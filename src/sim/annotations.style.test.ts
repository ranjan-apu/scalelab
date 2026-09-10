/**
 * Colour and font validation on the annotation trust boundary.
 *
 * A colour reaches the DOM as a style value, and it arrives from a share
 * link, a pasted design or an imported file. Everything hostile here is a
 * string someone could put in a URL, so these are the cases that matter far
 * more than the happy path.
 */

import { describe, expect, it } from 'vitest';
import { isTextBox, makeTextBox, sanitizeAnnotations } from './annotations';

const noteWith = (extra: Record<string, unknown>) => [
  { id: 'n1', kind: 'note', text: 'hello', x: 0, y: 0, width: 200, ...extra },
];

const sectionWith = (extra: Record<string, unknown>) => [
  {
    id: 's1',
    kind: 'section',
    label: 'Tier',
    x: 0,
    y: 0,
    width: 300,
    height: 200,
    tone: 1,
    ...extra,
  },
];

const firstNote = (input: unknown[]) => sanitizeAnnotations(input)[0];

describe('annotation colour', () => {
  it.each([
    ['#fff', '#fff'],
    ['#1a2b3c', '#1a2b3c'],
    ['#1a2b3cdd', '#1a2b3cdd'],
    ['rgb(12, 34, 56)', 'rgb(12, 34, 56)'],
    ['rgba(12,34,56,0.5)', 'rgba(12,34,56,0.5)'],
    ['hsl(210 40% 50%)', 'hsl(210 40% 50%)'],
    ['tomato', 'tomato'],
  ])('accepts %s', (input, expected) => {
    expect(firstNote(noteWith({ color: input }))).toMatchObject({ color: expected });
  });

  it.each([
    ['red; position: fixed'],
    ['url(https://example.com/x.png)'],
    ['expression(alert(1))'],
    ['rgb(0,0,0) !important'],
    ['</style><script>alert(1)</script>'],
    ['var(--secret)'],
    ['#12'],
    ['#1234567'],
    [''],
    ['   '],
  ])('drops hostile value %s rather than passing it through', (input) => {
    expect(firstNote(noteWith({ color: input }))).not.toHaveProperty('color');
  });

  it('drops a colour that is not a string', () => {
    expect(firstNote(noteWith({ color: 0xff0000 }))).not.toHaveProperty('color');
  });

  it('drops an absurdly long value before matching it', () => {
    expect(firstNote(noteWith({ color: `#${'a'.repeat(200)}` }))).not.toHaveProperty(
      'color',
    );
  });

  it('applies the same rule to a section', () => {
    expect(sanitizeAnnotations(sectionWith({ color: '#0a0a0a' }))[0]).toMatchObject({
      color: '#0a0a0a',
    });
    expect(
      sanitizeAnnotations(sectionWith({ color: 'red;evil' }))[0],
    ).not.toHaveProperty('color');
  });

  it('leaves an annotation with no colour following the theme', () => {
    expect(firstNote(noteWith({}))).not.toHaveProperty('color');
  });
});

describe('annotation font', () => {
  it.each(['sans', 'serif', 'mono'])('accepts %s', (f) => {
    expect(firstNote(noteWith({ font: f }))).toMatchObject({ font: f });
  });

  it('drops a family we have no measurable stack for', () => {
    // "marker" was offered once and removed: it resolved to the same face as
    // serif on a typical machine, so the picker showed two identical
    // buttons. A design saved while it existed must not resurrect it.
    expect(firstNote(noteWith({ font: 'marker' }))).not.toHaveProperty('font');
    // The handwriting face went the same way when its webfont was removed:
    // designs saved while it existed fall back to the default rendering.
    expect(firstNote(noteWith({ font: 'hand' }))).not.toHaveProperty('font');
    // Painting in a face we cannot measure wraps the note to the wrong width.
    expect(firstNote(noteWith({ font: 'Papyrus' }))).not.toHaveProperty('font');
    expect(firstNote(noteWith({ font: 42 }))).not.toHaveProperty('font');
  });
});

describe('textbox sanitization and helpers', () => {
  it('sanitizes a valid textbox correctly', () => {
    const raw = [
      {
        id: 'tb1',
        kind: 'textbox',
        title: 'Functional Requirements',
        text: '• Core action',
        x: 50,
        y: 60,
        width: 320,
        height: 220,
        tone: 2,
      },
    ];
    const sanitized = sanitizeAnnotations(raw);
    expect(sanitized).toHaveLength(1);
    expect(sanitized[0]).toMatchObject({
      id: 'tb1',
      kind: 'textbox',
      title: 'Functional Requirements',
      text: '• Core action',
      x: 50,
      y: 60,
      width: 320,
      height: 220,
      tone: 2,
    });
  });

  it('clamps dimensions to min and max bounds', () => {
    const raw = [
      {
        id: 'tb2',
        kind: 'textbox',
        text: 'hello',
        x: 0,
        y: 0,
        width: 10,
        height: 5000,
      },
    ];
    const [tb] = sanitizeAnnotations(raw);
    expect(tb).toMatchObject({
      width: 160,
      height: 2000,
    });
  });

  it('makeTextBox factory produces expected default attributes', () => {
    const tb = makeTextBox(100, 200);
    expect(tb.kind).toBe('textbox');
    expect(tb.x).toBe(100);
    expect(tb.y).toBe(200);
    expect(tb.width).toBe(280);
    expect(tb.height).toBe(180);
    expect(isTextBox(tb)).toBe(true);
  });

  it('makeTextBox supports clean plain text box with empty title (draw.io double-click)', () => {
    const tb = makeTextBox(150, 250, '', '');
    expect(tb.kind).toBe('textbox');
    expect(tb.title).toBe('');
    expect(tb.text).toBe('');
    expect(tb.x).toBe(150);
    expect(tb.y).toBe(250);
  });

  it('makeTextBox supports cardStyle and sanitizeAnnotations preserves it', () => {
    const outlineBox = makeTextBox(100, 100, 'Box Title', 'Content', 2, 'outline');
    expect(outlineBox.cardStyle).toBe('outline');

    const sanitized = sanitizeAnnotations([
      {
        id: 'tb-1',
        kind: 'textbox',
        x: 10,
        y: 20,
        width: 250,
        height: 150,
        text: 'Outline box notes',
        cardStyle: 'outline',
      },
      {
        id: 'tb-2',
        kind: 'textbox',
        x: 30,
        y: 40,
        width: 200,
        height: 120,
        text: 'Sticky notes',
        cardStyle: 'sticky',
      },
      {
        id: 'tb-3',
        kind: 'textbox',
        x: 50,
        y: 60,
        width: 200,
        height: 120,
        text: 'Invalid style box',
        cardStyle: 'unrecognized-style',
      },
    ]);

    expect(sanitized).toHaveLength(3);
    const [b1, b2, b3] = sanitized as any[];
    expect(b1.cardStyle).toBe('outline');
    expect(b2.cardStyle).toBe('sticky');
    expect(b3.cardStyle).toBeUndefined();
  });
});
