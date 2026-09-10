import { describe, expect, it } from 'vitest';
import { billableUnits, formatUsdPerMo, KIND_COSTS, topologyCost } from './costs';
import { ALL_NODE_KINDS } from '../content/preferences';
import type { Topology } from './types';
import { makeNode } from './presets';

describe('cost model', () => {
  it('covers every component kind', () => {
    for (const kind of ALL_NODE_KINDS) {
      expect(KIND_COSTS[kind], kind).toBeDefined();
      expect(KIND_COSTS[kind]!.usdPerMo).toBeGreaterThanOrEqual(0);
    }
  });

  it('an empty canvas costs nothing and bills nothing', () => {
    const cost = topologyCost({ nodes: [], edges: [] });
    expect(cost.totalUsdPerMo).toBe(0);
    expect(cost.lines).toHaveLength(0);
    expect(cost.unbilledComponents).toBe(0);
  });

  it('sums instances across components of a kind', () => {
    const a = makeNode('service', 0, 0);
    const b = makeNode('service', 100, 100);
    a.config.instances = 2;
    b.config.instances = 3;
    const topo: Topology = { nodes: [a, b], edges: [] };
    const cost = topologyCost(topo);
    expect(cost.lines).toHaveLength(1);
    expect(cost.lines[0]!.units).toBe(5);
    expect(cost.totalUsdPerMo).toBe(5 * KIND_COSTS.service.usdPerMo);
  });

  it('treats policies and patterns as unbilled, not free', () => {
    const breaker = makeNode('breaker', 0, 0);
    const cost = topologyCost({ nodes: [breaker], edges: [] });
    expect(cost.totalUsdPerMo).toBe(0);
    expect(cost.lines).toHaveLength(0);
    expect(cost.unbilledComponents).toBe(1);
  });

  it('sorts lines by spend, descending', () => {
    const topo: Topology = {
      nodes: [makeNode('cron', 0, 0), makeNode('db', 100, 100)],
      edges: [],
    };
    const cost = topologyCost(topo);
    expect(cost.lines[0]!.kind).toBe('db');
  });

  it('billable units floor at one', () => {
    expect(billableUnits(undefined)).toBe(1);
    expect(billableUnits(0)).toBe(1);
    expect(billableUnits(2.7)).toBe(2);
  });

  it('formats whole dollars grouped', () => {
    expect(formatUsdPerMo(2480)).toBe('$2,480');
    expect(formatUsdPerMo(0)).toBe('$0');
  });
});
