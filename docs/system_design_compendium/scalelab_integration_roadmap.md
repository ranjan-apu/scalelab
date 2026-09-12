# ScaleLab Studio: System Design Integration Roadmap

This roadmap details how to incorporate the 32 problem breakdowns, 9 core concepts, 7 patterns, and deep dives directly into ScaleLab Studio.

---

## Architectural Alignment with ScaleLab

ScaleLab already contains:
1. **A Discrete-Event Queueing Engine**: Simulating real queue depths, concurrency limits, gamma service distributions, retry storms, circuit breakers, and Little's Law mechanics.
2. **34 Architecture Components**: Covering Traffic, Compute, Data, Specialized Stores, Messaging, and Control components.
3. **26 Ready-to-Run Simulation Presets**: Including production systems (Discord, Uber, Netflix, Twitter, Stripe, WhatsApp).
4. **Guided Practice Packs**: Step-by-step problem walkthroughs pinnable to the diagramming canvas.

---

## Phased Implementation Blueprint

### Phase 1: Guided Interview Practice Packs Expansion
Currently, ScaleLab features 3 practice packs (`Timeline Feed`, `URL Shortener`, `Group Chat`). We will expand this to cover the top tier of foundational interview questions:

1. **Pack 4: Ticket Booking & Seat Reservation (Page 25)**
   - *HLD Preset*: High-contention seat lock simulation.
   - *Key Focus*: Temporary seat holds, Redis atomic reservation scripts, and virtual queue shedder.
2. **Pack 5: Distributed Rate Limiter (Page 06)**
   - *HLD Preset*: Token bucket rate limiter at the API gateway.
   - *Key Focus*: Sliding window counter, Redis Lua scripts, and client-side retry mitigation.
3. **Pack 6: Ad Click Aggregator (Page 01)**
   - *HLD Preset*: Kafka stream broker into Flink aggregator and time-series database.
   - *Key Focus*: Tumbling windows, deduplication with Bloom filters, and hot-key partition salting.
4. **Pack 7: Payment System with Ledger & Idempotency (Page 22)**
   - *HLD Preset*: Stripe-like double-entry ledger with retry storm and circuit breaker.
   - *Key Focus*: Idempotency keys, saga orchestration, and dead-letter queue recovery.
5. **Pack 8: Ride-Sharing Dispatch & Location Ingestion (Page 28)**
   - *HLD Preset*: Uber-like high-frequency driver pings into spatial index.
   - *Key Focus*: H3 spatial hexagons, ring search candidate dispatch, and WebSocket location sync.

### Phase 2: Preset Topologies Expansion
Map each remaining problem to a runnable canvas topology in `src/sim/presets.ts`:
- **Flash Sale (Page 11)**: Client burst -> Virtual Waiting Room -> Redis Hold -> Kafka -> DB Sync.
- **Metrics Monitoring (Page 18)**: Agent -> Kafka -> TSDB (Chunked Buffer) -> Downsampling Worker -> Rollup Store.
- **Top-K Heavy Hitters (Page 27)**: Stream Producer -> Partitioned Workers (Count-Min Sketch) -> Global Merger -> Top 100 Cache.
- **Web Crawler (Page 29)**: URL Frontier -> Host Queue with Delay -> DNS Cache -> Worker Fleet -> Deduplicator -> Object Store.

### Phase 3: Interactive Lesson & Concept Studio
Introduce an educational lesson drawer in ScaleLab UI:
- **Concept Modules**:
  - *Module 1: Concurrency & Locks* (Simulating row locks vs Redis Lua vs queue serialization).
  - *Module 2: Caching Mechanics* (Simulating cache-aside, cache penetration, and stampedes).
  - *Module 3: Resilient Delivery* (Simulating retry storms, circuit breakers, and dead-letter queues).
- **Interactive Sandbox Experiments**: Each concept module loads a mini-canvas with interactive step-by-step guidance and live traffic verification.
