// src/components/HomeCard.jsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom"; // add useNavigate

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
  authorAvatar = null, // <-- explicit prop (only used in profile mode)
  authorId = null, // <-- new prop
  isOwnProfile = false,
  onToggleFollow = () => {},
  onToggleLike = () => {},
  onShare = () => {},
  onToggleSave = () => {}, // <-- accept this prop (was missing)
  onEdit = () => {}, // <-- new: edit handler
  onDelete = () => {}, // <-- new: delete handler
  canEdit,   // <-- optional explicit control
  canDelete, // <-- optional explicit control
}) {
  const navigate = useNavigate();
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

  // compute whether to show edit/delete (explicit props take precedence)
  const showEdit = (typeof canEdit !== "undefined") ? Boolean(canEdit) : Boolean(isOwnProfile);
  const showDelete = (typeof canDelete !== "undefined") ? Boolean(canDelete) : Boolean(isOwnProfile);

  // force-hide edit/delete when viewing saved tab
  const isSavedMode = mode === "saved" || mode === "savedPosts" || mode === "saved_tab";
  const finalShowEdit = isSavedMode ? false : showEdit;
  const finalShowDelete = isSavedMode ? false : showDelete;

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

    const followeeId = resolveFolloweeId(post);

    if (!followeeId) {
      console.error("Missing followee id for follow operation", { post });
      alert("Could not determine the user to follow. Check console for `post` object.");
      return;
    }

    // Optimistic local toggle — parent will perform network and update global state
    setIsFollowing((s) => !s);

    try {
      // delegate to parent. Parent accepts either post object or id (we pass the post so parent can resolve multiple fields)
      if (typeof onToggleFollow === "function") {
        await onToggleFollow(post);
      }
    } catch (err) {
      console.error("Follow/unfollow (delegated) error", err);
      // revert local optimistic toggle on error
      setIsFollowing((s) => !s);
      alert("Could not update follow status: " + (err?.message || err));
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

  // share wrapper (calls provided onShare)
  const handleShareClick = (e) => {
    e?.stopPropagation?.();
    if (typeof onShare === "function") onShare(post);
  };

  // small helper to fallback pretty id for top-left username display
  function prettyId(id) {
    if (!id) return "user";
    if (typeof id === "string" && id.length <= 10) return id;
    return String(id).slice(0, 8) + '...';
  }

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

              {/* If in profile mode expose Edit/Delete in the dropdown only if allowed */}
              {mode === "profile" && (finalShowEdit || finalShowDelete) && (
                <>
                  {finalShowEdit && (
                    <button
                      type="button"
                      className="menu-item"
                      onClick={(e) => { handleEditClick(e); setMenuOpen(false); }}
                      role="menuitem"
                    >
                      <span>Edit</span>
                    </button>
                  )}

                  {finalShowDelete && (
                    <button
                      type="button"
                      className="menu-item destructive"
                      onClick={(e) => { handleDeleteClick(e); setMenuOpen(false); }}
                      role="menuitem"
                    >
                      <span>Delete</span>
                    </button>
                  )}
                </>
              )}

            </div>
          )}
        </div>

        {hovered && (
          <div
            className="top-left-info"
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              const id = authorId || post?.raw?.user_id || post?.user_id || post?.author || post?.authorId || post?.username;
              if (!id) return;
              navigate(`/profile/${encodeURIComponent(id)}`);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                const id = authorId || post?.raw?.user_id || post?.user_id || post?.author || post?.authorId || post?.username;
                if (!id) return;
                navigate(`/profile/${encodeURIComponent(id)}`);
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <div className="top-left-pfp-container">
              <img
                src={authorAvatar || post.avatar || post.authorAvatar || post.profilePic || "/path/to/fallback.jpg"}
                alt={post.author ? `${post.author} avatar` : "avatar"}
                className="top-left-pfp"
                loading="lazy"
                onError={(e)=>{ e.currentTarget.onerror = null; e.currentTarget.src = "/path/to/fallback.jpg"; }}
              />
            </div>
            <div className="top-left-username">{post.author ?? post.username ?? prettyId(authorId)}</div>
          </div>
        )}


        <div className={`homecard-overlay ${hovered ? "visible" : ""}`}>
          <div className="overlay-actions">
            {/* Show Edit/Delete only if allowed; otherwise show Follow */}
            {finalShowEdit || finalShowDelete ? (
              <div className="profile-actions">
                {finalShowEdit && <button className="btn-edit" onClick={handleEditClick} aria-label="Edit post">Edit</button>}
                {finalShowDelete && <button className="btn-delete" onClick={handleDeleteClick} aria-label="Delete post">Delete</button>}
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
