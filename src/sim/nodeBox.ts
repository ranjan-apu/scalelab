/**
 * A node's box on the canvas: the one place that answers "how big is this
 * thing, and where does it end".
 *
 * Every component is the same 184x88 rounded rect and always has been, so the
 * size used to be a pair of constants the canvas, the minimap and the shell's
 * placement maths each kept their own copy of. Shapes broke that: a box is
 * whatever size it was dragged to, so the answer now depends on the node.
 *
 * These live outside Canvas.tsx because three modules need them (the canvas,
 * the minimap and the palette's placement maths) and Canvas.tsx is a very
 * large module to import for two numbers. They live in sim/ because
 * `SimNode` is the thing being measured.
 */

import type { SimNode } from './types';

/** Default component body size in world px. The size every kind but `shape` uses. */
export const NODE_W = 184;
export const NODE_H = 88;

/**
 * A node's body width. Components have no width of their own, so they take
 * the constant; a shape carries its own.
 *
 * A half-written or hostile value falls back to the default rather than
 * reaching the renderer: a NaN here paints nothing at all and would make the
 * node vanish from the diagram with no way to get it back.
 */
export function nodeW(n: Pick<SimNode, 'width'>): number {
  const w = n.width;
  return typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : NODE_W;
}

/**
 * A node's body height.
 *
 * Zero is a LEGAL height here, unlike width: a horizontal line or arrow is
 * exactly 0 tall and must stay that way, so the guard is "is this a finite
 * number" rather than "is it positive". Only a missing, negative or NaN value
 * falls back to the constant.
 */
export function nodeH(n: Pick<SimNode, 'height'>): number {
  const h = n.height;
  return typeof h === 'number' && Number.isFinite(h) && h >= 0 ? h : NODE_H;
}

/** A node's box, for the edge router, hit testing and the minimap. */
export function nodeRect(n: Pick<SimNode, 'x' | 'y' | 'width' | 'height'>): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  return { x: n.x, y: n.y, w: nodeW(n), h: nodeH(n) };
}
