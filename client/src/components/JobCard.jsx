import { useState } from 'react';
import api from '../api/client';
import toast from 'react-hot-toast';

const PLATFORM_LABELS = {
  linkedin: 'LinkedIn', naukri: 'Naukri', cutshort: 'Cutshort',
  unstop: 'Unstop', remotive: 'Remotive', indeed: 'Indeed',
};

export default function JobCard({ job, onApply }) {
  const [saving, setSaving] = useState(false);

  const handleApply = async () => {
    setSaving(true);
    try {
      await api.post('/api/applications', {
        company:  job.company,
        role:     job.title,
        platform: job.platform,
        applyUrl: job.applyUrl,
        location: job.location,
        salary:   job.salary,
      });
      toast.success(`Logged application to ${job.company}!`);
      onApply?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to log application');
    } finally {
      setSaving(false);
    }
  };

  const platformLabel = PLATFORM_LABELS[job.platform] || job.platform;
  const initials      = job.company?.slice(0, 2).toUpperCase() || '??';

  return (
    <div className="job-card card-hover">
      <div className="job-card-header">
        <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: 0 }}>
          {job.companyLogo
            ? <img src={job.companyLogo} alt={job.company} className="job-logo" onError={e => { e.target.style.display='none'; }} />
            : <div className="job-logo-placeholder">{initials[0]}</div>
          }
          <div style={{ minWidth: 0 }}>
            <div className="job-title" title={job.title}>{job.title}</div>
            <div className="job-company">{job.company}</div>
          </div>
        </div>
        <span className={`tag platform-badge platform-${job.platform}`}>{platformLabel}</span>
      </div>

      <div className="job-meta">
        {job.location && <span className="tag">📍 {job.location}</span>}
        {job.isRemote  && <span className="tag tag-green">🌐 Remote</span>}
        {job.salary    && <span className="tag tag-yellow">💰 {job.salary}</span>}
        {job.jobType && job.jobType !== 'other' && (
          <span className="tag tag-accent">{job.jobType === 'fullstack' ? '🔗 Full Stack' : '🎨 Frontend'}</span>
        )}
      </div>

      {job.tags?.length > 0 && (
        <div className="job-tags">
          {job.tags.slice(0, 5).map(t => <span key={t} className="tag">{t}</span>)}
        </div>
      )}

      {job.description && (
        <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {job.description.slice(0, 120)}{job.description.length > 120 ? '…' : ''}
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '4px' }}>
        <a href={job.applyUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
          {job.isPortalLink ? '🔍 Search' : '↗ Apply'}
        </a>
        {!job.isPortalLink && (
          <button className="btn btn-secondary btn-sm" onClick={handleApply} disabled={saving}>
            {saving ? '…' : '📋 Log'}
          </button>
        )}
      </div>
    </div>
  );
}
