import { useMemo } from 'react';
import type { Topology } from '../sim/types';
import { KIND_NAME } from './nodeVisuals';
import { formatUsdPerMo, topologyCost } from '../sim/costs';
import './StudioPanel.css';

/* ------------------------------------------------------------------ *
 * Studio panel.
 *
 * The right dock when nothing is selected. A simulator's inspector has
 * nothing to say with no selection ("Select a component..."); a studio's
 * does — it reviews the whole design. This panel reviews cost today, and
 * gains the Advisor and the RFC document in the next pass, in this same
 * slot, without moving anything the reader has already learned.
 * ------------------------------------------------------------------ */

export interface StudioPanelProps {
  topology: Topology;
}

export function StudioPanel({ topology }: StudioPanelProps) {
  const cost = useMemo(() => topologyCost(topology), [topology]);

  return (
    <div className="stp">
      <p className="label stp-eyebrow">Studio review</p>
      {topology.nodes.length === 0 ? (
        <p className="stp-empty">
          Your design review lives here. Add components and it will estimate
          monthly cost, flag weak spots, and draft your RFC.
        </p>
      ) : (
        <>
          <div className="stp-hero">
            <span className="label">Est. cloud cost</span>
            <span className="num num-lg">{formatUsdPerMo(cost.totalUsdPerMo)}/mo</span>
          </div>
          {cost.lines.length > 0 ? (
            <ul className="stp-lines">
              {cost.lines.map((line) => (
                <li key={line.kind} className="stp-line">
                  <span className="stp-line-kind">
                    {line.components > 1 ? `${line.components}× ` : ''}
                    {KIND_NAME[line.kind]}
                  </span>
                  <span className="stp-line-sku">{line.sku}</span>
                  <span className="num stp-line-usd">
                    {formatUsdPerMo(line.usdPerMo * line.units)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="stp-empty">
              Nothing billable yet. Policies and patterns cost nothing to run.
            </p>
          )}
          {cost.unbilledComponents > 0 && (
            <p className="stp-note">
              {cost.unbilledComponents} component
              {cost.unbilledComponents === 1 ? '' : 's'} add
              {cost.unbilledComponents === 1 ? 's' : ''} no infrastructure cost.
            </p>
          )}
          <p className="stp-note stp-foot">
            Planning estimates, not a quote.
          </p>
        </>
      )}
    </div>
  );
}
