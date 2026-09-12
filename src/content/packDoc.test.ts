import { describe, expect, it } from 'vitest';
import { INTERVIEW_PACKS } from './interviewPacks';
import { packToCanvasDoc } from './packDoc';

/**
 * The Practice-on-canvas exporter must carry the whole interview track and
 * nothing else: a dropped box missing its deep dives, or one leaking lab or
 * brand content, would sit on the canvas looking authoritative.
 */

describe('packToCanvasDoc', () => {
  it('covers every pack with a two-column spread', () => {
    expect(INTERVIEW_PACKS.length).toBeGreaterThan(0);
    for (const pack of INTERVIEW_PACKS) {
      const doc = packToCanvasDoc(pack);
      expect(doc.header.title, `${pack.id} header`).toContain(pack.title);
      expect(doc.header.text, `${pack.id} prompt`).toContain(pack.prompt);
      expect(doc.left.length, `${pack.id} left`).toBe(4);
      expect(doc.right.length, `${pack.id} right`).toBe(1 + pack.deepDives.length);
      for (const box of [doc.header, ...doc.left, ...doc.right]) {
        expect(box.title.length, `${pack.id} box title`).toBeGreaterThan(0);
        expect(box.text.length, `${pack.id} box text`).toBeGreaterThan(0);
      }
    }
  });

  it('names every entity, endpoint, step, and dive', () => {
    for (const pack of INTERVIEW_PACKS) {
      const doc = packToCanvasDoc(pack);
      const boxes = [doc.header, ...doc.left, ...doc.right];
      const all = boxes.map((b) => `${b.title}\n${b.text}`).join('\n');
      for (const e of pack.entities) expect(all, `${pack.id} entity ${e.name}`).toContain(e.name);
      for (const e of pack.api.endpoints) expect(all, `${pack.id} endpoint`).toContain(e.path);
      for (const s of pack.hldSteps) expect(all, `${pack.id} hld`).toContain(s.slice(0, 30));
      for (const d of pack.deepDives) expect(all, `${pack.id} dive`).toContain(d.title);
    }
  });

  it('carries no external brand strings', () => {
    for (const pack of INTERVIEW_PACKS) {
      expect(JSON.stringify(packToCanvasDoc(pack))).not.toMatch(/hello.?interview/i);
    }
  });
});
