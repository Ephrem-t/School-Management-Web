import React, { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  FaHome,
  FaFileAlt,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaFacebookMessenger,
  FaSearch,
  FaCalendarAlt,
  FaCommentDots,
  FaPaperPlane,
  FaCheck,
} from "react-icons/fa";
import axios from "axios";
import { getDatabase, ref as rdbRef, onValue } from "firebase/database";
import { BACKEND_BASE } from "../config.js";

const DB = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";
const getChatId = (a, b) => [a, b].sort().join("_");

function Parent() {
  const API_BASE = `${BACKEND_BASE}/api`;
  const [parents, setParents] = useState([]);
  const [loadingParents, setLoadingParents] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [parentTab, setParentTab] = useState("Details");
  const [parentChatOpen, setParentChatOpen] = useState(false);
  const [newMessageText, setNewMessageText] = useState("");
  const [parentInfo, setParentInfo] = useState(null);
  const [children, setChildren] = useState([]);
  const [expandedChildren, setExpandedChildren] = useState({});
  const [unreadSenders, setUnreadSenders] = useState({});
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [postNotifications, setPostNotifications] = useState([]);
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sidebarVisible, setSidebarVisible] = useState(window.innerWidth > 900);
  const typingTimeoutRef = useRef(null);
  const [typingUserId, setTypingUserId] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const admin = JSON.parse(localStorage.getItem("admin")) || {};
  const adminId = admin.userId;
  const chatId =
    admin?.userId && selectedParent?.userId
      ? getChatId(admin.userId, selectedParent.userId)
      : null;

  const maybeMarkLastMessageSeenForAdmin = async (chatKey) => {
    try {
      const res = await axios.get(`${DB}/Chats/${chatKey}/lastMessage.json`).catch(() => ({ data: null }));
      const last = res.data;
      if (!last) return;
      if (String(last.receiverId) === String(admin.userId) && last.seen === false) {
        await axios.patch(`${DB}/Chats/${chatKey}/lastMessage.json`, { seen: true }).catch(() => {});
      }
    } catch (e) {
      // ignore
    }
  };

  const messagesEndRef = useRef(null);
  const formatDateLabel = (ts) => {
    if (!ts) return "";
    try { return new Date(ts).toLocaleDateString(); } catch { return ""; }
  };
  const formatTime = (ts) => {
    if (!ts) return "";
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ""; }
  };
  const [windowW, setWindowW] = useState(window.innerWidth);

  const isNarrow = windowW < 900;

  // Portrait detection helper used in sidebar layout
  const isPortrait = windowW <= 600;

  // Window resize handling for responsiveness
  useEffect(() => {
    const onResize = () => setWindowW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Keep sidebarVisible default based on screen size
  useEffect(() => {
    setSidebarVisible(windowW > 900);
  }, [windowW]);

  // Fetch parents
  useEffect(() => {
    const fetchParents = async () => {
      setLoadingParents(true);
      try {
        const [usersRes, parentsRes, studentsRes] = await Promise.all([
          axios.get(`${DB}/Users.json`).catch(() => ({ data: {} })),
          axios.get(`${DB}/Parents.json`).catch(() => ({ data: {} })),
          axios.get(`${DB}/Students.json`).catch(() => ({ data: {} })),
        ]);

        const users = usersRes.data || {};
        const parentsData = parentsRes.data || {};
        const studentsData = studentsRes.data || {};

        const getUserByKeyOrUserId = (maybeUserId) => {
          if (!maybeUserId) return null;
          return (
            users[maybeUserId] ||
            Object.values(users).find((u) => String(u?.userId) === String(maybeUserId)) ||
            null
          );
        };

        const findParentRecordByUserId = (canonicalUserId) => {
          if (!canonicalUserId) return null;
          return (
            parentsData?.[canonicalUserId] ||
            Object.entries(parentsData || {}).find(
              ([parentKey, p]) =>
                String(parentKey) === String(canonicalUserId) ||
                String(p?.userId) === String(canonicalUserId)
            )?.[1] ||
            null
          );
        };

        const findStudentRecordById = (maybeStudentId) => {
          if (!maybeStudentId) return null;
          return (
            studentsData?.[maybeStudentId] ||
            Object.entries(studentsData || {}).find(
              ([studentKey, s]) =>
                String(studentKey) === String(maybeStudentId) ||
                String(s?.studentId || s?.id || "") === String(maybeStudentId)
            )?.[1] ||
            null
          );
        };

        const resolveFirstChildPreview = (canonicalUserId) => {
          const parentRecord = findParentRecordByUserId(canonicalUserId);
          const childLinks = Object.values(parentRecord?.children || {});
          if (!childLinks.length) return null;

          const firstLink = childLinks[0] || {};
          const studentRecord = findStudentRecordById(firstLink.studentId);
          if (!studentRecord) return null;
          const studentUserId = studentRecord.use || studentRecord.userId || studentRecord.user || null;
          const studentUser = getUserByKeyOrUserId(studentUserId);
          const name =
            studentUser?.name ||
            studentUser?.username ||
            studentRecord?.name ||
            studentRecord?.username ||
            null;
          const relationship = firstLink.relationship || null;
          return { name, relationship };
        };

        const parentList = Object.keys(users)
          .filter((uid) => users[uid].role === "parent")
          .map((uid) => {
            const u = users[uid] || {};
            const canonicalUserId = u.userId || uid;
            const firstChild = resolveFirstChildPreview(canonicalUserId);
            return {
              userId: canonicalUserId,
              name: u.name || u.username || "No Name",
              email: u.email || "N/A",
              childName: firstChild?.name || "N/A",
              childRelationship: firstChild?.relationship || "N/A",
              profileImage: u.profileImage || "/default-profile.png",
              phone: u.phone || u.phoneNumber || "N/A",
              age: u.age || null,
              city: u.city || (u.address && u.address.city) || null,
              citizenship: u.citizenship || null,
              job: u.job || null,
              address: u.address || null,
            };
          });
        setParents(parentList);
      } catch (err) {
        console.error("Error fetching parents:", err);
        setParents([]);
      } finally {
        setLoadingParents(false);
      }
    };
    fetchParents();
  }, []);

  // Post notifications
  const fetchPostNotifications = async () => {
    if (!adminId) return;
    try {
      const res = await axios.get(`${API_BASE}/get_post_notifications/${adminId}`);
      let notifications = Array.isArray(res.data)
        ? res.data
        : Object.values(res.data || {});
      if (notifications.length === 0) {
        setPostNotifications([]);
        return;
      }
      const [usersRes, adminsRes] = await Promise.all([
        axios.get(`${DB}/Users.json`),
        axios.get(`${DB}/School_Admins.json`),
      ]);
      const users = usersRes.data || {};
      const admins = adminsRes.data || {};
      const findAdminUser = (id) => {
        const rec = admins[id];
        if (!rec) return null;
        return Object.values(users).find((u) => u.userId === rec.userId);
      };
      const enriched = notifications.map((n) => {
        const posterUser = findAdminUser(n.adminId);
        return {
          ...n,
          notificationId: n.notificationId || n.id || `${n.postId}_${n.adminId}`,
          adminName: posterUser?.name || "Unknown Admin",
          adminProfile: posterUser?.profileImage || "/default-profile.png",
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
    const interval = setInterval(fetchPostNotifications, 9000);
    return () => clearInterval(interval);
  }, [adminId]);

  // Mark post notification & navigate
  const handleNotificationClick = async (notification) => {
    try {
      await axios.post(`${API_BASE}/mark_post_notification_read`, {
        notificationId: notification.notificationId,
        adminId: admin.userId,
      });
    } catch (err) {
      console.warn("Failed to mark notification:", err);
    }
    setPostNotifications((prev) =>
      prev.filter((n) => n.notificationId !== notification.notificationId)
    );
    setShowPostDropdown(false);
    navigate("/dashboard", { state: { postId: notification.postId } });
  };

  useEffect(() => {
    if (location.state?.postId) setPostNotifications([]);
  }, [location.state]);

  // Unread senders (messenger)
  const fetchUnreadMessages = async () => {
    if (!admin.userId) return;
    const senders = {};
    try {
      const usersRes = await axios.get(`${DB}/Users.json`);
      const usersData = usersRes.data || {};
      const findUserByUserId = (userId) =>
        Object.values(usersData).find((u) => u.userId === userId);

      // helper to read both chat keys
      const getUnreadCount = async (userId) => {
        const key1 = `${admin.userId}_${userId}`;
        const key2 = `${userId}_${admin.userId}`;
        const [r1, r2] = await Promise.all([
          axios.get(`${DB}/Chats/${key1}/messages.json`).catch(() => ({ data: null })),
          axios.get(`${DB}/Chats/${key2}/messages.json`).catch(() => ({ data: null })),
        ]);
        const msgs = [...Object.values(r1.data || {}), ...Object.values(r2.data || {})];
        return msgs.filter((m) => m.receiverId === admin.userId && !m.seen).length;
      };

      // Teachers
      const teachersRes = await axios.get(`${DB}/Teachers.json`).catch(() => ({ data: {} }));
      for (const k in teachersRes.data || {}) {
        const t = teachersRes.data[k];
        const unread = await getUnreadCount(t.userId);
        if (unread > 0) {
          const user = findUserByUserId(t.userId);
          senders[t.userId] = {
            type: "teacher",
            name: user?.name || "Teacher",
            profileImage: user?.profileImage || "/default-profile.png",
            count: unread,
          };
        }
      }
      // Students
      const studentsRes = await axios.get(`${DB}/Students.json`).catch(() => ({ data: {} }));
      for (const k in studentsRes.data || {}) {
        const s = studentsRes.data[k];
        const unread = await getUnreadCount(s.userId);
        if (unread > 0) {
          const user = findUserByUserId(s.userId);
          senders[s.userId] = {
            type: "student",
            name: user?.name || s.name || "Student",
            profileImage: user?.profileImage || s.profileImage || "/default-profile.png",
            count: unread,
          };
        }
      }
      // Parents
      const parentsRes = await axios.get(`${DB}/Parents.json`).catch(() => ({ data: {} }));
      for (const k in parentsRes.data || {}) {
        const p = parentsRes.data[k];
        const unread = await getUnreadCount(p.userId);
        if (unread > 0) {
          const user = findUserByUserId(p.userId);
          senders[p.userId] = {
            type: "parent",
            name: user?.name || p.name || "Parent",
            profileImage: user?.profileImage || p.profileImage || "/default-profile.png",
            count: unread,
          };
        }
      }

      setUnreadSenders(senders);
    } catch (err) {
      console.error("Unread fetch failed:", err);
      setUnreadSenders({});
    }
  };

  useEffect(() => {
    if (!admin.userId) return;
    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 9000);
    return () => clearInterval(interval);
  }, [admin.userId]);

  // Close messenger dropdown if clicked outside
  useEffect(() => {
    const closeDropdown = (e) => {
      if (!e.target.closest(".icon-circle") && !e.target.closest(".messenger-dropdown")) {
        setShowMessageDropdown(false);
      }
    };
    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  // Fetch parent info & children
  useEffect(() => {
    if (!selectedParent) return;
    const fetchParentInfoAndChildren = async () => {
      try {
        const parentsRes = await axios.get(`${DB}/Parents.json`).catch(() => ({ data: {} }));
        const parentsData = parentsRes.data || {};
        const parentRecord = (
          Object.entries(parentsData).find(
            ([parentKey, p]) =>
              String(p?.userId) === String(selectedParent.userId) ||
              String(parentKey) === String(selectedParent.userId)
          ) ||
          []
        )[1];
        const usersRes = await axios.get(`${DB}/Users.json`).catch(() => ({ data: {} }));
        const usersData = usersRes.data || {};
        const getUserByKeyOrUserId = (maybeUserId) => {
          if (!maybeUserId) return null;
          return (
            usersData[maybeUserId] ||
            Object.values(usersData).find((u) => String(u?.userId) === String(maybeUserId)) ||
            null
          );
        };

        const userInfo = getUserByKeyOrUserId(selectedParent.userId) || {};

        // compute age from possible DOB fields or explicit age field
        const dobRaw = userInfo?.dob || userInfo?.birthDate || parentRecord?.dob || parentRecord?.birthDate || null;
        const computeAge = (dob) => {
          if (!dob) return null;
          try {
            const d = typeof dob === "number" ? new Date(dob) : new Date(String(dob));
            const now = new Date();
            let age = now.getFullYear() - d.getFullYear();
            const m = now.getMonth() - d.getMonth();
            if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
            return age;
          } catch (e) {
            return null;
          }
        };

        const age = parentRecord?.age || userInfo?.age || computeAge(dobRaw) || null;

        // derive relationships from child links if present
        const rels = (Object.values(parentRecord?.children || {}).map((c) => c.relationship).filter(Boolean)) || [];

        const info = {
          userId: selectedParent.userId,
          name: userInfo.name || userInfo.username || "No Name",
          username: userInfo.username || null,
          email: userInfo.email || "N/A",
          phone: userInfo.phone || parentRecord?.phone || "N/A",
          isActive: userInfo.isActive ?? parentRecord?.isActive ?? true,
          job: userInfo.job || parentRecord?.job || null,
          relationships: rels,
          age: age ?? "—",
          city: parentRecord?.city || (parentRecord?.address && parentRecord.address.city) || userInfo.city || "—",
          citizenship: parentRecord?.citizenship || userInfo.citizenship || "—",
          status: parentRecord?.status || (userInfo.isActive ? "Active" : "Inactive") || "N/A",
          address: parentRecord?.address || userInfo.address || null,
          additionalInfo: parentRecord?.additionalInfo || "N/A",
          createdAt: parentRecord?.createdAt || userInfo.createdAt || "N/A",
          profileImage: userInfo.profileImage || "/default-profile.png",
        };
        setParentInfo(info);
        setSelectedParent((prev) => ({ ...(prev || {}), ...info }));
        const studentsRes = await axios.get(`${DB}/Students.json`).catch(() => ({ data: {} }));
        const studentsData = studentsRes.data || {};
        const childrenList = Object.values(parentRecord?.children || {})
          .map((childLink) => {
            const studentRecord =
              studentsData?.[childLink.studentId] ||
              Object.entries(studentsData || {}).find(
                ([studentKey, s]) =>
                  String(studentKey) === String(childLink.studentId || "") ||
                  String(s?.studentId || s?.id || "") === String(childLink.studentId || "") ||
                  String(s?.use || s?.userId || "") === String(childLink.studentId || "")
              )?.[1];
            if (!studentRecord) return null;
            const studentUserId = studentRecord.use || studentRecord.userId || studentRecord.user || null;
            const studentUser = getUserByKeyOrUserId(studentUserId) || {};
            return {
              studentId: childLink.studentId,
              name: studentUser.name || studentUser.username || studentRecord.name || studentRecord.username || "N/A",
              email: studentUser.email || "N/A",
              grade: studentRecord.grade || "N/A",
              section: studentRecord.section || "N/A",
              parentPhone: parentRecord.phone || "N/A",
              relationship: childLink.relationship || "N/A",
              profileImage: studentUser.profileImage || studentRecord.profileImage || "/default-profile.png",
            };
          })
          .filter(Boolean);
        setChildren(childrenList);
      } catch (err) {
        console.error("Error fetching parent info and children:", err);
        setParentInfo(null);
        setChildren([]);
      }
    };
    fetchParentInfoAndChildren();
  }, [selectedParent]);

  // Fetch chat messages in realtime
  useEffect(() => {
    if (!chatId) return;
    const db = getDatabase();
    const messagesRef = rdbRef(db, `Chats/${chatId}/messages`);
    const unsubscribe = onValue(messagesRef, async (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.entries(data)
        .map(([id, msg]) => ({ messageId: id, ...msg }))
        .sort((a, b) => a.timeStamp - b.timeStamp);
      setMessages(list);

      // mark unseen messages addressed to admin as seen
      const updates = {};
      Object.entries(data).forEach(([msgId, msg]) => {
        if (msg && msg.receiverId === admin.userId && !msg.seen) {
          updates[`${msgId}/seen`] = true;
        }
      });

      if (Object.keys(updates).length > 0) {
        try {
          await axios.patch(`${DB}/Chats/${chatId}/messages.json`, updates).catch(() => {});
        } catch (err) {
          console.warn('Failed to patch parent seen updates', err);
        }
        // also reset unread for admin; only mark lastMessage seen if it was sent to admin
        axios.patch(`${DB}/Chats/${chatId}/unread.json`, { [admin.userId]: 0 }).catch(() => {});
        maybeMarkLastMessageSeenForAdmin(chatId);
        // optimistic local update
        setMessages((prev) => prev.map((m) => (m.receiverId === admin.userId ? { ...m, seen: true } : m)));
      }
    });
    return () => unsubscribe();
  }, [chatId]);

  // Listen to typing in realtime (only while popup open)
  useEffect(() => {
    if (!chatId || !parentChatOpen) {
      setTypingUserId(null);
      return;
    }
    const db = getDatabase();
    const typingRef = rdbRef(db, `Chats/${chatId}/typing`);
    const unsub = onValue(typingRef, (snapshot) => {
      const t = snapshot.val();
      setTypingUserId(t && t.userId ? t.userId : null);
    });
    return () => unsub();
  }, [chatId, parentChatOpen]);

  // Mark messages as seen when the chat popup opens or selected parent changes
  useEffect(() => {
    if (!parentChatOpen || !selectedParent || !admin?.userId) return;
    const chatKey = getChatId(admin.userId, selectedParent.userId);

    const markSeen = async () => {
      try {
        const res = await axios.get(`${DB}/Chats/${chatKey}/messages.json`);
        const data = res.data || {};
        const updates = {};
        Object.entries(data).forEach(([msgId, msg]) => {
          if (msg && msg.receiverId === admin.userId && !msg.seen) {
            updates[`${msgId}/seen`] = true;
          }
        });

        if (Object.keys(updates).length > 0) {
          // Patch the messages node with per-message seen updates
          await axios.patch(`${DB}/Chats/${chatKey}/messages.json`, updates).catch(() => {});
        }

        // Optimistically update local state
        setMessages((prev) => prev.map((m) => (m.receiverId === admin.userId ? { ...m, seen: true } : m)));
      } catch (err) {
        console.warn("Failed to mark messages as seen:", err);
      }
    };

    markSeen();
    // also reset unread counter for admin in chat root
    axios.patch(`${DB}/Chats/${chatKey}/unread.json`, { [admin.userId]: 0 }).catch(() => {});
    maybeMarkLastMessageSeenForAdmin(chatKey);
    axios.put(`${DB}/Chats/${chatKey}/typing.json`, null).catch(() => {});
  }, [parentChatOpen, selectedParent, admin]);

  // Typing handler: write typing.userId to chat root while admin types
  const handleTyping = (text) => {
    if (!admin?.userId || !selectedParent?.userId) return;
    const chatKey = getChatId(admin.userId, selectedParent.userId);

    // If input cleared, clear typing immediately
    if (!text || !text.trim()) {
      axios.put(`${DB}/Chats/${chatKey}/typing.json`, null).catch(() => {});
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      return;
    }

    // write typing user
    axios.put(`${DB}/Chats/${chatKey}/typing.json`, { userId: admin.userId }).catch(() => {});

    // debounce clearing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      axios.put(`${DB}/Chats/${chatKey}/typing.json`, null).catch(() => {});
      typingTimeoutRef.current = null;
    }, 1800);
  };

  // Clear typing when popup closes or selectedParent changes
  useEffect(() => {
    if (!parentChatOpen && selectedParent && admin?.userId) {
      const chatKey = getChatId(admin.userId, selectedParent.userId);
      axios.put(`${DB}/Chats/${chatKey}/typing.json`, null).catch(() => {});
    }
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [parentChatOpen, selectedParent, admin]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, parentChatOpen]);

  // Ensure chat object exists
  const initChatIfMissing = async () => {
    if (!chatId) return;
    await axios.patch(`${DB}/Chats/${chatId}.json`, {
      participants: { [admin.userId]: true, [selectedParent.userId]: true },
      unread: { [admin.userId]: 0, [selectedParent.userId]: 0 },
      typing: null,
      lastMessage: null,
    }).catch(() => {});
  };

  // Send message
  const sendMessage = async (text) => {
    if (!text || !text.trim() || !selectedParent) return;
    if (!admin?.userId || !selectedParent?.userId) return;
    const id = getChatId(admin.userId, selectedParent.userId);
    await initChatIfMissing();

    // build message payload
    const newMsg = {
      senderId: admin.userId,
      receiverId: selectedParent.userId,
      type: "text",
      text,
      imageUrl: null,
      replyTo: null,
      seen: false,
      edited: false,
      deleted: false,
      timeStamp: Date.now(),
    };

    try {
      // push message (let Firebase generate id)
      const pushRes = await axios.post(`${DB}/Chats/${id}/messages.json`, newMsg).catch(() => ({ data: null }));
      const generatedId = pushRes?.data?.name || `${Date.now()}`;

      // Build a full lastMessage object matching desired DB structure
      const lastMessage = {
        messageId: generatedId,
        senderId: newMsg.senderId,
        receiverId: newMsg.receiverId,
        text: newMsg.text || "",
        type: newMsg.type || "text",
        timeStamp: newMsg.timeStamp,
        seen: false,
        edited: false,
        deleted: false,
      };

      // Ensure chat root contains participants, typing cleared, and full lastMessage
      await axios.patch(`${DB}/Chats/${id}.json`, {
        participants: { [admin.userId]: true, [selectedParent.userId]: true },
        lastMessage,
        typing: null,
      }).catch(() => {});

      // increment unread for receiver (preserve existing unread counts)
      try {
        const unreadRes = await axios.get(`${DB}/Chats/${id}/unread.json`);
        const unread = unreadRes.data || {};
        const prev = Number(unread[selectedParent.userId] || 0);
        const updated = { ...(unread || {}), [selectedParent.userId]: prev + 1, [admin.userId]: Number(unread[admin.userId] || 0) };
        await axios.put(`${DB}/Chats/${id}/unread.json`, updated).catch(() => {});
      } catch (uErr) {
        await axios.put(`${DB}/Chats/${id}/unread.json`, { [selectedParent.userId]: 1, [admin.userId]: 0 }).catch(() => {});
      }

      // update local UI state immediately and clear typing indicator
      setNewMessageText("");
      // clear typing flag now that message was sent
      axios.put(`${DB}/Chats/${id}/typing.json`, null).catch(() => {});
    } catch (err) {
      console.error("Failed to send parent message:", err);
    }
  };

  // Mark as seen when selectedParent changes
  useEffect(() => {
    if (!selectedParent || !admin?.userId) return;
    const id = getChatId(admin.userId, selectedParent.userId);
    axios.patch(`${DB}/Chats/${id}/unread.json`, { [admin.userId]: 0 }).catch(() => {});
    maybeMarkLastMessageSeenForAdmin(id);
  }, [selectedParent, admin]);

  // Mark messages seen helper for dropdown click
  const markMessagesAsSeen = async (userId) => {
    if (!admin?.userId || !userId) return;
    const id = getChatId(admin.userId, userId);
    await axios.patch(`${DB}/Chats/${id}/unread.json`, { [admin.userId]: 0 }).catch(() => {});
    await maybeMarkLastMessageSeenForAdmin(id);
  };

  // badge counts
  const messageCount = Object.values(unreadSenders || {}).reduce((acc, s) => acc + (s.count || 0), 0);
  const totalNotifications = (postNotifications?.length || 0) + messageCount;

  if (!admin?.userId) return null;

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredParents = useMemo(() => {
    if (!normalizedSearch) return parents;
    return (parents || []).filter((p) => {
      const hay = [
        p?.name,
        p?.email,
        p?.phone,
        p?.city,
        p?.job,
        p?.citizenship,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(normalizedSearch);
    });
  }, [parents, normalizedSearch]);

  // MAIN CONTENT (Teachers-like layout)
  const mainContentStyle = {
    padding: "10px 20px 20px",
    flex: 1,
    minWidth: 0,
    boxSizing: "border-box",
  };

  const parentCardBase = {
    height: "72px",
    borderRadius: "12px",
    padding: "10px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
     <div className="dashboard-page">
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>

        <div className="nav-right">
          {/* Combined bell: shows posts + message senders in one dropdown */}
          <div
            className="icon-circle"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              setShowPostDropdown((prev) => !prev);
            }}
          >
            <FaBell />
            {(
              postNotifications.length + Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0)
            ) > 0 && (
              <span className="badge">{postNotifications.length + Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0)}</span>
            )}

            {showPostDropdown && (
              <div className="notification-dropdown" onClick={(e) => e.stopPropagation()} style={{
                  position: "absolute",
                  top: "45px",
                  right: "0",
                  width: "360px",
                  maxHeight: "420px",
                  overflowY: "auto",
                  background: "#fff",
                  borderRadius: 10,
                  boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
                  zIndex: 1000,
                  padding: 6,
                }}>
                {totalNotifications === 0 ? (
                  <p className="muted">No new notifications</p>
                ) : (
                  <div>
                    {/* Posts section */}
                    {postNotifications.length > 0 && (
                      <div>
                        <div className="notification-section-title">Posts</div>
                        {postNotifications.map((n) => (
                          <div
                            key={n.notificationId}
                            className="notification-row"
                            onClick={async () => {
                              try {
                                await axios.post(`${API_BASE}/mark_post_notification_read`, {
                                  notificationId: n.notificationId,
                                });
                              } catch (err) {
                                console.warn("Failed to mark notification:", err);
                              }

                              setPostNotifications((prev) => prev.filter((notif) => notif.notificationId !== n.notificationId));
                              setShowPostDropdown(false);
                              navigate("/dashboard", {
                                state: {
                                  postId: n.postId,
                                  posterName: n.adminName,
                                  posterProfile: n.adminProfile,
                                },
                              });
                            }}
                            style={{
                              padding: 10,
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              cursor: "pointer",
                              borderBottom: "1px solid #f0f0f0",
                              transition: "background 120ms ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                          >
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

                    {/* Messages section */}
                    {messageCount > 0 && (
                      <div>
                        <div className="notification-section-title" style={{ padding: '8px 10px', color: '#333', fontWeight: 700, background: '#fafafa', borderRadius: 6, margin: '8px 6px' }}>Messages</div>
                        {Object.entries(unreadSenders || {}).map(([userId, sender]) => (
                              <div
                                key={userId}
                                className="notification-row"
                                onClick={async () => {
                                  await markMessagesAsSeen(userId);
                                  setUnreadSenders((prev) => {
                                    const copy = { ...prev };
                                    delete copy[userId];
                                    return copy;
                                  });
                                  setShowPostDropdown(false);
                                  navigate("/all-chat", { state: { user: { userId, name: sender.name, profileImage: sender.profileImage, type: sender.type } } });
                                }}
                                style={{
                                  padding: 10,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                  cursor: "pointer",
                                  borderBottom: "1px solid #f0f0f0",
                                  transition: "background 120ms ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                              >
                                <img src={sender.profileImage || "/default-profile.png"} alt={sender.name} style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover" }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <strong style={{ display: "block", marginBottom: 4 }}>{sender.name}</strong>
                                  <p style={{ margin: 0, fontSize: 13, color: "#555", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{sender.count} new message{sender.count > 1 && "s"}</p>
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

          {/* Messenger icon: only counts messages and navigates straight to /all-chat */}
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

      <div className="google-dashboard">
        <div className="google-sidebar" style={{ width: '220px', padding: '10px' }}>
          <div className="sidebar-profile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingBottom: 6 }}>
            <div className="sidebar-img-circle" style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: '2px solid #e6eefc' }}>
              <img src={admin?.profileImage || "/default-profile.png"} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{admin?.name || "Admin Name"}</h3>
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
            <Link className="sidebar-btn" to="/students" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
              <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Students
            </Link>
            <Link className="sidebar-btn" to="/schedule" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
              <FaCalendarAlt style={{ width: 18, height: 18 }} /> Schedule
            </Link>
            <Link className="sidebar-btn" to="/parents" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13, backgroundColor: '#4b6cb7', color: '#fff', borderRadius: 8 }}>
              <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Parents
            </Link>
            <Link className="sidebar-btn" to="/registration-form" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
              <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Registration Form
            </Link>

            <button
              className="sidebar-btn logout-btn"
              onClick={() => { localStorage.removeItem("admin"); window.location.href = "/login"; }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}
            >
              <FaSignOutAlt style={{ width: 18, height: 18 }} /> Logout
            </button>
          </div>
        </div>

        {/* MAIN CONTENT (centered & responsive) */}
        <main className="main-content" style={mainContentStyle}>
          <h2 style={{ marginBottom: "6px", textAlign: isNarrow ? "center" : "left", marginTop: "-8px", fontSize: "20px", marginLeft: isNarrow ? 0 : 64 }}>
            Parents
          </h2>

          {/* Search */}
          <div style={{ display: "flex", justifyContent: isNarrow ? "center" : "flex-start", marginBottom: "10px", paddingLeft: isNarrow ? 0 : 64 }}>
            <div
              style={{
                width: "min(580px, 100%)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#fff",
                borderRadius: "10px",
                padding: "6px 10px",
                border: "1px solid #e5e7eb",
                boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
              }}
            >
              <FaSearch style={{ color: "#64748b", fontSize: "12px" }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search parents by name, email, phone"
                style={{
                  border: "none",
                  outline: "none",
                  width: "100%",
                  fontSize: "12px",
                  color: "#111827",
                  background: "transparent",
                }}
              />
            </div>
          </div>

          {/* Parents List */}
          {loadingParents ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: isNarrow ? "center" : "flex-start", gap: "10px", marginLeft: isNarrow ? 0 : '165px' }}>
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} style={{ width: isNarrow ? "92%" : "400px", height: "72px", borderRadius: "12px", padding: "10px", background: "#fff", border: "1px solid #eee", boxShadow: "0 4px 10px rgba(0,0,0,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f1f5f9" }} />
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f1f5f9" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ width: "55%", height: 12, background: "#f1f5f9", borderRadius: 6, marginBottom: 8 }} />
                      <div style={{ width: "45%", height: 10, background: "#f1f5f9", borderRadius: 6 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredParents.length === 0 ? (
            <p style={{ textAlign: "center", color: "#555" }}>No parents found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: isNarrow ? "center" : "flex-start", gap: "10px", marginLeft: isNarrow ? 0 : '165px' }}>
              {filteredParents.map((p, i) => (
                <div
                  key={p.userId}
                  onClick={() => { setSelectedParent(p); setSidebarVisible(true); }}
                  style={{
                    ...parentCardBase,
                    width: isNarrow ? "92%" : "400px",
                    background: selectedParent?.userId === p.userId ? "#e0e7ff" : "#fff",
                    border: selectedParent?.userId === p.userId ? "2px solid #4b6cb7" : "1px solid #ddd",
                    boxShadow: selectedParent?.userId === p.userId ? "0 6px 15px rgba(75,108,183,0.3)" : "0 4px 10px rgba(0,0,0,0.1)",
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
                      src={p.profileImage}
                      alt={p.name}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: selectedParent?.userId === p.userId ? "3px solid #4b6cb7" : "3px solid red",
                        transition: "all 0.3s ease",
                      }}
                    />
                    <h3 style={{ marginTop: "-24px", fontSize: "14px", marginBottom: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.name}
                    </h3>
                  </div>
                  <div style={{ marginLeft: isNarrow ? "78px" : "104px", marginTop: "-16px", color: "#555", fontSize: "11px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.email && p.email !== "N/A"
                      ? p.email
                      : ` ${p.childRelationship || "N/A"}: ${p.childName || "N/A"}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR */}
        {selectedParent && sidebarVisible && (
          <aside
            className="parent-info-sidebar"
            style={{
              width: isPortrait ? "100%" : "30%",
              position: "fixed",
              left: isPortrait ? 0 : "auto",
              right: 0,
              top: isPortrait ? 0 : "55px",
              height: isPortrait ? "100vh" : "calc(100vh - 55px)",
              background: "#ffffff",
              boxShadow: "0 0 18px rgba(0,0,0,0.08)",
              borderLeft: isPortrait ? "none" : "1px solid #e5e7eb",
              zIndex: 300,
              display: "flex",
              flexDirection: "column",
              fontSize: "10px",
            }}
          >
            {/* CLOSE BUTTON */}
            <div style={{ position: "absolute", top: 0, left: 22, zIndex: 999 }}>
              <button
                onClick={() => setSidebarVisible(false)}
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

            {/* SCROLLABLE CONTENT */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
              {/* HEADER */}
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
                    src={selectedParent.profileImage}
                    alt={selectedParent.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <h2 style={{ margin: 0, color: "#111827", fontSize: 14 }}>{selectedParent.name}</h2>
                <p style={{ margin: "4px 0", color: "#6b7280", fontSize: "10px" }}>{selectedParent.email}</p>
              </div>

              {/* TABS */}
              <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: "10px" }}>
                {[
                  { key: "Details", label: "DETAILS" },
                  { key: "Children", label: "CHILDREN" },
                  { key: "Status", label: "STATUS" },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setParentTab(t.key)}
                    style={{
                      flex: 1,
                      padding: "6px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                      color: parentTab === t.key ? "#4b6cb7" : "#6b7280",
                      fontSize: "10px",
                      borderBottom: parentTab === t.key ? "3px solid #4b6cb7" : "3px solid transparent",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* TAB CONTENT */}
              <div style={{ paddingBottom: 40 }}>
                {parentTab === "Details" && selectedParent && (
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
                    <h3 style={{ margin: 0, marginBottom: 6, color: "#0f172a", fontWeight: 800, letterSpacing: "0.1px", fontSize: 12, textAlign: "left" }}>
                      Parent Profile
                    </h3>
                    <div style={{ color: "#64748b", fontSize: 9, textAlign: "left", marginBottom: 10 }}>
                      ID: <b style={{ color: "#111827" }}>{selectedParent.userId}</b>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[
                        { label: "Email", value: selectedParent.email || "N/A" },
                        { label: "Phone", value: selectedParent.phone || "N/A" },
                        { label: "Age", value: selectedParent.age || "—" },
                        { label: "City", value: selectedParent.city || (selectedParent.address && typeof selectedParent.address === 'object' ? selectedParent.address.city : selectedParent.city) || "—" },
                        { label: "Citizenship", value: selectedParent.citizenship || "—" },
                        { label: "Job", value: selectedParent.job || "—" },
                        { label: "Status", value: selectedParent.status ? (selectedParent.status.charAt(0).toUpperCase() + selectedParent.status.slice(1)) : "—" },
                        { label: "Address", value: (typeof selectedParent.address === 'string' ? selectedParent.address : (selectedParent.address && (selectedParent.address.street || selectedParent.address.city || JSON.stringify(selectedParent.address))) ) || "—" },
                      ].map((item) => (
                        <div
                          key={item.label}
                          style={{
                            alignItems: "center",
                            justifyContent: "flex-start",
                            display: "flex",
                            background: "#ffffff",
                            padding: "8px",
                            borderRadius: 10,
                            border: "1px solid #eef2f7",
                            minHeight: 36,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.4px", color: "#64748b", textTransform: "uppercase" }}>
                              {item.label}
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: item.label === "Status" ? (item.value && String(item.value).toLowerCase() === "active" ? "#16a34a" : "#991b1b") : "#111", marginTop: 2, wordBreak: "break-word" }}>
                              {item.value || <span style={{ color: "#d1d5db" }}>N/A</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {parentTab === "Children" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {children.length === 0 ? (
                      <div style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280" }}>
                        No children found.
                      </div>
                    ) : (
                      children.map((c) => (
                        <div
                          key={c.studentId}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px",
                            borderRadius: 12,
                            border: "1px solid #e5e7eb",
                            background: "#fff",
                            boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
                          }}
                        >
                          <img
                            src={c.profileImage}
                            alt={c.name}
                            style={{ width: 44, height: 44, borderRadius: 22, objectFit: "cover", border: "2px solid #4b6cb7" }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "#111827", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {c.name}
                            </div>
                            <div style={{ fontSize: 10, color: "#6b7280" }}>
                              Grade {c.grade}{c.section ? ` • ${c.section}` : ""}
                              {` • Relation: ${c.relationship || "N/A"}`}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {parentTab === "Status" && (
                  <div style={{ padding: "12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[
                        { label: "Status", value: selectedParent.status || "Active" },
                        { label: "Created", value: selectedParent.createdAt ? new Date(selectedParent.createdAt).toLocaleString() : "—" },
                      ].map((item) => (
                        <div key={item.label} style={{ padding: 8, borderRadius: 10, border: "1px solid #eef2f7", background: "#fff" }}>
                          <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.4px", color: "#64748b", textTransform: "uppercase" }}>{item.label}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#111827", marginTop: 2, wordBreak: "break-word" }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Chat button & Popup - matches Teachers styling */}
              {!parentChatOpen && (
                <div
                  onClick={() => setParentChatOpen(true)}
                  style={{
                    position: "fixed",
                    bottom: "20px",
                    right: "20px",
                    width: "56px",
                    height: "56px",
                    background: "#4b6cb7",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    cursor: "pointer",
                    zIndex: 1000,
                    boxShadow: "0 8px 18px rgba(0,0,0,0.20)",
                    transition: "transform 0.2s ease",
                  }}
                >
                  <FaCommentDots size={30} />
                </div>
              )}

            {parentChatOpen && selectedParent && (
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
                  <div style={{ padding: "14px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#e0e7ff" }}>
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                      <strong>{selectedParent.name}</strong>
                      {typingUserId && String(typingUserId) === String(selectedParent.userId) && (
                        <small style={{ color: '#0b78f6', marginTop: 4 }}>Typing…</small>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        onClick={() => {
                          setParentChatOpen(false);
                          navigate("/all-chat", { state: { user: selectedParent, tab: "parent" } });
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px" }}
                      >
                        ⤢
                      </button>
                      <button onClick={() => setParentChatOpen(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>×</button>
                    </div>
                  </div>

                  {/* Messages */}
                  <div style={{ flex: 1, padding: "12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", background: "#f8fafc" }}>
                    {messages.length === 0 ? (
                      <p style={{ textAlign: "center", color: "#aaa" }}>Start chatting with {selectedParent.name}</p>
                    ) : (
                      messages.map((m) => {
                        const isAdmin = String(m.senderId) === String(admin.userId);
                        return (
                          <div key={m.messageId || m.id} style={{ display: "flex", flexDirection: "column", alignItems: isAdmin ? "flex-end" : "flex-start", marginBottom: 10 }}>
                            <div style={{ maxWidth: "70%", background: isAdmin ? "#4b6cb7" : "#fff", color: isAdmin ? "#fff" : "#111827", padding: "10px 14px", borderRadius: 18, borderTopRightRadius: isAdmin ? 0 : 18, borderTopLeftRadius: isAdmin ? 18 : 0, boxShadow: "0 1px 3px rgba(0,0,0,0.10)", wordBreak: "break-word", cursor: "default", position: "relative", border: isAdmin ? "none" : "1px solid #e5e7eb" }}>
                              {m.text} {m.edited && (<small style={{ fontSize: 10 }}> (edited)</small>)}
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 6, fontSize: 11, color: isAdmin ? "#fff" : "#888" }}>
                                <span style={{ marginRight: 6, fontSize: 11, opacity: 0.9 }}>{formatDateLabel(m.timeStamp)}</span>
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
                  <div style={{ padding: "10px", borderTop: "1px solid #e5e7eb", display: "flex", gap: "8px", background: "#fff" }}>
                    <input value={newMessageText} onChange={(e) => { setNewMessageText(e.target.value); handleTyping(e.target.value); }} placeholder="Type a message..." style={{ flex: 1, padding: "10px 14px", borderRadius: "25px", border: "1px solid #ccc", outline: "none" }} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(newMessageText); }} />
                    <button onClick={() => sendMessage(newMessageText)} style={{ width: 45, height: 45, borderRadius: "50%", background: "#4b6cb7", border: "none", color: "#fff", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
                      <FaPaperPlane />
                    </button>
                  </div>
                </div>
              )}   
            </div>
          </aside>
        )}

      </div>
    </div>
  );
}

export default Parent;