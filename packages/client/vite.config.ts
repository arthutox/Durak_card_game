import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Named vendor chunks: easier to read in the build output and cached
        // across app releases, because libraries change far less often than our code.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            {
              name: 'socket',
              test: /node_modules[\\/](socket\.io-client|engine\.io-client|socket\.io-parser|@socket\.io|engine\.io-parser)[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: {
    // Listen on all interfaces so phones on the LAN can open the dev server.
    host: true,
    port: 5173,
    strictPort: true,
  },
});
