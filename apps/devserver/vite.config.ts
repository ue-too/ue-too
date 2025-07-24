import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: __dirname,
  build: {
    outDir: '../../dist/apps/devserver',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@ue-too/core': resolve(__dirname, '../../packages/core/src'),
      '@ue-too/core/': resolve(__dirname, '../../packages/core/src/'),
    },
  },
  server: {
    host: true,
    strictPort: false,
  },
}); 