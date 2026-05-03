import axios from 'axios';

// Dev: Vite proxy handles /api → localhost:3000 (no env var needed)
// Prod: VITE_API_URL = https://jobapplypro-server.onrender.com
export const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL:         API_URL,
  withCredentials: true,   // MUST be true for cross-domain session cookies (Vercel ↔ Render)
  timeout:         25000,
  headers:         { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
