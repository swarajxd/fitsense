// inside SavedPosts.jsx (full map/render replacement)
export default function SavedPosts({ postImages = [], masonryRef = null }) {
  // show a handful of saved tiles (repeat images if needed)
  const count = 16;

  // create a reordered array: rotate + step to avoid exact same sequence as Posts
  const reordered = [];
  for (let i = 0; i < count; i++) {
    // pick item by stepping through source with a prime step to vary order
    const idx = (i * 3 + 1) % postImages.length; // step 3 prevents simple repeating sequences
    const srcObj = postImages[idx % postImages.length];
    // if postImages contains strings, normalize to object
    const src = typeof srcObj === "string" ? { src: srcObj, caption: `Saved ${i + 1}`, creator: "saved", creatorUsername: "saved" } : srcObj;
    reordered.push({ ...src, caption: src.caption || `Saved ${i + 1}` });
  }

  return (
    <div className="saved-wrap">
      <section
        className="fs-gallery saved-gallery"
        aria-label="Saved posts"
        ref={masonryRef}
      >
        {reordered.map((p, idx) => (
          <div key={idx} className="fs-gallery-item masonry-item">
            <img
              src={p.src}
              alt={p.caption}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src =
                  "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%23222222'/%3E%3C/text%3E%3C/svg%3E";
              }}
              style={{ width: "100%", display: "block" }}
            />

            {/* Use same overlay structure as posts (creator + avatar + caption + follow pill) */}
            <div className="fs-post-overlay">
              <div className="fs-post-overlay-content">
                <div className="fs-post-header">
                  <div className="fs-post-creator">
                    <div className="fs-post-creator-avatar">
                      {/* reuse profile pic or a small placeholder */}
                      <img src={p.creatorAvatar || "/assets/profilepic.jpg"} alt={p.creator} />
                    </div>
                    <div className="fs-post-creator-info">
                      <div className="fs-post-creator-name">{p.creator}</div>
                      <div className="fs-post-creator-username">@{p.creatorUsername}</div>
                    </div>
                    <div className="fs-post-verified">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="fs-post-caption">{p.caption}</div>

                <div className="fs-post-actions">
                  <button className="fs-post-btn fs-post-btn-follow">Follow +</button>
                  <button className="fs-post-btn fs-post-btn-ghost">Share</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );

}

