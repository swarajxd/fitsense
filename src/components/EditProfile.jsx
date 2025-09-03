import React, { useState } from "react";
import "./EditProfile.css";

export default function EditProfile({ onSave, currentData = {} }) {
  const [name, setName] = useState(currentData.name || "");
  const [bio, setBio] = useState(currentData.bio || "");
  const [profilePic, setProfilePic] = useState(currentData.profilePic || "");
  const [location, setLocation] = useState(currentData.location || "");
  const [link, setLink] = useState(currentData.link || "");

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    onSave({ name, bio, profilePic, location,link });
  };
  const close = () => {
    onSave({ name: "", bio: "", profilePic: "", location: "", link: "" }); // Close the modal without saving
  };

  return (
    <div className="edit-profile-modal">
      <div className="edit-profile-content">
        {/* Close Button */}
        <button onClick={() => close()} className="close-btn">
          ×
        </button>

        <h2 className="edit-profile-title">Edit Profile</h2>

        {/* Profile Picture Section */}
        <div className="profile-pic-section">
          <div className="profile-pic-container">
            {profilePic ? (
              <img
                src={profilePic}
                alt="Profile Preview"
                className="edit-profile-preview"
              />
            ) : (
              <div className="no-image-placeholder">
                No Image
              </div>
            )}
            
            <label className="camera-btn">
              📷
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="file-input"
              />
            </label>
          </div>
          <p className="upload-hint">Click camera to change</p>
        </div>

        <label className="form-label">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="form-input"
          placeholder="Enter your name"
        />

        <label className="form-label">Bio</label>
        <textarea 
          value={bio} 
          onChange={(e) => setBio(e.target.value)}
          className="form-textarea"
          placeholder="Tell us about yourself..."
          maxLength={20}
        />
        {/* Bio Location */}
        <label className="form-label">Location</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="form-input"
          placeholder="Enter your location"
        />
      <label className="form-label">Link</label>
        <input
          type="text"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className="form-input"
          placeholder="Enter your website link"
        />
        <div className="character-counter">
          {bio.length}/20 characters
        </div>

        <div className="edit-profile-actions">
          <button onClick={handleSave} className="save-btn">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}