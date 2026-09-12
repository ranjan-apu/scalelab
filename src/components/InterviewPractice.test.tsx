// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { InterviewPractice } from './InterviewPractice';
import { INTERVIEW_PACKS } from '../content/interviewPacks';
import { PRESETS } from '../sim/presets';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

function render(
  ui: React.ReactElement<React.ComponentProps<typeof InterviewPractice>>,
): void {
  act(() => root.render(ui));
}

function baseProps() {
  return {
    open: true,
    onClose: () => {},
    packs: INTERVIEW_PACKS,
    presets: PRESETS,
    activePresetId: null as string | null,
    onLoadPreset: vi.fn(),
    onPinSection: vi.fn(),
  };
}

describe('InterviewPractice', () => {
  it('renders nothing when closed', () => {
    render(<InterviewPractice {...baseProps()} open={false} />);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('opens on the requirements step with checkpoints', () => {
    render(<InterviewPractice {...baseProps()} />);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Interview Practice');
    expect(dialog?.textContent).toContain('Problem checkpoints');
    expect(dialog?.textContent).toContain('Functional');
    expect(dialog?.textContent).toContain('Non-functional');
  });

  it('walks the full interview track', () => {
    render(<InterviewPractice {...baseProps()} />);
    const steps = Array.from(document.querySelectorAll('.iv-step'));
    expect(steps.map((s) => s.textContent)).toEqual([
      '1Requirements',
      '2Entities',
      '3API Design',
      '4High-Level Design',
      '5Deep Dives',
    ]);

    act(() => {
      steps[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('API design');

    act(() => {
      steps[4]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('Tradeoff:');
  });

  it('loads the linked starter preset on the design step', () => {
    const onLoadPreset = vi.fn();
    const onClose = vi.fn();
    render(
      <InterviewPractice {...baseProps()} onLoadPreset={onLoadPreset} onClose={onClose} />,
    );
    const steps = Array.from(document.querySelectorAll('.iv-step'));
    act(() => {
      steps[3]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const load = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.startsWith('Load starter'),
    );
    expect(load).toBeDefined();
    act(() => {
      load?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onLoadPreset).toHaveBeenCalledTimes(1);
    expect(onLoadPreset.mock.calls[0]![0].id).toBe(
      INTERVIEW_PACKS[0]!.hldPresetId,
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('pins a section to the canvas', () => {
    const onPinSection = vi.fn();
    render(<InterviewPractice {...baseProps()} onPinSection={onPinSection} />);
    const pin = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Pin to canvas',
    );
    expect(pin).toBeDefined();
    act(() => {
      pin?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onPinSection).toHaveBeenCalledTimes(1);
    const [title, text] = onPinSection.mock.calls[0]!;
    expect(typeof title).toBe('string');
    expect((text as string).length).toBeGreaterThan(0);
  });

  it('searches and filters the problem library', () => {
    render(<InterviewPractice {...baseProps()} />);
    const search = document.querySelector('.iv-packs-filter input') as HTMLInputElement;
    expect(search).not.toBeNull();
    expect(document.querySelectorAll('.iv-pack').length).toBe(INTERVIEW_PACKS.length);

    act(() => {
      search.focus();
      // React 19 reads the native setter path; dispatch an input event instead.
      const native = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      native.call(search, 'auction');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const shown = Array.from(document.querySelectorAll('.iv-pack'));
    expect(shown.length).toBeGreaterThanOrEqual(1);
    expect(shown.length).toBeLessThan(INTERVIEW_PACKS.length);
    expect(document.body.textContent).toContain('Auction');
  });

  it('shows the lab step only for packs with labs, and grades it live', async () => {
    const { LABS } = await import('../content/labs');
    const { Engine } = await import('../sim/engine');
    const onLoadLab = vi.fn();
    const props = { ...baseProps(), labs: LABS, onLoadLab };
    render(<InterviewPractice {...props} />);

    // Jump to the cache-service pack, whose lab setup is the cache-aside preset.
    const target = Array.from(document.querySelectorAll('.iv-pack')).find((b) =>
      b.textContent?.includes('Distributed Cache Service'),
    );
    expect(target).toBeDefined();
    act(() => {
      target?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // The sixth step appears only when the pack has a lab.
    const steps = Array.from(document.querySelectorAll('.iv-step'));
    expect(steps.map((s) => s.textContent)).toContain('6Practice Lab');
    act(() => {
      steps[5]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('Size for the head');

    // Grading is disabled with no snapshot.
    const runDisabled = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Run checks',
    );
    expect(runDisabled?.hasAttribute('disabled')).toBe(true);

    // Load-lab offers the preset plus the lab traffic scenario.
    const loadLab = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.startsWith('Load lab'),
    );
    expect(loadLab).toBeDefined();
    act(() => {
      loadLab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onLoadLab).toHaveBeenCalledTimes(1);
    expect(onLoadLab.mock.calls[0]![0].id).toBe('cache-aside');
    expect(onLoadLab.mock.calls[0]![1]).toBe('steady');

    // A real engine run over the lab setup passes the calibrated checks.
    const topo = structuredClone(PRESETS.find((p) => p.id === 'cache-aside')!.topology);
    const engine = new Engine(topo, 7);
    for (let i = 0; i < 60 * 60; i += 1) engine.advance(1000 / 60);
    const snapshot = engine.snapshot();
    act(() => {
      root.render(<InterviewPractice {...props} snapshot={snapshot} topology={topo} />);
    });
    const run = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Run checks',
    );
    expect(run?.hasAttribute('disabled')).toBe(false);
    act(() => {
      run?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('All checks pass');
  });

  it('preselects a pack when jumping from a concept', () => {
    render(<InterviewPractice {...baseProps()} initialPackId="seat-hold" />);
    expect(document.body.textContent).toContain(
      'Design ticket sales for events with 100k seats',
    );
  });

  it('switches packs and resets to requirements', () => {
    render(<InterviewPractice {...baseProps()} />);
    const steps = Array.from(document.querySelectorAll('.iv-step'));
    act(() => {
      steps[4]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('Deep dives');

    const packButtons = Array.from(document.querySelectorAll('.iv-pack'));
    expect(packButtons.length).toBe(INTERVIEW_PACKS.length);
    act(() => {
      packButtons[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('Problem checkpoints');
  });
});
