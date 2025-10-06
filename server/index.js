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
  try {
    const q = (req.query.q || '').trim();
    
    if (!process.env.CLERK_SECRET_KEY || !clerkClient) {
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

// ============= GET CONVERSATIONS =============
app.get('/api/conversations', async (req, res) => {
  const userId = req.query.userId;
  
  if (!userId || userId === 'anon') {
    return res.status(400).json({ error: 'Valid userId required' });
  }

  try {
    // Query conversations where user is either participant_a or participant_b
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching conversations:', error);
      return res.status(500).json({ error: 'Failed to load conversations', details: error.message });
    }

    // Transform conversations to include other participant info
    const transformedConversations = (conversations || []).map(conv => {
      const isUserA = conv.participant_a === userId;
      const otherId = isUserA ? conv.participant_b : conv.participant_a;
      const otherDisplayName = isUserA ? conv.display_name_b : conv.display_name_a;

      return {
        roomId: conv.id,
        otherId,
        otherDisplayName: otherDisplayName || otherId,
        lastMessage: conv.last_message || '',
        lastMessageTime: conv.last_message_time || conv.created_at,
        createdAt: conv.created_at,
      };
    });

    return res.json({ conversations: transformedConversations });
  } catch (err) {
    console.error('Error loading conversations:', err);
    return res.status(500).json({ error: 'Failed to load conversations', details: err.message });
  }
});

// ============= CREATE CONVERSATION =============
app.post('/api/conversations', async (req, res) => {
  const { userId, roomId, participantId, participantDisplayName } = req.body;

  if (!userId || !participantId) {
    return res.status(400).json({ 
      error: 'userId and participantId required',
      received: { userId, participantId }
    });
  }

  // Generate roomId if not provided
  const finalRoomId = roomId || [userId, participantId].sort().join('_');

  try {
    // Check if conversation already exists
    const { data: existing, error: checkError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', finalRoomId)
      .single();

    if (existing) {
      return res.json({ roomId: finalRoomId, message: 'Conversation already exists' });
    }

    // Get display name for current user (you might want to pass this from frontend)
    const currentUserDisplayName = 'You'; // Or fetch from Clerk if needed

    // Create new conversation
    const { data: newConversation, error: insertError } = await supabase
      .from('conversations')
      .insert({
        id: finalRoomId,
        participant_a: userId,
        participant_b: participantId,
        display_name_a: currentUserDisplayName,
        display_name_b: participantDisplayName || participantId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Supabase error creating conversation:', insertError);
      return res.status(500).json({ 
        error: 'Failed to create conversation', 
        details: insertError.message 
      });
    }

    return res.json({ 
      roomId: finalRoomId, 
      conversation: newConversation,
      message: 'Conversation created successfully' 
    });
  } catch (err) {
    console.error('Error creating conversation:', err);
    return res.status(500).json({ 
      error: 'Failed to create conversation', 
      details: err.message 
    });
  }
});

// ============= GET MESSAGES FOR A ROOM =============
app.get('/api/messages', async (req, res) => {
  const { roomId } = req.query;

  if (!roomId) {
    return res.status(400).json({ error: 'roomId required' });
  }

  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(1000);

    if (error) {
      console.error('Supabase error fetching messages:', error);
      return res.status(500).json({ 
        error: 'Failed to load messages', 
        details: error.message 
      });
    }

    return res.json({ messages: messages || [] });
  } catch (err) {
    console.error('Error loading messages:', err);
    return res.status(500).json({ 
      error: 'Failed to load messages', 
      details: err.message 
    });
  }
});

// ============= SEND MESSAGE =============
app.post('/api/messages', async (req, res) => {
  const { userId, roomId, text } = req.body;

  if (!roomId || !text) {
    return res.status(400).json({ 
      error: 'roomId & text required',
      received: { userId, roomId, text: text ? 'present' : 'missing' }
    });
  }

  if (!userId) {
    return res.status(400).json({ 
      error: 'userId required',
      received: { userId, roomId, text: 'present' }
    });
  }

  try {
    // Get user display name (optional - can be stored or fetched from Clerk)
    let fromName = userId;
    if (clerkClient && process.env.CLERK_SECRET_KEY) {
      try {
        const user = await clerkClient.users.getUser(userId);
        fromName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || userId;
      } catch (err) {
        console.warn('Could not fetch user name from Clerk:', err.message);
      }
    }

    // Create message in Supabase
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    
    const { data: newMessage, error: insertError } = await supabase
      .from('messages')
      .insert({
        id: messageId,
        room_id: roomId,
        from_id: userId,
        from_name: fromName,
        text: text.trim(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Supabase error creating message:', insertError);
      return res.status(500).json({ 
        error: 'Failed to send message', 
        details: insertError.message 
      });
    }

    // Update conversation's last message (optional but recommended for performance)
    try {
      await supabase
        .from('conversations')
        .update({
          last_message: text.trim().substring(0, 100), // Store preview
          last_message_time: new Date().toISOString(),
        })
        .eq('id', roomId);
    } catch (updateErr) {
      console.warn('Failed to update conversation last message:', updateErr);
      // Don't fail the request if this update fails
    }

    // Supabase Realtime will automatically broadcast this INSERT to subscribed clients
    return res.json({ 
      ok: true, 
      message: newMessage,
      roomId 
    });
  } catch (err) {
    console.error('Error sending message:', err);
    return res.status(500).json({ 
      error: 'Failed to send message', 
      details: err.message 
    });
  }
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