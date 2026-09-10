import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Topology } from '../sim/types';
import { auditTopology } from '../sim/advisor';
import './AdvisorDrawer.css';

interface AdvisorDrawerProps {
  open: boolean;
  onClose: () => void;
  topology: Topology;
  onSelectNodes: (nodeIds: string[]) => void;
}

export function AdvisorDrawer({
  open,
  onClose,
  topology,
  onSelectNodes,
}: AdvisorDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const findings = auditTopology(topology);
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;

  return createPortal(
    <div className="adv-scrim" onClick={onClose} role="presentation">
      <aside
        className="adv-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="adv-title"
      >
        <header className="adv-head">
          <div>
            <div className="adv-title-row">
              <span className="adv-shield-icon">🛡️</span>
              <h2 id="adv-title" className="adv-title">
                Architectural Advisor
              </h2>
            </div>
            <p className="adv-subtitle">
              Automated system design audit: anti-pattern detection &amp; reliability analysis.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-icon adv-close"
            onClick={onClose}
            aria-label="Close advisor"
          >
            ✕
          </button>
        </header>

        <div className="adv-summary-bar">
          <span className={`adv-pill is-critical${criticalCount === 0 ? ' is-zero' : ''}`}>
            {criticalCount} Critical
          </span>
          <span className={`adv-pill is-warning${warningCount === 0 ? ' is-zero' : ''}`}>
            {warningCount} Warnings
          </span>
          <span className="adv-pill is-info">
            {findings.length === 0 ? 'Healthy Architecture' : `${findings.length} Total Suggestions`}
          </span>
        </div>

        <div className="adv-body scroll">
          {findings.length === 0 ? (
            <div className="adv-healthy-state">
              <div className="adv-healthy-icon">✨</div>
              <h3>No Architectural Anti-Patterns Detected</h3>
              <p>
                Your topology follows distributed systems resilience standards: no single points of failure (SPOFs),
                protected ingress, and isolated write paths.
              </p>
            </div>
          ) : (
            <div className="adv-findings-list">
              {findings.map((f) => (
                <div key={f.id} className={`adv-card is-${f.severity}`}>
                  <div className="adv-card-top">
                    <span className={`adv-badge is-${f.severity}`}>{f.severity.toUpperCase()}</span>
                    <span className="adv-category">{f.category.toUpperCase()}</span>
                  </div>
                  <h4 className="adv-card-title">{f.title}</h4>
                  <p className="adv-card-desc">{f.description}</p>
                  <div className="adv-recommendation">
                    <strong>💡 Recommendation: </strong>
                    {f.recommendation}
                  </div>
                  {f.nodeIds && f.nodeIds.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-sm adv-inspect-btn"
                      onClick={() => {
                        onSelectNodes(f.nodeIds);
                        onClose();
                      }}
                    >
                      Focus Affected Component{f.nodeIds.length > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="adv-footer">
          <button type="button" className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>
            Done Reviewing
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
