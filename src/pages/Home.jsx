// src/pages/Home.jsx
import React, { useState, useMemo, useRef, useEffect } from "react";
import Header from "../components/header";
import HomeCard from "../components/HomeCard";
import "./Home.css";
import { Link } from "react-router-dom";
import Discover from "./Discover";
import { motion } from "framer-motion";
import { useUser } from '@clerk/clerk-react';

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [mode, setMode] = useState("forYou");
  const masonryRef = useRef(null);
  const { user } = useUser();
const [refreshKey, setRefreshKey] = useState(0);

  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 24;
  
  const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:7000';
  // Load feed whenever mode, user (for following), or offset changes
  useEffect(() => {
    let cancelled = false;
    async function fetchFeed() {
      setLoading(true);
      try {
       const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:7000';
          const endpoint = mode === 'forYou' ? '/api/posts/feed' : '/api/posts/following';
          const url = new URL(base + endpoint);

          url.searchParams.set('limit', LIMIT);
          url.searchParams.set('offset', offset || 0);

          // ✅ Add userId for both modes
          if (mode === 'forYou' && user?.id) {
            url.searchParams.set('userId', user.id); // exclude own posts
          }
          if (mode === 'following' && user?.id) {
            url.searchParams.set('userId', user.id); // fetch followees
}
 
        const resp = await fetch(url.toString());
        const json = await resp.json();
        if (!resp.ok) {
          console.error('Failed to fetch feed', json);
          return;
        }
        if (cancelled) return;
        // If offset is 0, replace; otherwise append (simple "load more")
        setPosts(prev => (offset ? [...prev, ...(json.posts || [])] : (json.posts || [])));
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchFeed();
    return () => { cancelled = true; };
  }, [mode, user?.id, offset, refreshKey]);


  // Masonry layout recalculation (reuse your logic)
  useEffect(() => {
    const container = masonryRef.current;
    if (!container) return;

    const resizeItem = (item) => {
      const img = item.querySelector("img");
      if (!img) return;
      const style = window.getComputedStyle(container);
      const rowHeightPx = parseInt(style.getPropertyValue("grid-auto-rows")) || 10;
      const gapPx = parseInt(style.getPropertyValue("gap")) || parseInt(style.getPropertyValue("grid-row-gap")) || 16;
      const imgHeight = img.getBoundingClientRect().height;
      const rowSpan = Math.max(1, Math.ceil((imgHeight + gapPx) / (rowHeightPx + gapPx)));
      item.style.gridRowEnd = `span ${rowSpan}`;
    };

    const resizeAll = () => {
      const items = Array.from(container.querySelectorAll(".masonry-item"));
      items.forEach((it) => resizeItem(it));
    };

    const imgs = Array.from(container.querySelectorAll("img"));
    imgs.forEach((img) => {
      if (img.complete) {
        const item = img.closest(".masonry-item");
        if (item) resizeItem(item);
      } else {
        img.addEventListener("load", () => {
          const item = img.closest(".masonry-item");
          if (item) resizeItem(item);
        });
      }
    });

    window.addEventListener("resize", resizeAll);
    const t = setTimeout(resizeAll, 50);

    return () => {
      window.removeEventListener("resize", resizeAll);
      clearTimeout(t);
    };
  }, [posts]); // recalc whenever posts change

  function toggleLike(id) {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, liked: !p.liked } : p));
  }

// Replace your existing toggleFollow(...) with this function
async function toggleFollow(userId) {
  // userId = post.user_id (author's id)
  try {
    const currentlyFollowing = posts.find(p => p.user_id === userId)?.isFollowing || false;

    // optimistic UI flip
    setPosts(prev => prev.map(p => p.user_id === userId ? { ...p, isFollowing: !p.isFollowing } : p));

    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:7000';

    if (currentlyFollowing) {
      // Try DELETE with query params (more robust than DELETE with JSON body)
      const url = `${base}/api/interactions/follow?followerId=${encodeURIComponent(user?.id)}&followeeId=${encodeURIComponent(userId)}`;
      const res = await fetch(url, { method: 'DELETE' });

      if (!res.ok) {
        // fallback: try sending POST to an /unfollow endpoint if your server exposes it
        console.warn('DELETE unfollow returned non-ok, trying fallback POST /api/interactions/unfollow');
        const fallback = await fetch(`${base}/api/interactions/unfollow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ followerId: user?.id, followeeId: userId })
        });
        if (!fallback.ok) throw new Error(`Fallback unfollow failed: ${fallback.status}`);
      } else {
        console.log('[UNFOLLOW] success (DELETE query)', { followerId: user?.id, followeeId: userId });
      }
    } else {
      // Follow (POST body is reliable)
      const res = await fetch(`${base}/api/interactions/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId: user?.id, followeeId: userId })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Follow failed: ${res.status} ${txt}`);
      }
      console.log('[FOLLOW] success', { followerId: user?.id, followeeId: userId });
    }

    // Force re-fetch when user is viewing the "Following" tab
if (mode === 'following') {
  // bump refresh key to force useEffect to run even if offset is already 0
  setRefreshKey(k => k + 1);
  // also reset offset so pagination stays consistent
  setOffset(0);
}

  } catch (err) {
    console.error('toggleFollow error', err);
    // revert optimistic change by reloading feed data; fallback:
    window.location.reload();
  }
}



  async function loadMore() {
    setOffset(prev => prev + LIMIT);
  }

  return (
    <>
      <Header />
      <div className="home-top-row">
        <div className="home-toggle">
          <button className={`mode-btn ${mode === "following" ? "active" : ""}`} onClick={() => { setMode('following'); setOffset(0); }}>
            Following
          </button>

          <button className={`mode-btn ${mode === "forYou" ? "active" : ""}`} onClick={() => { setMode('forYou'); setOffset(0); }}>
            For you
          </button>
        </div>
      </div>

      <main className="home-container">
        <div className="masonry" ref={masonryRef}>
          {posts.length === 0 && !loading ? (
            <div className="empty-msg">No posts to show.</div>
          ) : (
            posts.map((post, index) => (
              <motion.div
                key={post.id}
                className="masonry-item"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.02 }}
              >
                <HomeCard
                  post={{
                    id: post.id,
                    image: post.image_url || post.image_path,
                    author: post.author || post.user_id || 'user',
                    avatar: post.avatar || null,
                    isFollowing: post.isFollowing || false,
                    liked: post.liked || false,
                    caption: post.caption || '',
                    raw: post
                  }}
                  mode={mode}
                    onToggleFollow={() => toggleFollow(post.user_id)}
                    

                  onToggleLike={() => toggleLike(post.id)}
                />
              </motion.div>
            ))
          )}
        </div>

        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          {loading ? <button className="btn">Loading…</button> : <button className="btn" onClick={loadMore}>Load more</button>}
        </div>

        <Discover />
        <Link to="/create" className="upload-button" title="Create">+</Link>
      </main>
    </>
  );
}
