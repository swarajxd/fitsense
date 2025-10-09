// server/supabase-proxy.js
// Usage: node server/supabase-proxy.js
// npm i express body-parser cors @supabase/supabase-js dotenv

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// must set in server .env (NOT frontend)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE in server .env and restart.');
  process.exit(1);
}

// create admin client (service role)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  // Optionally set a custom header to indicate admin usage
  global: { headers: { 'x-supabase-admin': 'true' } }
});

/*
  verifyClerkToken:
  - In DEV you can pass x-clerk-user-id header (quick local testing).
  - In PROD integrate Clerk server SDK to verify the user's token (recommended).
*/
async function verifyClerkToken(req) {
  // Quick DEV mode: allow header x-clerk-user-id (only for local testing).
  if (process.env.NODE_ENV !== 'production' && req.headers['x-clerk-user-id']) {
    return req.headers['x-clerk-user-id'];
  }

  // Production placeholder: verify Authorization: Bearer <clerk_jwt>
  // Replace the code below with your Clerk verify logic using Clerk's server SDK
  // Example: use @clerk/clerk-sdk-node to verify token and return user id (sub)
  //
  // const token = (req.headers.authorization || '').split(' ')[1];
  // if (!token) throw new Error('Missing auth token');
  // const payload = await clerkVerifyToken(token);
  // return payload.sub;
  //
  // For now, refuse if not DEV header:
  const auth = req.headers.authorization;
  if (!auth) throw new Error('Unauthorized: missing Authorization header (or x-clerk-user-id in dev)');
  throw new Error('Server authorization not implemented: integrate Clerk server verification');
}

/* GET /api/conversations?userId=... */
app.get('/api/conversations', async (req, res) => {
  try {
    // You may want to verify user here too (optional for read)
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

/* GET /api/messages?roomId=... */
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

/* POST /api/conversations
   Body: { id, participant_a, participant_b, display_name_a, display_name_b, created_at }
*/
app.post('/api/conversations', async (req, res) => {
  try {
    const clerkUserId = await verifyClerkToken(req); // throws if not valid
    const body = req.body;
    // Basic check: ensure clerkUserId is one participant
    if (!(body.participant_a === clerkUserId || body.participant_b === clerkUserId)) {
      return res.status(403).json({ error: 'You can only create conversations you are a participant of' });
    }

    const { error } = await supabaseAdmin.from('conversations').upsert([body], { onConflict: ['id'] });
    if (error) return res.status(500).json({ error });
    return res.json({ ok: true, roomId: body.id });
  } catch (err) {
    console.error('POST /api/conversations', err);
    return res.status(401).json({ error: err.message || 'Unauthorized' });
  }
});

/* POST /api/messages
   Body: { id, room_id, from_id, from_name, text, created_at }
*/
app.post('/api/messages', async (req, res) => {
  try {
    const clerkUserId = await verifyClerkToken(req);
    const body = req.body;
    if (body.from_id !== clerkUserId) {
      return res.status(403).json({ error: 'from_id must match authenticated user' });
    }

    // Optionally: verify that the room exists and the user is a participant
    const { data: convs, error: convErr } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', body.room_id)
      .limit(1);
    if (convErr) return res.status(500).json({ error: convErr });
    if (!convs || convs.length === 0) return res.status(400).json({ error: 'room not found' });

    const conv = convs[0];
    if (!(conv.participant_a === clerkUserId || conv.participant_b === clerkUserId)) {
      return res.status(403).json({ error: 'not a participant of this room' });
    }

    const { error } = await supabaseAdmin.from('messages').insert([body]);
    if (error) return res.status(500).json({ error });
    return res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/messages', err);
    return res.status(401).json({ error: err.message || 'Unauthorized' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Supabase proxy listening on ${PORT} (DEV header: x-clerk-user-id allowed in non-production)`);
});
