import type { Topology } from '../types';
import { COL, LROW, ROW, edge, node, note, sectionOver } from './helpers';

/* ------------------------------------------------------------------ *
 * Discord: Real-Time Chat
 *
 * A simplified public reconstruction, not insider knowledge. It is based
 * on what Discord has published:
 *
 *   - "How Discord Stores Trillions of Messages" (discord.com/blog):
 *     messages partitioned BY CHANNEL in Cassandra, later ScyllaDB, and
 *     the hot-partition problem when one channel gets very active. The
 *     `scylla` shard node models exactly that: shards are channel
 *     partitions and hotKeyFraction is "one huge channel".
 *   - "How Discord Scaled Elixir to 5,000,000 Concurrent Users" and
 *     "Real time communication at scale with Elixir at Discord"
 *     (discord.com/blog, elixir-lang.org/blog): a gateway tier holding
 *     millions of persistent websockets, session processes per client,
 *     one guild process fanning every message out to every connected
 *     session. The fan-out topic and the Gateway Push pods model the
 *     guild-process-to-gateway leg of that fan-out.
 *   - "How Discord Handles Two and Half Million Concurrent Voice Users
 *     using WebRTC" (discord.com/blog): voice is its own fleet of SFU
 *     servers, discovered separately, on a path that never touches the
 *     text pipeline.
 *
 * What it leaves out: presence updates (a larger firehose than messages),
 * the Rust data services and request coalescing in front of ScyllaDB,
 * permission checks, and the true fan-out multiplier (a delivery per
 * MEMBER, not per gateway pod). Every number is illustrative, chosen to
 * reproduce the relative behaviour, and none is a Discord figure.
 *
 * The arithmetic at 1x:
 *
 *   CONNECTIONS  30 conn/s x 40s sessions = 1200 held against a ceiling
 *                of 4 instances x 400 = 1600 (75%). The gateway's meter
 *                is CONNECTIONS, not requests: at 2x it wants 2400 held
 *                and refuses everything past 1600 as conn-refused. That
 *                difference is the whole lesson of the gateway tier.
 *   MESSAGES     80 msg/s -> rate limiter (200 rps, Discord's API rate
 *                limits are famous) -> message API -> three children:
 *                  scylla   6 channel shards x 2 slots / 40ms = 50/s per
 *                           shard, 300/s total; ~13/s per shard at 1x.
 *                           Set hotKeyFraction to ~0.7 and one shard is
 *                           offered 56/s against its own 50: the hot
 *                           channel melts while the mean looks fine.
 *                  fan-out  one publish becomes one delivery per gateway
 *                           push pod (3 today), all detached: the sender
 *                           is long gone. Each pod does 15ms of push work
 *                           per message (2 slots -> 133/s); at 2x the
 *                           admitted 160 msg/s exceed that and the push
 *                           tier sheds deliveries LOUDLY on its own
 *                           meters while the senders' error rate shows
 *                           NOTHING. Members just stop seeing messages;
 *                           that silence is why fan-out is hard.
 *                  search   acked into a queue, indexed asynchronously
 *                           (writes pay ~68ms each at the index).
 *   MEDIA        120 fetch/s, 90% absorbed by the CDN; the object store
 *                sees ~12/s of misses.
 *   VOICE        20 joins/s across 2 SFU servers (400/s each): a
 *                separate path that stays healthy while text melts.
 * ------------------------------------------------------------------ */

const discord: Topology = {
  nodes: [
    // Connection lane: capacity here is held connections, not rps.
    node('conn', 'client', 'New Connections', COL(0), ROW(0), {
      rps: 30,
      timeoutMs: 3000,
    }),
    node('gateway', 'websocket', 'Gateway (WS)', COL(1), ROW(0), {
      capacity: 400,
      instances: 4,
      serviceMs: 5,
      serviceCv: 0.4,
      connectionMs: 40000,
    }),
    node('sessions', 'service', 'Session Servers', COL(2), ROW(0), {
      capacity: 8,
      serviceMs: 10,
      serviceCv: 0.5,
      queueLimit: 64,
    }),

    // Message lane.
    node('senders', 'client', 'Message Senders', COL(0), ROW(2), {
      rps: 80,
      timeoutMs: 2500,
    }),
    node('limiter', 'ratelimiter', 'API Rate Limit', COL(1), ROW(2), {
      rateLimitRps: 200,
      burst: 200,
    }),
    node('msg-api', 'service', 'Message API', COL(2), ROW(2), {
      capacity: 16,
      serviceMs: 6,
      serviceCv: 0.5,
      queueLimit: 128,
    }),
    node('fanout', 'pubsub', 'Guild Fan-out', COL(3), ROW(1), { serviceMs: 0.5 }),
    node('push-a', 'service', 'Gateway Push A', COL(4), ROW(0), {
      capacity: 2,
      serviceMs: 15,
      serviceCv: 0.5,
      queueLimit: 32,
    }),
    node('push-b', 'service', 'Gateway Push B', COL(4), ROW(1), {
      capacity: 2,
      serviceMs: 15,
      serviceCv: 0.5,
      queueLimit: 32,
    }),
    node('push-c', 'service', 'Gateway Push C', COL(4), ROW(2), {
      capacity: 2,
      serviceMs: 15,
      serviceCv: 0.5,
      queueLimit: 32,
    }),
    // Messages are partitioned by channel; a shard here IS a channel range.
    node('scylla', 'shard', 'Message Store', COL(3), ROW(2), {
      serviceMs: 40,
      serviceCv: 0.6,
      queueLimit: 32,
      shardCount: 6,
      shardCapacity: 2,
      hotKeyFraction: 0,
    }),
    node('search-q', 'queue', 'Index Queue', COL(3), LROW(3, 1), {
      serviceMs: 1,
      serviceCv: 0.2,
      queueLimit: 5000,
    }),
    node('indexer', 'worker', 'Search Indexer', COL(4), LROW(3, 1), {
      capacity: 4,
      serviceMs: 12,
      serviceCv: 0.5,
    }),
    node('search', 'searchindex', 'Message Search', COL(5), LROW(3, 1), {
      readFraction: 0.15,
    }),

    // Media lane: attachments behind a CDN.
    node('media', 'client', 'Media Fetch', COL(0), LROW(4, 1), {
      rps: 120,
      timeoutMs: 2000,
    }),
    node('cdn', 'cdn', 'Media CDN', COL(1), LROW(4, 1), {
      capacity: 256,
      serviceMs: 2,
      serviceCv: 0.3,
      hitRate: 0.9,
      queueLimit: 2048,
    }),
    node('blobs', 'objectstore', 'Attachments', COL(2), LROW(4, 1)),

    // Voice lane: a separate fleet entirely.
    node('voice', 'client', 'Voice Joins', COL(0), LROW(5, 2), {
      rps: 20,
      timeoutMs: 3000,
    }),
    node('rtc', 'lb', 'RTC Discovery', COL(1), LROW(5, 2), {
      capacity: 256,
      serviceMs: 0.5,
    }),
    node('sfu-a', 'service', 'Voice Server A', COL(2), LROW(5, 2), {
      capacity: 8,
      serviceMs: 20,
      serviceCv: 0.5,
      queueLimit: 64,
    }),
    node('sfu-b', 'service', 'Voice Server B', COL(2), LROW(6, 2), {
      capacity: 8,
      serviceMs: 20,
      serviceCv: 0.5,
      queueLimit: 64,
    }),
  ],
  edges: [
    edge('conn', 'gateway'),
    edge('gateway', 'sessions'),
    edge('senders', 'limiter'),
    edge('limiter', 'msg-api'),
    // A message write fans to all three: the store decides the sender's
    // fate; the fan-out and the index pipeline ack instantly and fail,
    // when they fail, where the sender cannot see it.
    edge('msg-api', 'scylla'),
    edge('msg-api', 'fanout'),
    edge('msg-api', 'search-q'),
    edge('fanout', 'push-a'),
    edge('fanout', 'push-b'),
    edge('fanout', 'push-c'),
    edge('search-q', 'indexer'),
    edge('indexer', 'search'),
    edge('media', 'cdn'),
    edge('cdn', 'blobs'),
    edge('voice', 'rtc'),
    edge('rtc', 'sfu-a'),
    edge('rtc', 'sfu-b'),
  ],
  annotations: [
    // Four independent paths that share a company. Only the message path
    // and the push tier are coupled, and the coupling is the lesson.
    sectionOver('dc-sec-conn', 'Holding the sockets open', 0, 0, 2, 0, 0),
    sectionOver('dc-sec-msg', 'Writing a message', 1, 0, 2, 2, 2),
    sectionOver('dc-sec-push', 'Pushing it out', 2, 4, 4, 0, 2),
    sectionOver('dc-sec-search', 'Indexed later, off to the side', 3, 3, 5, 3, 3, 1),
    sectionOver('dc-sec-media', 'Attachments', 4, 0, 2, 4, 4, 1),
    sectionOver('dc-sec-voice', 'Voice, on its own hardware', 5, 0, 2, 5, 6, 2),
    note(
      'dc-note-conn',
      1320,
      48,
      'The gateway counts open connections, not requests. 30 new a second, each held for 40 seconds, is 1200 sockets against a ceiling of 1600. Double the load and it starts refusing connections outright.',
      300,
    ),
    // The lesson. Placed clear of every frame so it reads as commentary on
    // the whole message path rather than as a label on one box.
    note(
      'dc-note-fanout',
      1608,
      272,
      'Drag the message rate up and watch the push servers. One message becomes one delivery per pod, and each pod can only do about 130 a second. Past that, members stop seeing messages while the senders see no errors at all. That silence is what makes fan-out hard.',
      320,
    ),
    note(
      'dc-note-hot',
      792,
      760,
      'Messages are split across six channel shards. Give the message store a hot key and one busy channel takes far more than its share, so that shard melts while the average still looks healthy.',
      300,
    ),
    note(
      'dc-note-voice',
      792,
      976,
      'Voice runs on its own servers and never touches the text path, so chat can be on fire while calls stay up.',
      300,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * Uber: Ride Dispatch
 *
 * A simplified public reconstruction, not insider knowledge. Based on
 * what Uber has published:
 *
 *   - "H3: Uber's Hexagonal Hierarchical Spatial Index" (uber.com/blog/h3)
 *     and their dispatch talks: driver locations land in a geospatial
 *     index sharded by cell/region, and matching reads the cells around
 *     the rider. The `geo` shard node is that index; hotKeyFraction is
 *     "everyone is downtown on Friday night".
 *   - "Real-time Data Infrastructure at Uber" (arxiv.org/abs/2104.00087):
 *     Kafka carries the event firehose; the surge pricing pipeline
 *     consumes trip and status events through Kafka into a streaming job
 *     and writes multipliers to a key-value sink store that pricing
 *     reads; M3 is the metrics store consuming the same stream.
 *   - "Brief History of Scaling Uber" (highscalability.com) and Uber's
 *     own posts on DISCO and Ringpop: a dispatch service split from an
 *     edge gateway, matching as its own latency-critical system, trip
 *     state in Schemaless (a replicated MySQL-backed store).
 *
 * What it leaves out: Ringpop's peer sharding, ETA routing graphs, the
 * ML inside surge, driver session state, and several dozen real
 * services. Every number is illustrative, not an Uber figure.
 *
 * The arithmetic at 1x:
 *
 *   WRITE SIDE   400 location pings/s from drivers, acked by ingest in
 *                ~3ms and published to the stream. Three consumer groups
 *                read it independently:
 *                  geo writer  keeps the location index fresh. Ceiling
 *                              ~750/s (12 partitions x ~16ms per update
 *                              including the shard write): comfortable at
 *                              430/s, hopeless at 4x (1630/s), where its
 *                              CONSUMER LAG grows and eventually ages out
 *                              of retention. A lagging geo writer means
 *                              dispatch is matching on stale positions,
 *                              and nothing on the rider path says so.
 *                  surge       recomputes multipliers into the surge KV
 *                              store that pricing reads.
 *                  M3          the metrics firehose, appends are cheap.
 *   READ SIDE    30 rider requests/s through the edge gateway, 3:1 to
 *                dispatch vs trip status. Dispatch fans to the geo index
 *                (2 slots x 6 region shards / 10ms = 200/s per shard),
 *                ETA, pricing and the offer push. Raise hotKeyFraction
 *                on the geo index to pile the city into one region cell.
 *   TRIPS        trip writes go to a replicated store (reads scale,
 *                writes do not) and to the payment processor: 4 slots at
 *                ~200ms is a 20/s ceiling against ~7.5/s at 1x. At 4x it
 *                saturates and the breaker in front of it trips, failing
 *                fast instead of queueing behind a 200ms dependency.
 * ------------------------------------------------------------------ */

const uber: Topology = {
  nodes: [
    // Rider read side.
    node('riders', 'client', 'Rider Apps', COL(0), ROW(1), {
      rps: 30,
      timeoutMs: 3000,
    }),
    node('gw', 'apigateway', 'Edge Gateway', COL(1), ROW(1), {
      capacity: 32,
      serviceMs: 2,
      rateLimitRps: 200,
      burst: 200,
      authFailRate: 0.005,
    }),
    node('match', 'service', 'Dispatch', COL(2), ROW(0), {
      capacity: 8,
      serviceMs: 10,
      serviceCv: 0.5,
      queueLimit: 64,
    }),
    node('eta', 'service', 'Maps ETA', COL(3), ROW(0), {
      capacity: 8,
      serviceMs: 15,
      serviceCv: 0.5,
      queueLimit: 64,
    }),
    node('push', 'service', 'Offer Push', COL(4), ROW(0), {
      capacity: 4,
      serviceMs: 8,
      serviceCv: 0.5,
      queueLimit: 32,
    }),
    node('pricing', 'service', 'Dynamic Pricing', COL(3), ROW(1), {
      capacity: 8,
      serviceMs: 6,
      serviceCv: 0.4,
      queueLimit: 64,
    }),
    // The sink store the surge pipeline writes and pricing reads.
    node('surge-kv', 'db', 'Surge KV Store', COL(4), ROW(1), {
      capacity: 16,
      serviceMs: 4,
      serviceCv: 0.5,
      queueLimit: 128,
    }),

    // Trip state and payments.
    node('trips', 'service', 'Trip Service', COL(2), LROW(2, 1), {
      capacity: 8,
      serviceMs: 12,
      serviceCv: 0.5,
      queueLimit: 64,
    }),
    node('trip-db', 'replica', 'Trip Store', COL(3), LROW(2, 1), {
      capacity: 4,
      serviceMs: 10,
      serviceCv: 0.5,
      queueLimit: 64,
      replicaCount: 2,
      replicationLagMs: 50,
      readFraction: 0.7,
    }),
    node('pay-brk', 'breaker', 'Payment Breaker', COL(3), LROW(3, 1), {
      errorThreshold: 0.5,
      windowMs: 4000,
      openMs: 3000,
      halfOpenProbes: 3,
    }),
    node('payments', 'service', 'Payments', COL(4), LROW(3, 1), {
      capacity: 4,
      serviceMs: 200,
      serviceCv: 0.5,
      queueLimit: 16,
      errorRate: 0.01,
    }),

    // Driver write side: the firehose.
    node('drivers', 'client', 'Driver Pings', COL(0), LROW(4, 2), {
      rps: 400,
      timeoutMs: 2000,
    }),
    node('ingest', 'service', 'Location Ingest', COL(1), LROW(4, 2), {
      capacity: 24,
      serviceMs: 3,
      serviceCv: 0.4,
      queueLimit: 256,
    }),
    node('kafka', 'streambroker', 'Kafka Event Bus', COL(2), LROW(4, 2), {
      serviceMs: 0.5,
      serviceCv: 0.2,
      partitions: 12,
      queueLimit: 4000,
    }),
    node('geo-upd', 'service', 'Geo Updater', COL(3), LROW(4, 2), {
      capacity: 8,
      serviceMs: 6,
      serviceCv: 0.5,
      queueLimit: 64,
    }),
    // Sharded by region cell: one shard is one slice of the city.
    node('geo', 'shard', 'Geo Index (H3)', COL(4), LROW(4, 2), {
      serviceMs: 10,
      serviceCv: 0.5,
      queueLimit: 32,
      shardCount: 6,
      shardCapacity: 2,
      hotKeyFraction: 0,
    }),
    node('surge-w', 'service', 'Surge Pipeline', COL(3), LROW(5, 2), {
      capacity: 8,
      serviceMs: 6,
      serviceCv: 0.5,
      queueLimit: 64,
    }),
    node('m3', 'timeseriesdb', 'M3 Metrics', COL(3), LROW(6, 2), {
      rangeQueryFraction: 0.02,
      rangeQueryMs: 120,
    }),
  ],
  edges: [
    edge('riders', 'gw'),
    // The gateway's route table: 3 parts dispatch, 1 part trip state.
    edge('gw', 'match', 3),
    edge('gw', 'trips', 1),
    // Matching fans to everything it needs to answer one request.
    edge('match', 'geo'),
    edge('match', 'eta'),
    edge('match', 'pricing'),
    edge('match', 'push'),
    edge('pricing', 'surge-kv'),
    edge('trips', 'trip-db'),
    edge('trips', 'pay-brk'),
    // Trip events join the same stream the location pings ride.
    edge('trips', 'kafka'),
    edge('pay-brk', 'payments'),
    edge('drivers', 'ingest'),
    edge('ingest', 'kafka'),
    // Each broker edge is an independent consumer group with its own lag.
    edge('kafka', 'geo-upd'),
    edge('kafka', 'surge-w'),
    edge('kafka', 'm3'),
    edge('geo-upd', 'geo'),
    edge('surge-w', 'surge-kv'),
  ],
  annotations: [
    sectionOver('ub-sec-match', 'Finding a driver', 0, 2, 4, 0, 1),
    sectionOver('ub-sec-trip', 'The trip, and getting paid', 1, 2, 4, 2, 3, 1),
    sectionOver(
      'ub-sec-fire',
      'Where the drivers are, updated constantly',
      2,
      0,
      4,
      4,
      6,
      2,
    ),
    note(
      'ub-note-fan',
      1320,
      40,
      'One rider request touches four services before an offer comes back. The slowest of them sets the wait, so a match happens at the speed of the weakest link here.',
      300,
    ),
    // The lesson. Payments is the only node in the diagram whose ceiling is
    // low enough to hit at 4x, and the breaker's reaction is the point.
    note(
      'ub-note-pay',
      1320,
      368,
      'Drag the load to 4x and watch payments. Each charge takes 200ms and only four run at once, so it tops out near 20 a second. The breaker in front notices and starts failing fast, which beats every trip request piling up behind a slow card network.',
      300,
    ),
    note(
      'ub-note-geo',
      1320,
      696,
      'The location index is split by map cell. Give it a hot key and the whole city crowds into one cell, so that one shard saturates while the rest sit idle.',
      300,
    ),
    note(
      'ub-note-lag',
      16,
      336,
      '400 driver pings a second go onto one stream, and three readers consume it on their own clocks. If the map updater falls behind, dispatch quietly matches on stale positions and nothing on the rider path shows an error.',
      236,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 17. Netflix (public reconstruction)
 *
 * A simplified model built from what Netflix has published, not insider
 * knowledge. Sources a student can read:
 *   - Open Connect: openconnect.netflix.com and the APNIC write-up
 *     (blog.apnic.net/2018/06/20/netflix-content-distribution-through-
 *     open-connect/). Netflix states ~95% of its traffic is served from
 *     OCA appliances peered directly with residential ISPs.
 *   - Zuul 2 gateway and prioritised load shedding at the gateway:
 *     netflixtechblog.com ("Open Sourcing Zuul 2", "Keeping Netflix
 *     Reliable Using Prioritized Load Shedding").
 *   - EVCache (memcached tier) in front of Cassandra for viewing data:
 *     netflixtechblog.com EVCache posts.
 *   - Hystrix circuit breakers and bulkheads: Netflix Hystrix architecture.
 *   - Cosmos / VES encoding pipeline: netflixtechblog.com ("The Netflix
 *     Cosmos Platform", "Rebuilding Netflix Video Processing Pipeline
 *     with Microservices").
 * Left out: Eureka discovery, the hundreds of real microservices, A/B
 * infra, per-title encode ladders. All numbers are illustrative, chosen
 * for believable relative behaviour, not Netflix production figures.
 *
 * The traffic picture, 1x:
 *   STREAMING  1500 rps of segment fetches -> OCA at hitRate 0.96, so
 *              only ~60 rps ever touch the S3 fill origin. This lane is
 *              ~86% of all offered traffic and it never enters "the
 *              cloud" at all, which is the whole point of Open Connect.
 *   CONTROL    240 rps of device API calls -> Zuul (auth + route table,
 *              3:2 play vs browse).
 *     play     PlayAPI fans to: Hystrix breaker -> DRM licensing
 *              (5 slots / 18ms = 278 rps ceiling: the knee), EVCache at
 *              0.9 in front of a 4-shard Cassandra ring, the Keystone
 *              stream (viewing history consumer: 6 partitions x
 *              1000/20ms = 300/s ceiling), and Atlas telemetry appends.
 *     browse   Browse API -> a 10-wide Hystrix bulkhead ->
 *              Personalisation (8 slots / 20ms = 400 rps) -> precomputed
 *              recs out of EVCache (0.97; the offline recompute is not
 *              modelled).
 *   ENCODING   2 masters/s -> Cosmos queue -> VES farm (2 boxes x 2
 *              jobs / 1.5s = 2.7 jobs/s) -> encodes land in the same S3
 *              origin the OCAs fill from. Completely separate from
 *              serving, exactly as published.
 *
 * What breaks, and how:
 *   4x: licensing sheds ~50%, the breaker trips and flaps, and PlayAPI
 *   fails fast (loud). Personalisation saturates and the bulkhead caps
 *   it (loud but contained). Keystone's history consumer lags ~270
 *   msg/s and then drops out of retention (quiet). The VES backlog
 *   grows without bound (quiet). Meanwhile the OCA lane, 6000 rps of
 *   it, shrugs: streaming keeps working while the control plane burns.
 *   At 1x, drag the OCA hit rate down instead and watch the fill origin
 *   absorb a load it was never sized for.
 * ------------------------------------------------------------------ */

const netflix: Topology = {
  nodes: [
    // Streaming lane: the bytes. Most of the system's traffic, none of
    // its cloud. An OCA is an ISP-embedded cache; its misses fill from S3.
    node('viewers', 'client', 'Stream Viewers', COL(0), ROW(0), {
      rps: 1500,
      timeoutMs: 2500,
    }),
    node('oca', 'cdn', 'Open Connect OCA', COL(1), ROW(0), {
      capacity: 512,
      serviceMs: 2,
      serviceCv: 0.3,
      hitRate: 0.96,
      queueLimit: 4096,
    }),
    node('s3', 'objectstore', 'S3 Origin (fill)', COL(3), ROW(0)),
    // Encoding lane: one master in, many encodes out, fed by a queue and
    // priced in seconds. Its output lands in the same S3 the OCAs fill from.
    node('studio', 'client', 'Studio Ingest', COL(0), ROW(1), {
      rps: 2,
      timeoutMs: 3000,
    }),
    node('cosmosq', 'queue', 'Cosmos Job Queue', COL(1), ROW(1), {
      serviceMs: 1,
      serviceCv: 0.2,
      queueLimit: 5000,
    }),
    node('ves', 'transcoder', 'VES Encode Farm', COL(2), ROW(1), {
      instances: 2,
      capacity: 2,
      serviceMs: 1500,
      serviceCv: 0.3,
    }),
    node('atlas', 'timeseriesdb', 'Atlas Telemetry', COL(3), ROW(1), {
      capacity: 16,
      serviceMs: 1.5,
      serviceCv: 0.4,
      queueLimit: 1024,
      rangeQueryFraction: 0.03,
      rangeQueryMs: 120,
    }),
    // Control plane: the API calls. Two orders of magnitude less traffic
    // than streaming, and where all the complexity lives.
    node('capi', 'client', 'Device API Calls', COL(0), LROW(3, 1), {
      rps: 240,
      timeoutMs: 2500,
    }),
    node('zuul', 'apigateway', 'Zuul 2 Gateway', COL(1), LROW(3, 1), {
      capacity: 96,
      serviceMs: 2,
      serviceCv: 0.3,
      queueLimit: 512,
      rateLimitRps: 1200,
      burst: 600,
      authFailRate: 0.005,
    }),
    node('playapi', 'service', 'PlayAPI', COL(2), LROW(2, 1), {
      capacity: 16,
      serviceMs: 8,
      serviceCv: 0.5,
      queueLimit: 128,
      timeoutMs: 600,
    }),
    node('hystrix', 'breaker', 'Hystrix Breaker', COL(3), LROW(2, 1), {
      errorThreshold: 0.4,
      windowMs: 4000,
      openMs: 4000,
      halfOpenProbes: 3,
    }),
    // 5 slots / 18ms = 278 rps: the deliberate knee of the play path.
    node('license', 'service', 'DRM License Svc', COL(4), LROW(2, 1), {
      capacity: 5,
      serviceMs: 18,
      serviceCv: 0.5,
      queueLimit: 24,
    }),
    node('evcache', 'cache', 'EVCache (viewing)', COL(3), LROW(3, 1), {
      capacity: 48,
      serviceMs: 1,
      serviceCv: 0.3,
      hitRate: 0.9,
      queueLimit: 512,
    }),
    node('cassandra', 'shard', 'Cassandra Ring', COL(4), LROW(3, 1), {
      serviceMs: 35,
      serviceCv: 0.6,
      queueLimit: 32,
      shardCount: 4,
      shardCapacity: 2,
      hotKeyFraction: 0,
    }),
    node('keystone', 'streambroker', 'Keystone Pipeline', COL(3), LROW(4, 1), {
      serviceMs: 1,
      partitions: 6,
      queueLimit: 4000,
    }),
    node('history', 'service', 'Viewing History', COL(4), LROW(4, 1), {
      capacity: 6,
      serviceMs: 20,
      serviceCv: 0.5,
      queueLimit: 48,
    }),
    node('browse', 'service', 'Browse API', COL(2), LROW(5, 2), {
      capacity: 12,
      serviceMs: 10,
      serviceCv: 0.5,
      queueLimit: 96,
    }),
    node('recsbh', 'bulkhead', 'Recs Bulkhead', COL(3), LROW(5, 2), {
      bulkheadMax: 10,
    }),
    node('recs', 'service', 'Personalisation', COL(4), LROW(5, 2), {
      capacity: 8,
      serviceMs: 20,
      serviceCv: 0.5,
      queueLimit: 48,
    }),
    // Precomputed offline; the read path almost never misses. The
    // recompute pipeline itself is deliberately out of frame.
    node('evrecs', 'cache', 'EVCache (recs)', COL(5), LROW(5, 2), {
      capacity: 48,
      serviceMs: 1,
      serviceCv: 0.3,
      hitRate: 0.97,
      queueLimit: 256,
    }),
  ],
  edges: [
    edge('viewers', 'oca'),
    edge('oca', 's3'),
    edge('studio', 'cosmosq'),
    edge('cosmosq', 'ves'),
    edge('ves', 's3'),
    edge('capi', 'zuul'),
    // Zuul's route table: 3 parts playback control, 2 parts browsing.
    edge('zuul', 'playapi', 3),
    edge('zuul', 'browse', 2),
    // PlayAPI fans out to everything a real playback start touches:
    // entitlement/licensing behind its breaker, viewing state through
    // EVCache, an event onto Keystone, a telemetry append into Atlas.
    edge('playapi', 'hystrix'),
    edge('hystrix', 'license'),
    edge('playapi', 'evcache'),
    edge('evcache', 'cassandra'),
    edge('playapi', 'keystone'),
    edge('playapi', 'atlas'),
    // Keystone's one modelled consumer group: the history writer.
    edge('keystone', 'history'),
    edge('browse', 'recsbh'),
    edge('recsbh', 'recs'),
    edge('recs', 'evrecs'),
  ],
  annotations: [
    // Three regions, because the diagram is really three systems that happen
    // to share a company. The top one moves almost all the bytes and has
    // almost none of the logic, which is the first surprising thing about it.
    sectionOver('nf-sec-bytes', 'Moving the video', 0, 0, 3, 0, 1),
    sectionOver('nf-sec-edge', 'Where API calls arrive', 1, 0, 1, 3, 3, 1),
    sectionOver('nf-sec-play', 'Starting a stream', 2, 2, 4, 2, 4, 1),
    sectionOver('nf-sec-recs', 'Browsing, kept separate', 3, 2, 5, 5, 5, 2),
    note(
      'nf-note-bytes',
      1080,
      64,
      '1500 requests a second of video, and 240 of everything else. The video almost never reaches Netflix: the edge cache answers 96 percent of it from inside your ISP.',
      380,
    ),
    note(
      'nf-note-encode',
      1080,
      216,
      'Encoding is slow and that is fine. Jobs wait in a queue and nobody is watching a spinner, so seconds here cost nothing.',
      380,
    ),
    // The lesson, placed in the empty column beside the play path rather
    // than above the API tier, where a reader would attach it to the wrong
    // group of boxes.
    note(
      'nf-note-license',
      40,
      360,
      'The bottleneck is the licence service, not the video. It has 5 slots at 18ms, so it runs out at about 280 requests a second. Raise the load and watch it fill before anything else does.',
      440,
      'md',
    ),
    note(
      'nf-note-breaker',
      40,
      648,
      'The breaker in front of it is what stops one slow service from holding every request open. Trip it and playback fails fast instead of hanging.',
      440,
    ),
    note(
      'nf-note-recs',
      40,
      840,
      'Recommendations sit behind a bulkhead, so if they get slow the play path is untouched. Browsing breaking is survivable; playback breaking is not.',
      440,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 18. Spotify (public reconstruction)
 *
 * A simplified model built from what Spotify has published, not insider
 * knowledge. Sources a student can read:
 *   - Event delivery: engineering.atspotify.com "Spotify's Event
 *     Delivery - The Road to the Cloud" (2016): ~700k events/s through
 *     Kafka, later Google Cloud Pub/Sub.
 *   - Personalisation: engineering.atspotify.com "Personalization at
 *     Spotify using Cassandra" (2015): Kafka logs, batch pipelines,
 *     Cassandra profile/metadata stores feeding Discover Weekly.
 *   - Playlists and libraries on Cassandra; search on Elasticsearch;
 *     audio from object storage via CDN (various Spotify engineering
 *     posts and talks).
 * Left out: the real GCP migration, Ogg/bitrate ladders, P2P history,
 * hundreds of squads' services. All numbers are illustrative, chosen
 * for believable relative behaviour, not Spotify production figures.
 *
 * The traffic picture, 1x:
 *   AUDIO      1100 rps of segment fetches -> CDN at hitRate 0.82 (a
 *              music catalogue has a long tail), so ~200 rps fall
 *              through to GCS audio storage (64 slots / 90ms = 710 rps
 *              ceiling). Fully separate from the metadata path.
 *   METADATA   220 rps of app calls -> gateway (700 rps bucket, 1% bad
 *              auth) -> route table: 35% metadata (cache 0.9 over a
 *              240 rps DB), 20% search (Elasticsearch-style index:
 *              searches 8ms, writes +60ms and searchable 2s late), 25%
 *              playlists, 20% home/recs.
 *   PLAYLISTS  the write-heavy path. 45% of playlist traffic is writes
 *              against a replica set whose primary has 3 slots / 30ms =
 *              100 writes/s, while reads spread over 3 replicas
 *              (300 rps). Replication lag 150ms: add a song, read the
 *              playlist back, and it is not there yet.
 *   RECS       Home/Discover reads Taste Vectors (a 1M-vector ANN index
 *              at 0.9 recall: ~50ms/query, 320 rps ceiling). Every 20s
 *              the Discover Weekly batch (cron -> queue -> feature
 *              pipeline, ~266 jobs/s for about a second) WRITES the
 *              same index, driving it to ~97% while the burst drains,
 *              so online p99 spikes on the batch clock. Batch and
 *              serving sharing a store is the lesson.
 *   EVENTS     600 events/s fired at the Event Delivery broker
 *              (8 partitions). Royalty & Reporting can drain 8 x
 *              1000/6ms = 1333/s; the analytics store drains in ~1.5ms
 *              appends. Both keep up at 1x.
 *
 * What breaks, and how:
 *   4x: 4400 rps of audio pushes ~790 rps of misses into a 710 rps GCS
 *   ceiling, and the audio path saturates and sheds (loud). The gateway bucket
 *   refuses ~180 rps of app calls (loud, at the front door). Playlist
 *   WRITES pin the primary at 100% while its read replicas idle, the
 *   replica lesson in company clothing. Events run at 2400/s against a
 *   1333/s consumer: Royalty lags, then loses data out of retention,
 *   while Analytics next to it keeps up (quiet). At 1x, crash the CDN,
 *   or watch p99 on the recs path breathe with the 20s batch cycle.
 * ------------------------------------------------------------------ */

const spotify: Topology = {
  nodes: [
    // Audio lane: bytes from blob storage through an edge cache.
    node('listeners', 'client', 'Listeners (audio)', COL(0), ROW(0), {
      rps: 1100,
      timeoutMs: 2500,
    }),
    node('audiocdn', 'cdn', 'Audio CDN', COL(1), ROW(0), {
      capacity: 384,
      serviceMs: 3,
      serviceCv: 0.3,
      hitRate: 0.82,
      queueLimit: 4096,
    }),
    // A shortish queue on purpose: when misses outrun the 710 rps
    // ceiling the store should refuse loudly, not buffer for seconds.
    node('gcs', 'objectstore', 'GCS Audio Storage', COL(2), ROW(0), {
      queueLimit: 256,
    }),
    // Metadata/control lane: the app's API calls.
    node('app', 'client', 'App Clients', COL(0), LROW(2, 1), {
      rps: 220,
      timeoutMs: 2500,
    }),
    node('gw', 'apigateway', 'API Gateway', COL(1), LROW(2, 1), {
      capacity: 96,
      serviceMs: 2,
      serviceCv: 0.3,
      queueLimit: 512,
      rateLimitRps: 700,
      burst: 350,
      authFailRate: 0.01,
    }),
    node('meta', 'service', 'Metadata Service', COL(2), LROW(1, 1), {
      capacity: 12,
      serviceMs: 8,
      serviceCv: 0.5,
      queueLimit: 96,
    }),
    node('metacache', 'cache', 'Metadata Cache', COL(3), LROW(1, 1), {
      capacity: 48,
      serviceMs: 1,
      serviceCv: 0.3,
      hitRate: 0.9,
      queueLimit: 512,
    }),
    node('cassmeta', 'db', 'Track Metadata DB', COL(4), LROW(1, 1), {
      capacity: 6,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 48,
    }),
    node('search', 'service', 'Search API', COL(2), LROW(2, 1), {
      capacity: 8,
      serviceMs: 6,
      serviceCv: 0.4,
      queueLimit: 64,
    }),
    node('es', 'searchindex', 'Search Index (ES)', COL(3), LROW(2, 1), {
      capacity: 12,
      serviceMs: 8,
      serviceCv: 0.5,
      queueLimit: 128,
      indexMs: 60,
      indexLagMs: 2000,
      readFraction: 0.95,
    }),
    node('playlist', 'service', 'Playlist Service', COL(2), LROW(3, 1), {
      capacity: 10,
      serviceMs: 7,
      serviceCv: 0.5,
      queueLimit: 96,
    }),
    // Write-heavy: 45% writes serialise through a 3-slot / 30ms primary
    // (100 writes/s) while reads spread across 3 replicas (300 reads/s).
    node('pldb', 'replica', 'Playlist Store', COL(3), LROW(3, 1), {
      capacity: 3,
      serviceMs: 30,
      serviceCv: 0.6,
      queueLimit: 64,
      replicaCount: 3,
      replicationLagMs: 150,
      readFraction: 0.55,
    }),
    node('recs', 'service', 'Home & Discover Feed', COL(2), LROW(4, 1), {
      capacity: 10,
      serviceMs: 8,
      serviceCv: 0.5,
      queueLimit: 96,
    }),
    node('vecs', 'vectordb', 'Taste Vectors', COL(3), LROW(4, 1), {
      capacity: 16,
      serviceMs: 0.5,
      serviceCv: 0.4,
      queueLimit: 128,
      indexSizeK: 1000,
      recallTarget: 0.9,
    }),
    // Discover Weekly: a batch pipeline that exists entirely outside the
    // request path, except that its output lands in the store the online
    // path reads. The cron burst every 20s is the weekly job on a clock a
    // student can actually watch.
    node('wkcron', 'cron', 'Discover Weekly Batch', COL(0), LROW(5, 2), {
      intervalMs: 20000,
      batchSize: 300,
    }),
    node('featq', 'queue', 'Feature Job Queue', COL(1), LROW(5, 2), {
      serviceMs: 1,
      serviceCv: 0.2,
      queueLimit: 5000,
    }),
    // 8 slots / 22ms = ~360 writes/s of drain: deliberately faster than
    // the vector store can absorb on top of its online reads, so each
    // burst briefly queues the store and the online path feels it.
    node('featwork', 'worker', 'Feature Pipeline', COL(2), LROW(5, 2), {
      instances: 2,
      capacity: 4,
      serviceMs: 22,
      serviceCv: 0.4,
    }),
    // Event lane: the firehose. Producers are acked in ~1ms; each
    // outgoing edge of the broker is an independent consumer group.
    node('events', 'client', 'Event Firehose', COL(0), LROW(6, 3), {
      rps: 600,
      timeoutMs: 1500,
    }),
    node('kafka', 'streambroker', 'Event Delivery', COL(1), LROW(6, 3), {
      serviceMs: 1,
      partitions: 8,
      queueLimit: 6000,
    }),
    node('royalty', 'service', 'Royalty & Reporting', COL(2), LROW(6, 3), {
      capacity: 12,
      serviceMs: 6,
      serviceCv: 0.4,
      queueLimit: 128,
    }),
    node('analytics', 'timeseriesdb', 'Analytics Store', COL(2), LROW(7, 3), {
      capacity: 16,
      serviceMs: 1.5,
      serviceCv: 0.4,
      queueLimit: 1024,
      // Pure ingest: appends only. A range query costs ~80x an append
      // here, and with the broker delivering at most `partitions`
      // messages at once, per-delivery cost is exactly what sets a
      // consumer group's ceiling. Keeping this group cheap is what lets
      // it keep up while Royalty, at 6ms per message, falls behind.
      rangeQueryFraction: 0,
      rangeQueryMs: 120,
    }),
  ],
  edges: [
    edge('listeners', 'audiocdn'),
    edge('audiocdn', 'gcs'),
    edge('app', 'gw'),
    // The gateway's route table: metadata 35%, search 20%, playlists
    // 25%, home/recs 20%.
    edge('gw', 'meta', 7),
    edge('gw', 'search', 4),
    edge('gw', 'playlist', 5),
    edge('gw', 'recs', 4),
    edge('meta', 'metacache'),
    edge('metacache', 'cassmeta'),
    edge('search', 'es'),
    edge('playlist', 'pldb'),
    edge('recs', 'vecs'),
    edge('wkcron', 'featq'),
    edge('featq', 'featwork'),
    edge('featwork', 'vecs'),
    edge('events', 'kafka'),
    // Two independent consumer groups: royalties, and raw analytics.
    edge('kafka', 'royalty'),
    edge('kafka', 'analytics'),
  ],
  annotations: [
    sectionOver('sp-sec-audio', 'Playing the music', 0, 0, 2, 0, 0),
    sectionOver('sp-sec-app', 'Everything else the app asks for', 1, 2, 4, 1, 4, 1),
    sectionOver(
      'sp-sec-batch',
      'Recomputing recommendations offline',
      2,
      0,
      2,
      5,
      5,
      2,
    ),
    sectionOver('sp-sec-ev', 'What was played, counted twice', 3, 0, 2, 6, 7, 3),
    note(
      'sp-note-audio',
      1320,
      40,
      'Audio and everything else are separate systems. 1100 song fetches a second go to a cache near the listener, but a music catalogue has a long tail, so nearly one in five still reaches storage.',
      300,
    ),
    note(
      'sp-note-playlist',
      1320,
      240,
      'Adding a song is a write, and writes only go to the one main copy of the playlist store. It manages about 100 a second while its two read copies sit idle. Reads also run up to 150ms behind, so a song you just added can be missing when the playlist loads back.',
      300,
    ),
    // The lesson. Batch and serving sharing one store is the thing this
    // example exists to show, and it is visible at 1x on a 20 second clock.
    note(
      'sp-note-batch',
      1320,
      528,
      'Watch the taste vectors. Every 20 seconds the recommendation batch writes into the same index the home feed reads from, and the slow tail on the feed rises and falls on that clock. Turn the load up and the two fight over one store.',
      300,
    ),
    note(
      'sp-note-events',
      800,
      1024,
      'Two readers share one event stream. Turn the load up and the royalty job cannot keep up while the analytics store beside it does fine. Royalty falls behind silently, and eventually the oldest events expire before it reaches them.',
      300,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * Twitter/X: the timeline fan-out
 *
 * Based on: Raffi Krikorian, "Timelines at Scale" (QCon 2012,
 * infoq.com/presentations/Twitter-Timeline-Scalability) and the Twitter
 * engineering blog ("The Infrastructure Behind Twitter: Scale"). The
 * published design: a home timeline is PRECOMPUTED. Writing a tweet
 * fans out, one Redis timeline insert per follower, so that reading a
 * timeline is one cheap cache fetch. Roughly 300k timeline reads/s were
 * served against ~4.6k tweet writes/s, and the write path, not the
 * read path, is where the machines went. Celebrity accounts break the
 * scheme: one tweet by an account with millions of followers is
 * millions of timeline writes, so celebrities are EXCLUDED from fanout
 * and merged in at read time instead (the hybrid). Left out: the
 * hybrid read merge itself (here a cache miss rebuilds from the graph
 * and tweet store, which is the same shape), ranking, ads, DMs. All
 * numbers are illustrative, scaled to this simulator, not Twitter's.
 *
 * The traffic picture, 1x:
 *   READ   300 rps -> gateway -> timeline service -> timeline cache at
 *          hitRate 0.92. A miss rebuilds: social graph (who do I
 *          follow) + sharded tweet store, joined. Reads are CHEAP.
 *   SEARCH 1/6 of gateway traffic -> blender -> Earlybird-style index,
 *          which also ingests every tweet from the firehose group.
 *   WRITE  30 rps of tweets through a per-account rate limit (90 rps)
 *          -> write API -> sharded tweet store + the firehose broker.
 *          The fanout group is the expensive half: each delivery costs
 *          ~120ms (look up followers in the graph, insert into every
 *          follower's timeline), and the broker's 8 partitions cap the
 *          group at 8 in flight, ~55/s of drain.
 *   CELEB  every 20s a cron drops a 200-message celebrity burst
 *          straight onto the firehose: one famous tweet, 200 fanout
 *          jobs. At 1x the group drains it (~12s) just before the next.
 *
 * What breaks, and how:
 *   2x: tweets 60/s + bursts exceed the ~55/s fanout ceiling. Consumer
 *   lag on the fanout group grows and never drains: timelines go STALE
 *   while every read still returns fast and green. That is the fanout
 *   trade: reads cannot tell you the write path is drowning; only the
 *   lag can. 4x: the write limiter starts refusing tweets (loud), the
 *   search index saturates, and retention eventually starts dropping
 *   fanout messages entirely. The read row barely notices any of it.
 * ------------------------------------------------------------------ */

const twitter: Topology = {
  nodes: [
    // Read row: the cheap half. The whole point of fanout-on-write is
    // that this row is one cache hit deep for 92% of requests.
    node('readers', 'client', 'Timeline Readers', COL(0), ROW(1), {
      rps: 300,
      timeoutMs: 2000,
    }),
    node('gw', 'apigateway', 'API Gateway', COL(1), ROW(1), {
      capacity: 64,
      serviceMs: 1.5,
      serviceCv: 0.3,
      rateLimitRps: 2500,
      burst: 2500,
      authFailRate: 0,
    }),
    node('tlsvc', 'service', 'Timeline Service', COL(2), ROW(1), {
      capacity: 16,
      serviceMs: 5,
      serviceCv: 0.5,
      queueLimit: 128,
    }),
    node('tlcache', 'cache', 'Timeline Cache (Redis)', COL(3), ROW(1), {
      capacity: 32,
      serviceMs: 2,
      serviceCv: 0.4,
      hitRate: 0.92,
      queueLimit: 256,
    }),
    // A miss rebuilds the timeline the slow way: fetch the follow graph
    // and the tweets, join both. This is also the shape of the hybrid
    // celebrity merge, so it stands in for that too.
    node('tweetstore', 'shard', 'Tweet Store (sharded)', COL(4), ROW(1), {
      shardCount: 4,
      shardCapacity: 4,
      serviceMs: 12,
      serviceCv: 0.6,
      queueLimit: 64,
    }),
    node('socialgraph', 'graphdb', 'Social Graph', COL(5), ROW(2), {
      capacity: 8,
      serviceMs: 6,
      serviceCv: 0.5,
      traversalDepth: 2,
      queueLimit: 64,
    }),
    // Search: the blender fans queries to the index the firehose feeds.
    // readFraction 0.6 approximates the query:ingest mix it sees.
    node('searchsvc', 'service', 'Search Blender', COL(2), ROW(0), {
      capacity: 8,
      serviceMs: 10,
      serviceCv: 0.5,
      queueLimit: 64,
    }),
    node('searchindex', 'searchindex', 'Earlybird Index', COL(4), ROW(0), {
      capacity: 8,
      serviceMs: 8,
      indexMs: 60,
      indexLagMs: 800,
      readFraction: 0.6,
      queueLimit: 64,
    }),
    // Write row: the expensive half. A per-account limiter (write rate
    // limits are real and visible on the platform), the write API
    // persisting to the shard ring, and the firehose broker.
    node('tweeters', 'client', 'Tweet Writers', COL(0), LROW(3, 1), {
      rps: 30,
      timeoutMs: 2500,
    }),
    node('wlimit', 'ratelimiter', 'Write Rate Limit', COL(1), LROW(3, 1), {
      rateLimitRps: 90,
      burst: 120,
    }),
    node('writeapi', 'service', 'Tweet Write API', COL(2), LROW(3, 1), {
      capacity: 8,
      serviceMs: 8,
      serviceCv: 0.5,
      queueLimit: 64,
    }),
    node('firehose', 'streambroker', 'Tweet Firehose', COL(3), LROW(3, 1), {
      serviceMs: 1,
      partitions: 8,
      queueLimit: 4000,
    }),
    // The fanout group. 120ms per delivery is the follower-list lookup
    // plus one timeline insert per follower, priced as one job. The
    // broker's 8 partitions cap the group at 8 deliveries in flight,
    // which is the ceiling that matters, not this node's slot count.
    node('fanout', 'service', 'Fanout Workers', COL(4), LROW(3, 1), {
      instances: 4,
      capacity: 4,
      serviceMs: 120,
      serviceCv: 0.4,
      queueLimit: 64,
    }),
    node('tlstore', 'service', 'Timeline Store (Redis)', COL(5), LROW(3, 1), {
      capacity: 64,
      serviceMs: 2,
      serviceCv: 0.3,
      queueLimit: 512,
    }),
    // One celebrity tweet is not one message: it is a burst of fanout
    // jobs. 200 every 20s here; the real number would be millions,
    // which is exactly why the real system stopped fanning them out.
    node('celebrity', 'cron', 'Celebrity Tweet', COL(2), LROW(4, 1), {
      intervalMs: 20000,
      batchSize: 200,
    }),
    node('pushsvc', 'service', 'Push Notifications', COL(4), LROW(4, 1), {
      capacity: 6,
      serviceMs: 10,
      serviceCv: 0.5,
      queueLimit: 64,
    }),
  ],
  edges: [
    edge('readers', 'gw'),
    // The gateway's route table: 5 parts timeline, 1 part search.
    edge('gw', 'tlsvc', 5),
    edge('gw', 'searchsvc', 1),
    edge('tlsvc', 'tlcache'),
    edge('tlcache', 'tweetstore'),
    edge('tlcache', 'socialgraph'),
    edge('searchsvc', 'searchindex'),
    edge('tweeters', 'wlimit'),
    edge('wlimit', 'writeapi'),
    edge('writeapi', 'tweetstore'),
    edge('writeapi', 'firehose'),
    edge('celebrity', 'firehose'),
    // Each broker edge is an independent consumer group: fanout is the
    // expensive one, search ingest and push notifications keep up.
    edge('firehose', 'fanout'),
    edge('firehose', 'searchindex'),
    edge('firehose', 'pushsvc'),
    edge('fanout', 'socialgraph'),
    edge('fanout', 'tlstore'),
  ],
  annotations: [
    // The whole design is one trade: make reading cheap by making writing
    // expensive. Two frames, one for each half of that bargain.
    sectionOver('tw-sec-read', 'Reading a timeline', 0, 2, 5, 0, 2),
    sectionOver('tw-sec-write', 'Writing one, which costs far more', 1, 2, 5, 3, 4, 1),
    note(
      'tw-note-read',
      1584,
      40,
      'Reading a timeline is cheap because the answer was written in advance. 300 reads a second are almost all served straight from cache; only a miss goes back to look up who you follow and rebuild it.',
      300,
    ),
    // The lesson. The point is that the read side stays green throughout,
    // so the only place the failure is visible is the lag on this group.
    note(
      'tw-note-fanout',
      1584,
      496,
      'Turn the load up to 2x and watch the fan-out workers. One tweet means one insert into every follower timeline, about 120ms each, and only eight run at once. They fall behind and never catch up, so timelines go stale while every read still comes back fast and green.',
      300,
    ),
    note(
      'tw-note-celeb',
      16,
      632,
      'Every 20 seconds a famous account tweets, and that one tweet becomes 200 fan-out jobs at once. This is why very large accounts get handled differently from everyone else.',
      236,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * Stripe: correctness over availability
 *
 * Based on: Stripe's published engineering posts, "Scaling your API
 * with rate limiters" (stripe.com/blog/rate-limiters: request rate
 * limiters plus load shedders that keep critical methods working while
 * non-critical traffic is dropped), "Designing robust and predictable
 * APIs with idempotency" (stripe.com/blog/idempotency), the Stripe
 * docs on webhook retries with exponential backoff, and their ledger
 * writeups (a double-entry, append-only ledger as the source of
 * truth). Left out: the payment-intent state machine, settlement and
 * payouts clearing, multi-region, Radar's real feature stores. All
 * numbers are illustrative, not Stripe production figures.
 *
 * The shape of the lesson: a payments API is the one system in this
 * app where "just retry it" and "just shed it" are both wrong on the
 * money path. So every protection here is about REFUSING CLEANLY:
 *   - duplicate retries hit the idempotency store (a cache at
 *     hitRate 0.08: ~8% of arriving charges are retried duplicates
 *     answered from the stored response, never charged twice),
 *   - the external card networks live behind a circuit breaker; when
 *     they brown out, charges fail FAST and DEFINITIVELY instead of
 *     hanging in a state nobody can bill from,
 *   - webhooks are delivered off a retry queue with backoff; endpoints
 *     fail 12% of the time and the failures land on a dead-letter
 *     shelf instead of vanishing,
 *   - dashboards read LEDGER REPLICAS through their own limiter, so
 *     reporting load can never queue behind the money.
 *
 * The traffic picture, 1x: 100 rps of charges (gateway limiter at
 * 250), ~92 reach the payment service; each charge joins fraud check
 * (30ms) -> breaker -> card networks (250ms, the slow external truth),
 * a ledger write (15ms), and an event onto the broker. 120 rps of
 * dashboard reads fan over 3 ledger replicas. Every 25s a payout batch
 * of 150 jobs shares the ledger primary: watch its queue breathe.
 *
 * What breaks, and how: at 4x the gateway sheds ~150 rps of charges at
 * the door (loud, clean, and exactly what the rate-limiter post says
 * to do), the card-network pool runs ~90% hot so p99 stretches, and
 * dashboards are throttled to their 150 rps budget while the ledger
 * never queues. Inject an 'errors' fault on Card Networks and the breaker trips:
 * charges fail fast, nothing double-bills, webhooks drain the failures
 * with retries. Crash the Ledger and charges stop entirely while
 * dashboards keep serving off the replicas: availability is the thing
 * this system is DESIGNED to give up first.
 * ------------------------------------------------------------------ */

const stripe: Topology = {
  nodes: [
    node('merchants', 'client', 'Merchant API Calls', COL(0), ROW(1), {
      rps: 100,
      timeoutMs: 4000,
    }),
    // The front door from the rate-limiter post: a token bucket that
    // sheds excess API traffic before it can queue behind the money.
    node('gw', 'apigateway', 'API Gateway', COL(1), ROW(1), {
      capacity: 64,
      serviceMs: 2,
      serviceCv: 0.3,
      rateLimitRps: 250,
      burst: 250,
      authFailRate: 0.01,
    }),
    // Idempotency-Key dedupe: a hit is a retried duplicate answered
    // from the stored response. The 8% hit rate is the duplicate share.
    node('idem', 'cache', 'Idempotency Keys', COL(2), ROW(1), {
      capacity: 32,
      serviceMs: 2,
      serviceCv: 0.3,
      hitRate: 0.08,
      queueLimit: 128,
    }),
    node('paysvc', 'service', 'Payment Service', COL(3), ROW(1), {
      capacity: 16,
      serviceMs: 10,
      serviceCv: 0.5,
      queueLimit: 128,
    }),
    // Radar runs IN the charge path: scoring is worth 30ms of latency
    // on every charge because the alternative is charging fraudsters.
    node('fraud', 'service', 'Radar Fraud Check', COL(4), ROW(0), {
      capacity: 12,
      serviceMs: 30,
      serviceCv: 0.5,
      timeoutMs: 1500,
      queueLimit: 64,
    }),
    node('breaker', 'breaker', 'Network Breaker', COL(5), ROW(0), {
      errorThreshold: 0.5,
      windowMs: 5000,
      openMs: 4000,
      halfOpenProbes: 3,
    }),
    // The slow external truth: a card authorisation is a quarter of a
    // second somewhere you do not control and cannot blindly retry.
    node('cardnet', 'service', 'Card Networks (external)', COL(6), ROW(0), {
      capacity: 72,
      serviceMs: 250,
      serviceCv: 0.35,
      errorRate: 0.01,
      queueLimit: 128,
    }),
    node('ledger', 'db', 'Ledger (double-entry)', COL(4), ROW(1), {
      capacity: 8,
      serviceMs: 15,
      serviceCv: 0.5,
      queueLimit: 96,
    }),
    node('events', 'streambroker', 'Payment Events', COL(4), ROW(3), {
      serviceMs: 1,
      partitions: 4,
      queueLimit: 4000,
    }),
    // Webhooks, per the docs: redeliver with backoff, then give up
    // onto a shelf you can inspect, because merchant endpoints fail.
    node('webhookq', 'retryqueue', 'Webhook Delivery', COL(5), ROW(3), {
      capacity: 8,
      serviceMs: 3,
      serviceCv: 0.3,
      timeoutMs: 1000,
      retries: 2,
      queueLimit: 2000,
    }),
    node('merchantep', 'service', 'Merchant Endpoints', COL(6), ROW(3), {
      capacity: 8,
      serviceMs: 40,
      serviceCv: 0.6,
      errorRate: 0.12,
      queueLimit: 64,
    }),
    node('tsdb', 'timeseriesdb', 'Billing Metrics', COL(5), LROW(4, 1), {
      capacity: 16,
      rangeQueryFraction: 0.02,
      rangeQueryMs: 120,
    }),
    // Payouts arrive on a clock, not on demand, and share the ledger
    // primary with live charges: watch its queue breathe every 25s.
    node('payoutcron', 'cron', 'Payout Batch', COL(2), ROW(3), {
      intervalMs: 25000,
      batchSize: 150,
    }),
    node('payoutsvc', 'service', 'Payout Jobs', COL(3), ROW(3), {
      capacity: 8,
      serviceMs: 20,
      serviceCv: 0.5,
      queueLimit: 256,
    }),
    // Reporting reads never touch the primary: replicas plus their own
    // limiter mean dashboard load is structurally unable to slow money.
    node('dashboards', 'client', 'Dashboard Readers', COL(0), LROW(4, 1), {
      rps: 120,
      timeoutMs: 2000,
    }),
    node('dlimit', 'ratelimiter', 'Reporting Limiter', COL(1), LROW(4, 1), {
      rateLimitRps: 150,
      burst: 200,
    }),
    node('reportsvc', 'service', 'Reporting API', COL(2), LROW(4, 1), {
      capacity: 12,
      serviceMs: 8,
      serviceCv: 0.5,
      queueLimit: 96,
    }),
    node('replica', 'replica', 'Ledger Replicas', COL(3), LROW(4, 1), {
      capacity: 4,
      serviceMs: 20,
      serviceCv: 0.6,
      replicaCount: 3,
      replicationLagMs: 400,
      readFraction: 1,
      queueLimit: 96,
    }),
  ],
  edges: [
    edge('merchants', 'gw'),
    edge('gw', 'idem'),
    edge('idem', 'paysvc'),
    // A charge is a JOIN of three branches: the authorisation chain,
    // the ledger write, and the event publish. All must land.
    edge('paysvc', 'fraud'),
    edge('paysvc', 'ledger'),
    edge('paysvc', 'events'),
    edge('fraud', 'breaker'),
    edge('breaker', 'cardnet'),
    edge('events', 'webhookq'),
    edge('events', 'tsdb'),
    edge('webhookq', 'merchantep'),
    edge('payoutcron', 'payoutsvc'),
    edge('payoutsvc', 'ledger'),
    edge('dashboards', 'dlimit'),
    edge('dlimit', 'reportsvc'),
    edge('reportsvc', 'replica'),
  ],
  annotations: [
    sectionOver('sr-sec-charge', 'Taking one payment', 0, 2, 6, 0, 1),
    sectionOver('sr-sec-after', 'What happens after the money moves', 1, 2, 6, 3, 3),
    sectionOver('sr-sec-report', 'Reading the money back out', 2, 2, 5, 4, 4, 1),
    note(
      'sr-note-idem',
      16,
      320,
      'A payment is the one thing you must never do twice. Each charge carries a key, and a retry of a charge already made gets the stored answer back instead of a second charge.',
      236,
    ),
    // The lesson. Every protection in this example is about refusing
    // cleanly, and the breaker is where a student can watch that happen.
    note(
      'sr-note-breaker',
      1840,
      40,
      'Right click the card networks and inject errors. The breaker beside them opens, and charges start failing immediately instead of hanging. A payment that fails cleanly can be retried; one left in the air while a slow network times out is the one nobody can account for.',
      300,
    ),
    note(
      'sr-note-report',
      16,
      776,
      'Dashboards read copies of the ledger, behind their own limit. Someone loading a big report can never make a payment wait, because the two never share a queue.',
      236,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * WhatsApp: store-and-forward at absurd scale
 *
 * Based on: Rick Reed's Erlang Factory talks ("1 Million is so 2011",
 * "That's Billion with a B: scaling to the next level") and the
 * HighScalability writeup of them. The published facts this models:
 * a famously TINY system (hundreds of servers for hundreds of millions
 * of users), Erlang gateways holding about 2 MILLION tcp connections
 * per box, message routing that does almost nothing per message (with
 * end-to-end encryption the server cannot even read them), and
 * STORE-AND-FORWARD as the whole reliability story: a message to an
 * offline phone is not an error, it parks in that user's offline queue
 * (Mnesia) and is delivered when they reconnect. Media rides a
 * completely separate HTTP path into blob storage. Left out: group
 * fanout (priced into routing cost here), multi-device, presence
 * broadcast, the real Mnesia partitioning. Numbers are illustrative,
 * scaled to this simulator.
 *
 * The traffic picture, 1x:
 *   SEND    400 rps -> the Erlang router (1.5ms: the chat core idles
 *           at ~1% busy, which IS the famous lesson: simple beats big)
 *           -> recipient lookup: 70% online, pushed immediately; 30%
 *           offline, acked and parked in the offline store. The drain
 *           worker (200/s ceiling) redelivers as phones reconnect.
 *   CONNECT 45 conn/s held ~30s: ~1350 of the gateway's 1800 held
 *           connections in use. Connections, not requests, are the
 *           scarce thing, exactly as at Discord, and this box is run
 *           deliberately hot because that was the whole cost model.
 *   MEDIA   uploads and downloads on their own HTTP lane: blob store
 *           behind a cache, never touching the chat core.
 *   MIDNIGHT every 30s a 600-message burst (everyone texting at once,
 *           the published New Year's Eve peak pattern) hits the router.
 *
 * What breaks, and how: senders essentially CANNOT fail; that is what
 * store-and-forward means. At 4x the offline share (~490/s) outruns
 *   the 200/s reconnect drain and undelivered messages pile up by the
 * hundreds per second with zero sender-visible errors: the graph to
 * watch is the offline queue depth, not the error rate. Meanwhile the
 * gateway hits its connection ceiling and REFUSES new phones (loud,
 * conn-refused), the one place this system says no. Crash the offline
 * store and you lose exactly the parked messages: the queue is the
 * durability story. The router never breaks; it was never the
 * bottleneck, and that is the point.
 * ------------------------------------------------------------------ */

const whatsapp: Topology = {
  nodes: [
    node('phones', 'client', 'Message Senders', COL(0), LROW(1, 1), {
      rps: 400,
      timeoutMs: 2000,
    }),
    // The chat core: one Erlang hop. With E2E encryption the server
    // just moves ciphertext, so per-message cost is close to nothing,
    // and the node runs practically idle at any load this app offers.
    node('router', 'service', 'Erlang Router', COL(1), LROW(1, 1), {
      capacity: 48,
      serviceMs: 1.5,
      serviceCv: 0.3,
      queueLimit: 512,
    }),
    // Weighted split standing in for a presence lookup: 7 of 10
    // recipients are online right now, 3 are not.
    node('lookup', 'lb', 'Recipient Lookup (70% online)', COL(2), LROW(1, 1), {
      capacity: 256,
      serviceMs: 0.5,
    }),
    node('push', 'service', 'Push to Connected', COL(3), LROW(1, 1), {
      capacity: 32,
      serviceMs: 2,
      serviceCv: 0.4,
      queueLimit: 256,
    }),
    // Store-and-forward: the offline message is ACKED to the sender
    // and parked. Losing this node loses exactly the parked messages.
    node('offlineq', 'queue', 'Offline Store (Mnesia)', COL(3), LROW(2, 1), {
      serviceMs: 1,
      serviceCv: 0.2,
      queueLimit: 20000,
    }),
    node('drain', 'worker', 'Deliver on Reconnect', COL(4), LROW(2, 1), {
      capacity: 4,
      serviceMs: 20,
      serviceCv: 0.5,
    }),
    node('midnight', 'cron', 'Midnight Spike', COL(0), LROW(2, 1), {
      intervalMs: 30000,
      batchSize: 600,
    }),
    // The connection tier: what a gateway box actually rations. The
    // real boxes held ~2M tcp connections each; 1800 here, run at 75%
    // on purpose, because connection count WAS the capacity plan.
    node('churn', 'client', 'Phones Connecting', COL(0), ROW(0), {
      rps: 45,
      timeoutMs: 2000,
    }),
    node('wsgw', 'websocket', 'Chat Gateway (Erlang)', COL(1), ROW(0), {
      capacity: 1800,
      serviceMs: 4,
      serviceCv: 0.4,
      connectionMs: 30000,
    }),
    node('session', 'db', 'Session Store (Mnesia)', COL(2), ROW(0), {
      capacity: 16,
      serviceMs: 3,
      serviceCv: 0.4,
      queueLimit: 128,
    }),
    // Media: its own HTTP lane, exactly as published. Bytes never
    // touch the chat core.
    node('mediaup', 'client', 'Media Uploads', COL(0), LROW(3, 2), {
      rps: 25,
      timeoutMs: 4000,
    }),
    node('mediasvc', 'service', 'Media HTTP Service', COL(1), LROW(3, 2), {
      capacity: 12,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 96,
    }),
    node('blob', 'objectstore', 'Media Blob Store', COL(2), LROW(3, 2), {
      capacity: 64,
      serviceMs: 90,
      serviceCv: 0.4,
      queueLimit: 512,
    }),
    node('mediadl', 'client', 'Media Downloads', COL(0), LROW(4, 2), {
      rps: 80,
      timeoutMs: 2500,
    }),
    node('mediacdn', 'cdn', 'Media Cache', COL(1), LROW(4, 2), {
      capacity: 128,
      serviceMs: 2,
      serviceCv: 0.3,
      hitRate: 0.6,
      queueLimit: 1024,
    }),
  ],
  edges: [
    edge('phones', 'router'),
    edge('midnight', 'router'),
    edge('router', 'lookup'),
    // The split that makes store-and-forward visible: online messages
    // push through, offline ones park. Weights are the 70/30 mix.
    edge('lookup', 'push', 7),
    edge('lookup', 'offlineq', 3),
    edge('offlineq', 'drain'),
    edge('churn', 'wsgw'),
    edge('wsgw', 'session'),
    edge('mediaup', 'mediasvc'),
    edge('mediasvc', 'blob'),
    edge('mediadl', 'mediacdn'),
    edge('mediacdn', 'blob'),
  ],
  annotations: [
    sectionOver('wa-sec-conn', 'Keeping phones connected', 0, 0, 2, 0, 0),
    sectionOver('wa-sec-route', 'Sending a message, or parking it', 1, 1, 4, 1, 2, 1),
    sectionOver(
      'wa-sec-media',
      'Photos and video, on their own path',
      2,
      0,
      2,
      3,
      4,
      2,
    ),
    note(
      'wa-note-conn',
      800,
      16,
      'What runs out here is open connections, not requests. 45 phones connect a second and each holds on for 30 seconds, filling 1350 of the 1800 slots. This box is run deliberately hot, because connections were the entire cost of the system.',
      300,
    ),
    note(
      'wa-note-route',
      1320,
      232,
      'The router does almost nothing per message: it cannot even read them. At 400 a second it is about one percent busy. Simple and small beat big here, and that was the point.',
      300,
    ),
    // The lesson. Senders essentially cannot fail, which is exactly what
    // makes the pile-up invisible unless you watch the right graph.
    note(
      'wa-note-store',
      1320,
      472,
      'Turn the load up to 4x and watch the offline store, not the error rate. A message to a phone that is not online parks here until it reconnects, so senders keep succeeding while undelivered messages pile up by the hundreds a second.',
      300,
    ),
    note(
      'wa-note-media',
      800,
      568,
      'Photos and video ride a separate path and never touch the chat core, so a media outage leaves messaging alone.',
      236,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * Photo Feed: media posts and home timeline
 *
 * Reads and bytes travel apart. Feed opens hit the edge and the timeline
 * cache; only misses reach the composer and the metadata store. Uploads
 * take the lower lane: bytes land in blob storage, a queue feeds the
 * rendition farm, finished renditions land back in the store. The lab
 * ramps opens and uploads together: watch edge hit rate decide how much
 * origin load the read path really is.
 * ------------------------------------------------------------------ */

const photofeedTopology: Topology = {
  nodes: [
    node('pf-viewers', 'client', 'Feed Viewers', COL(0), ROW(0), { rps: 300, timeoutMs: 2000 }, 'Chronological home feed opens, heavily read-skewed.'),
    node('pf-edge', 'cdn', 'Edge Cache', COL(1), ROW(0), { hitRate: 0.9 }, 'Serves hot photos and feed payloads from PoPs near viewers.'),
    node('pf-api', 'apigateway', 'Feed API', COL(2), ROW(0), { capacity: 64 }, 'Authenticates opens and routes feed versus upload traffic.'),
    node('pf-tcache', 'cache', 'Timeline Cache', COL(3), ROW(0), { capacity: 128, hitRate: 0.85 }, 'Precomputed home timelines, merged at read time for mega-accounts.'),
    node('pf-composer', 'service', 'Feed Composer', COL(4), ROW(0), { capacity: 16, serviceMs: 15 }, 'Merges followee posts on a timeline-cache miss.'),
    node('pf-meta', 'db', 'Metadata Store', COL(5), ROW(0), { capacity: 16, serviceMs: 20 }, 'Photo rows indexed by author and time, plus the follow graph.'),
    node('pf-uploaders', 'client', 'Uploaders', COL(0), LROW(2, 1), { rps: 2, timeoutMs: 5000 }, 'Photo posts, roughly one per hundred feed opens.'),
    node('pf-upload', 'service', 'Upload API', COL(1), LROW(2, 1), { capacity: 8, serviceMs: 20 }, 'Mints upload URLs and records the post once bytes land.'),
    node('pf-blobs', 'objectstore', 'Blob Store', COL(2), LROW(2, 1), {}, 'Originals plus finished renditions, keyed by photo id.'),
    node('pf-encq', 'queue', 'Encode Queue', COL(3), LROW(2, 1), {}, 'Holds uploads waiting for a rendition slot.'),
    node('pf-transcode', 'transcoder', 'Rendition Farm', COL(4), LROW(2, 1), { instances: 2 }, 'Renders the lightweight previews first, full variants after.'),
  ],
  edges: [
    edge('pf-viewers', 'pf-edge', 1, 'rest', 'GET /feed', true),
    edge('pf-edge', 'pf-api', 1, 'rest', 'Cache Miss', true),
    edge('pf-api', 'pf-tcache', 1, 'rest', 'GET timeline', true),
    edge('pf-tcache', 'pf-composer', 1, 'rest', 'Cache Miss', true),
    edge('pf-composer', 'pf-meta', 1, 'sql', 'SELECT posts', true),
    edge('pf-uploaders', 'pf-upload', 1, 'rest', 'POST /photos', true),
    edge('pf-upload', 'pf-blobs', 1, 'rest', 'PUT original', true),
    edge('pf-blobs', 'pf-encq', 1, 'rest', 'Enqueue encode', false),
    edge('pf-encq', 'pf-transcode', 1, 'rest', 'Encode job', false),
    edge('pf-transcode', 'pf-blobs', 1, 'rest', 'PUT renditions', false),
  ],
  annotations: [
    sectionOver('pf-sec-read', 'Opening the feed', 4, 0, 5, 0, 0),
    sectionOver('pf-sec-upload', 'Posting a photo', 5, 0, 4, 2, 2, 1),
    note(
      'pf-note-read',
      40,
      200,
      'Nine opens in ten never reach the composer: the edge answers photo bytes and the timeline cache answers the feed. Turn the edge hit rate down and watch origin load multiply.',
      340,
    ),
    note(
      'pf-note-upload',
      40,
      520,
      'Uploads are one request in a hundred but each one is megabytes. Bytes land in the blob store first; the rendition farm works through the queue behind it.',
      340,
    ),
  ],
};

export const realworldTopologies = {
  discord, uber, netflix, spotify, twitter, stripe, whatsapp, photofeedTopology,
};
export { discord, uber, netflix, spotify, twitter, stripe, whatsapp, photofeedTopology };
