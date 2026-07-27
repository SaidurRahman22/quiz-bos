import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy /api to the Express backend during development.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on 0.0.0.0 so phones/other devices on the same LAN can connect
    port: 5173,
    strictPort: true, // always use 5173 (fail loudly instead of drifting to a new port)
    proxy: {
      '/api': {
        // Runs on the PC (not the phone), so it can still reach the API on localhost.
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
