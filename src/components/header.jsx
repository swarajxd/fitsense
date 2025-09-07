import React from 'react';
import './Header.css';
import { FaHome, FaSearch, FaCamera, FaHeart } from "react-icons/fa";
import { GoHome } from "react-icons/go";
import { CiSearch } from "react-icons/ci";
import { FiCamera } from "react-icons/fi";
import { IoSearchSharp } from "react-icons/io5";
import { FaRegHeart } from "react-icons/fa";
import { LuMessageCircleMore } from "react-icons/lu";

export default function Header() {
  return (
    <header className="h-app-header">
      <div className="h-header-inner">
        <div className="h-logo">FITSENSE</div>

        <nav className="h-nav-icons">
          <GoHome size={32} />
          <IoSearchSharp size={32} />
          <FiCamera size={32} />
          <FaRegHeart size={32} />


        </nav>
        <div className="h-message-icon">
          <LuMessageCircleMore size={32}  />
        </div>
      </div>
    </header>
  );
}