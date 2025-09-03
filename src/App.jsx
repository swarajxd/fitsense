import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Discover from "./pages/Discover";
import "./App.css";
import MVP from './pages/MVP';
import LoginPage from './pages/Login.jsx';
import Profile from './pages/profile.jsx';
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/Discover" element={<Discover />} />
        <Route path="/Login" element={<LoginPage />} />
        <Route path="/Profile" element={<Profile />} />
         <Route path="/" element={<MVP />} />
        {/* Add more pages later here */}
      </Routes>
    </Router>
  );
}

export default App;
