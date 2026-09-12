import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Preset } from '../sim/presets';
import type { SimSnapshot, Topology, TrafficPattern } from '../sim/types';
import type { InterviewPack } from '../content/interviewPacks';
import { CONCEPTS_BY_ID } from '../content/concepts';
import {
  evaluateLab,
  labPassed,
  type CheckResult,
  type PracticeLab,
} from '../content/labs';
import { usePresence } from './presence';
import './InterviewPractice.css';

/* ==========================================================================
   Interview practice.
 *
   A guided session per pack, in the order real interviews run: scope the
   problem through checkpoints, fix functional and non-functional
   requirements, name the entities, sign the API contract, build the high
   level design on the canvas, then harden it in deep dives. A sixth Lab step
   turns the design into a graded exercise: load the lab setup, work the
   tasks, and run checks against the live simulation snapshot.
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
  'Practice Lab',
] as const;

export interface InterviewPracticeProps {
  open: boolean;
  onClose: () => void;
  packs: readonly InterviewPack[];
  presets: readonly Preset[];
  activePresetId: string | null;
  onLoadPreset: (preset: Preset) => void;
  onPinSection: (title: string, text: string) => void;
  /** All practice labs; matched to packs by packId. */
  labs?: readonly PracticeLab[];
  /** Live simulation snapshot used to grade lab checks. */
  snapshot?: SimSnapshot | null;
  /** Current canvas topology, for node-scoped lab checks. */
  topology?: Topology | null;
  /** Load a lab setup: preset plus traffic scenario for every source. */
  onLoadLab?: (preset: Preset, pattern: TrafficPattern) => void;
  /** Preselect one pack when the dialog opens (e.g. jumping from a concept). */
  initialPackId?: string;
  /** Drop the whole current pack onto a fresh canvas as a two-column doc. */
  onPracticeOnCanvas?: (packId: string) => void;
}

function bullets(lines: readonly string[]): string {
  return lines.map((l) => `• ${l}`).join('\n');
}

const LAB_DONE_KEY = 'scalelab-lab-done-v1';

function readDoneLabs(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(LAB_DONE_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

function formatActual(check: CheckResult['check'], actual: number): string {
  if (!Number.isFinite(actual)) return 'n/a';
  if (check.metric === 'errorRate' || check.metric === 'goodputRatio' || check.metric === 'hitRate') {
    return `${(actual * 100).toFixed(1)}%`;
  }
  if (check.metric === 'utilization') return `${(actual * 100).toFixed(0)}%`;
  return `${actual}ms`;
}

function LabPane({
  lab,
  pack,
  preset,
  activePresetId,
  snapshot,
  topology,
  onLoadLab,
  onPinSection,
}: {
  lab: PracticeLab;
  pack: InterviewPack;
  preset?: Preset;
  activePresetId: string | null;
  snapshot?: SimSnapshot | null;
  topology?: Topology | null;
  onLoadLab?: (preset: Preset, pattern: TrafficPattern) => void;
  onPinSection: (title: string, text: string) => void;
}) {
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [results, setResults] = useState<CheckResult[] | null>(null);

  useEffect(() => {
    setTicked(new Set());
    setResults(null);
  }, [lab.id]);

  const toggleTask = (i: number) => {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const runChecks = () => {
    if (!snapshot || !topology) return;
    const graded = evaluateLab(snapshot, topology, lab);
    setResults(graded);
    if (labPassed(graded)) {
      try {
        localStorage.setItem(LAB_DONE_KEY, JSON.stringify({ ...readDoneLabs(), [lab.id]: true }));
      } catch {
        /* persistence is a nicety, not the lesson */
      }
    }
  };

  const canGrade = !!snapshot && !!topology;
  const passed = results !== null && labPassed(results);

  return (
    <>
      <section className="iv-section" aria-label="Lab objective">
        <div className="iv-section-head">
          <h3>{lab.title}</h3>
          {preset && onLoadLab && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onLoadLab(preset, lab.scenario)}
            >
              {activePresetId === preset.id
                ? 'Lab setup on canvas'
                : `Load lab: ${preset.name} + ${lab.scenario}`}
            </button>
          )}
        </div>
        <p className="iv-hint">{lab.objective}</p>
        {lab.conceptIds.length > 0 && (
          <p className="iv-hint">
            Builds on:{' '}
            {lab.conceptIds
              .map((id) => CONCEPTS_BY_ID.get(id)?.title ?? id)
              .join(', ')}
            . Find each one in the Guide under Concepts.
          </p>
        )}
      </section>

      <section className="iv-section" aria-label="Lab tasks">
        <div className="iv-section-head">
          <h3>Tasks</h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() =>
              onPinSection(
                `${pack.title}: lab tasks`,
                lab.tasks.map((t, i) => `${i + 1}. ${t.title}: ${t.detail}`).join('\n'),
              )
            }
          >
            Pin to canvas
          </button>
        </div>
        <ul className="iv-list">
          {lab.tasks.map((t, i) => (
            <li key={t.title}>
              <label>
                <input
                  type="checkbox"
                  checked={ticked.has(i)}
                  onChange={() => toggleTask(i)}
                />{' '}
                <strong>{t.title}</strong>
              </label>
              <span className="iv-decides">{t.detail}</span>
              {t.hint && <span className="iv-decides">Hint: {t.hint}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="iv-section" aria-label="Lab checks">
        <div className="iv-section-head">
          <h3>Checks</h3>
          <button
            type="button"
            className="btn btn-sm"
            disabled={!canGrade}
            title={canGrade ? 'Grade against the live simulation' : 'Open a canvas with traffic running first'}
            onClick={runChecks}
          >
            Run checks
          </button>
        </div>
        {!canGrade && (
          <p className="iv-hint">Load the lab setup so the simulation runs, then grade here.</p>
        )}
        <ul className="iv-list">
          {lab.checks.map((c) => {
            const r = results?.find((x) => x.check.id === c.id);
            return (
              <li key={c.id}>
                <strong>{c.label}</strong>
                {r && (
                  <span className="iv-decides">
                    {r.pass ? '✓' : '✗'} measured {formatActual(c, r.actual)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {results && (
          <p className="iv-hint">
            {passed
              ? 'All checks pass. Lab complete: the system holds its SLO under the scenario.'
              : `${results.filter((r) => !r.pass).length} check(s) failing. Adjust the design on the canvas and run again.`}
          </p>
        )}
      </section>
    </>
  );
}

export function InterviewPractice({
  open,
  onClose,
  packs,
  presets,
  activePresetId,
  onLoadPreset,
  onPinSection,
  labs = [],
  snapshot = null,
  topology = null,
  onLoadLab,
  initialPackId,
  onPracticeOnCanvas,
}: InterviewPracticeProps) {
  const { mounted, closing, unmount } = usePresence(open);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [packId, setPackId] = useState<string>(packs[0]?.id ?? '');
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState<'all' | 'Core' | 'Popular' | 'Hard'>('all');

  /* Reset on OPEN rather than on close, so the session is not blanked out
     from under the reader while the dialog is still sliding away. */
  useEffect(() => {
    if (open) {
      const initial =
        initialPackId && packs.some((p) => p.id === initialPackId)
          ? initialPackId
          : (packs[0]?.id ?? '');
      setPackId(initial);
      setStep(0);
      setQuery('');
      setDifficulty('all');
    }
  }, [open, packs, initialPackId]);

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

  const filteredPacks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return packs.filter((p) => {
      if (difficulty !== 'all' && p.difficulty !== difficulty) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.id.includes(q.replace(/\s+/g, '-'))
      );
    });
  }, [packs, query, difficulty]);

  const pack = useMemo(
    () => packs.find((p) => p.id === packId) ?? packs[0],
    [packs, packId],
  );
  const starter = useMemo(
    () => presets.find((p) => p.id === pack?.hldPresetId),
    [presets, pack],
  );
  const lab = useMemo(
    () => labs.find((l) => l.packId === pack?.id),
    [labs, pack],
  );
  const labPreset = useMemo(
    () => presets.find((p) => p.id === lab?.setupPresetId),
    [presets, lab],
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

  const visibleSteps = lab ? STEPS : STEPS.slice(0, 5);

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
            {onPracticeOnCanvas && (
              <button
                type="button"
                className="btn"
                title="Drop the whole interview onto a fresh canvas"
                onClick={() => pack && onPracticeOnCanvas(pack.id)}
              >
                Practice on canvas
              </button>
            )}
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        <div className="iv-body">
          <div className="iv-packs-col">
            <div className="iv-packs-filter">
              <input
                type="search"
                placeholder="Search problems…"
                aria-label="Search practice problems"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                aria-label="Filter by difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
              >
                <option value="all">All levels</option>
                <option value="Core">Core</option>
                <option value="Popular">Popular</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
            <ul className="iv-packs" aria-label="Practice problems">
              {filteredPacks.map((p) => {
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
            {filteredPacks.length === 0 && (
              <p className="iv-hint">No problems match. Try a broader search.</p>
            )}
          </div>

          <div className="iv-content">
            <div className="iv-prompt">
              <p className="iv-prompt-text">{pack.prompt}</p>
            </div>

            <div className="iv-steps" role="tablist" aria-label="Interview stages">
              {visibleSteps.map((label, i) => (
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

              {step === 5 && lab && (
                <LabPane
                  lab={lab}
                  pack={pack}
                  preset={labPreset}
                  activePresetId={activePresetId}
                  snapshot={snapshot}
                  topology={topology}
                  onLoadLab={onLoadLab}
                  onPinSection={onPinSection}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
