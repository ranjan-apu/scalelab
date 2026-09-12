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

  it('Elevates .cv-zoom in simulation mode across all desktop/laptop viewports to prevent dock collision', () => {
    // .app-body.is-sim .cv-zoom must be elevated above the floating simulation dock
    expect(appCss).toMatch(
      /\.app-body\.is-sim\s+\.cv-zoom\s*\{[^}]*bottom:\s*calc\(var\(--sp-4\)\s*\+\s*76px\s*\+\s*var\(--sp-2\)\)/,
    );

    // .app-body.is-sim.has-metrics .cv-zoom must be elevated above metrics strip and dock
    expect(appCss).toMatch(
      /\.app-body\.is-sim\.has-metrics\s+\.cv-zoom\s*\{[^}]*bottom:\s*calc\(var\(--strip-h\)\s*\+\s*var\(--sp-3\)\s*\+\s*76px\s*\+\s*var\(--sp-2\)\)/,
    );

    // .cv-zoom in Canvas.css has z-index: 20
    expect(canvasCss).toMatch(/\.cv-zoom\s*\{[^}]*z-index:\s*20/);
  });
});
