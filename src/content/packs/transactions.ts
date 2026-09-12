import type { InterviewPack } from '../interviewPacks';

/** Transaction packs: contention, money movement, and single-winner decisions. */
export const TRANSACTION_PACKS: readonly InterviewPack[] = [
  {
    id: 'seat-hold',
    title: 'Seat Hold and Checkout',
    tagline: 'Sell out a stadium without double-booking a seat',
    difficulty: 'Popular',
    minutes: 45,
    prompt:
      'Design ticket sales for events with 100k seats and millions of buyers at on-sale. Browse and search stay fast, holds expire fairly, and checkout never sells one seat twice.',
    checkpoints: [
      {
        question: 'How long does a hold last?',
        decides: 'Minutes-long holds need expiry machinery; seconds-long holds need speed.',
      },
      {
        question: 'Queue at the door or let everyone rush the seats?',
        decides: 'A waiting room protects checkout; open rushing melts it.',
      },
      {
        question: 'What does search run on during the rush?',
        decides: 'Live seat queries against transactional rows will not survive on-sale.',
      },
    ],
    functional: [
      'Users can browse and search events and seats',
      'Users can hold seats for a bounded time',
      'Users can check out held seats exactly once',
    ],
    nonfunctional: [
      'No seat sold twice under any concurrency',
      'Browse stays fast during on-sale stampedes',
      'Holds always expire, even when clients vanish',
      'Checkout completes or fails cleanly, never half-applies',
    ],
    estimations: [
      'Reads: browse and search at millions of rps during hot on-sales',
      'Writes: holds and checkouts at tens of thousands a second, serialized per seat',
      'State: seat maps per event, small rows with ferocious contention',
    ],
    entities: [
      { name: 'Event', fields: 'id, venue map, sale window, waiting room config' },
      { name: 'SeatHold', fields: 'seat id, holder, expires at, checkout token' },
      { name: 'Order', fields: 'id, seat ids, payment reference, state' },
    ],
    api: {
      protocol: 'REST plus pushed seat updates',
      protocolWhy:
        'Browse, hold, and checkout are REST state transitions. Seat maps push updates so buyers see reality instead of polling it.',
      endpoints: [
        { method: 'GET', path: '/events?query=', purpose: 'Search events' },
        { method: 'GET', path: '/events/{id}/seats', purpose: 'Seat map snapshot' },
        { method: 'POST', path: '/events/{id}/holds', purpose: 'Hold seats with expiry' },
        { method: 'POST', path: '/orders', purpose: 'Check out held seats' },
      ],
    },
    hldPresetId: 'ticketmaster',
    hldSteps: [
      'Serve browse and search from cache and a search index, never the booking rows.',
      'Meter arrivals through a waiting room during hot on-sales.',
      'Hold seats with expiring leases instead of long database locks.',
      'Convert holds to orders through one serialized, idempotent checkout.',
    ],
    deepDives: [
      {
        title: 'Holds that always expire',
        problem: 'Crashed clients must not own seats forever, and lock tables must not jam.',
        approach: [
          'Write holds with expiries and treat expiry as implicit release.',
          'Sweep with idempotent workers instead of holding open transactions.',
          'Serialize per-seat transitions so two holders cannot both win.',
        ],
        tradeoff: 'Sweeper and lease complexity in exchange for seats that always free up.',
      },
      {
        title: 'Browse that survives on-sale',
        problem: 'Millions refreshing seat maps will flatten any transactional store.',
        approach: [
          'Snapshot seat maps to cache on a short timer.',
          'Push deltas to viewers instead of serving polls.',
          'Isolate search onto its own index and fleet.',
        ],
        tradeoff: 'Seconds of map staleness in exchange for browsing that never dies.',
      },
      {
        title: 'Checkout that never double-sells',
        problem: 'Two checkouts racing for one held seat must produce one order.',
        approach: [
          'Consume the hold token exactly once with a conditional write.',
          'Key payment retries so duplicates collapse into the first charge.',
          'Compensate paid-but-unconfirmed orders instead of leaving them hanging.',
        ],
        tradeoff: 'Serialized checkout writes in exchange for zero double-sales.',
      },
    ],
    concepts: ['contention-control', 'distributed-lock', 'scaling-reads'],
    patterns: ['contention-control', 'scaling-reads'],
  },
  {
    id: 'auction-room',
    title: 'Online Auction and Bids',
    tagline: 'Close with one winner when everyone bids at once',
    difficulty: 'Popular',
    minutes: 40,
    prompt:
      'Design auctions for 10M bidders. Bids stream in until the hammer, closing-second rushes decide winners, and every loser learns instantly with no phantom wins.',
    checkpoints: [
      {
        question: 'Hard close or anti-snipe extension?',
        decides: 'Extensions change the ending into a negotiation; hard closes need tie rules.',
      },
      {
        question: 'What decides bid order at the same price?',
        decides: 'Timestamp, sequence, or proxy limits must be stated before the rush.',
      },
      {
        question: 'Do losers need instant notices?',
        decides: 'Instant fan-out costs more than results pages polled after close.',
      },
    ],
    functional: [
      'Sellers can list items with rules and reserves',
      'Bidders can place bids until the close',
      'Everyone learns the outcome with an auditable trail',
    ],
    nonfunctional: [
      'Exactly one winner per auction, provably',
      'Bids accepted at 50x baseline in the final minute',
      'Outbid notices within seconds during the close',
      'Full bid history retained for disputes',
    ],
    estimations: [
      'Writes: closing rushes near 20k bids a second per hot auction',
      'Reads: watchers multiply every bid several fold',
      'History: bid rows small, retained for years for disputes',
    ],
    entities: [
      { name: 'Auction', fields: 'id, rules, close policy, reserve, state' },
      { name: 'Bid', fields: 'auction id, bidder, amount, sequence, timestamp' },
      { name: 'Outcome', fields: 'auction id, winner, price, audit trail pointer' },
    ],
    api: {
      protocol: 'REST plus sockets for the close',
      protocolWhy:
        'Listing and bidding are REST writes. The closing rush streams prices and outbid notices over sockets.',
      endpoints: [
        { method: 'POST', path: '/auctions', purpose: 'List an item' },
        { method: 'POST', path: '/auctions/{id}/bids', purpose: 'Place a bid' },
        { method: 'WS', path: '/auctions/{id}/stream', purpose: 'Price and outbid pushes' },
      ],
    },
    hldPresetId: 'auction',
    hldSteps: [
      'Accept bids fast with per-auction sequencing behind a queue.',
      'Serialize the winning decision through one conditional close.',
      'Fan outbid notices to watchers while the winner confirms.',
      'Persist the full bid trail for disputes and audits.',
    ],
    deepDives: [
      {
        title: 'The closing-second serialization',
        problem: 'Thousands of bids in the final seconds must order deterministically.',
        approach: [
          'Sequence bids per auction at accept time.',
          'Decide the winner from the sequence, never from arrival order at readers.',
          'Extend or hard-close by stated policy, applied once from the sequence.',
        ],
        tradeoff: 'One serialized decision path in exchange for winners nobody disputes.',
      },
      {
        title: 'Outbid storms without collapse',
        problem: 'Every bid notifying every watcher multiplies the rush beyond capacity.',
        approach: [
          'Batch outbid notices per watcher instead of per bid.',
          'Prioritize the current high bidder and close watchers.',
          'Degrade to results pages when fan-out saturates.',
        ],
        tradeoff: 'Some delayed notices in exchange for bidding that never errors.',
      },
      {
        title: 'Shill bids and reserves',
        problem: 'Fake bids inflate prices while hidden reserves confuse bidders.',
        approach: [
          'Throttle linked accounts and flag circular bidding for review.',
          'Disclose reserve behavior in the rules, not in surprises.',
          'Void tainted auctions with full bid refunds, not silent edits.',
        ],
        tradeoff: 'Review overhead in exchange for auctions sellers and buyers trust.',
      },
    ],
    concepts: ['contention-control', 'distributed-lock', 'realtime-updates'],
    patterns: ['contention-control', 'realtime-updates'],
  },
  {
    id: 'flash-sale',
    title: 'Flash Inventory Drop',
    tagline: 'Sell fixed stock to a synchronized crowd fairly',
    difficulty: 'Hard',
    minutes: 45,
    prompt:
      'Design a flash sale: 50k units, 5M shoppers arriving in one minute. Admit fairly, decrement exactly, and keep checkout fast while the crowd gets honest wait times.',
    checkpoints: [
      {
        question: 'First-come or lottery admission?',
        decides: 'Queues feel fair but wait; lotteries feel random but finish fast.',
      },
      {
        question: 'What happens when stock hits zero mid-checkout?',
        decides: 'Oversell prevention decides where inventory serializes.',
      },
      {
        question: 'Do browsers get live stock counts?',
        decides: 'Live counts invite stampedes; coarse signals calm them.',
      },
    ],
    functional: [
      'Shoppers can join the sale and see queue position',
      'Shoppers can claim units while stock lasts',
      'Shoppers check out claimed units exactly once',
    ],
    nonfunctional: [
      'Zero oversell under any concurrency',
      'Checkout latency flat while the crowd waits',
      'Honest positions and ETAs for everyone queued',
      'Sold-out declared cleanly with no hanging claims',
    ],
    estimations: [
      'Arrivals: 5M in a minute, nearly all read-only queue watchers',
      'Claims: 50k units serialize through one decrement path',
      'Checkouts: a fraction of claims, each idempotent',
    ],
    entities: [
      { name: 'Drop', fields: 'id, stock, sale window, admission policy' },
      { name: 'Claim', fields: 'drop id, shopper, units, expires at' },
      { name: 'QueueTicket', fields: 'shopper id, position, admitted flag' },
    ],
    api: {
      protocol: 'REST plus queue position pushes',
      protocolWhy:
        'Claims and checkout are REST state transitions. Positions stream so millions are not polling.',
      endpoints: [
        { method: 'POST', path: '/drops/{id}/join', purpose: 'Take a queue ticket' },
        { method: 'POST', path: '/drops/{id}/claim', purpose: 'Claim units while stock lasts' },
        { method: 'POST', path: '/orders', purpose: 'Check out a claim' },
      ],
    },
    hldPresetId: 'resilient-delivery',
    hldSteps: [
      'Admit the crowd through tickets with visible positions.',
      'Serialize stock decrements through one atomic counter path.',
      'Expire unclaimed units back into stock automatically.',
      'Shed browsing extras first so checkout never queues.',
    ],
    deepDives: [
      {
        title: 'Decrementing without oversell',
        problem: 'Fifty thousand units and millions of claimants must end at exactly zero.',
        approach: [
          'Decrement atomically and fail claims past zero fast.',
          'Hold claimed units with expiries that recycle automatically.',
          'Reconcile the counter against order rows after the sale.',
        ],
        tradeoff: 'One serialized counter in exchange for stock math that always balances.',
      },
      {
        title: 'Admission that feels fair',
        problem: 'Everyone arriving in one minute cannot all check out at once.',
        approach: [
          'Randomize entry order into the queue to defeat refresh bots.',
          'Admit at the rate checkout sustains, with honest ETAs.',
          'Separate bots and resellers with challenge tiers before admission.',
        ],
        tradeoff: 'Waiting for most shoppers in exchange for checkout that works.',
      },
      {
        title: 'Live stock without stampedes',
        problem: 'Exact remaining counts trigger refresh avalanches.',
        approach: [
          'Publish coarse bands like plenty, low, and sold out.',
          'Push band changes instead of serving count polls.',
          'Cache bands at the edge with second-level freshness.',
        ],
        tradeoff: 'Imprecise counts in exchange for a crowd that stays calm.',
      },
    ],
    concepts: ['contention-control', 'load-balancer', 'message-queue'],
    patterns: ['contention-control'],
  },
  {
    id: 'payments-ledger',
    title: 'Money Movement and Ledger',
    tagline: 'Move money once, explain it forever',
    difficulty: 'Hard',
    minutes: 45,
    prompt:
      'Design payments for a marketplace moving $100M daily. Authorize, capture, refund, and payout across providers while the ledger stays the source of truth and retries never double-charge.',
    checkpoints: [
      {
        question: 'Who owns truth: our ledger or the provider?',
        decides: 'Reconciliation direction decides dispute outcomes.',
      },
      {
        question: 'Synchronous authorize or async settlement?',
        decides: 'Sync authorizes feel instant; async settlement absorbs provider pain.',
      },
      {
        question: 'How do refunds and payouts order?',
        decides: 'Money-out paths need stricter serialization than money-in.',
      },
    ],
    functional: [
      'Buyers can pay with authorize then capture',
      'Merchants can refund and receive payouts',
      'Every movement reconciles against provider records',
    ],
    nonfunctional: [
      'No double charge under retries, ever',
      'Ledger balances exactly, provably, at all times',
      'Provider outages degrade to queued settlement, not lost money',
      'Full audit trail retained for years',
    ],
    estimations: [
      'Throughput: thousands of authorizations a second at peaks',
      'Ledger rows: every movement doubled as debit and credit, retained for years',
      'Webhooks: provider callbacks at a fraction of payment volume',
    ],
    entities: [
      { name: 'Payment', fields: 'id, idempotency key, amount, state, provider reference' },
      { name: 'LedgerEntry', fields: 'payment id, debit account, credit account, amount' },
      { name: 'Payout', fields: 'merchant id, period, amount, state' },
    ],
    api: {
      protocol: 'REST with idempotency keys',
      protocolWhy:
        'Money moves over REST with caller-supplied idempotency keys on every mutating call. Status arrives as signed webhooks.',
      endpoints: [
        { method: 'POST', path: '/payments', purpose: 'Authorize with idempotency key' },
        { method: 'POST', path: '/payments/{id}/capture', purpose: 'Capture an authorization' },
        { method: 'POST', path: '/payments/{id}/refunds', purpose: 'Refund a capture' },
        { method: 'POST', path: '/payouts', purpose: 'Pay merchants out' },
      ],
    },
    hldPresetId: 'stripe',
    hldSteps: [
      'Key every mutation idempotently and answer repeats from stored results.',
      'Append double-entry ledger rows for every movement.',
      'Settle with providers asynchronously through queued webhooks.',
      'Reconcile continuously and quarantine mismatches for humans.',
    ],
    deepDives: [
      {
        title: 'Retries that never double-charge',
        problem: 'Timeouts leave charges unknown, and blind retries bill twice.',
        approach: [
          'Require idempotency keys and persist results before responding.',
          'Confirm provider state before re-attempting anything.',
          'Make capture and refund conditional on exact prior states.',
        ],
        tradeoff: 'Key storage and state checks per call in exchange for single charging.',
      },
      {
        title: 'Provider outages without lost money',
        problem: 'Card networks brown out precisely when volume peaks.',
        approach: [
          'Queue settlement work behind breakers that fail fast.',
          'Hold authorizations while providers recover instead of declining blindly.',
          'Degrade dashboards first and money paths last.',
        ],
        tradeoff: 'Delayed settlement in exchange for money that never vanishes.',
      },
      {
        title: 'Reconciliation that humans trust',
        problem: 'Our books and provider books drift in ways nobody notices until audits.',
        approach: [
          'Match every provider record against ledger rows continuously.',
          'Quarantine mismatches with full context instead of auto-fixing.',
          'Publish balance proofs on a schedule, not just at year end.',
        ],
        tradeoff: 'Ongoing reconciliation work in exchange for audits that pass quietly.',
      },
    ],
    concepts: ['multistep-sagas', 'contention-control', 'consistency-models'],
    patterns: ['multistep-sagas', 'contention-control'],
  },
  {
    id: 'trading-quotes',
    title: 'Quotes and Order Execution',
    tagline: 'Stream prices to millions, execute orders exactly',
    difficulty: 'Hard',
    minutes: 45,
    prompt:
      'Design retail stock trading for 5M investors. Quotes stream in real time, orders execute against live prices with strict ordering, and the ledger never shows a phantom fill.',
    checkpoints: [
      {
        question: 'How fresh must a quote be to trade on?',
        decides: 'Stale-quote trading creates disputes; over-fresh quotes cost a fortune.',
      },
      {
        question: 'Market, limit, or both order types?',
        decides: 'Each type adds matching and expiry semantics to get right.',
      },
      {
        question: 'What happens when markets close mid-order?',
        decides: 'Session boundaries need explicit order lifecycle rules.',
      },
    ],
    functional: [
      'Investors can stream live quotes for watchlists',
      'Investors can place market and limit orders',
      'Portfolios reflect fills with exact average prices',
    ],
    nonfunctional: [
      'Quotes under a second old at p99 during volatility',
      'Orders execute in strict received sequence per account',
      'No phantom fills: every fill maps to a real execution',
      'Market data fan-out isolated from order execution',
    ],
    estimations: [
      'Fan-out: quotes to millions of watchers, tiny messages, huge multiplication',
      'Orders: thousands a second, each serialized per account',
      'History: ticks retained for charts, rolled up with age',
    ],
    entities: [
      { name: 'Quote', fields: 'symbol, bid, ask, sequence, timestamp' },
      { name: 'Order', fields: 'id, account, symbol, type, limit, state' },
      { name: 'Fill', fields: 'order id, quantity, price, execution id' },
    ],
    api: {
      protocol: 'Sockets for quotes, REST for orders',
      protocolWhy:
        'Quotes push over sockets to millions. Orders are REST writes with strict per-account sequencing and idempotency.',
      endpoints: [
        { method: 'WS', path: '/quotes/stream', purpose: 'Watched symbol ticks' },
        { method: 'POST', path: '/orders', purpose: 'Place an order' },
        { method: 'DELETE', path: '/orders/{id}', purpose: 'Cancel a working order' },
      ],
    },
    hldPresetId: 'event-driven',
    hldSteps: [
      'Fan quotes out through push tiers fed by the market data stream.',
      'Serialize orders per account through one execution path.',
      'Confirm fills from execution reports, never from optimistic math.',
      'Isolate quote fan-out failures from the order ledger completely.',
    ],
    deepDives: [
      {
        title: 'Quotes that survive volatility',
        problem: 'Market opens multiply quote rates beyond steady-state capacity.',
        approach: [
          'Conflate ticks per symbol when subscribers cannot keep up.',
          'Prioritize watched symbols over full-universe streams.',
          'Shed depth detail before touching top-of-book freshness.',
        ],
        tradeoff: 'Coarser quotes under stress in exchange for streams that never die.',
      },
      {
        title: 'Order sequencing per account',
        problem: 'Cancel racing an execution must resolve to exactly one outcome.',
        approach: [
          'Sequence every account action through one ordered log.',
          'Apply cancels against the same sequence the execution reads.',
          'Report the single resolved outcome with its execution id.',
        ],
        tradeoff: 'Per-account serialization in exchange for outcomes nobody disputes.',
      },
      {
        title: 'Ledger fills without phantoms',
        problem: 'Optimistic fills shown then revoked destroy trust instantly.',
        approach: [
          'Show fills only from confirmed execution reports.',
          'Reconcile positions against executions continuously.',
          'Quarantine breaks for humans instead of auto-adjusting balances.',
        ],
        tradeoff: 'Slightly slower fill display in exchange for balances that never lie.',
      },
    ],
    concepts: ['realtime-updates', 'contention-control', 'event-streams'],
    patterns: ['realtime-updates', 'contention-control'],
  },
  {
    id: 'ride-dispatch',
    title: 'Ride Dispatch and Fare',
    tagline: 'Match riders to drivers before patience runs out',
    difficulty: 'Hard',
    minutes: 45,
    prompt:
      'Design ride-hailing for a metro with 1M daily trips. Estimate fares instantly, match each rider to a nearby driver once, and track trips live while driver positions flood in.',
    checkpoints: [
      {
        question: 'How do matches form: nearest, fastest pickup, or batched?',
        decides: 'Batched matching is efficient; instant matching feels responsive.',
      },
      {
        question: 'What happens when the driver cancels?',
        decides: 'Rematch speed decides whether riders wait or leave.',
      },
      {
        question: 'Surge: who sees it and how is it computed?',
        decides: 'Zone-level surge needs demand sensing without runaway feedback.',
      },
    ],
    functional: [
      'Riders can get fare estimates for a route',
      'Riders can request rides matched to nearby drivers',
      'Trips track live from pickup to dropoff',
    ],
    nonfunctional: [
      'Matches within seconds at p99, even at rush hour',
      'One driver per request: no double dispatch, ever',
      'Driver positions fresh enough to match on',
      'Payments isolated from dispatch failures',
    ],
    estimations: [
      'Positions: driver pings outnumber ride requests by an order of magnitude',
      'Matches: rush peaks near hundreds a minute per metro',
      'Reads: fare estimates and tracking multiply every trip several fold',
    ],
    entities: [
      { name: 'Driver', fields: 'id, position, status, vehicle, rating' },
      { name: 'RideRequest', fields: 'id, rider, pickup, dropoff, fare quote, state' },
      { name: 'Trip', fields: 'request id, driver id, route, fare final, payment reference' },
    ],
    api: {
      protocol: 'REST plus position streams',
      protocolWhy:
        'Estimates, requests, and trips are REST state machines. Positions arrive as streams and ETAs push to riders.',
      endpoints: [
        { method: 'POST', path: '/fare-estimates', purpose: 'Quote a route' },
        { method: 'POST', path: '/ride-requests', purpose: 'Request a ride' },
        { method: 'GET', path: '/trips/{id}/tracking', purpose: 'Live trip position' },
      ],
    },
    hldPresetId: 'uber',
    hldSteps: [
      'Stream driver positions into geo cells separate from request writes.',
      'Match requests to drivers with expiring single-winner offers.',
      'Track trips from the matched driver stream with rider-visible ETAs.',
      'Isolate payments behind breakers so dispatch failures never double-charge.',
    ],
    deepDives: [
      {
        title: 'Position freshness against cost',
        problem: 'Every ping indexed in real time bankrupts the geo tier.',
        approach: [
          'Batch positions and index at bounded freshness, not per ping.',
          'Match on cells, then refine with the freshest points.',
          'Adapt ping rates to speed: parked drivers whisper, moving ones report.',
        ],
        tradeoff: 'Seconds of position age in exchange for a geo tier that survives rush hour.',
      },
      {
        title: 'Single dispatch under races',
        problem: 'Two requests offering the same driver must yield one trip.',
        approach: [
          'Lease driver availability with short expiries per offer.',
          'Accept through one conditional write that exactly one request wins.',
          'Return expired drivers to the pool instead of stranding them.',
        ],
        tradeoff: 'Serialized accepts in exchange for drivers who never double-book.',
      },
      {
        title: 'Rush hour without rider exodus',
        problem: 'Demand 4x with fixed supply means waits or surge, never magic.',
        approach: [
          'Queue visibly with honest ETAs instead of spinning.',
          'Price by zone to pull supply where demand concentrates.',
          'Protect matching latency by shedding estimate precision first.',
        ],
        tradeoff: 'Higher prices and waits in exchange for a marketplace that clears.',
      },
    ],
    concepts: ['scaling-writes', 'proximity-search', 'contention-control'],
    patterns: ['scaling-writes', 'contention-control'],
  },
  {
    id: 'donations',
    title: 'Campaign Donations at Viral Scale',
    tagline: 'Take a viral spike without losing a gift',
    difficulty: 'Hard',
    minutes: 40,
    prompt:
      'Design donation pages for disaster relief that spike 100x when news breaks. Accept every gift safely, show live totals donors trust, and pay out to organizers with full accounting.',
    checkpoints: [
      {
        question: 'How live must the totals be?',
        decides: 'Second-fresh totals need streaming counters; minute-fresh allows batches.',
      },
      {
        question: 'One-time gifts, recurring, or both?',
        decides: 'Recurring adds schedules, retries, and dunning to the money path.',
      },
      {
        question: 'What happens when payments fail mid-spike?',
        decides: 'Queued retries versus instant errors decides donor experience under stress.',
      },
    ],
    functional: [
      'Donors can give one-time and recurring gifts',
      'Campaigns show live totals and recent gifts',
      'Organizers receive payouts with full statements',
    ],
    nonfunctional: [
      'No gift lost or double-charged under 100x spikes',
      'Totals fresh within seconds during viral moments',
      'Fraud screened without blocking genuine disaster giving',
      'Every cent accounted from gift to payout',
    ],
    estimations: [
      'Spikes: 100x baseline for hours, nearly all first-time donors',
      'Totals: counters updated per gift, read by every visitor',
      'Payouts: batched per organizer with statements, not per gift',
    ],
    entities: [
      { name: 'Campaign', fields: 'id, organizer, goal, total counters, state' },
      { name: 'Gift', fields: 'id, idempotency key, amount, donor, state' },
      { name: 'Payout', fields: 'organizer id, period, amount, statement pointer' },
    ],
    api: {
      protocol: 'REST with idempotency keys',
      protocolWhy:
        'Gifts are money writes keyed idempotently. Totals are reads served from counters, never summed live.',
      endpoints: [
        { method: 'POST', path: '/campaigns/{id}/gifts', purpose: 'Give with idempotency key' },
        { method: 'GET', path: '/campaigns/{id}', purpose: 'Live totals and recent gifts' },
        { method: 'POST', path: '/campaigns/{id}/payouts', purpose: 'Pay organizers out' },
      ],
    },
    hldPresetId: 'stripe',
    hldSteps: [
      'Key every gift idempotently and answer repeats from stored results.',
      'Count totals in streaming counters served from cache.',
      'Queue settlement behind breakers so provider pain never loses gifts.',
      'Batch payouts with statements organizers can audit.',
    ],
    deepDives: [
      {
        title: 'Totals that survive virality',
        problem: 'Summing millions of gifts per page view collapses instantly.',
        approach: [
          'Increment counters per gift and serve totals from cache.',
          'Shard counters by campaign when one fundraiser dominates.',
          'Reconcile counters against gift rows continuously.',
        ],
        tradeoff: 'Seconds of total staleness in exchange for pages that never fall over.',
      },
      {
        title: 'Fraud screening without blocking generosity',
        problem: 'Stolen cards test on disaster pages within minutes of launch.',
        approach: [
          'Score risk asynchronously and hold payouts, not gifts.',
          'Throttle velocity per instrument instead of blocking campaigns.',
          'Refund confirmed fraud with full donor communication.',
        ],
        tradeoff: 'Some fraud losses in exchange for genuine donors never turned away.',
      },
      {
        title: 'Payouts donors can audit',
        problem: 'Money in is visible; money out must be equally transparent.',
        approach: [
          'Batch payouts on a schedule with per-gift statements.',
          'Hold reserves for refunds and chargebacks explicitly.',
          'Publish fee breakdowns instead of burying them.',
        ],
        tradeoff: 'Slower organizer access in exchange for trust that compounds.',
      },
    ],
    concepts: ['multistep-sagas', 'scaling-writes', 'sketch-structures'],
    patterns: ['multistep-sagas', 'scaling-writes'],
  },
];
