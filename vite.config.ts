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
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom', 'framer-motion', 'zustand']
        }
      }
    }
  },
  server: { port: 5174 }
});
