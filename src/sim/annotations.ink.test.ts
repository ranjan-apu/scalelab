import { describe, expect, it } from 'vitest';
import { sanitizeAnnotations } from './annotations';
import { INK_MAX_POINTS, INK_MAX_WIDTH, INK_MIN_WIDTH } from './sketch';

describe('ink sanitization', () => {
  const stroke = (over: Record<string, unknown> = {}) => ({
    id: 'ink-1',
    kind: 'ink',
    x: 10,
    y: 20,
    points: [0, 0, 5, 5, 10, 0],
    tone: 1,
    width: 4,
    opacity: 1,
    ...over,
  });

  it('keeps a well-formed stroke unchanged', () => {
    const [a] = sanitizeAnnotations([stroke()]);
    expect(a).toMatchObject({
      id: 'ink-1',
      kind: 'ink',
      x: 10,
      y: 20,
      points: [0, 0, 5, 5, 10, 0],
      tone: 1,
      width: 4,
      opacity: 1,
    });
  });

  it('drops a stroke with no usable samples', () => {
    expect(sanitizeAnnotations([stroke({ points: [] })])).toEqual([]);
    expect(sanitizeAnnotations([stroke({ points: [0, 0] })])).toEqual([]); // one sample
    expect(sanitizeAnnotations([stroke({ points: 'nonsense' })])).toEqual([]);
    expect(sanitizeAnnotations([stroke({ points: undefined })])).toEqual([]); // no points field
  });

  it('drops a stroke whose samples are not finite numbers', () => {
    expect(sanitizeAnnotations([stroke({ points: [0, NaN, 5, 5] })])).toEqual([]);
    expect(sanitizeAnnotations([stroke({ points: [0, 'x', 5, 5] })])).toEqual([]);
    expect(sanitizeAnnotations([stroke({ points: [0, Infinity, 5, 5] })])).toEqual([]);
  });

  it('recovers an odd-length sample list by keeping its paired prefix', () => {
    // A share link truncated mid-stroke loses the tail, not the stroke: the
    // paired prefix is recovered, matching how truncated text is sliced.
    const [a] = sanitizeAnnotations([stroke({ points: [0, 0, 5, 5, 10] })]) as any[];
    expect(a.points).toEqual([0, 0, 5, 5]);
  });

  it('still drops a list with no complete pair', () => {
    expect(sanitizeAnnotations([stroke({ points: [0] })])).toEqual([]);
  });

  it('caps the number of samples a hostile file can smuggle in', () => {
    const n = INK_MAX_POINTS + 500;
    const points: number[] = [];
    for (let i = 0; i < n; i += 1) points.push(i * 3, i * 3);
    const [a] = sanitizeAnnotations([stroke({ points })]) as any[];
    expect(a.points.length).toBe(INK_MAX_POINTS * 2);
  });

  it('clamps sample coordinates a hostile file can push anywhere', () => {
    const [a] = sanitizeAnnotations([stroke({ points: [0, 0, 1e9, 0] })]) as any[];
    expect(a.points[2]).toBeLessThanOrEqual(100000);
  });

  it('defaults a missing tone to the neutral pen', () => {
    const [a] = sanitizeAnnotations([stroke({ tone: undefined })]) as any[];
    expect(a.tone).toBe(0);
  });

  it('pins the tone into the palette and wraps nothing outside it', () => {
    expect((sanitizeAnnotations([stroke({ tone: 99 })]) as any)[0].tone).toBe(4);
    expect((sanitizeAnnotations([stroke({ tone: -3 })]) as any)[0].tone).toBe(0);
  });

  it('clamps width into the pen range and keeps opacity in [0.2, 1]', () => {
    const wide = sanitizeAnnotations([stroke({ width: 999 })]) as any[];
    expect(wide[0].width).toBe(INK_MAX_WIDTH);
    const thin = sanitizeAnnotations([stroke({ width: 0.001 })]) as any[];
    expect(thin[0].width).toBe(INK_MIN_WIDTH);
    const ghost = sanitizeAnnotations([stroke({ opacity: 0.001 })]) as any[];
    expect(ghost[0].opacity).toBe(0.2);
    const solid = sanitizeAnnotations([stroke({ opacity: 7 })]) as any[];
    expect(solid[0].opacity).toBe(1);
  });

  it('defaults a missing width and opacity to the pen defaults', () => {
    const [a] = sanitizeAnnotations([stroke({ width: undefined, opacity: undefined })]) as any[];
    expect(a.width).toBe(4);
    expect(a.opacity).toBe(1);
  });

  it('drops a stroke missing its origin like any other annotation', () => {
    expect(sanitizeAnnotations([stroke({ x: undefined })])).toEqual([]);
    expect(sanitizeAnnotations([stroke({ y: undefined })])).toEqual([]);
  });

  it('coexists with the other annotation kinds in one design', () => {
    const note = { id: 'note-1', kind: 'note', text: 'hi', x: 0, y: 0, width: 100 };
    const out = sanitizeAnnotations([note, stroke()]);
    expect(out).toHaveLength(2);
    expect(out[0]!.kind).toBe('note');
    expect(out[1]!.kind).toBe('ink');
  });
});
