import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    strictPort: true,
    // The Worker (wrangler dev) handles all /api routes during local dev.
    // Host header is preserved so OAuth redirect URIs resolve to the Vite origin.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787' },
    },
  },
});
