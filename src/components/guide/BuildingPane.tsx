export function BuildingPane() {
  return (
    <div className="gd-pane">
      <h3>🧩 Assembling Your Architecture</h3>
      <p>
        ScaleLab provides <strong>34 specialized building blocks</strong> covering modern cloud systems:
      </p>

      <div className="gd-feature-list">
        <div className="gd-feature-item">
          <strong>🌐 Ingress &amp; Routing:</strong>
          <span>Client traffic generator, Load Balancer, API Gateway, CDN, Edge Compute.</span>
        </div>
        <div className="gd-feature-item">
          <strong>⚙️ Compute &amp; Processing:</strong>
          <span>Microservice, Async Worker, Serverless Lambda, Cron Burst worker.</span>
        </div>
        <div className="gd-feature-item">
          <strong>⚡ Caching &amp; Buffering:</strong>
          <span>In-Memory Cache (Redis/Memcached), Write-Behind Buffer.</span>
        </div>
        <div className="gd-feature-item">
          <strong>💾 Storage &amp; Databases:</strong>
          <span>Primary DB, Read Replicas, Sharded DB, Object Store (S3), Vector DB, Search Index.</span>
        </div>
        <div className="gd-feature-item">
          <strong>📨 Streaming &amp; Messaging:</strong>
          <span>Message Queue (RabbitMQ), Stream Broker (Kafka), Pub/Sub Topic, Dead-Letter Queue.</span>
        </div>
        <div className="gd-feature-item">
          <strong>🛡️ Resilience &amp; Control:</strong>
          <span>Circuit Breaker, Rate Limiter, Bulkhead, Load Shedder, Autoscaler Controller.</span>
        </div>
      </div>

      <div className="gd-subsection">
        <h4>Connecting &amp; Wiring</h4>
        <ul>
          <li><strong>Drag a port:</strong> Click and drag from any component&apos;s port handle to a downstream target.</li>
          <li><strong>Control edges:</strong> Connect an Autoscaler controller to a Microservice to scale instances automatically.</li>
        </ul>
      </div>

      <div className="gd-subsection">
        <h4>✏️ Draw.io Diagramming &amp; Documentation Tools</h4>
        <p className="gd-subtext">
          Document real-world designs, draw system boundaries, and sketch interview notes directly on the canvas:
        </p>
        <div className="gd-draw-grid">
          <div className="gd-draw-item">
            <div className="gd-draw-title">
              <span className="gd-draw-icon">🖊️</span>
              <strong>Freehand Pen / Marker</strong>
              <kbd>P</kbd>
            </div>
            <p>
              Draw smooth freehand ink strokes, arrows, bottlenecks, and handwritten notes with quadratic SVG smoothing. Customize stroke width (1–32px), opacity, and 5 theme tones in the Inspector. Press <kbd>Esc</kbd> or <kbd>P</kbd> to disarm.
            </p>
          </div>
          <div className="gd-draw-item">
            <div className="gd-draw-title">
              <span className="gd-draw-icon">📦</span>
              <strong>Normal Boxes &amp; Cards</strong>
              <kbd>T</kbd>
            </div>
            <p>
              Press <kbd>T</kbd> and click the canvas to add a box. Switch between <strong>Normal Box (Outline)</strong> for clean flowchart rectangles and boundaries, <strong>Sticky Note</strong> for callouts, or <strong>Requirements Card</strong> for interview templates.
            </p>
          </div>
          <div className="gd-draw-item">
            <div className="gd-draw-title">
              <span className="gd-draw-icon">✍️</span>
              <strong>Just text</strong>
              <span>double-click canvas</span>
            </div>
            <p>
              Double-click anywhere empty and start typing: a plain text label lands where the pointer was, with no box, title bar or border around it. It is the same free-standing text the example designs use to explain a diagram. Type nothing and click away and nothing is placed at all.
            </p>
          </div>
          <div className="gd-draw-item">
            <div className="gd-draw-title">
              <span className="gd-draw-icon">📝</span>
              <strong>Playground</strong>
              <span>right dock</span>
            </div>
            <p>
              The rail's Playground button opens a written answer sheet beside the canvas: requirements, entities, API, high-level design, and deep dives. Type in it like any text field, copy a step or the whole sheet as Markdown, and drop any step onto the board as a note. It stays with the design, travels in a share link, and appears in the exported RFC.
            </p>
          </div>
          <div className="gd-draw-item">
            <div className="gd-draw-title">
              <span className="gd-draw-icon">🔤</span>
              <strong>Typography &amp; Styling</strong>
              <span className="badge">Inspector</span>
            </div>
            <p>
              Format text in Interface (Sans), Serif, or Monospace typefaces. Scale font sizes (S/M/L) and toggle Bold or Italic formatting.
            </p>
          </div>
          <div className="gd-draw-item">
            <div className="gd-draw-title">
              <span className="gd-draw-icon">🖼️</span>
              <strong>Notes &amp; Section Frames</strong>
              <kbd>N</kbd> <kbd>B</kbd>
            </div>
            <p>
              Drop plain text notes (<kbd>N</kbd>) or drag colored section frames (<kbd>B</kbd>) behind nodes to demarcate architectural tiers like VPCs, regions, and clusters.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
