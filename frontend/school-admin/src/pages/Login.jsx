import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";
import { BACKEND_BASE } from "../config.js";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
  e.preventDefault(); // ✅ REQUIRED

  console.log("LOGIN CLICKED");

  try {
    const res = await axios.post(`${BACKEND_BASE}/api/login`, {
      username,
      password,
    });

    console.log("Backend response:", res.data);

    if (res.data.success) {
      const adminData = {
        adminId: res.data.adminId,
        userId: res.data.userId,
        name: res.data.name,
        profileImage: res.data.profileImage,
      };

      localStorage.setItem("admin", JSON.stringify(adminData));

      console.log("Saved admin, navigating now...");

      navigate("/dashboard"); // 👈 MUST TRIGGER
    }
  } catch (err) {
    console.error("Login failed:", err);
  }
};


  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Login</h2>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

       <form onSubmit={handleLogin}>
  <button type="submit">Login</button>
</form>


        {/* <p>
          I don’t have an account? <a href="/register">Register</a>
        </p> */}
      </div>
    </div>
  );
}

export default Login;

