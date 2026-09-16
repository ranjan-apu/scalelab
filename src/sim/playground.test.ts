import { describe, expect, it } from 'vitest';
import {
  PLAYGROUND_STEPS,
  PLAYGROUND_STEP_LIMIT,
  emptyPlayground,
  playgroundAnsweredCount,
  playgroundIsEmpty,
  playgroundToMarkdown,
  playgroundWordCount,
  sanitizePlayground,
} from './playground';

/**
 * The practice sheet crosses the same trust boundaries the annotations do
 * (localStorage, a share link, an imported file), so the sanitizer is the part
 * worth pinning: everything else is a template.
 */

function sheet(overrides: Partial<Record<string, string>> = {}) {
  const steps = emptyPlayground().steps;
  for (const [id, text] of Object.entries(overrides)) {
    if (text !== undefined) steps[id as keyof typeof steps] = text;
  }
  return { steps };
}

describe('sanitizePlayground', () => {
  it('keeps the steps it can read and blanks the ones it cannot', () => {
    const clean = sanitizePlayground({
      steps: { requirements: '10M DAU', api: 42, deepDives: 'the lock' },
    });
    expect(clean).not.toBeUndefined();
    expect(clean!.steps.requirements).toBe('10M DAU');
    expect(clean!.steps.deepDives).toBe('the lock');
    // A non-string is missing data, not an error: the step reads as unanswered.
    expect(clean!.steps.api).toBe('');
    expect(clean!.steps.entities).toBe('');
  });

  it('clamps a step that would blow up a share link', () => {
    const clean = sanitizePlayground({ steps: { requirements: 'x'.repeat(9000) } });
    expect(clean!.steps.requirements.length).toBe(PLAYGROUND_STEP_LIMIT);
  });

  it('returns nothing for a sheet with no answers', () => {
    expect(sanitizePlayground({ steps: { requirements: '   ' } })).toBeUndefined();
    expect(sanitizePlayground({ steps: {} })).toBeUndefined();
  });

  it('never throws on garbage', () => {
    for (const value of [null, undefined, 7, 'text', [], { steps: 'no' }, { steps: [] }]) {
      expect(sanitizePlayground(value)).toBeUndefined();
    }
  });

  it('drops unknown steps rather than carrying them into a link', () => {
    const clean = sanitizePlayground({
      steps: { requirements: 'yes', nonsense: 'should not survive', __proto__: 'no' },
    });
    expect(Object.keys(clean!.steps).sort()).toEqual(
      PLAYGROUND_STEPS.map((s) => s.id).sort(),
    );
  });
});

describe('playground helpers', () => {
  it('counts answered steps and words', () => {
    const doc = sheet({ requirements: 'ten million daily users', api: 'GET /feed' });
    expect(playgroundAnsweredCount(doc)).toBe(2);
    expect(playgroundWordCount(doc.steps.requirements)).toBe(4);
    expect(playgroundWordCount('   ')).toBe(0);
  });

  it('treats a sheet of blank steps as empty', () => {
    expect(playgroundIsEmpty(emptyPlayground())).toBe(true);
    expect(playgroundIsEmpty(sheet({ api: 'POST /orders' }))).toBe(false);
  });
});

describe('playgroundToMarkdown', () => {
  it('writes every step, with a placeholder where nothing was typed', () => {
    const md = playgroundToMarkdown(sheet({ api: 'GET /feed' }));
    for (const step of PLAYGROUND_STEPS) expect(md).toContain(`## ${step.title}`);
    expect(md).toContain('GET /feed');
    expect(md).toContain('_Not answered yet._');
  });

  it('is empty for no sheet at all', () => {
    expect(playgroundToMarkdown(undefined)).toBe('');
  });
});
