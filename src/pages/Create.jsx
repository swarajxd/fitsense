import React, { useRef, useState } from 'react';
import './Create.css';
import Header from "../components/header";
import { FiUpload, FiPlus } from 'react-icons/fi';

export default function Create() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const fileRef = useRef(null);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function handleDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function handleAddTag() {
    const t = tagInput.trim();
    if (!t) return;
    if (!tags.includes(t)) setTags(prev => [...prev, t]);
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

  function removeTag(index) {
    setTags(prev => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Replace with actual upload logic / API call
    const payload = { caption: caption.trim(), tags, fileName: file?.name ?? null };
    console.log('Submitting post', payload);
    alert('Post submitted (check console). Replace handleSubmit with real upload logic.');
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
                    onClick={() => { setPreview(null); setFile(null); }}
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
                  placeholder="Add a tag and press Enter"
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
                  onClick={() => { setCaption(''); setTags([]); setPreview(null); setFile(null); }}
                >
                  Clear
                </button>

                <button type="submit" className="btn primary">
                  Post
                </button>
              </div>
            </div>
          </aside>
        </form>
      </main>
    </div>
  );
}

