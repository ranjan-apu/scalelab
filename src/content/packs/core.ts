import type { InterviewPack } from '../interviewPacks';

/** Foundational packs: single-clear-story problems that teach one mechanism well. */
export const CORE_PACKS: readonly InterviewPack[] = [
  {
    id: 'ci-runner',
    title: 'Build Pipeline Runner',
    tagline: 'Queue pushes, run builds, report green',
    difficulty: 'Hard',
    minutes: 40,
    prompt:
      'Design CI for a monorepo with 10k engineers. Pushes queue builds across a worker fleet, flaky tests retry with budgets, and developers see live logs without polling.',
    checkpoints: [
      {
        question: 'What invalidates the build cache?',
        decides: 'Cache keys decide whether main-branch pushes rebuild the world.',
      },
      {
        question: 'How do flaky tests behave?',
        decides: 'Retry budgets versus instant failure changes fleet sizing.',
      },
      {
        question: 'Live logs: push or poll?',
        decides: 'Streaming logs need sticky tail connections per build.',
      },
    ],
    functional: [
      'Pushes can queue builds with declared dependencies',
      'Workers execute builds in isolated environments',
      'Developers can stream logs and read verdicts',
    ],
    nonfunctional: [
      'Queue accepts bursts without losing a push',
      'Verdicts for cached builds return in seconds',
      'Flaky retries bounded so one repo cannot hog the fleet',
      'Logs stream within seconds of emission',
    ],
    estimations: [
      'Bursts: monorepo pushes near hundreds a minute at peak hours',
      'Builds: minutes of compute each, highly cacheable on main',
      'Logs: megabytes per build streamed to few watchers each',
    ],
    entities: [
      { name: 'Build', fields: 'id, commit, dependency graph hash, state' },
      { name: 'Attempt', fields: 'build id, worker, started at, log pointer, verdict' },
      { name: 'BuildCache', fields: 'graph hash, artifact pointers, hit count' },
    ],
    api: {
      protocol: 'REST plus log streams',
      protocolWhy:
        'Builds and verdicts are REST resources. Live logs stream so developers watch without polling.',
      endpoints: [
        { method: 'POST', path: '/builds', purpose: 'Queue a build for a push' },
        { method: 'GET', path: '/builds/{id}', purpose: 'Verdict and artifact pointers' },
        { method: 'GET', path: '/builds/{id}/logs', purpose: 'Stream live build logs' },
      ],
    },
    hldPresetId: 'async-workers',
    hldSteps: [
      'Queue pushes behind dependency-aware scheduling with cache lookups first.',
      'Execute cache misses on isolated worker pools with retry budgets.',
      'Stream logs from workers while verdicts land in the store.',
      'Quarantine flaky targets so retries never starve genuine builds.',
    ],
    deepDives: [
      {
        title: 'Caching that survives the monorepo',
        problem: 'Rebuilding unchanged targets on every push wastes the fleet.',
        approach: [
          'Key cache entries by the full dependency graph hash.',
          'Share hits across branches when graphs match exactly.',
          'Invalidate precisely on toolchain changes, never broadly.',
        ],
        tradeoff: 'Hashing and storage overhead in exchange for seconds-fast rebuilds.',
      },
      {
        title: 'Flaky tests with bounded retries',
        problem: 'Unbounded retries let one flaky suite consume the fleet.',
        approach: [
          'Budget retries per target and quarantine chronic flakes.',
          'Report flake rates to owners instead of silently absorbing them.',
          'Prioritize first attempts over retries when capacity binds.',
        ],
        tradeoff: 'Some red builds in exchange for a fleet that always drains.',
      },
      {
        title: 'Logs for thousands of watchers',
        problem: 'Tailing the same build from hundreds of browsers multiplies reads.',
        approach: [
          'Fan log streams out from the owning worker through push tiers.',
          'Page finished logs from storage, never from workers.',
          'Buffer bursts so slow readers never stall the build.',
        ],
        tradeoff: 'Fan-out tiers in exchange for logs that never slow builds.',
      },
    ],
    concepts: ['workers-async', 'long-running-tasks', 'message-queue'],
    patterns: ['long-running-tasks'],
  },
  {
    id: 'file-sync',
    title: 'File Sync and Share',
    tagline: 'Sync file changes across devices with sharing links',
    difficulty: 'Core',
    minutes: 35,
    prompt:
      'Design a file sync service for 50M users. Clients sync folders across devices, share files by link, and resume interrupted uploads. Files can be gigabytes.',
    checkpoints: [
      {
        question: 'Do we sync whole files or changed blocks?',
        decides: 'Block deltas shrink uploads but need chunking and reassembly.',
      },
      {
        question: 'How do conflicting edits from two devices resolve?',
        decides: 'Version vectors, last-writer rules, or explicit conflict files.',
      },
      {
        question: 'Do shared links need expiry or passwords?',
        decides: 'Expiry adds lifecycle sweeps; open links are just capability URLs.',
      },
    ],
    functional: [
      'Clients can upload, download, and sync files across devices',
      'Clients can share files through links',
      'Clients can resume interrupted uploads',
    ],
    nonfunctional: [
      'Uploads survive flaky connections without restarting',
      'Metadata operations under 100ms at p99',
      'Durable: an acknowledged byte is never lost',
      'Scales to 50M users with mostly idle clients',
    ],
    estimations: [
      'Metadata: 50M users x 10k files, tiny rows, index-heavy',
      'Bytes: average file 2MB with dedup saving roughly a third',
      'Bandwidth dominated by downloads through edge caches',
    ],
    entities: [
      { name: 'FileMeta', fields: 'id, owner, path, version vector, block list' },
      { name: 'Block', fields: 'hash (primary key), size, storage pointer' },
      { name: 'ShareLink', fields: 'token, file id, expiry, password flag' },
    ],
    api: {
      protocol: 'REST plus direct storage upload',
      protocolWhy:
        'Metadata rides REST for clarity. Bytes skip app servers entirely through signed storage URLs, or large syncs would melt the API tier.',
      endpoints: [
        { method: 'POST', path: '/files/upload-urls', purpose: 'Mint chunk upload URLs' },
        { method: 'POST', path: '/files/commit', purpose: 'Commit a version from uploaded blocks' },
        { method: 'GET', path: '/files/{id}', purpose: 'Metadata plus download URL' },
        { method: 'POST', path: '/shares', purpose: 'Create a share link' },
      ],
    },
    hldPresetId: 'full-stack',
    hldSteps: [
      'Client to service to metadata store: the simplest cut that tracks versions.',
      'Move bytes direct to object storage with signed URLs; the database keeps pointers.',
      'Chunk large files and resume by missing blocks, never from zero.',
      'Serve downloads through edge caches keyed by content hash.',
    ],
    deepDives: [
      {
        title: 'Dedup without leaking privacy',
        problem: 'Identical blocks across users should store once, but probes must not reveal who stores what.',
        approach: [
          'Address blocks by content hash so identical bytes converge naturally.',
          'Require authentication before confirming existence to block enumeration.',
          'Encrypt convergent paths per user where the threat model demands it.',
        ],
        tradeoff: 'Cross-user savings against stricter access checks on every confirm.',
      },
      {
        title: 'Resumable uploads at gigabyte scale',
        problem: 'A dropped connection must not restart a 5GB upload.',
        approach: [
          'Split into fixed blocks and commit a manifest of finished hashes.',
          'Resume by asking which hashes are missing, then upload only those.',
          'Expire orphaned blocks with a sweeper so abandoned uploads decay.',
        ],
        tradeoff: 'Manifest bookkeeping per upload in exchange for never redoing finished work.',
      },
      {
        title: 'Sync conflicts across devices',
        problem: 'Two offline edits to one file cannot both win silently.',
        approach: [
          'Version vectors detect concurrent edits at commit time.',
          'Keep both versions and surface a conflict file instead of picking silently.',
          'Fast-forward cleanly when one version strictly dominates.',
        ],
        tradeoff: 'Occasional user-visible conflicts in exchange for never losing an edit.',
      },
    ],
    concepts: ['large-blobs', 'data-modeling', 'cdn-edge'],
    patterns: ['large-blobs'],
  },
  {
    id: 'local-reviews',
    title: 'Local Reviews and Search',
    tagline: 'Find nearby places with trustworthy review rankings',
    difficulty: 'Core',
    minutes: 35,
    prompt:
      'Design a local discovery service for 100M users. People search nearby restaurants and shops, read ranked reviews, and upload photos. Queries mix text with location.',
    checkpoints: [
      {
        question: 'Do results rank by distance, rating, or both?',
        decides: 'Ranking inputs decide which indexes and scoring services you need.',
      },
      {
        question: 'How fresh must a new review be in search?',
        decides: 'Seconds-fresh needs CDC streaming; minutes-fresh allows batch sync.',
      },
      {
        question: 'Do photos ride the same path as reviews?',
        decides: 'Media needs blob plus edge delivery, never database rows.',
      },
    ],
    functional: [
      'Users can search places by text and location',
      'Users can read ranked reviews for a place',
      'Users can write reviews and upload photos',
    ],
    nonfunctional: [
      'Search under 200ms at p99',
      'Review writes never lost; ranking may lag by a minute',
      'Photos load instantly from nearby edges',
      'Scales to 100M users with dinner-time peaks',
    ],
    estimations: [
      'Reads: dinner peaks near 50k search rps across metro shards',
      'Writes: reviews near 500 rps, photos an order of magnitude more bytes',
      'Index: tens of millions of places, sharded by metro cell',
    ],
    entities: [
      { name: 'Place', fields: 'id, geo cell, categories, aggregate rating' },
      { name: 'Review', fields: 'id, place id, author, rating, text reference' },
      { name: 'Photo', fields: 'id, place id, storage pointer, moderation flag' },
    ],
    api: {
      protocol: 'REST',
      protocolWhy:
        'Search, places, and reviews are stable resources. Geo arrives as query parameters the index understands natively.',
      endpoints: [
        { method: 'GET', path: '/search?q=&lat=&lon=', purpose: 'Ranked nearby places' },
        { method: 'GET', path: '/places/{id}', purpose: 'Place page with top reviews' },
        { method: 'POST', path: '/places/{id}/reviews', purpose: 'Write a review' },
        { method: 'POST', path: '/places/{id}/photos', purpose: 'Mint a photo upload URL' },
      ],
    },
    hldPresetId: 'specialised-stores',
    hldSteps: [
      'Client to service to primary store: places and reviews with basic queries.',
      'Offload search to a geo-aware index synced from the primary store.',
      'Shard places by metro cell so nearby queries stay local.',
      'Serve photos from blob storage through edge caches.',
    ],
    deepDives: [
      {
        title: 'Geo plus text ranking',
        problem: 'Nearby and relevant pull in opposite directions at dinner time.',
        approach: [
          'Filter by geo cell first to bound the candidate set.',
          'Score text relevance inside the cell, then blend distance and rating.',
          'Precompute popular metro result sets and refresh on a timer.',
        ],
        tradeoff: 'Precomputed staleness for the head queries in exchange for p99 headroom.',
      },
      {
        title: 'Review spam and trust',
        problem: 'Fake reviews destroy ranking quality faster than any scaling issue.',
        approach: [
          'Score reviewers by history and throttle new accounts.',
          'Quarantine suspicious reviews for async moderation instead of blocking writes.',
          'Down-weight outliers rather than deleting on suspicion.',
        ],
        tradeoff: 'Some spam visible briefly in exchange for never blocking genuine reviewers.',
      },
      {
        title: 'Freshness without coupling',
        problem: 'A new review should appear soon, but search sync must not slow writes.',
        approach: [
          'Stream commits to the index asynchronously with a stated lag bound.',
          'Serve the place page from the primary store so the author sees it instantly.',
          'Backfill the index from the log after any outage, never from app retries.',
        ],
        tradeoff: 'Seconds of search staleness in exchange for write paths that never block.',
      },
    ],
    concepts: ['search-index', 'proximity-search', 'data-modeling'],
    patterns: ['scaling-reads'],
  },
  {
    id: 'cache-service',
    title: 'Distributed Cache Service',
    tagline: 'Design the shared memory every service depends on',
    difficulty: 'Core',
    minutes: 35,
    prompt:
      'Design a multi-tenant distributed cache for 10k application servers. Tenants store TTL key-values, expect single-digit millisecond hits, and scale their working sets independently.',
    checkpoints: [
      {
        question: 'Do tenants share nodes or get isolated fleets?',
        decides: 'Isolation costs machines; sharing needs quotas and noisy-neighbor defense.',
      },
      {
        question: 'What happens on a full node loss?',
        decides: 'Replication and fast rehashing decide whether misses spike or cascade.',
      },
      {
        question: 'Who evicts, and by what policy?',
        decides: 'LRU per node is simple; tenant-aware policies protect small hot tenants.',
      },
    ],
    functional: [
      'Tenants can get, set, and delete keys with TTLs',
      'Tenants can grow their working set without downtime',
      'Operators can drain a node for maintenance safely',
    ],
    nonfunctional: [
      'Hits under 2ms at p99 inside a region',
      'Survives single-node loss with bounded miss spikes',
      'Noisy tenants cannot starve quiet ones',
      'Linear growth: add nodes, gain capacity',
    ],
    estimations: [
      'Throughput: 10k app servers x 500 rps with 90 percent cached, about 4.5M hits a second',
      'Memory: working sets in terabytes, sharded across hundreds of nodes',
      'Churn: TTL-driven, so steady-state miss rate is the sizing input',
    ],
    entities: [
      { name: 'TenantQuota', fields: 'tenant id, memory cap, request cap' },
      { name: 'KeyRange', fields: 'hash range, owning node, replica nodes' },
      { name: 'NodeMembership', fields: 'node id, ranges held, drain flag' },
    ],
    api: {
      protocol: 'Memcached-style binary protocol',
      protocolWhy:
        'Cache clients speak a tiny binary protocol, not REST. Every microsecond matters and payloads are opaque bytes with TTLs.',
      endpoints: [
        { method: 'GET', path: 'get {key}', purpose: 'Fetch bytes or miss' },
        { method: 'SET', path: 'set {key} {ttl}', purpose: 'Store bytes with expiry' },
        { method: 'DEL', path: 'delete {key}', purpose: 'Invalidate on write-through' },
      ],
    },
    hldPresetId: 'cache-aside',
    hldSteps: [
      'One cache node in front of one store: measure hit rate first.',
      'Hash keys across nodes so growth means more nodes, not bigger ones.',
      'Replicate each range so one loss is a miss spike, not an outage.',
      'Add quotas and drain support so tenants and operators stop colliding.',
    ],
    deepDives: [
      {
        title: 'Rebalancing without stampedes',
        problem: 'Adding a node must not relocate nearly every key at once.',
        approach: [
          'Hash keys onto a ring so only neighboring ranges move.',
          'Migrate in the background while both owners serve.',
          'Throttle migration bandwidth so serving latency never notices.',
        ],
        tradeoff: 'Slower rebalances in exchange for invisible ones.',
      },
      {
        title: 'Hot keys on shared nodes',
        problem: 'One viral key pins its node while siblings idle.',
        approach: [
          'Replicate hot keys read-only across several nodes.',
          'Split the value or shard by suffix for write-hot keys.',
          'Detect heat from request sampling, not from operator tickets.',
        ],
        tradeoff: 'Extra copies and detection lag in exchange for surviving virality.',
      },
      {
        title: 'Thundering herds on expiry',
        problem: 'A popular TTL expiring lets thousands of misses through at once.',
        approach: [
          'Let one request regenerate while the rest wait on the in-flight result.',
          'Refresh hot keys before expiry instead of after.',
          'Stagger TTLs with jitter so crowds never expire together.',
        ],
        tradeoff: 'Slight complexity per read in exchange for a database that survives success.',
      },
    ],
    concepts: ['distributed-cache', 'consistent-hashing', 'caching'],
    patterns: ['scaling-reads'],
  },
  {
    id: 'edge-rate-limiter',
    title: 'Edge Rate Limiter',
    tagline: 'Refuse abusive traffic before it costs you anything',
    difficulty: 'Core',
    minutes: 30,
    prompt:
      'Design a distributed rate limiter for a public API at 1M rps. Enforce per-key budgets with burst allowances, refuse excess fast, and stay correct across dozens of gateway machines.',
    checkpoints: [
      {
        question: 'Token bucket or fixed window?',
        decides: 'Buckets allow bursts gracefully; windows are simpler but cliff-edged.',
      },
      {
        question: 'Local decisions or shared counters?',
        decides: 'Local is fast but approximate; shared is exact but adds a hop.',
      },
      {
        question: 'What does a refused caller get?',
        decides: 'Status codes plus retry-after headers decide whether clients back off or hammer.',
      },
    ],
    functional: [
      'Gateways can check and consume quota per key in microseconds',
      'Operators can set per-key rates and burst sizes',
      'Refused callers learn when to retry',
    ],
    nonfunctional: [
      'Decisions under 1ms at p99 on the request path',
      'No single point of failure across gateway machines',
      'Over-admission bounded and explainable',
      'Scales linearly with gateway count',
    ],
    estimations: [
      'Checks: 1M rps of counter reads, almost all local',
      'Sync: periodic counter reconciliation, not per-request coordination',
      'State: counters in megabytes, not a database problem',
    ],
    entities: [
      { name: 'Budget', fields: 'key, rate, burst, window' },
      { name: 'CounterShard', fields: 'key slice, tokens, last refill' },
    ],
    api: {
      protocol: 'Library plus headers',
      protocolWhy:
        'Limiters live as gateway middleware, not a service call. The contract is response headers: remaining quota and retry timing.',
      endpoints: [
        { method: 'GET', path: 'any endpoint + X-RateLimit-Remaining', purpose: 'Quota feedback per response' },
        { method: 'GET', path: '429 + Retry-After', purpose: 'Refusal with backoff guidance' },
      ],
    },
    hldPresetId: 'rate-limited-api',
    hldSteps: [
      'Gateway with local token buckets: refuse locally, serve fast.',
      'Reconcile counters across gateways on a short interval for global budgets.',
      'Return retry-after so well-behaved clients back off instead of retrying blind.',
      'Separate budgets per endpoint sensitivity and customer tier.',
    ],
    deepDives: [
      {
        title: 'Exactness against speed',
        problem: 'Per-request coordination is exact and far too slow at 1M rps.',
        approach: [
          'Decide locally from lazily synced counters.',
          'Bound over-admission by shard count times bucket size.',
          'Tighten sync intervals only for the highest-value keys.',
        ],
        tradeoff: 'Bounded over-admission in exchange for microsecond decisions.',
      },
      {
        title: 'Bursts versus sustained abuse',
        problem: 'Legitimate clients burst; attackers sustain. One rule punishes both.',
        approach: [
          'Allow bounded bursts from the bucket while capping sustained rate.',
          'Track both window sizes and refuse on either.',
          'Escalate repeat offenders to longer backoffs, not harder errors.',
        ],
        tradeoff: 'Two dials to tune instead of one, in exchange for happy launches and dead bots.',
      },
      {
        title: 'Refusal UX that converges',
        problem: 'A bare error turns clients into retry storms.',
        approach: [
          'Always answer refusals with retry-after timing.',
          'Add jitter guidance so crowds do not return in lockstep.',
          'Count refusals per client for operators to see who is suffering.',
        ],
        tradeoff: 'Header and bookkeeping overhead in exchange for self-healing traffic.',
      },
    ],
    concepts: ['api-gateway', 'api-design', 'capacity-numbers'],
    patterns: ['scaling-reads'],
  },
  {
    id: 'job-scheduler',
    title: 'Reliable Job Scheduler',
    tagline: 'Fire millions of triggers exactly once',
    difficulty: 'Core',
    minutes: 35,
    prompt:
      'Design a scheduler for 100M daily triggers: cron jobs, delayed retries, and one-off futures. Each trigger must execute once, on time, even as scheduler machines fail over.',
    checkpoints: [
      {
        question: 'Who owns a trigger at any instant?',
        decides: 'Single ownership prevents double execution during failover.',
      },
      {
        question: 'How late may a trigger fire?',
        decides: 'Second-precision needs very different machinery than minute-precision.',
      },
      {
        question: 'What happens to missed triggers after an outage?',
        decides: 'Catch-up storms need their own policy, or recovery becomes a second outage.',
      },
    ],
    functional: [
      'Clients can create cron, delayed, and one-off triggers',
      'Triggers execute their payloads on schedule',
      'Clients can list, pause, and cancel their triggers',
    ],
    nonfunctional: [
      'Exactly-once execution per trigger in practice',
      'Second-level precision for due triggers',
      'Survives scheduler failover without double-firing',
      'Missed-trigger catch-up is rate-limited, not a flood',
    ],
    estimations: [
      'Triggers: 100M a day, about 1.2k due per second average with sharp cron peaks',
      'State: trigger rows in gigabytes, execution logs short-lived',
      'Worst minute matters more than the average day',
    ],
    entities: [
      { name: 'Trigger', fields: 'id, owner, schedule, next fire time, payload reference' },
      { name: 'Execution', fields: 'trigger id, attempt, status, lease holder' },
      { name: 'Ownership', fields: 'shard, holder, lease expiry' },
    ],
    api: {
      protocol: 'REST',
      protocolWhy:
        'Triggers are CRUD resources with schedules as data. Execution itself is internal queue traffic, not client API.',
      endpoints: [
        { method: 'POST', path: '/triggers', purpose: 'Create a trigger' },
        { method: 'GET', path: '/triggers/{id}', purpose: 'Inspect schedule and next fire' },
        { method: 'DELETE', path: '/triggers/{id}', purpose: 'Cancel future fires' },
      ],
    },
    hldPresetId: 'async-workers',
    hldSteps: [
      'Service plus store plus workers: due triggers become queue jobs.',
      'Shard trigger ownership so one scheduler owns each trigger at a time.',
      'Lease ownership with heartbeats so failover transfers cleanly.',
      'Rate-limit catch-up after outages so recovery never stampedes.',
    ],
    deepDives: [
      {
        title: 'Exactly-once in practice',
        problem: 'Failover plus retries always threaten double execution.',
        approach: [
          'Lease each trigger to one owner with short expiries.',
          'Dedupe executions by trigger id and attempt at the worker.',
          'Confirm completion before releasing, never after.',
        ],
        tradeoff: 'Lease chatter and dedupe storage in exchange for single execution.',
      },
      {
        title: 'Cron peaks without collapse',
        problem: 'Every user schedules on the hour, and the hour arrives all at once.',
        approach: [
          'Spread due triggers over the minute with jittered release.',
          'Queue behind autoscaled workers instead of executing inline.',
          'Shed the least critical tiers first when the peak exceeds capacity.',
        ],
        tradeoff: 'Seconds of schedule skew in exchange for surviving the top of the hour.',
      },
      {
        title: 'Catch-up after silence',
        problem: 'An outage leaves millions of overdue triggers demanding to fire now.',
        approach: [
          'Replay overdue triggers at a capped rate with priorities.',
          'Collapse repeats into the latest intent where semantics allow.',
          'Expire what no longer matters instead of executing ancient work.',
        ],
        tradeoff: 'Some overdue work skipped or delayed in exchange for a recovery that converges.',
      },
    ],
    concepts: ['workers-async', 'coordination', 'message-queue'],
    patterns: ['long-running-tasks'],
  },
  {
    id: 'price-tracker',
    title: 'Price Watch and Alerts',
    tagline: 'Poll millions of products and ping on real drops',
    difficulty: 'Core',
    minutes: 30,
    prompt:
      'Design a price tracker for 20M watched products across thousands of stores. Poll on schedule, detect genuine drops through noise like coupons, and alert watchers within minutes.',
    checkpoints: [
      {
        question: 'How often per product, and does popularity change it?',
        decides: 'Hot products poll faster; the tail polls rarely or never.',
      },
      {
        question: 'What counts as a real price drop?',
        decides: 'Coupons, bundles, and currency noise need rules before alerts.',
      },
      {
        question: 'Push, email, or digest for alerts?',
        decides: 'Channel choice bounds fan-out cost and user tolerance for noise.',
      },
    ],
    functional: [
      'Users can watch products with target prices',
      'The system polls store pages on schedule',
      'Users get alerted on genuine drops below target',
    ],
    nonfunctional: [
      'Alert latency under 15 minutes for watched drops',
      'Polite crawling: respect robots and rate limits per store',
      'No alert storms from transient price flickers',
      'Scales to 20M products with tiered freshness',
    ],
    estimations: [
      'Polls: 20M products at daily cadence, about 230 rps, hot tier far faster',
      'Change rate: low single digits percent per sweep, alerts a fraction of that',
      'History: price points per product, rolled up aggressively with age',
    ],
    entities: [
      { name: 'Watch', fields: 'user id, product id, target price, channel' },
      { name: 'PricePoint', fields: 'product id, timestamp, price, conditions' },
      { name: 'PollSchedule', fields: 'product id, tier, next poll, store politeness state' },
    ],
    api: {
      protocol: 'REST',
      protocolWhy:
        'Watches are user CRUD. Polling and alerting are internal pipelines the user never calls.',
      endpoints: [
        { method: 'POST', path: '/watches', purpose: 'Watch a product at a target' },
        { method: 'GET', path: '/watches', purpose: 'List watches with latest prices' },
        { method: 'DELETE', path: '/watches/{id}', purpose: 'Stop watching' },
      ],
    },
    hldPresetId: 'async-workers',
    hldSteps: [
      'Service plus store plus poll workers: schedules become queue jobs.',
      'Tier products by watcher count so hot items poll fast and the tail sips.',
      'Detect drops with hysteresis so flickers never alert.',
      'Fan alerts out through the notification path with per-user digesting.',
    ],
    deepDives: [
      {
        title: 'Polite polling at scale',
        problem: 'Twenty million products can DDoS a small store by accident.',
        approach: [
          'Throttle per store domain with politeness budgets.',
          'Spread polls across the day instead of sweeping on the hour.',
          'Back off per store on errors before the store blocks you entirely.',
        ],
        tradeoff: 'Slower tail freshness in exchange for never getting banned.',
      },
      {
        title: 'Real drops versus noise',
        problem: 'Coupons and variants make naive thresholds alert constantly.',
        approach: [
          'Compare like-for-like variants with normalized conditions.',
          'Require the drop to persist across two polls before alerting.',
          'Learn per-product volatility and widen bands for jumpy items.',
        ],
        tradeoff: 'Minutes of detection delay in exchange for alerts users trust.',
      },
      {
        title: 'Alert fan-out without storms',
        problem: 'One popular drop can notify a million watchers at once.',
        approach: [
          'Batch alerts per user into digests with quiet hours.',
          'Prioritize target hits over informational moves.',
          'Dedupe across overlapping watches before sending anything.',
        ],
        tradeoff: 'Less instant gratification in exchange for a channel users keep open.',
      },
    ],
    concepts: ['workers-async', 'realtime-updates', 'timeseries-stores'],
    patterns: ['long-running-tasks'],
  },
  {
    id: 'food-review',
    title: 'Dish-Level Food Reviews',
    tagline: 'Review the dish, not just the restaurant',
    difficulty: 'Core',
    minutes: 30,
    prompt:
      'Design dish-level reviews for 30M food lovers. People photograph dishes, rate them, and browse the best pad thai within walking distance. Photos dominate traffic.',
    checkpoints: [
      {
        question: 'Dish pages, place pages, or both?',
        decides: 'Two page types double ranking and aggregation work.',
      },
      {
        question: 'Who moderates a million food photos?',
        decides: 'Async pipelines with sampling beat inline review for latency.',
      },
      {
        question: 'How local is local?',
        decides: 'Walking-distance queries need tight geo cells, not city shards.',
      },
    ],
    functional: [
      'Users can review and photograph specific dishes',
      'Users can browse top dishes near them',
      'Owners can respond to reviews of their dishes',
    ],
    nonfunctional: [
      'Browse under 200ms at p99',
      'Photo uploads never block the review submit',
      'Moderation lags minutes, never the write path',
      'Dinner peaks 10x the afternoon baseline',
    ],
    estimations: [
      'Reads: browse-heavy at 50 to 1 over writes',
      'Photos: hundreds of thousands a day, megabytes each before variants',
      'Geo: tight cells, so most queries stay single-partition',
    ],
    entities: [
      { name: 'Dish', fields: 'id, place id, name, aggregate score, photo count' },
      { name: 'DishReview', fields: 'id, dish id, author, score, text, photo pointers' },
      { name: 'OwnerResponse', fields: 'review id, place id, text, timestamp' },
    ],
    api: {
      protocol: 'REST',
      protocolWhy:
        'Dishes, reviews, and responses are nested resources with simple verbs. Photos upload direct to storage.',
      endpoints: [
        { method: 'GET', path: '/dishes/nearby?lat=&lon=&q=', purpose: 'Top dishes nearby' },
        { method: 'POST', path: '/dishes/{id}/reviews', purpose: 'Review a dish' },
        { method: 'POST', path: '/dishes/{id}/photos', purpose: 'Mint a dish photo upload' },
        { method: 'POST', path: '/reviews/{id}/response', purpose: 'Owner responds' },
      ],
    },
    hldPresetId: 'specialised-stores',
    hldSteps: [
      'Service plus store: dishes, reviews, and responses with geo queries.',
      'Move photos to blob storage with async moderation off the write path.',
      'Precompute nearby leaderboards per geo cell on a timer.',
      'Serve browse from cache and edge; writes flow to the store.',
    ],
    deepDives: [
      {
        title: 'Nearby leaderboards that stay fresh',
        problem: 'Every browse recomputing rankings from raw reviews is too slow.',
        approach: [
          'Aggregate dish scores incrementally on each accepted review.',
          'Refresh per-cell boards on a short timer, not per request.',
          'Serve boards from cache with place-page fallthrough to the store.',
        ],
        tradeoff: 'Minutes of board staleness in exchange for millisecond browsing.',
      },
      {
        title: 'Photo pipeline without blocking',
        problem: 'Moderation and variants take seconds; submits must take milliseconds.',
        approach: [
          'Accept the review the moment bytes land in storage.',
          'Generate variants and run moderation asynchronously.',
          'Hide, never delete, on flags so appeals restore instantly.',
        ],
        tradeoff: 'Briefly visible bad photos in exchange for instant submits.',
      },
      {
        title: 'Owner responses without wars',
        problem: 'Public arguments between owners and reviewers poison pages.',
        approach: [
          'One response per review, editable but never deletable by owners.',
          'Rate-limit responses and queue them for the same moderation pass.',
          'Rank pages by dish quality signals, not by argument heat.',
        ],
        tradeoff: 'Some owner frustration in exchange for pages readers trust.',
      },
    ],
    concepts: ['scaling-reads', 'large-blobs', 'proximity-search'],
    patterns: ['scaling-reads', 'large-blobs'],
  },
];
