import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 4173,
  },
  build: {
    // Split Three.js into its own chunk for parallel loading
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
    // Generate source maps for debugging production issues
    sourcemap: true,
    // Target modern browsers only
    target: 'es2020',
    // Asset size warning threshold
    chunkSizeWarningLimit: 500,
  },
});
