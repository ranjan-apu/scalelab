# Page 4: Common Patterns (7)

> The site's core thesis (paraphrased): interviews reward pattern recognition — name the
> pattern, apply the known-good shape, spend time on what's novel. Breakdowns tag which
> patterns they use.

1. **Pushing Real-time Updates** — polling → SSE → WebSocket ladder; server side via
   pub/sub (chat/notify) or stateful ring (heavy/collaborative). Used by chat, feed,
   live-comments, docs, presence problems.
2. **Dealing with Contention** — many writers, one resource (seats, bids, inventory):
   pessimistic lock vs optimistic concurrency vs TTL distributed lock vs queue serialization;
   idempotency keys for safe retry. Used by ticketing, auction, sale, payment problems.
3. **Multi-step Processes** — saga/orchestration vs choreography; durable execution +
   delay queues for timeouts/retries; DLQ for poison steps. Used by ride matching,
   scheduler, payment, delivery problems.
4. **Scaling Reads** — cache-aside, read replicas, search-index offload, CDN/edge,
   precompute/materialize (timeline, top-K). Used by feed, video, shortener, search problems.
5. **Scaling Writes** — sharding + partition keys, batching/buffering, queue absorption,
   geo-sharding. Used by location streams, click logs, metrics, chat problems.
6. **Handling Large Blobs** — presigned direct-to-storage upload, chunked/resumable,
   async transcode/encode pipeline, segmented + adaptive-bitrate delivery via CDN.
   Used by video, photo, file-sync, chat-media problems.
7. **Managing Long-Running Tasks** — sync validate → enqueue with job ID → worker pool →
   poll/subscribe status; retries + DLQ. Only when jobs are seconds+; else stay synchronous
   for clearer backpressure. Used by video encode, judge/runner, report, crawl-fetch problems.

## Pattern × problem quick-tag (our inference for planning)

- Feed / Top-K / Search / Shortener → Scaling Reads (+ Realtime for live variants)
- Ticket / Auction / Sale / Payment / Inventory → Contention (+ Multi-step for checkout flows)
- Chat / Notify / Live / Docs / Presence → Realtime (+ Scaling Writes for fan-out)
- Video / Files / Media-chat → Large Blobs (+ Long-Running for encode)
- Crawler / Scheduler / Judge / Metrics / Clicks → Long-Running + Scaling Writes (+ Multi-step)

Next → Page 5: `05-problem-catalog-a.md`
