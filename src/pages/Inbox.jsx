// src/pages/Inbox.jsx
import React, { useEffect, useRef, useState } from "react";
import Header from "../components/header";
import "./Inbox.css";
import { FaPaperPlane } from "react-icons/fa";

/**
 * Demo Inbox (toggle behavior)
 * - clicking the same user will close the chat (activeThread -> null)
 * - clicking another user opens that chat
 * - messages stored locally in messagesMap
 */

export default function Inbox() {
  const demoUsers = [
    { id: "user1", username: "user1", displayName: "User One" },
    { id: "user2", username: "user2", displayName: "User Two" },
    { id: "user3", username: "user3", displayName: "User Three" },
  ];

  const currentUser = { id: "me", username: "you", displayName: "You" };

  const [users] = useState(demoUsers);
  const [activeThread, setActiveThread] = useState(null); // null => centered view
  const [messagesMap, setMessagesMap] = useState(() => ({
    user1: [
      { id: "m1", fromId: "user1", fromName: "User One", text: "Hey! Welcome to the demo chat.", createdAt: Date.now() - 1000 * 60 * 60 },
      { id: "m2", fromId: "me", fromName: "You", text: "Thanks — this looks great!", createdAt: Date.now() - 1000 * 60 * 30 },
    ],
    user2: [{ id: "m3", fromId: "user2", fromName: "User Two", text: "Hello from user2.", createdAt: Date.now() - 1000 * 60 * 20 }],
    user3: [],
  }));

  const [input, setInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const messagesRefEl = useRef(null);

  const filteredUsers = users.filter((u) => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return true;
    return (u.displayName || u.username).toLowerCase().includes(t) || (u.username || "").toLowerCase().includes(t);
  });

  useEffect(() => {
    if (!activeThread) return;
    setTimeout(() => {
      if (messagesRefEl.current) messagesRefEl.current.scrollTop = messagesRefEl.current.scrollHeight;
    }, 50);
  }, [messagesMap, activeThread]);

  function openChatFor(user) {
    // toggle: if clicking currently active user -> close chat (center view)
    if (activeThread && activeThread.id === user.id) {
      setActiveThread(null);
      setSearchTerm("");
      setInput("");
      return;
    }
    // otherwise open this user's chat
    setActiveThread(user);
    setSearchTerm("");
    setInput("");
  }

  function handleSend() {
    if (!activeThread) return;
    const txt = input.trim();
    if (!txt) return;

    const newMsg = {
      id: `local_${Date.now()}`,
      fromId: currentUser.id,
      fromName: currentUser.displayName,
      text: txt,
      createdAt: Date.now(),
    };

    setMessagesMap((prev) => {
      const prevList = prev[activeThread.id] || [];
      return { ...prev, [activeThread.id]: [...prevList, newMsg] };
    });

    setInput("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const activeMessages = (activeThread && messagesMap[activeThread.id]) || [];
  const pageClass = !activeThread ? "centered" : "with-chat";

  return (
    <div className={`inbox-page ${pageClass}`}>
      <Header />

      <main className="inbox-main">
        {/* Left column: search + user list */}
        <aside className={`threads-col ${!activeThread ? "center-mode" : "left-mode"}`}>
          <div className="search-wrap">
            <input
              className="search-input"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search users"
            />
          </div>

          <div className="threads-list" aria-label="Users list">
            {filteredUsers.map((u) => (
              <button
                key={u.id}
                className={`thread-item ${activeThread?.id === u.id ? "active" : ""}`}
                onClick={() => openChatFor(u)}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <img  
                  src="/pfp.jpg"  
                alt={`${u.displayName} avatar`}  
                  className="user-circle-small"  
                /> 
                <div style={{ textAlign: "left" }}>
                  <div className="thread-title">{u.displayName}</div>
                  <div className="thread-sub">@{u.username}</div>
                </div>
              </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Right column: messages (hidden until a user is selected) */}
        <section className={`messages-col ${activeThread ? "visible" : "hidden"}`}>
          <div className="messages-header">
            <div className="thread-name">{activeThread ? activeThread.displayName : "Select a user"}</div>
          </div>

          <div className="messages" ref={messagesRefEl}>
            {(!activeThread || activeMessages.length === 0) && (
              <div className="empty">{activeThread ? "No messages yet — say hi 👋" : "Select a user to view chat"}</div>
            )}

            {activeMessages.map((m) => (
              <div key={m.id} className={`msg ${m.fromId === currentUser.id ? "me" : "bot"}`}>
                <div className="msg-meta">
                  <div className="msg-sender">{m.fromName}</div>
                  <div className="msg-time">{new Date(m.createdAt).toLocaleTimeString()}</div>
                </div>
                {m.text && <div className="text">{m.text}</div>}
              </div>
            ))}
          </div>

        {/* Composer: full-width input + compact send button */}
        <div className="composer">
          <div className="composer-inner">
            <textarea
              className="composer-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={activeThread ? `Message ${activeThread.displayName}...` : "Select a user first"}
              rows={1}
              onKeyDown={handleKeyDown}
              disabled={!activeThread}
            />
            <button
              className="composer-send"
              onClick={handleSend}
              aria-label="Send message"
              disabled={!activeThread || !input.trim()}
            >
              <FaPaperPlane />
            </button>
          </div>
        </div>
        </section>
      </main>
    </div>
  );
}
