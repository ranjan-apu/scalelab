import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePresence } from '../presence';
import type { GuideProps, GuideTab, TabDef } from './types';
import { OverviewPane } from './OverviewPane';
import { BuildingPane } from './BuildingPane';
import { TrafficPane } from './TrafficPane';
import { ResiliencePane } from './ResiliencePane';
import { PresetsPane } from './PresetsPane';
import { ShortcutsPane } from './ShortcutsPane';
import './Guide.css';

const TABS: TabDef[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  },
  {
    id: 'building',
    label: 'Building Systems',
    icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  },
  {
    id: 'traffic',
    label: 'Traffic & Metrics',
    icon: 'M3 3v18h18M18 17l-5-5-4 4-6-6',
  },
  {
    id: 'resilience',
    label: 'Failure & Resilience',
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10M9 12l2 2 4-4',
  },
  {
    id: 'presets',
    label: 'Presets & Challenges',
    badge: '22+',
    icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  },
  {
    id: 'shortcuts',
    label: 'Pro Tips & Keys',
    icon: 'M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3zM6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z',
  },
];

export function GuideModal({
  open,
  onClose,
  onOpenExamples,
  onOpenChallenges,
}: GuideProps) {
  const { mounted, closing, unmount } = usePresence(open);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<GuideTab>('overview');

  /* Restore opener focus on close */
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
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`gd-root${closing ? ' is-closing' : ''}`}
      inert={closing || undefined}
    >
      <div className="gd-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={cardRef}
        className="gd-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gd-title"
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
        <header className="gd-head">
          <div className="gd-head-lead">
            <div className="gd-badge-pill">ScaleLab Guide</div>
            <h2 id="gd-title" className="gd-title">
              How to Use ScaleLab
            </h2>
            <p className="gd-subtitle">
              A discrete-event distributed system simulator &amp; scale testing platform
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={onClose}
            aria-label="Close guide"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <nav className="gd-nav" role="tablist" aria-label="Guide sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`gd-tab${activeTab === tab.id ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <svg
                className="gd-tab-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={tab.icon} />
              </svg>
              <span>{tab.label}</span>
              {tab.badge && <span className="gd-tab-badge">{tab.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="gd-body" role="tabpanel">
          {activeTab === 'overview' && <OverviewPane />}
          {activeTab === 'building' && <BuildingPane />}
          {activeTab === 'traffic' && <TrafficPane />}
          {activeTab === 'resilience' && <ResiliencePane />}
          {activeTab === 'presets' && (
            <PresetsPane
              onClose={onClose}
              onOpenExamples={onOpenExamples}
              onOpenChallenges={onOpenChallenges}
            />
          )}
          {activeTab === 'shortcuts' && <ShortcutsPane />}
        </div>

        <footer className="gd-foot">
          <div className="gd-foot-info">
            Press <kbd>Esc</kbd> anytime to close
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Got it, let&apos;s build
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
