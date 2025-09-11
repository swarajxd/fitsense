import React, { useRef, useState, useEffect } from 'react';
import './Create.css';
import Header from "../components/header";
import { FiUpload, FiPlus } from 'react-icons/fi';
import { supabase } from '../lib/supabaseClient';
import { useUser, useAuth } from '@clerk/clerk-react';

export default function Create() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);

  const fileRef = useRef(null);
  const { user } = useUser(); // Clerk user
  const { getToken } = useAuth(); // for attaching token when calling server (optional/recommended)

  // cleanup object URL to avoid memory leaks
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // ---------------- HELPERS ----------------
  async function uploadFileToSupabase(fileToUpload, userId) {
    if (!fileToUpload) return { path: null, publicURL: null };

    // optional quick client-side validation
    // if (fileToUpload.size > 5 * 1024 * 1024) throw new Error('File too large (max 5MB)');

    const timestamp = Date.now();
    const cleanName = fileToUpload.name.replace(/\s+/g, '_');
    const filePath = `uploads/${userId}/${timestamp}_${cleanName}`;

    const { data, error } = await supabase.storage
      .from('posts')
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
        contentType: fileToUpload.type,
      });

    if (error) {
      console.error('Supabase upload error', error);
      throw error;
    }

    // For public buckets:
    const { data: publicData } = supabase.storage.from('posts').getPublicUrl(filePath);
    return { path: filePath, publicURL: publicData?.publicUrl ?? null };
  }

  async function uploadToServer(fileToUpload, userId, captionVal, tagsArr) {
    if (!fileToUpload) throw new Error('No file provided');

    const fd = new FormData();
    fd.append('file', fileToUpload);
    fd.append('userId', userId);
    fd.append('caption', captionVal || '');
    fd.append('tags', JSON.stringify(tagsArr || []));

    // optional: attach Clerk token for server verification
    let token = null;
    try {
      token = await getToken();
    } catch (err) {
      console.warn('getToken error (continuing without token):', err);
    }

    const base = (import.meta.env.VITE_API_BASE_URL) ?? 'http://localhost:4000';
    const resp = await fetch(`${base}/api/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    });

    const json = await resp.json();
    if (!resp.ok) {
      throw new Error(json.error || 'Server upload failed');
    }
    return { path: json.path, publicURL: json.url ?? json.publicUrl ?? null };
  }

  // ---------------- TAG HELPERS ----------------
  function cleanToken(tok) {
    const cleaned = tok.replace(/^[#\s]+|[^\w-]+$/g, '').trim();
    return cleaned.replace(/[^\w-]+/g, '').toLowerCase();
  }

  function parseTagsFromString(raw) {
    if (!raw || !raw.trim()) return [];
    const s = raw.trim();
    if (s.indexOf('#') !== -1) {
      const found = [];
      const re = /#([^\s#]+)/g;
      let m;
      while ((m = re.exec(s)) !== null) {
        if (m[1]) {
          const cleaned = cleanToken(m[1]);
          if (cleaned) found.push(cleaned);
        }
      }
      return found;
    }
    const parts = s.split(/\s+/);
    return parts.map(p => cleanToken(p)).filter(Boolean);
  }

  function addTagsFromString(raw) {
    const parsed = parseTagsFromString(raw);
    if (!parsed.length) return;
    setTags(prev => {
      const existing = new Set(prev.map(t => t.toLowerCase()));
      const merged = [...prev];
      for (const p of parsed) {
        if (!existing.has(p)) {
          merged.push(p);
          existing.add(p);
        }
      }
      return merged;
    });
  }

  function handleAddTag() {
    addTagsFromString(tagInput);
    setTagInput('');
  }

  function handleTagKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === 'Backspace' && tagInput === '') {
      setTags(prev => prev.slice(0, -1));
    }
  }

  function handleTagBlur() {
    if (tagInput.trim()) {
      addTagsFromString(tagInput);
      setTagInput('');
    }
  }

  function removeTag(index) {
    setTags(prev => prev.filter((_, i) => i !== index));
  }

  // ---------------- FILE HANDLERS ----------------
  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function handleDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  // ---------------- SUBMIT ----------------
  // You said your buckets are public -> use client upload then store metadata on server.
  // Set this to true if you want server to accept the file and upload it itself.
  const useServerUpload = false;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user) {
      alert('You must be signed in to post.');
      return;
    }
    if (!file) {
      alert('Please choose a file first.');
      return;
    }

    setLoading(true);
    try {
      let image_path = null;
      let image_url = null;

      if (file) {
        if (useServerUpload) {
          const res = await uploadToServer(file, user.id, caption, tags);
          image_path = res.path;
          image_url = res.publicURL;
        } else {
          const res = await uploadFileToSupabase(file, user.id);
          image_path = res.path;
          image_url = res.publicURL;
        }
      }

      // If server already inserted metadata (upload endpoint did), skip this step.
      if (!useServerUpload) {
        // call your server to create posts row (server should verify Clerk token in prod)
        const base = (import.meta.env.VITE_API_BASE_URL) ?? 'http://localhost:7000';

        const body = {
          userId: user.id,
          caption: caption.trim() || null,
          tags: tags.length ? tags : null,
          image_path,
          image_url
        };
        // optional: attach Clerk token
        let token = null;
        try { token = await getToken(); } catch (e) { /* ignore */ }

        const resp = await fetch(`${base}/api/posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(body)
        });

        const json = await resp.json();
        if (!resp.ok) {
          throw new Error(json.error || 'Failed to save post metadata');
        }
        // json.post contains inserted row
      }

      alert('Post uploaded successfully.');
      setCaption('');
      setTags([]);
      if (preview) { URL.revokeObjectURL(preview); }
      setPreview(null);
      setFile(null);
    } catch (err) {
      console.error(err);
      alert('Upload failed: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="create-page">
      <Header />

      <main className="create-main">
        <form className="create-grid" onSubmit={handleSubmit}>
          <section
            className="upload-column"
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            aria-label="Upload area"
          >
            {!preview ? (
              <div className="upload-card">
                <div className="upload-box">
                  <FiUpload className="upload-icon" aria-hidden />
                  <p className="muted">Drop an image here or</p>

                  <div className="upload-actions">
                    <button
                      type="button"
                      className="btn ghost orange"
                      onClick={() => fileRef.current?.click()}
                    >
                      <FiPlus className="icon-small" aria-hidden /> Upload photo
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="visually-hidden"
                    />
                  </div>
                </div>

                <p className="hint">Supported: JPG, PNG — ideal ratio 4:5</p>
              </div>
            ) : (
              <div className="preview-card">
                <div className="preview-wrapper">
                  <img src={preview} alt="preview" className="preview-img" />
                </div>

                <div className="preview-actions">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => { if (preview) URL.revokeObjectURL(preview); setPreview(null); setFile(null); }}
                  >
                    Remove
                  </button>

                  <button
                    type="button"
                    className="btn ghost orange"
                    onClick={() => fileRef.current?.click()}
                  >
                    Replace
                  </button>
                </div>
              </div>
            )}
          </section>

          <aside className="meta-column">
            <div className="card">
              <label className="field-label">Caption</label>
              <textarea
                className="input textarea"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Write a concise caption..."
                rows={4}
              />
            </div>

            <div className="card">
              <label className="field-label">Tags</label>

              <div className="tags-row">
                {tags.map((t, i) => (
                  <button
                    key={t + i}
                    type="button"
                    className="tag"
                    onClick={() => removeTag(i)}
                    aria-label={`Remove tag ${t}`}
                  >
                    #{t} <span className="x">×</span>
                  </button>
                ))}
              </div>

              <div className="tag-input-row">
                <input
                  className="input"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKey}
                  onBlur={handleTagBlur}
                  placeholder="Add a tag and press Enter — you can paste many tags (#a #b or #a#b or a b c)"
                />
                <button type="button" className="btn ghost orange" onClick={handleAddTag}>Add</button>
              </div>
            </div>

            <div className="card actions-card">
              <div className="preview-info">Preview: <span className="file-name">{file?.name ?? 'no file'}</span></div>

              <div className="actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => { setCaption(''); setTags([]); if (preview) URL.revokeObjectURL(preview); setPreview(null); setFile(null); }}
                >
                  Clear
                </button>

                <button type="submit" className="btn primary" disabled={loading}>
                  {loading ? 'Uploading...' : 'Post'}
                </button>
              </div>
            </div>
          </aside>
        </form>
      </main>
    </div>
  );
}
