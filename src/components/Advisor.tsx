import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePresence } from './presence';
import { analyzeArchitecture } from '../sim/advisor';
import type { Finding, FindingSeverity } from '../sim/advisor';
import type { Topology } from '../sim/types';
import { exportToDockerCompose, exportToMermaid } from '../exportFormats';
import './Advisor.css';

export interface AdvisorProps {
  open: boolean;
  onClose: () => void;
  topology: Topology;
  onSelectNode?: (id: string) => void;
  onNotify?: (text: string) => void;
}

export function Advisor({
  open,
  onClose,
  topology,
  onSelectNode,
  onNotify,
}: AdvisorProps) {
  const { mounted, closing, unmount } = usePresence(open);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [filter, setFilter] = useState<FindingSeverity | 'all'>('all');

  const audit = useMemo(() => analyzeArchitecture(topology), [topology]);

  useEffect(() => {
    if (!open) return;
    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cardRef.current?.focus();
    return () => opener?.focus();
  }, [open]);

  const visibleFindings = useMemo(() => {
    if (filter === 'all') return audit.findings;
    return audit.findings.filter((f) => f.severity === filter);
  }, [audit.findings, filter]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of topology.nodes) {
      map.set(n.id, n.label);
    }
    return map;
  }, [topology.nodes]);

  const handleCopyMermaid = async () => {
    const code = exportToMermaid(topology);
    try {
      await navigator.clipboard.writeText(code);
      onNotify?.('Copied Mermaid flowchart to clipboard');
    } catch {
      onNotify?.('Could not copy to clipboard');
    }
  };

  const handleDownloadDockerCompose = () => {
    const yaml = exportToDockerCompose(topology);
    const blob = new Blob([yaml], { type: 'application/x-yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'docker-compose.yml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify?.('Downloaded docker-compose.yml');
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className={`adv-root${closing ? ' is-closing' : ''}`}
      inert={closing || undefined}
    >
      <div className="adv-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={cardRef}
        className="adv-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adv-title"
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
        <header className="adv-head">
          <div className="adv-title-wrap">
            <span className={`adv-grade adv-grade-${audit.grade}`}>
              {audit.grade}
            </span>
            <div>
              <h2 id="adv-title" className="adv-title">
                Architecture Advisor
              </h2>
              <p className="adv-sub">
                Health Score: {audit.score}/100 · {audit.findings.length}{' '}
                {audit.findings.length === 1 ? 'observation' : 'observations'} across{' '}
                {topology.nodes.length} components
              </p>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="adv-body">
          {/* Category Scores */}
          <div className="adv-categories">
            {audit.categoryScores.map((cat) => (
              <div key={cat.category} className="adv-cat-card">
                <div className="adv-cat-header">
                  <span>{cat.label}</span>
                  <span>{cat.score}%</span>
                </div>
                <div className="adv-cat-bar-bg">
                  <div
                    className="adv-cat-bar-fill"
                    style={{ width: `${cat.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Filter Tabs */}
          <div className="adv-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              className={`adv-tab${filter === 'all' ? ' is-active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({audit.findings.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'critical'}
              className={`adv-tab${filter === 'critical' ? ' is-active' : ''}`}
              onClick={() => setFilter('critical')}
            >
              Critical ({audit.summary.criticalCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'warning'}
              className={`adv-tab${filter === 'warning' ? ' is-active' : ''}`}
              onClick={() => setFilter('warning')}
            >
              Warnings ({audit.summary.warningCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'info'}
              className={`adv-tab${filter === 'info' ? ' is-active' : ''}`}
              onClick={() => setFilter('info')}
            >
              Suggestions ({audit.summary.infoCount})
            </button>
          </div>

          {/* Findings List */}
          {visibleFindings.length === 0 ? (
            <div className="adv-empty">
              <div className="adv-empty-title">Well-Architected!</div>
              <p>
                {filter === 'all'
                  ? 'No architectural anti-patterns detected in this design.'
                  : `No ${filter} issues detected in this design.`}
              </p>
            </div>
          ) : (
            <div className="adv-findings">
              {visibleFindings.map((f: Finding) => (
                <div
                  key={f.id}
                  className={`adv-finding-item is-${f.severity}`}
                >
                  <div className="adv-finding-header">
                    <div className="adv-finding-title-row">
                      <span className={`adv-badge adv-badge-${f.severity}`}>
                        {f.severity}
                      </span>
                      <h3 className="adv-finding-title">{f.title}</h3>
                    </div>
                  </div>

                  <p className="adv-finding-desc">{f.description}</p>

                  {f.nodeIds.length > 0 && (
                    <div className="adv-nodes-row">
                      <span className="adv-nodes-label">Affected:</span>
                      {f.nodeIds.map((nid) => (
                        <button
                          key={nid}
                          type="button"
                          className="adv-node-pill"
                          title="Select component on canvas"
                          onClick={() => {
                            onSelectNode?.(nid);
                            onClose();
                          }}
                        >
                          {nodeMap.get(nid) ?? nid}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="adv-remediation">
                    <strong>Remediation:</strong> {f.remediation}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="adv-foot">
          <div className="adv-foot-actions">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={handleCopyMermaid}
              title="Copy Mermaid.js flowchart markdown"
            >
              Copy Mermaid
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={handleDownloadDockerCompose}
              title="Download docker-compose.yml for local testing"
            >
              Export Docker Compose
            </button>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
