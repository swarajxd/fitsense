// server/supabase-proxy-sockets.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');
const { Server } = require('socket.io');

const verifyClerkToken = require('./helpers/verifyClerkToken'); // must implement dev fallback

const app = express();
app.use(cors());
app.use(bodyParser.json());

// env
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE in server .env and restart.');
  process.exit(1);
}

// create admin client (service role)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  global: { headers: { 'x-supabase-admin': 'true' } }
});

// HTTP + Socket.IO server
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST']
  }
});

// Basic Socket.IO namespace/room handling
io.on('connection', (socket) => {
  socket.on('join', ({ room }) => {
    if (!room) return;
    const roomName = `room_${room}`;
    socket.join(roomName);
    socket.emit('joined', { room });
  });

  socket.on('leave', ({ room }) => {
    if (!room) return;
    const roomName = `room_${room}`;
    socket.leave(roomName);
  });
});

// Server subscribes to Supabase Realtime for messages table INSERTs
// and forwards them to socket.io rooms.
const setupSupabaseSubscription = () => {
  try {
    const channel = supabaseAdmin
      .channel('realtime-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new;
          if (!newMsg || !newMsg.room_id) return;
          const roomName = `room_${newMsg.room_id}`;
          io.to(roomName).emit('message', newMsg);
        }
      )
      .subscribe();

    console.log('Supabase realtime subscription established for INSERTs on messages.');
    // Keep channel while server runs
  } catch (err) {
    console.error('Failed to set up Supabase realtime subscription:', err);
  }
};

setupSupabaseSubscription();

/* REST endpoints */

// GET conversations for a user
app.get('/api/conversations', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error });
    return res.json({ conversations: data || [] });
  } catch (err) {
    console.error('GET /api/conversations', err);
    return res.status(500).json({ error: err.message || 'server error' });
  }
});

// GET messages for a room
app.get('/api/messages', async (req, res) => {
  try {
    const roomId = req.query.roomId;
    if (!roomId) return res.status(400).json({ error: 'roomId required' });

    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error });
    return res.json({ messages: data || [] });
  } catch (err) {
    console.error('GET /api/messages', err);
    return res.status(500).json({ error: err.message || 'server error' });
  }
});

// POST create/upsert conversation
app.post('/api/conversations', async (req, res) => {
  try {
    const clerkUserId = await verifyClerkToken(req);
    const row = req.body;
    if (!(row.participant_a === clerkUserId || row.participant_b === clerkUserId)) {
      return res.status(403).json({ error: 'You can only create conversations you are a participant of' });
    }

    const { error } = await supabaseAdmin.from('conversations').upsert([row], { onConflict: ['id'] });
    if (error) return res.status(500).json({ error });
    return res.json({ ok: true, roomId: row.id });
  } catch (err) {
    console.error('POST /api/conversations', err);
    return res.status(401).json({ error: err.message || 'Unauthorized' });
  }
});

// SINGLE robust POST insert message (returns canonical inserted row)
app.post('/api/messages', async (req, res) => {
  try {
    const clerkUserId = await verifyClerkToken(req);

    const body = req.body;
    if (!body || !body.room_id || !body.text || !body.from_id) {
      return res.status(400).json({ error: 'room_id, from_id & text required' });
    }

    if (body.from_id !== clerkUserId) {
      return res.status(403).json({ error: 'from_id must match authenticated user' });
    }

    // verify conversation exists and that user is a participant
    const { data: convs, error: convErr } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', body.room_id)
      .limit(1);

    if (convErr) {
      console.error('conversations lookup error', convErr);
      return res.status(500).json({ error: convErr });
    }

    if (!convs || convs.length === 0) {
      return res.status(400).json({ error: 'room not found' });
    }

    const conv = convs[0];
    if (!(conv.participant_a === clerkUserId || conv.participant_b === clerkUserId)) {
      return res.status(403).json({ error: 'not a participant of this room' });
    }

    const insertPayload = {
      ...body,
      created_at: body.created_at || new Date().toISOString()
    };

    const { data: insertedRow, error: insertErr } = await supabaseAdmin
      .from('messages')
      .insert([insertPayload])
      .select()
      .single();

    if (insertErr) {
      console.error('INSERT messages error', insertErr);
      return res.status(500).json({ error: insertErr });
    }

    console.log('Inserted message:', insertedRow);

    // Return canonical message so client can replace optimistic
    return res.json({ ok: true, message: insertedRow });
  } catch (err) {
    console.error('POST /api/messages', err);
    return res.status(401).json({ error: err.message || 'Unauthorized' });
  }
});

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => {
  console.log(`Supabase proxy/socket server listening on ${PORT}`);
});
