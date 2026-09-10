export function ResiliencePane() {
  return (
    <div className="gd-pane">
      <div className="gd-advisor-spotlight">
        <div className="gd-advisor-spotlight-head">
          <h4>🛡️ Architectural Health &amp; Resilience Advisor</h4>
          <span className="gd-advisor-pill-sample">
            <span style={{ color: 'currentColor' }}>●</span> Resilient / SPOF Linter
          </span>
        </div>
        <p>
          ScaleLab continuously inspects your active topology for distributed systems anti-patterns, bottlenecks, and reliability vulnerabilities in real-time. Check the health telemetry badge in the top header or click it to slide out the Advisor Drawer.
        </p>
        <div className="gd-advisor-features">
          <div className="gd-advisor-item">
            <strong>⚠️ Single Point of Failure (SPOF)</strong>
            <span>Flags critical single-instance databases, queues, or gateways whose failure brings down the system.</span>
          </div>
          <div className="gd-advisor-item">
            <strong>🌊 Unbuffered Write Floods</strong>
            <span>Detects direct synchronous writes to transactional databases without Kafka/SQS buffering.</span>
          </div>
          <div className="gd-advisor-item">
            <strong>🎯 1-Click Focus &amp; Mitigate</strong>
            <span>Click &quot;Focus Node&quot; inside the Advisor Drawer to zoom right to the vulnerable node on your canvas.</span>
          </div>
        </div>
      </div>

      <div className="gd-subsection">
        <h4>💥 Fault Injection &amp; Chaos Engineering</h4>
        <p className="gd-subtext">
          Simulate how cascading failures propagate under load before deploying architectures to production:
        </p>

        <div className="gd-resilience-grid">
          <div className="gd-resilience-card">
            <h4>🌪️ The Retry Storm</h4>
            <p>
              When downstream databases slow down, clients timeout and retry. Without backoff and jitter, retries multiply incoming traffic, turning minor latency hiccups into complete outages.
            </p>
            <span className="gd-tag">Remediation: Exponential backoff &amp; jitter</span>
          </div>

          <div className="gd-resilience-card">
            <h4>⚡ Circuit Breakers</h4>
            <p>
              Place Circuit Breakers before brittle dependencies. When failures breach thresholds, they trip <em>Open</em> immediately to fail fast, and probe with <em>Half-Open</em> to safely recover.
            </p>
            <span className="gd-tag">Pattern: Fail-fast &amp; graceful degradation</span>
          </div>

          <div className="gd-resilience-card">
            <h4>📉 Cache Stampede / Degradation</h4>
            <p>
              Drop cache hit rates in the Inspector from 95% to 70%. Watch the backend database saturate and collapse as 6x more unbuffered queries leak through to disk.
            </p>
            <span className="gd-tag">Remediation: Cache warming &amp; read replicas</span>
          </div>

          <div className="gd-resilience-card">
            <h4>📦 Message Consumer Lag</h4>
            <p>
              Inject high-throughput bursts into Kafka or queue brokers. Observe consumer lag spike when workers are slow, and scale worker pools horizontally to recover throughput.
            </p>
            <span className="gd-tag">Remediation: Autoscaling worker pools</span>
          </div>
        </div>
      </div>
    </div>
  );
}
