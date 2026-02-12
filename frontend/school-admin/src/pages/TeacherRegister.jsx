import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/login.css";
import { BACKEND_BASE } from "../config";
import { ref as dbRef, get, push } from "firebase/database";
import { db } from "../firebase";

export default function Register() {
  const navigate = useNavigate();

  const gradeOptions = ["1","1AO", "2", "3", "4", "4AO", "5", "6", "7", "8"];
  const sectionOptions = ["A", "B", "C"];
  const subjectOptions = {
     "1": [
      "Mathematics",
      "Amharic",
      "English",
      "Safuu",
      "Environmental Science",
      "ART",
      "HPE",
      "Afaan Oromoo",  
    ],

      "1AO": [
      "Mathematics",
      "Gadaaa",
      "English",
      "Safuu",
      "Environmental Science",
      "ART",
      "HPE",
      "Afaan Oromoo",  
      
    ],
     "2": [
      "Mathematics",
      "Amharic",
      "English",
      "Safuu",
      "Environmental Science",
      "ART",
      "HPE",
      "Afaan Oromoo",
      
    ],
     "3": [
      "Mathematics",
      "Amharic",
      "English",
      "Safuu",
      "Environmental Science",
      "ART",
      "HPE",
      "Afaan Oromoo",
      
    ],
     "4": [
     "Mathematics",
      "Amharic",
      "English",
      "Safuu",
      "Environmental Science",
      "ART",
      "HPE",
      "Afaan Oromoo",
    ],

      "4AO": [
     "Mathematics",
      "Gadaaa",
      "English",
      "Safuu",
      "Environmental Science",
      "ART",
      "HPE",
      "Afaan Oromoo",
    ],
     "5": [
      "Afaan Oromoo",
     "Mathematics",
      "Amharic",
      "English",
      "Safuu",
      "Environmental Science",
      "ART",
      "HPE",
     
      
      
    ],
    "6": [
      "Afaan Oromoo",
     "Mathematics",
      "Amharic",
      "English",
      "Safuu",
      "Environmental Science",
      "ART",
      "HPE",
      
      
    ],    

    "7": [
      "Mathematics",
      "Amharic",
      "English",
      "General Science",
      "ART",
      "OT",
      "HPE",
      "Social Studies",
      "Civics",
      "ICT",
      "Afaan Oromoo",
    ],
      
    "8": [
     "Mathematics",
      "Amharic",
      "English",
      "General Science",
      "ART",
      "OT",
      "HPE",
      "Social Studies",
      "Civics",
      "ICT",
      "Afaan Oromoo",
    ],

  };

  const [formData, setFormData] = useState({
    name: "",
    password: "",
    email: "",
    phone: "",
    gender: "",
    courses: [{ grade: "", section: "", subject: "" }],
  });
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  const [assignedTeacherId, setAssignedTeacherId] = useState("");

  // For adding subject to existing teacher
  const [existingTeacherKey, setExistingTeacherKey] = useState("");
  const [existingCourse, setExistingCourse] = useState({ grade: "", section: "", subject: "" });
  const [addingMsg, setAddingMsg] = useState("");

  const handleChange = (e, index = null) => {
    const { name, value } = e.target;
    if (index !== null) {
      const updatedCourses = [...formData.courses];
      updatedCourses[index][name] = value;
      if (name === "grade") updatedCourses[index]["subject"] = "";
      setFormData({ ...formData, courses: updatedCourses });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const addCourse = () => {
    setFormData({
      ...formData,
      courses: [...formData.courses, { grade: "", section: "", subject: "" }],
    });
  };

  const handleAddToExisting = async (e) => {
    e.preventDefault();
    setAddingMsg("");
    const { grade, section, subject } = existingCourse;
    if (!existingTeacherKey) { setAddingMsg("Enter teacher key"); return; }
    if (!grade || !section || !subject) { setAddingMsg("Select grade, section and subject"); return; }

    try {
      // Verify teacher exists
      const teacherSnap = await get(dbRef(db, `Teachers/${existingTeacherKey}`));
      if (!teacherSnap.exists()) {
        setAddingMsg("Teacher not found by that key.");
        return;
      }

      // Find matching courseId in Courses node
      const coursesSnap = await get(dbRef(db, "Courses"));
      const courses = coursesSnap.exists() ? coursesSnap.val() : {};
      let foundCourseId = null;
      for (const [cid, c] of Object.entries(courses)) {
        if ((c.grade == grade) && (String(c.section) == String(section)) && (c.subject == subject)) {
          foundCourseId = cid;
          break;
        }
      }

      if (!foundCourseId) {
        // Create the course automatically (mirror behavior from registration)
        const newCourseRef = await push(dbRef(db, "Courses"), { grade, section, subject });
        foundCourseId = newCourseRef.key;
        // Informative message after assignment
        setAddingMsg("Course did not exist — created new course and assigning...");
      }

      // Push to TeacherAssignments
      await push(dbRef(db, "TeacherAssignments"), { teacherId: existingTeacherKey, courseId: foundCourseId });
      setAddingMsg("Subject added to teacher successfully.");
      // clear selection
      setExistingCourse({ grade: "", section: "", subject: "" });
      setExistingTeacherKey("");
    } catch (err) {
      console.error("Add to existing teacher failed:", err);
      setAddingMsg("Failed to add subject. See console.");
    }
  };

  const removeCourse = (index) => {
    const updatedCourses = formData.courses.filter((_, i) => i !== index);
    setFormData({ ...formData, courses: updatedCourses });
  };

  const hasDuplicateCourse = () => {
    const seen = new Set();

    for (let c of formData.courses) {
      if (!c.grade || !c.section || !c.subject) continue;

      const key = `${c.grade}${c.section}-${c.subject}`;

      if (seen.has(key)) {
        return true;
      }
      seen.add(key);
    }
    return false;
  };

  const validateEmail = (email) =>
    email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());

  const validatePhone = (phone) =>
    /^[0-9+()\-\s]{6,20}$/.test(String(phone).trim());

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage("");
    setAssignedTeacherId("");

    // Frontend validation
    if (!validateEmail(formData.email)) {
      setMessage("Please enter a valid email address or leave it empty.");
      return;
    }
    if (!validatePhone(formData.phone)) {
      setMessage("Please enter a valid phone number.");
      return;
    }
    if (!formData.gender) {
      setMessage("Please select gender.");
      return;
    }
    if (!formData.name || !formData.password) {
      setMessage("Name and password are required.");
      return;
    }
    if (hasDuplicateCourse()) {
      setMessage(
        "Duplicate subject detected! A subject can only be taught once per grade and section."
      );
      return;
    }

    try {
      const dataToSend = new FormData();
      // NOTE: username removed from frontend. Server will set username = teacherId
      dataToSend.append("name", formData.name);
      dataToSend.append("password", formData.password);
      dataToSend.append("email", formData.email);
      dataToSend.append("phone", formData.phone);
      dataToSend.append("gender", formData.gender);
      dataToSend.append("courses", JSON.stringify(formData.courses));
      if (profile) dataToSend.append("profile", profile);

      const res = await fetch(`${BACKEND_BASE}/register/teacher`, {
        method: "POST",
        body: dataToSend,
      });

      const data = await res.json();

      if (data.success) {
        // Backend returns teacherId in response (assigned username)
        const tid = data.teacherKey || data.teacherId || data.teacherKey || data.teacherId || "";
        setAssignedTeacherId(tid);
        setFormData({
          name: "",
          password: "",
          email: "",
          phone: "",
          gender: "",
          courses: [{ grade: "", section: "", subject: "" }],
        });
        setProfile(null);
        setMessage("Registration successful. Your teacherId (username) is shown below.");
        // Optionally auto-navigate to login after a short delay:
        // setTimeout(() => navigate("/login"), 4000);i my 
      } else {
        setMessage(data.message || "Registration failed.");
      }
    } catch (err) {
      console.error("Registration error:", err);
      setMessage("Server error. Check console.");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box" style={{ maxWidth: "600px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            style={{ background: "none", width: "30px", border: "none", cursor: "pointer", fontSize: 20, color: "black", borderRadius: 4}}
          >
            ←
          </button>
          <h2 style={{ margin: 0 }}>Teacher Registration</h2>
        </div>
        {/* Add subject to existing teacher */}
        <div style={{ marginBottom: 12, padding: 12, border: "1px solid #eee", borderRadius: 8, background: "#fafafa" }}>
          <h3 style={{ marginTop: 0 }}>Add Subject To Existing Teacher</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input placeholder="Teacher key (e.g. TCHR123)" value={existingTeacherKey} onChange={e => setExistingTeacherKey(e.target.value)} />
            <select value={existingCourse.grade} onChange={e => setExistingCourse({ ...existingCourse, grade: e.target.value })}>
              <option value="">Grade</option>
              {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={existingCourse.section} onChange={e => setExistingCourse({ ...existingCourse, section: e.target.value })}>
              <option value="">Section</option>
              {sectionOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={existingCourse.subject} onChange={e => setExistingCourse({ ...existingCourse, subject: e.target.value })} disabled={!existingCourse.grade}>
              <option value="">Subject</option>
              {existingCourse.grade && subjectOptions[existingCourse.grade].map(subj => <option key={subj} value={subj}>{subj}</option>)}
            </select>
            <button className="add-btn" onClick={handleAddToExisting} style={{ whiteSpace: "nowrap" }}>Add Subject</button>
          </div>
          {addingMsg && <div style={{ marginTop: 8, color: addingMsg.startsWith("Failed") || addingMsg.includes("not found") ? "#b91c1c" : "#064e3b" }}>{addingMsg}</div>}
        </div>
        {message && <p className="auth-error">{message}</p>}

        <form onSubmit={handleRegister}>
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            required
          />

          {/* Username removed from form - server will assign teacherId as username */}

          <input
            type="email"
            name="email"
            placeholder="Email (optional)"
            value={formData.email}
            onChange={handleChange}
          />
          <input
            type="tel"
            name="phone"
            placeholder="Phone number"
            value={formData.phone}
            onChange={handleChange}
            required
          />
          <select
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            required
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />

          <div className="profile-upload">
            {profile && (
              <img
                src={URL.createObjectURL(profile)}
                alt="Profile Preview"
                className="profile-preview"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProfile(e.target.files[0])}
            />
          </div>

          <h3>Courses</h3>
          {formData.courses.map((course, index) => (
            <div className="course-group" key={index}>
              <select
                name="grade"
                value={course.grade}
                onChange={(e) => handleChange(e, index)}
                required
              >
                <option value="">Select Grade</option>
                {gradeOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              <select
                name="section"
                value={course.section}
                onChange={(e) => handleChange(e, index)}
                required
              >
                <option value="">Select Section</option>
                {sectionOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                name="subject"
                value={course.subject}
                onChange={(e) => handleChange(e, index)}
                required
                disabled={!course.grade}
              >
                <option value="">Select Subject</option>
                {course.grade &&
                  subjectOptions[course.grade].map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
              </select>

              {formData.courses.length > 1 && (
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => removeCourse(index)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          <button type="button" className="add-btn" onClick={addCourse} style={{marginTop: 10}}>
            Add Course
          </button>
          <button type="submit" className="submit-btn" style={{marginTop: 10}}>
            Register
          </button>
        </form>

        {assignedTeacherId && (
          <div className="auth-success" style={{ marginTop: 12 }}>
            <p>
              Registration complete. Your teacherId (username) is:{" "}
              <strong>{assignedTeacherId}</strong>
            </p>
            
          </div>
        )}

       
      </div>
    </div>
  );
}