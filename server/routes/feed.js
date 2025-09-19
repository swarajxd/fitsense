// server/routes/feed.js
const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../lib/supabaseAdmin'); // service_role client

// Helper to get public URL for stored image if needed
async function getPublicUrlIfNeeded(image_url, image_path) {
  if (image_url) return image_url;
  if (!image_path) return null;
  try {
    const { data } = supabaseAdmin.storage.from('posts').getPublicUrl(image_path);
    return data?.publicUrl ?? null;
  } catch (e) {
    console.warn('getPublicUrlIfNeeded error', e && e.message);
    return null;
  }
}

/**
 * GET /api/posts/feed?limit=24&offset=0&userId=...
 * Returns global feed (excluding viewer's own posts when userId provided).
 */
router.get('/feed', async (req, res) => {
  res.set('Cache-Control', 'no-store'); // avoid caching stale results
  const limit = Math.min(parseInt(req.query.limit || '24', 10), 100);
  const offset = parseInt(req.query.offset || '0', 10) || 0;
  const userId = req.query.userId || null;

  try {
    const from = offset;
    const to = offset + limit - 1;

    // Build base query
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
      .order('created_at', { ascending: false });

    // Exclude viewer's own posts when userId provided
    if (userId) query = query.neq('user_id', userId);

    query = query.range(from, to);

    const { data: rows, error } = await query;
    if (error) {
      console.error('[FEED] posts fetch error', error);
      return res.status(500).json({ error: error.message || 'failed to load posts' });
    }

    // If viewer provided, fetch followees once to mark isFollowing
    let followeeIds = [];
    if (userId) {
      try {
        const { data: follows, error: fErr } = await supabaseAdmin
          .from('follows')
          .select('followee_id')
          .eq('follower_id', userId);

        if (!fErr && Array.isArray(follows)) {
          followeeIds = follows.map(f => f.followee_id).filter(Boolean);
        } else if (fErr) {
          console.warn('[FEED] follows fetch warning', fErr);
        }
      } catch (e) {
        console.warn('[FEED] follows fetch exception', e && e.message);
      }
    }
     // --- likes + liked logic (single query for all posts) ---
    const postIds = (rows || []).map(r => r.id).filter(Boolean);
    let likesRows = [];
    if (postIds.length) {
      const { data: lrows, error: lerr } = await supabaseAdmin
        .from('likes')
        .select('post_id, user_id')
        .in('post_id', postIds);

      if (lerr) {
        console.warn('[FEED] could not fetch likes', lerr);
      } else {
        likesRows = lrows || [];
      }
    }

    const counts = {};
    const likedByViewer = new Set();
    for (const l of likesRows) {
      counts[l.post_id] = (counts[l.post_id] || 0) + 1;
      if (userId && l.user_id === userId) likedByViewer.add(l.post_id);
    }


    // Map rows to output shape
    const mapped = await Promise.all((rows || []).map(async row => {
      const author = row.profiles?.username ?? row.user_id;
      const avatar = row.profiles?.avatar_url ?? null;
      const publicUrl = await getPublicUrlIfNeeded(row.image_url, row.image_path);

      return {
        id: row.id,
        user_id: row.user_id,
        caption: row.caption,
        image_url: publicUrl,
        image_path: row.image_path,
        created_at: row.created_at,
        author,
        avatar,
        isFollowing: userId ? followeeIds.includes(row.user_id) : false,
        likes: counts[row.id] || 0,
        liked: likedByViewer.has(row.id),

        raw: row
      };
    }));
    // debug (you can remove this later)
    console.log('[FEED OUT] sample', mapped.slice(0, 6).map(p => ({ id: p.id, likes: p.likes, liked: p.liked })));
    return res.json({ posts: mapped });
  } catch (err) {
    console.error('[FEED] server error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/posts/following?limit=24&offset=0&userId=...
 * Returns posts authored by users the viewer follows.
 * NOTE: returns only followees' posts (no own posts) and sets Cache-Control: no-store.
 */
router.get('/following', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const limit = Math.min(parseInt(req.query.limit || '24', 10), 100);
  const offset = parseInt(req.query.offset || '0', 10) || 0;
  const userId = req.query.userId || null;

  try {
    if (!userId) return res.json({ posts: [] });

    // 1) fetch followees
    const { data: follows, error: fErr } = await supabaseAdmin
      .from('follows')
      .select('followee_id')
      .eq('follower_id', userId);

    if (fErr) {
      console.error('[FOLLOWING] fetch follows error', fErr);
      return res.status(500).json({ error: fErr.message || 'failed to load follows' });
    }

    const followeeIds = (follows || []).map(f => f.followee_id).filter(Boolean);

    if (!followeeIds.length) return res.json({ posts: [] });

    // defensive: ensure we don't include the user's own id if somehow present
    const filteredFollowees = followeeIds.filter(id => id !== userId);
    if (!filteredFollowees.length) return res.json({ posts: [] });

    // 2) fetch posts by followees
    const from = offset;
    const to = offset + limit - 1;

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
      .in('user_id', filteredFollowees)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[FOLLOWING] posts fetch error', error);
      return res.status(500).json({ error: error.message || 'failed to load posts' });
    }

// --- paste this where you currently map rows to response in feed.js ---
// --- likes + liked logic for following posts ---
    const postIds = (rows || []).map(r => r.id).filter(Boolean);
    let likesRows = [];
    if (postIds.length) {
      const { data: lrows, error: lerr } = await supabaseAdmin
        .from('likes')
        .select('post_id, user_id')
        .in('post_id', postIds);

      if (lerr) {
        console.warn('[FOLLOWING] could not fetch likes', lerr);
      } else {
        likesRows = lrows || [];
      }
    }

    const counts = {};
    const likedByViewer = new Set();
    for (const l of likesRows) {
      counts[l.post_id] = (counts[l.post_id] || 0) + 1;
      if (userId && l.user_id === userId) likedByViewer.add(l.post_id);
    }
    // Map rows
    const mapped = await Promise.all((rows || []).map(async row => {
      const author = row.profiles?.username ?? row.user_id;
      const avatar = row.profiles?.avatar_url ?? null;
      const publicUrl = await getPublicUrlIfNeeded(row.image_url, row.image_path);

      return {
        id: row.id,
        user_id: row.user_id,
        caption: row.caption,
        image_url: publicUrl,
        image_path: row.image_path,
        created_at: row.created_at,
        author,
        avatar,
        isFollowing: true, // these are followees by definition
        likes: counts[row.id] || 0,        // <-- number of likes
        liked: likedByViewer.has(row.id), // <-- whether current viewer liked it

        raw: row
      };
    }));
    // debug log (optional, remove after verification)
 console.log('[FOLLOWING OUT] sample', mapped.slice(0, 6).map(p => ({ id: p.id, likes: p.likes, liked: p.liked })));


    return res.json({ posts: mapped });
  } catch (err) {
    console.error('[FOLLOWING] server error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
