import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// 每次打包的版本字串（ISO 時間）。App 內用 __APP_VERSION__ 讀自己的版本，
// 並比對線上 version.json 來判斷是否有新版。
const version = new Date().toISOString();

function versionFile(): Plugin {
  return {
    name: 'civic-bunko-version-file',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) + '\n' });
    },
  };
}

// base 用相對路徑：GitHub Pages 的專案網址帶子路徑，本機預覽也能直接開。
export default defineConfig({
  base: './',
  plugins: [react(), versionFile()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { target: 'es2022', sourcemap: false },
});
