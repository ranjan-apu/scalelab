import type { InterviewPack } from '../interviewPacks';

/** Media and infrastructure packs: pipelines, crawls, and streaming analytics. */
export const MEDIA_INFRA_PACKS: readonly InterviewPack[] = [
  {
    id: 'video-platform',
    title: 'Video Upload and Streaming',
    tagline: 'Transcode once, stream to millions adaptively',
    difficulty: 'Popular',
    minutes: 45,
    prompt:
      'Design a video platform for 2B monthly viewers. Creators upload huge files that must be resumable, processing produces adaptive renditions, and playback starts instantly on any network.',
    checkpoints: [
      {
        question: 'How do uploads survive failure halfway?',
        decides: 'Chunked resumable uploads change the entire ingest design.',
      },
      {
        question: 'Which renditions get generated: fixed set or per-title?',
        decides: 'Fixed sets are simple; per-title optimization saves fortunes in bytes.',
      },
      {
        question: 'Live, on-demand, or both?',
        decides: 'Live adds low-latency ingest and synchronized delivery to the story.',
      },
    ],
    functional: [
      'Creators can upload huge videos resumably',
      'Processing produces adaptive streaming renditions',
      'Viewers can play instantly with adaptive quality',
    ],
    nonfunctional: [
      'Uploads resume from partial progress, never from zero',
      'Playback starts under 2s at p99 on decent networks',
      'Processing completes within minutes for typical uploads',
      'Popular videos never touch origin during viewing peaks',
    ],
    estimations: [
      'Uploads: thousands of concurrent multi-gigabyte transfers',
      'Processing: minutes of compute per minute of video, parallelized per chunk',
      'Viewing: edge-served segments dominate all traffic by orders of magnitude',
    ],
    entities: [
      { name: 'Video', fields: 'id, owner, duration, rendition pointers, state' },
      { name: 'UploadSession', fields: 'id, video id, finished chunk hashes, expiry' },
      { name: 'Rendition', fields: 'video id, bitrate, segment pointers, codec' },
    ],
    api: {
      protocol: 'REST plus chunked upload and segmented playback',
      protocolWhy:
        'Uploads and metadata are REST with chunk protocols. Playback uses segmented adaptive streaming, not file downloads.',
      endpoints: [
        { method: 'POST', path: '/videos/upload-sessions', purpose: 'Start a resumable upload' },
        { method: 'POST', path: '/videos/{id}/chunks', purpose: 'Upload one chunk' },
        { method: 'GET', path: '/videos/{id}/manifest', purpose: 'Adaptive playback manifest' },
      ],
    },
    hldPresetId: 'netflix',
    hldSteps: [
      'Accept uploads in chunks with a session recording finished hashes.',
      'Transcode asynchronously into segmented multi-bitrate renditions.',
      'Serve segments from edge caches keyed by video plus rendition.',
      'Adapt quality per viewer from measured throughput, not guesses.',
    ],
    deepDives: [
      {
        title: 'Resumable uploads that converge',
        problem: 'A failed 20GB upload restarting from zero abandons creators.',
        approach: [
          'Address chunks by hash and record finished ones in the session.',
          'Resume by listing missing hashes, then upload only those.',
          'Expire abandoned sessions so orphaned chunks decay.',
        ],
        tradeoff: 'Session bookkeeping per upload in exchange for uploads that always finish.',
      },
      {
        title: 'Transcoding that keeps pace',
        problem: 'Serial transcoding queues uploads behind each other for hours.',
        approach: [
          'Split videos into chunks processed in parallel across workers.',
          'Prioritize preview renditions so videos go live before full sets finish.',
          'Retry failed chunks independently instead of whole videos.',
        ],
        tradeoff: 'Orchestration complexity in exchange for minutes-to-live uploads.',
      },
      {
        title: 'Adaptive playback without rebuffering',
        problem: 'Fixed bitrates stall on bad networks and waste good ones.',
        approach: [
          'Offer segmented renditions and let players step quality per segment.',
          'Start low and climb fast instead of starting high and stalling.',
          'Prefetch from edges so origin never sits in the playback path.',
        ],
        tradeoff: 'Storage for many renditions in exchange for playback that never spins.',
      },
    ],
    concepts: ['large-blobs', 'long-running-tasks', 'cdn-edge'],
    patterns: ['large-blobs', 'long-running-tasks'],
  },
  {
    id: 'web-crawler',
    title: 'Crawl and Index the Web',
    tagline: 'Fetch politely, dedupe globally, feed the index',
    difficulty: 'Hard',
    minutes: 45,
    prompt:
      'Design a web crawler indexing 10B pages with daily freshness for the important web. Fetch politely per domain, dedupe content globally, and feed new pages to the index continuously.',
    checkpoints: [
      {
        question: 'How fresh must the important web be?',
        decides: 'Daily freshness for head pages needs prioritized frontiers, not FIFO.',
      },
      {
        question: 'How do you avoid fetching the same content twice?',
        decides: 'URL plus content dedup decides fetch waste and index quality.',
      },
      {
        question: 'Who enforces politeness?',
        decides: 'Per-domain budgets must live somewhere central or nowhere works.',
      },
    ],
    functional: [
      'The system fetches pages on schedule with per-domain politeness',
      'Fetched content dedupes by URL and by content',
      'Fresh pages flow to the index within hours',
    ],
    nonfunctional: [
      'No domain hammered beyond its politeness budget, ever',
      'Head pages refreshed daily; tail on longer cycles',
      'Duplicate fetches bounded to a small fraction',
      'Crawler survives worker loss without refetch storms',
    ],
    estimations: [
      'Fetches: billions of pages a day at steady state, petabytes a month',
      'Frontier: hundreds of billions of known URLs with priorities',
      'Dedup: fingerprints for every fetched page, sharded by hash',
    ],
    entities: [
      { name: 'FrontierEntry', fields: 'url hash, priority, next fetch, domain budget pointer' },
      { name: 'PageSnapshot', fields: 'url hash, fetched at, content fingerprint, store pointer' },
      { name: 'DomainBudget', fields: 'domain, rate limit, last fetch, backoff state' },
    ],
    api: {
      protocol: 'Internal queues, not user APIs',
      protocolWhy:
        'Crawlers are pipelines: the contract is queue schemas between frontier, fetcher, and indexer, plus operator controls.',
      endpoints: [
        { method: 'POST', path: '/seeds', purpose: 'Add seed URLs to the frontier' },
        { method: 'GET', path: '/frontier/stats', purpose: 'Depth, freshness, and budget health' },
        { method: 'POST', path: '/domains/{domain}/budgets', purpose: 'Tune politeness budgets' },
      ],
    },
    hldPresetId: 'async-workers',
    hldSteps: [
      'Hold the frontier as prioritized queues sharded by domain.',
      'Fetch through worker pools gated by per-domain budgets.',
      'Fingerprint content and drop duplicates before indexing.',
      'Feed survivors to the index stream with freshness priorities.',
    ],
    deepDives: [
      {
        title: 'Frontiers that prioritize freshness',
        problem: 'FIFO frontiers refresh trivia as often as front pages.',
        approach: [
          'Score URLs by change rate, importance, and staleness.',
          'Shard the frontier so workers never contend on one queue.',
          'Requeue failures on a slow lane instead of blocking the head.',
        ],
        tradeoff: 'Scoring and sharding complexity in exchange for a fresh important web.',
      },
      {
        title: 'Politeness that holds under scale',
        problem: 'Thousands of fetchers can accidentally DDoS small sites.',
        approach: [
          'Gate every fetch on a per-domain token budget.',
          'Respect robots directives and crawl-delay signals centrally.',
          'Back off whole domains on errors before site owners notice.',
        ],
        tradeoff: 'Slower tail coverage in exchange for never being blocked.',
      },
      {
        title: 'Dedup across billions of pages',
        problem: 'Mirrors, parameters, and scrapers multiply the same content endlessly.',
        approach: [
          'Canonicalize URLs before the frontier, not after fetching.',
          'Fingerprint content with shingles and cluster near-dups.',
          'Index one representative and link the variants to it.',
        ],
        tradeoff: 'Fingerprint storage and compute in exchange for an index without echoes.',
      },
    ],
    concepts: ['workers-async', 'scaling-writes', 'search-index'],
    patterns: ['long-running-tasks', 'scaling-writes'],
  },
  {
    id: 'metrics-pipe',
    title: 'Service Telemetry Pipeline',
    tagline: 'Ingest every host, alert on what matters',
    difficulty: 'Hard',
    minutes: 40,
    prompt:
      'Design telemetry for 500k hosts emitting metrics every 10 seconds. Ingest everything, keep a year of history affordable, and page humans only for real problems.',
    checkpoints: [
      {
        question: 'How long do raw points live?',
        decides: 'Raw retention bounds storage; rollups decide what history costs.',
      },
      {
        question: 'What pages a human: thresholds, anomalies, or both?',
        decides: 'Static thresholds flap; learned baselines need training loops.',
      },
      {
        question: 'Do customers query raw data or dashboards?',
        decides: 'Ad-hoc queries need different storage than prebuilt boards.',
      },
    ],
    functional: [
      'Hosts can push metric points continuously',
      'Users can dashboard any metric over any window',
      'Alerts fire on windowed conditions with routing',
    ],
    nonfunctional: [
      'Ingest never drops points during traffic peaks',
      'Year-long history queryable within seconds',
      'Alerts evaluate within a minute of the condition',
      'Cardinality explosions cannot take down the tier',
    ],
    estimations: [
      'Ingest: 500k hosts times dozens of series, millions of points a second',
      'Storage: raw for days, rolled up for a year, petabytes without rollups',
      'Reads: dashboards poll on refresh cycles, alerts evaluate continuously',
    ],
    entities: [
      { name: 'Series', fields: 'metric, labels hash, retention tier, rollup schedule' },
      { name: 'Point', fields: 'series id, timestamp, value' },
      { name: 'AlertRule', fields: 'id, expression, window, hysteresis, route' },
    ],
    api: {
      protocol: 'REST plus push ingest',
      protocolWhy:
        'Hosts push points over lightweight ingest. Dashboards and rules are reads and CRUD over series metadata.',
      endpoints: [
        { method: 'POST', path: '/ingest', purpose: 'Batch-push metric points' },
        { method: 'GET', path: '/query?metric=&from=&to=', purpose: 'Range query over rollups' },
        { method: 'POST', path: '/alerts', purpose: 'Create an alert rule' },
      ],
    },
    hldPresetId: 'specialised-stores',
    hldSteps: [
      'Buffer ingest behind queues so peaks never drop points.',
      'Write raw points short-lived and roll up on schedule.',
      'Evaluate alerts over windows with hysteresis, not instants.',
      'Isolate runaway series by cardinality limits per tenant.',
    ],
    deepDives: [
      {
        title: 'Cardinality that does not kill',
        problem: 'One bad label with a user id per series creates millions of orphans.',
        approach: [
          'Cap active series per tenant with headroom alerts first.',
          'Drop or aggregate violating dimensions instead of storing them.',
          'Charge back by series so owners feel their labels.',
        ],
        tradeoff: 'Some dropped dimensions in exchange for a tier that survives mistakes.',
      },
      {
        title: 'Rollups that answer a year',
        problem: 'Raw points for a year cost more than the hosts being measured.',
        approach: [
          'Downsample aggressively with age: seconds to minutes to hours.',
          'Precompute dashboard rollups instead of querying raw ranges.',
          'Keep exemplars, not everything, for trace-linked drill-downs.',
        ],
        tradeoff: 'Coarse distant history in exchange for affordable infinite memory.',
      },
      {
        title: 'Alerts humans do not mute',
        problem: 'Flapping thresholds train everyone to ignore paging.',
        approach: [
          'Evaluate over windows with hysteresis and minimum durations.',
          'Route by severity with escalation, not broadcast.',
          'Measure alert precision and retire rules that cry wolf.',
        ],
        tradeoff: 'Slower pages in exchange for pages that mean something.',
      },
    ],
    concepts: ['timeseries-stores', 'scaling-writes', 'event-streams'],
    patterns: ['scaling-writes'],
  },
  {
    id: 'topk-trending',
    title: 'Trending Top-K Rankings',
    tagline: 'Count the flood, serve the board instantly',
    difficulty: 'Hard',
    minutes: 40,
    prompt:
      'Design trending rankings over 1B daily view events. Boards show the top videos per region updated within a minute, while counting stays exact enough to trust and cheap enough to run.',
    checkpoints: [
      {
        question: 'Exact counts or approximate?',
        decides: 'Sketches are cheap and close; exact tallies serialize the flood.',
      },
      {
        question: 'What is the counting window: hour, day, or decaying?',
        decides: 'Windows bound state; decay keeps all-time boards alive.',
      },
      {
        question: 'Per region, per category, or global boards?',
        decides: 'Board dimensions multiply counting state directly.',
      },
    ],
    functional: [
      'View events stream in continuously',
      'Boards serve top-K per region and category',
      'Boards refresh within a minute of counting shifts',
    ],
    nonfunctional: [
      'Board reads under 50ms at p99',
      'Counting absorbs viral spikes without loss',
      'Boards never show half-written ranks',
      'New regions and categories onboard without re-architecture',
    ],
    estimations: [
      'Events: 1B a day, about 12k a second with viral peaks far higher',
      'Boards: regions times categories, each a small sorted structure',
      'Reads: board browsing multiplies counting writes many fold',
    ],
    entities: [
      { name: 'ViewEvent', fields: 'video id, region, timestamp, dedupe key' },
      { name: 'Counter', fields: 'video id, window, count, sketch state' },
      { name: 'BoardSnapshot', fields: 'region, category, ranked ids, computed at' },
    ],
    api: {
      protocol: 'REST for boards, streams for events',
      protocolWhy:
        'Boards are tiny fast reads. Events arrive as streams the API tier never touches directly.',
      endpoints: [
        { method: 'GET', path: '/trending?region=&category=', purpose: 'Top-K snapshot' },
        { method: 'GET', path: '/videos/{id}/rank', purpose: 'Personal rank lookup' },
      ],
    },
    hldPresetId: 'topk',
    hldSteps: [
      'Stream view events into windowed counters partitioned by video.',
      'Rank per board from counters on a short timer, not per event.',
      'Serve boards from versioned snapshots swapped atomically.',
      'Dedupe replays so retries never inflate counts.',
    ],
    deepDives: [
      {
        title: 'Counting without serializing virality',
        problem: 'One viral video serializing all counters caps the whole pipeline.',
        approach: [
          'Partition counters by video so heat spreads across workers.',
          'Pre-aggregate locally before shuffling to global counters.',
          'Approximate with sketches where exactness buys nothing.',
        ],
        tradeoff: 'Approximation and partitioning work in exchange for counting that never caps.',
      },
      {
        title: 'Boards that never tear',
        problem: 'Readers catching mid-recompute see half old, half new ranks.',
        approach: [
          'Compute the next snapshot offline, then swap the pointer.',
          'Version snapshots so clients finish reading one generation.',
          'Stagger board recomputes so they never stampede the counters.',
        ],
        tradeoff: 'Minute-old ranks in exchange for boards that never tear.',
      },
      {
        title: 'Gaming the trends',
        problem: 'View farms manufacture virality within hours of launch.',
        approach: [
          'Dedupe by viewer and velocity, not just raw counts.',
          'Quarantine suspicious surges for review before ranking.',
          'Weight diversity of viewers over sheer volume.',
        ],
        tradeoff: 'Slower breakout detection in exchange for trends people believe.',
      },
    ],
    concepts: ['scaling-reads', 'event-streams', 'sketch-structures'],
    patterns: ['scaling-reads', 'scaling-writes'],
  },
  {
    id: 'ad-clicks',
    title: 'Ad Click Aggregation',
    tagline: 'Count billions of clicks into billable truth',
    difficulty: 'Hard',
    minutes: 40,
    prompt:
      'Design click aggregation for an ad network serving 500B impressions monthly. Count clicks into billable windows within minutes, filter fraud inline, and never bill the same click twice.',
    checkpoints: [
      {
        question: 'How fast from click to billable?',
        decides: 'Minutes-fresh needs streaming windows; hourly allows batches.',
      },
      {
        question: 'What makes a click invalid?',
        decides: 'Duplicates, bots, and accidents each need detection rules.',
      },
      {
        question: 'Who queries the counts: advertisers live or finance daily?',
        decides: 'Live advertiser reads need serving tiers finance never touches.',
      },
    ],
    functional: [
      'Clicks stream in from serving tiers continuously',
      'Counts aggregate into billable windows per campaign',
      'Advertisers read live spend with understood freshness',
    ],
    nonfunctional: [
      'Billable counts within minutes of the click',
      'No click billed twice across retries and replays',
      'Fraud filtered before billing, with appeal trails',
      'Spend reads under 200ms at p99',
    ],
    estimations: [
      'Events: billions of clicks a month with sharp campaign peaks',
      'Windows: minutes wide, keyed by campaign and creative',
      'Reads: advertiser dashboards poll constantly during flights',
    ],
    entities: [
      { name: 'ClickEvent', fields: 'id, campaign, creative, timestamp, fingerprint' },
      { name: 'BillableWindow', fields: 'campaign, window start, valid count, fraud count' },
      { name: 'FraudSignal', fields: 'fingerprint, pattern, verdict, reviewed flag' },
    ],
    api: {
      protocol: 'Streams in, REST out',
      protocolWhy:
        'Clicks arrive as streams far too fast for request APIs. Advertisers read aggregates over REST.',
      endpoints: [
        { method: 'GET', path: '/campaigns/{id}/spend?window=', purpose: 'Billable counts' },
        { method: 'GET', path: '/campaigns/{id}/fraud', purpose: 'Filtered click trails' },
      ],
    },
    hldPresetId: 'event-driven',
    hldSteps: [
      'Dedupe clicks by event id at ingest before anything counts.',
      'Window valid clicks per campaign in streaming aggregators.',
      'Filter fraud inline and quarantine the uncertain for review.',
      'Serve spend from precomputed windows, never live scans.',
    ],
    deepDives: [
      {
        title: 'Exactly-once billing over retries',
        problem: 'At-least-once delivery bills the same click twice without dedup.',
        approach: [
          'Key every click once and collapse repeats at ingest.',
          'Make window updates idempotent to the same event id.',
          'Reconcile billed totals against raw logs continuously.',
        ],
        tradeoff: 'Dedupe state per click in exchange for bills nobody disputes.',
      },
      {
        title: 'Fraud inline without blocking',
        problem: 'Deep fraud analysis takes longer than the billing window allows.',
        approach: [
          'Apply cheap rules inline and expensive models asynchronously.',
          'Bill the provisionally valid, then adjust with credits on verdicts.',
          'Track fingerprints across campaigns to catch farms early.',
        ],
        tradeoff: 'Provisional bills with later adjustments in exchange for speed with fairness.',
      },
      {
        title: 'Windows that close cleanly',
        problem: 'Late clicks arriving after close must not rewrite history silently.',
        approach: [
          'Allow bounded lateness with explicit correction records.',
          'Freeze windows after the lateness bound and version them.',
          'Show advertisers provisional versus final states distinctly.',
        ],
        tradeoff: 'Slightly delayed finality in exchange for books that always balance.',
      },
    ],
    concepts: ['scaling-writes', 'event-streams', 'sketch-structures'],
    patterns: ['scaling-writes'],
  },
  {
    id: 'post-search',
    title: 'Social Post Search',
    tagline: 'Search every post with recency that feels live',
    difficulty: 'Hard',
    minutes: 40,
    prompt:
      'Design full-text search over 10B social posts with recency ranking. New posts appear within seconds, trending terms stay fast under flash interest, and deleted posts vanish promptly.',
    checkpoints: [
      {
        question: 'How fresh must a new post be?',
        decides: 'Seconds-fresh needs streaming index updates; minutes allows batches.',
      },
      {
        question: 'Rank by relevance, recency, or social signals?',
        decides: 'Ranking inputs decide index layout and query cost.',
      },
      {
        question: 'How fast must deletes disappear?',
        decides: 'Takedown latency bounds determine index update paths.',
      },
    ],
    functional: [
      'Users can full-text search posts with filters',
      'New posts become searchable within seconds',
      'Deleted posts leave results promptly',
    ],
    nonfunctional: [
      'Search under 200ms at p99 including flash terms',
      'Index freshness within seconds of posting',
      'Takedowns effective within a minute',
      'Corpus of 10B posts across sharded indexes',
    ],
    estimations: [
      'Writes: millions of new posts a day plus edits and deletes',
      'Reads: search at tens of thousands of queries a second with flash spikes',
      'Index: terabytes of postings sharded by term and time',
    ],
    entities: [
      { name: 'Post', fields: 'id, author, timestamp, text, visibility' },
      { name: 'PostingList', fields: 'term, shard, document ids with positions' },
      { name: 'Takedown', fields: 'post id, reason, effective at' },
    ],
    api: {
      protocol: 'REST',
      protocolWhy:
        'Search is a read API with rich query parameters. Indexing is an internal stream the user never calls.',
      endpoints: [
        { method: 'GET', path: '/search/posts?q=&since=&filter=', purpose: 'Ranked post results' },
        { method: 'GET', path: '/search/suggest?q=', purpose: 'Typeahead completions' },
      ],
    },
    hldPresetId: 'specialised-stores',
    hldSteps: [
      'Stream posts into the index within seconds of writing.',
      'Shard postings by term with a recency tier for fresh content.',
      'Rank by blending text score, recency, and social signals.',
      'Apply takedowns as priority deletes that purge all tiers.',
    ],
    deepDives: [
      {
        title: 'Freshness without reindexing the world',
        problem: 'Rebuilding shards per post is impossibly expensive.',
        approach: [
          'Buffer fresh posts in a small real-time tier merged at query time.',
          'Promote tiers to the main index on a schedule.',
          'Delete by marking first and purging on promotion.',
        ],
        tradeoff: 'Slightly costlier queries in exchange for seconds-fresh results.',
      },
      {
        title: 'Flash terms without collapse',
        problem: 'One breaking story concentrates all queries onto few terms.',
        approach: [
          'Replicate hot term shards ahead of the surge.',
          'Cache top results per hot query with second-level TTLs.',
          'Shed personalized ranking first, keep plain recency flowing.',
        ],
        tradeoff: 'Simpler ranking under stress in exchange for search that survives the story.',
      },
      {
        title: 'Ranking across three signals',
        problem: 'Relevance, recency, and social proof disagree constantly.',
        approach: [
          'Score each signal separately, then blend with stated weights.',
          'Learn weights per query class instead of one global recipe.',
          'Expose recency versus relevance controls to the user.',
        ],
        tradeoff: 'Ranking complexity in exchange for results that feel right.',
      },
    ],
    concepts: ['search-index', 'change-capture', 'scaling-reads'],
    patterns: ['scaling-reads'],
  },
  {
    id: 'code-runner',
    title: 'Code Runner and Contest Board',
    tagline: 'Judge untrusted code fairly at contest scale',
    difficulty: 'Popular',
    minutes: 40,
    prompt:
      'Design an online judge for 5M developers. Submissions run untrusted code in sandboxes, contests burst 20x at start, and leaderboards update live without leaking other users code.',
    checkpoints: [
      {
        question: 'Which languages, and how isolated?',
        decides: 'Containers per language versus shared pools changes cost and safety.',
      },
      {
        question: 'How are contests scored: live or frozen?',
        decides: 'Live boards excite; frozen finals stay fair.',
      },
      {
        question: 'What limits a run: time, memory, or syscalls?',
        decides: 'Limits define sandbox design and verdict semantics.',
      },
    ],
    functional: [
      'Users can submit code in several languages',
      'Sandboxes execute with time and memory limits',
      'Contests rank participants live during windows',
    ],
    nonfunctional: [
      'Verdicts within seconds at p99 outside contest peaks',
      'Untrusted code cannot escape or observe neighbors',
      'Contest starts absorb 20x bursts without lost submits',
      'Leaderboards refresh within seconds of accepted runs',
    ],
    estimations: [
      'Submits: contest starts near 10k a minute, mostly idle between',
      'Runs: seconds of sandbox compute each, highly parallelizable',
      'Boards: reads multiply every accepted run several fold',
    ],
    entities: [
      { name: 'Submission', fields: 'id, user, problem, language, code pointer, state' },
      { name: 'Verdict', fields: 'submission id, status, runtime, memory' },
      { name: 'ContestRank', fields: 'contest id, user id, score, tiebreak' },
    ],
    api: {
      protocol: 'REST plus pollable status',
      protocolWhy:
        'Submits are REST writes returning job ids. Verdicts arrive by polling or push; execution stays internal.',
      endpoints: [
        { method: 'POST', path: '/submissions', purpose: 'Submit code for judging' },
        { method: 'GET', path: '/submissions/{id}', purpose: 'Verdict and run details' },
        { method: 'GET', path: '/contests/{id}/board', purpose: 'Live contest ranks' },
      ],
    },
    hldPresetId: 'leetcode',
    hldSteps: [
      'Accept submits instantly into a queue with per-language lanes.',
      'Execute in sandboxed worker pools sized from run duration math.',
      'Record verdicts and update contest ranks from sorted sets.',
      'Serve boards from snapshots while judging continues behind.',
    ],
    deepDives: [
      {
        title: 'Sandboxes that hold',
        problem: 'Untrusted code probes every boundary you forgot.',
        approach: [
          'Isolate with containers plus syscall filters and no network.',
          'Cap time, memory, and output size with hard kills.',
          'Reuse warm sandboxes per language without leaking state between runs.',
        ],
        tradeoff: 'Pool and filter complexity in exchange for sleeping well at night.',
      },
      {
        title: 'Contest-start bursts',
        problem: 'Twenty times normal submits arrive in the first sixty seconds.',
        approach: [
          'Buffer submits in queues and acknowledge immediately.',
          'Autoscale judge pools while the queue absorbs the gap.',
          'Prioritize contest traffic over practice traffic explicitly.',
        ],
        tradeoff: 'Delayed verdicts at the start in exchange for zero lost submits.',
      },
      {
        title: 'Fair live boards',
        problem: 'Rejudges and hacks must not corrupt standings mid-contest.',
        approach: [
          'Version board snapshots and recompute from verdict logs.',
          'Apply hacks and rejudges as new verdicts, never edits.',
          'Freeze boards before finals with published rules.',
        ],
        tradeoff: 'Recompute work in exchange for standings anyone can audit.',
      },
    ],
    concepts: ['workers-async', 'long-running-tasks', 'scaling-reads'],
    patterns: ['long-running-tasks', 'scaling-reads'],
  },
];
