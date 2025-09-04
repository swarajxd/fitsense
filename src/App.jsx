// App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Discover from "./pages/Discover";
import "./App.css";
import MVP from "./pages/MVP";
import LoginPage from "./pages/Login.jsx";
import Profile from "./pages/profile.jsx";
import SignupPage from "./pages/Signup.jsx";

// Clerk imports
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";

function App() {
  return (
    <Router>
      

      {/* Routes */}
      <Routes>
        <Route path="/Discover" element={<Discover />} />
        <Route path="/Login" element={<LoginPage />} />
        <Route path="/Profile" element={<Profile />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/" element={<MVP />} />
      </Routes>
    </Router>
  );
}

export default App;
