// server/routes/feed.js
const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../lib/supabaseAdmin'); // your service_role client

// GET /api/posts/feed?limit=24&offset=0&userId=...
router.get('/feed', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 24, 100);
  const offset = parseInt(req.query.offset) || 0;
  const userId = req.query.userId; // optional

  try {
    const from = offset;
    const to = offset + limit - 1;

    // Select posts and join profile info
    let query = supabaseAdmin
      .from('posts')
      .select(`
        id,
        caption,
        image_url,
        image_path,
        created_at,
        user_id,
        profiles!inner (
          username,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (userId) {
      query = query.neq('user_id', userId); // exclude your own posts from "For you"
    }

    const { data: rows, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const mapped = (rows || []).map(row => {
      // row.profiles will be an object because of the join
      const author = row.profiles?.username ?? row.user_id;
      const avatar = row.profiles?.avatar_url ?? null;

      let publicUrl = row.image_url;
      if (!publicUrl && row.image_path) {
        const { data: pd } = supabaseAdmin
          .storage.from('posts')
          .getPublicUrl(row.image_path);
        publicUrl = pd?.publicUrl ?? null;
      }

      return {
        id: row.id,
        user_id: row.user_id,
        caption: row.caption,
        image_url: publicUrl,
        image_path: row.image_path,
        created_at: row.created_at,
        author,
        avatar,
        raw: row
      };
    });

    res.json({ posts: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/posts/following?userId=...&limit=24&offset=0
router.get('/following', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const limit = Math.min(parseInt(req.query.limit) || 24, 100);
  const offset = parseInt(req.query.offset) || 0;
  const from = offset;
  const to = offset + limit - 1;

  try {
    // get list of followees
    const { data: follows, error: fErr } = await supabaseAdmin
      .from('follows')
      .select('followee_id')
      .eq('follower_id', userId);

    if (fErr) throw fErr;
    const followeeIds = (follows || []).map(f => f.followee_id);
    if (followeeIds.length === 0) return res.json({ posts: [] });

    // Select posts and join profile info for followees
    const { data: rows, error } = await supabaseAdmin
      .from('posts')
      .select(`
        id,
        caption,
        image_url,
        image_path,
        created_at,
        user_id,
        profiles!inner (
          username,
          avatar_url
        )
      `)
      .in('user_id', followeeIds)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const mapped = (rows || []).map(row => {
      const author = row.profiles?.username ?? row.user_id;
      const avatar = row.profiles?.avatar_url ?? null;

      let publicUrl = row.image_url;
      if (!publicUrl && row.image_path) {
        const { data: pd } = supabaseAdmin.storage.from('posts').getPublicUrl(row.image_path);
        publicUrl = pd?.publicUrl ?? null;
      }
      return {
        id: row.id,
        user_id: row.user_id,
        caption: row.caption,
        image_url: publicUrl,
        image_path: row.image_path,
        created_at: row.created_at,
        author,
        avatar,
        raw: row
      };
    });

    return res.json({ posts: mapped });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = router;
