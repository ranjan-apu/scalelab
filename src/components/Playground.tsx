import { useEffect, useRef } from 'react';
import {
  PLAYGROUND_STEPS,
  PLAYGROUND_STEP_LIMIT,
  playgroundAnsweredCount,
  playgroundToMarkdown,
  playgroundWordCount,
} from '../sim/playground';
import type { Playground as PlaygroundDoc, PlaygroundStepId } from '../sim/playground';
import './Playground.css';

/* ------------------------------------------------------------------ *
 * Playground panel.
 *
 * The written half of an interview answer. The canvas is where the design
 * gets drawn; this is where it gets argued: requirements and the numbers
 * first, then entities, the API surface, the high-level design, and the two
 * or three places it breaks under load.
 *
 * Every step is a plain textarea, deliberately. Typing, selecting, undo and
 * the system clipboard all behave exactly as they do anywhere else on the
 * machine, which is the whole point: a practice sheet that reimplements its
 * own text editing is a practice sheet nobody writes in. The buttons on top
 * of that are the ones a textarea cannot do by itself — copy the whole sheet
 * as Markdown, drop a step onto the board as a note, start over.
 * ------------------------------------------------------------------ */

export interface PlaygroundProps {
  playground: PlaygroundDoc;
  onEdit: (step: PlaygroundStepId, text: string) => void;
  /** Place a step's text on the board, as a note the student can move. */
  onPlaceOnBoard: (step: PlaygroundStepId, text: string) => void;
  onClear: () => void;
  /** Copy text to the system clipboard, reporting failure to the shell. */
  onCopy: (text: string, what: string) => void;
}

/** A textarea that is as tall as what has been typed into it. */
function GrowingTextarea({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  // Height follows the CONTENT, so a long answer stays fully visible instead
  // of scrolling inside a three-line box. Re-run on every value change for the
  // same reason the canvas re-lays out a note: the text is the layout.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      className="pg-textarea"
      rows={3}
      value={value}
      maxLength={PLAYGROUND_STEP_LIMIT}
      aria-label={ariaLabel}
      spellCheck={false}
      placeholder="Type here..."
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Playground({
  playground,
  onEdit,
  onPlaceOnBoard,
  onClear,
  onCopy,
}: PlaygroundProps) {
  const answered = playgroundAnsweredCount(playground);
  const words = PLAYGROUND_STEPS.reduce(
    (sum, step) => sum + playgroundWordCount(playground.steps[step.id] ?? ''),
    0,
  );

  return (
    <aside className="pg" aria-label="Playground">
      <header className="pg-head">
        <div>
          <p className="label pg-eyebrow">Playground</p>
          <h2 className="pg-title">Practice sheet</h2>
        </div>
        <div className="pg-head-actions">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onCopy(playgroundToMarkdown(playground), 'sheet')}
            title="Copy all five steps as Markdown"
          >
            Copy sheet
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={onClear}
            disabled={answered === 0 && words === 0}
            title="Start over: clears every step"
          >
            Clear
          </button>
        </div>
      </header>

      <p className="pg-sub">
        Type your answer step by step, the way you would talk through it. The text
        stays with this design, travels in a share link, and never touches the
        simulation.
      </p>
      <p className="pg-progress">
        <strong>
          {answered}/{PLAYGROUND_STEPS.length}
        </strong>{' '}
        steps answered, {words} {words === 1 ? 'word' : 'words'}
      </p>

      <div className="pg-steps">
        {PLAYGROUND_STEPS.map((step, index) => {
          const text = playground.steps[step.id] ?? '';
          const count = playgroundWordCount(text);
          return (
            <section className="pg-step" key={step.id}>
              <div className="pg-step-head">
                <span className="pg-step-num" aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="pg-step-title">{step.title}</h3>
                <span className="pg-step-count">{count ? `${count}w` : ''}</span>
              </div>
              <p className="pg-step-hint">{step.hint}</p>
              <GrowingTextarea
                value={text}
                onChange={(next) => onEdit(step.id, next)}
                ariaLabel={step.title}
              />
              <div className="pg-step-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => onCopy(text, step.title)}
                  disabled={!text.trim()}
                  title="Copy this step to the clipboard"
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => onPlaceOnBoard(step.id, text)}
                  disabled={!text.trim()}
                  title="Place this step on the board as a note"
                >
                  Place on board
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
