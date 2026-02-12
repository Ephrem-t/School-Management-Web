import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, 
  FaSignOutAlt, FaBell, FaFacebookMessenger, FaSearch, FaCalendarAlt, FaCommentDots, FaCheck, FaPaperPlane
} from "react-icons/fa";
import axios from "axios";
import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";
import { useMemo } from "react";
import { getDatabase, ref, onValue, push, update } from "firebase/database";
import { getFirestore, collection, getDocs } from "firebase/firestore";

import app, { db } from "../firebase"; // Adjust the path if needed
import { BACKEND_BASE } from "../config.js";


function StudentsPage() {
  const API_BASE = `${BACKEND_BASE}/api`;
  // ------------------ STATES ------------------
  const [students, setStudents] = useState([]); // List of all students
  const [selectedGrade, setSelectedGrade] = useState("All"); // Grade filter
  const [selectedSection, setSelectedSection] = useState("All"); // Section filter
  const [searchTerm, setSearchTerm] = useState("");
  const [sections, setSections] = useState([]); // Sections available for selected grade
  const [selectedStudent, setSelectedStudent] = useState(null); // Currently selected student
  const [studentChatOpen, setStudentChatOpen] = useState(false); // Toggle chat popup
  const [popupMessages, setPopupMessages] = useState([]); // Messages for chat popup
  const messagesEndRef = useRef(null);
  const [popupInput, setPopupInput] = useState(""); // Input for chat message
  const [details, setDetails] = useState(null);
  const [performance, setPerformance] = useState([]);
  const [studentTab, setStudentTab] = useState("details");
  const [attendance, setAttendance] = useState([]);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [unreadMap, setUnreadMap] = useState({});
  const navigate = useNavigate();
  const admin = JSON.parse(localStorage.getItem("admin")) || {}; // Admin info from localStorage
// Place before return (

  const [studentMarks, setStudentMarks] = useState({});
  const studentMarksFlattened = useMemo(() => {
    // Ensure we always provide an object for the UI to iterate over.
    return studentMarks || {};
  }, [studentMarks]);
  const [attendanceView, setAttendanceView] = useState("daily");
  const [attendanceCourseFilter, setAttendanceCourseFilter] = useState("All");
  const [expandedCards, setExpandedCards] = useState({});
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false); // Right sidebar toggle
  const [teachers, setTeachers] = useState([]);
  const [unreadTeachers, setUnreadTeachers] = useState({});
  const [unreadSenders, setUnreadSenders] = useState({}); 
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  const [postNotifications, setPostNotifications] = useState([]);
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const [newMessageText, setNewMessageText] = useState("");
  const [lastMessages, setLastMessages] = useState({});
  // At the top of your StudentsPage component
  const [expandedSubjects, setExpandedSubjects] = useState([]); 

  // Semester selection for performance tab
  const [activeSemester, setActiveSemester] = useState("semester2");

  const adminId = admin.userId;
  const adminUserId = admin.userId;

  const [isPortrait, setIsPortrait] = useState(typeof window !== "undefined" ? window.innerWidth < window.innerHeight : false);
  const [isNarrow, setIsNarrow] = useState(typeof window !== "undefined" ? window.innerWidth < 900 : false);

  const dbRT = getDatabase(app);

  const getChatKey = (userA, userB) => {
    return [userA, userB].sort().join("_");
  };

  // Small helpers used in chat UI
  const formatDateLabel = (ts) => {
    if (!ts) return "";
    try { return new Date(ts).toLocaleDateString(); } catch { return ""; }
  };
  const formatTime = (ts) => {
    if (!ts) return "";
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ""; }
  };

const fetchPostNotifications = async () => {
  if (!adminId) return;

  try {
    // 1️⃣ Get post notifications
    const res = await axios.get(`${API_BASE}/get_post_notifications/${adminId}`);

    let notifications = Array.isArray(res.data)
      ? res.data
      : Object.values(res.data || {});

    if (notifications.length === 0) {
      setPostNotifications([]);
      return;
    }

    // 2️⃣ Fetch Users & School_Admins
    const [usersRes, adminsRes] = await Promise.all([
      axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"
      ),
      axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/School_Admins.json"
      ),
    ]);

    const users = usersRes.data || {};
    const admins = adminsRes.data || {};

    // 3️⃣ Helpers
    const findAdminUser = (adminId) => {
      const admin = admins[adminId];
      if (!admin) return null;

      return Object.values(users).find(
        (u) => u.userId === admin.userId
      );
    };

    // 4️⃣ Enrich notifications
    const enriched = notifications.map((n) => {
      const posterUser = findAdminUser(n.adminId);

      return {
        ...n,
        notificationId:
          n.notificationId ||
          n.id ||
          `${n.postId}_${n.adminId}`,

        adminName: posterUser?.name || "Unknown Admin",
        adminProfile:
          posterUser?.profileImage || "/default-profile.png",
      };
    });

    setPostNotifications(enriched);
  } catch (err) {
    console.error("Post notification fetch failed", err);
    setPostNotifications([]);
  }
};


  useEffect(() => {
    if (!adminId) return;

    fetchPostNotifications();
    const interval = setInterval(fetchPostNotifications, 5000);

    return () => clearInterval(interval);
  }, [adminId]);

const handleNotificationClick = async (notification) => {
  try {
    await axios.post(`${API_BASE}/mark_post_notification_read`, {
      notificationId: notification.notificationId,
      adminId: admin.userId,
    });
  } catch (err) {
    console.warn("Failed to delete notification:", err);
  }

  // 🔥 REMOVE FROM UI IMMEDIATELY
  setPostNotifications((prev) =>
    prev.filter((n) => n.notificationId !== notification.notificationId)
  );

  setShowPostDropdown(false);

  // ➜ Navigate to post
  navigate("/dashboard", {
    state: { postId: notification.postId },
  });
};
useEffect(() => {
  if (location.state?.postId) {
    setPostNotifications([]);
  }
}, []);

  const handleSendMessage = () => {
    // now newMessageText is defined
    console.log("Sending message:", newMessageText);
    // your code to send the message
  };

  useEffect(() => {
    const closeDropdown = (e) => {
      if (
        !e.target.closest(".icon-circle") &&
        !e.target.closest(".notification-dropdown")
      ) {
        setShowPostDropdown(false);
      }
    };

    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  useEffect(() => {
    const fetchStudents = async () => {
      const querySnapshot = await getDocs(collection(db, "students"));
      const studentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(studentsData);
    };

    fetchStudents();
  }, []);

  const handleClick = () => {
    navigate("/all-chat"); // replace with your target route
  };

  useEffect(() => {
    // Replace with your actual API call
    const fetchUnreadSenders = async () => {
      const response = await fetch("/api/unreadSenders");
      const data = await response.json();
      setUnreadSenders(data);
    };
    fetchUnreadSenders();
  }, []);

  const handleSelectStudent = async (s) => {
    setLoading(true);
    try {
      // 1️⃣ Fetch user info
      const userRes = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users/${s.userId}.json`
      );
      const user = userRes.data || {};

      // 2️⃣ Fetch ClassMarks from Firebase
      const marksRes = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/ClassMarks.json`
      );
      const classMarks = marksRes.data || {};

      const studentMarksObj = {};
      const courseTeacherMap = {};

      // Loop through all courses
      Object.entries(classMarks).forEach(([courseId, studentsObj]) => {
        // There are two common ways to key student records under a course:
        // 1) by the Students node key (student_123) -> that's stored in s.studentId
        // 2) by a nested object where student objects might include userId properties
        // We'll prefer matching by s.studentId (the RTDB Students key).
        const studentMark =
          studentsObj?.[s.studentId] ||
          // fallback: try to find a student object whose userId matches s.userId
          Object.values(studentsObj || {}).find(
            (st) => st && (st.userId === s.userId || st.studentId === s.studentId)
          );

        if (studentMark) {
          studentMarksObj[courseId] = studentMark;
          courseTeacherMap[courseId] = studentMark.teacherName || "Teacher";
        }
      });

      // 3️⃣ Fetch Attendance (optional)
      const attendanceRes = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Attendance.json`
      );
      const attendanceRaw = attendanceRes.data || {};

      const attendanceData = [];
      Object.entries(attendanceRaw).forEach(([courseId, datesObj]) => {
        Object.entries(datesObj || {}).forEach(([date, studentsObj]) => {
          const status = studentsObj?.[s.studentId];
          if (status) {
            attendanceData.push({
              courseId,
              date,
              status,
              teacherName: courseTeacherMap[courseId] || "Teacher",
            });
          }
        });
      });

      // 4️⃣ Fetch student RTDB record (to read parents / dob if available)
      let rtStudent = {};
      try {
        if (s.studentId) {
          const rtRes = await axios.get(
            `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students/${s.studentId}.json`
          );
          rtStudent = rtRes.data || {};
        }
      } catch (err) {
        // ignore
        rtStudent = {};
      }

      // compute age from DOB (check user.dob, rtStudent.dob, or s.dob)
      const dobRaw = user?.dob || rtStudent?.dob || s?.dob;
      const computeAge = (dob) => {
        if (!dob) return null;
        try {
          const birth = new Date(dob);
          const now = new Date();
          let age = now.getFullYear() - birth.getFullYear();
          const m = now.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
          return age;
        } catch (e) {
          return null;
        }
      };

      const age = computeAge(dobRaw);

      // 5️⃣ Resolve parents: collect first parent name & phone and all parents list
      const parentsList = [];
      let parentName = null;
      let parentPhone = null;
      try {
        const parentIds = rtStudent?.parents ? Object.keys(rtStudent.parents) : (s.parents ? Object.keys(s.parents) : []);
        for (const pid of parentIds) {
          try {
            const pRes = await axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Parents/${pid}.json`);
            const parentNode = pRes.data || {};
            const parentUserId = parentNode.userId;
            if (parentUserId) {
              const uRes = await axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users/${parentUserId}.json`);
              const parentUser = uRes.data || {};
              const pInfo = { parentId: pid, name: parentUser.name || parentNode.name || "Parent", phone: parentUser.phone || parentUser.phoneNumber || parentNode.phone || null };
              parentsList.push(pInfo);
              if (!parentName) parentName = pInfo.name;
              if (!parentPhone) parentPhone = pInfo.phone;
            }
          } catch (e) {
            // ignore per-parent errors
          }
        }
      } catch (e) {
        // ignore
      }
      // 6️⃣ Set selected student state (include age & parent info)
      setSelectedStudent({
        ...s,
        ...user,
        marks: studentMarksObj,
        attendance: attendanceData,
        age: age,
        parents: parentsList,
        parentName: parentName,
        parentPhone: parentPhone,
      });


   setRightSidebarOpen(true);
    } catch (err) {
      console.error("Error fetching student data:", err);
    } finally {
      setLoading(false);
    }
  };

 // New: close the right sidebar (keeps selectedStudent in state so it can be reopened)
  const closeRightSidebar = () => {
    setRightSidebarOpen(false);
  };

  // Optional: function to toggle sidebar (can be used by a "Show sidebar" button)
  const openRightSidebar = () => {
    if (selectedStudent) setRightSidebarOpen(true);
  };

  // close dropdowns outside click - unchanged logic retained
  useEffect(() => {
    const closeDropdown = (e) => {
      if (!e.target.closest(".icon-circle") && !e.target.closest(".messenger-dropdown")) {
        setShowMessageDropdown(false);
      }
      if (!e.target.closest(".icon-circle") && !e.target.closest(".notification-dropdown")) {
        setShowPostDropdown(false);
      }
    };
    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);



  useEffect(() => {
    const fetchTeachersAndUnread = async () => {
      try {
        const [teachersRes, usersRes] = await Promise.all([
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json")
        ]);

        const teachersData = teachersRes.data || {};
        const usersData = usersRes.data || {};

        const teacherList = Object.keys(teachersData).map(tid => {
          const teacher = teachersData[tid];
          const user = usersData[teacher.userId] || {};
          return {
            teacherId: tid,
            userId: teacher.userId,
            name: user.name || "No Name",
            profileImage: user.profileImage || "/default-profile.png"
          };
        });

        setTeachers(teacherList);

        // fetch unread messages
        const unread = {};
        const allMessages = [];

        for (const t of teacherList) {
          const chatKey = `${t.userId}_${adminUserId}`;
          const res = await axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`);
          const msgs = Object.values(res.data || {}).map(m => ({
            ...m,
            sender: m.senderId === adminUserId ? "admin" : "teacher"
          }));
          allMessages.push(...msgs);

          const unreadCount = msgs.filter(m => m.receiverId === adminUserId && !m.seen).length;
          if (unreadCount > 0) unread[t.userId] = unreadCount;
        }

        setPopupMessages(allMessages);
        setUnreadTeachers(unread);

      } catch (err) {
        console.error(err);
      }
    };

    fetchTeachersAndUnread();
  }, [adminUserId]);

  // ------------------ FETCH STUDENTS ------------------
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const studentsRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json");
        const usersRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json");

        const studentsData = studentsRes.data || {};
        const usersData = usersRes.data || {};

        const studentList = Object.keys(studentsData).map((id) => {
          const student = studentsData[id];
          const user = usersData[student.userId] || {};
          return {
            studentId: id,
            userId: student.userId,
            name: user.name || user.username || "No Name",
            profileImage: user.profileImage || "/default-profile.png",
            grade: student.grade,
            section: student.section,
            email: user.email || ""
          };
        });

        setStudents(studentList);
      } catch (err) {
        console.error("Error fetching students:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  // ------------------ UPDATE SECTIONS WHEN GRADE CHANGES ------------------
  useEffect(() => {
    if (selectedGrade === "All") {
      setSections([]);
    } else {
      const gradeSections = [...new Set(students.filter(s => s.grade === selectedGrade).map(s => s.section))];
      setSections(gradeSections);
      setSelectedSection("All");
    }
  }, [selectedGrade, students]);

  // ------------------ FILTER STUDENTS ------------------
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredStudents = students.filter((s) => {
    if (selectedGrade !== "All" && s.grade !== selectedGrade) return false;
    if (selectedSection !== "All" && s.section !== selectedSection) return false;

    if (!normalizedSearch) return true;

    const haystack = [s.name, s.studentId, s.userId, s.email, s.grade, s.section]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });


  // ---------------- FETCH PERFORMANCE ----------------
  // This effect reads ClassMarks and stores only the entries for the selected student.
  useEffect(() => {
    if (!selectedStudent?.studentId) {
      setStudentMarks({});
      return;
    }

    let cancelled = false;

    async function fetchMarks() {
      setLoading(true);
      try {
        const res = await axios.get(
          "https://ethiostore-17d9f-default-rtdb.firebaseio.com/ClassMarks.json"
        );

        const marksObj = {};
        Object.entries(res.data || {}).forEach(([courseId, students]) => {
          // Try direct key
          if (students?.[selectedStudent.studentId]) {
            marksObj[courseId] = students[selectedStudent.studentId];
            return;
          }

          // Fallback: try to find by userId inside student nodes
          const found = Object.values(students || {}).find(s => s && (s.userId === selectedStudent.userId || s.studentId === selectedStudent.studentId));
          if (found) marksObj[courseId] = found;
        });

        if (!cancelled) {
          setStudentMarks(marksObj);
        }
      } catch (err) {
        console.error("Marks fetch error:", err);
        if (!cancelled) setStudentMarks({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMarks();

    return () => {
      cancelled = true;
    };
  }, [selectedStudent]);


  //-------------------------Fetch unread status for each student--------------
  useEffect(() => {
    const fetchUnread = async () => {
      const map = {};

      for (const s of students) {
        const key = `${s.studentId}_${admin.userId}`;

        const res = await axios.get(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key}/messages.json`
        );

        const msgs = res.data || {};
        map[s.studentId] = Object.values(msgs).some(
          m => m.senderId === s.studentId && m.seenByAdmin === false
        );

      }

      setUnreadMap(map);
    };

    if (students.length > 0) fetchUnread();
  }, [students]);

  // ---------------- FETCH CHAT MESSAGES ----------------
  useEffect(() => {
    if (!studentChatOpen || !selectedStudent) return;

    const chatKey = getChatKey(selectedStudent.userId, adminUserId);

    const fetchMessages = async () => {
      try {
        const res = await axios.get(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`
        );

        const msgs = Object.values(res.data || {}).map(m => ({
          ...m,
          sender: m.senderId === adminUserId ? "admin" : "student"
        })).sort((a, b) => a.timeStamp - b.timeStamp);

        setPopupMessages(msgs);
      } catch (err) {
        console.error(err);
      }
    };

    fetchMessages();
  }, [studentChatOpen, selectedStudent, adminUserId]);

  // ---------------- SEND MESSAGE ----------------
  const sendPopupMessage = async () => {
    if (!popupInput.trim() || !selectedStudent) return;

    const newMessage = {
      senderId: adminUserId,
      receiverId: selectedStudent.userId,
      text: popupInput,
      timeStamp: Date.now(),
      seen: false
    };

    try {
      const chatKey = `${selectedStudent.userId}_${adminUserId}`;
      // 1) push message
      const pushRes = await axios.post(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`,
        {
          senderId: newMessage.senderId,
          receiverId: newMessage.receiverId,
          type: newMessage.type || "text",
          text: newMessage.text || "",
          imageUrl: newMessage.imageUrl || null,
          replyTo: newMessage.replyTo || null,
          seen: false,
          edited: false,
          deleted: false,
          timeStamp: newMessage.timeStamp
        }
      );

      const generatedId = pushRes.data && pushRes.data.name;

      // 2) update lastMessage + participants
      const lastMessage = {
        text: newMessage.text,
        senderId: newMessage.senderId,
        seen: false,
        timeStamp: newMessage.timeStamp,
      };

      await axios.patch(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}.json`,
        {
          participants: {
            ...(/* keep existing participants if any */ {}),
            [adminUserId]: true,
            [selectedStudent.userId]: true,
          },
          lastMessage,
        }
      );

      // 3) increment unread for receiver
      try {
        const unreadRes = await axios.get(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/unread.json`
        );
        const unread = unreadRes.data || {};
        const prev = Number(unread[selectedStudent.userId] || 0);
        const updated = { ...(unread || {}), [selectedStudent.userId]: prev + 1, [adminUserId]: Number(unread[adminUserId] || 0) };
        await axios.put(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/unread.json`,
          updated
        );
      } catch (uErr) {
        await axios.put(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/unread.json`,
          { [selectedStudent.userId]: 1, [adminUserId]: 0 }
        );
      }

      // 4) update UI
      setPopupMessages(prev => [...prev, { messageId: generatedId || `${Date.now()}`, ...newMessage, sender: "admin" }]);
      setPopupInput("");
    } catch (err) {
      console.error(err);
    }
  };

  // General sendMessage used by the inline chat input (uses `newMessageText`)
  const sendMessage = async () => {
    if (!newMessageText.trim() || !selectedStudent) return;

    const newMessage = {
      senderId: adminUserId,
      receiverId: selectedStudent.userId,
      text: newMessageText,
      timeStamp: Date.now(),
      seen: false,
    };

    try {
      const chatKey = getChatKey(selectedStudent.userId, adminUserId);

      // push message with full schema
      try {
        const pushRes = await axios.post(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`,
          {
            senderId: newMessage.senderId,
            receiverId: newMessage.receiverId,
            type: newMessage.type || "text",
            text: newMessage.text || "",
            imageUrl: null,
            replyTo: null,
            seen: false,
            edited: false,
            deleted: false,
            timeStamp: newMessage.timeStamp,
          }
        );

        const generatedId = pushRes.data && pushRes.data.name;

        // patch lastMessage + participants
        const lastMessage = { text: newMessage.text, senderId: newMessage.senderId, seen: false, timeStamp: newMessage.timeStamp };
        await axios.patch(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}.json`,
          {
            participants: { [adminUserId]: true, [selectedStudent.userId]: true },
            lastMessage,
          }
        );

        // update unread
        try {
          const unreadRes = await axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/unread.json`);
          const unread = unreadRes.data || {};
          const prev = Number(unread[selectedStudent.userId] || 0);
          const updated = { ...(unread || {}), [selectedStudent.userId]: prev + 1, [adminUserId]: Number(unread[adminUserId] || 0) };
          await axios.put(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/unread.json`, updated);
        } catch (uErr) {
          await axios.put(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/unread.json`, { [selectedStudent.userId]: 1, [adminUserId]: 0 });
        }

        setPopupMessages(prev => [...prev, { messageId: generatedId || `${Date.now()}`, ...newMessage, sender: 'admin' }]);
        setNewMessageText("");
      } catch (err) {
        console.error("Failed to send message:", err);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // ---------------- FETCH UNREAD MESSAGES ----------------
  const fetchUnreadMessages = async () => {
    if (!admin.userId) return;

    const senders = {};

    try {
      // 1️⃣ USERS (names & images)
      const usersRes = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"
      );
      const usersData = usersRes.data || {};

      const findUserByUserId = (userId) => {
        return Object.values(usersData).find(u => u.userId === userId);
      };

      // helper to read messages from BOTH chat keys
      const getUnreadCount = async (userId) => {
        const key1 = `${admin.userId}_${userId}`;
        const key2 = `${userId}_${admin.userId}`;

        const [r1, r2] = await Promise.all([
          axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key1}/messages.json`),
          axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key2}/messages.json`)
        ]);

        const msgs = [
          ...Object.values(r1.data || {}),
          ...Object.values(r2.data || {})
        ];

        return msgs.filter(
          m => m.receiverId === admin.userId && !m.seen
        ).length;
      };

      // 2️⃣ TEACHERS
      const teachersRes = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"
      );

      for (const k in teachersRes.data || {}) {
        const t = teachersRes.data[k];
        const unread = await getUnreadCount(t.userId);

        if (unread > 0) {
         const user = findUserByUserId(t.userId);

        senders[t.userId] = {
          type: "teacher",
          name: user?.name || "Teacher",
          profileImage: user?.profileImage || "/default-profile.png",
          count: unread
        };
        }
      }

      // 3️⃣ STUDENTS
      const studentsRes = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json"
      );

      for (const k in studentsRes.data || {}) {
        const s = studentsRes.data[k];
        const unread = await getUnreadCount(s.userId);

        if (unread > 0) {
          const user = findUserByUserId(s.userId);

        senders[s.userId] = {
          type: "student",
          name: user?.name || s.name || "Student",
          profileImage: user?.profileImage || s.profileImage || "/default-profile.png",
          count: unread
        };

        }
      }

      // 4️⃣ PARENTS
      const parentsRes = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Parents.json"
      );

      for (const k in parentsRes.data || {}) {
        const p = parentsRes.data[k];
        const unread = await getUnreadCount(p.userId);

        if (unread > 0) {
         const user = findUserByUserId(p.userId);

        senders[p.userId] = {
          type: "parent",
          name: user?.name || p.name || "Parent",
          profileImage: user?.profileImage || p.profileImage || "/default-profile.png",
          count: unread
        };

        }
      }

      setUnreadSenders(senders);
    } catch (err) {
      console.error("Unread fetch failed:", err);
    }
  };

  // ---------------- CLOSE DROPDOWN ON OUTSIDE CLICK ----------------
  useEffect(() => {
    const closeDropdown = (e) => {
      if (
        !e.target.closest(".icon-circle") &&
        !e.target.closest(".messenger-dropdown")
      ) {
        setShowMessageDropdown(false);
      }
    };

    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  useEffect(() => {
    if (!admin.userId) return;

    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 5000);

    return () => clearInterval(interval);
  }, [admin.userId]);

  useEffect(() => {
    const onResize = () => {
      setIsPortrait(window.innerWidth < window.innerHeight);
      setIsNarrow(window.innerWidth < 900);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ---------------- MARK MESSAGES AS SEEN ----------------
  useEffect(() => {
    if (!studentChatOpen || !selectedStudent) return;

    const chatKey = getChatKey(selectedStudent.userId, adminUserId);
    const messagesRef = ref(dbRT, `Chats/${chatKey}/messages`);

    const handleSnapshot = async (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.entries(data)
        .map(([id, msg]) => ({ messageId: id, ...msg }))
        .sort((a, b) => a.timeStamp - b.timeStamp);
      setPopupMessages(list);

      // mark any unseen messages addressed to admin as seen
      const updates = {};
      Object.entries(data).forEach(([msgId, msg]) => {
        if (msg && msg.receiverId === adminUserId && !msg.seen) {
          updates[`Chats/${chatKey}/messages/${msgId}/seen`] = true;
        }
      });

      if (Object.keys(updates).length > 0) {
        try {
          await axios.patch(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/.json`, updates);
          // reset unread and mark lastMessage seen at chat root
          axios.patch(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}.json`, { unread: { [adminUserId]: 0 }, lastMessage: { seen: true } }).catch(() => {});
        } catch (err) {
          console.error('Failed to patch seen updates:', err);
        }
      }
    };

    const unsubscribe = onValue(messagesRef, handleSnapshot);
    return () => unsubscribe();
  }, [studentChatOpen, selectedStudent, adminUserId]);

  const attendanceStats = useMemo(() => {
    if (!selectedStudent?.attendance) return null;

    const total = selectedStudent.attendance.length;
    const present = selectedStudent.attendance.filter(a => a.status === "present").length;
    const absent = total - present;
    const percent = total ? Math.round((present / total) * 100) : 0;

    // Consecutive absences
    let streak = 0;
    [...selectedStudent.attendance]
      .sort((a, b) => b.date.localeCompare(a.date))
      .some(a => {
        if (a.status === "absent") {
          streak++;
          return false;
        }
        return true;
      });

    return { total, present, absent, percent, streak };
  }, [selectedStudent]);

  const markMessagesAsSeen = async (userId) => {
    const key1 = `${admin.userId}_${userId}`;
    const key2 = `${userId}_${admin.userId}`;

    const [r1, r2] = await Promise.all([
      axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key1}/messages.json`),
      axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key2}/messages.json`)
    ]);

    const updates = {};

    const collectUpdates = (data, basePath) => {
      Object.entries(data || {}).forEach(([msgId, msg]) => {
        if (msg.receiverId === admin.userId && !msg.seen) {
          updates[`${basePath}/${msgId}/seen`] = true;
        }
      });
    };

    collectUpdates(r1.data, `Chats/${key1}/messages`);
    collectUpdates(r2.data, `Chats/${key2}/messages`);

    if (Object.keys(updates).length > 0) {
      await axios.patch(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/.json",
        updates
      );
    }
  };

  const attendanceData = React.useMemo(() => {
    if (!selectedStudent?.attendance) return [];

    return selectedStudent.attendance.map(a => ({
      date: a.date || a.created_at,
      courseId: a.courseId || a.course || "Unknown Course",
      teacherName: a.teacherName || a.teacher || "Unknown Teacher",
      status: a.status || a.attendance_status || "absent"
    }));
  }, [selectedStudent]);

  const groupedAttendance = React.useMemo(() => {
    if (!attendanceData.length) return {};

    return attendanceData.reduce((acc, record) => {
      const dateKey = new Date(record.date).toLocaleDateString();

      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(record);

      return acc;
    }, {});
  }, [attendanceData]);


  const toggleExpand = (key) => {
    setExpandedCards((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getProgress = (records) => {
    if (!records || !records.length) return 0;
    const presentCount = records.filter(
      (r) => r.status === "present" || r.status === "late"
    ).length;
    return Math.round((presentCount / records.length) * 100);
  };

  const attendanceBySubject = attendanceData.reduce((acc, cur) => {
    if (!acc[cur.courseId]) acc[cur.courseId] = [];
    acc[cur.courseId].push(cur);
    return acc;
  }, {});

  const formatSubjectName = (courseId = "") => {
    const clean = courseId
      .replace("course_", "")
      .replace(/_[0-9A-Za-z]+$/, "") // remove class like _9A
      .replace(/_/g, " ");

    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };





  const contentLeft = isNarrow ? 0 : 90;

 return (
    <div className="dashboard-page">
      {/* ---------------- TOP NAVIGATION BAR ---------------- */}
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>
        
        <div className="nav-right">
          <div
            className="icon-circle"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              setShowPostDropdown(prev => !prev);
            }}
          >
            <FaBell />

            {(() => {
              const messageCount = Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0);
              const total = (postNotifications?.length || 0) + messageCount;
              return total > 0 ? (
                <span style={{ position: "absolute", top: "-5px", right: "-5px", background: "red", color: "#fff", borderRadius: "50%", padding: "2px 6px", fontSize: "10px", fontWeight: "bold" }}>{total}</span>
              ) : null;
            })()}

            {showPostDropdown && (
              <div className="notification-dropdown" onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: 40, right: 0, width: 360, maxHeight: 420, overflowY: "auto", background: "#fff", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", zIndex: 1000, padding: 6 }}>
                {((postNotifications?.length || 0) + Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0)) === 0 ? (
                  <p style={{ padding: 12, textAlign: "center", color: "#777" }}>No new notifications</p>
                ) : (
                  <div>
                    {postNotifications.length > 0 && (
                      <div>
                        <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontWeight: 700 }}>Posts</div>
                        {postNotifications.map(n => (
                          <div key={n.notificationId} style={{ padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", borderBottom: "1px solid #f0f0f0", transition: "background 120ms ease" }} onMouseEnter={(e) => (e.currentTarget.style.background = '#f6f8fa')} onMouseLeave={(e) => (e.currentTarget.style.background = '')} onClick={() => handleNotificationClick(n)}>
                            <img src={n.adminProfile || "/default-profile.png"} alt={n.adminName} style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover" }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ display: "block", marginBottom: 4 }}>{n.adminName}</strong>
                              <p style={{ margin: 0, fontSize: 13, color: "#555", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{n.message}</p>
                            </div>
                            <div style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>{new Date(n.time || n.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count||0), 0) > 0 && (
                      <div>
                        <div style={{ padding: '8px 10px', color: '#333', fontWeight: 700, background: '#fafafa', borderRadius: 6, margin: '8px 6px' }}>Messages</div>
                        {Object.entries(unreadSenders || {}).map(([userId, sender]) => (
                          <div key={userId} style={{ padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", borderBottom: "1px solid #f0f0f0", transition: "background 120ms ease" }} onMouseEnter={(e) => (e.currentTarget.style.background = '#f6f8fa')} onMouseLeave={(e) => (e.currentTarget.style.background = '')} onClick={async () => { await markMessagesAsSeen(userId); setUnreadSenders(prev => { const copy = { ...prev }; delete copy[userId]; return copy; }); setShowPostDropdown(false); navigate('/all-chat', { state: { user: { userId, name: sender.name, profileImage: sender.profileImage, type: sender.type } } }); }}>
                            <img src={sender.profileImage || "/default-profile.png"} alt={sender.name} style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover" }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ display: "block", marginBottom: 4 }}>{sender.name}</strong>
                              <p style={{ margin: 0, fontSize: 13, color: "#555", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{sender.count} new message{sender.count > 1 && 's'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="icon-circle" style={{ position: "relative", cursor: "pointer" }} onClick={() => navigate("/all-chat") }>
            <FaFacebookMessenger />
            {Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0) > 0 && (
              <span className="badge">{Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0)}</span>
            )}
          </div>

          <Link className="icon-circle" to="/settings"><FaCog /></Link>
          <img src={admin.profileImage || "/default-profile.png"} alt="admin" className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex" }}>
        {/* ---------------- SIDEBAR ---------------- */}
        <div className="google-sidebar" style={{ width: '220px', padding: '10px' }}>
          <div className="sidebar-profile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingBottom: 6 }}>
            <div className="sidebar-img-circle" style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: '2px solid #e6eefc' }}>
              <img src={admin.profileImage || "/default-profile.png"} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{admin.name}</h3>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{admin?.adminId || "username"}</p>
          </div>

          <div className="sidebar-menu" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <Link className="sidebar-btn" to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
              <FaHome style={{ width: 18, height: 18 }} /> Home
            </Link>
            <Link className="sidebar-btn" to="/my-posts" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
              <FaFileAlt style={{ width: 18, height: 18 }} /> My Posts
            </Link>
            <Link className="sidebar-btn" to="/teachers" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
              <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Teachers
            </Link>
            <Link className="sidebar-btn" to="/students" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13, backgroundColor: '#4b6cb7', color: '#fff', borderRadius: 8 }}>
              <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Students
            </Link>
            <Link className="sidebar-btn" to="/schedule" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
              <FaCalendarAlt style={{ width: 18, height: 18 }} /> Schedule
            </Link>
            <Link className="sidebar-btn" to="/parents" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
              <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Parents
            </Link>
            <Link className="sidebar-btn" to="/registration-form" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
              <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Registration Form
            </Link>

            <button
              className="sidebar-btn logout-btn"
              onClick={() => {
                localStorage.removeItem("admin");
                window.location.href = "/login";
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}
            >
              <FaSignOutAlt style={{ width: 18, height: 18 }} /> Logout
            </button>
          </div>
        </div>

        {/* ---------------- MAIN CONTENT ---------------- */}
        <div
          className={`main-content ${rightSidebarOpen ? "sidebar-open" : ""}`}
          style={{
            padding: "10px 20px 20px",
            flex: 1,
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >
          <div className="main-inner" style={{ marginLeft: 0, marginTop: 0 }}>
            <h2 style={{ marginBottom: "6px", textAlign: isNarrow ? "center" : "left", marginTop: "-8px", fontSize: "20px", marginLeft: contentLeft }}>
              Students
            </h2>

            {/* Search */}
            <div style={{ display: "flex", justifyContent: isNarrow ? "center" : "flex-start", marginBottom: "10px", paddingLeft: contentLeft }}>
              <div
                style={{
                  width: isNarrow ? "92%" : "400px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  padding: "6px 10px",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
                }}
              >
                <FaSearch style={{ color: "#6b7280", fontSize: 14 }} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search students..."
                  style={{
                    width: "100%",
                    border: "none",
                    outline: "none",
                    fontSize: 12,
                    background: "transparent",
                  }}
                />
              </div>
            </div>

            {/* Grade Filter */}
            <div style={{ display: "flex", justifyContent: isNarrow ? "center" : "flex-start", marginBottom: "10px", paddingLeft: contentLeft }}>
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  maxWidth: "100%",
                  overflowX: "auto",
                  paddingBottom: 1,
                }}
              >
                {["All", "7", "8", "9", "10", "11", "12"].map(g => (
                  <button
                    key={g}
                    onClick={() => setSelectedGrade(g)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "8px",
                      background: selectedGrade === g ? "#4b6cb7" : "#ddd",
                      color: selectedGrade === g ? "#fff" : "#000",
                      cursor: "pointer",
                      border: "none",
                      fontSize: "11px",
                    }}
                  >
                    {g === "All" ? "All Grades" : `Grade ${g}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Section Filter */}
            {selectedGrade !== "All" && sections.length > 0 && (
              <div style={{ display: "flex", justifyContent: isNarrow ? "center" : "flex-start", marginBottom: "10px", paddingLeft: contentLeft }}>
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    maxWidth: "100%",
                    overflowX: "auto",
                    paddingBottom: 1,
                  }}
                >
                  {["All", ...sections].map(section => (
                    <button
                      key={section}
                      onClick={() => setSelectedSection(section)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "8px",
                        background: selectedSection === section ? "#4b6cb7" : "#ddd",
                        color: selectedSection === section ? "#fff" : "#000",
                        cursor: "pointer",
                        border: "none",
                        fontSize: "11px",
                      }}
                    >
                      {section === "All" ? "All Sections" : `Section ${section}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Students List */}
            {/* Students List */}
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: isNarrow ? "center" : "flex-start", gap: "10px", paddingLeft: contentLeft }}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} style={{ width: isNarrow ? "92%" : "400px", height: "72px", borderRadius: "12px", padding: "10px", background: "#fff", border: "1px solid #eee", boxShadow: "0 4px 10px rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f1f5f9" }} />
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f1f5f9" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ width: "60%", height: 12, background: "#f1f5f9", borderRadius: 6, marginBottom: 8 }} />
                        <div style={{ width: "40%", height: 10, background: "#f1f5f9", borderRadius: 6 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <p style={{ textAlign: "center", color: "#555" }}>No students found for this selection.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: isNarrow ? "center" : "flex-start", gap: "10px", paddingLeft: contentLeft }}>
                {filteredStudents.map((s, i) => (
                  <div
                    key={s.userId}
                    onClick={() => handleSelectStudent(s)}
                    className="student-card"
                    style={{
                      width: isNarrow ? "92%" : "400px",
                      height: "72px",
                      borderRadius: "12px",
                      padding: "10px",
                      background: selectedStudent?.studentId === s.studentId ? "#e0e7ff" : "#fff",
                      border: selectedStudent?.studentId === s.studentId ? "2px solid #4b6cb7" : "1px solid #ddd",
                      boxShadow: selectedStudent?.studentId === s.studentId ? "0 6px 15px rgba(75,108,183,0.3)" : "0 4px 10px rgba(0,0,0,0.1)",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: "#eef2ff",
                          color: "#2563eb",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: 13,
                          flex: "0 0 auto",
                        }}
                      >
                        {i + 1}
                      </div>
                      <img
                        src={s.profileImage}
                        alt={s.name}
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          border: selectedStudent?.studentId === s.studentId ? "3px solid #4b6cb7" : "3px solid red",
                          objectFit: "cover",
                          transition: "all 0.3s ease",
                        }}
                      />
                      <h3 style={{ marginTop: "-24px", fontSize: "14px" }}>{s.name}</h3>
                    </div>
                    <div style={{ marginLeft: isNarrow ? "78px" : "104px", marginTop: "-16px", color: "#555", fontSize: "11px" }}>
                      Grade {s.grade} - Section {s.section}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        {/* RIGHT SIDEBAR */}
{selectedStudent && (
  <div
    style={{
      width: isPortrait ? "100%" : "30%",
      height: isPortrait ? "100vh" : "calc(100vh - 55px)",
      position: "fixed",
      right: 0,
      top: isPortrait ? 0 : "55px",
      background: "#fff",
      zIndex: 1000,
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      padding: "12px",
      boxShadow: "0 0 18px rgba(0,0,0,0.08)",
      borderLeft: isPortrait ? "none" : "1px solid #e5e7eb",
      transition: "all 0.35s ease",
      fontSize: "10px",
    }}
  >
    {/* Close button */}
    <div style={{ position: "absolute", top: 0, left: 22, zIndex: 2000 }}>
      <button
        onClick={() => setSelectedStudent(null)}
        aria-label="Close sidebar"
        style={{
          background: "none",
          border: "none",
          fontSize: 28,
          fontWeight: 700,
          color: "#3647b7",
          cursor: "pointer",
          padding: 2,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>

    {/* Header */}
    <div
      style={{
        background: "#e0e7ff",
        margin: "-12px -12px 10px",
        padding: "14px 10px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "70px",
          height: "70px",
          margin: "0 auto 10px",
          borderRadius: "50%",
          overflow: "hidden",
          border: "3px solid #4b6cb7",
        }}
      >
        <img
          src={selectedStudent.profileImage}
          alt={selectedStudent.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      <h2 style={{ margin: 0, color: "#111827", fontSize: 14 }}>{selectedStudent.name}</h2>
      <p style={{ margin: "4px 0", color: "#6b7280", fontSize: "10px" }}>{selectedStudent.studentId}</p>
      <p style={{ margin: 0, color: "#6b7280", fontSize: "10px" }}>
        Grade {selectedStudent.grade} - Section {selectedStudent.section}
      </p>
    </div>

    {/* Tabs */}
    <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: "10px" }}>
      {["details", "attendance", "performance"].map((tab) => (
        <button
          key={tab}
          onClick={() => setStudentTab(tab)}
          style={{
            flex: 1,
            padding: "6px",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            color: studentTab === tab ? "#4b6cb7" : "#6b7280",
            fontSize: "10px",
            borderBottom: studentTab === tab ? "3px solid #4b6cb7" : "3px solid transparent",
          }}
        >
          {tab.toUpperCase()}
        </button>
      ))}
    </div>

    {/* Tab Content */}
    <div>
      {/* DETAILS TAB */}
      {studentTab === "details" && (
        <div
          style={{
            padding: "12px",
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
            margin: "0 auto",
            maxWidth: 380,
          }}
        >
          <div>
            {/* STUDENT DETAILS */}
            <h3
              style={{
                margin: 0,
                marginBottom: 6,
                color: "#0f172a",
                fontWeight: 800,
                letterSpacing: "0.1px",
                fontSize: 12,
                textAlign: "left",
              }}
            >
              Student Profile
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {[
                ["Phone", selectedStudent?.phone],
                ["Gender", selectedStudent?.gender],
                ["Email", selectedStudent?.email],
                ["Grade", selectedStudent?.grade],
                ["Section", selectedStudent?.section],
                ["Age", selectedStudent?.age],
                ["Birth Date", selectedStudent?.dob],
                ["Parent Name", selectedStudent?.parentName],
                ["Parent Phone", selectedStudent?.parentPhone],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    alignItems: "center",
                    justifyContent: "flex-start",
                    display: "flex",
                    background: "#ffffff",
                    padding: "8px",
                    borderRadius: 10,
                    border: "1px solid #eef2f7",
                    boxShadow: "none",
                    minHeight: 36,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        letterSpacing: "0.4px",
                        color: "#64748b",
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: "#111",
                        marginTop: 2,
                        wordBreak: "break-word",
                      }}
                    >
                      {value || <span style={{ color: "#cbd5e1" }}>N/A</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
           
          </div>
        </div>
      )}

      {/* ATTENDANCE TAB */}
      {studentTab === "attendance" && selectedStudent && (
        <div
          style={{
            padding: "12px",
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
          }}
        >
          {/* VIEW SWITCH */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 6,
              marginBottom: 10,
            }}
          >
            {["daily", "weekly", "monthly"].map((v) => (
              <button
                key={v}
                onClick={() => setAttendanceView(v)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 8,
                  border: "none",
                  fontWeight: 700,
                  fontSize: 10,
                  cursor: "pointer",
                  background: attendanceView === v ? "#4b6cb7" : "#e5e7eb",
                  color: attendanceView === v ? "#fff" : "#111827",
                }}
              >
                {v.toUpperCase()}
              </button>
            ))}
          </div>
          {/* SUBJECT CARDS */}
          {Object.entries(attendanceBySubject)
            .filter(
              ([course]) =>
                attendanceCourseFilter === "All" || course === attendanceCourseFilter
            )
            .map(([course, records]) => {
              const today = new Date().toDateString();
              const weekRecords = records.filter(
                (r) => new Date(r.date).getWeek?.() === new Date().getWeek?.()
              );
              const monthRecords = records.filter(
                (r) => new Date(r.date).getMonth() === new Date().getMonth()
              );
              const displayRecords =
                attendanceView === "daily"
                  ? records.filter((r) => new Date(r.date).toDateString() === today)
                  : attendanceView === "weekly"
                  ? weekRecords
                  : monthRecords;
              const progress = getProgress(displayRecords);
              const expandKey = `${attendanceView}-${course}`;
              return (
                <div
                  key={course}
                  onClick={() => toggleExpand(expandKey)}
                  style={{
                    cursor: "pointer",
                    background: "#ffffff",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 10,
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Glow */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "transparent",
                      pointerEvents: "none",
                    }}
                  />
                  {/* HEADER */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 18,
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 12,
                          fontWeight: 800,
                          color: "#0f172a",
                        }}
                      >
                        {formatSubjectName(course)}
                      </h3>
                      <p
                        style={{
                          margin: "6px 0 0",
                          fontSize: 10,
                          color: "#64748b",
                        }}
                      >
                        {records[0]?.teacherName}
                      </p>
                    </div>
                    <div
                      style={{
                        padding: "4px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 800,
                        background: "#e0e7ff",
                        color: "#1e40af",
                        border: "1px solid #c7d2fe",
                      }}
                    >
                      {progress}%
                    </div>
                  </div>
                  {/* PROGRESS BAR */}
                  <div
                    onClick={() => toggleExpand(expandKey)}
                    style={{
                      height: 8,
                      background: "#e5e7eb",
                      borderRadius: 999,
                      cursor: "pointer",
                      overflow: "hidden",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${progress}%`,
                        background: "#4b6cb7",
                        transition: "width .3s ease",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#475569",
                      marginBottom: 12,
                    }}
                  >
                    Click to view {attendanceView.toUpperCase()} details
                  </div>
                  {/* EXPANDED DAYS */}
                  {expandedCards[expandKey] && (
                    <div
                      style={{
                        marginTop: 14,
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        padding: 10,
                      }}
                    >
                      {displayRecords.map((r, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 6px",
                            borderBottom:
                              i !== displayRecords.length - 1
                                ? "1px solid #e5e7eb"
                                : "none",
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontSize: 10, color: "#1f2937" }}>
                              {new Date(r.date).toDateString()}
                            </span>
                          </div>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 800,
                              background:
                                r.status === "present"
                                  ? "#dcfce7"
                                  : r.status === "late"
                                  ? "#fef3c7"
                                  : "#fee2e2",
                              color:
                                r.status === "present"
                                  ? "#166534"
                                  : r.status === "late"
                                  ? "#92400e"
                                  : "#991b1b",
                            }}
                          >
                            {r.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* PERFORMANCE TAB */}
      {studentTab === "performance" && (
        <div
          style={{
            position: "relative",
            paddingBottom: "70px",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
            padding: 12,
          }}
        >
          {/* Semester Tabs */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 6,
              marginBottom: 10,
              borderBottom: "1px solid #e5e7eb",
              paddingBottom: 6,
            }}
          >
            {["semester1", "semester2"].map((sem) => {
              const isActive = activeSemester === sem;
              return (
                <button
                  key={sem}
                  onClick={() => setActiveSemester(sem)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 700,
                    color: isActive ? "#4b6cb7" : "#64748b",
                    padding: "6px 8px",
                    borderBottom: isActive ? "2px solid #4b6cb7" : "2px solid transparent",
                  }}
                >
                  {sem === "semester1" ? "Semester 1" : "Semester 2"}
                </button>
              );
            })}
          </div>
          {/* Marks Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 10,
              padding: 0,
            }}
          >
            {loading ? (
              <div
                style={{
                  textAlign: "center",
                  gridColumn: "1 / -1",
                  padding: 12,
                  color: "#64748b",
                  fontSize: 11,
                }}
              >
                Loading performance...
              </div>
            ) : Object.keys(studentMarksFlattened || {}).length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 12,
                  borderRadius: 12,
                  background: "#ffffff",
                  color: "#64748b",
                  fontSize: 11,
                  fontWeight: 600,
                  border: "1px solid #e5e7eb",
                  gridColumn: "1 / -1",
                }}
              >
                No performance records
              </div>
            ) : (
              Object.entries(studentMarksFlattened).map(
                ([courseKey, studentCourseData], idx) => {
                  const data = studentCourseData?.[activeSemester];
                  if (!data) return null;
                  const assessments = data.assessments || {};
                  const total = Object.values(assessments).reduce(
                    (sum, a) => sum + (a.score || 0),
                    0
                  );
                  const maxTotal = Object.values(assessments).reduce(
                    (sum, a) => sum + (a.max || 0),
                    0
                  );
                  const percentage = maxTotal ? (total / maxTotal) * 100 : 0;
                  const statusClr =
                    percentage >= 75
                      ? "#16a34a"
                      : percentage >= 50
                      ? "#f59e0b"
                      : "#dc2626";
                  const courseName = courseKey
                    .replace("course_", "")
                    .replace(/_/g, " ")
                    .toUpperCase();

                  return (
                    <div
                      key={`${courseKey}-${idx}`}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
                      }}
                    >
                      {/* Course Name */}
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          marginBottom: 10,
                          color: "#0f172a",
                          textAlign: "left",
                        }}
                      >
                        {courseName}
                      </div>
                      {/* Summary */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>
                          Total
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#111827" }}>
                          {total} / {maxTotal}
                        </div>
                        <div style={{ padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 800, border: "1px solid #e5e7eb", color: statusClr, background: "#ffffff" }}>
                          {Math.round(percentage)}%
                        </div>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden", marginBottom: 12 }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, percentage))}%`, height: "100%", background: statusClr }} />
                      </div>
                      {/* Assessment Bars */}
                      {Object.entries(assessments).map(([key, a]) => (
                        <div key={key} style={{ marginBottom: 8 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 10,
                              fontWeight: 600,
                              color: "#111827",
                            }}
                          >
                            <span>{a.name}</span>
                            <span>
                              {a.score} / {a.max}
                            </span>
                          </div>
                          <div
                            style={{
                              height: 5,
                              borderRadius: "999px",
                              background: "#e5e7eb",
                              marginTop: "5px",
                            }}
                          >
                            <div
                              style={{
                                width: `${(a.score / a.max) * 100}%`,
                                height: "100%",
                                background: statusClr,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      {/* Status */}
                      <div
                        style={{
                          marginTop: 8,
                          textAlign: "left",
                          fontWeight: 700,
                          color: statusClr,
                          fontSize: 10,
                        }}
                      >
                        {percentage >= 75
                          ? "Excellent"
                          : percentage >= 50
                          ? "Good"
                          : "Needs Improvement"}
                      </div>
                      {/* Teacher Name */}
                      <div
                        style={{
                          marginTop: 6,
                          textAlign: "left",
                          fontSize: 10,
                          color: "#64748b",
                        }}
                      >
                        {studentCourseData.teacherName ||
                          data.teacherName ||
                          "N/A"}
                      </div>
                    </div>
                  );
                }
              )
            )}
          </div>
        </div>
      )}
    </div>
    {/* Chat Button */}
    {!studentChatOpen && (
      <div
        onClick={() => setStudentChatOpen(true)}
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          width: "60px",
          height: "60px",
          background:
            "linear-gradient(135deg, #833ab4, #0259fa, #459afc)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          cursor: "pointer",
          zIndex: 1000,
          boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
          transition: "transform 0.2s ease",
        }}
      >
        <FaCommentDots size={30} />
      </div>
    )}
    {/* Chat Popup */}
    {studentChatOpen && selectedStudent && (
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          width: "360px",
          height: "480px",
          background: "#fff",
          borderRadius: "16px",
          boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
          zIndex: 2000,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: "14px",
            borderBottom: "1px solid #eee",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#fafafa",
          }}
        >
            <strong>{selectedStudent.name}</strong>
          <div style={{ display: "flex", gap: "10px" }}>
            {/* Expand */}
            <button
              onClick={() => {
                setStudentChatOpen(false); // properly close popup
                navigate("/all-chat", {
                  state: {
                    user: selectedStudent, // user to auto-select
                    tab: "student", // tab type
                  },
                });
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "18px",
              }}
            >
              ⤢
            </button>
            {/* Close */}
            <button
              onClick={() => setStudentChatOpen(false)}
              style={{
                background: "none",
                border: "none",
                fontSize: "20px",
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
        </div>
        {/* Messages */}
        <div
          style={{
            flex: 1,
            padding: "12px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            background: "#f9f9f9",
          }}
        >
          {popupMessages.length === 0 ? (
            <p style={{ textAlign: "center", color: "#aaa" }}>
              Start chatting with {selectedStudent.name}
            </p>
          ) : (
            popupMessages.map((m) => {
              const isAdmin = String(m.senderId) === String(adminUserId);
              return (
                <div
                  key={m.messageId || m.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isAdmin ? "flex-end" : "flex-start",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      maxWidth: "70%",
                      background: isAdmin ? "#4facfe" : "#fff",
                      color: isAdmin ? "#fff" : "#000",
                      padding: "10px 14px",
                      borderRadius: 18,
                      borderTopRightRadius: isAdmin ? 0 : 18,
                      borderTopLeftRadius: isAdmin ? 18 : 0,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      wordBreak: "break-word",
                      cursor: "default",
                      position: "relative",
                    }}
                  >
                    {m.text} {" "}
                    {m.edited && (
                      <small style={{ fontSize: 10 }}> (edited)</small>
                    )}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 6,
                        marginTop: 6,
                        fontSize: 11,
                        color: isAdmin ? "#fff" : "#888",
                      }}
                    >
                      <span style={{ marginRight: 6, fontSize: 11, opacity: 0.9 }}>
                        {formatDateLabel(m.timeStamp)}
                      </span>
                      <span>{formatTime(m.timeStamp)}</span>
                      {isAdmin && !m.deleted && (
                      <span style={{ display: "flex", gap: 0, alignItems: "center" }}>
                                                          <FaCheck size={10} color={isAdmin ? "#fff" : "#888"} style={{ opacity: 0.90, marginLeft: 2 }} />
                                                          {m.seen && (<FaCheck size={10} color={isAdmin ? "#f3f7f8" : "#ccc"} style={{ marginLeft: -6, opacity: 0.95 }} />)}
                                                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        {/* Input */}
        <div
          style={{
            padding: "10px",
            borderTop: "1px solid #eee",
            display: "flex",
            gap: "8px",
            background: "#fff",
          }}
        >
          <input
            value={newMessageText}
            onChange={(e) => setNewMessageText(e.target.value)}
            placeholder="Type a message..."
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: "25px",
              border: "1px solid #ccc",
              outline: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
          />
          <button
            onClick={() => sendMessage()}
            style={{
              width: 45,
              height: 45,
              borderRadius: "50%",
              background: "#4facfe",
              border: "none",
              color: "#fff",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <FaPaperPlane />
          </button>
        </div>
      </div>
    )}
  </div>
)}
    </div>

  </div>
)}
export default StudentsPage;