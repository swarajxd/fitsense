// server/index.js - Fixed with Supabase integration
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { spawn } = require('child_process');

const postsRouter = require('./routes/posts');
const app = express();
const PORT = process.env.PORT || 7000;

// Multer configuration for file uploads
const upload = multer({ dest: 'uploads/' });


/* ---------- Middleware ---------- */
// right after your requires/imports
console.log('require postsRouter =>', require('./routes/posts'));
console.log('cors type =>', typeof require('cors'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE // Use service role key for server-side operations
);

console.log('Supabase initialized:', !!supabase);

// Request logger (add after app.use(cors()))
app.use((req, res, next) => {
  try {
    console.log(`[REQ] ${req.method} ${req.url}`, Object.keys(req.body || {}).length ? req.body : '');
  } catch (e) {
    console.log('[REQ] log err', e && e.message);
  }
  next();
});

// Utility to list registered routes (call before app.listen)
function printRegisteredRoutes() {
  try {
    const routes = [];
    app._router && app._router.stack.forEach((layer) => {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods).join(',');
        routes.push(`${methods.toUpperCase()} ${layer.route.path}`);
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        // mounted routers - attempt to show mount + path
        layer.handle.stack.forEach((l) => {
          if (l.route && l.route.path) {
            const methods = Object.keys(l.route.methods).join(',');
            routes.push(`${methods.toUpperCase()} ${l.route.path}`);
          }
        });
      }
    });
    console.log('--- Registered routes ---');
    routes.forEach(r => console.log(r));
    console.log('-------------------------');
  } catch (e) {
    console.warn('Could not enumerate routes:', e && e.message);
  }
}

// Helper to safely mount routers
function safeMount(mountPath, moduleOrName) {
  let mod = moduleOrName;
  if (typeof moduleOrName === 'string') {
    try {
      mod = require(moduleOrName);
    } catch (err) {
      console.warn(`safeMount: require failed for '${moduleOrName}': ${err.message}`);
      return;
    }
  }

  if (!mod) {
    console.warn(`safeMount: module for '${mountPath}' is falsy — skipping mount.`);
    return;
  }

  if (mod && mod.default) mod = mod.default;

  const isFunction = typeof mod === 'function';
  const looksLikeRouter = mod && (typeof mod.use === 'function' || typeof mod.handle === 'function');

  if (isFunction || looksLikeRouter) {
    try {
      app.use(mountPath, mod);
      console.log(`Mounted ${mountPath}`);
    } catch (err) {
      console.error(`Failed to mount ${mountPath}:`, err.message);
    }
  } else {
    console.warn(`Module for ${mountPath} is not a router/middleware. Skipping mount.`);
  }
}

// Mount existing routes
safeMount('/api/posts', postsRouter);
safeMount('/api/uploads', './routes/upload');
safeMount('/api/profile', './routes/profile');
safeMount('/api/posts', './routes/feed');
safeMount('/api/interactions', './routes/interactions');


/* ---------- AI Model Analysis Endpoint ---------- */
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imagePath = path.resolve(req.file.path); // Full path to uploaded image
    const scriptPath = path.resolve(__dirname, 'aimodel', 'pklrunner.py'); // Your Python script
    const modelPath = path.resolve(__dirname, 'aimodel', 'unified_model.pkl'); // Your model
    const resultsPath = path.resolve(__dirname, 'results.json');
    
    // Get parameters from request body
    const runColor = req.body.run_color === 'true';
    const runPattern = req.body.run_pattern === 'true';
    const runSeason = req.body.run_season === 'true';
    const scoreThr = parseFloat(req.body.score_thr) || 0.7;
    const topk = parseInt(req.body.topk) || 10;

    console.log('Analysis request:', {
      imagePath,
      modelPath,
      scriptPath,
      runColor,
      runPattern,
      runSeason,
      scoreThr,
      topk
    });

    // Build Python command arguments
    const pythonArgs = [
      scriptPath,
      '--model', modelPath,
      '--image', imagePath,
      '--json_out', resultsPath,
      '--score_thr', scoreThr.toString(),
      '--topk', topk.toString()
    ];

    if (runColor) pythonArgs.push('--run_color');
    if (runPattern) pythonArgs.push('--run_pattern');
    if (runSeason) pythonArgs.push('--run_season');

    console.log('Executing Python with args:', pythonArgs.join(' '));

    // Execute Python script
    const pythonProcess = spawn('python', pythonArgs); // Change to 'python3' if needed

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('Python stdout:', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('Python stderr:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      console.log('Python process closed with code:', code);
      
      // Clean up uploaded file
      fs.unlink(imagePath, (err) => {
        if (err) console.error('Failed to delete temp file:', err);
      });

      if (code !== 0) {
        console.error('Python process failed:', { code, stderr, stdout });
        return res.status(500).json({ 
          error: 'Model analysis failed', 
          details: stderr || stdout,
          code 
        });
      }

      // Read the results.json file
      fs.readFile(resultsPath, 'utf8', (err, data) => {
        if (err) {
          console.error('Failed to read results file:', err);
          return res.status(500).json({ 
            error: 'Failed to read analysis results',
            details: err.message 
          });
        }

        try {
          const results = JSON.parse(data);
          console.log('Analysis results:', results);
          return res.json(results);
        } catch (parseErr) {
          console.error('Failed to parse results JSON:', parseErr);
          return res.status(500).json({ 
            error: 'Invalid results format',
            details: parseErr.message,
            rawData: data
          });
        }
      });
    });

    pythonProcess.on('error', (err) => {
      console.error('Failed to start Python process:', err);
      fs.unlink(imagePath, () => {});
      return res.status(500).json({ 
        error: 'Failed to start Python process',
        details: err.message 
      });
    });

  } catch (error) {
    console.error('Analyze endpoint error:', error);
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(500).json({ 
      error: 'Analysis failed', 
      details: error.message 
    });
  }
});


let clerkClient = null;
try {
  const clerk = require('@clerk/clerk-sdk-node');
  clerkClient = clerk?.clerkClient || clerk?.Clerk || null;
  if (clerkClient && !process.env.CLERK_SECRET_KEY) {
    console.warn('CLERK_SECRET_KEY not provided — Clerk SDK loaded but will not be used.');
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

// Create uploads directory if it doesn't exist
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
  console.log('Created uploads directory');
}

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
    console.log('Saved conversations to', CONVOS_FILE);
  } catch (err) {
    console.error('Failed to write convos file', err);
  }
}


const demoUsers = [
  { id: "user1", username: "ayaan", displayName: "Ayaan Malik", imageUrl: null },
  { id: "user2", username: "sana", displayName: "Sana R.", imageUrl: null },
  { id: "user3", username: "support", displayName: "FitSense Support", imageUrl: null },
  { id: "user4", username: "rohit", displayName: "Rohit Patel", imageUrl: null },
];
// Add this after your /api/analyze endpoint (around line 200)


app.post('/api/generate-outfit-image', async (req, res) => {
  try {
    const { outfitDescription } = req.body;
    
    if (!outfitDescription) {
      return res.status(400).json({ error: 'Outfit description required' });
    }

    const STABILITY_API_KEY = process.env.STABILITY_API_KEY;
    
    if (!STABILITY_API_KEY) {
      return res.status(500).json({ error: 'Stability API key not configured' });
    }

    // Enhanced prompt for fashion photography
    const enhancedPrompt = `Professional fashion photography, studio lighting, clean background, ${outfitDescription}, high quality, detailed clothing, fashion model, full body shot, 8k resolution`;

    console.log('Generating image for outfit:', enhancedPrompt);

    const response = await fetch(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${STABILITY_API_KEY}`,
        },
        body: JSON.stringify({
          text_prompts: [
            {
              text: enhancedPrompt,
              weight: 1
            },
            {
              text: 'blurry, bad quality, distorted, ugly, low resolution',
              weight: -1
            }
          ],
          cfg_scale: 7,
          height: 1024,
          width: 1024,
          steps: 30,
          samples: 1,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Stability AI error:', error);
      return res.status(response.status).json({ 
        error: 'Failed to generate image',
        details: error 
      });
    }

    const data = await response.json();
    
    if (data.artifacts && data.artifacts.length > 0) {
      // Return the base64 image
      return res.json({
        image: `data:image/png;base64,${data.artifacts[0].base64}`,
        seed: data.artifacts[0].seed
      });
    } else {
      return res.status(500).json({ error: 'No image generated' });
    }

  } catch (error) {
    console.error('Generate outfit image error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate outfit image',
      details: error.message 
    });
  }
});
/* ----------------- /api/users ----------------- */
app.get('/api/users', async (req, res) => {
  const q = (req.query.q || '').trim();
  try {
    // 1) Clerk if available
    if (clerkClient) {
      try {
        const list = q ? await clerkClient.users.getUserList({ query: q, limit: 50 }) : await clerkClient.users.getUserList({ limit: 20 });
        const out = list.map(u => ({
          id: u.id,
          username: u.username || (u.primaryEmailAddress && u.primaryEmailAddress.emailAddress) || null,
          displayName: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || null,
          imageUrl: u.profileImageUrl || null
        }));
        return res.json(out);
      } catch (e) {
        console.warn('Clerk lookup failed, falling back:', e && e.message);
      }
    }

    // 2) Supabase profiles table (if exists)
    if (typeof supabase !== 'undefined' && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE) {
      // adjust column names to your profiles schema
      const filter = q ? `username.ilike.%${q}%` : null;
      let query = supabase.from('profiles').select('id, username, full_name, avatar_url').limit(50);
      if (q) query = query.ilike('username', `%${q}%`).or(`full_name.ilike.%${q}%`);
      const { data, error } = await query;
      if (!error) {
        const out = (data || []).map(p => ({
          id: p.id,
          username: p.username || null,
          displayName: p.full_name || p.username || p.id,
          imageUrl: p.avatar_url || null
        }));
        return res.json(out);
      } else {
        console.warn('Supabase profiles lookup error', error);
      }
    }

    // 3) demo fallback
    const qlc = q.toLowerCase();
    const filtered = demoUsers.filter(u =>
      !qlc ||
      (u.displayName || '').toLowerCase().includes(qlc) ||
      (u.username || '').toLowerCase().includes(qlc)
    );
    return res.json(filtered);
  } catch (err) {
    console.error('users search error', err);
    return res.status(500).json({ error: err?.message || 'users search failed' });
  }
});

/* ---------- debug: print registered routes (optional) ---------- */
function printRegisteredRoutes() {
  if (!app || !app._router) return;
  const routes = [];
  app._router.stack.forEach(layer => {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
      routes.push(`${methods} ${layer.route.path}`);
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      layer.handle.stack.forEach(l => {
        if (l.route && l.route.path) {
          const methods = Object.keys(l.route.methods).join(',').toUpperCase();
          routes.push(`${methods} ${l.route.path}`);
        }
      });
    }
  });
  console.log('Registered routes:');
  routes.forEach(r => console.log('  ', r));
}
// ============= GET MESSAGES FOR A ROOM =============
app.get('/api/messages', async (req, res) => {
  const { roomId } = req.query;
  if (!roomId) return res.status(400).json({ error: 'roomId required' });

  console.log(`[GET /api/messages] roomId=${roomId}`);

  // If Supabase configured, try it first
  // --- also insert into Supabase if we have a service role key configured ---
  if (typeof supabase !== 'undefined' && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE) {
    try {
      // Use ISO string for timestamptz column
      const { data: sbData, error: sbErr } = await supabase
        .from('messages')
        .insert([{
          id: payload.id,
          room_id: payload.roomId,
          from_id: payload.fromId,
          from_name: payload.fromName,
          text: payload.text,
          created_at: new Date(payload.createdAt).toISOString()
        }])
        .select()
        .single()
        ;
      if (sbErr) {
        // don't fail entire request, just warn
        console.warn('Supabase insert warning (messages):', sbErr);
      } else {
        // optionally, if you want to use the canonical server values from supabase
        // you could set payload.created_at = sbData.created_at;
      }
    } catch (err) {
      console.error('Supabase insert error (messages):', err);
    }
  }

  // Fallback: return messages from in-memory / file store
  try {
    const local = messagesStore[roomId] || [];
    // Normalize to the same shape as Supabase returns (snake_case)
    const out = (local || []).map(m => ({
      id: m.id,
      room_id: m.roomId || m.room_id,
      from_id: m.fromId || m.from_id,
      from_name: m.fromName || m.from_name,
      text: m.text,
      created_at: (typeof m.created_at !== 'undefined') ? m.created_at : (typeof m.createdAt !== 'undefined' ? new Date(m.createdAt).toISOString() : new Date().toISOString())
    })).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return res.json({ messages: out });
  } catch (err) {
    console.error('Error loading messages from local store:', err);
    return res.status(500).json({ error: 'Failed to load messages', details: err.message || err });
  }
});

// ============= GET CONVERSATIONS =============
app.post('/api/conversations', async (req, res) => {
  // accept userId from query OR body
  const userId = req.query.userId || req.body.userId;
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }
  const { participantId, participantDisplayName, participantImage } = req.body;
  if (!participantId) return res.status(400).json({ error: 'participantId required' });

  const roomId = [userId, participantId].sort().join('_');
  const createdAtNum = toNumericTs(req.body.createdAt || Date.now());

  if (mongoose.connection.readyState) {
    try {
      const existing = await Conversation.findOne({ roomId });
      if (!existing) {
        const meta = {};
        meta[participantId] = { displayName: participantDisplayName || participantId, image: participantImage || null };
        meta[userId] = { displayName: 'You' };
        await Conversation.create({ roomId, participants: [userId, participantId], meta, createdAt: createdAtNum });
      }
      return res.json({ roomId });
    } catch (err) {
      console.error('create convo err', err);
      return res.status(500).json({ error: err.message || 'create convo failed' });
    }
  } else {
    // file/in-memory fallback
    const convo = { roomId, otherId: participantId, otherDisplayName: participantDisplayName || null, otherImage: participantImage || null, createdAt: createdAtNum };
    conversationsByUser[userId] = conversationsByUser[userId] || [];
    conversationsByUser[participantId] = conversationsByUser[participantId] || [];
    if (!conversationsByUser[userId].some(c => c.roomId === roomId)) conversationsByUser[userId].push(convo);
    if (!conversationsByUser[participantId].some(c => c.roomId === roomId)) {
      conversationsByUser[participantId].push({ roomId, otherId: userId, otherDisplayName: 'You', otherImage: null, createdAt: createdAtNum });
    }
    // persist to disk if using file fallback
    try { saveConvosFile(); } catch (e) { console.error('failed saving convos to disk', e); }
    return res.json({ roomId });
  }
});

// ============= CREATE CONVERSATION =============
/* ---------- helpers (if not already present) ---------- */
function toNumericTs(val) {
  if (!val) return Date.now();
  if (typeof val === 'number') return val;
  const n = Date.parse(val);
  return isNaN(n) ? Date.now() : n;
}

/* ---------- GET /api/conversations (returns list for a user) ---------- */
app.get('/api/conversations', async (req, res) => {
  const userId = req.query.userId || req.body.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    // 1) Supabase primary (server-side)
    if (typeof supabase !== 'undefined' && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE) {
      // conversations table assumed with columns: id (roomId), participant_a, participant_b, display_name_a, display_name_b, created_at
      const { data: rows, error } = await supabase
        .from('conversations')
        .select('id, participant_a, participant_b, display_name_a, display_name_b, created_at')
        .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) {
        console.warn('Supabase: convos fetch error', error);
        // fall through to other layers
      } else {
        const convos = (rows || []).map(r => {
          const otherId = (r.participant_a === userId) ? r.participant_b : r.participant_a;
          const otherDisplayName = (r.participant_a === userId) ? (r.display_name_b || otherId) : (r.display_name_a || otherId);
          return {
            roomId: r.id,
            otherId,
            otherDisplayName,
            otherImage: null,
            createdAt: r.created_at || null,
            lastMessage: "",           // you can join messages table if you want last message
            lastMessageTime: r.created_at || null
          };
        });
        return res.json({ conversations: convos });
      }
    }

    // 2) MongoDB fallback
    if (mongoose.connection.readyState) {
      const convos = await Conversation.find({ participants: userId }).sort({ createdAt: -1 }).lean();
      const out = convos.map(c => {
        const otherId = c.participants.find(p => p !== userId) || (c.participants[0] || null);
        return {
          roomId: c.roomId,
          otherId,
          otherDisplayName: c.meta?.[otherId]?.displayName || otherId,
          otherImage: c.meta?.[otherId]?.image || null,
          createdAt: c.createdAt,
          lastMessage: '',
          lastMessageTime: c.createdAt
        };
      });
      return res.json({ conversations: out });
    }

    // 3) File/in-memory fallback
    const convos = conversationsByUser[userId] || [];
    return res.json({ conversations: convos });

  } catch (err) {
    console.error('Get conversations error', err);
    return res.status(500).json({ error: 'Failed to load conversations', details: err.message || err });
  }
});
// ============= SEND MESSAGE =============
app.post('/api/messages', async (req, res) => {
  // accept userId from query OR body (frontend sends it in body)
  const userId = req.query.userId || req.body.userId || 'me';
  const { roomId, text } = req.body;
  if (!roomId || !text) return res.status(400).json({ error: 'roomId & text required' });

  // Ensure createdAt is numeric (ms)
  const createdAtNum = toNumericTs(req.body.createdAt || Date.now());

  // Prepare payload with DB-friendly fields
  const payload = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    roomId,
    fromId: userId,
    fromName: req.body.fromName || userId,
    text,
    createdAt: createdAtNum,   // for Mongo / file
    created_at: createdAtNum,  // helpful if your Postgres layer expects snake_case
  };

  // --- Save message to Mongo (if connected) or fallback to file/in-memory ---
  if (mongoose.connection.readyState) {
    try {
      await Message.create({
        id: payload.id,
        roomId: payload.roomId,
        fromId: payload.fromId,
        fromName: payload.fromName,
        text: payload.text,
        createdAt: payload.createdAt
      });
    } catch (err) {
      console.error('save message err (mongo)', err);
      return res.status(500).json({ error: 'save message failed', details: String(err) });
    }
  } else {
    // fallback in-memory + file write
    messagesStore[roomId] = messagesStore[roomId] || [];
    messagesStore[roomId].push(payload);
    try { saveMessagesFile(); } catch (e) { console.error('failed saving messages to disk', e); }
  }

  // --- Optional: insert into Supabase messages table if configured ---
// safer supabase fetch in GET /api/messages
if (typeof supabase !== 'undefined' && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE) {
  try {
    // adjust column names to match your table if different
    const { data: sbRows, error: sbErr } = await supabase
      .from('messages')
      .select('id, room_id, from_id, from_name, text, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(10000);

    if (!sbErr) {
      // return rows as-is (supabase shape) — client normalizer accepts both snake & camel
      return res.json({ messages: sbRows || [] });
    } else {
      console.warn('Supabase: failed to fetch messages', sbErr);
      // fall through to local fallback below
    }
  } catch (err) {
    console.warn('Supabase messages read error', err);
    // fall through to fallback
  }
}

  // ---------- IMPORTANT: Update conversation "last message" / "last message time" ----------
  // Try all configured backends (Supabase, Mongo, file) but never crash the handler if one fails.
  const isoTime = new Date(createdAtNum).toISOString();
  // 1) Supabase: update conversations row if table exists
  if (typeof supabase !== 'undefined' && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE) {
    try {
      // adjust column names to match your schema (here assumed: id, last_message, last_message_time)
      const { error: updErr } = await supabase
        .from('conversations')
        .update({
          last_message: text,
          last_message_time: isoTime
        })
        .eq('id', roomId);

      if (updErr) {
        console.warn('Supabase: failed updating conversation last message', updErr);
      }
    } catch (err) {
      console.warn('Supabase update conv error', err);
    }
  }

  // 2) MongoDB: set lastMessage / lastMessageTime on Conversation doc (upsert-safe)
  if (mongoose.connection.readyState) {
    try {
      await Conversation.updateOne(
        { roomId },
        { $set: { lastMessage: text, lastMessageTime: createdAtNum } },
        { upsert: true }
      );
    } catch (err) {
      console.warn('Mongo: failed updating conversation last message', err);
    }
  } else {
    // 3) File/in-memory fallback: update conversationsByUser for both participants
    try {
      const parts = roomId.split('_').filter(Boolean);
      if (parts.length >= 2) {
        const [a, b] = parts;
        const updateForUser = (uid, otherId) => {
          conversationsByUser[uid] = conversationsByUser[uid] || [];
          const idx = conversationsByUser[uid].findIndex(c => c.roomId === roomId);
          if (idx >= 0) {
            conversationsByUser[uid][idx].lastMessage = text;
            conversationsByUser[uid][idx].lastMessageTime = createdAtNum;
          } else {
            // If the convo isn't present for this user, push a minimal record
            conversationsByUser[uid].push({
              roomId,
              otherId,
              otherDisplayName: otherId === uid ? 'You' : otherId,
              lastMessage: text,
              lastMessageTime: createdAtNum,
              createdAt: createdAtNum
            });
          }
        };
        updateForUser(a, b);
        updateForUser(b, a);
        // persist
        try { saveConvosFile(); } catch (e) { console.error('failed saving convos to disk', e); }
      } else {
        // couldn't parse participants - skip
      }
    } catch (err) {
      console.warn('File fallback: failed updating convos', err);
    }
  }

  // Trigger Pusher if available
  if (pusher) {
    try {
      await pusher.trigger(`private-chat_${roomId}`, 'message', payload);
    } catch (err) {
      console.error('pusher trigger err:', err);
      // don't fail - still return the saved payload
    }
  } else {
    console.log('Message saved (Pusher disabled):', payload);
  }

  // Return payload in a shape the frontend expects (try to include both snake_case and camelCase)
  return res.json({
    ok: true,
    payload: {
      id: payload.id,
      room_id: payload.roomId,
      roomId: payload.roomId,
      from_id: payload.fromId,
      fromId: payload.fromId,
      from_name: payload.fromName,
      fromName: payload.fromName,
      text: payload.text,
      created_at: payload.created_at,
      createdAt: payload.createdAt
    }
  });
});

// ============= ERROR HANDLER =============
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err?.message || 'Internal server error' });
});

// ============= START SERVER =============
app.listen(PORT, () => {
  console.log(`Dev server running on http://localhost:${PORT}`);
  console.log('Supabase URL:', process.env.SUPABASE_URL ? 'configured' : 'NOT configured');
  console.log('Supabase Service Role:', process.env.SUPABASE_SERVICE_ROLE ? 'configured' : 'NOT configured');

});