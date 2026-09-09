interface PresetsPaneProps {
  onClose: () => void;
  onOpenExamples?: () => void;
  onOpenChallenges?: () => void;
}

export function PresetsPane({
  onClose,
  onOpenExamples,
  onOpenChallenges,
}: PresetsPaneProps) {
  return (
    <div className="gd-pane">
      <h3>🏛️ Explore Ready-to-Run Presets &amp; Challenges</h3>

      <div className="gd-grid-2">
        <div className="gd-card-mini">
          <h4>🏢 Production Reconstructions</h4>
          <p>Explore reverse-engineered architectures from the <strong>Examples</strong> menu:</p>
          <ul>
            <li><strong>Discord:</strong> Millions of concurrent WebSockets &amp; guild fan-out.</li>
            <li><strong>Uber:</strong> Driver GPS stream ingestion &amp; dispatch lock contention.</li>
            <li><strong>Netflix:</strong> Open Connect CDN video delivery &amp; microservices.</li>
            <li><strong>Spotify:</strong> Metadata vector search &amp; audio track caching.</li>
            <li><strong>Stripe:</strong> Idempotent payment ledgers &amp; consistency under partition.</li>
          </ul>
        </div>

        <div className="gd-card-mini">
          <h4>🎯 Interactive Challenges</h4>
          <p>Test your intuition with hands-on debugging challenges:</p>
          <ul>
            <li><strong>Hold the Line:</strong> Keep p99 under 200ms at 150 RPS on an overloaded service.</li>
            <li><strong>More Machines:</strong> Scale out a bottlenecked cluster under 600 RPS without dropping packets.</li>
            <li><strong>Stop the Storm:</strong> Extinguish a self-inflicted 100% outage caused by aggressive retries.</li>
          </ul>
        </div>
      </div>

      <div className="gd-actions-row">
        {onOpenExamples && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              onClose();
              onOpenExamples();
            }}
          >
            Browse Presets &amp; Examples
          </button>
        )}
        {onOpenChallenges && (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              onClose();
              onOpenChallenges();
            }}
          >
            Open Challenges Drawer
          </button>
        )}
      </div>
    </div>
  );
}
