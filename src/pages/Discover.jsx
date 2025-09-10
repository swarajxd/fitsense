import React, { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";

const SearchBar = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const searchInputRef = useRef(null);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape" && isFocused) {
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFocused]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    // Add your search logic here
    console.log("Searching for:", e.target.value);
  };

  const handleMetricClick = (metric) => {
    console.log("Clicked metric:", metric);
  };

  const metrics = [
    "Average Engagement Time",
    "Active Users Data",
    "New Users From Campaign",
    "Cohort New Prospects",
  ];

  return (
    <div className="search-app">
      <style jsx>{`
        .search-app {
          min-height: 100%;
        
          display: flex;
          align-items:center;
          justify-content: center;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }

      

        /* Search Container Styles */
        .search-container {
          background: #1a1a1a7e;
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 24px;
          padding: 20px 24px;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.08),
            0 2px 16px rgba(0, 0, 0, 0.04),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          position:fixed;
          bottom: 24px;
          width:800px;

          overflow: hidden;
        }

        .search-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent);
  transition: left 0.6s ease;
  pointer-events: none;
}

.search-container:hover::before {
  left: 100%;
}

/* Hover State - darker, not white */
.search-container:hover {
  background: #1a1a1acc; /* slightly more opaque dark */
  border: 1px solid rgba(255, 255, 255, 0.25);
  transform: translate(-50%, -2px) scale(1.01);
  box-shadow: 
    0 16px 64px rgba(0, 0, 0, 0.4),
    0 4px 24px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

/* Focus State - keep dark but highlighted */
.search-container.focused {
  background: #1a1a1af0; /* still dark, just more solid */
  border: 1px solid #d4633a /* blue tint outline */
  transform: translate(-50%, -1px) scale(1.005);
  box-shadow: 
    0 0 0 3px rgba(0, 122, 255, 0.2),
    0 12px 48px rgba(0, 0, 0, 0.35),
    0 3px 16px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

        .search-wrapper {
          display: flex;
          align-items: center;
          gap: 16px;
          position: relative;
          z-index: 2;
        }

        .search-icon {
          color: #8e8e93;
          flex-shrink: 0;
          transition: all 0.3s ease;
        }

        .search-container.focused .search-icon {
          color: #d4633a;
          transform: scale(1.1);
        }

        .search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 17px;
  color: #ffffff;   /* <-- make text visible on dark bg */
  font-weight: 400;
  letter-spacing: -0.01em;
  transition: all 0.3s ease;
}

        .search-input::placeholder {
          color: #8e8e93;
          font-weight: 400;
        }

        .search-input:focus::placeholder {
          color: #c7c7cc;
        }

        .search-shortcuts {
          display: flex;
          align-items: center;
          gap: 6px;
          opacity: 0.6;
          font-size: 14px;
          color: #8e8e93;
          transition: all 0.3s ease;
        }

        .search-container.focused .search-shortcuts {
          opacity: 0.8;
        }

        .shortcut-key {
          background: rgba(142, 142, 147, 0.08);
          border: 1px solid rgba(142, 142, 147, 0.12);
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }

        .shortcut-key:hover {
          background: rgba(142, 142, 147, 0.12);
          transform: scale(1.05);
        }

        /* Metrics Panel Styles */
        .metrics-panel {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 24px;
          padding: 28px;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.08),
            0 2px 16px rgba(0, 0, 0, 0.04),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .metrics-panel::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          transition: left 0.8s ease;
          pointer-events: none;
        }

        .metrics-panel:hover::before {
          left: 100%;
        }

        .metrics-panel:hover {
          background: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.4);
          transform: translateY(-2px) scale(1.005);
          box-shadow: 
            0 16px 64px rgba(0, 0, 0, 0.12),
            0 4px 24px rgba(0, 0, 0, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        .metric-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0;
          border-bottom: 1px solid rgba(142, 142, 147, 0.12);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          border-radius: 12px;
          position: relative;
        }

        .metric-item:last-child {
          border-bottom: none;
        }

        .metric-item:hover {
          background: rgba(0, 122, 255, 0.04);
          padding: 16px 16px;
          transform: translateX(4px);
          backdrop-filter: blur(10px);
        }

        .metric-item:active {
          transform: translateX(4px) scale(0.98);
        }

        .metric-label {
          font-size: 16px;
          color: #1d1d1f;
          font-weight: 500;
          letter-spacing: -0.01em;
          transition: all 0.3s ease;
        }

        .metric-item:hover .metric-label {
          color: #007aff;
        }

        .metric-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          opacity: 0.5;
          transition: all 0.3s ease;
        }

        .metric-item:hover .metric-actions {
          opacity: 0.8;
          transform: translateX(2px);
        }

        .action-dots {
          width: 4px;
          height: 4px;
          background: #8e8e93;
          border-radius: 50%;
          position: relative;
          transition: all 0.3s ease;
        }

        .action-dots::before,
        .action-dots::after {
          content: '';
          position: absolute;
          width: 4px;
          height: 4px;
          background: #8e8e93;
          border-radius: 50%;
          transition: all 0.3s ease;
        }

        .action-dots::before {
          top: -8px;
        }

        .action-dots::after {
          top: 8px;
        }

        .metric-item:hover .action-dots,
        .metric-item:hover .action-dots::before,
        .metric-item:hover .action-dots::after {
          background: #007aff;
        }
        
        .action-arrow {
          width: 0;
          height: 0;
          border-left: 6px solid #8e8e93;
          border-top: 4px solid transparent;
          border-bottom: 4px solid transparent;
          transition: all 0.3s ease;
        }

        .metric-item:hover .action-arrow {
          border-left-color: #007aff;
          transform: translateX(3px);
        }

        /* Responsive Design */
        @media (max-width: 600px) {
          .search-app {
            padding: 16px;
          }
          
          .container {
            max-width: 100%;
          }
          
          .search-container,
          .metrics-panel {
            padding: 18px;
            border-radius: 20px;
          }
          
          .search-shortcuts {
            display: none;
          }

          .search-input {
            font-size: 16px;
          }
        }

        /* Entrance Animations */
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .search-container {
          animation: slideInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .metrics-panel {
          animation: slideInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s forwards;
        }

        /* Ripple Effect */
        .ripple {
          position: absolute;
          border-radius: 50%;
          background: rgba(0, 122, 255, 0.3);
          transform: scale(0);
          animation: ripple 0.6s linear;
          pointer-events: none;
        }

        @keyframes ripple {
          to {
            transform: scale(4);
            opacity: 0;
          }
        
        }
      `}</style>

      {/* Search Bar */}
      <div className={`search-container ${isFocused ? "focused" : ""}`}>
        <div className="search-wrapper">
          <Search size={22} className="search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="What would you like to find today?"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            data-form-type="other"
          />
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
