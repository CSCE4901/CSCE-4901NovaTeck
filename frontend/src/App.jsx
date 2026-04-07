import { useState, useEffect, createContext, useContext } from "react";

const API = "/api";
const AuthContext = createContext(null);

// ─── helpers ─────────────────────────────────────────────────────
function useAuth() { return useContext(AuthContext); }

async function apiFetch(path, options = {}, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(API + path, { ...options, headers: { ...headers, ...options.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ─── App shell ───────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState(() => {
    const t = localStorage.getItem("nt_token");
    const u = localStorage.getItem("nt_user");
    return t && u ? { token: t, ...JSON.parse(u) } : null;
  });
  const [page, setPage] = useState("jobs"); // jobs | detail | dashboard | skillgap | login | register
  const [selectedJobId, setSelectedJobId] = useState(null);

  function login(token, user) {
    localStorage.setItem("nt_token", token);
    localStorage.setItem("nt_user", JSON.stringify(user));
    setAuth({ token, ...user });
    setPage("jobs");
  }

  function logout() {
    localStorage.clear();
    setAuth(null);
    setPage("login");
  }

  function goJob(id) { setSelectedJobId(id); setPage("detail"); }

  return (
    <AuthContext.Provider value={auth}>
      <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "Segoe UI, sans-serif" }}>
        <Navbar page={page} setPage={setPage} logout={logout} auth={auth} />
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
          {page === "login"     && <LoginPage onLogin={login} setPage={setPage} />}
          {page === "register"  && <RegisterPage onLogin={login} setPage={setPage} />}
          {page === "jobs"      && <JobListingsPage goJob={goJob} />}
          {page === "detail"    && <JobDetailPage jobId={selectedJobId} setPage={setPage} />}
          {page === "dashboard" && <DashboardPage goJob={goJob} setPage={setPage} />}
          {page === "skillgap"  && <SkillGapPage />}
        </div>
      </div>
    </AuthContext.Provider>
  );
}

// ─── Navbar ──────────────────────────────────────────────────────
function Navbar({ page, setPage, logout, auth }) {
  const active = p => ({
    cursor: "pointer", padding: "8px 16px", borderRadius: 6,
    background: page === p ? "#1e40af" : "transparent",
    color: "#fff", fontWeight: page === p ? 700 : 400,
    border: "none", fontSize: 14,
  });
  return (
    <nav style={{ background: "#1e3a8a", padding: "0 24px", display: "flex", alignItems: "center", gap: 4, height: 56 }}>
      <span style={{ color: "#93c5fd", fontWeight: 800, fontSize: 18, marginRight: 24 }}>
        🚀 NovaTeck
      </span>
      <button style={active("jobs")} onClick={() => setPage("jobs")}>Jobs</button>
      {auth && <button style={active("dashboard")} onClick={() => setPage("dashboard")}>Dashboard</button>}
      {auth && <button style={active("skillgap")} onClick={() => setPage("skillgap")}>Skill Gap</button>}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
        {auth ? (
          <>
            <span style={{ color: "#bfdbfe", fontSize: 13 }}>Hi, {auth.name?.split(" ")[0]}</span>
            <button onClick={logout} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>Logout</button>
          </>
        ) : (
          <>
            <button onClick={() => setPage("login")} style={{ background: "transparent", color: "#bfdbfe", border: "1px solid #3b82f6", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>Login</button>
            <button onClick={() => setPage("register")} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>Register</button>
          </>
        )}
      </div>
    </nav>
  );
}

// ─── LoginPage ───────────────────────────────────────────────────
function LoginPage({ onLogin, setPage }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr]   = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setErr(""); setLoading(true);
    try {
      const data = await apiFetch("/auth/login", { method: "POST", body: JSON.stringify(form) });
      onLogin(data.token, { user_id: data.user_id, name: data.name });
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 420, margin: "60px auto" }}>
      <Card>
        <h2 style={hStyle}>Sign In</h2>
        <p style={{ color: "#6b7280", marginBottom: 24, textAlign: "center" }}>Welcome back to NovaTeck DFW Job Tracker</p>
        {err && <Alert msg={err} />}
        <Label>Email</Label>
        <Input type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="student@test.com" />
        <Label>Password</Label>
        <Input type="password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} placeholder="••••••••" />
        <Btn onClick={handleSubmit} loading={loading} full>Sign In</Btn>
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 14, color: "#6b7280" }}>
          No account? <span style={linkStyle} onClick={() => setPage("register")}>Register here</span>
        </p>
        <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
          Demo: student@test.com / test1234
        </p>
      </Card>
    </div>
  );
}

// ─── RegisterPage ────────────────────────────────────────────────
function RegisterPage({ onLogin, setPage }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", skills: "" });
  const [err, setErr]   = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setErr(""); setLoading(true);
    try {
      const payload = { ...form, skills: form.skills.split(",").map(s => s.trim()).filter(Boolean) };
      const data = await apiFetch("/auth/register", { method: "POST", body: JSON.stringify(payload) });
      onLogin(data.token, { user_id: data.user_id, name: data.name });
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 460, margin: "40px auto" }}>
      <Card>
        <h2 style={hStyle}>Create Account</h2>
        {err && <Alert msg={err} />}
        <Label>Full Name *</Label>
        <Input value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Jane Doe" />
        <Label>Email *</Label>
        <Input type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="jane@example.com" />
        <Label>Password * (8+ characters)</Label>
        <Input type="password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} placeholder="••••••••" />
        <Label>Your Skills (comma-separated, optional)</Label>
        <Input value={form.skills} onChange={v => setForm(f => ({ ...f, skills: v }))} placeholder="Python, SQL, React, Git" />
        <p style={{ fontSize: 12, color: "#9ca3af", margin: "-8px 0 16px" }}>Used to power your skill gap analysis</p>
        <Btn onClick={handleSubmit} loading={loading} full>Create Account</Btn>
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 14, color: "#6b7280" }}>
          Already have an account? <span style={linkStyle} onClick={() => setPage("login")}>Sign in</span>
        </p>
      </Card>
    </div>
  );
}

// ─── JobListingsPage ─────────────────────────────────────────────
function JobListingsPage({ goJob }) {
  const auth = useAuth();
  const [jobs, setJobs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [skill, setSkill]       = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving]     = useState({});
  const [saved, setSaved]       = useState({});
  const [msg, setMsg]           = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (skill)    params.append("skill", skill);
      if (location) params.append("location", location);
      const data = await apiFetch(`/jobs?${params}`);
      setJobs(Array.isArray(data) ? data : []);
    } catch { setJobs([]); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave(job_id) {
    if (!auth) return alert("Please login to save jobs");
    setSaving(s => ({ ...s, [job_id]: true }));
    try {
      await apiFetch("/saved-jobs", { method: "POST", body: JSON.stringify({ job_id }) }, auth.token);
      setSaved(s => ({ ...s, [job_id]: true }));
      setMsg("Job saved! ✓");
      setTimeout(() => setMsg(""), 2000);
    } catch (e) { alert(e.message); }
    setSaving(s => ({ ...s, [job_id]: false }));
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1e3a8a", marginBottom: 4 }}>DFW Tech Jobs</h1>
      <p style={{ color: "#6b7280", marginBottom: 20 }}>Browse and filter jobs from top DFW technology companies</p>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input value={skill} onChange={e => setSkill(e.target.value)} placeholder="Filter by skill (e.g. Python)"
          style={filterInput} onKeyDown={e => e.key === "Enter" && load()} />
        <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Filter by location (e.g. Dallas)"
          style={filterInput} onKeyDown={e => e.key === "Enter" && load()} />
        <button onClick={load} style={{ background: "#1e40af", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontWeight: 600 }}>Search</button>
        <button onClick={() => { setSkill(""); setLocation(""); setTimeout(load, 0); }}
          style={{ background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, padding: "10px 16px", cursor: "pointer" }}>Clear</button>
      </div>

      {msg && <div style={{ background: "#d1fae5", color: "#065f46", padding: "10px 16px", borderRadius: 8, marginBottom: 16 }}>{msg}</div>}

      {loading ? <Spinner /> : (
        <>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>{jobs.length} jobs found</p>
          <div style={{ display: "grid", gap: 16 }}>
            {jobs.map(job => (
              <div key={job.job_id} style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1e3a8a", cursor: "pointer" }}
                      onClick={() => goJob(job.job_id)}>{job.title}</h3>
                    <p style={{ margin: "4px 0 0", color: "#374151", fontSize: 14 }}>
                      {job.company_name} · {job.location}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {job.salary_range && <span style={tagStyle("#dbeafe", "#1e40af")}>{job.salary_range}</span>}
                    {job.job_type    && <span style={tagStyle("#f3f4f6", "#374151")}>{job.job_type}</span>}
                  </div>
                </div>
                <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>Posted: {job.date_posted || "N/A"}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => goJob(job.job_id)}
                      style={{ background: "transparent", color: "#1e40af", border: "1px solid #1e40af", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>View Details</button>
                    <button onClick={() => handleSave(job.job_id)} disabled={saving[job.job_id] || saved[job.job_id]}
                      style={{ background: saved[job.job_id] ? "#d1fae5" : "#1e40af", color: saved[job.job_id] ? "#065f46" : "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>
                      {saved[job.job_id] ? "Saved ✓" : saving[job.job_id] ? "Saving..." : "Save Job"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── JobDetailPage ───────────────────────────────────────────────
function JobDetailPage({ jobId, setPage }) {
  const auth = useAuth();
  const [job, setJob]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved]   = useState(false);
  const [msg, setMsg]       = useState("");

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    apiFetch(`/jobs/${jobId}`).then(d => { setJob(d); setLoading(false); }).catch(() => setLoading(false));
  }, [jobId]);

  async function handleSave() {
    if (!auth) return alert("Please login to save jobs");
    try {
      await apiFetch("/saved-jobs", { method: "POST", body: JSON.stringify({ job_id: jobId }) }, auth.token);
      setSaved(true); setMsg("Job saved to your dashboard! ✓");
    } catch (e) { setMsg(e.message); }
  }

  if (loading) return <Spinner />;
  if (!job)    return <p>Job not found.</p>;

  const required  = (job.skills || []).filter(s => s.requirement_type === "required");
  const preferred = (job.skills || []).filter(s => s.requirement_type === "preferred");

  return (
    <div>
      <button onClick={() => setPage("jobs")} style={{ background: "transparent", border: "none", color: "#1e40af", cursor: "pointer", fontSize: 14, marginBottom: 16 }}>← Back to Jobs</button>
      {msg && <div style={{ background: "#d1fae5", color: "#065f46", padding: "10px 16px", borderRadius: 8, marginBottom: 16 }}>{msg}</div>}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1e3a8a" }}>{job.title}</h1>
            <p style={{ margin: "6px 0 0", fontSize: 16, color: "#374151" }}>{job.company_name}</p>
            <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              {job.location     && <span style={tagStyle("#f3f4f6", "#374151")}>📍 {job.location}</span>}
              {job.job_type     && <span style={tagStyle("#dbeafe", "#1e40af")}>{job.job_type}</span>}
              {job.salary_range && <span style={tagStyle("#d1fae5", "#065f46")}>💰 {job.salary_range}</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a href={job.source_url} target="_blank" rel="noreferrer"
              style={{ background: "#059669", color: "#fff", textDecoration: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 600, fontSize: 14 }}>Apply Now ↗</a>
            <button onClick={handleSave} disabled={saved}
              style={{ background: saved ? "#d1fae5" : "#1e40af", color: saved ? "#065f46" : "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
              {saved ? "Saved ✓" : "Save Job"}
            </button>
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "20px 0" }} />

        {required.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ color: "#1e3a8a", marginBottom: 10 }}>Required Skills</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {required.map(s => <span key={s.skill_name} style={tagStyle("#dbeafe", "#1e40af", true)}>{s.skill_name}</span>)}
            </div>
          </div>
        )}
        {preferred.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ color: "#374151", marginBottom: 10 }}>Preferred Skills</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {preferred.map(s => <span key={s.skill_name} style={{ ...tagStyle("#f9fafb", "#6b7280"), border: "1px dashed #9ca3af" }}>{s.skill_name}</span>)}
            </div>
          </div>
        )}

        <h4 style={{ color: "#1e3a8a", marginBottom: 12 }}>Job Description</h4>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14, lineHeight: 1.7, color: "#374151", background: "#f9fafb", padding: 16, borderRadius: 8 }}>
          {job.description || "No description available."}
        </pre>

        <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 16 }}>
          Source: <a href={job.source_url} target="_blank" rel="noreferrer" style={{ color: "#6b7280" }}>{job.source_url}</a>
          {job.date_posted && ` · Posted: ${job.date_posted}`}
        </p>
      </Card>
    </div>
  );
}

// ─── DashboardPage ───────────────────────────────────────────────
function DashboardPage({ goJob, setPage }) {
  const auth = useAuth();
  const [student, setStudent]     = useState(null);
  const [saved, setSaved]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [removing, setRemoving]   = useState({});

  useEffect(() => {
    if (!auth) return;
    Promise.all([
      apiFetch(`/students/${auth.user_id}`, {}, auth.token),
      apiFetch(`/students/${auth.user_id}/saved-jobs`, {}, auth.token),
    ]).then(([s, j]) => { setStudent(s); setSaved(Array.isArray(j) ? j : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [auth]);

  async function removeSaved(job_id) {
    setRemoving(r => ({ ...r, [job_id]: true }));
    await apiFetch(`/saved-jobs/${job_id}`, { method: "DELETE" }, auth.token).catch(() => {});
    setSaved(s => s.filter(j => j.job_id !== job_id));
    setRemoving(r => ({ ...r, [job_id]: false }));
  }

  if (!auth) return <div style={{ textAlign: "center", marginTop: 60 }}><p>Please <span style={linkStyle} onClick={() => setPage("login")}>login</span> to view your dashboard.</p></div>;
  if (loading) return <Spinner />;

  const skills = student?.skills ? student.skills.split(",").map(s => s.trim()).filter(Boolean) : [];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1e3a8a", marginBottom: 4 }}>
        Welcome back, {student?.name?.split(" ")[0] || "Student"}!
      </h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>Your NovaTeck dashboard</p>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Saved Jobs", value: saved.length, color: "#1e40af" },
          { label: "Your Skills", value: skills.length, color: "#059669" },
          { label: "Companies", value: 3, color: "#7c3aed" },
          { label: "DFW Jobs", value: "51+", color: "#dc2626" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "#fff", borderRadius: 12, padding: "20px 16px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: 28, fontWeight: 800, color: stat.color, margin: 0 }}>{stat.value}</p>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>{stat.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Saved Jobs */}
        <Card title="Saved Jobs">
          {saved.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 14 }}>No saved jobs yet. Browse jobs and save ones you like!</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {saved.map(job => (
                <div key={job.job_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#f9fafb", borderRadius: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, color: "#1e3a8a", cursor: "pointer", fontSize: 14 }} onClick={() => goJob(job.job_id)}>{job.title}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>{job.company_name} · {job.location}</p>
                  </div>
                  <button onClick={() => removeSaved(job.job_id)} disabled={removing[job.job_id]}
                    style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>
                    {removing[job.job_id] ? "..." : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Profile */}
        <Card title="Your Profile">
          <div style={{ marginBottom: 12 }}>
            <p style={{ margin: 0, fontWeight: 600, color: "#374151" }}>{student?.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>{student?.email}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>Member since {student?.created_at?.split("T")[0]}</p>
          </div>
          <h4 style={{ fontSize: 13, color: "#374151", marginBottom: 8 }}>Your Skills</h4>
          {skills.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {skills.map(s => <span key={s} style={tagStyle("#dbeafe", "#1e40af")}>{s}</span>)}
            </div>
          ) : <p style={{ fontSize: 13, color: "#9ca3af" }}>No skills listed yet.</p>}
          <button onClick={() => setPage("skillgap")} style={{ marginTop: 16, background: "#1e40af", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            View Skill Gap Analysis →
          </button>
        </Card>
      </div>
    </div>
  );
}

// ─── SkillGapPage ────────────────────────────────────────────────
function SkillGapPage() {
  const auth = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState("");

  async function load() {
    if (!auth) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/students/${auth.user_id}/skill-gap`, {}, auth.token);
      setData(res);
    } catch { setData(null); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [auth]);

  async function saveSkills() {
    setSaving(true);
    const skills = skillInput.split(",").map(s => s.trim()).filter(Boolean);
    try {
      await apiFetch(`/students/${auth.user_id}/skills`, { method: "PUT", body: JSON.stringify({ skills }) }, auth.token);
      setMsg("Skills updated!"); setEditMode(false); await load();
    } catch (e) { setMsg(e.message); }
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  }

  if (!auth) return <p style={{ textAlign: "center", marginTop: 60 }}>Please login to view skill gap analysis.</p>;
  if (loading) return <Spinner />;

  const pct    = data?.overall_match_pct ?? 0;
  const barColor = pct >= 70 ? "#16a34a" : pct >= 40 ? "#d97706" : "#dc2626";
  const missing  = data?.missing_skills  || [];
  const matched  = data?.matched_skills  || [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1e3a8a" }}>Skill Gap Analysis</h1>
        <button onClick={() => { setEditMode(e => !e); setSkillInput((data?.user_skills || []).join(", ")); }}
          style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>
          ✏️ Update My Skills
        </button>
      </div>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>Your skills vs. what DFW tech employers actually need</p>

      {msg && <div style={{ background: "#d1fae5", color: "#065f46", padding: "10px 16px", borderRadius: 8, marginBottom: 16 }}>{msg}</div>}

      {editMode && (
        <Card>
          <h4 style={{ margin: "0 0 12px" }}>Update Your Skills</h4>
          <textarea value={skillInput} onChange={e => setSkillInput(e.target.value)} rows={3}
            placeholder="Python, SQL, React, Git, JavaScript, AWS..."
            style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: 10, fontSize: 14, boxSizing: "border-box", resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={saveSkills} disabled={saving} style={{ background: "#1e40af", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={() => setEditMode(false)} style={{ background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>Cancel</button>
          </div>
        </Card>
      )}

      {/* Overall match */}
      <Card>
        <h3 style={{ margin: "0 0 16px", color: "#1e3a8a" }}>Overall Market Match</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
          <div style={{ flex: 1, background: "#e5e7eb", borderRadius: 999, height: 24, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 999, transition: "width 0.6s ease", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{pct > 10 ? `${pct}%` : ""}</span>
            </div>
          </div>
          <span style={{ fontWeight: 800, fontSize: 22, color: barColor, minWidth: 50 }}>{pct}%</span>
        </div>
        <p style={{ fontSize: 13, color: "#6b7280" }}>
          {pct >= 70 ? "Strong match! Your skills align well with DFW tech demand." :
           pct >= 40 ? "Moderate match. Focus on the missing skills below to improve." :
           "Low match. Consider building the top missing skills listed below."}
        </p>
      </Card>

      {/* Progress bars per matched skill */}
      {matched.length > 0 && (
        <Card title="Skills You Have (in demand)">
          <div style={{ display: "grid", gap: 12 }}>
            {matched.slice(0, 10).map(s => {
              const w = Math.min(100, Math.round((s.demand_count / (matched[0]?.demand_count || 1)) * 100));
              return (
                <div key={s.skill_name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: "#374151" }}>{s.skill_name}</span>
                    <span style={{ color: "#6b7280" }}>{s.demand_count} jobs</span>
                  </div>
                  <div style={{ background: "#e5e7eb", borderRadius: 999, height: 10 }}>
                    <div style={{ width: `${w}%`, height: "100%", background: "#16a34a", borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Missing skills bar chart */}
      {missing.length > 0 && (
        <Card title="Top Missing Skills (most demanded by employers)">
          <div style={{ display: "grid", gap: 12 }}>
            {missing.map(s => {
              const w = Math.min(100, Math.round((s.demand_count / (missing[0]?.demand_count || 1)) * 100));
              const c = w >= 70 ? "#dc2626" : w >= 40 ? "#d97706" : "#f59e0b";
              return (
                <div key={s.skill_name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: "#374151" }}>{s.skill_name}</span>
                    <span style={{ color: "#6b7280" }}>{s.demand_count} jobs need this</span>
                  </div>
                  <div style={{ background: "#e5e7eb", borderRadius: 999, height: 10 }}>
                    <div style={{ width: `${w}%`, height: "100%", background: c, borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 20, padding: 14, background: "#fef9c3", borderRadius: 8, border: "1px solid #fde68a" }}>
            <p style={{ margin: 0, fontSize: 13, color: "#92400e", fontWeight: 600 }}>💡 Suggested Learning Resources</p>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, color: "#78350f" }}>
              {missing.slice(0, 3).map(s => (
                <li key={s.skill_name}><strong>{s.skill_name}</strong>: Search on Coursera, freeCodeCamp, or official documentation</li>
              ))}
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Shared UI primitives ────────────────────────────────────────
const hStyle = { fontSize: 22, fontWeight: 700, color: "#1e3a8a", textAlign: "center", marginBottom: 8 };
const linkStyle = { color: "#1e40af", cursor: "pointer", fontWeight: 600 };
const filterInput = { flex: 1, minWidth: 160, border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none" };

function tagStyle(bg, color, filled = false) {
  return { background: bg, color, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, display: "inline-block" };
}

function Card({ children, title }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb", marginBottom: 20 }}>
      {title && <h3 style={{ margin: "0 0 16px", color: "#1e3a8a", fontSize: 16 }}>{title}</h3>}
      {children}
    </div>
  );
}

function Alert({ msg }) {
  return <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{msg}</div>;
}

function Spinner() {
  return <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Loading...</div>;
}

function Label({ children }) {
  return <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#374151" }}>{children}</p>;
}

function Input({ type = "text", value, onChange, placeholder }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 12px", fontSize: 14, marginBottom: 16, boxSizing: "border-box", outline: "none" }} />
  );
}

function Btn({ children, onClick, loading, full }) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{ width: full ? "100%" : "auto", background: loading ? "#93c5fd" : "#1e40af", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
      {loading ? "Please wait..." : children}
    </button>
  );
}
