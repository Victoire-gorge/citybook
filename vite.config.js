import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// One HTML file per page. The Worker serves them from dist/ (see wrangler.jsonc).
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        map: resolve(import.meta.dirname, 'index.html'),
        adventures: resolve(import.meta.dirname, 'adventures.html'),
        adventure: resolve(import.meta.dirname, 'adventure.html'),
        share: resolve(import.meta.dirname, 'share.html'),
        login: resolve(import.meta.dirname, 'login.html'),
        notFound: resolve(import.meta.dirname, '404.html'),
      },
    },
  },
  server: {
    // `npm run dev` for the front only; API calls go to `wrangler dev` on port 8787.
    proxy: { '/api': 'http://localhost:8787', '/photos': 'http://localhost:8787', '/media': 'http://localhost:8787' },
  },
});
