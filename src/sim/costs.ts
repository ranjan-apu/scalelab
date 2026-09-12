import type { NodeKind, Topology } from './types';

/**
 * Illustrative managed-cloud pricing behind the Studio cost estimator.
 *
 * These are planning figures, not a quote: each maps a component kind to the
 * SKU a team would typically reach for first and what one unit of it costs
 * per month. The panel labels them estimates, and cost never touches the
 * simulation — it is a readout over the topology, recomputed every render.
 *
 * `units` of zero means the component is a policy, pattern, or controller
 * with no infrastructure of its own (a breaker is a library, a region is a
 * routing rule). Those rows show an em dash rather than $0, because $0
 * claims a measurement and "—" says "nothing to bill".
 */
export interface KindCost {
  /** The SKU a team would typically reach for first. */
  sku: string;
  /** USD per unit per month. */
  usdPerMo: number;
}

export const KIND_COSTS: Record<NodeKind, KindCost> = {
  client: { sku: 'Emulated load', usdPerMo: 0 },
  producer: { sku: 'Emulated events', usdPerMo: 0 },
  lb: { sku: 'ALB', usdPerMo: 25 },
  service: { sku: 'EC2 c6g.xlarge', usdPerMo: 110 },
  cache: { sku: 'ElastiCache t4g.medium', usdPerMo: 55 },
  db: { sku: 'RDS Postgres db.m6g.large', usdPerMo: 250 },
  queue: { sku: 'SQS + pollers', usdPerMo: 15 },
  worker: { sku: 'EC2 c6g.large', usdPerMo: 60 },
  autoscaler: { sku: 'Control loop', usdPerMo: 0 },
  region: { sku: 'Routing policy', usdPerMo: 0 },
  cdn: { sku: 'CloudFront', usdPerMo: 40 },
  ratelimiter: { sku: 'Gateway policy', usdPerMo: 0 },
  breaker: { sku: 'Client library', usdPerMo: 0 },
  replica: { sku: 'RDS read replica', usdPerMo: 250 },
  shard: { sku: 'RDS shard unit', usdPerMo: 250 },
  objectstore: { sku: 'S3 Standard', usdPerMo: 25 },
  searchindex: { sku: 'OpenSearch t3.small', usdPerMo: 60 },
  timeseriesdb: { sku: 'Timestream', usdPerMo: 45 },
  graphdb: { sku: 'Neptune db.r6g.large', usdPerMo: 300 },
  coldstorage: { sku: 'S3 Glacier', usdPerMo: 10 },
  vectordb: { sku: 'Managed vector index', usdPerMo: 70 },
  streambroker: { sku: 'MSK 3x kafka.m5.large', usdPerMo: 350 },
  pubsub: { sku: 'SNS + SQS fan-out', usdPerMo: 20 },
  websocket: { sku: 'API GW WebSocket + fleet', usdPerMo: 90 },
  apigateway: { sku: 'API Gateway', usdPerMo: 35 },
  sidecar: { sku: 'Runs on its host', usdPerMo: 0 },
  lambda: { sku: 'Lambda requests', usdPerMo: 25 },
  cron: { sku: 'EventBridge schedule', usdPerMo: 5 },
  bulkhead: { sku: 'Isolation pattern', usdPerMo: 0 },
  retryqueue: { sku: 'SQS DLQ pair', usdPerMo: 10 },
  transcoder: { sku: 'EC2 g4dn.xlarge slice', usdPerMo: 120 },
  edgecompute: { sku: 'Lambda@Edge', usdPerMo: 30 },
  writebehind: { sku: 'ElastiCache t4g.medium', usdPerMo: 55 },
  loadshedder: { sku: 'Gateway policy', usdPerMo: 0 },
  // A sketch is not deployed anywhere, so there is nothing to bill. It takes
  // the same zero-as-unbilled path as a breaker or a routing policy rather
  // than a misleading $0 line.
  shape: { sku: 'Sketch, not deployed', usdPerMo: 0 },
};

export interface CostLine {
  kind: NodeKind;
  /** Distinct components of this kind on the canvas. */
  components: number;
  /** Billable units (instances summed across components). */
  units: number;
  sku: string;
  usdPerMo: number;
}

export interface TopologyCost {
  lines: CostLine[];
  /** Billable total, USD per month. */
  totalUsdPerMo: number;
  /** Components with no infrastructure of their own. */
  unbilledComponents: number;
}

/** Billable units for one node: its instance count, at least one. */
export function billableUnits(instances: unknown): number {
  const n = typeof instances === 'number' && Number.isFinite(instances) ? Math.floor(instances) : 1;
  return Math.max(1, n);
}

/** Cost rollup over a topology. Pure: safe to call every render. */
export function topologyCost(topology: Topology): TopologyCost {
  const byKind = new Map<NodeKind, { components: number; units: number }>();
  for (const node of topology.nodes) {
    const entry = byKind.get(node.kind) ?? { components: 0, units: 0 };
    entry.components += 1;
    entry.units += billableUnits(
      (node.config as { instances?: unknown }).instances,
    );
    byKind.set(node.kind, entry);
  }
  const lines: CostLine[] = [];
  let totalUsdPerMo = 0;
  let unbilledComponents = 0;
  for (const [kind, { components, units }] of byKind) {
    const { sku, usdPerMo } = KIND_COSTS[kind];
    if (usdPerMo <= 0) {
      unbilledComponents += components;
      continue;
    }
    lines.push({ kind, components, units, sku, usdPerMo });
    totalUsdPerMo += units * usdPerMo;
  }
  lines.sort((a, b) => b.usdPerMo * b.units - a.usdPerMo * a.units);
  return { lines, totalUsdPerMo, unbilledComponents };
}

/** $2,480 — whole dollars, grouped. Never decimals: these are estimates. */
export function formatUsdPerMo(usd: number): string {
  return `$${Math.round(usd).toLocaleString('en-US')}`;
}
