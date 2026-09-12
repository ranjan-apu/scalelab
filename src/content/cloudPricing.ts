import type { NodeKind, Topology } from '../sim/types';

export interface CloudSku {
  provider: 'aws' | 'gcp' | 'azure';
  serviceName: string;
  skuName: string;
  monthlyBaseCost: number;
  perInstanceCost: number;
}

export interface ComponentCost {
  nodeId: string;
  nodeLabel: string;
  kind: NodeKind;
  instances: number;
  aws: CloudSku;
  gcp: CloudSku;
  azure: CloudSku;
  monthlyCostAws: number;
  monthlyCostGcp: number;
  monthlyCostAzure: number;
}

export interface CloudCostEstimate {
  totalAws: number;
  totalGcp: number;
  totalAzure: number;
  components: ComponentCost[];
}

/**
 * Kinds that map onto something a provider actually bills for.
 *
 * Sketches are excluded rather than given a zero-cost SKU: a whiteboard box is
 * not deployed anywhere, and a "Rectangle, $0" row in a cloud bill would be
 * noise in the one panel whose job is to talk about infrastructure.
 */
type DeployableKind = Exclude<NodeKind, 'shape'>;

const SKU_MAP: Record<
  DeployableKind,
  { aws: CloudSku; gcp: CloudSku; azure: CloudSku }
> = {
  client: {
    aws: { provider: 'aws', serviceName: 'Route 53 + Client', skuName: 'DNS / Edge Routing', monthlyBaseCost: 5, perInstanceCost: 0 },
    gcp: { provider: 'gcp', serviceName: 'Cloud DNS', skuName: 'Public Hosted Zone', monthlyBaseCost: 5, perInstanceCost: 0 },
    azure: { provider: 'azure', serviceName: 'Azure DNS', skuName: 'DNS Zone', monthlyBaseCost: 5, perInstanceCost: 0 },
  },
  producer: {
    aws: { provider: 'aws', serviceName: 'IoT Core / Ingress', skuName: 'Data Ingestion Node', monthlyBaseCost: 15, perInstanceCost: 10 },
    gcp: { provider: 'gcp', serviceName: 'Cloud IoT Core', skuName: 'Device Ingest', monthlyBaseCost: 15, perInstanceCost: 10 },
    azure: { provider: 'azure', serviceName: 'IoT Hub', skuName: 'S1 Standard', monthlyBaseCost: 25, perInstanceCost: 10 },
  },
  lb: {
    aws: { provider: 'aws', serviceName: 'Application Load Balancer', skuName: 'ALB (Fixed + LCU)', monthlyBaseCost: 25, perInstanceCost: 5 },
    gcp: { provider: 'gcp', serviceName: 'Cloud Load Balancing', skuName: 'Global External ALB', monthlyBaseCost: 20, perInstanceCost: 5 },
    azure: { provider: 'azure', serviceName: 'Azure Application Gateway', skuName: 'Standard_v2', monthlyBaseCost: 35, perInstanceCost: 5 },
  },
  apigateway: {
    aws: { provider: 'aws', serviceName: 'API Gateway', skuName: 'REST API v2 Tier', monthlyBaseCost: 30, perInstanceCost: 15 },
    gcp: { provider: 'gcp', serviceName: 'Apigee / Cloud Endpoints', skuName: 'Standard Gateway', monthlyBaseCost: 30, perInstanceCost: 15 },
    azure: { provider: 'azure', serviceName: 'API Management', skuName: 'Developer / Basic', monthlyBaseCost: 45, perInstanceCost: 15 },
  },
  service: {
    aws: { provider: 'aws', serviceName: 'ECS on Fargate / EC2', skuName: 'c6g.large (2 vCPU, 4GB)', monthlyBaseCost: 0, perInstanceCost: 48 },
    gcp: { provider: 'gcp', serviceName: 'Google Kubernetes Engine', skuName: 'c2-standard-4', monthlyBaseCost: 0, perInstanceCost: 52 },
    azure: { provider: 'azure', serviceName: 'Azure Kubernetes Service', skuName: 'Standard_D2ps_v5', monthlyBaseCost: 0, perInstanceCost: 50 },
  },
  worker: {
    aws: { provider: 'aws', serviceName: 'ECS Asynchronous Worker', skuName: 'c6g.medium (1 vCPU, 2GB)', monthlyBaseCost: 0, perInstanceCost: 24 },
    gcp: { provider: 'gcp', serviceName: 'GKE Background Pool', skuName: 'e2-standard-2', monthlyBaseCost: 0, perInstanceCost: 26 },
    azure: { provider: 'azure', serviceName: 'Azure Container Apps', skuName: 'Consumption 1vCPU', monthlyBaseCost: 0, perInstanceCost: 25 },
  },
  lambda: {
    aws: { provider: 'aws', serviceName: 'AWS Lambda', skuName: 'Serverless Functions (Arm64)', monthlyBaseCost: 10, perInstanceCost: 8 },
    gcp: { provider: 'gcp', serviceName: 'Cloud Functions', skuName: '2nd Gen Serverless', monthlyBaseCost: 10, perInstanceCost: 8 },
    azure: { provider: 'azure', serviceName: 'Azure Functions', skuName: 'Premium Plan EP1', monthlyBaseCost: 15, perInstanceCost: 8 },
  },
  edgecompute: {
    aws: { provider: 'aws', serviceName: 'CloudFront Functions / Lambda@Edge', skuName: 'Edge Workers', monthlyBaseCost: 20, perInstanceCost: 12 },
    gcp: { provider: 'gcp', serviceName: 'Edge Cloud', skuName: 'Cloud CDN Edge Compute', monthlyBaseCost: 20, perInstanceCost: 12 },
    azure: { provider: 'azure', serviceName: 'Azure Front Door Edge', skuName: 'Edge Rules Engine', monthlyBaseCost: 25, perInstanceCost: 12 },
  },
  sidecar: {
    aws: { provider: 'aws', serviceName: 'App Mesh / Envoy Sidecar', skuName: 'Envoy Container Overhead', monthlyBaseCost: 5, perInstanceCost: 8 },
    gcp: { provider: 'gcp', serviceName: 'Anthos Service Mesh', skuName: 'Istio Sidecar Proxy', monthlyBaseCost: 5, perInstanceCost: 8 },
    azure: { provider: 'azure', serviceName: 'Open Service Mesh', skuName: 'AKS Mesh Sidecar', monthlyBaseCost: 5, perInstanceCost: 8 },
  },
  cron: {
    aws: { provider: 'aws', serviceName: 'EventBridge Scheduled Tasks', skuName: 'Cron Burst Trigger', monthlyBaseCost: 5, perInstanceCost: 5 },
    gcp: { provider: 'gcp', serviceName: 'Cloud Scheduler', skuName: 'Cron Invoker', monthlyBaseCost: 5, perInstanceCost: 5 },
    azure: { provider: 'azure', serviceName: 'Logic Apps / Timer Trigger', skuName: 'Scheduled Job', monthlyBaseCost: 5, perInstanceCost: 5 },
  },
  transcoder: {
    aws: { provider: 'aws', serviceName: 'AWS Elemental MediaConvert', skuName: 'On-Demand Transcoder', monthlyBaseCost: 40, perInstanceCost: 60 },
    gcp: { provider: 'gcp', serviceName: 'Transcoder API', skuName: 'Batch Video Processing', monthlyBaseCost: 40, perInstanceCost: 58 },
    azure: { provider: 'azure', serviceName: 'Azure Media Services', skuName: 'Standard Encoding Unit', monthlyBaseCost: 45, perInstanceCost: 62 },
  },
  cache: {
    aws: { provider: 'aws', serviceName: 'ElastiCache for Redis', skuName: 'cache.r6g.large (13GB)', monthlyBaseCost: 80, perInstanceCost: 75 },
    gcp: { provider: 'gcp', serviceName: 'Memorystore for Redis', skuName: 'Standard Tier (10GB)', monthlyBaseCost: 85, perInstanceCost: 78 },
    azure: { provider: 'azure', serviceName: 'Azure Cache for Redis', skuName: 'Premium P1 (6GB)', monthlyBaseCost: 90, perInstanceCost: 82 },
  },
  writebehind: {
    aws: { provider: 'aws', serviceName: 'MemoryDB / Write Buffer', skuName: 'db.r6g.large In-Memory', monthlyBaseCost: 95, perInstanceCost: 85 },
    gcp: { provider: 'gcp', serviceName: 'Memorystore Multi-AZ', skuName: 'Persistent Redis M2', monthlyBaseCost: 95, perInstanceCost: 88 },
    azure: { provider: 'azure', serviceName: 'Azure Redis Enterprise', skuName: 'Flash Optimized', monthlyBaseCost: 105, perInstanceCost: 90 },
  },
  db: {
    aws: { provider: 'aws', serviceName: 'Amazon Aurora PostgreSQL', skuName: 'db.r6g.xlarge Multi-AZ (32GB)', monthlyBaseCost: 280, perInstanceCost: 180 },
    gcp: { provider: 'gcp', serviceName: 'Cloud SQL / AlloyDB', skuName: 'AlloyDB 4 vCPU, 32GB', monthlyBaseCost: 290, perInstanceCost: 185 },
    azure: { provider: 'azure', serviceName: 'Azure Database for PostgreSQL', skuName: 'Flexible Server D4ds_v4', monthlyBaseCost: 275, perInstanceCost: 175 },
  },
  replica: {
    aws: { provider: 'aws', serviceName: 'Aurora Read Replica Set', skuName: 'db.r6g.large Read Tier', monthlyBaseCost: 110, perInstanceCost: 95 },
    gcp: { provider: 'gcp', serviceName: 'Cloud SQL Read Replica', skuName: '2 vCPU, 16GB', monthlyBaseCost: 115, perInstanceCost: 98 },
    azure: { provider: 'azure', serviceName: 'PostgreSQL Read Replica', skuName: 'General Purpose D2ds_v4', monthlyBaseCost: 110, perInstanceCost: 92 },
  },
  shard: {
    aws: { provider: 'aws', serviceName: 'DynamoDB / Aurora Shards', skuName: 'Partition Cluster', monthlyBaseCost: 150, perInstanceCost: 120 },
    gcp: { provider: 'gcp', serviceName: 'Cloud Spanner', skuName: 'Regional Processing Unit', monthlyBaseCost: 210, perInstanceCost: 150 },
    azure: { provider: 'azure', serviceName: 'Cosmos DB', skuName: 'Partitioned RU/s Pool', monthlyBaseCost: 180, perInstanceCost: 130 },
  },
  objectstore: {
    aws: { provider: 'aws', serviceName: 'Amazon S3 Standard', skuName: 'Hot Object Bucket (10TB est.)', monthlyBaseCost: 230, perInstanceCost: 0 },
    gcp: { provider: 'gcp', serviceName: 'Google Cloud Storage', skuName: 'Standard Multi-Region', monthlyBaseCost: 240, perInstanceCost: 0 },
    azure: { provider: 'azure', serviceName: 'Azure Blob Storage', skuName: 'Hot Tier GRS', monthlyBaseCost: 235, perInstanceCost: 0 },
  },
  coldstorage: {
    aws: { provider: 'aws', serviceName: 'S3 Glacier Flexible', skuName: 'Archive Vault (50TB)', monthlyBaseCost: 180, perInstanceCost: 0 },
    gcp: { provider: 'gcp', serviceName: 'Cloud Storage Archive', skuName: 'Archive Tier', monthlyBaseCost: 175, perInstanceCost: 0 },
    azure: { provider: 'azure', serviceName: 'Azure Archive Blob', skuName: 'Archive Tier LRS', monthlyBaseCost: 170, perInstanceCost: 0 },
  },
  searchindex: {
    aws: { provider: 'aws', serviceName: 'OpenSearch Service', skuName: 'm6g.xlarge.search 3-Node', monthlyBaseCost: 320, perInstanceCost: 90 },
    gcp: { provider: 'gcp', serviceName: 'Cloud Search / Elasticsearch', skuName: 'Managed Search Cluster', monthlyBaseCost: 310, perInstanceCost: 95 },
    azure: { provider: 'azure', serviceName: 'Azure AI Search', skuName: 'Standard S2 Unit', monthlyBaseCost: 330, perInstanceCost: 100 },
  },
  timeseriesdb: {
    aws: { provider: 'aws', serviceName: 'Amazon Timestream', skuName: 'Serverless TSDB Tier', monthlyBaseCost: 140, perInstanceCost: 40 },
    gcp: { provider: 'gcp', serviceName: 'Cloud Bigtable', skuName: 'SSD Cluster 2 Nodes', monthlyBaseCost: 195, perInstanceCost: 65 },
    azure: { provider: 'azure', serviceName: 'Azure Data Explorer', skuName: 'Cluster 2 vCPU', monthlyBaseCost: 160, perInstanceCost: 55 },
  },
  graphdb: {
    aws: { provider: 'aws', serviceName: 'Amazon Neptune', skuName: 'db.r6g.xlarge Multi-AZ', monthlyBaseCost: 340, perInstanceCost: 110 },
    gcp: { provider: 'gcp', serviceName: 'Neo4j Enterprise on GCP', skuName: 'n2-standard-4', monthlyBaseCost: 350, perInstanceCost: 115 },
    azure: { provider: 'azure', serviceName: 'Cosmos DB Gremlin API', skuName: 'Dedicated Graph Provisioning', monthlyBaseCost: 320, perInstanceCost: 105 },
  },
  vectordb: {
    aws: { provider: 'aws', serviceName: 'OpenSearch Vector / Pinecone', skuName: 'Dedicated Vector Pods', monthlyBaseCost: 260, perInstanceCost: 95 },
    gcp: { provider: 'gcp', serviceName: 'Vertex AI Vector Search', skuName: 'Index Endpoint Cluster', monthlyBaseCost: 275, perInstanceCost: 100 },
    azure: { provider: 'azure', serviceName: 'Azure AI Search Vector Tier', skuName: 'Vector Unit S1', monthlyBaseCost: 270, perInstanceCost: 95 },
  },
  queue: {
    aws: { provider: 'aws', serviceName: 'Amazon SQS Standard', skuName: 'High-Throughput FIFO Queue', monthlyBaseCost: 20, perInstanceCost: 0 },
    gcp: { provider: 'gcp', serviceName: 'Cloud Tasks', skuName: 'Queue Worker Ingress', monthlyBaseCost: 20, perInstanceCost: 0 },
    azure: { provider: 'azure', serviceName: 'Azure Service Bus', skuName: 'Standard Namespace', monthlyBaseCost: 25, perInstanceCost: 0 },
  },
  retryqueue: {
    aws: { provider: 'aws', serviceName: 'SQS Dead-Letter / Retry Queue', skuName: 'DLQ with Redrive Policy', monthlyBaseCost: 15, perInstanceCost: 0 },
    gcp: { provider: 'gcp', serviceName: 'Pub/Sub Dead-Letter Topic', skuName: 'DLQ Retention Buffer', monthlyBaseCost: 15, perInstanceCost: 0 },
    azure: { provider: 'azure', serviceName: 'Service Bus Dead-Letter', skuName: 'Queue Redrive Buffer', monthlyBaseCost: 15, perInstanceCost: 0 },
  },
  streambroker: {
    aws: { provider: 'aws', serviceName: 'Amazon MSK (Kafka)', skuName: 'kafka.m5.large (3 Brokers)', monthlyBaseCost: 310, perInstanceCost: 95 },
    gcp: { provider: 'gcp', serviceName: 'Pub/Sub / Managed Kafka', skuName: 'Throughput Streaming Tier', monthlyBaseCost: 290, perInstanceCost: 90 },
    azure: { provider: 'azure', serviceName: 'Azure Event Hubs', skuName: 'Dedicated 1 TU (Kafka Capable)', monthlyBaseCost: 320, perInstanceCost: 100 },
  },
  pubsub: {
    aws: { provider: 'aws', serviceName: 'Amazon SNS', skuName: 'Fan-Out Topic Mesh', monthlyBaseCost: 25, perInstanceCost: 5 },
    gcp: { provider: 'gcp', serviceName: 'Cloud Pub/Sub', skuName: 'Message Router Topic', monthlyBaseCost: 25, perInstanceCost: 5 },
    azure: { provider: 'azure', serviceName: 'Azure Event Grid', skuName: 'Event Router Operations', monthlyBaseCost: 30, perInstanceCost: 5 },
  },
  websocket: {
    aws: { provider: 'aws', serviceName: 'API Gateway WebSockets', skuName: 'Persistent Connection Pool', monthlyBaseCost: 45, perInstanceCost: 25 },
    gcp: { provider: 'gcp', serviceName: 'GKE Gateway Socket Fleet', skuName: 'Socket Server Group', monthlyBaseCost: 45, perInstanceCost: 25 },
    azure: { provider: 'azure', serviceName: 'Azure Web PubSub Service', skuName: 'Standard Unit (10k Conns)', monthlyBaseCost: 50, perInstanceCost: 25 },
  },
  cdn: {
    aws: { provider: 'aws', serviceName: 'Amazon CloudFront', skuName: 'Global Edge Locations', monthlyBaseCost: 65, perInstanceCost: 0 },
    gcp: { provider: 'gcp', serviceName: 'Google Cloud CDN', skuName: 'Anycast Edge Cache', monthlyBaseCost: 65, perInstanceCost: 0 },
    azure: { provider: 'azure', serviceName: 'Azure Front Door Standard', skuName: 'Edge POP Network', monthlyBaseCost: 70, perInstanceCost: 0 },
  },
  ratelimiter: {
    aws: { provider: 'aws', serviceName: 'AWS WAF / Shield', skuName: 'Rate-Based Rule Group', monthlyBaseCost: 35, perInstanceCost: 0 },
    gcp: { provider: 'gcp', serviceName: 'Google Cloud Armor', skuName: 'Rate Limiting Policy', monthlyBaseCost: 35, perInstanceCost: 0 },
    azure: { provider: 'azure', serviceName: 'Azure Web Application Firewall', skuName: 'Policy Rule Engine', monthlyBaseCost: 40, perInstanceCost: 0 },
  },
  breaker: {
    aws: { provider: 'aws', serviceName: 'Resilience Hub / Envoy Mesh', skuName: 'Outlier Detection Proxy', monthlyBaseCost: 15, perInstanceCost: 5 },
    gcp: { provider: 'gcp', serviceName: 'Traffic Director', skuName: 'Circuit Breaker Filter', monthlyBaseCost: 15, perInstanceCost: 5 },
    azure: { provider: 'azure', serviceName: 'Azure Traffic Manager / Mesh', skuName: 'Fault Tolerance Probe', monthlyBaseCost: 20, perInstanceCost: 5 },
  },
  bulkhead: {
    aws: { provider: 'aws', serviceName: 'Dedicated ECS Cluster Pool', skuName: 'Isolated Resource Quota', monthlyBaseCost: 20, perInstanceCost: 10 },
    gcp: { provider: 'gcp', serviceName: 'GKE Node Pool Partition', skuName: 'Dedicated Resource Namespace', monthlyBaseCost: 20, perInstanceCost: 10 },
    azure: { provider: 'azure', serviceName: 'AKS Isolated Node Pool', skuName: 'Bulkhead Subnet', monthlyBaseCost: 25, perInstanceCost: 10 },
  },
  loadshedder: {
    aws: { provider: 'aws', serviceName: 'Ingress Shedding Controller', skuName: 'Priority Queue Throttle', monthlyBaseCost: 15, perInstanceCost: 5 },
    gcp: { provider: 'gcp', serviceName: 'Cloud Armor Load Shedder', skuName: 'Adaptive Throttler', monthlyBaseCost: 15, perInstanceCost: 5 },
    azure: { provider: 'azure', serviceName: 'App Gateway Load Shedder', skuName: 'Adaptive Rejection Filter', monthlyBaseCost: 20, perInstanceCost: 5 },
  },
  autoscaler: {
    aws: { provider: 'aws', serviceName: 'AWS Application Auto Scaling', skuName: 'Target Tracking Policies', monthlyBaseCost: 10, perInstanceCost: 0 },
    gcp: { provider: 'gcp', serviceName: 'GKE Horizontal Pod Autoscaler', skuName: 'HPA Controller', monthlyBaseCost: 10, perInstanceCost: 0 },
    azure: { provider: 'azure', serviceName: 'Azure Monitor Autoscaling', skuName: 'Dynamic Metric Scaler', monthlyBaseCost: 10, perInstanceCost: 0 },
  },
  region: {
    aws: { provider: 'aws', serviceName: 'Multi-Region Global Infrastructure', skuName: 'Inter-Region VPC Peering Mesh', monthlyBaseCost: 120, perInstanceCost: 40 },
    gcp: { provider: 'gcp', serviceName: 'Cross-Region Interconnect', skuName: 'Global VPC Backbone', monthlyBaseCost: 110, perInstanceCost: 40 },
    azure: { provider: 'azure', serviceName: 'Global VNet Peering', skuName: 'Cross-Region Peering Mesh', monthlyBaseCost: 115, perInstanceCost: 40 },
  },
};

export function calculateCloudCosts(topology: Topology): CloudCostEstimate {
  let totalAws = 0;
  let totalGcp = 0;
  let totalAzure = 0;
  const components: ComponentCost[] = [];

  for (const n of topology.nodes) {
    // Sketches are not infrastructure: they are not estimated, not listed,
    // and not counted in any total.
    if (n.kind === 'shape') continue;
    const sku = SKU_MAP[n.kind] ?? SKU_MAP.service;
    const instances = Math.max(1, n.config.instances ?? 1);

    const costAws = sku.aws.monthlyBaseCost + (sku.aws.perInstanceCost * instances);
    const costGcp = sku.gcp.monthlyBaseCost + (sku.gcp.perInstanceCost * instances);
    const costAzure = sku.azure.monthlyBaseCost + (sku.azure.perInstanceCost * instances);

    totalAws += costAws;
    totalGcp += costGcp;
    totalAzure += costAzure;

    components.push({
      nodeId: n.id,
      nodeLabel: n.label,
      kind: n.kind,
      instances,
      aws: sku.aws,
      gcp: sku.gcp,
      azure: sku.azure,
      monthlyCostAws: costAws,
      monthlyCostGcp: costGcp,
      monthlyCostAzure: costAzure,
    });
  }

  return {
    totalAws,
    totalGcp,
    totalAzure,
    components,
  };
}
