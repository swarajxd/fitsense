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

  /* -------------------- load conversations -------------------- */
/* -------------------- load conversations -------------------- */
const loadConversations = useCallback(async () => {
  if (!currentUser?.id || currentUser.id === "anon") return;
  setLoading(true);
  try {
    const res = await fetch(`${base}/api/conversations?userId=${encodeURIComponent(currentUser.id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    let convos = (json.conversations || []).filter(Boolean);

    // Filter out self convos (defensive)
    convos = convos.filter((c) => c.otherId && c.otherId !== currentUser.id);

    // normalize fields & sort by lastMessageTime desc (fallback to createdAt)
    const norm = convos.map((c) => ({
      roomId: c.roomId,
      otherId: c.otherId,
      otherDisplayName: c.otherDisplayName || c.otherId,
      lastMessage: c.lastMessage || "",
      lastMessageTime: c.lastMessageTime || c.createdAt || null,
      createdAt: c.createdAt || null,
    }));

    norm.sort((a, b) => {
      const ta = parseToDate(a.lastMessageTime) || parseToDate(a.createdAt) || new Date(0);
      const tb = parseToDate(b.lastMessageTime) || parseToDate(b.createdAt) || new Date(0);
      return tb - ta;
    });

    setConversations((prev) => {
      // keep stable ordering but prefer server list; also avoid duplicate roomIds
      const seen = new Set(norm.map((n) => n.roomId));
      const merged = [...norm];
      // append any local-only convos that server didn't return (rare)
      prev.forEach((p) => {
        if (!seen.has(p.roomId)) merged.push(p);
      });
      return merged;
    });

    // If nothing selected or selectedRoomId isn't in the list anymore, pick first
    const hasSelected = norm.some((c) => c.roomId === selectedRoomId);
    if ((!selectedRoomId || !hasSelected) && norm.length > 0) {
      setSelectedRoomId(norm[0].roomId);
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

  /* -------------------- start a conversation -------------------- */
/* -------------------- start a conversation -------------------- */
const startConversation = async (selectedUser) => {
  if (!selectedUser || !currentUser?.id) return;

  // pick a reliable id for the other user (fallbacks if shape differs)
  const otherId = selectedUser.id || selectedUser.userId || selectedUser.username || selectedUser.email || selectedUser.displayName;
  if (!otherId) {
    console.warn('startConversation: selectedUser missing id:', selectedUser);
    return;
  }
  if (otherId === currentUser.id) return; // do not create self convo

  // desired local room id
  const desiredRoomId = makeRoomId(currentUser.id, otherId);

  // If a conversation already exists locally, open it immediately
  const existing = conversations.find((c) => c.roomId === desiredRoomId);
  if (existing) {
    setSelectedRoomId(desiredRoomId);
    setQuery("");
    setSearchResults([]);
    if (!messagesMap[desiredRoomId] || messagesMap[desiredRoomId].length === 0) {
      await loadMessages(desiredRoomId);
    }
    return;
  }

  // create an optimistic convo entry and open it immediately (avoids double-click)
  const optimisticConv = {
    roomId: desiredRoomId,
    otherId,
    otherDisplayName: selectedUser.username || selectedUser.displayName || otherId,
    lastMessage: "",
    lastMessageTime: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    _optimistic: true,
  };

  setConversations((prev) =>
    [optimisticConv, ...prev.filter((c) => c.roomId !== desiredRoomId)].sort(
      (a, b) => (parseToDate(b.lastMessageTime) || parseToDate(b.createdAt) || 0) - (parseToDate(a.lastMessageTime) || parseToDate(a.createdAt) || 0)
    )
  );

  setSelectedRoomId(desiredRoomId);
  setMessagesMap((prev) => ({ ...prev, [desiredRoomId]: prev[desiredRoomId] || [] }));
  setQuery("");
  setSearchResults([]);
  setTimeout(() => inputRef.current?.focus(), 120);

  // Fire create convo request in background and reconcile server response
  try {
    const res = await fetch(`${base}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUser.id,
        participantId: otherId,
        participantDisplayName: selectedUser.username || selectedUser.displayName || otherId,
        roomId: desiredRoomId, // server may return canonical roomId
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Failed creating conversation", res.status, text);
      return;
    }

    const json = await res.json().catch(() => ({}));
    const serverRoomId = json.roomId || desiredRoomId;

    // If server returned a different roomId, migrate optimistic convo & messagesMap key
    if (serverRoomId !== desiredRoomId) {
      setConversations((prev) =>
        prev.map((c) => (c.roomId === desiredRoomId ? { ...c, roomId: serverRoomId, _optimistic: false } : c))
      );
      setMessagesMap((prev) => {
        if (!prev[desiredRoomId]) return prev;
        const copy = { ...prev };
        copy[serverRoomId] = copy[desiredRoomId];
        delete copy[desiredRoomId];
        return copy;
      });
      setSelectedRoomId(serverRoomId);
    } else {
      // mark optimistic as confirmed
      setConversations((prev) => prev.map((c) => (c.roomId === desiredRoomId ? { ...c, _optimistic: false } : c)));
    }

    // Now refresh server conversations so we get canonical data and ordering
    await loadConversations();

    // Ensure messages are loaded for the (possibly migrated) room
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
                  onClick={() => setSelectedRoomId(conv.roomId)}
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
