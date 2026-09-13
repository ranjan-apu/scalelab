import type { Topology } from '../types';
import { COL, LROW, ROW, control, edge, node, note, sectionOver } from './helpers';


/* ------------------------------------------------------------------ *
 * 1. Single Server
 *    service: 8 slots / 25ms  -> 320 rps
 *    db:      6 slots / 30ms  -> 200 rps  <- first bottleneck
 *    default 50 rps, knee around 4x.
 * ------------------------------------------------------------------ */

const singleServer: Topology = {
  nodes: [
    node('client', 'client', 'Client', 40, 200, { rps: 50, timeoutMs: 2000 }),
    node('api', 'service', 'API Server', 340, 200, {
      capacity: 8,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 64,
    }),
    node('db', 'db', 'Database', 660, 200, {
      capacity: 6,
      serviceMs: 30,
      serviceCv: 0.7,
      queueLimit: 48,
    }),
  ],
  edges: [edge('client', 'api'), edge('api', 'db')],
  annotations: [
    note(
      'ss-note-db',
      40,
      320,
      'One server, one database. The database is the smaller of the two: 6 requests at a time at 30ms each, so it runs out near 200 a second. Drag the load past 4x and the wait builds there first, not at the API.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 2. Load Balanced
 *    3 services: 3 x (6 slots / 25ms) = 720 rps
 *    shared db:  12 slots / 25ms      = 480 rps <- bottleneck anyway
 *    default 140 rps, db bites around 3.4x.
 * ------------------------------------------------------------------ */

const loadBalanced: Topology = {
  nodes: [
    node('client', 'client', 'Client', 40, 220, { rps: 140, timeoutMs: 2000 }),
    node('lb', 'lb', 'Load Balancer', 260, 220, { capacity: 512, serviceMs: 0.5 }),
    node('api1', 'service', 'API 1', 500, 80, {
      capacity: 6,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 48,
    }),
    node('api2', 'service', 'API 2', 500, 220, {
      capacity: 6,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 48,
    }),
    node('api3', 'service', 'API 3', 500, 360, {
      capacity: 6,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 48,
    }),
    node('db', 'db', 'Database', 800, 220, {
      capacity: 12,
      serviceMs: 25,
      serviceCv: 0.7,
      queueLimit: 96,
    }),
  ],
  edges: [
    edge('client', 'lb'),
    edge('lb', 'api1'),
    edge('lb', 'api2'),
    edge('lb', 'api3'),
    edge('api1', 'db'),
    edge('api2', 'db'),
    edge('api3', 'db'),
  ],
  annotations: [
    note(
      'lb-note-db',
      40,
      480,
      'Three servers share one database. That triples the API capacity and does nothing for the database, which still tops out near 480 a second. Adding servers only helps when the servers were the problem.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 3. Cache Aside
 *    cache: 64 slots / 2ms -> effectively unlimited
 *    db:    4 slots / 30ms -> 133 rps, but only (1 - hitRate) reaches it.
 *    At hitRate 0.85 and 200 rps offered the db sees ~30 rps.
 *    Drop hitRate to ~0.3 and the db is instantly over its 133 rps ceiling.
 * ------------------------------------------------------------------ */

const cacheAside: Topology = {
  nodes: [
    node('client', 'client', 'Client', 40, 200, { rps: 200, timeoutMs: 2000 }),
    node('api', 'service', 'API Server', 280, 200, {
      capacity: 24,
      serviceMs: 8,
      serviceCv: 0.5,
      queueLimit: 128,
    }),
    node('cache', 'cache', 'Cache', 550, 200, {
      capacity: 64,
      serviceMs: 2,
      serviceCv: 0.4,
      hitRate: 0.85,
      queueLimit: 512,
    }),
    node('db', 'db', 'Database', 820, 200, {
      capacity: 4,
      serviceMs: 30,
      serviceCv: 0.7,
      queueLimit: 32,
    }),
  ],
  edges: [edge('client', 'api'), edge('api', 'cache'), edge('cache', 'db')],
  annotations: [
    note(
      'ca-note-miss',
      40,
      320,
      'The database only ever sees the misses. At an 85 percent hit rate it takes about 30 requests a second out of 200. Drag the hit rate down to 0.3 and it is instantly over its 133 a second ceiling, with no change in load at all.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 4. Async Workers
 *    api:     24 slots / 8ms  -> 3000 rps (never the bottleneck)
 *    queue:   ack ~1ms, 5000 deep
 *    workers: 6 slots / 30ms  -> 200 rps drain rate <- the real ceiling
 *    default 120 rps drains fine; push past 200 and the backlog grows
 *    without the client ever seeing an error, until the buffer fills.
 * ------------------------------------------------------------------ */

const asyncWorkers: Topology = {
  nodes: [
    node('client', 'client', 'Client', 40, 200, { rps: 120, timeoutMs: 2000 }),
    node('api', 'service', 'API Server', 260, 200, {
      capacity: 24,
      serviceMs: 8,
      serviceCv: 0.5,
      queueLimit: 128,
    }),
    node('queue', 'queue', 'Message Queue', 500, 200, {
      serviceMs: 1,
      serviceCv: 0.2,
      queueLimit: 5000,
    }),
    node('worker', 'worker', 'Workers', 730, 200, {
      capacity: 6,
      serviceMs: 30,
      serviceCv: 0.6,
    }),
    node('db', 'db', 'Database', 860, 380, {
      capacity: 8,
      serviceMs: 20,
      serviceCv: 0.7,
      queueLimit: 64,
    }),
  ],
  edges: [
    edge('client', 'api'),
    edge('api', 'queue'),
    edge('queue', 'worker'),
    edge('worker', 'db'),
  ],
  annotations: [
    note(
      'aw-note-queue',
      40,
      520,
      'The workers drain 200 a second. Push the load past that and the client still gets an instant yes, because the queue is absorbing the difference. Nothing looks wrong until the queue fills, so the graph to watch is the queue depth, not the error rate.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 5. Retry Storm
 *    db: 4 slots / 40ms -> 100 rps ceiling.
 *    The api timeout (250ms) sits comfortably above the db's uncongested
 *    tail latency (~110ms at low load), so retries fire only once real
 *    queueing develops -- not from service-time variance alone. Below the
 *    ceiling each request needs one attempt and load passes through 1:1.
 *    Once queueing pushes past 250ms, every request starts issuing all 3
 *    attempts, tripling the offered load onto a db already at its limit,
 *    and the system collapses. Stable to 80 rps (1.8x); collapse begins at
 *    85 (1.9x) and is total by 90 (2x).
 *
 *    Measured, not estimated, and the onset is genuinely stochastic: at 85
 *    rps four seeds give 39.6%, 59.1%, 93.0% and 95.0% failures, because
 *    whether the queue tips depends on the timing of the first slow batch.
 *    An earlier note here claimed collapse at 2.4x, which is well past the
 *    interesting part: by then it is uniformly dead.
 * ------------------------------------------------------------------ */

const retryStorm: Topology = {
  nodes: [
    node('client', 'client', 'Client', 40, 200, { rps: 45, timeoutMs: 3000 }),
    node('api', 'service', 'API Server', 340, 200, {
      capacity: 32,
      serviceMs: 5,
      serviceCv: 0.4,
      queueLimit: 256,
      timeoutMs: 250,
      retries: 2,
    }),
    node('db', 'db', 'Database', 680, 200, {
      capacity: 4,
      serviceMs: 40,
      serviceCv: 0.5,
      queueLimit: 64,
    }),
  ],
  edges: [edge('client', 'api'), edge('api', 'db')],
  annotations: [
    note(
      'rt-note-storm',
      40,
      320,
      'The database handles 100 a second. Once waiting passes the 250ms timeout on the API, every request starts retrying three times, so the load triples onto a database that was already full. It is steady at 80 a second. Push to 85 and it starts losing most of its traffic; by 90 almost none gets through.',
      340,
    ),
  ],
};


const cdnOrigin: Topology = {
  nodes: [
    node('client', 'client', 'Client', COL(0), ROW(1), { rps: 400, timeoutMs: 2000 }),
    node('cdn', 'cdn', 'CDN Edge', COL(1), ROW(1), {
      capacity: 256,
      serviceMs: 2,
      serviceCv: 0.3,
      hitRate: 0.9,
      queueLimit: 2048,
    }),
    node('origin', 'service', 'Origin Server', COL(2), ROW(1), {
      capacity: 3,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 64,
    }),
    node('db', 'db', 'Database', COL(3), ROW(1), {
      capacity: 8,
      serviceMs: 10,
      serviceCv: 0.6,
      queueLimit: 64,
    }),
  ],
  edges: [edge('client', 'cdn'), edge('cdn', 'origin'), edge('origin', 'db')],
  annotations: [
    note(
      'co-note-miss',
      40,
      320,
      'The origin only ever sees what the cache misses. It handles 120 a second, and the cache is currently hiding 90 percent of the traffic from it. Drag the hit rate down and the origin gets a load nobody ever sized it for.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 7. Rate Limited API
 *    limiter: 200 rps sustained, 200-token burst
 *    api:       6 slots / 25ms -> 240 rps ceiling
 *    The limiter is set just under what the api can actually serve, so at 1x
 *    (150 rps) every request is admitted and nothing is refused: the limiter
 *    is invisible until it is needed.
 *
 *    What it buys is NOT extra goodput -- measured at 600 rps offered, the
 *    limiter serves 200 rps where removing it serves 234. It buys LATENCY for
 *    the requests that do get through:
 *
 *      600 rps    goodput   p50     p99    api queue
 *      limiter     200.0    36ms    80ms      0
 *      no limiter  234.4   235ms   292ms     46
 *
 *    Without the limiter every caller waits behind a 46-deep queue for an
 *    answer that mostly arrives too late to be useful. With it, the system
 *    says no quickly to some so it can say yes quickly to the rest. That
 *    trade -- a lower ceiling in exchange for a flat, predictable latency --
 *    is the whole argument for admission control, and it is why the honest
 *    comparison is p50, not throughput.
 * ------------------------------------------------------------------ */

const rateLimitedApi: Topology = {
  nodes: [
    node('client', 'client', 'Client', COL(0), ROW(1), { rps: 150, timeoutMs: 2000 }),
    node('limiter', 'ratelimiter', 'Rate Limiter', COL(1), ROW(1), {
      rateLimitRps: 200,
      burst: 200,
    }),
    node('api', 'service', 'API Server', COL(2), ROW(1), {
      capacity: 6,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 48,
    }),
    node('db', 'db', 'Database', COL(3), ROW(1), {
      capacity: 12,
      serviceMs: 12,
      serviceCv: 0.6,
      queueLimit: 96,
    }),
  ],
  edges: [edge('client', 'limiter'), edge('limiter', 'api'), edge('api', 'db')],
  annotations: [
    note(
      'rl-note-trade',
      40,
      320,
      'The limiter does not add capacity. It refuses some requests quickly so the rest are answered quickly: at 600 offered it serves 200 at 36ms, where removing it serves 234 at 235ms. Saying no fast is what buys the predictable wait.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 8. Circuit Breaker
 *    payments: 4 slots / 30ms -> 133 rps ceiling, and it is the dependency
 *    that goes bad. The breaker trips once half the calls in a 4s window
 *    fail, stays open 3s, then probes.
 *    At 1x (100 rps) the dependency is inside its ceiling and the circuit
 *    stays closed all run. At 4x it is 3x oversubscribed, its queue fills,
 *    the shed rate crosses the error threshold and the breaker trips -- after
 *    which requests fail in microseconds instead of waiting out a timeout.
 *    Injecting a `crash` or raising errorRate on payments trips it on demand.
 * ------------------------------------------------------------------ */

const circuitBreaker: Topology = {
  nodes: [
    node('client', 'client', 'Client', COL(0), ROW(1), { rps: 100, timeoutMs: 2000 }),
    node('api', 'service', 'API Server', COL(1), ROW(1), {
      capacity: 24,
      serviceMs: 6,
      serviceCv: 0.4,
      queueLimit: 128,
      timeoutMs: 600,
    }),
    node('breaker', 'breaker', 'Circuit Breaker', COL(2), ROW(1), {
      errorThreshold: 0.5,
      windowMs: 4000,
      openMs: 3000,
      halfOpenProbes: 3,
    }),
    node('payments', 'service', 'Payments API', COL(3), ROW(1), {
      capacity: 4,
      serviceMs: 30,
      serviceCv: 0.6,
      queueLimit: 32,
    }),
  ],
  edges: [edge('client', 'api'), edge('api', 'breaker'), edge('breaker', 'payments')],
  annotations: [
    note(
      'cb-note-trip',
      40,
      320,
      'Right click the payments API and inject a crash. Once half the calls in a four second window fail, the breaker opens and the rest fail in microseconds instead of waiting out a timeout. After three seconds it closes and probes again.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 9. Read Replicas
 *    replicas: 3 x 4 slots / 20ms -> 600 rps of READ capacity
 *    primary:      4 slots / 20ms -> 200 rps of WRITE capacity
 *    At 85% reads and 300 rps offered that is 255 reads against 600 and 45
 *    writes against 200: comfortable. At 4x the reads blow past 600 while the
 *    writes are still inside their own ceiling, so adding replicas is the fix
 *    for one and does nothing at all for the other.
 *    The 60ms replication lag is what makes stale reads visible without
 *    needing an unrealistic write rate.
 * ------------------------------------------------------------------ */

const readReplicas: Topology = {
  nodes: [
    node('client', 'client', 'Client', COL(0), ROW(1), { rps: 300, timeoutMs: 2000 }),
    node('api', 'service', 'API Server', COL(1), ROW(1), {
      capacity: 32,
      serviceMs: 5,
      serviceCv: 0.4,
      queueLimit: 256,
    }),
    node('replicas', 'replica', 'Replica Set', COL(2), ROW(1), {
      capacity: 4,
      serviceMs: 20,
      serviceCv: 0.5,
      queueLimit: 128,
      replicaCount: 3,
      replicationLagMs: 60,
      readFraction: 0.85,
    }),
  ],
  edges: [edge('client', 'api'), edge('api', 'replicas')],
  annotations: [
    note(
      'rr-note-writes',
      40,
      320,
      'Copies give you read capacity and nothing else: 600 reads a second across three of them, but still only 200 writes against the one primary. Adding copies fixes one of those and does nothing at all for the other.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 10. Sharded Database
 *     4 shards x 4 slots / 25ms -> 160 rps PER SHARD, 640 rps total.
 *     At 400 rps spread evenly by key each shard carries ~100 of its 160 and
 *     the store is fine. The whole lesson is in hotKeyFraction: push it to
 *     0.8 and shard 0 alone is offered 320 rps against its own 160, so it
 *     pins at 100% and sheds while the node-level utilisation meter -- the
 *     mean across shards -- still reads comfortable.
 * ------------------------------------------------------------------ */

const shardedDatabase: Topology = {
  nodes: [
    node('client', 'client', 'Client', COL(0), ROW(1), { rps: 400, timeoutMs: 2000 }),
    node('api', 'service', 'API Server', COL(1), ROW(1), {
      capacity: 32,
      serviceMs: 5,
      serviceCv: 0.4,
      queueLimit: 256,
    }),
    node('shards', 'shard', 'Sharded Store', COL(2), ROW(1), {
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 32,
      shardCount: 4,
      shardCapacity: 4,
      hotKeyFraction: 0,
    }),
  ],
  edges: [edge('client', 'api'), edge('api', 'shards')],
  annotations: [
    note(
      'sd-note-hot',
      40,
      320,
      'Four shards carry 160 a second each. Push the hot key share to 0.8 and one shard alone is offered 320 against its own 160, so it pins and sheds while the utilisation meter, an average across all four, still looks comfortable.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 11. Autoscaling Service
 *     api: 3 INSTANCES x 3 slots each = 9 slots / 25ms -> 360 rps, against
 *     250 rps offered. That is 69% utilisation, which is deliberately the
 *     controller's own setpoint: at 1x the autoscaler has already converged
 *     and holds the fleet steady, so the system is stable and the student
 *     sees a controller at rest.
 *
 *     RETUNED for the instance model. It used to be one node with `capacity:
 *     9` and the controller moved that 9 up and down -- arithmetically the
 *     same system, but the thing being added was a thread, which is invisible
 *     and is not what "autoscaling" means to anyone. The fleet is now three
 *     machines of three slots: same 9 slots, same 360 rps, same 69% at 1x,
 *     but now the number the controller moves is a number of MACHINES and the
 *     canvas can draw them appearing.
 *
 *     The lesson is what happens when you MOVE the load. Raise the client's
 *     rps and capacity does not follow immediately: the controller waits out
 *     its 3s cooldown, decides, and then the new machines take a further 4s
 *     to boot. Requests fail in that gap, and the gap is the whole point --
 *     an autoscaler is a lagging controller, not a shield. Scale-DOWN is
 *     instant, as it is in reality, which is why the recovery looks nothing
 *     like the climb.
 *
 *     maxCapacity 5 instances -> 15 slots -> 600 rps ceiling, so 4x
 *     (1000 rps) outruns the autoscaler no matter how patient it is: past
 *     some point the answer is not more of the same box. (Under the old
 *     slot-based reading this bound was `maxCapacity: 16` slots for the same
 *     640 rps; the ceiling is what was preserved, not the integer.)
 * ------------------------------------------------------------------ */

const autoscalingService: Topology = {
  nodes: [
    node('client', 'client', 'Client', COL(0), ROW(1), { rps: 250, timeoutMs: 3000 }),
    node('api', 'service', 'API Server', COL(1), ROW(1), {
      // Three slots on one machine; three machines running right now.
      capacity: 3,
      instances: 3,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 256,
    }),
    node('db', 'db', 'Database', COL(2), ROW(1), {
      capacity: 24,
      serviceMs: 8,
      serviceCv: 0.6,
      queueLimit: 128,
    }),
    // The controller sits below the node it scales, joined to it by a CONTROL
    // edge. That edge names its target and carries no requests -- the engine
    // keeps control edges out of routing entirely, so this is a supervisory
    // relationship the topology states outright rather than something a
    // student has to infer from a wire that looks like every other wire.
    node('scaler', 'autoscaler', 'Autoscaler', COL(1), ROW(2), {
      targetUtil: 0.7,
      // In INSTANCES: never fewer than 2 machines, never more than 5.
      minCapacity: 2,
      maxCapacity: 5,
      cooldownMs: 3000,
      scaleStepPct: 0.5,
      warmupMs: 4000,
    }),
  ],
  edges: [edge('client', 'api'), edge('api', 'db'), control('scaler', 'api')],
  annotations: [
    note(
      'as-note-lag',
      40,
      456,
      'Raise the load and capacity does not follow. The controller waits out three seconds of cooldown, decides, and the new machines take four more to boot. Requests fail in that gap, and the gap is the point: an autoscaler lags, it does not shield.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 12. Multi-Region Failover
 *     Two regions, each 10 slots / 25ms -> 400 rps. Only ONE serves traffic
 *     at a time, so the pair buys availability and not one request per second
 *     of extra capacity -- which is why 4x (1000 rps) melts the active region
 *     while the standby sits at zero.
 *     Crash `us-api` (or cut the edge to it) and traffic lands on `eu-api`
 *     after the 5s failover window, during which every request fails as
 *     'region-down'. Set failoverMs to 0 to see the cutover no real system
 *     gets, or to 30000 to feel what a slow one costs.
 * ------------------------------------------------------------------ */

const multiRegion: Topology = {
  nodes: [
    node('client', 'client', 'Client', COL(0), ROW(1), { rps: 250, timeoutMs: 2000 }),
    node('router', 'region', 'Region Router', COL(1), ROW(1), {
      regions: 2,
      activeRegion: 0,
      failoverMs: 5000,
    }),
    node('us-api', 'service', 'US API', COL(2), ROW(0), {
      capacity: 10,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 64,
    }),
    node('eu-api', 'service', 'EU API', COL(2), ROW(2), {
      capacity: 10,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 64,
    }),
    node('us-db', 'db', 'US Database', COL(3), ROW(0), {
      capacity: 16,
      serviceMs: 12,
      serviceCv: 0.6,
      queueLimit: 96,
    }),
    node('eu-db', 'db', 'EU Database', COL(3), ROW(2), {
      capacity: 16,
      serviceMs: 12,
      serviceCv: 0.6,
      queueLimit: 96,
    }),
  ],
  // Edge ORDER is region index: the first edge out of the router is region 0.
  edges: [
    edge('client', 'router'),
    edge('router', 'us-api'),
    edge('router', 'eu-api'),
    edge('us-api', 'us-db'),
    edge('eu-api', 'eu-db'),
  ],
  annotations: [
    sectionOver('mr-sec-us', 'United States, taking traffic', 0, 2, 3, 0, 0),
    sectionOver('mr-sec-eu', 'Europe, idle until it is needed', 3, 2, 3, 2, 2),
    note(
      'mr-note-fail',
      1064,
      40,
      'Crash the US API. For five seconds every request fails while the router notices, then Europe picks it all up. Only one region takes traffic at a time, so this pair buys you survival, not extra capacity: at 4x the active region melts while the standby sits at zero.',
      300,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 13. Full Stack
 *     The showcase. Every tier in one picture, each sized so that the thing
 *     that breaks first is the thing a real system breaks first.
 *
 *     600 rps offered, and here is where it goes:
 *       cdn     hitRate 0.70   -> 30% miss, so ~180 rps reach the LB
 *       lb      -> 2 api, ~90 rps each
 *       api     2 x 12 slots / 8ms  -> 3000 rps, never the bottleneck
 *       cache   hitRate 0.60   -> 40% miss, so ~72 rps reach the shards
 *       shards  4 x 2 slots / 25ms  -> 320 rps total, 80 rps per shard
 *       queue   -> workers 6 / 25ms -> 240 rps of async drain
 *
 *     Both paths are sized to have real headroom at 1x and to run out of it
 *     by 4x, but they run out DIFFERENTLY, and that contrast is the lesson:
 *
 *       - the synchronous path (cache -> shards) fails LOUDLY. The shards
 *         saturate, sheds start, and the client sees errors and a fat tail.
 *       - the asynchronous path (queue -> workers) fails QUIETLY. The workers
 *         saturate too, but the queue absorbs the excess, so the client is
 *         still acknowledged instantly while an invisible backlog grows.
 *
 *     A student who watches only the error rate sees half the failure. The
 *     queue depth is the other half, and it is the half that takes hours to
 *     drain after the spike is over.
 * ------------------------------------------------------------------ */

const fullStack: Topology = {
  nodes: [
    node('client', 'client', 'Client', COL(0), ROW(1), { rps: 600, timeoutMs: 3000 }),
    node('cdn', 'cdn', 'CDN Edge', COL(1), ROW(1), {
      capacity: 256,
      serviceMs: 2,
      serviceCv: 0.3,
      hitRate: 0.7,
      queueLimit: 2048,
    }),
    node('lb', 'lb', 'Load Balancer', COL(2), ROW(1), {
      capacity: 512,
      serviceMs: 0.5,
    }),
    node('api1', 'service', 'API 1', COL(3), ROW(0), {
      capacity: 12,
      serviceMs: 8,
      serviceCv: 0.5,
      queueLimit: 128,
    }),
    node('api2', 'service', 'API 2', COL(3), ROW(2), {
      capacity: 12,
      serviceMs: 8,
      serviceCv: 0.5,
      queueLimit: 128,
    }),
    node('cache', 'cache', 'Cache', COL(4), ROW(0), {
      capacity: 64,
      serviceMs: 2,
      serviceCv: 0.4,
      hitRate: 0.6,
      queueLimit: 512,
    }),
    node('shards', 'shard', 'Sharded Store', COL(5), ROW(0), {
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 32,
      shardCount: 4,
      shardCapacity: 2,
      hotKeyFraction: 0,
    }),
    node('queue', 'queue', 'Job Queue', COL(4), ROW(2), {
      serviceMs: 1,
      serviceCv: 0.2,
      queueLimit: 5000,
    }),
    node('workers', 'worker', 'Workers', COL(5), ROW(2), {
      capacity: 6,
      serviceMs: 25,
      serviceCv: 0.6,
    }),
  ],
  edges: [
    edge('client', 'cdn'),
    edge('cdn', 'lb'),
    edge('lb', 'api1'),
    edge('lb', 'api2'),
    // Each api reads through the cache AND books async work. Both edges are
    // taken for every request: a 'service' fans out to all its downstreams.
    edge('api1', 'cache'),
    edge('api1', 'queue'),
    edge('api2', 'cache'),
    edge('api2', 'queue'),
    edge('cache', 'shards'),
    edge('queue', 'workers'),
  ],
  annotations: [
    // Only the two ends are framed. The point of this example is the
    // contrast between them, and boxing the middle would bury it.
    sectionOver('fs-sec-sync', 'Answered while you wait', 0, 4, 5, 0, 0),
    sectionOver('fs-sec-async', 'Answered later', 3, 4, 5, 2, 2),
    note(
      'fs-note-cdn',
      1584,
      40,
      'Two thirds of the traffic never gets past the edge cache. Only the misses reach anything below, which is why everything behind it looks so lightly loaded at rest.',
      236,
    ),
    // The lesson. Both halves run out of room at 4x; only one of them
    // tells you about it.
    note(
      'fs-note-lesson',
      16,
      336,
      'Take the load to 4x and watch both halves. The sharded store saturates and the client sees errors straight away. The workers saturate too, but the queue swallows the excess, so the client is still told everything is fine while a backlog builds that takes hours to drain.',
      300,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 14. Specialised Stores
 *     Every request finds the store built for it, and the arithmetic of
 *     WHY each store exists is visible in the meters.
 *
 *     240 rps offered, split three ways by the LB (~80 rps per API):
 *       search-api -> searchindex   80 rps at a 90/10 search/write mix.
 *                     Mean cost ~14ms against 12 slots -> ~850 rps ceiling.
 *                     Writes pay +60ms of indexing and are searchable only
 *                     1.5s after commit; the stale-search rate IS that lag.
 *       recs-api   -> vectordb + graphdb. The vector index costs ~50ms per
 *                     query at 1M vectors and 0.9 recall (16 slots ->
 *                     320 rps ceiling: the knee of this preset), the graph
 *                     runs friend-of-friend at depth 2 (~18ms -> 440 rps).
 *       media-api  -> objectstore. 90ms flat, 64 slots -> ~710 rps: high
 *                     latency, near-unlimited throughput. Not a database.
 *       every api  -> timeseriesdb. All 240 rps of metrics appends land
 *                     there and use ~11% of it; range queries are the only
 *                     thing that can hurt it, and that is a slider.
 *
 *     A separate 6 rps batch client archives through a queue into cold
 *     storage (24 slots / 2.8s -> ~8.5 rps ceiling, ~70% busy at 1x).
 *
 *     At 4x the two paths fail in character: the vector index saturates
 *     LOUDLY (sheds, client errors) while the archive pipeline fails
 *     QUIETLY -- the batch client is still acknowledged instantly while
 *     cold storage sheds the restores behind the queue.
 * ------------------------------------------------------------------ */

const specialisedStores: Topology = {
  nodes: [
    node('client', 'client', 'Client', COL(0), ROW(1), { rps: 240, timeoutMs: 3000 }),
    node('batch', 'client', 'Batch Jobs', COL(0), LROW(3, 1), {
      rps: 6,
      timeoutMs: 2000,
    }),
    node('lb', 'lb', 'Load Balancer', COL(1), ROW(1), {
      capacity: 512,
      serviceMs: 0.5,
    }),
    node('archive-q', 'queue', 'Archive Queue', COL(1), LROW(3, 1), {
      serviceMs: 1,
      serviceCv: 0.2,
      queueLimit: 5000,
    }),
    node('search-api', 'service', 'Search API', COL(2), ROW(0), {
      capacity: 8,
      serviceMs: 6,
      serviceCv: 0.4,
      queueLimit: 128,
    }),
    node('recs-api', 'service', 'Recs API', COL(2), ROW(1), {
      capacity: 8,
      serviceMs: 6,
      serviceCv: 0.4,
      queueLimit: 128,
    }),
    node('media-api', 'service', 'Media API', COL(2), ROW(2), {
      capacity: 8,
      serviceMs: 6,
      serviceCv: 0.4,
      queueLimit: 128,
    }),
    node('archiver', 'worker', 'Archiver', COL(2), LROW(3, 1), {
      capacity: 2,
      serviceMs: 40,
      serviceCv: 0.4,
    }),
    node('search', 'searchindex', 'Search Index', COL(3), ROW(0)),
    // 12 slots at ~50ms per query is a 240 rps ceiling: a third used at 1x,
    // and the first thing to saturate at 4x, which makes the vector index
    // the knee of the whole preset.
    node('vectors', 'vectordb', 'Vector Index', COL(3), ROW(1), { capacity: 12 }),
    node('blobs', 'objectstore', 'Object Storage', COL(3), ROW(2)),
    node('glacier', 'coldstorage', 'Cold Storage', COL(3), LROW(3, 1)),
    node('social', 'graphdb', 'Social Graph', COL(4), ROW(0)),
    node('metrics', 'timeseriesdb', 'Metrics Store', COL(4), ROW(2)),
  ],
  edges: [
    edge('client', 'lb'),
    edge('lb', 'search-api'),
    edge('lb', 'recs-api'),
    edge('lb', 'media-api'),
    // Each API talks to its own store AND emits a metric append; a service
    // fans out to all its downstreams, so the metrics edge is taken for
    // every request, which is exactly what instrumentation does.
    edge('search-api', 'search'),
    edge('search-api', 'metrics'),
    edge('recs-api', 'vectors'),
    edge('recs-api', 'social'),
    edge('recs-api', 'metrics'),
    edge('media-api', 'blobs'),
    edge('media-api', 'metrics'),
    // The archive path: acknowledged at the queue, drained at the
    // archiver's pace, paid for in seconds at the cold tier.
    edge('batch', 'archive-q'),
    edge('archive-q', 'archiver'),
    edge('archiver', 'glacier'),
  ],
  annotations: [
    sectionOver('ss-sec-stores', 'A different store for each question', 0, 2, 4, 0, 2),
    sectionOver('ss-sec-arch', 'Moving old data somewhere cheaper', 2, 0, 3, 3, 3, 1),
    note(
      'ss-note-stores',
      1320,
      40,
      'One general purpose database would do all of this badly. A text index, a vector index and a graph each answer a question the others are slow at, and the price is four stores to run instead of one.',
      300,
    ),
    // The lesson: the same overload, told two different ways depending on
    // whether the caller is still waiting for an answer.
    note(
      'ss-note-lesson',
      1320,
      296,
      'Take the load to 4x. The vector index saturates and the client sees the errors immediately. The archive path saturates too and says nothing: the batch client is still acked while cold storage sheds behind the queue.',
      300,
    ),
    note(
      'ss-note-cold',
      16,
      296,
      'Cold storage is slow on purpose, seconds per restore, because almost nothing is ever read back. Paying for fast storage you never read is the mistake this avoids.',
      236,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 15. Event-Driven Backend
 *
 * The messaging tier in one picture, with the arithmetic worked out:
 *
 *   client 60 rps -> apigateway (300 rps bucket, 1% bad auth, 2ms)
 *     routes 3:1 -> api service (16 slots / 10ms = 1600 rps ceiling) ~44 rps
 *                -> lambda (25ms warm, +350ms cold, 40 concurrent)   ~15 rps
 *   api fans out to:
 *     stream broker (4 partitions, retention 2000):
 *       group A -> indexer  (4 slots / 55ms -> ~72/s; 4 partitions x
 *                  1000/55 = ~72/s -- keeps up at 1x, lags visibly at 2x+)
 *       group B -> billing  (4 slots / 12ms -> ~330/s; never behind)
 *     pub/sub topic -> push, audit, metrics (1 publish = 3 deliveries;
 *       audit is deliberately slow (2 slots / 40ms = 50/s) so at ~44 rps it
 *       runs hot without touching the other subscribers)
 *   chat client 30 conn/s -> websocket gateway (400 connection slots,
 *       8s sessions -> ~240 held, 60% full at 1x; 4x offers 120 conn/s =
 *       960 wanted and the gateway refuses everything past 400)
 *       -> sidecar (2ms tax, 2 retries, eject after 5) -> chat service
 *   cron: every 15s, 40 requests at once -> lambda -> shared db. The warm
 *       pool (~1-2 instances) cannot cover a burst of 40, so nearly every
 *       burst invocation pays the cold start, and the db (8 slots / 20ms =
 *       400/s) absorbs a spike that shows up in interactive latency.
 * ------------------------------------------------------------------ */

const eventDriven: Topology = {
  nodes: [
    node('client', 'client', 'API Clients', 40, 140, { rps: 60, timeoutMs: 2500 }),
    node('gw', 'apigateway', 'API Gateway', 250, 140, {
      capacity: 64,
      serviceMs: 2,
      // 60 rps of interactive traffic fits comfortably; at 4x the door is
      // exactly what refuses the excess, which is its job and its lesson.
      rateLimitRps: 150,
      burst: 150,
      authFailRate: 0.01,
    }),
    node('api', 'service', 'API Service', 470, 140, {
      capacity: 16,
      serviceMs: 10,
      serviceCv: 0.5,
      queueLimit: 128,
    }),
    node('broker', 'streambroker', 'Event Stream', 700, 60, {
      serviceMs: 1,
      partitions: 4,
      queueLimit: 2000,
    }),
    node('indexer', 'service', 'Search Indexer', 930, 20, {
      capacity: 4,
      serviceMs: 55,
      serviceCv: 0.6,
      queueLimit: 32,
    }),
    node('billing', 'service', 'Billing', 930, 130, {
      capacity: 4,
      serviceMs: 12,
      serviceCv: 0.5,
      queueLimit: 32,
    }),
    node('topic', 'pubsub', 'Fan-out Topic', 700, 230, { serviceMs: 0.5 }),
    node('push', 'service', 'Push Notifs', 930, 240, {
      capacity: 4,
      serviceMs: 8,
      serviceCv: 0.5,
      queueLimit: 32,
    }),
    node('audit', 'service', 'Audit Log', 930, 350, {
      capacity: 2,
      serviceMs: 40,
      serviceCv: 0.6,
      queueLimit: 24,
    }),
    node('metrics', 'service', 'Metrics', 930, 460, {
      capacity: 4,
      serviceMs: 5,
      serviceCv: 0.4,
      queueLimit: 32,
    }),
    node('chat', 'client', 'Chat Clients', 40, 420, { rps: 30, timeoutMs: 2000 }),
    node('ws', 'websocket', 'WS Gateway', 250, 420, {
      capacity: 400,
      serviceMs: 5,
      connectionMs: 8000,
    }),
    node('mesh', 'sidecar', 'Chat Sidecar', 470, 420, {
      capacity: 32,
      serviceMs: 2,
      timeoutMs: 500,
      retries: 2,
      outlierAfter: 5,
      openMs: 3000,
    }),
    node('chatsvc', 'service', 'Chat Service', 690, 420, {
      capacity: 8,
      serviceMs: 12,
      serviceCv: 0.5,
      queueLimit: 64,
    }),
    node('cron', 'cron', 'Nightly Report', 40, 560, {
      intervalMs: 15000,
      batchSize: 40,
    }),
    node('fn', 'lambda', 'Report Fn', 300, 560, {
      serviceMs: 25,
      serviceCv: 0.5,
      coldStartMs: 350,
      keepWarmMs: 10000,
      maxConcurrency: 30,
    }),
    node('db', 'db', 'Database', 560, 560, {
      capacity: 8,
      serviceMs: 20,
      serviceCv: 0.6,
      queueLimit: 64,
    }),
  ],
  edges: [
    edge('client', 'gw'),
    // The gateway's route table: 3 parts interactive API, 1 part function.
    edge('gw', 'api', 3),
    edge('gw', 'fn', 1),
    edge('api', 'broker'),
    edge('api', 'topic'),
    // Each broker edge is an independent consumer group.
    edge('broker', 'indexer'),
    edge('broker', 'billing'),
    // Each topic edge is one more delivery per publish.
    edge('topic', 'push'),
    edge('topic', 'audit'),
    edge('topic', 'metrics'),
    edge('chat', 'ws'),
    edge('ws', 'mesh'),
    edge('mesh', 'chatsvc'),
    edge('cron', 'fn'),
    edge('fn', 'db'),
  ],
  // Notes only, no sections. These nodes are hand-placed rather than on the
  // COL/ROW grid, and the twelve pixels between Billing and the fan-out
  // topic cannot hold two frames plus a label plate. Nudging the layout to
  // make room would cost more than the frames are worth here.
  annotations: [
    note(
      'ed-note-sync',
      16,
      248,
      'Everything on the left is a caller waiting for an answer. Everything on the right runs after that answer was already sent.',
      236,
    ),
    // The lesson. Five consumers, one of which quietly cannot keep up.
    note(
      'ed-note-fanout',
      1160,
      16,
      'One event becomes five pieces of work here, each read by its own consumer. Turn the load up and watch the audit log: it takes 40ms a message and falls behind while the four beside it keep up, and nobody calling the API sees a thing.',
      300,
    ),
    note(
      'ed-note-cold',
      16,
      680,
      'The report function starts cold. The first call after a quiet spell pays 350ms of startup, then stays warm for ten seconds. Watch the first burst after the timer fires.',
      236,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * Resilient Delivery
 *     The resilience tier in one picture: every way a system can fail
 *     ON PURPOSE instead of by surprise.
 *
 *     Sync path, 240 rps offered:
 *       shedder   admits 700 rps sustained; 30% of keys are best-effort.
 *                 Invisible at 1x, and at 4x it drops the best-effort tier
 *                 first while the important traffic keeps its tokens.
 *       api       16 slots / 6ms -> 2600 rps, never the bottleneck.
 *       bulkhead  12 concurrent calls around recommendations. At 240 rps
 *                 a 15ms dependency holds ~3.6 in flight on average, and
 *                 the pool is sized at 3x that mean because concurrency is
 *                 Poisson: a pool at the mean would clip ordinary bursts.
 *                 Slow the dependency (inject 'slow') and the pool fills
 *                 within one round trip, after which the excess fails in
 *                 microseconds instead of queueing.
 *       recs      6 slots / 15ms -> 400 rps ceiling behind the bulkhead.
 *       writebehind  acks every write in ~1ms and holds it dirty for
 *                 200ms before the flush lands on the db: a standing
 *                 population of ~50 acknowledged-but-unwritten rows.
 *                 Crash it and watch exactly that many failures appear.
 *       retryqueue -> notify   the notification service fails 15% of
 *                 calls, so ~40/s are redelivered with backoff and only
 *                 the 0.34% that fail three straight attempts dead-letter:
 *                 failures with somewhere to go, counted on the shelf.
 *
 *     Batch path, 3 uploads/s:
 *       encode queue -> transcoder farm, 2 boxes x 2 jobs / 1.2s = 3.3
 *       jobs/s of drain against 3.0 offered. ~90% utilised at 1x; at 4x
 *       the 12 jobs/s deficit grows the backlog by ~9 jobs every second,
 *       and no amount of waiting drains it. Scale `instances` to fix it.
 * ------------------------------------------------------------------ */

const resilientDelivery: Topology = {
  nodes: [
    node('client', 'client', 'Client', COL(0), ROW(1), { rps: 240, timeoutMs: 2500 }),
    node('shedder', 'loadshedder', 'Load Shedder', COL(1), ROW(1), {
      rateLimitRps: 700,
      burst: 700,
      lowPriorityShare: 0.3,
      priorityReserve: 0.3,
    }),
    node('api', 'service', 'API Server', COL(2), ROW(1), {
      capacity: 16,
      serviceMs: 6,
      serviceCv: 0.4,
      queueLimit: 128,
    }),
    node('bulkhead', 'bulkhead', 'Recs Bulkhead', COL(3), ROW(0), {
      bulkheadMax: 12,
    }),
    node('recs', 'service', 'Recommendations', COL(4), ROW(0), {
      capacity: 6,
      serviceMs: 15,
      serviceCv: 0.5,
      queueLimit: 32,
    }),
    node('writebuf', 'writebehind', 'Write-Behind Cache', COL(3), ROW(1), {
      capacity: 256,
      serviceMs: 1,
      serviceCv: 0.3,
      queueLimit: 512,
      flushDelayMs: 200,
    }),
    node('db', 'db', 'Database', COL(4), ROW(1), {
      capacity: 12,
      serviceMs: 15,
      serviceCv: 0.6,
      queueLimit: 96,
    }),
    node('retryq', 'retryqueue', 'Notify Queue', COL(3), ROW(2), {
      capacity: 8,
      serviceMs: 3,
      serviceCv: 0.3,
      queueLimit: 2000,
      timeoutMs: 1000,
      retries: 2,
    }),
    node('notify', 'service', 'Notification Service', COL(4), ROW(2), {
      capacity: 6,
      serviceMs: 12,
      serviceCv: 0.5,
      errorRate: 0.15,
      queueLimit: 48,
    }),
    node('uploader', 'client', 'Upload Client', COL(0), LROW(3, 1), {
      rps: 3,
      timeoutMs: 4000,
    }),
    node('encodeq', 'queue', 'Encode Queue', COL(1), LROW(3, 1), {
      serviceMs: 1,
      serviceCv: 0.2,
      queueLimit: 5000,
    }),
    node('transcoder', 'transcoder', 'Transcoder Farm', COL(2), LROW(3, 1), {
      instances: 2,
      capacity: 2,
      serviceMs: 1200,
      serviceCv: 0.3,
    }),
  ],
  edges: [
    edge('client', 'shedder'),
    edge('shedder', 'api'),
    // The api fans out to all three: recommendations behind their own
    // bulkhead, writes into the write-behind buffer, and a notification
    // job into the retry queue. Both delivery nodes ack instantly, so
    // the client's fate rides on the recommendations path alone.
    edge('api', 'bulkhead'),
    edge('api', 'writebuf'),
    edge('api', 'retryq'),
    edge('bulkhead', 'recs'),
    edge('writebuf', 'db'),
    edge('retryq', 'notify'),
    edge('uploader', 'encodeq'),
    edge('encodeq', 'transcoder'),
  ],
  annotations: [
    sectionOver('rd-sec-live', 'Failing on purpose, not by surprise', 0, 1, 4, 0, 2),
    sectionOver('rd-sec-batch', 'Work that can wait', 2, 0, 2, 3, 3, 1),
    note(
      'rd-note-shed',
      16,
      16,
      'At 4x the shedder drops the traffic marked best effort and keeps serving the rest. Choosing what to drop beats letting a queue choose for you.',
      236,
    ),
    // The lesson. A bulkhead is the one protection whose effect you can
    // trigger by hand and see in a single round trip.
    note(
      'rd-note-bulkhead',
      1320,
      40,
      "Right click recommendations and inject slow. The bulkhead in front fills within one round trip, and after that the extra calls fail in microseconds instead of queueing. One slow feature stops being everyone else's problem.",
      300,
    ),
    note(
      'rd-note-writebuf',
      1320,
      264,
      'The write cache acks in about a millisecond and flushes 200ms later, so roughly 50 rows are always acknowledged but not yet stored. Crash it and exactly that many writes are gone.',
      300,
    ),
    note(
      'rd-note-batch',
      800,
      496,
      'The transcoders drain about 3.3 jobs a second against 3 arriving, so they are already 90 percent busy at rest. Turn the load up and the backlog grows about 9 jobs every second and never drains on its own. Raise the number of instances to fix it.',
      300,
    ),
  ],
};

export const foundationalTopologies = {
  singleServer, loadBalanced, cacheAside, asyncWorkers, retryStorm,
  cdnOrigin, rateLimitedApi, circuitBreaker, readReplicas, shardedDatabase,
  autoscalingService, multiRegion, fullStack, specialisedStores, eventDriven,
  resilientDelivery,
};
export {
  singleServer, loadBalanced, cacheAside, asyncWorkers, retryStorm,
  cdnOrigin, rateLimitedApi, circuitBreaker, readReplicas, shardedDatabase,
  autoscalingService, multiRegion, fullStack, specialisedStores, eventDriven,
  resilientDelivery,
};
