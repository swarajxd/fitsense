// server/routes/profile.js
const express = require("express");
const router = express.Router();
const supabaseAdmin = require("../lib/supabaseAdmin"); // service_role client

// GET /api/profile?userId=...
router.get("/", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
    return res.json(data || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// POST /api/profile
router.post("/", async (req, res) => {
  const { userId, name, username, bio, profilePic, public_id } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    const updates = {
      user_id: userId,
      name,
      username,
      bio,
      avatar_url: profilePic,
      public_id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .upsert(updates, { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw error;
    return res.json({ profile: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save profile" });
  }
});
// GET /api/profile/saved?userId=...
router.get("/saved", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    // 1. get saved post_ids for this user
    const { data: saves, error: saveErr } = await supabaseAdmin
      .from("saves")
      .select("post_id")
      .eq("user_id", userId);

    if (saveErr) throw saveErr;
    const postIds = (saves || []).map(s => s.post_id);
    if (postIds.length === 0) return res.json({ posts: [] });

    // 2. fetch posts by those ids
    const { data: posts, error: postErr } = await supabaseAdmin
      .from("posts")
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
      .in("id", postIds)
      .order("created_at", { ascending: false });

    if (postErr) throw postErr;

    // 3. map clean objects
    const mapped = (posts || []).map(post => ({
      id: post.id,
      user_id: post.user_id,
      caption: post.caption,
      image_url: post.image_url,
      image_path: post.image_path,
      created_at: post.created_at,
      author: post.profiles?.username ?? post.user_id,
      avatar: post.profiles?.avatar_url ?? null,
      saved: true,
      raw: post,
    }));

    return res.json({ posts: mapped });
  } catch (err) {
    console.error("[PROFILE/SAVED] error", err);
    res.status(500).json({ error: "Failed to fetch saved posts", details: err.message });
  }
});


module.exports = router;
