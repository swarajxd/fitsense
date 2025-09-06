// src/components/NavBar2.jsx
import React from "react";
import './NavBar2.css';
import { IoMailOutline } from "react-icons/io5";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

export default function NavBar2() {
  return (
    <div className="navbar2">
      <div className="info">
        <h1><IoMailOutline /> info@kuwloagem.com</h1>
      </div>

      <div className="logocontainer">
        <h1>FITSENSE</h1>
      </div>

      <div className="nav-links">
        <SignedOut>
          {/* SPA nav to your custom Signup page */}
          <Link to="/signup" className="nav-link">Signup</Link>
          {/* also provide Login link when signed out */}
          <Link to="/login" className="nav-link">Login</Link>
        </SignedOut>

        <SignedIn>
          {/* When signed in show Clerk's user button (avatar + menu) */}
          <UserButton afterSignOutUrl="/" />
        </SignedIn>

        {/* static links */}
        <a href="#about" className="nav-link">About</a>
        <a href="#services" className="nav-link">Services</a>
        <a href="#contact" className="nav-link">Contact</a>
      </div>
    </div>
  );
}
