import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaUpload, FaSave } from "react-icons/fa";
import { BACKEND_BASE } from "../config";

export default function StudentRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", password: "", email: "", phone: "", dob: "", gender: "", grade: "", section: "" });
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const grades = ["7", "8", "9", "10", "11 Social", "11 Natural", "12 Social", "12 Natural"];
  const sections = ["A", "B", "C"];

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const validate = () => {
    if (!form.name.trim() || !form.password || !form.grade || !form.section) {
      setMessage("Name, password, grade and section are required.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("password", form.password);
      fd.append("grade", form.grade);
      fd.append("section", form.section);
      if (form.email) fd.append("email", form.email);
      if (form.phone) fd.append("phone", form.phone);
      if (form.dob) fd.append("dob", form.dob);
      if (form.gender) fd.append("gender", form.gender);
      if (profile) fd.append("profile", profile);

      const res = await fetch(`${BACKEND_BASE}/register/student`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        setMessage("Student registered: " + (data.studentId || ""));
        // navigate to student list or login after short delay
        setTimeout(() => navigate('/students'), 1300);
      } else {
        setMessage(data.message || "Registration failed.");
      }
    } catch (err) {
      console.error(err);
      setMessage("Server error. Check console.");
    } finally {
      setSubmitting(false);
    }
  };

  const label = { fontSize: 13, color: '#334155', marginBottom: 6, display: 'block', fontWeight: 700 };

  return (
    <div className="auth-container">
      <div className="auth-box" style={{ maxWidth: 760 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, width: 10, color: "black" }}
          >
            ←
          </button>
          <h2 style={{ margin: 0 }}>Student Registration</h2>
        </div>
        {message && <div style={{ marginBottom: 12, color: message.startsWith('Student registered') ? 'green' : '#b91c1c' }}>{message}</div>}

        <form onSubmit={handleSubmit} className="vertical-form">
          <label style={label}>Full name</label>
          <input name="name" value={form.name} onChange={handleChange} placeholder="John Doe" />

          <label style={label}>Grade</label>
          <select name="grade" value={form.grade} onChange={handleChange}>
            <option value="">Select grade</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <label style={label}>Section</label>
          <select name="section" value={form.section} onChange={handleChange}>
            <option value="">Select section</option>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <label style={label}>Password</label>
          <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Choose a secure password" />

          <label style={label}>Email (optional)</label>
          <input name="email" value={form.email} onChange={handleChange} placeholder="student@example.com" />

          <label style={label}>Phone (optional)</label>
          <input name="phone" value={form.phone} onChange={handleChange} placeholder="+251xxxxxxxx" />

          <label style={label}>Date of birth (optional)</label>
          <input name="dob" type="date" value={form.dob} onChange={handleChange} />

          <label style={label}>Gender</label>
          <select name="gender" value={form.gender} onChange={handleChange}>
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          
          </select>

          <label style={{ marginTop: 6, display: 'block', fontWeight: 700 }}>Profile photo (optional)</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <label className="file-label">
              <FaUpload />
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setProfile(e.target.files[0])} />
              <span style={{ marginLeft: 8 }}>{profile ? profile.name : 'Choose a photo'}</span>
            </label>
            {profile && <img src={URL.createObjectURL(profile)} alt="preview" className="profile-preview" />}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : (<><FaSave style={{ marginRight: 8 }} /> Register</>)}</button>
          </div>
        </form>
      </div>
    </div>
  );
}