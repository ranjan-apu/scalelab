# Battle-Tested Architectural Patterns

This guide provides deep dives into the 7 recurring distributed system patterns encountered in enterprise systems and technical interviews.

---

## Pattern 1: Dealing with Contention & Hot Keys

### The Problem
When thousands of concurrent requests attempt to mutate the same resource (e.g. booking the last concert seat, buying a flash-sale item, or liking a celebrity post), standard database updates cause row lock exhaustion, transaction deadlocks, and connection starvation.

### Solutions & Tradeoffs
1. **Pessimistic Locking (`SELECT ... FOR UPDATE`)**:
   - *Mechanism*: Database acquires an exclusive lock on the row for the transaction duration.
   - *Pros*: Complete isolation, zero application-level rollback complexity.
   - *Cons*: Poor concurrency, thread pooling bottlenecks, catastrophic under >100 QPS on a single row.
2. **Optimistic Concurrency Control (OCC)**:
   - *Mechanism*: Reads record with version integer (`v1`). Updates via `UPDATE items SET stock = stock - 1, version = version + 1 WHERE id = :id AND version = :v1`.
   - *Pros*: Non-blocking reads, excellent when collision rate is low.
   - *Cons*: Catastrophic abort and retry storm under extreme contention.
3. **In-Memory Atomic Decrement (Redis Lua Script)**:
   - *Mechanism*: Store inventory count in Redis. Execute single-threaded Lua script checking `stock > 0` and decrementing atomically.
   - *Pros*: Handles 100,000+ QPS with sub-millisecond execution.
   - *Cons*: Requires durable reconciliation pipeline to primary database.
4. **Queue-Based Serialization (Actor Pattern / Kafka Partitioning)**:
   - *Mechanism*: Route all mutations for entity `X` to a single Kafka partition or in-memory actor. Single worker processes sequentially.
   - *Pros*: Zero lock overhead, completely eliminates race conditions.
   - *Cons*: Bounded by single-thread worker execution throughput.

---

## Pattern 2: Handling Large Blobs & File Uploads

### The Problem
Routing multi-gigabyte video or image payloads directly through application servers consumes memory buffers, monopolizes thread pools, and triggers gateway timeouts.

### Solutions & Tradeoffs
1. **Direct-to-Object-Storage Uploads via Presigned URLs**:
   - *Flow*: Client requests upload authorization -> App server generates signed S3 URL with 15-minute expiration -> Client streams bytes directly to S3 via `PUT` -> S3 emits bucket event notification (SNS/SQS) to trigger async transcoding.
   - *Benefit*: Application servers handle zero data payload; unlimited horizontal upload scaling.
2. **Multipart & Resumable Chunked Uploads**:
   - *Flow*: Split file into 5MB - 20MB chunks. Client uploads chunks concurrently. On network drop, client re-transmits only missing chunk indices. S3 reassembles upon completion.
3. **Content-Defined Chunking & Deduplication (Rabin Fingerprints)**:
   - *Flow*: Identify variable-length chunk boundaries based on data content. Hash chunks (SHA-256) and check central block database before upload. Skip uploading existing blocks.

---

## Pattern 3: Managing Long-Running Tasks

### The Problem
Tasks taking >2 seconds (video encoding, report generation, complex ML inference) cannot be executed synchronously within HTTP request-response cycles.

### Solutions & Tradeoffs
1. **Asynchronous Worker Queue Pattern**:
   - *Flow*: Client submits task -> Server generates `job_id`, records `status: QUEUED` in DB, enqueues message to Kafka/RabbitMQ -> Returns HTTP `202 Accepted` with `Location: /jobs/{job_id}` -> Worker fleet consumes message and processes -> Updates DB to `status: COMPLETED`.
2. **Client Notification Mechanisms**:
   - *Polling*: Client polls `GET /jobs/{job_id}` every 2 seconds with exponential backoff. Simple, but incurs redundant requests.
   - *Webhooks*: For server-to-server systems, worker sends HTTP POST to caller's registered callback URL upon completion with HMAC signature.
   - *WebSockets / SSE*: For browser clients, server pushes completion notification over open connection.
3. **Failure Isolation**:
   - Implement Dead Letter Queues (DLQ) after 3-5 exponential retries to prevent poison-pill jobs from stalling queues.

---

## Pattern 4: Multi-Step Processes & Distributed Transactions (Sagas)

### The Problem
A business workflow spans multiple microservices (e.g. Order Service -> Inventory Service -> Payment Service -> Shipping Service). Traditional Two-Phase Commit (2PC) creates blocking locks, poor availability, and tight coupling.

### Solutions & Tradeoffs
1. **Choreographed Saga**:
   - *Mechanism*: Services publish domain events to message broker. Next service listens, executes, and publishes its event.
   - *Pros*: Highly decoupled, no single coordinator bottleneck.
   - *Cons*: Hard to visualize workflow state; complex cyclical dependency debugging.
2. **Orchestrated Saga**:
   - *Mechanism*: Central Saga Orchestrator (e.g. Temporal, AWS Step Functions) maintains workflow state machine and explicitly invokes each service via RPC/gRPC.
   - *Pros*: Clear state tracking, centralized compensation logic (rollback triggers if Step 3 fails).
   - *Cons*: Additional infrastructure layer and coordinator point of failure.
3. **Transactional Outbox Pattern**:
   - *Mechanism*: Write domain entity update AND event payload into same database transaction (Outbox table). Dedicated Debezium / CDC daemon reads WAL and pushes event to Kafka, guaranteeing at-least-once message delivery without dual-write inconsistency.

---

## Pattern 5: Real-Time Updates & Bidirectional Sync

### Protocol Evaluation
- **WebSockets**: Full duplex, persistent TCP. Best for collaborative tools, multiplayer games, and active two-way messaging.
- **Server-Sent Events (SSE)**: HTTP-native unidirectional push. Best for LLM token streams, live notifications, and price tickers.
- **Push Notifications (APNS / FCM)**: For waking inactive mobile applications when persistent connections are closed.

### Scaling Connection Fleets
- **Connection Holding Gateway Tier**: Lightweight, stateful proxy layer (Erlang/Elixir, Go, Node) holding millions of open socket connections.
- **Redis Pub/Sub / NATS Backbone**: When a message targets `user_123`, the message router publishes to Redis. The specific gateway server holding `user_123`'s socket connection picks up the event and writes to the client socket.

---

## Pattern 6: Scaling Reads (Read-Heavy Architectures)

### Techniques
1. **Multi-Tier Caching**:
   - L1: Browser / In-memory app cache.
   - L2: Edge CDN (Cloudflare / CloudFront) for static assets and public cached API endpoints.
   - L3: Distributed Redis cluster for personalized user models.
2. **Read Replicas & Database Load Balancing**:
   - Asynchronous replication to multiple read replicas.
   - Direct all read traffic to replicas; write traffic to primary.
   - Mitigate replication lag using 'Read-Your-Own-Writes' session tokens: route reads from the authoring user to primary for 5 seconds after a mutation.
3. **CQRS (Command Query Responsibility Segregation)**:
   - Separate write models (normalized PostgreSQL) from read models (denormalized Elasticsearch or MongoDB read projections).

---

## Pattern 7: Scaling Writes (Write-Heavy Architectures)

### Techniques
1. **Write-Behind / Write Buffering**:
   - Buffer writes in Apache Kafka or Redis Streams before batching into cold storage.
2. **Database Sharding**:
   - Partition data across physical nodes using a high-cardinality shard key.
3. **LSM-Tree Storage Engines**:
   - Utilize append-only log structures (Cassandra / RocksDB) that convert random writes into sequential disk writes.
4. **Denormalization & Pre-Aggregation**:
   - Pre-compute rollups (hourly counters) using stream processing engines (Flink) rather than executing expensive `COUNT(*)` queries on read.
