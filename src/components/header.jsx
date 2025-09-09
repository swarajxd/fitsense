import React from "react"; 
import "./Header.css";
import { GoHome } from "react-icons/go";
import { FiCamera, FiLogOut } from "react-icons/fi";
import { GiTShirt } from "react-icons/gi";
import { LuMessageCircleMore } from "react-icons/lu";
import { Link } from "react-router-dom";
import { useUser, SignOutButton } from "@clerk/clerk-react";

export default function Header() {
  let user = null;
  try {
    const u = useUser();
    user = u?.user ?? null;
  } catch (e) {
    user = null;
  }

  const profileImage =
    user?.profileImageUrl ??
    user?.imageUrl ??
    user?.image ??
    user?.photoUrl ??
    "/default-pfp.jpg";

  return (
    <header className="h-app-header">
      <div className="h-header-inner">
        {/* Left side: logo */}
        <div className="h-left">
          <div className="h-logo">FITSENSE</div>
        </div>

        {/* Center navigation icons */}
        <nav className="h-nav-icons" aria-label="Main navigation">
          <Link to="/home" className="icon-link" title="Home" aria-label="Home">
            <GoHome />
          </Link>

          <Link to="/create" className="icon-link" title="Create" aria-label="Create">
            <FiCamera />
          </Link>

          <Link to="/aichat" className="icon-link" title="AI Chat" aria-label="AI Chat">
            <GiTShirt />
          </Link>

          <Link to="/inbox" className="icon-link" title="Messages" aria-label="Messages">
            <LuMessageCircleMore />
          </Link>

          <Link to="/profile" className="icon-link nav-profile-link" title="Profile" aria-label="Profile">
            <img src={profileImage} alt="profile" className="nav-profile-icon" />
          </Link>
        </nav>

        {/* Right side: sign out button */}
        <div className="h-right">
          <SignOutButton>
            <button className="icon-link sign-out-btn" title="Sign Out" aria-label="Sign Out">
              <FiLogOut />
            </button>
          </SignOutButton>
        </div>
      </div>
    </header>
  );
}
