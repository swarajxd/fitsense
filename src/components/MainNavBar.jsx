// src/components/MainNavBar.jsx
"use client";
import React, { useMemo } from "react";
import { Home, Search, MessageCircle, Inbox as InboxIcon, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

// tiny cn helper
function cn(...args) {
  return args.filter(Boolean).join(" ");
}

export default function MainNavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const pathToTab = useMemo(() => {
    if (location.pathname.startsWith("/discover")) return "discover";
    if (location.pathname.startsWith("/ai-chat")) return "ai-chat";
    if (location.pathname.startsWith("/inbox")) return "inbox";
    if (location.pathname.startsWith("/profile")) return "profile";
    return "home";
  }, [location.pathname]);

  const navItems = [
    { id: "home", path: "/", icon: Home, label: "Home" },
    { id: "discover", path: "/discover", icon: Search, label: "Discover" },
    { id: "ai-chat", path: "/ai-chat", icon: MessageCircle, label: "AI Chat" },
    { id: "inbox", path: "/inbox", icon: InboxIcon, label: "Inbox" },
    { id: "profile", path: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-b border-orange-500/20 z-50">
      <div className="flex items-center justify-center py-4 px-6 max-w-4xl mx-auto">
        <div className="flex items-center space-x-6 bg-black/40 backdrop-blur-sm rounded-full px-6 py-2 border border-orange-500/10">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathToTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 group relative",
                  isActive
                    ? "text-orange-500 bg-gradient-to-br from-orange-500/20 to-orange-600/10 shadow-lg shadow-orange-500/20"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  size={20}
                  className={cn("mb-1 transition-transform duration-300", isActive ? "scale-110" : "group-hover:scale-105")}
                />
                <span className={cn("text-xs font-medium tracking-wide", isActive ? "text-orange-400" : "")}>
                  {item.label}
                </span>
                {isActive && <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-orange-500 rounded-full" />}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
