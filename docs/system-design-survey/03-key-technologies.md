# Page 3: Key Technologies (~13 categories + 9 deep-dives)

> Summarized in own words. "Pick one per category you can defend" is the site's stance;
> breadth before depth (depth scales with level).

## Categories observed

1. **Core Database — Relational (Postgres et al.)**: tables + SQL, joins (power + bottleneck),
   arbitrary/B-tree/multi-column indexes, ACID transactions. Default for product interviews.
2. **Core Database — NoSQL (Dynamo/Cassandra/Mongo)**: flexible schema, horizontal scale via
   hashing/sharding; key-value / document / wide-column / graph flavors; consistency knobs.
   Site warns against generic "SQL vs NoSQL" speeches — talk about your pick's features.
3. **Blob Storage (S3/GCS/Azure Blob)**: infinite-scale unstructured bytes; DB holds pointer URLs.
   Upload via presigned URL → notify → status; download via presigned URL through CDN.
   Multipart/chunked + resume for large files. Durability via replication/erasure coding.
4. **Search-Optimized DB (Elasticsearch/Lucene)**: inverted index + tokenize + stem + fuzzy;
   sharded like a DB. Alternative: in-DB full-text (Postgres GIN) for small footprint.
5. **API Gateway**: single edge entry — routing, auth, rate-limit, logging. Fine to include
   by default; rarely deep-dived.
6. **Load Balancer**: distribute over horizontally-scaled workers; L4 for sticky/persistent
   (sockets), L7 for content routing. Draw once at edge unless a tier needs its own.
7. **Queue (SQS/RabbitMQ-style)**: buffer bursts + decouple producer/consumer; FIFO default;
   retries, dead-letter queue, partitioned scaling, **backpressure** (reject/shed/slow when full).
   Avoid on strictly synchronous low-latency paths.
8. **Streams / Event Sourcing (Kafka-style)**: retained log, replay, multi consumer-groups,
   partition-key scaling. For real-time analytics at volume, audit/replay needs, pub/sub fan-out.
9. **Distributed Lock**: TTL leases, fencing, cron-vs-lock for expiry sweeps; contention path.
10. **Distributed Cache (Redis/Memcached)**: see Page 2 §5; consistent-hash sharding.
11. **CDN + Edge Compute**: static/segment cache at edge; upload origin + edge fan-out.
12. **Compute / Workers**: request servers vs async worker pools (covered more in Patterns).
13. **Coordination / Metadata (ZooKeeper-style)**: leader election, config, membership
    (deep-dive page exists; rarely front-and-center in product interviews).

## Named tech deep-dives listed in nav (9)

`Redis`, `Elasticsearch`, `Kafka`, `API Gateway`, `Cassandra`, `DynamoDB`, `PostgreSQL`,
`Flink` (stream processing), `ZooKeeper` (coordination).

## ScaleLab component coverage check

| Needed | ScaleLab has today |
|---|---|
| Gateway, LB, Service, Worker, Queue, Retry queue | ✅ |
| DB, Cache, Write-behind, Read replicas, Sharded store | ✅ |
| Object storage, Search index, Stream broker, Pub/sub, WS gateway, Lambda, Cron | ✅ |
| Rate limiter, Shedder, Breaker, Bulkhead, Autoscaler, Sidecar, Region | ✅ |
| Flink-like stream processor / ZK-like coordinator as first-class boxes | ❌ (acceptable — model as Worker + Sidecar/Region notes; don't add boxes for parity alone) |

Next → Page 4: `04-common-patterns.md`
