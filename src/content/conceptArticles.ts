import { CONCEPTS, CONCEPTS_BY_ID, type ConceptLesson, type ConceptTrack } from './concepts';
import type { DiagramType } from '../components/concepts/ConceptDiagram';

export interface ConceptArticleSection {
  title: string;
  lead?: string;
  paragraphs: string[];
  code?: { language: string; code: string };
  callout?: { type: 'note' | 'warning' | 'tip'; title?: string; text: string };
  table?: { headers: string[]; rows: string[][] };
}

export interface ConceptArticle {
  id: string;
  lesson: ConceptLesson;
  readTime: string;
  difficulty: 'Foundational' | 'Intermediate' | 'Advanced';
  diagramType: DiagramType;
  diagramTitle?: string;
  realWorldScenario: string;
  deepDive: ConceptArticleSection[];
  tradeoffs?: { headers: string[]; rows: string[][] };
  productionGotchas: string[];
  interviewProbes: { question: string; lookFor: string }[];
}

export const TRACK_INFO: Record<ConceptTrack, { label: string; badge: string; blurb: string }> = {
  core: {
    label: 'Core Fundamentals',
    badge: 'Core',
    blurb: 'The foundational architectural principles every distributed system engineer must master.',
  },
  tech: {
    label: 'Building Blocks',
    badge: 'Tech',
    blurb: 'Deep technical breakdown of specialized storage engines, proxies, caches, and compute nodes.',
  },
  pattern: {
    label: 'Architectural Patterns',
    badge: 'Patterns',
    blurb: 'Battle-tested distributed system recipes for handling scale, contention, and failure.',
  },
  advanced: {
    label: 'Advanced Topics',
    badge: 'Advanced',
    blurb: 'Specialist depth for staff-level scale: consensus, vectors, probabilistic filters, and capacity models.',
  },
};

const ARTICLEDATA: Partial<Record<string, Omit<ConceptArticle, 'id' | 'lesson'>>> = {
  'consistent-hashing': {
    readTime: '6 min read',
    difficulty: 'Intermediate',
    diagramType: 'consistent-hash-ring',
    diagramTitle: 'Consistent Hash Ring with Virtual Replicas',
    realWorldScenario:
      'In a distributed cache cluster of 100 Redis nodes, taking one node down with traditional modulo hashing (hash(key) % N) invalidates ~99% of all cached keys simultaneously. This triggers a catastrophic cache stampede that overwhelms the primary databases and brings down the site.',
    deepDive: [
      {
        title: 'The Modulo Hashing Dilemma',
        lead: 'Why simple remainder hashing fails in elastic clusters.',
        paragraphs: [
          'In traditional partitioning, keys are mapped to servers using the formula server_index = hash(key) % N, where N is the cluster size. When N changes from 10 to 11 (adding a node for peak traffic) or from 10 to 9 (a machine crash), the remainder changes for nearly every single key.',
          'Consistent hashing solves this by decoupling the key space from the number of servers. Instead of a fixed modulo range, both servers and keys are hashed into the exact same 360° integer ring (typically 0 to 2³²-1).',
        ],
        callout: {
          type: 'warning',
          title: 'The Thundering Herd Risk',
          text: 'If 99% of cache keys suddenly re-hash to new nodes that do not have the data, 100% of read traffic penetrates to the primary database within milliseconds.',
        },
      },
      {
        title: 'Ring Traversal and Virtual Nodes',
        lead: 'Ensuring balanced load distribution across heterogeneous hardware.',
        paragraphs: [
          'To locate which server holds a given key, the client hashes the key and scans clockwise around the circle until finding the first server node. When a server is added or removed, only keys residing on the adjacent segment are transferred—all other keys remain undisturbed.',
          'However, having only 3 or 4 physical server points on a circle results in severe non-uniform distribution (hotspots). To prevent this, modern systems (DynamoDB, Cassandra, Discord) assign 100 to 256 virtual nodes (vnodes) per physical machine across the ring.',
        ],
        code: {
          language: 'typescript',
          code: `// Virtual Node key mapping
function getNode(key: string, ring: Map<number, string>, sortedHashes: number[]): string {
  const hash = murmur3(key);
  // Binary search for first ring position >= hash (clockwise)
  const idx = binarySearchCeil(sortedHashes, hash);
  const targetHash = sortedHashes[idx % sortedHashes.length];
  return ring.get(targetHash)!;
}`,
        },
      },
    ],
    tradeoffs: {
      headers: ['Approach', 'Key Movement on Scale', 'Memory Overhead', 'Hotspot Vulnerability'],
      rows: [
        ['Modulo (hash % N)', '~100% of all keys', 'O(1) minimal', 'Low, but brittle'],
        ['Consistent Hashing (No Vnodes)', '1/N keys moved', 'O(N) ring table', 'High (uneven arc gaps)'],
        ['Consistent Hashing with Vnodes', '1/N keys moved evenly', 'O(N × V) ring index', 'Extremely low (even spread)'],
        ['Bounded-Load Consistent Hashing', '1/N keys moved', 'O(N × V) + load tracker', 'Zero (spillover cap 1.25×)'],
      ],
    },
    productionGotchas: [
      'Cascading Failure: If a node crashes, all its load transfers to its single clockwise neighbor. Without virtual nodes, that neighbor receives 2× traffic, promptly crashes from exhaustion, and causes a domino collapse.',
      'Heterogeneous Server Capacities: Machines with 2× RAM and CPU must be assigned 2× the number of virtual nodes on the ring to prevent early eviction.',
    ],
    interviewProbes: [
      {
        question: 'How do you handle a node crash without overwhelming the next machine on the ring?',
        lookFor: 'Using 100-256 virtual nodes per machine so the crashed node’s partitions scatter evenly across all remaining cluster members.',
      },
      {
        question: 'What happens if one single key is exceptionally hot (e.g. viral celebrity tweet)?',
        lookFor: 'Consistent hashing routes the hot key to one node. You must combine it with local L1 in-memory caching or Google’s Bounded-Load Consistent Hashing.',
      },
    ],
  },

  'caching': {
    readTime: '7 min read',
    difficulty: 'Foundational',
    diagramType: 'cache-aside-flow',
    diagramTitle: 'Cache-Aside (Lazy Loading) Request Lifecycle',
    realWorldScenario:
      'Twitter’s user timeline service handles 300,000 requests per second. Querying PostgreSQL or MySQL directly for every home feed would require millions of expensive multi-table joins per second, melting database replicas in seconds. In-memory distributed caching serves 98% of hits in sub-millisecond time.',
    deepDive: [
      {
        title: 'The Core Caching Topologies',
        lead: 'Choosing between in-process L1 caches and distributed L2 clusters.',
        paragraphs: [
          'Local in-memory caches (Guava, Caffeine, Go bigcache) live inside the application server process memory. They achieve zero-network latency (< 1 microsecond) but are bounded by machine RAM and suffer from cache incoherency when multiple replica instances disagree on updated values.',
          'Distributed caches (Redis, Memcached) sit as a dedicated cluster over the network. They offer centralized shared state, persistent data structures, and replica failover, at the cost of a 1-2ms round-trip network hop.',
        ],
      },
      {
        title: 'Cache Access Patterns Compared',
        lead: 'Cache-Aside vs Read-Through vs Write-Through vs Write-Behind.',
        paragraphs: [
          'Cache-Aside (Lazy Loading): The application code handles cache checks. On a miss, it fetches from the database and writes to the cache. This is the industry standard for resilient read-heavy workloads because cache failures do not bring down the application.',
          'Write-Through: The application writes directly to the cache, and the cache synchronously writes to the database before returning success. Provides high consistency at the cost of write latency.',
          'Write-Behind (Write-Back): The application writes to cache, which acknowledges immediately and flushes batches to the database asynchronously. Delivers extreme write throughput but risks data loss if the cache node crashes before writing.',
        ],
        code: {
          language: 'python',
          code: `# Cache-Aside with probabilistic early expiration (XFetch)
def get_user_profile(user_id):
    cached = redis.get(f"user:{user_id}")
    if cached:
        return json.loads(cached)
    
    # Cache miss: fetch authoritative record
    profile = db.query("SELECT * FROM users WHERE id = %s", user_id)
    redis.setex(f"user:{user_id}", 3600, json.dumps(profile))
    return profile`,
        },
      },
    ],
    tradeoffs: {
      headers: ['Strategy', 'Read Latency', 'Write Latency', 'Consistency', 'Data Loss Risk'],
      rows: [
        ['Cache-Aside', 'Low (~1ms on hit)', 'Normal DB write', 'Eventual (TTL / Evict on update)', 'None'],
        ['Read/Write-Through', 'Low (~1ms on hit)', 'High (synchronous dual write)', 'Strong', 'None'],
        ['Write-Behind (Write-Back)', 'Lowest (<1ms)', 'Lowest (<1ms to RAM)', 'Eventual', 'High on crash'],
        ['Refresh-Ahead', 'Zero (pre-warmed)', 'Normal DB write', 'Eventual', 'None'],
      ],
    },
    productionGotchas: [
      'Cache Penetration: Malicious queries for non-existent IDs bypass the cache and hammer the database. Fix: Bloom filters or caching null results with short TTLs.',
      'Cache Stampede (Thundering Herd): When a hot key expires, thousands of concurrent threads miss simultaneously and hammer the DB. Fix: Mutex locking or probabilistic early recomputation (XFetch).',
      'Dual-Write Race Conditions: Updating the database and deleting the cache key must be ordered correctly. Always update the database FIRST, then invalidate/delete the cache key.',
    ],
    interviewProbes: [
      {
        question: 'Should you update the cache or invalidate (delete) the cache key on data mutations?',
        lookFor: 'Invalidate (delete) the key. Updating causes concurrent race conditions where two simultaneous writes overwrite each other in the wrong order.',
      },
      {
        question: 'How do you prevent a cache stampede when a viral celebrity’s profile cache expires?',
        lookFor: 'Distributed locking (acquire mutex to recompute) or background refresh with probabilistic early expiration.',
      },
    ],
  },

  'sharding': {
    readTime: '8 min read',
    difficulty: 'Intermediate',
    diagramType: 'sharding-architecture',
    diagramTitle: 'Horizontal Sharding with Primary & Replica Topology',
    realWorldScenario:
      'Slack stores billions of messages. A single relational database instance runs out of disk storage, memory, and IOPS at approximately 10TB of active data. Sharding horizontally distributes data across dozens of independent database servers, allowing virtually limitless horizontal scale.',
    deepDive: [
      {
        title: 'Horizontal vs Vertical Partitioning',
        lead: 'Knowing when to split tables vs when to split rows across nodes.',
        paragraphs: [
          'Vertical partitioning splits distinct columns into separate databases (e.g. separating user login credentials from user biographies and media). It is simple to implement but quickly hits physical scaling ceilings.',
          'Horizontal partitioning (sharding) divides rows of a table across multiple database engines based on a Shard Key. Each shard maintains identical schema definitions but stores a disjoint subset of the data.',
        ],
      },
      {
        title: 'Selecting the Shard Key',
        lead: 'The single most consequential architectural decision in distributed storage.',
        paragraphs: [
          'The ideal shard key routes the vast majority of high-frequency queries to a single shard. For example, sharding Slack by team_id ensures that all channel messages, user presence, and reactions for an entire company live on one shard, making joins fast and atomic.',
          'Beware of cross-shard joins and scatter-gather: If a query does not include the shard key (e.g. "Find all users named Alice"), the router must broadcast the query to every single shard and merge the results in application memory.',
        ],
        code: {
          language: 'sql',
          code: `-- High efficiency: Single Shard Query (O(1) shard routing)
SELECT * FROM messages WHERE team_id = 'T1234' AND channel_id = 'C5678' ORDER BY timestamp DESC LIMIT 50;

-- Catastrophic at scale: Scatter-Gather Query (O(N) broadcast across 64 shards)
SELECT * FROM messages WHERE text LIKE '%quarterly goals%';`,
        },
      },
    ],
    tradeoffs: {
      headers: ['Partitioning Method', 'Even Data Spread', 'Range Query Support', 'Hotspot Vulnerability'],
      rows: [
        ['Hash-Based (hash(key) % N)', 'Excellent (uniform)', 'Impossible (scatter-gather)', 'Low'],
        ['Range-Based (e.g. timestamp)', 'Poor (writes hit latest)', 'Native & very fast', 'Extreme (time hotspot)'],
        ['Directory / Lookup Based', 'Completely flexible', 'Requires index scan', 'Lookup table bottleneck'],
        ['Geographic / Entity (e.g. tenant_id)', 'Tenant-dependent', 'Fast within tenant', 'High if tenant is giant'],
      ],
    },
    productionGotchas: [
      'The Celebrity Tenant Problem: If you shard by customer_id and one customer is Apple or Nike, their single shard experiences 1000× the load of other shards. Solution: Sub-partition hot tenants by compound keys (tenant_id + hash(user_id)).',
      'Distributed Transactions across Shards: Two-phase commit (2PC) over multiple database shards incurs massive latency and locking overhead. Minimize cross-shard operations by domain-driven schema design.',
    ],
    interviewProbes: [
      {
        question: 'How do you generate globally unique IDs across 100 database shards without a central bottleneck?',
        lookFor: 'Twitter Snowflake pattern (timestamp + shard_id + sequence number) or UUIDv7, avoiding auto-increment collisions.',
      },
      {
        question: 'What do you do when one shard grows 10× faster than the others?',
        lookFor: 'Re-sharding using virtual partitions or splitting the large tenant onto dedicated hardware using lookup tables.',
      },
    ],
  },

  'contention-control': {
    readTime: '7 min read',
    difficulty: 'Intermediate',
    diagramType: 'concurrency-control',
    diagramTitle: 'Concurrency Control: Pessimistic vs Optimistic vs In-Memory Lua',
    realWorldScenario:
      'When 50,000 concurrent fans attempt to purchase the final 10 tickets for a concert or book the last hotel room in a city, uncoordinated database updates cause catastrophic lock contention, transaction deadlocks, and severe connection starvation.',
    deepDive: [
      {
        title: 'The Contention Bottleneck',
        lead: 'Why standard database writes collapse under simultaneous mutations of a single row.',
        paragraphs: [
          'In traditional RDBMS updates (UPDATE items SET stock = stock - 1 WHERE id = 42), the database engine acquires an exclusive write lock on that row. Other concurrent transactions must wait in line. When request arrival rates exceed processing speed, database thread pools saturate in milliseconds.',
          'Distributed architectures resolve contention using three primary paradigms: Pessimistic Locking (lock upfront), Optimistic Concurrency Control (validate at commit), and In-Memory Single-Threaded Atomic Queues (Redis Lua).',
        ],
      },
      {
        title: 'Three Battle-Tested Concurrency Strategies',
        lead: 'Selecting the optimal tradeoff between throughput and consistency.',
        paragraphs: [
          '1. Pessimistic Locking (SELECT ... FOR UPDATE): Safest and simplest, but caps write throughput to under 100 QPS on a single row.',
          '2. Optimistic Concurrency Control (OCC): Reads record with version integer (WHERE version = 1). Updates via version increment. Extremely performant when collision rate is low, but suffers abort storms under flash-sale contention.',
          '3. Redis Lua Atomic Decrement: Executes in single-threaded RAM at 100,000+ QPS, returning an instant reservation and queueing order finalization asynchronously to disk.',
        ],
        code: {
          language: 'lua',
          code: `-- Redis Lua atomic inventory hold
local key = KEYS[1]
local requested = tonumber(ARGV[1])
local current = tonumber(redis.call('get', key) or "0")

if current >= requested then
    redis.call('decrby', key, requested)
    return 1 -- Success
else
    return 0 -- Insufficient stock
end`,
        },
      },
    ],
    tradeoffs: {
      headers: ['Strategy', 'Max Throughput', 'Contention Behavior', 'Implementation Complexity'],
      rows: [
        ['Pessimistic Row Lock', '< 100 QPS', 'Queues / blocks threads', 'Low (native SQL)'],
        ['Optimistic (OCC)', 'Medium (~1,000 QPS)', 'Abort & retry waves', 'Medium (version check)'],
        ['Redis Atomic Lua', '100,000+ QPS', 'Single-threaded RAM', 'Medium (async DB sync)'],
        ['Queue Serialization', 'High (bounded by worker)', 'Zero lock overhead', 'High (FIFO worker queue)'],
      ],
    },
    productionGotchas: [
      'Deadlocks in Multi-Item Checkouts: Acquiring locks on items in random order causes circular wait deadlocks. Always sort items canonically by ID before locking.',
      'Zombie Reservations: When holding stock in Redis for checkout, always attach a 10-minute TTL to release inventory if the user abandons the cart.',
    ],
    interviewProbes: [
      {
        question: 'How does Ticketmaster handle 100,000 users attempting to buy the same seat?',
        lookFor: 'Virtual waiting rooms to rate-limit access, combined with Redis atomic temporary holds (10-min TTL) and async payment processing.',
      },
      {
        question: 'What breaks first when the waiting room itself becomes the bottleneck?',
        lookFor: 'Admission throughput and queue position fairness: shard the waiting room and drain in arrival order with visible position.',
      },
    ],
  },

  'large-blobs': {
    readTime: '6 min read',
    difficulty: 'Intermediate',
    diagramType: 'blob-presigned-upload',
    diagramTitle: 'Direct-to-S3 Multipart Upload via Presigned URLs',
    realWorldScenario:
      'YouTube receives 500 hours of video every minute. If video files streamed directly through application web servers, server RAM buffers would exhaust, connection thread pools would freeze, and any transient network drop would require starting a 4GB upload completely over.',
    deepDive: [
      {
        title: 'Zero-Payload Application Tier',
        lead: 'Decoupling control plane authorization from binary data streaming.',
        paragraphs: [
          'In modern cloud architectures, application servers never accept binary video or large file uploads directly. Instead, the application acts strictly as an authorization and metadata control plane.',
          'The client requests an upload authorization. The server authenticates the user, generates a cryptographically signed Presigned URL (AWS S3, Google Cloud Storage), and returns it to the client. The client streams raw bytes directly to object storage over high-bandwidth edge networks.',
        ],
      },
      {
        title: 'Resumable Multipart Chunking',
        lead: 'Never losing upload progress over unstable mobile networks.',
        paragraphs: [
          'For files larger than 50MB, files are split into chunks (e.g. 5MB to 20MB each) on the client side. Chunks are uploaded in parallel to S3 using S3 Multipart Upload APIs.',
          'If a mobile user drives through a tunnel and drops connection at 95% completion of a 2GB file, only the single active 5MB chunk is retried upon reconnecting. Once all chunk ETags are received, S3 reassembles the file atomically.',
        ],
        code: {
          language: 'typescript',
          code: `// Step 1: Server signs S3 Presigned URL
const command = new PutObjectCommand({
  Bucket: 'user-uploads',
  Key: \`videos/\${userId}/\${videoId}.mp4\`,
  ContentType: 'video/mp4',
});
const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

// Step 2: Client streams bytes directly to S3
await fetch(presignedUrl, {
  method: 'PUT',
  body: fileBlob,
  headers: { 'Content-Type': 'video/mp4' },
});`,
        },
      },
    ],
    tradeoffs: {
      headers: ['Upload Approach', 'App Server Load', 'Max File Size', 'Resumability', 'Network Efficiency'],
      rows: [
        ['Via App Server POST', 'High (Thread & RAM locked)', '~50MB (gateway limit)', 'No (all or nothing)', 'Poor (double hop)'],
        ['Direct S3 Presigned URL', 'Zero (only metadata)', '5GB single object', 'No', 'Optimal (direct hop)'],
        ['Multipart S3 Presigned', 'Zero (only chunk tokens)', '5TB massive blobs', 'Yes (per-chunk retry)', 'Optimal + Parallel'],
        ['Content-Defined Chunking', 'Medium (dedup hashing)', 'Unlimited', 'Yes', 'Highest (zero duplicate upload)'],
      ],
    },
    productionGotchas: [
      'Orphaned Incomplete Uploads: Incomplete multipart uploads consume storage fees indefinitely if abandoned. Must configure an S3 Bucket Lifecycle Rule to abort incomplete multipart uploads after 7 days.',
      'Malicious Presigned URL Abuse: Always enforce strict Content-Length and Content-Type restrictions within the signed policy to prevent users from uploading unexpected file types or infinite payloads.',
    ],
    interviewProbes: [
      {
        question: 'How do you notify your backend when an upload to S3 finishes?',
        lookFor: 'S3 Event Notifications published to SQS or SNS, triggering an event-driven worker fleet to start transcoding.',
      },
      {
        question: 'How does Dropbox avoid re-uploading duplicate files across multiple users?',
        lookFor: 'Client-side Content-Defined Chunking (Rabin fingerprints) and hash deduplication against a central block metadata database.',
      },
    ],
  },

  'event-streams': {
    readTime: '7 min read',
    difficulty: 'Intermediate',
    diagramType: 'queue-stream-partitions',
    diagramTitle: 'Partitioned Event Log with Consumer Group Offsets',
    realWorldScenario:
      'Uber ingests millions of driver GPS pings per second. Dispatch, fraud detection, surge pricing, billing, and machine learning models all require access to the exact same stream of events with independent processing speeds without slowing each other down.',
    deepDive: [
      {
        title: 'Message Queues vs Event Streams',
        lead: 'Comparing RabbitMQ/SQS point-to-point queues with Kafka/Kinesis append-only logs.',
        paragraphs: [
          'Traditional message queues (RabbitMQ, SQS) treat messages as transient jobs. Once a consumer processes a message and acknowledges it, the message is permanently deleted from the queue. This is ideal for worker task distribution.',
          'Event streaming platforms (Kafka, Apache Pulsar) treat events as an immutable append-only commit log on disk. Messages are retained for days or weeks. Multiple consumer groups read the same log at their own independent speeds and can replay history at will.',
        ],
      },
      {
        title: 'Partitioning and Consumer Groups',
        lead: 'How Kafka balances ordered delivery with horizontal scale.',
        paragraphs: [
          'Total global ordering across millions of events per second is impossible without a single-threaded bottleneck. Kafka solves this by partitioning topics.',
          'Events with the same Partition Key (e.g. driver_id) are guaranteed to land on the same partition in strict chronological order. Different partitions run in parallel across a cluster of consumer workers.',
        ],
        code: {
          language: 'json',
          code: `// Kafka Event Structure with Key Partitioning
{
  "topic": "driver-locations",
  "key": "driver_uuid_8921",
  "partition": 4,
  "offset": 1092842,
  "timestamp": 1726189200,
  "payload": {
    "lat": 37.7749,
    "lng": -122.4194,
    "status": "AVAILABLE",
    "bearing": 182
  }
}`,
        },
      },
    ],
    tradeoffs: {
      headers: ['Feature', 'Message Queues (RabbitMQ/SQS)', 'Event Streams (Kafka/Kinesis)'],
      rows: [
        ['Message Retention', 'Deleted upon acknowledgment', 'Retained by time/size (e.g. 7 days)'],
        ['Ordering Guarantees', 'FIFO queues (slow, limited throughput)', 'Strict ordering within each partition'],
        ['Multiple Consumers', 'Each message consumed by ONE worker', 'Fan-out: Each Consumer Group reads independently'],
        ['Replayability', 'Cannot replay past messages', 'Full replay by resetting consumer offset'],
        ['Throughput Scale', '10,000 - 50,000 msgs/sec', '1,000,000+ msgs/sec via sequential disk I/O'],
      ],
    },
    productionGotchas: [
      'Consumer Lag: If consumers process slower than producers write, consumer offset lag grows. Alerting on consumer lag is far more critical than alerting on CPU.',
      'Poison Pill Messages: A malformed event that crashes the consumer worker causes it to restart and attempt the same message repeatedly, stalling the entire partition. Solution: Dead Letter Queues (DLQ).',
    ],
    interviewProbes: [
      {
        question: 'What happens when a new consumer worker joins a Kafka consumer group?',
        lookFor: 'Partition rebalancing: Kafka pauses consumption briefly and re-allocates topic partitions among the active members.',
      },
      {
        question: 'How do you guarantee exactly-once processing when delivering payments via an event stream?',
        lookFor: 'Idempotency keys on the consumer database side plus atomic transactional outbox or Kafka transactions.',
      },
    ],
  },
  'networking': {
    readTime: '5 min read',
    difficulty: 'Foundational',
    diagramType: 'networking-protocols',
    diagramTitle: 'Request/Response, Push, and Binary RPC Paths',
    realWorldScenario:
      'A mobile app opening its home screen fires 40 requests across 3 regions. Each cross-region round trip costs 150ms that no code can remove, so the teams that budget round trips like money ship screens that feel instant, and the teams that do not ship spinners.',
    deepDive: [
      {
        title: 'Three ways services talk',
        lead: 'Request/response, pushed events, and binary RPC cover nearly everything.',
        paragraphs: [
          'Request/response over HTTP is the default: a client asks, a server answers, and nothing is held open between calls. It is simple to reason about, trivially load balanced, and debuggable with a log of pairs. Use it for anything the user explicitly asked for.',
          'Pushed updates over persistent connections (WebSockets, server-sent events) fit information the user did not ask for but must learn fast: chat messages, live scores, collaboration cursors. The price is connection state on the server, which is why holding a million sockets is its own architecture.',
        ],
        callout: {
          type: 'warning',
          title: 'Distance is a floor, not a budget',
          text: 'Light in fiber needs 65ms to cross the Atlantic and back. Any design requiring three sequential cross-region hops cannot beat 200ms, whatever the code does.',
        },
      },
      {
        title: 'Binary RPC between services',
        lead: 'Inside the datacenter, compact protocols beat readable ones.',
        paragraphs: [
          'Service-to-service calls favor binary protocols (gRPC, Thrift) with schema-defined contracts: smaller payloads, faster parsing, and generated clients that make contract drift a compile error instead of a midnight page.',
          'Keep REST at the edge where browsers and third parties live, and binary RPC inside where you control both ends. Mixing them up gives you unreadable public APIs and un-debuggable internal ones.',
        ],
      },
    ],
    tradeoffs: {
      headers: ['Style', 'Latency profile', 'Server state', 'Best for'],
      rows: [
        ['REST request/response', 'One round trip per call', 'None', 'User-initiated reads and writes'],
        ['WebSocket push', 'Near zero after handshake', 'Per-connection memory', 'Chat, live updates, collaboration'],
        ['Server-sent events', 'Near zero, one direction', 'Per-connection memory', 'Feeds, notifications, tickers'],
        ['Binary RPC', 'Smallest payloads', 'None', 'Internal service calls'],
      ],
    },
    productionGotchas: [
      'Head-of-line blocking: one slow request on a shared HTTP/1.1 connection stalls everything behind it. Fix: HTTP/2 multiplexing or separate connection pools per priority.',
      'Retry amplification: clients retrying a slow endpoint multiply load exactly when the system is weakest. Fix: timeouts with jitter plus bounded retries.',
      'TLS handshake cost on every new connection to a far region. Fix: connection reuse, keep-alive, and session resumption.',
    ],
    interviewProbes: [
      {
        question: 'When would you pick WebSockets over polling for a live feed?',
        lookFor: 'Sub-second freshness with many updates per connection. Polling wins when updates are rare or clients are mostly idle.',
      },
      {
        question: 'How do you keep cross-region latency from dominating a request path?',
        lookFor: 'Replicate reads near users, collapse sequential cross-region hops, and move work to async paths where freshness allows.',
      },
    ],
  },

  'api-design': {
    readTime: '6 min read',
    difficulty: 'Foundational',
    diagramType: 'system-architecture-overview',
    diagramTitle: 'Resource API Surface and Versioning',
    realWorldScenario:
      'A payments API serves 2,000 third-party integrators. One breaking field rename pages a hundred on-call engineers at once, which is why the teams with boring, versioned, paginated APIs sleep and the clever ones do not.',
    deepDive: [
      {
        title: 'Resources, verbs, and predictable shapes',
        lead: 'Boring APIs are a feature: every surprise is a support ticket.',
        paragraphs: [
          'Model nouns as resources with standard verbs: create, read, update, delete, list. A client that learns one endpoint can guess the rest, which cuts integration time from weeks to days and makes client libraries writable by script.',
          'Keep response envelopes stable: data, paging cursors, and error objects in the same places forever. Clients program against shapes, not documentation, so a reshaped response is a breaking change even when every field survives.',
        ],
      },
      {
        title: 'Pagination, idempotency, and versions',
        lead: 'The three decisions that decide whether integrators trust you.',
        paragraphs: [
          'Page by cursor over stable ordering, never by offset: inserts during pagination duplicate or skip rows with offsets, while cursors freeze a boundary. Every list endpoint that can grow needs this from day one.',
          'Make every mutating endpoint accept an idempotency key and version the API in the path or header. Retried payments must answer from stored results, and v2 must never break v1 clients mid-contract.',
        ],
        callout: {
          type: 'tip',
          title: 'The idempotency test',
          text: 'If a client can safely retry any request after a timeout with no new side effects, the contract is done. If not, the contract is a bug report waiting for traffic.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Choice', 'Wins', 'Costs', 'Use when'],
      rows: [
        ['Cursor pagination', 'Stable pages under inserts', 'Opaque cursors clients cannot craft', 'Any list that grows'],
        ['Offset pagination', 'Simple, jumpable pages', 'Duplicates and skips under writes', 'Small static lists only'],
        ['Path versioning', 'Explicit, cacheable', 'URL sprawl across versions', 'Public REST APIs'],
        ['Idempotency keys', 'Safe retries', 'Server-side key storage', 'Every mutation that moves money or state'],
      ],
    },
    productionGotchas: [
      'N+1 endpoints: chatty clients turning one screen into fifty calls. Fix: batch endpoints and expansion parameters.',
      'Unbounded lists: one endpoint returning a million rows when a tenant grows. Fix: default page sizes with hard maximums.',
      'Silent field type changes: an integer id becoming a string breaks typed clients. Fix: contract tests that fail the build on shape drift.',
    ],
    interviewProbes: [
      {
        question: 'How do you design pagination for a feed with constant inserts?',
        lookFor: 'Cursor over stable (timestamp, id) ordering; offsets duplicate and skip under concurrent writes.',
      },
      {
        question: 'A partner double-submits a payment after a timeout. What saves you?',
        lookFor: 'Idempotency keys with stored results, so the retry answers instead of recharging.',
      },
    ],
  },

  'data-modeling': {
    readTime: '6 min read',
    difficulty: 'Foundational',
    diagramType: 'system-architecture-overview',
    diagramTitle: 'Normalized Core with Purpose-Built Read Models',
    realWorldScenario:
      'An e-commerce catalog stores products, sellers, and reviews. One denormalized document per product page reads in a single fetch but makes a seller rename a million-row rewrite, so the teams that normalize the core and denormalize the reads get both fast pages and cheap updates.',
    deepDive: [
      {
        title: 'Normalize the core, denormalize the reads',
        lead: 'One fact lives in one place; copies serve queries.',
        paragraphs: [
          'Start normalized: each fact stored once, related by keys. Updates touch one row, invariants hold in one transaction, and the model survives requirements you have not heard yet.',
          'Then denormalize deliberately for the hottest reads: precomputed views, embedded summaries, materialized feeds. Every copy is a cache with an invalidation story, so each one names its refresh path at design time.',
        ],
      },
      {
        title: 'Keys that survive scale',
        lead: 'Key choice is a sharding decision wearing a naming decision.',
        paragraphs: [
          'Prefer opaque, monotonically sortable keys (time-ordered ids) over meaningful ones: usernames change, emails get reused, and natural keys leak into every foreign reference.',
          'Design keys for the partition scheme you will need: a key that hashes evenly today shards cleanly tomorrow, while a sequential key without hashing piles every write onto one partition.',
        ],
        callout: {
          type: 'warning',
          title: 'The rename tax',
          text: 'Anything embedded in a million denormalized copies costs a backfill to change. Put volatile display data behind references, never inside copies.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Model', 'Writes', 'Reads', 'Evolves'],
      rows: [
        ['Normalized', 'Cheap, one row', 'Joins required', 'Easily'],
        ['Denormalized copies', 'Fan-out per write', 'Single fetch', 'Via backfills'],
        ['Event-sourced log', 'Append only', 'Rebuild or project', 'By replaying'],
      ],
    },
    productionGotchas: [
      'God rows: one tenant or celebrity row growing without bound until it cannot be read or moved. Fix: bucket large collections by time or shard key.',
      'Schema-on-read regret: schemaless documents accumulating five spellings of the same field. Fix: validate at the write edge even when storage is flexible.',
      'Missing secondary indexes discovered at 2am: the query the launch needed was never indexed. Fix: index review for every new access pattern before ship.',
    ],
    interviewProbes: [
      {
        question: 'When do you denormalize, and what do you owe the design in return?',
        lookFor: 'For hot reads; owe an invalidation or refresh story for every copy, named up front.',
      },
      {
        question: 'How do you model a social graph that must answer both directions?',
        lookFor: 'Adjacency rows in both directions or a graph store; single-direction edges make one query fast and the reverse a full scan.',
      },
    ],
  },

  'db-indexing': {
    readTime: '5 min read',
    difficulty: 'Foundational',
    diagramType: 'system-architecture-overview',
    diagramTitle: 'Index Selection Against Query Patterns',
    realWorldScenario:
      'A support dashboard query scans 40M tickets in 9 seconds. One composite index on (status, updated_at) drops it to 12ms, and suddenly the same database serves fifty agents instead of five.',
    deepDive: [
      {
        title: 'Index the access pattern, not the table',
        lead: 'Every query shape wants its own index; the table is irrelevant.',
        paragraphs: [
          'List the queries first, then index their filters in selectivity order: equality columns before range columns, and the sort key last so the index returns rows in order without a sort step.',
          'Covering indexes carry the selected columns inside the index itself, turning the query into an index-only scan that never touches the table. The price is wider indexes and slower writes.',
        ],
      },
      {
        title: 'What indexes cost',
        lead: 'Every index is a second table the database maintains on every write.',
        paragraphs: [
          'Each additional index adds write amplification, storage, and planner confusion: five overlapping indexes can make the optimizer pick a worse plan than two clean ones.',
          'Audit indexes like code: drop the unused, merge the overlapping, and re-check after every feature that adds a query. An index nobody reads is pure write tax.',
        ],
        callout: {
          type: 'tip',
          title: 'The EXPLAIN habit',
          text: 'Read the query plan before adding hardware. Most slow queries at scale are missing indexes, not missing machines.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Index', 'Reads', 'Writes', 'Watch for'],
      rows: [
        ['B-tree composite', 'Fast equality + range', 'Moderate tax', 'Column order mistakes'],
        ['Covering', 'Index-only scans', 'Wide, slow writes', 'Bloated storage'],
        ['Partial', 'Small and fast', 'Only matching rows', 'Queries outside the predicate'],
        ['Full-text/GIN', 'Text search', 'Heavy build cost', 'Stale-doc visibility lag'],
      ],
    },
    productionGotchas: [
      'Leading-wildcard LIKE queries that no B-tree can serve. Fix: trigram or full-text indexes for substring search.',
      'Index bloat after heavy updates vacuums too late to prevent. Fix: scheduled maintenance plus fill-factor tuning on hot tables.',
      'The planner choosing a sequential scan because statistics went stale. Fix: analyze after bulk loads, not on a timer alone.',
    ],
    interviewProbes: [
      {
        question: 'A query filters on status and sorts by updated_at. What index?',
        lookFor: 'Composite (status, updated_at): equality first, sort key last, one ordered scan.',
      },
      {
        question: 'Writes suddenly slowed after adding three indexes. Why?',
        lookFor: 'Every write now maintains four structures; drop or merge indexes the slow queries do not need.',
      },
    ],
  },

  'consistency-models': {
    readTime: '6 min read',
    difficulty: 'Foundational',
    diagramType: 'system-architecture-overview',
    diagramTitle: 'Consistency Spectrum From Strong to Eventual',
    realWorldScenario:
      'A bank ledger and a social feed make opposite choices correctly. The ledger waits for every replica to agree before confirming a transfer; the feed shows your post instantly and lets far replicas catch up. Swapping the two choices would be a scandal and a spinner respectively.',
    deepDive: [
      {
        title: 'The spectrum, honestly labeled',
        lead: 'Strong, causal, and eventual are latency and availability knobs.',
        paragraphs: [
          'Strong consistency makes every read see the latest write, which costs coordination on the write path: quorums, consensus rounds, cross-region waits. Ledgers, locks, and inventories pay it gladly.',
          'Eventual consistency answers from the nearest copy and converges in the background. Feeds, catalogs, and analytics prefer it: a slightly stale answer now beats a correct answer after a timeout.',
        ],
      },
      {
        title: 'Causality is the middle worth knowing',
        lead: 'Most applications need order, not simultaneity.',
        paragraphs: [
          'Causal consistency guarantees that causally related writes appear in order everywhere: replies never precede their questions, even across regions. It costs less than strong consistency and surprises users far less than raw eventual.',
          'Read-your-writes and monotonic reads are session guarantees worth naming in requirements: after posting, the author must see their own post, and refreshing must never show older data than before.',
        ],
        callout: {
          type: 'note',
          title: 'CAP in one line',
          text: 'When the network partitions, you choose between refusing writes (consistency) or accepting divergence (availability). There is no third door.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Model', 'Read latency', 'Write cost', 'Surprise level'],
      rows: [
        ['Strong', 'Quorum reads', 'Coordination rounds', 'None, by definition'],
        ['Causal + session', 'Local reads', 'Ordered propagation', 'Low'],
        ['Eventual', 'Nearest copy', 'Fire and converge', 'Stale reads, conflicts'],
      ],
    },
    productionGotchas: [
      'Stale reads after writes breaking signup flows: the new user record is invisible on the replica that serves the next click. Fix: read-your-writes routing for fresh entities.',
      'Clock skew silently reordering events across regions. Fix: logical clocks or centralized sequencing for order-sensitive streams.',
      'Conflict resolution nobody designed: two regions accepting the same seat. Fix: last-writer-wins with vector clocks, or serialize the contested writes.',
    ],
    interviewProbes: [
      {
        question: 'When is eventual consistency unacceptable?',
        lookFor: 'Money movement, inventory decrements, anything where two accepted writes cannot both be honored.',
      },
      {
        question: 'How do you keep a global feed fast without showing users time travel?',
        lookFor: 'Eventual across regions plus monotonic reads and read-your-writes per session.',
      },
    ],
  },

  'capacity-numbers': {
    readTime: '5 min read',
    difficulty: 'Foundational',
    diagramType: 'system-architecture-overview',
    diagramTitle: 'Latency Tiers and Throughput Budgets',
    realWorldScenario:
      'An interviewer asks for 10k requests per second with 99th percentile under 200ms. The candidate who knows memory is nanoseconds, disk seeks are milliseconds, and networks add their own floor sizes the fleet on the whiteboard instead of guessing.',
    deepDive: [
      {
        title: 'Numbers worth memorizing',
        lead: 'Order of magnitude beats precision; these fit on an index card.',
        paragraphs: [
          'Memory reference 100ns, L1 cache 1ns, SSD random read 150us, spinning disk seek 10ms, same-datacenter round trip 0.5ms, cross-region 50 to 150ms. Each tier is roughly a thousand times the last, which is why one disk seek costs more than a thousand memory lookups.',
          'Throughput follows Little’s Law: concurrent requests equal arrival rate times latency. A service doing 25ms of work per request needs 250 concurrent slots to sustain 10k rps, which is why latency and capacity are the same question.',
        ],
      },
      {
        title: 'Using numbers in design',
        lead: 'Estimate before architecting, then let the numbers veto.',
        paragraphs: [
          'Work top down: daily users to peak rps (divide by 86,400, multiply by 3 to 5 for peak), rps to storage per day, storage to machines with replication. Every step is one multiplication a reviewer can check.',
          'Use the numbers to kill designs early: a chatty protocol needing fifty sequential cross-region calls cannot meet 500ms no matter the fleet, so the protocol dies on the whiteboard instead of in production.',
        ],
        callout: {
          type: 'tip',
          title: 'The 3 to 5 rule',
          text: 'Average load divided from daily totals, times 3 to 5, approximates peak. Design for the peak, cost for the average with autoscaling between them.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Tier', 'Latency', 'What it means'],
      rows: [
        ['L1 / memory', '1 to 100ns', 'In-process caching is effectively free'],
        ['SSD / disk', '150us to 10ms', 'One seek dwarfs thousands of lookups'],
        ['Same datacenter', '0.5ms', 'Chatty internal calls are affordable'],
        ['Cross region', '50 to 150ms', 'Sequential cross-region calls break budgets'],
      ],
    },
    productionGotchas: [
      'Averages hiding tails: p50 at 20ms with p99 at 2s means one user in a hundred suffers. Fix: budget and alert on p99, never the mean.',
      'Forgetting replication multipliers: 1TB of data needs 3TB of disks plus headroom. Fix: multiply storage by replica count before buying machines.',
      'Peak blindness: sizing for the daily average and melting at 8pm. Fix: the 3 to 5 rule, then verify against last peak plus growth.',
    ],
    interviewProbes: [
      {
        question: 'How many machines for 10k rps at 25ms per request with 8 slots each?',
        lookFor: 'Little’s Law: 250 concurrent needed, 8 per box means 32 boxes plus headroom and replicas.',
      },
      {
        question: 'Why does adding a cache change the machine count more than faster disks?',
        lookFor: 'Tiers differ by 1000x: serving from memory removes whole latency tiers instead of shaving one.',
      },
    ],
  },

  'relational-db': {
    readTime: '6 min read',
    difficulty: 'Foundational',
    diagramType: 'system-architecture-overview',
    diagramTitle: 'Primary, Replicas, and the Write Path',
    realWorldScenario:
      'An orders service runs one primary with three read replicas. Writes serialize through the primary with full ACID guarantees while product pages fan out across replicas, and the only incidents in a year were applications reading their own just-written rows from a lagging replica.',
    deepDive: [
      {
        title: 'Why the relational model endures',
        lead: 'Tables, joins, and transactions match how product data actually relates.',
        paragraphs: [
          'Foreign keys, constraints, and joins keep related facts consistent in one place: an order cannot reference a missing customer, and a report can assemble customers, orders, and payments in one query instead of five service calls.',
          'ACID transactions turn multi-row updates into all-or-nothing units, which is what lets money move without a reconciliation team double-checking every transfer.',
        ],
      },
      {
        title: 'Scaling reads without breaking writes',
        lead: 'Replicas multiply reads; only sharding multiplies writes.',
        paragraphs: [
          'Read replicas absorb browse traffic while writes stay on the primary, which carries most products to surprising scale. The classic failure is reading your own write from a replica before it replays: route fresh entities to the primary or wait out the lag.',
          'When the primary itself saturates on writes, the exits are sharding by key, moving hot entities out, or admitting some data was never relational. Vertical scaling buys the time to choose properly.',
        ],
        callout: {
          type: 'warning',
          title: 'Replication lag is a correctness issue',
          text: 'Lag between primary and replica is not just slowness: it is a window where two consecutive reads disagree. Name the lag budget in requirements.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Topology', 'Reads', 'Writes', 'Failure mode'],
      rows: [
        ['Single primary', 'One box worth', 'Serialized, safe', 'Failover gap'],
        ['Primary + replicas', 'Multiplied', 'Still one writer', 'Stale reads under lag'],
        ['Sharded', 'Partitioned', 'Partitioned', 'Cross-shard queries suffer'],
      ],
    },
    productionGotchas: [
      'Long transactions holding locks through user think-time. Fix: do interaction first, open the transaction only for the write burst.',
      'Missing indexes on foreign keys turning every join into a scan. Fix: index review with every migration.',
      'Connection exhaustion from pool-per-service sprawl. Fix: pooled proxies and per-service pool budgets.',
    ],
    interviewProbes: [
      {
        question: 'When do you add a read replica versus shard?',
        lookFor: 'Replicas for read pressure with tolerable lag; sharding when the primary saturates on writes or data size.',
      },
      {
        question: 'A user creates an account then immediately lands on an error page. What happened?',
        lookFor: 'Read-your-write violated by replica lag; route fresh rows to the primary.',
      },
    ],
  },
  'nosql-db': {
    readTime: '6 min read',
    difficulty: 'Intermediate',
    diagramType: 'sharding-architecture',
    diagramTitle: 'Document, Key-Value, and Wide-Column Access Paths',
    realWorldScenario:
      'A shopping cart service outgrew its relational database at 50k writes a second. Moving carts to a document store partitioned by user id removed every cross-shard join, and write throughput scaled with each added node while the relational core kept orders and payments.',
    deepDive: [
      {
        title: 'Pick by access pattern, not by fashion',
        lead: 'Each model answers one question shape brilliantly and others badly.',
        paragraphs: [
          'Key-value stores answer one question: fetch by exact key, fast. Use them for sessions, carts, feature flags, anything addressed by id alone.',
          'Document stores add secondary indexes and nested structure for entities read and written whole: profiles, catalogs, orders. Wide-column stores handle massive ordered series: timelines, metrics, event logs keyed by time.',
        ],
      },
      {
        title: 'What you give up leaving tables',
        lead: 'Flexibility and scale cost joins and transactions.',
        paragraphs: [
          'Ad-hoc joins disappear: related data must be embedded, denormalized, or fetched by the application in multiple round trips. Model the top queries first and let them dictate the layout.',
          'Multi-row transactions shrink to single-partition atomicity in most stores. Anything needing cross-entity atomicity either stays relational or moves into sagas with compensating actions.',
        ],
        callout: {
          type: 'warning',
          title: 'Schemaless does not mean schema-free',
          text: 'Without enforced shapes, five writers invent five spellings of the same field. Validate at the write edge or pay for cleanup migrations later.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Model', 'Queries', 'Scale', 'Transactions'],
      rows: [
        ['Key-value', 'By key only', 'Linear with nodes', 'Single key'],
        ['Document', 'Indexed + nested', 'Sharded', 'Single document'],
        ['Wide-column', 'Ordered scans', 'Massive series', 'Single partition'],
        ['Relational', 'Ad-hoc joins', 'Vertical, then sharded', 'Full ACID'],
      ],
    },
    productionGotchas: [
      'Hot partitions from sequential keys piling every write onto one node. Fix: hashed or composite partition keys.',
      'Unbounded document growth as arrays append forever. Fix: bucket large collections by time window.',
      'Secondary index lag serving stale query results after writes. Fix: route freshness-critical reads by primary key.',
    ],
    interviewProbes: [
      {
        question: 'When do you move a workload off a relational database?',
        lookFor: 'Single-entity access at write rates or data sizes one node cannot hold, with joins that can be denormalized away.',
      },
      {
        question: 'How do you handle a query that needs two entities in a document store?',
        lookFor: 'Embed for read-together data, application-side joins for the rest, or admit the workload is relational.',
      },
    ],
  },

  'blob-storage': {
    readTime: '5 min read',
    difficulty: 'Intermediate',
    diagramType: 'blob-presigned-upload',
    diagramTitle: 'Direct Upload and Edge Delivery for Bytes',
    realWorldScenario:
      'A video platform serves 2B playbacks a day. Originals land directly in object storage from uploaders, renditions fan out to edge caches, and the application servers never touch a single video byte, which is why playback scales while the API fleet stays small.',
    deepDive: [
      {
        title: 'Bytes ride a separate road',
        lead: 'Application servers coordinate; they never carry.',
        paragraphs: [
          'Clients upload straight to storage with short-lived signed URLs minted by the API. The API authenticates and authorizes, then steps aside: megabytes flow from client to store with no proxy in the middle.',
          'Reads follow the same split: metadata from the database, bytes from the edge cache, originals from storage only on a miss. Each tier scales on its own curve.',
        ],
      },
      {
        title: 'Tiers, lifecycle, and resume',
        lead: 'Not all bytes deserve the same price or patience.',
        paragraphs: [
          'Lifecycle rules drift aging bytes to cheaper tiers automatically: hot originals today, cool archive next quarter, deep freeze next year. Design the transitions at upload time, not during a cost panic.',
          'Large uploads chunk with resume: a dropped phone connection restarts one chunk, never the gigabyte. Renditions generate once per chunk set and serve forever after.',
        ],
        callout: {
          type: 'tip',
          title: 'The proxy test',
          text: 'If application memory grows with file size, bytes are flowing through servers that should only coordinate. Sign URLs and step aside.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Tier', 'Retrieval', 'Price signal', 'Use for'],
      rows: [
        ['Hot object', 'Milliseconds', 'Highest', 'Active originals and renditions'],
        ['Cool / infrequent', 'Milliseconds, higher fee', 'Lower', 'Month-old content'],
        ['Archive', 'Minutes to hours', 'Lowest', 'Compliance and cold backups'],
      ],
    },
    productionGotchas: [
      'Per-prefix rate limits throttling one hot key range while the store idles. Fix: hash prefixes to spread load across partitions.',
      'Multipart uploads abandoned mid-way billing forever. Fix: lifecycle expiry on incomplete uploads.',
      'Signed URL leaks granting permanent access. Fix: minutes-long expiry with the narrowest action scope.',
    ],
    interviewProbes: [
      {
        question: 'How do you accept 5GB uploads without touching app servers?',
        lookFor: 'Signed URLs for direct-to-storage upload in chunks with resume, API only mints and records.',
      },
      {
        question: 'Where do renditions live and who makes them?',
        lookFor: 'Async workers transcode once per upload into the store; edges cache the hot variants.',
      },
    ],
  },

  'search-index': {
    readTime: '6 min read',
    difficulty: 'Intermediate',
    diagramType: 'system-architecture-overview',
    diagramTitle: 'Inverted Index From Tokens to Documents',
    realWorldScenario:
      'A marketplace with 200M listings answers typo-tolerant searches in 40ms. An inverted index maps every token to its document list, so matching never scans listings: it intersects small sorted lists and ranks the survivors.',
    deepDive: [
      {
        title: 'Tokens in, document lists out',
        lead: 'Search is indexing plus ranking, in that order.',
        paragraphs: [
          'Ingestion tokenizes text, stems variants to roots, and appends document ids to per-token posting lists. A query becomes set operations over those lists: fast because the lists are short and sorted.',
          'Ranking then orders the survivors by text relevance, popularity signals, and business boosts. Indexing decides what CAN match; ranking decides what SHOULD top.',
        ],
      },
      {
        title: 'Freshness is the hard part',
        lead: 'Anyone can index yesterday; products need seconds.',
        paragraphs: [
          'Near-real-time indexes flush small segments constantly and merge them in the background. New documents become searchable in seconds while merges keep query speed from decaying.',
          'Separate the write path (indexing pipeline) from the read path (replica shards): a flood of new listings must never slow a single search.',
        ],
        callout: {
          type: 'note',
          title: 'Search is not a database',
          text: 'Indexes answer relevance questions over text. Asking them for exact transactional reads trades both speed and correctness away.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Approach', 'Freshness', 'Query power', 'Cost'],
      rows: [
        ['Database LIKE', 'Immediate', 'Substring only, slow', 'Free until it melts'],
        ['Inverted index', 'Seconds', 'Full relevance + facets', 'Separate cluster'],
        ['Vector search', 'Minutes', 'Semantic similarity', 'Embedding + index build'],
      ],
    },
    productionGotchas: [
      'Relevance decay as content mix shifts: last quarter’s boosts promote stale winners. Fix: scheduled re-tuning against click logs.',
      'Shard hotspots from trendy terms piling onto one shard. Fix: replica the hot shards, not just the cluster.',
      'Mapping explosions from dynamic fields creating thousands of internal fields. Fix: explicit mappings with dynamic templates disabled by default.',
    ],
    interviewProbes: [
      {
        question: 'How do you make new listings searchable within seconds?',
        lookFor: 'Segment-based near-real-time indexing with background merges, reads from replica shards.',
      },
      {
        question: 'Search is slow but the cluster looks idle. What do you check?',
        lookFor: 'Shard balance and hot terms, query fan-out width, and relevance computation cost per shard.',
      },
    ],
  },

  'api-gateway': {
    readTime: '5 min read',
    difficulty: 'Intermediate',
    diagramType: 'rate-limiter-token-bucket',
    diagramTitle: 'Gateway Responsibilities at the Edge',
    realWorldScenario:
      'A platform with 400 microservices puts one gateway in front. Auth, rate limits, and routing live there once instead of 400 times, and when a partner floods the API the gateway refuses at the door while internal services never notice.',
    deepDive: [
      {
        title: 'One front door for cross-cutting work',
        lead: 'Auth, limits, routing, logging: written once, enforced everywhere.',
        paragraphs: [
          'The gateway terminates TLS, validates tokens, enforces per-client quotas, and routes by path to services. Business logic stays out: the moment the gateway computes, it becomes the monolith you decomposed.',
          'Centralized access logs at the gateway give every incident one timeline to start from, which pays for the hop on its own.',
        ],
      },
      {
        title: 'What does not belong',
        lead: 'A gateway is a policy point, not a service.',
        paragraphs: [
          'Aggregation across services (API composition) looks tempting and turns the gateway into a stateful bottleneck with its own failure modes. Push composition to a dedicated backend-for-frontend or the client.',
          'Heavy transformation, protocol translation beyond the edge, and business validation all belong downstream where they scale with the services they serve.',
        ],
        callout: {
          type: 'warning',
          title: 'The single point of failure question',
          text: 'A gateway is redundant across zones with no shared mutable state, which makes it the least fragile single front door, not the most.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Placement', 'Wins', 'Risks', 'Rule'],
      rows: [
        ['Edge gateway', 'One policy, early refusal', 'Extra hop', 'Cross-cutting only'],
        ['In-service logic', 'No hop', '400 copies of auth', 'Never for shared policy'],
        ['Backend-for-frontend', 'Tailored responses', 'Another service to run', 'Composition lives here'],
      ],
    },
    productionGotchas: [
      'Gateway timeout shorter than the slowest service, turning patience into 504s. Fix: timeouts matching downstream budgets plus hedging.',
      'Rate limits counted per gateway instance instead of globally, letting N instances each admit the full quota. Fix: centralized counters or sticky routing for limited keys.',
      'Plugin sprawl turning upgrades into outages. Fix: version gateway config like code with staged rollouts.',
    ],
    interviewProbes: [
      {
        question: 'What lives in the gateway versus in services?',
        lookFor: 'Gateway: auth, quotas, routing, logging. Services: everything that computes.',
      },
      {
        question: 'A partner exceeds quota but pays well. What changes?',
        lookFor: 'Per-client quota tiers with headers showing remaining budget, never a global ceiling raise.',
      },
    ],
  },

  'load-balancer': {
    readTime: '5 min read',
    difficulty: 'Foundational',
    diagramType: 'system-architecture-overview',
    diagramTitle: 'Distribution Strategies Across Healthy Hosts',
    realWorldScenario:
      'A checkout fleet runs twenty boxes behind one balancer. When a deploy leaves three boxes serving 500 errors, health checks pull them in seconds and shoppers never notice, which is the whole job: nobody routes to the dead.',
    deepDive: [
      {
        title: 'Algorithms for different skews',
        lead: 'Round robin is the start, not the answer.',
        paragraphs: [
          'Round robin and random spread evenly when requests cost the same. Least-connections adapts when they do not, sending work where the queues are shortest.',
          'Consistent hashing pins keys (users, sessions, shards) to servers so caches stay warm across requests. The price is rebalancing work when the fleet changes size.',
        ],
      },
      {
        title: 'Health checks are the real feature',
        lead: 'Distribution is easy; detecting death fast is the job.',
        paragraphs: [
          'Active checks probe a health endpoint; passive checks watch real traffic for errors and latency. Both must drain, not drop: stop sending new work, let in-flight finish, then remove.',
          'Layer 4 balancers move packets cheaply; layer 7 understands paths, headers, and cookies for smart routing. Pay the layer 7 cost only where routing needs to see inside.',
        ],
        callout: {
          type: 'tip',
          title: 'Drain, do not drop',
          text: 'Removing a host mid-request turns a deploy into user errors. Drain windows measured in seconds cost nothing and save everything.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Strategy', 'Evenness', 'Stickiness', 'Use when'],
      rows: [
        ['Round robin', 'Even', 'None', 'Uniform stateless work'],
        ['Least connections', 'Adaptive', 'None', 'Variable request cost'],
        ['Consistent hash', 'Keyed', 'Warm caches', 'Sessions, shards, caches'],
      ],
    },
    productionGotchas: [
      'Unequal boxes behind equal weights: new big machines idle while old small ones burn. Fix: weights matching capacity.',
      'Health checks too gentle to catch a wedged-but-listening server. Fix: deep checks that exercise the real path.',
      'Sticky sessions masking a broken box for its pinned users. Fix: prefer stateless with shared state over stickiness.',
    ],
    interviewProbes: [
      {
        question: 'How do you take a box out for deploy with zero user impact?',
        lookFor: 'Drain: stop new assignments, finish in-flight, verify empty, then remove.',
      },
      {
        question: 'When is consistent hashing worth its complexity?',
        lookFor: 'When per-server caches or partitions make re-routing expensive: sessions, shards, hot keys.',
      },
    ],
  },

  'message-queue': {
    readTime: '6 min read',
    difficulty: 'Intermediate',
    diagramType: 'queue-stream-partitions',
    diagramTitle: 'Buffer, Workers, and Dead Letters',
    realWorldScenario:
      'An email service accepts 2M sends in a product-launch minute. The API acknowledges instantly and workers drain at their own pace, so the launch succeeds with delivery spread over twenty minutes instead of failing in one.',
    deepDive: [
      {
        title: 'Decoupling in two directions',
        lead: 'Queues separate when work happens from whether it happens.',
        paragraphs: [
          'Producers append and move on; consumers pull at their sustainable rate. Bursts become backlog depth, a visible number with a drain rate, instead of timeouts and retries.',
          'Retention turns the queue into a replayable buffer: rewind after a bad deploy and redrive the same messages through fixed workers.',
        ],
      },
      {
        title: 'Ordering, duplication, and poison',
        lead: 'The three guarantees you actually choose between.',
        paragraphs: [
          'FIFO per partition gives order where one stream matters; global order across partitions costs the parallelism that makes queues fast. Most systems need order per key, not per world.',
          'At-least-once delivery with idempotent consumers beats exactly-once machinery for nearly every workload. Poison messages get bounded redeliveries, then a dead-letter shelf with counters and alerts.',
        ],
        callout: {
          type: 'warning',
          title: 'Unbounded backlog is a decision',
          text: 'A queue that grows forever is a system that never says no. Size retention, alert on depth growth rate, and shed or page before disks decide for you.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Pattern', 'Coupling', 'Ordering', 'Failure mode'],
      rows: [
        ['Direct call', 'Tight', 'Caller order', 'Caller waits or fails'],
        ['Queue + workers', 'Loose', 'Per partition', 'Backlog grows visibly'],
        ['Pub/sub fan-out', 'Loosest', 'Per subscriber', 'Slow subscriber lags'],
      ],
    },
    productionGotchas: [
      'Poison messages redelivered forever, wedging every worker restart. Fix: bounded retries then dead-letter with alerts.',
      'Consumers slower than producers with no alarm until disks fill. Fix: alert on depth growth rate, scale workers on depth.',
      'Duplicate processing after rebalances charging twice. Fix: idempotent handlers keyed on message ids.',
    ],
    interviewProbes: [
      {
        question: 'The queue depth grows every day at noon and never fully drains. What now?',
        lookFor: 'Drain rate below peak arrival: add workers/partitions, or shed low-priority classes before the peak.',
      },
      {
        question: 'How do you guarantee an email sends exactly once?',
        lookFor: 'You do not: at-least-once plus idempotent sends keyed on message id, deduped at the edge.',
      },
    ],
  },

  'distributed-lock': {
    readTime: '6 min read',
    difficulty: 'Intermediate',
    diagramType: 'concurrency-control',
    diagramTitle: 'Leases, Fencing, and the Redlock Debate',
    realWorldScenario:
      'A flash sale has 500 seats and 200k buyers. A distributed lock serializes seat holds so two buyers never hold the same seat, and every lock carries a lease so a crashed holder releases instead of freezing the sale.',
    deepDive: [
      {
        title: 'Locks are leases with expiry',
        lead: 'No expiry means one crash freezes the resource forever.',
        paragraphs: [
          'Acquire sets a key with a TTL; holders renew while working and release when done. Expiry bounds every failure: the worst case is waiting out one lease, never manual surgery.',
          'Fencing tokens order the holders: each grant carries a higher number, and the resource rejects stale holders. Without fencing, a paused holder can wake up and act after losing the lock.',
        ],
      },
      {
        title: 'Keep the critical section tiny',
        lead: 'Hold the lock for the decision, never for the work.',
        paragraphs: [
          'Decide under the lock, execute outside it: check the seat, mark it held, release, then charge and notify without holding anything. Long sections serialize the whole system and turn the lock into the bottleneck.',
          'Prefer database constraints, atomic compare-and-set, or partitioned ownership before reaching for a lock service. Often the serialization already exists somewhere cheaper.',
        ],
        callout: {
          type: 'note',
          title: 'Redlock, briefly',
          text: 'Majority agreement across independent lock servers raises the bar for split-brain grants. Most teams never need it; correct leases plus fencing cover nearly every sale, seat, and ledger.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Mechanism', 'Strength', 'Cost', 'Use when'],
      rows: [
        ['DB unique constraint', 'Absolute', 'One row write', 'Single-database contention'],
        ['Lease lock + fencing', 'Strong with care', 'Lock service + tokens', 'Cross-service prizes'],
        ['Best effort / none', 'None', 'Zero', 'Idempotent work that tolerates doubles'],
      ],
    },
    productionGotchas: [
      'Clock skew granting overlapping leases on two machines. Fix: expiry margins plus fencing tokens on the resource.',
      'Lock held across a slow payment call, serializing all buyers behind one. Fix: decide under lock, charge outside it.',
      'Thundering acquire storms when the lock releases. Fix: jittered backoff with fairness queues for the burst.',
    ],
    interviewProbes: [
      {
        question: 'How do you stop two buyers holding the same seat?',
        lookFor: 'Serialize the hold decision under a lease lock or atomic constraint; charge after release.',
      },
      {
        question: 'A lock holder pauses for 30 seconds past its lease. What protects the resource?',
        lookFor: 'Fencing tokens: the resource rejects the stale holder even though it still believes it holds the lock.',
      },
    ],
  },
  'distributed-cache': {
    readTime: '6 min read',
    difficulty: 'Intermediate',
    diagramType: 'cache-aside-flow',
    diagramTitle: 'Hashed Keys Across a Pooled Memory Tier',
    realWorldScenario:
      'A session store holds 40M live sessions across twelve memory nodes. Keys hash across the pool so any node can answer any session, and when one node dies only its twelfth of keys re-fetch while the rest never notice.',
    deepDive: [
      {
        title: 'Pool memory, hash keys, set TTLs',
        lead: 'The three mechanics that make a pool behave like one big cache.',
        paragraphs: [
          'Consistent hashing spreads keys so node changes move slivers, not everything. Clients hash the key, find the owner, and talk to it directly, which keeps the pool free of coordination on the hot path.',
          'TTLs bound staleness and memory together: every entry dies on schedule, so the pool self-heals from bad writes and never grows without limit. Eviction policies (LRU and friends) decide who leaves early under pressure.',
        ],
      },
      {
        title: 'Hit rate is the only scoreboard',
        lead: 'Everything about the pool reduces to one ratio.',
        paragraphs: [
          'Hit rate decides origin load multiplicatively: at 90 percent the database sees a tenth of reads, at 50 percent it sees half. Small hit-rate moves are large database moves, which is why the number gets a dashboard of its own.',
          'Raise it with hotter keys (longer TTLs on stable data), bigger pools for working sets, and request coalescing so ten simultaneous misses become one fetch.',
        ],
        callout: {
          type: 'tip',
          title: 'Coalesce the miss storm',
          text: 'When ten requests miss the same key at once, fetch once and share the result. Singleflight turns a stampede into one database call.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Choice', 'Wins', 'Costs', 'Watch'],
      rows: [
        ['Client-side hashing', 'No proxy hop', 'Client owns topology', 'Rehash on rescale'],
        ['Proxy tier', 'Topology hidden', 'Extra hop', 'Proxy capacity'],
        ['Long TTLs', 'High hit rate', 'Stale reads', 'Invalidation paths'],
      ],
    },
    productionGotchas: [
      'One hot key melting its owner while the pool idles. Fix: replicate hot keys or split the value.',
      'Cold restart emptying the pool and thundering the database. Fix: warm from snapshots or roll restarts node by node.',
      'TTL stampedes on synchronized expiries. Fix: jitter TTLs so keys do not die in the same second.',
    ],
    interviewProbes: [
      {
        question: 'Hit rate fell from 95 to 70 percent overnight. How do you investigate?',
        lookFor: 'Key distribution shifts, TTL changes, deploy-invalidated prefixes, or a new traffic shape missing the working set.',
      },
      {
        question: 'One node dies in a twelve-node pool. What do users feel?',
        lookFor: 'Roughly a twelfth of keys miss once and re-fetch; consistent hashing keeps the rest untouched.',
      },
    ],
  },

  'cdn-edge': {
    readTime: '5 min read',
    difficulty: 'Foundational',
    diagramType: 'system-architecture-overview',
    diagramTitle: 'Edge PoPs Absorbing Origin Load',
    realWorldScenario:
      'A sports final pushes 8M concurrent viewers to one stream. Edge points of presence absorb 97 percent of bytes within kilometers of viewers, and the origin serves a trickle it could handle with a fraction of its fleet.',
    deepDive: [
      {
        title: 'Geography as a performance feature',
        lead: 'Physics pays for every edge deployment exactly once.',
        paragraphs: [
          'Static bytes cache at PoPs near users: images, video segments, scripts, styles. Each cache hit skips the origin round trip entirely, which is why the first load and every repeat feel different.',
          'Edge compute runs small logic at the PoP: auth checks, A/B assignment, redirects, header rewrites. Work that needs no origin data finishes in single-digit milliseconds.',
        ],
      },
      {
        title: 'Invalidation is the whole discipline',
        lead: 'A cache you cannot purge is a liability with servers.',
        paragraphs: [
          'Versioned URLs (fingerprinted assets) make invalidation unnecessary for static files: new content gets a new name, old names age out. Only dynamic edge content needs purge APIs.',
          'Tier the cache: edge PoPs backed by regional shields, so a miss in one city fetches from a nearby shield instead of the origin. Shield hit rates decide origin load as much as edge rates do.',
        ],
        callout: {
          type: 'warning',
          title: 'Stale dynamic content',
          text: 'Caching personalized or rapidly changing responses at the edge serves one user’s page to another. Cache by content identity, never by URL alone.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Content', 'Cache where', 'Purge story', 'Edge compute?'],
      rows: [
        ['Fingerprinted static', 'Edge, long TTL', 'None needed', 'No'],
        ['Hot dynamic', 'Edge, short TTL', 'API purge', 'Sometimes'],
        ['Personalized', 'Origin only', 'Not cached', 'Auth at edge only'],
      ],
    },
    productionGotchas: [
      'Cache key explosions from query strings creating a million variants of one page. Fix: normalize keys, strip tracking parameters.',
      'Shield misses during regional events overwhelming origins anyway. Fix: stale-while-revalidate so old content serves while fresh fetches.',
      'TLS and cert sprawl across custom domains. Fix: managed edge certificates with automated renewal.',
    ],
    interviewProbes: [
      {
        question: 'How do you serve 8M concurrent viewers without melting origin?',
        lookFor: 'Edge caching with regional shields, fingerprinted segments, origin sized for shield misses only.',
      },
      {
        question: 'A price change must go live everywhere in a minute. How?',
        lookFor: 'Versioned URLs for static plus purge APIs for dynamic; never wait out long TTLs for urgent changes.',
      },
    ],
  },

  'workers-async': {
    readTime: '5 min read',
    difficulty: 'Foundational',
    diagramType: 'queue-stream-partitions',
    diagramTitle: 'Acknowledge Fast, Execute in Pools',
    realWorldScenario:
      'A photo app acknowledges uploads in 50ms and processes them over the next minute. Users see instant success while resizing, moderation, and indexing drain through worker pools sized for the average, with queues absorbing the peaks.',
    deepDive: [
      {
        title: 'The acknowledge-then-execute contract',
        lead: 'Fast acceptance plus honest status beats slow perfection.',
        paragraphs: [
          'Accept the job, hand back an id, and let pools do the slow work. The client polls or subscribes for completion instead of holding a connection open through minutes of processing.',
          'Status endpoints and webhooks close the loop: pending, running, done, failed with reasons. A job system without visible status is a support queue generator.',
        ],
      },
      {
        title: 'Sizing pools against queues',
        lead: 'Workers set the drain rate; queues set the patience.',
        paragraphs: [
          'Pool size times per-job speed is the drain rate, and anything above it becomes backlog depth with a predictable wait. Size pools for the sustained rate and let queues absorb bursts within retention.',
          'Separate pools by job class: video encodes must never starve password-reset emails behind the same workers. Priority lanes are cheaper than one giant fair pool.',
        ],
        callout: {
          type: 'tip',
          title: 'Idempotency first',
          text: 'Workers retry, rebalance, and redeliver: every job handler must survive running twice. Key side effects on job ids.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Model', 'User wait', 'Failure mode', 'Use when'],
      rows: [
        ['Synchronous', 'Full duration', 'Timeouts', 'Sub-second work only'],
        ['Pooled async', 'Milliseconds', 'Visible backlog', 'Seconds to minutes'],
        ['Scheduled batch', 'Hours', 'Missed windows', 'Nightly aggregates'],
      ],
    },
    productionGotchas: [
      'Silent job loss on worker crash mid-execution. Fix: acknowledge only on completion with visibility timeouts.',
      'One slow job class starving everything behind shared workers. Fix: separate pools or priority lanes per class.',
      'Status polling storms from anxious clients. Fix: exponential backoff guidance plus push on completion.',
    ],
    interviewProbes: [
      {
        question: 'An upload takes 60 seconds to process. How does the API answer?',
        lookFor: 'Acknowledge in milliseconds with a job id; status endpoint plus notification on completion.',
      },
      {
        question: 'The backlog grows daily and never drains. What changed?',
        lookFor: 'Arrival passed drain rate: add workers, split job classes, or shed low-priority work.',
      },
    ],
  },

  'coordination': {
    readTime: '6 min read',
    difficulty: 'Intermediate',
    diagramType: 'concurrency-control',
    diagramTitle: 'Leadership, Membership, and Config Agreement',
    realWorldScenario:
      'A stream processor runs forty workers that must agree on partition ownership. A small coordination store holds leadership and membership, so when a worker dies the survivors reassign its partitions in seconds instead of double-processing for hours.',
    deepDive: [
      {
        title: 'Small data that everything depends on',
        lead: 'Leadership, membership, config: tiny, critical, consistent.',
        paragraphs: [
          'Coordination stores (ZooKeeper, etcd style) keep kilobytes everyone reads and almost nobody writes: who leads, who is alive, what config is current. Strong consistency here is non-negotiable because every decision downstream assumes agreement.',
          'Watches replace polling: workers subscribe to membership changes and react in seconds. Polling the same state burns the very consensus throughput you are protecting.',
        ],
      },
      {
        title: 'Keep it small or lose it',
        lead: 'Coordination stores die from success: more data, more writes, more pain.',
        paragraphs: [
          'Never store product data, queues, or locks-with-payloads in the coordinator. It is sized for kilobytes at low write rates; bulk data belongs in stores built for bulk.',
          'Session expiry is failure detection: missed heartbeats evict the member and trigger reassignment. Tune timeouts so slow GC pauses do not massacre healthy members.',
        ],
        callout: {
          type: 'warning',
          title: 'The herd on reconnect',
          text: 'Every member reconnecting at once after a coordinator blip stampedes it back down. Stagger session re-establishment with jitter.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Use', 'Belongs in coordinator', 'Belongs elsewhere'],
      rows: [
        ['Leadership election', 'Yes, one leader key', 'Nowhere else is safe'],
        ['Membership', 'Yes, ephemeral nodes', 'Gossip for large fleets'],
        ['Config', 'Yes, versioned keys', 'Bulk data in object stores'],
        ['Queues / locks data', 'No', 'Dedicated queue and lock services'],
      ],
    },
    productionGotchas: [
      'Storing megabytes in a kilobyte store until writes crawl. Fix: pointers in coordination, bytes elsewhere.',
      'GC pauses expiring healthy sessions and triggering mass reassignments. Fix: timeout margins plus JVM/GC tuning on members.',
      'Split-brain leadership during partitions. Fix: quorum writes and fencing so two leaders cannot both act.',
    ],
    interviewProbes: [
      {
        question: 'How do forty workers agree on who processes which partition?',
        lookFor: 'Coordination store for membership plus deterministic assignment; watches trigger reassignment on death.',
      },
      {
        question: 'What must never go into a coordination store?',
        lookFor: 'Product data, queues, payloads: anything bulky or high-write that belongs in purpose-built stores.',
      },
    ],
  },

  'realtime-updates': {
    readTime: '5 min read',
    difficulty: 'Intermediate',
    diagramType: 'networking-protocols',
    diagramTitle: 'Poll, Long-Poll, and Push Freshness Ladder',
    realWorldScenario:
      'A trading app shows prices that move ten times a second. Polling every second leaves quotes visibly stale and hammers the API; a pushed stream over held connections keeps every screen within milliseconds of the market at a fraction of the request cost.',
    deepDive: [
      {
        title: 'Climb the freshness ladder slowly',
        lead: 'Each rung costs more connection state than the last.',
        paragraphs: [
          'Start with polling where minutes-old data passes: simple, cacheable, stateless. Move to long-polling when seconds matter: the server holds the request until news or timeout, cutting empty responses dramatically.',
          'Hold connections (WebSockets, SSE) only where sub-second freshness pays: trading, chat, collaboration, live ops. The server now tracks every viewer, so capacity planning counts sockets, not just requests.',
        ],
      },
      {
        title: 'Fan-out is the real architecture',
        lead: 'Getting one event to a million viewers is a different system than getting it once.',
        paragraphs: [
          'Publish once into a fan-out tier that replicates per region, per point of presence, per connection holder. Each layer multiplies reach while shielding the origin from viewer count.',
          'Degrade gracefully under pressure: drop to coarser updates, then to polling, before dropping viewers. A slow ticker beats a dead socket.',
        ],
        callout: {
          type: 'tip',
          title: 'Count sockets in capacity math',
          text: 'A million viewers means a million held connections plus fan-out CPU. Forgetting the socket count is how launches melt at the gateway.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Mechanism', 'Freshness', 'Server cost', 'Use when'],
      rows: [
        ['Polling', 'Interval-bound', 'Stateless', 'Minutes are fine'],
        ['Long-polling', 'Seconds', 'Held requests', 'Seconds matter, viewers few'],
        ['Push sockets', 'Milliseconds', 'Held connections', 'Sub-second at scale'],
      ],
    },
    productionGotchas: [
      'Reconnect storms after a gateway restart: a million clients redialing at once. Fix: jittered backoff with staged fleet restarts.',
      'Stale connection leaks from clients that vanished without closing. Fix: heartbeats with aggressive idle expiry.',
      'One slow consumer backpressuring shared fan-out. Fix: per-connection buffers with drop-oldest policies for laggards.',
    ],
    interviewProbes: [
      {
        question: 'How do you push one goal notification to 5M viewers in seconds?',
        lookFor: 'Tiered fan-out: publish once, replicate per region and PoP, connection holders push the last hop.',
      },
      {
        question: 'When is polling actually the right answer?',
        lookFor: 'Freshness tolerance above tens of seconds, mostly-idle viewers, or audiences where socket state costs more than requests.',
      },
    ],
  },

  'multistep-sagas': {
    readTime: '6 min read',
    difficulty: 'Intermediate',
    diagramType: 'saga-pattern',
    diagramTitle: 'Choreography Versus Orchestration',
    realWorldScenario:
      'Booking a trip reserves a flight, charges a card, and books a hotel across three services with no shared transaction. A saga runs the steps in order and compensates finished steps when a later one fails, so travelers never pay for trips that do not exist.',
    deepDive: [
      {
        title: 'Forward steps, backward promises',
        lead: 'Every step names its undo before it runs.',
        paragraphs: [
          'Each local transaction pairs with a compensating action: reserve with release, charge with refund, book with cancel. The saga executes forward and compensates backward from the failure point, leaving no half-built outcomes.',
          'Compensations must be idempotent and retryable themselves: a refund that runs twice is a second bug, and a compensation that cannot complete needs its own escalation path.',
        ],
      },
      {
        title: 'Choreography versus orchestration',
        lead: 'Events decide, or a conductor decides: pick by visibility needs.',
        paragraphs: [
          'Choreography chains services through events with no central owner: each step listens, acts, and emits. It scales and decouples beautifully until nobody can answer what state an order is in.',
          'Orchestration puts one conductor in charge of sequence, timeouts, and compensation order. Prefer it whenever operators must see, debug, or intervene in running workflows.',
        ],
        callout: {
          type: 'note',
          title: 'Sagas are not transactions',
          text: 'Isolation is gone: other readers see intermediate states. Design steps so partial progress reads sensibly, not corruptly.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Style', 'Coupling', 'Visibility', 'Use when'],
      rows: [
        ['Choreography', 'Loose', 'Scattered logs', 'Simple chains, mature events'],
        ['Orchestration', 'Central owner', 'One state machine', 'Long flows needing ops'],
        ['2PC transaction', 'Tight', 'Atomic', 'Single database only'],
      ],
    },
    productionGotchas: [
      'Non-idempotent compensations double-refunding on retry. Fix: idempotency keys on every undo path.',
      'Lost saga state on conductor crash mid-flow. Fix: durable saga log with resume, never in-memory only.',
      'Cyclic event chains in choreography looping forever. Fix: step counters with dead-letter on exhaustion.',
    ],
    interviewProbes: [
      {
        question: 'The hotel booking fails after the flight charged. What happens?',
        lookFor: 'Saga compensates backward: refund the charge, release the seat, notify with one consistent story.',
      },
      {
        question: 'Choreography or orchestration for a five-step money flow?',
        lookFor: 'Orchestration: operators need one place to see state, retry steps, and run compensations.',
      },
    ],
  },

  'scaling-reads': {
    readTime: '5 min read',
    difficulty: 'Intermediate',
    diagramType: 'cache-aside-flow',
    diagramTitle: 'Head Caching Plus Replica Breadth',
    realWorldScenario:
      'A celebrity post opens a timeline for 100M followers at once. Precomputed timeline caches answer nearly every open from memory while replicas absorb the rest, and the database that authors write to never sees the crowd.',
    deepDive: [
      {
        title: 'Cache the head, replicate the breadth',
        lead: 'Two moves cover nearly every read-scaling story.',
        paragraphs: [
          'A tiny fraction of data takes nearly all reads: cache that head aggressively with generous TTLs and watch origin load collapse. Measure the head first; guessing wastes cache on the tail.',
          'Replicas multiply read throughput for the rest: route browse traffic across them, keep writes on the primary, and budget the replication lag in requirements.',
        ],
      },
      {
        title: 'Precompute what never changes per reader',
        lead: 'The fastest read is the one answered before it is asked.',
        paragraphs: [
          'Timelines, leaderboards, and recommendation shelves compute on write and serve as single cache hits. Write amplification pays once per change instead of per reader.',
          'Reserve live merging for the exceptions (mega-accounts, fresh edits) and keep the precomputed path the default every open takes.',
        ],
        callout: {
          type: 'tip',
          title: 'Read the ratio first',
          text: 'A 100 to 1 read-write ratio justifies precomputation almost everywhere; a 2 to 1 ratio rarely does. Let the ratio choose the architecture.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Move', 'Read cost', 'Write cost', 'Staleness'],
      rows: [
        ['Head caching', 'Memory hits', 'Invalidation', 'TTL bounded'],
        ['Read replicas', 'Spread load', 'Primary unchanged', 'Lag bounded'],
        ['Precompute on write', 'One hit', 'Amplified writes', 'Compute lag'],
      ],
    },
    productionGotchas: [
      'Caching without measuring the head: a huge cache of uniformly cold data. Fix: sample key popularity before sizing.',
      'Replica lag breaking read-your-writes for fresh content. Fix: route fresh entities to primary or the precomputed path.',
      'Precompute pipelines falling behind writes until boards lie. Fix: lag metrics with alerts, not just error rates.',
    ],
    interviewProbes: [
      {
        question: 'Reads outnumber writes 100 to 1. How does that shape the design?',
        lookFor: 'Precompute on write, cache the head, replicate the rest; spend write budget to buy read speed.',
      },
      {
        question: 'A celebrity posts and opens spike 100x. What absorbs it?',
        lookFor: 'Precomputed follower timelines plus head caching; the database sees authoring only.',
      },
    ],
  },
  'scaling-writes': {
    readTime: '6 min read',
    difficulty: 'Intermediate',
    diagramType: 'sharding-architecture',
    diagramTitle: 'Shard, Buffer, and Queue the Flood',
    realWorldScenario:
      'A ride-hailing city emits 2M driver locations a minute at rush hour. Sharded ingestion keyed by driver id absorbs the flood in parallel while rider reads take a separate path, and nothing serializes through a single writer.',
    deepDive: [
      {
        title: 'Split the write path three ways',
        lead: 'Shard what must be fast, buffer what can wait, queue the rest.',
        paragraphs: [
          'Shard by the key queries use: driver locations by driver, orders by customer, events by device. Each shard owns its slice outright, so adding shards adds write throughput nearly linearly.',
          'Buffer and batch what tolerates delay: group a hundred writes into one storage call and the per-write cost collapses. Queues hold whatever can wait minutes without anyone noticing.',
        ],
      },
      {
        title: 'Keep reads off the write path',
        lead: 'The flood must never slow a single read.',
        paragraphs: [
          'Serve reads from replicas, caches, or precomputed views fed asynchronously by the write path. A rider checking ETA reads a view, never the ingestion shards.',
          'Backpressure belongs at admission: when shards saturate, refuse fast with retry guidance instead of queueing writes into hours of lag nobody recovers from.',
        ],
        callout: {
          type: 'warning',
          title: 'The single-writer trap',
          text: 'Any component every write passes through, a single queue, a single lock, a single primary, caps the whole system at its speed. Name it, then remove it.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Move', 'Write gain', 'Read cost', 'Complexity'],
      rows: [
        ['Sharding', 'Linear with shards', 'Scatter-gather risk', 'Rebalancing'],
        ['Buffer + batch', '100x per-write cost', 'Seconds of lag', 'Flush tuning'],
        ['Async queues', 'Unbounded patience', 'Stale views', 'Lag monitoring'],
      ],
    },
    productionGotchas: [
      'Hot shards from naive keys piling rush hour onto one partition. Fix: hashed or composite keys validated against real traffic.',
      'Unbounded queue lag hidden by zero errors until views are hours stale. Fix: lag metrics with paging thresholds.',
      'Batch windows growing until freshness guarantees break silently. Fix: flush on size OR time, whichever hits first.',
    ],
    interviewProbes: [
      {
        question: 'Driver locations flood in at 2M a minute. How do you absorb it?',
        lookFor: 'Shard by driver id, batch writes, serve reads from separate views; no single writer anywhere.',
      },
      {
        question: 'When do you refuse writes instead of queueing them?',
        lookFor: 'When lag would exceed the freshness contract: fast refusal with retry beats unbounded stale queues.',
      },
    ],
  },

  'long-running-tasks': {
    readTime: '5 min read',
    difficulty: 'Intermediate',
    diagramType: 'queue-stream-partitions',
    diagramTitle: 'Accept Fast, Execute Slow, Report Honestly',
    realWorldScenario:
      'A video site takes uploads that encode for six minutes. The API answers in 40ms with a job id, encoders drain through pools, and creators watch honest progress instead of a hung spinner.',
    deepDive: [
      {
        title: 'Validate fast, work slow',
        lead: 'Synchronous validation plus asynchronous execution.',
        paragraphs: [
          'Check everything checkable in the request: auth, quotas, file shape, duplicates. Then accept and hand back an id. Failures after acceptance become status, never surprises.',
          'Execute in pools with per-class isolation: encodes, emails, and reports drain at their own rates from their own queues, so one slow class never starves the rest.',
        ],
      },
      {
        title: 'Status is a feature, not a log',
        lead: 'Users tolerate slowness they can see; they revolt at silence.',
        paragraphs: [
          'Model states explicitly: queued, running with progress, done with outputs, failed with reasons and retry buttons. Every state needs a screen, not just a log line.',
          'Notify on completion instead of polling forever: webhooks or push close the loop, and polling guidance (backoff, etags) covers clients that insist on asking.',
        ],
        callout: {
          type: 'tip',
          title: 'Progress beats patience',
          text: 'A truthful 40 percent bar holds users longer than any spinner. Emit progress from workers, even coarse progress.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Model', 'Accept latency', 'Visibility', 'Infra'],
      rows: [
        ['Sync execution', 'Minutes', 'Hung connection', 'None extra'],
        ['Job + pools', 'Milliseconds', 'Status + notify', 'Queues, workers'],
        ['Scheduled batch', 'Hours', 'Next run', 'Scheduler only'],
      ],
    },
    productionGotchas: [
      'Jobs lost on deploy restarts with no record they existed. Fix: durable queue with acknowledged completion only.',
      'Retry storms from failed jobs requeued instantly at full rate. Fix: exponential backoff with dead-letter after bounds.',
      'Progress endpoints hammered by polling clients. Fix: cacheable status with backoff headers.',
    ],
    interviewProbes: [
      {
        question: 'An encode takes six minutes. Walk me through the API.',
        lookFor: 'Validate synchronously, accept with job id, pools execute, status plus notification close the loop.',
      },
      {
        question: 'How do you stop one slow job class from starving the rest?',
        lookFor: 'Separate pools or priority lanes per class with independent drain rates.',
      },
    ],
  },

  'proximity-search': {
    readTime: '6 min read',
    difficulty: 'Advanced',
    diagramType: 'system-architecture-overview',
    diagramTitle: 'Geo Cells From Map to Matching',
    realWorldScenario:
      'A food app matches couriers to orders within minutes across a metro of 12M people. The map splits into cells, couriers index by current cell, and matching scans nearby cells instead of the whole city, turning a metro-wide problem into a neighborhood one.',
    deepDive: [
      {
        title: 'Cells turn geometry into keys',
        lead: 'Partition the map, then everything is a key lookup.',
        paragraphs: [
          'Geohashes or grid cells convert coordinates into string prefixes: nearby points share prefixes, so who is near becomes a prefix scan instead of a distance sort over millions.',
          'Couriers update cells on movement; orders query the order cell plus neighbors. Cell size balances update churn against scan width: too small drowns in updates, too large scans half the city.',
        ],
      },
      {
        title: 'Matching under movement',
        lead: 'Positions expire faster than queries run.',
        paragraphs: [
          'Treat locations as perishable: expire cell memberships in seconds so matches never chase ghosts. Stale pickups are worse than slow ones.',
          'Dispatch greedily within cells but rebalance across them: local matching is fast, periodic global passes fix the border injustices greedy leaves behind.',
        ],
        callout: {
          type: 'note',
          title: 'Density decides everything',
          text: 'Downtown cells hold thousands, suburbs hold dozens. Uniform cell sizes lie; adaptive or hierarchical cells follow the demand.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Cell size', 'Update cost', 'Query cost', 'Fit'],
      rows: [
        ['Small', 'High churn', 'Narrow scans', 'Dense downtown'],
        ['Large', 'Low churn', 'Wide scans', 'Sparse suburbs'],
        ['Hierarchical', 'Balanced', 'Zoom to density', 'Mixed metros'],
      ],
    },
    productionGotchas: [
      'Border misses: the nearest courier sits one cell over and never matches. Fix: neighbor-cell expansion on every query.',
      'Ghost couriers from stale positions accepting impossible pickups. Fix: second-scale expiry plus confirm-before-dispatch.',
      'Downtown cells overloading single shards. Fix: subdivide hot cells independently of the base grid.',
    ],
    interviewProbes: [
      {
        question: 'How do you find the ten nearest drivers without scanning the city?',
        lookFor: 'Geo cells with prefix scans over the order cell plus neighbors; distance sort only the survivors.',
      },
      {
        question: 'What breaks at 10x courier density downtown?',
        lookFor: 'Hot cells: subdivide adaptively and watch update churn, not just query latency.',
      },
    ],
  },

  'timeseries-stores': {
    readTime: '6 min read',
    difficulty: 'Advanced',
    diagramType: 'system-architecture-overview',
    diagramTitle: 'Retention Tiers From Raw Points to Rollups',
    realWorldScenario:
      'An observability platform ingests 5M metric points a second from customer fleets. Raw points live for a day, minute rollups for a month, hourly rollups for a year, and dashboards never know the difference because each zoom level reads its own tier.',
    deepDive: [
      {
        title: 'Append-only series with labels',
        lead: 'Time plus labels is the whole data model.',
        paragraphs: [
          'Every point is a timestamp, a value, and a label set identifying its source. Labels slice one physical store into millions of logical series without a schema migration per new metric.',
          'Writes append and never update: out-of-order and late points merge by timestamp rules, and the store optimizes for scans over time ranges, not point lookups.',
        ],
      },
      {
        title: 'Retention as architecture',
        lead: 'Nobody queries last year at second resolution, so stop storing it.',
        paragraphs: [
          'Downsample aggressively with age: raw seconds today, minute means this quarter, hourly means this year. Each tier answers its zoom level at a fraction of the storage.',
          'Rollups precompute at ingest, not at query: dashboards read small pre-aggregated ranges instead of scanning billions of raw points per refresh.',
        ],
        callout: {
          type: 'tip',
          title: 'Cardinality is the bill',
          text: 'Cost scales with distinct label combinations, not points. One high-cardinality label (user id on every metric) can multiply storage a hundredfold.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Tier', 'Resolution', 'Retention', 'Serves'],
      rows: [
        ['Raw', 'Seconds', 'Day', 'Live debugging'],
        ['Minute rollups', 'Minutes', 'Month', 'Weekly dashboards'],
        ['Hourly rollups', 'Hours', 'Year+', 'Capacity planning'],
      ],
    },
    productionGotchas: [
      'Cardinality explosions from unbounded label values. Fix: allowlists plus aggregation rules that drop offending labels.',
      'Late points rewriting closed windows and confusing alerts. Fix: lateness windows with explicit drop-or-merge policy.',
      'Rollup gaps during ingester restarts silently emptying dashboards. Fix: backfill jobs plus gap alerts on every tier.',
    ],
    interviewProbes: [
      {
        question: 'How do you keep a year of metrics queryable without infinite disks?',
        lookFor: 'Tiered retention with downsampling: raw briefly, rollups by zoom level, dashboards reading their tier.',
      },
      {
        question: 'Storage tripled in a month with flat traffic. What happened?',
        lookFor: 'Cardinality explosion: find the new high-cardinality label and aggregate it away.',
      },
    ],
  },

  'sketch-structures': {
    readTime: '6 min read',
    difficulty: 'Advanced',
    diagramType: 'system-architecture-overview',
    diagramTitle: 'Probabilistic Answers in Tiny Memory',
    realWorldScenario:
      'An ad platform checks membership against 2B seen device ids on every bid, in under a millisecond. A Bloom filter holds the set in 2GB with a 1 percent false-positive rate, where an exact set would need 100GB and a database round trip.',
    deepDive: [
      {
        title: 'Trade exactness for orders of magnitude',
        lead: 'Approximate with bounded error beats exact but impossible.',
        paragraphs: [
          'Bloom filters answer membership with no false negatives and tunable false positives: size the bit array from the error budget, not from vibes. HyperLogLog counts distinct billions in kilobytes with 2 percent error.',
          'Count-Min sketches track heavy hitters in streams: top URLs, hot keys, viral posts, all in fixed memory regardless of stream length.',
        ],
      },
      {
        title: 'Where sketches sit in real systems',
        lead: 'Guards and guides, rarely the answer itself.',
        paragraphs: [
          'Bloom filters guard expensive paths: check the filter before the database, the cache, the network fetch. A negative answer skips work entirely; positives verify exactly.',
          'Sketches guide exact systems: HyperLogLog sizes the cluster, Count-Min picks cache candidates, then exact stores handle the survivors.',
        ],
        callout: {
          type: 'note',
          title: 'Know the error direction',
          text: 'Bloom filters never miss members but sometimes admit strangers; HyperLogLog error is symmetric. Design the fallback for the actual direction.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Structure', 'Answers', 'Memory', 'Error'],
      rows: [
        ['Bloom filter', 'Membership', 'Bits per item', 'One-sided false positives'],
        ['HyperLogLog', 'Cardinality', 'Kilobytes', '~2 percent'],
        ['Count-Min', 'Frequencies', 'Fixed', 'Overcount on collisions'],
      ],
    },
    productionGotchas: [
      'Sizing for today’s set and overflowing the error budget as it grows. Fix: size for 3-year growth or plan rebuilds.',
      'Deleting from a structure that cannot forget. Fix: counting variants or periodic rebuilds from source.',
      'Hash correlation across sketches breaking independence assumptions. Fix: independent seeds per structure.',
    ],
    interviewProbes: [
      {
        question: 'How do you check 2B seen ids per bid in under a millisecond?',
        lookFor: 'Bloom filter sized to the false-positive budget; positives verify exactly, negatives skip everything.',
      },
      {
        question: 'When is a 2 percent wrong answer better than an exact one?',
        lookFor: 'Sizing, ranking candidates, and guards where error is bounded and fallbacks are exact.',
      },
    ],
  },

  'vector-search': {
    readTime: '6 min read',
    difficulty: 'Advanced',
    diagramType: 'system-architecture-overview',
    diagramTitle: 'Embeddings to Indexes to Retrieval',
    realWorldScenario:
      'A support bot answers from 4M help articles by meaning, not keywords. Articles embed once into vectors, queries embed on the fly, and an approximate index returns the nearest neighbors in 30ms where keyword search returned nothing useful.',
    deepDive: [
      {
        title: 'Meaning as geometry',
        lead: 'Similar meanings land near each other in vector space.',
        paragraphs: [
          'Embedding models convert text, images, or products into dense vectors where distance means similarity. The model choice sets quality ceilings no index can exceed, so evaluate embeddings before indexes.',
          'Chunking decides what retrieves: whole articles dilute, sentences fragment. Overlapping chunks of a few hundred tokens with metadata carry context the ranker needs.',
        ],
      },
      {
        title: 'Approximate indexes for millisecond neighbors',
        lead: 'Exact search over millions of vectors is a scan; indexes make it a walk.',
        paragraphs: [
          'Graph indexes (HNSW style) link each vector to nearby neighbors and walk the graph at query time: logarithmic hops, tunable recall, heavy build cost paid once.',
          'Partitioned indexes (IVF style) cluster vectors and search the nearest clusters: faster builds, recall set by how many clusters each query visits. Filters compose better here than on graphs.',
        ],
        callout: {
          type: 'warning',
          title: 'Stale embeddings rot silently',
          text: 'A model upgrade orphans every stored vector overnight. Version embeddings with the model and rebuild indexes on upgrade, never mixed.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Index', 'Recall control', 'Build cost', 'Filters'],
      rows: [
        ['Graph (HNSW)', 'Search depth', 'Heavy, slow updates', 'Post-filter'],
        ['Partitioned (IVF)', 'Clusters visited', 'Lighter', 'Pre-filter friendly'],
        ['Exact scan', 'Perfect', 'None', 'Trivial'],
      ],
    },
    productionGotchas: [
      'Recall decay as the corpus grows past the tuned parameters. Fix: re-tune depth and cluster counts with growth, not once.',
      'Filter-then-search returning nothing when filters annihilate candidates. Fix: pre-filter aware indexes or over-fetch and filter.',
      'Embedding drift between training data and live queries. Fix: monitor retrieval quality, not just latency.',
    ],
    interviewProbes: [
      {
        question: 'How do you search 4M articles by meaning in 30ms?',
        lookFor: 'Offline embeddings plus an approximate index; query embeds once, graph or partition walk retrieves.',
      },
      {
        question: 'Keyword search fails on synonyms. What changes?',
        lookFor: 'Embeddings capture synonymy geometrically; hybrid keyword plus vector covers exact SKUs and fuzzy intent.',
      },
    ],
  },

  'change-capture': {
    readTime: '5 min read',
    difficulty: 'Advanced',
    diagramType: 'queue-stream-partitions',
    diagramTitle: 'Log Tailing From Database to Followers',
    realWorldScenario:
      'Every order write fans out to search, cache invalidation, analytics, and fraud checks without touching request code. The database log streams each commit once, and followers tail it independently at their own pace.',
    deepDive: [
      {
        title: 'The log is the integration point',
        lead: 'One stream out, many followers, zero coupling.',
        paragraphs: [
          'Change data capture reads the database commit log (WAL, binlog) and publishes each change as an event. Producers never know followers exist: adding search indexing later means subscribing, not modifying checkout code.',
          'Snapshots plus log positions bootstrap new followers without locking tables: bulk load the current state, then tail from the recorded position forward.',
        ],
      },
      {
        title: 'Ordering and exactly-once delivery',
        lead: 'Per-row order is free; global order costs everything.',
        paragraphs: [
          'Partition change streams by row key and every follower sees each row’s history in order, which covers nearly every real need. Global ordering across rows requires single-partition funnels that bottleneck the flood.',
          'Deliver at-least-once with idempotent followers keyed on (table, key, version): replays after crashes converge instead of duplicating.',
        ],
        callout: {
          type: 'tip',
          title: 'Schema changes are events too',
          text: 'Column adds and type changes flow through the same log. Version event schemas and test follower upgrades against both versions.',
        },
      },
    ],
    tradeoffs: {
      headers: ['Approach', 'Coupling', 'Freshness', 'Ops'],
      rows: [
        ['Dual writes in app', 'Tight', 'Immediate', 'Partial-failure bugs'],
        ['Log tailing (CDC)', 'None', 'Seconds', 'Connector fleet'],
        ['Batch ETL', 'None', 'Hours', 'Simplest'],
      ],
    },
    productionGotchas: [
      'Schema migrations breaking followers that parse old shapes. Fix: versioned events with compatibility tests.',
      'Log retention expiring before slow followers catch up. Fix: retention sized to the slowest follower plus alerts.',
      'Initial snapshots locking hot tables for hours. Fix: non-locking snapshot methods with position handoff.',
    ],
    interviewProbes: [
      {
        question: 'How do you feed search and analytics from orders without touching checkout?',
        lookFor: 'Tail the commit log; followers subscribe independently at their own pace.',
      },
      {
        question: 'Why not just write to the database and the queue in the request?',
        lookFor: 'Dual writes fail halfway with no recovery story; the log is the single source followers trust.',
      },
    ],
  },
};

/**
 * Returns the rich concept article, synthesizing base lesson data with deep dive content.
 */
export function getConceptArticle(id: string): ConceptArticle {
  const lesson = CONCEPTS_BY_ID.get(id) ?? CONCEPTS[0]!;
  const override = ARTICLEDATA[lesson.id];

  if (override) {
    return {
      id: lesson.id,
      lesson,
      readTime: override.readTime,
      difficulty: override.difficulty,
      diagramType: override.diagramType,
      diagramTitle: override.diagramTitle ?? `${lesson.title} Architecture Flow`,
      realWorldScenario: override.realWorldScenario,
      deepDive: override.deepDive,
      tradeoffs: override.tradeoffs,
      productionGotchas: override.productionGotchas,
      interviewProbes: override.interviewProbes,
    };
  }

  // Fallback high-quality structured article dynamically generated from lesson data
  let defaultDiagram: DiagramType = 'system-architecture-overview';
  if (lesson.id === 'contention-control' || lesson.id === 'distributed-lock') {
    defaultDiagram = 'concurrency-control';
  } else if (lesson.id === 'load-balancer' || lesson.id === 'api-design') {
    defaultDiagram = 'rate-limiter-token-bucket';
  } else if (lesson.id === 'networking' || lesson.id === 'realtime-updates') {
    defaultDiagram = 'networking-protocols';
  } else if (lesson.id === 'multistep-sagas') {
    defaultDiagram = 'saga-pattern';
  } else if (lesson.id === 'scaling-reads' || lesson.id === 'distributed-cache') {
    defaultDiagram = 'cache-aside-flow';
  } else if (lesson.id === 'scaling-writes') {
    defaultDiagram = 'sharding-architecture';
  }

  return {
    id: lesson.id,
    lesson,
    readTime: '5 min read',
    difficulty: lesson.track === 'core' ? 'Foundational' : lesson.track === 'advanced' ? 'Advanced' : 'Intermediate',
    diagramType: defaultDiagram,
    diagramTitle: `${lesson.title} Architectural Topology`,
    realWorldScenario: `How modern internet-scale services manage ${lesson.title.toLowerCase()} across distributed clusters handling millions of requests with strict latency constraints.`,
    deepDive: [
      {
        title: 'Core Architectural Mechanics',
        lead: lesson.summary,
        paragraphs: [
          `In distributed environments, understanding ${lesson.title.toLowerCase()} is vital to prevent bottlenecks and cascading failures. System designers must weigh tradeoffs between latency, consistency, operational complexity, and infrastructure spend.`,
          `When implementing this building block, isolate critical read and write paths, enforce strict timeout budgets, and ensure horizontal scaling guarantees.`,
        ],
      },
      {
        title: 'When to Reach For It in System Design',
        lead: 'Key architectural indicators and decision criteria.',
        paragraphs: lesson.whenToUse.map((w) => `• ${w}`),
      },
    ],
    productionGotchas: lesson.pitfalls,
    interviewProbes: lesson.checkYourself.map((q) => ({
      question: q,
      lookFor: 'Demonstrate deep understanding of system boundaries, bottleneck mitigation, and failover behavior.',
    })),
  };
}

export const ALL_CONCEPT_ARTICLES: ConceptArticle[] = CONCEPTS.map((c) => getConceptArticle(c.id));

/**
 * Lessons with hand-written deep dives. The getConceptArticle fallback
 * synthesizes generic filler, so this set plus the test below keep every
 * lesson backed by a real article: add the article, not an exception.
 */
export const RICH_ARTICLE_IDS: ReadonlySet<string> = new Set(Object.keys(ARTICLEDATA));
