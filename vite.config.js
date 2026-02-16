
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/card/', // 设置为您的 GitHub 仓库名
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});
