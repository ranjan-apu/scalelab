# Page 6: Problem Catalog B — rest of Medium + Hard + guided-only (20)

## Medium, part 2 (4)

17. **Live Comment Firehose** (`fb-live-comments`) — high-velocity comments on live video.
    Focus: write absorption (buffer/batch), ordered fan-out, late-join catch-up. New for ScaleLab.
18. **News Aggregator** (`google-news`) — ingest articles, dedup/cluster, personalized ranking.
    Focus: crawl ingest, near-dup detection, fan-out ranking. New.
19. **Price Tracker** (`camelcamelcamel`) — watch product prices, poll + alert on drops.
    Focus: scheduled polling at scale, change detection, notification fan-out. New (scheduler+notify combo).
20. **Notification System** (`notification-system`) — multi-channel (push/SMS/email) templated sends
    with preferences + retries. Focus: channel routing, batching, DLQ, preference store.
    Partial: queue/retry pieces exist.

## Hard (12)

21. **Trending-Video Top-K** (`top-k`) — continuous most-viewed lists from view events.
    Focus: streaming counters (Flink-style), windowed aggregation, precomputed serving. New.
22. **Ride Sharing** (`uber`) — fare estimate, match nearby driver, trip state machine.
    Focus: geo ingest + proximity search, dispatch lock, queue under peak, geo-sharding.
    Partial: dispatch/order presets overlap; pack candidate.
23. **Stock Trading App** (`robinhood`) — quotes, order placement, execution + ledger.
    Focus: low-latency quotes fan-out, order contention, correctness/ledger. New (finance correctness).
24. **Collaborative Document** (`google-docs`) — concurrent editing with live presence.
    Focus: realtime sync (OT/CRDT-style), stateful session routing, conflict merge. New (hardest realtime).
25. **Web Crawler** (`web-crawler`) — frontier, fetch, dedup, index feed at web scale.
    Focus: politeness/sharding, dedup, long-running fetch pool. New.
26. **Ad Click Aggregator** (`ad-click-aggregator`) — count + bill clicks in near-real-time.
    Focus: stream ingest, windowed dedup/fraud filter, exactly-once-approx billing. New.
27. **Social Post Search** (`fb-post-search`) — full-text over social corpus with recency.
    Focus: inverted index sharding, CDC lag, ranking. Partial: search-index component exists.
28. **Payment Rail** (`payment-system`) — authorize/capture/ledger with idempotent retries.
    Focus: double-charge prevention, saga across providers, reconciliation. Partial: Stripe-like preset.
29. **Metrics + Monitoring Pipeline** (`metrics-monitoring`) — ingest host metrics, alert + dashboards.
    Focus: time-series store, downsampling/retention, alert evaluation. New (TSDB showcase).
30. **Online Chess** (`online-chess`) — matchmake, play with clocks, move relay + persistence.
    Focus: stateful game sessions, tick/heartbeat, reconnect resume. New (stateful-session showcase).
31. **Conversational AI Front-end** (`chatgpt`) — prompt → streamed completion with history + limits.
    Focus: token streaming over sockets/SSE, session affinity, queue + backpressure under bursts,
    safety/rate layers. New (streaming-LLM showcase).
32. **Flash Sale** (slug inferred `flash-sale`) — fixed inventory, massive synchronized demand.
    Focus: admission control (waiting room), inventory decrement correctness, shed low-priority load.
    New (contention + resilience showcase; pairs with our shedder/breaker sim).

## Guided-only practice, no write-up (4)

33. **Food Review App** (Medium) — listings + reviews + photos; guided practice only.
34. **Game Leaderboard** (Medium) — score submits + ranked boards; guided only.
35. **Donations Page** (Hard) — campaign pages + payment spikes; guided only.
36. **CI Runner** ("GitHub Actions", Hard) — pipeline queue + worker fleet; guided only.

## Totals

32 written + 4 guided-only = **36 problem shapes**. Site labels: 4 Easy / ~16 Medium / ~12 Hard
(+ 2 Medium + 2 Hard guided-only).

## Priority for ScaleLab (own judgment, detailed in Page 9)

- P0 (preset exists, pack cheap): Ticket Booking, Photo Feed, Code Judge, Ride Sharing.
- P1 (new, high teaching value): Auction, Flash Sale, Collaborative Doc (lite), Notification System,
  Top-K Trending, Metrics Pipeline, Web Crawler (lite), Payment Rail (lite).
- P2 (later): Live Comments, News Aggregator, Price Tracker, Trading, Post Search (deep),
  Chess, AI Chat, Food/Leaderboard/Donations/CI (guided-style).

Next → Page 7: `07-breakdown-anatomy.md`
