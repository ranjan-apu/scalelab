import { describe, expect, it } from 'vitest';
import { PRESETS } from './presets';

/**
 * Topology reuse allowlist.
 *
 * Two catalog entries may share one topology object only when the same
 * system genuinely tells both stories (auction IS the ticketmaster waiting
 * room; topk IS the leetcode leaderboard). photofeed once reused twitter
 * while promising blob uploads and edge delivery that twitter never had,
 * so accidental sharing now fails the build: add a new topology, or record
 * why the reuse is honest here.
 */
const HONEST_REUSE: Record<string, readonly string[]> = {
  ticketmasterTopology: ['auction', 'ticketmaster'],
  leetcodeTopology: ['leetcode', 'topk'],
  discord: ['discord', 'livefirehose'],
};

describe('preset topology reuse', () => {
  it('shares a topology object only when recorded as honest', () => {
    const byTopology = new Map<object, string[]>();
    for (const p of PRESETS) {
      const list = byTopology.get(p.topology) ?? [];
      list.push(p.id);
      byTopology.set(p.topology, list);
    }
    const allowed = new Set(Object.values(HONEST_REUSE).map((ids) => [...ids].sort().join('|')));
    for (const [topology, ids] of byTopology) {
      if (ids.length < 2) continue;
      const key = [...ids].sort().join('|');
      const varName =
        Object.entries(HONEST_REUSE).find(([, v]) => [...v].sort().join('|') === key)?.[0] ??
        '(unrecorded)';
      expect(
        allowed.has(key),
        `${varName} shared by ${key}: record it in HONEST_REUSE or give it its own topology`,
      ).toBe(true);
      expect(topology).toBeDefined();
    }
  });

  it('covers every honest-reuse entry with real presets', () => {
    const ids = new Set(PRESETS.map((p) => p.id));
    for (const [name, members] of Object.entries(HONEST_REUSE)) {
      expect(members.length, name).toBeGreaterThanOrEqual(2);
      for (const id of members) expect(ids.has(id), `${name} member ${id}`).toBe(true);
    }
  });
});
