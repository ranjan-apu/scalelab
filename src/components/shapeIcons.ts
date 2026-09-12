import type { ShapeKind } from '../sim/types';

/**
 * The whiteboard library's icons: one drawing per shape body.
 *
 * Lives outside both consumers (the rail's tiles and the inspector's shape
 * picker) for the reason nodeVisuals.ts gives for its own icons: a module that
 * exports only constants can be imported by a component without breaking React
 * Fast Refresh, and two copies of these paths is how the picker ends up showing
 * a different shape from the one the tile places.
 *
 * Each one is the geometry its shape puts on the canvas, drawn in the 24-box
 * the icon set uses: picking a tile means "give me that outline", so the
 * outline IS the label. Stroked, never filled -- the surrounding container
 * supplies currentColor and the stroke weight, exactly as KIND_ICON does.
 */
export const SHAPE_ICONS: Record<ShapeKind, string[]> = {
  rect: ['M4 5h16v14H4z'],
  roundrect: ['M7 5h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z'],
  ellipse: ['M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7z'],
  diamond: ['M12 3l9 9-9 9-9-9z'],
  triangle: ['M12 4l8 15H4z'],
  hexagon: ['M8 5h8l4 7-4 7H8l-4-7z'],
  parallelogram: ['M9 5h11l-5 14H4z'],
  cylinder: [
    'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z',
    'M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7',
  ],
  line: ['M4 20 20 4'],
  arrow: ['M4 20 20 4', 'M14 4h6v6'],
};
