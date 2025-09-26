import React from "react";
import { Link } from "react-router-dom";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/clerk-react";
import "./Navbar.css";

export default function Navbar() {
  return (
    <header className="app-navbar">
      {/* Left: logo/brand */}
      <div className="nav-left">
        <Link to="/" className="brand-link">
          <span className="nav-brand">Fit-Sense</span>
        </Link>
      </div>

      {/* Middle: search bar */}
      <div className="nav-middle">
        <input
          type="text"
          placeholder="Search outfits..."
          className="search-bar"
        />
      </div>

      {/* Right: sign in/out + profile */}
      <div className="nav-right">
        <SignedIn>
          {/* Clerk handles avatar + logout inside this button */}
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                userButtonAvatarBox: {
                  width: "48px",   // increase width
                  height: "48px",  // increase height
                },
              },
            }}
          />
        </SignedIn>

        <SignedOut>
          <SignInButton mode="modal">
            <button className="nav-signin">Sign in</button>
          </SignInButton>
        </SignedOut>
      </div>
    </header>
  );
}
