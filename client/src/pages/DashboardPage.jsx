import { useEffect, useState, useCallback } from 'react';
import { Link }     from 'react-router-dom';
import toast        from 'react-hot-toast';
import api          from '../api/client';
import { useAuth }  from '../contexts/AuthContext';

export default function DashboardPage() {
  const { user }              = useAuth();
  const [stats,   setStats]   = useState(null);
  const [recent,  setRecent]  = useState([]);
  const [gmail,   setGmail]   = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [jobStats, setJobStats] = useState(null);

  const load = useCallback(async () => {
    try {
      const [s, a, g, j] = await Promise.all([
        api.get('/api/applications/stats'),
        api.get('/api/applications?limit=5'),
        api.get('/api/gmail/status'),
        api.get('/api/jobs/stats'),
      ]);
      setStats(s.data);
      setRecent(a.data.applications || []);
      setGmail(g.data);
      setJobStats(j.data);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const syncGmail = async () => {
    setSyncing(true);
    try {
      const r = await api.post('/api/gmail/sync');
      toast.success(`Sync done! ${r.data.matched} replies found`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const STATUS_BADGE = {
    applied:   'badge-applied',
    interview: 'badge-interview',
    offer:     'badge-offer',
    rejected:  'badge-rejected',
    ghosted:   'badge-ghosted',
  };

  return (
    <div className="page">
      <div className="dashboard-header">
        <h1>Welcome back, {user?.name?.split(' ')[0] || 'there'} 👋</h1>
        <p>Here's your job search at a glance</p>
      </div>

      {/* ── Stat cards ── */}
      {stats && (
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div className="stat-label">Total Applied</div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-sub">+{stats.todayCount} today</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Replies</div>
            <div className="stat-value" style={{ color: 'var(--blue)' }}>{stats.replies}</div>
            <div className="stat-sub">{stats.responseRate}% response rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Interviews</div>
            <div className="stat-value" style={{ color: 'var(--yellow)' }}>{stats.interviews}</div>
            <div className="stat-sub">{stats.interviewRate}% interview rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Offers</div>
            <div className="stat-value" style={{ color: 'var(--green)' }}>{stats.offers}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Jobs in DB</div>
            <div className="stat-value" style={{ color: 'var(--purple)' }}>{jobStats?.total ?? '—'}</div>
            <div className="stat-sub">{jobStats?.fetchedToday ?? 0} fetched today</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.25rem', alignItems: 'start' }}>
        {/* ── Recent applications ── */}
        <div>
          <div className="section-title">📋 Recent Applications</div>
          {recent.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-icon">📭</div>
              <p>No applications yet.</p>
              <Link to="/jobs" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>Find Jobs →</Link>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Role</th>
                      <th>Platform</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 500 }}>{a.company}</td>
                        <td style={{ color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.role}</td>
                        <td><span className={`tag platform-badge platform-${a.platform}`}>{a.platform}</span></td>
                        <td><span className={`badge ${STATUS_BADGE[a.status] || 'badge-applied'}`}>{a.status}</span></td>
                        <td style={{ color: 'var(--text-dim)', fontSize: '.75rem' }}>
                          {new Date(a.appliedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
                <Link to="/applications" className="btn btn-ghost btn-sm">View all →</Link>
              </div>
            </div>
          )}
        </div>

        {/* ── Gmail sync card ── */}
        <div>
          <div className="section-title">📬 Gmail Sync</div>
          <div className="gmail-card">
            {user?.gmailConnected ? (
              <>
                <div className="gmail-connected" style={{ marginBottom: '1rem' }}>
                  <span>✅</span> Gmail connected
                </div>
                {gmail && (
                  <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div>Last synced: {gmail.lastSyncedAt ? new Date(gmail.lastSyncedAt).toLocaleString('en-IN') : 'Never'}</div>
                    <div>Emails scanned: <b style={{ color: 'var(--text-primary)' }}>{gmail.totalFetched}</b></div>
                    <div>Replies found: <b style={{ color: 'var(--green)' }}>{gmail.totalMatched}</b></div>
                    {gmail.status === 'error' && <div style={{ color: 'var(--red)', marginTop: 4 }}>⚠️ {gmail.errorMsg}</div>}
                  </div>
                )}
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={syncGmail} disabled={syncing}>
                  {syncing ? '⏳ Syncing…' : '🔄 Sync Now'}
                </button>
                <p style={{ fontSize: '.72rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '.5rem' }}>
                  Detects interview calls, offer letters, rejections
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: '.875rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>
                  Connect Gmail to automatically detect replies from companies you've applied to.
                </p>
                <a href="/auth/google" className="gmail-connect-btn" style={{ width: '100%', justifyContent: 'center' }}>
                  <img src="https://www.google.com/favicon.ico" alt="" style={{ width: 18, height: 18 }} />
                  Connect Gmail
                </a>
              </>
            )}
          </div>

          {/* Job sources */}
          {jobStats?.byPlatform?.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div className="section-title">📊 Jobs by Platform</div>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {jobStats.byPlatform.map(p => (
                  <div key={p.platform} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`tag platform-badge platform-${p.platform}`} style={{ textTransform: 'capitalize' }}>{p.platform}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
