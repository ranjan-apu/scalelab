export function BuildingPane() {
  return (
    <div className="gd-pane">
      <h3>🧩 Assembling Your Architecture</h3>
      <p>
        ScaleLab provides <strong>33 specialized building blocks</strong> covering modern cloud systems:
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
          <li><strong>Annotations:</strong> Press <kbd>N</kbd> to drop sticky notes or <kbd>B</kbd> to frame functional zones with sections.</li>
        </ul>
      </div>
    </div>
  );
}
