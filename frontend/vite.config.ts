import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // @keebmeet/shared is a linked CommonJS workspace package; Vite won't
  // pre-bundle linked deps by default, and its re-exported (export *) names
  // aren't statically analyzable when served raw. Force pre-bundling so named
  // imports resolve.
  optimizeDeps: {
    include: ['@keebmeet/shared'],
  },
  // Dev-only single-origin proxy mirroring the production Caddyfile, so the
  // whole app (SPA + API + auth + socket) is reachable from one origin. This
  // lets an HTTPS tunnel (e.g. `cloudflared tunnel --url http://localhost:5173`)
  // expose everything over one trusted HTTPS URL — required for the camera /
  // BarcodeScanner (getUserMedia) to work on a real mobile device.
  server: {
    host: true,
    // Quick tunnels use a random *.trycloudflare.com host; allow any so Vite
    // doesn't reject the forwarded Host header. Dev-only.
    allowedHosts: true,
    proxy: {
      // Order matters: the more specific /api/auth prefix must come first.
      // handle_path in Caddy strips the prefix, so we rewrite to match.
      '/api/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/auth/, ''),
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
      // Socket.IO: prefix is NOT stripped; upgrade the WebSocket.
      '/socket.io': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
