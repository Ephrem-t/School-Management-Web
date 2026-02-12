import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaUpload, FaSave } from "react-icons/fa";
import { BACKEND_BASE } from "../config";

export default function ParentRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", username: "", phone: "", password: "" });
  const [profile, setProfile] = useState(null);
  const [children, setChildren] = useState([{ studentId: "", relationship: "" }]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const relationships = ["Mother", "Father", "Guardian", "Other"];

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleChildChange = (index, e) => {
    const { name, value } = e.target;
    const updated = [...children];
    updated[index][name] = value;
    setChildren(updated);
  };

  const addChild = () => setChildren(c => [...c, { studentId: "", relationship: "" }]);
  const removeChild = (i) => setChildren(c => c.filter((_, idx) => idx !== i));

  const validate = () => {
    if (!form.name.trim() || !form.username.trim() || !form.phone.trim() || !form.password) {
      setMessage("Name, username, phone and password are required.");
      return false;
    }
    if (children.length === 0) {
      setMessage("Add at least one child.");
      return false;
    }
    for (let c of children) {
      if (!c.studentId.trim() || !c.relationship) {
        setMessage("Each child must have studentId and relationship.");
        return false;
      }
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
      fd.append("username", form.username);
      fd.append("phone", form.phone);
      fd.append("password", form.password);
      if (profile) fd.append("profile", profile);

      // Append multiple studentId and relationship fields
      for (const c of children) {
        fd.append("studentId", c.studentId);
        fd.append("relationship", c.relationship);
      }

      const res = await fetch(`${BACKEND_BASE}/register/parent`, { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage(`Parent registered. parentId: ${data.parentId || ''}`);
        setForm({ name: "", username: "", phone: "", password: "" });
        setChildren([{ studentId: "", relationship: "" }]);
        setProfile(null);
        // optional navigate after short delay
        setTimeout(() => navigate('/'), 1400);
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
            style={{ background: 'none', border: 'none', color: "black", cursor: 'pointer', fontSize: 20, width: 10 }}
          >
            ←
          </button>
          <h2 style={{ margin: 0 }}>Parent Registration</h2>
        </div>

        {message && <div style={{ marginBottom: 12, color: message.startsWith('Parent registered') ? 'green' : '#b91c1c' }}>{message}</div>}

        <form onSubmit={handleSubmit}>
          <label style={{textAlign: "left", marginBottom: 10, display: 'block', fontWeight: 700, color: '#334155', fontSize: 13 }}>Full name</label>
          <input name="name" className="" value={form.name} onChange={handleChange} placeholder="Full name" />

          <label style={{textAlign: "left", marginBottom: 10, display: 'block', fontWeight: 700, color: '#334155', fontSize: 13 }}>Username</label>
          <input name="username" value={form.username} onChange={handleChange} placeholder="Unique username" />

          <label style={{textAlign: "left", marginBottom: 10, display: 'block', fontWeight: 700, color: '#334155', fontSize: 13}}>Phone</label>
          <input name="phone" value={form.phone} onChange={handleChange} placeholder="+251xxxxxxxx" />

          <label style={{textAlign: "left", marginBottom: 10, display: 'block', fontWeight: 700, color: '#334155', fontSize: 13}}>Password</label>
          <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Choose a password" />

          <label style={{ textAlign: "left", marginBottom: 10, display: 'block', fontWeight: 700, color: '#334155', fontSize: 13}}>Profile photo (optional)</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <label className="file-label">
              <FaUpload />
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setProfile(e.target.files[0])} />
              <span style={{ marginLeft: 8 }}>{profile ? profile.name : 'Choose a photo'}</span>
            </label>
            {profile && <img src={URL.createObjectURL(profile)} alt="preview" className="profile-preview" />}
          </div>

          <h3 style={{textAlign: "left", marginBottom: 10, display: 'block', fontWeight: 700, color: '#334155', fontSize: 18}}>Children</h3>
          {children.map((c, i) => (
            <div key={i} className="children-row">
              <input name="studentId" value={c.studentId} onChange={(e) => handleChildChange(i, e)} placeholder="StudentId (e.g. GES_0001_26)" />
              <select name="relationship" value={c.relationship} onChange={(e) => handleChildChange(i, e)}>
                <option value="">Select relationship</option>
                {relationships.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <div>
                {children.length > 1 && <button type="button" className="muted-btn" onClick={() => removeChild(i)} style={{ marginRight: 8 }}>Remove</button>}
                {i === children.length - 1 && <button type="button" className="muted-btn" onClick={addChild}>Add</button>}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="submit" className="" disabled={submitting}>{submitting ? 'Saving...' : (<><FaSave style={{ marginRight: 8 }} /> Register</>)}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
