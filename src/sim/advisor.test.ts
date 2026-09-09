import { describe, expect, it } from 'vitest';
import { analyzeArchitecture } from './advisor';
import { PRESETS, defaultConfig } from './presets';
import type { Topology } from './types';

describe('Architecture Advisor', () => {
  it('returns clean audit for an empty topology', () => {
    const empty: Topology = { nodes: [], edges: [] };
    const audit = analyzeArchitecture(empty);
    expect(audit.score).toBe(100);
    expect(audit.grade).toBe('A');
    expect(audit.findings).toHaveLength(0);
    expect(audit.summary.totalNodes).toBe(0);
  });

  it('detects Single Point of Failure (SPOF) on an unreplicated database', () => {
    const singleServer = PRESETS.find((p) => p.id === 'single-server')!;
    const audit = analyzeArchitecture(singleServer.topology);
    const spof = audit.findings.find((f) => f.id.startsWith('spof-store'));
    expect(spof).toBeDefined();
    expect(spof?.severity).toBe('warning');
    expect(spof?.category).toBe('reliability');
  });

  it('detects Retry Storm hazards on retry-storm preset', () => {
    const retryStormPreset = PRESETS.find((p) => p.id === 'retry-storm')!;
    const audit = analyzeArchitecture(retryStormPreset.topology);
    const storm = audit.findings.find((f) => f.id.startsWith('retry-storm'));
    expect(storm).toBeDefined();
    expect(storm?.category).toBe('resilience');
  });

  it('detects unprotected client ingress when client connects directly to service or db', () => {
    const topo: Topology = {
      nodes: [
        {
          id: 'client-1',
          kind: 'client',
          label: 'Mobile App',
          x: 0,
          y: 0,
          config: { ...defaultConfig('client'), rps: 100 },
        },
        {
          id: 'svc-1',
          kind: 'service',
          label: 'User Service',
          x: 200,
          y: 0,
          config: { ...defaultConfig('service'), instances: 2 },
        },
      ],
      edges: [{ id: 'e1', from: 'client-1', to: 'svc-1', weight: 1 }],
    };
    const audit = analyzeArchitecture(topo);
    const ingressFinding = audit.findings.find((f) => f.id.startsWith('unprotected-ingress'));
    expect(ingressFinding).toBeDefined();
    expect(ingressFinding?.category).toBe('protection');
  });

  it('detects premature cascading timeouts', () => {
    const topo: Topology = {
      nodes: [
        {
          id: 'api',
          kind: 'service',
          label: 'API Gateway',
          x: 0,
          y: 0,
          config: { ...defaultConfig('service'), timeoutMs: 50 },
        },
        {
          id: 'slow-db',
          kind: 'db',
          label: 'Legacy Warehouse',
          x: 200,
          y: 0,
          config: { ...defaultConfig('db'), serviceMs: 200 },
        },
      ],
      edges: [{ id: 'e1', from: 'api', to: 'slow-db', weight: 1 }],
    };
    const audit = analyzeArchitecture(topo);
    const timeoutFinding = audit.findings.find((f) => f.id.startsWith('cascading-timeout'));
    expect(timeoutFinding).toBeDefined();
    expect(timeoutFinding?.severity).toBe('critical');
    expect(audit.score).toBeLessThanOrEqual(80);
  });

  it('detects unconnected orphaned components', () => {
    const topo: Topology = {
      nodes: [
        {
          id: 'orphan-cache',
          kind: 'cache',
          label: 'Unused Redis',
          x: 100,
          y: 100,
          config: defaultConfig('cache'),
        },
      ],
      edges: [],
    };
    const audit = analyzeArchitecture(topo);
    const orphan = audit.findings.find((f) => f.id.startsWith('unconnected-node'));
    expect(orphan).toBeDefined();
    expect(orphan?.severity).toBe('info');
  });

  it('analyzes production reference presets without error', () => {
    for (const preset of PRESETS) {
      const audit = analyzeArchitecture(preset.topology);
      expect(audit.score).toBeGreaterThanOrEqual(0);
      expect(audit.score).toBeLessThanOrEqual(100);
      expect(['A', 'B', 'C', 'D', 'F']).toContain(audit.grade);
      expect(audit.categoryScores).toHaveLength(4);
    }
  });
});
