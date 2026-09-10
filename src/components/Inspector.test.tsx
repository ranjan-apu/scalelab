// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Inspector } from './Inspector';
import type { Note, TextBox } from '../sim/annotations';

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

describe('NoteInspector in Inspector', () => {
  const sampleNote: Note = {
    id: 'n1',
    kind: 'note',
    text: 'One server, one database bottleneck test',
    x: 100,
    y: 200,
    width: 300,
    size: 'md',
    font: 'hand',
    tone: 2,
    bold: true,
  };

  it('renders note content, typeface, sizes and styles', () => {
    render(
      <Inspector
        node={null}
        stats={null}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        note={sampleNote}
      />,
    );

    expect(container.textContent).toContain('Canvas Note');
    expect(container.textContent).toContain('Handwritten');
    expect(container.textContent).toContain('Interface (Sans)');
    expect(container.textContent).toContain('Serif');
    expect(container.textContent).toContain('Monospace');

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe('One server, one database bottleneck test');
  });

  it('calls onEditNote when typing in the textarea', () => {
    const onEditNote = vi.fn();
    render(
      <Inspector
        node={null}
        stats={null}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        note={sampleNote}
        onEditNote={onEditNote}
      />,
    );

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      nativeInputValueSetter?.call(textarea, 'Updated note');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onEditNote).toHaveBeenCalledWith('n1', 'Updated note');
  });

  it('calls onSetNoteStyle when clicking typeface and tone buttons', () => {
    const onSetNoteStyle = vi.fn();
    render(
      <Inspector
        node={null}
        stats={null}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        note={sampleNote}
        onSetNoteStyle={onSetNoteStyle}
      />,
    );

    const monoBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Monospace'),
    );
    expect(monoBtn).toBeDefined();
    act(() => {
      monoBtn?.click();
    });
    expect(onSetNoteStyle).toHaveBeenCalledWith('n1', { font: 'mono' });
  });

  it('calls onDeleteNote when clicking delete button', () => {
    const onDeleteNote = vi.fn();
    render(
      <Inspector
        node={null}
        stats={null}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        note={sampleNote}
        onDeleteNote={onDeleteNote}
      />,
    );

    const deleteBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Delete Note'),
    );
    expect(deleteBtn).toBeDefined();
    act(() => {
      deleteBtn?.click();
    });
    expect(onDeleteNote).toHaveBeenCalledWith('n1');
  });
});

describe('TextBoxInspector in Inspector', () => {
  const sampleBox: TextBox = {
    id: 'tb1',
    kind: 'textbox',
    title: 'Functional Requirements',
    text: '• User login\n• Checkout flow',
    x: 100,
    y: 100,
    width: 280,
    height: 180,
    size: 'md',
    tone: 1,
    cardStyle: 'card',
  };

  it('renders box content, box styles, typeface, and formatting controls', () => {
    render(
      <Inspector
        node={null}
        stats={null}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        textBox={sampleBox}
      />,
    );

    expect(container.textContent).toContain('Requirements Card');
    expect(container.textContent).toContain('Card');
    expect(container.textContent).toContain('Sticky');
    expect(container.textContent).toContain('Box (Outline)');
    expect(container.textContent).toContain('Interface (Sans)');
    expect(container.textContent).toContain('Handwritten');
    expect(container.textContent).toContain('Interview Templates');

    const titleInput = container.querySelector('input.ins-title') as HTMLInputElement;
    expect(titleInput.value).toBe('Functional Requirements');

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('• User login\n• Checkout flow');
  });

  it('calls onSetTextBoxStyle when clicking Box Style buttons', () => {
    const onSetTextBoxStyle = vi.fn();
    render(
      <Inspector
        node={null}
        stats={null}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        textBox={sampleBox}
        onSetTextBoxStyle={onSetTextBoxStyle}
      />,
    );

    const outlineBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Box (Outline)',
    );
    expect(outlineBtn).toBeDefined();
    act(() => {
      outlineBtn?.click();
    });
    expect(onSetTextBoxStyle).toHaveBeenCalledWith('tb1', { cardStyle: 'outline' });
  });

  it('calls onSetTextBoxStyle when clicking typeface or formatting buttons', () => {
    const onSetTextBoxStyle = vi.fn();
    render(
      <Inspector
        node={null}
        stats={null}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        textBox={sampleBox}
        onSetTextBoxStyle={onSetTextBoxStyle}
      />,
    );

    const handBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Handwritten'),
    );
    expect(handBtn).toBeDefined();
    act(() => {
      handBtn?.click();
    });
    expect(onSetTextBoxStyle).toHaveBeenCalledWith('tb1', { font: 'hand' });

    const boldBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('title') === 'Bold',
    );
    expect(boldBtn).toBeDefined();
    act(() => {
      boldBtn?.click();
    });
    expect(onSetTextBoxStyle).toHaveBeenCalledWith('tb1', { bold: 'toggle' });
  });

  it('calls onDeleteTextBox when clicking Delete Box', () => {
    const onDeleteTextBox = vi.fn();
    render(
      <Inspector
        node={null}
        stats={null}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        textBox={sampleBox}
        onDeleteTextBox={onDeleteTextBox}
      />,
    );

    const deleteBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Delete Box'),
    );
    expect(deleteBtn).toBeDefined();
    act(() => {
      deleteBtn?.click();
    });
    expect(onDeleteTextBox).toHaveBeenCalledWith('tb1');
  });
});

describe('Clean Canvas mode conditional rendering in Inspector', () => {
  const dummyStats = {
    inFlight: 5,
    queued: 2,
    throughput: 100,
    arrivalRate: 100,
    utilization: 0.5,
    p50: 12,
    p95: 25,
    p99: 45,
    errorRate: 0,
    shedRate: 0,
    timeoutRate: 0,
    hitRate: 0,
    totalCompleted: 1000,
    totalFailed: 0,
    queueLimit: 100,
    staleReadRate: 0,
    maxShardUtilization: 0,
    minShardUtilization: 0,
    shardUtilization: [],
  };

  it('hides offered load slider and right now section when cleanCanvas is true for producer', async () => {
    const { makeNode } = await import('../sim/presets');
    const producerNode = makeNode('producer', 100, 100);

    render(
      <Inspector
        node={producerNode}
        stats={dummyStats}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        cleanCanvas={true}
      />,
    );

    expect(container.textContent).not.toContain('Offered load');
    expect(container.textContent).not.toContain('Right now');
    expect(container.textContent).toContain('Delete component');
  });

  it('shows offered load slider and right now section when cleanCanvas is false for producer', async () => {
    const { makeNode } = await import('../sim/presets');
    const producerNode = makeNode('producer', 100, 100);

    render(
      <Inspector
        node={producerNode}
        stats={dummyStats}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        cleanCanvas={false}
      />,
    );

    expect(container.textContent).toContain('Offered load');
    expect(container.textContent).toContain('Right now');
  });

  it('hides telemetry and live calculations for service nodes when cleanCanvas is true', async () => {
    const { makeNode } = await import('../sim/presets');
    const serviceNode = makeNode('service', 100, 100);

    render(
      <Inspector
        node={serviceNode}
        stats={dummyStats}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        cleanCanvas={true}
      />,
    );

    expect(container.textContent).not.toContain('Right now');
    expect(container.textContent).not.toContain('What that works out to');
    // Architectural knobs like capacity and service time should remain
    expect(container.textContent).toContain('Slots per instance');
    expect(container.textContent).toContain('Service time');
  });
});
