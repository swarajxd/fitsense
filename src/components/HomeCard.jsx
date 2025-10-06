// src/components/HomeCard.jsx
import React, { useState, useRef, useEffect } from "react";
import "./HomeCard.css";
import {
  FaHeart,
  FaRegHeart,
  FaShareAlt,
  FaEllipsisV,
  FaRegBookmark,
  FaBookmark,
} from "react-icons/fa";
import profilePicFallback from "../assets/profilepic.jpg"; // adjust path if needed

import { useUser } from "@clerk/clerk-react";

export default function HomeCard({
  post,
  mode = "forYou",
    authorAvatar = null,         // <-- explicit prop (only used in profile mode)

  onToggleFollow = () => {},
  onToggleLike = () => {},
  onShare = () => {},
  onToggleSave = () => {},   // <-- accept this prop (was missing)
  onEdit = () => {},         // <-- new: edit handler
  onDelete = () => {},       // <-- new: delete handler
}) {
  const { user } = useUser();
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saved, setSaved] = useState(post.isSaved || false);
  const [isFollowing, setIsFollowing] = useState(Boolean(post.isFollowing));
  const [liked, setLiked] = useState(Boolean(post.liked));
  const menuRef = useRef(null);

  useEffect(() => {
    setIsFollowing(Boolean(post.isFollowing));
  }, [post.isFollowing, post.user_id]);

  useEffect(() => {
    setLiked(Boolean(post.liked));
  }, [post.liked, post.id]);

  useEffect(() => {
    setSaved(Boolean(post.saved || post.isSaved));
  }, [post.saved, post.isSaved, post.id]);

  const followLabel = mode === "following" ? "Unfollow" : "Follow";
  const rawLikes = post.likes ?? post.likeCount ?? 0;
  const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:7000";

  function formatCount(n) {
    if (n >= 1_000_000)
      return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
    return `${n}`;
  }

  async function postJson(path, body) {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let json;
    try {
      json = await res.json();
    } catch (e) {
      json = null;
    }
    if (!res.ok) {
      const msg = json?.error || json || `HTTP ${res.status}`;
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    return json;
  }

  useEffect(() => {
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  function resolveFolloweeId(p) {
    const candidates = [
      p?.user_id,
      p?.userId,
      p?.author_id,
      p?.authorId,
      p?.user?.id,
      p?.author?.id,
      p?.raw?.user_id,
      p?.raw?.userId,
      p?.owner_id,
      p?.ownerId,
    ];
    for (const c of candidates) {
      if (c) return c;
    }
    return null;
  }

  const handleFollow = async (e) => {
    e?.stopPropagation?.();
    if (!user) {
      alert("Please sign in to follow users.");
      return;
    }

    const followerId = user.id;
    const followeeId = resolveFolloweeId(post);

    if (!followerId || !followeeId) {
      console.error("Missing IDs for follow operation", { followerId, followeeId, post });
      alert("Could not determine the user to follow. Check console for `post` object.");
      return;
    }

    const action = isFollowing ? "/api/interactions/unfollow" : "/api/interactions/follow";
    setIsFollowing((s) => !s);
    try {
      await postJson(action, { followerId, followeeId });
      try { onToggleFollow(post, !isFollowing); } catch (e) {}
    } catch (err) {
      console.error("Follow error", err);
      setIsFollowing((s) => !s);
      alert("Could not update follow status: " + err.message);
    }
  };

  const handleLike = async (e) => {
    e?.stopPropagation?.();
    if (!user) {
      alert("Please sign in to like posts.");
      return;
    }

    const endpoint = liked ? "/api/interactions/unlike" : "/api/interactions/like";
    setLiked((s) => !s);

    try {
      const res = await postJson(endpoint, { userId: user.id, postId: post.id });
      const newCount = (res && typeof res.likes_count === "number") ? res.likes_count : null;
      const newLiked = (res && typeof res.liked === "boolean") ? res.liked : !liked;
      try { onToggleLike(post, newLiked, newCount); } catch (e) {}
    } catch (err) {
      console.error("Like error", err);
      setLiked((s) => !s);
      alert("Could not update like: " + (err?.message || err));
    }
  };

  const handleSave = async (e) => {
    e?.stopPropagation?.();
    if (!user) {
      alert("Please sign in to save posts.");
      return;
    }

    const endpoint = saved ? "/api/interactions/unsave" : "/api/interactions/save";
    setSaved((s) => !s);

    try {
      const res = await postJson(endpoint, { userId: user.id, postId: post.id });
      const newSaved = (res && typeof res.saved === "boolean") ? res.saved : !saved;
      const newCount = (res && typeof res.saves_count === "number") ? res.saves_count : null;
      try { onToggleSave(post, newSaved, newCount); } catch (e) {}
      setSaved(Boolean(newSaved));
    } catch (err) {
      console.error("Save error", err);
      setSaved((s) => !s);
      alert("Could not update saved state: " + (err?.message || err));
    }
  };

  // New local wrappers for edit/delete to stop propagation and call props
  const handleEditClick = (e) => {
    e?.stopPropagation?.();
    if (typeof onEdit === "function") onEdit(post);
  };

  const handleDeleteClick = (e) => {
    e?.stopPropagation?.();
    if (typeof onDelete === "function") onDelete(post);
  };

  return (
    <article
      className={`homecard ${mode === "profile" ? "profile-mode" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Post by ${post.author ?? post.user_id}`}
    >
      <div className="img-wrap">
        <img
          src={post.image || post.image_url || post.imagePath}
          alt={`post-${post.id}`}
          className="homecard-img"
        />

        <div className={`menu-wrap ${hovered || menuOpen ? "visible" : ""}`} ref={menuRef}>
          <button
            className="menu-btn"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label="More options"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((s) => !s); }}
          >
            <FaEllipsisV />
          </button>

          {menuOpen && (
            <div className="menu-dropdown" role="menu" aria-label="Post options">
              <button
                type="button"
                className="menu-item"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onShare(post); }}
                role="menuitem"
              >
                <FaShareAlt className="menu-item-icon" /> <span>Share</span>
              </button>

              <button
                type="button"
                className={`menu-item ${saved ? "saved" : ""}`}
                onClick={(e) => { handleSave(e); setMenuOpen(false); }}
                role="menuitem"
              >
                {saved ? (
                  <>
                    <FaBookmark className="menu-item-icon" /> <span>Saved</span>
                  </>
                ) : (
                  <>
                    <FaRegBookmark className="menu-item-icon" /> <span>Save</span>
                  </>
                )}
              </button>

              {/* If in profile mode expose Edit/Delete in the dropdown too (useful for mobile) */}
              {mode === "profile" && (
                <>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={(e) => { handleEditClick(e); setMenuOpen(false); }}
                    role="menuitem"
                  >
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    className="menu-item destructive"
                    onClick={(e) => { handleDeleteClick(e); setMenuOpen(false); }}
                    role="menuitem"
                  >
                    <span>Delete</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {hovered && (
  <div className="top-left-info">
    <div className="top-left-pfp-container">
      {/* compute avatarSrc: only prefer resolved profile avatar in profile mode */}
      <img
        src={
          mode === "profile"
            ? (authorAvatar || post.authorAvatar || post.avatar || post.profilePic || profilePicFallback)
            : (post.avatar || post.profilePic || profilePicFallback)
        }
        alt={post.author ? `${post.author} avatar` : "avatar"}
        className="top-left-pfp"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = profilePicFallback;
        }}
        loading="lazy"
      />
    </div>
    <div className="top-left-username">{post.author ?? post.user_id}</div>
  </div>
)}


        <div className={`homecard-overlay ${hovered ? "visible" : ""}`}>
          <div className="overlay-actions">
            {/* Replace follow with Edit/Delete in profile mode */}
            {mode === "profile" ? (
              <div className="profile-actions">
                <button className="btn-edit" onClick={handleEditClick} aria-label="Edit post">Edit</button>
                <button className="btn-delete" onClick={handleDeleteClick} aria-label="Delete post">Delete</button>
              </div>
            ) : (
              <button
                className={`btn-follow ${mode === "following" && isFollowing ? "following" : ""}`}
                onClick={(e) => { e?.stopPropagation?.(); handleFollow(e); }}
                aria-pressed={isFollowing}
              >
                {isFollowing ? "Unfollow" : followLabel}
              </button>
            )}

            <div className="right-actions">
              <div className="likes-count" aria-hidden>
                {formatCount(rawLikes)}
              </div>

              <button
                className="btn-like"
                onClick={(e) => { e?.stopPropagation?.(); handleLike(e); }}
                aria-pressed={liked}
                aria-label={liked ? "Unlike" : "Like"}
                title={liked ? "Unlike" : "Like"}
              >
                {liked ? <FaHeart /> : <FaRegHeart />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
