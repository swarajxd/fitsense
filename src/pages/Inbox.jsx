// Inbox.jsx
import React, { useEffect, useRef, useState } from "react";
import Header from "../components/header";
import "./Inbox.css";

import { db } from "../firebase"; // your firebase.js that exports Firestore instance
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { FiImage } from "react-icons/fi";   // feather image icon (ok)
import { FaPaperPlane } from "react-icons/fa"; // font-awesome paper plane


let tryGetUser = () => ({ id: "me", name: "You" });
try {
  // optional: pick up Clerk user if you're using Clerk
  // eslint-disable-next-line no-undef
  const { useUser } = require("@clerk/clerk-react");
  const u = useUser?.();
  if (u && u.user) tryGetUser = () => ({ id: u.user.id, name: u.user.firstName || u.user.username || "You" });
} catch (e) {
  // ignore — fallback to 'me'
}

/**
 * Firestore structure used:
 * - /threads (collection)
 *    - {threadId} (doc)
 *       - title, members...
 *       - messages (subcollection)
 *           - {messageId} { text, fromId, fromName, type, attachmentUrl, createdAt }
 */

export default function Inbox() {
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const messagesRef = useRef(null);
  const fileInputRef = useRef(null);

  const storage = getStorage(); // uses same firebase app

  // load threads list (subscribe realtime)
  useEffect(() => {
    const q = query(collection(db, "threads"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, async (snap) => {
      const list = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          return { id: d.id, ...data };
        })
      );
      setThreads(list);
      // if no active thread, pick the first
      if (!activeThread && list?.length) setActiveThread(list[0]);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when activeThread changes, subscribe to messages
  useEffect(() => {
    if (!activeThread) {
      setMessages([]);
      return;
    }
    const msgsRef = collection(db, "threads", activeThread.id, "messages");
    const q = query(msgsRef, orderBy("createdAt"));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
    });

    // mark thread read / update lastSeen etc if you want:
    // setDoc(doc(db, "threads", activeThread.id), { unread: 0 }, { merge: true });

    return () => unsub();
  }, [activeThread]);

  // auto-scroll on new messages
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  // create a new thread (helper)
  async function createThread(title = "New chat") {
    const user = tryGetUser();
    const newId = `${Date.now()}`; // or use addDoc for auto id
    const tRef = doc(db, "threads", newId);
    await setDoc(tRef, {
      title,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      members: [user.id],
    });
    // after creation, set active to new thread
    setActiveThread({ id: newId, title });
  }

  async function handleSend() {
    if (!activeThread) return alert("Select or create a thread first.");
    if (!input.trim() && !file) return;

    const user = tryGetUser();

    // if file present: upload to Firebase Storage then create a message with attachmentUrl
    if (file) {
      try {
        const sr = storageRef(storage, `threads/${activeThread.id}/attachments/${Date.now()}_${file.name}`);
        const snap = await uploadBytes(sr, file);
        const url = await getDownloadURL(snap.ref);

        await addDoc(collection(db, "threads", activeThread.id, "messages"), {
          type: "post", // indicates shared post/attachment
          text: input.trim() || "",
          fromId: user.id,
          fromName: user.name,
          attachmentUrl: url,
          createdAt: serverTimestamp(),
        });

        // update thread last activity
        await setDoc(
          doc(db, "threads", activeThread.id),
          { updatedAt: serverTimestamp() },
          { merge: true }
        );

        setInput("");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = null;
        return;
      } catch (err) {
        console.error("upload failed", err);
        alert("Upload failed. Check console.");
        return;
      }
    }

    // plain text message
    await addDoc(collection(db, "threads", activeThread.id, "messages"), {
      type: "message",
      text: input.trim(),
      fromId: user.id,
      fromName: user.name,
      createdAt: serverTimestamp(),
    });

    // update thread
    await setDoc(doc(db, "threads", activeThread.id), { updatedAt: serverTimestamp() }, { merge: true });

    setInput("");
  }

  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  return (
    <div className="inbox-page">
      <Header />

      <main className="inbox-main">
        <aside className="threads-col">
          <div className="threads-top">
            <h3>Chats</h3>
            <button className="btn-new" onClick={() => createThread("Conversation " + (threads.length + 1))}>
              + New
            </button>
          </div>

          <div className="threads-list">
            {threads.map((t) => (
              <button
                key={t.id}
                className={`thread-item ${activeThread?.id === t.id ? "active" : ""}`}
                onClick={() => setActiveThread(t)}
              >
                <div className="thread-title">{t.title || t.id}</div>
                <div className="thread-sub">{t.lastText || "No messages yet"}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="messages-col">
          <div className="messages-header">
            <div className="thread-name">{activeThread?.title || "Select a chat"}</div>
          </div>

          <div className="messages" ref={messagesRef}>
            {messages.length === 0 && <div className="empty">No messages — say hi 👋</div>}

            {messages.map((m) => (
              <div key={m.id} className={`msg ${m.fromId === tryGetUser().id ? "me" : "bot"}`}>
                <div className="msg-meta">
                  <div className="msg-sender">{m.fromName ?? (m.fromId === tryGetUser().id ? "You" : "Guest")}</div>
                  <div className="msg-time">{m.createdAt?.toDate ? new Date(m.createdAt.toDate()).toLocaleTimeString() : ""}</div>
                </div>

                {m.attachmentUrl && (
                  <div className="shared-post">
                    <img src={m.attachmentUrl} alt="shared" />
                    {m.text && <div className="caption">{m.text}</div>}
                  </div>
                )}

                {m.text && <div className="text">{m.text}</div>}
              </div>
            ))}
          </div>

          <div className="input-area">
            <input ref={fileInputRef} type="file" className="visually-hidden" accept="image/*" onChange={onFileChange} />
            <button className="attach-btn" onClick={() => fileInputRef.current?.click()}>
              <FiImage />
            </button>

            <textarea
              className="message-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message or caption..."
              rows={1}
            />

            <button className="send-btn" onClick={handleSend}>
              <FaPaperPlane />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
