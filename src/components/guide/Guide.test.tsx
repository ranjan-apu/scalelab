// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Guide } from './index';

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

function render(ui: React.ReactNode): void {
  act(() => root.render(ui));
}

describe('Guide component', () => {
  it('renders nothing when closed', () => {
    render(<Guide open={false} onClose={() => {}} />);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders dialog and header when open', () => {
    render(<Guide open={true} onClose={() => {}} />);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Welcome to ScaleLab Studio');
    expect(dialog?.textContent).toContain('Think in Events, Not Just Static Boxes');
  });

  it('switches tabs on click', () => {
    render(<Guide open={true} onClose={() => {}} />);
    const buttons = Array.from(document.querySelectorAll('.gd-tab'));
    const buildingTab = buttons.find((b) => b.textContent?.includes('Building Systems'));
    expect(buildingTab).toBeDefined();

    act(() => {
      buildingTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('Assembling Your Architecture');
    expect(document.body.textContent).toContain('34 specialized building blocks');
    expect(document.body.textContent).toContain('Draw.io Diagramming & Documentation Tools');
    expect(document.body.textContent).toContain('Freehand Pen / Marker');
    expect(document.body.textContent).toContain('Normal Boxes & Cards');
  });

  it('switches to Health & Resilience tab and displays architectural advisor info', () => {
    render(<Guide open={true} onClose={() => {}} />);
    const buttons = Array.from(document.querySelectorAll('.gd-tab'));
    const healthTab = buttons.find((b) => b.textContent?.includes('Health & Resilience'));
    expect(healthTab).toBeDefined();

    act(() => {
      healthTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(healthTab?.classList.contains('is-active')).toBe(true);
    expect(healthTab?.getAttribute('aria-selected')).toBe('true');
    expect(document.body.textContent).toContain('Architectural Health & Resilience Advisor');
    expect(document.body.textContent).toContain('Single Point of Failure (SPOF)');
    expect(document.body.textContent).toContain('Unbuffered Write Floods');
    expect(document.body.textContent).toContain('1-Click Focus & Mitigate');
  });

  it('switches to Concepts tab and searches the lesson library', () => {
    render(<Guide open={true} onClose={() => {}} />);
    const buttons = Array.from(document.querySelectorAll('.gd-tab'));
    const conceptsTab = buttons.find((b) => b.textContent?.includes('Concepts'));
    expect(conceptsTab).toBeDefined();

    act(() => {
      conceptsTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('Concept Lessons');
    expect(document.body.textContent).toContain('Caching');
    expect(document.body.textContent).toContain('34 lessons');
  });

  it('opens a concept lesson with the full teaching shape', () => {
    render(<Guide open={true} onClose={() => {}} />);
    const buttons = Array.from(document.querySelectorAll('.gd-tab'));
    act(() => {
      buttons
        .find((b) => b.textContent?.includes('Concepts'))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const open = Array.from(document.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Open lesson: Caching',
    );
    expect(open).toBeDefined();
    act(() => {
      open?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('Reach for it when');
    expect(document.body.textContent).toContain('Watch out for');
    expect(document.body.textContent).toContain('See it run');
    expect(document.body.textContent).toContain('Ask yourself');
    expect(document.body.textContent).toContain('Practice it');

    const back = Array.from(document.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Back to concepts',
    );
    act(() => {
      back?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('Concept Lessons');
  });

  it('wires lesson actions: demo, pin, glossary, and practice jump', () => {
    const onClose = vi.fn();
    const onLoadDemoPreset = vi.fn();
    const onPinSection = vi.fn();
    const onOpenGlossary = vi.fn();
    const onPracticePack = vi.fn();
    render(
      <Guide
        open={true}
        onClose={onClose}
        onLoadDemoPreset={onLoadDemoPreset}
        onPinSection={onPinSection}
        onOpenGlossary={onOpenGlossary}
        onPracticePack={onPracticePack}
      />,
    );
    const buttons = Array.from(document.querySelectorAll('.gd-tab'));
    act(() => {
      buttons
        .find((b) => b.textContent?.includes('Concepts'))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    act(() => {
      Array.from(document.querySelectorAll('button'))
        .find((b) => b.getAttribute('aria-label') === 'Open lesson: Caching')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const demo = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.startsWith('Open demo'),
    );
    act(() => {
      demo?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onLoadDemoPreset).toHaveBeenCalledTimes(1);
    expect(onLoadDemoPreset.mock.calls[0]![0]).toBe('cache-aside');
    expect(onClose).toHaveBeenCalled();

    const pin = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Pin lesson to canvas',
    );
    act(() => {
      pin?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onPinSection).toHaveBeenCalledTimes(1);
    expect(onPinSection.mock.calls[0]![0]).toBe('Caching');

    const practice = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Practice →',
    );
    expect(practice).toBeDefined();
    act(() => {
      practice?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onPracticePack).toHaveBeenCalledTimes(1);
    expect(typeof onPracticePack.mock.calls[0]![0]).toBe('string');
  });

  it('opens on the requested initial tab', () => {
    render(<Guide open={true} onClose={() => {}} initialTab="concepts" />);
    expect(document.body.textContent).toContain('Concept Lessons');
    const conceptsTab = Array.from(document.querySelectorAll('.gd-tab')).find((b) =>
      b.textContent?.includes('Concepts'),
    );
    expect(conceptsTab?.classList.contains('is-active')).toBe(true);
  });

  it('triggers onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<Guide open={true} onClose={onClose} />);
    const closeBtn = document.querySelector('button[aria-label="Close guide"]');
    expect(closeBtn).not.toBeNull();

    act(() => {
      closeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('triggers onClose when Esc pressed', () => {
    const onClose = vi.fn();
    render(<Guide open={true} onClose={onClose} />);
    const dialog = document.querySelector('[role="dialog"]');

    act(() => {
      dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
