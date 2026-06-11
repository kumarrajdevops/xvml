import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@xvml/core': path.resolve(__dirname, '../../src'),
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
});
