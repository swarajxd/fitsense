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

module.exports = router;
