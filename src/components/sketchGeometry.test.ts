import { describe, expect, it } from 'vitest';
import { decimatePoints, inkPathD, inkSampleBounds, inkWorldBounds, inkHitTest } from './sketchGeometry';

describe('decimatePoints', () => {
  it('keeps the first and last sample whatever the spacing', () => {
    const raw = [0, 0, 1, 1, 2, 2, 50, 50, 51, 51];
    const out = decimatePoints(raw, 2);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(0);
    expect(out[out.length - 2]).toBe(51);
    expect(out[out.length - 1]).toBe(51);
  });

  it('drops samples closer than the spacing to the last kept one', () => {
    // A slow line: each step 1px apart at spacing 2 keeps every other sample.
    const raw = [0, 0, 1, 0, 2, 0, 3, 0, 4, 0];
    const out = decimatePoints(raw, 2);
    // Kept: (0,0) [first], (2,0) [2px from 0,0], (4,0) [2px from 2,0 = last]
    expect(out).toEqual([0, 0, 2, 0, 4, 0]);
  });

  it('keeps a tail sample inside the spacing so the stroke ends where drawn', () => {
    // (4,0) is only 1px past the last kept (3,0): without the tail rule the
    // stroke would end a full sample short.
    const raw = [0, 0, 1, 0, 2, 0, 3, 0, 4, 0];
    const out = decimatePoints(raw, 3);
    // Kept by spacing: (0,0), (3,0). Tail: (4,0) is the gesture's true end.
    expect(out).toEqual([0, 0, 3, 0, 4, 0]);
  });

  it('passes a single sample straight through', () => {
    expect(decimatePoints([7, 9], 2)).toEqual([7, 9]);
    expect(decimatePoints([], 2)).toEqual([]);
  });

  it('never mutates its input', () => {
    const raw = [0, 0, 10, 10];
    const before = raw.slice();
    decimatePoints(raw, 2);
    expect(raw).toEqual(before);
  });
});

describe('inkPathD', () => {
  it('returns an empty path for no samples', () => {
    expect(inkPathD([])).toBe('');
  });

  it('renders a single sample as a zero-length segment the round cap turns into a dot', () => {
    const d = inkPathD([3, 5]);
    expect(d).toContain('M 3 5');
    expect(d).toMatch(/l 0\.01 0/);
  });

  it('starts at the first sample and ends at the last', () => {
    const d = inkPathD([0, 0, 10, 0, 20, 0]);
    expect(d.startsWith('M 0 0')).toBe(true);
    expect(d.endsWith('L 20 0')).toBe(true);
  });

  it('smooths through midpoints with quadratic Béziers', () => {
    const d = inkPathD([0, 0, 10, 0, 20, 0]);
    // Control point (10,0), anchor at the midpoint (15,0).
    expect(d).toContain('Q 10 0 15 0');
  });

  it('keeps a straight line straight: collinear samples produce a path on the line', () => {
    const d = inkPathD([0, 0, 5, 5, 10, 10]);
    expect(d).toContain('Q 5 5');
  });
});

describe('inkSampleBounds', () => {
  it('computes the tight bounds of the samples', () => {
    expect(inkSampleBounds([2, 3, 8, 1, -1, 7, 4, -2])).toEqual({
      x: -1,
      y: -2,
      w: 9,
      h: 9,
    });
  });

  it('is a point for a single sample', () => {
    expect(inkSampleBounds([4, 6])).toEqual({ x: 4, y: 6, w: 0, h: 0 });
  });

  it('is empty for no samples', () => {
    expect(inkSampleBounds([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe('inkWorldBounds', () => {
  it('adds the origin and pads by half the stroke width', () => {
    // Samples span (0,0)..(10,4); width 4 pads 2 on every side.
    const b = inkWorldBounds(100, 50, [0, 0, 10, 4], 4);
    expect(b).toEqual({ x: 98, y: 48, w: 14, h: 8 });
  });

  it('a horizontal line is still selectable along its painted body', () => {
    const b = inkWorldBounds(0, 0, [0, 0, 10, 0], 4);
    expect(b.h).toBe(4); // not 0
  });
});

describe('inkHitTest', () => {
  const line = [0, 0, 100, 0]; // a horizontal stroke, origin (0,0), width 4

  it('hits a point on the centreline', () => {
    expect(inkHitTest(0, 0, line, 4, 50, 0)).toBe(true);
  });

  it('hits a point within half the width of the line', () => {
    expect(inkHitTest(0, 0, line, 4, 50, 2)).toBe(true);
  });

  it('respects the fat-finger floor: 4 world px either side even for a hairline', () => {
    expect(inkHitTest(0, 0, line, 1, 50, 4)).toBe(true);
    expect(inkHitTest(0, 0, line, 1, 50, 4.5)).toBe(false);
  });

  it('misses a point well off the line', () => {
    expect(inkHitTest(0, 0, line, 4, 50, 10)).toBe(false);
  });

  it('misses past the end of the stroke', () => {
    expect(inkHitTest(0, 0, line, 4, 105, 0)).toBe(false);
  });

  it('handles a single-sample stroke as a dot', () => {
    expect(inkHitTest(0, 0, [5, 5], 4, 6, 6)).toBe(true);
    expect(inkHitTest(0, 0, [5, 5], 4, 20, 20)).toBe(false);
  });

  it('uses the origin: the same relative samples hit at their placed location', () => {
    expect(inkHitTest(100, 200, line, 4, 150, 200)).toBe(true);
    expect(inkHitTest(100, 200, line, 4, 50, 0)).toBe(false);
  });

  it('hits a looped stroke on the far side of its own bounding box', () => {
    // A "C" shape: the point (10, 5) is inside the box but NOT on the ink.
    const c = [0, 0, 10, 0, 20, 0, 20, 10, 20, 20, 10, 20, 0, 20];
    expect(inkHitTest(0, 0, c, 4, 10, 10)).toBe(false);
    // ...while (20, 10) is on the ink.
    expect(inkHitTest(0, 0, c, 4, 20, 10)).toBe(true);
  });
});
