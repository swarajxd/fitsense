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

        if (mode === 'forYou' && user?.id) {
          url.searchParams.set('userId', user.id);
        }
        if (mode === 'following' && user?.id) {
          url.searchParams.set('userId', user.id);
        }

        const resp = await fetch(url.toString());
        const json = await resp.json();
        if (!resp.ok) {
          console.error('Failed to fetch feed', json);
          return;
        }
        if (cancelled) return;

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


  // masonry recalculation unchanged...
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
  }, [posts]);


  function toggleLike(postOrId, newLiked, newCount) {
    const postId = typeof postOrId === 'object' ? postOrId.id : postOrId;

    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const prevLikes = (typeof p.likes === 'number') ? p.likes : (p.raw?.likes ?? p.likeCount ?? 0);
      const likes = (typeof newCount === 'number')
        ? newCount
        : (newLiked ? (prevLikes + 1) : Math.max(0, prevLikes - 1));

      return {
        ...p,
        liked: !!newLiked,
        likes
      };
    }));
  }

  function toggleSave(postOrId, newSaved, newCount) {
    const postId = typeof postOrId === 'object' ? postOrId.id : postOrId;

    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const prevSaves = (typeof p.saves === 'number') ? p.saves : (p.raw?.saves ?? p.saves ?? 0);
      const saves = (typeof newCount === 'number') ? newCount : (newSaved ? prevSaves + 1 : Math.max(0, prevSaves - 1));
      return { ...p, saved: !!newSaved, saves };
    }));
  }

  // UPDATED: accepts either a userId string OR a post object (robust)
  async function toggleFollow(postOrUserId) {
    // resolve a followeeId whether input is a post object or a string id
    const resolveId = (x) => {
      if (!x) return null;
      if (typeof x === 'string') return x;
      if (typeof x === 'number') return String(x);
      // try common fields if an object was passed
      const candidates = [
        x?.user_id,
        x?.userId,
        x?.author_id,
        x?.authorId,
        x?.user?.id,
        x?.author?.id,
        x?.raw?.user_id,
        x?.raw?.userId,
        x?.owner_id,
        x?.ownerId,
      ];
      for (const c of candidates) if (c) return String(c);
      return null;
    };

    const followeeId = resolveId(postOrUserId);
    if (!followeeId) {
      console.error('toggleFollow: could not resolve followeeId from', postOrUserId);
      return;
    }

    const currentlyFollowing = posts.find(p => String(p.user_id) === String(followeeId) || String(p.userId) === String(followeeId))?.isFollowing || false;

    // Optimistic update: flip every post that belongs to the followee
    setPosts(prev => prev.map(p => {
      if (String(p.user_id) === String(followeeId) || String(p.userId) === String(followeeId) || String(p.raw?.user_id) === String(followeeId)) {
        return { ...p, isFollowing: !currentlyFollowing };
      }
      return p;
    }));

    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:7000';

      if (currentlyFollowing) {
        // unfollow (DELETE with query)
        const url = `${base}/api/interactions/follow?followerId=${encodeURIComponent(user?.id)}&followeeId=${encodeURIComponent(followeeId)}`;
        const res = await fetch(url, { method: 'DELETE' });
        if (!res.ok) {
          // fallback attempt
          const fallback = await fetch(`${base}/api/interactions/unfollow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ followerId: user?.id, followeeId })
          });
          if (!fallback.ok) throw new Error(`Unfollow failed: ${fallback.status}`);
        }
      } else {
        // follow
        const res = await fetch(`${base}/api/interactions/follow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ followerId: user?.id, followeeId })
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Follow failed: ${res.status} ${txt}`);
        }
      }

      // If we are in 'following' tab, refresh feed so list accurately reflects the backend (and pagination)
      if (mode === 'following') {
        setRefreshKey(k => k + 1);
        setOffset(0);
      }
    } catch (err) {
      console.error('toggleFollow error', err);
      // revert optimistic change if network failed
      setPosts(prev => prev.map(p => {
        if (String(p.user_id) === String(followeeId) || String(p.userId) === String(followeeId) || String(p.raw?.user_id) === String(followeeId)) {
          return { ...p, isFollowing: currentlyFollowing }; // revert
        }
        return p;
      }));
      // as a last resort, force refresh
      // window.location.reload();
    }
  }

  async function loadMore() {
    setOffset(prev => prev + LIMIT);
  }

  return (
    <>
      <Header />
      <div className="home-cont">
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
                    key={post.id}
                    post={{
                      id: post.id,
                      image: post.image_url || post.image_path || post.image || post.imageUrl,
                      author: post.author || post.username || post.profiles?.username || post.user_name || post.user_id,
                      avatar: post.avatar || post.profiles?.avatar_url || post.authorAvatar || post.profilePic || null,
                      likes: post.likes ?? 0,
                      liked: post.liked ?? false,
                      caption: post.caption ?? "",
                      isSaved: post.isSaved ?? post.saved ?? false,
                      isFollowing: post.isFollowing ?? post.is_following ?? post.following ?? false, // ensure presence
                      raw: post, // keep raw row for owner id lookups
                    }}
                    mode={mode}
                    authorId={ post.user_id || post.userId || post.raw?.user_id || post.authorId || post.profiles?.user_id || post.profiles?.id || post.author }
                    onToggleFollow={toggleFollow}
                    onToggleLike={toggleLike}
                    onToggleSave={toggleSave}
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
      </div>
    </>
  );
}
