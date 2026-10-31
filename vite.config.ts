import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      // Pure physics engine, deliberately UI-free.
      '@engine': path.resolve(__dirname, 'src/engine/index.ts'),
      '@': path.resolve(__dirname, 'src/game')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('three')) return 'three';
          if (id.includes('react') || id.includes('framer-motion') || id.includes('zustand')) return 'react';
          return undefined;
        }
      }
    }
  },
  server: { port: 5174 }
});
