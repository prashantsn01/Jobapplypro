import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../contexts/AuthContext';
import { API_URL }     from '../api/client';

const FEATURES = [
  { icon: '🔍', text: 'Real jobs from LinkedIn, Naukri, Cutshort, Unstop & Remotive' },
  { icon: '📬', text: 'Gmail sync — auto-detect interview invites & rejections' },
  { icon: '📋', text: 'Track every application with one click' },
  { icon: '📊', text: 'Response rate, interview rate & offer stats live' },
  { icon: '🔔', text: 'Real-time notifications via WebSocket' },
];

export default function LoginPage() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const params = new URLSearchParams(window.location.search);
  const error  = params.get('error');

  // In prod the OAuth flow starts on the Render backend
  // In dev Vite proxies /auth → localhost:3000
  const googleAuthUrl = `${API_URL}/auth/google`;

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">💼</div>
        <h1 className="login-title">JobApplyPro</h1>
        <p className="login-sub">Your personal job application command centre</p>

        {error && (
          <div style={{ background:'var(--red-light)', color:'var(--red)', padding:'10px 14px',
            borderRadius:'8px', fontSize:'.85rem', marginBottom:'1rem' }}>
            Sign-in failed — please try again.
          </div>
        )}

        <a href={googleAuthUrl} className="gmail-connect-btn"
          style={{ width:'100%', justifyContent:'center' }}>
          <img src="https://www.google.com/favicon.ico" alt="Google" />
          Continue with Google
        </a>

        <p style={{ textAlign:'center', fontSize:'.72rem', color:'var(--text-dim)', marginTop:'.75rem' }}>
          We request Gmail <strong>read-only</strong> access to detect replies to your applications.
          We never read email bodies.
        </p>

        <div className="login-divider">What you get</div>

        <div className="login-features">
          {FEATURES.map(f => (
            <div key={f.text} className="login-feature">
              <span className="icon">{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
