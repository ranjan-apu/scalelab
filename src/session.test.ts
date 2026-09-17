// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Topology } from './sim/types';
import { makeNode } from './sim/presets';
import { PLAYGROUND_STEPS, emptyPlayground } from './sim/playground';
import {
  SESSION_KEY,
  SESSION_TITLE_MAX,
  cleanSessionTitle,
  loadSession,
  saveSession,
} from './session';

/**
 * The autosaved session is the thing standing between a student and losing
 * twenty minutes to an accidental refresh. Most of what follows is about
 * the trip there and back: a design saved one moment must come back the
 * next with its components, connections, notes and title intact, and
 * anything storage hands back that is not a design must turn into an empty
 * studio rather than a broken boot.
 */

function makeTopology(): Topology {
  const client = makeNode('client', 0, 0);
  const svc = makeNode('service', 200, 0);
  return {
    nodes: [client, svc],
    edges: [{ id: `${client.id}->${svc.id}`, from: client.id, to: svc.id, weight: 1 }],
    annotations: [
      {
        id: 'note-1',
        kind: 'note',
        text: 'Watch the queue in front of the service.',
        x: 0,
        y: 180,
        width: 260,
        size: 'md',
        font: 'serif',
        bold: true,
      },
    ],
  };
}

beforeEach(() => localStorage.clear());

describe('autosave round trip (the refresh case)', () => {
  it('restores components, connections and notes after a refresh', () => {
    const topo = makeTopology();
    saveSession({ topology: topo, rps: 120, presetId: null, title: 'My design' });

    // A refresh is a fresh JS heap reading the same shelf.
    const back = loadSession();
    expect(back.topology.nodes).toHaveLength(2);
    expect(back.topology.edges).toHaveLength(1);
    expect(back.topology.annotations).toHaveLength(1);
    expect(back.rps).toBe(120);
    expect(back.title).toBe('My design');
  });

  it('restores the architecture title, so a refresh keeps the rename', () => {
    saveSession({
      topology: makeTopology(),
      rps: 50,
      presetId: null,
      title: 'Checkout v2',
    });
    expect(loadSession().title).toBe('Checkout v2');
  });

  it('carries the practice sheet through, since it is half the work', () => {
    const topo = makeTopology();
    const playground = emptyPlayground();
    playground.steps[PLAYGROUND_STEPS[0]!.id] = 'Some thinking';
    topo.playground = playground;
    saveSession({ topology: topo, rps: 50, presetId: 'netflix', title: null });

    const back = loadSession();
    expect(back.presetId).toBe('netflix');
    expect(back.topology.playground?.steps[PLAYGROUND_STEPS[0]!.id]).toBe(
      'Some thinking',
    );
  });

  it('does not alias the live topology', () => {
    // Saving must take effect through the serialised copy: editing the
    // canvas afterwards must not rewrite what is on the shelf, which is
    // the whole point of saving it.
    const live = makeTopology();
    saveSession({ topology: live, rps: 50, presetId: null, title: null });
    live.nodes[0]!.label = 'CHANGED AFTER SAVING';
    expect(loadSession().topology.nodes[0]!.label).not.toBe('CHANGED AFTER SAVING');
  });
});

describe('surviving storage', () => {
  it('boots an empty studio on first run', () => {
    const back = loadSession();
    expect(back.topology.nodes).toHaveLength(0);
    expect(back.presetId).toBeNull();
    expect(back.title).toBeNull();
  });

  it('boots an empty studio on corrupt JSON rather than throwing', () => {
    localStorage.setItem(SESSION_KEY, '{not json');
    expect(() => loadSession()).not.toThrow();
    expect(loadSession().topology.nodes).toHaveLength(0);
  });

  it('drops a topology the engine could not run instead of half-restoring it', () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        topology: { nodes: [{ id: 'x' }], edges: [] },
        rps: 50,
        presetId: null,
        title: 'Broken',
      }),
    );
    const back = loadSession();
    expect(back.topology.nodes).toHaveLength(0);
    expect(back.title).toBeNull();
  });

  it('reads saves written before the title existed', () => {
    // Backward compatibility: the shelf outlives any one release.
    const topo = makeTopology();
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ topology: topo, rps: 50, presetId: 'netflix' }),
    );
    const back = loadSession();
    expect(back.topology.nodes).toHaveLength(2);
    expect(back.presetId).toBe('netflix');
    expect(back.title).toBeNull();
  });

  it('drops malformed notes but keeps the components', () => {
    const topo = makeTopology() as unknown as Record<string, unknown>;
    topo.annotations = [{ id: 'nope' }, ...(makeTopology().annotations ?? [])];
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ topology: topo, rps: 50, presetId: null, title: null }),
    );
    const back = loadSession();
    expect(back.topology.nodes).toHaveLength(2);
    expect(back.topology.annotations).toHaveLength(1);
  });

  it('clamps an out-of-range rps rather than restoring it', () => {
    saveSession({ topology: makeTopology(), rps: 99999, presetId: null, title: null });
    expect(loadSession().rps).toBe(5000);
    saveSession({ topology: makeTopology(), rps: -10, presetId: null, title: null });
    expect(loadSession().rps).toBe(0);
  });

  it('never throws when storage is blocked or full', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    try {
      expect(() =>
        saveSession({ topology: makeTopology(), rps: 50, presetId: null, title: null }),
      ).not.toThrow();
    } finally {
      setItem.mockRestore();
    }
  });
});

describe('cleanSessionTitle', () => {
  it('trims whitespace-only titles to null', () => {
    expect(cleanSessionTitle('   ')).toBeNull();
    expect(cleanSessionTitle(42)).toBeNull();
    expect(cleanSessionTitle(null)).toBeNull();
  });

  it('trims a title that would be a paragraph', () => {
    expect(cleanSessionTitle(`  ${'x'.repeat(SESSION_TITLE_MAX + 40)}  `)).toHaveLength(
      SESSION_TITLE_MAX,
    );
  });
});
