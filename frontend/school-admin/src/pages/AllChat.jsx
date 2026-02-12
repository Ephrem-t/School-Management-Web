import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPaperPlane } from "react-icons/fa";
import { getDatabase, ref, onValue, push, set, update, get } from "firebase/database";
import { db } from "../firebase";
import "../styles/global.css";

function AllChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const admin = JSON.parse(localStorage.getItem("admin")) || {};
  const adminUserId = admin.userId;

  const getChatKey = (a, b) => [a, b].sort().join("_");

  const getChatKeyA = (a, b) => `${a}_${b}`;
  const getChatKeyB = (a, b) => `${b}_${a}`;

  const resolveChatKey = async (otherUserId) => {
    if (!adminUserId || !otherUserId) return getChatKey(adminUserId, otherUserId);

    const kSorted = getChatKey(adminUserId, otherUserId);
    const k1 = getChatKeyA(adminUserId, otherUserId);
    const k2 = getChatKeyB(adminUserId, otherUserId);

    try {
      const [sSorted, s1, s2] = await Promise.all([
        get(ref(db, `Chats/${kSorted}`)).catch(() => null),
        get(ref(db, `Chats/${k1}`)).catch(() => null),
        get(ref(db, `Chats/${k2}`)).catch(() => null),
      ]);

      const candidates = [
        { key: kSorted, snap: sSorted },
        { key: k1, snap: s1 },
        { key: k2, snap: s2 },
      ].filter(x => x.snap && x.snap.exists());

      if (!candidates.length) return kSorted;

      // Prefer the candidate with the newest lastMessage
      let best = candidates[0];
      let bestTs = Number(best.snap.val()?.lastMessage?.timeStamp || 0);
      for (const c of candidates.slice(1)) {
        const ts = Number(c.snap.val()?.lastMessage?.timeStamp || 0);
        if (ts > bestTs) {
          best = c;
          bestTs = ts;
        }
      }
      return best.key;
    } catch {
      return kSorted;
    }
  };

  const markChatAsRead = async (chatRefKey, otherUserId) => {
    if (!chatRefKey || !adminUserId || !otherUserId) return;
    try {
      // 1) Clear unread count for admin
      const unreadSnap = await get(ref(db, `Chats/${chatRefKey}/unread`)).catch(() => null);
      const unreadObj = unreadSnap?.exists() ? (unreadSnap.val() || {}) : {};
      if (Number(unreadObj?.[adminUserId] || 0) !== 0) {
        await update(ref(db, `Chats/${chatRefKey}`), {
          unread: { ...unreadObj, [adminUserId]: 0 },
        }).catch(() => {});
      }

      // 2) Mark messages as seen for admin
      const msgsSnap = await get(ref(db, `Chats/${chatRefKey}/messages`)).catch(() => null);
      if (!msgsSnap?.exists()) return;

      const updates = {};
      Object.entries(msgsSnap.val() || {}).forEach(([id, m]) => {
        if (String(m?.receiverId) === String(adminUserId) && m?.seen === false) {
          updates[`Chats/${chatRefKey}/messages/${id}/seen`] = true;
        }
      });

      if (Object.keys(updates).length) {
        await update(ref(db), updates).catch(() => {});
        await update(ref(db, `Chats/${chatRefKey}/lastMessage`), { seen: true }).catch(() => {});
      }
    } catch (e) {
      // ignore
    }
  };

  const { userId, userType, name, profileImage } = location.state || {};
  const passedUser = location.state?.user || null;

  // State
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [selectedTab, setSelectedTab] = useState("teacher");
  const [selectedChatUser, setSelectedChatUser] = useState(passedUser);
  const [popupMessages, setPopupMessages] = useState([]);
  const [popupInput, setPopupInput] = useState("");
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [typing, setTyping] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const chatEndRef = useRef(null);
  const typingRef = useRef(null);

  // ------------------- Fetch users with unread badge -------------------
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const [teachersRes, studentsRes, parentsRes, usersRes, chatsRes] = await Promise.all([
          fetch("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json").then(res => res.json()),
          fetch("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json").then(res => res.json()),
          fetch("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Parents.json").then(res => res.json()),
          fetch("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json").then(res => res.json()),
          fetch("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats.json").then(res => res.json())
        ]);

        const usersData = usersRes || {};
        const chatsData = chatsRes || {};

        const pickChatRecord = (otherUserId) => {
          const kSorted = getChatKey(adminUserId, otherUserId);
          const k1 = getChatKeyA(adminUserId, otherUserId);
          const k2 = getChatKeyB(adminUserId, otherUserId);
          const records = [
            { key: kSorted, rec: chatsData?.[kSorted] },
            { key: k1, rec: chatsData?.[k1] },
            { key: k2, rec: chatsData?.[k2] },
          ].filter(x => x.rec);
          if (!records.length) return { key: kSorted, rec: null };
          return records.reduce((best, cur) => {
            const bts = Number(best?.rec?.lastMessage?.timeStamp || 0);
            const cts = Number(cur?.rec?.lastMessage?.timeStamp || 0);
            return cts > bts ? cur : best;
          }, records[0]);
        };

        const formatUsers = (listData) =>
          Object.keys(listData || {}).map(id => {
            const userId = listData[id]?.userId;
            const user = usersData?.[userId] || {};
            const picked = pickChatRecord(userId);
            const unread = picked?.rec?.unread?.[adminUserId] || 0;
            const lastMsg = picked?.rec?.lastMessage || null;

            return {
              id,
              userId,
              name: user.name || "No Name",
              profileImage: user.profileImage || "/default-profile.png",
              lastMsgTime: lastMsg?.timeStamp || 0,
              lastMsgText: lastMsg?.text || "",
              lastSeen: user.lastSeen || null,
              unread,
              chatKey: picked?.key || getChatKey(adminUserId, userId),
            };
          }).sort((a, b) => b.lastMsgTime - a.lastMsgTime);

        setTeachers(formatUsers(teachersRes));
        setStudents(formatUsers(studentsRes));
        setParents(formatUsers(parentsRes));
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };

    fetchUsers();
  }, [adminUserId]);

  // ------------------- Select default user -------------------
  useEffect(() => {
    if (!selectedChatUser) {
      const firstUser = teachers[0] || students[0] || parents[0] || null;
      setSelectedChatUser(firstUser);
    }
  }, [teachers, students, parents]);

  // ------------------- Real-time messages -------------------
  useEffect(() => {
    if (!selectedChatUser || !adminUserId) return;
    const dbInst = getDatabase();
    let unsubMessages = () => {};
    let unsubTyping = () => {};
    let unsubLastSeen = () => {};
    let active = true;

    (async () => {
      const chatRefKey = await resolveChatKey(selectedChatUser.userId);
      if (!active) return;

      const messagesRef = ref(dbInst, `Chats/${chatRefKey}/messages`);
      const typingRefDB = ref(dbInst, `Chats/${chatRefKey}/typing`);
      const lastSeenRef = ref(dbInst, `Users/${selectedChatUser.userId}/lastSeen`);

      unsubMessages = onValue(messagesRef, (snapshot) => {
        const data = snapshot.val();
        const msgs = data
          ? Object.entries(data).map(([id, m]) => ({ ...m, id, sender: m.senderId === adminUserId ? "admin" : "user" }))
          : [];
        setPopupMessages(msgs.sort((a, b) => a.timeStamp - b.timeStamp));
      });

      unsubTyping = onValue(typingRefDB, (snapshot) => {
        const val = snapshot.val();
        setTyping(selectedChatUser.userId === val?.userId);
      });

      unsubLastSeen = onValue(lastSeenRef, (snapshot) => {
        setLastSeen(snapshot.val());
      });

      // Clear unread for admin when opening chat
      await markChatAsRead(chatRefKey, selectedChatUser.userId);
    })();

    return () => {
      active = false;
      try { unsubMessages(); } catch {}
      try { unsubTyping(); } catch {}
      try { unsubLastSeen(); } catch {}
    };
  }, [selectedChatUser?.userId, adminUserId]);

  // ------------------- Send/Edit message -------------------
  const sendPopupMessage = async () => {
    if (!popupInput.trim() || !selectedChatUser) return;

    const chatRefKey = await resolveChatKey(selectedChatUser.userId);

    const messagesRef = ref(db, `Chats/${chatRefKey}/messages`);
    const chatRef = ref(db, `Chats/${chatRefKey}`);

    const newMsg = {
      senderId: adminUserId,
      receiverId: selectedChatUser.userId,
      type: "text",
      text: popupInput,
      imageUrl: null,
      replyTo: null,
      seen: false,
      edited: false,
      deleted: false,
      timeStamp: Date.now()
    };

    if (editingMsgId) {
      await update(ref(db, `Chats/${chatRefKey}/messages/${editingMsgId}`), { text: popupInput, edited: true });
      // If editing the last message, keep lastMessage in sync
      try {
        const lastSnap = await get(ref(db, `Chats/${chatRefKey}/lastMessage`));
        if (lastSnap.exists() && lastSnap.val()?.messageId === editingMsgId) {
          await update(ref(db, `Chats/${chatRefKey}/lastMessage`), { text: popupInput, edited: true });
        }
      } catch {
        // ignore
      }
      setEditingMsgId(null);
    } else {
      const msgRef = push(messagesRef);
      await set(msgRef, newMsg);

      const unreadSnap = await get(ref(db, `Chats/${chatRefKey}/unread`)).catch(() => null);
      const unreadObj = unreadSnap?.exists() ? (unreadSnap.val() || {}) : {};
      const receiverPrev = Number(unreadObj?.[selectedChatUser.userId] || 0);

      await update(chatRef, {
        lastMessage: { ...newMsg, messageId: msgRef.key },
        participants: { [adminUserId]: true, [selectedChatUser.userId]: true },
        unread: { ...unreadObj, [adminUserId]: 0, [selectedChatUser.userId]: receiverPrev + 1 },
      });
    }

    setPopupInput("");
  };

  // ------------------- Delete message -------------------
  const deleteMessage = async (msgId) => {
    if (!selectedChatUser) return;
    const chatRefKey = await resolveChatKey(selectedChatUser.userId);
    const msgRef = ref(db, `Chats/${chatRefKey}/messages/${msgId}`);
    await update(msgRef, { deleted: true });

    // Update lastMessage if deleted
    const lastMsgSnapshot = await get(ref(db, `Chats/${chatRefKey}/lastMessage`));
    if (lastMsgSnapshot.exists() && lastMsgSnapshot.val().messageId === msgId) {
      const messagesSnapshot = await get(ref(db, `Chats/${chatRefKey}/messages`));
      const messages = messagesSnapshot.exists() ? Object.entries(messagesSnapshot.val()).map(([id, m]) => ({ ...m, id })) : [];
      const lastMsg = messages.filter(m => !m.deleted).sort((a, b) => b.timeStamp - a.timeStamp)[0] || null;
      await update(ref(db, `Chats/${chatRefKey}`), { lastMessage: lastMsg ? { ...lastMsg, messageId: lastMsg.id } : null });
    }
  };

  // ------------------- Typing -------------------
  const handleTyping = async (e) => {
    setPopupInput(e.target.value);
    if (!selectedChatUser) return;

    const chatRefKey = await resolveChatKey(selectedChatUser.userId);

    const typingRefDB = ref(db, `Chats/${chatRefKey}/typing`);
    await set(typingRefDB, { userId: adminUserId });

    if (typingRef.current) clearTimeout(typingRef.current);
    typingRef.current = setTimeout(async () => {
      await set(typingRefDB, { userId: null });
    }, 2000);
  };

  // ------------------- Scroll to bottom -------------------
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [popupMessages, typing]);

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    return new Date(Number(timestamp)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // TELEGRAM-LIKE UNREAD BADGE, left of avatar
  const renderUserList = (users) =>
    users
      .filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .map(u => (
        <div
          key={u.userId}
          onClick={() => setSelectedChatUser(u)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 10,
            borderRadius: 8,
            background: selectedChatUser?.userId === u.userId ? "#d0e6ff" : "#fff",
            cursor: "pointer",
            marginBottom: 8,
            position: "relative",
            transition: "0.2s all"
          }}
        >
          {u.unread > 0 && (
            <span
              style={{
                marginRight: 7,
                minWidth: 22,
                height: 22,
                background: "#f44336",
                color: "#fff",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 13,
                boxShadow: "0 1px 8px rgba(255,0,0,0.11)"
              }}
            >
              {u.unread > 99 ? "99+" : u.unread}
            </span>
          )}
          <img src={u.profileImage} alt={u.name} style={{ width: 40, height: 40, borderRadius: "50%" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>{u.name}</div>
            <div style={{ fontSize: 12, color: "#888" }}>{u.lastMsgText?.slice(0, 30)}...</div>
          </div>
          <span
            style={{
              minWidth: 10,
              height: 10,
              borderRadius: "50%",
              background: u.lastSeen && Date.now() - u.lastSeen < 60000 ? "green" : "gray"
            }}
          />
        </div>
      ));

  return (
    <div style={{ display: "flex", height: "100vh", background: "#e5ddd5" }}>
      {/* Sidebar */}
      <div style={{ width: 300, background: "#fff", borderRight: "1px solid #ddd", overflowY: "auto", padding: 15 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 15 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: "#0084ff", color: "#fff", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer", marginRight: 10 }}
          >
            <FaArrowLeft />
          </button>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1, padding: 8, borderRadius: 20, border: "1px solid #ccc", outline: "none" }}
          />
        </div>

        <div style={{ display: "flex", marginBottom: 15, gap: 5 }}>
          {["teacher", "student", "parent"].map(tab => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              style={{
                flex: 1,
                padding: 8,
                borderRadius: 20,
                border: "none",
                cursor: "pointer",
                background: selectedTab === tab ? "#0084ff" : "#f0f0f0",
                color: selectedTab === tab ? "#fff" : "#000"
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {selectedTab === "teacher" && renderUserList(teachers)}
        {selectedTab === "student" && renderUserList(students)}
        {selectedTab === "parent" && renderUserList(parents)}
      </div>

      {/* Chat Box */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 15 }}>
        {selectedChatUser ? (
          <>
            {/* Header */}
            <div style={{ padding: 10, borderBottom: "1px solid #ddd", display: "flex", alignItems: "center", gap: 10, background: "#f0f2f5", borderRadius: 10, marginBottom: 10 }}>
              <img src={selectedChatUser.profileImage} alt={selectedChatUser.name} style={{ width: 40, height: 40, borderRadius: "50%" }} />
              <div>
                <strong>{selectedChatUser.name}</strong>
                <div style={{ fontSize: 12, color: "#666" }}>
                  {typing ? "Typing..." : lastSeen ? `Last seen: ${new Date(lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: 15, display: "flex", flexDirection: "column", gap: 10, background: "#e5ddd5", borderRadius: 10 }}>
              {popupMessages.length === 0 ? (
                <p style={{ color: "#888", textAlign: "center", marginTop: 20 }}>Start chatting with {selectedChatUser.name}...</p>
              ) : popupMessages.map(m => {
                const isAdmin = m.sender === "admin";
                const isSelected = activeMessageId === m.id;
                if (m.deleted) return null;

                return (
                  <div
                    key={m.id}
                    onClick={() => setActiveMessageId(m.id)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isAdmin ? "flex-end" : "flex-start",
                      marginBottom: 12,
                    }}
                  >
                    {/* Message Bubble */}
                    <div
                      style={{
                        background: isAdmin ? "#0084ff" : "#e4e6eb",
                        color: isAdmin ? "#fff" : "#000",
                        padding: "8px 12px",
                        borderRadius: 16,
                        borderTopRightRadius: isAdmin ? 0 : 16,
                        borderTopLeftRadius: isAdmin ? 16 : 0,
                        maxWidth: "45%",
                        wordBreak: "break-word",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div>{m.text}</div>
                      {m.edited && <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>edited</div>}
                      <div style={{ fontSize: 10, opacity: 0.7, display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
                        <span>{formatTime(m.timeStamp)}</span>
                        {isAdmin && <span>{m.seen ? "✔✔" : "✔"}</span>}
                      </div>
                    </div>

                    {/* Edit/Delete Buttons (under the bubble) */}
                    {isSelected && isAdmin && (
                      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        <button
                          onClick={() => { setPopupInput(m.text); setEditingMsgId(m.id); }}
                          style={{ fontSize: 12 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMessage(m.id)}
                          style={{ fontSize: 12, color: "red" }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={chatEndRef}></div>
            </div>

            {/* Input */}
            <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid #ddd" }}>
              <input
                value={popupInput}
                onChange={handleTyping}
                onKeyDown={e => e.key === "Enter" && sendPopupMessage()}
                placeholder="Type a message..."
                style={{ flex: 1, padding: "12px 16px", borderRadius: 30, border: "1px solid #ccc", outline: "none", background: "#fff" }}
              />
              <button onClick={sendPopupMessage} style={{ background: "#0084ff", border: "none", color: "#fff", borderRadius: "50%", width: 45, height: 45, display: "flex", justifyContent: "center", alignItems: "center" }}>
                <FaPaperPlane />
              </button>
            </div>
          </>
        ) : (
          <p style={{ color: "#555", textAlign: "center", marginTop: "50%" }}>Select a user to start chatting...</p>
        )}
      </div>
    </div>
  );
}

export default AllChat;