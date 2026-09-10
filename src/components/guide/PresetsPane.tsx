interface PresetsPaneProps {
  onClose: () => void;
  onOpenExamples?: () => void;
}

export function PresetsPane({
  onClose,
  onOpenExamples,
}: PresetsPaneProps) {
  return (
    <div className="gd-pane">
      <h3>🏛️ Explore Ready-to-Run Architecture Presets</h3>

      <div className="gd-grid-2">
        <div className="gd-card-mini">
          <h4>🏢 Production Reconstructions</h4>
          <p>Explore reverse-engineered real-world architectures from the <strong>Examples</strong> menu:</p>
          <ul>
            <li><strong>Discord:</strong> Millions of concurrent WebSockets &amp; guild fan-out.</li>
            <li><strong>Uber:</strong> Driver GPS stream ingestion &amp; dispatch lock contention.</li>
            <li><strong>Netflix:</strong> Open Connect CDN video delivery &amp; microservices.</li>
            <li><strong>Spotify:</strong> Metadata vector search &amp; audio track caching.</li>
            <li><strong>Stripe:</strong> Idempotent payment ledgers &amp; consistency under partition.</li>
          </ul>
        </div>

        <div className="gd-card-mini">
          <h4>⚡ Common Distributed Patterns</h4>
          <p>Study foundational patterns under varying load and failure injection:</p>
          <ul>
            <li><strong>Cache-Aside &amp; Write-Behind:</strong> Minimizing database load spikes.</li>
            <li><strong>Asynchronous Work Queues:</strong> Buffering bursty background jobs.</li>
            <li><strong>Circuit Breakers &amp; Shedders:</strong> Preventing cascading system collapse.</li>
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
      </div>
    </div>
  );
}
