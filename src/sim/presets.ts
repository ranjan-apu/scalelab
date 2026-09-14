import type { Topology } from './types';

export interface Preset {
  id: string;
  name: string;
  /**
   * One short line for the palette row, under the name.
   *
   * Separate from `description` because the two are read in different
   * places at different moments: this is the six-word promise a student
   * scans down a list of twenty-three, while `description` is the full
   * paragraph they get once the preset is loaded and they want to know
   * what to watch. Deriving one from the other was tried and does not
   * work — the company presets all open with the same sourcing boilerplate,
   * so their first sentences are indistinguishable from each other.
   *
   * Required, so a new preset cannot silently ship without one. The map
   * this replaced was keyed by id and hand-maintained, and by the time it
   * was found seven of twenty-three presets had no note at all.
   */
  tagline: string;
  description: string;
  topology: Topology;
}

import { defaultConfig } from './presets/defaults';
import { makeNode } from './presets/helpers';
import {
  singleServer, loadBalanced, cacheAside, asyncWorkers, retryStorm,
  cdnOrigin, rateLimitedApi, circuitBreaker, readReplicas, shardedDatabase,
  autoscalingService, multiRegion, fullStack, specialisedStores, eventDriven,
  resilientDelivery,
} from './presets/foundational';
import {
  discord, uber, netflix, spotify, twitter, stripe, whatsapp, photofeedTopology,
} from './presets/realworld';
import {
  ticketmasterTopology, tinyurlTopology, leetcodeTopology,
} from './presets/interview';
import { saasTenants, streamProcessing } from './presets/platforms';

export { defaultConfig, makeNode };
export type { Topology };

export const PRESETS: Preset[] = [
  {
    id: 'ticketmaster',
    name: 'Ticketmaster: High-Concurrency Booking',
    tagline: 'Virtual queues, distributed locks & zero double-booking',
    description:
      'Production Architecture Pattern: High-concurrency flash ticket drops. A virtual waiting room throttles admissions, Redis distributed locks prevent double-booking, and circuit breakers protect payment processing.',
    topology: ticketmasterTopology,
  },
  {
    id: 'tinyurl',
    name: 'TinyURL: Extreme Read Scale',
    tagline: 'Base62 hashing, Bloom filters & 100:1 read scaling',
    description:
      'Production Architecture Pattern: Extreme read-heavy URL redirection. 92% of traffic is answered at the CDN edge and in-memory Redis cache. Base62 keys prevent collisions.',
    topology: tinyurlTopology,
  },
  {
    id: 'leetcode',
    name: 'LeetCode: Online Judge & Leaderboard',
    tagline: 'Sandboxed execution queues & real-time sorted-set rankings',
    description:
      'Production Architecture Pattern: Asynchronous code submission judge and real-time contest leaderboard. Code runs in isolated worker pools while rankings update instantaneously via Redis Sorted Sets.',
    topology: leetcodeTopology,
  },
  {
    id: 'single-server',
    name: 'Single server',
    tagline: 'Watch the database become the bottleneck',
    description:
      'One service in front of one database. Latency climbs sharply as the database fills up.',
    topology: singleServer,
  },
  {
    id: 'load-balanced',
    name: 'Load balanced',
    tagline: 'More servers, same database behind them',
    description:
      'Three servers share the load, but they all still talk to the same database.',
    topology: loadBalanced,
  },
  {
    id: 'cache-aside',
    name: 'Cache aside',
    tagline: 'What happens when the hit rate falls',
    description:
      'The cache absorbs most reads. Lower the hit rate and the database takes the whole load.',
    topology: cacheAside,
  },
  {
    id: 'async-workers',
    name: 'Async workers',
    tagline: 'A backlog that grows faster than it drains',
    description:
      'Requests are acknowledged instantly and buffered. Watch the backlog grow when workers fall behind.',
    topology: asyncWorkers,
  },
  {
    id: 'retry-storm',
    name: 'Retry storm',
    tagline: 'Retries making an overload worse',
    description:
      'A short timeout with retries in front of a small database. Retries multiply the load that caused them.',
    topology: retryStorm,
  },
  {
    id: 'cdn-origin',
    name: 'CDN and origin',
    tagline: 'How much traffic never reaches you',
    description:
      'The CDN answers most requests at the edge, so only a trickle reaches the origin. Drop the hit rate and watch the origin melt.',
    topology: cdnOrigin,
  },
  {
    id: 'rate-limited-api',
    name: 'Rate limited API',
    tagline: 'Turning excess away before it queues',
    description:
      'A limiter refuses excess traffic at the door. It serves slightly less, but what it does serve stays fast instead of queueing.',
    topology: rateLimitedApi,
  },
  {
    id: 'circuit-breaker',
    name: 'Circuit breaker',
    tagline: 'Giving a failing dependency room to recover',
    description:
      'A breaker watches a failing dependency and stops calling it. Break the payments API and watch the circuit trip, then recover.',
    topology: circuitBreaker,
  },
  {
    id: 'read-replicas',
    name: 'Read replicas',
    tagline: 'Reads that scale, and reads that go stale',
    description:
      'Replicas scale reads but not writes, and a read can arrive before the write it should have seen.',
    topology: readReplicas,
  },
  {
    id: 'sharded-database',
    name: 'Sharded database',
    tagline: 'One hot key undoing all the partitions',
    description:
      'Four partitions share the load evenly until one key gets hot, and then a single shard melts while the average still looks healthy.',
    topology: shardedDatabase,
  },
  {
    id: 'autoscaling-service',
    name: 'Autoscaling service',
    tagline: 'Capacity arriving after it was needed',
    description:
      'Capacity chases the load, but new servers take time to boot, so requests fail in the gap between the two.',
    topology: autoscalingService,
  },
  {
    id: 'multi-region',
    name: 'Multi-region failover',
    tagline: 'What a failover actually costs you',
    description:
      'Two regions, one serving. Crash the active one and every request fails until failover lands.',
    topology: multiRegion,
  },
  {
    id: 'full-stack',
    name: 'Full stack',
    tagline: 'Every piece at once, under real load',
    description:
      'Every tier at once: edge cache, load balancer, services, cache, shards, and a queue of async work behind it all.',
    topology: fullStack,
  },
  {
    id: 'specialised-stores',
    name: 'Specialised stores',
    tagline: 'The right store for each job, side by side',
    description:
      'Search, vectors, graph, blobs, metrics and an archive tier, each store built for one job. Watch which one saturates first, and which fails without a sound.',
    topology: specialisedStores,
  },
  {
    id: 'event-driven',
    name: 'Event-driven backend',
    tagline: 'Lag, fan-out, cold starts and a cron burst',
    description:
      'A stream with two consumer groups, a fan-out topic, a websocket tier, a sidecar, a lambda and a cron burst. Watch consumer lag grow, cold starts spike on the quarter-minute, and connections, not requests, run out.',
    topology: eventDriven,
  },
  {
    id: 'resilient-delivery',
    name: 'Resilient delivery',
    tagline: 'Choosing what fails, and where failures go',
    description:
      'Failing on purpose: a shedder drops the traffic that matters least, a bulkhead contains a slow dependency, retried deliveries land on a dead letter shelf, and a write-behind buffer trades durability for speed.',
    topology: resilientDelivery,
  },
  {
    id: 'discord',
    name: 'Discord: real-time chat',
    tagline: 'Millions of sockets, and fan-out per message',
    description:
      'A simplified reconstruction of Discord from their engineering blog; numbers are illustrative. The gateway runs out of connections, not requests; one message fans out to every gateway pod, and at 2x the push tier sheds deliveries the senders never see; make one channel hot and its store shard melts alone. Voice rides its own servers.',
    topology: discord,
  },
  {
    id: 'uber',
    name: 'Uber: ride dispatch',
    tagline: 'Matching riders to drivers, city by city',
    description:
      'A simplified reconstruction of Uber from their published architecture; numbers are illustrative. Driver pings outnumber rider requests 13 to 1 and ride a Kafka-style stream; at 4x the geo consumer lags and dispatch matches on stale positions without a single rider-facing error. Crash the payment processor and the breaker contains it.',
    topology: uber,
  },
  {
    id: 'netflix',
    name: 'Netflix: streaming at scale',
    tagline: 'Almost everything served from the edge',
    description:
      'A simplified reconstruction of Netflix from their tech blog; numbers are illustrative. Open Connect appliances inside ISPs serve ~96% of the bytes, so streaming barely touches the cloud; the control plane behind Zuul is where 4x hurts: licensing trips its Hystrix breaker, the recs bulkhead fills, Keystone quietly falls behind, and the encode farm backlog grows while viewers stream on.',
    topology: netflix,
  },
  {
    id: 'spotify',
    name: 'Spotify: music and discovery',
    tagline: 'A steady catalogue beside a heavy recommender',
    description:
      'A simplified reconstruction of Spotify from their engineering blog; numbers are illustrative. Audio flows from object storage through a CDN, apart from the metadata path. Playlist writes pin a replica primary while its read replicas idle, the event firehose outruns the royalty consumer at 4x, and every 20s the Discover Weekly batch writes the same vector index the home feed reads, so p99 breathes on the batch clock.',
    topology: spotify,
  },
  {
    id: 'twitter',
    name: 'Twitter/X: timeline fan-out',
    tagline: 'One tweet becoming a hundred thousand writes',
    description:
      'A simplified reconstruction of the Twitter timeline from Raffi Krikorian\'s "Timelines at Scale" talk; numbers are illustrative. Tweets fan out on write into precomputed timelines, so reads are one cache hit; every 20s a celebrity tweet dumps 200 fanout jobs on the firehose. Past 2x the fanout group never catches up again: reads stay green while timelines quietly go stale, and only the consumer lag tells the truth.',
    topology: twitter,
  },
  {
    id: 'stripe',
    name: 'Stripe: correctness over availability',
    tagline: 'Refusing work rather than charging twice',
    description:
      'A simplified reconstruction of Stripe from their published posts on rate limiters, idempotency and the ledger; numbers are illustrative. Duplicate retries answer from the idempotency store, a breaker fails charges fast when the card networks brown out, webhooks redeliver onto a dead-letter shelf, and at 4x the gateway sheds excess charges at the door while dashboards throttle against their replicas. Crash the ledger: charges stop dead, dashboards keep reading, and that ordering is the design.',
    topology: stripe,
  },
  {
    id: 'photofeed',
    name: 'Photo Feed: media posts and home timeline',
    tagline: 'Blob uploads, edge delivery and precomputed feeds',
    description:
      'A photo-sharing feed starter: media bytes travel to object storage and out through edge caches while the follow graph fans posted items into precomputed home timelines. Watch edge hit rate decide origin load, and the rendition farm work through the upload queue.',
    topology: photofeedTopology,
  },
  {
    id: 'auction',
    name: 'Auction Room: bids under contention',
    tagline: 'One item, many bidders, a single winner',
    description:
      'An auction-room starter: a waiting room meters the closing-seconds rush, atomic bid registration decides a single winner, and idempotent retries make redelivered bids safe. Watch lock contention and queue depth decide whether the close stays fair.',
    topology: ticketmasterTopology,
  },
  {
    id: 'livefirehose',
    name: 'Live Firehose: comments at broadcast speed',
    tagline: 'Buffer the burst, then fan out in order',
    description:
      'A live-comment starter: connection holders absorb the broadcast burst, a buffer smooths the burst, and fan-out workers push ordered comments to every viewer. Watch consumer lag, not error rate, when the goal goes in.',
    topology: discord,
  },
  {
    id: 'topk',
    name: 'Trending Now: windowed top-K rankings',
    tagline: 'Count the stream, serve the precomputed board',
    description:
      'A trending-board starter: view events stream into windowed counters while rankings serve from precomputed sorted sets. Watch aggregation lag versus serving latency when a video goes viral mid-window.',
    topology: leetcodeTopology,
  },
  {
    id: 'stream-processing',
    name: 'Stream Processing: events into materialized views',
    tagline: 'Consumer lag is the only metric that matters',
    description:
      'A streaming starter: one producer appends to a partitioned log, a processor pool drains it into a serving store dashboards read, and poison pills park on a dead-letter shelf. Watch consumer lag, not error rate, when ingest passes the drain rate.',
    topology: streamProcessing,
  },
  {
    id: 'saas-tenants',
    name: 'Multi-tenant SaaS: noisy neighbors',
    tagline: 'One quota and bulkhead between tenants',
    description:
      'A multi-tenant starter: a quiet tenant and a noisy tenant share one pool and one database, with a per-tenant quota and bulkhead on the noisy lane. Raise the noisy tenant and watch sheds climb while quiet p99 stays flat.',
    topology: saasTenants,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp: store and forward',
    tagline: 'Messages that wait instead of failing',
    description:
      "A simplified reconstruction of WhatsApp from Rick Reed's Erlang scaling talks; numbers are illustrative. The chat core is deliberately tiny and nearly idle: one routing hop, then online recipients get pushed and offline ones park in the Mnesia store until they reconnect, so senders essentially cannot fail. At 4x undelivered messages pile up by the hundreds per second with zero errors, and the gateway runs out of held connections, not requests. Watch the queue depth, not the error rate.",
    topology: whatsapp,
  },
];
