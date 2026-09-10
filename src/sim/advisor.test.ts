import { describe, expect, it } from 'vitest';
import { auditTopology } from './advisor';
import type { Topology } from './types';
import { makeNode } from './presets';

describe('auditTopology', () => {
  it('returns empty findings for an empty topology', () => {
    expect(auditTopology({ nodes: [], edges: [] })).toEqual([]);
  });

  it('detects a Single Point of Failure (SPOF) on an unreplicated database', () => {
    const svc = makeNode('service', 0, 0, 'Order Service');
    svc.id = 'svc-1';
    svc.config.instances = 2;

    const db = makeNode('db', 200, 0, 'Orders DB');
    db.id = 'db-1';
    db.config.instances = 1;

    const topology: Topology = {
      nodes: [svc, db],
      edges: [
        { id: 'svc-1->db-1', from: 'svc-1', to: 'db-1', weight: 1 },
      ],
    };

    const findings = auditTopology(topology);
    const spof = findings.find((f) => f.id.startsWith('spof-db-'));
    expect(spof).toBeDefined();
    expect(spof?.severity).toBe('critical');
    expect(spof?.title).toContain('Single Point of Failure: Orders DB');
  });

  it('detects unprotected client traffic directly hitting a service without a gateway', () => {
    const client = makeNode('client', 0, 0, 'Mobile Clients');
    client.id = 'client-1';
    client.config.rps = 100;

    const svc = makeNode('service', 200, 0, 'Auth Service');
    svc.id = 'svc-1';
    svc.config.instances = 1;

    const topology: Topology = {
      nodes: [client, svc],
      edges: [
        { id: 'client-1->svc-1', from: 'client-1', to: 'svc-1', weight: 1 },
      ],
    };

    const findings = auditTopology(topology);
    const directHit = findings.find((f) => f.id.startsWith('unprotected-client-'));
    expect(directHit).toBeDefined();
    expect(directHit?.severity).toBe('critical');
  });
});
