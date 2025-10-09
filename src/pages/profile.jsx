// src/pages/profile.jsx
import React, { useEffect, useState } from "react";
import "./profile.css";
import Header from "../components/header";
import HomeCard from "../components/HomeCard";
import profilePicFallback from "../assets/profilepic.jpg";
import EditProfile from "../components/EditProfile.jsx";
import EditPostModal from "../components/EditPostModal";
import FollowersModal from "../components/FollowersModal";

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
   const [isFollowingProfile, setIsFollowingProfile] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  // modal for follower/following lists
const [fmOpen, setFmOpen] = useState(false);
const [fmType, setFmType] = useState(null); // "followers" | "following"
const [fmUsers, setFmUsers] = useState([]);
const [fmLoading, setFmLoading] = useState(false);


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
    // Determine if current user is following the profile (for header + card sync)
  useEffect(() => {
    if (!user?.id || !profile?.user_id) {
      setIsFollowingProfile(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data: existing, error } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', user.id)
          .eq('followee_id', profile.user_id)
          .maybeSingle();

        if (error) {
          console.error('Error checking follow state:', error);
          if (!cancelled) setIsFollowingProfile(false);
          return;
        }

        if (!cancelled) {
          const nowFollowing = Boolean(existing && existing.id);
          setIsFollowingProfile(nowFollowing);

          // Sync posts and savedPosts isFollowing flag for this profile's owner
          setPosts(prev => (prev || []).map(p => {
            const owner = p?.raw?.user_id || p?.user_id || p?.userId;
            if (owner && String(owner) === String(profile.user_id)) {
              return { ...p, isFollowing: nowFollowing };
            }
            return p;
          }));

          setSavedPosts(prev => (prev || []).map(p => {
            const owner = p?.raw?.user_id || p?.user_id || p?.userId;
            if (owner && String(owner) === String(profile.user_id)) {
              return { ...p, isFollowing: nowFollowing };
            }
            return p;
          }));
        }
      } catch (err) {
        console.error('Failed to resolve follow state:', err);
        if (!cancelled) setIsFollowingProfile(false);
      }
    })();

    return () => { cancelled = true; };
  }, [profile?.user_id, user?.id]);


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
    setSavedPosts([]);
    return;
  }

  let cancelled = false;
  (async () => {
    setIsLoadingSaved(true);
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:7000";
      const resp = await fetch(`${base}/api/profile/saved?userId=${encodeURIComponent(user.id)}`);
      if (!resp.ok) {
        console.error("Failed to fetch saved posts:", resp.status, await resp.text().catch(() => ""));
        if (!cancelled) setSavedPosts([]);
        return;
      }

      const json = await resp.json();
      const normalized = (json.posts || []).map(row => ({
        ...row,
        id: row.id,
        image: row.image_url || row.image_path || post1,
        author: row.author || row.username || row.user || `user${row.user_id ?? ""}`,
        authorAvatar: row.avatar || profile?.profilePic || profilePicFallback,
        caption: row.caption ?? "",
        liked: false,           // temporary — will update from Supabase below
        likes: 0,               // temporary — will update from Supabase below
        isFollowing: false,     // will update below
        isSaved: true,
        raw: row,
      }));

      if (cancelled || !normalized.length) {
        if (!cancelled) setSavedPosts(normalized);
        return;
      }

      // collect post IDs and author IDs
      const postIds = normalized.map(p => p.id).filter(Boolean);
      const authorIds = Array.from(
        new Set(
          normalized.map(p => p.raw?.user_id || p.user_id || p.authorId || p.author).filter(Boolean)
        )
      );

      /* -------------------------
         Fetch like info (per post + for current user)
         ------------------------- */
      let likesData = [];
      try {
        const { data: allLikes, error: likeErr } = await supabase
          .from("likes")
          .select("post_id, user_id");

        if (!likeErr && allLikes) likesData = allLikes;
      } catch (err) {
        console.warn("Could not fetch likes:", err);
      }

      const userLikedSet = new Set(
        likesData.filter(l => l.user_id === user.id).map(l => String(l.post_id))
      );

      const likeCountMap = {};
      likesData.forEach(l => {
        const pid = String(l.post_id);
        likeCountMap[pid] = (likeCountMap[pid] ?? 0) + 1;
      });

      /* -------------------------
         Fetch following info (as before)
         ------------------------- */
      let followingSet = new Set();
      try {
        if (authorIds.length > 0) {
          const { data: followRows, error: followErr } = await supabase
            .from("follows")
            .select("followee_id")
            .eq("follower_id", user.id)
            .in("followee_id", authorIds);

          if (!followErr && followRows) {
            followingSet = new Set(followRows.map(r => String(r.followee_id)));
          }
        }
      } catch (err) {
        console.warn("Could not fetch follow info:", err);
      }

      /* -------------------------
         Merge all info back into savedPosts
         ------------------------- */
      const withAllFlags = normalized.map(p => {
        const pid = String(p.id);
        const owner = String(p.raw?.user_id || p.user_id || p.authorId || p.author);
        return {
          ...p,
          liked: userLikedSet.has(pid),
          likes: likeCountMap[pid] ?? 0,
          isFollowing: followingSet.has(owner),
        };
      });

      if (!cancelled) setSavedPosts(withAllFlags);
    } catch (err) {
      console.error("Error fetching saved posts:", err);
      if (!cancelled) setSavedPosts([]);
    } finally {
      if (!cancelled) setIsLoadingSaved(false);
    }
  })();

  return () => { cancelled = true; };
}, [user?.id, profile?.profilePic]);



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

  // FOLLOW/UNFOLLOW handler (optimistic, synced across posts + savedPosts)
  const handleToggleFollow = async (postOrProfileLike) => {
    if (!user?.id) {
      alert('Please sign in to follow users.');
      return;
    }

    // resolve followee id
    const resolveFolloweeId = (x) => {
      if (!x) return null;
      if (typeof x === 'string') return x;
      if (x.raw && (x.raw.user_id || x.raw.userId)) return x.raw.user_id || x.raw.userId;
      if (x.user_id || x.userId) return x.user_id || x.userId;
      // fallback to profile.user_id (if toggling from profile header)
      if (x.author && profile?.user_id && (x.author === profile.username || x.author === profile.user_id)) return profile.user_id;
      return null;
    };

    const followeeId = resolveFolloweeId(postOrProfileLike) || profile?.user_id;
    if (!followeeId) {
      console.error('Could not determine followee id for', postOrProfileLike);
      alert('Could not follow/unfollow: missing user id.');
      return;
    }

    // detect current state using either posts or savedPosts
    const currentlyFollowing =
      (posts.find(p => String(p.raw?.user_id || p.user_id || p.userId) === String(followeeId))?.isFollowing) ||
      (savedPosts.find(p => String(p.raw?.user_id || p.user_id || p.userId) === String(followeeId))?.isFollowing) ||
      false;

    // optimistic update (flip isFollowing for all posts that belong to followee)
    setPosts(prev => prev.map(p => {
      const owner = p?.raw?.user_id || p?.user_id || p?.userId;
      if (owner && String(owner) === String(followeeId)) return { ...p, isFollowing: !currentlyFollowing };
      return p;
    }));

    setSavedPosts(prev => prev.map(p => {
      const owner = p?.raw?.user_id || p?.user_id || p?.userId;
      if (owner && String(owner) === String(followeeId)) return { ...p, isFollowing: !currentlyFollowing };
      return p;
    }));




// add near top of component if not present:
// const [followBusy, setFollowBusy] = useState(false);

try {
  setFollowBusy(true);

  // check if already following
  const { data: existing, error: selErr } = await supabase
    .from("follows")
    .select("*")
    .eq("follower_id", user.id)
    .eq("followee_id", followeeId)
    .maybeSingle();

  if (selErr) throw selErr;

  if (existing && existing.id) {
    // unfollow
    const { error: delErr } = await supabase
      .from("follows")
      .delete()
      .eq("id", existing.id);

    if (delErr) throw delErr;
  } else {
    // follow
    const { error: insErr } = await supabase
      .from("follows")
      .insert({ follower_id: user.id, followee_id: followeeId });

    if (insErr) throw insErr;
  }

  // success: update header follow flag to the new state
  setIsFollowingProfile(prev => !prev);

  // refresh follower/following counts (awaited, not fire-and-forget)
  try {
    const followersQ = await supabase
      .from("follows")
      .select("id", { head: true, count: "exact" })
      .eq("followee_id", profile.user_id);

    const followingQ = await supabase
      .from("follows")
      .select("id", { head: true, count: "exact" })
      .eq("follower_id", profile.user_id);

    setFollowersCount(followersQ.count ?? followersCount);
    setFollowingCount(followingQ.count ?? followingCount);
  } catch (e) {
    console.warn("Could not refresh follow counts:", e);
    // non-fatal — we keep optimistic counts/state
  }

} catch (err) {
  console.error("Follow/unfollow failed, reverting optimistic update", err);

  // revert optimistic change on posts & savedPosts
  setPosts(prev => prev.map(p => {
    const owner = p?.raw?.user_id || p?.user_id || p?.userId;
    if (owner && String(owner) === String(followeeId)) return { ...p, isFollowing: currentlyFollowing };
    return p;
  }));

  setSavedPosts(prev => prev.map(p => {
    const owner = p?.raw?.user_id || p?.user_id || p?.userId;
    if (owner && String(owner) === String(followeeId)) return { ...p, isFollowing: currentlyFollowing };
    return p;
  }));

  // revert header follow flag
  setIsFollowingProfile(currentlyFollowing);

  alert("Could not update follow status. Please try again.");
} finally {
  setFollowBusy(false);
}

  };
  // update local likes state when HomeCard reports a change
  const handleToggleLikeLocal = (postData, newLiked, newCount) => {
    setPosts(prev => prev.map(p => p.id === postData.id ? { ...p, liked: Boolean(newLiked), likes: (typeof newCount === 'number' ? newCount : p.likes) } : p));
    setSavedPosts(prev => prev.map(p => p.id === postData.id ? { ...p, liked: Boolean(newLiked), likes: (typeof newCount === 'number' ? newCount : p.likes) } : p));
  };
  // Fetch and show followers or following list in modal
const openFollowersModal = async (type = "followers") => {
  // type: "followers" -> users who follow this profile
  // type: "following" -> users this profile follows
  if (!profile?.user_id) return;

  setFmType(type);
  setFmOpen(true);
  setFmLoading(true);
  setFmUsers([]);

  try {
    if (type === "followers") {
      // get follower rows (follower_id)
      const { data: rows, error: rowsErr } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("followee_id", profile.user_id);

      if (rowsErr) throw rowsErr;
      const ids = (rows || []).map(r => r.follower_id).filter(Boolean);

      if (!ids.length) {
        setFmUsers([]);
        return;
      }

      // try to fetch profile info for these ids from 'profiles' table
      const { data: users, error: usersErr } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", ids);

      if (usersErr || !users) {
        // fallback to minimal objects if profiles table missing
        setFmUsers(ids.map(id => ({ user_id: id })));
        return;
      }

      // For each user, determine whether current viewer follows them
      const { data: followRows } = await supabase
        .from("follows")
        .select("followee_id")
        .eq("follower_id", user?.id)
        .in("followee_id", ids);

      const followingSet = new Set((followRows || []).map(r => String(r.followee_id)));

      const mapped = users.map(u => ({
        ...u,
        user_id: u.user_id ?? u.id ?? u.profile_id,
        username: u.username || u.name || u.display_name,
        avatar: u.avatar || u.avatar_url || u.profilePic,
        bio: u.bio || u.description || "",
        isFollowing: followingSet.has(String(u.user_id ?? u.id ?? u.profile_id)),
      }));
      setFmUsers(mapped);
    } else {
      // type === "following" -> who this profile follows (followee_id)
      const { data: rows, error: rowsErr } = await supabase
        .from("follows")
        .select("followee_id")
        .eq("follower_id", profile.user_id);

      if (rowsErr) throw rowsErr;
      const ids = (rows || []).map(r => r.followee_id).filter(Boolean);

      if (!ids.length) {
        setFmUsers([]);
        return;
      }

      const { data: users, error: usersErr } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", ids);

      if (usersErr || !users) {
        setFmUsers(ids.map(id => ({ user_id: id })));
        return;
      }

      // Does the current viewer follow these users?
      const { data: followRows } = await supabase
        .from("follows")
        .select("followee_id")
        .eq("follower_id", user?.id)
        .in("followee_id", ids);

      const followingSet = new Set((followRows || []).map(r => String(r.followee_id)));

      const mapped = users.map(u => ({
        ...u,
        user_id: u.user_id ?? u.id ?? u.profile_id,
        username: u.username || u.name || u.display_name,
        avatar: u.avatar || u.avatar_url || u.profilePic,
        bio: u.bio || u.description || "",
        isFollowing: followingSet.has(String(u.user_id ?? u.id ?? u.profile_id)),
      }));

      setFmUsers(mapped);
    }
  } catch (err) {
    console.error("Failed to load follower/following list:", err);
    setFmUsers([]);
  } finally {
    setFmLoading(false);
  }
};

// Called when the modal follow/unfollow button is clicked
const handleFmToggleFollow = async (u) => {
  // u may be a profile object (with user_id) — reuse existing handleToggleFollow
  try {
    await handleToggleFollow(u);
    // optimistically flip isFollowing in modal list
    setFmUsers(prev => (prev || []).map(item => {
      const id = String(item.user_id ?? item.id ?? item.profile_id);
      const target = String(u.user_id ?? u.id ?? u.profile_id ?? u.followee_id ?? u.followeeId ?? u);
      if (id === target) {
        return { ...item, isFollowing: !Boolean(item.isFollowing) };
      }
      return item;
    }));
    // Also refresh header follow state and counts (optional): already handled by handleToggleFollow
  } catch (err) {
    console.error("Modal follow toggle failed:", err);
    alert("Could not update follow status.");
  }
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

// SHARE handler: tries navigator.share, falls back to copy link
  const handleShare = async (post) => {
    try {
      const postUrl = `${window.location.origin}/post/${encodeURIComponent(post?.id ?? post?.raw?.id ?? '')}`;
      // Native share
      if (navigator.share) {
        await navigator.share({
          title: post?.caption || 'Check out this post',
          text: post?.caption || '',
          url: postUrl,
        });
        return;
      }

      // Fallback: copy to clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(postUrl);
        alert('Post link copied to clipboard!');
        return;
      }

      // Final fallback: prompt with URL
      window.prompt('Copy this link:', postUrl);
    } catch (err) {
      console.error('Share failed', err);
      alert('Could not share the post.');
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
                    <button
                      className="stat-link"
                      onClick={() => openFollowersModal("followers")}
                      aria-label="Show followers"
                      disabled={isLoadingCounts}
                    >
                      <b>{isLoadingCounts ? "…" : followersCount}</b>
                      <span>Followers</span>
                    </button>
                  </div>

                  <div className="fs-stat">
                    <button
                      className="stat-link"
                      onClick={() => openFollowersModal("following")}
                      aria-label="Show following"
                      disabled={isLoadingCounts}
                    >
                      <b>{isLoadingCounts ? "…" : followingCount}</b>
                      <span>Following</span>
                    </button>
                  </div>
                </div>

                <div className="fs-actions">
                  <button
                    className="fs-btn fs-btn-follow"
                        onClick={() => {
                          // Share profile URL
                          const url = `${window.location.origin}/profile/${encodeURIComponent(profile.user_id)}`;

                          if (navigator.share) {
                            navigator
                              .share({
                                title: `${profile.name} (@${profile.username})`,
                                url,
                              })
                              .catch(() => {});
                          } else if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard
                              .writeText(url)
                              .then(() => alert("Profile URL copied to clipboard!"));
                          } else {
                            window.prompt("Profile URL", url);
                          }
                        }}
                      >
                        Share
                      </button>

                      {profile.user_id === user?.id ? (
                        <button
                          className="fs-btn fs-btn-ghost"
                          onClick={() => setIsEditing(true)}
                        >
                          Edit Profile
                        </button>
                      ) : (
                      <button
                        className="fs-btn fs-btn-follow"
                        onClick={() => handleToggleFollow({ author: profile.username })}
                      >
                        {isFollowingProfile ? "Unfollow" : "Follow"}
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
                          onShare={(p) => handleShare(p)}
                            canEdit={isOwnProfile}
                            canDelete={isOwnProfile}
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
                          onShare={(p) => handleShare(p)}
                            canEdit={false}
                            canDelete={false}
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
        
       <FollowersModal
      open={fmOpen}
      title={fmType === "following" ? "Following" : "Followers"}
      users={fmUsers}
      loading={fmLoading}
      onClose={() => setFmOpen(false)}
      onToggleFollow={handleFmToggleFollow}
      currentUserId={user?.id}
      />
 
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
