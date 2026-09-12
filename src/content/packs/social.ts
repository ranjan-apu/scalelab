import type { InterviewPack } from '../interviewPacks';

/** Social and feed packs: graphs, ranking, and fan-out at scale. */
export const SOCIAL_PACKS: readonly InterviewPack[] = [
  {
    id: 'photo-feed',
    title: 'Photo Share Feed',
    tagline: 'Post photos, follow people, open a fast home feed',
    difficulty: 'Popular',
    minutes: 45,
    prompt:
      'Design a photo-sharing feed for 500M users. People post photos with captions, follow others, and open a chronological home feed that loads instantly.',
    checkpoints: [
      {
        question: 'Chronological or ranked feed?',
        decides: 'Chronological is a merge; ranking needs a scoring service.',
      },
      {
        question: 'Do mega-accounts with 100M followers fan out like everyone else?',
        decides: 'The hot key shapes the entire write path.',
      },
      {
        question: 'Which photo bytes travel through our servers?',
        decides: 'Direct-to-storage upload versus proxied bytes changes cost completely.',
      },
    ],
    functional: [
      'Users can post photos with captions',
      'Users can follow and unfollow others',
      'Users can read their home feed, paged',
    ],
    nonfunctional: [
      'Feed opens under 500ms at p99',
      'Photos render instantly from nearby edges',
      'New posts visible within seconds',
      'Scales to 500M users with heavy read skew',
    ],
    estimations: [
      'Reads: feed opens dominate at roughly 100 to 1 over posts',
      'Writes: posts plus follow edges, small rows, huge photo bytes',
      'Storage: photos in blob tiers, metadata indexed by author and time',
    ],
    entities: [
      { name: 'User', fields: 'id, follower bucket (normal vs mega)' },
      { name: 'Photo', fields: 'id, author id, timestamp, storage pointers, caption' },
      { name: 'Follow', fields: 'follower id, followee id, created at' },
    ],
    api: {
      protocol: 'REST plus direct upload',
      protocolWhy:
        'Feed and graph calls are REST. Photo bytes upload straight to storage so app servers never touch megabytes.',
      endpoints: [
        { method: 'POST', path: '/photos/upload-urls', purpose: 'Mint chunk upload URLs' },
        { method: 'POST', path: '/photos', purpose: 'Publish a photo post' },
        { method: 'POST', path: '/follows', purpose: 'Follow a user' },
        { method: 'GET', path: '/feed?cursor=', purpose: 'Paged home feed' },
      ],
    },
    hldPresetId: 'photofeed',
    hldSteps: [
      'Client to service to store: publish a post, read a merged feed.',
      'Precompute timelines on write so reads become one cache hit.',
      'Keep mega-accounts on the read path to avoid 100M-entry write storms.',
      'Serve photo bytes from edge caches with multiple renditions.',
    ],
    deepDives: [
      {
        title: 'Fan-out write versus read',
        problem: 'Merging hundreds of followees per open is too slow at feed scale.',
        approach: [
          'Push normal posts into follower timeline caches on write.',
          'Merge mega-account posts at read time instead.',
          'Cap stored timelines and rebuild cold ones on open.',
        ],
        tradeoff: 'Write amplification and slight staleness for instant reads.',
      },
      {
        title: 'Instant photo rendering',
        problem: 'Multi-megabyte originals cannot render instantly on mobile networks.',
        approach: [
          'Generate lightweight previews first, full variants after.',
          'Serve the smallest sufficient rendition per device.',
          'Cache hot photos at edges close to viewers.',
        ],
        tradeoff: 'Processing and storage overhead in exchange for instant paint.',
      },
      {
        title: 'Feed pagination that survives inserts',
        problem: 'New posts arriving mid-scroll duplicate or skip items with offsets.',
        approach: [
          'Page by cursor over stable (timestamp, id) ordering.',
          'Freeze page boundaries per session instead of live re-sorting.',
        ],
        tradeoff: 'Slightly stale pages in exchange for stable scrolling.',
      },
    ],
    concepts: ['scaling-reads', 'large-blobs', 'cdn-edge'],
    patterns: ['scaling-reads', 'large-blobs'],
  },
  {
    id: 'match-feed',
    title: 'Profile Discovery and Matching',
    tagline: 'Swipe nearby profiles and chat on mutual interest',
    difficulty: 'Popular',
    minutes: 40,
    prompt:
      'Design profile discovery for 100M users. People browse nearby profiles, signal interest, and unlock chat on mutual matches. Discovery is read-heavy and geo-bounded.',
    checkpoints: [
      {
        question: 'How far may discovery reach?',
        decides: 'Tight geo bounds keep queries single-partition; global reach does not.',
      },
      {
        question: 'What unlocks chat: mutual signals only?',
        decides: 'Mutual matching needs reciprocal detection; open messaging needs spam defense.',
      },
      {
        question: 'Do inactive profiles appear in discovery?',
        decides: 'Freshness filtering decides index size and query cost.',
      },
    ],
    functional: [
      'Users can browse nearby profiles',
      'Users can signal interest in a profile',
      'Mutual matches unlock one-to-one chat',
    ],
    nonfunctional: [
      'Discovery under 200ms at p99',
      'Match detection within seconds of the second signal',
      'No profile shown twice after an explicit pass',
      'Evening peaks 8x the morning baseline',
    ],
    estimations: [
      'Reads: discovery browsing dominates at thousands of rps per metro',
      'Writes: signals are small rows with dedupe by pair',
      'Matches: a small fraction of signals, each opening a conversation',
    ],
    entities: [
      { name: 'Profile', fields: 'id, geo cell, activity timestamp, preference vector' },
      { name: 'Signal', fields: 'from id, to id, direction, timestamp' },
      { name: 'Match', fields: 'pair id, matched at, conversation id' },
    ],
    api: {
      protocol: 'REST plus sockets for chat',
      protocolWhy:
        'Discovery and signals are REST. The unlocked conversation rides the messaging socket path.',
      endpoints: [
        { method: 'GET', path: '/discover?lat=&lon=', purpose: 'Nearby profile deck' },
        { method: 'POST', path: '/signals', purpose: 'Signal interest or pass' },
        { method: 'GET', path: '/matches', purpose: 'Mutual matches list' },
      ],
    },
    hldPresetId: 'sharded-database',
    hldSteps: [
      'Client to service to store: profiles, signals, and matches.',
      'Shard profiles by geo cell so discovery stays local.',
      'Detect mutual signals with a pair-keyed lookup on every signal.',
      'Hand matches to the chat path instead of building messaging twice.',
    ],
    deepDives: [
      {
        title: 'Geo-bounded discovery at peak',
        problem: 'Evening browsing concentrates entire metros onto few cells.',
        approach: [
          'Precompute candidate decks per cell and refresh on a timer.',
          'Filter seen profiles at serve time from a compact per-user set.',
          'Split hot cells when p99 degrades instead of scaling everything.',
        ],
        tradeoff: 'Precompute staleness in exchange for surviving the evening.',
      },
      {
        title: 'Exactly-once match detection',
        problem: 'Two near-simultaneous signals must open exactly one conversation.',
        approach: [
          'Key the match row by the ordered pair so duplicates collapse.',
          'Serialize per-pair decisions through one conditional write.',
          'Notify both sides idempotently from the single committed row.',
        ],
        tradeoff: 'One serialized write per signal in exchange for no duplicate chats.',
      },
      {
        title: 'Spam and bad actors',
        problem: 'Open signaling invites bots and harassment at scale.',
        approach: [
          'Throttle signals per account with new-account limits.',
          'Shadow-review reported profiles without blocking reporters.',
          'Require mutual interest before any message content flows.',
        ],
        tradeoff: 'Some friction for newcomers in exchange for a deck people trust.',
      },
    ],
    concepts: ['proximity-search', 'sharding', 'contention-control'],
    patterns: ['scaling-reads', 'contention-control'],
  },
  {
    id: 'activity-tracker',
    title: 'Workout and Activity Feed',
    tagline: 'Ingest GPS streams and rank every segment',
    difficulty: 'Popular',
    minutes: 40,
    prompt:
      'Design an activity tracker for 150M athletes. Apps stream GPS points during workouts, followers see a social feed, and segments rank every rider who ever climbed them.',
    checkpoints: [
      {
        question: 'Live tracking or upload-at-finish?',
        decides: 'Live streams need ingest buffering; finish-uploads need bulk import.',
      },
      {
        question: 'Who computes segment times: client or server?',
        decides: 'Client math saves ingestion but trusts the device; server math costs more.',
      },
      {
        question: 'How long do raw GPS points live?',
        decides: 'Raw retention bounds storage; rollups keep history affordable.',
      },
    ],
    functional: [
      'Apps can stream workout GPS points live',
      'Users can follow friends and read an activity feed',
      'Segments rank all-time efforts per leaderboard',
    ],
    nonfunctional: [
      'Ingest millions of points per minute at workout peaks',
      'Leaderboards update within minutes of a finished effort',
      'Raw points retained briefly; summaries kept for years',
      'Feed reads stay fast during the morning workout rush',
    ],
    estimations: [
      'Writes: workout peaks near 100k points a second globally',
      'Reads: feed browsing at 20 to 1 over workout uploads',
      'Storage: raw points heavy for days, then rolled up and thinned',
    ],
    entities: [
      { name: 'Workout', fields: 'id, athlete id, started at, point stream reference' },
      { name: 'Segment', fields: 'id, polyline, leaderboard scope' },
      { name: 'Effort', fields: 'workout id, segment id, elapsed, rank snapshot' },
    ],
    api: {
      protocol: 'REST plus stream ingest',
      protocolWhy:
        'Social reads are REST. GPS points arrive as a high-rate stream the API tier never touches directly.',
      endpoints: [
        { method: 'POST', path: '/workouts', purpose: 'Start a tracked workout' },
        { method: 'POST', path: '/workouts/{id}/points', purpose: 'Batch-append GPS points' },
        { method: 'GET', path: '/feed?cursor=', purpose: 'Friend activity feed' },
        { method: 'GET', path: '/segments/{id}/leaderboard', purpose: 'All-time segment ranks' },
      ],
    },
    hldPresetId: 'event-driven',
    hldSteps: [
      'Apps buffer points and upload in batches to an ingest stream.',
      'Stream consumers write workouts while leaderboard workers match segments.',
      'Serve feeds from precomputed caches and leaderboards from ranked sets.',
      'Roll raw points into summaries after the freshness window closes.',
    ],
    deepDives: [
      {
        title: 'Segment matching at ingest speed',
        problem: 'Matching every point against thousands of segments per second is too slow.',
        approach: [
          'Index segments by geo cell and match only nearby candidates.',
          'Score efforts asynchronously after the workout, not per point.',
          'Cache popular segment geometries at the matcher tier.',
        ],
        tradeoff: 'Minutes of leaderboard lag in exchange for ingest that never blocks.',
      },
      {
        title: 'Cheating and GPS noise',
        problem: 'Drives recorded as rides and noisy tunnels corrupt leaderboards.',
        approach: [
          'Flag impossible speeds and heart-rate mismatches for review.',
          'Smooth noisy traces before matching, not after ranking.',
          'Quarantine suspect efforts instead of deleting community history.',
        ],
        tradeoff: 'Some manual review in exchange for boards athletes believe.',
      },
      {
        title: 'Feed during the morning rush',
        problem: 'Everyone finishes at 8am and opens the app at 8:05.',
        approach: [
          'Precompute follower feeds as workouts complete.',
          'Serve the rush from cache while matching catches up behind.',
          'Prioritize followed-athlete efforts over global discovery.',
        ],
        tradeoff: 'Slight feed delay for finishes in exchange for instant opens.',
      },
    ],
    concepts: ['scaling-writes', 'event-streams', 'timeseries-stores'],
    patterns: ['scaling-writes', 'scaling-reads'],
  },
  {
    id: 'live-comments',
    title: 'Live Comment Firehose',
    tagline: 'Order millions of comments on one broadcast',
    difficulty: 'Popular',
    minutes: 40,
    prompt:
      'Design live comments for broadcasts with 5M concurrent viewers. Comments must appear in order within a second, late joiners catch up instantly, and senders never see errors during goal moments.',
    checkpoints: [
      {
        question: 'Global order or per-viewer order?',
        decides: 'Global sequencing serializes everything; per-viewer ordering scales.',
      },
      {
        question: 'What does a late joiner receive?',
        decides: 'Replay windows bound buffer sizes and catch-up cost.',
      },
      {
        question: 'Do senders need delivery receipts?',
        decides: 'Receipts double fan-out traffic; fire-and-forget stays light.',
      },
    ],
    functional: [
      'Viewers can post comments on a live broadcast',
      'Viewers receive comments in order under a second',
      'Late joiners catch up on recent comments instantly',
    ],
    nonfunctional: [
      'Ordered delivery under 1s at p99 during bursts',
      'Senders succeed even at 50x baseline comment rate',
      'Catch-up reads served from memory, never the archive',
      'One broadcast never starves another on shared tiers',
    ],
    estimations: [
      'Writes: goal moments near 100k comments a second on one broadcast',
      'Fan-out: each comment delivered to millions of viewers',
      'Replay: bounded recent window per broadcast, seconds of history',
    ],
    entities: [
      { name: 'Broadcast', fields: 'id, started at, replay window config' },
      { name: 'Comment', fields: 'id, broadcast id, sequence number, author, text' },
      { name: 'ViewerCursor', fields: 'viewer id, broadcast id, last sequence seen' },
    ],
    api: {
      protocol: 'WebSocket plus REST',
      protocolWhy:
        'Comments and delivery ride sockets for ordering and speed. History and posting fallbacks stay REST.',
      endpoints: [
        { method: 'WS', path: '/broadcasts/{id}/stream', purpose: 'Ordered comment delivery' },
        { method: 'POST', path: '/broadcasts/{id}/comments', purpose: 'Post a comment' },
        { method: 'GET', path: '/broadcasts/{id}/catchup?since=', purpose: 'Recent window replay' },
      ],
    },
    hldPresetId: 'livefirehose',
    hldSteps: [
      'Viewers hold sockets on connection tiers sharded by broadcast.',
      'Sequence each broadcast comments once, then fan out to holders.',
      'Buffer the recent window in memory for instant catch-up.',
      'Shed gracefully per broadcast so one viral moment never takes the tier.',
    ],
    deepDives: [
      {
        title: 'Ordering without serializing the world',
        problem: 'One global sequence number becomes the system bottleneck.',
        approach: [
          'Sequence per broadcast, not globally.',
          'Batch sequence assignment to amortize the atomic increment.',
          'Deliver by sequence and hold back gaps briefly before skipping.',
        ],
        tradeoff: 'Tiny hold-back delays in exchange for order at burst speed.',
      },
      {
        title: 'Fan-out that survives the goal',
        problem: 'Fifty times normal comments must reach millions without sender errors.',
        approach: [
          'Buffer sends and acknowledge before fan-out completes.',
          'Scale fan-out workers per broadcast, not per system.',
          'Sample or collapse low-value updates when workers saturate.',
        ],
        tradeoff: 'Some collapsed updates in exchange for zero sender errors.',
      },
      {
        title: 'Late joiners without archive reads',
        problem: 'Thousands joining per second cannot all hit cold storage.',
        approach: [
          'Keep the replay window in memory sized by broadcast velocity.',
          'Serve catch-up from the same buffer fan-out reads.',
          'Page older history to the archive only on explicit scrollback.',
        ],
        tradeoff: 'Memory per hot broadcast in exchange for instant joins.',
      },
    ],
    concepts: ['realtime-updates', 'scaling-writes', 'message-queue'],
    patterns: ['realtime-updates', 'scaling-writes'],
  },
  {
    id: 'news-aggregator',
    title: 'News Ingest and Ranking',
    tagline: 'Cluster the flood into a personal front page',
    difficulty: 'Popular',
    minutes: 40,
    prompt:
      'Design a news aggregator crawling 100k sources. Dedup near-identical stories, cluster developing events, and rank a personal front page per user within minutes of publication.',
    checkpoints: [
      {
        question: 'How fast from publish to front page?',
        decides: 'Minutes-fresh needs streaming dedup; hourly allows batch clustering.',
      },
      {
        question: 'Personalized or editorial ranking?',
        decides: 'Personal models need profiles and training loops; editorial needs curation tools.',
      },
      {
        question: 'What defines the same story?',
        decides: 'Near-dup thresholds decide cluster quality and compute cost.',
      },
    ],
    functional: [
      'Crawlers can ingest articles continuously',
      'Stories cluster into developing events',
      'Users get a ranked personal front page',
    ],
    nonfunctional: [
      'Publish to front page within minutes',
      'Near-dup detection across millions of daily articles',
      'Ranking reads under 200ms at p99',
      'Crawling stays polite per publisher',
    ],
    estimations: [
      'Ingest: millions of articles a day with morning and evening peaks',
      'Dedup: fingerprint comparisons bounded by time windows, not all pairs',
      'Reads: front-page opens dominate writes by orders of magnitude',
    ],
    entities: [
      { name: 'Article', fields: 'id, source, published at, fingerprint, embedding' },
      { name: 'StoryCluster', fields: 'id, representative article, member count, momentum' },
      { name: 'UserProfile', fields: 'user id, topic weights, seen story ids' },
    ],
    api: {
      protocol: 'REST',
      protocolWhy:
        'Front pages, clusters, and preferences are reads and CRUD. Ingest is an internal pipeline.',
      endpoints: [
        { method: 'GET', path: '/frontpage', purpose: 'Personal ranked stories' },
        { method: 'GET', path: '/stories/{id}', purpose: 'Cluster with member articles' },
        { method: 'POST', path: '/preferences', purpose: 'Tune topic weights' },
      ],
    },
    hldPresetId: 'async-workers',
    hldSteps: [
      'Crawl politely into an ingest queue with per-publisher budgets.',
      'Fingerprint and cluster asynchronously; ranking reads never wait.',
      'Precompute front pages per cohort and personalize at serve time.',
      'Track seen stories so pages never repeat themselves.',
    ],
    deepDives: [
      {
        title: 'Near-dup detection at millions a day',
        problem: 'Comparing every article against every other is quadratic and hopeless.',
        approach: [
          'Fingerprint with shingles and compare within time windows only.',
          'Confirm candidates with embeddings instead of full text.',
          'Cluster incrementally as articles arrive, not in nightly batches.',
        ],
        tradeoff: 'Occasional split or merged clusters in exchange for minutes-fresh pages.',
      },
      {
        title: 'Ranking without filter bubbles',
        problem: 'Pure engagement ranking narrows every reader into sameness.',
        approach: [
          'Blend recency, source diversity, and personal weights explicitly.',
          'Reserve slots for developing stories outside the profile.',
          'Measure diversity as a metric, not a hope.',
        ],
        tradeoff: 'Some raw engagement left on the table in exchange for a front page worth opening.',
      },
      {
        title: 'Polite crawling that still finishes',
        problem: 'Aggressive crawling gets blocked; timid crawling goes stale.',
        approach: [
          'Budget per publisher with sitemaps and change frequency hints.',
          'Prioritize developing stories over the long tail.',
          'Back off fast on errors and retry on a separate slow lane.',
        ],
        tradeoff: 'Tail staleness in exchange for never losing a publisher.',
      },
    ],
    concepts: ['workers-async', 'scaling-reads', 'vector-search'],
    patterns: ['long-running-tasks', 'scaling-reads'],
  },
  {
    id: 'music-stream',
    title: 'Music Stream and Discovery',
    tagline: 'Play instantly while recommendations learn taste',
    difficulty: 'Popular',
    minutes: 40,
    prompt:
      'Design music streaming for 600M listeners. Audio plays instantly from nearby edges, metadata stays queryable, and weekly discovery playlists regenerate from listening history.',
    checkpoints: [
      {
        question: 'Do audio bytes and metadata share a path?',
        decides: 'Sharing couples two very different scaling stories.',
      },
      {
        question: 'How fresh must recommendations be?',
        decides: 'Weekly batches are cheap; interactive taste needs streaming features.',
      },
      {
        question: 'Offline downloads: whose bytes, whose accounting?',
        decides: 'Downloads need licenses, expiry, and play counting without phoning home.',
      },
    ],
    functional: [
      'Users can play any catalog track instantly',
      'Users get weekly discovery playlists',
      'Users can download tracks for offline play',
    ],
    nonfunctional: [
      'Playback starts under a second at p99',
      'Metadata queries independent of audio delivery load',
      'Royalty events never lost even if dashboards lag',
      'Catalog of 100M tracks with daily additions',
    ],
    estimations: [
      'Bytes: audio dominates everything; metadata is rounding error',
      'Reads: playback and browsing at massive concurrency, mostly idle sockets',
      'Events: plays stream into royalty and taste pipelines continuously',
    ],
    entities: [
      { name: 'Track', fields: 'id, audio pointers, metadata, license terms' },
      { name: 'Playlist', fields: 'id, owner, track list, generated at' },
      { name: 'PlayEvent', fields: 'user id, track id, timestamp, offline flag' },
    ],
    api: {
      protocol: 'REST plus edge streaming',
      protocolWhy:
        'Catalog, playlists, and downloads are REST. Audio segments stream from the edge over standard media protocols.',
      endpoints: [
        { method: 'GET', path: '/tracks/{id}', purpose: 'Metadata plus stream URLs' },
        { method: 'GET', path: '/playlists/discover-weekly', purpose: 'Personal picks' },
        { method: 'POST', path: '/downloads', purpose: 'License tracks for offline' },
      ],
    },
    hldPresetId: 'spotify',
    hldSteps: [
      'Serve audio from object storage through edge caches; metadata from its own stores.',
      'Stream play events into royalty and taste pipelines asynchronously.',
      'Regenerate discovery playlists in batches, never on the request path.',
      'License downloads with expiry and count plays on next sync.',
    ],
    deepDives: [
      {
        title: 'Instant playback at global scale',
        problem: 'Spinning up origin fetches per play would melt the cloud.',
        approach: [
          'Cache hot tracks at edges inside ISP networks.',
          'Start playback from the first segment while the rest prefetches.',
          'Separate control-plane failures from audio delivery entirely.',
        ],
        tradeoff: 'Edge footprint and prefetch waste in exchange for sub-second starts.',
      },
      {
        title: 'Discovery without stale taste',
        problem: 'Weekly batches go stale the moment habits change.',
        approach: [
          'Blend batch playlists with light real-time signals at serve time.',
          'Recompute in stages so failures degrade to last week, not to nothing.',
          'Isolate batch writes from serving reads with versioned snapshots.',
        ],
        tradeoff: 'Batch complexity in exchange for recommendations that survive bad Tuesdays.',
      },
      {
        title: 'Royalty events that never drop',
        problem: 'Play counts are money; losing them is not an option dashboards enjoy.',
        approach: [
          'Buffer play events durably before acknowledging.',
          'Process royalties idempotently so redeliveries never double-pay.',
          'Let dashboards lag while the money pipeline stays exact.',
        ],
        tradeoff: 'Dashboard staleness in exchange for exact payouts.',
      },
    ],
    concepts: ['large-blobs', 'cdn-edge', 'vector-search'],
    patterns: ['large-blobs', 'scaling-reads'],
  },
  {
    id: 'game-leaderboard',
    title: 'Game Leaderboard',
    tagline: 'Rank millions of scores the second contests end',
    difficulty: 'Popular',
    minutes: 35,
    prompt:
      'Design live leaderboards for mobile games with 50M players. Score submits flood in during events, ranks update within seconds, and cheaters must not hold trophies.',
    checkpoints: [
      {
        question: 'Global board or leagues and friends?',
        decides: 'Global ranking is one hot structure; scoped boards shard naturally.',
      },
      {
        question: 'How fast must a rank update be?',
        decides: 'Seconds-fresh needs sorted sets; minutes-fresh allows batch ranks.',
      },
      {
        question: 'What happens to suspicious scores?',
        decides: 'Inline rejection is fast but risky; quarantine-then-judge is fair.',
      },
    ],
    functional: [
      'Clients can submit scores with anti-cheat attestations',
      'Players can read global and friends boards, paged',
      'Contests open, close, and freeze boards on schedule',
    ],
    nonfunctional: [
      'Board reads under 100ms at p99 during finals',
      'Submits accepted even at 20x baseline',
      'Suspicious scores never visible before review',
      'Final standings frozen and auditable',
    ],
    estimations: [
      'Writes: event peaks near 50k submits a second',
      'Reads: board browsing multiplies writes several fold',
      'Retention: seasons archive; only current boards stay hot',
    ],
    entities: [
      { name: 'Score', fields: 'player id, contest id, value, attestation, verdict' },
      { name: 'Board', fields: 'contest id, scope, frozen flag, snapshot id' },
      { name: 'Contest', fields: 'id, window, rules, prize tiers' },
    ],
    api: {
      protocol: 'REST',
      protocolWhy:
        'Submits and board reads are simple verbs over stable resources. Ranking math stays server-side.',
      endpoints: [
        { method: 'POST', path: '/contests/{id}/scores', purpose: 'Submit a score' },
        { method: 'GET', path: '/contests/{id}/board?scope=', purpose: 'Paged ranks' },
        { method: 'GET', path: '/players/{id}/rank', purpose: 'Personal standing' },
      ],
    },
    hldPresetId: 'leetcode',
    hldSteps: [
      'Accept submits fast into a queue; judge and validate asynchronously.',
      'Maintain ranks in sorted sets per board scope.',
      'Serve boards from precomputed snapshots refreshed on a timer.',
      'Freeze and archive standings when contests close.',
    ],
    deepDives: [
      {
        title: 'Submits that never serialize the board',
        problem: 'Updating one global structure per submit caps throughput.',
        approach: [
          'Shard boards by scope and update shards independently.',
          'Batch rank recomputation instead of per-submit resorting.',
          'Serve reads from snapshots while writes land behind them.',
        ],
        tradeoff: 'Seconds of rank staleness in exchange for unbounded submits.',
      },
      {
        title: 'Cheaters without false trophies',
        problem: 'Blocking on verdicts slows submits; trusting them crowns bots.',
        approach: [
          'Quarantine statistical outliers for async review.',
          'Show provisional ranks that exclude the quarantined.',
          'Ban in waves so detection signals stay secret longer.',
        ],
        tradeoff: 'Delayed justice in exchange for boards players believe.',
      },
      {
        title: 'Finals without collapse',
        problem: 'The last minute brings the whole season at once.',
        approach: [
          'Extend acceptance windows with queued buffering.',
          'Freeze submits cleanly at the deadline with a drain period.',
          'Publish results from the frozen snapshot, never the live set.',
        ],
        tradeoff: 'A short results delay in exchange for finals that converge.',
      },
    ],
    concepts: ['scaling-reads', 'sketch-structures', 'workers-async'],
    patterns: ['scaling-reads', 'long-running-tasks'],
  },
];
