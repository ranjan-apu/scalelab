export function OverviewPane() {
  return (
    <div className="gd-pane">
      <div className="gd-hero-card">
        <h3>⚡ Think in Events, Not Just Static Boxes</h3>
        <p>
          Traditional system design tools only show what a system <em>looks like</em>.
          <strong> ScaleLab simulates what happens when real traffic hits it</strong>:
          concurrency queues fill up, service times vary with Gamma distributions,
          databases saturate, and retry storms cascade.
        </p>
      </div>

      <div className="gd-grid-3">
        <div className="gd-step-card">
          <div className="gd-step-num">1</div>
          <h4>Build Topology</h4>
          <p>
            Drag components from the left palette (API Gateways, Microservices,
            Caches, Kafka brokers, Databases). Wire dependencies by dragging ports.
          </p>
        </div>

        <div className="gd-step-card">
          <div className="gd-step-num">2</div>
          <h4>Simulate Load</h4>
          <p>
            Hit <kbd>Space</kbd> or click <strong>Play</strong>. Dial up traffic with the
            top RPS slider. Watch colored packets flow along edges with real queue dynamics.
          </p>
        </div>

        <div className="gd-step-card">
          <div className="gd-step-num">3</div>
          <h4>Test Failures</h4>
          <p>
            Select nodes in the Inspector to drop cache hit rates, inject network delay,
            or kill nodes. Observe p99 latency spikes and add circuit breakers or autoscalers.
          </p>
        </div>
      </div>

      <div className="gd-callout">
        <strong>💡 Pro Tip:</strong> Use the <strong>Share</strong> button on the top right
        header to instantly copy a self-contained, shareable link carrying your entire design in the URL.
      </div>
    </div>
  );
}
