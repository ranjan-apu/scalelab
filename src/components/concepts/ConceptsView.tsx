import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CONCEPTS, type ConceptLesson, type ConceptTrack } from '../../content/concepts';
import { GLOSSARY_BY_ID } from '../../content/glossary';
import { INTERVIEW_PACKS } from '../../content/interviewPacks';
import { PRESETS } from '../../sim/presets';
import type { TrafficPattern } from '../../sim/types';
import { usePresence } from '../presence';
import {
  TRACK_INFO,
  getConceptArticle,
  type ConceptArticle,
} from '../../content/conceptArticles';
import { ConceptDiagram } from './ConceptDiagram';
import './ConceptsView.css';

export interface ConceptsViewProps {
  open: boolean;
  onClose: () => void;
  initialConceptId?: string | null;
  onLoadDemoPreset?: (presetId: string, pattern: TrafficPattern) => void;
  onPinSection?: (title: string, text: string) => void;
  onOpenGlossary?: (id: string) => void;
  onPracticePack?: (packId: string) => void;
}

const TRACK_ORDER: ConceptTrack[] = ['core', 'tech', 'pattern', 'advanced'];

function formatPinText(article: ConceptArticle): string {
  const l = article.lesson;
  const section = (head: string, lines: readonly string[]) =>
    `${head}:\n${lines.map((item) => `• ${item}`).join('\n')}`;
  return [
    `# ${l.title}: ${l.summary}`,
    article.realWorldScenario,
    section('Reach for it when', l.whenToUse),
    section('Watch out for', l.pitfalls),
    section('Staff Interview Questions', l.checkYourself),
  ].join('\n\n');
}

export function ConceptsView({
  open,
  onClose,
  initialConceptId,
  onLoadDemoPreset,
  onPinSection,
  onOpenGlossary,
  onPracticePack,
}: ConceptsViewProps) {
  const { mounted, closing, unmount } = usePresence(open);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedId, setSelectedId] = useState<string>(() => initialConceptId ?? CONCEPTS[0]!.id);
  const [searchQuery, setSearchQuery] = useState('');

  // Update selected concept if initialConceptId changes
  useEffect(() => {
    if (initialConceptId) {
      setSelectedId(initialConceptId);
    }
  }, [initialConceptId]);

  // Keyboard shortcut listener: Escape to close, / to search
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const activeArticle = useMemo(() => getConceptArticle(selectedId), [selectedId]);
  const activePreset = useMemo(
    () => PRESETS.find((p) => p.id === activeArticle.lesson.simDemo.presetId),
    [activeArticle]
  );
  const linkedPacks = useMemo(
    () => INTERVIEW_PACKS.filter((p) => p.concepts?.includes(activeArticle.id)),
    [activeArticle.id]
  );

  // Grouped and filtered concepts
  const groupedLessons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const result: Record<ConceptTrack, ConceptLesson[]> = {
      core: [],
      tech: [],
      pattern: [],
      advanced: [],
    };

    for (const c of CONCEPTS) {
      if (
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.whenToUse.some((w) => w.toLowerCase().includes(q))
      ) {
        result[c.track].push(c);
      }
    }
    return result;
  }, [searchQuery]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`concepts-view-root${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="System Design Concept Academy"
      tabIndex={-1}
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) unmount();
      }}
    >
      {/* Top Navigation Bar */}
      <header className="concepts-topbar">
        <div className="concepts-brand">
          <div className="concepts-brand-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <span className="concepts-brand-title">Concept Academy</span>
          <span className="concepts-badge-count">{CONCEPTS.length} Topics</span>
        </div>

        {/* Global Search Bar */}
        <div className="concepts-search-wrap">
          <svg className="concepts-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={searchInputRef}
            type="search"
            className="concepts-search-input"
            placeholder="Search concepts, patterns, technologies…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search concept lessons"
          />
          <span className="concepts-search-hint">/</span>
        </div>

        {/* Topbar Actions */}
        <div className="concepts-topbar-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Back to canvas"
            title="Return to canvas (Esc)"
          >
            ← Back to Canvas
          </button>
        </div>
      </header>

      {/* Main 3-Column Workspace */}
      <div className="concepts-main">
        {/* Left Navigation Sidebar */}
        <nav className="concepts-nav-sidebar" aria-label="Concept tracks">
          {TRACK_ORDER.map((trackKey) => {
            const lessons = groupedLessons[trackKey];
            if (lessons.length === 0) return null;
            const info = TRACK_INFO[trackKey];

            return (
              <div key={trackKey} className="concepts-track-group">
                <div className="concepts-track-header">
                  <span className="concepts-track-title">{info.label}</span>
                  <span className="concepts-track-badge">{lessons.length}</span>
                </div>
                <div className="concepts-track-items">
                  {lessons.map((lesson) => {
                    const isActive = lesson.id === activeArticle.id;
                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        className={`concepts-nav-item${isActive ? ' is-active' : ''}`}
                        onClick={() => setSelectedId(lesson.id)}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <span className="truncate">{lesson.title}</span>
                        <span className="concepts-nav-item-meta">
                          {lesson.track === 'core' ? 'Foundational' : 'Dive'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Center Article Reading View */}
        <main className="concepts-article-viewport" tabIndex={0}>
          <article className="concepts-article-wrap concepts-prose">
            {/* Breadcrumb */}
            <div className="concepts-breadcrumb">
              <span>Concept Academy</span>
              <span>›</span>
              <span>{TRACK_INFO[activeArticle.lesson.track].label}</span>
              <span>›</span>
              <span className="text-accent">{activeArticle.lesson.title}</span>
            </div>

            {/* Title & Metadata Strip */}
            <h1 className="concepts-article-title">{activeArticle.lesson.title}</h1>
            <div className="concepts-meta-strip">
              <span className="concepts-pill pill-accent">{TRACK_INFO[activeArticle.lesson.track].badge}</span>
              <span className={`concepts-pill pill-diff-${activeArticle.difficulty.toLowerCase()}`}>
                {activeArticle.difficulty}
              </span>
              <span className="concepts-pill">{activeArticle.readTime}</span>
              <span className="concepts-pill">Discrete-Event Demo Ready</span>
            </div>

            {/* Interactive Action Hero Banner */}
            <div className="concepts-action-banner">
              <div className="concepts-action-banner-text">
                <strong>Explore on Canvas:</strong> Run this topology in ScaleLab&apos;s discrete-event engine or pin the summary directly to your workspace.
              </div>
              <div className="concepts-action-banner-btns">
                {activePreset && onLoadDemoPreset && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      onClose();
                      onLoadDemoPreset(activePreset.id, activeArticle.lesson.simDemo.scenario);
                    }}
                  >
                    🚀 Load Demo in Engine
                  </button>
                )}
                {onPinSection && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      onClose();
                      onPinSection(activeArticle.lesson.title, formatPinText(activeArticle));
                    }}
                  >
                    📌 Pin to Canvas
                  </button>
                )}
              </div>
            </div>

            {/* Real-World Context Callout */}
            <div className="concepts-scenario-box">
              <div className="concepts-scenario-title">Real-World Scale Challenge</div>
              <p className="concepts-scenario-text">{activeArticle.realWorldScenario}</p>
            </div>

            {/* Visual Architecture Diagram */}
            <section aria-labelledby="diagram-heading">
              <h2 id="diagram-heading">System Architecture Diagram</h2>
              <ConceptDiagram type={activeArticle.diagramType} title={activeArticle.diagramTitle} />
            </section>

            {/* Deep Dive Sections */}
            {activeArticle.deepDive.map((section, idx) => (
              <section key={idx} aria-labelledby={`deep-dive-${idx}`}>
                <h2 id={`deep-dive-${idx}`}>{section.title}</h2>
                {section.lead && <p className="concepts-lead">{section.lead}</p>}
                {section.paragraphs.map((p, pIdx) => (
                  <p key={pIdx}>{p}</p>
                ))}

                {section.callout && (
                  <div className={`concepts-callout callout-${section.callout.type}`}>
                    {section.callout.title && <div className="concepts-callout-title">{section.callout.title}</div>}
                    <p className="concepts-callout-text">{section.callout.text}</p>
                  </div>
                )}

                {section.code && (
                  <div className="concepts-code-block">
                    <pre>
                      <code>{section.code.code}</code>
                    </pre>
                  </div>
                )}
              </section>
            ))}

            {/* Tradeoff Matrix Table */}
            {activeArticle.tradeoffs && (
              <section aria-labelledby="tradeoffs-heading">
                <h2 id="tradeoffs-heading">Trade-Off Analysis &amp; Comparison</h2>
                <div className="concepts-table-wrap">
                  <table className="concepts-table">
                    <thead>
                      <tr>
                        {activeArticle.tradeoffs.headers.map((h, hIdx) => (
                          <th key={hIdx}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeArticle.tradeoffs.rows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Production Gotchas & Pitfalls */}
            <section aria-labelledby="gotchas-heading">
              <h2 id="gotchas-heading">Production Gotchas &amp; War Stories</h2>
              <ul className="concepts-gotchas-list">
                {activeArticle.productionGotchas.map((gotcha, gIdx) => (
                  <li key={gIdx} className="concepts-gotcha-item">
                    <span className="concepts-gotcha-icon" aria-hidden="true">⚠️</span>
                    <span>{gotcha}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Staff-Level Interview Probes */}
            <section aria-labelledby="interview-probes-heading">
              <h2 id="interview-probes-heading">Staff &amp; Principal Interview Probes</h2>
              {activeArticle.interviewProbes.map((probe, pIdx) => (
                <div key={pIdx} className="concepts-interview-card">
                  <div className="concepts-probe-q">Q: {probe.question}</div>
                  <div className="concepts-probe-a">
                    <strong>What interviewers look for:</strong> {probe.lookFor}
                  </div>
                </div>
              ))}
            </section>
          </article>
        </main>

        {/* Right Sidebar: Table of Contents & Connected Resources */}
        <aside className="concepts-toc-panel" aria-label="Page navigation and resources">
          {/* Quick Nav */}
          <div>
            <div className="concepts-toc-section-title">On This Page</div>
            <ul className="concepts-toc-list">
              <li>
                <a href="#diagram-heading" className="concepts-toc-link">
                  Architecture Diagram
                </a>
              </li>
              <li>
                <a href="#deep-dive-0" className="concepts-toc-link">
                  Mechanics &amp; Deep Dive
                </a>
              </li>
              {activeArticle.tradeoffs && (
                <li>
                  <a href="#tradeoffs-heading" className="concepts-toc-link">
                    Trade-Off Matrix
                  </a>
                </li>
              )}
              <li>
                <a href="#gotchas-heading" className="concepts-toc-link">
                  Production Gotchas
                </a>
              </li>
              <li>
                <a href="#interview-probes-heading" className="concepts-toc-link">
                  Staff Interview Probes
                </a>
              </li>
            </ul>
          </div>

          {/* Interactive Preset Card */}
          {activePreset && (
            <div className="concepts-demo-widget">
              <div className="concepts-demo-widget-title">Live Engine Preset</div>
              <p className="concepts-demo-widget-desc">
                {activePreset.name}: {activeArticle.lesson.simDemo.watch}
              </p>
              {onLoadDemoPreset && (
                <button
                  type="button"
                  className="btn btn-sm btn-full"
                  onClick={() => {
                    onClose();
                    onLoadDemoPreset(activePreset.id, activeArticle.lesson.simDemo.scenario);
                  }}
                >
                  Launch Preset on Canvas →
                </button>
              )}
            </div>
          )}

          {/* Connected Interview Packs */}
          {linkedPacks.length > 0 && (
            <div>
              <div className="concepts-toc-section-title">Practice Packs ({linkedPacks.length})</div>
              <ul className="concepts-toc-list">
                {linkedPacks.map((pack) => (
                  <li key={pack.id}>
                    <button
                      type="button"
                      className="concepts-toc-link"
                      onClick={() => {
                        onClose();
                        onPracticePack?.(pack.id);
                      }}
                    >
                      {pack.title} →
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Glossary Terms */}
          {activeArticle.lesson.glossaryIds.length > 0 && onOpenGlossary && (
            <div>
              <div className="concepts-toc-section-title">Glossary Terms</div>
              <div className="concepts-tag-cloud">
                {activeArticle.lesson.glossaryIds.map((gId) => (
                  <button
                    key={gId}
                    type="button"
                    className="concepts-tag-pill"
                    onClick={() => {
                      onClose();
                      onOpenGlossary(gId);
                    }}
                  >
                    {GLOSSARY_BY_ID.get(gId)?.term ?? gId}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>,
    document.body
  );
}
