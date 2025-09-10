// HomeCard.jsx
import React, { useState, useRef, useEffect } from "react";
import "./HomeCard.css";
import { FaHeart, FaRegHeart, FaShareAlt, FaEllipsisV, FaRegBookmark, FaBookmark } from "react-icons/fa";

export default function HomeCard({
  post,
  mode = "forYou",
  onToggleFollow = () => {},
  onToggleLike = () => {},
  onShare = () => {},
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saved, setSaved] = useState(false); // new state for save toggle
  const menuRef = useRef(null);

  const followLabel = mode === "following" ? "Unfollow" : "Follow";
  const rawLikes = post.likes ?? post.likeCount ?? 0;

  function formatCount(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
    return `${n}`;
  }

  useEffect(() => {
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  return (
    <article
      className="homecard"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Post by ${post.author}`}
    >
      <div className="img-wrap">
        <img src={post.image} alt={`post-${post.id}`} className="homecard-img" />

        {/* 3-dots menu in top-right */}
        <div className={`menu-wrap ${hovered || menuOpen ? "visible" : ""}`} ref={menuRef}>
          <button
            className="menu-btn"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label="More options"
            onClick={() => setMenuOpen((s) => !s)}
          >
            <FaEllipsisV />
          </button>

          {menuOpen && (
            <div className="menu-dropdown" role="menu" aria-label="Post options">
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  onShare?.(post);
                }}
                role="menuitem"
              >
                <FaShareAlt className="menu-item-icon" />
                <span>Share</span>
              </button>

              <button
                type="button"
                className={`menu-item ${saved ? "saved" : ""}`}
                onClick={() => {
                  setSaved(!saved);
                  setMenuOpen(false);
                }}
                role="menuitem"
              >
                {saved ? (
                  <>
                    <FaBookmark className="menu-item-icon" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <FaRegBookmark className="menu-item-icon" />
                    <span>Save</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Top-left pfp + username (shows on hover) */}
        {hovered && (
          <div className="top-left-info">
            <div className="top-left-pfp-container">
              <img src="/pfp.jpg" alt="pfp" className="top-left-pfp" />
            </div>
            <div className="top-left-username">{post.author}</div>
          </div>
        )}

        <div className={`homecard-overlay ${hovered ? "visible" : ""}`}>
          <div className="overlay-actions">
            <button
              className={`btn-follow ${mode === "following" && post.isFollowing ? "following" : ""}`}
              onClick={onToggleFollow}
              aria-pressed={post.isFollowing}
            >
              {followLabel}
            </button>

            <div className="right-actions">
              <div className="likes-count" aria-hidden>
                {formatCount(rawLikes)}
              </div>

              <button
                className="btn-like"
                onClick={onToggleLike}
                aria-pressed={post.liked}
                aria-label={post.liked ? "Unlike" : "Like"}
                title={post.liked ? "Unlike" : "Like"}
              >
                {post.liked ? <FaHeart /> : <FaRegHeart />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer always uses /pfp.jpg */}
      <div className="homecard-footer">

      </div>
    </article>
  );
}
