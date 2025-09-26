import React, { useEffect, useRef, useState, useCallback } from "react";
import "./Inbox.css";
import Header from "../components/header";
import { FaPaperPlane } from "react-icons/fa";
import Pusher from "pusher-js";
import { useUser } from "@clerk/clerk-react"; // Clerk frontend hook

// simple debounce helper
function debounce(fn, wait = 300) {
  let t;
  const debounced = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(t);
  return debounced;
}

// helper avatar
function Avatar({ name, color }) {
  const initials = (name || "U")
    .split(" ")
    .map(n => n[0] || "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return <div className="fs-avatar" style={{ background: color || "#444" }}>{initials}</div>;
}

export default function Inbox() {
  const { user } = useUser(); // Clerk user (must be signed in)
  const currentUser = user ? { id: user.id, displayName: user.fullName || user.username || user.emailAddresses?.[0]?.emailAddress } : { id: "anon", displayName: "You" };

  // UI state
  const [conversations, setConversations] = useState([]); // { roomId, otherId, otherDisplayName, otherImage, createdAt }
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [messagesMap, setMessagesMap] = useState({}); // { roomId: [messages...] }
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [composeText, setComposeText] = useState("");
  const [loadingConvos, setLoadingConvos] = useState(false);

  // pusher reference
  const pusherRef = useRef(null);
  const subscribedChannelRef = useRef(null);
  const messagesRefEl = useRef(null);

  // initialize Pusher client (authEndpoint is server route that will use clerk to auth)
useEffect(() => {
  const key = import.meta.env.VITE_PUSHER_KEY;
  const cluster = import.meta.env.VITE_PUSHER_CLUSTER;
  if (!key || !cluster) {
    console.warn("PUSHER client config missing in env — real-time disabled.");
    return;
  }

  // If using Clerk, get token to forward to server auth endpoint:
  let authHeaders = { "Content-Type": "application/x-www-form-urlencoded" }; // pusher expects urlencoded by default
  if (user) {
    // clerk's SDK: user.getToken() returns a token; ensure you have @clerk/clerk-react user object available
    user.getToken && user.getToken().then(t => {
      authHeaders.Authorization = `Bearer ${t}`;
      // init pusher after you have the token
      const pusher = new Pusher(key, {
        cluster,
        authEndpoint: "/api/pusher/auth",
        auth: { headers: authHeaders },
        forceTLS: true,
      });
      pusherRef.current = pusher;
    }).catch(err => {
      console.warn('could not get clerk token for pusher auth', err);
      const pusher = new Pusher(key, {
        cluster,
        authEndpoint: "/api/pusher/auth",
        forceTLS: true,
      });
      pusherRef.current = pusher;
    });
  } else {
    const pusher = new Pusher(key, {
      cluster,
      authEndpoint: "/api/pusher/auth",
      forceTLS: true,
    });
    pusherRef.current = pusher;
  }

  return () => {
    try { pusherRef.current && pusherRef.current.disconnect(); } catch (e) {}
    pusherRef.current = null;
  };
}, [user]);


  // helper to scroll convo to bottom
  useEffect(() => {
    if (!selectedRoomId) return;
    setTimeout(() => {
      if (messagesRefEl.current) messagesRefEl.current.scrollTop = messagesRefEl.current.scrollHeight;
    }, 100);
  }, [messagesMap, selectedRoomId]);

  // load conversations when currentUser is available
  useEffect(() => {
    if (!currentUser?.id) return;
    async function loadConvos() {
      setLoadingConvos(true);
      try {
        const res = await fetch(`/api/conversations?userId=${encodeURIComponent(currentUser.id)}`);
        if (!res.ok) throw new Error("Failed to fetch convos");
        const json = await res.json();
        setConversations(json.conversations || []);
        if ((json.conversations || []).length > 0 && !selectedRoomId) {
          setSelectedRoomId(json.conversations[0].roomId);
        }
      } catch (err) {
        console.error("Load convos error", err);
      } finally {
        setLoadingConvos(false);
      }
    }
    loadConvos();
  }, [currentUser?.id]);

  // load messages when selecting a room (persistence)
  useEffect(() => {
    if (!selectedRoomId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/messages?roomId=${encodeURIComponent(selectedRoomId)}`);
        if (!r.ok) throw new Error("Failed to load messages");
        const json = await r.json();
        if (!cancelled) {
          setMessagesMap(prev => ({ ...prev, [selectedRoomId]: json.messages || [] }));
        }
      } catch (err) {
        console.error("load messages error", err);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedRoomId]);

  // subscribe to Pusher for the selected conversation's roomId (real-time)
  useEffect(() => {
    const pusher = pusherRef.current;
    if (!pusher) return;

    // unsubscribe previous
    if (subscribedChannelRef.current) {
      try {
        pusher.unsubscribe(subscribedChannelRef.current);
      } catch (e) {}
      subscribedChannelRef.current = null;
    }

    if (!selectedRoomId) return;

    const channelName = `private-chat_${selectedRoomId}`;
    subscribedChannelRef.current = channelName;

    const channel = pusher.subscribe(channelName);

    const handler = (msg) => {
      // append incoming message
      setMessagesMap(prev => {
        const prevList = prev[selectedRoomId] || [];
        // dedupe by id
        if (prevList.some(m => m.id === msg.id)) return prev;
        return { ...prev, [selectedRoomId]: [...prevList, msg] };
      });
    };

    channel.bind("message", handler);

    return () => {
      try {
        channel.unbind("message", handler);
        pusher.unsubscribe(channelName);
      } catch (e) {}
    };
  }, [selectedRoomId]);

  // scroll whenever messages change
  useEffect(() => {
    if (!selectedRoomId) return;
    const node = messagesRefEl.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messagesMap, selectedRoomId]);

  // search users (debounced)
  const doSearch = useCallback(debounce(async (q) => {
    if (!q || q.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    try {
      const r = await fetch(`/api/users?q=${encodeURIComponent(q)}`);
      if (!r.ok) throw new Error("search failed");
      const list = await r.json();
      setSearchResults(list || []);
    } catch (err) {
      console.error("search error", err);
    }
  }, 300), []);

  useEffect(() => {
    doSearch(query);
  }, [query, doSearch]);

  // create/start conversation with a searched user
  async function startConversationWith(userObj) {
    try {
      const body = { participantId: userObj.id, participantDisplayName: userObj.displayName || userObj.username, participantImage: userObj.imageUrl || null };
      const res = await fetch(`/api/conversations?userId=${encodeURIComponent(currentUser.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`failed to create conversation: ${txt}`);
      }
      const json = await res.json();
      const roomId = json.roomId;
      // add to local conversations list (optimistic)
      setConversations(prev => {
        if (prev.some(c => c.roomId === roomId)) return prev;
        return [{ roomId, otherId: userObj.id, otherDisplayName: userObj.displayName, otherImage: userObj.imageUrl, createdAt: Date.now() }, ...prev];
      });
      // open the convo (this will also load messages)
      setSelectedRoomId(roomId);
      setSearchResults([]);
      setQuery("");
    } catch (err) {
      console.error("start convo error", err);
    }
  }

  // send message via server (server will trigger pusher and save)
  async function sendMessage(e) {
    e?.preventDefault?.();
    if (!selectedRoomId || !composeText.trim()) return;
    const text = composeText.trim();

    // optimistic UI: append local message (id prefixed local_)
    const localMsg = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      fromId: currentUser.id,
      fromName: currentUser.displayName || "You",
      text,
      createdAt: Date.now(),
    };
    setMessagesMap(prev => {
      const prevList = prev[selectedRoomId] || [];
      return { ...prev, [selectedRoomId]: [...prevList, localMsg] };
    });
    setComposeText("");

    try {
      const res = await fetch(`/api/messages?userId=${encodeURIComponent(currentUser.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: selectedRoomId, text }),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("send message failed:", txt);
        return;
      }
      const json = await res.json();
      // Replace optimistic message with canonical payload if returned
      if (json.payload && json.payload.id) {
        setMessagesMap(prev => {
          const list = (prev[selectedRoomId] || []).map(m => (m.id === localMsg.id ? json.payload : m));
          return { ...prev, [selectedRoomId]: list };
        });
      }
    } catch (err) {
      console.error("send error", err);
    }
  }

  // helpers to display conversation name & room mapping
  const selectedConvo = conversations.find(c => c.roomId === selectedRoomId);

  return (
    <div className="fs-inbox-root">
      <Header />

      <div className="fs-inbox-header">
        <h2>Inbox</h2>
        <div className="fs-header-controls">
          <button className="fs-btn new-convo">+ New Conversation</button>
        </div>
      </div>

      <div className="fs-inbox-body">
        <aside className="fs-left-col">
          <div className="fs-left-top">
            <div className="fs-tabs" role="tablist" aria-label="message tabs">
              <button className={`fs-tab`}>All Messages</button>
              <button className={`fs-tab`}>Unread</button>
            </div>

            <div className="fs-search">
              <svg className="fs-search-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path fill="currentColor" d="M21 21l-4.35-4.35"></path>
                <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1" fill="none"></circle>
              </svg>
              <input
                placeholder="Search users by name or username"
                aria-label="Search users"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="fs-list" role="list">
            {/* search results take precedence */}
            {query && searchResults.length > 0 && (
              <>
                <div style={{ padding: "8px 6px", color: "var(--muted)", fontSize: 13 }}>Search results</div>
                {searchResults.map(u => (
                  <div key={u.id} className="fs-list-item" onClick={() => startConversationWith(u)} role="button">
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div className="fs-avatar" style={{ background: "#2d2d2d" }}>{(u.displayName||u.username||"U")[0]?.toUpperCase()}</div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontWeight: 700 }}>{u.displayName || u.username}</div>
                        <div style={{ color: "var(--muted)", fontSize: 12 }}>@{u.username || (u.email || "").split("@")[0]}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* conversations list */}
            {loadingConvos && <div className="fs-empty">Loading conversations…</div>}
            {!query && conversations.length === 0 && <div className="fs-empty">No conversations — start one by searching above</div>}
            {!query && conversations.map(c => (
              <div
                key={c.roomId}
                className={`fs-list-item ${selectedRoomId === c.roomId ? "selected" : ""}`}
                onClick={() => { setSelectedRoomId(c.roomId); }}
                role="listitem"
              >
                <Avatar name={c.otherDisplayName || c.otherId} color="#2b2b2b" />
                <div className="fs-list-meta">
                  <div className="fs-list-top">
                    <div className="fs-name">{c.otherDisplayName || c.otherId}</div>
                    <div className="fs-time">{new Date(c.createdAt || Date.now()).toLocaleDateString()}</div>
                  </div>
                  <div className="fs-preview">
                    <span className="fs-last-msg">Conversation</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="fs-right-col">
          <div className="fs-convo-header">
            <div className="fs-convo-left">
              <Avatar name={selectedConvo?.otherDisplayName || "No one"} color="#333" />
              <div className="fs-convo-title">
                <div className="fs-convo-name">{selectedConvo?.otherDisplayName || "Select a conversation"}</div>
                <div className="fs-convo-sub">{selectedConvo ? ("@" + (selectedConvo.otherId || "").slice(0,8)) : ""} • Active</div>
              </div>
            </div>
            <div className="fs-convo-actions">
              <button className="icon-btn" title="More">⋯</button>
            </div>
          </div>

          <div className="fs-convo-body" ref={messagesRefEl}>
            {(!selectedRoomId) && <div className="fs-empty">Select a conversation to view messages</div>}

            {selectedRoomId && (messagesMap[selectedRoomId] || []).map((m) => (
              <div key={m.id} className={`fs-msg ${m.fromId === currentUser.id ? "from-me" : "from-them"}`}>
                <div className="fs-msg-bubble">{m.text}</div>
                <div className="fs-msg-time">{new Date(m.createdAt).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>

          <form className="fs-composer" onSubmit={sendMessage}>
            <input
              className="fs-input"
              placeholder={selectedConvo ? `Message ${selectedConvo.otherDisplayName}...` : "Select a user to message"}
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              disabled={!selectedRoomId}
            />
            <div className="fs-composer-actions">
              <button type="button" className="icon-btn" title="Attach">+</button>
              <button type="submit" className="fs-send-btn" disabled={!selectedRoomId || !composeText.trim()}>
                <FaPaperPlane />
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}