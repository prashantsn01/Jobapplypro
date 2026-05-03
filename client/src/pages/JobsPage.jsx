import { useEffect, useState, useCallback } from 'react';
import toast   from 'react-hot-toast';
import api     from '../api/client';
import JobCard from '../components/JobCard';

const PLATFORMS = ['all','linkedin','naukri','cutshort','unstop','remotive'];
const ROLES     = ['all','frontend','fullstack'];

export default function JobsPage() {
  const [jobs,      setJobs]      = useState([]);
  const [total,     setTotal]     = useState(0);
  const [pages,     setPages]     = useState(1);
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const [filters, setFilters] = useState({
    platform: 'all', role: 'all', search: '', location: '',
  });

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 24 };
      if (filters.platform !== 'all') params.platform = filters.platform;
      if (filters.role     !== 'all') params.role     = filters.role;
      if (filters.search)             params.search   = filters.search.trim();
      if (filters.location)           params.location = filters.location.trim();

      const r = await api.get('/api/jobs', { params });
      setJobs(r.data.jobs || []);
      setTotal(r.data.total || 0);
      setPages(r.data.pages || 1);
      setPage(p);
    } catch {
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { load(1); }, [filters]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (jobs.length === 0) load(1); }, []);

  const triggerScrape = async () => {
    setRefreshing(true);
    try {
      await api.post('/api/jobs/refresh');
      toast.success('Fetching fresh jobs — results in ~30s');
      setTimeout(() => load(1), 30000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Refresh failed');
    } finally {
      setTimeout(() => setRefreshing(false), 3000);
    }
  };

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>🔍 Job Board</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '.875rem', marginTop: 4 }}>
            {total} real jobs from LinkedIn, Naukri, Cutshort, Unstop & Remotive
          </p>
        </div>
        <button className="btn btn-primary" onClick={triggerScrape} disabled={refreshing}>
          {refreshing ? '⏳ Fetching…' : '🔄 Refresh Jobs'}
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="form-input search-input"
            placeholder="Search jobs or companies…"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
          />
        </div>

        <select className="form-select" style={{ width: 'auto' }} value={filters.platform} onChange={e => setFilter('platform', e.target.value)}>
          {PLATFORMS.map(p => <option key={p} value={p}>{p === 'all' ? 'All Platforms' : p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>

        <select className="form-select" style={{ width: 'auto' }} value={filters.role} onChange={e => setFilter('role', e.target.value)}>
          {ROLES.map(r => <option key={r} value={r}>{r === 'all' ? 'All Roles' : r === 'frontend' ? '🎨 Frontend' : '🔗 Full Stack'}</option>)}
        </select>

        <input
          className="form-input"
          placeholder="Location…"
          style={{ width: 140 }}
          value={filters.location}
          onChange={e => setFilter('location', e.target.value)}
        />

        {(filters.platform !== 'all' || filters.role !== 'all' || filters.search || filters.location) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ platform: 'all', role: 'all', search: '', location: '' })}>
            ✕ Clear
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="loading-dots"><span /><span /><span /></div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>No jobs found. Try refreshing or adjusting your filters.</p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }} onClick={triggerScrape}>
            🔄 Fetch Jobs Now
          </button>
        </div>
      ) : (
        <>
          <div className="jobs-grid">
            {jobs.map(job => (
              <JobCard key={job.id} job={job} onApply={() => {}} />
            ))}
          </div>

          {pages > 1 && (
            <div className="pagination">
              <button className="btn btn-secondary btn-sm" onClick={() => load(page - 1)} disabled={page <= 1}>← Prev</button>
              <span style={{ fontSize: '.875rem', color: 'var(--text-muted)' }}>Page {page} of {pages}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => load(page + 1)} disabled={page >= pages}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
