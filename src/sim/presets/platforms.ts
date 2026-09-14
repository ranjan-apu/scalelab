import type { Topology } from '../types';
import { COL, LROW, ROW, edge, node, note, sectionOver } from './helpers';

/* ------------------------------------------------------------------ *
 * Stream Processing: events into materialized views
 *
 * One producer appends to a partitioned log; a processor pool drains it
 * into a serving store that dashboards read. The only metric that matters
 * is consumer lag: while the pool outruns the log the system looks idle,
 * and the moment ingest passes the pool's drain rate the backlog grows by
 * the deficit every second. Poison pills park in the dead-letter shelf
 * instead of wedging the partitions.
 * ------------------------------------------------------------------ */

const streamProcessing: Topology = {
  nodes: [
    node('sl-events', 'producer', 'Click Events', COL(0), ROW(1), { rps: 120 }, 'Raw interaction events appended to the log.'),
    node('sl-broker', 'streambroker', 'Partitioned Log', COL(1), ROW(1), { partitions: 4 }, 'Four partitions; one slow group never blocks another.'),
    node('sl-proc', 'worker', 'Stream Processor', COL(2), ROW(1), { capacity: 8, serviceMs: 30 }, 'Windowed aggregation into the serving store.'),
    node('sl-state', 'db', 'Serving Store', COL(3), ROW(1), { capacity: 8, serviceMs: 15 }, 'Materialized views dashboards actually read.'),
    node('sl-api', 'service', 'Dashboard API', COL(4), ROW(1), { capacity: 8, serviceMs: 10 }, 'Serves precomputed boards, never the raw stream.'),
    node('sl-readers', 'client', 'Dashboard Readers', COL(5), ROW(1), { rps: 60, timeoutMs: 2000 }, 'Analysts refreshing boards, not tailing the firehose.'),
    node('sl-dlq', 'retryqueue', 'Dead-Letter Shelf', COL(2), LROW(3, 1), {}, 'Poison pills get two redeliveries, then a counted home here.'),
  ],
  edges: [
    edge('sl-events', 'sl-broker', 1, 'kafka', 'append events', false),
    edge('sl-broker', 'sl-proc', 1, 'kafka', 'consume group', false),
    edge('sl-proc', 'sl-state', 1, 'sql', 'upsert views', true),
    edge('sl-proc', 'sl-dlq', 1, 'kafka', 'poison pills', false),
    edge('sl-readers', 'sl-api', 1, 'rest', 'GET /boards', true),
    edge('sl-api', 'sl-state', 1, 'sql', 'SELECT views', true),
  ],
  annotations: [
    sectionOver('sl-sec-flow', 'Ingest to insight', 6, 0, 5, 1, 1),
    sectionOver('sl-sec-dlq', 'Failures with somewhere to go', 7, 2, 2, 3, 3, 1),
    note(
      'sl-note-lag',
      40,
      328,
      'The pool drains about 260 events a second against 120 offered, so lag sits near zero. Push ingest past the drain rate and the backlog grows by the deficit every second.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * Multi-tenant SaaS: noisy neighbors
 *
 * Two tenants share one pool and one database. The quiet tenant arrives
 * through its own API; the noisy one passes a per-tenant quota and a
 * bulkhead first. The quota sheds what the pool cannot serve and the
 * bulkhead caps how many pool slots noise may hold, so the quiet lane
 * stays flat while the noisy lane sheds loudly. Turn the noisy tenant up
 * and watch sheds climb while quiet p99 does not move.
 * ------------------------------------------------------------------ */

const saasTenants: Topology = {
  nodes: [
    node('t-quiet', 'client', 'Quiet Tenant', COL(0), ROW(0), { rps: 40, timeoutMs: 2000 }, 'Steady dashboards and settings traffic.'),
    node('t-quietapi', 'service', 'Tenant API', COL(1), ROW(0), { capacity: 8, serviceMs: 10 }, 'Per-tenant request handling, no shared state.'),
    node('t-pool', 'service', 'Shared Pool', COL(3), ROW(1), { capacity: 12, serviceMs: 20 }, 'The contention point both tenants bill against.'),
    node('t-maindb', 'db', 'Shared Database', COL(4), ROW(1), { capacity: 10, serviceMs: 25 }, 'One relational store with per-tenant quotas above it.'),
    node('t-noisy', 'client', 'Noisy Tenant', COL(0), LROW(2, 1), { rps: 120, timeoutMs: 2000 }, 'Bulk import jobs that mistake the API for a data pipe.'),
    node('t-quota', 'ratelimiter', 'Tenant Quota', COL(1), LROW(2, 1), { rateLimitRps: 160, burst: 160 }, 'Per-tenant ceiling: excess is refused at the door, fast.'),
    node('t-bulk', 'bulkhead', 'Noise Bulkhead', COL(2), LROW(2, 1), { bulkheadMax: 16 }, 'Caps how many pool slots the noisy lane may hold at once.'),
  ],
  edges: [
    edge('t-quiet', 't-quietapi', 1, 'rest', 'GET /v1/*', true),
    edge('t-quietapi', 't-pool', 1, 'grpc', 'Tenant calls', true),
    edge('t-pool', 't-maindb', 1, 'sql', 'Tenant queries', true),
    edge('t-noisy', 't-quota', 1, 'rest', 'POST /import', true),
    edge('t-quota', 't-bulk', 1, 'grpc', 'Admitted jobs', true),
    edge('t-bulk', 't-pool', 1, 'grpc', 'Capped calls', true),
  ],
  annotations: [
    sectionOver('t-sec-quiet', 'The quiet lane', 8, 0, 1, 0, 0),
    sectionOver('t-sec-shared', 'Shared and billed', 9, 3, 4, 0, 2),
    sectionOver('t-sec-noisy', 'The noisy lane', 10, 0, 2, 2, 2, 1),
    note(
      't-note-isolation',
      800,
      520,
      'Raise the noisy tenant and watch sheds climb at the quota while quiet p99 stays flat. Remove the quota and both lanes melt together.',
      300,
    ),
  ],
};

export const platformTopologies = {
  streamProcessing,
  saasTenants,
};
export { streamProcessing, saasTenants };
