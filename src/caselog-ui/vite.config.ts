import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@xyflow/react': '/src/lib/reactflow-shim.tsx'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
