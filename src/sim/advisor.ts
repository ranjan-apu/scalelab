import type { NodeKind, SimEdge, SimNode, Topology } from './types';

export type FindingSeverity = 'critical' | 'warning' | 'info';

export type FindingCategory = 'reliability' | 'resilience' | 'performance' | 'protection';

export interface Finding {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  description: string;
  remediation: string;
  nodeIds: string[];
  edgeIds?: string[];
}

export interface CategoryScore {
  category: FindingCategory;
  score: number;
  label: string;
}

export interface ArchitectureAudit {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  findings: Finding[];
  categoryScores: CategoryScore[];
  summary: {
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    totalNodes: number;
    totalEdges: number;
  };
}

const STATEFUL_KINDS = new Set<NodeKind>([
  'db',
  'searchindex',
  'timeseriesdb',
  'graphdb',
  'vectordb',
]);

const EDGE_PROTECTION_KINDS = new Set<NodeKind>([
  'apigateway',
  'ratelimiter',
  'cdn',
  'edgecompute',
  'lb',
]);

/**
 * Builds incoming and outgoing adjacency maps for the topology.
 */
function buildAdjacency(topology: Topology) {
  const outgoing = new Map<string, SimEdge[]>();
  const incoming = new Map<string, SimEdge[]>();

  for (const n of topology.nodes) {
    outgoing.set(n.id, []);
    incoming.set(n.id, []);
  }

  for (const e of topology.edges) {
    if (e.control) continue; // Skip control edges (e.g. autoscaler control)
    outgoing.get(e.from)?.push(e);
    incoming.get(e.to)?.push(e);
  }

  const nodeMap = new Map<string, SimNode>();
  for (const n of topology.nodes) {
    nodeMap.set(n.id, n);
  }

  return { outgoing, incoming, nodeMap };
}

/**
 * Analyzes a topology and produces architectural findings and health scores.
 */
export function analyzeArchitecture(topology: Topology): ArchitectureAudit {
  const findings: Finding[] = [];
  const { outgoing, incoming, nodeMap } = buildAdjacency(topology);

  if (topology.nodes.length === 0) {
    return {
      score: 100,
      grade: 'A',
      findings: [],
      categoryScores: [
        { category: 'reliability', score: 100, label: 'Reliability' },
        { category: 'resilience', score: 100, label: 'Resilience' },
        { category: 'performance', score: 100, label: 'Performance' },
        { category: 'protection', score: 100, label: 'Protection' },
      ],
      summary: {
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0,
        totalNodes: 0,
        totalEdges: 0,
      },
    };
  }

  // 1. Single Point of Failure (SPOF) on databases and critical data tiers
  for (const node of topology.nodes) {
    if (STATEFUL_KINDS.has(node.kind)) {
      const inEdges = incoming.get(node.id) ?? [];
      const instances = node.config.instances ?? 1;

      // If it serves traffic from multiple nodes or has high load but 1 instance with no replica/shard
      if (instances <= 1 && inEdges.length > 0) {
        findings.push({
          id: `spof-store-${node.id}`,
          severity: 'warning',
          category: 'reliability',
          title: `Single Point of Failure: ${node.label}`,
          description: `"${node.label}" is a single database instance without read replicas or sharding. A failure or maintenance event will cause downtime for all dependent services.`,
          remediation:
            'Consider adding Read Replicas (replica component), horizontal sharding (shard component), or a multi-region failover switch (region component).',
          nodeIds: [node.id],
        });
      }
    }
  }

  // 2. Retry Storm Hazard
  // When an upstream node has retries > 0 and timeoutMs > 0, calling a downstream node without a circuit breaker
  for (const edge of topology.edges) {
    if (edge.control) continue;
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!fromNode || !toNode) continue;

    if (fromNode.config.retries > 0 && fromNode.config.timeoutMs > 0) {
      // If target is directly a service or db (not a breaker, queue, or ratelimiter)
      if (toNode.kind === 'service' || toNode.kind === 'db') {
        const severity: FindingSeverity = fromNode.config.retries >= 2 ? 'critical' : 'warning';
        findings.push({
          id: `retry-storm-${edge.id}`,
          severity,
          category: 'resilience',
          title: `Retry Storm Hazard: ${fromNode.label} → ${toNode.label}`,
          description: `"${fromNode.label}" retries up to ${fromNode.config.retries} times on failure or timeout. Under heavy load or downstream slowdown, this can cause a destructive retry storm that prevents "${toNode.label}" from recovering.`,
          remediation:
            'Place a Circuit Breaker (breaker) or Bulkhead (bulkhead) between them, reduce retries, or introduce an asynchronous queue for decoupled retries.',
          nodeIds: [fromNode.id, toNode.id],
          edgeIds: [edge.id],
        });
      }
    }
  }

  // 3. Unprotected Public Ingress
  for (const client of topology.nodes) {
    if (client.kind === 'client') {
      const clientOut = outgoing.get(client.id) ?? [];
      for (const edge of clientOut) {
        const target = nodeMap.get(edge.to);
        if (!target) continue;

        // If client connects directly to a service or database without an edge protection layer
        if (
          !EDGE_PROTECTION_KINDS.has(target.kind) &&
          (target.kind === 'service' || target.kind === 'db')
        ) {
          findings.push({
            id: `unprotected-ingress-${edge.id}`,
            severity: 'warning',
            category: 'protection',
            title: `Direct Client Ingress: ${target.label}`,
            description: `Traffic from "${client.label}" lands directly on "${target.label}" without an API Gateway, Load Balancer, CDN, or Rate Limiter in front.`,
            remediation:
              'Insert an API Gateway (apigateway), Rate Limiter (ratelimiter), or Load Balancer (lb) to protect internal services from traffic surges.',
            nodeIds: [client.id, target.id],
            edgeIds: [edge.id],
          });
        }
      }
    }
  }

  // 4. Cache Stampede / Thundering Herd Vulnerability
  for (const node of topology.nodes) {
    if (node.kind === 'cache') {
      const outEdges = outgoing.get(node.id) ?? [];
      for (const edge of outEdges) {
        const downstream = nodeMap.get(edge.to);
        if (downstream && STATEFUL_KINDS.has(downstream.kind)) {
          // Direct cache to database connection
          const hitRate = node.config.hitRate ?? 0.8;
          if (hitRate < 0.8) {
            findings.push({
              id: `cache-stampede-${node.id}-${downstream.id}`,
              severity: 'warning',
              category: 'performance',
              title: `Cache Stampede Risk: ${node.label} → ${downstream.label}`,
              description: `"${node.label}" has a relatively low hit rate (${Math.round(hitRate * 100)}%) and connects directly to "${downstream.label}". A cache flush or sudden traffic spike will overwhelm the database.`,
              remediation:
                'Increase cache hit rate or isolate the database behind a Bulkhead (bulkhead) to cap concurrent queries during miss waves.',
              nodeIds: [node.id, downstream.id],
              edgeIds: [edge.id],
            });
          }
        }
      }
    }
  }

  // 5. Cascading Timeout Hazards
  for (const edge of topology.edges) {
    if (edge.control) continue;
    const caller = nodeMap.get(edge.from);
    const target = nodeMap.get(edge.to);
    if (!caller || !target) continue;

    if (caller.config.timeoutMs > 0 && target.config.serviceMs > 0) {
      if (caller.config.timeoutMs <= target.config.serviceMs) {
        findings.push({
          id: `cascading-timeout-${edge.id}`,
          severity: 'critical',
          category: 'resilience',
          title: `Premature Timeout: ${caller.label} (${caller.config.timeoutMs}ms) < ${target.label} (${target.config.serviceMs}ms)`,
          description: `"${caller.label}" times out after ${caller.config.timeoutMs}ms, but "${target.label}" takes an average of ${target.config.serviceMs}ms to answer. Most requests will time out before work finishes.`,
          remediation:
            `Set the timeout on "${caller.label}" to at least 2-3x the expected downstream latency (${Math.ceil(target.config.serviceMs * 2.5)}ms+), or optimize "${target.label}".`,
          nodeIds: [caller.id, target.id],
          edgeIds: [edge.id],
        });
      }
    }
  }

  // 6. Direct Synchronous Worker Invocation
  for (const node of topology.nodes) {
    if (node.kind === 'worker') {
      const inEdges = incoming.get(node.id) ?? [];
      for (const edge of inEdges) {
        const caller = nodeMap.get(edge.from);
        if (caller && caller.kind !== 'queue' && caller.kind !== 'streambroker') {
          findings.push({
            id: `synchronous-worker-${edge.id}`,
            severity: 'info',
            category: 'performance',
            title: `Synchronously Called Worker: ${node.label}`,
            description: `Worker "${node.label}" is directly invoked by "${caller.label}" instead of pulling from an asynchronous message buffer (queue or stream broker).`,
            remediation:
              'Decouple background jobs by placing a Queue (queue) or Stream Broker (streambroker) between the service and the worker.',
            nodeIds: [caller.id, node.id],
            edgeIds: [edge.id],
          });
        }
      }
    }
  }

  // 7. Unbounded Bufferbloat / Deep Queues
  for (const node of topology.nodes) {
    if (node.kind === 'service' || node.kind === 'db') {
      if (node.config.queueLimit > 500) {
        findings.push({
          id: `bufferbloat-${node.id}`,
          severity: 'info',
          category: 'resilience',
          title: `High Queue Limit: ${node.label} (${node.config.queueLimit})`,
          description: `Queue limit of ${node.config.queueLimit} can cause bufferbloat under sustained load: requests wait hundreds of milliseconds in line before being served.`,
          remediation:
            'Lower queueLimit (e.g. 50-200) and use a Load Shedder (loadshedder) or Rate Limiter to fail fast rather than accumulate latency.',
          nodeIds: [node.id],
        });
      }
    }
  }

  // 8. Isolated / Dead-end components
  for (const node of topology.nodes) {
    if (node.kind !== 'client' && node.kind !== 'cron') {
      const inEdges = incoming.get(node.id) ?? [];
      const outEdges = outgoing.get(node.id) ?? [];
      if (inEdges.length === 0 && outEdges.length === 0) {
        findings.push({
          id: `unconnected-node-${node.id}`,
          severity: 'info',
          category: 'reliability',
          title: `Unconnected Component: ${node.label}`,
          description: `"${node.label}" has no connections. It is not participating in any request or control path.`,
          remediation: 'Connect this component to the architecture or remove it.',
          nodeIds: [node.id],
        });
      }
    }
  }

  // Calculate Scores
  let score = 100;
  const categoryDeductions: Record<FindingCategory, number> = {
    reliability: 0,
    resilience: 0,
    performance: 0,
    protection: 0,
  };

  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const f of findings) {
    let penalty = 0;
    if (f.severity === 'critical') {
      penalty = 20;
      criticalCount++;
    } else if (f.severity === 'warning') {
      penalty = 10;
      warningCount++;
    } else {
      penalty = 3;
      infoCount++;
    }
    score -= penalty;
    categoryDeductions[f.category] += penalty;
  }

  score = Math.max(0, Math.min(100, score));

  const categoryScores: CategoryScore[] = (
    ['reliability', 'resilience', 'performance', 'protection'] as FindingCategory[]
  ).map((cat) => {
    const raw = Math.max(0, 100 - categoryDeductions[cat] * 2);
    const labels: Record<FindingCategory, string> = {
      reliability: 'Reliability',
      resilience: 'Resilience',
      performance: 'Performance',
      protection: 'Protection',
    };
    return {
      category: cat,
      score: raw,
      label: labels[cat],
    };
  });

  const grade: 'A' | 'B' | 'C' | 'D' | 'F' =
    score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

  return {
    score,
    grade,
    findings,
    categoryScores,
    summary: {
      criticalCount,
      warningCount,
      infoCount,
      totalNodes: topology.nodes.length,
      totalEdges: topology.edges.length,
    },
  };
}
