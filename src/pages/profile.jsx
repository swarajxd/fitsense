import React, { useState } from "react";
import "./profile.css";
import Header from "../components/header";
import HomeCard from "../components/HomeCard";
import profilePic from "../assets/profilepic.jpg";
import EditProfile from "../components/EditProfile.jsx";
import post1 from "../assets/post1.jpg";
import post2 from "../assets/post2.jpg";
import post3 from "../assets/post3.jpg";
import post4 from "../assets/post4.jpg";
import post5 from "../assets/post5.jpg";

// Initial posts - some are already saved
const initialPosts = [
  { id: 1, image: post1, author: "taha_313", likes: 234, liked: false, isFollowing: false, caption: "Summer vibes and good times ☀️", isSaved: false },
  { id: 2, image: post2, author: "taha_313", likes: 156, liked: true, isFollowing: false, caption: "Casual Friday outfit inspiration", isSaved: false },
  { id: 3, image: post3, author: "taha_313", likes: 89, liked: false, isFollowing: false, caption: "Weekend adventures begin here", isSaved: false },
  { id: 4, image: post4, author: "taha_313", likes: 342, liked: true, isFollowing: false, caption: "Minimalist aesthetic goals", isSaved: false },
  { id: 5, image: post5, author: "taha_313", likes: 127, liked: false, isFollowing: false, caption: "New season, new style", isSaved: false },
];

// Additional saved posts from other users
const additionalSavedPosts = [
  { id: 6, image: post1, author: "style_maven", likes: 421, liked: false, isFollowing: true, caption: "Vintage finds and modern twists ✨", isSaved: true },
  { id: 7, image: post2, author: "fashion_forward", likes: 287, liked: true, isFollowing: false, caption: "Street style inspo from Tokyo", isSaved: true },
  { id: 8, image: post3, author: "urban_explorer", likes: 195, liked: false, isFollowing: true, caption: "City lights and night vibes 🌃", isSaved: true },
  { id: 9, image: post4, author: "minimal_life", likes: 156, liked: false, isFollowing: false, caption: "Less is more philosophy", isSaved: true },
  { id: 10, image: post5, author: "color_palette", likes: 298, liked: true, isFollowing: true, caption: "Playing with autumn colors 🍂", isSaved: true },
  { id: 11, image: post1, author: "retro_revival", likes: 173, liked: false, isFollowing: false, caption: "90s comeback is real", isSaved: true },
  { id: 12, image: post2, author: "sustainable_style", likes: 245, liked: true, isFollowing: true, caption: "Eco-friendly fashion choices 🌱", isSaved: true }
];

export default function Profile() {
  const [user, setUser] = useState({
    name: "Taha Sayed",
    username: "taha_313",
    bio: "Follow for more outfit inspiration",
    profilePic: profilePic,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [mode, setMode] = useState("posts");
  // Combine user posts with additional saved posts for a more realistic saved collection
  const [posts, setPosts] = useState([...initialPosts, ...additionalSavedPosts]);

  const handleSave = (updatedUser) => {
    setUser(updatedUser);
    setIsEditing(false);
  };

  const handleToggleFollow = (postData) => {
    console.log(`Following ${postData.author}`);
  };

  const handleToggleLike = (postData) => {
    console.log(`Liking post ${postData.id}`);
  };

  // ✅ Save / Unsave handler
  const handleSavePost = (postData) => {
    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postData.id ? { ...p, isSaved: !p.isSaved } : p
      )
    );
  };

  // Filter posts: user's own posts vs all saved posts
  const userPosts = posts.filter((post) => post.author === user.username);
  const savedPosts = posts.filter((post) => post.isSaved);

  return (
    <>
      <Header />

      <div className="fs-wrap">
        <div className="fs-container">
          {/* LEFT: Profile Card */}
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
                    <div className="fs-stat">
                      <b>{userPosts.length}</b>
                      <span>Posts</span>
                    </div>
                    <div className="fs-stat">
                      <b>64</b>
                      <span>Followers</span>
                    </div>
                    <div className="fs-stat">
                      <b>92</b>
                      <span>Following</span>
                    </div>
                  </div>

                  <div className="fs-actions">
                    <button className="fs-btn fs-btn-follow">Share</button>
                    <button
                      className="fs-btn fs-btn-ghost"
                      onClick={() => setIsEditing(true)}
                    >
                      Edit Profile
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* RIGHT: Posts / Saved */}
          <main className="fs-main" role="main">
            <div className="fs-topbar">
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
                    Saved ({savedPosts.length})
                  </button>
                </div>
              </div>
            </div>

            {/* POSTS */}
            {mode === "posts" ? (
              <div className="fs-gallery-wrap">
                <section className="fs-gallery" aria-label="Posts gallery">
                  {userPosts.map((postData) => (
                    <HomeCard
                      key={postData.id}
                      post={postData}
                      mode="profile"
                      onToggleFollow={() => handleToggleFollow(postData)}
                      onToggleLike={() => handleToggleLike(postData)}
                      onSave={() => handleSavePost(postData)}
                    />
                  ))}
                </section>
              </div>
            ) : (
              // SAVED POSTS
              <div className="fs-gallery-wrap">
                <section className="fs-gallery" aria-label="Saved posts">
                  {savedPosts.length > 0 ? (
                    savedPosts.map((postData) => (
                      <HomeCard
                        key={postData.id}
                        post={postData}
                        mode="profile"
                        onToggleFollow={() => handleToggleFollow(postData)}
                        onToggleLike={() => handleToggleLike(postData)}
                        onSave={() => handleSavePost(postData)}
                      />
                    ))
                  ) : (
                    <p>No saved posts yet</p>
                  )}
                </section>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* EditProfile modal */}
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
