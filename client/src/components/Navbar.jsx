import { NavLink } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAuth }   from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';

export default function Navbar() {
  const { user, logout }                        = useAuth();
  const { notifications, clearNotification }    = useSocket(user?.id);
  const unread = notifications.length;
  const [notifOpen, setNotifOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navLinks = [
    { to: '/dashboard',    label: 'Dashboard', icon: '🏠' },
    { to: '/jobs',         label: 'Jobs',       icon: '🔍' },
    { to: '/applications', label: 'Applied',    icon: '📋' },
    { to: '/profile',      label: 'Profile',    icon: '👤' },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to="/dashboard" className="navbar-logo">
          <span>💼</span> JobApplyPro
        </NavLink>

        <div className="navbar-links">
          {navLinks.map(l => (
            <NavLink
              key={l.to} to={l.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {l.icon} <span>{l.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="navbar-right">
          {/* Notification bell */}
          <div style={{ position: 'relative' }} ref={ref}>
            <button className="notif-btn" onClick={() => setNotifOpen(o => !o)}>
              🔔
              {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
            </button>
            {notifOpen && (
              <div className="notif-dropdown">
                {notifications.length === 0
                  ? <div className="notif-item" style={{ textAlign: 'center', color: 'var(--text-dim)' }}>No notifications</div>
                  : notifications.map((n, i) => (
                      <div key={i} className="notif-item" onClick={() => clearNotification(i)}>
                        <div className="notif-title">{n.title}</div>
                        <div>{n.message}</div>
                      </div>
                    ))
                }
              </div>
            )}
          </div>

          {/* Avatar */}
          {user?.avatar
            ? <img src={user.avatar} alt={user.name} className="avatar" />
            : <div className="avatar-placeholder">{user?.name?.[0] || '?'}</div>
          }

          <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
        </div>
      </div>
    </nav>
  );
}
