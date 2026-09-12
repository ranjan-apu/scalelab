# Page 7: Breakdown Anatomy (template + 6 samples, own words)

## The template every written breakdown follows (observed headings)

1. Understanding the Problem (scope questions)
2. Functional Requirements (3–5)
3. Non-Functional Requirements (latency/availability/scale/consistency)
4. The Set Up / Planning the Approach (which slice first)
5. Core Entities (tables/keys that drive design)
6. API / System Interface (endpoints + protocol why)
7. High-Level Design (numbered per-capability build-up, Bad→Good→Great micro-ladders)
8. Potential Deep Dives (2–6 questions, each with option ladder + tradeoff)
9. Final Design (assembled diagram)
10. What is Expected at Each Level (Mid / Senior / Staff+)

This is the shape our `InterviewPack` should keep mirroring (see Page 1 mapping).

## Sampled structures (paraphrased, no copied sentences)

**A. Short-link service** — HLD: submit→store, open→lookup→redirect, stats off the hot path.
Deep dives: (1) uniqueness — prefix-strip (bad) / hash+retry (great) / counter+base62 with
block allocation (great); (2) redirect speed — index → memory cache → edge; (3) 1B-row scale —
shard by code, head-cache sizing. Levels: Mid = working CRUD+cache; Senior = scale math +
shard/cache reasoning; Staff+ = edge + analytics separation.

**B. Photo-sharing feed** — HLD: post→blob+metadata, follow edge, chrono feed merge.
Deep dives: (1) feed latency <500 ms — precompute vs merge; (2) instant media — chunked upload,
multi-format/segment store, CDN; (3) 500M DAU — user-shard + replica + head cache.
Levels scale with media-pipeline depth and feed-fanout reasoning.

**C. Ride-share** — HLD: fare estimate → request → match → trip machine → dropoff/pay.
Deep dives: (1) location ingest+proximity — DB writes (bad) / batched + geo-index (good) /
in-memory geo store (great); adaptive update intervals; (2) double-dispatch — app lock (bad) /
DB status+timeout (good) / TTL distributed lock (great); (3) peak absorption — no queue (bad) /
queue+autoscale (great); delay-queue/durable-exec for no-response; geo-shard+replicas for scale.

**D. Ticket booking** — HLD: browse → search → hold → pay → confirm.
Deep dives: (1) holds — long DB locks (bad) / status+expiry+sweeper (good) / implicit-expiry read
+ TTL lock (great); (2) browse scale — cache+LB+horizontal; (3) booking UX — SSE seat updates,
virtual waiting room; (4) search — indexing → in-DB full-text → dedicated search engine;
(5) repeated-query speed — result + edge caching.

**E. Team chat** — HLD: gateway holds sockets → route → persist → fan-out → offline buffer;
media via direct-to-storage references. Deep dives: (1) billions of sockets — naive scale (bad) /
per-user topics (bad) / hashed chat servers (good) / pub-sub offload (great) with 1:1-vs-100-group
math; (2) multi-device; (3) socket failure — TCP timeout (bad) / ACK+retry (good) / app heartbeats
(great); (4) missed delivery — poll / per-chat sequence+gap / heartbeat-piggyback; (5) ordering;
(6) last-seen — per-heartbeat DB write (bad) / derive from live connections (great).

**F. Video platform** — HLD: upload → transcode DAG → segment store → CDN adaptive playback.
Deep dives: raw-store (bad) → multi-format (good) → segmented multi-bitrate (great);
progressive-vs-adaptive playback; resumable/chunked upload; daily volume sharding.
"More to consider" list invites DRM, analytics, comments as follow-ups.

## Takeaway for ScaleLab packs

Keep: numbered HLD build-up + 2–4 deep dives with approaches + tradeoff.
Add (optional, backward-compatible): per-deep-dive option ladder (`bad/good/great` as
teaching notes, original wording) and per-pack `levelExpectations { mid, senior, staff }`.

Next → Page 8: `08-advanced-wild-quiz-practice.md`
