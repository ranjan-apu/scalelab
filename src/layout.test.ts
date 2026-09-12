import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Layout invariants for Palette mode switch and Simulation Dock / Zoom cluster', () => {
  const paletteCss = readFileSync(new URL('./components/Palette.css', import.meta.url), 'utf8');
  const appCss = readFileSync(new URL('./App.css', import.meta.url), 'utf8');
  const canvasCss = readFileSync(new URL('./components/Canvas.css', import.meta.url), 'utf8');

  it('Palette mode switch has top margin and matching horizontal margins', () => {
    // .pal-mode-switch must have top margin (10px) to separate from LIBRARY heading border,
    // and 14px horizontal margins to align with .pal-search
    expect(paletteCss).toMatch(/\.pal-mode-switch\s*\{[^}]*margin:\s*10px\s+14px\s+8px/);
    expect(paletteCss).toMatch(/\.pal-mode-btn\s*\{[^}]*flex:\s*1\s+1\s+0/);
    expect(paletteCss).toMatch(/\.pal-mode-btn\s*\{[^}]*line-height:\s*var\(--lh-sm\)/);
  });

  it('Positions dock to utilize left empty space and clears zoom controls on the right', () => {
    // Dock is centered between rail and zoom controls with left offset and max-width bounds
    expect(appCss).toMatch(
      /\.app-body\.has-library\s+\.app-sim-dock\s*\{[^}]*left:\s*calc\(50%\s*\+\s*4px\)/,
    );
    expect(appCss).toMatch(
      /\.app-body\.has-library\s+\.app-sim-dock\s*\{[^}]*max-width:\s*calc\(100vw\s*-\s*var\(--rail-w\)\s*-\s*220px\)/,
    );

    // Zoom cluster elevates on compact tablet viewports (<= 1050px) to prevent overlap
    expect(appCss).toMatch(
      /@media\s*\(min-width:\s*721px\)\s+and\s+\(max-width:\s*1050px\)\s*\{[\s\S]*?\.app-body\.is-sim\s+\.cv-zoom\s*\{[^}]*bottom:\s*calc\(var\(--sp-4\)\s*\+\s*76px\s*\+\s*var\(--sp-2\)\)/,
    );

    // .cv-zoom in Canvas.css has z-index: 20
    expect(canvasCss).toMatch(/\.cv-zoom\s*\{[^}]*z-index:\s*20/);
  });
});
