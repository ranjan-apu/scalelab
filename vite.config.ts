import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The playground is served from a subpath; the Astro landing page owns
  // the domain root. Build output goes to dist/app/ (see `npm run build`).
  base: '/app/',
  build: {
    outDir: 'dist/app',
  },
});

