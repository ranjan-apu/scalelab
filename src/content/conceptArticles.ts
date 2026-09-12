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
