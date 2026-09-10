import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Preset } from '../sim/presets';
import type { InterviewPack } from '../content/interviewPacks';
import { usePresence } from './presence';
import './InterviewPractice.css';

/* ==========================================================================
   Interview practice.
 *
   A guided session per pack, in the order real interviews run: scope the
   problem through checkpoints, fix functional and non-functional
   requirements, name the entities, sign the API contract, build the high
   level design on the canvas, then harden it in deep dives.
 *
   Two actions make practice concrete instead of reading material. "Load
   starter" drops the linked simulation preset onto the canvas, so the design
   under discussion is one the reader can push load through. "Pin to canvas"
   copies any section onto the canvas as a textbox, so the interview track
   lives beside the diagram it describes.
   ========================================================================== */

const STEPS = [
  'Requirements',
  'Entities',
  'API Design',
  'High-Level Design',
  'Deep Dives',
] as const;

export interface InterviewPracticeProps {
  open: boolean;
  onClose: () => void;
  packs: readonly InterviewPack[];
  presets: readonly Preset[];
  activePresetId: string | null;
  onLoadPreset: (preset: Preset) => void;
  onPinSection: (title: string, text: string) => void;
}

function bullets(lines: readonly string[]): string {
  return lines.map((l) => `• ${l}`).join('\n');
}

export function InterviewPractice({
  open,
  onClose,
  packs,
  presets,
  activePresetId,
  onLoadPreset,
  onPinSection,
}: InterviewPracticeProps) {
  const { mounted, closing, unmount } = usePresence(open);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [packId, setPackId] = useState<string>(packs[0]?.id ?? '');
  const [step, setStep] = useState(0);

  /* Reset on OPEN rather than on close, so the session is not blanked out
     from under the reader while the dialog is still sliding away. */
  useEffect(() => {
    if (open) {
      setPackId(packs[0]?.id ?? '');
      setStep(0);
    }
  }, [open, packs]);

  /* Focus return, mirroring the examples gallery. */
  useEffect(() => {
    if (!open) return;
    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const card = cardRef.current;
    card?.focus();
    return () => {
      const active = document.activeElement;
      const inside = card?.contains(active as Node) ?? false;
      if (inside || active === document.body || active === null) {
        opener?.focus();
      }
    };
  }, [open ]);

  const pack = useMemo(
    () => packs.find((p) => p.id === packId) ?? packs[0],
    [packs, packId],
  );
  const starter = useMemo(
    () => presets.find((p) => p.id === pack?.hldPresetId),
    [presets, pack],
  );

  if (!mounted || !pack) return null;

  const selectPack = (id: string) => {
    setPackId(id);
    setStep(0);
  };

  const loadStarter = () => {
    if (!starter) return;
    onLoadPreset(starter);
    onClose();
  };

  return createPortal(
    <div
      className={`iv-root${closing ? ' is-closing' : ''}`}
      inert={closing || undefined}
    >
      <div className="iv-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={cardRef}
        className="iv-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="iv-title"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
        onAnimationEnd={(e) => {
          if (closing && e.target === e.currentTarget) unmount();
        }}
      >
        <header className="iv-head">
          <div>
            <h2 id="iv-title" className="iv-title">
              Interview Practice
            </h2>
            <p className="iv-sub">
              Walk the interview track, then run the system you designed.
            </p>
          </div>
          <div className="iv-head-actions">
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        <div className="iv-body">
          <ul className="iv-packs" aria-label="Practice problems">
            {packs.map((p) => {
              const active = p.id === pack.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`iv-pack${active ? ' is-active' : ''}`}
                    aria-current={active ? 'true' : undefined}
                    onClick={() => selectPack(p.id)}
                  >
                    <span className="iv-pack-name">{p.title}</span>
                    <span className="iv-pack-tagline">{p.tagline}</span>
                    <span className="iv-pack-meta">
                      <span className="iv-pack-diff">{p.difficulty}</span>
                      <span className="iv-pack-min">{p.minutes} min</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="iv-content">
            <div className="iv-prompt">
              <p className="iv-prompt-text">{pack.prompt}</p>
            </div>

            <div className="iv-steps" role="tablist" aria-label="Interview stages">
              {STEPS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={step === i}
                  className={`iv-step${step === i ? ' is-active' : ''}`}
                  onClick={() => setStep(i)}
                >
                  <span className="iv-step-num" aria-hidden="true">{i + 1}</span>
                  {label}
                </button>
              ))}
            </div>

            <div className="iv-pane" role="tabpanel">
              {step === 0 && (
                <>
                  <section className="iv-section" aria-label="Problem checkpoints">
                    <div className="iv-section-head">
                      <h3>Problem checkpoints</h3>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          onPinSection(
                            `${pack.title}: scoping questions`,
                            bullets(
                              pack.checkpoints.map(
                                (c) => `${c.question} Decides: ${c.decides}`,
                              ),
                            ),
                          )
                        }
                      >
                        Pin to canvas
                      </button>
                    </div>
                    <p className="iv-hint">
                      Ask these before drawing anything. Each answer narrows the design.
                    </p>
                    <ul className="iv-list">
                      {pack.checkpoints.map((c) => (
                        <li key={c.question}>
                          <strong>{c.question}</strong>
                          <span className="iv-decides">Decides: {c.decides}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="iv-section" aria-label="Requirements">
                    <div className="iv-section-head">
                      <h3>Requirements</h3>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          onPinSection(
                            `${pack.title}: requirements`,
                            `Functional:\n${bullets(pack.functional)}\n\nNon-functional:\n${bullets(pack.nonfunctional)}\n\nEstimations:\n${bullets(pack.estimations)}`,
                          )
                        }
                      >
                        Pin to canvas
                      </button>
                    </div>
                    <h4 className="iv-kicker">Functional: users should be able to</h4>
                    <ul className="iv-list">
                      {pack.functional.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    <h4 className="iv-kicker">Non-functional: the system should</h4>
                    <ul className="iv-list">
                      {pack.nonfunctional.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    <h4 className="iv-kicker">Estimations, only where they steer the design</h4>
                    <ul className="iv-list">
                      {pack.estimations.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </section>
                </>
              )}

              {step === 1 && (
                <section className="iv-section" aria-label="Core entities">
                  <div className="iv-section-head">
                    <h3>Core entities</h3>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        onPinSection(
                          `${pack.title}: entities`,
                          bullets(
                            pack.entities.map((e) => `${e.name}: ${e.fields}`),
                          ),
                        )
                      }
                    >
                      Pin to canvas
                    </button>
                  </div>
                  <p className="iv-hint">
                    A first draft, not the schema. Only the fields that shape the design.
                  </p>
                  <ul className="iv-list">
                    {pack.entities.map((e) => (
                      <li key={e.name}>
                        <strong>{e.name}</strong>
                        <span className="iv-decides">{e.fields}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {step === 2 && (
                <section className="iv-section" aria-label="API design">
                  <div className="iv-section-head">
                    <h3>API design</h3>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        onPinSection(
                          `${pack.title}: API`,
                          `${pack.api.protocol}: ${pack.api.protocolWhy}\n\n${bullets(
                            pack.api.endpoints.map(
                              (e) => `${e.method} ${e.path}: ${e.purpose}`,
                            ),
                          )}`,
                        )
                      }
                    >
                      Pin to canvas
                    </button>
                  </div>
                  <p className="iv-protocol">
                    <strong>{pack.api.protocol}</strong>
                    <span>{pack.api.protocolWhy}</span>
                  </p>
                  <ul className="iv-list iv-endpoints">
                    {pack.api.endpoints.map((e) => (
                      <li key={`${e.method} ${e.path}`}>
                        <code className="iv-method">{e.method}</code>
                        <code className="iv-path">{e.path}</code>
                        <span className="iv-decides">{e.purpose}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {step === 3 && (
                <section className="iv-section" aria-label="High level design">
                  <div className="iv-section-head">
                    <h3>High-level design</h3>
                    <div className="iv-section-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          onPinSection(
                            `${pack.title}: build order`,
                            pack.hldSteps
                              .map((s, i) => `${i + 1}. ${s}`)
                              .join('\n'),
                          )
                        }
                      >
                        Pin to canvas
                      </button>
                      {starter && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={loadStarter}
                        >
                          {activePresetId === starter.id
                            ? 'Starter on canvas'
                            : `Load starter: ${starter.name}`}
                        </button>
                      )}
                    </div>
                  </div>
                  {pack.dataFlow && (
                    <>
                      <h4 className="iv-kicker">Data flow</h4>
                      <ol className="iv-list iv-ordered">
                        {pack.dataFlow.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ol>
                    </>
                  )}
                  <h4 className="iv-kicker">Build it endpoint by endpoint</h4>
                  <ol className="iv-list iv-ordered">
                    {pack.hldSteps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  <p className="iv-hint">
                    Simplest working cut first. Name the hot spots, then harden
                    them in the deep dives.
                  </p>
                </section>
              )}

              {step === 4 && (
                <section className="iv-section" aria-label="Deep dives">
                  <div className="iv-section-head">
                    <h3>Deep dives</h3>
                  </div>
                  <p className="iv-hint">
                    Pick the bottleneck your non-functional requirements point
                    at. Lead with the problem, then the fix, then what it costs.
                  </p>
                  <ul className="iv-dives">
                    {pack.deepDives.map((d) => (
                      <li key={d.title} className="iv-dive">
                        <div className="iv-dive-head">
                          <h4>{d.title}</h4>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              onPinSection(
                                `${pack.title}: ${d.title}`,
                                `Problem: ${d.problem}\n\n${bullets(d.approach)}\n\nTradeoff: ${d.tradeoff}`,
                              )
                            }
                          >
                            Pin to canvas
                          </button>
                        </div>
                        <p className="iv-dive-problem">{d.problem}</p>
                        <ul className="iv-list">
                          {d.approach.map((a) => (
                            <li key={a}>{a}</li>
                          ))}
                        </ul>
                        <p className="iv-dive-tradeoff">
                          <strong>Tradeoff:</strong> {d.tradeoff}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
