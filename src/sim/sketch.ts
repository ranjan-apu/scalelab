/**
 * Freehand ink strokes — the drawing layer of the canvas.
 *
 * Ink is an Annotation: documentation-only, engine-free, saved and shared
 * with the rest of the design. A stroke's geometry lives in two parts the
 * way every other annotation's does:
 *
 *   (x, y)   the stroke's origin — the FIRST sample, in world px. Moving a
 *            stroke moves this pair, never the points.
 *   points   the samples RELATIVE to that origin, flat [x0, y0, x1, y1, ...].
 *            points[0] is always [0, 0].
 *
 * Storing the origin separately (rather than absolute points) is what makes
 * the generic annotation move, marquee, history and delete machinery work
 * for ink without it learning that ink exists.
 */

/**
 * The ink palette, as theme-token indices rather than colours.
 *
 * Each index resolves through the annotation tone variables
 * (--ann-N-ink), which are redefined per theme, so a red stroke is red in
 * dark mode without carrying a hex that was picked for one of them.
 * Index 0 is the neutral "pen" ink; 1..4 reuse the blue/green/amber/red
 * tones the notes and text boxes already offer, so a diagram's accent
 * vocabulary stays one set of colours.
 */
export const INK_TONE_COUNT = 5;

export type InkTone = 0 | 1 | 2 | 3 | 4;

/**
 * A freehand stroke.
 *
 * `points` is decimated at capture time (samples closer than
 * INK_MIN_SPACING world px are dropped) and capped at INK_MAX_POINTS, so a
 * fast scribble stays a few hundred numbers, not a few thousand — the share
 * URL and the save file both carry every stroke verbatim.
 */
export interface Ink {
  id: string;
  kind: 'ink';
  /** First sample of the stroke, in world px. */
  x: number;
  /** First sample of the stroke, in world px. */
  y: number;
  /** Samples relative to (x, y), flat [x0, y0, x1, y1, ...]. points[0] is [0, 0]. */
  points: number[];
  /** Tone index, resolved to --ann-N-ink by the stylesheet. */
  tone: InkTone;
  /** Stroke width in world px (scales with zoom like every other canvas unit). */
  width: number;
  /** 0..1, applied to the whole stroke. */
  opacity: number;
}

/** Samples closer than this, in world px, are dropped at capture time. */
export const INK_MIN_SPACING = 2;
/** A stroke keeps at most this many samples. */
export const INK_MAX_POINTS = 1500;

export const INK_MIN_WIDTH = 1;
export const INK_MAX_WIDTH = 24;
export const INK_DEFAULT_WIDTH = 4;
export const INK_MIN_OPACITY = 0.2;
export const INK_DEFAULT_OPACITY = 1;

/**
 * A stroke with fewer samples than this is a click, not a drawing: dropped
 * at commit so a stray tap under the armed pen tool never leaves a dot.
 */
export const INK_MIN_SAMPLES = 2;

let counter = 0;

export function makeInk(
  x: number,
  y: number,
  points: number[],
  tone: InkTone = 0,
  width = INK_DEFAULT_WIDTH,
  opacity = INK_DEFAULT_OPACITY,
): Ink {
  counter += 1;
  return {
    id: `ink-${counter}`,
    kind: 'ink',
    x,
    y,
    points,
    tone,
    width: clampN(width, INK_MIN_WIDTH, INK_MAX_WIDTH),
    opacity: clampN(opacity, INK_MIN_OPACITY, 1),
  };
}

export function isInk(a: { kind: string }): a is Ink {
  return a.kind === 'ink';
}

/**
 * Validate one ink entry arriving from a saved design, a pasted link or an
 * imported file. Returns null when the entry is unrecoverable; a stroke with
 * no usable samples is dropped like an empty note, because it is invisible
 * and unselectable — litter the reader cannot remove.
 */
export function sanitizeInk(
  a: Record<string, unknown>,
  id: string,
  x: number,
  y: number,
): Ink | null {
  const rawPoints = Array.isArray(a.points) ? a.points : null;
  if (!rawPoints || rawPoints.length < INK_MIN_SAMPLES * 2) return null;

  const points: number[] = [];
  for (let i = 0; i + 1 < rawPoints.length && points.length < INK_MAX_POINTS * 2; i += 2) {
    const px = num(rawPoints[i]);
    const py = num(rawPoints[i + 1]);
    if (px === null || py === null) return null;
    // Coordinates are bounded the way section dimensions are: a hostile file
    // must not be able to place a stroke a megapixel off the diagram.
    points.push(clampN(px, -100000, 100000), clampN(py, -100000, 100000));
  }

  const toneRaw = num(a.tone);
  const tone =
    toneRaw === null
      ? 0
      : (Math.floor(clampN(toneRaw, 0, INK_TONE_COUNT - 1)) as InkTone);
  const width = num(a.width);
  const opacity = num(a.opacity);

  return {
    id,
    kind: 'ink',
    x,
    y,
    points,
    tone,
    width: clampN(width ?? INK_DEFAULT_WIDTH, INK_MIN_WIDTH, INK_MAX_WIDTH),
    opacity: clampN(opacity ?? INK_DEFAULT_OPACITY, INK_MIN_OPACITY, 1),
  };
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function clampN(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
