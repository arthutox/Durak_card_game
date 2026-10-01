import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on all interfaces so phones on the LAN can open the dev server.
    host: true,
    port: 5173,
    strictPort: true,
  },
});
