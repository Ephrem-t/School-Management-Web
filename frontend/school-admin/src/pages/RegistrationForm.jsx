	import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaFileAlt,
 
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaFacebookMessenger,
  FaSearch,
  FaCalendarAlt,
  FaChalkboardTeacher, FaUserFriends, FaLock, FaMobileAlt 
} from "react-icons/fa";
import axios from "axios";
import "../styles/login.css";
import { BACKEND_BASE } from "../config.js";

function SettingsPage() {
  const API_BASE = `${BACKEND_BASE}/api`;
  const [admin, setAdmin] = useState(
    JSON.parse(localStorage.getItem("admin")) || {}
  );
  const [selectedFile, setSelectedFile] = useState(null);
  const [profileImage, setProfileImage] = useState(
    admin.profileImage || "/default-profile.png"
  );
  

  const [name, setName] = useState(admin.name || "");
  const [username, setUsername] = useState(admin.username || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();
  const [unreadSenders, setUnreadSenders] = useState([]);
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);

  // POST NOTIFICATIONS
  const [postNotifications, setPostNotifications] = useState([]);
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const [hover, setHover] = useState({ teacher: false, parent: false, student: false });
  const adminId = admin.userId;

  // Fetch post notifications and enrich each with poster's name & profile image
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ------------------ rest of the component (unchanged) ------------------

 

  const toggleDropdown = () => {
    setShowMessageDropdown((prev) => !prev);
  };

  useEffect(() => {
    const closeDropdown = (e) => {
      setShowMessageDropdown(false);
    };

    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  useEffect(() => {
    const fetchUnreadSenders = async () => {
      try {
        const response = await fetch("/api/unreadSenders");
        const data = await response.json();
        setUnreadSenders(data);
      } catch (err) {
        // ignore
      }
    };
    fetchUnreadSenders();
  }, []);

  const handleClick = () => {
    navigate("/all-chat");
  };

  // ---------------- FETCH UNREAD MESSAGES ----------------
  const fetchUnreadMessages = async () => {
    if (!admin.userId) return;

    const senders = {};

    try {
      // 1) USERS (names & images)
      const usersRes = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"
      );
      const usersData = usersRes.data || {};

      const findUserByUserId = (userId) => {
        return Object.values(usersData).find((u) => u.userId === userId);
      };

      const getUnreadCount = async (userId) => {
        const key1 = `${admin.userId}_${userId}`;
        const key2 = `${userId}_${admin.userId}`;

        const [r1, r2] = await Promise.all([
          axios.get(
            `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key1}/messages.json`
          ),
          axios.get(
            `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key2}/messages.json`
          ),
        ]);

        const msgs = [...Object.values(r1.data || {}), ...Object.values(r2.data || {})];

        return msgs.filter((m) => m.receiverId === admin.userId && !m.seen).length;
      };

      // TEACHERS
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
            count: unread,
          };
        }
      }

      // STUDENTS
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
            count: unread,
          };
        }
      }

      // PARENTS
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
            count: unread,
          };
        }
      }

      setUnreadSenders(senders);
    } catch (err) {
      console.error("Unread fetch failed:", err);
    }
  };

  // ---------------- CLOSE DROPDOWN WHEN CLICKING OUTSIDE ----------------
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
    if (!admin.userId) return;

    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 5000);

    return () => clearInterval(interval);
  }, [admin.userId]);

  const markMessagesAsSeen = async (userId) => {
    const key1 = `${admin.userId}_${userId}`;
    const key2 = `${userId}_${admin.userId}`;

    const [r1, r2] = await Promise.all([
      axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key1}/messages.json`
      ),
      axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key2}/messages.json`
      ),
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

  // badge counts (match MyPosts UI)
  const messageCount = Object.values(unreadSenders || {}).reduce((acc, s) => acc + (s.count || 0), 0);
  const totalNotifications = (postNotifications?.length || 0) + messageCount;

	const container = {
		minHeight: "80vh",
		display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
		padding: 24,
    width: "100%",
    boxSizing: "border-box",
		background: "linear-gradient(180deg,#f6f8ff 0%, #ffffff 60%)",
	};

	const card = {
		width: "100%",
		maxWidth: 980,
		borderRadius: 16,
		boxShadow: "0 12px 40px rgba(16,24,48,0.12)",
		overflow: "hidden",
		display: "flex",
		fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
	};

	const left = {
		flex: 1,
		padding: 40,
		background: "linear-gradient(135deg,#0f172a 0%, #1e40af 100%)",
		color: "#fff",
		display: "flex",
		flexDirection: "column",
		gap: 12,
		justifyContent: "center",
	};

	const right = {
		flex: 1,
		padding: 36,
		background: "#fff",
		display: "flex",
		flexDirection: "column",
		gap: 14,
		justifyContent: "center",
	};

	const ctaBase = {
		flex: 1,
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		padding: "12px 18px",
		borderRadius: 12,
		fontWeight: 800,
		textDecoration: "none",
		transition: "transform 180ms ease, box-shadow 180ms ease",
		boxShadow: "0 6px 18px rgba(2,6,23,0.12)",
	};

	const teacherBtn = {
		...ctaBase,
		background: hover.teacher ? "linear-gradient(90deg,#ff7a18,#af002d)" : "#fff",
		color: hover.teacher ? "#fff" : "#0b2447",
		transform: hover.teacher ? "translateY(-4px)" : "none",
		display: "flex",
		gap: 10,
	};

	const parentBtn = {
		...ctaBase,
		background: hover.parent ? "rgba(255,255,255,0.06)" : "transparent",
		color: "#fff",
		border: hover.parent ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.06)",
		transform: hover.parent ? "translateY(-4px)" : "none",
		display: "flex",
		gap: 10,
	};

	const featureBox = {
		padding: 12,
		borderRadius: 10,
		textAlign: "center",
		boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.02)",
	};




  return (
    <div className="dashboard-page">
      {/* ---------------- TOP NAVIGATION BAR ---------------- */}
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>

        {/* Search Bar */}
   

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

          {/* Settings */}
          <Link className="icon-circle" to="/settings">
            <FaCog />
          </Link>

          {/* Profile */}
          <img
            src={admin.profileImage || "/default-profile.png"}
            alt="admin"
            className="profile-img"
          />
        </div>
      </nav>

      <div
        className="google-dashboard"
        
      >
        {/* SIDEBAR */}
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
            <Link className="sidebar-btn" to="/parents" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
              <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Parents
            </Link>
            <Link className="sidebar-btn" to="/registration-form" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13, backgroundColor: '#4b6cb7', color: '#fff', borderRadius: 8 }}>
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

        {/* MAIN CONTENT */}
        <div style={container}>
          <div style={{ marginLeft: 260, width: "100%" }}>
            <div style={{ marginLeft: 0, marginTop: -240, maxWidth: 900 }}>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: -0.5, textAlign: "left" }}>Registration Form</h1>
              <p style={{ margin: 0, opacity: 0.92, fontSize: 14, textAlign: "left" }}>Select the registration path that fits you. Teacher accounts collect course assignments; Parent accounts allow linking children to your profile.</p>

          <div className="reg-links" style={{ marginTop: 20 }}>
            <Link
              to="/teacher-register"
              className={`reg-card ${hover.teacher ? 'is-hover' : ''}`}
              onMouseEnter={() => setHover(h => ({ ...h, teacher: true }))}
              onMouseLeave={() => setHover(h => ({ ...h, teacher: false }))}
            >
              <div className="reg-icon">
                <FaChalkboardTeacher />
              </div>
              <div className="reg-content">
                <div className="reg-title">Teacher Registration</div>
                <div className="reg-sub">Create teacher account and assign courses</div>
              </div>
              <div className="reg-arrow">→</div>
            </Link>

            <Link
              to="/parent-register"
              className={`reg-card ${hover.parent ? 'is-hover' : ''}`}
              onMouseEnter={() => setHover(h => ({ ...h, parent: true }))}
              onMouseLeave={() => setHover(h => ({ ...h, parent: false }))}
            >
              <div className="reg-icon">
                <FaUserFriends />
              </div>
              <div className="reg-content">
                <div className="reg-title">Parent Registration</div>
                <div className="reg-sub">Link your children to your profile</div>
              </div>
              <div className="reg-arrow">→</div>
            </Link>

            <Link
              to="/student-register"
              className={`reg-card ${hover.student ? 'is-hover' : ''}`}
              onMouseEnter={() => setHover(h => ({ ...h, student: true }))}
              onMouseLeave={() => setHover(h => ({ ...h, student: false }))}
            >
              <div className="reg-icon">
                <FaUserFriends />
              </div>
              <div className="reg-content">
                <div className="reg-title">Student Registration</div>
                <div className="reg-sub">Create a student profile and ID</div>
              </div>
              <div className="reg-arrow">→</div>
            </Link>
 <Link
              to="/register"
              className={`reg-card ${hover.parent ? 'is-hover' : ''}`}
              onMouseEnter={() => setHover(h => ({ ...h, parent: true }))}
              onMouseLeave={() => setHover(h => ({ ...h, parent: false }))}
            >
              <div className="reg-icon">
                <FaUserFriends />
              </div>
              <div className="reg-content">
                <div className="reg-title">Management Registration</div>
                <div className="reg-sub">Create an account for administrators to manage the school and users.</div>
              </div>
              <div className="reg-arrow">→</div>
            </Link>


          </div>

				
				</div>

				
			</div>
		</div>
      </div>
    </div>
  );
}

export default SettingsPage;