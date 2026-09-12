import { describe, expect, it } from 'vitest';
import { evaluateLab, LABS, labPassed, type PracticeLab } from './labs';
import { CONCEPTS_BY_ID } from './concepts';
import { INTERVIEW_PACK_IDS } from './interviewPacks';
import { PRESETS } from '../sim/presets';
import type { SimSnapshot, Topology } from '../sim/types';

/**
 * Structural contract for practice labs, plus unit tests for the grader.
 *
 * Labs grade against live snapshots, so a lab pointing at a preset, pack, or
 * concept that does not exist would offer checks that can never pass. The
 * structural checks fail the build instead; the grader tests pin evaluation
 * semantics (history averaging, ratio guards, node aggregation).
 */

function fakeSnapshot(overrides?: Partial<SimSnapshot>): SimSnapshot {
  const base = {
    timeMs: 60_000,
    offeredRps: 100,
    goodputRps: 99,
    errorRate: 0.005,
    p50: 10,
    p95: 30,
    p99: 45,
    totalRequests: 6000,
    totalFailed: 30,
  };
  return {
    system: { ...base, ...overrides?.system },
    nodes: overrides?.nodes ?? {},
    history: overrides?.history ?? [],
    edgeFlow: {},
    edgeState: {},
    failuresByReason: {} as SimSnapshot['failuresByReason'],
    activeFailures: [],
    trace: null,
  };
}

const fakeTopology = (kinds: string[]): Topology =>
  ({
    nodes: kinds.map((kind, i) => ({ id: `n${i}`, kind, x: 0, y: 0, config: {} })),
    edges: [],
    annotations: [],
  }) as unknown as Topology;

const sampleLab: PracticeLab = {
  id: 'sample',
  title: 'Sample',
  packId: 'timeline',
  conceptIds: ['caching'],
  objective: 'Sample objective',
  setupPresetId: 'cache-aside',
  scenario: 'steady',
  tasks: [],
  checks: [
    { id: 'p99', label: 'p99', scope: 'system', metric: 'p99', op: '<', value: 100 },
    { id: 'hit', label: 'hit', scope: 'node', nodeKind: 'cache', metric: 'hitRate', op: '>', value: 0.5 },
  ],
};

describe('lab grader', () => {
  it('passes a healthy snapshot', () => {
    const topo = fakeTopology(['cache']);
    const snap = fakeSnapshot({ nodes: { n0: { hitRate: 0.9 } as never } });
    const results = evaluateLab(snap, topo, sampleLab);
    expect(results.map((r) => r.pass)).toEqual([true, true]);
    expect(labPassed(results)).toBe(true);
  });

  it('fails when p99 breaches the threshold', () => {
    const topo = fakeTopology(['cache']);
    const snap = fakeSnapshot({
      system: { timeMs: 1, offeredRps: 100, goodputRps: 99, errorRate: 0, p50: 10, p95: 30, p99: 500, totalRequests: 1, totalFailed: 0 },
      nodes: { n0: { hitRate: 0.9 } as never },
    });
    const [p99] = evaluateLab(snap, topo, sampleLab);
    expect(p99!.pass).toBe(false);
    expect(p99!.actual).toBe(500);
  });

  it('averages history so one spike sample cannot flake a pass', () => {
    const topo = fakeTopology(['cache']);
    const history = Array.from({ length: 10 }, (_, i) => ({
      t: i * 1000,
      p50: 10,
      p95: 30,
      p99: i === 9 ? 500 : 40,
      goodput: 99,
      offered: 100,
      errorRate: 0,
    }));
    const snap = fakeSnapshot({
      system: { timeMs: 1, offeredRps: 100, goodputRps: 99, errorRate: 0, p50: 10, p95: 30, p99: 500, totalRequests: 1, totalFailed: 0 },
      nodes: { n0: { hitRate: 0.9 } as never },
      history,
    });
    const [p99] = evaluateLab(snap, topo, sampleLab);
    expect(p99!.pass).toBe(true);
    expect(p99!.actual).toBeLessThan(200);
  });

  it('guards division by zero on goodput ratio', () => {
    const lab: PracticeLab = {
      ...sampleLab,
      checks: [{ id: 'r', label: 'r', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.9 }],
    };
    const snap = fakeSnapshot({
      system: { timeMs: 1, offeredRps: 0, goodputRps: 0, errorRate: 0, p50: 0, p95: 0, p99: 0, totalRequests: 0, totalFailed: 0 },
    });
    const [r] = evaluateLab(snap, fakeTopology([]), lab);
    expect(r!.actual).toBe(1);
    expect(r!.pass).toBe(true);
  });

  it('fails node checks with no matching nodes instead of passing silently', () => {
    const snap = fakeSnapshot();
    const [, hit] = evaluateLab(snap, fakeTopology(['service']), sampleLab);
    expect(hit!.pass).toBe(false);
    expect(Number.isNaN(hit!.actual)).toBe(true);
  });
});

describe('labs content', () => {
  it('ships one lab per pack', () => {
    expect(LABS.length).toBe(37);
    const packIds = new Set(LABS.map((l) => l.packId));
    for (const id of INTERVIEW_PACK_IDS) {
      expect(packIds.has(id), `pack ${id} has a lab`).toBe(true);
    }
  });

  it('uses unique ids', () => {
    const ids = LABS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every lab tasks and calibrated checks', () => {
    for (const lab of LABS) {
      expect(lab.objective.length, `${lab.id} objective`).toBeGreaterThan(20);
      expect(lab.tasks.length, `${lab.id} tasks`).toBeGreaterThanOrEqual(2);
      expect(lab.checks.length, `${lab.id} checks`).toBeGreaterThanOrEqual(2);
      expect(lab.conceptIds.length, `${lab.id} concepts`).toBeGreaterThanOrEqual(1);
      for (const c of lab.checks) {
        expect(c.label.length, `${lab.id}/${c.id} label`).toBeGreaterThan(0);
        expect(Number.isFinite(c.value), `${lab.id}/${c.id} value`).toBe(true);
      }
    }
  });

  it('points every setup at a real preset and pack', () => {
    const presetIds = new Set(PRESETS.map((p) => p.id));
    const packIds = new Set(INTERVIEW_PACK_IDS);
    for (const lab of LABS) {
      expect(presetIds.has(lab.setupPresetId), `${lab.id} preset`).toBe(true);
      expect(packIds.has(lab.packId), `${lab.id} pack`).toBe(true);
    }
  });

  it('links only to concepts that exist', () => {
    for (const lab of LABS) {
      for (const c of lab.conceptIds) {
        expect(CONCEPTS_BY_ID.has(c), `${lab.id} concept ${c}`).toBe(true);
      }
    }
  });

  it('carries no external brand strings', () => {
    expect(JSON.stringify(LABS)).not.toMatch(/hello.?interview/i);
  });
});
