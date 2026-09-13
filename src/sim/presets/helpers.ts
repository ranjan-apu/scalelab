import type { NodeConfig, NodeKind, SimEdge, SimNode } from '../types';
import type { Note, Section } from '../annotations';
import { defaultConfig } from './defaults';

export { defaultConfig };

const DEFAULT_LABEL: Record<NodeKind, string> = {
  client: 'Client',
  producer: 'Event producer',
  lb: 'Load Balancer',
  service: 'Service',
  cache: 'Cache',
  db: 'Database',
  queue: 'Queue',
  worker: 'Worker',
  replica: 'Read Replicas',
  shard: 'Sharded Store',
  cdn: 'CDN',
  ratelimiter: 'Rate Limiter',
  breaker: 'Circuit Breaker',
  autoscaler: 'Autoscaler',
  region: 'Region',
  objectstore: 'Object Storage',
  searchindex: 'Search Index',
  timeseriesdb: 'Time-Series DB',
  graphdb: 'Graph Database',
  coldstorage: 'Cold Storage',
  vectordb: 'Vector Database',
  streambroker: 'Stream Broker',
  pubsub: 'Pub/Sub Topic',
  websocket: 'WebSocket Gateway',
  apigateway: 'API Gateway',
  sidecar: 'Sidecar Proxy',
  lambda: 'Lambda',
  cron: 'Cron Job',
  bulkhead: 'Bulkhead',
  retryqueue: 'Retry Queue',
  transcoder: 'Transcoder',
  edgecompute: 'Edge Compute',
  writebehind: 'Write-Behind Cache',
  loadshedder: 'Load Shedder',
  // Empty on purpose: a blank box is what a whiteboard wants, and this is the
  // label makeNode would use if a shape were ever built through makeNode.
  shape: '',
};

let nodeCounter = 0;

export function makeNode(
  kind: NodeKind,
  x: number,
  y: number,
  label?: string,
): SimNode {
  nodeCounter += 1;
  return {
    id: `${kind}-${nodeCounter}`,
    kind,
    label: label ?? DEFAULT_LABEL[kind],
    x,
    y,
    config: defaultConfig(kind),
  };
}

/* ------------------------------------------------------------------ *
 * Preset construction helpers
 * ------------------------------------------------------------------ */

export function node(
  id: string,
  kind: NodeKind,
  label: string,
  x: number,
  y: number,
  overrides: Partial<NodeConfig> = {},
  description?: string,
): SimNode {
  return {
    id,
    kind,
    label,
    x,
    y,
    config: { ...defaultConfig(kind), ...overrides },
    ...(description ? { description } : {}),
  };
}

export function edge(
  from: string,
  to: string,
  weight = 1,
  protocol?: import('../types').EdgeProtocol,
  edgeLabel?: string,
  sync?: boolean,
): SimEdge {
  return {
    id: `${from}->${to}`,
    from,
    to,
    weight,
    ...(protocol ? { protocol } : {}),
    ...(edgeLabel ? { edgeLabel } : {}),
    ...(sync !== undefined ? { sync } : {}),
  };
}

/**
 * A CONTROL edge: "`from` acts on `to`". Carries no requests -- the engine
 * leaves control edges out of every routing set -- and exists so a
 * supervisory relationship is stated in the topology rather than inferred
 * from a wire that looks exactly like a traffic path.
 */
export function control(from: string, to: string): SimEdge {
  return { id: `${from}->${to}`, from, to, weight: 1, control: true };
}

/* ================================================================== *
 * Grid geometry for the presets below.
 *
 * Canvas draws a node as NODE_W=184 x NODE_H=88 anchored at (x, y). A column
 * pitch of 260 leaves 76px of horizontal gutter for the edge to be visible,
 * and a row pitch of 130 leaves 42px vertically. Every preset places nodes on
 * COL(i) / ROW(j) so no two boxes can overlap by construction, and the
 * verifier asserts it rather than trusting the arithmetic.
 * ================================================================== */

const COL0 = 40;
const COL_PITCH = 260;
const ROW0 = 60;
const ROW_PITCH = 130;

/** x of grid column i (0-based), left-to-right. */
export const COL = (i: number) => COL0 + i * COL_PITCH;
/** y of grid row j (0-based), top-to-bottom. */
export const ROW = (j: number) => ROW0 + j * ROW_PITCH;

/* ================================================================== *
 * Annotation helpers for the presets below.
 *
 * These build the Section and Note literals directly rather than calling
 * makeSection/makeNote from annotations.ts, because those mint ids from a
 * mutating module counter. A preset's annotation ids would then depend on
 * module evaluation order, which is exactly the kind of thing that is stable
 * in a test run and different in a share link. Ids here are written down.
 *
 * The frame helpers take grid cells rather than pixels so a section is
 * described the way the layout is: "columns 0 to 3, rows 0 to 1". Sections
 * are padded evenly; the room that padding needs is bought at the lane
 * boundary by LANE_GAP rather than by squeezing the frames.
 * presets.annotations.test.ts asserts none of them collide.
 * ================================================================== */

const SEC_PAD_X = 28;
const SEC_PAD_T = 16;
const SEC_PAD_B = 16;

/**
 * Extra vertical space inserted at a lane boundary, on top of ROW_PITCH.
 *
 * Two stacked sections need NODE_H + pad + label plate + pad = 148px between
 * their row tops, and ROW_PITCH is 130. Without this the frames either touch
 * or the lower one's label plate lands inside the upper frame. Rather than
 * shaving the padding down until it fits (which is what made the first pass
 * look cramped), the layout gives the boundary the room it actually needs.
 */
const LANE_GAP = 64;

/** y of grid row j, pushed down by `lane` lane boundaries above it. */
export const LROW = (j: number, lane = 0) => ROW(j) + lane * LANE_GAP;

/**
 * A section framing grid cells c0..c1 by r0..r1 inclusive.
 *
 * `tight` drops the bottom padding to zero, freeing the row gutter for the
 * label plate of whatever section sits underneath.
 */
export function sectionOver(
  id: string,
  label: string,
  tone: number,
  c0: number,
  c1: number,
  r0: number,
  r1: number,
  lane = 0,
): Section {
  const x = COL(c0) - SEC_PAD_X;
  const y = LROW(r0, lane) - SEC_PAD_T;
  return {
    id,
    kind: 'section',
    label,
    x,
    y,
    width: COL(c1) + NODE_W + SEC_PAD_X - x,
    height: LROW(r1, lane) + NODE_H + SEC_PAD_B - y,
    tone,
  };
}

/**
 * A note at an explicit world point.
 *
 * Preset commentary renders in the studio sans so it reads as a typed
 * review note rather than as another label belonging to the diagram. Colour is left unset: a note with no colour follows the theme,
 * which is what keeps the examples legible when the palette changes.
 */
export function note(
  id: string,
  x: number,
  y: number,
  text: string,
  width = 220,
  size: Note['size'] = 'md',
  font: Note['font'] = 'sans',
): Note {
  return { id, kind: 'note', text, x, y, width, size, font };
}

/** Node box, mirrored from Canvas so the frame helpers can do arithmetic. */
export const NODE_W = 184;
export const NODE_H = 88;

/* ------------------------------------------------------------------ *
 * 6. CDN + Origin
 *    cdn:    256 slots / 2ms  -> effectively unbounded
 *    origin:   3 slots / 25ms -> 120 rps ceiling
 *    At hitRate 0.90 and 400 rps offered the origin sees ~40 rps: a third of
 *    its ceiling. At 4x it sees ~160 rps and is over the ceiling, which is
 *    the same collapse a student can trigger at 1x just by dragging the hit
 *    rate down -- the point being that the origin was never sized for the
 *    traffic the CDN was absorbing.
 * ------------------------------------------------------------------ */

