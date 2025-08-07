import React, { useState } from 'react';
import './PostCard.css';
import { FaHeart, FaRegHeart, FaShareAlt, FaBookmark } from 'react-icons/fa';

const PostCard = ({ imageUrl }) => {
  const [liked, setLiked] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="post-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={imageUrl} alt="Post" className="post-image" />
      {hovered && (
        <div className="overlay">
          <div className="action-buttons">
            <button className="icon-btn" onClick={() => setLiked(!liked)}>
              {liked ? <FaHeart className="liked" /> : <FaRegHeart />}
            </button>
            <button className="icon-btn">
              <FaShareAlt />
            </button>
          </div>
          <button className="save-btn">
            <FaBookmark />
          </button>
        </div>
      )}
    </div>
  );
};

export default PostCard;
