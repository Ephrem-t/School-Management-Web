import React from "react";

export default function PostCard({ post, onEdit, onDelete, isOwner }) {
  const media = post.postUrl || "";

  return (
    <div className="card" style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <strong>{post.adminName || "Admin"}</strong>
          <div className="small-muted">{post.time || ""}</div>
        </div>
        {isOwner && (
          <div style={{display:"flex",gap:8}}>

            <button className="btn secondary" onClick={() => onEdit(post.postId)}>Edit</button>
            <button className="btn" onClick={() => onDelete(post.postId)}>Delete</button>
             <button onClick={() => handleLike(post.postId)}>
    👍 {post.likes ? Object.keys(post.likes).length : 0}
  </button>
          </div>
        )}
      </div>
      <p style={{marginTop:12}}>{post.message}</p>
      {media && (media.match(/\.(jpg|jpeg|png|gif|webp)$/) ? (
        <img className="post-media" src={media} alt="media" />
      ) : media.match(/\.(mp4|webm|ogg)$/) ? (
        <video controls className="post-media" src={media} />
      ) : media.match(/\.(mp3|wav|ogg)$/) ? (
        <audio controls src={media} />
      ) : null)}
    </div>
  );
}
