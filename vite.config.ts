import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /api/* is proxied to JSON Server (port 3001).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': { target: 'http://localhost:3001', rewrite: (p) => p.replace(/^\/api/, '') } } },
});
