import { defineConfig } from 'vite';

export default defineConfig({
  // relative base so the build works under GitHub Pages' /pokestrike/ path
  base: './',
  server: { host: true },
});
