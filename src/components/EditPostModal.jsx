// src/components/EditPostModal.jsx
import React, { useState, useEffect } from "react";
import "./EditPostModal.css"; 

export default function EditPostModal({ open = false, post = null, onClose = () => {}, onSave = async () => {} }) {
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (post) {
      setCaption(post.caption ?? "");
      // support multiple shapes
      setImageUrl(post.image || post.image_url || post.imagePath || "");
    } else {
      setCaption("");
      setImageUrl("");
    }
  }, [post]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      // call parent's onSave with edited fields (only send fields that changed)
      const edited = {};
      if ((caption ?? "") !== (post?.caption ?? "")) edited.caption = caption;
      if ((imageUrl ?? "") !== (post?.image || post?.image_url || post?.imagePath || "")) {
        edited.image = imageUrl;
      }
      await onSave(edited, post);
    } catch (err) {
      console.error("Edit save failed", err);
      alert("Failed to save changes: " + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit post">
      <div className="modal-card">
        <header className="modal-header">
          <h3>Edit post</h3>
          <button className="modal-close" onClick={() => onClose()} aria-label="Close">✕</button>
        </header>

        <form className="modal-body" onSubmit={handleSubmit}>
          <label className="modal-label">
            Caption
            <textarea
              className="modal-input"
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption..."
            />
          </label>

          <label className="modal-label">
            Image URL
            <input
              className="modal-input"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn btn-muted" onClick={() => onClose()} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>

      
      
    </div>
  );
}
