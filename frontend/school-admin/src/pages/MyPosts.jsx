import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { AiFillPicture } from "react-icons/ai";
import {
  FaHome,
  FaFileAlt,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaFacebookMessenger,
  FaCalendarAlt,
} from "react-icons/fa";
import "../styles/global.css";
import { BACKEND_BASE } from "../config.js";

function MyPosts() {
  const API_BASE = `${BACKEND_BASE}/api`;
  const [posts, setPosts] = useState([]);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedContent, setEditedContent] = useState("");
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState(null);
  const fileInputRef = useRef(null);
  const [teachers, setTeachers] = useState([]);
  const [unreadTeachers, setUnreadTeachers] = useState({});
  const [popupMessages, setPopupMessages] = useState([]);
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  const [unreadSenders, setUnreadSenders] = useState({});
  const [postNotifications, setPostNotifications] = useState([]);
  const [showPostDropdown, setShowPostDropdown] = useState(false);

  // loading states for edit/delete
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();

  // Read admin from localStorage
  let admin = {};
  try {
    admin = JSON.parse(localStorage.getItem("admin")) || {};
  } catch (e) {
    admin = {};
  }
  const adminId = admin?.userId || null;
  const token =
    admin?.token ||
    admin?.accessToken ||
    admin?.idToken ||
    admin?.apiKey ||
    null;

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      axios.defaults.headers.common["x-access-token"] = token;
    } else {
      delete axios.defaults.headers.common["Authorization"];
      delete axios.defaults.headers.common["x-access-token"];
    }
  }, [token]);

  const RTDB_BASE = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";

  // counts for badges
  const messageCount = Object.values(unreadSenders || {}).reduce((acc, s) => acc + (s.count || 0), 0);
  const totalNotifications = (postNotifications?.length || 0) + messageCount;

  const markMessagesAsSeen = async (userId) => {
    if (!admin?.userId) return;

    try {
      const key1 = `${admin.userId}_${userId}`;
      const key2 = `${userId}_${admin.userId}`;

      const [r1, r2] = await Promise.all([
        axios.get(`${RTDB_BASE}/Chats/${key1}/messages.json`),
        axios.get(`${RTDB_BASE}/Chats/${key2}/messages.json`),
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
        await axios.patch(`${RTDB_BASE}/.json`, updates);
      }
    } catch (err) {
      console.warn("markMessagesAsSeen failed", err);
    }
  };

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
        axios.get(`${RTDB_BASE}/Users.json`),
        axios.get(`${RTDB_BASE}/School_Admins.json`),
      ]);

      const users = usersRes.data || {};
      const admins = adminsRes.data || {};

      const findAdminUser = (adminId) => {
        const admin = admins[adminId];
        if (!admin) return null;
        return Object.values(users).find((u) => u.userId === admin.userId);
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

  // ---------------- FETCH UNREAD MESSAGES ----------------
  const fetchUnreadMessages = async () => {
    if (!admin?.userId) return;

    const senders = {};

    try {
      // load all users for names/images
      const usersRes = await axios.get(`${RTDB_BASE}/Users.json`);
      const usersData = usersRes.data || {};

      const findUserByUserId = (userId) => Object.values(usersData).find(u => u.userId === userId);

      const getUnreadCount = async (userId) => {
        const key1 = `${admin.userId}_${userId}`;
        const key2 = `${userId}_${admin.userId}`;

        const [r1, r2] = await Promise.all([
          axios.get(`${RTDB_BASE}/Chats/${key1}/messages.json`).catch(() => ({ data: {} })),
          axios.get(`${RTDB_BASE}/Chats/${key2}/messages.json`).catch(() => ({ data: {} })),
        ]);

        const msgs = [...Object.values(r1.data || {}), ...Object.values(r2.data || {})];
        return msgs.filter(m => m.receiverId === admin.userId && !m.seen).length;
      };

      // Teachers
      const teachersRes = await axios.get(`${RTDB_BASE}/Teachers.json`).catch(() => ({ data: {} }));
      for (const k in teachersRes.data || {}) {
        const t = teachersRes.data[k];
        const unread = await getUnreadCount(t.userId);
        if (unread > 0) {
          const user = findUserByUserId(t.userId);
          senders[t.userId] = {
            type: 'teacher',
            name: user?.name || 'Teacher',
            profileImage: user?.profileImage || '/default-profile.png',
            count: unread,
          };
        }
      }

      // Students
      const studentsRes = await axios.get(`${RTDB_BASE}/Students.json`).catch(() => ({ data: {} }));
      for (const k in studentsRes.data || {}) {
        const s = studentsRes.data[k];
        const unread = await getUnreadCount(s.userId);
        if (unread > 0) {
          const user = findUserByUserId(s.userId);
          senders[s.userId] = {
            type: 'student',
            name: user?.name || s.name || 'Student',
            profileImage: user?.profileImage || s.profileImage || '/default-profile.png',
            count: unread,
          };
        }
      }

      // Parents
      const parentsRes = await axios.get(`${RTDB_BASE}/Parents.json`).catch(() => ({ data: {} }));
      for (const k in parentsRes.data || {}) {
        const p = parentsRes.data[k];
        const unread = await getUnreadCount(p.userId);
        if (unread > 0) {
          const user = findUserByUserId(p.userId);
          senders[p.userId] = {
            type: 'parent',
            name: user?.name || p.name || 'Parent',
            profileImage: user?.profileImage || p.profileImage || '/default-profile.png',
            count: unread,
          };
        }
      }

      setUnreadSenders(senders);
    } catch (err) {
      console.error('Unread fetch failed:', err);
    }
  };

  useEffect(() => {
    if (!admin?.userId) return;
    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 5000);
    return () => clearInterval(interval);
  }, [admin?.userId]);

  useEffect(() => {
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

    setPostNotifications((prev) =>
      prev.filter((n) => n.notificationId !== notification.notificationId)
    );

    setShowPostDropdown(false);

    navigate("/dashboard", {
      state: { postId: notification.postId },
    });
  };

  const fetchMyPosts = async () => {
    if (!adminId) return;
    try {
      const res = await axios.get(`${API_BASE}/get_my_posts/${adminId}`);
      const postsArray = Array.isArray(res.data)
        ? res.data
        : Object.entries(res.data || {}).map(([key, post]) => ({
            postId: key,
            ...post,
          }));

      const mappedPosts = postsArray
        .map((p) => {
          const parsedTime = p.time ? new Date(p.time) : new Date();
          const postId = p.postId || p.id || "";
          return {
            postId: postId || String(p?.postId || p?.id || ""),
            message: p.message || p.postText || "",
            postUrl: p.postUrl || p.mediaUrl || p.postUrl || null,
            time: parsedTime.toLocaleString(),
            parsedTime,
            edited: p.edited || false,
            likeCount: Number(p.likeCount) || 0,
            likes: p.likes || {},
            adminId: p.adminId || adminId,
          };
        })
        .sort((a, b) => b.parsedTime - a.parsedTime);

      setPosts(mappedPosts);
    } catch (err) {
      console.error("Error fetching posts:", err.response?.data || err);
    }
  };

  useEffect(() => {
    if (!adminId) return;
    fetchMyPosts();
    const interval = setInterval(fetchMyPosts, 10000);
    return () => clearInterval(interval);
  }, [adminId]);

  const handlePost = async () => {
    if (!postText && !postMedia) return;
    try {
      const formData = new FormData();
      formData.append("adminId", adminId);
      formData.append("postText", postText);
      if (postMedia) formData.append("postMedia", postMedia);

      await axios.post(`${API_BASE}/create_post`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setPostText("");
      setPostMedia(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchMyPosts();
    } catch (err) {
      console.error("Error creating post:", err.response?.data || err);
      alert("Create post failed: " + (err.response?.data?.message || err.message || "See console"));
    }
  };

  const handleEdit = (postId, currentContent) => {
    setEditingPostId(postId);
    setEditedContent(currentContent || "");
  };

  const saveEdit = async (postId) => {
    if (!postId) return;
    if (!adminId) return;
    const trimmed = (editedContent || "").trim();
    if (trimmed.length === 0) {
      alert("Post content cannot be empty.");
      return;
    }
    setSavingId(postId);

    // Try Firebase first
    try {
      const payload = {
        message: trimmed,
        edited: true,
        editedAt: new Date().toISOString(),
        lastEditedBy: adminId,
      };
      const firebaseUrl = `${RTDB_BASE}/Posts/${encodeURIComponent(postId)}.json`;
      await axios.patch(firebaseUrl, payload);
      setPosts((prev) =>
        prev.map((post) =>
          post.postId === postId ? { ...post, message: trimmed, edited: true } : post
        )
      );
      setEditingPostId(null);
      setEditedContent("");
      setSavingId(null);
      return;
    } catch (err) {
      // fallback to backend
    }

    try {
      const url = `${API_BASE}/edit_post/${postId}`;
      const payload = { adminId, postText: trimmed, message: trimmed };
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        headers["x-access-token"] = token;
      }
      const res = await axios.post(url, payload, { headers });
      if (res.data && res.data.success === false) {
        throw new Error(res.data.message || "Edit failed on backend");
      }
      setPosts((prev) =>
        prev.map((post) =>
          post.postId === postId ? { ...post, message: trimmed, edited: true } : post
        )
      );
      setEditingPostId(null);
      setEditedContent("");
    } catch (err) {
      console.error("[EDIT] Final error:", err.response?.status, err.response?.data || err.message || err);
      alert("Edit failed: " + (err.response?.data?.message || err.message || "See console"));
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (postId) => {
    if (!postId) return;
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    if (!adminId) return;
    setDeletingId(postId);

    try {
      const firebaseUrl = `${RTDB_BASE}/Posts/${encodeURIComponent(postId)}.json`;
      await axios.delete(firebaseUrl);
      setPosts((prev) => prev.filter((p) => p.postId !== postId));
      setDeletingId(null);
      return;
    } catch (err) {
      // fallback below
    }

    try {
      const url = `${API_BASE}/delete_post/${postId}`;
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        headers["x-access-token"] = token;
      }

      try {
        const rPost = await axios.post(url, { adminId }, { headers });
        if (rPost.data && rPost.data.success === false) throw new Error(rPost.data.message || "delete returned success:false");
        setPosts((prev) => prev.filter((p) => p.postId !== postId));
        setDeletingId(null);
        return;
      } catch (postErr) {
        // try delete with body
      }

      try {
        const rDelBody = await axios.delete(url, { data: { adminId }, headers });
        if (rDelBody.data && rDelBody.data.success === false) throw new Error(rDelBody.data.message || "delete returned success:false");
        setPosts((prev) => prev.filter((p) => p.postId !== postId));
        setDeletingId(null);
        return;
      } catch (delBodyErr) {
        // try delete with params
      }

      const rDelParam = await axios.delete(url, { params: { adminId }, headers });
      if (rDelParam.data && rDelParam.data.success === false) throw new Error(rDelParam.data.message || "delete returned success:false");
      setPosts((prev) => prev.filter((p) => p.postId !== postId));
    } catch (err) {
      console.error("[DELETE] Final error:", err.response?.status, err.response?.data || err.message || err);
      alert("Delete failed: " + (err.response?.data?.message || err.message || "See console"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleLike = async (postId) => {
    try {
      const res = await axios.post(`${API_BASE}/like_post`, {
        adminId,
        postId,
      });
      if (res.data.success) {
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.postId === postId
              ? {
                  ...post,
                  likeCount: res.data.likeCount,
                  likes: {
                    ...post.likes,
                    [adminId]: res.data.liked ? true : undefined,
                  },
                }
              : post
          )
        );
      }
    } catch (err) {
      console.error("Error liking post:", err.response?.data || err);
    }
  };

  useEffect(() => {
    const closeDropdown = (e) => {
      if (!e.target.closest(".icon-circle") && !e.target.closest(".messenger-dropdown")) {
        setShowMessageDropdown(false);
      }
    };
    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  useEffect(() => {
    const closeDropdown = (e) => {
      if (!e.target.closest(".icon-circle") && !e.target.closest(".notification-dropdown")) {
        setShowPostDropdown(false);
      }
    };
    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  return (
    <div className="dashboard-page">
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>

        <div className="nav-right">
          <div
            className="icon-circle"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              setShowPostDropdown((prev) => !prev);
            }}
          >
            <FaBell />
            {totalNotifications > 0 && (
              <span className="badge">{totalNotifications}</span>
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

          <div className="icon-circle" style={{ position: "relative", cursor: "pointer" }} onClick={() => navigate("/all-chat") }>
            <FaFacebookMessenger />
            {messageCount > 0 && <span className="badge">{messageCount}</span>}
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
              <img src={admin?.profileImage || "/default-profile.png"} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{admin?.name || "Admin Name"}</h3>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{admin?.adminId || "username"}</p>
          </div>

          <div className="sidebar-menu" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <Link className="sidebar-btn" to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
              <FaHome style={{ width: 18, height: 18 }} /> Home
            </Link>
            <Link className="sidebar-btn" to="/my-posts" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13, backgroundColor: '#4b6cb7', color: '#fff', borderRadius: 8 }}>
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
          className="main-content google-main"
          style={{
            padding: "10px 20px 20px",
            flex: 1,
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >
          {/* Post input box (same look as Dashboard) */}
          <div className="post-box">
            <div className="fb-post-top" style={{ display: "flex", gap: 12 }}>
              <img src={admin.profileImage || "/default-profile.png"} alt="me" />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea
                  placeholder="What's on your mind?"
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                />
                <div className="fb-post-bottom" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <label className="fb-upload" title="Upload media" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <AiFillPicture className="fb-icon" />
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files && e.target.files[0];
                        setPostMedia(file || null);
                      }}
                      accept="image/*,video/*"
                    />
                  </label>

                  {postMedia && (
                    <div
                      style={{
                        width: "20%",
                        minWidth: 140,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 10px",
                        background: "#f3f4f6",
                        borderRadius: 8,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        boxSizing: "border-box",
                      }}
                    >
                      <span style={{ fontSize: 13, color: "#111", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {postMedia.name}
                      </span>
                      <button
                        onClick={() => {
                          setPostMedia(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#6b7280",
                          cursor: "pointer",
                          fontSize: 16,
                          lineHeight: 1,
                        }}
                        aria-label="Remove selected media"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  <div style={{ marginLeft: "auto" }}>
                    <button className="telegram-send-icon" onClick={handlePost}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25" width="35" height="35" fill="#0088cc">
                        <path d="M2.01 21L23 12 2.01 3v7l15 2-15 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Posts container */}
          {posts.length === 0 ? (
            <p className="muted" style={{ textAlign: "center", padding: 10 }}>You have no posts yet.</p>
          ) : (
            <div className="posts-container">
              {posts.map((post) => (
                <div className="post-card" id={`post-${post.postId}`} key={post.postId}>
                  <div className="post-header">
                    <div className="img-circle">
                      <img src={admin.profileImage || "/default-profile.png"} alt="profile" />
                    </div>
                    <div className="post-info">
                      <h4>{admin.name || "Admin"}</h4>
                      <span>
                        {post.time}
                        {post.edited ? " (edited)" : ""}
                      </span>
                    </div>
                  </div>

                  {editingPostId === post.postId ? (
                    <div className="post-card-body">
                      <div className="edit-area">
                        <textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className="edit-textarea"
                        />
                        <div className="edit-actions">
                          <button onClick={() => saveEdit(post.postId)} disabled={savingId === post.postId} className="btn primary">
                            {savingId === post.postId ? "Saving..." : "Save"}
                          </button>
                          <button onClick={() => setEditingPostId(null)} className="btn muted">Cancel</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p>{post.message}</p>
                      {post.postUrl && <img src={post.postUrl} alt="post media" />}

                      <div className="post-card-actions">
                        <button onClick={() => handleEdit(post.postId, post.message)} className="btn warning">Edit</button>
                        <button onClick={() => handleDelete(post.postId)} disabled={deletingId === post.postId} className="btn danger">
                          {deletingId === post.postId ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MyPosts;