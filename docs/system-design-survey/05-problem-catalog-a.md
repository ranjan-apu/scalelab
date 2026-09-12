# Page 5: Problem Catalog A — Easy + first Medium batch (16)

> Site difficulty labels quoted for planning; summaries are our own paraphrases.
> `Existing` = ScaleLab coverage today. Slugs are the reference site's URL tails
> (recorded for research traceability; never surface in product).

## Easy (4)

1. **Short Link Service** (`bitly`) — shorten long URLs, redirect, count opens.
   Focus: code uniqueness (counter+base62 vs hash+retry), redirect p99 (index → cache → edge),
   1B-row scale. Existing: ✅ pack `url-shortener` + `cache-aside` preset.
2. **File Sync Store** (`dropbox`) — multi-device file sync with deltas + sharing.
   Focus: chunking/dedup, resumable upload, metadata vs blob split, sync conflicts.
   Existing: ⚠️ partial (object-storage + queue presets, no pack).
3. **Local Business Reviews** (`yelp`) — listings + reviews + geo search.
   Focus: geo index, full-text search offload, review fan-in, photos path.
   Existing: ⚠️ partial (search-index component, no pack).
4. **Neighborhood Delivery** (`gopuff` shown as "Local Delivery Service") — browse nearby
   stores, order, courier dispatch + tracking.
   Focus: geo sharding, dispatch matching, courier location stream, burst dinner-time load.
   Existing: ⚠️ partial (Uber-like preset themes overlap).

## Medium, part 1 (12)

5. **Ticket Booking** (`ticketmaster`) — browse/search events, hold + pay for seats under flash load.
   Focus: seat contention (locks/holds/expiry), waiting room, search scale. Existing: ⚠️ preset `ticketmaster` exists; no full pack — top candidate.
6. **Photo Sharing Feed** (`instagram`) — post media + caption, follow graph, chronological home feed.
   Focus: blob pipeline + CDN, feed read scale, 500M DAU. Existing: ⚠️ `twitter` preset is closest; photo path missing.
7. **Social News Feed** (`fb-news-feed`) — posts/likes, ranked/chrono feed at social scale.
   Focus: fan-out write vs read, celebrity hot keys, cache sizing. Existing: ✅ pack `timeline` + `twitter` preset covers core.
8. **Discovery / Matching Feed** (`tinder`) — profiles, swipe signals, mutual-match messaging, geo-bounded discovery.
   Focus: geo shards, reciprocal-match detection, mostly-read discovery path. Existing: ❌ new shape.
9. **Code Judge + Contest Board** (`leetcode`) — problem library, async code runs, contests + leaderboard.
   Focus: judge worker pool + queue, contest burst, leaderboard updates. Existing: ⚠️ `leetcode` preset exists; no pack.
10. **Group + 1:1 Chat** (`whatsapp`, cap 100/group, 30-day offline) — send/receive, multi-device,
    media offload, presence/last-seen. Focus: connection sharding vs pub/sub, heartbeats/ACKs,
    sequence gap detection, exactly-once-approx. Existing: ✅ pack `group-chat` + `whatsapp` preset.
11. **Activity Tracking App** (`strava`) — ingest workout GPS streams, feed + segments/leaderboards.
    Focus: write-heavy geo-time ingest, segment aggregation, social feed reuse. Existing: ❌ new.
12. **Distributed Cache Design** (`distributed-cache`) — infra problem: sharded TTL cache itself.
    Focus: hashing/rebalance, stampede, eviction, hot keys. Existing: ✅ concepts + cache pieces; pack optional.
13. **Rate Limiter** (`distributed-rate-limiter`) — token/leaky bucket at edge, distributed counting.
    Focus: per-key counters, burst vs sustained, gateway enforcement. Existing: ✅ component + preset.
14. **Online Auction** (`online-auction`) — list, bid, close with single-winner correctness.
    Focus: bid contention/ordering, closing-time spikes, anti-sniping. Existing: ❌ new (contention showcase).
15. **Video Sharing Platform** (`youtube`) — uploads, async transcode, segmented adaptive streaming.
    Focus: resumable upload, encode DAG, CDN segments. Existing: ⚠️ Netflix/Spotify presets touch it; no pack.
16. **Job Scheduler** (`job-scheduler`) — schedule + run recurring/one-off jobs reliably.
    Focus: durable triggers, delay queues, exactly-once-approx execution, shard ownership.
    Existing: ⚠️ cron/worker/queue pieces exist; no pack.

ScaleLab reuse notes for this batch: strongest pack candidates are **Ticket Booking**,
**Photo Feed**, **Code Judge** (presets already exist → packs are cheap). New-shape
candidates: **Matching Feed**, **Activity Tracker**, **Auction** (need new presets).

Next → Page 6: `06-problem-catalog-b.md`
