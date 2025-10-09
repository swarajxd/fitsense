// src/pages/Inbox.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import "./Inbox.css";
import Header from "../components/header";
import { FaPaperPlane } from "react-icons/fa";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "../lib/supabaseClient";

const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:7000";

function debounce(fn, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      fn(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
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

function makeRoomId(userId1, userId2) {
  return [userId1, userId2].sort().join("_");
}

function parseToDate(value) {
  if (!value) return null;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return new Date(Number(value));
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

function formatTime(timestamp) {
  const date = parseToDate(timestamp);
  if (!date) return "";
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

export default function Inbox() {
  const { user } = useUser();
  const currentUser = user
    ? {
        id: user.id,
        displayName:
          user.fullName ||
          user.username ||
          user.emailAddresses?.[0]?.emailAddress ||
          "You",
      }
    : { id: "anon", displayName: "You" };

  const [conversations, setConversations] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [messages, setMessages] = useState({});
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const realtimeChannelRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages[selectedRoomId]]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!currentUser?.id || currentUser.id === "anon") return;

    setLoading(true);
    try {
      const res = await fetch(
        `${base}/api/conversations?userId=${encodeURIComponent(currentUser.id)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const convos = (data.conversations || [])
        .filter((conv) => conv && conv.roomId)
        .map((conv) => ({
          roomId: conv.roomId,
          otherId: conv.otherId,
          otherDisplayName: conv.otherDisplayName || conv.otherId,
          lastMessage: conv.lastMessage || "",
          lastMessageTime: conv.lastMessageTime || conv.createdAt,
          createdAt: conv.createdAt,
        }));

      setConversations(convos);

      if (convos.length > 0 && !selectedRoomId) {
        setSelectedRoomId(convos[0].roomId);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, selectedRoomId]);

  // Load messages for a room
  const loadMessages = useCallback(async (roomId) => {
    if (!roomId) return;

    try {
      const res = await fetch(`${base}/api/messages?roomId=${encodeURIComponent(roomId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const roomMessages = (data.messages || []).sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );

      setMessages((prev) => ({ ...prev, [roomId]: roomMessages }));

      if (roomMessages.length > 0) {
        const lastMsg = roomMessages[roomMessages.length - 1];
        setConversations((prev) =>
          prev.map((conv) =>
            conv.roomId === roomId
              ? {
                  ...conv,
                  lastMessage: lastMsg.text,
                  lastMessageTime: lastMsg.created_at,
                }
              : conv
          )
        );
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }, []);

  // Setup Supabase realtime subscription
  useEffect(() => {
    if (!selectedRoomId) return;

    // Clean up previous subscription
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    // Subscribe to new messages in the selected room
    const channel = supabase
      .channel(`room:${selectedRoomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${selectedRoomId}`,
        },
        (payload) => {
          const newMsg = payload.new;
          
          setMessages((prev) => {
            const currentMessages = prev[selectedRoomId] || [];
            const exists = currentMessages.some((msg) => msg.id === newMsg.id);
            if (exists) return prev;

            const updatedMessages = [...currentMessages, newMsg].sort(
              (a, b) => new Date(a.created_at) - new Date(b.created_at)
            );

            return { ...prev, [selectedRoomId]: updatedMessages };
          });

          setConversations((prev) => {
            const updated = prev.map((conv) =>
              conv.roomId === selectedRoomId
                ? {
                    ...conv,
                    lastMessage: newMsg.text,
                    lastMessageTime: newMsg.created_at,
                  }
                : conv
            );
            return updated.sort(
              (a, b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0)
            );
          });
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [selectedRoomId]);

  // Search users
  const searchUsers = useCallback(
    debounce(async (searchQuery) => {
      if (!searchQuery || searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      try {
        const res = await fetch(`${base}/api/users?q=${encodeURIComponent(searchQuery)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const users = await res.json();
        setSearchResults(users || []);
      } catch (err) {
        console.error("Search failed:", err);
        setSearchResults([]);
      }
    }, 300),
    []
  );

  // Create conversation
  const startConversation = async (selectedUser) => {
    const roomId = makeRoomId(currentUser.id, selectedUser.id);

    const existing = conversations.find((c) => c.roomId === roomId);
    if (existing) {
      setSelectedRoomId(roomId);
      setQuery("");
      setSearchResults([]);
      if (!messages[roomId] || messages[roomId].length === 0) {
        await loadMessages(roomId);
      }
      return;
    }

    try {
      const conversationData = {
        roomId,
        participantId: selectedUser.id,
        participantDisplayName: selectedUser.displayName || selectedUser.username || selectedUser.id,
      };

      const res = await fetch(`${base}/api/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...conversationData, userId: currentUser.id }),
      });

      if (!res.ok) {
        let errBody;
        try {
          errBody = await res.json();
        } catch (e) {
          errBody = await res.text().catch(() => `HTTP ${res.status}`);
        }
        console.error("Failed to create conversation:", res.status, errBody);
        return;
      }

      const newConv = {
        roomId,
        otherId: selectedUser.id,
        otherDisplayName: selectedUser.displayName || selectedUser.username || selectedUser.id,
        lastMessage: "",
        lastMessageTime: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      setConversations((prev) => [newConv, ...prev]);
      setSelectedRoomId(roomId);
      setMessages((prev) => ({ ...prev, [roomId]: [] }));
      setQuery("");
      setSearchResults([]);

      await loadMessages(roomId);
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err) {
      console.error("Error creating conversation:", err);
    }
  };

  // Send message
  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!selectedRoomId || !messageText.trim() || sending) return;

    const text = messageText.trim();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const optimisticMessage = {
      id: tempId,
      room_id: selectedRoomId,
      from_id: currentUser.id,
      from_name: currentUser.displayName,
      text,
      created_at: new Date().toISOString(),
      sending: true,
    };

    setMessages((prev) => ({
      ...prev,
      [selectedRoomId]: [...(prev[selectedRoomId] || []), optimisticMessage],
    }));

    setMessageText("");
    setSending(true);

    try {
      const messageData = {
        roomId: selectedRoomId,
        text,
        userId: currentUser.id,
      };

      const res = await fetch(`${base}/api/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messageData),
      });

      if (!res.ok) {
        let errBody;
        try {
          errBody = await res.json();
        } catch (e) {
          errBody = await res.text().catch(() => `HTTP ${res.status}`);
        }
        console.error("Failed to send message:", errBody);

        setMessages((prev) => ({
          ...prev,
          [selectedRoomId]: (prev[selectedRoomId] || []).filter((m) => m.id !== tempId),
        }));

        return;
      }

      const json = await res.json();

      if (json && json.message) {
        setMessages((prev) => {
          const roomMsgs = (prev[selectedRoomId] || []).filter((m) => m.id !== tempId);
          return { ...prev, [selectedRoomId]: [...roomMsgs, json.message] };
        });
      }
    } catch (err) {
      console.error("Send message exception:", err);
      setMessages((prev) => ({
        ...prev,
        [selectedRoomId]: (prev[selectedRoomId] || []).filter((m) => m.id !== tempId),
      }));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedRoomId) {
      loadMessages(selectedRoomId);
    }
  }, [selectedRoomId, loadMessages]);

  useEffect(() => {
    searchUsers(query);
  }, [query, searchUsers]);

  const selectedConversation = conversations.find((c) => c.roomId === selectedRoomId);
  const currentMessages = messages[selectedRoomId] || [];

  return (
    <div className="fs-inbox-root">
      <Header />

      <div className="fs-inbox-header">
        <h2>Messages</h2>
      </div>

      <div className="fs-inbox-body">
        <aside className="fs-left-col">
          <div className="fs-left-top">
            <div className="fs-search">
              <svg className="fs-search-icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M21 21l-4.35-4.35" />
                <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1" fill="none" />
              </svg>
              <input
                placeholder="Search users to start chatting..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="fs-list" role="list">
            {query && searchResults.length > 0 && (
              <div key="search-section">
                <div style={{ padding: "8px 12px", color: "#666", fontSize: 13, fontWeight: 600 }}>
                  Search Results
                </div>
                {searchResults.map((user) => (
                  <div
                    key={`search-${user.id}`}
                    className="fs-list-item"
                    onClick={() => startConversation(user)}
                    style={{ cursor: "pointer" }}
                  >
                    <Avatar name={user.displayName || user.username} />
                    <div className="fs-list-meta">
                      <div className="fs-list-top">
                        <div className="fs-name">{user.displayName || user.username}</div>
                      </div>
                      <div className="fs-preview">
                        <span className="fs-last-msg">Start a conversation</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {loading && <div className="fs-empty" key="loading">Loading conversations...</div>}

            {!query && !loading && conversations.length === 0 && (
              <div className="fs-empty" key="empty">
                No conversations yet. Search above to start chatting!
              </div>
            )}

            {!query &&
              conversations.map((conv) => (
                <div
                  key={`conv-${conv.roomId}`}
                  className={`fs-list-item ${selectedRoomId === conv.roomId ? "selected" : ""}`}
                  onClick={() => setSelectedRoomId(conv.roomId)}
                  style={{ cursor: "pointer" }}
                >
                  <Avatar name={conv.otherDisplayName} />
                  <div className="fs-list-meta">
                    <div className="fs-list-top">
                      <div className="fs-name">{conv.otherDisplayName}</div>
                      <div className="fs-time">{formatTime(conv.lastMessageTime)}</div>
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
                    <div className="fs-convo-sub">Active now</div>
                  </div>
                </div>
              </div>

              <div className="fs-convo-body">
                {currentMessages.map((msg) => (
                  <div
                    key={`msg-${msg.id}`}
                    className={`fs-msg ${msg.from_id === currentUser.id ? "from-me" : "from-them"}`}
                  >
                    <div className="fs-msg-bubble">
                      {msg.text}
                      {msg.sending && (
                        <span style={{ opacity: 0.6, fontSize: 11, marginLeft: 8 }}>Sending...</span>
                      )}
                    </div>
                    <div className="fs-msg-time">
                      {parseToDate(msg.created_at)
                        ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : ""}
                    </div>
                  </div>
                ))}
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