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
    <header className="app-header">
      <div className="header-inner">
        <div className="logo">FITSENSE</div>
        
        <nav className="nav-icons">
          <GoHome size={22} />
          <IoSearchSharp size={22} />
          <FiCamera size={22} />
          <FaRegHeart size={22} />
          

        </nav>
        <LuMessageCircleMore size={22} style={{ marginRight: '40px', marginBottom: '15px', cursor: 'pointer' }} />
      </div>
    </header>
  );
}