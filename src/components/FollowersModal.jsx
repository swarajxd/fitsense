// src/components/FollowersModal.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "./FollowersModal.css";

export default function FollowersModal({
  open,
  title = "Users",
  users = [],
  loading = false,
  onClose = () => {},
  onToggleFollow = () => {},
  currentUserId = null,
}) {
  const navigate = useNavigate();

  if (!open) return null;

  return (
    <div className="fm-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fm-card">
        <header className="fm-header">
          <h3 className="fm-title">{title}</h3>
          <button className="fm-close" aria-label="Close" onClick={onClose}>✕</button>
        </header>

        <div className="fm-body">
          {loading ? (
            <div className="fm-loading">Loading…</div>
          ) : users.length === 0 ? (
            <div className="fm-empty">No users to show.</div>
          ) : (
            <ul className="fm-list">
              {users.map(u => (
                <li key={u.user_id || u.id || u.profile_id} className="fm-item">
                  <button
                    type="button"
                    className="fm-user"
                    onClick={() => navigate(`/profile/${encodeURIComponent(u.user_id ?? u.id ?? u.profile_id)}`)}
                  >
                    <img
                      src={u.avatar || u.profilePic || u.avatar_url || "/path/to/fallback.jpg"}
                      alt={u.username || u.name || "user avatar"}
                      className="fm-avatar"
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/path/to/fallback.jpg"; }}
                    />
                    <div className="fm-meta">
                      <div className="fm-username">{u.username || u.name || u.display_name || (u.user_id ? String(u.user_id).slice(0,8) : "user")}</div>
                      {u.bio ? <div className="fm-bio">{u.bio}</div> : null}
                    </div>
                  </button>

                  <div className="fm-actions">
                    {/* Don't offer follow button for self and if onToggleFollow isn't provided */}
                    {currentUserId && String(currentUserId) !== String(u.user_id || u.id || u.profile_id) && typeof onToggleFollow === "function" && (
                      <button
                        className={`fm-follow-btn ${u.isFollowing ? "following" : ""}`}
                        onClick={async (e) => {
                          e.stopPropagation();
                          await onToggleFollow(u);
                        }}
                      >
                        {u.isFollowing ? "Unfollow" : "Follow"}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
