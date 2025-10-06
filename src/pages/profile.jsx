// src/pages/profile.jsx
import React, { useEffect, useState } from "react";
import "./profile.css";
import Header from "../components/header";
import HomeCard from "../components/HomeCard";
import profilePicFallback from "../assets/profilepic.jpg";
import EditProfile from "../components/EditProfile.jsx";
import EditPostModal from "../components/EditPostModal";
import { supabase } from "../lib/supabaseClient";
import { useUser, useAuth } from "@clerk/clerk-react";
import { useParams } from "react-router-dom";

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
  const { profileId } = useParams(); // e.g. taha418 or user_32Jf50rnysWyuoHQK9whjQtXljX

  const [profile, setProfile] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const [mode, setMode] = useState("posts");
  const [savedPosts, setSavedPosts] = useState([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);

  const [posts, setPosts] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);

  // New states for edit/delete flow
  const [editingPost, setEditingPost] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [processingDelete, setProcessingDelete] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);

  //fetch followers/following counts
  useEffect(() => {
    if (!profile?.user_id) return;
    let cancelled = false;
    (async () => {
      setIsLoadingCounts(true);
      try {
        const { count: followers } = await supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("followee_id", profile.user_id);

        const { count: following } = await supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", profile.user_id);

        if (!cancelled) {
          setFollowersCount(followers ?? 0);
          setFollowingCount(following ?? 0);
        }
      } catch (err) {
        console.error("Error fetching counts:", err);
        if (!cancelled) {
          setFollowersCount(0);
          setFollowingCount(0);
        }
      } finally {
        if (!cancelled) setIsLoadingCounts(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.user_id]);

  // Combined profile fetch effect:
  // - If URL has :profileId -> fetch that profile via /api/profile/:profileId
  // - Otherwise fetch current logged-in user's profile via /api/profile?userId=
  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:7000";

    (async () => {
      setIsLoadingUser(true);

      try {
        if (profileId) {
          // Fetch profile by URL param (could be user_id or username)
          const resp = await fetch(`${base}/api/profile/${encodeURIComponent(profileId)}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });

          if (resp.ok) {
            const data = await resp.json();
            if (!cancelled && data && Object.keys(data).length) {
              setProfile({
                name: data.name || data.full_name || data.username || prettyId(data.user_id ?? profileId),
                username: data.username || prettyId(data.user_id ?? profileId),
                bio: data.bio || "",
                profilePic: data.avatar_url || profilePicFallback,
                public_id: data.public_id || data.publicId || null,
                user_id: data.user_id || profileId,
              });
              setIsLoadingUser(false);
              return;
            }
          }

          // fallback if lookup failed
          if (!cancelled) {
            setProfile({
              name: prettyId(profileId),
              username: prettyId(profileId),
              bio: "",
              profilePic: profilePicFallback,
              user_id: profileId,
            });
            setIsLoadingUser(false);
          }
          return;
        }

        // No profileId in URL -> fetch current logged-in user's profile
        if (!user) {
          setIsLoadingUser(false);
          return;
        }

        try {
          const resp = await fetch(`${base}/api/profile?userId=${encodeURIComponent(user.id)}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });

          if (resp.ok) {
            const data = await resp.json();
            if (data && Object.keys(data).length && !cancelled) {
              const fallbackUsername =
                data.username ||
                user?.username ||
                (user?.fullName ? user.fullName.replace(/\s+/g, "_").toLowerCase() : null) ||
                prettyId(user.id);

              setProfile({
                name: data.name || user?.fullName || "Taha Sayed",
                username: fallbackUsername,
                bio: data.bio || "Follow for more outfit inspiration",
                profilePic: data.avatar_url,
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

        // final fallback: use clerk user object
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
      } catch (err) {
        console.error("Profile fetch error:", err);
        if (!cancelled) setIsLoadingUser(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, profileId]);

  // If profilePic updates, patch authorAvatar in posts/savedPosts
  useEffect(() => {
    if (!profile || !profile.profilePic) return;

    const resolvedPic = profile.profilePic;

    setPosts(prev =>
      (prev || []).map(p => {
        const ownerId = p?.raw?.user_id || p?.raw?.userId || p?.user_id || p?.userId || null;
        if (ownerId && profile.user_id && ownerId === profile.user_id) {
          return { ...p, authorAvatar: resolvedPic };
        }
        return p;
      })
    );

    setSavedPosts(prev =>
      (prev || []).map(p => {
        const ownerId = p?.raw?.user_id || p?.raw?.userId || p?.user_id || p?.userId || null;
        if (ownerId && profile.user_id && ownerId === profile.user_id) {
          return { ...p, authorAvatar: resolvedPic };
        }
        return p;
      })
    );
  }, [profile?.profilePic, profile?.user_id]);

  // Fetch posts for the profile being viewed using your backend API
  useEffect(() => {
    // wait until profile is resolved (so we have profile.user_id)
    if (!profile?.user_id) {
      setIsLoadingPosts(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setIsLoadingPosts(true);
      try {
        const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:7000";
        // optional: pass viewerId (current user) so backend can mark liked:true/false
        const viewerParam = user?.id ? `&viewerId=${encodeURIComponent(user.id)}` : "";
        const resp = await fetch(`${base}/api/posts?userId=${encodeURIComponent(profile.user_id)}${viewerParam}`);
        if (!resp.ok) {
          console.error("Failed to fetch posts for profile:", resp.status, await resp.text().catch(()=>""));
          if (!cancelled) setPosts(initialPosts);
          return;
        }
        const json = await resp.json();
        const mapped = (json.posts || []).map(row => ({
          id: row.id,
          image: row.image_url || row.image_path || post1,
          author: row.author || prettyId(row.user_id),
          authorAvatar: row.avatar || profile.profilePic || profilePicFallback,
          likes: typeof row.likes === "number" ? row.likes : 0,
          liked: Boolean(row.liked),
          isFollowing: false,
          caption: row.caption ?? "",
          isSaved: row.is_saved ?? false,
          tags: Array.isArray(row.tags) ? row.tags : (row.tags ? JSON.parse(row.tags) : []),
          raw: row.raw ?? row // backend returns raw inside raw; be defensive
        }));

        if (!cancelled) setPosts(mapped.length ? mapped : initialPosts);
      } catch (err) {
        console.error("Exception fetching posts:", err);
        if (!cancelled) setPosts(initialPosts);
      } finally {
        if (!cancelled) setIsLoadingPosts(false);
      }
    })();

    return () => { cancelled = true; };
  }, [profile?.user_id, user?.id]);

  // Fetch posts saved by current user (saved is personal so use current logged-in user)
  useEffect(() => {
    if (!user) {
      setIsLoadingSaved(false);
      return;
    }
    let cancelled = false;

    (async () => {
      setIsLoadingSaved(true);
      try {
        const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:7000";
        const resp = await fetch(`${base}/api/profile/saved?userId=${encodeURIComponent(user.id)}`);
        if (!resp.ok) throw new Error("Failed to fetch saved posts");
        const json = await resp.json();
        if (!cancelled) setSavedPosts(json.posts || []);
      } catch (err) {
        console.error("Error fetching saved posts:", err);
        if (!cancelled) setSavedPosts([]);
      } finally {
        if (!cancelled) setIsLoadingSaved(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  // Patch posts' author field once profile becomes available (handles race conditions)
  useEffect(() => {
    if (!profile || !posts || posts.length === 0) return;

    setPosts(prev =>
      prev.map(p => {
        if (p.raw && p.raw.user_id && p.raw.user_id === profile.user_id) {
          return {
            ...p,
            author: profile.username || p.author,
            authorAvatar: profile.profilePic || p.authorAvatar || profilePicFallback
          };
        }
        return p;
      })
    );
  }, [profile]);

  // Masonry layout initialization
  useEffect(() => {
    const timer = setTimeout(() => {
      const galleries = document.querySelectorAll('.fs-gallery, .saved-gallery');

      galleries.forEach(gallery => {
        const items = gallery.querySelectorAll('.fs-gallery-item');

        const resizeItem = (item) => {
          const img = item.querySelector('img, .homecard-img');
          if (!img) return;

          const style = window.getComputedStyle(gallery);
          const rowHeightPx = parseInt(style.getPropertyValue('grid-auto-rows')) || 8;
          const gapPx = parseInt(style.getPropertyValue('gap')) || parseInt(style.getPropertyValue('grid-row-gap')) || 16;
          const imgHeight = img.getBoundingClientRect().height;
          const rowSpan = Math.max(1, Math.ceil((imgHeight + gapPx) / (rowHeightPx + gapPx)));

          item.style.gridRowEnd = `span ${rowSpan}`;
        };

        items.forEach(item => {
          const img = item.querySelector('img, .homecard-img');
          if (!img) return;

          if (img.complete) {
            resizeItem(item);
          } else {
            img.addEventListener('load', () => resizeItem(item));
          }
        });
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [posts, savedPosts, mode]);

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

    const optimisticPic = updatedUser.profilePic;
    if (optimisticPic) {
      setPosts(prev =>
        (prev || []).map(p => {
          const ownerId = p?.raw?.user_id || p?.raw?.userId || p?.user_id || p?.userId || null;
          if (ownerId && user?.id && ownerId === user.id) {
            return { ...p, authorAvatar: optimisticPic };
          }
          return p;
        })
      );

      setSavedPosts(prev =>
        (prev || []).map(p => {
          const ownerId = p?.raw?.user_id || p?.raw?.userId || p?.user_id || p?.userId || null;
          if (ownerId && user?.id && ownerId === user.id) {
            return { ...p, authorAvatar: optimisticPic };
          }
          return p;
        })
      );
    }

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

  // update local likes state when HomeCard reports a change
  const handleToggleLikeLocal = (postData, newLiked, newCount) => {
    setPosts(prev => prev.map(p => p.id === postData.id ? { ...p, liked: Boolean(newLiked), likes: (typeof newCount === 'number' ? newCount : p.likes) } : p));
  };

  const handleToggleSaveLocal = (postData, newSaved /*, newCount */) => {
    setPosts(prev => prev.map(p => p.id === postData.id ? { ...p, isSaved: Boolean(newSaved) } : p));
  };

  // Open edit modal with a post
  const openEdit = (post) => {
    setEditingPost(post);
    setEditModalOpen(true);
  };

  // Save edited fields to Supabase (optimistic UI + rollback)
  const handleEditSave = async (editedFields = {}, post) => {
    if (!post || !post.id) {
      alert("Invalid post to edit");
      return;
    }

    setEditModalOpen(false);
    const prev = posts;
    setPosts((arr) => arr.map((p) => (p.id === post.id ? { ...p, ...editedFields } : p)));

    try {
      const { data, error } = await supabase
        .from("posts")
        .update(editedFields)
        .eq("id", post.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setPosts((arr) => arr.map((p) => {
          if (p.id !== post.id) return p;
          return {
            ...p,
            image: data.image_url || data.image_path || p.image,
            caption: data.caption ?? p.caption,
            raw: { ...p.raw, ...data }
          };
        }));
      }
    } catch (err) {
      console.error("Failed to edit post", err);
      alert("Could not save changes. Reverting.");
      setPosts(prev);
    } finally {
      setEditingPost(null);
    }
  };


  // Delete a post (optimistic remove + rollback)
  const handleDeletePost = async (post) => {
    if (!post || !post.id) {
      alert("Invalid post to delete");
      return;
    }

    const ok = window.confirm("Are you sure you want to delete this post? This cannot be undone.");
    if (!ok) return;

    setProcessingDelete(true);
    const prev = posts;
    setPosts((arr) => arr.filter((p) => p.id !== post.id));

    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id);

      if (error) throw error;
    } catch (err) {
      console.error("Failed to delete post", err);
      alert("Could not delete post. Reverting.");
      setPosts(prev);
    } finally {
      setProcessingDelete(false);
    }
  };

  // Temporary handler used earlier (keeps compatibility)
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
    if (post.raw && post.raw.user_id) return post.raw.user_id === profile.user_id;
    return post.author === profile.username;
  });
  const isOwnProfile = user && profile && String(profile.user_id) === String(user.id);


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
                      <b>{isLoadingCounts ? "…" : followersCount}</b>
                      <span>Followers</span>
                    </div>
                    <div className="fs-stat">
                      <b>{isLoadingCounts ? "…" : followingCount}</b>
                      <span>Following</span>
                    </div>
                  </div>

                  <div className="fs-actions">
                    <button className="fs-btn fs-btn-follow">Share</button>

                    {/* show Edit Profile only for the current logged-in user */}
                    {profile.user_id === user?.id ? (
                      <button
                        className="fs-btn fs-btn-ghost"
                        onClick={() => setIsEditing(true)}
                      >
                        Edit Profile
                      </button>
                    ) : (
                      <button className="fs-btn fs-btn-follow" onClick={() => handleToggleFollow({ author: profile.username })}>
                        Follow
                      </button>
                    )}
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
                          isOwnProfile={isOwnProfile} 
                          authorAvatar={postData.authorAvatar}
                          onToggleFollow={() => handleToggleFollow(postData)}
                          onToggleLike={(p, newLiked, newCount) => handleToggleLikeLocal(p, newLiked, newCount)}
                          onToggleSave={(p, newSaved, newCount) => handleToggleSaveLocal(p, newSaved, newCount)}
                          onEdit={(p) => openEdit(p)}
                          onDelete={(p) => handleDeletePost(p)}
                          onShare={(p) => { /* keep existing or add share behavior */ }}
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
                  {isLoadingSaved ? (
                    <div style={{ padding: 24 }}>Loading saved posts…</div>
                  ) : savedPosts.length > 0 ? (
                    savedPosts.map((postData) => (
                      <div key={postData.id} className="fs-gallery-item">
                        <HomeCard
                          post={postData}
                          mode="profile"
                          isOwnProfile={isOwnProfile} 
                          onToggleFollow={() => handleToggleFollow(postData)}
                          onToggleLike={(p, newLiked, newCount) => handleToggleLikeLocal(p, newLiked, newCount)}
                          onToggleSave={(p, newSaved, newCount) => handleToggleSaveLocal(p, newSaved, newCount)}
                          onEdit={(p) => openEdit(p)}
                          onDelete={(p) => handleDeletePost(p)}
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

      {/* Edit Post Modal (for editing caption / image) */}
      <EditPostModal
        open={editModalOpen}
        post={editingPost}
        onClose={() => { setEditModalOpen(false); setEditingPost(null); }}
        onSave={handleEditSave}
      />
    </>
  );
}
