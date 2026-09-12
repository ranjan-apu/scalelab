// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { InterviewPractice } from './InterviewPractice';
import { Guide } from './guide';
import { INTERVIEW_PACKS } from '../content/interviewPacks';
import { LABS } from '../content/labs';
import { CONCEPTS } from '../content/concepts';
import { PRESETS } from '../sim/presets';
import { Engine } from '../sim/engine';

/**
 * Library-wide load verification: every problem statement must render its
 * full track in the practice dialog, every lab setup must boot in the real
 * engine, and every concept lesson must appear in the Guide. A pack that
 * exists in data but crashes on open is not "loaded properly".
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

function click(el: Element | null | undefined): void {
  expect(el).not.toBeNull();
  act(() => {
    el!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function bodyText(): string {
  return document.body.textContent ?? '';
}

describe('problem library loads properly', () => {
  it('renders the full track for all 37 packs', () => {
    expect(INTERVIEW_PACKS.length).toBe(37);
    act(() => {
      root.render(
        <InterviewPractice
          open={true}
          onClose={() => {}}
          packs={INTERVIEW_PACKS}
          presets={PRESETS}
          activePresetId={null}
          onLoadPreset={() => {}}
          onPinSection={() => {}}
          labs={LABS}
        />,
      );
    });

    // All 37 packs listed with no filter applied.
    expect(document.querySelectorAll('.iv-pack').length).toBe(37);

    for (const pack of INTERVIEW_PACKS) {
      const button = Array.from(document.querySelectorAll('.iv-pack')).find((b) =>
        b.textContent?.includes(pack.title),
      );
      expect(button, `pack listed: ${pack.id}`).toBeDefined();
      click(button);

      // Requirements step: prompt plus first functional requirement visible.
      expect(bodyText(), `${pack.id} prompt`).toContain(pack.prompt.slice(0, 60));
      expect(bodyText(), `${pack.id} functional`).toContain(pack.functional[0]!.slice(0, 40));

      const steps = Array.from(document.querySelectorAll('.iv-step'));
      expect(steps.length, `${pack.id} has 6 steps with a lab`).toBe(6);

      // Entities.
      click(steps[1]);
      expect(bodyText(), `${pack.id} entities`).toContain(pack.entities[0]!.name);

      // API.
      click(steps[2]);
      expect(bodyText(), `${pack.id} api`).toContain(pack.api.endpoints[0]!.path);

      // HLD.
      click(steps[3]);
      expect(bodyText(), `${pack.id} hld`).toContain(pack.hldSteps[0]!.slice(0, 40));

      // Deep dives.
      click(steps[4]);
      expect(bodyText(), `${pack.id} deep dives`).toContain(pack.deepDives[0]!.title);

      // Lab step: objective plus its checks.
      const lab = LABS.find((l) => l.packId === pack.id);
      expect(lab, `${pack.id} has a lab`).toBeDefined();
      click(steps[5]);
      expect(bodyText(), `${pack.id} lab`).toContain(lab!.title);
      for (const check of lab!.checks) {
        expect(bodyText(), `${pack.id} check ${check.id}`).toContain(check.label);
      }
    }
  });

  it('boots every starter and lab setup in the real engine', () => {
    const setupIds = new Set([
      ...INTERVIEW_PACKS.map((p) => p.hldPresetId),
      ...LABS.map((l) => l.setupPresetId),
    ]);
    expect(setupIds.size).toBeGreaterThan(10);
    for (const id of setupIds) {
      const preset = PRESETS.find((p) => p.id === id);
      expect(preset, `preset exists: ${id}`).toBeDefined();
      const engine = new Engine(structuredClone(preset!.topology), 7);
      for (let i = 0; i < 5 * 60; i += 1) engine.advance(1000 / 60);
      const snap = engine.snapshot();
      expect(Number.isFinite(snap.system.p99), `${id} p99 finite`).toBe(true);
      expect(snap.system.totalRequests, `${id} serves traffic`).toBeGreaterThan(0);
    }
  });

  it('lists all 34 concept lessons in the Guide', () => {
    expect(CONCEPTS.length).toBe(34);
    act(() => {
      root.render(<Guide open={true} onClose={() => {}} />);
    });
    const tabs = Array.from(document.querySelectorAll('.gd-tab'));
    click(tabs.find((b) => b.textContent?.includes('Concepts')));
    expect(bodyText()).toContain('34 lessons');
    for (const concept of CONCEPTS) {
      expect(bodyText(), `concept listed: ${concept.id}`).toContain(concept.title);
    }
  });
});
