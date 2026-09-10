import { describe, expect, it } from 'vitest';
import { calculateCloudCosts } from './cloudPricing';
import type { Topology } from '../sim/types';
import { makeNode } from '../sim/presets';

describe('calculateCloudCosts', () => {
  it('calculates 0 cost for empty topology', () => {
    const topology: Topology = { nodes: [], edges: [] };
    const cost = calculateCloudCosts(topology);
    expect(cost.totalAws).toBe(0);
    expect(cost.totalGcp).toBe(0);
    expect(cost.totalAzure).toBe(0);
    expect(cost.components).toHaveLength(0);
  });

  it('calculates monthly costs for services and databases according to instance counts', () => {
    const svc = makeNode('service', 0, 0, 'Auth Service');
    svc.id = 'svc-1';
    svc.config.instances = 3;

    const db = makeNode('db', 200, 0, 'Primary Postgres');
    db.id = 'db-1';
    db.config.instances = 1;

    const topology: Topology = {
      nodes: [svc, db],
      edges: [],
    };

    const cost = calculateCloudCosts(topology);
    expect(cost.totalAws).toBeGreaterThan(0);
    expect(cost.totalGcp).toBeGreaterThan(0);
    expect(cost.totalAzure).toBeGreaterThan(0);
    expect(cost.components).toHaveLength(2);

    const svcCost = cost.components.find((c) => c.nodeId === 'svc-1');
    expect(svcCost?.instances).toBe(3);
    expect(svcCost?.monthlyCostAws).toBe(48 * 3);
  });
});
