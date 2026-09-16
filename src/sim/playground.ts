/**
 * The Playground: a typed answer sheet that travels with a design.
 *
 * Interview practice is a written exercise before it is a drawn one. The
 * canvas answers "what does the system look like"; this answers "what did you
 * decide, and why" — requirements and scale numbers first, then entities, the
 * API surface, the high-level design, and the two or three places it breaks
 * under load. Hello Interview's practice loop walks those same five steps, and
 * the value is that they are written down in one place rather than narrated
 * and lost.
 *
 * It lives on the Topology, beside `annotations`, for the same reason they do:
 * it is presentation, the engine never reads it, and putting it there means it
 * rides the session, a share link and an exported design file for free. The
 * only thing each of those boundaries has to remember is to sanitize it, which
 * is what `sanitizePlayground` is for.
 */

export const PLAYGROUND_STEPS = [
  {
    id: 'requirements',
    title: 'Requirements',
    hint: 'Functional, non-functional, and the numbers: users, reads, writes, retention.',
  },
  {
    id: 'entities',
    title: 'Entities',
    hint: 'The nouns. What is stored, what identifies it, and what it points at.',
  },
  {
    id: 'api',
    title: 'API',
    hint: 'The endpoints, their verbs, and what comes back. Mark the heavy ones.',
  },
  {
    id: 'design',
    title: 'High-level design',
    hint: 'The boxes and the wires, and why each one earns its place.',
  },
  {
    id: 'deepDives',
    title: 'Deep dives',
    hint: 'Where it breaks first under load, and what you would do about it.',
  },
] as const;

export type PlaygroundStepId = (typeof PLAYGROUND_STEPS)[number]['id'];

export type PlaygroundSteps = Record<PlaygroundStepId, string>;

export interface Playground {
  steps: PlaygroundSteps;
}

/**
 * Cap per step, in characters.
 *
 * Generous for a few paragraphs and small enough that a share link stays a
 * link: the sheet travels in the URL, and a pasted novel would push it past
 * what a browser will happily address.
 */
export const PLAYGROUND_STEP_LIMIT = 4000;

export function emptyPlaygroundSteps(): PlaygroundSteps {
  const steps = {} as PlaygroundSteps;
  for (const step of PLAYGROUND_STEPS) steps[step.id] = '';
  return steps;
}

export function emptyPlayground(): Playground {
  return { steps: emptyPlaygroundSteps() };
}

/** Is there anything worth keeping? An empty sheet is not stored at all. */
export function playgroundIsEmpty(playground: Playground | undefined): boolean {
  if (!playground) return true;
  return PLAYGROUND_STEPS.every((step) => !playground.steps[step.id]?.trim());
}

/** Filled steps only, for a compact summary line. */
export function playgroundAnsweredCount(playground: Playground | undefined): number {
  if (!playground) return 0;
  return PLAYGROUND_STEPS.filter((step) => playground.steps[step.id]?.trim()).length;
}

export function playgroundWordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Validate a sheet arriving from a stored session, a share link or an imported
 * file. Missing steps become empty ones rather than an error: a link written
 * before a step existed still opens, and a step nobody answered is the normal
 * case rather than corrupt data.
 */
export function sanitizePlayground(input: unknown): Playground | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = (input as { steps?: unknown }).steps;
  if (!raw || typeof raw !== 'object') return undefined;

  const steps = emptyPlaygroundSteps();
  for (const step of PLAYGROUND_STEPS) {
    const value = (raw as Record<string, unknown>)[step.id];
    if (typeof value === 'string') steps[step.id] = value.slice(0, PLAYGROUND_STEP_LIMIT);
  }
  const sheet: Playground = { steps };
  return playgroundIsEmpty(sheet) ? undefined : sheet;
}

/** The sheet as Markdown, for the clipboard or an exported document. */
export function playgroundToMarkdown(playground: Playground | undefined): string {
  if (!playground) return '';
  return PLAYGROUND_STEPS.map((step) => {
    const text = playground.steps[step.id]?.trim();
    return `## ${step.title}\n\n${text && text.length > 0 ? text : '_Not answered yet._'}`;
  }).join('\n\n');
}
