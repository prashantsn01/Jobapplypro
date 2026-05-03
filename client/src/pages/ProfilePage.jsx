import { useEffect, useState } from 'react';
import toast   from 'react-hot-toast';
import api     from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export default function ProfilePage() {
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [parsing, setParsing] = useState(false);
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
    api.get('/api/user/profile')
      .then(r => setProfile(r.data.user))
      .catch(() => toast.error('Failed to load profile'));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.patch('/api/user/profile', profile);
      setProfile(r.data.user);
      await refreshUser();
      toast.success('Profile saved!');
    } catch (err) {
      toast.error(err.response?.data?.error ? 'Validation error' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleResume = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('resume', file);
      const r = await api.post('/api/user/resume', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Resume parsed! Auto-filled ${r.data.fieldsFilled} fields`);
      // Reload profile to show parsed values
      const p = await api.get('/api/user/profile');
      setProfile(p.data.user);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Resume parse failed');
    } finally {
      setParsing(false);
    }
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (!s || (profile.skills || []).includes(s)) return;
    setProfile(p => ({ ...p, skills: [...(p.skills || []), s] }));
    setNewSkill('');
  };

  const removeSkill = (sk) => setProfile(p => ({ ...p, skills: p.skills.filter(s => s !== sk) }));

  const set = (k, v) => setProfile(p => ({ ...p, [k]: v }));

  if (!profile) return (
    <div style={{ display:'flex', justifyContent:'center', padding:'5rem' }}>
      <div className="spinner" />
    </div>
  );

  const requiredFields = ['name','phone','city','college','degree','branch','graduationYear'];
  const filled = requiredFields.filter(k => profile[k]?.trim?.()).length;
  const pct    = Math.round((filled / requiredFields.length) * 100);

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="page-header">
        <div className="profile-header">
          {profile.avatar
            ? <img src={profile.avatar} alt={profile.name} className="profile-avatar" />
            : <div className="avatar-placeholder" style={{ width:64, height:64, fontSize:'1.4rem' }}>{profile.name?.[0]||'?'}</div>
          }
          <div>
            <h1 style={{ fontSize:'1.3rem' }}>{profile.name}</h1>
            <p style={{ color:'var(--text-muted)', fontSize:'.875rem' }}>{profile.email}</p>
            {profile.gmailConnected && <span className="tag tag-green" style={{ marginTop:4 }}>✅ Gmail connected</span>}
          </div>
        </div>
      </div>

      {/* Profile completeness */}
      <div className="card" style={{ marginBottom:'1.25rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ fontSize:'.85rem', fontWeight:500 }}>Profile completeness</span>
          <span style={{ fontWeight:700, color: pct===100?'var(--green)':'var(--yellow)' }}>{pct}%</span>
        </div>
        <div className="progress-bar"><div className="progress-fill" style={{ width:`${pct}%`, background: pct===100?'var(--green)':'var(--accent)' }} /></div>
        {pct < 100 && <p style={{ fontSize:'.75rem', color:'var(--text-dim)', marginTop:4 }}>Complete your profile to improve job matching</p>}
      </div>

      {/* Resume upload */}
      <div className="card" style={{ marginBottom:'1.25rem' }}>
        <div className="section-head">📄 Resume Auto-Fill</div>
        <p style={{ fontSize:'.82rem', color:'var(--text-muted)', marginBottom:'.75rem' }}>Upload your PDF or DOCX — we'll extract your info automatically</p>
        <label className="btn btn-secondary" style={{ cursor:'pointer' }}>
          {parsing ? '⏳ Parsing…' : '⬆️ Upload Resume (PDF/DOCX)'}
          <input type="file" accept=".pdf,.docx" hidden onChange={handleResume} disabled={parsing} />
        </label>
      </div>

      <div className="profile-sections">
        {/* Basic info */}
        <div className="profile-section">
          <div className="section-head">Basic Information</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" value={profile.name||''} onChange={e=>set('name',e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone *</label>
                <input className="form-input" placeholder="+91 9876543210" value={profile.phone||''} onChange={e=>set('phone',e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">City *</label>
              <input className="form-input" placeholder="Bangalore" value={profile.city||''} onChange={e=>set('city',e.target.value)} />
            </div>
          </div>
        </div>

        {/* Education */}
        <div className="profile-section">
          <div className="section-head">Education</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
            <div className="form-group">
              <label className="form-label">College/University *</label>
              <input className="form-input" placeholder="e.g. VTU, Anna University" value={profile.college||''} onChange={e=>set('college',e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Degree *</label>
                <input className="form-input" placeholder="B.Tech / B.E. / MCA" value={profile.degree||''} onChange={e=>set('degree',e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Branch *</label>
                <input className="form-input" placeholder="Computer Science Engineering" value={profile.branch||''} onChange={e=>set('branch',e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Graduation Year *</label>
                <input className="form-input" placeholder="2024" maxLength="4" value={profile.graduationYear||''} onChange={e=>set('graduationYear',e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">CGPA</label>
                <input className="form-input" placeholder="8.5" value={profile.cgpa||''} onChange={e=>set('cgpa',e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="profile-section">
          <div className="section-head">Skills</div>
          <div className="skills-grid" style={{ marginBottom:'.75rem' }}>
            {(profile.skills||[]).map(s => (
              <span key={s} className="skill-pill" onClick={() => removeSkill(s)} title="Click to remove">{s} ✕</span>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <input
              className="form-input" style={{ maxWidth:180 }}
              placeholder="Add skill…"
              value={newSkill}
              onChange={e=>setNewSkill(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); addSkill(); } }}
            />
            <button className="btn btn-secondary btn-sm" onClick={addSkill}>Add</button>
          </div>
        </div>

        {/* Job preferences */}
        <div className="profile-section">
          <div className="section-head">Job Preferences</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
            <div className="form-group">
              <label className="form-label">Preferred Roles (comma separated)</label>
              <input
                className="form-input"
                placeholder="React Developer, Full Stack Developer"
                value={(profile.jobPreferences||[]).join(', ')}
                onChange={e => set('jobPreferences', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Expected Salary</label>
                <input className="form-input" placeholder="4–6 LPA" value={profile.expectedSalary||''} onChange={e=>set('expectedSalary',e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Notice Period</label>
                <input className="form-input" placeholder="Immediate / 30 days" value={profile.noticePeriod||''} onChange={e=>set('noticePeriod',e.target.value)} />
              </div>
            </div>
            <div style={{ display:'flex', gap:'1.5rem' }}>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'.875rem', cursor:'pointer' }}>
                <input type="checkbox" checked={!!profile.openToRemote} onChange={e=>set('openToRemote',e.target.checked)} />
                Open to Remote
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'.875rem', cursor:'pointer' }}>
                <input type="checkbox" checked={!!profile.openToRelocation} onChange={e=>set('openToRelocation',e.target.checked)} />
                Open to Relocation
              </label>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="profile-section">
          <div className="section-head">Links</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
            {[
              { key:'linkedinUrl',  label:'LinkedIn URL',  placeholder:'https://linkedin.com/in/…' },
              { key:'githubUrl',    label:'GitHub URL',    placeholder:'https://github.com/…' },
              { key:'portfolioUrl', label:'Portfolio URL', placeholder:'https://yoursite.com' },
            ].map(f => (
              <div key={f.key} className="form-group">
                <label className="form-label">{f.label}</label>
                <input className="form-input" type="url" placeholder={f.placeholder} value={profile[f.key]||''} onChange={e=>set(f.key,e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop:'1.5rem', display:'flex', justifyContent:'flex-end' }}>
        <button className="btn btn-primary btn-lg" onClick={save} disabled={saving}>
          {saving ? '⏳ Saving…' : '💾 Save Profile'}
        </button>
      </div>
    </div>
  );
}
