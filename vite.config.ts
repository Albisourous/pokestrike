import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

// every deploy stamps its git hash — a bug report can name its build
const BUILD = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
})();

export default defineConfig({
  // relative base so the build works under GitHub Pages' /pokestrike/ path
  base: './',
  server: { host: true },
  define: { __BUILD__: JSON.stringify(BUILD) },
});
