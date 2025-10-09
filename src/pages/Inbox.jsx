// src/pages/Inbox.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import "./Inbox.css";
import Header from "../components/header";
import { FaPaperPlane } from "react-icons/fa";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "../lib/supabaseClient";

const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:7000";

/* -------------------- helpers -------------------- */
function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function Avatar({ name, color = "#2b2b2b" }) {
  const initials = (name || "U")
    .split(" ")
    .map((n) => n[0] || "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="fs-avatar" style={{ background: color }}>
      {initials}
    </div>
  );
}

function makeRoomId(a, b) {
  return [a, b].sort().join("_");
}

function parseToDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function humanDateLabel(date) {
  if (!date) return "";
  const d = parseToDate(date);
  if (!d) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";

  // e.g. "Sep 7, 2025"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function formatTime12(date) {
  const d = parseToDate(date);
  if (!d) return "";
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const mm = minutes < 10 ? `0${minutes}` : `${minutes}`;
  const hh = hours < 10 ? `${hours}` : `${hours}`;
  return `${hh}:${mm} ${ampm}`;
}

/* -------------------- component -------------------- */
export default function Inbox() {
  const { user } = useUser();

  // prefer username (unique) then fullName then email
  const currentUser = user
    ? {
        id: user.id,
        displayName: user.username || user.fullName || user.emailAddresses?.[0]?.emailAddress || "You",
      }
    : { id: "anon", displayName: "You" };

  const [conversations, setConversations] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [messagesMap, setMessagesMap] = useState({}); // { roomId: [msgs] }
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const realtimeChannelRef = useRef(null);

  /* -------------------- scroll -------------------- */
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 80);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messagesMap, selectedRoomId, scrollToBottom]);

/* -------------------- load conversations (fixed) -------------------- */
const loadConversations = useCallback(async () => {
  if (!currentUser?.id || currentUser.id === "anon") return;
  setLoading(true);
  try {
    const res = await fetch(`${base}/api/conversations?userId=${encodeURIComponent(currentUser.id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    let convos = (json.conversations || []).filter(Boolean);

    // helper: extract otherId reliably
    const getOtherId = (c) => {
      if (c.otherId) return c.otherId;
      if (c.other_id) return c.other_id;
      if (c.participantId) return c.participantId;
      if (c.participant_id) return c.participant_id;
      // Supabase style: participant_a + participant_b
      if (c.participant_a && c.participant_b) return c.participant_a === currentUser.id ? c.participant_b : c.participant_a;
      // file fallback shape: otherId / other
      if (c.other) return c.other;
      return null;
    };

    // Defensive filter: remove self convos (but compute otherId correctly)
    convos = convos.filter((c) => {
      const otherId = getOtherId(c);
      return otherId && otherId !== currentUser.id;
    });

    // normalize fields & build stable roomId
    const norm = convos.map((c) => {
      const otherId = getOtherId(c) || null;

      // derive a stable roomId: prefer explicit IDs from server, else compute
      const roomId = c.roomId || c.room_id || c.id || c.conversationId || (otherId ? makeRoomId(currentUser.id, otherId) : null);

      const otherDisplayName =
        c.otherDisplayName ||
        c.other_display_name ||
        c.displayName ||
        c.display_name ||
        c.display_name_a ||
        c.display_name_b ||
        c.full_name ||
        c.username ||
        otherId ||
        "Unknown";

      const lastMessage =
        c.lastMessage ||
        c.last_message ||
        c.preview ||
        c.last_message_text ||
        c.last_msg ||
        "";

      const lastMessageTime =
        c.lastMessageTime ||
        c.last_message_time ||
        c.last_message_at ||
        c.last_message_ts ||
        c.lastMessageAt ||
        c.createdAt ||
        c.created_at ||
        null;

      const createdAt = c.createdAt || c.created_at || null;

      return { roomId, otherId, otherDisplayName, lastMessage, lastMessageTime, createdAt, _raw: c };
    });

    // Remove entries that still somehow lack a roomId
    const filteredNorm = norm.filter((n) => !!n.roomId);

    // Sort by lastMessageTime desc (fallback to createdAt)
    filteredNorm.sort((a, b) => {
      const ta = parseToDate(a.lastMessageTime) || parseToDate(a.createdAt) || new Date(0);
      const tb = parseToDate(b.lastMessageTime) || parseToDate(b.createdAt) || new Date(0);
      return tb - ta;
    });

    setConversations((prev) => {
      const seen = new Set(filteredNorm.map((n) => n.roomId));
      const merged = [...filteredNorm];
      prev.forEach((p) => {
        if (!seen.has(p.roomId)) merged.push(p);
      });
      return merged;
    });

    // If nothing selected or selectedRoomId isn't in the list anymore, pick first
    const hasSelected = filteredNorm.some((c) => c.roomId === selectedRoomId);
    if ((!selectedRoomId || !hasSelected) && filteredNorm.length > 0) {
      setSelectedRoomId(filteredNorm[0].roomId);
    }
  } catch (err) {
    console.error("Failed to load conversations:", err);
  } finally {
    setLoading(false);
  }
}, [currentUser?.id, selectedRoomId]);

  /* -------------------- load messages for a room -------------------- */
  const loadMessages = useCallback(
    async (roomId) => {
      if (!roomId) return;
      try {
        const res = await fetch(`${base}/api/messages?roomId=${encodeURIComponent(roomId)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const list = (json.messages || []).map((m) => ({
          id: m.id,
          text: m.text,
          fromId: m.from_id || m.fromId || m.fromId,
          fromName: m.from_name || m.fromName || m.fromName,
          createdAt: m.created_at || m.createdAt || m.createdAt,
        })).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        setMessagesMap((prev) => ({ ...prev, [roomId]: list }));
      } catch (err) {
        console.error("Failed to load messages:", err);
      }
    },
    []
  );

  /* -------------------- Supabase realtime subscription -------------------- */
  useEffect(() => {
    if (!selectedRoomId) return;

    // cleanup previous
    if (realtimeChannelRef.current) {
      try {
        supabase.removeChannel(realtimeChannelRef.current);
      } catch (e) {
        console.warn("removeChannel error", e);
      }
      realtimeChannelRef.current = null;
    }

    // subscribe to room messages INSERTs
    const channel = supabase
      .channel(`room:${selectedRoomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${selectedRoomId}` },
        (payload) => {
          const m = payload.new;
          if (!m || !m.id) return;

          const msg = {
            id: m.id,
            text: m.text,
            fromId: m.from_id,
            fromName: m.from_name,
            createdAt: m.created_at,
          };

          setMessagesMap((prev) => {
            const curr = prev[selectedRoomId] || [];
            if (curr.some((x) => x.id === msg.id)) return prev;
            const next = [...curr, msg].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            return { ...prev, [selectedRoomId]: next };
          });

          // update convos summary & move to top
          setConversations((prev) => {
            let updated = prev.map((conv) =>
              conv.roomId === selectedRoomId
                ? { ...conv, lastMessage: msg.text, lastMessageTime: msg.createdAt }
                : conv
            );
            updated = updated.sort((a, b) => (parseToDate(b.lastMessageTime) || 0) - (parseToDate(a.lastMessageTime) || 0));
            return updated;
          });
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        try {
          supabase.removeChannel(realtimeChannelRef.current);
        } catch (e) {
          console.warn("removeChannel error on cleanup", e);
        }
        realtimeChannelRef.current = null;
      }
    };
  }, [selectedRoomId]);

  /* -------------------- search users (debounced) -------------------- */
  // debounce wrapper: memoize the handler so effects can call it
  const doSearch = useCallback(
    debounce(async (q) => {
      if (!q || q.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      try {
        const res = await fetch(`${base}/api/users?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const list = await res.json();

        // Normalize results so each item has a stable `id` and `displayName`
        const normalized = (list || []).map((u, idx) => {
          const id = u.id || u.userId || u.username || u.email || `unknown-${idx}`;
          const displayName = u.displayName || u.full_name || u.username || id;
          return {
            ...u,
            id,
            username: u.username || null,
            displayName,
            imageUrl: u.imageUrl || u.avatar_url || u.profileImageUrl || null,
          };
        });

        setSearchResults(normalized.filter(Boolean));
      } catch (err) {
        console.error("Search users failed:", err);
        setSearchResults([]);
      }
    }, 300),
    []
  );

  useEffect(() => {
    doSearch(query);
  }, [query, doSearch]);

/* -------------------- start a conversation (robust) -------------------- */
const startConversation = async (selectedUser) => {
  if (!selectedUser || !currentUser?.id) return;

  // stable id pick for the other user
  const otherId = selectedUser.id || selectedUser.userId || selectedUser.username || selectedUser.email || selectedUser.displayName;
  if (!otherId) {
    console.warn("startConversation: selectedUser missing id:", selectedUser);
    return;
  }
  if (otherId === currentUser.id) return; // don't create self convo

  const desiredRoomId = makeRoomId(currentUser.id, otherId);

  // If we already have this convo locally, just open it and ensure messages are loaded
  const existing = conversations.find((c) => c.roomId === desiredRoomId);
  if (existing) {
    setSelectedRoomId(desiredRoomId);
    setQuery("");
    setSearchResults([]);
    // ensure messages are loaded
    await loadMessages(desiredRoomId);
    return;
  }

  // optimistic entry so user sees the convo appear immediately
  const optimisticConv = {
    roomId: desiredRoomId,
    otherId,
    otherDisplayName: selectedUser.username || selectedUser.displayName || otherId,
    lastMessage: "",
    lastMessageTime: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    _optimistic: true,
  };

  // put optimistic at top
  setConversations((prev) =>
    [optimisticConv, ...prev.filter((c) => c.roomId !== desiredRoomId)].sort(
      (a, b) =>
        (parseToDate(b.lastMessageTime) || parseToDate(b.createdAt) || 0) -
        (parseToDate(a.lastMessageTime) || parseToDate(a.createdAt) || 0)
    )
  );

  // open it locally immediately
  setSelectedRoomId(desiredRoomId);
  setMessagesMap((prev) => ({ ...prev, [desiredRoomId]: prev[desiredRoomId] || [] }));
  setQuery("");
  setSearchResults([]);
  setTimeout(() => inputRef.current?.focus(), 120);

  // send create convo request to server and reconcile
  try {
    const res = await fetch(`${base}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUser.id,
        participantId: otherId,
        participantDisplayName: selectedUser.username || selectedUser.displayName || otherId,
        roomId: desiredRoomId, // server may accept or return canonical roomId
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Failed creating conversation", res.status, text);
      return;
    }

    const json = await res.json().catch(() => ({}));
    // server may return `roomId` or `{ roomId: '...' }` etc; prefer server value if present
    const serverRoomId = json.roomId || json.id || desiredRoomId;

    // If the server returned a different roomId, migrate optimistic conversation & messagesMap
    if (serverRoomId !== desiredRoomId) {
      setConversations((prev) =>
        prev.map((c) =>
          c.roomId === desiredRoomId ? { ...c, roomId: serverRoomId, _optimistic: false } : c
        )
      );

      setMessagesMap((prev) => {
        if (!prev[desiredRoomId]) {
          // nothing to migrate
          return { ...prev, [serverRoomId]: prev[serverRoomId] || [] };
        }
        const copy = { ...prev };
        copy[serverRoomId] = [...(copy[serverRoomId] || []), ...(copy[desiredRoomId] || [])];
        // remove duplicate ids and sort
        copy[serverRoomId] = Array.from(new Map(copy[serverRoomId].map(m => [m.id, m])).values()).sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        delete copy[desiredRoomId];
        return copy;
      });

      // ensure UI selects the canonical server room id
      setSelectedRoomId(serverRoomId);
    } else {
      // mark optimistic as confirmed
      setConversations((prev) =>
        prev.map((c) => (c.roomId === desiredRoomId ? { ...c, _optimistic: false } : c))
      );
      setSelectedRoomId(desiredRoomId);
    }

    // refresh server conversations (ensures canonical names/times)
    await loadConversations();

    // always load messages for canonical room id
    await loadMessages(serverRoomId || desiredRoomId);
  } catch (err) {
    console.error("startConversation error", err);
  }
};

  /* -------------------- send message (optimistic) -------------------- */
  const sendMessage = async (e) => {
    e?.preventDefault?.();
    if (!selectedRoomId || !messageText.trim() || sending) return;

    const text = messageText.trim();
    const tempId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const optimistic = {
      id: tempId,
      text,
      fromId: currentUser.id,
      fromName: currentUser.displayName,
      createdAt: new Date().toISOString(),
      _optimistic: true,
    };

    setMessagesMap((prev) => {
      const curr = prev[selectedRoomId] || [];
      return { ...prev, [selectedRoomId]: [...curr, optimistic] };
    });
    setMessageText("");
    setSending(true);
    scrollToBottom();

    try {
      const res = await fetch(`${base}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, roomId: selectedRoomId, text }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("Send message failed:", res.status, txt);
        // remove optimistic message
        setMessagesMap((prev) => ({ ...prev, [selectedRoomId]: (prev[selectedRoomId] || []).filter((m) => m.id !== tempId) }));
        return;
      }

      const json = await res.json();
      const serverMsg = (json.message || json.payload || null);
      if (serverMsg && serverMsg.id) {
        const normalized = {
          id: serverMsg.id,
          text: serverMsg.text,
          fromId: serverMsg.from_id || serverMsg.fromId,
          fromName: serverMsg.from_name || serverMsg.fromName,
          createdAt: serverMsg.created_at || serverMsg.createdAt,
        };

        setMessagesMap((prev) => {
          const curr = (prev[selectedRoomId] || []).filter((m) => m.id !== tempId);
          return { ...prev, [selectedRoomId]: [...curr, normalized].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)) };
        });

        // update convos list
        setConversations((prev) =>
          prev
            .map((conv) => (conv.roomId === selectedRoomId ? { ...conv, lastMessage: normalized.text, lastMessageTime: normalized.createdAt } : conv))
            .sort((a, b) => (parseToDate(b.lastMessageTime) || 0) - (parseToDate(a.lastMessageTime) || 0))
        );
      } else {
        // If server doesn't return the new message, we rely on realtime or reloading messages
        await loadMessages(selectedRoomId);
      }
    } catch (err) {
      console.error("sendMessage exception", err);
      setMessagesMap((prev) => ({ ...prev, [selectedRoomId]: (prev[selectedRoomId] || []).filter((m) => m.id !== tempId) }));
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  };

  /* -------------------- effects -------------------- */
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedRoomId) {
      loadMessages(selectedRoomId);
    }
  }, [selectedRoomId, loadMessages]);

  /* fire search effect (already handled by debounce wrapper) */
  useEffect(() => {
    // handled by doSearch via query effect earlier
  }, [query]);

  /* -------------------- rendering helpers -------------------- */
  const selectedConversation = conversations.find((c) => c.roomId === selectedRoomId);
  const currentMessages = messagesMap[selectedRoomId] || [];

  return (
    <div className="fs-inbox-root">
      <Header />

      <div className="fs-inbox-header">
        <h2>Inbox</h2>
      </div>

      <div className="fs-inbox-body">
        <aside className="fs-left-col">
          <div className="fs-left-top">
            <div className="fs-search">
              <svg className="fs-search-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path fill="currentColor" d="M21 21l-4.35-4.35"></path>
                <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1" fill="none"></circle>
              </svg>
              <input
                placeholder="Search users to start chatting..."
                aria-label="Search users"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="fs-list" role="list">
            {query && searchResults.length > 0 && (
              <div key="search-section">
                <div style={{ padding: "8px 12px", color: "var(--muted)", fontSize: 13, fontWeight: 700 }}>
                  Search Results
                </div>
                {searchResults.map((u) => (
                  <div
                    key={`search-${u.id}`}
                    className="fs-list-item"
                    onClick={() => startConversation(u)}
                    role="button"
                  >
                    <Avatar name={u.username || u.displayName || u.id} />
                    <div className="fs-list-meta">
                      <div className="fs-list-top">
                        <div className="fs-name">{u.username || u.displayName || u.id}</div>
                      </div>
                      <div className="fs-preview"><span className="fs-last-msg">Start a conversation</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {loading && <div className="fs-empty">Loading conversations…</div>}

            {!query && !loading && conversations.length === 0 && (
              <div className="fs-empty">No conversations yet — search to start a chat</div>
            )}

            {!query &&
              conversations.map((conv) => (
                <div
                  key={`conv-${conv.roomId}`}
                  className={`fs-list-item ${selectedRoomId === conv.roomId ? "selected" : ""}`}
                  onClick={() => {
                    if (!conv.roomId) return;
                    setSelectedRoomId(conv.roomId);
                    loadMessages(conv.roomId);
                  }}
                  role="listitem"
                >
                  <Avatar name={conv.otherDisplayName} />
                  <div className="fs-list-meta">
                    <div className="fs-list-top">
                      <div className="fs-name">{conv.otherDisplayName}</div>
                      <div className="fs-time">{conv.lastMessageTime ? formatTime12(conv.lastMessageTime) : ""}</div>
                    </div>
                    <div className="fs-preview">
                      <span className="fs-last-msg">{conv.lastMessage || "No messages yet"}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </aside>

        <main className="fs-right-col">
          {selectedConversation ? (
            <>
              <div className="fs-convo-header">
                <div className="fs-convo-left">
                  <Avatar name={selectedConversation.otherDisplayName} />
                  <div className="fs-convo-title">
                    <div className="fs-convo-name">{selectedConversation.otherDisplayName}</div>
                    <div className="fs-convo-sub">@{selectedConversation.otherId}</div>
                  </div>
                </div>
              </div>

              <div className="fs-convo-body" aria-live="polite">
                {currentMessages.length === 0 && <div className="fs-empty">No messages yet. Say hi 👋</div>}

                {currentMessages.reduce((acc, msg) => {
                  // We'll build a flat array of nodes with date dividers inserted
                  const prev = acc.length > 0 ? acc[acc.length - 1] : null;
                  const prevMsg = prev && prev._isDivider ? null : prev;
                  const lastDate = prevMsg ? parseToDate(prevMsg.createdAt) : null;
                  const thisDate = parseToDate(msg.createdAt);

                  if (!prevMsg || !isSameDay(lastDate, thisDate)) {
                    // insert divider
                    acc.push({
                      _isDivider: true,
                      id: `div-${msg.id}-${(thisDate && thisDate.toDateString()) || 'nodate'}`,
                      label: humanDateLabel(thisDate),
                      createdAt: msg.createdAt,
                    });
                  }
                  acc.push(msg);
                  return acc;
                }, []).map((node) => {
                  if (node._isDivider) {
                    return (
                      <div key={node.id} className="fs-date-divider">
                        {node.label}
                      </div>
                    );
                  }
                  const isMe = node.fromId === currentUser.id;
                  return (
                    <div
                      key={node.id}
                      className={`fs-msg ${isMe ? "from-me" : "from-them"}`}
                    >
                      <div className="fs-msg-bubble">
                        {node.text}
                        {node._optimistic && <span style={{ opacity: 0.65, fontSize: 11, marginLeft: 8 }}>Sending…</span>}
                      </div>
                      <div className="fs-msg-time">{formatTime12(node.createdAt)}</div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <form className="fs-composer" onSubmit={sendMessage}>
                <input
                  ref={inputRef}
                  className="fs-input"
                  placeholder={`Message ${selectedConversation.otherDisplayName}...`}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  disabled={sending}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(e);
                    }
                  }}
                />
                <button type="submit" className="fs-send-btn" disabled={!messageText.trim() || sending}>
                  <FaPaperPlane />
                </button>
              </form>
            </>
          ) : (
            <div className="fs-empty">Select a conversation or search for someone to start chatting</div>
          )}
        </main>
      </div>
    </div>
  );
}
