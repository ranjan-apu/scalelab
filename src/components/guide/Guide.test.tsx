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
