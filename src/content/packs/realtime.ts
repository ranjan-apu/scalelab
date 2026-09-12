import type { InterviewPack } from '../interviewPacks';

/** Real-time packs: sockets, presence, and pushed updates. */
export const REALTIME_PACKS: readonly InterviewPack[] = [
  {
    id: 'notify-hub',
    title: 'Notification Hub',
    tagline: 'Route millions of alerts to push, mail, and SMS',
    difficulty: 'Popular',
    minutes: 40,
    prompt:
      'Design a notification hub sending 1B alerts a day across push, email, and SMS. Template per event, respect per-user preferences and quiet hours, and retry failures without spamming.',
    checkpoints: [
      {
        question: 'Which channel wins when several are available?',
        decides: 'Priority routing decides cost and user interruption level.',
      },
      {
        question: 'Digest or instant per alert?',
        decides: 'Digests bound fan-out; instant maximizes timeliness.',
      },
      {
        question: 'What does a failed push do?',
        decides: 'Fallback chains add reliability but multiply sends.',
      },
    ],
    functional: [
      'Services can submit templated notification requests',
      'Users receive on preferred channels within preferences',
      'Users can tune preferences and quiet hours',
    ],
    nonfunctional: [
      'Alerts deliver within a minute at p99',
      'No user alerted twice for one event',
      'Channel outages reroute without loss',
      'Preference checks never slow the send path',
    ],
    estimations: [
      'Sends: 1B a day, about 12k a second with sharp event peaks',
      'Fan-out: most events touch one user; broadcasts touch millions',
      'Retries: a small fraction, but each retry risks a duplicate',
    ],
    entities: [
      { name: 'Notification', fields: 'id, event id, template, priority, dedupe key' },
      { name: 'Preference', fields: 'user id, channel priority, quiet hours, digest flag' },
      { name: 'Delivery', fields: 'notification id, channel, status, attempts' },
    ],
    api: {
      protocol: 'REST for submit, provider webhooks for status',
      protocolWhy:
        'Internal services submit over REST. Delivery status arrives as provider callbacks that advance each send through its lifecycle.',
      endpoints: [
        { method: 'POST', path: '/notifications', purpose: 'Submit a templated alert' },
        { method: 'GET', path: '/preferences/{userId}', purpose: 'Read send preferences' },
        { method: 'POST', path: '/preferences/{userId}', purpose: 'Update preferences' },
      ],
    },
    hldPresetId: 'event-driven',
    hldSteps: [
      'Accept submits fast, then route per preferences asynchronously.',
      'Batch per user into digests where preferences allow.',
      'Retry with backoff across fallback channels on provider failure.',
      'Dedupe by event key so retries never double-notify.',
    ],
    deepDives: [
      {
        title: 'Preferences at send speed',
        problem: 'A preference lookup per send becomes the bottleneck at 12k rps.',
        approach: [
          'Cache preferences with short TTLs and versioned invalidations.',
          'Compile quiet hours and channel order into the cached record.',
          'Degrade to last-known preferences instead of blocking sends.',
        ],
        tradeoff: 'Minutes of preference staleness in exchange for sends that never wait.',
      },
      {
        title: 'Retries without duplicates',
        problem: 'Provider timeouts leave sends in unknown states that retries duplicate.',
        approach: [
          'Key every delivery by idempotency key the provider echoes.',
          'Confirm status via webhooks before scheduling the next attempt.',
          'Cap attempts per channel, then fall back instead of hammering.',
        ],
        tradeoff: 'Slower confirmation in exchange for users notified exactly as intended.',
      },
      {
        title: 'Broadcasts without collapse',
        problem: 'One event for ten million users is a self-inflicted DDoS.',
        approach: [
          'Fan broadcasts out over minutes with priority lanes for urgent tiers.',
          'Shed marketing before transactional when capacity binds.',
          'Isolate broadcast workers from the transactional send path.',
        ],
        tradeoff: 'Broadcast latency in exchange for transactional alerts that always land.',
      },
    ],
    concepts: ['realtime-updates', 'message-queue', 'event-streams'],
    patterns: ['realtime-updates'],
  },
  {
    id: 'collab-docs',
    title: 'Collaborative Document',
    tagline: 'Edit together live with presence and history',
    difficulty: 'Hard',
    minutes: 45,
    prompt:
      'Design collaborative editing for 10M documents. Multiple editors type simultaneously with live cursors, every keystroke merges without conflicts, and full history replays on demand.',
    checkpoints: [
      {
        question: 'How large do live sessions get?',
        decides: 'Small sessions sync peer-to-peer-ish; huge ones need broadcast tiers.',
      },
      {
        question: 'What merges concurrent keystrokes?',
        decides: 'Operational transforms versus CRDTs changes server responsibilities.',
      },
      {
        question: 'How much history replays?',
        decides: 'Full replay needs compacted snapshots plus deltas, not infinite logs.',
      },
    ],
    functional: [
      'Editors can type simultaneously with live cursors',
      'Concurrent edits merge without data loss',
      'Users can browse and restore version history',
    ],
    nonfunctional: [
      'Keystroke echo under 100ms on good connections',
      'Sessions survive editor disconnects and reconnects',
      'History retained for years with fast restore',
      'No edit lost even during server failover',
    ],
    estimations: [
      'Connections: mostly small sessions, a tail of huge public docs',
      'Ops: keystrokes per editor per second, tiny payloads, strict ordering needs',
      'History: deltas compacted into snapshots on a schedule',
    ],
    entities: [
      { name: 'Document', fields: 'id, snapshot pointer, version vector' },
      { name: 'EditOp', fields: 'doc id, sequence, author, operation payload' },
      { name: 'Presence', fields: 'doc id, user id, cursor, last heartbeat' },
    ],
    api: {
      protocol: 'WebSocket plus REST',
      protocolWhy:
        'Edits, cursors, and presence need bidirectional sockets with ordering. Snapshots, history, and permissions stay REST.',
      endpoints: [
        { method: 'WS', path: '/docs/{id}/session', purpose: 'Edit ops, cursors, presence' },
        { method: 'GET', path: '/docs/{id}', purpose: 'Snapshot plus permissions' },
        { method: 'GET', path: '/docs/{id}/history?cursor=', purpose: 'Version history pages' },
      ],
    },
    hldPresetId: 'discord',
    hldSteps: [
      'Pin each document session to one stateful server for ordering.',
      'Broadcast ops to session holders and persist to the op log.',
      'Derive presence from live connections instead of database writes.',
      'Compact history into snapshots so restores never replay forever.',
    ],
    deepDives: [
      {
        title: 'Ordering concurrent keystrokes',
        problem: 'Two editors typing at once must converge to the same text everywhere.',
        approach: [
          'Serialize ops per document through the session owner.',
          'Transform or merge concurrent ops against the same base.',
          'Acknowledge applied sequence numbers so clients resend gaps only.',
        ],
        tradeoff: 'One ordering bottleneck per document in exchange for convergence.',
      },
      {
        title: 'Session failover without lost edits',
        problem: 'The session owner dying mid-keystroke cannot eat the sentence.',
        approach: [
          'Persist ops before broadcasting so replays rebuild state.',
          'Reassign ownership with fencing so two owners never interleave.',
          'Clients hold unacked ops and resend to the new owner.',
        ],
        tradeoff: 'Persist latency per op in exchange for edits that survive crashes.',
      },
      {
        title: 'Presence that scales past the doc',
        problem: 'Cursor heartbeats for huge sessions drown the edit path.',
        approach: [
          'Send presence on a lower-priority channel than edits.',
          'Throttle cursor updates and interpolate between them.',
          'Summarize viewers beyond a cap instead of tracking each one.',
        ],
        tradeoff: 'Coarser presence in exchange for edits that never wait.',
      },
    ],
    concepts: ['realtime-updates', 'consistency-models', 'coordination'],
    patterns: ['realtime-updates'],
  },
  {
    id: 'chess-live',
    title: 'Live Board Games',
    tagline: 'Match players and relay timed moves fairly',
    difficulty: 'Hard',
    minutes: 40,
    prompt:
      'Design live board-game play for 20M players. Matchmake by skill in seconds, relay moves with chess clocks ticking, and let disconnected players reconnect mid-game.',
    checkpoints: [
      {
        question: 'How tight must matchmaking be?',
        decides: 'Tight bands wait longer; loose bands start fast but bore.',
      },
      {
        question: 'Who owns the clock: client or server?',
        decides: 'Client clocks cheat; server clocks need move-time accounting.',
      },
      {
        question: 'What happens on disconnect mid-game?',
        decides: 'Grace windows plus stateful sessions decide whether games resume.',
      },
    ],
    functional: [
      'Players can queue for skill-matched games',
      'Players exchange moves with running clocks',
      'Disconnected players can reconnect and resume',
    ],
    nonfunctional: [
      'Match found within 10 seconds at p99',
      'Move relay under 100ms at p99',
      'Clocks stay fair across laggy connections',
      'Finished games persist with full move history',
    ],
    estimations: [
      'Sessions: hundreds of thousands concurrent at evening peaks',
      'Moves: small payloads, strict ordering per game, modest total throughput',
      'Matchmaking: queue depth matters more than raw rate',
    ],
    entities: [
      { name: 'Player', fields: 'id, rating, queue entry timestamp, range' },
      { name: 'Game', fields: 'id, players, move list, clocks, session owner' },
      { name: 'Move', fields: 'game id, sequence, SAN, server timestamp' },
    ],
    api: {
      protocol: 'REST for lobby, sockets for play',
      protocolWhy:
        'Queueing and history are REST. Moves and clocks need ordered sockets bound to the game session.',
      endpoints: [
        { method: 'POST', path: '/matchmaking/queue', purpose: 'Join the match queue' },
        { method: 'WS', path: '/games/{id}/play', purpose: 'Moves, clocks, and results' },
        { method: 'GET', path: '/games/{id}', purpose: 'Full game record' },
      ],
    },
    hldPresetId: 'discord',
    hldSteps: [
      'Matchmake from skill buckets with widening ranges over wait time.',
      'Pin each game to a session server that owns clocks and ordering.',
      'Persist moves as they relay so reconnects resume exactly.',
      'Score results back into ratings asynchronously.',
    ],
    deepDives: [
      {
        title: 'Matchmaking that converges',
        problem: 'Top players wait forever while beginners match instantly.',
        approach: [
          'Bucket by rating and widen the acceptable range with wait time.',
          'Prioritize longest-waiting players when ranges overlap.',
          'Split regions only when queues prove they need it.',
        ],
        tradeoff: 'Some uneven games in exchange for queues that always drain.',
      },
      {
        title: 'Fair clocks over lag',
        problem: 'Network delay must never eat a thinking player clock.',
        approach: [
          'Timestamp moves at the server and debit measured transit.',
          'Compensate known latency instead of trusting client clocks.',
          'Flag rather than forfeit on first disconnect, then decide.',
        ],
        tradeoff: 'Server complexity per move in exchange for clocks players trust.',
      },
      {
        title: 'Reconnects without restarts',
        problem: 'A blip mid-endgame cannot mean a loss.',
        approach: [
          'Hold game state on the session owner past disconnect grace windows.',
          'Replay missed moves from the persisted log on return.',
          'Forfeit only after the grace window with both clocks accounting.',
        ],
        tradeoff: 'Held session memory in exchange for games that survive real networks.',
      },
    ],
    concepts: ['realtime-updates', 'consistency-models', 'message-queue'],
    patterns: ['realtime-updates'],
  },
  {
    id: 'ai-chat',
    title: 'Streaming Assistant Chat',
    tagline: 'Stream answers with history, limits, and safety',
    difficulty: 'Hard',
    minutes: 40,
    prompt:
      'Design a conversational assistant for 200M users. Prompts stream token-by-token, conversations keep long histories, and bursts must queue instead of dropping while safety checks run inline.',
    checkpoints: [
      {
        question: 'How long may history grow?',
        decides: 'Bounded windows are cheap; unbounded memory needs summarization.',
      },
      {
        question: 'Stream tokens or answer whole?',
        decides: 'Streaming needs sticky sessions and backpressure; whole answers need patience.',
      },
      {
        question: 'Where do safety checks run?',
        decides: 'Inline checks add latency; async checks let harm through first.',
      },
    ],
    functional: [
      'Users can send prompts and stream completions',
      'Conversations persist history across devices',
      'Bursts queue with positions instead of errors',
    ],
    nonfunctional: [
      'First token under 1s at p99 on warm capacity',
      'Streams stay ordered with no dropped tokens',
      'Safety decisions before tokens reach users',
      'History recall for year-old conversations',
    ],
    estimations: [
      'Sessions: millions concurrent, mostly waiting on tokens',
      'Tokens: the cost unit; output length dominates capacity math',
      'Bursts: launches and outages spike prompts many-fold in minutes',
    ],
    entities: [
      { name: 'Conversation', fields: 'id, user id, model, summary pointer, message count' },
      { name: 'Message', fields: 'id, conversation id, role, token count, safety verdict' },
      { name: 'QueueTicket', fields: 'user id, position, priority tier, expiry' },
    ],
    api: {
      protocol: 'SSE or sockets plus REST',
      protocolWhy:
        'Tokens stream over server push while history, auth, and billing stay REST. Sticky routing keeps streams on their workers.',
      endpoints: [
        { method: 'POST', path: '/conversations', purpose: 'Start a conversation' },
        { method: 'POST', path: '/conversations/{id}/prompts', purpose: 'Prompt and open the token stream' },
        { method: 'GET', path: '/conversations/{id}/history?cursor=', purpose: 'Backfill history' },
      ],
    },
    hldPresetId: 'event-driven',
    hldSteps: [
      'Accept prompts fast and issue queue tickets with visible positions.',
      'Route streams to workers with session affinity and backpressure.',
      'Run safety checks inline on prompts and sampled on completions.',
      'Summarize aging history so context stays bounded and cheap.',
    ],
    deepDives: [
      {
        title: 'Bursts that queue instead of collapse',
        problem: 'Model capacity cannot 10x in a minute when the world shows up.',
        approach: [
          'Queue prompts with priority tiers and visible positions.',
          'Shed lowest-priority tiers first with clear messaging.',
          'Autoscale workers while the queue absorbs the gap.',
        ],
        tradeoff: 'Waiting instead of instant in exchange for nobody erroring out.',
      },
      {
        title: 'Sticky streams without hot workers',
        problem: 'Affinity pins load unevenly while long generations run.',
        approach: [
          'Route by conversation hash with bounded loads per worker.',
          'Migrate idle conversations, never mid-generation ones.',
          'Cap concurrent generations per worker regardless of queue depth.',
        ],
        tradeoff: 'Some imbalance in exchange for streams that never interleave.',
      },
      {
        title: 'History that stays affordable',
        problem: 'Year-old conversations cannot all sit in full context.',
        approach: [
          'Summarize cold turns and keep recent ones verbatim.',
          'Page history from cheap storage instead of holding it resident.',
          'Version summaries so corrections never corrupt the record.',
        ],
        tradeoff: 'Lossy distant memory in exchange for instant recall that scales.',
      },
    ],
    concepts: ['realtime-updates', 'workers-async', 'load-balancer'],
    patterns: ['realtime-updates', 'long-running-tasks'],
  },
  {
    id: 'delivery-dispatch',
    title: 'Courier Delivery Dispatch',
    tagline: 'Match orders to couriers in a living city',
    difficulty: 'Popular',
    minutes: 40,
    prompt:
      'Design on-demand delivery for a metro with 2M daily orders. Assign each order to a nearby courier in seconds, track arrivals live, and reassign gracefully when couriers cancel.',
    checkpoints: [
      {
        question: 'Batch orders or assign one by one?',
        decides: 'Batching improves efficiency but delays the first assignment.',
      },
      {
        question: 'How are ETAs computed and kept fresh?',
        decides: 'Live ETAs need position streams; static ETAs go stale in traffic.',
      },
      {
        question: 'Who pays when a courier cancels mid-route?',
        decides: 'Reassignment speed decides whether food arrives hot or not at all.',
      },
    ],
    functional: [
      'Customers can place orders with live tracking',
      'Couriers receive batched delivery offers',
      'Cancelled legs reassign automatically',
    ],
    nonfunctional: [
      'First assignment within seconds at p99',
      'Tracking updates within seconds of movement',
      'No order stuck unassigned during dinner peaks',
      'Reassignment without customer-visible errors',
    ],
    estimations: [
      'Orders: dinner peaks near 500 assignments a minute per metro',
      'Positions: courier pings outnumber orders by an order of magnitude',
      'Reads: tracking views multiply every active order several fold',
    ],
    entities: [
      { name: 'Order', fields: 'id, pickup, dropoff, items, state, courier id' },
      { name: 'Courier', fields: 'id, position, capacity, active batch' },
      { name: 'Batch', fields: 'id, order ids, route polyline, deadline' },
    ],
    api: {
      protocol: 'REST plus sockets for tracking',
      protocolWhy:
        'Orders and batches are REST state machines. Positions and ETAs stream to customers over sockets.',
      endpoints: [
        { method: 'POST', path: '/orders', purpose: 'Place an order' },
        { method: 'GET', path: '/orders/{id}/tracking', purpose: 'Live position and ETA' },
        { method: 'POST', path: '/batches/{id}/accept', purpose: 'Courier accepts a batch' },
      ],
    },
    hldPresetId: 'uber',
    hldSteps: [
      'Ingest courier positions as a stream separate from order writes.',
      'Match orders to couriers in geo cells with expiring offers.',
      'Batch compatible orders to cut miles without missing deadlines.',
      'Reassign cancelled legs from the pending pool, never from scratch.',
    ],
    deepDives: [
      {
        title: 'Offers that never double-assign',
        problem: 'Two couriers accepting the same order ruins dinner twice.',
        approach: [
          'Lease each offer with a short expiry and single-winner accept.',
          'Serialize accepts per order through one conditional write.',
          'Return expired offers to the pool instead of orphaning them.',
        ],
        tradeoff: 'A serialized write per accept in exchange for exactly one courier.',
      },
      {
        title: 'Batching without lateness',
        problem: 'Clever batches arrive cold when the algorithm overthinks.',
        approach: [
          'Constrain batches by detour minutes, not by count.',
          'Dispatch the first assignment fast, then improve the route.',
          'Break batches apart the moment a deadline risks slipping.',
        ],
        tradeoff: 'Slightly more miles in exchange for food that arrives hot.',
      },
      {
        title: 'Dinner peaks without stuck orders',
        problem: 'Demand 5x in an hour while courier supply lags behind.',
        approach: [
          'Queue unassigned orders visibly with honest ETAs.',
          'Surge incentives geographically instead of globally.',
          'Shed the lowest-priority promos before real orders wait.',
        ],
        tradeoff: 'Longer quoted waits in exchange for zero stuck orders.',
      },
    ],
    concepts: ['scaling-writes', 'proximity-search', 'multistep-sagas'],
    patterns: ['scaling-writes', 'multistep-sagas'],
  },
];
