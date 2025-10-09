// src/components/EditPostModal.jsx
import React, { useState, useEffect } from "react";
import "./EditPostModal.css";
import { supabase } from "../lib/supabaseClient";

export default function EditPostModal({ open = false, post = null, onClose = () => {}, onSave = async () => {} }) {
  const [caption, setCaption] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function maybeFetchTagsFromSupabase() {
      if (!post) {
        setCaption("");
        setTagsInput("");
        return;
      }

      // fast caption set
      setCaption(post.caption ?? "");

      // helper to try local shapes first
      const tryGetTagsString = (p) => {
        if (!p) return null;
        if (Array.isArray(p.tags)) return p.tags.join(", ");
        if (typeof p.tags === "string" && p.tags.trim()) return p.tags;
        if (p.raw && Array.isArray(p.raw.tags)) return p.raw.tags.join(", ");
        if (p.raw && typeof p.raw.tags === "string" && p.raw.tags.trim()) return p.raw.tags;
        // tags might be JSON string
        if (p.raw && typeof p.raw.tags === "string") {
          try {
            const parsed = JSON.parse(p.raw.tags);
            if (Array.isArray(parsed)) return parsed.join(", ");
            if (typeof parsed === "string") return parsed;
          } catch (e) { /* ignore */ }
        }
        return null;
      };

      // if tags already present, use them
      const existing = tryGetTagsString(post);
      if (existing !== null) {
        if (!cancelled) setTagsInput(existing);
        return;
      }

      // No tags locally → fetch from Supabase (only when modal open and post.id exists)
      if (!open || !post?.id) {
        if (!cancelled) setTagsInput("");
        return;
      }

      setLoadingTags(true);
      try {
        // Attempt to read 'tags' field from posts table by primary id
        const { data, error } = await supabase
          .from("posts")
          .select("tags")
          .eq("id", post.id)
          .maybeSingle();

        if (error) {
          console.warn("Supabase tags fetch error:", error);
          if (!cancelled) setTagsInput("");
          return;
        }

        const row = data ?? null;
        if (!row) {
          if (!cancelled) setTagsInput("");
          return;
        }

        // Normalize tags from multiple possible shapes
        if (Array.isArray(row.tags)) {
          if (!cancelled) setTagsInput(row.tags.join(", "));
          return;
        }

        if (typeof row.tags === "string" && row.tags.trim()) {
          // If it's a JSON string (like '["a","b"]'), try parse
          try {
            const parsed = JSON.parse(row.tags);
            if (Array.isArray(parsed)) {
              if (!cancelled) setTagsInput(parsed.join(", "));
              return;
            }
            // fallback to using the string directly
            if (!cancelled) setTagsInput(row.tags);
            return;
          } catch (e) {
            // not JSON — use as-is
            if (!cancelled) setTagsInput(row.tags);
            return;
          }
        }

        // if nothing found
        if (!cancelled) setTagsInput("");
      } catch (err) {
        console.warn("Error fetching tags from Supabase:", err);
        if (!cancelled) setTagsInput("");
      } finally {
        if (!cancelled) setLoadingTags(false);
      }
    }

    maybeFetchTagsFromSupabase();

    return () => { cancelled = true; };
  }, [post, open]);

  if (!open) return null;

  function parseTags(input) {
    return input
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
  }

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!post) return;
    setSaving(true);
    try {
      const edited = {};

      if ((caption ?? "") !== (post?.caption ?? "")) edited.caption = caption;

      const originalTags = Array.isArray(post?.tags)
        ? post.tags.join(", ")
        : (typeof post?.tags === "string" ? post.tags : (Array.isArray(post?.raw?.tags) ? post.raw.tags.join(", ") : ""));

      const normalizedOriginal = (originalTags || "").trim();
      const normalizedInput = (tagsInput || "").trim();

      if (normalizedInput !== normalizedOriginal) {
        const tags = parseTags(tagsInput);
        edited.tags = tags;
      }

      if (Object.keys(edited).length === 0) {
        onClose();
        return;
      }

      await onSave(edited, post);
      onClose();
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
          <button className="modal-close" onClick={() => onClose()} aria-label="Close" disabled={saving}>✕</button>
        </header>

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="modal-grid">
            <div className="modal-preview">
              <img
                src={post?.image || post?.image_url || post?.imagePath || "/path/to/fallback.jpg"}
                alt="Post preview"
                className="modal-preview-img"
              />
              <div className="modal-note">Image cannot be edited here.</div>
            </div>

            <div className="modal-fields">
              <label className="modal-label">
                Caption
                <textarea
                  className="modal-input"
                  rows={4}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write a caption..."
                  maxLength={2000}
                />
              </label>

              <label className="modal-label">
                Tags (comma separated)
                <input
                  className="modal-input"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. physics, revision, thermodynamics"
                />
                {loadingTags && <div style={{ fontSize: 12, color: "#ccc", marginTop: 6 }}>Loading tags…</div>}
              </label>

              <div className="modal-actions">
                <button type="button" className="btn btn-muted" onClick={() => onClose()} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
