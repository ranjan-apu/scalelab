import type { CSSProperties } from 'react';

export type DiagramType =
  | 'consistent-hash-ring'
  | 'cache-aside-flow'
  | 'sharding-architecture'
  | 'concurrency-control'
  | 'queue-stream-partitions'
  | 'blob-presigned-upload'
  | 'circuit-breaker-fsm'
  | 'networking-protocols'
  | 'saga-pattern'
  | 'rate-limiter-token-bucket'
  | 'system-architecture-overview';

interface ConceptDiagramProps {
  type: DiagramType;
  className?: string;
  title?: string;
}

export function ConceptDiagram({ type, className, title }: ConceptDiagramProps) {
  const containerStyle: CSSProperties = {
    width: '100%',
    maxWidth: '760px',
    margin: 'var(--sp-4) auto',
    borderRadius: 'var(--r-md)',
    border: 'var(--bw) solid var(--border)',
    background: 'var(--surface-raised)',
    padding: 'var(--sp-3)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
  };

  const renderContent = () => {
    switch (type) {
      case 'consistent-hash-ring':
        return (
          <svg viewBox="0 0 600 360" width="100%" height="100%" aria-label="Consistent Hashing Ring Diagram">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--text-dim)" />
              </marker>
              <marker id="arrow-accent" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--accent)" />
              </marker>
            </defs>

            {/* Circular Ring */}
            <circle cx="280" cy="180" r="120" fill="none" stroke="var(--border-strong)" strokeWidth="3" strokeDasharray="6 4" />
            <text x="280" y="185" textAnchor="middle" fill="var(--text-dim)" fontSize="12" fontWeight="bold">
              360° Hash Ring (0 .. 2³²-1)
            </text>

            {/* Direction indicator */}
            <path d="M 380 90 A 135 135 0 0 1 415 180" fill="none" stroke="var(--accent)" strokeWidth="2" markerEnd="url(#arrow-accent)" />
            <text x="430" y="130" fill="var(--accent)" fontSize="11" fontWeight="600">Clockwise Route</text>

            {/* Physical & Virtual Nodes */}
            <circle cx="280" cy="60" r="16" fill="var(--k-blue, #3b82f6)" />
            <text x="280" y="64" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">A₁</text>
            <text x="280" y="38" textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="600">Server A (v1)</text>

            <circle cx="384" cy="240" r="16" fill="var(--k-green, #10b981)" />
            <text x="384" y="244" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">B₁</text>
            <text x="425" y="255" textAnchor="start" fill="var(--text)" fontSize="11" fontWeight="600">Server B (v1)</text>

            <circle cx="176" cy="240" r="16" fill="var(--k-purple, #8b5cf6)" />
            <text x="176" y="244" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">C₁</text>
            <text x="135" y="255" textAnchor="end" fill="var(--text)" fontSize="11" fontWeight="600">Server C (v1)</text>

            <circle cx="280" cy="300" r="14" fill="var(--k-blue, #3b82f6)" opacity="0.8" />
            <text x="280" y="304" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">A₂</text>
            <text x="280" y="328" textAnchor="middle" fill="var(--text-dim)" fontSize="10">Server A (v2)</text>

            <circle cx="176" cy="120" r="14" fill="var(--k-green, #10b981)" opacity="0.8" />
            <text x="176" y="124" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">B₂</text>
            <text x="135" y="115" textAnchor="end" fill="var(--text-dim)" fontSize="10">Server B (v2)</text>

            {/* Key mappings */}
            <rect x="340" y="90" width="10" height="10" fill="var(--k-amber, #f59e0b)" rx="2" />
            <text x="360" y="100" fill="var(--text)" fontSize="11">Key &quot;user_42&quot;</text>
            <path d="M 345 105 L 375 225" stroke="var(--k-amber, #f59e0b)" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arrow)" />

            <rect x="190" y="270" width="10" height="10" fill="var(--k-amber, #f59e0b)" rx="2" />
            <text x="135" y="295" fill="var(--text)" fontSize="11">Key &quot;order_99&quot;</text>
            <path d="M 205 275 L 265 295" stroke="var(--k-amber, #f59e0b)" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arrow)" />

            {/* Legend */}
            <g transform="translate(450, 20)">
              <rect x="0" y="0" width="140" height="75" rx="6" fill="var(--surface)" stroke="var(--border)" />
              <circle cx="15" cy="18" r="6" fill="var(--k-blue, #3b82f6)" />
              <text x="28" y="22" fill="var(--text-dim)" fontSize="10">Server A replicas</text>
              <circle cx="15" cy="38" r="6" fill="var(--k-green, #10b981)" />
              <text x="28" y="42" fill="var(--text-dim)" fontSize="10">Server B replicas</text>
              <circle cx="15" cy="58" r="6" fill="var(--k-purple, #8b5cf6)" />
              <text x="28" y="62" fill="var(--text-dim)" fontSize="10">Server C replicas</text>
            </g>
          </svg>
        );

      case 'cache-aside-flow':
        return (
          <svg viewBox="0 0 620 280" width="100%" height="100%" aria-label="Cache-Aside Pattern Flow">
            <defs>
              <marker id="c-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--accent)" />
              </marker>
              <marker id="c-gray" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--text-dim)" />
              </marker>
            </defs>

            <g transform="translate(30, 90)">
              <rect width="110" height="70" rx="8" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2" />
              <text x="55" y="32" textAnchor="middle" fill="var(--text)" fontSize="12" fontWeight="bold">Client / App</text>
              <text x="55" y="50" textAnchor="middle" fill="var(--text-dim)" fontSize="10">Web / Mobile</text>
            </g>

            <g transform="translate(250, 30)">
              <rect width="130" height="70" rx="8" fill="var(--surface)" stroke="var(--k-blue, #3b82f6)" strokeWidth="2" />
              <text x="65" y="30" textAnchor="middle" fill="var(--k-blue, #3b82f6)" fontSize="12" fontWeight="bold">Distributed Cache</text>
              <text x="65" y="48" textAnchor="middle" fill="var(--text-dim)" fontSize="10">Redis / Memcached</text>
              <text x="65" y="62" textAnchor="middle" fill="var(--k-green, #10b981)" fontSize="9" fontWeight="600">~1ms In-Memory</text>
            </g>

            <g transform="translate(470, 90)">
              <rect width="120" height="70" rx="8" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2" />
              <text x="60" y="30" textAnchor="middle" fill="var(--text)" fontSize="12" fontWeight="bold">Primary DB</text>
              <text x="60" y="48" textAnchor="middle" fill="var(--text-dim)" fontSize="10">Postgres / MySQL</text>
              <text x="60" y="62" textAnchor="middle" fill="var(--text-dim)" fontSize="9">~20-50ms Disk</text>
            </g>

            <path d="M 140 110 Q 200 65 245 65" fill="none" stroke="var(--accent)" strokeWidth="2" markerEnd="url(#c-arrow)" />
            <text x="180" y="70" fill="var(--accent)" fontSize="11" fontWeight="600">1. Check Cache</text>

            <path d="M 245 85 Q 190 95 145 125" fill="none" stroke="var(--k-green, #10b981)" strokeWidth="2" strokeDasharray="4 2" markerEnd="url(#c-arrow)" />
            <text x="165" y="115" fill="var(--k-green, #10b981)" fontSize="10" fontWeight="bold">Hit: Return Data</text>

            <path d="M 140 140 L 465 140" fill="none" stroke="var(--text-dim)" strokeWidth="2" markerEnd="url(#c-gray)" />
            <text x="290" y="155" textAnchor="middle" fill="var(--text-dim)" fontSize="11">2. Miss: Query Database</text>

            <path d="M 470 115 Q 400 65 385 65" fill="none" stroke="var(--k-blue, #3b82f6)" strokeWidth="2" strokeDasharray="4 2" markerEnd="url(#c-arrow)" />
            <text x="430" y="75" fill="var(--k-blue, #3b82f6)" fontSize="10" fontWeight="600">3. Write to Cache</text>

            <text x="310" y="240" textAnchor="middle" fill="var(--text-dim)" fontSize="11" fontStyle="italic">
              Cache-Aside decouples cache from database storage; client handles population &amp; fallbacks.
            </text>
          </svg>
        );

      case 'sharding-architecture':
        return (
          <svg viewBox="0 0 620 300" width="100%" height="100%" aria-label="Database Sharding Architecture">
            <g transform="translate(20, 110)">
              <rect width="130" height="80" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
              <text x="65" y="32" textAnchor="middle" fill="var(--accent)" fontSize="12" fontWeight="bold">Shard Router</text>
              <text x="65" y="50" textAnchor="middle" fill="var(--text-dim)" fontSize="10">hash(key) % N</text>
              <text x="65" y="66" textAnchor="middle" fill="var(--text)" fontSize="9">Routing Gateway</text>
            </g>

            <g transform="translate(240, 20)">
              <rect width="160" height="56" rx="6" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.5" />
              <text x="80" y="24" textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="bold">Shard 0 (IDs 0..25%)</text>
              <text x="80" y="42" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Primary + Read Replica</text>
            </g>

            <g transform="translate(240, 90)">
              <rect width="160" height="56" rx="6" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.5" />
              <text x="80" y="24" textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="bold">Shard 1 (IDs 25..50%)</text>
              <text x="80" y="42" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Primary + Read Replica</text>
            </g>

            <g transform="translate(240, 160)">
              <rect width="160" height="56" rx="6" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.5" />
              <text x="80" y="24" textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="bold">Shard 2 (IDs 50..75%)</text>
              <text x="80" y="42" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Primary + Read Replica</text>
            </g>

            <g transform="translate(240, 230)">
              <rect width="160" height="56" rx="6" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.5" />
              <text x="80" y="24" textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="bold">Shard 3 (IDs 75..100%)</text>
              <text x="80" y="42" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Primary + Read Replica</text>
            </g>

            <path d="M 150 135 L 235 48" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 3" />
            <path d="M 150 145 L 235 118" stroke="var(--accent)" strokeWidth="1.5" />
            <path d="M 150 155 L 235 188" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 3" />
            <path d="M 150 165 L 235 258" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 3" />

            <g transform="translate(440, 95)">
              <rect width="160" height="90" rx="8" fill="var(--surface)" stroke="var(--k-amber, #f59e0b)" strokeWidth="1.5" />
              <text x="80" y="25" textAnchor="middle" fill="var(--k-amber, #f59e0b)" fontSize="11" fontWeight="bold">Scatter-Gather</text>
              <text x="80" y="45" textAnchor="middle" fill="var(--text)" fontSize="9">Queries lacking Shard Key</text>
              <text x="80" y="60" textAnchor="middle" fill="var(--text-dim)" fontSize="9">broadcasts to ALL shards</text>
              <text x="80" y="76" textAnchor="middle" fill="var(--k-amber, #f59e0b)" fontSize="8">High latency penalty</text>
            </g>
          </svg>
        );

      case 'circuit-breaker-fsm':
        return (
          <svg viewBox="0 0 620 260" width="100%" height="100%" aria-label="Circuit Breaker Finite State Machine">
            <g transform="translate(50, 90)">
              <circle cx="50" cy="50" r="45" fill="var(--surface)" stroke="var(--k-green, #10b981)" strokeWidth="3" />
              <text x="50" y="45" textAnchor="middle" fill="var(--k-green, #10b981)" fontSize="13" fontWeight="bold">CLOSED</text>
              <text x="50" y="62" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Normal Traffic</text>
            </g>

            <g transform="translate(470, 90)">
              <circle cx="50" cy="50" r="45" fill="var(--surface)" stroke="var(--k-amber, #ef4444)" strokeWidth="3" />
              <text x="50" y="45" textAnchor="middle" fill="var(--k-amber, #ef4444)" fontSize="13" fontWeight="bold">OPEN</text>
              <text x="50" y="62" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Fail Fast (503)</text>
            </g>

            <g transform="translate(260, 10)">
              <circle cx="50" cy="50" r="45" fill="var(--surface)" stroke="var(--k-blue, #3b82f6)" strokeWidth="3" />
              <text x="50" y="45" textAnchor="middle" fill="var(--k-blue, #3b82f6)" fontSize="12" fontWeight="bold">HALF-OPEN</text>
              <text x="50" y="62" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Trial Canary Req</text>
            </g>

            <path d="M 145 150 L 465 150" stroke="var(--k-amber, #ef4444)" strokeWidth="2" />
            <text x="310" y="170" textAnchor="middle" fill="var(--k-amber, #ef4444)" fontSize="10" fontWeight="600">
              Error rate exceeds threshold (&gt; 50%)
            </text>

            <path d="M 480 100 Q 420 30 355 45" fill="none" stroke="var(--k-blue, #3b82f6)" strokeWidth="2" />
            <text x="440" y="40" fill="var(--k-blue, #3b82f6)" fontSize="10">Sleep timeout expires (5s)</text>

            <path d="M 265 45 Q 200 30 140 100" fill="none" stroke="var(--k-green, #10b981)" strokeWidth="2" />
            <text x="140" y="40" fill="var(--k-green, #10b981)" fontSize="10">Canary trial succeeds</text>

            <path d="M 355 70 Q 410 80 470 110" fill="none" stroke="var(--k-amber, #ef4444)" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="420" y="100" fill="var(--k-amber, #ef4444)" fontSize="9">Canary fails</text>

            <text x="310" y="240" textAnchor="middle" fill="var(--text-dim)" fontSize="11">
              Prevents cascading failure storms by breaking client requests before exhausting downstream thread pools.
            </text>
          </svg>
        );

      case 'queue-stream-partitions':
        return (
          <svg viewBox="0 0 620 280" width="100%" height="100%" aria-label="Event Streaming and Partitioned Logs">
            <g transform="translate(20, 95)">
              <rect width="100" height="70" rx="6" fill="var(--surface)" stroke="var(--border)" strokeWidth="2" />
              <text x="50" y="32" textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="bold">Producers</text>
              <text x="50" y="50" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Publish Events</text>
            </g>

            <g transform="translate(180, 20)">
              <rect width="240" height="220" rx="8" fill="var(--surface)" stroke="var(--k-purple, #8b5cf6)" strokeWidth="2" />
              <text x="120" y="25" textAnchor="middle" fill="var(--k-purple, #8b5cf6)" fontSize="12" fontWeight="bold">
                Kafka Topic (Ordered Partitions)
              </text>

              <g transform="translate(15, 40)">
                <rect width="210" height="45" rx="4" fill="var(--surface-raised)" stroke="var(--border)" />
                <text x="10" y="18" fill="var(--text)" fontSize="10" fontWeight="bold">Partition 0</text>
                <text x="10" y="35" fill="var(--text-dim)" fontSize="9">[Offset 0] [Offset 1] [Offset 2] ...</text>
              </g>

              <g transform="translate(15, 95)">
                <rect width="210" height="45" rx="4" fill="var(--surface-raised)" stroke="var(--border)" />
                <text x="10" y="18" fill="var(--text)" fontSize="10" fontWeight="bold">Partition 1</text>
                <text x="10" y="35" fill="var(--text-dim)" fontSize="9">[Offset 0] [Offset 1] [Offset 2] ...</text>
              </g>

              <g transform="translate(15, 150)">
                <rect width="210" height="45" rx="4" fill="var(--surface-raised)" stroke="var(--border)" />
                <text x="10" y="18" fill="var(--text)" fontSize="10" fontWeight="bold">Partition 2</text>
                <text x="10" y="35" fill="var(--text-dim)" fontSize="9">[Offset 0] [Offset 1] [Offset 2] ...</text>
              </g>
            </g>

            <g transform="translate(480, 45)">
              <rect width="120" height="50" rx="6" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
              <text x="60" y="22" textAnchor="middle" fill="var(--text)" fontSize="10" fontWeight="bold">Consumer A</text>
              <text x="60" y="38" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Reads Part 0</text>
            </g>

            <g transform="translate(480, 105)">
              <rect width="120" height="50" rx="6" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
              <text x="60" y="22" textAnchor="middle" fill="var(--text)" fontSize="10" fontWeight="bold">Consumer B</text>
              <text x="60" y="38" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Reads Part 1</text>
            </g>

            <g transform="translate(480, 165)">
              <rect width="120" height="50" rx="6" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
              <text x="60" y="22" textAnchor="middle" fill="var(--text)" fontSize="10" fontWeight="bold">Consumer C</text>
              <text x="60" y="38" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Reads Part 2</text>
            </g>

            <path d="M 120 130 L 175 130" stroke="var(--accent)" strokeWidth="2" />
            <path d="M 425 80 L 475 70" stroke="var(--k-purple, #8b5cf6)" strokeWidth="1.5" />
            <path d="M 425 130 L 475 130" stroke="var(--k-purple, #8b5cf6)" strokeWidth="1.5" />
            <path d="M 425 180 L 475 190" stroke="var(--k-purple, #8b5cf6)" strokeWidth="1.5" />

            <text x="310" y="265" textAnchor="middle" fill="var(--text-dim)" fontSize="11">
              Events are strictly ordered within a partition. Horizontal scale is achieved by partition count.
            </text>
          </svg>
        );

      case 'blob-presigned-upload':
        return (
          <svg viewBox="0 0 620 280" width="100%" height="100%" aria-label="Large Blob Presigned Upload Flow">
            <g transform="translate(20, 90)">
              <rect width="100" height="80" rx="8" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2" />
              <text x="50" y="35" textAnchor="middle" fill="var(--text)" fontSize="12" fontWeight="bold">Client</text>
              <text x="50" y="52" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Browser / App</text>
              <text x="50" y="68" textAnchor="middle" fill="var(--text-dim)" fontSize="9">2GB Video</text>
            </g>

            <g transform="translate(200, 30)">
              <rect width="130" height="70" rx="8" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2" />
              <text x="65" y="30" textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="bold">API Gateway / App</text>
              <text x="65" y="48" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Signs URL (HMAC)</text>
              <text x="65" y="62" textAnchor="middle" fill="var(--k-green, #10b981)" fontSize="9">Zero Payload Hops</text>
            </g>

            <g transform="translate(440, 90)">
              <rect width="140" height="80" rx="8" fill="var(--surface)" stroke="var(--k-blue, #3b82f6)" strokeWidth="2" />
              <text x="70" y="32" textAnchor="middle" fill="var(--k-blue, #3b82f6)" fontSize="12" fontWeight="bold">Object Storage</text>
              <text x="70" y="50" textAnchor="middle" fill="var(--text-dim)" fontSize="10">Amazon S3 / GCS</text>
              <text x="70" y="66" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Multipart Streaming</text>
            </g>

            <g transform="translate(240, 180)">
              <rect width="140" height="60" rx="8" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
              <text x="70" y="26" textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="bold">Transcode Workers</text>
              <text x="70" y="44" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Async Queue Driven</text>
            </g>

            <path d="M 120 110 L 195 70" stroke="var(--accent)" strokeWidth="2" />
            <text x="140" y="80" fill="var(--accent)" fontSize="9" fontWeight="bold">1. Request Presigned URL</text>

            <path d="M 195 85 L 125 125" stroke="var(--text-dim)" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="175" y="115" fill="var(--text-dim)" fontSize="9">2. Return Signed S3 URL</text>

            <path d="M 120 145 L 435 145" stroke="var(--k-blue, #3b82f6)" strokeWidth="2.5" />
            <text x="270" y="140" textAnchor="middle" fill="var(--k-blue, #3b82f6)" fontSize="10" fontWeight="bold">
              3. Direct Streaming Multipart PUT (Bytes bypass App Server)
            </text>

            <path d="M 480 170 L 385 200" stroke="var(--border-strong)" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="450" y="200" fill="var(--text-dim)" fontSize="9">4. S3 Event -&gt; Queue</text>
          </svg>
        );

      case 'concurrency-control':
        return (
          <svg viewBox="0 0 620 280" width="100%" height="100%" aria-label="Concurrency Control and Locking Strategies">
            <g transform="translate(20, 20)">
              <rect width="180" height="230" rx="8" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.5" />
              <text x="90" y="28" textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="bold">Pessimistic Locking</text>
              <text x="90" y="46" textAnchor="middle" fill="var(--text-dim)" fontSize="9">SELECT ... FOR UPDATE</text>

              <rect x="15" y="65" width="150" height="40" rx="4" fill="var(--surface-raised)" stroke="var(--k-amber, #f59e0b)" />
              <text x="90" y="85" textAnchor="middle" fill="var(--k-amber, #f59e0b)" fontSize="10" fontWeight="bold">Exclusive Row Lock</text>
              <text x="90" y="98" textAnchor="middle" fill="var(--text-dim)" fontSize="8">Blocks other transactions</text>

              <text x="90" y="145" textAnchor="middle" fill="var(--text)" fontSize="9">• Complete row isolation</text>
              <text x="90" y="165" textAnchor="middle" fill="var(--text-dim)" fontSize="9">• Low throughput (&lt;100 QPS)</text>
              <text x="90" y="185" textAnchor="middle" fill="var(--k-amber, #ef4444)" fontSize="9">Thread pool bottlenecks</text>
            </g>

            <g transform="translate(220, 20)">
              <rect width="180" height="230" rx="8" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.5" />
              <text x="90" y="28" textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="bold">Optimistic (OCC)</text>
              <text x="90" y="46" textAnchor="middle" fill="var(--text-dim)" fontSize="9">WHERE version = :v1</text>

              <rect x="15" y="65" width="150" height="40" rx="4" fill="var(--surface-raised)" stroke="var(--k-blue, #3b82f6)" />
              <text x="90" y="85" textAnchor="middle" fill="var(--k-blue, #3b82f6)" fontSize="10" fontWeight="bold">Version Checking</text>
              <text x="90" y="98" textAnchor="middle" fill="var(--text-dim)" fontSize="8">v1 -&gt; v2 on update</text>

              <text x="90" y="145" textAnchor="middle" fill="var(--text)" fontSize="9">• Non-blocking reads</text>
              <text x="90" y="165" textAnchor="middle" fill="var(--text-dim)" fontSize="9">• High QPS if collision low</text>
              <text x="90" y="185" textAnchor="middle" fill="var(--k-amber, #ef4444)" fontSize="9">Retry storms on contention</text>
            </g>

            <g transform="translate(420, 20)">
              <rect width="180" height="230" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
              <text x="90" y="28" textAnchor="middle" fill="var(--accent)" fontSize="11" fontWeight="bold">Redis Atomic Lua</text>
              <text x="90" y="46" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Single-Threaded RAM</text>

              <rect x="15" y="65" width="150" height="40" rx="4" fill="var(--surface-raised)" stroke="var(--k-green, #10b981)" />
              <text x="90" y="85" textAnchor="middle" fill="var(--k-green, #10b981)" fontSize="10" fontWeight="bold">100k+ QPS Decr</text>
              <text x="90" y="98" textAnchor="middle" fill="var(--text-dim)" fontSize="8">Sub-millisecond latency</text>

              <text x="90" y="145" textAnchor="middle" fill="var(--text)" fontSize="9">• Zero lock overhead</text>
              <text x="90" y="165" textAnchor="middle" fill="var(--text-dim)" fontSize="9">• Handles flash spikes</text>
              <text x="90" y="185" textAnchor="middle" fill="var(--accent)" fontSize="9">Async sync to primary DB</text>
            </g>
          </svg>
        );

      default:
        return (
          <svg viewBox="0 0 620 220" width="100%" height="100%" aria-label="System Architecture Flow">
            <g transform="translate(20, 75)">
              <rect width="90" height="70" rx="6" fill="var(--surface)" stroke="var(--border)" strokeWidth="2" />
              <text x="45" y="32" textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="bold">Clients</text>
              <text x="45" y="50" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Web / App</text>
            </g>

            <path d="M 110 110 L 150 110" stroke="var(--accent)" strokeWidth="2" />

            <g transform="translate(155, 75)">
              <rect width="110" height="70" rx="6" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
              <text x="55" y="32" textAnchor="middle" fill="var(--accent)" fontSize="11" fontWeight="bold">API Gateway</text>
              <text x="55" y="50" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Auth / Rate Limit</text>
            </g>

            <path d="M 265 110 L 305 110" stroke="var(--accent)" strokeWidth="2" />

            <g transform="translate(310, 75)">
              <rect width="110" height="70" rx="6" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2" />
              <text x="55" y="32" textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="bold">Service Fleet</text>
              <text x="55" y="50" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Stateless Logic</text>
            </g>

            <path d="M 420 95 L 465 60" stroke="var(--k-blue, #3b82f6)" strokeWidth="1.5" />
            <path d="M 420 125 L 465 160" stroke="var(--border-strong)" strokeWidth="1.5" />

            <g transform="translate(470, 25)">
              <rect width="120" height="60" rx="6" fill="var(--surface)" stroke="var(--k-blue, #3b82f6)" strokeWidth="1.5" />
              <text x="60" y="26" textAnchor="middle" fill="var(--k-blue, #3b82f6)" fontSize="11" fontWeight="bold">Cache Layer</text>
              <text x="60" y="44" textAnchor="middle" fill="var(--text-dim)" fontSize="9">In-Memory (1ms)</text>
            </g>

            <g transform="translate(470, 135)">
              <rect width="120" height="60" rx="6" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.5" />
              <text x="60" y="26" textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="bold">Storage Tier</text>
              <text x="60" y="44" textAnchor="middle" fill="var(--text-dim)" fontSize="9">Primary + Replica</text>
            </g>
          </svg>
        );
    }
  };

  return (
    <div className={`concept-diagram-card ${className ?? ''}`} style={containerStyle}>
      {title && (
        <div
          style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-dim)',
            marginBottom: 'var(--sp-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-2)',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
          {title}
        </div>
      )}
      {renderContent()}
    </div>
  );
}
