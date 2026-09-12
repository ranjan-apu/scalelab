/**
 * Concept lessons: short teachable units behind practice.
 *
 * A glossary entry explains ONE term in two sentences. A concept lesson
 * teaches WHEN to reach for an idea, what goes wrong, and which runnable
 * preset proves it. Packs link here through `concepts`, labs through
 * `conceptIds`; the Guide renders these grouped by track.
 *
 * House style (mirrors the glossary contract):
 *   - summaries in plain language, addressed as "you", no em dashes.
 *   - every glossaryIds entry must exist in GLOSSARY (enforced by test).
 *   - every simDemo.presetId must exist in PRESETS (enforced by test).
 */

import type { TrafficPattern } from '../sim/types';

export type ConceptTrack = 'core' | 'tech' | 'pattern' | 'advanced';

export interface ConceptDemo {
  presetId: string;
  scenario: TrafficPattern;
  /** What to watch while the scenario runs. */
  watch: string;
}

export interface ConceptLesson {
  id: string;
  title: string;
  track: ConceptTrack;
  summary: string;
  whenToUse: string[];
  pitfalls: string[];
  simDemo: ConceptDemo;
  glossaryIds: string[];
  checkYourself: string[];
}

export const CONCEPTS: readonly ConceptLesson[] = [
  /* ---- core --------------------------------------------------------- */
  {
    id: 'networking',
    title: 'Networking Essentials',
    track: 'core',
    summary:
      'How services talk: request/response over HTTP for most things, persistent connections when updates must be pushed, and fast binary protocols between services. Distance sets a floor on latency that no tuning removes.',
    whenToUse: [
      'Default to HTTP request/response between clients and servers',
      'Reach for pushed updates when clients must learn about events in under a second',
      'Replicate near users when cross-region round trips break the latency budget',
    ],
    pitfalls: [
      'Opening stateful connections for data that polling could carry',
      'Forgetting that one New York to London round trip costs more than a whole local call chain',
    ],
    simDemo: {
      presetId: 'discord',
      scenario: 'steady',
      watch: 'Connection holders fill before request queues do',
    },
    glossaryIds: ['latency', 'websocket', 'load-balancer', 'cdn'],
    checkYourself: [
      'When is polling cheaper than a socket per client?',
      'What breaks first when every client holds a connection?',
    ],
  },
  {
    id: 'api-design',
    title: 'API Design',
    track: 'core',
    summary:
      'The contract clients program against: resources with verbs, paged lists, and auth that travels with the request. Sketch it in minutes, then spend design time on the hard parts behind it.',
    whenToUse: [
      'Name 4 to 5 endpoints before drawing any boxes',
      'Page every list that can grow without bound',
      'Put rate limits on any endpoint strangers can call',
    ],
    pitfalls: [
      'Designing perfect endpoints while the storage and scaling questions stay open',
      'Returning unbounded lists that get slower as the product succeeds',
    ],
    simDemo: {
      presetId: 'rate-limited-api',
      scenario: 'spike',
      watch: 'Excess callers are refused at the door while served calls stay fast',
    },
    glossaryIds: ['rate-limiter', 'tokens', 'throttled', 'latency'],
    checkYourself: [
      'Which of your endpoints needs paging on day one?',
      'Where does auth get checked: gateway, service, or both?',
    ],
  },
  {
    id: 'data-modeling',
    title: 'Data Modeling',
    track: 'core',
    summary:
      'Choosing what to store and how rows relate. Start normalized so each fact lives in one place, then duplicate data onto hot read paths only when measurements justify it.',
    whenToUse: [
      'Model relationships explicitly while the schema is still small',
      'Denormalize the few queries that dominate traffic, not every query',
      'Design key structures around your most frequent access pattern first',
    ],
    pitfalls: [
      'Duplicating data everywhere up front, then paying for every update twice',
      'Joining across huge tables on the request path instead of precomputing',
    ],
    simDemo: {
      presetId: 'sharded-database',
      scenario: 'steady',
      watch: 'One key layout serves user queries while global queries scatter',
    },
    glossaryIds: ['database', 'shard', 'read-replica', 'range-query'],
    checkYourself: [
      'Which query is your hottest, and which tables does it touch?',
      'What breaks if a duplicated field updates late?',
    ],
  },
  {
    id: 'db-indexing',
    title: 'Database Indexing',
    track: 'core',
    summary:
      'Indexes trade write cost and storage for fast lookups. Index the columns your real queries filter on, combine columns for multi-filter queries, and offload full-text or geo search to a purpose-built index.',
    whenToUse: [
      'Add an index when a frequent query scans instead of seeking',
      'Use composite indexes for queries that always filter on the same columns together',
      'Sync a search index from the primary database when text relevance matters',
    ],
    pitfalls: [
      'Indexing every column and slowing every write to speed no read',
      'Running full-text search as substring scans against the primary store',
    ],
    simDemo: {
      presetId: 'specialised-stores',
      scenario: 'steady',
      watch: 'Search traffic leaves the primary store alone',
    },
    glossaryIds: ['database', 'searchindex', 'stale-search', 'read-fraction'],
    checkYourself: [
      'Which two queries deserve an index first?',
      'How stale may the search index be before users notice?',
    ],
  },
  {
    id: 'caching',
    title: 'Caching',
    track: 'core',
    summary:
      'Answer repeated reads from fast memory instead of the database. Cache-aside covers most cases: check the cache, fall through to the store, backfill with a TTL. Invalidation and stampedes are the real subject.',
    whenToUse: [
      'Cache data that is read far more often than it changes',
      'Invalidate on write and keep TTLs short enough that staleness stays invisible',
      'Guard regeneration so one expiry does not stampede the database',
    ],
    pitfalls: [
      'Caching everything, including data that changes on every request',
      'Letting a full cache outage transfer the entire load to the database at once',
    ],
    simDemo: {
      presetId: 'cache-aside',
      scenario: 'steady',
      watch: 'Lower the hit rate and watch the database saturate',
    },
    glossaryIds: ['cache', 'hit-rate', 'stale-read', 'retry-storm'],
    checkYourself: [
      'What is your hottest key, and how long may it be stale?',
      'What happens the minute your cache tier goes dark?',
    ],
  },
  {
    id: 'sharding',
    title: 'Sharding',
    track: 'core',
    summary:
      'Split one database into many when a single node cannot hold the data or the writes. The shard key decides which queries stay fast and which become scatter-gather, so choose it from query patterns, not habit.',
    whenToUse: [
      'Shard when storage or write throughput outgrows one tuned node plus replicas',
      'Keep transactions inside one shard by drawing boundaries around them',
      'Plan for hot keys with splitting or caching before they arrive',
    ],
    pitfalls: [
      'Sharding at gigabytes, buying distributed pain for single-node problems',
      'Picking a shard key that puts every celebrity on the same partition',
    ],
    simDemo: {
      presetId: 'sharded-database',
      scenario: 'steady',
      watch: 'Raise the hot key fraction and watch one partition melt',
    },
    glossaryIds: ['shard', 'hot-key', 'partitions', 'database'],
    checkYourself: [
      'Which queries hit one shard, and which hit them all?',
      'Where does your hottest key land?',
    ],
  },
  {
    id: 'consistent-hashing',
    title: 'Consistent Hashing',
    track: 'core',
    summary:
      'A way to spread keys over nodes so adding or removing a node moves only a sliver of data instead of nearly all of it. The ring makes elastic caches and stores practical.',
    whenToUse: [
      'Name it whenever nodes join or leave under load',
      'Pair it with replication when one node dying must not lose its range',
      'Prefer it over plain modulo mapping for any growing fleet',
    ],
    pitfalls: [
      'Explaining ring mechanics in an interview instead of stating the property you need',
      'Assuming even hashing fixes hot keys: popularity still skews',
    ],
    simDemo: {
      presetId: 'cache-aside',
      scenario: 'ramp',
      watch: 'Extra cache capacity absorbs the ramp instead of migrating everything',
    },
    glossaryIds: ['cache', 'partitions', 'consistent-hashing', 'hit-rate'],
    checkYourself: [
      'How much data moves when you add one node?',
      'What still breaks when one key is far hotter than the rest?',
    ],
  },
  {
    id: 'consistency-models',
    title: 'Consistency Models',
    track: 'core',
    summary:
      'How quickly all copies agree. Eventual consistency keeps feeds fast and available; strong consistency protects money, inventory, and seats. Most real systems mix both per subsystem.',
    whenToUse: [
      'Default to eventual consistency for feeds, recommendations, and analytics',
      'Demand strong consistency where stale reads cost money or double-book',
      'Say which parts use which model instead of picking one for everything',
    ],
    pitfalls: [
      'Promising strong consistency globally, then paying coordination latency on every read',
      'Serving money or inventory from a lagging replica',
    ],
    simDemo: {
      presetId: 'read-replicas',
      scenario: 'steady',
      watch: 'Reads scale out while lagging reads go stale behind writes',
    },
    glossaryIds: ['read-replica', 'replication-lag', 'stale-read', 'database'],
    checkYourself: [
      'Which reads in your system may be seconds stale?',
      'Which write must never be lost or reordered?',
    ],
  },
  {
    id: 'capacity-numbers',
    title: 'Capacity Numbers',
    track: 'core',
    summary:
      'Order-of-magnitude math used at decision time, not as an opener. Know latency tiers and single-box ceilings so sharding, caching, and regional debates end with arithmetic instead of vibes.',
    whenToUse: [
      'Size fleets from requests per second divided by per-server headroom',
      'Compare memory, SSD, datacenter, and cross-region latencies before placing data',
      'Revisit the math when traffic shape changes, not just volume',
    ],
    pitfalls: [
      'Opening with estimates before requirements are even fixed',
      'Sizing for the average while the peak is several multiples higher',
    ],
    simDemo: {
      presetId: 'load-balanced',
      scenario: 'ramp',
      watch: 'Throughput climbs, then latency bends the curve',
    },
    glossaryIds: ['rps', 'throughput', 'goodput', 'latency', 'p99'],
    checkYourself: [
      'How many servers does your peak need, plus headroom?',
      'Which tier breaks first as load doubles?',
    ],
  },
  /* ---- tech --------------------------------------------------------- */
  {
    id: 'relational-db',
    title: 'Relational Databases',
    track: 'tech',
    summary:
      'Tables, SQL, joins, and transactions. The default for product data with real relationships: model clearly, index deliberately, and keep hot joins off the request path.',
    whenToUse: [
      'Store accounts, orders, and bookings with integrity guarantees',
      'Use transactions where partial writes would corrupt the story',
      'Add read replicas for read-heavy mixes before sharding',
    ],
    pitfalls: ['Joining across massive tables per request', 'Treating replicas as a fix for write pressure'],
    simDemo: {
      presetId: 'read-replicas',
      scenario: 'steady',
      watch: 'Replica reads scale while writes still queue on the primary',
    },
    glossaryIds: ['database', 'read-replica', 'replication-lag', 'range-query'],
    checkYourself: ['Where do your writes serialize?', 'Which join hurts first at 10x?'],
  },
  {
    id: 'nosql-db',
    title: 'NoSQL Databases',
    track: 'tech',
    summary:
      'Key-value, document, and wide-column stores that scale horizontally with flexible schemas. You design around access patterns up front: the partition key decides your fast queries.',
    whenToUse: [
      'Pick one store you can defend instead of comparing all of them',
      'Model the partition key from the queries you will actually run',
      'Use tunable consistency per operation, not per database',
    ],
    pitfalls: [
      'Claiming NoSQL automatically means more scale or more speed',
      'Discovering your main query needs a full scan after launch',
    ],
    simDemo: {
      presetId: 'sharded-database',
      scenario: 'steady',
      watch: 'Partition spread decides which queries stay single-partition',
    },
    glossaryIds: ['shard', 'partitions', 'hot-key', 'database'],
    checkYourself: ['What is your partition key and why?', 'Which query becomes the expensive one?'],
  },
  {
    id: 'blob-storage',
    title: 'Blob Storage',
    track: 'tech',
    summary:
      'Cheap, durable bytes for images, video, and files, with the database holding only pointers. Clients upload straight to storage with signed URLs; downloads ride the CDN.',
    whenToUse: [
      'Move every large byte out of the database and the request path',
      'Upload directly from clients with presigned URLs plus completion callbacks',
      'Chunk and resume anything big enough to fail halfway',
    ],
    pitfalls: [
      'Proxying gigabytes through app servers that add cost and latency',
      'Storing blobs in rows, then wondering why the database is slow and huge',
    ],
    simDemo: {
      presetId: 'cdn-origin',
      scenario: 'steady',
      watch: 'Edge answers crowd out origin fetches',
    },
    glossaryIds: ['objectstore', 'cdn', 'presigned-url', 'origin-fetch'],
    checkYourself: ['Which bytes flow through your servers, and why?', 'How does an interrupted upload resume?'],
  },
  {
    id: 'search-index',
    title: 'Search Indexes',
    track: 'tech',
    summary:
      'Inverted indexes that turn words into document lists, with tokenization, stemming, and fuzzy matching. Synced from the primary store, so results lag writes by design.',
    whenToUse: [
      'Offload full-text and faceted search from the primary database',
      'Shard the index like a database when the corpus outgrows one node',
      'Accept small staleness and say the bound out loud',
    ],
    pitfalls: ['Substring-scanning the primary store for search', 'Promising real-time search over an async pipeline'],
    simDemo: {
      presetId: 'specialised-stores',
      scenario: 'steady',
      watch: 'Search load never touches primary write pools',
    },
    glossaryIds: ['searchindex', 'stale-search', 'inverted-index', 'database'],
    checkYourself: ['How fresh must a new document be?', 'What ranks above what, and where is that computed?'],
  },
  {
    id: 'api-gateway',
    title: 'API Gateways',
    track: 'tech',
    summary:
      'The front door: routing, auth, rate limiting, and logging in one place before microservices. Include it by default; interviewers rarely ask you to go deep on it.',
    whenToUse: [
      'Terminate auth and enforce limits at the edge',
      'Route by path or content to the owning service',
      'Emit one request log series for the whole system',
    ],
    pitfalls: ['Stuffing business logic into the gateway', 'Drawing a gateway but enforcing nothing there'],
    simDemo: {
      presetId: 'rate-limited-api',
      scenario: 'spike',
      watch: 'The gateway refuses excess before it queues anywhere',
    },
    glossaryIds: ['apigateway', 'rate-limiter', 'unauthorized', 'throttled'],
    checkYourself: ['What does your gateway enforce?', 'What happens when the gateway itself saturates?'],
  },
  {
    id: 'load-balancer',
    title: 'Load Balancers',
    track: 'tech',
    summary:
      'Spread work over healthy machines. Content-aware balancing routes smartly; connection-level balancing stays fast and sticky for persistent sockets. Health checks decide who receives traffic.',
    whenToUse: [
      'Balance every tier that runs more than one machine',
      'Keep persistent connections pinned while machines churn',
      'Drain before removing, so in-flight work lands softly',
    ],
    pitfalls: ['Balancing once at the edge while inner tiers hot-spot', 'Spreading sockets randomly across restarts'],
    simDemo: {
      presetId: 'load-balanced',
      scenario: 'ramp',
      watch: 'Servers share the climb until the shared database bends',
    },
    glossaryIds: ['load-balancer', 'utilisation', 'target-util', 'latency'],
    checkYourself: ['What does the balancer know about each request?', 'How does a dying server leave the rotation?'],
  },
  {
    id: 'message-queue',
    title: 'Message Queues',
    track: 'tech',
    summary:
      'Buffers that decouple producers from consumers and absorb bursts. Workers drain at their own pace; retries, dead letters, and backpressure keep the buffer honest.',
    whenToUse: [
      'Buffer bursty arrivals behind steady workers',
      'Scale producers and consumers independently',
      'Quarantine poison messages instead of retrying forever',
    ],
    pitfalls: [
      'Queueing synchronous low-latency work and guaranteeing a missed budget',
      'Growing the queue forever instead of pushing back on producers',
    ],
    simDemo: {
      presetId: 'async-workers',
      scenario: 'spike',
      watch: 'Backlog grows, then drains, while errors stay flat',
    },
    glossaryIds: ['queue', 'queue-limit', 'dead-letter', 'redelivery', 'worker'],
    checkYourself: ['What bounds your queue, and what happens at the bound?', 'Where do poison messages go?'],
  },
  {
    id: 'event-streams',
    title: 'Streams and Event Sourcing',
    track: 'tech',
    summary:
      'Retained logs that many consumer groups can replay independently. State becomes a fold over events, which gives audit trails, replays, and real-time analytics from one pipe.',
    whenToUse: [
      'Feed several consumers from the same event history',
      'Replay to rebuild state, backfill, or audit',
      'Partition by key so ordering holds where it matters',
    ],
    pitfalls: ['One topic per user, exploding partition counts', 'Treating replay as free when consumers lag'],
    simDemo: {
      presetId: 'event-driven',
      scenario: 'ramp',
      watch: 'Two consumer groups diverge: one keeps up, one lags',
    },
    glossaryIds: ['streambroker', 'consumer-lag', 'partitions', 'retention'],
    checkYourself: ['Who replays, and from where?', 'Which consumer falls behind first?'],
  },
  {
    id: 'distributed-lock',
    title: 'Distributed Locks',
    track: 'tech',
    summary:
      'Mutual exclusion across machines, usually a lease with an expiry so a crashed holder cannot jam the system forever. Use sparingly: locks serialize exactly the path you wanted parallel.',
    whenToUse: [
      'Guard single-winner transitions like seat holds and bid closes',
      'Always pair locks with TTLs and fencing or version checks',
      'Prefer queue serialization when ordering matters more than exclusion',
    ],
    pitfalls: ['Locking without expiry, freezing the resource on the first crash', 'Locking whole flows instead of the tiny critical section'],
    simDemo: {
      presetId: 'ticketmaster',
      scenario: 'spike',
      watch: 'Holds serialize while the waiting room meters arrivals',
    },
    glossaryIds: ['ttl-lock', 'lock-contention', 'queue', 'dirty-write'],
    checkYourself: ['What is the smallest thing worth locking?', 'What happens if the holder dies mid-hold?'],
  },
  {
    id: 'distributed-cache',
    title: 'Distributed Caches',
    track: 'tech',
    summary:
      'Memory pooled across nodes with hashed keys, TTLs, and eviction. Hit rate is the whole game: size for the head of the distribution and let the tail fall through.',
    whenToUse: [
      'Shard cache nodes when one box cannot hold the working set',
      'Stagger expiries and guard regeneration against stampedes',
      'Keep a degraded path for total cache loss',
    ],
    pitfalls: ['Caching the long tail and wondering why memory never suffices', 'Expiring everything at once and stampeding the store'],
    simDemo: {
      presetId: 'cache-aside',
      scenario: 'steady',
      watch: 'Hit rate decides database load almost one to one',
    },
    glossaryIds: ['cache', 'hit-rate', 'consistent-hashing', 'stale-read'],
    checkYourself: ['What fraction of reads does the head cover?', 'What regenerates a hot key, and how often?'],
  },
  {
    id: 'cdn-edge',
    title: 'CDNs and Edge Compute',
    track: 'tech',
    summary:
      'Static bytes and even some logic served from points of presence near users. The origin stops being the hot path; invalidation and TTLs become the design.',
    whenToUse: [
      'Serve images, video segments, and bundles from the edge',
      'Push simple transforms and auth checks to edge functions',
      'Version assets so caches never serve yesterday as today',
    ],
    pitfalls: ['Caching personalized responses at the edge by accident', 'Treating purge as instant everywhere'],
    simDemo: {
      presetId: 'cdn-origin',
      scenario: 'steady',
      watch: 'Origin traffic collapses as edge share climbs',
    },
    glossaryIds: ['cdn', 'edgecompute', 'edge-share', 'origin-fetch'],
    checkYourself: ['What is cacheable, and for how long?', 'What does a purge actually guarantee?'],
  },
  {
    id: 'workers-async',
    title: 'Workers and Async Execution',
    track: 'tech',
    summary:
      'Do slow work off the request: acknowledge fast, execute in pools, report status. Independent scaling of acceptors and workers is the payoff; status tracking is the price.',
    whenToUse: [
      'Move anything seconds-long off the synchronous path',
      'Scale worker pools separately from front doors',
      'Track job state so clients can poll or subscribe cleanly',
    ],
    pitfalls: ['Async for millisecond work, adding queues where a call would do', 'Losing jobs with no record and no retry'],
    simDemo: {
      presetId: 'async-workers',
      scenario: 'spike',
      watch: 'Front door stays fast while workers chew the backlog',
    },
    glossaryIds: ['worker', 'queue', 'queue-time', 'timeout'],
    checkYourself: ['What does the client get back immediately?', 'How does the client learn the job finished?'],
  },
  {
    id: 'coordination',
    title: 'Coordination Services',
    track: 'tech',
    summary:
      'Small, strongly consistent stores for leadership, membership, and config: who leads, who is alive, what the current settings are. Control plane truth that data planes read.',
    whenToUse: [
      'Elect one scheduler, one primary, one trigger owner',
      'Watch membership instead of hardcoding addresses',
      'Version config so rollouts and rollbacks are explicit',
    ],
    pitfalls: ['Routing data through the coordinator', 'Treating watches as instant and total'],
    simDemo: {
      presetId: 'multi-region',
      scenario: 'steady',
      watch: 'Failover has a cost measured in failed requests, not just time',
    },
    glossaryIds: ['region', 'region-down', 'heartbeat', 'timeout'],
    checkYourself: ['Who decides the leader?', 'What does everyone do while the leader is unknown?'],
  },
  /* ---- patterns ----------------------------------------------------- */
  {
    id: 'realtime-updates',
    title: 'Pushing Real-Time Updates',
    track: 'pattern',
    summary:
      'Getting events to users as they happen: poll first, push when freshness demands it, hold connections where interaction is truly bidirectional. Presence and heartbeats ride the same rails.',
    whenToUse: [
      'Start with polling until freshness numbers force better',
      'Use server push for live scores, notifications, and dashboards',
      'Hold bidirectional channels for chat, collab, and play',
    ],
    pitfalls: ['Sockets for every user when minutes-old data would do', 'Broadcasting presence to everyone instead of open conversations'],
    simDemo: {
      presetId: 'discord',
      scenario: 'steady',
      watch: 'Fan-out multiplies one send into many deliveries',
    },
    glossaryIds: ['websocket', 'fan-out', 'heartbeat', 'connection-slot'],
    checkYourself: ['How fresh must each update type be?', 'What caps your concurrent connections?'],
  },
  {
    id: 'contention-control',
    title: 'Dealing with Contention',
    track: 'pattern',
    summary:
      'Many writers, one prize: seats, bids, inventory, ledger rows. Serialize decisions with holds, locks, or queues, and make retries safe so pressure never corrupts the outcome.',
    whenToUse: [
      'Hold-then-confirm for anything bookable',
      'Serialize single-winner decisions through one path',
      'Key every retry so duplicates collapse safely',
    ],
    pitfalls: ['Long database locks under flash load', 'First-come serving with no queue and no fairness'],
    simDemo: {
      presetId: 'auction',
      scenario: 'spike',
      watch: 'One winner emerges while losers fail fast, not slow',
    },
    glossaryIds: ['lock-contention', 'ttl-lock', 'idempotency-key', 'queue'],
    checkYourself: ['What is the single-winner moment?', 'What does a retry do twice, safely?'],
  },
  {
    id: 'multistep-sagas',
    title: 'Multi-Step Processes',
    track: 'pattern',
    summary:
      'Workflows that span services and time: reserve, charge, confirm, notify. Orchestrate or choreograph, compensate on failure, and outlast slow steps with durable execution instead of hope.',
    whenToUse: [
      'Saga with compensation when rollback must mean business sense, not just undo',
      'Durable timers for anything that waits on humans or partners',
      'Dead-letter the steps that poison themselves',
    ],
    pitfalls: ['Distributed transactions across shards as a first resort', 'Timeouts with no owner and retries with no budget'],
    simDemo: {
      presetId: 'stripe',
      scenario: 'steady',
      watch: 'Webhooks redeliver while the ledger never double-applies',
    },
    glossaryIds: ['saga', 'durable-execution', 'dead-letter', 'redelivery'],
    checkYourself: ['What compensates each step?', 'Who owns a step stuck for an hour?'],
  },
  {
    id: 'scaling-reads',
    title: 'Scaling Reads',
    track: 'pattern',
    summary:
      'Serve the many without bothering the few: cache the head, replicate for breadth, precompute what is expensive to assemble, and push static bytes to the edge.',
    whenToUse: [
      'Cache-aside plus replicas before anything exotic',
      'Precompute timelines, boards, and rankings on write',
      'Offload search and static assets to their own tiers',
    ],
    pitfalls: ['Precomputing for users who never return', 'Replicas for a workload that is actually write-bound'],
    simDemo: {
      presetId: 'twitter',
      scenario: 'steady',
      watch: 'Reads stay one cache hit while writes do the work',
    },
    glossaryIds: ['cache', 'hit-rate', 'read-replica', 'cdn'],
    checkYourself: ['What is your read-to-write ratio?', 'Which read is precomputed, and for whom?'],
  },
  {
    id: 'scaling-writes',
    title: 'Scaling Writes',
    track: 'pattern',
    summary:
      'Absorb the flood: shard by key, batch and buffer, queue what can wait, and split regions by geography. Writes serialize somewhere, so choose where on purpose.',
    whenToUse: [
      'Shard when one writer cannot keep up, with keys from query patterns',
      'Buffer bursts in queues and streams instead of refusing them',
      'Batch small writes when per-write cost dominates',
    ],
    pitfalls: ['Adding replicas to fix write pressure', 'Unbounded buffers that hide overload until they burst'],
    simDemo: {
      presetId: 'uber',
      scenario: 'diurnal',
      watch: 'Location writes dwarf rider reads all day long',
    },
    glossaryIds: ['shard', 'queue', 'partitions', 'consumer-lag'],
    checkYourself: ['Where do your writes serialize?', 'What absorbs a 10x burst for five minutes?'],
  },
  {
    id: 'large-blobs',
    title: 'Handling Large Blobs',
    track: 'pattern',
    summary:
      'Move big bytes on a separate road: direct-to-storage uploads, chunked resume, async processing pipelines, and segmented delivery through the CDN. Metadata stays small and queryable.',
    whenToUse: [
      'Upload straight to storage; keep the database to pointers',
      'Transcode and thumbnail asynchronously after accept',
      'Deliver in segments with adaptive quality',
    ],
    pitfalls: ['Storing raw originals only, then re-encoding on every view', 'Blocking the request on minutes of processing'],
    simDemo: {
      presetId: 'netflix',
      scenario: 'ramp',
      watch: 'Edge serves the bytes while the encode farm lags behind',
    },
    glossaryIds: ['objectstore', 'presigned-url', 'cdn', 'rendition'],
    checkYourself: ['Which bytes touch your app servers?', 'What plays while processing still runs?'],
  },
  {
    id: 'long-running-tasks',
    title: 'Managing Long-Running Tasks',
    track: 'pattern',
    summary:
      'Validate fast, work slow: accept the job, hand back an id, execute in pools, and let clients poll or subscribe. Retries, timeouts, and dead letters are part of the design, not afterthoughts.',
    whenToUse: [
      'Queue anything that takes seconds while the request takes milliseconds',
      'Expose job status as a first-class read',
      'Size worker pools from job duration, not request rate',
    ],
    pitfalls: ['Synchronous waits on minute-long work', 'Fire-and-forget jobs with no status and no retry'],
    simDemo: {
      presetId: 'async-workers',
      scenario: 'spike',
      watch: 'Accept latency stays flat while drain time stretches',
    },
    glossaryIds: ['worker', 'queue', 'queue-time', 'dead-letter'],
    checkYourself: ['How does the client track its job?', 'What retries a failed job, and how many times?'],
  },
  /* ---- advanced ----------------------------------------------------- */
  {
    id: 'proximity-search',
    title: 'Proximity Search',
    track: 'advanced',
    summary:
      'Answer who is near: partition the map into cells, index occupants by cell, and search outward. In-memory geo stores trade freshness against query cost at high update rates.',
    whenToUse: [
      'Cell the world and query rings outward from the asker',
      'Batch or sample high-frequency positions before indexing',
      'Shard by geography when one region cannot hold the map',
    ],
    pitfalls: ['Point queries against a relational table per update', 'Indexing every GPS ping at full fidelity'],
    simDemo: {
      presetId: 'uber',
      scenario: 'diurnal',
      watch: 'Matching reads from a store fed by a far larger write stream',
    },
    glossaryIds: ['geoshard', 'range-query', 'shard', 'stale-read'],
    checkYourself: ['How stale may a driver position be?', 'What cell size balances precision and fan-out?'],
  },
  {
    id: 'timeseries-stores',
    title: 'Time-Series Stores',
    track: 'advanced',
    summary:
      'Metrics as timestamped series with retention and rollups: keep raw points briefly, downsample for history, and evaluate alerts over windows instead of instants.',
    whenToUse: [
      'Store host and product metrics as series, not rows',
      'Downsample aggressively; nobody zooms into last quarter at one-second grain',
      'Alert on windowed conditions with hysteresis, not single spikes',
    ],
    pitfalls: ['Infinite raw retention that bankrupts storage', 'Alerting on instantaneous values that flap all night'],
    simDemo: {
      presetId: 'specialised-stores',
      scenario: 'steady',
      watch: 'Metric writes flow while dashboards read rolled-up history',
    },
    glossaryIds: ['timeseriesdb', 'timeseries-rollup', 'retention', 'database'],
    checkYourself: ['What grain do you keep for a year?', 'What condition pages a human?'],
  },
  {
    id: 'sketch-structures',
    title: 'Data Structures for Big Data',
    track: 'advanced',
    summary:
      'Approximate answers in tiny memory: membership, cardinality, and frequency sketches that trade exactness for scale. Perfect when close enough drives the decision.',
    whenToUse: [
      'Deduplicate or pre-filter with membership sketches before expensive stores',
      'Count uniques approximately when exact counts cost a fortune',
      'Track heavy hitters for throttles and trending without full tallies',
    ],
    pitfalls: ['Exact counting at billions of events for a dashboard', 'Ignoring false-positive rates in admission paths'],
    simDemo: {
      presetId: 'tinyurl',
      scenario: 'steady',
      watch: 'Edge filters absorb the flood before the store sees it',
    },
    glossaryIds: ['sketch-counter', 'cache', 'hit-rate', 'throughput'],
    checkYourself: ['Where would approximate be fine?', 'What error rate can that decision tolerate?'],
  },
  {
    id: 'vector-search',
    title: 'Vector Databases',
    track: 'advanced',
    summary:
      'Similarity search over embeddings: index high-dimensional vectors for nearest neighbors, then fetch the real items. Powers recommendations, semantic search, and retrieval for assistants.',
    whenToUse: [
      'Index embeddings when similarity matters more than keywords',
      'Separate the approximate index from the source of truth',
      'Batch re-embeds; serve reads from versioned snapshots',
    ],
    pitfalls: ['Keyword search for meaning questions', 'Rebuilding the live index on every single write'],
    simDemo: {
      presetId: 'specialised-stores',
      scenario: 'steady',
      watch: 'Recommendation reads ride an index rebuilt in batches',
    },
    glossaryIds: ['vectordb', 'vector-ann', 'stale-search', 'throughput'],
    checkYourself: ['What does similar mean here?', 'How fresh must the index be?'],
  },
  {
    id: 'change-capture',
    title: 'Change Data Capture',
    track: 'advanced',
    summary:
      'Follow the database log to keep followers current: search indexes, caches, and warehouses tail the commit stream instead of polling. Lag becomes explicit and measurable.',
    whenToUse: [
      'Sync search and cache tiers from the log, not from app code paths',
      'Replay the log to rebuild any follower from scratch',
      'Monitor lag as a first-class health signal',
    ],
    pitfalls: ['Dual-writing from app code and drifting out of sync', 'Treating async followers as instantly consistent'],
    simDemo: {
      presetId: 'specialised-stores',
      scenario: 'steady',
      watch: 'Followers trail the primary by a visible, bounded lag',
    },
    glossaryIds: ['cdc', 'replication-lag', 'stale-search', 'consumer-lag'],
    checkYourself: ['Which followers tail your log?', 'What breaks if lag grows tenfold?'],
  },
];

export const CONCEPTS_BY_ID: ReadonlyMap<string, ConceptLesson> = new Map(
  CONCEPTS.map((c) => [c.id, c]),
);
