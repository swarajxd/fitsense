// server/routes/messages.js (example)
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

// TODO: replace this with real Clerk verification using Clerk server SDK
async function verifyClerkToken(req) {
  const auth = req.headers.authorization; // Bearer <clerk_token>
  if (!auth) return null;
  const token = auth.split(' ')[1];
  // Verify token with Clerk and return clerkUserId
  // e.g. const payload = await clerkVerify(token); return payload.sub;
  // For now: throw if missing
  throw new Error('Implement Clerk token verification on server');
}

router.post('/conversations', async (req, res) => {
  try {
    const clerkUserId = await verifyClerkToken(req);
    // validate that clerkUserId === req.body.participant_a OR participant_b
    // then upsert conversation with supabaseAdmin
    const row = req.body;
    const { error } = await supabaseAdmin.from('conversations').upsert([row], { onConflict: 'id' });
    if (error) return res.status(500).json({ error });
    res.json({ ok: true });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

router.post('/messages', async (req, res) => {
  try {
    const clerkUserId = await verifyClerkToken(req);
    // ensure clerkUserId === req.body.from_id and is a participant in conversation
    const row = req.body;
    const { error } = await supabaseAdmin.from('messages').insert([row]);
    if (error) return res.status(500).json({ error });
    res.json({ ok: true });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

module.exports = router;
