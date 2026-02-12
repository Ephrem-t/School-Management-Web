import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  FaChevronLeft,
  FaChevronRight,
  FaCheckCircle,
  FaClock
} from "react-icons/fa";
import axios from "axios";
import { getDatabase, ref, onValue } from "firebase/database";
import app from "../firebase";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { BACKEND_BASE } from "../config.js";




function TeachersPage() {
  const API_BASE = `${BACKEND_BASE}/api`;
  const [teachers, setTeachers] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [searchTerm, setSearchTerm] = useState("");
  const [popupMessages, setPopupMessages] = useState([]);
  const [popupInput, setPopupInput] = useState("");
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [typingUserId, setTypingUserId] = useState(null);

  const formatDateLabel = (ts) => {
    if (!ts) return "";
    try { return new Date(ts).toLocaleDateString(); } catch { return ""; }
  };
  const formatTime = (ts) => {
    if (!ts) return "";
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ""; }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [popupMessages, teacherChatOpen]);
  const [teacherSchedule, setTeacherSchedule] = useState({}); // store schedule
  const [teacherDailyPlans, setTeacherDailyPlans] = useState([]);
  const [planSidebarTab, setPlanSidebarTab] = useState('daily'); // daily | weekly | monthly
  const [planWeeks, setPlanWeeks] = useState([]);
  const [planCurrentWeeks, setPlanCurrentWeeks] = useState([]); // per-course current week blocks
  const [planCurrentWeekIndex, setPlanCurrentWeekIndex] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState('');
  const [planSubmittedKeys, setPlanSubmittedKeys] = useState([]);
  const [planSidebarOpen, setPlanSidebarOpen] = useState(true);
  const [planRefreshKey, setPlanRefreshKey] = useState(0);
  const [planSelectedCourseId, setPlanSelectedCourseId] = useState('all');
  const [planCourseLabelMap, setPlanCourseLabelMap] = useState({});
  const [planAnnualOpen, setPlanAnnualOpen] = useState(false);

  const [showMessageDropdown, setShowMessageDropdown] = useState(false);

  const [unreadTeachers, setUnreadTeachers] = useState({});
  const [unreadSenders, setUnreadSenders] = useState({}); 
  const [postNotifications, setPostNotifications] = useState([]);
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const [selectedTeacherUser, setSelectedTeacherUser] = useState(null);
  const [isPortrait, setIsPortrait] = useState(typeof window !== "undefined" ? window.innerWidth < window.innerHeight : false);
  const [isNarrow, setIsNarrow] = useState(typeof window !== "undefined" ? window.innerWidth < 900 : false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const navigate = useNavigate();
  const admin = JSON.parse(localStorage.getItem("admin")) || {};
  const adminUserId = admin.userId;
  const adminId = admin.userId;
  const dbRT = getDatabase(app);
  const weekOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const nowDate = new Date(nowTick);
  const currentDayName = nowDate.toLocaleDateString("en-US", { weekday: "long" });
  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const RTDB_BASE = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";

  useEffect(() => {
    const tick = () => setNowTick(Date.now());
    const intervalId = setInterval(tick, 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  const getPeriodRangeMinutes = (label) => {
    if (!label) return null;
    const text = String(label);
    const match = text.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const toMinutes = (hStr, mStr) => {
      let h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      if (h < 8) h += 12; // afternoon/evening schedule without AM/PM
      return h * 60 + m;
    };
    const start = toMinutes(match[1], match[2]);
    const end = toMinutes(match[3], match[4]);
    if (start === null || end === null) return null;
    return { start, end };
  };

  const downloadTeacherTimetablePdf = () => {
    try {
      if (!selectedTeacher) return;
      if (!teacherSchedule || Object.keys(teacherSchedule).length === 0) return;

      const teacherName = (selectedTeacher?.name || "Teacher").toString().trim();
      const safeName = teacherName.replace(/[<>:"/\\|?*]+/g, "").trim() || "Teacher";
      const fileName = `${safeName}_Weekly_Timetable.pdf`;

      const days = weekOrder.filter((d) => teacherSchedule[d]);
      const periodKeySet = new Set();
      days.forEach((day) => {
        const periods = teacherSchedule?.[day] || {};
        Object.keys(periods).forEach((p) => periodKeySet.add(p));
      });

      const sortPeriodKeys = (keys) => {
        return [...keys].sort((a, b) => {
          const sa = String(a || "");
          const sb = String(b || "");
          const na = (sa.match(/\d+/) || [null])[0];
          const nb = (sb.match(/\d+/) || [null])[0];
          if (na !== null && nb !== null) {
            const ia = parseInt(na, 10);
            const ib = parseInt(nb, 10);
            if (!Number.isNaN(ia) && !Number.isNaN(ib) && ia !== ib) return ia - ib;
          }
          return sa.localeCompare(sb);
        });
      };

      const periodKeys = sortPeriodKeys(Array.from(periodKeySet));

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const marginX = 40;
      const titleY = 40;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Weekly Teaching Timetable", marginX, titleY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const metaStartY = titleY + 18;
      const emailText = (selectedTeacherUser?.email || selectedTeacher?.email || "").toString();
      const subjectsText = (selectedTeacher?.subjectsUnique || []).join(", ");
      doc.text(`Teacher: ${teacherName}`, marginX, metaStartY);
      doc.text(`Email: ${emailText}`, marginX, metaStartY + 14);
      doc.text(`Subjects: ${subjectsText}`, marginX, metaStartY + 28);
      doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, metaStartY + 42);

      const tableHead = [["Period", ...days]];
      const tableBody = periodKeys.map((periodKey) => {
        return [
          periodKey,
          ...days.map((day) => {
            const entries = teacherSchedule?.[day]?.[periodKey] || [];
            if (!Array.isArray(entries) || entries.length === 0) return "";
            const labels = entries
              .map((e) => {
                const subject = (e?.subject || "").toString().trim();
                const cls = (e?.class || "").toString().trim();
                if (subject && cls) return `${subject} (${cls})`;
                return subject || cls;
              })
              .filter(Boolean);
            return Array.from(new Set(labels)).join("\n");
          }),
        ];
      });

      autoTable(doc, {
        startY: metaStartY + 60,
        head: tableHead,
        body: tableBody,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: 4,
          valign: "top",
        },
        headStyles: {
          fillColor: [30, 64, 175],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 90 },
        },
      });

      doc.save(fileName);
    } catch (e) {
      console.error("Failed to export teacher timetable:", e);
    }
  };

  const dayOrder = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
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


  // ---------------- FETCH TEACHERS ----------------
  useEffect(() => {
    const fetchTeachers = async () => {
      setLoadingTeachers(true);
      try {
        const [teachersRes, assignmentsRes, coursesRes, usersRes] = await Promise.all([
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherAssignments.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Courses.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json")
        ]);

        const teachersData = teachersRes.data || {};
        const assignmentsData = assignmentsRes.data || {};
        const coursesData = coursesRes.data || {};
        const usersData = usersRes.data || {};

        const teacherList = Object.keys(teachersData).map(teacherId => {
          const teacher = teachersData[teacherId];
          const user = usersData[teacher.userId] || {};

          const gradesSubjectsRaw = Object.values(assignmentsData)
            .filter(a => a.teacherId === teacherId)
            .map(a => {
              const course = coursesData[a.courseId];
              return course
                ? { courseId: a.courseId, grade: course.grade, subject: course.subject, section: course.section }
                : null;
            })
            .filter(Boolean);

          // Deduplicate: show each course only once (prevents repeated subjects)
          const seenCourseKeys = new Set();
          const gradesSubjects = [];
          gradesSubjectsRaw.forEach((gs) => {
            const key = gs.courseId || `${gs.grade}-${gs.section}-${gs.subject}`;
            if (seenCourseKeys.has(key)) return;
            seenCourseKeys.add(key);
            gradesSubjects.push(gs);
          });

          // Deduplicate subjects for display (one subject name only once)
          const seenSubjects = new Set();
          const subjectsUnique = [];
          gradesSubjects.forEach((gs) => {
            const rawSubject = (gs?.subject ?? "").toString().trim();
            if (!rawSubject) return;
            const normalized = rawSubject.toLowerCase().replace(/\s+/g, " ");
            if (seenSubjects.has(normalized)) return;
            seenSubjects.add(normalized);
            subjectsUnique.push(rawSubject);
          });

          return {
            teacherId,
            name: user.name || "No Name",
            profileImage: user.profileImage || "/default-profile.png",
            gradesSubjects,
            subjectsUnique,
            email: user.email || null,
            userId: teacher.userId
          };
        });

        setTeachers(teacherList);
      } catch (err) {
        console.error("Error fetching teachers:", err);
      } finally {
        setLoadingTeachers(false);
      }
    };

    fetchTeachers();
  }, []);

  // ---------------- FILTER TEACHERS ----------------
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchesSearch = (teacher) => {
    if (!normalizedSearch) return true;
    const name = (teacher?.name || "").toLowerCase();
    const subjects = (teacher?.subjectsUnique || []).join(" ").toLowerCase();
    const grades = (teacher?.gradesSubjects || [])
      .map((gs) => `${gs.grade ?? ""}${gs.section ?? ""} ${gs.subject ?? ""}`)
      .join(" ")
      .toLowerCase();
    return name.includes(normalizedSearch) || subjects.includes(normalizedSearch) || grades.includes(normalizedSearch);
  };

  const filteredTeachers =
    selectedGrade === "All"
      ? teachers.filter(matchesSearch)
      : teachers.filter(t => t.gradesSubjects.some(gs => gs.grade === selectedGrade)).filter(matchesSearch);



// ---------------- FETCH TEACHER SCHEDULE ----------------
// ---------------- FETCH TEACHER SCHEDULE (FIXED & WORKING) ----------------
useEffect(() => {
  if (!selectedTeacher || activeTab !== "schedule") return;

  const fetchSchedule = async () => {
    try {
      const res = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Schedules.json"
      );


      const allSchedules = res.data || {};
      const result = {};

      Object.entries(allSchedules).forEach(([day, dayData]) => {
        Object.entries(dayData || {}).forEach(([classKey, periods]) => {
          Object.entries(periods || {}).forEach(([periodKey, entry]) => {
            if (
              entry &&
              entry.teacherId === selectedTeacher.teacherId && // ✅ FIX
              !entry.break
            ) {
              if (!result[day]) result[day] = {};
              if (!result[day][periodKey]) result[day][periodKey] = [];

              result[day][periodKey].push({
                subject: entry.subject,
                class: classKey
              });
            }
          });
        });
      });

      console.log("✅ FINAL TEACHER SCHEDULE:", result);
      setTeacherSchedule(result);
    } catch (err) {
      console.error("❌ Schedule fetch failed:", err);
      setTeacherSchedule({});
    }
  };

  fetchSchedule();
}, [selectedTeacher, activeTab]);


useEffect(() => {
    // Replace with your actual API call
    const fetchUnreadSenders = async () => {
      const response = await fetch("/api/unreadSenders");
      const data = await response.json();
      setUnreadSenders(data);
    };
    fetchUnreadSenders();
  }, []);


// Fetch teacher daily lesson plan from RTDB LessonPlans node when Plan tab is active
useEffect(() => {
  if (!selectedTeacher || activeTab !== "plan") {
    setTeacherDailyPlans([]);
    setPlanWeeks([]);
    setPlanCurrentWeeks([]);
    setPlanCurrentWeekIndex(null);
    setPlanSubmittedKeys([]);
    setPlanSelectedCourseId('all');
    setPlanCourseLabelMap({});
    setPlanAnnualOpen(false);
    setPlanError('');
    setPlanLoading(false);
    return;
  }

  const fetchLessonPlans = async () => {
    try {
      setPlanLoading(true);
      setPlanError('');
      const teacherUserId = selectedTeacher.userId;
      const teacherId = selectedTeacher.teacherId;
      if (!teacherUserId && !teacherId) {
        setTeacherDailyPlans([]);
        setPlanWeeks([]);
        setPlanCurrentWeeks([]);
        setPlanCurrentWeekIndex(null);
        return;
      }
      const today = new Date();
      const todayISO = today.toISOString().slice(0, 10);
      const todayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const todayIndex = today.getDay();
      const getScheduledIndex = (dayName) => {
        const lname = (dayName || '').toString().toLowerCase();
        return Object.prototype.hasOwnProperty.call(dayOrder, lname) ? dayOrder[lname] : null;
      };

      const normalizeWeekForKey = (val) => {
        if (val === undefined || val === null) return '';
        const s = String(val).trim();
        if (!s) return '';
        const m = s.match(/\d+/);
        return m ? m[0] : s;
      };

      const normalizeDayForKey = (dayName) => {
        return String(dayName || '').trim().toLowerCase();
      };

      const canonicalSubmissionKey = (teacherId, courseId, weekVal, dayName) => {
        const t = String(teacherId || '').trim();
        const c = String(courseId || '').trim();
        return `${t}::${c}::${normalizeWeekForKey(weekVal)}::${normalizeDayForKey(dayName)}`;
      };

      const normalizeISODate = (val) => {
        if (!val) return '';
        const s = String(val).trim();
        // Accept YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        // Try Date parsing as fallback
        const dt = new Date(s);
        if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
        return '';
      };

      const isPastISODate = (iso) => {
        const d = normalizeISODate(iso);
        if (!d) return false;
        // String compare works for ISO yyyy-mm-dd
        return d < todayISO;
      };

      const normalizeWeekDays = (input) => {
        if (!input) return [];
        if (Array.isArray(input)) {
          return input.map(d => ({
            dayName: (d.dayName || d.name || d.day || d.label || '').toString(),
            date: normalizeISODate(d.date || d.dayDate || d.isoDate || d.dayISO || ''),
            topic: d.topic || d.subject || d.title || '',
            method: d.method || d.methods || '',
            aids: d.aids || d.material || d.materials || '',
            assessment: d.assessment || d.assess || d.evaluation || '',
          }));
        }
        if (typeof input === 'object') {
          return Object.keys(input).map((key) => {
            const val = input[key] || {};
            if (typeof val === 'string') return { dayName: key, date: '', topic: val, method: '', aids: '', assessment: '' };
            return {
              dayName: (val.dayName || val.name || key).toString(),
              date: normalizeISODate(val.date || val.dayDate || val.isoDate || val.dayISO || ''),
              topic: val.topic || val.subject || '',
              method: val.method || val.methods || '',
              aids: val.aids || val.material || '',
              assessment: val.assessment || val.assess || '',
            };
          });
        }
        return [];
      };

      const pickAcademicYearKey = (obj, preferred = null) => {
        if (!obj || typeof obj !== 'object') return null;
        const keys = Object.keys(obj);
        if (!keys.length) return null;
        if (preferred && obj[preferred]) return preferred;
        // RTDB keys cannot contain '/', so try common variants
        if (preferred) {
          const variants = [
            preferred,
            preferred.replaceAll('/', '_'),
            preferred.replaceAll('/', '-'),
            preferred.replaceAll('/', ''),
          ];
          for (const v of variants) {
            if (obj[v]) return v;
          }
        }
        // heuristic: choose lexicographically latest
        return keys.sort().slice(-1)[0];
      };

      const parsePreferredAcademicYear = (preferred) => {
        const s = String(preferred || '').trim();
        const m = s.match(/^(\d{4})\s*\/\s*(\d{2,4})$/);
        if (!m) return null;
        const yearKey = m[1];
        let termKey = m[2];
        // store as 2-digit if given as 4-digit (e.g., 2026 -> 26)
        if (termKey.length === 4) termKey = termKey.slice(2);
        return { yearKey, termKey };
      };

      const resolveAcademicYearNode = (root, preferred) => {
        if (!root || typeof root !== 'object') return { node: {}, path: [] };

        // 1) direct key match (e.g., "2025_26" or "202526")
        const directKey = pickAcademicYearKey(root, preferred);
        if (directKey && root[directKey] && typeof root[directKey] === 'object') {
          const directNode = root[directKey];
          if (directNode.courses && typeof directNode.courses === 'object') return { node: directNode, path: [directKey] };
        }

        // 2) nested structure: root["2025"]["26"].courses
        const parsed = parsePreferredAcademicYear(preferred);
        if (parsed && root[parsed.yearKey] && typeof root[parsed.yearKey] === 'object') {
          const yearLevel = root[parsed.yearKey];
          if (yearLevel[parsed.termKey] && typeof yearLevel[parsed.termKey] === 'object') {
            const nestedNode = yearLevel[parsed.termKey];
            if (nestedNode.courses && typeof nestedNode.courses === 'object') return { node: nestedNode, path: [parsed.yearKey, parsed.termKey] };
          }
          // try any child that contains courses
          for (const subKey of Object.keys(yearLevel || {})) {
            const nestedNode = yearLevel?.[subKey];
            if (nestedNode && typeof nestedNode === 'object' && nestedNode.courses && typeof nestedNode.courses === 'object') {
              return { node: nestedNode, path: [parsed.yearKey, subKey] };
            }
          }
        }

        // 3) heuristic: find first node in root (or its first child) that has courses
        for (const k of Object.keys(root || {})) {
          const v = root?.[k];
          if (v && typeof v === 'object') {
            if (v.courses && typeof v.courses === 'object') return { node: v, path: [k] };
            for (const sk of Object.keys(v || {})) {
              const vv = v?.[sk];
              if (vv && typeof vv === 'object' && vv.courses && typeof vv.courses === 'object') return { node: vv, path: [k, sk] };
            }
          }
        }

        return { node: {}, path: [] };
      };

      // Like resolveAcademicYearNode, but does NOT require a `.courses` child.
      // Used for nodes like LessonPlanSubmissions where the year node directly contains courseIds.
      const resolveAcademicYearNodeAny = (root, preferred) => {
        if (!root || typeof root !== 'object') return { node: {}, path: [] };

        // 1) nested structure: root["2025"]["26"] (matches the provided LessonPlanSubmissions schema)
        const parsed = parsePreferredAcademicYear(preferred);
        if (parsed && root[parsed.yearKey] && typeof root[parsed.yearKey] === 'object') {
          const yearLevel = root[parsed.yearKey];
          if (yearLevel[parsed.termKey] && typeof yearLevel[parsed.termKey] === 'object') {
            return { node: yearLevel[parsed.termKey], path: [parsed.yearKey, parsed.termKey] };
          }
          // fallback to any child node
          for (const subKey of Object.keys(yearLevel || {})) {
            const nestedNode = yearLevel?.[subKey];
            if (nestedNode && typeof nestedNode === 'object') {
              return { node: nestedNode, path: [parsed.yearKey, subKey] };
            }
          }
        }

        // 2) direct key match (e.g., "2025_26" or "202526").
        // IMPORTANT: avoid heuristically picking the latest key when preferred doesn't match,
        // otherwise we can stop at the year container (e.g., "2025") and miss the term node ("26").
        if (preferred) {
          const variants = [
            preferred,
            String(preferred).replaceAll('/', '_'),
            String(preferred).replaceAll('/', '-'),
            String(preferred).replaceAll('/', ''),
          ];
          const directKey = variants.find((k) => root[k] && typeof root[k] === 'object');
          if (directKey) return { node: root[directKey], path: [directKey] };
        }

        // 3) heuristic: pick first object-ish node
        for (const k of Object.keys(root || {})) {
          const v = root?.[k];
          if (v && typeof v === 'object') {
            // If it looks like a year container, try one level down
            for (const sk of Object.keys(v || {})) {
              const vv = v?.[sk];
              if (vv && typeof vv === 'object') return { node: vv, path: [k, sk] };
            }
            return { node: v, path: [k] };
          }
        }

        return { node: {}, path: [] };
      };

      const ALL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const inferMonthFromWeekDays = (weekDays) => {
        const d = (weekDays || []).find((x) => normalizeISODate(x?.date));
        const iso = normalizeISODate(d?.date);
        if (!iso) return '';
        const dt = new Date(`${iso}T00:00:00`);
        if (Number.isNaN(dt.getTime())) return '';
        return ALL_MONTHS[dt.getMonth()] || '';
      };

      // Load teacher's LessonPlans root.
      // IMPORTANT: LessonPlans may be keyed by teacherId (Teachers node key) or by userId (legacy).
      const candidatePlanKeys = Array.from(new Set([
        String(teacherId || '').trim(),
        String(teacherUserId || '').trim(),
      ].filter(Boolean)));

      let teacherPlansRoot = {};
      for (const k of candidatePlanKeys) {
        // eslint-disable-next-line no-await-in-loop
        const res = await axios.get(`${RTDB_BASE}/LessonPlans/${encodeURIComponent(k)}.json`).catch(() => ({ data: null }));
        if (res && res.data && typeof res.data === 'object') {
          teacherPlansRoot = res.data;
          // Prefer the first non-empty object
          if (Object.keys(teacherPlansRoot || {}).length) break;
        }
      }

      const preferredAcademicYear = '2025/26';
      const resolvedPlans = resolveAcademicYearNode(teacherPlansRoot, preferredAcademicYear);
      const coursesNode = (resolvedPlans.node && resolvedPlans.node.courses && typeof resolvedPlans.node.courses === 'object') ? resolvedPlans.node.courses : {};

      // Submissions are keyed by teacherId in LessonPlanSubmissions (per provided schema)
      const teacherSubmissionId = String(teacherId || teacherUserId || '').trim();

      // Load submissions (optional, for status)
      // Support both node names: LessonPlanSubmissions (legacy) and LessonPlanSubmission (current)
      // Support both teacher key styles: selectedTeacher.userId and selectedTeacher.teacherId
      let submittedKeySet = new Set();
      try {
        const candidateTeacherKeys = Array.from(new Set([
          String(teacherUserId || '').trim(),
          String(selectedTeacher?.teacherId || '').trim(),
        ].filter(Boolean)));

        const submissionRoots = [];

        for (const tKey of candidateTeacherKeys) {
          const urls = [
            `${RTDB_BASE}/LessonPlanSubmissions/${encodeURIComponent(tKey)}.json`,
          
          ];

          const results = await Promise.all(
            urls.map((u) => axios.get(u).catch(() => ({ data: null })))
          );

          results.forEach((r) => {
            if (r && r.data && typeof r.data === 'object') submissionRoots.push(r.data);
          });
        }

        submissionRoots.forEach((submissionsRoot) => {
          const resolvedSubs = resolveAcademicYearNodeAny(submissionsRoot, preferredAcademicYear);
          const submissionsYearNode = resolvedSubs.node || {};
          Object.values(submissionsYearNode || {}).forEach((courseSubNode) => {
            if (!courseSubNode || typeof courseSubNode !== 'object') return;
            Object.values(courseSubNode).forEach((sub) => {
              if (!sub) return;
              // Store canonicalized submission keys so matching is robust
              if (sub.key) {
                const raw = String(sub.key).trim();
                submittedKeySet.add(raw);
                const parts = raw.split('::');
                if (parts.length >= 4) {
                  const [tId, cId, wk, dn] = parts.map((p) => String(p ?? '').trim());
                  submittedKeySet.add(canonicalSubmissionKey(tId, cId, wk, dn));
                }
              }

              // Also derive the canonical key from structured fields (preferred, matches your DB sample)
              if (sub.teacherId || sub.courseId || sub.week || sub.dayName) {
                submittedKeySet.add(
                  canonicalSubmissionKey(sub.teacherId, sub.courseId, sub.week, sub.dayName)
                );
              }

              // If childKey exists like teacherId__courseId__week__Monday, derive from it too
              if (sub.childKey) {
                const ck = String(sub.childKey).trim();
                const parts = ck.split('__').map((p) => String(p ?? '').trim());
                if (parts.length >= 4) {
                  const [tId, cId, wk, dn] = parts;
                  submittedKeySet.add(canonicalSubmissionKey(tId, cId, wk, dn));
                }
              }
            });
          });
        });
      } catch (e) {
        // ignore missing submissions
        submittedKeySet = new Set();
      }

      setPlanSubmittedKeys(Array.from(submittedKeySet));

      const extractWeeksFromCourse = (courseId, courseEntry) => {
        if (!courseEntry) return [];
        const out = [];

        const pushWeek = (weekObj, weekFallback = '') => {
          if (!weekObj) return;
          const weekDays = normalizeWeekDays(weekObj.weekDays || weekObj.days || weekObj.daily || []);
          if (!weekDays.length && !(weekObj.topic || weekObj.weekTopic)) return;
          const month = (weekObj.month || weekObj.monthName || '').toString() || inferMonthFromWeekDays(weekDays);
          out.push({
            month,
            week: weekObj.week || weekObj.weekNumber || weekFallback || '',
            topic: weekObj.topic || weekObj.weekTopic || '',
            objective: weekObj.objective || weekObj.objectives || weekObj.weekObjective || weekObj.weekObjectives || '',
            method: weekObj.method || weekObj.teachingMethod || weekObj.methods || '',
            material: weekObj.material || weekObj.materials || weekObj.aids || weekObj.resources || '',
            assessment: weekObj.assessment || weekObj.evaluation || weekObj.assessments || '',
            weekDays,
            courseId: courseId || weekObj.courseId || null,
          });
        };

        // annual rows
        if (courseEntry.annual && Array.isArray(courseEntry.annual.annualRows)) {
          courseEntry.annual.annualRows.forEach((r) => pushWeek(r, r.week || ''));
        }

        // week_{x}
        Object.keys(courseEntry).forEach((k) => {
          if (!k) return;
          if (k.startsWith('week_')) {
            const wk = courseEntry[k];
            const fallback = k.replace(/^week_/, '');
            if (wk && typeof wk === 'object') pushWeek(wk, wk.week || fallback);
          }
        });

        return out;
      };

      // Extract weeks across all courses
      let weeks = [];
      Object.entries(coursesNode || {}).forEach(([courseId, courseEntry]) => {
        weeks = weeks.concat(extractWeeksFromCourse(courseId, courseEntry));
      });

      // Dedupe loosely by courseId+week+month+topic
      const seen = new Set();
      weeks = weeks.filter((w) => {
        const key = `${String(w.courseId)}::${String(w.week)}::${String(w.month)}::${String(w.topic)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setPlanWeeks(weeks);

      // Per-course current week (the one containing today's weekday; fallback to first)
      const currentWeeks = [];
      const dailyPlans = [];
      const coursesGrouped = (weeks || []).reduce((acc, w) => {
        const cid = String(w.courseId || 'unknown');
        if (!acc[cid]) acc[cid] = [];
        acc[cid].push(w);
        return acc;
      }, {});

      Object.entries(coursesGrouped).forEach(([courseId, courseWeeks]) => {
        let idx = null;
        for (let i = 0; i < courseWeeks.length; i++) {
          if ((courseWeeks[i].weekDays || []).some(d => normalizeISODate(d.date) === todayISO)) {
            idx = i;
            break;
          }
          if ((courseWeeks[i].weekDays || []).some(d => (d.dayName || '').toString().toLowerCase() === todayName)) {
            idx = i;
            break;
          }
        }
        if (idx === null && courseWeeks.length) idx = 0;
        if (idx === null) return;

        const wk = courseWeeks[idx];
        currentWeeks.push(wk);

        (wk.weekDays || []).forEach((d) => {
          const scheduledIndex = getScheduledIndex(d.dayName || '');
          const submissionKey = canonicalSubmissionKey(teacherSubmissionId, courseId, wk.week || '', d.dayName || '');
          const submitted = submittedKeySet.has(submissionKey) || submittedKeySet.has(String(submissionKey).replace(/::([a-z]+)$/i, (m) => m));
          const status = submitted
            ? 'submitted'
            : (d.date && isPastISODate(d.date))
              ? 'missed'
              : (scheduledIndex !== null && scheduledIndex < todayIndex)
                ? 'missed'
                : 'pending';

          const matchesToday = (d.date && normalizeISODate(d.date) === todayISO)
            || scheduledIndex === todayIndex
            || (d.dayName || '').toString().toLowerCase() === todayName;

          if (matchesToday) {
            dailyPlans.push({
              ...d,
              courseId,
              week: wk.week || '',
              month: wk.month || '',
              status,
              key: submissionKey,
              scheduledIndex,
            });
          }
        });
      });

      // Dedupe daily plans (can match by both date and weekday)
      const seenDaily = new Set();
      const dedupedDailyPlans = dailyPlans.filter((p) => {
        const k = String(p.key || '');
        if (!k) return true;
        if (seenDaily.has(k)) return false;
        seenDaily.add(k);
        return true;
      });

      setPlanCurrentWeeks(currentWeeks);
      // Keep legacy state for compatibility (first current week)
      setPlanCurrentWeekIndex(currentWeeks.length ? 0 : null);
      setTeacherDailyPlans(dedupedDailyPlans);
    } catch (err) {
      console.error('Failed to fetch LessonPlans', err);
      setTeacherDailyPlans([]);
      setPlanWeeks([]);
      setPlanCurrentWeeks([]);
      setPlanCurrentWeekIndex(null);
      setPlanSubmittedKeys([]);
      setPlanError('Failed to load lesson plans from database.');
    } finally {
      setPlanLoading(false);
    }
  };

  fetchLessonPlans();
}, [selectedTeacher, activeTab, planRefreshKey]);

// Fetch course labels for Plan tab dropdown (based on courseIds present in plan data)
useEffect(() => {
  if (!selectedTeacher || activeTab !== 'plan') return;

  const ids = Array.from(new Set([
    ...(Array.isArray(planWeeks) ? planWeeks.map((w) => String(w?.courseId || '')).filter(Boolean) : []),
    ...(Array.isArray(planCurrentWeeks) ? planCurrentWeeks.map((w) => String(w?.courseId || '')).filter(Boolean) : []),
  ]));

  if (!ids.length) {
    setPlanCourseLabelMap({});
    setPlanSelectedCourseId('all');
    return;
  }

  let cancelled = false;

  const run = async () => {
    try {
      const res = await axios.get(`${RTDB_BASE}/Courses.json`);
      const courses = res.data || {};
      const map = {};
      ids.forEach((courseId) => {
        const c = courses?.[courseId];
        if (!c) return;
        const subject = (c.subject || '').toString().trim() || courseId;
        const grade = c.grade ? `Grade ${c.grade}` : '';
        const section = c.section ? `${c.section}` : '';
        const meta = [grade, section].filter(Boolean).join(' ');
        map[courseId] = meta ? `${subject} • ${meta}` : subject;
      });

      if (cancelled) return;
      setPlanCourseLabelMap(map);
      setPlanSelectedCourseId((prev) => {
        if (prev === 'all') return prev;
        return ids.includes(prev) ? prev : 'all';
      });
    } catch (e) {
      if (cancelled) return;
      setPlanCourseLabelMap({});
      setPlanSelectedCourseId('all');
    }
  };

  run();
  return () => { cancelled = true; };
}, [selectedTeacher, activeTab, planWeeks, planCurrentWeeks, RTDB_BASE]);


// helper: canonical chat key (sorted so it's consistent)
const getChatKey = (userA, userB) => {
  // ensure stable ordering: "lower_higher"
  return [userA, userB].sort().join("_");
};

const ensureChatRoot = async (chatKey, otherUserId) => {
  if (!adminUserId || !otherUserId) return;
  try {
    const res = await axios.get(`${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}.json`).catch(() => ({ data: null }));
    const existing = res.data || {};
    const participants = { ...(existing.participants || {}), [adminUserId]: true, [otherUserId]: true };

    const unread = { ...(existing.unread || {}) };
    if (unread[adminUserId] === undefined) unread[adminUserId] = 0;
    if (unread[otherUserId] === undefined) unread[otherUserId] = 0;

    const patch = { participants, unread };
    if (existing.typing === undefined) patch.typing = null;
    if (existing.lastMessage === undefined) patch.lastMessage = null;

    await axios.patch(`${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}.json`, patch).catch(() => {});
  } catch (e) {
    // ignore
  }
};

const maybeMarkLastMessageSeenForAdmin = async (chatKey) => {
  try {
    const res = await axios.get(`${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}/lastMessage.json`).catch(() => ({ data: null }));
    const last = res.data;
    if (!last) return;
    if (String(last.receiverId) === String(adminUserId) && last.seen === false) {
      await axios.patch(`${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}/lastMessage.json`, { seen: true }).catch(() => {});
    }
  } catch (e) {
    // ignore
  }
};

const clearTyping = (chatKey) => {
  axios.put(`${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}/typing.json`, null).catch(() => {});
};

const handleTyping = (text) => {
  if (!adminUserId || !selectedTeacher?.userId) return;
  const chatKey = getChatKey(selectedTeacher.userId, adminUserId);

  if (!text || !text.trim()) {
    clearTyping(chatKey);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    return;
  }

  axios.put(`${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}/typing.json`, { userId: adminUserId }).catch(() => {});

  if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  typingTimeoutRef.current = setTimeout(() => {
    clearTyping(chatKey);
    typingTimeoutRef.current = null;
  }, 1800);
};

//----------------------Fetch unread messages for teachers--------------------

      useEffect(() => {
  if (!adminUserId || teachers.length === 0) return;

  const fetchUnreadTeachers = async () => {
    const unread = {};

    for (const t of teachers) {
      const chatKey = getChatKey(adminUserId, t.userId);
      try {
        const res = await axios.get(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`
        );

        const msgs = Object.values(res.data || {});
        const count = msgs.filter(
          m => m.receiverId === adminUserId && m.seen === false
        ).length;

        if (count > 0) unread[t.userId] = count;
      } catch (err) {
        console.error(err);
      }
    }

    setUnreadTeachers(unread);
  };

  fetchUnreadTeachers();
}, [teachers, adminUserId]);


// (Popup messages are handled by the realtime subscription below)

// ---------------- SEND POPUP MESSAGE ----------------
const sendPopupMessage = async () => {
  if (!popupInput.trim() || !selectedTeacher) return;

  const chatKey = getChatKey(selectedTeacher.userId, adminUserId);
  const timestamp = Date.now();

  const newMessage = {
    senderId: adminUserId,
    receiverId: selectedTeacher.userId,
    type: "text",
    text: popupInput,
    imageUrl: null,
    replyTo: null,
    seen: false,
    edited: false,
    deleted: false,
    timeStamp: timestamp
  };

  try {
    // Ensure chat root exists in the correct schema
    await ensureChatRoot(chatKey, selectedTeacher.userId);

    // 1) Push message to messages node (POST -> returns a name/key)
    const pushRes = await axios.post(
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${encodeURIComponent(chatKey)}/messages.json`,
      newMessage
    );
    const generatedId = pushRes.data && pushRes.data.name;

    // 2) Update lastMessage with full schema
    const lastMessage = {
      messageId: generatedId || `${timestamp}`,
      senderId: newMessage.senderId,
      receiverId: newMessage.receiverId,
      text: newMessage.text || "",
      type: newMessage.type || "text",
      timeStamp: newMessage.timeStamp,
      seen: false,
      edited: false,
      deleted: false,
    };

    await axios.put(
      `${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}/lastMessage.json`,
      lastMessage
    ).catch(() => {});

    // 3) Increment unread count for receiver (non-atomic: read -> increment -> write)
    try {
      const unreadRes = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${encodeURIComponent(chatKey)}/unread.json`
      );
      const unread = unreadRes.data || {};
      const prev = Number(unread[selectedTeacher.userId] || 0);
      const updated = { ...(unread || {}), [selectedTeacher.userId]: prev + 1, [adminUserId]: Number(unread[adminUserId] || 0) };
      await axios.put(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${encodeURIComponent(chatKey)}/unread.json`,
        updated
      );
    } catch (uErr) {
      // if unread node missing or failed, set it
      await axios.put(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${encodeURIComponent(chatKey)}/unread.json`,
        { [selectedTeacher.userId]: 1, [adminUserId]: 0 }
      );
    }

    // Clear typing after sending
    clearTyping(chatKey);

    // 4) Optimistically update UI
    setPopupMessages(prev => [
      ...prev,
      { messageId: generatedId || `${timestamp}`, ...newMessage, sender: "admin" }
    ]);
    setPopupInput("");
  } catch (err) {
    console.error("Failed to send message:", err);
  }
};


const getUnreadCount = async (userId) => {
  const chatKey = getChatKey(userId, adminUserId);

  try {
    const res = await axios.get(
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`
    );

    const msgs = Object.values(res.data || {});
    return msgs.filter(m => m.receiverId === adminUserId && !m.seen).length;
  } catch (err) {
    console.error(err);
    return 0;
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


// ---------------- MARK MESSAGES AS SEEN ----------------


useEffect(() => {
  if (!teacherChatOpen || !selectedTeacher) return;

  const chatKey = getChatKey(selectedTeacher.userId, adminUserId);
  const messagesRef = ref(dbRT, `Chats/${chatKey}/messages`);

  const handleSnapshot = async (snapshot) => {
    const data = snapshot.val() || {};
    const list = Object.entries(data)
      .map(([id, msg]) => ({ messageId: id, ...msg }))
      .sort((a, b) => a.timeStamp - b.timeStamp);
    setPopupMessages(list);

    const updates = {};
    Object.entries(data).forEach(([msgId, msg]) => {
      if (msg && msg.receiverId === adminUserId && !msg.seen) {
        updates[`Chats/${chatKey}/messages/${msgId}/seen`] = true;
      }
    });

    if (Object.keys(updates).length > 0) {
      try {
        await axios.patch(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/.json`, updates);
        setUnreadTeachers(prev => ({ ...prev, [selectedTeacher.userId]: 0 }));
        await ensureChatRoot(chatKey, selectedTeacher.userId);
        await axios.put(`${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}/unread/${adminUserId}.json`, 0).catch(() => {});
        await maybeMarkLastMessageSeenForAdmin(chatKey);
      } catch (err) {
        console.error('Failed to patch seen updates:', err);
      }
    }
  };

  const unsubscribe = onValue(messagesRef, handleSnapshot);
  return () => unsubscribe();
}, [teacherChatOpen, selectedTeacher, adminUserId]);


useEffect(() => {
  if (!teacherChatOpen || !selectedTeacher) {
    setTypingUserId(null);
    return;
  }

  const chatKey = getChatKey(selectedTeacher.userId, adminUserId);
  const typingRef = ref(dbRT, `Chats/${chatKey}/typing`);

  const unsubscribe = onValue(typingRef, (snapshot) => {
    const data = snapshot.val();
    setTypingUserId(data?.userId || null);
  });

  return () => {
    unsubscribe();
    setTypingUserId(null);
  };
}, [teacherChatOpen, selectedTeacher, adminUserId]);



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














  return (
    <div className="dashboard-page">
      {/* ---------------- TOP NAVBAR ---------------- */}
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

      {/* combined notifications count */}
      {(() => {
        const messageCount = Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0);
        const total = (postNotifications?.length || 0) + messageCount;
        return total > 0 ? (
          <span style={{ position: "absolute", top: "-5px", right: "-5px", background: "red", color: "#fff", borderRadius: "50%", padding: "2px 6px", fontSize: "10px", fontWeight: "bold" }}>{total}</span>
        ) : null;
      })()}

      {showPostDropdown && (
        <div
          className="notification-dropdown"
          style={{ position: "absolute", top: "40px", right: "0", width: "360px", maxHeight: "420px", overflowY: "auto", background: "#fff", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", zIndex: 1000, padding: 6 }}
          onClick={(e) => e.stopPropagation()}
        >
          {((postNotifications?.length || 0) + Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0)) === 0 ? (
            <p style={{ padding: "12px", textAlign: "center", color: "#777" }}>No new notifications</p>
          ) : (
            <div>
              {/* Posts */}
              {postNotifications.length > 0 && (
                <div>
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontWeight: 700 }}>Posts</div>
                  {postNotifications.map(n => (
                    <div key={n.notificationId} style={{ padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", borderBottom: "1px solid #f0f0f0", transition: "background 120ms ease" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")} onMouseLeave={(e) => (e.currentTarget.style.background = "") } onClick={() => handleNotificationClick(n)}>
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

              {/* Messages */}
              {Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count||0), 0) > 0 && (
                <div>
                  <div style={{ padding: '8px 10px', color: '#333', fontWeight: 700, background: '#fafafa', borderRadius: 6, margin: '8px 6px' }}>Messages</div>
                  {Object.entries(unreadSenders || {}).map(([userId, sender]) => (
                    <div key={userId} style={{ padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", borderBottom: "1px solid #f0f0f0", transition: "background 120ms ease" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")} onMouseLeave={(e) => (e.currentTarget.style.background = "") } onClick={async () => {
                      await markMessagesAsSeen(userId);
                      setUnreadSenders(prev => { const copy = { ...prev }; delete copy[userId]; return copy; });
                      setShowPostDropdown(false);
                      navigate('/all-chat', { state: { user: { userId, name: sender.name, profileImage: sender.profileImage, type: sender.type } } });
                    }}>
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


    {/* ================= MESSENGER ================= */}
    <div className="icon-circle" style={{ position: "relative", cursor: "pointer" }} onClick={() => navigate("/all-chat") }>
      <FaFacebookMessenger />
      {Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0) > 0 && (
        <span style={{ position: "absolute", top: "-5px", right: "-5px", background: "red", color: "#fff", borderRadius: "50%", padding: "2px 6px", fontSize: "10px", fontWeight: "bold" }}>{Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0)}</span>
      )}
    </div>
    {/* ============== END MESSENGER ============== */}
    


    <Link className="icon-circle" to="/settings">
                    <FaCog />
                  </Link>
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
            <Link className="sidebar-btn" to="/teachers" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13, backgroundColor: '#4b6cb7', color: '#fff', borderRadius: 8 }}>
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
          className="main-content"
          style={{
            padding: "10px 20px 20px",
            flex: 1,
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >
          <h2 style={{ marginBottom: "6px", textAlign: isNarrow ? "center" : "left", marginTop: "-8px", fontSize: "20px", marginLeft: isNarrow ? 0 : 64 }}>Teachers</h2>

          {/* Search */}
          <div style={{ display: "flex", justifyContent: isNarrow ? "center" : "flex-start", marginBottom: "8px", paddingLeft: isNarrow ? 0 : 64 }}>
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
                placeholder="Search teachers by name, subject, or grade"
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

          {/* Grade Filter */}
          <div style={{ display: "flex", justifyContent: isNarrow ? "center" : "flex-start", marginBottom: "10px", paddingLeft: isNarrow ? 0 : 64 }}>
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
              {["All", "1", "2", "3", "4", "5", "6", "7", "8"].map(g => (
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
                    fontSize: "11px"
                  }}
                >
                  {g === "All" ? "All Teachers" : `Grade ${g}`}
                </button>
              ))}
            </div>
          </div>

          {/* Teachers List */}
          {loadingTeachers ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: isNarrow ? "center" : "flex-start", gap: "10px", marginLeft: isNarrow ? 0 : '165px' }}>
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} style={{ width: isNarrow ? "92%" : "400px", borderRadius: "12px", padding: "10px", background: "#fff", border: "1px solid #eee", boxShadow: "0 2px 6px rgba(0,0,0,0.04)", display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0f2f5' }} />
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e6e6e6' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ height: 12, width: '40%', background: '#e6e6e6', borderRadius: 6, marginBottom: 8 }} />
                    <div style={{ height: 10, width: '60%', background: '#f0f0f0', borderRadius: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTeachers.length === 0 ? (
            <p style={{ textAlign: "center", color: "#555" }}>No teachers found for this grade.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: isNarrow ? "center" : "flex-start", gap: "10px", marginLeft: isNarrow ? 0 : '165px' }}>
              {filteredTeachers.map((t, i) => (
                <div
                  key={t.teacherId}
                  onClick={() => setSelectedTeacher(t)}
                  style={{
                    width: isNarrow ? "92%" : "400px",
                    borderRadius: "12px",
                    padding: "10px",
                    background: selectedTeacher?.teacherId === t.teacherId ? "#e0e7ff" : "#fff",
                    border: selectedTeacher?.teacherId === t.teacherId ? "2px solid #4b6cb7" : "1px solid #ddd",
                    boxShadow: selectedTeacher?.teacherId === t.teacherId ? "0 6px 15px rgba(75,108,183,0.3)" : "0 4px 10px rgba(0,0,0,0.1)",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: '0 0 auto' }}>
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
                      src={t.profileImage}
                      alt={t.name}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        border: selectedTeacher?.teacherId === t.teacherId ? "3px solid #4b6cb7" : "3px solid #ddd",
                        objectFit: "cover",
                        transition: "all 0.3s ease",
                        flex: '0 0 auto'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginLeft: 12, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3 style={{ margin: 0, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</h3>
                      {unreadTeachers[t.userId] > 0 && (
                        <span style={{ background: 'red', color: '#fff', borderRadius: 12, padding: '2px 6px', fontSize: 11, fontWeight: 700, marginLeft: 8 }}>{unreadTeachers[t.userId]}</span>
                      )}
                    </div>
                    <div style={{ color: '#555', fontSize: 11, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.subjectsUnique?.length > 0 ? t.subjectsUnique.join(', ') : 'No assigned courses'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---------------- RIGHT SIDEBAR ---------------- */}
      {selectedTeacher && (
    <div
      className="teacher-info-sidebar"
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
      zIndex: 120,
      display: "flex",
      flexDirection: "column",
      fontSize: "10px"
    }}
  >
    {/* CLOSE BUTTON at the top right */}
    <div style={{ position: "absolute", top: 0, left: 22, zIndex: 999 }}>
      <button
        onClick={() => setSelectedTeacher(null)}
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
    {/* ================= SCROLLABLE CONTENT ================= */}
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "12px"
      }}
    >
      {/* ================= HEADER ================= */}
      <div
        style={{
          background: "#e0e7ff",
          margin: "-12px -12px 10px",
          padding: "14px 10px",
          textAlign: "center"
        }}
      >
        <div
          style={{
            width: "70px",
            height: "70px",
            margin: "0 auto 10px",
            borderRadius: "50%",
            overflow: "hidden",
            border: "3px solid #4b6cb7"
          }}
        >
          <img
            src={selectedTeacher.profileImage}
            alt={selectedTeacher.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        <h2 style={{ margin: 0, color: "#111827", fontSize: 14 }}>
          {selectedTeacher.name}
        </h2>

        <p style={{ margin: "4px 0", color: "#6b7280", fontSize: "10px" }}>
          {selectedTeacherUser?.email || selectedTeacher.email || "teacher@example.com"}
        </p>
      </div>

      {/* ================= TABS ================= */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #e5e7eb",
          marginBottom: "10px"
        }}
      >
        {["details", "schedule", "plan"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: "6px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              color: activeTab === tab ? "#4b6cb7" : "#6b7280",
              fontSize: "10px",
              borderBottom:
                activeTab === tab
                  ? "3px solid #4b6cb7"
                  : "3px solid transparent"
            }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>



     
{/* ================= DETAILS TAB ================= */}

{activeTab === "details" && selectedTeacher && (
  <div
    style={{
      padding: "12px",
      background: "#ffffff",
      borderRadius: 12,
      border: "1px solid #e5e7eb",
      boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
      margin: "0 auto",
      maxWidth: 380
    }}
  >
    <h3 style={{
      margin: 0,
      marginBottom: 6,
      color: "#0f172a",
      fontWeight: 800,
      letterSpacing: "0.1px",
      fontSize: 12,
      textAlign: "left"
    }}>
      Teacher Profile
    </h3>
    <div style={{ color: "#64748b", fontSize: 9, textAlign: "left", marginBottom: 10 }}>
      ID: <b style={{ color: "#111827" }}>{selectedTeacher.teacherId}</b>
    </div>

    {/* Info GRID */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        marginBottom: 10,
      }}
    >
      {[
        { label: "Email", icon: "📧", value: selectedTeacherUser?.email || selectedTeacher.email },
        { label: "Gender", icon: (selectedTeacherUser?.gender || selectedTeacher.gender) === "male" ? "♂️" : (selectedTeacherUser?.gender || selectedTeacher.gender) === "female" ? "♀️" : "⚧", value: selectedTeacherUser?.gender || selectedTeacher.gender || "N/A" },
        { label: "Phone", icon: "📱", value: selectedTeacherUser?.phone || selectedTeacher.phone || selectedTeacher.phoneNumber || "N/A" },
        { label: "Status", icon: "✅", value: selectedTeacher.status || "Active" },
        {
          label: "Class(es)",
          icon: "🏫",
          value: (() => {
            const buckets = new Set();
            (selectedTeacher?.gradesSubjects || []).forEach((gs) => {
              const grade = (gs?.grade ?? "").toString().trim();
              const section = (gs?.section ?? "").toString().trim();
              if (grade && section) buckets.add(`Grade ${grade}${section}`);
              else if (grade) buckets.add(`Grade ${grade}`);
            });
            return Array.from(buckets).join(", ");
          })()
        },
        { label: "Subject(s)", icon: "📚", value: selectedTeacher.subjectsUnique?.join(", ") },
        { label: "Teacher ID", icon: "🆔", value: selectedTeacher.teacherId },
      ].map((item, i) => (
        <div
          key={i}
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
          <span style={{
            fontSize: 14,
            marginRight: 8,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#64748b"
          }}>{item.icon}</span>
          <div>
            <div style={{
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.4px",
              color: "#64748b",
              textTransform: "uppercase"
            }}>
              {item.label}
            </div>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              color: item.label === "Status"
                ? (item.value && String(item.value).toLowerCase() === "active" ? "#16a34a" : "#991b1b")
                : "#111",
              marginTop: 2,
              wordBreak: "break-word"
            }}>
              {item.value || <span style={{ color: "#d1d5db" }}>N/A</span>}
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Teaching by class */}
    {(() => {
      const byClass = new Map();
      (selectedTeacher?.gradesSubjects || []).forEach((gs) => {
        const grade = (gs?.grade ?? "").toString().trim();
        const section = (gs?.section ?? "").toString().trim();
        const subject = (gs?.subject ?? "").toString().trim();
        if (!grade || !section || !subject) return;
        const classKey = `Grade ${grade}${section}`;
        if (!byClass.has(classKey)) byClass.set(classKey, new Set());
        byClass.get(classKey).add(subject);
      });

      const classKeys = Array.from(byClass.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (!classKeys.length) return null;

      return (
        <div
          style={{
            background: "#ffffff",
            borderRadius: 12,
            padding: 10,
            border: "1px solid #eef2f7",
            boxShadow: "none",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.4px", color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>
            Teaching by class
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {classKeys.map((ck) => (
              <div key={ck} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ minWidth: 110, fontWeight: 800, color: "#0f172a" }}>{ck}</div>
                <div style={{ color: "#111827", fontWeight: 600, lineHeight: 1.35, wordBreak: "break-word" }}>
                  {Array.from(byClass.get(ck) || []).sort((a, b) => a.localeCompare(b)).join(", ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    })()}
  </div>
)}

      
{/* ================= SCHEDULE TAB ================= */}
{/* ================= SCHEDULE TAB ================= */}
{activeTab === "schedule" && (
  <div style={{ padding: "8px" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
      <h4
        style={{
          fontSize: "12px",
          fontWeight: "800",
          color: "#111827",
          letterSpacing: "0.1px",
          margin: 0
        }}
      >
        Weekly Teaching Schedule
      </h4>

      <button
        type="button"
        className="btn btn-sm"
        style={{
          background: "#4b6cb7",
          color: "#ffffff",
          border: "none",
          padding: "5px 8px",
          borderRadius: "10px",
          fontWeight: 800,
          fontSize: "9px",
          letterSpacing: "0.2px",
          boxShadow: "none",
          textTransform: "none"
        }}
        onClick={downloadTeacherTimetablePdf}
        disabled={!teacherSchedule || Object.keys(teacherSchedule).length === 0}
      >
        Download PDF
      </button>
    </div>

    {/* Empty State */}
    {Object.keys(teacherSchedule).length === 0 ? (
      <div
        style={{
          textAlign: "center",
          padding: "12px",
          borderRadius: "12px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          color: "#475569",
          fontSize: "10px",
          boxShadow: "none"
        }}
      >
        No schedule assigned yet
      </div>
    ) : (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)", // TWO COLUMNS
          gap: "6px"
        }}
      >
        {weekOrder
          .filter(day => teacherSchedule[day])
          .map(day => {
            const periods = teacherSchedule[day];
            const isToday = currentDayName === day;

            return (
              <div
                key={day}
                style={{
                  borderRadius: "12px",
                  padding: "7px",
                  background: "#ffffff",
                  boxShadow: "0 8px 22px rgba(15,23,42,0.06)",
                  border: isToday ? "1px solid #4b6cb7" : "1px solid #e5e7eb"
                }}
              >
                {/* Day Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "6px"
                  }}
                >
                  <h5
                    style={{
                      fontSize: "12px",
                      fontWeight: "800",
                      color: "#0f172a"
                    }}
                  >
                    {day}
                  </h5>

                  <span
                    style={{
                      fontSize: "10px",
                      padding: "4px 6px",
                      borderRadius: "999px",
                      background: "#f1f5f9",
                      color: "#334155",
                      fontWeight: "700"
                    }}
                  >
                    {Object.keys(periods).length} periods
                  </span>
                </div>

                {/* Periods */}
                {Object.entries(periods).map(([period, entries]) => {
                  const range = getPeriodRangeMinutes(period);
                  const isCurrentPeriod = isToday && range && currentMinutes >= range.start && currentMinutes < range.end;

                  return (
                  <div
                    key={period}
                    style={{
                      marginBottom: "6px",
                      borderRadius: "12px",
                      padding: "8px",
                      background: isCurrentPeriod ? "#eef2ff" : "#f8fafc",
                      border: isCurrentPeriod ? "1px solid #4b6cb7" : "1px solid #e2e8f0"
                    }}
                  >
                    {/* Period Header */}
                    <div
                      style={{
                        fontSize: "9px",
                        fontWeight: "800",
                        color: "#1f2937",
                        marginBottom: "4px"
                      }}
                    >
                      <span>{period}</span>
                      {isCurrentPeriod && (
                        <span
                          style={{
                            marginLeft: "8px",
                            fontSize: "8px",
                            padding: "1px 4px",
                            borderRadius: "999px",
                            background: "#4b6cb7",
                            color: "#ffffff",
                            fontWeight: "700"
                          }}
                        >
                          NOW
                        </span>
                      )}
                    </div>

                    {/* Subjects */}
                    {entries.map((e, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "4px 6px",
                          borderRadius: "8px",
                          background: "#ffffff",
                          marginBottom: "4px",
                          border: "1px solid #eef2f7",
                          boxShadow: "none",
                          fontSize: "10px"
                        }}
                      >
                        <span style={{ fontWeight: "600", color: "#111827" }}>
                          {e.subject}
                        </span>
                        <span
                          style={{
                            fontSize: "8px",
                            fontWeight: "500",
                            padding: "1px 4px",
                            borderRadius: "999px",
                            background: "#f1f5f9",
                            color: "#334155"
                          }}
                        >
                          {e.class}
                        </span>
                      </div>
                    ))}
                  </div>
                  );
                })}
              </div>
            );
          })}
      </div>
    )}
  </div>
)}




      {/* ================= PLAN TAB ================= */}
      {activeTab === "plan" && (() => {
        const teacherUserId = selectedTeacher?.userId;
        const teacherSubmissionId = String(selectedTeacher?.teacherId || teacherUserId || '').trim();
        const today = new Date();
        const todayISO = today.toISOString().slice(0, 10);
        const todayIndex = today.getDay();
        const currentMonthName = today.toLocaleDateString('en-US', { month: 'long' });
        const normalizeWeekForKey = (val) => {
          if (val === undefined || val === null) return '';
          const s = String(val).trim();
          if (!s) return '';
          const m = s.match(/\d+/);
          return m ? m[0] : s;
        };

        const normalizeDayForKey = (dayName) => String(dayName || '').trim().toLowerCase();

        const canonicalSubmissionKey = (teacherId, courseId, weekVal, dayName) => {
          const t = String(teacherId || '').trim();
          const c = String(courseId || '').trim();
          return `${t}::${c}::${normalizeWeekForKey(weekVal)}::${normalizeDayForKey(dayName)}`;
        };

        const submittedKeySet = new Set(
          (planSubmittedKeys || []).flatMap((k) => {
            const raw = String(k).trim();
            const parts = raw.split('::');
            if (parts.length >= 4) {
              const [tId, cId, wk, dn] = parts.map((p) => String(p ?? '').trim());
              return [raw, canonicalSubmissionKey(tId, cId, wk, dn)];
            }
            return [raw];
          })
        );

        const allCourseIds = Array.from(new Set([
          ...(Array.isArray(planWeeks) ? planWeeks.map((w) => String(w?.courseId || '')).filter(Boolean) : []),
          ...(Array.isArray(planCurrentWeeks) ? planCurrentWeeks.map((w) => String(w?.courseId || '')).filter(Boolean) : []),
          ...(Array.isArray(teacherDailyPlans) ? teacherDailyPlans.map((p) => String(p?.courseId || '')).filter(Boolean) : []),
        ]));

        const courseOptions = [
          { value: 'all', label: 'All Subjects' },
          ...allCourseIds.map((id) => ({
            value: id,
            label: planCourseLabelMap?.[id] || id,
          })),
        ];

        const selectedCourseLabel = planSelectedCourseId === 'all'
          ? 'All Subjects'
          : (planCourseLabelMap?.[planSelectedCourseId] || planSelectedCourseId);

        const visibleDailyPlans = planSelectedCourseId === 'all'
          ? (teacherDailyPlans || [])
          : (teacherDailyPlans || []).filter((p) => String(p?.courseId || '') === String(planSelectedCourseId));

        const visibleCurrentWeeks = planSelectedCourseId === 'all'
          ? (planCurrentWeeks || [])
          : (planCurrentWeeks || []).filter((w) => String(w?.courseId || '') === String(planSelectedCourseId));

        const visiblePlanWeeks = planSelectedCourseId === 'all'
          ? (planWeeks || [])
          : (planWeeks || []).filter((w) => String(w?.courseId || '') === String(planSelectedCourseId));

        const getScheduledIndex = (dayName) => {
          const lname = (dayName || '').toString().toLowerCase();
          return Object.prototype.hasOwnProperty.call(dayOrder, lname) ? dayOrder[lname] : null;
        };

        const buildSubmissionKey = (courseId, weekVal, dayName) => {
          return canonicalSubmissionKey(teacherSubmissionId || 'anon', courseId || 'unknown', weekVal || '', dayName || '');
        };

        const getDayStatus = (courseId, weekVal, day) => {
          const dayName = (day?.dayName || '').toString();
          const iso = (day?.date || '').toString().slice(0, 10);
          const scheduledIndex = getScheduledIndex(dayName);
          const key = buildSubmissionKey(courseId, weekVal, dayName);
          const submitted = submittedKeySet.has(key);
          if (submitted) return { status: 'submitted', key };

          // Prefer ISO date if present, otherwise fallback to weekday ordering
          if (iso && iso < todayISO) return { status: 'missed', key };
          if (scheduledIndex !== null && scheduledIndex < todayIndex) return { status: 'missed', key };
          return { status: 'pending', key };
        };

        const weekStats = (() => {
          const stats = { submitted: 0, missed: 0, pending: 0, total: 0 };
          (visibleCurrentWeeks || []).forEach((wk) => {
            (wk?.weekDays || []).forEach((d) => {
              const ds = getDayStatus(wk?.courseId, wk?.week, d);
              stats[ds.status] = (stats[ds.status] || 0) + 1;
              stats.total += 1;
            });
          });
          return stats;
        })();

        const currentMonthWeeks = (visiblePlanWeeks || []).filter((w) => {
          const m = (w?.month || '').toString().trim().toLowerCase();
          return m && m === currentMonthName.toLowerCase();
        });

        const monthlyCount = currentMonthWeeks.length;

        const monthStats = (() => {
          const stats = { submitted: 0, missed: 0, pending: 0, total: 0, topics: [] };
          (currentMonthWeeks || []).forEach((w) => {
            if (w?.topic) stats.topics.push(w.topic);
            (w?.weekDays || []).forEach((d) => {
              const ds = getDayStatus(w?.courseId, w?.week, d);
              stats[ds.status] = (stats[ds.status] || 0) + 1;
              stats.total += 1;
              if (d?.topic) stats.topics.push(d.topic);
            });
          });
          // de-dupe topics
          stats.topics = Array.from(new Set(stats.topics.filter(Boolean)));
          return stats;
        })();

        const monthPct = monthStats.total ? Math.round((monthStats.submitted / monthStats.total) * 100) : 0;

        const monthIndexMap = {
          january: 1,
          february: 2,
          march: 3,
          april: 4,
          may: 5,
          june: 6,
          july: 7,
          august: 8,
          september: 9,
          october: 10,
          november: 11,
          december: 12,
        };

        const getMonthIndex = (m) => {
          const key = (m || '').toString().trim().toLowerCase();
          return monthIndexMap[key] || 999;
        };

        const annualWeeks = Array.isArray(visiblePlanWeeks) ? visiblePlanWeeks : [];
        const annualByMonth = annualWeeks.reduce((acc, w) => {
          const monthKey = (w?.month || '').toString().trim() || 'Other';
          if (!acc[monthKey]) acc[monthKey] = [];
          acc[monthKey].push(w);
          return acc;
        }, {});

        const annualMonthKeys = Object.keys(annualByMonth).sort((a, b) => {
          const ai = getMonthIndex(a);
          const bi = getMonthIndex(b);
          if (ai !== bi) return ai - bi;
          return a.localeCompare(b);
        });

        const getWeekSortValue = (w) => {
          const raw = w?.week;
          if (raw === undefined || raw === null) return 9999;
          const n = Number(raw);
          if (!Number.isNaN(n)) return n;
          const m = String(raw).match(/\d+/);
          return m ? Number(m[0]) : 9999;
        };

        const downloadAnnualExcel = () => {
          try {
            const normalizeText = (v) => {
              if (v === undefined || v === null) return '';
              if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean).join('; ');
              return String(v).trim();
            };

            const uniqJoin = (vals) => {
              const out = Array.from(new Set((vals || []).map((x) => normalizeText(x)).filter(Boolean)));
              return out.join('; ');
            };

            const escapeHtml = (s) => {
              return String(s ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            };

            const rows = [];
            annualMonthKeys.forEach((mKey) => {
              const monthWeeks = (annualByMonth[mKey] || []).slice().sort((a, b) => getWeekSortValue(a) - getWeekSortValue(b));
              monthWeeks.forEach((wk) => {
                const weekLabel = wk?.week ? `Week ${wk.week}` : '-';
                const days = Array.isArray(wk?.weekDays) ? wk.weekDays : [];

                const topic = normalizeText(wk?.topic) || uniqJoin(days.map((d) => d?.topic));
                const objective =
                  normalizeText(wk?.objective) ||
                  normalizeText(wk?.objectives) ||
                  uniqJoin(days.map((d) => d?.objective ?? d?.objectives));
                const method = normalizeText(wk?.method) || uniqJoin(days.map((d) => d?.method));
                const material =
                  normalizeText(wk?.material) ||
                  normalizeText(wk?.materials) ||
                  normalizeText(wk?.aids) ||
                  uniqJoin(days.map((d) => d?.material ?? d?.materials ?? d?.aids));
                const assessment = normalizeText(wk?.assessment) || uniqJoin(days.map((d) => d?.assessment));

                const agg = (() => {
                  const c = { submitted: 0, missed: 0, pending: 0, total: 0 };
                  (days || []).forEach((d) => {
                    const ds = getDayStatus(wk?.courseId, wk?.week, d);
                    c[ds.status] = (c[ds.status] || 0) + 1;
                    c.total += 1;
                  });
                  return c;
                })();

                const status = agg.missed > 0 ? 'missed' : (agg.submitted > 0 ? 'submitted' : 'pending');

                rows.push({
                  month: mKey,
                  week: weekLabel,
                  topic,
                  objective,
                  method,
                  material,
                  assessment,
                  status,
                });
              });
            });

            if (!rows.length) return;

            const teacherLabel = (selectedTeacher?.fullName || selectedTeacher?.name || selectedTeacher?.userId || 'teacher').toString();
            const safeTeacher = teacherLabel.replace(/[\\/:*?"<>|]/g, '_');
            const safeCourse = (selectedCourseLabel || 'all').toString().replace(/[\\/:*?"<>|]/g, '_');
            const dateStamp = new Date().toISOString().slice(0, 10);
            const filename = `Annual_Lesson_Plan_${safeTeacher}_${safeCourse}_${dateStamp}.xls`;

            const exportYear = '2025/26';

            const selectedLabel = (selectedCourseLabel || '').toString();
            const parsed = (() => {
              if (!selectedLabel || planSelectedCourseId === 'all') {
                return { subject: 'All Subjects', gradeSection: '' };
              }

              // Expected label format: "Subject • Grade X Section" (best-effort parsing)
              const parts = selectedLabel.split('•').map((s) => s.trim()).filter(Boolean);
              const subject = parts[0] || selectedLabel;
              const meta = parts[1] || '';
              if (!meta) return { subject, gradeSection: '' };

              const m = meta.match(/Grade\s*(\d+)\s*(.*)$/i);
              if (!m) return { subject, gradeSection: meta };
              const grade = m[1] ? `Grade ${m[1]}` : '';
              const section = (m[2] || '').trim();
              const gradeSection = [grade, section].filter(Boolean).join(' ');
              return { subject, gradeSection };
            })();

            const css = `
              table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 12pt; }
              th, td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; }
              th { background: #f1f5f9; font-weight: 700; }
            `;

            const header = ['Month', 'Week', 'Topic', 'Objective', 'Method', 'Material', 'Assessment'];
            const metaHtml = `
              <div style="font-family: Calibri, Arial, sans-serif; font-size: 12pt;">
                <div><strong>Teacher Name:</strong> ${escapeHtml(teacherLabel)}</div>
                <div><strong>Grade &amp; Section:</strong> ${escapeHtml(parsed.gradeSection || '-')}</div>
                <div><strong>Subject:</strong> ${escapeHtml(parsed.subject || selectedLabel || '-')}</div>
                <div><strong>Year:</strong> ${escapeHtml(exportYear)}</div>
              </div>
              <br />
            `;
            const tableHtml = `
              <table>
                <thead>
                  <tr>${header.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
                </thead>
                <tbody>
                  ${rows.map((r) => {
                    const bg = r.status === 'missed' ? '#FEE2E2' : (r.status === 'submitted' ? '#DCFCE7' : '#FFFFFF');
                    return (
                    `<tr style="background-color:${bg};">
                      <td>${escapeHtml(r.month)}</td>
                      <td>${escapeHtml(r.week)}</td>
                      <td>${escapeHtml(r.topic || '-') }</td>
                      <td>${escapeHtml(r.objective || '-') }</td>
                      <td>${escapeHtml(r.method || '-') }</td>
                      <td>${escapeHtml(r.material || '-') }</td>
                      <td>${escapeHtml(r.assessment || '-') }</td>
                    </tr>`
                    );
                  }).join('')}
                </tbody>
              </table>
            `;

            const html = `
              <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                  <meta charset="utf-8" />
                  <style>${css}</style>
                </head>
                <body>
                  ${metaHtml}
                  ${tableHtml}
                </body>
              </html>
            `;

            const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          } catch (e) {
            console.error('Failed to export annual plan', e);
          }
        };

        const renderPlanSidebarContent = () => {
          if (planSidebarTab === 'daily') {
            const submittedDailyPlans = (() => {
              const out = [];
              (visiblePlanWeeks || []).forEach((wk) => {
                (wk?.weekDays || []).forEach((d) => {
                  const ds = getDayStatus(wk?.courseId, wk?.week, d);
                  if (ds.status !== 'submitted') return;
                  out.push({
                    ...d,
                    courseId: wk?.courseId,
                    week: wk?.week,
                    month: wk?.month,
                    key: ds.key,
                    status: 'submitted',
                    topic: d?.topic || wk?.topic || '',
                    method: d?.method || wk?.method || '',
                    aids: d?.aids || wk?.material || wk?.materials || wk?.aids || '',
                    assessment: d?.assessment || wk?.assessment || '',
                  });
                });
              });

              // Prefer sorting by ISO date (desc), then week (desc)
              out.sort((a, b) => {
                const aISO = (a?.date || '').toString().slice(0, 10);
                const bISO = (b?.date || '').toString().slice(0, 10);
                if (aISO && bISO && aISO !== bISO) return bISO.localeCompare(aISO);
                const aw = Number(String(a?.week ?? '').match(/\d+/)?.[0] ?? 0);
                const bw = Number(String(b?.week ?? '').match(/\d+/)?.[0] ?? 0);
                return bw - aw;
              });

              return out;
            })();

            return (
              <div className="space-y-3">
                <div style={{ background: '#fff', borderRadius: 8, padding: 6, boxShadow: '0 4px 10px rgba(11,20,30,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="font-semibold" style={{ margin: 0, fontSize: 11 }}>Submitted Daily Plans</h3>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: '#666' }}>Total</div>
                      <div style={{ fontWeight: 800, color: '#16a34a' }}>{submittedDailyPlans.length}</div>
                    </div>
                  </div>

                  {submittedDailyPlans.length ? (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {submittedDailyPlans.slice(0, 10).map((p, idx) => (
                        <div key={p?.key || idx} style={{ display: 'flex', gap: 6, padding: 6, borderRadius: 8, background: '#ecfdf5', border: '1px solid #bbf7d0', alignItems: 'center' }}>
                          <div style={{ width: 5, height: 30, borderRadius: 6, background: '#16a34a' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontWeight: 800, fontSize: 10 }}>{p.dayName || `Submitted ${idx + 1}`}</div>
                              <div style={{ fontSize: 9, color: '#166534' }}>{p.week ? `Week: ${p.week}` : 'Week: -'}{p?.date ? ` • ${String(p.date).slice(0, 10)}` : ''}</div>
                            </div>
                            <div style={{ fontSize: 10, color: '#14532d', marginTop: 3 }}>{p.topic || 'No topic provided'}</div>
                            <div style={{ fontSize: 9, color: '#166534', marginTop: 3 }}>
                              {p.method ? `Method: ${p.method}` : p.aids ? `Material: ${p.aids}` : p.assessment ? `Assessment: ${p.assessment}` : 'Quick note: -'}
                            </div>
                          </div>
                          <div style={{ background: '#16a34a', color: '#fff', padding: '3px 6px', borderRadius: 999, fontSize: 9, fontWeight: 800 }}>
                            Submitted
                          </div>
                        </div>
                      ))}
                      {submittedDailyPlans.length > 10 && (
                        <div style={{ fontSize: 9, color: '#166534', textAlign: 'center' }}>
                          Showing latest 10 submitted daily plans.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginTop: 6, textAlign: 'center', color: '#666', fontSize: 9 }}>No submitted daily plans yet.</div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="font-semibold" style={{ fontSize: 11 }}>Today's Plan</h3>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: '#666' }}>Today</div>
                    <div style={{ fontWeight: 700 }}>{(visibleDailyPlans || []).length}</div>
                  </div>
                </div>

                {(visibleDailyPlans && visibleDailyPlans.length > 0) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {visibleDailyPlans.map((p, idx) => {
                      const status = p?.status || 'pending';
                      const color = status === 'submitted' ? '#2f855a' : status === 'missed' ? '#c53030' : '#4a5568';
                      return (
                        <div key={p?.key || idx} style={{ display: 'flex', gap: 6, padding: 6, borderRadius: 8, background: '#fff', boxShadow: '0 4px 10px rgba(11,20,30,0.04)', alignItems: 'center' }}>
                          <div style={{ width: 5, height: 30, borderRadius: 6, background: color }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontWeight: 700, fontSize: 10 }}>{p.dayName || `Plan ${idx + 1}`}</div>
                              <div style={{ fontSize: 9, color: '#666' }}>{p.week ? `Week: ${p.week}` : 'Week: -'}</div>
                            </div>
                            <div style={{ fontSize: 10, color: '#333', marginTop: 3 }}>{p.topic || 'No topic provided'}</div>
                            <div style={{ fontSize: 9, color: '#666', marginTop: 3 }}>
                              {p.method ? `Method: ${p.method}` : p.aids ? `Aids: ${p.aids}` : p.assessment ? `Assessment: ${p.assessment}` : 'Quick note: -'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                            <div style={{ background: color, color: '#fff', padding: '3px 6px', borderRadius: 999, fontSize: 9, fontWeight: 700 }}>
                              {status === 'submitted' ? 'Submitted' : status === 'missed' ? 'Missed' : 'Pending'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#666', fontSize: 9 }}>No plans for today.</div>
                )}
              </div>
            );
          }

          if (planSidebarTab === 'weekly') {
            const blocks = Array.isArray(visibleCurrentWeeks) ? visibleCurrentWeeks : [];
            if (!blocks.length) return (<div style={{ textAlign: 'center', color: '#666' }}>No weekly plan found.</div>);

            return (
              <div className="sidebar-week-list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <h3 className="font-semibold" style={{ fontSize: 11 }}>Week Plan</h3>
                {blocks.map((wk, bi) => {
                  const days = wk?.weekDays || [];
                  if (!days.length) return null;
                  return (
                    <div key={bi} style={{ background: '#fff', padding: 6, borderRadius: 8, boxShadow: '0 4px 10px rgba(11,20,30,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <div style={{ fontWeight: 800 }}>{wk.courseId || 'Course'}</div>
                        <div style={{ fontSize: 9, color: '#666' }}>{wk.week ? `Week ${wk.week}` : ''}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {days.map((d, i) => {
                          const ds = getDayStatus(wk.courseId, wk.week, d);
                          const status = ds.status;
                          const statusColor = status === 'submitted' ? '#2f855a' : status === 'missed' ? '#c53030' : '#4a5568';
                          const cardBg = status === 'submitted' ? '#d9f8d5' : status === 'missed' ? '#ffe4e4' : '#ffffff';
                          return (
                            <div key={i} className={`sidebar-week-card ${status}`} style={{ display: 'flex', gap: 10, color: '#333', padding: 6, borderRadius: 8, background: cardBg, alignItems: 'center', boxShadow: '0 6px 14px rgba(11,20,30,0.04)' }}>
                              <div style={{ width: 6, height: 30, borderRadius: 6, background: status === 'submitted' ? 'linear-gradient(180deg,#9ae6b4,#2f855a)' : status === 'missed' ? 'linear-gradient(180deg,#feb2b2,#c53030)' : 'linear-gradient(180deg,#e2e8f0,#4a5568)' }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontWeight: 700, fontSize: 10 }}>{d.dayName || `Day ${i + 1}`}</div>
                                  <div style={{ fontSize: 9, color: '#666' }}>{wk.week ? `Week ${wk.week}` : ''}</div>
                                </div>
                                <div style={{ fontSize: 10, color: '#333', marginTop: 3 }}>{d.topic || wk.topic || 'No topic set'}</div>
                                {d?.date ? (<div style={{ fontSize: 9, color: '#666', marginTop: 3 }}>Date: {d.date}</div>) : null}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                                <div style={{ background: statusColor, color: '#fff', padding: '3px 6px', borderRadius: 999, fontSize: 9, fontWeight: 700 }}>{status === 'submitted' ? 'Submitted' : status === 'missed' ? 'Missed' : 'Pending'}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }

          // monthly
          return (
            <div className="space-y-2">
              <h3 className="font-semibold" style={{ fontSize: 11 }}>This Month</h3>
              {!currentMonthWeeks.length && <div className="text-xs text-gray-500" style={{ color: '#666', fontSize: 9 }}>No plans for this month.</div>}

              {!!currentMonthWeeks.length && (
                <div style={{ padding: 6, borderRadius: 8, background: '#fff', boxShadow: '0 6px 14px rgba(12,20,30,0.04)', marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 10 }}>{currentMonthName}</div>
                      <div style={{ fontSize: 9, color: '#666' }}>{currentMonthWeeks.length} week(s) • {monthStats.total} day(s)</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: '#666' }}>Completed</div>
                      <div style={{ fontWeight: 700 }}>{monthPct}%</div>
                    </div>
                  </div>

                  <div style={{ height: 5, background: '#edf2f7', borderRadius: 999, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${monthPct}%`, height: '100%', background: 'linear-gradient(90deg,#67e8f9,#4b6cb7)' }} />
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontSize: 9, color: '#2f855a' }}>Submitted: <strong>{monthStats.submitted}</strong></div>
                      <div style={{ fontSize: 9, color: '#c53030' }}>Missed: <strong>{monthStats.missed}</strong></div>
                      <div style={{ fontSize: 9, color: '#4a5568' }}>Pending: <strong>{monthStats.pending}</strong></div>
                    </div>
                  </div>

                  {monthStats.topics && monthStats.topics.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 9, color: '#666', marginBottom: 3 }}>Topics this month</div>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {monthStats.topics.slice(0, 3).map((t, i) => (<li key={i} style={{ fontSize: 10, color: '#333' }}>{t}</li>))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        };

        return (
          <>
            {planAnnualOpen && (
              <div
                role="dialog"
                aria-modal="true"
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 5000,
                  background: 'rgba(15, 23, 42, 0.55)',
                  padding: 16,
                }}
                onClick={() => setPlanAnnualOpen(false)}
              >
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    background: '#f7fafc',
                    borderRadius: 16,
                    overflow: 'hidden',
                    boxShadow: '0 18px 60px rgba(0,0,0,0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      background: '#ffffff',
                      borderBottom: '1px solid #e5e7eb',
                      padding: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 12, color: '#0f172a' }}>Annual Lesson Plan</div>
                      <div style={{ fontSize: 9, color: '#64748b' }}>
                        Showing: <strong style={{ color: '#111827' }}>{selectedCourseLabel}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' }}>
                      <div style={{ fontSize: 9, color: '#64748b', fontWeight: 800, whiteSpace: 'nowrap' }}>Subject</div>
                      <select
                        value={planSelectedCourseId}
                        onChange={(e) => setPlanSelectedCourseId(e.target.value)}
                        style={{
                          width: 'min(520px, 100%)',
                          padding: '5px 6px',
                          borderRadius: 10,
                          border: '1px solid #e5e7eb',
                          background: '#f8fafc',
                          outline: 'none',
                          fontSize: 10,
                          color: '#111827',
                        }}
                      >
                        {courseOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <button
                        className="btn btn-ghost"
                        onClick={downloadAnnualExcel}
                        disabled={!annualWeeks.length}
                        style={{
                          borderRadius: 12,
                          background: annualWeeks.length ? 'linear-gradient(135deg,#16a34a,#22c55e)' : '#e5e7eb',
                          color: annualWeeks.length ? '#fff' : '#94a3b8',
                          padding: '6px 8px',
                          fontSize: 10,
                          fontWeight: 900,
                          cursor: annualWeeks.length ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Download Excel
                      </button>

                      <button
                        className="btn btn-ghost"
                        onClick={() => setPlanAnnualOpen(false)}
                        style={{
                          borderRadius: 12,
                          background: '#0f172a',
                          color: '#fff',
                          padding: '6px 8px',
                          fontSize: 10,
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: 10, overflowY: 'auto', flex: 1 }}>
                    {!annualWeeks.length && (
                      <div style={{ padding: 8, borderRadius: 8, background: '#fff', border: '1px solid #e5e7eb', color: '#64748b', fontSize: 10 }}>
                        No annual lesson plan found for this selection.
                      </div>
                    )}

                    {!!annualWeeks.length && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {annualMonthKeys.map((mKey) => {
                          const monthWeeks = (annualByMonth[mKey] || []).slice().sort((a, b) => getWeekSortValue(a) - getWeekSortValue(b));
                          const normalizeText = (v) => {
                            if (v === undefined || v === null) return '';
                            if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean).join('; ');
                            return String(v).trim();
                          };

                          const uniqJoin = (vals) => {
                            const out = Array.from(new Set((vals || []).map((x) => normalizeText(x)).filter(Boolean)));
                            return out.join('; ');
                          };

                          return (
                            <div key={mKey} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 10px 28px rgba(14,30,37,0.06)' }}>
                              <div style={{ padding: 8, borderBottom: '1px solid #eef2f7', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                                <div style={{ fontWeight: 900, fontSize: 12, color: '#0f172a' }}>{mKey}</div>
                                <div style={{ fontSize: 9, color: '#64748b' }}>{monthWeeks.length} week(s)</div>
                              </div>

                              <div style={{ padding: 8 }}>
                                <div style={{ width: '100%', overflowX: 'auto', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 700, background: '#fff' }}>
                                    <thead>
                                      <tr style={{ background: '#f8fafc' }}>
                                        {['Week', 'Topic', 'Objective', 'Method', 'Material', 'Assessment'].map((h) => (
                                          <th
                                            key={h}
                                            style={{
                                              textAlign: 'left',
                                              padding: '6px 8px',
                                              fontSize: 9,
                                              color: '#475569',
                                              fontWeight: 900,
                                              borderBottom: '1px solid #e5e7eb',
                                              position: 'sticky',
                                              top: 0,
                                              background: '#f8fafc',
                                              zIndex: 1,
                                            }}
                                          >
                                            {h}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {monthWeeks.map((wk, wi) => {
                                        const weekLabel = wk?.week ? `Week ${wk.week}` : '-';
                                        const days = Array.isArray(wk?.weekDays) ? wk.weekDays : [];

                                        const topic = normalizeText(wk?.topic) || uniqJoin(days.map((d) => d?.topic));
                                        const objective =
                                          normalizeText(wk?.objective) ||
                                          normalizeText(wk?.objectives) ||
                                          uniqJoin(days.map((d) => d?.objective ?? d?.objectives));
                                        const method = normalizeText(wk?.method) || uniqJoin(days.map((d) => d?.method));
                                        const material =
                                          normalizeText(wk?.material) ||
                                          normalizeText(wk?.materials) ||
                                          normalizeText(wk?.aids) ||
                                          uniqJoin(days.map((d) => d?.material ?? d?.materials ?? d?.aids));
                                        const assessment = normalizeText(wk?.assessment) || uniqJoin(days.map((d) => d?.assessment));

                                        const agg = (() => {
                                          const c = { submitted: 0, missed: 0, pending: 0, total: 0 };
                                          (days || []).forEach((d) => {
                                            const ds = getDayStatus(wk?.courseId, wk?.week, d);
                                            c[ds.status] = (c[ds.status] || 0) + 1;
                                            c.total += 1;
                                          });
                                          return c;
                                        })();

                                        const isMissed = agg.missed > 0;
                                        const isSubmitted = !isMissed && agg.submitted > 0;

                                        const rowBg = isMissed
                                          ? '#fff1f2'
                                          : isSubmitted
                                            ? '#ecfdf5'
                                            : (wi % 2 === 0 ? '#ffffff' : '#fcfcfd');

                                        const accent = isMissed
                                          ? '#dc2626'
                                          : isSubmitted
                                            ? '#16a34a'
                                            : '#e2e8f0';

                                        return (
                                          <tr key={`${wk?.courseId || 'c'}-${wk?.week || 'w'}-${wi}`} style={{ background: rowBg }}>
                                            <td style={{ padding: '6px 8px', fontSize: 10, color: '#0f172a', borderBottom: '1px solid #eef2f7', fontWeight: 900, whiteSpace: 'nowrap', borderLeft: `6px solid ${accent}` }}>
                                              {weekLabel}
                                            </td>
                                            <td style={{ padding: '6px 8px', fontSize: 10, color: '#334155', borderBottom: '1px solid #eef2f7' }}>{topic || '-'}</td>
                                            <td style={{ padding: '6px 8px', fontSize: 10, color: '#334155', borderBottom: '1px solid #eef2f7' }}>{objective || '-'}</td>
                                            <td style={{ padding: '6px 8px', fontSize: 10, color: '#334155', borderBottom: '1px solid #eef2f7' }}>{method || '-'}</td>
                                            <td style={{ padding: '6px 8px', fontSize: 10, color: '#334155', borderBottom: '1px solid #eef2f7' }}>{material || '-'}</td>
                                            <td style={{ padding: '6px 8px', fontSize: 10, color: '#334155', borderBottom: '1px solid #eef2f7' }}>{assessment || '-'}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="right-sidebar" style={{ padding: planSidebarOpen ? 12 : 6, background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 8px 20px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column', gap: 8, transition: 'all 220ms ease', borderRadius: 12, fontSize: 12 }}>
              

              {planSidebarOpen && (
                <>
                <div style={{ position: 'sticky', top: 8, zIndex: 250, display: 'flex', justifyContent: 'flex-end', paddingBottom: 6 }}>
                  <button
                    onClick={() => setPlanAnnualOpen(true)}
                    style={{
                      borderRadius: 10,
                      padding: '8px 12px',
                      background: '#4b6cb7',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    Annual Lesson Plan
                  </button>
                </div>
                <div style={{ background: '#ffffff', padding: 12, borderRadius: 12, border: '1px solid #eef2f7', boxShadow: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ background: '#f1f5f9', padding: 8, borderRadius: 10, border: '1px solid #e2e8f0' }}><FaCalendarAlt color="#4b6cb7" /></div>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>Lesson Overview</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{today.toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>This Week</div>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{weekStats.total}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800, whiteSpace: 'nowrap' }}>Subject</div>
                    <select
                      value={planSelectedCourseId}
                      onChange={(e) => setPlanSelectedCourseId(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid #e5e7eb',
                        background: '#f8fafc',
                        outline: 'none',
                        fontSize: 12,
                        color: '#111827',
                      }}
                    >
                      {courseOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
                    Showing: <strong style={{ color: '#111827' }}>{selectedCourseLabel}</strong>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <div style={{ flex: 1, background: '#ffffff', padding: 8, borderRadius: 10, textAlign: 'center', border: '1px solid #eef2f7' }}>
                      <div style={{ fontSize: 12, color: '#16a34a' }}><FaCheckCircle /></div>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{weekStats.submitted}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Submitted</div>
                    </div>
                    <div style={{ flex: 1, background: '#ffffff', padding: 8, borderRadius: 10, textAlign: 'center', border: '1px solid #eef2f7' }}>
                      <div style={{ fontSize: 12, color: '#dc2626' }}><FaClock /></div>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{weekStats.missed}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Missed</div>
                    </div>
                    <div style={{ flex: 1, background: '#ffffff', padding: 8, borderRadius: 10, textAlign: 'center', border: '1px solid #eef2f7' }}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>•</div>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{weekStats.pending}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Pending</div>
                    </div>
                  </div>

                  {planError && (
                    <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: '#fff7f7', color: '#991b1b', fontSize: 13 }}>
                      {planError}
                    </div>
                  )}

                  {planLoading && (
                    <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: '#f3f4f6', color: '#6b7280', fontSize: 13 }}>
                      Loading lesson plans...
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => setPlanSidebarTab('daily')}
                    className={"btn " + (planSidebarTab === 'daily' ? 'btn-primary' : 'btn-ghost')}
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      padding: '8px 10px',
                      fontSize: 11,
                      fontWeight: 800,
                      background: planSidebarTab === 'daily' ? '#4b6cb7' : '#ffffff',
                      color: planSidebarTab === 'daily' ? '#ffffff' : '#0f172a',
                      border: '1px solid ' + (planSidebarTab === 'daily' ? '#4b6cb7' : '#e5e7eb'),
                    }}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => setPlanSidebarTab('weekly')}
                    className={"btn " + (planSidebarTab === 'weekly' ? 'btn-primary' : 'btn-ghost')}
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      padding: '8px 10px',
                      fontSize: 11,
                      fontWeight: 800,
                      background: planSidebarTab === 'weekly' ? '#4b6cb7' : '#ffffff',
                      color: planSidebarTab === 'weekly' ? '#ffffff' : '#0f172a',
                      border: '1px solid ' + (planSidebarTab === 'weekly' ? '#4b6cb7' : '#e5e7eb'),
                    }}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setPlanSidebarTab('monthly')}
                    className={"btn " + (planSidebarTab === 'monthly' ? 'btn-primary' : 'btn-ghost')}
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      padding: '8px 10px',
                      fontSize: 11,
                      fontWeight: 800,
                      background: planSidebarTab === 'monthly' ? '#4b6cb7' : '#ffffff',
                      color: planSidebarTab === 'monthly' ? '#ffffff' : '#0f172a',
                      border: '1px solid ' + (planSidebarTab === 'monthly' ? '#4b6cb7' : '#e5e7eb'),
                    }}
                  >
                    Monthly
                  </button>
                </div>

                <div style={{ background: '#ffffff', padding: 12, borderRadius: 12, border: '1px solid #eef2f7', boxShadow: 'none', overflowY: 'auto', maxHeight: isPortrait ? '56vh' : '56vh' }}>
                  {renderPlanSidebarContent()}
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Monthly entries: <strong style={{ color: '#0f172a' }}>{monthlyCount}</strong></div>
                  <div>
                    <button className="btn btn-ghost" onClick={() => setPlanRefreshKey((k) => k + 1)}>Refresh</button>
                  </div>
                </div>
              </>
              )}
            </div>
          </>
        );
      })()}

      {/* ================= MESSAGE BUTTON ================= */}
     

{/* ================= FIXED MESSAGE BUTTON ================= */}
<div
  onClick={() => setTeacherChatOpen(true)}
  style={{
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "60px",
    height: "60px",
    background: "linear-gradient(135deg, #833ab4, #0259fa, #459afc)",
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
  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1) ")}
>
  <FaCommentDots size={30} />
</div>


</div>
  

    </div>
 
)}

      </div>

      {/* ---------------- MINI POPUP CHAT ---------------- */}
      {teacherChatOpen && selectedTeacher && (
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
            <div style={{ display: "flex", flexDirection: "column" }}>
              <strong>{selectedTeacher.name}</strong>
              {typingUserId && String(typingUserId) !== String(adminUserId) && (
                <span style={{ fontSize: 12, color: "#666" }}>Typing…</span>
              )}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  if (selectedTeacher?.userId && adminUserId) {
                    clearTyping(getChatKey(selectedTeacher.userId, adminUserId));
                  }
                  setTeacherChatOpen(false);
                  navigate("/all-chat", { state: { user: selectedTeacher, tab: "teacher" } });
                }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px" }}
              >
                ⤢
              </button>
              <button
                onClick={() => {
                  if (selectedTeacher?.userId && adminUserId) {
                    clearTyping(getChatKey(selectedTeacher.userId, adminUserId));
                  }
                  setTeacherChatOpen(false);
                }}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, padding: "12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", background: "#f9f9f9" }}>
            {popupMessages.length === 0 ? (
              <p style={{ textAlign: "center", color: "#aaa" }}>Start chatting with {selectedTeacher.name}</p>
            ) : (
              popupMessages.map((m) => {
                const isAdmin = String(m.senderId) === String(adminUserId) || m.sender === "admin";
                return (
                  <div key={m.messageId || m.id} style={{ display: "flex", flexDirection: "column", alignItems: isAdmin ? "flex-end" : "flex-start", marginBottom: 10 }}>
                    <div style={{ maxWidth: "70%", background: isAdmin ? "#4facfe" : "#fff", color: isAdmin ? "#fff" : "#000", padding: "10px 14px", borderRadius: 18, borderTopRightRadius: isAdmin ? 0 : 18, borderTopLeftRadius: isAdmin ? 18 : 0, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", wordBreak: "break-word", cursor: "default", position: "relative" }}>
                      {m.text} {m.edited && (<small style={{ fontSize: 10 }}> (edited)</small>)}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 6, fontSize: 11, color: isAdmin ? "#fff" : "#888" }}>
                        <span style={{ marginRight: 6, fontSize: 11, opacity: 0.9 }}>{formatDateLabel(m.timeStamp)}</span>
                        <span>{formatTime(m.timeStamp)}</span>
                        {isAdmin && !m.deleted && (
                          <span style={{ display: "flex", gap: 0, alignItems: "center" }}>
                            <FaCheck size={10} color={isAdmin ? "#fff" : "#888"} style={{ opacity: 0.85, marginLeft: 4 }} />
                            {m.seen && (<FaCheck size={10} color={isAdmin ? "#f3f7f8" : "#ccc"} style={{ marginLeft: 2, opacity: 0.95 }} />)}
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
          <div style={{ padding: "10px", borderTop: "1px solid #eee", display: "flex", gap: "8px", background: "#fff" }}>
            <input
              value={popupInput}
              onChange={(e) => {
                const value = e.target.value;
                setPopupInput(value);
                handleTyping(value);
              }}
              placeholder="Type a message..."
              style={{ flex: 1, padding: "10px 14px", borderRadius: "25px", border: "1px solid #ccc", outline: "none" }}
              onKeyDown={(e) => { if (e.key === "Enter") sendPopupMessage(); }}
            />
            <button onClick={() => sendPopupMessage()} style={{ width: 45, height: 45, borderRadius: "50%", background: "#4facfe", border: "none", color: "#fff", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
              <FaPaperPlane />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeachersPage;
