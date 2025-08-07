import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Discover from "./pages/Discover";
import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Discover />} />
        {/* Add more pages later here */}
      </Routes>
    </Router>
  );
}

export default App;
