import { describe, expect, it } from 'vitest';
import { INTERVIEW_PACKS } from './interviewPacks';
import { CONCEPTS_BY_ID } from './concepts';
import { PRESETS } from '../sim/presets';

/**
 * Structural contract for interview packs.
 *
 * Packs are content, but the practice dialog renders every section
 * unconditionally: a pack missing its API endpoints or deep dives would
 * render an empty step with no error. These checks fail the build instead.
 */

describe('interview packs', () => {
  it('ships the full library of 37 packs', () => {
    expect(INTERVIEW_PACKS.length).toBe(37);
  });

  it('uses unique ids', () => {
    const ids = INTERVIEW_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every pack the full interview track', () => {
    for (const pack of INTERVIEW_PACKS) {
      expect(pack.title.length, `${pack.id} title`).toBeGreaterThan(0);
      expect(pack.prompt.length, `${pack.id} prompt`).toBeGreaterThan(0);
      expect(pack.checkpoints.length, `${pack.id} checkpoints`).toBeGreaterThanOrEqual(2);
      for (const c of pack.checkpoints) {
        expect(c.question.length, `${pack.id} checkpoint`).toBeGreaterThan(0);
        expect(c.decides.length, `${pack.id} checkpoint decides`).toBeGreaterThan(0);
      }
      expect(pack.functional.length, `${pack.id} functional`).toBeGreaterThanOrEqual(3);
      expect(pack.nonfunctional.length, `${pack.id} nonfunctional`).toBeGreaterThanOrEqual(3);
      expect(pack.estimations.length, `${pack.id} estimations`).toBeGreaterThan(0);
      expect(pack.entities.length, `${pack.id} entities`).toBeGreaterThanOrEqual(2);
      expect(pack.api.protocol.length, `${pack.id} protocol`).toBeGreaterThan(0);
      expect(pack.api.endpoints.length, `${pack.id} endpoints`).toBeGreaterThanOrEqual(2);
      for (const e of pack.api.endpoints) {
        expect(e.method.length, `${pack.id} endpoint method`).toBeGreaterThan(0);
        expect(e.path.length, `${pack.id} endpoint path`).toBeGreaterThan(0);
      }
      expect(pack.hldSteps.length, `${pack.id} hld steps`).toBeGreaterThanOrEqual(2);
      expect(pack.deepDives.length, `${pack.id} deep dives`).toBeGreaterThanOrEqual(2);
      for (const d of pack.deepDives) {
        expect(d.problem.length, `${pack.id} deep dive problem`).toBeGreaterThan(0);
        expect(d.approach.length, `${pack.id} deep dive approach`).toBeGreaterThan(0);
        expect(d.tradeoff.length, `${pack.id} deep dive tradeoff`).toBeGreaterThan(0);
      }
    }
  });

  it('points every HLD starter at a real preset', () => {
    const ids = new Set(PRESETS.map((p) => p.id));
    for (const pack of INTERVIEW_PACKS) {
      expect(ids.has(pack.hldPresetId), `${pack.id} preset ${pack.hldPresetId}`).toBe(true);
    }
  });

  it('keeps minutes and difficulty sane', () => {
    for (const pack of INTERVIEW_PACKS) {
      expect(pack.minutes, pack.id).toBeGreaterThanOrEqual(20);
      expect(pack.minutes, pack.id).toBeLessThanOrEqual(60);
      expect(['Core', 'Popular', 'Hard']).toContain(pack.difficulty);
    }
  });

  it('links only to concepts and patterns that exist', () => {
    for (const pack of INTERVIEW_PACKS) {
      for (const c of pack.concepts ?? []) {
        expect(CONCEPTS_BY_ID.has(c), `${pack.id} concept ${c}`).toBe(true);
      }
      for (const p of pack.patterns ?? []) {
        const pattern = CONCEPTS_BY_ID.get(p);
        expect(pattern?.track, `${pack.id} pattern ${p}`).toBe('pattern');
      }
    }
  });

  it('carries no external brand strings', () => {
    expect(JSON.stringify(INTERVIEW_PACKS)).not.toMatch(/hello.?interview/i);
  });
});
