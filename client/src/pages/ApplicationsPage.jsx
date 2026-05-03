import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api   from '../api/client';

const STATUSES  = ['all','applied','interview','offer','rejected','ghosted'];
const STATUS_BADGE = { applied:'badge-applied', interview:'badge-interview', offer:'badge-offer', rejected:'badge-rejected', ghosted:'badge-ghosted' };

export default function ApplicationsPage() {
  const [apps,    setApps]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');
  const [adding,  setAdding]  = useState(false);
  const [form,    setForm]    = useState({ company:'', role:'', platform:'manual', applyUrl:'', notes:'' });

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 20 };
      if (filter !== 'all') params.status = filter;
      const r = await api.get('/api/applications', { params });
      setApps(r.data.applications || []);
      setTotal(r.data.total || 0);
      setPages(r.data.pages || 1);
      setPage(p);
    } catch { toast.error('Failed to load applications'); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(1); }, [filter]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/api/applications/${id}`, { status });
      setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      toast.success(`Status → ${status}`);
    } catch { toast.error('Update failed'); }
  };

  const deleteApp = async (id) => {
    if (!confirm('Delete this application?')) return;
    try {
      await api.delete(`/api/applications/${id}`);
      setApps(prev => prev.filter(a => a.id !== id));
      setTotal(t => t - 1);
      toast.success('Deleted');
    } catch { toast.error('Delete failed'); }
  };

  const addManual = async (e) => {
    e.preventDefault();
    if (!form.company || !form.role) return toast.error('Company and Role are required');
    try {
      await api.post('/api/applications', form);
      toast.success('Application logged!');
      setAdding(false);
      setForm({ company:'', role:'', platform:'manual', applyUrl:'', notes:'' });
      load(1);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>📋 Applications</h1>
          <p style={{ color:'var(--text-muted)', fontSize:'.875rem', marginTop:4 }}>{total} total</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(a => !a)}>
          {adding ? '✕ Cancel' : '+ Log Manually'}
        </button>
      </div>

      {/* Manual add form */}
      {adding && (
        <div className="card" style={{ marginBottom:'1.25rem' }}>
          <div className="section-head" style={{ marginBottom:'.75rem' }}>Log a Manual Application</div>
          <form onSubmit={addManual} style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Company *</label>
                <input className="form-input" placeholder="e.g. Google" value={form.company} onChange={e => setForm(f => ({...f, company:e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <input className="form-input" placeholder="e.g. Frontend Engineer" value={form.role} onChange={e => setForm(f => ({...f, role:e.target.value}))} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Platform</label>
                <select className="form-select" value={form.platform} onChange={e => setForm(f => ({...f, platform:e.target.value}))}>
                  {['linkedin','naukri','cutshort','unstop','indeed','manual','other'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Apply URL</label>
                <input className="form-input" placeholder="https://…" type="url" value={form.applyUrl} onChange={e => setForm(f => ({...f, applyUrl:e.target.value}))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" placeholder="Any notes…" value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))} />
            </div>
            <div style={{ display:'flex', gap:'.75rem' }}>
              <button type="submit" className="btn btn-primary">Save</button>
              <button type="button" className="btn btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Status filter tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:'1.25rem', flexWrap:'wrap' }}>
        {STATUSES.map(s => (
          <button key={s} className={`btn btn-sm ${filter===s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(s)}>
            {s==='all' ? 'All' : s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'4rem' }}>
          <div className="loading-dots"><span/><span/><span/></div>
        </div>
      ) : apps.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>{filter==='all' ? 'No applications yet. Start applying!' : `No applications with status "${filter}".`}</p>
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Platform</th>
                  <th>Status</th>
                  <th>Reply</th>
                  <th>Applied</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apps.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight:500 }}>{a.company}</td>
                    <td style={{ color:'var(--text-muted)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.role}</td>
                    <td><span className={`tag platform-badge platform-${a.platform}`}>{a.platform}</span></td>
                    <td>
                      <select
                        className="form-select"
                        style={{ padding:'3px 6px', fontSize:'.78rem', width:'auto', minWidth:100 }}
                        value={a.status}
                        onChange={e => updateStatus(a.id, e.target.value)}
                      >
                        {['applied','interview','offer','rejected','ghosted'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      {a.replyDetected
                        ? <span className={`badge ${a.replyType==='offer'?'badge-offer':a.replyType==='interview'?'badge-interview':'badge-rejected'}`}>
                            {a.replyType==='interview'?'📅 Interview':a.replyType==='offer'?'🏆 Offer':'📩 Reply'}
                          </span>
                        : <span style={{ color:'var(--text-dim)', fontSize:'.78rem' }}>—</span>
                      }
                    </td>
                    <td style={{ color:'var(--text-dim)', fontSize:'.78rem' }}>
                      {new Date(a.appliedAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'2-digit' })}
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        {a.applyUrl && <a href={a.applyUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title="Open job">↗</a>}
                        <button className="btn btn-danger btn-sm" onClick={() => deleteApp(a.id)} title="Delete">✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div style={{ padding:'10px 14px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'center', gap:8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => load(page-1)} disabled={page<=1}>← Prev</button>
              <span style={{ alignSelf:'center', fontSize:'.875rem', color:'var(--text-muted)' }}>Page {page} of {pages}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => load(page+1)} disabled={page>=pages}>Next →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
