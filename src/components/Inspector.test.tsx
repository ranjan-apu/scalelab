// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Inspector } from './Inspector';
import type { Note } from '../sim/annotations';

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
