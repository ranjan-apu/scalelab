# Core System Design Concepts Reference

This document synthesizes the 9 foundational concepts that underpin distributed systems architecture and system design interviews.

---

## 1. Networking Essentials & Protocols

### Transport Layer
- **TCP (Transmission Control Protocol)**: Connection-oriented, guarantees ordered, reliable delivery via 3-way handshakes, sequence numbers, checksums, and congestion control (window sizing). Ideal for HTTP, databases, and file transfer.
- **UDP (User Datagram Protocol)**: Connectionless, lightweight, zero-handshake datagram transport without delivery guarantees or ordering. Ideal for real-time multiplayer gaming, video streaming (WebRTC), and DNS queries.

### Application Layer & Web Communication Protocols
| Protocol | Connection Model | Directionality | Overhead | Best Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **HTTP/1.1** | Keep-Alive TCP, head-of-line blocking per connection | Request/Response | High (repeated headers) | Legacy REST APIs |
| **HTTP/2** | Single TCP connection, binary framing, multiplexed streams | Request/Response + Server Push | Low (HPACK compression) | Modern REST APIs, microservices |
| **HTTP/3 (QUIC)** | UDP-based, zero head-of-line blocking across streams, fast 0-RTT handshakes | Request/Response | Lowest (built-in TLS 1.3) | Mobile networks, high packet loss |
| **WebSockets** | Full-duplex persistent TCP connection over upgraded HTTP port | Bidirectional | Minimal frame headers | Real-time chat, collaborative docs, live gaming |
| **Server-Sent Events (SSE)** | Unidirectional persistent HTTP/2 connection | Server-to-Client | Minimal (text/event-stream) | LLM token streaming, notifications, live stock tickers |
| **gRPC** | HTTP/2 multiplexed, Protocol Buffers binary serialization | Bidirectional / Streaming | Ultra-low (binary proto) | Internal service-to-service communication |
| **Long Polling** | Client opens HTTP request; server holds open until data available | Quasi-push | High (reconnection overhead) | Fallback when WebSockets/SSE unavailable |

---

## 2. API Design & System Interfaces

### API Architectural Styles
- **REST (Representational State Transfer)**: Resource-oriented, standard HTTP verbs (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`), stateless, hypermedia-driven.
- **GraphQL**: Schema-driven, single POST endpoint, allows clients to query exact fields, eliminating over-fetching and under-fetching. Introduces complex backend query execution and caching challenges.
- **gRPC**: Schema defined via `.proto` files, strongly typed, binary serialization, native streaming support, high throughput.

### API Hardening Patterns
1. **Idempotency Keys**: For state-mutating requests (`POST /charges`), clients supply a unique `Idempotency-Key: <UUID>`. The server caches the result of the first request; duplicates return the cached response without re-executing.
2. **Pagination**:
   - *Offset-based (`?offset=100&limit=20`)*: Simple, but suffers from O(N) database skip performance and 'page drift' when records are inserted.
   - *Cursor-based (`?cursor=eyJpZCI6MTAxfQ==&limit=20`)*: O(1) indexed lookups (`WHERE id > :cursor ORDER BY id LIMIT 20`), stable under continuous inserts.
3. **Rate Limiting Headers**: Standardized response headers:
   - `X-RateLimit-Limit`: Maximum allowed requests per window.
   - `X-RateLimit-Remaining`: Remaining budget.
   - `X-RateLimit-Reset`: Epoch timestamp when quota refreshes.
   - HTTP status `429 Too Many Requests` with `Retry-After: 30`.

---

## 3. Data Modeling & Storage Engine Selection

### Storage Paradigms Comparison
| Category | Data Structure | Concurrency / Guarantees | Strengths | Examples |
| :--- | :--- | :--- | :--- | :--- |
| **Relational (RDBMS)** | Tables, B+ Trees, Rows | ACID, Strict Foreign Keys, Joins | Financial ledgers, user accounts, complex relational integrity | PostgreSQL, MySQL, CockroachDB |
| **Document Store** | JSON / BSON documents | Base transactions, flexible schema | Rapid prototyping, user profiles, nested catalogs | MongoDB, Amazon DocumentDB |
| **Key-Value Store** | Hash tables, LSM-Trees | High QPS, simple access paths | Session states, user preferences, short URLs | DynamoDB, Redis, Memcached |
| **Wide-Column Store** | SSTables, Memtables, Sparse matrices | Tunable consistency, massive write scale | Messaging history, sensor telemetry, activity logs | Cassandra, ScyllaDB, Bigtable |
| **Time-Series DB** | Columnar chunks, Gorilla compression | Append-heavy, rollup aggregations | Server monitoring, IoT metrics, pricing history | TimescaleDB, InfluxDB, ClickHouse |
| **Graph DB** | Nodes, Edges, Adjacency lists | Index-free adjacency | Social graphs, fraud rings, recommendation paths | Neo4j, Amazon Neptune |

---

## 4. Caching Strategies & Eviction Mechanics

### Cache Topologies
- **Local In-Memory Cache (L1)**: In-process RAM (Guava, Caffeine). Zero network hop latency (<1μs), but bounded by process memory and subject to cache incoherency across server replicas.
- **Distributed Cache (L2)**: Dedicated cluster (Redis, Memcached). Shared state across all application instances, high availability via replication, but incurs network hop (1-3ms).

### Cache Access Patterns
1. **Cache-Aside (Lazy Loading)**: Application queries cache; on miss, queries database, populates cache, and returns. Database and cache are decoupled. Best for read-heavy general caching.
2. **Read-Through**: Application treats cache as main store. Cache library fetches missing data from DB automatically.
3. **Write-Through**: Application writes to cache; cache synchronously writes to DB before acknowledging. Ensures consistency; higher write latency.
4. **Write-Behind (Write-Back)**: Application writes to cache; cache acknowledges immediately and batches writes to DB asynchronously. Extreme write performance; risk of data loss on cache crash.

### Eviction Policies
- **LRU (Least Recently Used)**: Evicts items unused for the longest time. Implemented via Hash Map + Doubly Linked List.
- **LFU (Least Frequently Used)**: Evicts items accessed the fewest times. Implemented via frequency buckets and doubly linked lists.
- **FIFO (First In, First Out)**: Queue-based eviction.
- **Approximated LRU**: Samples N random keys and evicts the oldest (Redis strategy to avoid linked list locking).

---

## 5. Database Sharding & Partitioning

### Sharding Architectures
- **Vertical Partitioning**: Splitting columns across tables (e.g. separating frequently queried user profile data from large user bio/avatar data).
- **Horizontal Partitioning (Sharding)**: Splitting rows across distinct database instances based on a Shard Key.

### Shard Key Strategies
1. **Hash-Based Sharding**: `shard_id = hash(key) % total_shards`. Provides even key distribution, but makes range queries impossible (requires scatter-gather).
2. **Range-Based Sharding**: Partitions by numerical or alphabetical range (e.g. A-D, E-H). Enables efficient range queries, but prone to severe hotspots (e.g. timestamp ranges where all writes hit the newest shard).
3. **Directory-Based (Lookup) Sharding**: Central routing service maps entity IDs to shards. High flexibility to rebalance individual keys, but routing lookup becomes a single point of failure and extra latency hop.

---

## 6. Consistent Hashing

### Core Problem
Modulo hashing (`hash(key) % N`) invalidates nearly all mapped keys whenever a node is added or removed, triggering severe cache stampedes or massive database re-sharding.

### Ring Mechanics
1. **The Hash Ring**: Map both server nodes and cache keys to points on a 360-degree circle (0 to 2^32 - 1) using a uniform hash function (e.g. MD5 or MurmurHash).
2. **Lookup**: To find which node owns a key, hash the key and traverse clockwise until the first server node is encountered.
3. **Virtual Nodes (VNodes)**: To prevent uneven data distribution and hot spots, map each physical server to multiple virtual points (e.g. 256 vnodes per server). Adding/removing a server rebalances only ~1/N of total keys evenly across existing servers.

---

## 7. CAP Theorem & PACELC

### The CAP Theorem
In a distributed asynchronous network, during a network **Partition (P)**, a system can choose:
- **Consistency (C)**: Every read receives the most recent write or an error (e.g. Google Spanner, ZooKeeper).
- **Availability (A)**: Every non-failing node returns a non-error response, but without guarantee of freshness (e.g. Amazon DynamoDB default, Cassandra).

### PACELC Theorem Extension
Addresses system behavior when there is NO partition:
- **If Partition (P)**: Choose between Availability (A) and Consistency (C).
- **Else (E)**: Choose between Latency (L) and Consistency (C).
- *Examples*:
  - **PC/EC**: Google Spanner, CockroachDB (Always consistent, higher latency).
  - **PA/EL**: DynamoDB, Cassandra (Available during partition; low latency during normal operation).

---

## 8. Database Indexing: B-Trees vs LSM-Trees

| Dimension | B-Tree / B+ Tree | Log-Structured Merge Tree (LSM-Tree) |
| :--- | :--- | :--- |
| **Primary Access Strength** | Read-heavy workloads, random lookups, range scans | Write-heavy workloads, append throughput |
| **Write Mechanism** | In-place page updates; requires disk seeks or WAL append | Sequential appends to Memtable (RAM) + WAL, flushed to immutable SSTables on disk |
| **Compaction** | Page splits and tree balancing | Background merging and compaction of SSTables (Leveled or Size-Tiered) |
| **Read Overhead** | Single tree traversal (O(log N)) | Checks Memtable, then multiple SSTables; mitigated via Bloom Filters |
| **Space Amplification** | Medium (fragmented pages) | High during compaction spikes |
| **Representative DBs** | PostgreSQL, MySQL (InnoDB), Oracle, SQL Server | Cassandra, ScyllaDB, RocksDB, Google Bigtable |

---

## 9. Latency Numbers Every Systems Engineer Must Know

```
L1 cache reference ......................... 0.5 - 1 ns
Branch mispredict .......................... 3 - 5 ns
L2 cache reference ......................... 3 - 7 ns
Mutex lock/unlock .......................... 17 - 25 ns
Main memory (RAM) reference ................ 100 ns
Compress 1KB bytes with Snappy ............. 2,000 ns (2 μs)
Read 1MB sequentially from memory .......... 3,000 ns (3 μs)
SSD random read ............................ 10,000 - 50,000 ns (10 - 50 μs)
Read 1MB sequentially from SSD ............. 200,000 ns (200 μs)
Disk seek (HDD) ............................ 5,000,000 - 10,000,000 ns (5 - 10 ms)
Read 1MB sequentially from HDD ............. 10,000,000 ns (10 ms)
Round trip within same datacenter .......... 500,000 ns (0.5 ms)
Send packet California to Netherlands ...... 150,000,000 ns (150 ms)
```
