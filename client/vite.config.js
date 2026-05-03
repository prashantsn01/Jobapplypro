import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    server: {
      port: 5173,
      // In dev: proxy /api and /auth to the local Express server
      // In prod: Vercel serves the SPA; all API calls go to VITE_API_URL directly
      proxy: {
        '/api':  { target: 'http://localhost:3000', changeOrigin: true, credentials: true },
        '/auth': { target: 'http://localhost:3000', changeOrigin: true, credentials: true },
        '/socket.io': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          ws: true,
        },
      },
    },

    build: {
      outDir:                  'dist',
      sourcemap:               false,
      chunkSizeWarningLimit:   800,
      rollupOptions: {
        output: {
          manualChunks: {
            react:  ['react', 'react-dom', 'react-router-dom'],
            socket: ['socket.io-client'],
          },
        },
      },
    },

    // Make VITE_API_URL available in the app bundle
    define: {
      __API_URL__: JSON.stringify(env.VITE_API_URL || ''),
    },
  };
});
