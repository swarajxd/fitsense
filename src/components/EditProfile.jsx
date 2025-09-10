// EditProfile.jsx (drop-in replacement)
import React, { useEffect, useState } from "react";

export default function EditProfile({ currentData = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: "",
    bio: "",
    profilePic: ""
  });
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: currentData.name || "",
      bio: currentData.bio || "",
      profilePic: currentData.profilePic || ""
    });
    setPreview(currentData.profilePic || "");
  }, [currentData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Upload file to backend (Cloudinary) and return { url, public_id } or throw
  // EditProfile.jsx — replace uploadFileToServer with this
const uploadFileToServer = async (file) => {
  const fd = new FormData();
  fd.append("file", file);

  // use full backend URL if you didn't add a proxy:
  const res = await fetch("http://localhost:7000/api/uploads/avatar", {
    method: "POST",
    body: fd
  });

  // parse body safely
  let body;
  try {
    body = await res.json();
  } catch (err) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Upload failed: ${txt || "server returned non-json"}`);
  }

  console.log("Upload response:", body);

  // Accept two possible shapes:
  // 1) { ok: true, url, public_id } OR 2) { url, public_id, width, ... }
  if (!res.ok) {
    const msg = body?.error || body?.details || JSON.stringify(body);
    throw new Error(msg || `HTTP ${res.status}`);
  }

  if (!body.url) {
    throw new Error(`Upload succeeded but no url returned: ${JSON.stringify(body)}`);
  }

  // return the body to the caller
  return body;
};


  // Save profile payload to server (profile.json route). Adjust if you use other endpoint.
  const saveProfileToServer = async (payload) => {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Profile save failed: ${txt || res.status}`);
    }
    const json = await res.json().catch(() => ({}));
    return json;
  };

  // EditProfile.jsx — replace handleFile with this
const handleFile = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // show quick local preview
  const objectUrl = URL.createObjectURL(file);
  setPreview(objectUrl);

  try {
    setUploading(true);
    const uploadResp = await uploadFileToServer(file);
    // uploadResp.url exists per your server response
    const cloudUrl = uploadResp.url;
    setForm(prev => ({ ...prev, profilePic: cloudUrl }));
    setPreview(cloudUrl);

    // optionally store public_id if you want to delete/replace later
    setForm(prev => ({ ...prev, public_id: uploadResp.public_id || prev.public_id }));
    console.log("Uploaded to Cloudinary:", cloudUrl);
  } catch (err) {
    console.error("Upload error:", err);
    alert("Upload failed: " + (err.message || err));
  } finally {
    setUploading(false);
    try { URL.revokeObjectURL(objectUrl); } catch {}
  }
};


  // Submit handler: ensure async flow finishes before calling onSave
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);

      // Build payload merging currentData with new form values (protects missing keys)
      const payload = {
        ...currentData,
        name: form.name,
        bio: form.bio,
        profilePic: form.profilePic
      };

      // Persist server-side (optional). If you don't have /api/profile, skip this or save to localStorage.
      try {
        await saveProfileToServer({
          name: payload.name,
          bio: payload.bio,
          avatar_url: payload.profilePic,
          public_id: currentData.public_id || null // optional
        });
      } catch (err) {
        // If server save fails but you still want to update UI locally, you can choose to continue.
        // For now we rethrow to stop and show error.
        throw err;
      }

      // Notify parent with the full payload (parent merges and closes modal)
      if (typeof onSave === "function") {
        onSave({
          name: payload.name,
          bio: payload.bio,
          profilePic: payload.profilePic,
          // keep username if present
          username: payload.username ?? currentData.username
        });
      }
    } catch (err) {
      console.error("Save failed:", err);
      alert("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.backdrop}>
      <div style={styles.modal}>
        <h3>Edit profile</h3>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.field}>
            <div style={styles.label}>Name</div>
            <input name="name" value={form.name} onChange={handleChange} style={styles.input} />
          </label>

          <label style={styles.field}>
            <div style={styles.label}>Bio</div>
            <textarea name="bio" value={form.bio} onChange={handleChange} style={{ ...styles.input, minHeight: 80 }} />
          </label>

          <label style={styles.field}>
            <div style={styles.label}>Profile photo</div>
            <input type="file" accept="image/*" onChange={handleFile} />
            <div style={{ marginTop: 8 }}>
              {uploading ? <div>Uploading…</div> : preview ? <img src={preview} alt="preview" style={styles.previewImg} /> : <div style={styles.placeholder}>No photo</div>}
            </div>
          </label>

          <div style={styles.actions}>
            <button type="button" onClick={() => { if (onCancel) onCancel(); }} style={styles.ghostBtn} disabled={saving || uploading}>Cancel</button>
            <button type="submit" style={styles.primaryBtn} disabled={saving || uploading}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// inline styles — copy your preferred styles if you already have them
const styles = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 50 },
  modal: { background: "#fff", color: "#000", padding: 20, borderRadius: 8, width: 520, maxWidth: "95%" },
  form: { display: "grid", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, color: "#333" },
  input: { padding: 10, borderRadius: 6, border: "1px solid #ddd" },
  previewImg: { width: 120, height: 120, borderRadius: "999px", objectFit: "cover" },
  placeholder: { width: 120, height: 120, display: "flex", alignItems: "center", justifyContent: "center", background: "#f2f2f2", color: "#777", borderRadius: 6 },
  actions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 },
  primaryBtn: { background: "#ff6a00", color: "#fff", padding: "8px 14px", borderRadius: 8, border: "none" },
  ghostBtn: { background: "transparent", border: "1px solid #ccc", padding: "8px 12px", borderRadius: 8 }
};
