import type { Topology } from './sim/types';
import { exportToMermaid } from './exportFormats';
import { calculateCloudCosts } from './content/cloudPricing';

export interface HldExportOptions {
  systemName?: string;
  author?: string;
  includeMermaid?: boolean;
  includeCostEstimate?: boolean;
}

export function exportToHldMarkdown(
  topology: Topology,
  options: HldExportOptions = {},
): string {
  const name = options.systemName || 'Distributed System Architecture';
  const author = options.author || 'ScaleLab Systems Architect';
  const includeMermaid = options.includeMermaid ?? true;
  const includeCost = options.includeCostEstimate ?? true;

  const lines: string[] = [];

  // Header
  lines.push(`# High-Level Design (HLD): ${name}`);
  lines.push(`*Generated via ScaleLab Cloud Architecture Studio · Author: ${author} · Date: ${new Date().toISOString().split('T')[0]}*`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // 1. Overview
  lines.push('## 1. Executive Summary & Architectural Scope');
  lines.push(
    `This document details the production High-Level Design (HLD) for **${name}**. ` +
      `The architecture is modeled and verified using discrete-event queueing dynamics, ` +
      `simulating tail latency (p99), backpressure, and fault-domain resilience under scale.`,
  );
  lines.push('');

  // 2. Requirements
  lines.push('## 2. Requirements & Scale Targets');
  lines.push('### Functional Requirements');
  lines.push('- Users can submit requests through edge gateways with sub-second feedback.');
  lines.push('- Critical write transactions are strictly consistent and durable.');
  lines.push('- Read queries are served with high throughput and in-memory caching.');
  lines.push('- Background processing and notifications are handled asynchronously via event queues.');
  lines.push('');
  lines.push('### Non-Functional Requirements');
  lines.push('- **High Availability (HA)**: 99.99% uptime across multi-instance failure domains.');
  lines.push('- **Tail Latency**: Target p99 latency < 150ms under peak offered load.');
  lines.push('- **Scalability**: Horizontal autoscaling for stateless compute; partition sharding for data stores.');
  lines.push('- **Fault Tolerance**: Automatic circuit breaking, bulkhead thread isolation, and dead-letter retry queues.');
  lines.push('');

  // 3. Topology Diagram
  lines.push('## 3. Architecture Topology');
  if (includeMermaid) {
    lines.push('```mermaid');
    lines.push(exportToMermaid(topology));
    lines.push('```');
    lines.push('');
  }

  // 4. Component Catalog
  lines.push('## 4. Component Responsibility Catalog');
  lines.push('The system is composed of the following distributed building blocks:');
  lines.push('');
  lines.push('| Component | Type | Instances | Architectural Role & Responsibilities |');
  lines.push('| :--- | :--- | :--- | :--- |');

  for (const n of topology.nodes) {
    const instances = Math.max(1, n.config.instances ?? 1);
    const desc = n.description ? n.description.replace(/\n/g, ' ') : 'Core architectural component.';
    lines.push(`| **${n.label}** | \`${n.kind}\` | ${instances}x | ${desc} |`);
  }
  lines.push('');

  // 5. Data Flow & Communication Contracts
  lines.push('## 5. API Interface & Data Flow Contracts');
  lines.push('Communication channels and inter-service protocols across boundaries:');
  lines.push('');
  lines.push('| From | To | Protocol | Mode | Contract / Route / Payload |');
  lines.push('| :--- | :--- | :--- | :--- | :--- |');

  if (topology.edges.length === 0) {
    lines.push('| *None* | *None* | - | - | Canvas has no active edges |');
  } else {
    for (const e of topology.edges) {
      const fromNode = topology.nodes.find((n) => n.id === e.from)?.label ?? e.from;
      const toNode = topology.nodes.find((n) => n.id === e.to)?.label ?? e.to;
      const proto = e.protocol ? e.protocol.toUpperCase() : 'REST / HTTPS';
      const mode = e.sync === false ? 'Async Event' : 'Sync RPC';
      const contract = e.edgeLabel || (e.control ? 'Autoscaling supervisor' : 'Standard request link');
      lines.push(`| **${fromNode}** | **${toNode}** | \`${proto}\` | ${mode} | \`${contract}\` |`);
    }
  }
  lines.push('');

  // 6. Cloud Sizing & Monthly Cost Estimation
  if (includeCost && topology.nodes.length > 0) {
    const cost = calculateCloudCosts(topology);
    lines.push('## 6. Cloud Infrastructure Sizing & Monthly Cost ($/mo)');
    lines.push('Estimated infrastructure bills based on standard public cloud SKUs:');
    lines.push('');
    lines.push(`- **Amazon Web Services (AWS)**: **$${cost.totalAws.toLocaleString()}/month**`);
    lines.push(`- **Google Cloud Platform (GCP)**: **$${cost.totalGcp.toLocaleString()}/month**`);
    lines.push(`- **Microsoft Azure**: **$${cost.totalAzure.toLocaleString()}/month**`);
    lines.push('');
    lines.push('| Component | AWS SKU | AWS Monthly | GCP SKU | GCP Monthly |');
    lines.push('| :--- | :--- | :--- | :--- | :--- |');
    for (const c of cost.components) {
      lines.push(`| **${c.nodeLabel}** (${c.instances}x) | ${c.aws.serviceName} | $${c.monthlyCostAws} | ${c.gcp.serviceName} | $${c.monthlyCostGcp} |`);
    }
    lines.push('');
  }

  // 7. Reliability & Resilience Deep Dive
  lines.push('## 7. Reliability & Resilience Deep Dive');
  lines.push('### Failure Modes & Mitigation Strategies');
  lines.push('- **Traffic Spike / Flash Crowd**: Rate limiters shed excess unauthenticated load at the API perimeter.');
  lines.push('- **Database Degradation**: Cache-aside layer absorbs high-frequency read spikes; write-behind queues smooth bulk inserts.');
  lines.push('- **Downstream Microservice Latency**: Outlier-detection circuit breakers trip to `Open` within 3 failures, preventing cascading upstream thread exhaustion.');
  lines.push('- **Asynchronous Decoupling**: Message queues guarantee at-least-once delivery with exponential backoff and dead-letter queue (DLQ) quarantine.');
  lines.push('');

  return lines.join('\n');
}
