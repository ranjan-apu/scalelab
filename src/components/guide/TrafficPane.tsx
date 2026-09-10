export function TrafficPane() {
  return (
    <div className="gd-pane">
      <h3>📈 Controlling Traffic &amp; Reading Metrics</h3>

      <div className="gd-grid-2">
        <div className="gd-card-mini">
          <h4>Traffic Scenarios</h4>
          <p>The control deck under the canvas shapes <strong>how load arrives</strong>. One choice applies to every source at once:</p>
          <ul>
            <li><strong>Steady:</strong> Uniform rate for baseline benchmarking.</li>
            <li><strong>Ramp:</strong> Climbs to full load, then holds.</li>
            <li><strong>Spike:</strong> Periodic 4x surges to test queue absorption.</li>
            <li><strong>Diurnal:</strong> Realistic 24-hour day/night oscillation waves.</li>
          </ul>
        </div>

        <div className="gd-card-mini">
          <h4>Live Packet Visualizer</h4>
          <p>Packets flowing across edges are color-coded in real time:</p>
          <ul>
            <li><span className="gd-dot is-green" /> <strong>Green:</strong> Successful request within SLA.</li>
            <li><span className="gd-dot is-yellow" /> <strong>Orange / Yellow:</strong> Experiencing queueing delay.</li>
            <li><span className="gd-dot is-red" /> <strong>Red:</strong> Dropped or timed out request.</li>
          </ul>
        </div>
      </div>

      <div className="gd-subsection">
        <h4>Observability Dashboard (Bottom Strip)</h4>
        <p>
          The bottom strip reports true percentiles computed over trailing windows:
        </p>
        <ul>
          <li><strong>Throughput (RPS):</strong> Total requests processed vs offered load.</li>
          <li><strong>Latency (p50, p90, p99):</strong> 50th, 90th, and 99th percentile response times. Notice how tail latency explodes long before p50 shifts!</li>
          <li><strong>Queue Depth:</strong> Backlogs accumulating in front of downstream databases or async workers.</li>
        </ul>
      </div>
    </div>
  );
}
