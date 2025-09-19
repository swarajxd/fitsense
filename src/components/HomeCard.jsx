// src/components/HomeCard.jsx
import React, { useState, useRef, useEffect } from "react";
import "./HomeCard.css";
import { FaHeart, FaRegHeart, FaShareAlt, FaEllipsisV, FaRegBookmark, FaBookmark } from "react-icons/fa";
import { useUser } from "@clerk/clerk-react";

export default function HomeCard({
  post,
  mode = "forYou",
  onToggleFollow = () => {},
  onToggleLike = () => {},
  onShare = () => {},
}) {
  const { user } = useUser();
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saved, setSaved] = useState(post.isSaved || false);
  const [isFollowing, setIsFollowing] = useState(Boolean(post.isFollowing));
  const [liked, setLiked] = useState(Boolean(post.liked));
  const menuRef = useRef(null);

  // Keep local isFollowing in sync with parent prop
  useEffect(() => {
    setIsFollowing(Boolean(post.isFollowing));
    // optional debug:
    // console.log('[HomeCard] sync prop->local', { user_id: post?.user_id, prop: post?.isFollowing });
  }, [post.isFollowing, post.user_id]);
    // Keep local liked in sync with parent prop
  useEffect(() => {
    setLiked(Boolean(post.liked));
    // optional debug:
    // console.log('[HomeCard] sync liked prop->local', { postId: post?.id, liked: post?.liked });
  }, [post.liked, post.id]);


  const followLabel = mode === "following" ? "Unfollow" : "Follow";
  const rawLikes = post.likes ?? post.likeCount ?? 0;
  const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:7000";

  function formatCount(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
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
    try { json = await res.json(); } catch (e) { json = null; }
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

  // Robustly resolve the followee id from common property names
  function resolveFolloweeId(p) {
    // try the most common/sane names first
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
    // optimistic update
    setIsFollowing((s) => !s);
    try {
      await postJson(action, { followerId, followeeId });
      // Inform parent. We keep calling the original signature (post, newState)
      // Parent can decide to ignore arguments or handle them as needed.
      try { onToggleFollow(post, !isFollowing); } catch (e) { /* swallow */ }
    } catch (err) {
      console.error("Follow error", err);
      setIsFollowing((s) => !s); // revert
      alert("Could not update follow status: " + err.message);
    }
  };

// inside HomeCard.jsx - replace existing handleLike
const handleLike = async (e) => {
  e?.stopPropagation?.();
  if (!user) { alert("Please sign in to like posts."); return; }

  const endpoint = liked ? "/api/interactions/unlike" : "/api/interactions/like";

  // optimistic local flip of the heart
  setLiked((s) => !s);

  try {
    // read server response (should include likes_count and liked)
    const res = await postJson(endpoint, { userId: user.id, postId: post.id });

    // server response shape assumed: { ok: true, liked: boolean, likes_count: number }
    const newCount = (res && typeof res.likes_count === 'number') ? res.likes_count : null;
    const newLiked  = (res && typeof res.liked === 'boolean') ? res.liked : !liked;

    // inform parent with authoritative info (parent will update posts state)
    try { onToggleLike(post, newLiked, newCount); } catch (e) { /* ignore */ }
  } catch (err) {
    console.error("Like error", err);
    // rollback optimistic flip
    setLiked((s) => !s);
    alert("Could not update like: " + (err?.message || err));
  }
};


  const handleSave = async (e) => {
    e?.stopPropagation?.();
    if (!user) { alert("Please sign in to save posts."); return; }
    const endpoint = saved ? "/api/interactions/unsave" : "/api/interactions/save";
    setSaved((s) => !s);
    try {
      await postJson(endpoint, { userId: user.id, postId: post.id });
    } catch (err) {
      console.error("Save error", err);
      setSaved((s) => !s);
      alert("Could not update saved state: " + err.message);
    }
  };

  return (
    <article
      className="homecard"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Post by ${post.author ?? post.user_id}`}
    >
      <div className="img-wrap">
        <img src={post.image || post.image_url || post.imagePath} alt={`post-${post.id}`} className="homecard-img" />

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
                onClick={() => { setMenuOpen(false); onShare(post); }}
                role="menuitem"
              >
                <FaShareAlt className="menu-item-icon" /> <span>Share</span>
              </button>

              <button
                type="button"
                className={`menu-item ${saved ? "saved" : ""}`}
                onClick={() => { setSaved((s) => !s); setMenuOpen(false); }}
                role="menuitem"
              >
                {saved ? <><FaBookmark className="menu-item-icon" /><span>Saved</span></> :
                         <><FaRegBookmark className="menu-item-icon" /><span>Save</span></>}
              </button>
            </div>
          )}
        </div>

        {hovered && (
          <div className="top-left-info">
            <div className="top-left-pfp-container">
              <img src={post.avatar || post.profilePic || "/pfp.jpg"} alt="pfp" className="top-left-pfp" />
            </div>
            <div className="top-left-username">{post.author ?? post.user_id}</div>
          </div>
        )}

        <div className={`homecard-overlay ${hovered ? "visible" : ""}`}>
          <div className="overlay-actions">
            <button
              className={`btn-follow ${mode === "following" && isFollowing ? "following" : ""}`}
              onClick={handleFollow}
              aria-pressed={isFollowing}
            >
              {isFollowing ? "Unfollow" : followLabel}
            </button>

            <div className="right-actions">
              <div className="likes-count" aria-hidden>
                {formatCount(rawLikes)}
              </div>

              <button
                className="btn-like"
                onClick={handleLike}
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
