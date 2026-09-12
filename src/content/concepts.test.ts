import { describe, expect, it } from 'vitest';
import { CONCEPTS } from './concepts';
import { GLOSSARY_BY_ID } from './glossary';
import { PRESETS } from '../sim/presets';

/**
 * Structural contract for concept lessons.
 *
 * Lessons render in the Guide grouped by track; a lesson pointing at a
 * preset or glossary term that does not exist would render a dead link with
 * no error. These checks fail the build instead.
 */

describe('concepts', () => {
  it('ships the full survey: 9 core, 13 tech, 7 patterns, 5 advanced', () => {
    const byTrack = (t: string) => CONCEPTS.filter((c) => c.track === t).length;
    expect(byTrack('core')).toBe(9);
    expect(byTrack('tech')).toBe(13);
    expect(byTrack('pattern')).toBe(7);
    expect(byTrack('advanced')).toBe(5);
    expect(CONCEPTS.length).toBe(34);
  });

  it('uses unique ids', () => {
    const ids = CONCEPTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every lesson the full teaching shape', () => {
    for (const c of CONCEPTS) {
      expect(c.title.length, `${c.id} title`).toBeGreaterThan(0);
      expect(c.summary.length, `${c.id} summary`).toBeGreaterThan(80);
      expect(c.whenToUse.length, `${c.id} whenToUse`).toBeGreaterThanOrEqual(2);
      expect(c.pitfalls.length, `${c.id} pitfalls`).toBeGreaterThanOrEqual(1);
      expect(c.simDemo.watch.length, `${c.id} watch`).toBeGreaterThan(0);
      expect(c.glossaryIds.length, `${c.id} glossaryIds`).toBeGreaterThanOrEqual(2);
      expect(c.checkYourself.length, `${c.id} checkYourself`).toBeGreaterThanOrEqual(2);
    }
  });

  it('points every demo at a real preset', () => {
    const ids = new Set(PRESETS.map((p) => p.id));
    for (const c of CONCEPTS) {
      expect(ids.has(c.simDemo.presetId), `${c.id} preset ${c.simDemo.presetId}`).toBe(true);
    }
  });

  it('links only to glossary terms that exist', () => {
    for (const c of CONCEPTS) {
      for (const g of c.glossaryIds) {
        expect(GLOSSARY_BY_ID.has(g), `${c.id} glossary ${g}`).toBe(true);
      }
    }
  });

  it('carries no external brand strings', () => {
    const blob = JSON.stringify(CONCEPTS);
    expect(blob).not.toMatch(/hello.?interview/i);
  });
});
