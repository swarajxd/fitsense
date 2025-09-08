import React, { useState, useEffect } from "react";

/**
 * Props:
 * - currentData: { name, bio, profilePic }
 * - onSave(updatedData)
 * - onCancel()
 */
export default function EditProfile({ currentData, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: "",
    bio: "",
    profilePic: "",
  });
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (currentData) {
      setForm({
        name: currentData.name || "",
        bio: currentData.bio || "",
        profilePic: currentData.profilePic || "",
      });
      setPreview(currentData.profilePic || "");
    }
  }, [currentData]);

  // handle file input -> dataURL
  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target.result);
      setForm((s) => ({ ...s, profilePic: ev.target.result }));
    };
    reader.readAsDataURL(f);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const submit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="ep-backdrop" role="dialog" aria-modal="true">
      <div className="ep-modal">
        <h3>Edit profile</h3>

        <form className="ep-form" onSubmit={submit}>
          <div className="ep-grid">
            <label className="ep-field">
              <span>Name</span>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className="ep-input"
              />
            </label>

            <label className="ep-field">
              <span>Bio</span>
              <textarea
                name="bio"
                value={form.bio}
                onChange={handleChange}
                className="ep-input"
                rows={3}
              />
            </label>

            <label className="ep-field">
              <span>Profile picture</span>
              <input type="file" accept="image/*" onChange={handleFile} />
              {preview ? (
                <img src={preview} alt="preview" className="ep-img-preview" />
              ) : (
                <div className="ep-img-placeholder">No image</div>
              )}
            </label>
          </div>

          <div className="ep-actions">
            <button
              type="button"
              onClick={onCancel}
              className="ep-btn ep-btn-ghost"
            >
              Cancel
            </button>
            <button type="submit" className="ep-btn ep-btn-primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
