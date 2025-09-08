import React, { useState, useMemo, useRef, useEffect } from "react";
import Header from "../components/header";
import HomeCard from "../components/HomeCard";
import "./Home.css";
import { Link } from "react-router-dom";

const makePosts = (count = 20) =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    image: `/img${(i % 12) + 1}.jpg`,
    author: `user${i + 1}`,
    avatar: `/pfp${(i % 6) + 1}.jpg`,
    isFollowing: i % 3 === 0,
    liked: false,
  }));

export default function Home() {
  const [posts, setPosts] = useState(() => makePosts(24));
  const [mode, setMode] = useState("forYou"); // <- default back to "forYou"
  const masonryRef = useRef(null);

  const visiblePosts = useMemo(() => {
    if (mode === "following") return posts.filter((p) => p.isFollowing);
    return posts;
  }, [mode, posts]);

  function toggleFollow(id) {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isFollowing: !p.isFollowing } : p))
    );
  }

  function toggleLike(id) {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, liked: !p.liked } : p)));
  }

  async function handleShare(post) {
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Post by ${post.author}`, url });
      } catch (err) {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert("Post link copied to clipboard!");
      } catch {
        alert("Couldn't copy link. URL: " + url);
      }
    }
  }

  // Masonry: compute grid-row-end span for variable image heights.
  useEffect(() => {
    const container = masonryRef.current;
    if (!container) return;

    const resizeItem = (item) => {
      const img = item.querySelector("img");
      if (!img) return;
      // grid-auto-rows value
      const style = window.getComputedStyle(container);
      const rowHeightPx = parseInt(style.getPropertyValue("grid-auto-rows")) || 10;
      // gap could be '16px'
      const gapPx = parseInt(style.getPropertyValue("gap")) || parseInt(style.getPropertyValue("grid-row-gap")) || 16;
      const imgHeight = img.getBoundingClientRect().height;
      const rowSpan = Math.max(1, Math.ceil((imgHeight + gapPx) / (rowHeightPx + gapPx)));
      item.style.gridRowEnd = `span ${rowSpan}`;
    };

    const resizeAll = () => {
      const items = Array.from(container.querySelectorAll(".masonry-item"));
      items.forEach((it) => resizeItem(it));
    };

    // handle images loaded
    const imgs = Array.from(container.querySelectorAll("img"));
    imgs.forEach((img) => {
      if (img.complete) {
        // already loaded
        const item = img.closest(".masonry-item");
        if (item) resizeItem(item);
      } else {
        img.addEventListener("load", () => {
          const item = img.closest(".masonry-item");
          if (item) resizeItem(item);
        });
      }
    });

    // on window resize, recalc
    window.addEventListener("resize", resizeAll);
    // small timeout to allow DOM to paint then calculate
    const t = setTimeout(resizeAll, 50);

    return () => {
      window.removeEventListener("resize", resizeAll);
      clearTimeout(t);
    };
  }, [visiblePosts]); // recalc whenever visible posts change

  return (
    <>
      <Header />

      <div className="home-top-row">
        <div className="home-toggle">
          <button
            className={`mode-btn ${mode === "following" ? "active" : ""}`}
            onClick={() => setMode("following")}
          >
            Following
          </button>

          <button
            className={`mode-btn ${mode === "forYou" ? "active" : ""}`}
            onClick={() => setMode("forYou")}
          >
            For you
          </button>
        </div>
      </div>

      <main className="home-container">
        <div className="masonry" ref={masonryRef}>
          {visiblePosts.length === 0 ? (
            <div className="empty-msg">No posts to show. Try switching to "For you".</div>
          ) : (
            visiblePosts.map((post) => (
              <div className="masonry-item" key={post.id}>
                <HomeCard
                  post={post}
                  mode={mode}
                  onToggleFollow={() => toggleFollow(post.id)}
                  onToggleLike={() => toggleLike(post.id)}
                  onShare={() => handleShare(post)}
                />
              </div>
            ))
          )}
        </div>

        <Link to="/create" className="upload-button" title="Create">+</Link>
      </main>
    </>
  );
}
