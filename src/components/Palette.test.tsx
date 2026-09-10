// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { Palette } from './Palette';
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

function searchInput(): HTMLInputElement {
  const el = document.querySelector<HTMLInputElement>('.pal-search-input');
  if (!el) throw new Error('no search input');
  return el;
}

function typeSearch(value: string): void {
  const input = searchInput();
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('Palette collapsible groups', () => {
  it('renders all component groups expanded by default', () => {
    const onAdd = vi.fn();
    render(<Palette onAdd={onAdd} onAddAnnotation={vi.fn()} />);

    const toggles = document.querySelectorAll<HTMLButtonElement>('.pal-group-toggle');
    expect(toggles.length).toBeGreaterThanOrEqual(6);

    for (const toggle of toggles) {
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
    }

    // No pinned section initially
    expect(document.querySelector('.pal-group-pinned')).toBeNull();
  });

  it('collapses and expands a group on click, and persists to preferences', () => {
    const onAdd = vi.fn();
    render(<Palette onAdd={onAdd} onAddAnnotation={vi.fn()} />);

    const trafficToggle = [...document.querySelectorAll<HTMLButtonElement>('.pal-group-toggle')].find(
      (btn) => btn.textContent?.includes('Traffic'),
    );
    expect(trafficToggle).toBeTruthy();
    expect(trafficToggle?.getAttribute('aria-expanded')).toBe('true');

    // List is visible before collapse
    expect(document.querySelector('#pal-group-list-traffic')).not.toBeNull();

    // Click to collapse
    act(() => {
      trafficToggle?.click();
    });

    expect(trafficToggle?.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('#pal-group-list-traffic')).toBeNull();
    expect(getPreferences().collapsedGroups).toContain('traffic');

    // Click again to expand
    act(() => {
      trafficToggle?.click();
    });

    expect(trafficToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('#pal-group-list-traffic')).not.toBeNull();
    expect(getPreferences().collapsedGroups).not.toContain('traffic');
  });

  it('supports multiple collapsed groups simultaneously', () => {
    const onAdd = vi.fn();
    render(<Palette onAdd={onAdd} onAddAnnotation={vi.fn()} />);

    const toggles = [...document.querySelectorAll<HTMLButtonElement>('.pal-group-toggle')];
    const traffic = toggles.find((btn) => btn.textContent?.includes('Traffic'));
    const compute = toggles.find((btn) => btn.textContent?.includes('Compute'));

    act(() => {
      traffic?.click();
      compute?.click();
    });

    expect(getPreferences().collapsedGroups).toEqual(
      expect.arrayContaining(['traffic', 'compute']),
    );
    expect(document.querySelector('#pal-group-list-traffic')).toBeNull();
    expect(document.querySelector('#pal-group-list-compute')).toBeNull();
    expect(document.querySelector('#pal-group-list-data')).not.toBeNull();
  });

  it('auto-expands collapsed groups when searching matches', () => {
    setPreference('collapsedGroups', ['data']);
    const onAdd = vi.fn();
    render(<Palette onAdd={onAdd} onAddAnnotation={vi.fn()} />);

    // Initially Data is collapsed
    expect(document.querySelector('#pal-group-list-data')).toBeNull();

    // Type query matching "database" or "cache" in Data group
    typeSearch('cache');

    // When searching, Data should auto-expand to reveal matches
    expect(document.querySelector('#pal-group-list-data')).not.toBeNull();
    const rows = document.querySelectorAll<HTMLButtonElement>('.pal-row');
    expect(rows.length).toBeGreaterThan(0);

    // Clear search
    typeSearch('');
    // Data should collapse back according to preferences
    expect(document.querySelector('#pal-group-list-data')).toBeNull();
  });
});

describe('Palette pinned items', () => {
  it('pins an item when clicking the pin button and shows top Pinned section', () => {
    const onAdd = vi.fn();
    render(<Palette onAdd={onAdd} />);

    expect(document.querySelector('.pal-group-pinned')).toBeNull();

    // Find the Cache component row
    const cacheRow = document.querySelector<HTMLButtonElement>('.pal-row[data-kind="cache"]');
    expect(cacheRow).toBeTruthy();

    const pinBtn = cacheRow?.parentElement?.querySelector<HTMLButtonElement>('.pal-pin-btn');
    expect(pinBtn).toBeTruthy();
    expect(pinBtn?.getAttribute('aria-pressed')).toBe('false');

    // Pin Cache
    act(() => {
      pinBtn?.click();
    });

    expect(getPreferences().pinnedKinds).toEqual(['cache']);

    // Pinned section should now appear at the top
    const pinnedSection = document.querySelector('.pal-group-pinned');
    expect(pinnedSection).toBeTruthy();
    expect(pinnedSection?.textContent).toContain('Pinned');

    // Inside Pinned section, Cache should exist
    const pinnedCache = pinnedSection?.querySelector('.pal-row[data-kind="cache"]');
    expect(pinnedCache).toBeTruthy();

    // In regular list, Cache still exists and its pin button is active
    expect(pinBtn?.getAttribute('aria-pressed')).toBe('true');
  });

  it('unpins an item from the top Pinned section', () => {
    setPreference('pinnedKinds', ['cache', 'db']);
    const onAdd = vi.fn();
    render(<Palette onAdd={onAdd} />);

    let pinnedSection = document.querySelector('.pal-group-pinned');
    expect(pinnedSection).toBeTruthy();
    expect(pinnedSection?.querySelectorAll('.pal-row').length).toBe(2);

    // Find the pin button of cache inside the Pinned section
    const pinnedCacheRow = pinnedSection?.querySelector('.pal-row[data-kind="cache"]');
    const unpinBtn = pinnedCacheRow?.parentElement?.querySelector<HTMLButtonElement>('.pal-pin-btn');
    expect(unpinBtn).toBeTruthy();

    act(() => {
      unpinBtn?.click();
    });

    expect(getPreferences().pinnedKinds).toEqual(['db']);

    pinnedSection = document.querySelector('.pal-group-pinned');
    expect(pinnedSection?.querySelectorAll('.pal-row').length).toBe(1);
    expect(pinnedSection?.querySelector('.pal-row[data-kind="cache"]')).toBeNull();
    expect(pinnedSection?.querySelector('.pal-row[data-kind="db"]')).toBeTruthy();
  });

  it('allows collapsing the Pinned section', () => {
    setPreference('pinnedKinds', ['cache']);
    const onAdd = vi.fn();
    render(<Palette onAdd={onAdd} />);

    const pinnedToggle = document.querySelector<HTMLButtonElement>(
      '.pal-group-pinned .pal-group-toggle',
    );
    expect(pinnedToggle).toBeTruthy();
    expect(pinnedToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('#pal-group-list-pinned')).not.toBeNull();

    act(() => {
      pinnedToggle?.click();
    });

    expect(pinnedToggle?.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('#pal-group-list-pinned')).toBeNull();
    expect(getPreferences().collapsedGroups).toContain('pinned');
  });

  it('calls onAdd when clicking a row in the Pinned section', () => {
    setPreference('pinnedKinds', ['cache']);
    const onAdd = vi.fn();
    render(<Palette onAdd={onAdd} />);

    const pinnedCache = document.querySelector<HTMLButtonElement>(
      '.pal-group-pinned .pal-row[data-kind="cache"]',
    );
    expect(pinnedCache).toBeTruthy();

    act(() => {
      pinnedCache?.click();
    });

    expect(onAdd).toHaveBeenCalledWith('cache');
  });

  it('supports keyboard Space activation on rows', () => {
    const onAdd = vi.fn();
    render(<Palette onAdd={onAdd} />);

    const cache = document.querySelector<HTMLButtonElement>('.pal-row[data-kind="cache"]');
    expect(cache).toBeTruthy();

    act(() => {
      cache?.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
      );
    });

    expect(onAdd).toHaveBeenCalledWith('cache');
  });
});
