import { useMemo, useState } from 'react';
import { CONCEPTS, type ConceptLesson, type ConceptTrack } from '../../content/concepts';
import { GLOSSARY_BY_ID } from '../../content/glossary';
import { INTERVIEW_PACKS } from '../../content/interviewPacks';
import { LABS } from '../../content/labs';
import { PRESETS } from '../../sim/presets';
import type { TrafficPattern } from '../../sim/types';

interface ConceptsPaneProps {
  onClose: () => void;
  onOpenInterview?: () => void;
  onLoadDemoPreset?: (presetId: string, pattern: TrafficPattern) => void;
  onPinSection?: (title: string, text: string) => void;
  onOpenGlossary?: (id: string) => void;
  onPracticePack?: (packId: string) => void;
}

const TRACKS: { id: ConceptTrack; label: string; blurb: string }[] = [
  { id: 'core', label: 'Core ideas', blurb: 'The nine fundamentals behind every design.' },
  { id: 'tech', label: 'Building blocks', blurb: 'One technology per category you can defend.' },
  { id: 'pattern', label: 'Patterns', blurb: 'Reusable shapes that save interview time.' },
  { id: 'advanced', label: 'Advanced', blurb: 'Specialist topics for senior depth.' },
];

function trackLabel(track: ConceptTrack): string {
  return TRACKS.find((t) => t.id === track)?.label ?? track;
}

function lessonPinText(lesson: ConceptLesson): string {
  const section = (head: string, lines: readonly string[]) =>
    `${head}:\n${lines.map((l) => `• ${l}`).join('\n')}`;
  return [
    `${lesson.title}: ${lesson.summary}`,
    section('Reach for it when', lesson.whenToUse),
    section('Watch out for', lesson.pitfalls),
    section('Ask yourself', lesson.checkYourself),
  ].join('\n\n');
}

function ConceptDetail({
  lesson,
  onBack,
  onClose,
  onOpenInterview,
  onLoadDemoPreset,
  onPinSection,
  onOpenGlossary,
  onPracticePack,
}: { lesson: ConceptLesson; onBack: () => void } & Omit<ConceptsPaneProps, 'onClose'> & {
  onClose: () => void;
}) {
  const demoPreset = PRESETS.find((p) => p.id === lesson.simDemo.presetId);
  const packs = INTERVIEW_PACKS.filter((p) => p.concepts?.includes(lesson.id));
  const labs = LABS.filter((l) => l.conceptIds.includes(lesson.id));

  return (
    <div className="gd-pane" aria-label={`Concept: ${lesson.title}`}>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onBack} aria-label="Back to concepts">
        ← All concepts
      </button>
      <h3>{lesson.title}</h3>
      <p className="gd-subtext">
        {trackLabel(lesson.track)} · {CONCEPTS.length} lessons in the library
      </p>
      <p>{lesson.summary}</p>

      <div className="gd-subsection">
        <h4>Reach for it when</h4>
        <ul>
          {lesson.whenToUse.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </div>

      <div className="gd-subsection">
        <h4>Watch out for</h4>
        <ul>
          {lesson.pitfalls.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>

      <div className="gd-subsection">
        <h4>See it run</h4>
        <p className="gd-subtext">{lesson.simDemo.watch}</p>
        <div className="gd-actions-row">
          {demoPreset && onLoadDemoPreset && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                onClose();
                onLoadDemoPreset(demoPreset.id, lesson.simDemo.scenario);
              }}
            >
              Open demo: {demoPreset.name} + {lesson.simDemo.scenario}
            </button>
          )}
          {onPinSection && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onPinSection(lesson.title, lessonPinText(lesson))}
            >
              Pin lesson to canvas
            </button>
          )}
        </div>
      </div>

      <div className="gd-subsection">
        <h4>Ask yourself</h4>
        <ul>
          {lesson.checkYourself.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </div>

      {packs.length > 0 && (
        <div className="gd-subsection">
          <h4>
            Practice it ({packs.length})
          </h4>
          <div className="gd-feature-list">
            {packs.map((p) => (
              <div className="gd-feature-item" key={p.id}>
                <strong>{p.title}:</strong>
                <span>{p.tagline}</span>
                {(onPracticePack ?? onOpenInterview) && (
                  <span>
                    {' '}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        if (onPracticePack) onPracticePack(p.id);
                        else {
                          onClose();
                          onOpenInterview?.();
                        }
                      }}
                    >
                      Practice →
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {labs.length > 0 && (
        <div className="gd-subsection">
          <h4>Graded labs ({labs.length})</h4>
          <p className="gd-subtext">
            {labs.map((l) => l.title).join(' · ')}. Open any linked pack above:
            its Practice Lab step runs the checks.
          </p>
        </div>
      )}

      {lesson.glossaryIds.length > 0 && onOpenGlossary && (
        <div className="gd-subsection">
          <h4>Terms</h4>
          <div className="gd-actions-row">
            {lesson.glossaryIds.map((id) => (
              <button
                key={id}
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  onClose();
                  onOpenGlossary(id);
                }}
              >
                {GLOSSARY_BY_ID.get(id)?.term ?? id}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ConceptsPane(props: ConceptsPaneProps) {
  const { onClose, onOpenInterview } = props;
  const [query, setQuery] = useState('');
  const [track, setTrack] = useState<'all' | ConceptTrack>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CONCEPTS.filter((c) => {
      if (track !== 'all' && c.track !== track) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.whenToUse.some((w) => w.toLowerCase().includes(q))
      );
    });
  }, [query, track]);

  const selected = selectedId ? (CONCEPTS.find((c) => c.id === selectedId) ?? null) : null;
  if (selected) {
    return <ConceptDetail lesson={selected} onBack={() => setSelectedId(null)} {...props} />;
  }

  return (
    <div className="gd-pane">
      <h3>📚 Concept Lessons</h3>
      <p className="gd-subtext">
        Short lessons behind every practice pack: when to reach for an idea, what goes
        wrong, and which runnable preset proves it. {CONCEPTS.length} lessons.
      </p>

      <div className="gd-actions-row">
        <input
          type="search"
          className="gd-search"
          placeholder="Search concepts…"
          aria-label="Search concepts"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Filter by track"
          value={track}
          onChange={(e) => setTrack(e.target.value as 'all' | ConceptTrack)}
        >
          <option value="all">All tracks</option>
          {TRACKS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {TRACKS.filter((t) => track === 'all' || t.id === track).map((t) => {
        const items = visible.filter((c) => c.track === t.id);
        if (items.length === 0) return null;
        return (
          <div className="gd-subsection" key={t.id}>
            <h4>
              {t.label} ({items.length})
            </h4>
            <p className="gd-subtext">{t.blurb}</p>
            <div className="gd-feature-list">
              {items.map((c) => (
                <div className="gd-feature-item" key={c.id}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedId(c.id)}
                    aria-label={`Open lesson: ${c.title}`}
                  >
                    {c.title} →
                  </button>
                  <span>{c.summary}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {visible.length === 0 && (
        <p className="gd-subtext">No concepts match that search. Try a broader term.</p>
      )}

      {onOpenInterview && (
        <div className="gd-actions-row">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              onClose();
              onOpenInterview();
            }}
          >
            Practice with these ideas
          </button>
        </div>
      )}
    </div>
  );
}
