import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Navbar from "../components/Navbar.jsx";
import { getAdminProfile, getAllPosts } from "../api.js";
import PostCard from "../components/PostCard.jsx";

export default function Profile(){
  const { adminId } = useParams();
  const [admin, setAdmin] = useState(null);
  const [posts, setPosts] = useState([]);

  useEffect(()=>{
    fetchProfile();
    fetchPosts();
  }, [adminId]);

  async function fetchProfile(){
    try {
      const res = await getAdminProfile(adminId);
      if (res.data?.success) setAdmin(res.data.admin);
      else setAdmin({name:"Admin", username:""});
    } catch(err){
      console.error(err);
    }
  }

  async function fetchPosts(){
    try {
      const res = await getAllPosts();
      const all = res.data || [];
      setPosts(all.filter(p => p.adminId === adminId));
    } catch(err){
      console.error(err);
    }
  }

  if (!admin) return <div className="container"><div className="card">Loading profile…</div></div>;

  return (
    <div className="container">
      <div className="card"><Navbar /></div>
      <div className="app-layout" style={{marginTop:16}}>
        <Sidebar adminId={adminId} />
        <div style={{flex:1}}>
          <div className="card">
            <h2>{admin.name}</h2>
            <p className="small-muted">@{admin.username}</p>
            {admin.profileImage && <img src={admin.profileImage} width={140} style={{borderRadius:10, marginTop:8}} alt="profile" />}
          </div>

          <div style={{marginTop:12}}>
            <h3>Your Posts</h3>
            {posts.length === 0 && <div className="card small-muted">No posts yet</div>}
            {posts.map(p => <PostCard key={p.postId} post={p} isOwner={p.adminId === adminId} />)}
          </div>
        </div>
      </div>
    </div>


    
  );


  
}
