// server/index.js - Fixed with Supabase integration
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const postsRouter = require('./routes/posts');
const app = express();
const PORT = process.env.PORT || 7000;

// Middleware
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

// Optional Clerk server SDK
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

// Demo users fallback
const demoUsers = [
  { id: "user1", username: "ayaan", displayName: "Ayaan Malik", imageUrl: null },
  { id: "user2", username: "sana", displayName: "Sana R.", imageUrl: null },
  { id: "user3", username: "support", displayName: "FitSense Support", imageUrl: null },
  { id: "user4", username: "rohit", displayName: "Rohit Patel", imageUrl: null },
];

// ============= USER SEARCH ENDPOINT =============
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