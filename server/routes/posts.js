// server/routes/posts.js
const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../lib/supabaseAdmin');
require('dotenv').config();

// OPTIONAL: Clerk verification placeholder
async function verifyClerkToken(req) {
  // If you install @clerk/clerk-sdk-node, implement verification here.
  // Example placeholder that checks Authorization header and returns userId from token:
  // const token = req.headers.authorization?.replace('Bearer ', '');
  // verify token and return clerkUserId
  // For now return null meaning "not verified" and we'll trust client userId only if not provided.
  return null;
}

router.post('/', async (req, res) => {
  try {
    const authUserId = await verifyClerkToken(req); // null if not implemented
    const {
      userId: clientUserId,
      caption = null,
      tags = null,
      image_path = null,
      image_url = null
    } = req.body;

    const userId = authUserId || clientUserId; // prefer verified id if available
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    if (!image_path && !image_url) return res.status(400).json({ error: 'Missing image path or url' });

    const insertBody = {
      user_id: userId,
      caption,
      tags: Array.isArray(tags) ? tags : (tags ? JSON.parse(tags) : null),
      image_path,
      image_url
    };

    const { data, error } = await supabaseAdmin
      .from('posts')
      .insert([insertBody]);

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: error.message || 'Insert failed' });
    }

    return res.json({ success: true, post: data?.[0] ?? null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
