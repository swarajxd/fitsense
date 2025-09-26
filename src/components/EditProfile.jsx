// src/components/EditProfile.jsx
import React, { useEffect, useState } from "react";
import { useUser, useAuth } from "@clerk/clerk-react";

/**
 * EditProfile
 * - uploads avatar to your backend endpoint (/api/uploads/avatar)
 * - saves profile to backend (/api/profile) and includes userId
 *
 * Expects parent to pass currentData and callbacks:
 *  - currentData: { name, bio, profilePic, username, public_id, user_id? }
 *  - onSave(updatedProfile)
 *  - onCancel()
 */
export default function EditProfile({ currentData = {}, onSave, onCancel }) {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [form, setForm] = useState({
    name: "",
    bio: "",
    profilePic: "",
    username: ""
  });
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: currentData.name || "",
      bio: currentData.bio || "",
      profilePic: currentData.profilePic || "",
      username: currentData.username || ""
    });
    setPreview(currentData.profilePic || "");
  }, [currentData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  // Upload to your server which uploads to Cloudinary and returns { url, public_id, ... }
  const uploadFileToServer = async (file) => {
    const fd = new FormData();
    fd.append("file", file);

    const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:7000";
    const res = await fetch(`${base}/api/uploads/avatar`, {
      method: "POST",
      body: fd
    });

    let body;
    try {
      body = await res.json();
    } catch (err) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Upload failed: ${txt || "server returned non-json"}`);
    }

    if (!res.ok) {
      const msg = body?.error || body?.details || JSON.stringify(body);
      throw new Error(msg || `HTTP ${res.status}`);
    }

    if (!body.url) {
      throw new Error(`Upload succeeded but no url returned: ${JSON.stringify(body)}`);
    }
    return body;
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    try {
      setUploading(true);
      const uploadResp = await uploadFileToServer(file);
      const cloudUrl = uploadResp.url;
      setForm((p) => ({
        ...p,
        profilePic: cloudUrl,
        // keep public_id if returned
        public_id: uploadResp.public_id || p.public_id
      }));
      setPreview(cloudUrl);
      console.log("Uploaded to Cloudinary:", cloudUrl);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed: " + (err.message || err));
    } finally {
      setUploading(false);
      try { URL.revokeObjectURL(objectUrl); } catch {}
    }
  };

  // Save profile to your server (includes userId)
  const saveProfileToServer = async (payload) => {
    const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:7000";

    let token = null;
    try {
      token = await getToken();
    } catch (e) {
      // token optional: server uses service role; keeping token is good if server verifies
      console.warn("No token available", e);
    }

    const body = {
      userId: user?.id, // IMPORTANT: Clerk user id included
      name: payload.name,
      username: payload.username,
      bio: payload.bio,
      profilePic: payload.profilePic,
      public_id: payload.public_id ?? null
    };

    const res = await fetch(`${base}/api/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });

    const text = await res.text().catch(() => "");
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (e) { json = { text }; }

    if (!res.ok) {
      const errMsg = json?.error || json?.message || text || `HTTP ${res.status}`;
      throw new Error(errMsg);
    }
    return json;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("You must be signed in to save your profile.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...currentData,
        name: form.name,
        bio: form.bio,
        profilePic: form.profilePic,
        username: form.username || currentData.username || user?.username || user?.id,
        public_id: currentData.public_id ?? null
      };

      // persist to server
      const saved = await saveProfileToServer(payload);

      // If server returned saved profile row, prefer that
      const returnedProfile = saved?.profile ?? saved ?? payload;

      // notify parent
      if (typeof onSave === "function") {
        onSave({
          name: returnedProfile.name ?? payload.name,
          bio: returnedProfile.bio ?? payload.bio,
          profilePic: returnedProfile.avatar_url ?? returnedProfile.profilePic ?? payload.profilePic,
          username: returnedProfile.username ?? payload.username,
          public_id: returnedProfile.public_id ?? payload.public_id,
          user_id: returnedProfile.user_id ?? user?.id
        });
      }
    } catch (err) {
      console.error("Save failed:", err);
      alert("Save failed: " + (err.message || err));
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
            <div style={styles.label}>Username</div>
            <input name="username" value={form.username} onChange={handleChange} style={styles.input} />
          </label>

          <label style={styles.field}>
            <div style={styles.label}>Bio</div>
            <textarea name="bio" value={form.bio} onChange={handleChange} style={{ ...styles.input, minHeight: 80 }} />
          </label>

          <label style={styles.field}>
            <div style={styles.label}>Profile photo</div>
            <input type="file" accept="image/*" onChange={handleFile} />
            <div style={{ marginTop: 8 }}>
              {uploading ? (
                <div>Uploading…</div>
              ) : preview ? (
                <img src={preview} alt="preview" style={styles.previewImg} />
              ) : (
                <div style={styles.placeholder}>No photo</div>
              )}
            </div>
          </label>

          <div style={styles.actions}>
            <button type="button" onClick={() => onCancel && onCancel()} style={styles.ghostBtn} disabled={saving || uploading}>Cancel</button>
            <button type="submit" style={styles.primaryBtn} disabled={saving || uploading}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
