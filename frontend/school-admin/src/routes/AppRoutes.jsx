import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "../pages/Login";

import Dashboard from "../pages/Dashboard";
import MyPosts from "../pages/MyPosts";
import Teachers from "../pages/Teachers";
import Students from "../pages/Students";
import Parents from "../pages/Parents";
import SettingsPage from "../pages/SettingsPage";
import AllChat from "../pages/AllChat";
import StudentChatPage from "../pages/StudentChatPage";
import SchedulePage from "../pages/SchedulePage"; // ✅ NEW
import RegistrationForm from "../pages/RegistrationForm"; // NEW
import TeacherRegister from "../pages/TeacherRegister"; // NEW
import StudentRegister from "../pages/StudentRegister"; // NEW
import ParentRegister from "../pages/ParentRegister"; // NEW
import Register from "../pages/Register"; // NEW
export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        {/* Auth */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        

        {/* Admin Pages */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/my-posts" element={<MyPosts />} />
        <Route path="/teachers" element={<Teachers />} />
        <Route path="/students" element={<Students />} />
        <Route path="/parents" element={<Parents />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* Schedule */}
        <Route path="/schedule" element={<SchedulePage />} /> {/* ✅ */}

        {/* Chat */}
        <Route path="/all-chat" element={<AllChat />} />
        <Route path="/student-chat" element={<StudentChatPage />} />
        <Route path="/registration-form" element={<RegistrationForm />} /> {/* NEW */}
        <Route path="/teacher-register" element={<TeacherRegister />} /> {/* NEW */}
        <Route path="/student-register" element={<StudentRegister />} /> {/* NEW */}
        <Route path="/parent-register" element={<ParentRegister />} /> {/* NEW */}
         <Route path="/register" element={<Register />} /> {/* NEW */}
      </Routes>
    </Router>
  );
}
