/**
 * The basic-shapes library: the whiteboard layer's vocabulary.
 *
 * These are nodes, not annotations, so that an arrow can be drawn to one and
 * so that a box can sit mid-chain between two real components. What makes
 * them shapes rather than components is entirely in this file and in the
 * canvas: a shape is a body of some geometry with a label, and in the engine
 * it is a zero-cost pass-through hop (see the `shape` behaviour in
 * behaviour.ts).
 *
 * The engine-free reasoning for the model lives in types.ts (SimNode.shape,
 * ShapeKind); this module is the per-shape data and the size rules.
 */

import type { ShapeKind, SimNode } from './types';
import { defaultConfig } from './presets';

/**
 * Every shape, in the order the rail lists them. Closed shapes first, the two
 * linear ones last, which is also the order they are grouped in the library.
 */
export const SHAPE_KINDS: readonly ShapeKind[] = [
  'rect',
  'roundrect',
  'ellipse',
  'diamond',
  'triangle',
  'hexagon',
  'parallelogram',
  'cylinder',
  'line',
  'arrow',
];

export interface ShapeSpec {
  name: string;
  /** The rail row's tooltip: what it is for, not what it is. */
  hint: string;
  /** Size a freshly dropped one takes, in world px. */
  defaultW: number;
  defaultH: number;
  /**
   * Draws a single stroke between two corners rather than a closed body.
   *
   * Linear shapes are the exception to almost every rule here: their handle
   * set is their two endpoints, they have no fill and no label box, and a
   * horizontal one is legitimately 0 tall.
   */
  linear?: true;
}

/**
 * Defaults are draw.io-shaped rather than component-shaped: an ellipse is
 * born square (a circle), which is the one geometry a person will reach for
 * to draw a circle and would have to fight a 184x88 box to get.
 */
export const SHAPE_SPECS: Record<ShapeKind, ShapeSpec> = {
  rect: {
    name: 'Rectangle',
    hint: 'A plain box: the whiteboard workhorse',
    defaultW: 160,
    defaultH: 100,
  },
  roundrect: {
    name: 'Rounded rectangle',
    hint: 'A box with soft corners, for a process or a step',
    defaultW: 160,
    defaultH: 100,
  },
  ellipse: {
    name: 'Ellipse',
    hint: 'An oval or circle: a state, an actor, or just a bubble',
    defaultW: 140,
    defaultH: 140,
  },
  diamond: {
    name: 'Diamond',
    hint: 'A decision point in a flow',
    defaultW: 140,
    defaultH: 110,
  },
  triangle: {
    name: 'Triangle',
    hint: 'A warning, an origin, or a hierarchy',
    defaultW: 140,
    defaultH: 120,
  },
  hexagon: {
    name: 'Hexagon',
    hint: 'A preparation or a boundary',
    defaultW: 160,
    defaultH: 110,
  },
  parallelogram: {
    name: 'Parallelogram',
    hint: 'Input or output: data entering or leaving a step',
    defaultW: 170,
    defaultH: 100,
  },
  cylinder: {
    name: 'Cylinder',
    hint: 'A store of something, drawn plainly',
    defaultW: 130,
    defaultH: 120,
  },
  line: {
    name: 'Line',
    hint: 'A straight connector between two things',
    defaultW: 180,
    defaultH: 0,
    linear: true,
  },
  arrow: {
    name: 'Arrow',
    hint: 'A straight arrow: direction without a component behind it',
    defaultW: 180,
    defaultH: 0,
    linear: true,
  },
};

/**
 * Size bounds.
 *
 * The minimum is the size at which a shape still has a face to grab and a
 * label to read; below it a drag past the corner would leave something
 * unselectable. The maximum is a sanity bound rather than a design one: it is
 * what the sanitizer clamps to, so a hostile share link cannot place a box a
 * megapixel wide and collapse the fit-to-view maths.
 */
export const SHAPE_MIN_W = 24;
export const SHAPE_MIN_H = 24;
export const SHAPE_MAX_W = 4000;
export const SHAPE_MAX_H = 4000;

export function isLinearShape(shape: ShapeKind | undefined): boolean {
  return shape === 'line' || shape === 'arrow';
}

/** The smallest height this shape may be. A horizontal line is 0 tall. */
export function shapeMinH(shape: ShapeKind | undefined): number {
  return isLinearShape(shape) ? 0 : SHAPE_MIN_H;
}

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.min(Math.max(v, lo), hi);
}

/** Clamp a box to the bounds this shape allows. Used by edits and the sanitizer. */
export function clampShapeBox(
  shape: ShapeKind | undefined,
  w: number,
  h: number,
): { w: number; h: number } {
  return {
    w: clamp(w, SHAPE_MIN_W, SHAPE_MAX_W),
    h: clamp(h, shapeMinH(shape), SHAPE_MAX_H),
  };
}

/** Is this string a shape we know how to draw? Untrusted input comes through here. */
export function isShapeKind(v: unknown): v is ShapeKind {
  return typeof v === 'string' && (SHAPE_KINDS as readonly string[]).includes(v);
}

/**
 * A fresh shape node.
 *
 * The id is the caller's because the shell mints ids by scanning the live
 * topology (see freshAnnId in App.tsx): a counter in this module would hand
 * out an id a restored session already used, and two nodes sharing an id is a
 * collision the canvas cannot recover from.
 *
 * The label starts EMPTY. A blank box is what a whiteboard wants, and a
 * "Shape" caption on every rectangle would have to be deleted every time.
 */
export function makeShape(
  id: string,
  shape: ShapeKind,
  x: number,
  y: number,
  label = '',
): SimNode {
  const spec = SHAPE_SPECS[shape];
  return {
    id,
    kind: 'shape',
    label,
    x,
    y,
    shape,
    width: spec.defaultW,
    height: spec.defaultH,
    config: defaultConfig('shape'),
  };
}
