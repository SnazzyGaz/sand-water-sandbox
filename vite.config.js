import { defineConfig } from 'vite';
export default defineConfig({
  base: process.env.BASE || '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/examples/')) return 'three-controls';
          if (id.includes('/node_modules/three/')) return 'three-core';
        }
      }
    }
  }
});
