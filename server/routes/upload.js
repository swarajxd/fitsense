// server/routes/upload.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const streamifier = require("streamifier");
const cloudinary = require("../cloudinary");

// memory storage for multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG/PNG/WEBP images allowed"), false);
  }
});

router.post("/avatar", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const bufferStream = streamifier.createReadStream(req.file.buffer);

    const opts = {
      folder: "avatars",
      resource_type: "image",
      
      // optionally: transformation: [{ width: 800, crop: "limit" }]
    };

    const uploadStream = cloudinary.uploader.upload_stream(opts, (error, result) => {
      if (error) {
        console.error("Cloudinary error:", error);
        return res.status(500).json({ error: "Cloudinary upload failed", details: error });
      }
      // Respond with useful details
      res.json({
        url: result.secure_url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format
      });
    });

    bufferStream.pipe(uploadStream);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
