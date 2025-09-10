require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 7000;

// parse JSON and form bodies (Pusher may send urlencoded)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// ---- Optional Clerk server SDK (only used if CLERK_API_KEY provided) ----
let clerkClient = null;
try {
  const clerk = require('@clerk/clerk-sdk-node');
  // clerk export shape varies by version; try common names
  clerkClient = clerk?.clerkClient || clerk?.Clerk || null;
  if (clerkClient && !process.env.CLERK_API_KEY) {
    console.warn('CLERK_API_KEY not provided — Clerk SDK loaded but will not be used without CLERK_API_KEY.');
  }
} catch (err) {
  // not fatal — we'll fallback to demo users
  console.warn('Clerk SDK not available (dev fallback will be used).');
}

// ---- Pusher client init (guard if env missing) ----
let pusher = null;
if (process.env.PUSHER_APP_ID && process.env.PUSHER_KEY && process.env.PUSHER_SECRET && process.env.PUSHER_CLUSTER) {
  const Pusher = require('pusher');
  pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true,
  });
  console.log('Pusher client initialized.');
} else {
  console.warn('PUSHER_* env vars not fully set — Pusher will be disabled (dev fallback only).');
}

// ---- In-memory stores (dev only) ----
const conversationsByUser = {}; // { userId: [ convoObj ] }
const messagesStore = {};       // { roomId: [ messageObj ] }

// demo users if Clerk not available
const demoUsers = [
  { id: "user1", username: "ayaan", displayName: "Ayaan Malik", imageUrl: null },
  { id: "user2", username: "sana", displayName: "Sana R.", imageUrl: null },
  { id: "user3", username: "support", displayName: "FitSense Support", imageUrl: null },
  { id: "user4", username: "rohit", displayName: "Rohit Patel", imageUrl: null },
];

// --------- /api/users -----------
app.get('/api/users', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    // Dev fallback
    if (!process.env.CLERK_API_KEY || !clerkClient) {
      const qlc = q.toLowerCase();
      const filtered = demoUsers.filter(u =>
        !qlc ||
        (u.displayName || '').toLowerCase().includes(qlc) ||
        (u.username || '').toLowerCase().includes(qlc)
      );
      return res.json(filtered);
    }

    // Real Clerk lookup
    const list = q
      ? await clerkClient.users.getUserList({ query: q, limit: 50 })
      : await clerkClient.users.getUserList({ limit: 20 });

    const out = list.map(u => ({
      id: u.id,
      username: u.username || (u.primaryEmailAddress && u.primaryEmailAddress.emailAddress) || null,
      displayName: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || null,
      imageUrl: u.profileImageUrl || null
    }));

    return res.json(out);
  } catch (err) {
    console.error('users search error', err);
    return res.status(500).json({ error: err?.message || 'users search failed' });
  }
});

// --------- /api/conversations -----------
app.get('/api/conversations', (req, res) => {
  const userId = req.query.userId || 'me';
  const convos = conversationsByUser[userId] || [];
  res.json({ conversations: convos });
});

app.post('/api/conversations', (req, res) => {
  const userId = req.query.userId || 'me';
  const { participantId, participantDisplayName, participantImage } = req.body;
  if (!participantId) return res.status(400).json({ error: 'participantId required' });

  const roomId = [userId, participantId].sort().join('_');
  const convo = { roomId, otherId: participantId, otherDisplayName: participantDisplayName || null, otherImage: participantImage || null, createdAt: Date.now() };

  conversationsByUser[userId] = conversationsByUser[userId] || [];
  conversationsByUser[participantId] = conversationsByUser[participantId] || [];

  if (!conversationsByUser[userId].some(c => c.roomId === roomId)) conversationsByUser[userId].push(convo);
  if (!conversationsByUser[participantId].some(c => c.roomId === roomId)) {
    conversationsByUser[participantId].push({ roomId, otherId: userId, otherDisplayName: 'You', otherImage: null, createdAt: Date.now() });
  }

  return res.json({ roomId });
});

// --------- Pusher auth (private channels) -----------
app.post('/api/pusher/auth', (req, res) => {
  const { socket_id, channel_name } = req.body;
  if (!socket_id || !channel_name) return res.status(400).send('Missing socket_id or channel_name');

  if (!pusher) {
    console.warn('Auth request but Pusher not configured.');
    return res.status(500).send('Pusher not configured on server.');
  }

  try {
    const auth = pusher.authenticate(socket_id, channel_name);
    // send JSON authorization object
    res.json(auth);
  } catch (err) {
    console.error('pusher auth err', err);
    res.status(500).send('pusher auth error');
  }
});

// --------- Messages: POST (send) and GET (fetch) -----------
app.post('/api/messages', async (req, res) => {
  const userId = req.query.userId || 'me';
  const { roomId, text } = req.body;
  if (!roomId || !text) return res.status(400).json({ error: 'roomId & text required' });

  const payload = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    fromId: userId,
    fromName: userId,
    text,
    createdAt: Date.now()
  };

  // Save to in-memory messages store (dev)
  messagesStore[roomId] = messagesStore[roomId] || [];
  messagesStore[roomId].push(payload);

  // Trigger Pusher if available (real-time)
  if (pusher) {
    try {
      await pusher.trigger(`private-chat_${roomId}`, 'message', payload);
    } catch (err) {
      console.error('pusher trigger err:', err);
      // Do not fail the request — messages are still saved in-memory
      return res.status(500).json({ error: 'pusher error', details: String(err) });
    }
  } else {
    console.log('Message saved (Pusher disabled):', payload);
  }

  return res.json({ ok: true, payload });
});

// GET messages for a room (used when opening a conversation)
app.get('/api/messages', (req, res) => {
  const roomId = req.query.roomId;
  if (!roomId) return res.status(400).json({ error: 'roomId required' });
  const list = messagesStore[roomId] || [];
  res.json({ messages: list });
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error', err);
  res.status(500).json({ error: err?.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Dev server running on http://localhost:${PORT}`);
});
