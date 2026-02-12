import React from "react";
import { Link } from "react-router-dom";

const Sidebar = () => {
  return (
    <div className="w-64 bg-white shadow flex flex-col p-4">
      <Link to="/dashboard" className="mb-2 hover:text-blue-500">Dashboard</Link>
      <Link to="/profile" className="mb-2 hover:text-blue-500">Profile</Link>
    </div>
  );
};

export default Sidebar;
