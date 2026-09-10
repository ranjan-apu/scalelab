import type { Topology, SimNode } from './types';

export type FindingSeverity = 'critical' | 'warning' | 'info';

export interface ArchitecturalFinding {
  id: string;
  severity: FindingSeverity;
  title: string;
  category: 'resilience' | 'scalability' | 'cost' | 'performance';
  description: string;
  recommendation: string;
  nodeIds: string[];
}

export function auditTopology(topology: Topology): ArchitecturalFinding[] {
  const findings: ArchitecturalFinding[] = [];
  const { nodes, edges } = topology;

  if (nodes.length === 0) return findings;

  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  const upstreamKinds = new Map<string, Set<string>>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    outDegree.set(n.id, 0);
    upstreamKinds.set(n.id, new Set());
  }

  for (const e of edges) {
    if (e.control) continue;
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
    outDegree.set(e.from, (outDegree.get(e.from) ?? 0) + 1);
    upstreamKinds.get(e.to)?.add(nodes.find((n) => n.id === e.from)?.kind ?? '');
  }

  // Rule 1: Single Point of Failure (SPOF) Detection on Primary Database / Critical Core Services
  for (const n of nodes) {
    if (n.kind === 'db') {
      const hasReplica = nodes.some((other) => other.kind === 'replica');
      const hasShard = nodes.some((other) => other.kind === 'shard');
      if (!hasReplica && !hasShard && (inDegree.get(n.id) ?? 0) > 0) {
        findings.push({
          id: `spof-db-${n.id}`,
          severity: 'critical',
          category: 'resilience',
          title: `Single Point of Failure: ${n.label}`,
          description: `Primary database '${n.label}' has no read replica set or shard cluster. If this node fails, the entire application will suffer a total outage.`,
          recommendation: `Add a Read Replica Set or configure a Sharded Database cluster to decouple read traffic and provide automatic failover.`,
          nodeIds: [n.id],
        });
      }
    }

    if (n.kind === 'service') {
      const instances = n.config.instances ?? 1;
      const inbound = inDegree.get(n.id) ?? 0;
      if (instances === 1 && inbound >= 2) {
        findings.push({
          id: `spof-service-${n.id}`,
          severity: 'warning',
          category: 'resilience',
          title: `Singleton Microservice: ${n.label}`,
          description: `Service '${n.label}' runs on a single instance while handling multiple upstream traffic paths. A crash will drop all in-flight connections.`,
          recommendation: `Increase instance count to at least 2 and connect an Autoscaler or Load Balancer to guarantee high availability.`,
          nodeIds: [n.id],
        });
      }
    }
  }

  // Rule 2: Unprotected Downstream Dependency (Missing Circuit Breaker)
  for (const e of edges) {
    if (e.control) continue;
    const fromNode = nodes.find((n) => n.id === e.from);
    const toNode = nodes.find((n) => n.id === e.to);
    if (!fromNode || !toNode) continue;

    if (fromNode.kind === 'service' && toNode.kind === 'service') {
      const hasBreaker = edges.some((other) => {
        const mid = nodes.find((n) => n.id === other.to);
        return mid?.kind === 'breaker' || mid?.kind === 'ratelimiter';
      });

      if (!hasBreaker && (e.sync !== false)) {
        findings.push({
          id: `unprotected-rpc-${e.id}`,
          severity: 'warning',
          category: 'resilience',
          title: `Unprotected RPC: ${fromNode.label} → ${toNode.label}`,
          description: `Synchronous service-to-service call without a Circuit Breaker or Rate Limiter. If '${toNode.label}' slows down, thread pools in '${fromNode.label}' will exhaust.`,
          recommendation: `Place a Circuit Breaker between services or switch to asynchronous messaging with a Stream Broker or Queue.`,
          nodeIds: [fromNode.id, toNode.id],
        });
      }
    }
  }

  // Rule 3: Missing Ingress Rate Limiting / Gateway Protection
  const clients = nodes.filter((n) => n.kind === 'client');
  for (const c of clients) {
    const directServices = edges
      .filter((e) => e.from === c.id)
      .map((e) => nodes.find((n) => n.id === e.to))
      .filter((n): n is SimNode => n?.kind === 'service');

    if (directServices.length > 0) {
      findings.push({
        id: `unprotected-client-${c.id}`,
        severity: 'critical',
        category: 'resilience',
        title: `Public Ingress Directly Hits Backend Services`,
        description: `External clients route directly to internal microservices without passing through an API Gateway, Load Balancer, or Rate Limiter.`,
        recommendation: `Place an API Gateway or Cloud Load Balancer with Rate Limiting in front of your core services to absorb traffic spikes.`,
        nodeIds: [c.id, ...directServices.map((s) => s.id)],
      });
    }
  }

  // Rule 4: Unbuffered Writes to Primary Database
  for (const n of nodes) {
    if (n.kind === 'db') {
      const writers = edges
        .filter((e) => e.to === n.id)
        .map((e) => nodes.find((n) => n.id === e.from))
        .filter((n): n is SimNode => n !== undefined && (n.kind === 'producer' || (n.kind === 'service' && (n.config.rps ?? 0) > 100)));

      if (writers.length > 0) {
        const hasBuffer = nodes.some((other) => other.kind === 'writebehind' || other.kind === 'queue');
        if (!hasBuffer) {
          findings.push({
            id: `unbuffered-writes-${n.id}`,
            severity: 'warning',
            category: 'performance',
            title: `High-Throughput Unbuffered Writes on ${n.label}`,
            description: `High-throughput write traffic targets relational store '${n.label}' synchronously without buffer smoothing.`,
            recommendation: `Introduce a Write-Behind Buffer (MemoryDB/Redis) or Message Queue (SQS/Kafka) to absorb write bursts.`,
            nodeIds: [n.id, ...writers.map((w) => w.id)],
          });
        }
      }
    }
  }

  // Rule 5: Database Caching Optimization
  for (const n of nodes) {
    if (n.kind === 'db') {
      const hasCache = nodes.some((other) => other.kind === 'cache');
      const inDegreeCount = inDegree.get(n.id) ?? 0;
      if (!hasCache && inDegreeCount >= 2) {
        findings.push({
          id: `missing-cache-${n.id}`,
          severity: 'info',
          category: 'performance',
          title: `Consider Cache-Aside Tier for ${n.label}`,
          description: `Multiple services query '${n.label}' directly. Relational read queries often bottleneck under scale.`,
          recommendation: `Add an in-memory Redis or Memcached cache in front of the database to offload 80-95% of frequent read operations.`,
          nodeIds: [n.id],
        });
      }
    }
  }

  return findings;
}
