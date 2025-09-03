import React, { useState } from 'react';
import './Profile.css';
import Header from '../components/header'; // Adjust path as needed
import defaultAvatar from '../assets/profilepic.jpg'; // Adjust path as needed
import post1 from '../assets/post1.jpg';
import post2 from '../assets/post2.jpg';
import post3 from '../assets/post3.jpg';
import post4 from '../assets/post4.jpg';
import post5 from '../assets/post5.jpg';
import EditProfile from '../components/EditProfile';
const postImages = [post1, post2, post3, post4, post5];
const Profile = () => {
  const [user, setUser] = useState({
    name: "taha_313",
    bio: "Follow for more outfit inspiration",
    profilePic: "", // You can store image URL or base64 here
    location: "📍 Mum",
    link: "www.pinterest.com"
  });

  const [activeTab, setActiveTab] = useState("posts");
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = (updatedUser) => {
    setUser(updatedUser);
    setIsEditing(false);
  };
  return (
    <>
      <Header />
      <div className="profile-container">
        <section className="profile-info">
          <div className="profile-left">
            <div className="profile-pic">
                <img src={user.profilePic || defaultAvatar} alt="Profile" />
            </div>
            
          </div>
          
          <div className="profile-right">
           <h2 className="username">{user.name}</h2>
            <div className="stats">
              <div className="stat-item">
                <span className="stat-number">234</span>
                <span className="stat-label">posts</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">64</span>
                <span className="stat-label">followers</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">92</span>
                <span className="stat-label">following</span>
              </div>
            </div>
            <div className="profile-buttons-row">
              <button className="edit-profile-btn" onClick={() => setIsEditing(true)}>Edit Profile</button>
              <button className="edit-profile-btn">Share profile</button>
              <button className="more-options-btn">⋯</button>
            </div>
            
          </div>
        </section>

        <section className="bio-section-separate">
          <h3 className="bio-title"></h3>
          <p className="bio">
             
          </p>
          <p className="bio">{user.bio}</p>

          <p className="bio location">{user.location || "📍 Mum"}</p>
          <a href="#" className="website-link">{user.link || "linktr.ee/fitsense"}</a>

        </section>


        <section className="tabs-section">
          <div className="tabs">
            <button 
              className={`tab ${activeTab === 'posts' ? 'active' : ''}`}
              onClick={() => setActiveTab('posts')}
            >
              <span className="tab-icon">⚏</span>
              <span>POSTS</span>
            </button>
            <button 
              className={`tab ${activeTab === 'saved' ? 'active' : ''}`}
              onClick={() => setActiveTab('saved')}
            >
              <span className="tab-icon">🔖</span>
              <span>SAVED POSTS</span>
            </button>
          </div>
        </section>

        <section className="gallery">
          {activeTab === 'posts' && (
            <>
              {[...Array(15)].map((_, index) => {
                // Create varied heights for Pinterest-style layout
                const heights = ['200px', '250px', '180px', '300px', '220px', '280px', '160px', '240px', '320px'];
                const randomHeight = heights[index % heights.length];
                const image = postImages[index % postImages.length]; // pick image in loop
                return (
                  <div 
                    key={index} 
                    className="gallery-item pinterest-item"
                    style={{ height: randomHeight }}
                  >
                    <img src={image} alt={`Post ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div className="pinterest-overlay">
                      <button className="save-btn">Save</button>
                      <button className="more-btn">⋯</button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {activeTab === 'saved' && (
            <div className="saved-empty">
              <p>No saved posts yet</p>
            </div>
          )}
        </section>
        {isEditing && (
        <EditProfile
      currentData={user} // ✅ pass user data
      onSave={(updatedData) => {
      setUser(updatedData);
      setIsEditing(false);
      }}
    />
)}

        <footer className="footer-circle">
          <div className="circle-btn"></div>
        </footer>
      </div>
    </>
  );
};

export default Profile;