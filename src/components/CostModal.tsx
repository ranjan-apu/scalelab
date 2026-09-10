import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Topology } from '../sim/types';
import { calculateCloudCosts } from '../content/cloudPricing';
import './CostModal.css';

interface CostModalProps {
  open: boolean;
  onClose: () => void;
  topology: Topology;
}

export function CostModal({ open, onClose, topology }: CostModalProps) {
  const [activeProvider, setActiveProvider] = useState<'aws' | 'gcp' | 'azure'>('aws');

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const cost = calculateCloudCosts(topology);

  return createPortal(
    <div className="cost-modal-scrim" onClick={onClose} role="presentation">
      <div
        className="cost-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cost-modal-title"
      >
        <header className="cost-modal-head">
          <div>
            <h2 id="cost-modal-title" className="cost-modal-title">
              ☁️ Multi-Cloud Infrastructure Cost Estimator
            </h2>
            <p className="cost-modal-desc">
              Estimated monthly public cloud spend across AWS, GCP, and Azure for this architecture.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-icon cost-modal-close"
            onClick={onClose}
            aria-label="Close cost calculator"
          >
            ✕
          </button>
        </header>

        <div className="cost-modal-cards">
          <div
            className={`cost-provider-card${activeProvider === 'aws' ? ' is-active' : ''}`}
            onClick={() => setActiveProvider('aws')}
          >
            <span className="cost-provider-name">Amazon Web Services</span>
            <span className="cost-provider-total">${cost.totalAws.toLocaleString()}</span>
            <span className="cost-provider-unit">/ month</span>
          </div>

          <div
            className={`cost-provider-card${activeProvider === 'gcp' ? ' is-active' : ''}`}
            onClick={() => setActiveProvider('gcp')}
          >
            <span className="cost-provider-name">Google Cloud (GCP)</span>
            <span className="cost-provider-total">${cost.totalGcp.toLocaleString()}</span>
            <span className="cost-provider-unit">/ month</span>
          </div>

          <div
            className={`cost-provider-card${activeProvider === 'azure' ? ' is-active' : ''}`}
            onClick={() => setActiveProvider('azure')}
          >
            <span className="cost-provider-name">Microsoft Azure</span>
            <span className="cost-provider-total">${cost.totalAzure.toLocaleString()}</span>
            <span className="cost-provider-unit">/ month</span>
          </div>
        </div>

        <div className="cost-modal-table-wrap scroll">
          {cost.components.length === 0 ? (
            <p className="cost-modal-empty">Canvas is empty. Add components to estimate infrastructure costs.</p>
          ) : (
            <table className="cost-modal-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Instances</th>
                  <th>Cloud Service SKU ({activeProvider.toUpperCase()})</th>
                  <th style={{ textAlign: 'right' }}>Monthly Cost</th>
                </tr>
              </thead>
              <tbody>
                {cost.components.map((c) => {
                  const sku = c[activeProvider];
                  const amount =
                    activeProvider === 'aws'
                      ? c.monthlyCostAws
                      : activeProvider === 'gcp'
                        ? c.monthlyCostGcp
                        : c.monthlyCostAzure;
                  return (
                    <tr key={c.nodeId}>
                      <td>
                        <strong>{c.nodeLabel}</strong> <span className="cost-kind-badge">`{c.kind}`</span>
                      </td>
                      <td>{c.instances}x</td>
                      <td>
                        {sku.serviceName}
                        <span className="cost-sku-detail"> · {sku.skuName}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>${amount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <footer className="cost-modal-footer">
          <p className="cost-modal-hint">
            *Pricing based on US-East on-demand cloud pricing. Data transfer & I/O operations estimated at standard baseline.
          </p>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
