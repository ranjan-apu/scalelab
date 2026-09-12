# Page 8: Advanced Topics + In the Wild + Quizzes + Practice

## Advanced deep-dives (5, nav-observed)

- **Proximity Search** — geo indexes, geohash/S2-style cells, ride/discovery queries.
- **Time-Series Databases** — metrics retention, downsampling, alert evaluation windows.
- **Data Structures for Big Data** — sketches (HyperLogLog, Bloom, Count-Min) for
  approximate answers at volume.
- **Vector Databases** — embedding index (ANN) for similarity search; RAG-adjacent retrieval.
- **Change Data Capture** — log-tail sync from primary DB to search/cache/analytics followers.

ScaleLab relevance: sketches + TSDB + vector-store are the three component gaps most worth
a glossary-first treatment (no new canvas boxes required initially).

## In the Wild — real-world posts (5)

- All Posts index + Shopify Inventory Reservations, Discord Message Storage (ScyllaDB),
  Slack Job Queue, Figma Multiplayer, Spotify Data Lake point queries.
- Function in course: "here's how a production team actually chose" — contention, storage,
  queue, realtime-collab, and lake-query case studies.
- ScaleLab analogue: our existing real-world presets (chat, ride, video, payments, social)
  + HLD export; no new work proposed except linking packs to the closest preset.

## Quizzes (observed topics mirror Core Concepts + breakdowns)

API Design, Caching, CAP, Consistent Hashing, Data Modeling, DB Indexing, Networking,
Numbers, Sharding, + per-problem quizzes (auction, chess, AI chat, live comments, feed,
post search, top-K observed as quiz rows). Some write-ups flagged premium-only.
ScaleLab analogue: pack checkpoints already act as quiz prompts; a lightweight
multiple-choice layer could come later (not in this plan).

## Practice modes (observed)

- **Guided Practice** per question (step-by-step + AI feedback + history) — the 4 guided-only
  problems live here with no write-up.
- **Peer mocks** recommendation; **interview-question database** (reports by company).
- ScaleLab analogue: Interview Practice pane (pin-to-canvas + runnable starter) is our
  differentiated version — keep investing there rather than cloning AI feedback.

Next → Page 9: `09-integration-plan.md` (the build plan)
