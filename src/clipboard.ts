import type { NodeKind, SimEdge, SimNode, Topology } from './sim/types';
import { SHAPE_SPECS, clampShapeBox, isShapeKind } from './sim/shapes';
import { SECTION_TONE_COUNT, isSection, sanitizeAnnotations } from './sim/annotations';
import type { Annotation, Section } from './sim/annotations';
import { nodeH, nodeW } from './sim/nodeBox';

/* ------------------------------------------------------------------ *
 * Clipboard and duplication for the shell.
 *
 * One module owns the three operations that turn a selection into new
 * topology: serialising it for the system clipboard, validating whatever
 * comes back OFF the clipboard (untrusted by definition, exactly like a
 * share link), and stamping a subgraph with fresh ids so a duplicate or a
 * paste can never collide with a node that already exists.
 *
 * Everything here is pure data-in data-out, so the whole surface is unit
 * testable without a DOM.
 * ------------------------------------------------------------------ */

/**
 * Every kind the registry knows. This list gates what loads back out of
 * localStorage AND what is accepted from the clipboard, so every kind must
 * appear here or a student's saved or copied topology that uses it is
 * silently thrown away on restore.
 */
export const NODE_KINDS: readonly NodeKind[] = [
  'client',
  'producer',
  'lb',
  'service',
  'cache',
  'db',
  'queue',
  'worker',
  'replica',
  'shard',
  'autoscaler',
  'region',
  'cdn',
  'ratelimiter',
  'breaker',
  'objectstore',
  'searchindex',
  'timeseriesdb',
  'graphdb',
  'coldstorage',
  'vectordb',
  'streambroker',
  'pubsub',
  'websocket',
  'apigateway',
  'sidecar',
  'lambda',
  'cron',
  'bulkhead',
  'retryqueue',
  'transcoder',
  'edgecompute',
  'writebehind',
  'loadshedder',
  'shape',
];

/**
 * Structural validation of anything from outside the type system: a stored
 * session, a pasted clipboard payload. Every field the engine will
 * dereference is checked before it is trusted, and a dangling edge (which
 * would make the engine route into nothing) is rejected outright.
 */
export function isTopology(value: unknown): value is Topology {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as { nodes?: unknown; edges?: unknown };
  if (!Array.isArray(t.nodes) || !Array.isArray(t.edges)) return false;

  const ids = new Set<string>();
  for (const raw of t.nodes) {
    if (typeof raw !== 'object' || raw === null) return false;
    const n = raw as Partial<{
      id: unknown;
      kind: unknown;
      label: unknown;
      x: unknown;
      y: unknown;
      config: unknown;
      description?: unknown;
      shape?: unknown;
      width?: unknown;
      height?: unknown;
      tone?: unknown;
      flipX?: unknown;
      flipY?: unknown;
    }>;
    if (typeof n.id !== 'string' || n.id === '') return false;
    if (typeof n.label !== 'string') return false;
    if (n.description !== undefined && typeof n.description !== 'string') return false;
    if (!NODE_KINDS.includes(n.kind as NodeKind)) return false;
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) return false;
    if (typeof n.config !== 'object' || n.config === null) return false;
    // A shape's geometry is TYPED here and BOUNDED in sanitizeTopology. The
    // split is deliberate: an out-of-range width is recoverable (clamp it),
    // while a non-numeric one means the payload is not a topology at all.
    if (n.shape !== undefined && typeof n.shape !== 'string') return false;
    if (n.width !== undefined && !Number.isFinite(n.width)) return false;
    if (n.height !== undefined && !Number.isFinite(n.height)) return false;
    if (n.tone !== undefined && !Number.isFinite(n.tone)) return false;
    if (n.flipX !== undefined && typeof n.flipX !== 'boolean') return false;
    if (n.flipY !== undefined && typeof n.flipY !== 'boolean') return false;
    const cfg = n.config as Record<string, unknown>;
    for (const key of [
      'capacity',
      'serviceMs',
      'serviceCv',
      'queueLimit',
      'hitRate',
      'errorRate',
      'timeoutMs',
      'retries',
      'rps',
    ]) {
      if (!Number.isFinite(cfg[key])) return false;
    }
    if (ids.has(n.id)) return false;
    ids.add(n.id);
  }

  for (const raw of t.edges) {
    if (typeof raw !== 'object' || raw === null) return false;
    const e = raw as Partial<{
      id: unknown;
      from: unknown;
      to: unknown;
      weight: unknown;
    }>;
    if (typeof e.id !== 'string' || e.id === '') return false;
    if (typeof e.from !== 'string' || typeof e.to !== 'string') return false;
    if (!ids.has(e.from) || !ids.has(e.to)) return false;
    if (!Number.isFinite(e.weight)) return false;
  }

  return true;
}

/**
 * Bound a topology's shape geometry.
 *
 * `isTopology` answers "is this the right SHAPE of data"; this answers "is it
 * sane". They are kept apart because they fail differently. A payload that is
 * not a topology at all must be rejected outright, but a topology carrying one
 * absurd box should still open: refusing the whole design because a stale
 * share link had a width of 1e9 would throw away work that is otherwise fine.
 *
 * Two jobs, both about the whiteboard layer:
 *
 *  - a shape's box is CLAMPED, and an unrecognised `shape` falls back to a
 *    plain rectangle rather than reaching the renderer as a body it cannot
 *    draw (which would paint nothing and leave an invisible, unselectable
 *    node on the canvas);
 *  - geometry found on a COMPONENT is stripped. The interface cannot produce
 *    that, and honouring it would draw a component whose body no longer
 *    matches the fixed-size internals drawn on it (header band, meter,
 *    readout), so it is corruption rather than a legitimate variant.
 *
 * Every boundary that accepts a topology from outside calls this beside
 * `sanitizeAnnotations`: localStorage (session and saved designs), an
 * imported file, a share link, and the clipboard.
 */
export function sanitizeTopology(t: Topology): Topology {
  let changed = false;

  const nodes = t.nodes.map((n): SimNode => {
    const hasGeometry =
      n.shape !== undefined ||
      n.width !== undefined ||
      n.height !== undefined ||
      n.tone !== undefined ||
      n.flipX !== undefined ||
      n.flipY !== undefined;
    if (!hasGeometry) return n;

    if (n.kind !== 'shape') {
      changed = true;
      const { shape, width, height, tone, flipX, flipY, ...rest } = n;
      void shape;
      void width;
      void height;
      void tone;
      void flipX;
      void flipY;
      return rest;
    }

    const shape = isShapeKind(n.shape) ? n.shape : undefined;
    const spec = SHAPE_SPECS[shape ?? 'rect'];
    const box = clampShapeBox(shape, n.width ?? spec.defaultW, n.height ?? spec.defaultH);
    const tone = Number.isFinite(n.tone)
      ? ((Math.floor(n.tone as number) % SECTION_TONE_COUNT) + SECTION_TONE_COUNT) %
        SECTION_TONE_COUNT
      : undefined;

    if (
      shape === n.shape &&
      box.w === n.width &&
      box.h === n.height &&
      tone === n.tone
    ) {
      return n;
    }

    changed = true;
    const next: SimNode = { ...n };
    if (shape) next.shape = shape;
    else delete next.shape;
    next.width = box.w;
    next.height = box.h;
    if (tone === undefined) delete next.tone;
    else next.tone = tone;
    return next;
  });

  return changed ? { ...t, nodes } : t;
}

/**
 * What one copy operation carries: a self-contained subgraph.
 *
 * Annotations travel with the nodes because a SECTION is the frame around a
 * group of them and copying the frame without its contents (or the contents
 * without their frame) is not a copy of what the user selected. Everything
 * else that is seriously placed — a note, a text box, a stroke — rides along
 * the same way, selected outright or inside a copied section.
 */
export interface ClipboardSubgraph {
  nodes: SimNode[];
  edges: SimEdge[];
  annotations: Annotation[];
}

/** The box an annotation occupies, as far as the copy rule needs to know it. */
function annBox(a: Annotation): { x: number; y: number; w: number; h: number } {
  switch (a.kind) {
    case 'section':
    case 'textbox':
      return { x: a.x, y: a.y, w: a.width, h: a.height };
    case 'note':
      // Height follows the wrapped text and is deliberately never stored, so
      // the note is judged on its top edge and its full wrap width: a note
      // that starts inside the frame belongs to it even if the last line
      // overhangs the border.
      return { x: a.x, y: a.y, w: a.width, h: 0 };
    case 'ink':
      // The stroke's extent is derived from its samples; its origin is the
      // anchor, which is what a grouping decision can honestly test here.
      return { x: a.x, y: a.y, w: 0, h: 0 };
  }
}

/**
 * The ids a copy or a cut actually carries, with selected sections expanded
 * to what stands inside them.
 *
 * A section is SPATIAL: it does not own the nodes drawn in it and nothing is
 * reparented (see annotations.ts), so "copy the section" can only mean "copy
 * the frame AND everything standing in it", resolved from the geometry as it
 * stands at that moment. That is the same rule, and the same reasoning, as a
 * section DRAG (Canvas.tsx), which is what keeps the two gestures from
 * disagreeing about what a section contains.
 *
 * A node counts as inside only when its whole box is inside — the drag's
 * rule: a node that merely clips the frame's edge is not part of it, and
 * hauling it along is the kind of surprise that makes a person distrust the
 * tool. Nested frames and annotations inside come along on the same test.
 */
export function expandSectionSelection(
  topology: Topology,
  selectedIds: ReadonlySet<string>,
): Set<string> {
  const out = new Set(selectedIds);
  const anns = topology.annotations ?? [];
  const frames = anns.filter(
    (a): a is Section => selectedIds.has(a.id) && isSection(a),
  );
  if (frames.length === 0) return out;

  const inside = (box: { x: number; y: number; w: number; h: number }): boolean =>
    frames.some(
      (s) =>
        box.x >= s.x &&
        box.y >= s.y &&
        box.x + box.w <= s.x + s.width &&
        box.y + box.h <= s.y + s.height,
    );

  for (const n of topology.nodes) {
    if (!out.has(n.id) && inside({ x: n.x, y: n.y, w: nodeW(n), h: nodeH(n) })) {
      out.add(n.id);
    }
  }
  for (const a of anns) {
    if (!out.has(a.id) && inside(annBox(a))) out.add(a.id);
  }
  return out;
}

/**
 * The selected nodes and annotations plus the edges BETWEEN the nodes.
 *
 * An edge to something outside the selection is dropped: a pasted subgraph
 * must be self-contained, and a wire whose far end is a node the clipboard
 * does not carry would either dangle (rejected by validation) or grab some
 * unrelated node that happens to share an id in the receiving document.
 * Returns null when the selection holds nothing placeable; a lone edge cannot
 * be pasted into anything.
 */
export function selectionSubgraph(
  topology: Topology,
  selectedIds: ReadonlySet<string>,
): ClipboardSubgraph | null {
  const ids = expandSectionSelection(topology, selectedIds);
  const nodes = topology.nodes.filter((n) => ids.has(n.id));
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = topology.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
  const annotations = (topology.annotations ?? []).filter((a) => ids.has(a.id));
  if (nodes.length === 0 && annotations.length === 0) return null;
  return {
    nodes: structuredClone(nodes),
    edges: structuredClone(edges),
    annotations: structuredClone(annotations),
  };
}

/**
 * Serialise a selection for the system clipboard. Plain JSON with a marker
 * field, so a paste in a text editor shows something legible and a paste
 * back here has a cheap first check before the structural one.
 */
export function buildClipboardText(
  topology: Topology,
  selectedIds: ReadonlySet<string>,
): string | null {
  const sub = selectionSubgraph(topology, selectedIds);
  if (!sub) return null;
  return JSON.stringify({
    app: 'scalelab',
    nodes: sub.nodes,
    edges: sub.edges,
    annotations: sub.annotations,
  });
}

/**
 * Parse clipboard text back into a subgraph. The clipboard is an untrusted
 * input channel exactly the way a share link is: anything can be on it, so
 * this validates the same way loadSession validates localStorage and
 * returns null for whatever does not hold up. It NEVER throws; a paste of
 * prose or of someone else's JSON is a silent no-op, not a crash.
 *
 * Annotations are sanitised rather than structurally rejected, matching
 * every other boundary that accepts them (a share link, an imported file):
 * one malformed note is dropped while the nodes beside it still paste.
 */
export function parseClipboardText(text: string): ClipboardSubgraph | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const p = parsed as { nodes?: unknown; edges?: unknown; annotations?: unknown };
  const candidate = { nodes: p.nodes, edges: p.edges };
  if (!isTopology(candidate)) return null;
  const topology = sanitizeTopology(candidate);
  return {
    nodes: topology.nodes,
    edges: topology.edges,
    annotations: sanitizeAnnotations(p.annotations),
  };
}

/**
 * An id of the same `kind-N` shape makeNode mints, guaranteed unused.
 *
 * Scanned against the live topology rather than a counter, because ids on
 * the clipboard may come from another tab whose counter this session never
 * saw, and a collision would silently merge two different nodes.
 */
function freshId(kind: NodeKind, used: Set<string>): string {
  let n = 1;
  while (used.has(`${kind}-${n}`)) n += 1;
  const id = `${kind}-${n}`;
  used.add(id);
  return id;
}

/**
 * The same guarantee for an annotation, whose ids are prefixed by their kind
 * (`note-1`, `section-2`) rather than minted by makeNode.
 */
function freshAnnotationId(kind: Annotation['kind'], used: Set<string>): string {
  let n = 1;
  while (used.has(`${kind}-${n}`)) n += 1;
  const id = `${kind}-${n}`;
  used.add(id);
  return id;
}

/**
 * Stamp a subgraph with fresh ids and an offset, ready to append to a
 * topology. Every internal edge is remapped to the new node ids and takes
 * the `from->to` id shape the rest of the app uses; config, label, weight
 * and the control flag all carry over. Annotations keep their relative
 * position to the nodes — a copied section still frames the copies of the
 * components that stood in it. Used by Ctrl+D, alt-drag duplicate and paste,
 * so the three can never disagree about what a copy contains.
 */
export function cloneSubgraph(
  sub: ClipboardSubgraph,
  topology: Topology,
  dx: number,
  dy: number,
): ClipboardSubgraph {
  const used = new Set<string>();
  for (const n of topology.nodes) used.add(n.id);
  for (const a of topology.annotations ?? []) used.add(a.id);
  const idMap = new Map<string, string>();

  const nodes = sub.nodes.map((n) => {
    const id = freshId(n.kind, used);
    idMap.set(n.id, id);
    return {
      ...structuredClone(n),
      id,
      x: n.x + dx,
      y: n.y + dy,
    };
  });

  const edges: SimEdge[] = [];
  for (const e of sub.edges) {
    const from = idMap.get(e.from);
    const to = idMap.get(e.to);
    if (!from || !to) continue;
    edges.push({ ...structuredClone(e), id: `${from}->${to}`, from, to });
  }

  const annotations = sub.annotations.map((a) => ({
    ...structuredClone(a),
    id: freshAnnotationId(a.kind, used),
    x: a.x + dx,
    y: a.y + dy,
  }));

  return { nodes, edges, annotations };
}
