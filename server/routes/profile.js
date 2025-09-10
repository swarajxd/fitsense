const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const filePath = path.join(__dirname, "../profile.json");

// GET saved profile
router.get("/", (req, res) => {
  if (!fs.existsSync(filePath)) return res.json({});
  const data = fs.readFileSync(filePath, "utf8");
  res.json(JSON.parse(data));
});

// POST save profile
router.post("/", (req, res) => {
  fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
  res.json({ ok: true, profile: req.body });
});

module.exports = router;
