import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 用相對路徑：GitHub Pages 的專案網址帶子路徑，本機預覽也能直接開。
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2022', sourcemap: false },
});
