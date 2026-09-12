# Page 2: Core Concepts (9 fundamentals)

> Paraphrased summaries. Each concept below links conceptually (not literally) to a
> deeper article on the reference site. Mapped to ScaleLab's glossary/simulation.

## 1. Networking Essentials
- Default: HTTP over TCP; JSON REST covers ~90% of interviews.
- Real-time choice: polling → SSE (server→client push) → WebSocket (bidirectional).
  Stateful connections need sticky/persistent LB thinking.
- Internal: gRPC (binary, HTTP/2) for service-to-service; REST at the edge.
- L7 LB routes on content; L4 LB is dumber/faster and suits persistent connections.
- Geography: speed-of-light floor (~80 ms NY↔London); CDN + regional deploy for global p99.
- Pitfall flagged: reaching for WebSockets when polling/SSE would do.
- ScaleLab map: `CDN`, `Edge compute`, `WebSocket gateway`, `Load balancer`, `API gateway`
  components + Diurnal/Spike traffic shapes.

## 2. API Design
- REST default for resource CRUD; 4–5 endpoints in ~2 min, then move on.
- Pagination: cursor for live-growing lists, offset otherwise. Auth: JWT (users),
  API keys (service-to-service). Mention rate limiting for abuse-prone APIs.
- ScaleLab map: `PackApi` already enforces protocol + why + endpoints. No change needed.

## 3. Data Modeling
- Start normalized relational; denormalize hot read paths deliberately.
- NoSQL key design is access-pattern-first (partition + sort key decide which queries are cheap).
- ScaleLab map: `entities` field; future lesson prompts can ask "which queries are
  single-partition vs scatter-gather?"

## 4. Database Indexing
- B-tree default (exact + range); hash for exact-only; full-text (inverted index) and
  geo indexes as specialized add-ons, often synced via CDC with slight staleness.
- Interview move: index the columns in your stated query patterns; composite for
  multi-filter queries.
- ScaleLab map: glossary candidates (`index`, `inverted index`, `CDC`).

## 5. Caching
- Default pattern: cache-aside with Redis (~1 ms vs 20–50 ms DB).
- Hard parts: invalidation (write-through/invalidate + short TTL), stampede/thundering
  herd (lock/early-refresh/staggered TTL), full-outage fallback (in-process cache,
  breaker, degrade).
- Cache only hot, rarely-changing data; CDN = static/edge, in-process = flags/config.
- ScaleLab map: `Cache`, `Write-behind cache`, `CDN` components + cache-aside preset;
  retry-storm preset already shows stampede dynamics.

## 6. Sharding
- Trigger: TB-scale storage, >~10k wps, or replica-exhausted reads — not by default.
- Shard-key choice decides fast vs expensive queries (user-shard = fast user scope,
  costly global aggregation). Hash for evenness; range for natural tenancy (hot-spot risk);
  directory/LUT flexible but adds hop.
- Costs: no cross-shard transactions (design boundaries to avoid; else saga),
  hot keys, painful resharding.
- ScaleLab map: `Sharded store`, `Read replicas` + sharded-DB preset.

## 7. Consistent Hashing
- Ring of servers + keys; add/remove moves only neighboring range (~1/N data, vs ~90%
  with `hash % N`). Used by distributed caches, Dynamo/Cassandra-style stores, some LBs, CDNs.
- Interview use: mention by name when elastic add/remove of nodes matters; skip internals
  unless asked.
- ScaleLab map: glossary entry; autoscaler + sharded-store lessons.

## 8. CAP Theorem (+ PACELC nuance)
- During partitions choose Consistency vs Availability; healthy-network tradeoff is
  Consistency vs Latency (PACELC).
- Default eventual consistency (feeds, recs, analytics); strong consistency for
  money/inventory/seats. Mixed models per subsystem are normal.
- ScaleLab map: glossary (`eventual consistency`, `strong consistency`); Ticketmaster-style
  pack is the strong-consistency showcase.

## 9. Numbers to Know (decision-time math, not opener)
- Latency tiers: mem ns → SSD µs → intra-DC ms → intercontinental 10s–100s ms.
- Single-box ceilings (order-of-magnitude, per site): App ~100k conns; Redis ~100k+ ops/s,
  ~1 ms; DB ~10k–50k tps, TBs per node; queue broker ~1M msg/s.
- Scale triggers: cache hit <80%, CPU >70%, queue lag growth, DB write >~10k TPS.
- ScaleLab map: our simulation **generates** these numbers live — estimator text in packs
  (`estimations`) should stay order-of-magnitude and point at the sim for proof.

Next → Page 3: `03-key-technologies.md`
