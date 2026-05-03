import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { io }        from 'socket.io-client';
import toast         from 'react-hot-toast';
import { useAuth }   from './contexts/AuthContext';
import { API_URL }   from './api/client';
import Navbar        from './components/Navbar';
import LoginPage     from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import JobsPage      from './pages/JobsPage';
import ApplicationsPage from './pages/ApplicationsPage';
import ProfilePage   from './pages/ProfilePage';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loader"><div className="spinner" /></div>;
  if (!user)   return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Connect to Render backend (API_URL) in prod, or '/' in dev via Vite proxy
    const socketUrl = API_URL || window.location.origin;

    const socket = io(socketUrl, {
      withCredentials: true,
      transports:      ['websocket', 'polling'],
      path:            '/socket.io',
    });

    socket.on('connect',    () => {
      socket.emit('auth', { userId: user.id });
      socket.emit('jobs:subscribe');
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connection failed:', err.message);
    });

    socket.on('notification', (n) => {
      const emoji = n.type === 'gmail_reply' ? '📬' : '🔔';
      toast(n.message || n.title, { icon: emoji, duration: 6000 });
    });

    socket.on('gmail:synced', ({ matched }) => {
      if (matched > 0) toast.success(`Gmail sync: ${matched} new replies found!`);
    });

    window._japSocket = socket;
    return () => { socket.disconnect(); window._japSocket = null; };
  }, [user?.id]);

  return (
    <div className="app-shell">
      {user && <Navbar />}
      <main className="page-content">
        <Routes>
          <Route path="/login"        element={<LoginPage />} />
          <Route path="/dashboard"    element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/jobs"         element={<RequireAuth><JobsPage /></RequireAuth>} />
          <Route path="/applications" element={<RequireAuth><ApplicationsPage /></RequireAuth>} />
          <Route path="/profile"      element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/"             element={<Navigate to="/dashboard" replace />} />
          <Route path="*"             element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}
