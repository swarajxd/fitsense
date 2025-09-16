// src/pages/profile.jsx
import React, { useEffect, useState } from "react";
import "./profile.css";
import Header from "../components/header";
import HomeCard from "../components/HomeCard";
import profilePicFallback from "../assets/profilepic.jpg";
import EditProfile from "../components/EditProfile.jsx";
import { supabase } from "../lib/supabaseClient";
import { useUser, useAuth } from "@clerk/clerk-react";

// Local fallbacks (kept for UI if DB unreachable)
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

function prettyId(id) {
  if (!id) return "unknown";
  return id.replace(/^user_/, "").slice(0, 10);
}

export default function Profile() {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [profile, setProfile] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const [mode, setMode] = useState("posts");
  const [posts, setPosts] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);

  // Fetch profile on mount (only after Clerk user is available)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setIsLoadingUser(true);
      try {
        const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:7000";
        const resp = await fetch(`${base}/api/profile?userId=${encodeURIComponent(user.id)}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" }
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data && Object.keys(data).length && !cancelled) {
            // Build a friendly username fallback:
            const fallbackUsername =
              data.username ||
              user?.username ||
              (user?.fullName ? user.fullName.replace(/\s+/g, "_").toLowerCase() : null) ||
              prettyId(user.id);

            setProfile({
              name: data.name || user?.fullName || "Taha Sayed",
              username: fallbackUsername,
              bio: data.bio || "Follow for more outfit inspiration",
              profilePic: data.avatar_url || data.profilePic || profilePicFallback,
              public_id: data.public_id || data.publicId || null,
              user_id: data.user_id || user.id
            });
            setIsLoadingUser(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Could not fetch saved profile, using defaults.", err);
      }

      if (!cancelled) {
        setProfile({
          name: user?.fullName || "Taha Sayed",
          username: user?.username || prettyId(user?.id),
          bio: "Follow for more outfit inspiration",
          profilePic: profilePicFallback,
          user_id: user?.id
        });
        setIsLoadingUser(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  // Fetch posts uploaded by current user from Supabase (client-side)
  useEffect(() => {
    if (!user) {
      setIsLoadingPosts(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setIsLoadingPosts(true);
      try {
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching posts:", error);
          if (!cancelled) setPosts(initialPosts);
        } else {
          const mapped = (data || []).map((row) => {
            // Prefer profile.username if we already loaded profile; otherwise use sensible fallbacks
            const author =
              (profile && row.user_id === profile.user_id && profile.username) ||
              row.username ||
              user?.username ||
              prettyId(row.user_id);

            return {
              id: row.id,
              image: row.image_url || row.image_path || post1,
              author,
              likes: row.likes ?? 0,
              liked: row.liked ?? false,
              isFollowing: false,
              caption: row.caption ?? "",
              isSaved: row.is_saved ?? false,
              tags: Array.isArray(row.tags) ? row.tags : (row.tags ? JSON.parse(row.tags) : []),
              raw: row
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
    // intentionally only depend on user; we'll patch authors when profile becomes available
  }, [user]);

  // Patch posts' author field once profile becomes available (handles race conditions)
  useEffect(() => {
    if (!profile || !posts || posts.length === 0) return;

    setPosts(prev =>
      prev.map(p => {
        if (p.raw && p.raw.user_id && p.raw.user_id === profile.user_id) {
          return { ...p, author: profile.username || p.author };
        }
        return p;
      })
    );
  }, [profile]); // run when profile becomes available/changes

  // handle save from EditProfile (persists to server and updates UI)
  const handleSave = async (updatedUser) => {
    if (!updatedUser) {
      setIsEditing(false);
      return;
    }

    // Optimistic local update
    setProfile(prev => (({
      ...prev,
      name: updatedUser.name ?? prev.name,
      username: updatedUser.username ?? prev.username,
      bio: updatedUser.bio ?? prev.bio,
      profilePic: updatedUser.profilePic ?? prev.profilePic,
      public_id: updatedUser.public_id ?? prev.public_id
    })));
    setIsEditing(false);

    // Persist to your API
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:7000";
      const token = await (async () => {
        try { return await getToken(); } catch (e) { return null; }
      })();

      const resp = await fetch(`${base}/api/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          userId: user?.id,
          name: updatedUser.name,
          username: updatedUser.username,
          bio: updatedUser.bio,
          profilePic: updatedUser.profilePic,
          public_id: updatedUser.public_id
        })
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        console.error("Failed to save profile on server:", errJson);
      } else {
        const saved = await resp.json().catch(() => null);
        if (saved && saved.profile) {
          // merge server-returned row into profile (use avatar_url if present)
          setProfile(prev => ({
            ...prev,
            name: saved.profile.name ?? prev.name,
            username: saved.profile.username ?? prev.username,
            bio: saved.profile.bio ?? prev.bio,
            profilePic: saved.profile.avatar_url ?? prev.profilePic,
            public_id: saved.profile.public_id ?? prev.public_id,
            user_id: saved.profile.user_id ?? prev.user_id
          }));
        }
      }
    } catch (err) {
      console.error("Error saving profile to server:", err);
    }
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

  const displayUsername = profile.username || (user?.username ?? prettyId(user?.id));
  const userPosts = posts.filter((post) => {
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
                  <div className="fs-handle">@{displayUsername}</div>
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
