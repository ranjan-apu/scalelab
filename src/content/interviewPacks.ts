/**
 * Interview practice packs.
 *
 * Each pack is a guided system design interview session that follows the
 * track interviewers expect: scope the problem, pin down functional and
 * non-functional requirements, name the core entities, fix the API contract,
 * build the high level design on the canvas, then harden it in deep dives.
 *
 * Content is original to ScaleLab Studio. The section flow mirrors how real
 * interviews run (requirements first, API before boxes, depth last) without
 * lifting text from any prep site.
 *
 * A pack never carries its own topology. `hldPresetId` points at a simulation
 * preset that loads as the working starter, so practice always ends on a
 * system the reader can actually run load against. Structural tests in
 * interviewPacks.test.ts keep every reference honest.
 *
 * The three original packs live in this file. The full library lives in
 * ./packs/* and is aggregated below, so App.tsx keeps importing one symbol.
 */
import { CORE_PACKS } from './packs/core';
import { SOCIAL_PACKS } from './packs/social';
import { REALTIME_PACKS } from './packs/realtime';
import { TRANSACTION_PACKS } from './packs/transactions';
import { MEDIA_INFRA_PACKS } from './packs/media-infra';

export interface PackCheckpoint {
  /** A scoping question to ask before designing anything. */
  question: string;
  /** What the answer decides. */
  decides: string;
}

export interface PackEntity {
  name: string;
  /** The fields that actually shape the design, not the obvious ones. */
  fields: string;
}

export interface PackEndpoint {
  method: string;
  path: string;
  purpose: string;
}

export interface PackApi {
  protocol: string;
  protocolWhy: string;
  endpoints: PackEndpoint[];
}

export interface PackDeepDive {
  title: string;
  problem: string;
  approach: string[];
  tradeoff: string;
}

export interface InterviewPack {
  id: string;
  title: string;
  tagline: string;
  difficulty: 'Core' | 'Popular' | 'Hard';
  /** Concept lesson ids introduced by this pack (see concepts.ts). */
  concepts?: string[];
  /** Pattern ids exercised by this pack (see concepts.ts pattern track). */
  patterns?: string[];
  /** Minutes a real interview gives this problem. */
  minutes: number;
  prompt: string;
  checkpoints: PackCheckpoint[];
  functional: string[];
  nonfunctional: string[];
  estimations: string[];
  entities: PackEntity[];
  api: PackApi;
  /** Optional numbered flow, for systems that are really pipelines. */
  dataFlow?: string[];
  /** Simulation preset id loaded as the HLD starter. */
  hldPresetId: string;
  /** Build-up order: endpoint by endpoint, simplest working cut first. */
  hldSteps: string[];
  deepDives: PackDeepDive[];
}

const FOUNDING_PACKS: readonly InterviewPack[] = [
  {
    id: 'timeline',
    title: 'Timeline Feed',
    tagline: 'Design the home timeline of a microblogging app',
    difficulty: 'Popular',
    minutes: 45,
    prompt:
      'Design the home timeline of a microblogging app with 200M daily users. Users post short messages, follow other users, and open the app to a ranked feed of posts from people they follow.',
    checkpoints: [
      {
        question: 'Is the feed pull or push? Does a post appear instantly?',
        decides: 'Whether you need fan-out machinery or a simple read path.',
      },
      {
        question: 'Do we rank the timeline or show it newest first?',
        decides: 'Ranking needs a scoring service; newest first is a merge of sorted lists.',
      },
      {
        question: 'Do celebrities with 100M followers behave like normal users?',
        decides: 'This is the classic hot key. Your answer shapes the whole fan-out design.',
      },
    ],
    functional: [
      'Users can publish a short post',
      'Users can follow and unfollow other users',
      'Users can read their home timeline, paged',
    ],
    nonfunctional: [
      'Highly available: a missed post beats an error page, so favor availability over strong consistency',
      'Timeline reads under 200ms at p99',
      'Scales to 200M daily users with a 100 to 1 read to write ratio',
      'New posts visible within seconds, not instantly',
    ],
    estimations: [
      'Reads: 200M users x 20 opens a day / 100k seconds, about 40k rps average, 120k at peak',
      'Writes: read to write ratio of 100 to 1 puts posts near 1k rps at peak',
      'Storage: 1k posts a second x 1KB, about 90GB a day before media',
    ],
    entities: [
      { name: 'User', fields: 'id, follower count bucket (normal vs celebrity)' },
      { name: 'Post', fields: 'id, author id, timestamp, text reference' },
      { name: 'Follow', fields: 'follower id, followee id, created at' },
    ],
    api: {
      protocol: 'REST',
      protocolWhy:
        'CRUD over stable resources with diverse clients. The current user comes from the auth token, never from the request body.',
      endpoints: [
        { method: 'POST', path: '/posts', purpose: 'Publish a post' },
        { method: 'POST', path: '/follows', purpose: 'Follow a user' },
        { method: 'DELETE', path: '/follows/{userId}', purpose: 'Unfollow a user' },
        { method: 'GET', path: '/timeline?cursor=', purpose: 'Paged home timeline' },
      ],
    },
    concepts: ['scaling-reads', 'caching', 'consistent-hashing'],
    patterns: ['scaling-reads'],
    hldPresetId: 'twitter',
    hldSteps: [
      'Client to service to primary database: the simplest cut that can publish and read.',
      'Add the write path first: POST /posts persists the post and returns.',
      'Add the read path: GET /timeline merges the followees recent posts, newest first.',
      'Note the hot spots for later: the merge on read, and the celebrity write that fans out to millions.',
    ],
    deepDives: [
      {
        title: 'Fan-out on write vs fan-out on read',
        problem: 'Merging hundreds of followees on every read is too slow at 100k rps.',
        approach: [
          'Precompute each timeline on write: a post lands in every follower timeline cache.',
          'Reads become a single cache lookup, which is what makes p99 possible.',
          'Keep celebrities on the read path: their posts merge at read time so one post never writes 100M cache entries.',
        ],
        tradeoff: 'Write amplification and stale reads for normal users, in exchange for fast reads. Celebrities pay read cost instead.',
      },
      {
        title: 'Timeline cache sizing and eviction',
        problem: 'Precomputed timelines for 200M users do not fit anywhere cheap.',
        approach: [
          'Cap stored timelines to the most recent few hundred posts per user.',
          'Evict least recently active users first; rebuild on next open.',
          'Shard the cache by user id so growth means more shards, not bigger ones.',
        ],
        tradeoff: 'Cold opens cost a rebuild. Cap length against memory with the p99 budget as the judge.',
      },
      {
        title: 'Ordering without strong consistency',
        problem: 'Two replicas can disagree about which post is newest.',
        approach: [
          'Order by post id with the timestamp embedded, and accept seconds of skew.',
          'Cursor pagination over (timestamp, id) keeps pages stable across reads.',
        ],
        tradeoff: 'No global order guarantee. Users cannot tell, and availability stays up during partitions.',
      },
    ],
  },
  {
    id: 'url-shortener',
    title: 'URL Shortener',
    tagline: 'Design a link shortener with click analytics',
    difficulty: 'Core',
    minutes: 35,
    prompt:
      'Design a URL shortener. Users paste a long link and get a short one back. Opening the short link redirects to the original. The system also reports how many times each link was opened.',
    checkpoints: [
      {
        question: 'How long must a short link live? Can it expire?',
        decides: 'Expiry adds deletion and reclamation; forever means storage grows without bound.',
      },
      {
        question: 'Do we need per-click analytics or only totals?',
        decides: 'Per-click rows are a write firehose; totals can be counters.',
      },
      {
        question: 'Can two users shorten the same URL to different codes?',
        decides: 'Deduplication saves space but couples unrelated users to one row.',
      },
    ],
    functional: [
      'Users can shorten a long URL into a short code',
      'Opening a short code redirects to the original URL',
      'Users can see open counts for their links',
    ],
    nonfunctional: [
      'Redirects under 50ms at p99: this path is latency critical',
      'Read heavy at roughly 100 to 1: shortening is rare, opening is constant',
      'Highly available reads; short writes can retry safely if idempotent',
      'Links persist for years, analytics may be approximate',
    ],
    estimations: [
      'Writes: 10M new links a day, about 120 rps average',
      'Reads: 100 to 1 ratio puts opens near 12k rps average, 35k at peak',
      'Storage: 10M rows a day x 500 bytes, about 5GB a day before analytics',
    ],
    entities: [
      { name: 'Link', fields: 'code (primary key), original url, owner, created at, expiry' },
      { name: 'ClickStat', fields: 'code, day bucket, open count' },
    ],
    api: {
      protocol: 'REST',
      protocolWhy:
        'Two resources and two verbs. Shortening is a create, opening is a read that answers with a redirect, not a body.',
      endpoints: [
        { method: 'POST', path: '/links', purpose: 'Shorten a URL, returns the code' },
        { method: 'GET', path: '/{code}', purpose: 'Redirect to the original URL' },
        { method: 'GET', path: '/links/{code}/stats', purpose: 'Open counts for a link' },
      ],
    },
    concepts: ['caching', 'scaling-reads', 'capacity-numbers'],
    patterns: ['scaling-reads'],
    hldPresetId: 'cache-aside',
    hldSteps: [
      'Client to service to primary database: shorten writes a row, open reads it back.',
      'Put the cache in front of the read path: hot links should never reach the database.',
      'Move stats off the redirect path: count opens asynchronously so analytics can never slow a redirect.',
    ],
    deepDives: [
      {
        title: 'Generating codes without collisions',
        problem: 'Random codes collide; counters need coordination across instances.',
        approach: [
          'Encode an auto increment id in base 62: short, ordered, collision free by construction.',
          'Give each writer a block of ids so no single counter is a bottleneck.',
          'Hash based codes need a uniqueness check and a retry loop under contention.',
        ],
        tradeoff: 'Block allocation wastes some ids on uneven writers, in exchange for no coordination per write.',
      },
      {
        title: 'Cache hit rate on a long tail',
        problem: 'Most links are opened once. Caching everything wastes memory.',
        approach: [
          'Cache with a short TTL and let the tail fall out naturally.',
          'Size for the head: a small fraction of links takes most opens.',
          'Serve cache misses from the database and backfill on the way through.',
        ],
        tradeoff: 'First opens always miss. The p99 budget is met by the head, not by every link.',
      },
      {
        title: 'Counting opens without slowing redirects',
        problem: 'A database write per redirect would dominate the latency budget.',
        approach: [
          'Emit an event per open and aggregate into day buckets in the background.',
          'Accept approximate counts: analytics lagging by a minute is fine.',
        ],
        tradeoff: 'Stats are eventually consistent. Redirects stay at cache speed.',
      },
    ],
  },
  {
    id: 'group-chat',
    title: 'Group Chat',
    tagline: 'Design real time messaging with offline delivery',
    difficulty: 'Hard',
    minutes: 45,
    prompt:
      'Design a messaging app for 2B users. People send one to one and group messages, see each other online state, and receive everything sent while they were offline. Media messages can be large.',
    checkpoints: [
      {
        question: 'How large can groups be? Tens or hundreds of thousands?',
        decides: 'Small groups fan out inline; broadcast channels need a different path.',
      },
      {
        question: 'Must offline messages arrive in order?',
        decides: 'Ordering needs per-sender sequence numbers and a holdback buffer.',
      },
      {
        question: 'Do media bytes flow through our servers or straight to storage?',
        decides: 'Proxying media multiplies bandwidth cost; direct upload needs signed URLs.',
      },
    ],
    functional: [
      'Users can send and receive text messages one to one and in groups',
      'Users can see online state and delivery receipts',
      'Users receive messages sent while they were offline',
      'Users can send images and video',
    ],
    nonfunctional: [
      'Delivery under 100ms on a good connection: messaging is judged by feel',
      'Connection heavy, not request heavy: 2B mostly idle sockets',
      'Messages must never be lost once acknowledged',
      'Media delivery can lag text; text is the priority lane',
    ],
    estimations: [
      'Connections: 2B registered, perhaps 500M concurrently connected at peak',
      'Messages: 100B a day would be about 1M a second at peak hours',
      'Media: 1M images a minute at 1MB would be 1TB a minute, so direct to storage upload is mandatory',
    ],
    entities: [
      { name: 'User', fields: 'id, connection server, last seen' },
      { name: 'Message', fields: 'id, sender, conversation, sequence number, payload reference' },
      { name: 'Conversation', fields: 'id, member list, per-member read watermark' },
    ],
    api: {
      protocol: 'WebSocket plus REST',
      protocolWhy:
        'REST for account, contact, and history operations. A persistent socket per device for sends, receipts, and presence because polling at this scale is hopeless.',
      endpoints: [
        { method: 'POST', path: '/messages', purpose: 'Send (also mirrored on the socket)' },
        { method: 'GET', path: '/conversations/{id}/history?cursor=', purpose: 'Backfill history' },
        { method: 'POST', path: '/media/uploads', purpose: 'Mint a direct upload URL' },
        { method: 'WS', path: '/stream', purpose: 'Incoming messages, receipts, presence' },
      ],
    },
    concepts: ['realtime-updates', 'message-queue', 'consistency-models'],
    patterns: ['realtime-updates'],
    hldPresetId: 'whatsapp',
    hldSteps: [
      'Client to gateway to service to database: send persists, then routes.',
      'Hold connections on the gateway: route by which server owns the recipient socket.',
      'Buffer for offline recipients: an acknowledged message waits in a queue until the device returns.',
      'Keep media out of the message path: upload straight to object storage, send only the reference.',
    ],
    deepDives: [
      {
        title: 'Fanning out to 500M idle sockets',
        problem: 'One process cannot hold millions of connections, and routing tables churn.',
        approach: [
          'Shard connections across gateway fleets by user id hash.',
          'Look up the recipient owner server on send; forward server to server.',
          'A group send is N unicast deliveries, which isolates slow recipients from each other.',
        ],
        tradeoff: 'Extra hop between gateways. In exchange, each gateway stays within connection budget.',
      },
      {
        title: 'Offline queue without loss or duplicates',
        problem: 'Devices flap. A message must survive the gap and arrive exactly once in practice.',
        approach: [
          'Acknowledge to the sender only after the message is durably buffered.',
          'Redeliver on reconnect from the per-user buffer, keyed by message id for dedupe.',
          'Advance the read watermark only on client receipt, never on send.',
        ],
        tradeoff: 'At-least-once delivery with client dedupe. Exactly once over a flapping socket is not on offer.',
      },
      {
        title: 'Presence at planetary scale',
        problem: 'Broadcasting every online transition to every contact is quadratic.',
        approach: [
          'Publish presence only to contacts with an open conversation, on a separate low priority channel.',
          'Cache aggressively and accept staleness: last seen minutes ago is fine.',
        ],
        tradeoff: 'Presence lags reality by design. It is the first thing sacrificed under load.',
      },
    ],
  },
];

export const INTERVIEW_PACKS: readonly InterviewPack[] = [
  ...FOUNDING_PACKS,
  ...CORE_PACKS,
  ...SOCIAL_PACKS,
  ...REALTIME_PACKS,
  ...TRANSACTION_PACKS,
  ...MEDIA_INFRA_PACKS,
];

/** Every pack id, for labs and tests that must cover the whole library. */
export const INTERVIEW_PACK_IDS: readonly string[] = INTERVIEW_PACKS.map((p) => p.id);
