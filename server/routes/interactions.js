// server/routes/interactions.js
const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../lib/supabaseAdmin'); // service_role client

// helper to send JSON error
function errRes(res, msg, status = 400) {
  return res.status(status).json({ error: msg });
}

// normalize IDs from body OR query (snake or camel)
function getIds(req) {
  const followerId = req.body?.followerId || req.body?.follower_id || req.query?.followerId || req.query?.follower_id;
  const followeeId = req.body?.followeeId || req.body?.followee_id || req.query?.followeeId || req.query?.followee_id;
  return { followerId, followeeId };
}

// POST /api/interactions/follow
router.post('/follow', async (req, res) => {
  const { followerId, followeeId } = getIds(req);
  console.log('[FOLLOW] request body:', { followerId, followeeId });

  if (!followerId || !followeeId) {
    console.warn('[FOLLOW] Missing IDs', { followerId, followeeId });
    return errRes(res, 'Missing IDs', 400);
  }

  try {
    // 1) check if follow already exists
    const { data: existing, error: checkErr } = await supabaseAdmin
      .from('follows')
      .select('*')
      .match({ follower_id: followerId, followee_id: followeeId })
      .limit(1);

    if (checkErr) {
      console.error('[FOLLOW] check error:', checkErr);
      return errRes(res, 'Follow check failed', 500);
    }

    if (existing && existing.length > 0) {
      // already following — idempotent success
      console.log('[FOLLOW] already exists:', { followerId, followeeId });
      return res.json({ ok: true, alreadyFollowing: true, follow: existing[0] });
    }

    // 2) insert new follow row
    const payload = { follower_id: followerId, followee_id: followeeId, created_at: new Date().toISOString() };
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('follows')
      .insert([payload]);

    if (insertErr) {
      // handle duplicate key edge-case defensively (race condition)
      console.error('[FOLLOW] insert error:', insertErr);
      // Supabase Postgres unique-violation handling may differ; return generic error if needed
      return errRes(res, 'Follow failed', 500);
    }

    console.log('[FOLLOW] inserted:', inserted);
    return res.json({ ok: true, alreadyFollowing: false, follow: inserted?.[0] ?? null });
  } catch (err) {
    console.error('[FOLLOW] exception:', err);
    return errRes(res, 'Follow failed', 500);
  }
});

// POST /api/interactions/unfollow  (keeps backward compatibility)
router.post('/unfollow', async (req, res) => {
  const { followerId, followeeId } = getIds(req);
  console.log('[UNFOLLOW][POST] request body:', { followerId, followeeId });

  if (!followerId || !followeeId) return errRes(res, 'Missing IDs', 400);

  try {
    const { data, error } = await supabaseAdmin
      .from('follows')
      .delete()
      .match({ follower_id: followerId, followee_id: followeeId });

    if (error) {
      console.error('[UNFOLLOW][POST] supabase error:', error);
      return errRes(res, 'Unfollow failed', 500);
    }

    console.log('[UNFOLLOW][POST] success, deleted rows:', (data || []).length, { followerId, followeeId });
    return res.json({ ok: true, deleted: (data || []).length });
  } catch (err) {
    console.error('[UNFOLLOW][POST] exception:', err);
    return errRes(res, 'Unfollow failed', 500);
  }
});

// DELETE /api/interactions/follow?followerId=...&followeeId=...
// This is the robust endpoint the client was calling (DELETE with query params)
router.delete('/follow', async (req, res) => {
  const { followerId, followeeId } = getIds(req);
  console.log('[UNFOLLOW][DELETE] request data:', { followerId, followeeId });

  if (!followerId || !followeeId) return errRes(res, 'Missing IDs', 400);

  try {
    const { data, error } = await supabaseAdmin
      .from('follows')
      .delete()
      .match({ follower_id: followerId, followee_id: followeeId });

    if (error) {
      console.error('[UNFOLLOW][DELETE] supabase error:', error);
      return errRes(res, 'Unfollow failed', 500);
    }

    console.log('[UNFOLLOW][DELETE] success, deleted rows:', (data || []).length, { followerId, followeeId });
    return res.json({ ok: true, deleted: (data || []).length });
  } catch (err) {
    console.error('[UNFOLLOW][DELETE] exception:', err);
    return errRes(res, 'Unfollow failed', 500);
  }
});

/* ---------- Likes / Saves (unchanged behaviour) ---------- */

// like
router.post("/like", async (req, res) => {
  const { userId, postId } = req.body;
  if (!userId || !postId) return errRes(res, 'Missing IDs', 400);
  try {
    const { error } = await supabaseAdmin.from("likes").upsert({ user_id: userId, post_id: postId });
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error("Like error:", err);
    res.status(500).json({ error: "Like failed" });
  }
});

// unlike
router.post("/unlike", async (req, res) => {
  const { userId, postId } = req.body;
  if (!userId || !postId) return errRes(res, 'Missing IDs', 400);
  try {
    const { error } = await supabaseAdmin.from("likes").delete().eq("user_id", userId).eq("post_id", postId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error("Unlike error:", err);
    res.status(500).json({ error: "Unlike failed" });
  }
});

// save
router.post("/save", async (req, res) => {
  const { userId, postId } = req.body;
  if (!userId || !postId) return errRes(res, 'Missing IDs', 400);
  try {
    const { error } = await supabaseAdmin.from("saves").upsert({ user_id: userId, post_id: postId });
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error("Save error:", err);
    res.status(500).json({ error: "Save failed" });
  }
});

// unsave
router.post("/unsave", async (req, res) => {
  const { userId, postId } = req.body;
  if (!userId || !postId) return errRes(res, 'Missing IDs', 400);
  try {
    const { error } = await supabaseAdmin.from("saves").delete().eq("user_id", userId).eq("post_id", postId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error("Unsave error:", err);
    res.status(500).json({ error: "Unsave failed" });
  }
});

module.exports = router;
