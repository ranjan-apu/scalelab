# Technology Deep Dives & Data Structures

Technical reference for core infrastructure components and algorithms frequently evaluated in system design.

---

## 1. Key Technologies Breakdown

### Apache Kafka
- **Architecture**: Distributed append-only commit log partitioned across broker nodes.
- **Partitioning & Ordering**: Strict FIFO ordering guaranteed ONLY within a single partition. Partitions determine maximum consumer concurrency within a Consumer Group.
- **Offset Management**: Consumer commits offset markers to `__consumer_offsets`.
- **Replication**: High-Water Mark (HWM) and In-Sync Replicas (ISR) prevent data loss. `acks=all` ensures replication quorum.

### Redis
- **Core Architecture**: Single-threaded event loop (epoll) for command execution, eliminating thread synchronization locks; multi-threaded I/O (Redis 6+) for network socket reads/writes.
- **Persistence**: RDB (point-in-time snapshots) + AOF (Append-Only Log with fsync policies: always, everysec, no).
- **Clustering**: Hash slots (16,384 slots) distributed across master nodes via CRC16. Sentinel provides automated master failover.

### Apache Cassandra / ScyllaDB
- **Architecture**: Masterless, decentralized peer-to-peer ring based on the Dynamo paper and Bigtable storage architecture.
- **Storage Engine**: Memtable (in RAM) + CommitLog (on disk) -> flushed to immutable SSTables -> compacted in background.
- **Tunable Consistency**: `R + W > N` guarantees strong quorum consistency (e.g. Read Quorum + Write Quorum on Replication Factor 3).

### Amazon DynamoDB
- **Architecture**: Fully managed distributed NoSQL key-value and document database built on SSD storage and Paxos consensus.
- **Partition Keys & Sort Keys**: Hash key determines storage partition; range key determines physical sort order within partition.
- **GSI (Global Secondary Index)**: Asynchronously replicated projected views with independent partition keys.

### Elasticsearch
- **Core Architecture**: Distributed search engine built on Apache Lucene.
- **Inverted Index**: Maps unique terms/tokens to a posting list containing document IDs and term positions.
- **Sharding**: Primary shards and replica shards. Near-real-time search enabled via memory segment buffers and periodic flush commits.

---

## 2. Advanced Data Structures for Big Data

### Bloom Filter
- **Purpose**: Space-efficient probabilistic data structure used to test whether an element is a member of a set.
- **Properties**: False positive matches are possible; false negatives are NEVER possible (If it returns 'not present', it is definitely not present).
- **Implementation**: Bit array of size $m$ and $k$ independent hash functions.
- **Use Cases**: Cache penetration protection, Google Bigtable row lookups, web crawler URL deduping.

### HyperLogLog (HLL)
- **Purpose**: Approximates the count of unique elements (cardinality) in massive datasets using constant memory (~1.5 KB).
- **Properties**: Standard relative error of ~1.04 / sqrt(m) (~0.81% error with 16k registers).
- **Implementation**: Observes the maximum number of leading zeros in hashed values.
- **Use Cases**: Unique daily active visitors, trending hashtag counts.

### Count-Min Sketch
- **Purpose**: Probabilistic data structure for frequency estimation of events in a streaming data flow.
- **Properties**: Sub-linear memory, over-estimates frequencies due to collisions, but never under-estimates.
- **Implementation**: 2D array of counters with $d$ hash functions and width $w$.
- **Use Cases**: Top-K heavy hitters, DDoS attack detection.

### Geospatial Indexing Structures
1. **Geohash**: Hierarchical spatial data structure that subdivides space into bucket grid cells and encodes lat/long into a Base32 string. Common prefixes imply spatial proximity.
2. **QuadTree**: Tree data structure where each internal node has exactly four children (NW, NE, SW, SE). Nodes recursively subdivide when entity density exceeds threshold.
3. **Google S2**: Projects the Earth's sphere onto a cube, dividing each face into hierarchical Hilbert curve cells.
4. **Uber H3**: Hexagonal hierarchical spatial index. Equidistant to all 6 adjacent neighbors (eliminates diagonal distortion inherent to squares).
