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
          <h4>Build &amp; Diagram</h4>
          <p>
            Drag cloud components, wire ports, and use <strong>draw.io tools</strong> (Normal Boxes, Sticky Notes, and Freehand Markers) to design your architecture.
          </p>
        </div>

        <div className="gd-step-card">
          <div className="gd-step-num">2</div>
          <h4>Design or Simulate</h4>
          <p>
            Toggle <strong>Design</strong> for pure diagramming, or <strong>Simulate</strong> to dial up traffic with the studio control deck and watch real queue dynamics.
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
        <strong>Studio review:</strong> press <strong>I</strong> with an empty canvas to estimate this design in monthly cloud cost. Open <strong>Interview practice</strong> from the menu to walk requirements, API, and deep dives for classic problems, then pin each section onto the canvas and load its starter system.
      </div>

      <div className="gd-callout">
        <strong>💡 Pro Tip:</strong> Use the <strong>Share</strong> button on the top right
        header to instantly copy a self-contained, shareable link carrying your entire design in the URL.
      </div>
    </div>
  );
}
