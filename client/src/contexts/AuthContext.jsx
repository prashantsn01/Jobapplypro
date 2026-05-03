import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // /auth/me checks the session cookie — withCredentials must be true (set in api client)
    api.get('/auth/me')
      .then(r => setUser(r.data.authenticated ? r.data.user : null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
    window.location.href = '/login';
  };

  const refreshUser = async () => {
    const r = await api.get('/auth/me');
    if (r.data.authenticated) setUser(r.data.user);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
