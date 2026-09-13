import type { Topology } from '../types';
import { edge, node, note } from './helpers';

/* ------------------------------------------------------------------ *
 * Flagship Architecture 1: Ticketmaster (High-Concurrency Booking)
 * ------------------------------------------------------------------ */

const ticketmasterTopology: Topology = {
  nodes: [
    node('tm-client', 'client', 'Fans & Mobile Users', 40, 220, { rps: 180, timeoutMs: 3000 }, 'Flash crowd of fans attempting to reserve seats for high-demand concert tours.'),
    node('tm-cdn', 'cdn', 'CloudFront CDN', 260, 220, { hitRate: 0.85, capacity: 512 }, 'Caches venue maps, event details, and static seating manifests at the edge.'),
    node('tm-gateway', 'apigateway', 'API Gateway + WAF', 480, 220, { capacity: 256 }, 'Performs token validation, TLS termination, and drops bot traffic.'),
    node('tm-queue', 'queue', 'Virtual Waiting Room', 700, 140, { queueLimit: 2000 }, 'FIFO virtual waiting queue that meters admissions to prevent database thrashing.'),
    node('tm-booking', 'service', 'Booking Engine', 920, 220, { capacity: 16, instances: 4, serviceMs: 35 }, 'Coordinates seat holds, validates inventory, and triggers checkout.'),
    node('tm-locks', 'cache', 'Redis Seat Locks', 1160, 120, { capacity: 128, hitRate: 0.95 }, 'Distributed lock manager holding temporary 10-minute seat reservations.'),
    node('tm-inventory', 'shard', 'Inventory Shards', 1160, 320, { shardCount: 4, shardCapacity: 16 }, 'Sharded ACID relational database partitioned by event_id for final ticket creation.'),
    node('tm-breaker', 'breaker', 'Payment Breaker', 920, 400, {}, 'Circuit breaker protecting checkout flow from third-party payment gateway timeouts.'),
  ],
  edges: [
    edge('tm-client', 'tm-cdn', 1, 'rest', 'GET /events/:id/seats', true),
    edge('tm-cdn', 'tm-gateway', 1, 'rest', 'Cache Miss', true),
    edge('tm-gateway', 'tm-queue', 1, 'rest', 'Enqueue Buyer', true),
    edge('tm-queue', 'tm-booking', 1, 'grpc', 'Admit Buyer', true),
    edge('tm-booking', 'tm-locks', 1, 'sql', 'SETNX seat_lock (TTL 10m)', true),
    edge('tm-booking', 'tm-inventory', 1, 'sql', 'COMMIT Order', true),
    edge('tm-booking', 'tm-breaker', 1, 'grpc', 'POST /v1/charges', true),
  ],
  annotations: [
    note(
      'tm-note-1',
      40,
      384,
      'Production Pattern: The Virtual Waiting Room absorbs 10x traffic spikes, letting only 150 RPS reach the booking engine. Redis distributed locks prevent double-booking.',
      320,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * Flagship Architecture 2: TinyURL (URL Shortener & Fast Redirects)
 * ------------------------------------------------------------------ */

const tinyurlTopology: Topology = {
  nodes: [
    node('tu-client', 'client', 'Web Browsers & Apps', 40, 220, { rps: 240, timeoutMs: 1500 }, 'Global client population requesting HTTP 301/302 short link redirects.'),
    node('tu-cdn', 'cdn', 'Edge Redirect Cache', 280, 220, { hitRate: 0.92, capacity: 512 }, 'Answers the top 20% most popular short links directly from ISP edge nodes.'),
    node('tu-gateway', 'apigateway', 'API Gateway', 520, 220, { capacity: 256 }, 'Routes redirect lookups and rate limits new URL creation requests.'),
    node('tu-shortener', 'service', 'URL Shortener Service', 760, 220, { capacity: 16, instances: 3, serviceMs: 15 }, 'Generates Base62 hashes and coordinates read/write operations.'),
    node('tu-cache', 'cache', 'Redis KV Cache', 1020, 120, { capacity: 128, hitRate: 0.90 }, 'In-memory LRU cache storing hot short_code -> long_url mappings.'),
    node('tu-db', 'shard', 'URL Key-Value Shards', 1020, 320, { shardCount: 4, shardCapacity: 16 }, 'Distributed NoSQL store partitioned by hash(short_code).'),
  ],
  edges: [
    edge('tu-client', 'tu-cdn', 1, 'rest', 'GET /:shortCode', true),
    edge('tu-cdn', 'tu-gateway', 1, 'rest', 'Edge Miss', true),
    edge('tu-gateway', 'tu-shortener', 1, 'grpc', 'Lookup & Expand', true),
    edge('tu-shortener', 'tu-cache', 1, 'sql', 'GET shortCode', true),
    edge('tu-shortener', 'tu-db', 1, 'sql', 'SELECT long_url (Cache Miss)', true),
  ],
  annotations: [
    note(
      'tu-note-1',
      40,
      384,
      'Production Pattern: 100:1 read-to-write ratio. With 92% CDN hit rate and 90% Redis hit rate, less than 1% of read traffic ever touches the backend database.',
      320,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * Flagship Architecture 3: LeetCode (Online Judge & Live Leaderboard)
 * ------------------------------------------------------------------ */

const leetcodeTopology: Topology = {
  nodes: [
    node('lc-client', 'client', 'Contestants', 40, 240, { rps: 120, timeoutMs: 5000 }, 'Contest participants writing code and submitting test runs.'),
    node('lc-gateway', 'apigateway', 'API Gateway', 280, 240, { capacity: 256 }, 'Validates session JWTs and throttles submission spam per contestant.'),
    node('lc-submission', 'service', 'Submission Service', 520, 240, { capacity: 16, instances: 3, serviceMs: 20 }, 'Persists submission record and queues task for execution.'),
    node('lc-queue', 'streambroker', 'Judge Task Stream (Kafka)', 760, 240, {}, 'Partitioned event stream decoupling fast API submission from slow Docker code execution.'),
    node('lc-judge', 'worker', 'Sandboxed Judge Workers', 1020, 240, { capacity: 4, instances: 6, serviceMs: 180 }, 'Isolated Linux cgroup/gVisor sandboxes running test suites.'),
    node('lc-leaderboard', 'cache', 'Redis Live Leaderboard', 1260, 120, { capacity: 128, hitRate: 0.98 }, 'Redis Sorted Set (ZSET) calculating real-time rankings by score & penalty.'),
    node('lc-db', 'db', 'Submissions PostgreSQL', 1260, 360, { capacity: 16, serviceMs: 30 }, 'ACID store for verdicts, execution times, memory usage, and user history.'),
  ],
  edges: [
    edge('lc-client', 'lc-gateway', 1, 'rest', 'POST /problems/:id/submit', true),
    edge('lc-gateway', 'lc-submission', 1, 'grpc', 'SubmitCode()', true),
    edge('lc-submission', 'lc-queue', 1, 'kafka', 'submission.created', false),
    edge('lc-queue', 'lc-judge', 1, 'kafka', 'Task Dispatch', false),
    edge('lc-judge', 'lc-leaderboard', 1, 'sql', 'ZADD contest_rankings', true),
    edge('lc-judge', 'lc-db', 1, 'sql', 'INSERT INTO submissions', true),
  ],
  annotations: [
    note(
      'lc-note-1',
      40,
      400,
      'Production Pattern: Sandboxed code execution takes 180ms+, so synchronous HTTP would hang. Kafka decouples submissions, while Redis Sorted Sets provide instant O(log N) leaderboard ranking.',
      320,
    ),
  ],
};

export const interviewTopologies = {
  ticketmasterTopology, tinyurlTopology, leetcodeTopology,
};
export { ticketmasterTopology, tinyurlTopology, leetcodeTopology };
