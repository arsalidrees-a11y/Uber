import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Stable filename: this asset is uploaded to Open edX Files & Uploads and
    // referenced as /static/uber-learn.css. A content hash would break it on
    // every rebuild.
    rollupOptions: { output: { assetFileNames: 'uber-learn.[ext]' } },
  },
  server: { host: true },
});
