// Inbox.jsx
import React, { useState } from "react";
import "./Inbox.css";
import Header from "../components/header"; // Adjust path as needed

/*
  FitSense Inbox Component
  - Tabs: All Messages / Unread
  - Dark theme, left message list, right conversation pane
  - Example data included; replace with real data / props / API calls
*/

const sampleConversations = [
  {
    id: 1,
    name: "Ayaan Malik",
    handle: "@ayaan",
    avatarColor: "#FF6B35",
    lastMessage: "Loved that summer linen outfit!",
    time: "7:32 PM",
    unread: true,
    messages: [
      { fromUser: false, text: "Hey, check out these outfits I curated.", time: "7:09 PM" },
      { fromUser: true, text: "Wow — love the second look. Recommend sizing down?", time: "7:15 PM" },
      { fromUser: false, text: "Yes. It runs slightly big.", time: "7:20 PM" },
    ],
  },
  {
    id: 2,
    name: "Sana R.",
    handle: "@sana",
    avatarColor: "#6C5CE7",
    lastMessage: "Sent you the trendboard",
    time: "3:30 PM",
    unread: false,
    messages: [
      { fromUser: false, text: "Trendboard uploaded to your FitSense.", time: "3:01 PM" },
      { fromUser: true, text: "Opening now, thanks!", time: "3:10 PM" },
    ],
  },
  {
    id: 3,
    name: "FitSense Support",
    handle: "@support",
    avatarColor: "#00B894",
    lastMessage: "Your weekly digest is ready",
    time: "Yesterday",
    unread: false,
    messages: [
      { fromUser: false, text: "Your weekly digest of recommended outfits is ready.", time: "Yesterday" },
    ],
  },
  {
    id: 4,
    name: "Rohit Patel",
    handle: "@rohit",
    avatarColor: "#FF7675",
    lastMessage: "Can you review the denim picks?",
    time: "Mon",
    unread: true,
    messages: [
      { fromUser: false, text: "Can you review the denim picks?", time: "Mon 5:30 PM" },
      { fromUser: true, text: "Will do tonight.", time: "Mon 6:05 PM" },
    ],
  },
];

function Avatar({ name, color }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="fs-avatar" style={{ background: color }}>
      {initials}
    </div>
  );
}

export default function Inbox() {
  const [tab, setTab] = useState("all");
  const [conversations] = useState(sampleConversations);
  const [selectedId, setSelectedId] = useState(sampleConversations[0].id);
  const [composeText, setComposeText] = useState("");

  const filtered = conversations.filter((c) => (tab === "all" ? true : c.unread));

  const selected = conversations.find((c) => c.id === selectedId) || conversations[0];

  const unreadCount = conversations.filter((c) => c.unread).length;

  function handleSend(e) {
    e.preventDefault();
    if (!composeText.trim()) return;
    // Note: this demo doesn't mutate sample data; replace with API call to send & refresh
    alert(`(Demo) Would send: "${composeText}" to ${selected.name}`);
    setComposeText("");
  }

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
              <button
                className={`fs-tab ${tab === "all" ? "active" : ""}`}
                onClick={() => setTab("all")}
                role="tab"
                aria-selected={tab === "all"}
              >
                All Messages
              </button>
              <button
                className={`fs-tab ${tab === "unread" ? "active" : ""}`}
                onClick={() => setTab("unread")}
                role="tab"
                aria-selected={tab === "unread"}
              >
                Unread <span className="fs-unread-count">{unreadCount}</span>
              </button>
            </div>

            <div className="fs-search">
              <svg className="fs-search-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path fill="currentColor" d="M21 21l-4.35-4.35"></path>
                <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1" fill="none"></circle>
              </svg>
              <input placeholder="Search messages or users" aria-label="Search messages" />
            </div>
          </div>

          <div className="fs-list" role="list">
            {filtered.length === 0 && <div className="fs-empty">No conversations</div>}
            {filtered.map((c) => (
              <div
                key={c.id}
                className={`fs-list-item ${selectedId === c.id ? "selected" : ""}`}
                onClick={() => setSelectedId(c.id)}
                role="listitem"
                tabIndex={0}
              >
                <Avatar name={c.name} color={c.avatarColor} />
                <div className="fs-list-meta">
                  <div className="fs-list-top">
                    <div className="fs-name">{c.name}</div>
                    <div className="fs-time">{c.time}</div>
                  </div>
                  <div className="fs-preview">
                    <span className="fs-last-msg">{c.lastMessage}</span>
                    {c.unread && <span className="fs-dot" aria-hidden></span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="fs-right-col">
          <div className="fs-convo-header">
            <div className="fs-convo-left">
              <Avatar name={selected.name} color={selected.avatarColor} />
              <div className="fs-convo-title">
                <div className="fs-convo-name">{selected.name}</div>
                <div className="fs-convo-sub">{selected.handle} • Active</div>
              </div>
            </div>
            <div className="fs-convo-actions">
              
              <button className="icon-btn" title="More">
                ⋯
              </button>
            </div>
          </div>

          <div className="fs-convo-body" aria-live="polite">
            {selected.messages.map((m, idx) => (
              <div key={idx} className={`fs-msg ${m.fromUser ? "from-me" : "from-them"}`}>
                <div className="fs-msg-bubble">{m.text}</div>
                <div className="fs-msg-time">{m.time}</div>
              </div>
            ))}

            <div className="fs-convo-divider">Today</div>

            <div className="fs-msg from-them">
              <div className="fs-msg-bubble">
                Sent a lookbook: "Minimal summer linen — neutral tones"
                
              </div>
              <div className="fs-msg-time">6:30 PM</div>
            </div>
          </div>

          <form className="fs-composer" onSubmit={handleSend}>
            <input
              className="fs-input"
              placeholder={`Message ${selected.name}...`}
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
            />
            <div className="fs-composer-actions">
              <button type="button" className="icon-btn" title="Attach">
                +
              </button>
              <button type="submit" className="fs-send-btn">
                Send
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
