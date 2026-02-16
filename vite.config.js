
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/card/', // Github Pages 的仓库名
  build: {
    outDir: 'docs', // 输出到 docs 文件夹
    assetsDir: 'assets',
    sourcemap: false
  }
});
