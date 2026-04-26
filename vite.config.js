import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/tiramisu-game/',
  plugins: [react()],
  build: {
    target: 'es2020',
    cssCodeSplit: false,
  },
});
