export function ResiliencePane() {
  return (
    <div className="gd-pane">
      <h3>💥 Fault Injection &amp; Resilience Patterns</h3>
      <p>
        The primary purpose of ScaleLab is discovering how systems break <em>before</em> shipping to production.
      </p>

      <div className="gd-resilience-grid">
        <div className="gd-resilience-card">
          <h4>🌪️ The Retry Storm</h4>
          <p>
            When a database slows down, clients timeout and retry. Without backoff and jitter, retries multiply incoming traffic, turning a minor hiccup into a total outage.
          </p>
          <span className="gd-tag">Remediation: Circuit breakers &amp; exponential backoff</span>
        </div>

        <div className="gd-resilience-card">
          <h4>⚡ Circuit Breakers</h4>
          <p>
            Place a <strong>Circuit Breaker</strong> in front of brittle dependencies. When failures breach the threshold, it trips <em>Open</em> immediately failing fast, and probes with <em>Half-Open</em> to safely recover.
          </p>
          <span className="gd-tag">Pattern: Fail-fast &amp; graceful degradation</span>
        </div>

        <div className="gd-resilience-card">
          <h4>📉 Cache Stampede / Degradation</h4>
          <p>
            Drop cache hit rate in the Inspector from 95% to 70%. Watch the database get overwhelmed as 6x more queries leak through to disk.
          </p>
          <span className="gd-tag">Remediation: Cache warming &amp; read replicas</span>
        </div>

        <div className="gd-resilience-card">
          <h4>📦 Message Consumer Lag</h4>
          <p>
            Send high-throughput bursts into a <strong>Kafka Stream Broker</strong> or <strong>Queue</strong>. Observe consumer lag when workers are slow, and scale worker instances to catch up.
          </p>
          <span className="gd-tag">Remediation: Autoscaling worker pools</span>
        </div>
      </div>
    </div>
  );
}
