import React, { useEffect, useRef, useState } from "react";
import Header from "../components/header"; // adjust path if needed
import "./AiChat.css";
import { FiImage, FiX } from "react-icons/fi";      
import { FaPaperPlane } from "react-icons/fa"; 

export default function AiChat() {
  const [messages, setMessages] = useState([
    { id: 1, from: "bot", text: "Hi — I'm your AI assistant. Ask me anything.", image: null },
  ]);
  const [input, setInput] = useState("");
  const [attach, setAttach] = useState(null); // File
  const [attachPreview, setAttachPreview] = useState(null);
  const fileRef = useRef(null);
  const messagesRef = useRef(null);

  useEffect(() => {
    // auto-scroll to bottom when messages change
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setAttach(f);
    setAttachPreview(URL.createObjectURL(f));
  }

  function removeAttachment() {
    setAttach(null);
    setAttachPreview(null);
    if (fileRef.current) fileRef.current.value = null;
  }

  function sendMessage() {
    if (!input.trim() && !attach) return;
    const newMsg = {
      id: Date.now(),
      from: "me",
      text: input.trim() || null,
      image: attachPreview || null,
    };
    setMessages((m) => [...m, newMsg]);
    setInput("");
    setAttach(null);
    setAttachPreview(null);

    // TODO: send to API / websocket. Here we simulate a simple bot reply for demo.
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { id: Date.now() + 1, from: "bot", text: "Got it — I'll process that for you." },
      ]);
    }, 700);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="aichat-page">
      <Header />

      <main className="aichat-main">
        <div className="chat-wrapper">
          <div className="chat-panel">
            <div className="chat-header">AI Chat</div>

            <div className="messages" ref={messagesRef} aria-live="polite">
              {messages.map((m) => (
                <div key={m.id} className={`message ${m.from === "me" ? "me" : "bot"}`}>
                  {m.image && (
                    <div className="message-image">
                      <img src={m.image} alt="attachment" />
                    </div>
                  )}
                  {m.text && <div className="message-text">{m.text}</div>}
                </div>
              ))}
            </div>

            <div className="input-area">
              {attachPreview && (
                <div className="attach-preview">
                  <img src={attachPreview} alt="preview" />
                  <button className="remove-attach" onClick={removeAttachment} aria-label="Remove attachment">
                    <FiX />
                  </button>
                </div>
              )}

              <div className="input-row">
                <textarea
                  className="chat-input"
                  placeholder="Type a message... (Shift+Enter for newline)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />

                <div className="controls">
                  <input type="file" ref={fileRef} className="visually-hidden" accept="image/*" onChange={handleFileChange} />
                  <button type="button" className="icon-btn" onClick={() => fileRef.current?.click()} aria-label="Attach image">
                    <FiImage />
                  </button>

                  <button type="button" className="send-btn" onClick={sendMessage} aria-label="Send message">
                    <FaPaperPlane />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
