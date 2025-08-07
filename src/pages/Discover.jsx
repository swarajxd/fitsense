import React from "react";
import Navbar from "../components/Navbar";
import "./Discover.css";
import { FaPlus, FaHeart, FaShareAlt, FaBookmark } from "react-icons/fa";

const imageCount = 20;
const images = Array.from({ length: imageCount }, (_, i) => `/img${i + 1}.jpg`);

const Discover = () => {
  return (
    <>
      <Navbar />

      <div className="masonry">
        {images.map((src, index) => (
          <div className="masonry-item" key={index}>
            <img src={src} alt={`img${index}`} />

            <div className="image-actions">
              <button className="action-btn"><FaHeart /></button>
              <button className="action-btn"><FaShareAlt /></button>
              <button className="action-btn"><FaBookmark /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="upload-button">
        <FaPlus className="plus-icon" />
      </div>
    </>
  );
};

export default Discover;
