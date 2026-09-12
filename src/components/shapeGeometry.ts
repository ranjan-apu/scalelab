/**
 * Pure geometry for the basic shapes.
 *
 * Everything here is plain values in, plain values out, so the arithmetic that
 * decides where a diamond's corners sit, how much room a triangle leaves for a
 * label, and which way round a line's two endpoints go can be reasoned about
 * without a DOM. Canvas.tsx consumes these; it does not restate them.
 *
 * All coordinates are LOCAL to the shape's own box: (0, 0) is the box's
 * top-left and (w, h) its bottom-right. The caller has already translated to
 * the node's x/y, exactly as NoteView does.
 */

import { baselineIn, descentBelow, measureText } from './textMetrics';
import type { TextStyle } from './textMetrics';
import { wrapText } from './annotationLayout';
import type { ShapeKind, SimNode } from '../sim/types';

/** Drag payload type for the rail's shape tiles. */
export const SHAPE_DND_MIME = 'application/x-scalelab-shape';

/**
 * The face a shape's label is set in.
 *
 * One step smaller than a note's `md`, because a shape's label sits inside a
 * box the reader is also reading the box's own outline from: the words are a
 * caption on the geometry, not the content.
 */
export const SHAPE_LABEL_STYLE: TextStyle = { size: 13, weight: 500, family: 'sans' };
export const SHAPE_LABEL_LINE = 17;
/** Padding between a label and the inside of its box, in world px. */
export const SHAPE_LABEL_PAD = 10;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ShapeGeometry {
  /** The filled outline, or null for a shape with no body (line, arrow). */
  body: string | null;
  /** A stroked line drawn on top of the body: a cylinder's top cap. */
  detail: string | null;
  /** The stroked line itself, for the linear shapes. */
  stroke: string | null;
  /** A filled arrowhead at the end of `stroke`. */
  head: string | null;
  /** Where the label may sit, or a zero box when the shape takes no label. */
  label: Rect;
}

/** Rounded rectangle as a path, so every body is one kind of element to paint. */
function roundRect(w: number, h: number, r: number): string {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  if (rad === 0) return `M0,0 H${w} V${h} H0 Z`;
  return [
    `M${rad},0`,
    `H${w - rad}`,
    `A${rad},${rad} 0 0 1 ${w},${rad}`,
    `V${h - rad}`,
    `A${rad},${rad} 0 0 1 ${w - rad},${h}`,
    `H${rad}`,
    `A${rad},${rad} 0 0 1 0,${h - rad}`,
    `V${rad}`,
    `A${rad},${rad} 0 0 1 ${rad},0`,
    'Z',
  ].join(' ');
}

/**
 * Where a line's two ends are, in local coordinates.
 *
 * Stored as a box plus two flips rather than as two points, so there is one
 * source of geometry and nothing can go stale against the other: the box is
 * what the edge router, the hit test and the minimap already understand.
 */
function lineCorners(
  w: number,
  h: number,
  flipX?: boolean,
  flipY?: boolean,
): { a: { x: number; y: number }; b: { x: number; y: number } } {
  return {
    a: { x: flipX ? w : 0, y: flipY ? h : 0 },
    b: { x: flipX ? 0 : w, y: flipY ? 0 : h },
  };
}

/** Arrowhead half-width at the base, as a fraction of its length. */
const HEAD_RATIO = 0.42;
const HEAD_MIN = 6;
const HEAD_MAX = 18;

function arrowHead(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): string {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1) return '';
  const ux = dx / len;
  const uy = dy / len;
  const size = Math.max(HEAD_MIN, Math.min(HEAD_MAX, len * HEAD_RATIO));
  const half = size * 0.5;
  // Two barbs behind the tip, perpendicular to the line.
  const cx = bx - ux * size;
  const cy = by - uy * size;
  const nx = -uy * half;
  const ny = ux * half;
  return `${bx},${by} ${cx + nx},${cy + ny} ${cx - nx},${cy - ny}`;
}

/**
 * Everything the renderer needs for one shape, in its own box.
 *
 * A single call rather than four helpers so the caller memoises ONE value and
 * the pieces cannot be computed against different boxes.
 */
export function shapeGeometry(
  shape: ShapeKind | undefined,
  w: number,
  h: number,
  flipX?: boolean,
  flipY?: boolean,
): ShapeGeometry {
  const kind: ShapeKind = shape ?? 'rect';
  const none: Rect = { x: 0, y: 0, w: 0, h: 0 };
  const inset = SHAPE_LABEL_PAD;

  switch (kind) {
    case 'line':
    case 'arrow': {
      const { a, b } = lineCorners(w, h, flipX, flipY);
      const stroke = `M${a.x},${a.y} L${b.x},${b.y}`;
      return {
        body: null,
        detail: null,
        stroke,
        head: kind === 'arrow' ? arrowHead(a.x, a.y, b.x, b.y) : null,
        // A line has no inside to write in, so it takes no label.
        label: none,
      };
    }

    case 'ellipse':
      return {
        body: `M0,${h / 2} A${w / 2},${h / 2} 0 1 0 ${w},${h / 2} A${w / 2},${h / 2} 0 1 0 0,${h / 2} Z`,
        detail: null,
        stroke: null,
        head: null,
        label: { x: w * 0.15, y: h * 0.2, w: w * 0.7, h: h * 0.6 },
      };

    case 'diamond':
      return {
        body: `M${w / 2},0 L${w},${h / 2} L${w / 2},${h} L0,${h / 2} Z`,
        detail: null,
        stroke: null,
        head: null,
        // The middle half only: the corners are the shape's whole identity, so
        // text that runs into them stops reading as a diamond.
        label: { x: w * 0.25, y: h * 0.25, w: w * 0.5, h: h * 0.5 },
      };

    case 'triangle':
      return {
        body: `M${w / 2},0 L${w},${h} L0,${h} Z`,
        detail: null,
        stroke: null,
        head: null,
        // The lower half: the apex leaves nothing worth writing in.
        label: { x: w * 0.2, y: h * 0.45, w: w * 0.6, h: h * 0.5 },
      };

    case 'hexagon': {
      const cut = Math.min(w * 0.2, h * 0.5);
      return {
        body: `M${cut},0 L${w - cut},0 L${w},${h / 2} L${w - cut},${h} L${cut},${h} L0,${h / 2} Z`,
        detail: null,
        stroke: null,
        head: null,
        label: { x: cut + inset, y: inset, w: Math.max(0, w - cut * 2 - inset * 2), h: h - inset * 2 },
      };
    }

    case 'parallelogram': {
      const skew = Math.min(w * 0.2, h * 0.6);
      return {
        body: `M${skew},0 L${w},0 L${w - skew},${h} L0,${h} Z`,
        detail: null,
        stroke: null,
        head: null,
        label: { x: skew + inset, y: inset, w: Math.max(0, w - skew * 2 - inset * 2), h: h - inset * 2 },
      };
    }

    case 'cylinder': {
      // The cap's height is bounded so a very tall cylinder keeps a flat side
      // worth reading, and a very short one does not become all cap.
      const cap = Math.max(4, Math.min(h * 0.18, 22));
      const rx = w / 2;
      return {
        body: [
          `M0,${cap}`,
          `A${rx},${cap} 0 0 1 ${w},${cap}`,
          `V${h - cap}`,
          `A${rx},${cap} 0 0 1 0,${h - cap}`,
          'Z',
        ].join(' '),
        // The top ellipse, drawn as its own curve: it is the mark that says
        // "store" rather than "rounded box", and it has to stay visible on a
        // stroke-only shape too.
        detail: `M0,${cap} A${rx},${cap} 0 0 0 ${w},${cap}`,
        stroke: null,
        head: null,
        label: { x: inset, y: cap + inset, w: Math.max(0, w - inset * 2), h: Math.max(0, h - cap * 2 - inset * 2) },
      };
    }

    case 'roundrect':
      return {
        // A radius that reads as deliberate at any size without turning a
        // small shape into a stadium.
        body: roundRect(w, h, Math.min(18, Math.min(w, h) * 0.22)),
        detail: null,
        stroke: null,
        head: null,
        label: { x: inset, y: inset, w: Math.max(0, w - inset * 2), h: Math.max(0, h - inset * 2) },
      };

    case 'rect':
    default:
      return {
        body: `M0,0 H${w} V${h} H0 Z`,
        detail: null,
        stroke: null,
        head: null,
        label: { x: inset, y: inset, w: Math.max(0, w - inset * 2), h: Math.max(0, h - inset * 2) },
      };
  }
}

export interface LabelLayout {
  lines: string[];
  /** y of the first line's baseline, in local coordinates. */
  baseline: number;
  lineH: number;
  /** Total height the wrapped text occupies. */
  height: number;
  /** x of each line's start, for a middle-anchored paint. */
  x: number;
}

/**
 * Wrap a shape's label to fit inside its face, centred.
 *
 * Absent text yields no lines rather than one empty one, so the renderer draws
 * nothing at all and a blank box stays blank.
 */
export function layoutShapeLabel(
  text: string,
  label: Rect,
  style: TextStyle = SHAPE_LABEL_STYLE,
  lineH = SHAPE_LABEL_LINE,
): LabelLayout {
  const x = label.x + label.w / 2;
  if (!text.trim() || label.w <= 0 || label.h <= 0) {
    return { lines: [], baseline: label.y, lineH, height: 0, x };
  }
  const lines = wrapText(text, label.w, style);
  const baseline = baselineIn(lineH, style);
  const height = Math.max(
    lineH,
    (lines.length - 1) * lineH + baseline + descentBelow(style),
    lines.length * lineH,
  );
  return { lines, baseline, lineH, height, x };
}

/** One text line, measured. Used by the tests and the truncation guard. */
export function labelFits(text: string, label: Rect, style: TextStyle = SHAPE_LABEL_STYLE): boolean {
  return measureText(text, style) <= label.w;
}

export interface ShapePoint {
  x: number;
  y: number;
}

/**
 * A line's two endpoints in WORLD coordinates, for the resize gesture.
 *
 * The inverse of `withLineEndpoints`: the stored box and flips resolved into
 * the pair of points the handles are drawn at.
 */
export function lineEndpoints(node: Pick<SimNode, 'x' | 'y' | 'width' | 'height' | 'flipX' | 'flipY'>): {
  a: ShapePoint;
  b: ShapePoint;
} {
  const w = node.width ?? 0;
  const h = node.height ?? 0;
  const { a, b } = lineCorners(w, h, node.flipX, node.flipY);
  return {
    a: { x: node.x + a.x, y: node.y + a.y },
    b: { x: node.x + b.x, y: node.y + b.y },
  };
}

/**
 * Rebuild a line's box and flips from two world points.
 *
 * Dragging an endpoint is the one gesture that can invert a shape, and this is
 * where that is resolved: the box always grows DOWN-RIGHT from its own corner
 * (which is what every other part of the canvas assumes of `x`/`y`), and the
 * two flips carry which diagonal the line actually occupies. Crossing the
 * other endpoint therefore swaps the ends rather than producing a negative
 * width, which the router and the minimap would both misread.
 */
export function withLineEndpoints(
  a: ShapePoint,
  b: ShapePoint,
): { x: number; y: number; width: number; height: number; flipX: boolean; flipY: boolean } {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
    flipX: a.x > b.x,
    flipY: a.y > b.y,
  };
}
