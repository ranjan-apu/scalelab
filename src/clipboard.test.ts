import { describe, expect, it } from 'vitest';
import {
  buildClipboardText,
  cloneSubgraph,
  expandSectionSelection,
  isTopology,
  parseClipboardText,
  selectionSubgraph,
} from './clipboard';
import type { Topology, NodeConfig, SimNode } from './sim/types';
import type { Note, Section } from './sim/annotations';

/* ------------------------------------------------------------------ *
 * Fixtures. A three-node chain with one edge inside a would-be selection
 * and one crossing its boundary, which is exactly the shape the
 * edge-dropping rule exists for.
 * ------------------------------------------------------------------ */

const CONFIG: NodeConfig = {
  capacity: 8,
  serviceMs: 25,
  serviceCv: 0.6,
  queueLimit: 64,
  hitRate: 0,
  errorRate: 0,
  timeoutMs: 0,
  retries: 0,
  rps: 0,
  instances: 1,
  replicaCount: 3,
  replicationLagMs: 50,
  readFraction: 0.9,
  shardCount: 4,
  shardCapacity: 4,
  hotKeyFraction: 0,
};

function node(id: string, x = 0, y = 0): SimNode {
  return { id, kind: 'service', label: id, x, y, config: { ...CONFIG } };
}

function topo(): Topology {
  return {
    nodes: [
      node('service-1', 0, 0),
      node('service-2', 240, 0),
      node('service-3', 480, 0),
    ],
    edges: [
      { id: 'service-1->service-2', from: 'service-1', to: 'service-2', weight: 1 },
      { id: 'service-2->service-3', from: 'service-2', to: 'service-3', weight: 1 },
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Section fixtures. A frame wide enough to hold the first two nodes of
 * the chain with room to spare, a third node parked well outside it, and
 * an edge that crosses the frame's border. That is exactly the shape the
 * "a section takes its contents" rule has to get right.
 * ------------------------------------------------------------------ */

const FRAME: Section = {
  id: 'section-1',
  kind: 'section',
  label: 'Edge tier',
  x: -40,
  y: -40,
  width: 560,
  height: 200,
  tone: 2,
};

function framed(): Topology {
  const t = topo();
  t.nodes[2] = node('service-3', 900, 0);
  t.annotations = [{ ...FRAME }];
  return t;
}

describe('expandSectionSelection', () => {
  it('collects what stands inside the frame and leaves the rest', () => {
    const ids = expandSectionSelection(framed(), new Set(['section-1']));
    expect(ids.has('section-1')).toBe(true);
    expect(ids.has('service-1')).toBe(true);
    expect(ids.has('service-2')).toBe(true);
    // service-3 is nowhere near the frame.
    expect(ids.has('service-3')).toBe(false);
  });

  it('is containment, not intersection: a node clipping the border stays out', () => {
    const t = framed();
    // Half in, half out of the frame's right edge.
    t.nodes[2] = node('service-3', FRAME.x + FRAME.width - 40, 0);
    const ids = expandSectionSelection(t, new Set(['section-1']));
    expect(ids.has('service-3')).toBe(false);
  });

  it('carries annotations that start inside, and nested frames too', () => {
    const t = framed();
    const note: Note = {
      id: 'note-1',
      kind: 'note',
      text: 'reads peak here',
      x: 40,
      y: 100,
      width: 160,
      size: 'sm',
    };
    const inner: Section = {
      id: 'section-2',
      kind: 'section',
      label: 'cache tier',
      x: 200,
      y: 20,
      width: 240,
      height: 120,
      tone: 5,
    };
    t.annotations = [t.annotations![0]!, note, inner];
    const ids = expandSectionSelection(t, new Set(['section-1']));
    expect(ids.has('note-1')).toBe(true);
    expect(ids.has('section-2')).toBe(true);
  });

  it('is a no-op when nothing selected is a section', () => {
    const ids = expandSectionSelection(framed(), new Set(['service-1']));
    expect([...ids]).toEqual(['service-1']);
  });
});

describe('selectionSubgraph with a section', () => {
  it('returns the frame with the components standing in it', () => {
    const sub = selectionSubgraph(framed(), new Set(['section-1']))!;
    expect(sub).not.toBeNull();
    expect(sub.annotations.map((a) => a.id)).toEqual(['section-1']);
    expect(sub.nodes.map((n) => n.id)).toEqual(['service-1', 'service-2']);
    // The edge between the two picked-up nodes travels; the one leaving the
    // frame does not.
    expect(sub.edges.map((e) => e.id)).toEqual(['service-1->service-2']);
  });

  it('carries a frame with no contents at all', () => {
    const t = topo();
    // Empty in the literal sense: the frame is off where nothing stands, so
    // copying it is a copy of the frame alone.
    t.annotations = [{ ...FRAME, x: 2000, y: 2000 }];
    const sub = selectionSubgraph(t, new Set(['section-1']));
    expect(sub).not.toBeNull();
    expect(sub!.nodes).toEqual([]);
    expect(sub!.annotations.map((a) => a.id)).toEqual(['section-1']);
  });

  it('copies a lone annotation, which the old node-only path refused', () => {
    const t = topo();
    const note: Note = {
      id: 'note-1',
      kind: 'note',
      text: 'hello',
      x: 0,
      y: 0,
      width: 160,
      size: 'md',
    };
    t.annotations = [note];
    const sub = selectionSubgraph(t, new Set(['note-1']));
    expect(sub).not.toBeNull();
    expect(sub!.nodes).toEqual([]);
    expect(sub!.annotations.map((a) => a.id)).toEqual(['note-1']);
  });
});

describe('clipboard round trip with a section', () => {
  it('serialises annotations and returns them sanitised', () => {
    const text = buildClipboardText(framed(), new Set(['section-1']))!;
    expect(text).not.toBeNull();
    expect(JSON.parse(text).annotations).toHaveLength(1);
    const back = parseClipboardText(text)!;
    expect(back.nodes.map((n) => n.id)).toEqual(['service-1', 'service-2']);
    expect(back.annotations).toHaveLength(1);
    expect(back.annotations[0]).toMatchObject({ id: 'section-1', kind: 'section' });
  });

  it('drops a malformed annotation without losing the nodes beside it', () => {
    const payload = JSON.stringify({
      app: 'scalelab',
      nodes: [node('service-1')],
      edges: [],
      // No geometry: nothing can be drawn, so it is dropped rather than
      // allowed through to the renderer.
      annotations: [{ id: 'section-9', kind: 'section' }],
    });
    const back = parseClipboardText(payload);
    expect(back).not.toBeNull();
    expect(back!.nodes).toHaveLength(1);
    expect(back!.annotations).toEqual([]);
  });

  it('ignores a payload whose annotations field is not an array', () => {
    const payload = JSON.stringify({
      app: 'scalelab',
      nodes: [node('service-1')],
      edges: [],
      annotations: 'nonsense',
    });
    expect(parseClipboardText(payload)!.annotations).toEqual([]);
  });
});

describe('selectionSubgraph', () => {
  it('keeps edges between selected nodes and drops boundary-crossing ones', () => {
    const sub = selectionSubgraph(topo(), new Set(['service-1', 'service-2']));
    expect(sub).not.toBeNull();
    expect(sub!.nodes.map((n) => n.id)).toEqual(['service-1', 'service-2']);
    // service-2->service-3 crosses out of the selection and must not travel.
    expect(sub!.edges.map((e) => e.id)).toEqual(['service-1->service-2']);
  });

  it('returns null for a selection with no nodes', () => {
    expect(selectionSubgraph(topo(), new Set())).toBeNull();
    // A lone edge id is not a pasteable thing either.
    expect(selectionSubgraph(topo(), new Set(['service-1->service-2']))).toBeNull();
  });

  it('returns copies, not references into the topology', () => {
    const t = topo();
    const sub = selectionSubgraph(t, new Set(['service-1']))!;
    sub.nodes[0]!.x = 999;
    sub.nodes[0]!.config.capacity = 999;
    expect(t.nodes[0]!.x).toBe(0);
    expect(t.nodes[0]!.config.capacity).toBe(8);
  });
});

describe('clipboard round trip', () => {
  it('serialises and parses back the same subgraph', () => {
    const text = buildClipboardText(topo(), new Set(['service-1', 'service-2']));
    expect(text).not.toBeNull();
    const back = parseClipboardText(text!);
    expect(back).not.toBeNull();
    expect(back!.nodes.map((n) => n.id)).toEqual(['service-1', 'service-2']);
    expect(back!.edges.map((e) => e.id)).toEqual(['service-1->service-2']);
  });

  it('returns null rather than throwing on garbage', () => {
    // The paste path is untrusted input; none of these may throw.
    expect(parseClipboardText('not json at all')).toBeNull();
    expect(parseClipboardText('')).toBeNull();
    expect(parseClipboardText('42')).toBeNull();
    expect(parseClipboardText('"a string"')).toBeNull();
    expect(parseClipboardText('{"totally":"unrelated"}')).toBeNull();
    expect(parseClipboardText('[1,2,3]')).toBeNull();
  });

  it('rejects structurally invalid payloads', () => {
    // A node of an unknown kind.
    const badKind = JSON.stringify({
      nodes: [{ ...node('x-1'), kind: 'mainframe' }],
      edges: [],
    });
    expect(parseClipboardText(badKind)).toBeNull();

    // An edge pointing at a node the payload does not carry.
    const dangling = JSON.stringify({
      nodes: [node('service-1')],
      edges: [{ id: 'service-1->ghost', from: 'service-1', to: 'ghost', weight: 1 }],
    });
    expect(parseClipboardText(dangling)).toBeNull();

    // A config field replaced with something non-numeric.
    const brokenCfg = node('service-1');
    (brokenCfg.config as unknown as Record<string, unknown>).capacity = 'lots';
    expect(
      parseClipboardText(JSON.stringify({ nodes: [brokenCfg], edges: [] })),
    ).toBeNull();

    // NaN and Infinity do not survive JSON, but a hand-built payload could
    // hold null in a numeric slot.
    const nullX = { ...node('service-1'), x: null };
    expect(
      parseClipboardText(JSON.stringify({ nodes: [nullX], edges: [] })),
    ).toBeNull();
  });

  it('isTopology rejects duplicate node ids', () => {
    expect(
      isTopology({ nodes: [node('service-1'), node('service-1')], edges: [] }),
    ).toBe(false);
  });
});

describe('cloneSubgraph', () => {
  it('mints ids that collide with nothing in the topology', () => {
    const t = topo();
    const sub = selectionSubgraph(t, new Set(['service-1', 'service-2']))!;
    const clones = cloneSubgraph(sub, t, 16, 16);
    const existing = new Set(t.nodes.map((n) => n.id));
    for (const n of clones.nodes) {
      expect(existing.has(n.id)).toBe(false);
      expect(n.kind).toBe('service');
    }
    // The two fresh ids must also differ from each other.
    expect(new Set(clones.nodes.map((n) => n.id)).size).toBe(2);
  });

  it('remaps internal edges to the fresh ids and keeps the id shape', () => {
    const t = topo();
    const sub = selectionSubgraph(t, new Set(['service-1', 'service-2']))!;
    const clones = cloneSubgraph(sub, t, 0, 0);
    expect(clones.edges).toHaveLength(1);
    const e = clones.edges[0]!;
    const ids = clones.nodes.map((n) => n.id);
    expect(ids).toContain(e.from);
    expect(ids).toContain(e.to);
    expect(e.id).toBe(`${e.from}->${e.to}`);
    expect(e.weight).toBe(1);
  });

  it('applies the offset and carries config and label over', () => {
    const t = topo();
    t.nodes[0]!.label = 'checkout';
    t.nodes[0]!.config.capacity = 42;
    const sub = selectionSubgraph(t, new Set(['service-1']))!;
    const clones = cloneSubgraph(sub, t, 16, 24);
    expect(clones.nodes[0]!.x).toBe(16);
    expect(clones.nodes[0]!.y).toBe(24);
    expect(clones.nodes[0]!.label).toBe('checkout');
    expect(clones.nodes[0]!.config.capacity).toBe(42);
    // And the clone's config is its own object, not shared with the source.
    clones.nodes[0]!.config.capacity = 1;
    expect(t.nodes[0]!.config.capacity).toBe(42);
  });

  it('never trusts ids arriving from a foreign clipboard', () => {
    // A payload whose ids ALREADY exist here (copied from another tab).
    const t = topo();
    const foreign = {
      nodes: [node('service-1', 100, 100)],
      edges: [],
      annotations: [],
    };
    const clones = cloneSubgraph(foreign, t, 0, 0);
    expect(clones.nodes[0]!.id).not.toBe('service-1');
    expect(t.nodes.some((n) => n.id === clones.nodes[0]!.id)).toBe(false);
  });

  it('preserves node order, so callers may map source i to clone i', () => {
    const t = topo();
    const sub = selectionSubgraph(t, new Set(['service-1', 'service-3']))!;
    const clones = cloneSubgraph(sub, t, 0, 0);
    expect(clones.nodes.map((n) => n.x)).toEqual(sub.nodes.map((n) => n.x));
  });

  it('mints fresh annotation ids and offsets the frame with its nodes', () => {
    const t = framed();
    const sub = selectionSubgraph(t, new Set(['section-1']))!;
    const clones = cloneSubgraph(sub, t, 32, 16);
    expect(clones.annotations).toHaveLength(1);
    const frame = clones.annotations[0]!;
    expect(frame.kind).toBe('section');
    expect(frame.id).not.toBe('section-1');
    expect(t.annotations!.some((a) => a.id === frame.id)).toBe(false);
    // The frame moves by the same delta as the nodes it holds, so the copy
    // still frames its own contents.
    expect(frame.x).toBe(FRAME.x + 32);
    expect(frame.y).toBe(FRAME.y + 16);
    expect(clones.nodes[0]!.x).toBe(sub.nodes[0]!.x + 32);
  });

  it('collides with nothing when the payload arrives carrying live ids', () => {
    const t = framed();
    // The same frame, straight off a foreign clipboard: its id already exists
    // here, so the clone must not reuse it.
    const foreign = { nodes: [], edges: [], annotations: [{ ...FRAME }] };
    const clones = cloneSubgraph(foreign, t, 0, 0);
    expect(clones.annotations[0]!.id).not.toBe('section-1');
  });
});
