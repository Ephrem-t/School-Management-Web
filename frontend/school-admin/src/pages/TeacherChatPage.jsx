import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

function TeacherChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const teacherIdFromState = location.state?.teacherId;

  const [teachers, setTeachers] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");

  // ADMIN USER (must contain userId)
  const admin = JSON.parse(localStorage.getItem("admin")) || {};

  const BASE_URL = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";

  // ---------------- FETCH TEACHERS ----------------
  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const teachersRes = await axios.get(`${BASE_URL}/Teachers.json`);
        const usersRes = await axios.get(`${BASE_URL}/Users.json`);

        const teachersData = teachersRes.data || {};
        const usersData = usersRes.data || {};

        const teacherList = Object.keys(teachersData).map((id) => {
          const teacher = teachersData[id];
          const user = usersData[teacher.userId] || {};

          return {
            teacherId: id,
            userId: teacher.userId, // used for chat
            name: user.name || "No Name",
            profileImage: user.profileImage || "/default-profile.png",
          };
        });

        setTeachers(teacherList);
        setRecentChats(teacherList.map((t) => t.teacherId));

        if (teacherIdFromState) {
          const selected = teacherList.find(
            (t) => t.teacherId === teacherIdFromState
          );
          if (selected) setSelectedTeacher(selected);
        }
      } catch (err) {
        console.error("Error fetching teachers:", err);
      }
    };

    fetchTeachers();
  }, [teacherIdFromState]);

  // ---------------- FETCH MESSAGES ----------------
  useEffect(() => {
    if (!selectedTeacher || !admin.userId) return;

    const conversationId = `${admin.userId}_${selectedTeacher.userId}`;

    const fetchMessages = async () => {
      try {
        const res = await axios.get(
          `${BASE_URL}/Chats/${conversationId}/messages.json`
        );

        const data = res.data || {};

        const messageList = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        })).sort((a, b) => a.timeStamp - b.timeStamp);

        setMessages(messageList);
      } catch (err) {
        console.error("Error fetching chat messages:", err);
      }
    };

    fetchMessages();
  }, [selectedTeacher, admin.userId]);

  // ---------------- SEND MESSAGE ----------------
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedTeacher || !admin.userId) return;

    const conversationId = `${admin.userId}_${selectedTeacher.userId}`;

    const newMessage = {
      senderId: admin.userId,
      receiverId: selectedTeacher.userId,
      text: messageInput,
      timeStamp: Date.now(),
    };

    try {
      // Push message to Firebase (will generate unique key)
      const res = await axios.post(
        `${BASE_URL}/Chats/${conversationId}/messages.json`,
        newMessage
      );

      // Add Firebase generated ID to the message locally
      setMessages((prev) => [
        ...prev,
        { id: res.data.name, ...newMessage },
      ]);

      setMessageInput("");
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  // ---------------- UI ----------------
  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif" }}>
      {/* LEFT PANEL */}
      <div
        style={{
          width: "280px",
          borderRight: "1px solid #ddd",
          background: "#fff",
          overflowY: "auto",
        }}
      >
        <h3 style={{ padding: "15px", borderBottom: "1px solid #ddd" }}>
          Chats
        </h3>

        <div style={{ padding: "10px" }}>
          {recentChats.map((id) => {
            const t = teachers.find((x) => x.teacherId === id);
            if (!t) return null;

            return (
              <div
                key={id}
                onClick={() => setSelectedTeacher(t)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "8px",
                  cursor: "pointer",
                  borderRadius: "8px",
                  background:
                    selectedTeacher?.teacherId === id
                      ? "#e0e7ff"
                      : "transparent",
                }}
              >
                <img
                  src={t.profileImage}
                  alt={t.name}
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    marginRight: "10px",
                    objectFit: "cover",
                  }}
                />
                <span>{t.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* HEADER */}
        <div
          style={{
            padding: "15px",
            borderBottom: "1px solid #ddd",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "#fff",
          }}
        >
          <button onClick={() => navigate("/teachers")}>← Back</button>

          {selectedTeacher ? (
            <>
              <img
                src={selectedTeacher.profileImage}
                alt=""
                style={{ width: "40px", height: "40px", borderRadius: "50%" }}
              />
              <strong>{selectedTeacher.name}</strong>
            </>
          ) : (
            <span>Select a teacher</span>
          )}
        </div>

        {/* CHAT BODY */}
        <div
          style={{
            flex: 1,
            padding: "15px",
            overflowY: "auto",
            background: "#f9f9f9",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {messages.map((msg) => {
            const isMe = msg.senderId === admin.userId;

            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: isMe ? "flex-end" : "flex-start",
                  background: isMe ? "#4b6cb7" : "#ddd",
                  color: isMe ? "#fff" : "#000",
                  padding: "10px",
                  borderRadius: "10px",
                  maxWidth: "70%",
                  marginBottom: "8px",
                }}
              >
                {msg.text}
                <div style={{ fontSize: "10px", opacity: 0.7 }}>
                  {new Date(msg.timeStamp).toLocaleTimeString()}
                </div>
              </div>
            );
          })}
        </div>

        {/* INPUT */}
        {selectedTeacher && (
          <div
            style={{
              padding: "15px",
              borderTop: "1px solid #ddd",
              display: "flex",
              gap: "10px",
            }}
          >
            <input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Type a message..."
              style={{ flex: 1, padding: "10px" }}
            />
            <button onClick={handleSendMessage}>Send</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TeacherChatPage;
