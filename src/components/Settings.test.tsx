// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Settings } from './Settings';
import {
  __resetPreferences,
  getPreferences,
  setPreference,
} from '../content/preferences';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  __resetPreferences();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

function render(ui: React.ReactNode): void {
  act(() => root.render(ui));
}

describe('Settings component — theme switcher', () => {
  it('renders theme segmented control with Light, Dark, and System choices', () => {
    render(<Settings open={true} onClose={() => {}} />);

    const radiogroup = document.querySelector('[role="radiogroup"][aria-labelledby="st-theme-label"]');
    expect(radiogroup).not.toBeNull();

    const segmented = radiogroup?.querySelector('.st-segmented');
    expect(segmented).not.toBeNull();

    const buttons = segmented?.querySelectorAll<HTMLButtonElement>('.st-seg');
    expect(buttons?.length).toBe(3);

    const labels = Array.from(buttons ?? []).map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Light', 'Dark', 'System']);
  });

  it('marks the active theme as is-active and aria-checked=true', () => {
    setPreference('theme', 'dark');
    render(<Settings open={true} onClose={() => {}} />);

    const buttons = document.querySelectorAll<HTMLButtonElement>('.st-seg');
    const darkBtn = Array.from(buttons).find((b) => b.textContent?.trim() === 'Dark');
    const lightBtn = Array.from(buttons).find((b) => b.textContent?.trim() === 'Light');

    expect(darkBtn?.classList.contains('is-active')).toBe(true);
    expect(darkBtn?.getAttribute('aria-checked')).toBe('true');

    expect(lightBtn?.classList.contains('is-active')).toBe(false);
    expect(lightBtn?.getAttribute('aria-checked')).toBe('false');
  });

  it('updates preferences when a theme segment is clicked', () => {
    setPreference('theme', 'system');
    render(<Settings open={true} onClose={() => {}} />);

    const buttons = document.querySelectorAll<HTMLButtonElement>('.st-seg');
    const lightBtn = Array.from(buttons).find((b) => b.textContent?.trim() === 'Light');

    act(() => {
      lightBtn?.click();
    });

    expect(getPreferences().theme).toBe('light');
  });

  it('verifies Settings.css styles the segmented control track and dark mode elevation', () => {
    const cssPath = resolve(__dirname, 'Settings.css');
    const css = readFileSync(cssPath, 'utf8');

    // .st-segmented must have track background, border, border-radius, padding, and gap
    expect(css).toMatch(/\.st-segmented\s*\{[^}]*background:\s*var\(--surface-2\)/);
    expect(css).toMatch(/\.st-segmented\s*\{[^}]*border:\s*var\(--bw\)\s+solid\s+var\(--border-strong\)/);
    expect(css).toMatch(/\.st-segmented\s*\{[^}]*border-radius:\s*var\(--r-btn\)/);
    expect(css).toMatch(/\.st-segmented\s*\{[^}]*padding:\s*2px/);
    expect(css).toMatch(/\.st-segmented\s*\{[^}]*gap:\s*2px/);

    // .st-seg must have height and transitions
    expect(css).toMatch(/\.st-seg\s*\{[^}]*height:\s*32px/);

    // Dark mode active segment must be elevated above the card surface
    expect(css).toMatch(/:root\[data-theme='dark'\]\s+\.st-seg\.is-active\s*\{[^}]*background:\s*var\(--surface-3\)/);
    expect(css).toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[^}]*background:\s*var\(--surface-3\)/);
  });
});

describe('Settings component — architectural advisor & HLD RFC toggles', () => {
  it('renders toggles for Architectural advisor and HLD RFC export', () => {
    render(<Settings open={true} onClose={() => {}} />);

    const switches = document.querySelectorAll<HTMLButtonElement>('button.st-switch');
    const labels = Array.from(switches).map((s) => s.querySelector('.st-row-label')?.textContent?.trim());

    expect(labels).toContain('Architectural advisor');
    expect(labels).toContain('High-Level Design (HLD) RFC export');
  });

  it('toggles advisor preference when switch is clicked', () => {
    render(<Settings open={true} onClose={() => {}} />);

    const switches = document.querySelectorAll<HTMLButtonElement>('button.st-switch');
    const advisorSwitch = Array.from(switches).find(
      (s) => s.querySelector('.st-row-label')?.textContent?.trim() === 'Architectural advisor',
    );
    expect(advisorSwitch).toBeDefined();
    expect(advisorSwitch?.getAttribute('aria-checked')).toBe('true');

    act(() => {
      advisorSwitch?.click();
    });

    expect(getPreferences().advisor).toBe(false);
  });

  it('toggles hldRfc preference when switch is clicked and hides export RFC button', () => {
    const onExportHldMarkdown = () => {};
    render(
      <Settings
        open={true}
        onClose={() => {}}
        onExportHldMarkdown={onExportHldMarkdown}
      />,
    );

    let exportHldBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('.st-action')).find(
      (btn) => btn.textContent?.includes('Export Architecture Design RFC'),
    );
    expect(exportHldBtn).toBeDefined();

    const switches = document.querySelectorAll<HTMLButtonElement>('button.st-switch');
    const hldSwitch = Array.from(switches).find(
      (s) => s.querySelector('.st-row-label')?.textContent?.trim() === 'High-Level Design (HLD) RFC export',
    );
    expect(hldSwitch).toBeDefined();

    act(() => {
      hldSwitch?.click();
    });

    expect(getPreferences().hldRfc).toBe(false);

    // Re-render or check updated state
    exportHldBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('.st-action')).find(
      (btn) => btn.textContent?.includes('Export Architecture Design RFC'),
    );
    expect(exportHldBtn).toBeUndefined();
  });
});
