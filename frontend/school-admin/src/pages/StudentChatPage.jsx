import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

function StudentChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { studentId } = location.state || {};
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");

  const admin = JSON.parse(localStorage.getItem("admin")) || {};

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const studentsRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json");
        const usersRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json");

        const studentsData = studentsRes.data || {};
        const usersData = usersRes.data || {};

        const studentList = Object.keys(studentsData).map(id => {
          const student = studentsData[id];
          const user = usersData[student.userId] || {};
          return {
            studentId: id,
            name: user.name || user.username || "No Name",
            profileImage: user.profileImage || "/default-profile.png",
          };
        });

        setStudents(studentList);

        // Preselect student if navigated with studentId
        if (studentId) {
          const found = studentList.find(s => s.studentId === studentId);
          if (found) setSelectedStudent(found);
        }
      } catch (err) {
        console.error("Error fetching students:", err);
      }
    };

    fetchStudents();
  }, [studentId]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedStudent) return;
      try {
        const res = await axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/StudentMessages.json`);
        const allMessages = res.data || {};
        const chatMessages = Object.values(allMessages).filter(
          m =>
            (m.studentId === selectedStudent.studentId && m.adminId === admin.adminId) ||
            (m.studentId === admin.adminId && m.adminId === selectedStudent.studentId)
        );
        setMessages(chatMessages);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };

    fetchMessages();
  }, [selectedStudent, admin.adminId]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedStudent) return;

    const newMessage = {
      studentId: selectedStudent.studentId,
      adminId: admin.adminId,
      content: messageInput,
      timestamp: new Date().toISOString(),
    };

    try {
      await axios.post(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/StudentMessages.json`, newMessage);
      setMessages(prev => [...prev, newMessage]);
      setMessageInput("");
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f1f4f8" }}>
      {/* LEFT CHAT LIST */}
      <div
        style={{
          width: "280px",
          background: "#fff",
          borderRight: "1px solid #ddd",
          overflowY: "auto",
        }}
      >
        <div style={{ padding: "15px", borderBottom: "1px solid #ddd", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Students</strong>
          <button onClick={() => navigate("/students")} style={{ cursor: "pointer", fontSize: "16px", background: "none", border: "none" }}>
            ← Back
          </button>
        </div>
        {students.map(student => (
          <div
            key={student.studentId}
            onClick={() => setSelectedStudent(student)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px",
              cursor: "pointer",
              background: selectedStudent?.studentId === student.studentId ? "#e0e7ff" : "#fff",
              borderBottom: "1px solid #eee",
            }}
          >
            <img src={student.profileImage} alt={student.name} style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
            <span>{student.name}</span>
          </div>
        ))}
      </div>

      {/* RIGHT CHAT WINDOW */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {selectedStudent ? (
          <>
            <div style={{ padding: "15px", borderBottom: "1px solid #ddd", display: "flex", alignItems: "center", gap: "15px" }}>
              <img src={selectedStudent.profileImage} alt={selectedStudent.name} style={{ width: "50px", height: "50px", borderRadius: "50%" }} />
              <strong>{selectedStudent.name}</strong>
            </div>

            <div style={{ flex: 1, padding: "15px", overflowY: "auto" }}>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    marginBottom: "10px",
                    display: "flex",
                    justifyContent: msg.adminId === admin.adminId ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      background: msg.adminId === admin.adminId ? "#4b6cb7" : "#e0e7ff",
                      color: msg.adminId === admin.adminId ? "#fff" : "#000",
                      padding: "10px 15px",
                      borderRadius: "12px",
                      maxWidth: "70%",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", padding: "15px", gap: "10px", borderTop: "1px solid #ddd" }}>
              <input
                type="text"
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                placeholder="Type a message..."
                style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}
              />
              <button
                onClick={handleSendMessage}
                style={{ background: "#4b6cb7", color: "#fff", padding: "10px 15px", borderRadius: "8px", border: "none", cursor: "pointer" }}
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", color: "#555" }}>
            Select a student to start chatting
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentChatPage;
