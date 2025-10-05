// server/routes/posts.js
const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../lib/supabaseAdmin');
require('dotenv').config();

// OPTIONAL: Clerk verification placeholder (kept from your original file)
async function verifyClerkToken(req) {
  // If you install @clerk/clerk-sdk-node, implement verification here.
  // Example placeholder that checks Authorization header and returns userId from token:
  // const token = req.headers.authorization?.replace('Bearer ', '');
  // verify token and return clerkUserId
  // For now return null meaning "not verified" and we'll trust client userId only if not provided.
  return null;
}

// Helper: parse & sanitize pagination params
function parsePagination(query) {
  const rawLimit = parseInt(query.limit ?? "50", 10) || 50;
  const limit = Math.min(Math.max(rawLimit, 1), 200); // clamp 1..200
  const rawOffset = parseInt(query.offset ?? "0", 10) || 0;
  const offset = Math.max(rawOffset, 0);
  return { limit, offset };
}

// --------------------
// GET /api/posts?userId=...&viewerId=...&limit=...&offset=...
// --------------------
router.get('/', async (req, res) => {
  const { userId, viewerId } = req.query;
  const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);
  const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

  try {
    const select = `
      id,
      user_id,
      caption,
      image_url,
      image_path,
      created_at,
      profiles!inner (
        username,
        avatar_url
      )
    `;

    // fetch posts
    let query = supabaseAdmin
      .from('posts')
      .select(select)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) query = query.eq('user_id', userId);

    const { data: posts, error: postErr } = await query;
    if (postErr) throw postErr;
    if (!posts || posts.length === 0) return res.json({ posts: [] });

    // get all post_ids
    const postIds = posts.map(p => p.id);

    // fetch likes counts
    const { data: likesData, error: likesErr } = await supabaseAdmin
      .from('likes')
      .select('post_id, user_id');
    if (likesErr) throw likesErr;

    // aggregate like counts and whether viewer liked
    const likeCounts = {};
    const likedByViewer = {};
    for (const like of likesData) {
      likeCounts[like.post_id] = (likeCounts[like.post_id] || 0) + 1;
      if (viewerId && like.user_id === viewerId) likedByViewer[like.post_id] = true;
    }

    const mapped = posts.map(row => ({
      id: row.id,
      user_id: row.user_id,
      caption: row.caption,
      image_url: row.image_url,
      image_path: row.image_path,
      created_at: row.created_at,
      likes: likeCounts[row.id] || 0,
      liked: !!likedByViewer[row.id],
      author: row.profiles?.username ?? row.user_id,
      avatar: row.profiles?.avatar_url ?? null,
      raw: row
    }));

    return res.json({ posts: mapped, count: mapped.length, limit, offset });
  } catch (err) {
    console.error('[GET /api/posts] exception', err);
    return res.status(500).json({ error: 'Server error fetching posts', details: err.message });
  }
});


// --------------------
// GET /api/posts/user/:id  (same logic but specific user)
// --------------------
router.get('/user/:id', async (req, res) => {
  const userId = req.params.id;
  if (!userId) return res.status(400).json({ error: 'Missing user id' });

  try {
    const select = `
      id,
      user_id,
      caption,
      image_url,
      image_path,
      created_at,
      profiles!inner (
        username,
        avatar_url
      )
    `;

    const { data: posts, error: postErr } = await supabaseAdmin
      .from('posts')
      .select(select)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (postErr) throw postErr;
    if (!posts || posts.length === 0) return res.json({ posts: [] });

    // likes
    const postIds = posts.map(p => p.id);
    const { data: likesData, error: likesErr } = await supabaseAdmin
      .from('likes')
      .select('post_id, user_id')
      .in('post_id', postIds);
    if (likesErr) throw likesErr;

    const likeCounts = {};
    for (const like of likesData) {
      likeCounts[like.post_id] = (likeCounts[like.post_id] || 0) + 1;
    }

    const mapped = posts.map(row => ({
      id: row.id,
      user_id: row.user_id,
      caption: row.caption,
      image_url: row.image_url,
      image_path: row.image_path,
      created_at: row.created_at,
      likes: likeCounts[row.id] || 0,
      author: row.profiles?.username ?? row.user_id,
      avatar: row.profiles?.avatar_url ?? null,
      raw: row
    }));

    return res.json({ posts: mapped, count: mapped.length });
  } catch (err) {
    console.error('[GET /api/posts/user/:id] exception', err);
    return res.status(500).json({ error: 'Server error fetching user posts', details: err.message });
  }
});

// --------------------
// Keep your existing POST / route (unchanged)
// --------------------
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
