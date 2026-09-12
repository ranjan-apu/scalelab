// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StudioPanel } from './StudioPanel';
import type { Topology } from '../sim/types';
import { makeNode } from '../sim/presets';
import {
  __resetPreferences,
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

const sampleTopology: Topology = {
  nodes: [
    makeNode('db', 100, 100),
    makeNode('service', 200, 100),
  ],
  edges: [],
};

describe('StudioPanel cost estimation visibility', () => {
  it('renders estimated cloud cost and breakdown when costEstimator is enabled', () => {
    render(<StudioPanel topology={sampleTopology} costEstimator={true} />);

    expect(container.textContent).toContain('Studio review');
    expect(container.textContent).toContain('Est. cloud cost');
    expect(container.textContent).toContain('Database');
    expect(container.textContent).toContain('Service');
    expect(container.textContent).not.toContain('Cloud cost estimation is turned off in Settings');
  });

  it('hides estimated cloud cost and displays disabled message when costEstimator is false', () => {
    const onOpenSettings = vi.fn();
    render(
      <StudioPanel
        topology={sampleTopology}
        costEstimator={false}
        onOpenSettings={onOpenSettings}
      />,
    );

    expect(container.textContent).toContain('Studio review');
    expect(container.textContent).not.toContain('Est. cloud cost');
    expect(container.textContent).not.toContain('Planning estimates, not a quote');
    expect(container.textContent).toContain('Cloud cost estimation is turned off in Settings');

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain('Open Settings');

    act(() => button?.click());
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('reacts dynamically to global costEstimator preference change', () => {
    // Starts with costEstimator default = true
    render(<StudioPanel topology={sampleTopology} />);
    expect(container.textContent).toContain('Est. cloud cost');

    // Turn off preference
    act(() => {
      setPreference('costEstimator', false);
    });

    expect(container.textContent).not.toContain('Est. cloud cost');
    expect(container.textContent).toContain('Cloud cost estimation is turned off in Settings');

    // Turn back on
    act(() => {
      setPreference('costEstimator', true);
    });

    expect(container.textContent).toContain('Est. cloud cost');
    expect(container.textContent).not.toContain('Cloud cost estimation is turned off in Settings');
  });
});
