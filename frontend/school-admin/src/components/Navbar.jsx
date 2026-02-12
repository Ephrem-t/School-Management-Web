import React from "react";
import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem("adminId");
    navigate("/login");
  };

  return (
    <div className="header">
      <div className="logo">Gojo Study — Admin</div>
      <div style={{display:"flex",gap:8}}>
        <button className="btn secondary" onClick={() => navigate("/dashboard")}>Dashboard</button>
        <button className="btn" onClick={handleLogout}>Logout</button>
      </div>
    </div>
  );
}
