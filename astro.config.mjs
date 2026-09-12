import { defineConfig } from 'astro/config';

// Landing site: static output to the same dist/ folder as the Vite app.
// The app itself builds into dist/app/ (see vite.config.ts), so run this
// build FIRST: `npm run build` = tsc + astro build + vite build.
export default defineConfig({
  srcDir: './landing',
  publicDir: './landing/public',
  outDir: './dist',
});
