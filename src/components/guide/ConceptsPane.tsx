import { useMemo, useState } from 'react';
import { CONCEPTS, type ConceptTrack } from '../../content/concepts';

interface ConceptsPaneProps {
  onClose: () => void;
  onOpenInterview?: () => void;
}

const TRACKS: { id: ConceptTrack; label: string; blurb: string }[] = [
  { id: 'core', label: 'Core ideas', blurb: 'The nine fundamentals behind every design.' },
  { id: 'tech', label: 'Building blocks', blurb: 'One technology per category you can defend.' },
  { id: 'pattern', label: 'Patterns', blurb: 'Reusable shapes that save interview time.' },
  { id: 'advanced', label: 'Advanced', blurb: 'Specialist topics for senior depth.' },
];

export function ConceptsPane({ onClose, onOpenInterview }: ConceptsPaneProps) {
  const [query, setQuery] = useState('');
  const [track, setTrack] = useState<'all' | ConceptTrack>('all');

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
                  <strong>{c.title}:</strong>
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
