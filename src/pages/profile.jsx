// src/pages/profile.jsx
import React, { useEffect, useState } from "react";
import "./profile.css";
import Header from "../components/header";
import HomeCard from "../components/HomeCard";
import profilePic from "../assets/profilepic.jpg";
import EditProfile from "../components/EditProfile.jsx";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "@clerk/clerk-react";

// Keep these as local fallback if Supabase is unreachable
import post1 from "../assets/post1.jpg";
import post2 from "../assets/post2.jpg";
import post3 from "../assets/post3.jpg";
import post4 from "../assets/post4.jpg";
import post5 from "../assets/post5.jpg";

const initialPosts = [
  { id: 1, image: post1, author: "taha_313", likes: 234, liked: false, isFollowing: false, caption: "Summer vibes and good times ☀️", isSaved: false },
  { id: 2, image: post2, author: "taha_313", likes: 156, liked: true, isFollowing: false, caption: "Casual Friday outfit inspiration", isSaved: false },
  { id: 3, image: post3, author: "taha_313", likes: 89, liked: false, isFollowing: false, caption: "Weekend adventures begin here", isSaved: false },
  { id: 4, image: post4, author: "taha_313", likes: 342, liked: true, isFollowing: false, caption: "Minimalist aesthetic goals", isSaved: false },
  { id: 5, image: post5, author: "taha_313", likes: 127, liked: false, isFollowing: false, caption: "New season, new style", isSaved: false },
];

export default function Profile() {
  const { user } = useUser();
  const [profile, setProfile] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [mode, setMode] = useState("posts");
  const [posts, setPosts] = useState([]); // will be populated from Supabase
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);

  // Load minimal profile info (existing approach: server endpoint fallback)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("http://localhost:7000/api/profile");
        if (res.ok) {
          const data = await res.json();
          if (data && Object.keys(data).length) {
            setProfile({
              name: data.name || "Taha Sayed",
              username: data.username || "taha_313",
              bio: data.bio || "Follow for more outfit inspiration",
              profilePic: data.avatar_url || data.profilePic || profilePic,
              public_id: data.public_id || data.publicId || null
            });
            setIsLoadingUser(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Could not fetch saved profile, using defaults.", err);
      } finally {
        setProfile({
          name: "Taha Sayed",
          username: "taha_313",
          bio: "Follow for more outfit inspiration",
          profilePic: profilePic
        });
        setIsLoadingUser(false);
      }
    })();
  }, []);

  // Fetch posts uploaded by current user from Supabase
  useEffect(() => {
    if (!user) {
      // User not available yet: keep loading until Clerk provides user
      setIsLoadingPosts(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setIsLoadingPosts(true);
      try {
        // Query posts by user_id (your posts table schema)
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching posts:", error);
          // fallback to initialPosts so UI is not empty
          if (!cancelled) setPosts(initialPosts);
        } else {
          // Map DB rows to the format your HomeCard expects
          const mapped = (data || []).map((row) => {
            return {
              id: row.id,
              image: row.image_url || row.image_path || post1, // fallback image
              author: profile?.username || (user?.username ?? user?.id?.split('_')[0]) || "you",
              likes: row.likes ?? 0,
              liked: row.liked ?? false,
              isFollowing: false,
              caption: row.caption ?? "",
              isSaved: row.is_saved ?? false,
              tags: Array.isArray(row.tags) ? row.tags : (row.tags ? JSON.parse(row.tags) : []),
              raw: row // keep raw DB row for any further actions
            };
          });

          if (!cancelled) setPosts(mapped.length ? mapped : initialPosts);
        }
      } catch (err) {
        console.error("Exception fetching posts:", err);
        if (!cancelled) setPosts(initialPosts);
      } finally {
        if (!cancelled) setIsLoadingPosts(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, profile]); // re-run if user or profile changes

  const handleSave = (updatedUser) => {
    if (!updatedUser) {
      setIsEditing(false);
      return;
    }

    setProfile(prev => ({
      ...prev,
      name: updatedUser.name ?? prev.name,
      username: updatedUser.username ?? prev.username,
      bio: updatedUser.bio ?? prev.bio,
      profilePic: updatedUser.profilePic ?? prev.profilePic,
      public_id: updatedUser.public_id ?? prev.public_id
    }));

    setIsEditing(false);
  };

  const handleToggleFollow = (postData) => {
    console.log(`Following ${postData.author}`);
  };

  const handleToggleLike = (postData) => {
    console.log(`Liking post ${postData.id}`);
  };

  const handleSavePost = (postData) => {
    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postData.id ? { ...p, isSaved: !p.isSaved } : p
      )
    );
  };

  if (isLoadingUser || !profile) {
    return (
      <>
        <Header />
        <div style={{ padding: 24 }}>Loading profile…</div>
      </>
    );
  }

  const userPosts = posts.filter((post) => {
    // some posts are from fallback initialPosts which use author by username; prefer DB rows by comparing user.id if available
    if (post.raw && post.raw.user_id) return post.raw.user_id === user.id;
    return post.author === profile.username;
  });
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
                style={{ backgroundImage: `url(${profile.profilePic})` }}
              >
                <div className="fs-overlay">
                  <h1 className="fs-name">{profile.name}</h1>
                  <div className="fs-handle">@{profile.username}</div>
                  <div className="fs-bio">{profile.bio}</div>

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
      {isLoadingPosts ? (
        <div style={{ padding: 24 }}>Loading posts…</div>
      ) : userPosts.length > 0 ? (
        userPosts.map((postData) => (
          <div key={postData.id} className="fs-gallery-item">
            <HomeCard
              post={postData}
              mode="profile"
              onToggleFollow={() => handleToggleFollow(postData)}
              onToggleLike={() => handleToggleLike(postData)}
              onSave={() => handleSavePost(postData)}
            />
          </div>
        ))
      ) : (
        <div style={{ padding: 24 }}>No posts yet — try uploading one!</div>
      )}
    </section>
  </div>
) : (
  // SAVED POSTS
  <div className="fs-gallery-wrap">
    <section className="fs-gallery" aria-label="Saved posts">
      {savedPosts.length > 0 ? (
        savedPosts.map((postData) => (
          <div key={postData.id} className="fs-gallery-item">
            <HomeCard
              post={postData}
              mode="profile"
              onToggleFollow={() => handleToggleFollow(postData)}
              onToggleLike={() => handleToggleLike(postData)}
              onSave={() => handleSavePost(postData)}
            />
          </div>
        ))
      ) : (
        <p style={{ padding: 24 }}>No saved posts yet</p>
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
          currentData={profile}
          onCancel={() => setIsEditing(false)}
          onSave={handleSave}
        />
      )}
    </>
  );
}
