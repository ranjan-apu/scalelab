/**
 * Pure geometry for freehand ink strokes.
 *
 * Kept out of Canvas.tsx for the same reason pointerInput.ts and
 * annotationLayout.ts are: plain values in, plain values out, so the maths
 * that thins a captured scribble, smooths it into a path, and measures its
 * bounds can be unit tested without a DOM. Canvas.tsx consumes these; it
 * does not restate them.
 */

import { INK_MIN_SPACING } from '../sim/sketch';

/**
 * Drop samples closer than `minDist` world px from the one kept before
 * them.
 *
 * A pen reports a sample every pointermove — at 120Hz that is a dozen
 * samples per inch of a slow line, all of them noise. Decimation is
 * distance-based, not time-based, so a fast flick keeps its shape while a
 * tremor in the hand loses its wobble. The first and last sample are
 * always kept: they are where the stroke starts and ends, and dropping
 * either makes a stroke visibly shorter than the gesture that made it.
 */
export function decimatePoints(raw: number[], minDist: number = INK_MIN_SPACING): number[] {
  if (raw.length < 2) return raw.slice();
  const out: number[] = [raw[0]!, raw[1]!];
  const minSq = minDist * minDist;
  for (let i = 2; i + 1 < raw.length; i += 2) {
    const dx = raw[i]! - out[out.length - 2]!;
    const dy = raw[i + 1]! - out[out.length - 1]!;
    if (dx * dx + dy * dy >= minSq) {
      out.push(raw[i]!, raw[i + 1]!);
    }
  }
  // Keep the gesture's true endpoint even when it sat inside the spacing of
  // the last kept sample: a stroke that ends short reads as a different
  // mark than the one drawn.
  const lastX = out[out.length - 2]!;
  const lastY = out[out.length - 1]!;
  if (lastX !== raw[raw.length - 2] || lastY !== raw[raw.length - 1]) {
    out.push(raw[raw.length - 2]!, raw[raw.length - 1]!);
  }
  return out;
}

/**
 * The SVG path for a stroke, as quadratic Béziers through the sample
 * midpoints.
 *
 * The classic Excalidraw construction: each control point is a sample, each
 * anchor is the midpoint between two samples. A path through raw samples
 * with straight segments reads as a jagged polyline — the one tell that
 * makes a hand-drawn line look machine-made — and this construction is the
 * cheapest one that removes it without a Bézier fit.
 *
 * One sample pair (a dot) renders as a zero-length segment; the round line
 * cap paints it as a dot of the stroke's width, which is what a tap should
 * leave if it ever reaches the canvas.
 */
export function inkPathD(points: number[]): string {
  const n = points.length / 2;
  if (n === 0) return '';
  if (n === 1) {
    // A single sample: a zero-length segment the round cap turns into a dot.
    // The tiny offset keeps it genuinely zero-length in every renderer.
    const x = points[0]!;
    const y = points[1]!;
    return `M ${x} ${y} l 0.01 0`;
  }

  let d = `M ${points[0]} ${points[1]}`;
  for (let i = 1; i + 2 <= n; i += 1) {
    const cx = points[i * 2]!;
    const cy = points[i * 2 + 1]!;
    const mx = (cx + points[(i + 1) * 2]!) / 2;
    const my = (cy + points[(i + 1) * 2 + 1]!) / 2;
    d += ` Q ${cx} ${cy} ${mx} ${my}`;
  }
  // Land on the final sample, not the final midpoint: the stroke must end
  // where the hand stopped.
  const lastX = points[(n - 1) * 2]!;
  const lastY = points[(n - 1) * 2 + 1]!;
  d += ` L ${lastX} ${lastY}`;
  return d;
}

export interface InkBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The tight bounds of a stroke's samples, in the stroke's relative
 * coordinates.
 *
 * Callers add the (x, y) origin and the stroke width before using the
 * result for hit testing or fit-to-content, because the ink paints half a
 * stroke-width past its centreline on every side.
 */
export function inkSampleBounds(points: number[]): InkBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < points.length; i += 2) {
    const x = points[i]!;
    const y = points[i + 1]!;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Full paint bounds of a stroke, in WORLD coordinates: the samples plus the
 * origin, padded by half the stroke width so a horizontal line is selectable
 * along its painted body, not just its mathematical centreline.
 */
export function inkWorldBounds(
  ox: number,
  oy: number,
  points: number[],
  width: number,
): InkBounds {
  const b = inkSampleBounds(points);
  const pad = width / 2;
  return {
    x: ox + b.x - pad,
    y: oy + b.y - pad,
    w: b.w + width,
    h: b.h + width,
  };
}

/**
 * Is the point (wx, wy) in world coordinates close enough to the stroke's
 * centreline to count as a hit on the painted ink?
 *
 * Segment-by-segment point-to-line distance. Strokes are decimated to a
 * couple of hundred samples at most, so a linear scan is a few hundred
 * distance computations — trivial at click frequency, and it stays exact
 * where a bounds-only test would either miss a thin squiggle's loops or
 * grab the whole bounding box.
 */
export function inkHitTest(
  ox: number,
  oy: number,
  points: number[],
  width: number,
  wx: number,
  wy: number,
): boolean {
  const pad = Math.max(width / 2, 4); // a fat-finger floor: 4 world px either side
  const padSq = pad * pad;
  const n = points.length / 2;
  if (n === 1) {
    const dx = ox + points[0]! - wx;
    const dy = oy + points[1]! - wy;
    return dx * dx + dy * dy <= padSq;
  }
  let prevX = points[0]!;
  let prevY = points[1]!;
  for (let i = 1; i < n; i += 1) {
    const x = points[i * 2]!;
    const y = points[i * 2 + 1]!;
    if (pointSegmentDistSq(ox + prevX, oy + prevY, ox + x, oy + y, wx, wy) <= padSq) {
      return true;
    }
    prevX = x;
    prevY = y;
  }
  return false;
}

function pointSegmentDistSq(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  let t = lenSq === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (ax + t * abx);
  const dy = py - (ay + t * aby);
  return dx * dx + dy * dy;
}
