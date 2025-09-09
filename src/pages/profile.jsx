import React, { useState, useRef, useEffect } from "react";
import "./profile.css";
import Header from '../components/header'; // Adjust path as needed
import profilePic from "../assets/profilepic.jpg";
import EditProfile from "../components/EditProfile.jsx"; // ✅ import modal
import post1 from "../assets/post1.jpg";
import post2 from "../assets/post2.jpg";
import post3 from "../assets/post3.jpg";
import post4 from "../assets/post4.jpg";
import post5 from "../assets/post5.jpg";
import SavedPosts from "../components/SavedPosts"; // new import

// sample posts array with additional metadata
// replace your postImages array with this (still uses the same imports)
const postImages = [
  { src: post1, caption: "Look 1", creator: "taha_313", creatorUsername: "taha_313" },
  { src: post2, caption: "Look 2", creator: "alexd", creatorUsername: "alexd" },
  { src: post3, caption: "Look 3", creator: "harryb", creatorUsername: "harryb" },
  { src: post4, caption: "Look 4", creator: "jane_doe", creatorUsername: "janed" },
  { src: post5, caption: "Look 5", creator: "mario", creatorUsername: "mario" },
];


// demo images (replace with your own)
const demoImgs = [
  "https://images.unsplash.com/photo-1548685913-fe6678babe83?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1520974433023-c731af78f21f?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1521337706268-0f13c744c3c1?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=1000&auto=format&fit=crop",
];

export default function profile2() {
  // ✅ user state for edit profile
  const [user, setUser] = useState({
    name: "Taha Sayed",
    username: "taha_313",
    bio: "Follow for more outfit inspiration",
    profilePic: profilePic,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [mode, setMode] = useState("posts"); // "posts" or "saved"

  // create 18 demo items
  const galleryItems = Array.from({ length: 18 }).map((_, i) => ({
    id: i + 1,
    img: demoImgs[i % demoImgs.length],
  }));

  const handleSave = (updatedUser) => {
    setUser(updatedUser);
    setIsEditing(false);
  };

  const handleFollow = (username) => {
    console.log(`Following ${username}`);
  };

  const handleShare = (postId) => {
    console.log(`Sharing post ${postId}`);
  };

  const handleEdit = (postId) => {
    console.log(`Editing post ${postId}`);
  };

  const masonryRef = useRef(null);
  const postsCount = 20; // number of tiles to show (repeat the 5 sample images)
const visiblePosts = Array.from({ length: postsCount }).map((_, i) => {
  return postImages[i % postImages.length];
});

useEffect(() => {
  const container = masonryRef.current;
  if (!container) return;

  const resizeItem = (item) => {
    const img = item.querySelector("img");
    if (!img) return;
    // grid-auto-rows value
    const style = window.getComputedStyle(container);
    const rowHeightPx = parseInt(style.getPropertyValue("grid-auto-rows")) || 8;
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
  const t = setTimeout(resizeAll, 60);

  return () => {
    window.removeEventListener("resize", resizeAll);
    clearTimeout(t);
  };
}, [visiblePosts]); 
  return (
    <>
      <Header />

      <div className="fs-wrap">
        <div className="fs-container">
          {/* LEFT: Sticky Profile Card */}
          <aside className="fs-profile-column">
            <div className="fs-profile-card">
              <div
                className="fs-hero"
                style={{ backgroundImage: `url(${user.profilePic})` }}
                
              >
                <div className="fs-overlay">
                  <h1 className="fs-name">{user.name}</h1>
                  <div className="fs-handle">@{user.username}</div>
                  <div className="fs-bio">{user.bio}</div>

                  <div className="fs-stats">
                    <div className="fs-stat"><b>234</b><span>Posts</span></div>
                    <div className="fs-stat"><b>64</b><span>Followers</span></div>
                    <div className="fs-stat"><b>92</b><span>Following</span></div>
                  </div>

                  <div className="fs-actions">
                    <button className="fs-btn fs-btn-follow">Share</button>
                    <button
                      className="fs-btn fs-btn-ghost"
                      onClick={() => setIsEditing(true)} // ✅ open modal
                    >
                      Edit Profile
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </aside>

          {/* RIGHT: Scrollable Posts Column (only this column scrolls) */}
          <main className="fs-main" role="main">
            <div className="fs-topbar">
            {/* your existing topbar content (brand/search etc.) */}

            {/* Tabs: Profile | Saved */}
            <div className="profile-top-row">
              <div className="profile-toggle">
                <button
                  className={`profile-mode-btn ${mode === "posts" ? "active" : ""}`}
                  onClick={() => setMode("posts")}
                >
                  Posts
                </button>

                <button
                  className={`profile-mode-btn ${mode === "saved" ? "active" : ""}`}
                  onClick={() => setMode("saved")}
                >
                  Saved
                </button>
              </div>
            </div>
          </div>
          {mode === "posts" ? (
            // scrollable gallery area
            <div className="fs-gallery-wrap">
              <section className="fs-gallery" aria-label="Posts gallery" ref={masonryRef}>
                {Array.from({ length: 20 }).map((_, index) => {
                  const postData = postImages[index % postImages.length]; // repeat images
                  return (
                    <div key={index} className="fs-gallery-item masonry-item">
                      <img
                        src={postData.src}
                        alt={`Post ${index + 1}`}
                        loading="lazy"
                      />
                      {/* Post Hover Overlay */}
                      <div className="fs-post-overlay">
                        <div className="fs-post-overlay-content">
                          <div className="fs-post-header">
                            <div className="fs-post-creator">
                              <div className="fs-post-creator-avatar">
                                <img src={user.profilePic} alt={postData.creator} />
                              </div>
                              <div className="fs-post-creator-info">
                                <div className="fs-post-creator-name">{postData.creator}</div>
                                <div className="fs-post-creator-username">@{postData.creatorUsername}</div>
                              </div>
                              <div className="fs-post-verified">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                                </svg>
                              </div>
                            </div>
                          </div>
                          <div className="fs-post-caption">
                            {postData.caption}
                          </div>
                          <div className="fs-post-actions">
                            <button 
                              className="fs-post-btn fs-post-btn-follow"
                              onClick={() => handleFollow(postData.creatorUsername)}
                            >
                              Follow +
                            </button>
                            <button 
                              className="fs-post-btn fs-post-btn-ghost"
                              onClick={() => handleShare(index + 1)}
                            >
                              Share
                            </button>
                            <button 
                              className="fs-post-btn fs-post-btn-ghost"
                              onClick={() => handleEdit(index + 1)}
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>
            </div>
          ) : (
             <SavedPosts
              postImages={postImages.map(p => (typeof p === "string" ? p : p.src || p))}
              masonryRef={masonryRef}
            />

          )}
          </main>
        </div>
      </div>


      {/* ✅ EditProfile modal */}
      {isEditing && (
        <EditProfile
          currentData={user}
          onCancel={() => setIsEditing(false)}
          onSave={handleSave}
        />
      )}

    </>
  );
}