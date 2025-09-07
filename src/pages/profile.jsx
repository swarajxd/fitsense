import React, { useState } from "react";
import "./profile.css";
import Header from '../components/header'; // Adjust path as needed
import profilePic from "../assets/profilepic.jpg";
import EditProfile from "../components/EditProfile.jsx"; // ✅ import modal
import post1 from "../assets/post1.jpg";
import post2 from "../assets/post2.jpg";
import post3 from "../assets/post3.jpg";
import post4 from "../assets/post4.jpg";
import post5 from "../assets/post5.jpg";
// sample posts array
const postImages = [post1, post2, post3, post4, post5];


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

  // create 18 demo items
  const galleryItems = Array.from({ length: 18 }).map((_, i) => ({
    id: i + 1,
    img: demoImgs[i % demoImgs.length],
  }));

  const handleSave = (updatedUser) => {
    setUser(updatedUser);
    setIsEditing(false);
  };

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
                    <button className="fs-btn fs-btn-follow">Follow</button>
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
              <div className="fs-brand"><span className="fs-dot" /> Posts</div>
            </div>

            {/* scrollable gallery area */}
            <div className="fs-gallery-wrap">
            <section className="fs-gallery" aria-label="Posts gallery">
              {Array.from({ length: 20 }).map((_, index) => {
                const img = postImages[index % postImages.length]; // repeat images
                return (
                  <div key={index} className="fs-gallery-item">
                    <img
                      src={img}
                      alt={`Post ${index + 1}`}
                      loading="lazy"
                    />
                    
                  </div>
                );
              })}
            </section>
            </div>
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
