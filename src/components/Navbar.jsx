import React from "react";
import "./Navbar.css"; // Create this file or move styles to global CSS
import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <header className="navbar">
      <h1>Fit-Sense</h1>
      <input type="text" placeholder="Search outfits..." className="search-bar" />
      <img src="/profile.jpg" alt="Profile" className="profile-pic" />
    </header>
  );
};

export default Navbar;
