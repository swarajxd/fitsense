// server/index.js
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const Pusher = require("pusher");

const app = express();
const PORT = process.env.PORT || 7000;

app.use(cors());
app.use(bodyParser.json());

// Pusher server client (use your server env vars)
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

// In-memory mock storage for convos (for dev). Replace with DB in production.
const conversationsByUser = {}; // { userId: [ convoObj ] }
// sample users to search from (in real use you'll query Clerk)
const demoUsers = [
  { id: "user1", username: "ayaan", displayName: "Ayaan Malik", imageUrl: null },
  { id: "user2", username: "sana", displayName: "Sana R.", imageUrl: null },
  { id: "user3", username: "support", displayName: "FitSense Support", imageUrl: null },
  { id: "user4", username: "rohit", displayName: "Rohit Patel", imageUrl: null },
];

// Simple "search users" endpoint
app.get("/api/users", (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  if (!q) return res.json(demoUsers.slice(0, 10));
  const filtered = demoUsers.filter(u =>
    (u.displayName || "").toLowerCase().includes(q) ||
    (u.username || "").toLowerCase().includes(q)
  );
  res.json(filtered);
});

// Get conversations for the current (dev) user
// In prod, use Clerk to get actual userId from session. Here we accept ?userId= for dev.
app.get("/api/conversations", (req, res) => {
  const userId = req.query.userId || "me"; // dev default
  const convos = conversationsByUser[userId] || [];
  res.json({ conversations: convos });
});

// Create conversation between current user and participant
app.post("/api/conversations", (req, res) => {
  const userId = req.query.userId || "me"; // dev default
  const { participantId, participantDisplayName, participantImage } = req.body;
  if (!participantId) return res.status(400).json({ error: "participantId required" });
  const roomId = [userId, participantId].sort().join("_");
  const convo = { roomId, otherId: participantId, otherDisplayName: participantDisplayName, otherImage: participantImage, createdAt: Date.now() };

  conversationsByUser[userId] = conversationsByUser[userId] || [];
  conversationsByUser[participantId] = conversationsByUser[participantId] || [];

  // Only add once
  if (!conversationsByUser[userId].some(c => c.roomId === roomId)) conversationsByUser[userId].push(convo);
  if (!conversationsByUser[participantId].some(c => c.roomId === roomId)) {
    const convoForOther = { roomId, otherId: userId, otherDisplayName: "You", otherImage: null, createdAt: Date.now() };
    conversationsByUser[participantId].push(convoForOther);
  }

  res.json({ roomId });
});

// Pusher auth endpoint for private channels (dev: allow any authenticated socket)
app.post("/api/pusher/auth", (req, res) => {
  const { socket_id, channel_name } = req.body;
  if (!socket_id || !channel_name) return res.status(400).send("Missing socket_id or channel_name");
  // NOTE: In production verify that the requesting user can subscribe to this channel.
  const auth = pusher.authenticate(socket_id, channel_name);
  res.send(auth);
});

// Accept message POST and trigger pusher event
app.post("/api/messages", async (req, res) => {
  const userId = req.query.userId || "me"; // dev default
  const { roomId, text } = req.body;
  if (!roomId || !text) return res.status(400).json({ error: "roomId & text required" });

  const payload = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    fromId: userId,
    fromName: userId,
    text,
    createdAt: Date.now(),
  };

  try {
    await pusher.trigger(`private-chat_${roomId}`, "message", payload);
    res.json({ ok: true, payload });
  } catch (err) {
    console.error("pusher trigger err:", err);
    res.status(500).json({ error: "pusher error" });
  }
});

app.listen(PORT, () => {
  console.log(`Dev server running on http://localhost:${PORT}`);
});
