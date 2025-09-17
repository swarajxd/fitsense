// index.js — server with Mongo persistence (preferred) + file-backed fallback
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const postsRouter = require('./routes/posts');
const app = express();
const PORT = process.env.PORT || 7000;

/*upload posts*/

/* ---------- Middleware ---------- */
// right after your requires/imports
console.log('require postsRouter =>', require('./routes/posts'));
console.log('cors type =>', typeof require('cors'));

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // parse JSON and form bodies (Pusher may send urlencoded)
app.use(cors());

/* --- helper to safely mount routers --- */
function safeMount(mountPath, moduleOrName) {
  // moduleOrName may be a module value (router) or a string path
  let mod = moduleOrName;
  if (typeof moduleOrName === 'string') {
    try {
      mod = require(moduleOrName);
    } catch (err) {
      console.warn(`safeMount: require failed for '${moduleOrName}': ${err && err.code ? err.code : err.message}`);
      return;
    }
  }

  if (!mod) {
    console.warn(`safeMount: module for '${mountPath}' is falsy — skipping mount.`);
    return;
  }

  // prefer default export if present (interop ESM)
  if (mod && mod.default) mod = mod.default;

  const isFunction = typeof mod === 'function';
  const looksLikeRouter = mod && (typeof mod.use === 'function' || typeof mod.handle === 'function');

  console.log(`safeMount: mounting ${mountPath} => type: ${typeof mod}${ looksLikeRouter ? ' (looks like router)' : '' }`);

  if (isFunction || looksLikeRouter) {
    try {
      app.use(mountPath, mod);
      console.log(`Mounted ${mountPath}`);
    } catch (err) {
      console.error(`Failed to mount ${mountPath}:`, err && err.message);
    }
  } else {
    console.warn(`Module for ${mountPath} is not a router/middleware (type: ${typeof mod}). Skipping mount.`);
  }
}

/* mount posts router (you already required postsRouter) */
safeMount('/api/posts', postsRouter);

/* ---------- Existing routes (Cloudinary / uploads / profile) ---------- */
safeMount('/api/uploads', './routes/upload');
safeMount('/api/profile', './routes/profile');

/* server/index.js (add) */
safeMount('/api/posts', './routes/feed'); // NOTE: mounts feed at same base; keep if feed router is intended
safeMount('/api/interactions', './routes/interactions');

/* ---------- Optional Clerk server SDK (only used if CLERK_API_KEY provided) ---------- */
let clerkClient = null;
try {
  const clerk = require('@clerk/clerk-sdk-node');
  clerkClient = clerk?.clerkClient || clerk?.Clerk || null;
  if (clerkClient && !process.env.CLERK_SECRET_KEY) {
    console.warn('CLERK_API_KEY not provided — Clerk SDK loaded but will not be used without CLERK_API_KEY.');
  }
} catch (err) {
  console.warn('Clerk SDK not available (dev fallback will be used).');
}

/* ----------------- MongoDB ----------------- */
async function connectMongo() {
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI not set — falling back to file/in-memory stores (dev only).');
    return;
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('Mongo connect err', err);
  }
}
connectMongo();

/* ----------------- Message & Conversation schemas (Mongo) ----------------- */
const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  roomId: { type: String, required: true, index: true },
  fromId: String,
  fromName: String,
  text: String,
  createdAt: { type: Number, default: Date.now },
}, { versionKey: false });

const conversationSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  participants: [String],
  meta: { type: Object, default: {} },
  createdAt: { type: Number, default: Date.now }
}, { versionKey: false });

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);

/* ----------------- Pusher ----------------- */
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

/* -------- dev fallback in-memory + file persistence ---------- */
const DATA_DIR = path.resolve(__dirname, 'data');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const CONVOS_FILE = path.join(DATA_DIR, 'conversations.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  } catch (err) {
    console.error('Failed to create data dir', err);
  }
}
ensureDataDir();

let messagesStore = {};       // { roomId: [ messageObj ] }
let conversationsByUser = {}; // { userId: [ convoObj ] }

function loadFileData() {
  try {
    if (fs.existsSync(MESSAGES_FILE)) {
      const txt = fs.readFileSync(MESSAGES_FILE, 'utf8');
      messagesStore = JSON.parse(txt) || {};
    }
  } catch (err) {
    console.error('Failed to load messages file', err);
    messagesStore = {};
  }
  try {
    if (fs.existsSync(CONVOS_FILE)) {
      const txt = fs.readFileSync(CONVOS_FILE, 'utf8');
      conversationsByUser = JSON.parse(txt) || {};
    }
  } catch (err) {
    console.error('Failed to load convos file', err);
    conversationsByUser = {};
  }
}
loadFileData();

function saveMessagesFile() {
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messagesStore, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write messages file', err);
  }
}
function saveConvosFile() {
  try {
    fs.writeFileSync(CONVOS_FILE, JSON.stringify(conversationsByUser, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write convos file', err);
  }
}

/* demo users if Clerk not available */
const demoUsers = [
  { id: "user1", username: "ayaan", displayName: "Ayaan Malik", imageUrl: null },
  { id: "user2", username: "sana", displayName: "Sana R.", imageUrl: null },
  { id: "user3", username: "support", displayName: "FitSense Support", imageUrl: null },
  { id: "user4", username: "rohit", displayName: "Rohit Patel", imageUrl: null },
];

/* ----------------- /api/users ----------------- */
app.get('/api/users', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!process.env.CLERK_API_KEY || !clerkClient) {
      const qlc = q.toLowerCase();
      const filtered = demoUsers.filter(u =>
        !qlc ||
        (u.displayName || '').toLowerCase().includes(qlc) ||
        (u.username || '').toLowerCase().includes(qlc)
      );
      return res.json(filtered);
    }

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

/* ----------------- Conversations endpoints ----------------- */
app.get('/api/conversations', async (req, res) => {
  const userId = req.query.userId || 'me';
  if (mongoose.connection.readyState) {
    try {
      const convos = await Conversation.find({ participants: userId }).sort({ createdAt: -1 }).lean();
      const out = convos.map(c => {
        const otherId = c.participants.find(p => p !== userId) || (c.participants[0] || null);
        return { roomId: c.roomId, otherId, otherDisplayName: c.meta?.[otherId]?.displayName || otherId, otherImage: c.meta?.[otherId]?.image || null, createdAt: c.createdAt };
      });
      return res.json({ conversations: out });
    } catch (err) {
      console.error('get convos err', err);
      return res.status(500).json({ error: 'failed to load conversations' });
    }
  } else {
    const convos = conversationsByUser[userId] || [];
    return res.json({ conversations: convos });
  }
});

app.post('/api/conversations', async (req, res) => {
  const userId = req.query.userId || 'me';
  const { participantId, participantDisplayName, participantImage } = req.body;
  if (!participantId) return res.status(400).json({ error: 'participantId required' });

  const roomId = [userId, participantId].sort().join('_');

  if (mongoose.connection.readyState) {
    try {
      const existing = await Conversation.findOne({ roomId });
      if (!existing) {
        const meta = {};
        meta[participantId] = { displayName: participantDisplayName || participantId, image: participantImage || null };
        meta[userId] = { displayName: 'You' };
        await Conversation.create({ roomId, participants: [userId, participantId], meta, createdAt: Date.now() });
      }
      return res.json({ roomId });
    } catch (err) {
      console.error('create convo err', err);
      return res.status(500).json({ error: err.message || 'create convo failed' });
    }
  } else {
    // fallback memory + file write
    const convo = { roomId, otherId: participantId, otherDisplayName: participantDisplayName || null, otherImage: participantImage || null, createdAt: Date.now() };
    conversationsByUser[userId] = conversationsByUser[userId] || [];
    conversationsByUser[participantId] = conversationsByUser[participantId] || [];

    if (!conversationsByUser[userId].some(c => c.roomId === roomId)) conversationsByUser[userId].push(convo);
    if (!conversationsByUser[participantId].some(c => c.roomId === roomId)) {
      conversationsByUser[participantId].push({ roomId, otherId: userId, otherDisplayName: 'You', otherImage: null, createdAt: Date.now() });
    }

    // persist to disk immediately
    try { saveConvosFile(); } catch (e) { console.error('failed saving convos to disk', e); }

    return res.json({ roomId });
  }
});

/* ----------------- Pusher auth (private channels) ----------------- */
app.post('/api/pusher/auth', (req, res) => {
  const { socket_id, channel_name } = req.body;
  if (!socket_id || !channel_name) return res.status(400).send('Missing socket_id or channel_name');

  if (!pusher) {
    console.warn('Auth request but Pusher not configured.');
    return res.status(500).send('Pusher not configured on server.');
  }

  try {
    // Optionally verify the user via Clerk token in req.headers.authorization here
    const auth = pusher.authenticate(socket_id, channel_name);
    res.json(auth);
  } catch (err) {
    console.error('pusher auth err', err);
    res.status(500).send('pusher auth error');
  }
});

/* ----------------- Messages: POST (send) and GET (fetch) ----------------- */
app.post('/api/messages', async (req, res) => {
  const userId = req.query.userId || 'me';
  const { roomId, text } = req.body;
  if (!roomId || !text) return res.status(400).json({ error: 'roomId & text required' });

  const payload = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    roomId,
    fromId: userId,
    fromName: userId,
    text,
    createdAt: Date.now()
  };

  // Save to Mongo or file/in-memory fallback
  if (mongoose.connection.readyState) {
    try {
      await Message.create(payload);
    } catch (err) {
      console.error('save message err', err);
      return res.status(500).json({ error: 'save message failed', details: String(err) });
    }
  } else {
    messagesStore[roomId] = messagesStore[roomId] || [];
    messagesStore[roomId].push(payload);
    // persist file immediately
    try { saveMessagesFile(); } catch (e) { console.error('failed saving messages to disk', e); }
  }

  // Trigger Pusher if available (real-time)
  if (pusher) {
    try {
      await pusher.trigger(`private-chat_${roomId}`, 'message', payload);
    } catch (err) {
      console.error('pusher trigger err:', err);
      return res.status(500).json({ error: 'pusher error', details: String(err) });
    }
  } else {
    console.log('Message saved (Pusher disabled):', payload);
  }

  return res.json({ ok: true, payload });
});

/* GET messages for a room (used when opening a conversation) */
app.get('/api/messages', async (req, res) => {
  const roomId = req.query.roomId;
  if (!roomId) return res.status(400).json({ error: 'roomId required' });

  if (mongoose.connection.readyState) {
    try {
      const list = await Message.find({ roomId }).sort({ createdAt: 1 }).limit(1000).lean();
      return res.json({ messages: list });
    } catch (err) {
      console.error('get messages err', err);
      return res.status(500).json({ error: 'failed to load messages' });
    }
  } else {
    const list = messagesStore[roomId] || [];
    return res.json({ messages: list });
  }
});

/* ---------- Generic error handler ---------- */
app.use((err, req, res, next) => {
  console.error('Unhandled server error', err);
  res.status(500).json({ error: err?.message || 'Internal server error' });
});

/* ---------- Start server ---------- */
app.listen(PORT, () => {
  console.log(`Dev server running on http://localhost:${PORT}`);
});
