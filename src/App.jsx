import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Discover from "./pages/Discover";
import "./App.css";
import MVP from './pages/MVP';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/Discover" element={<Discover />} />
         <Route path="/" element={<MVP />} />
        {/* Add more pages later here */}
      </Routes>
    </Router>
  );
}

export default App;
