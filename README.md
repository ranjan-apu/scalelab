<div align="center">

# ⚡ ScaleLab

**A discrete-event distributed system design simulator & scale testing platform.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x%20%7C%207.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Bun](https://img.shields.io/badge/Bun-1.x-fbf0df?logo=bun&logoColor=black)](https://bun.sh/)
[![Tests](https://img.shields.io/badge/Tests-Vitest-6e9f18?logo=vitest&logoColor=white)](https://vitest.dev/)

Model complex distributed architectures on an interactive canvas, simulate realistic traffic load, and witness real queueing dynamics, cascading failures, bottlenecks, and recovery behavior in real time.

[Features](#-key-features) • [System Presets](#-real-world-presets--templates) • [Interactive Challenges](#-interactive-challenges) • [Quickstart](#-quickstart) • [Architecture](#-project-architecture) • [Exporting](#-export--infrastructure-as-code)

</div>

---

## 📖 Overview

System design is notoriously difficult to test before shipping to production. Traditional whiteboard diagrams lack dynamic behavior, while production scale testing is expensive and risky.

**ScaleLab** bridges this gap by providing an in-browser, high-fidelity **discrete-event queueing simulation engine** with a fluid, drag-and-drop canvas. It models how real systems behave under pressure:
- What happens when a cache hit rate drops from 95% to 70%?
- How does a brief downstream database timeout cascade into a catastrophic retry storm?
- Why does autoscaling often arrive too late during traffic spikes?
- How do message fan-outs and consumer lags silently degrade event-driven pipelines?

ScaleLab lets you experiment with these failure modes safely, visualize the flow of requests, and inspect real latency percentiles (p50, p90, p99).

---

## ✨ Key Features

### 🧮 Discrete-Event Simulation Engine
- **Queueing Theory in Action**: Backed by true discrete-event mechanics, Gamma-distributed service times, concurrency limits, and Little's Law dynamics.
- **Failures & Resilience Patterns**:
  - **Retry Storms & Backpressure**: Model how unmanaged retries multiply traffic and crush recovering databases.
  - **Circuit Breakers**: Tripping states (*Closed*, *Open*, *Half-Open*) to isolate failing downstreams.
  - **Rate Limiters & Load Shedders**: Shed low-priority traffic at the gateway before backlogs form.
  - **Bulkheads & Sidecars**: Isolate failure domains and offload cross-cutting concerns.
  - **Autoscaling Mechanics**: Instance scaling with realistic boot delays and scaling hysteresis.
- **Dynamic Traffic Profiles**: Drive topologies using steady rates, traffic ramps, burst spikes, or diurnal (24-hour day/night) cycles.

### 🧩 33 Specialized Architecture Components
ScaleLab provides 33 building blocks covering modern cloud topologies:

| Category | Components |
| :--- | :--- |
| **Ingress & Routing** | Client, Load Balancer, API Gateway, CDN, Edge Compute, Region |
| **Compute & Logic** | Microservice, Async Worker, Serverless Lambda, Cron Burst, Sidecar |
| **Caching & Buffering** | Cache (Redis/Memcached), Write-Behind Buffer |
| **Storage & Databases** | Primary Database, Read Replica Set, Sharded Database, Object Store (S3), Search Index, Time Series DB, Graph DB, Vector DB, Cold Storage Archive |
| **Messaging & Streaming** | Message Queue, Stream Broker (Kafka), Pub/Sub Topic, Dead-Letter / Retry Queue, WebSocket Gateway |
| **Resilience & Control** | Circuit Breaker, Rate Limiter, Bulkhead, Load Shedder, Autoscaler Controller |

---

## 🏛️ Real-World Presets & Templates

ScaleLab includes **22+ ready-to-run architectures**, ranging from fundamental distributed design patterns to reverse-engineered production architectures:

### 🏢 Real-World Reconstructions
- **Discord (Real-Time Chat)**: Millions of concurrent WebSockets, gateway connection limits, pub/sub message fan-out, and channel sharding under hot-key skew.
- **Uber (Ride Dispatch)**: High-frequency driver GPS streams (13:1 driver-to-rider ratio), Kafka consumer lag, dispatch state engines, and payment circuit breakers.
- **Netflix (Streaming at Scale)**: ISP-edge Open Connect CDN (serving ~96% of traffic), Zuul routing, Hystrix breakers on licensing, and asynchronous video encoding queues.
- **Spotify (Music & Discovery)**: Audio CDN streaming separate from metadata APIs, Discover Weekly batch vector index contention, and firehose ingestion queues.
- **Twitter / X (Timeline Fan-Out)**: Fan-out-on-write into precomputed timeline caches, celebrity tweet bursts, and asynchronous worker lag.
- **Stripe (Correctness Over Availability)**: Idempotency keys, ledger consistency, payment network brownout breakers, and webhook dead-letter delivery.
- **WhatsApp (Store and Forward)**: Ultra-lightweight Erlang routing, holding connection limits, offline message buffers, and queue depth observability.

### 📐 Foundational Patterns
- **Single Server Bottleneck**: Trace latency explosion as database queues saturate.
- **Cache-Aside Degradation**: Observe what happens when cache hit rates fall.
- **Retry Storm**: Watch aggressive client retries turn a minor blip into total collapse.
- **Sharded Database**: Explore partition skew when a single partition receives hot-key traffic.
- **Multi-Region Failover**: Simulate region failover costs, split-brain hazards, and cold start spikes.
- **Event-Driven Backend**: Measure Kafka-style consumer group lag and lambda cold starts.

---

## 🎯 Interactive Challenges

Test your system design intuition with built-in, hands-on debugging challenges:

1. **Hold the Line**: Squeeze p99 latency under 200ms at 150 RPS on an overloaded single-node service.
2. **More Machines, Not Bigger Ones**: Scale out a bottlenecked cluster under 600 RPS to eliminate request drops.
3. **Stop the Storm**: Diagnose and extinguish a self-inflicted 100% outage caused by retry storms.
4. **Keep It Warm**: Balance cache sizing, hit rates, and database capacity under 1,200 RPS.

---

## 🔍 Observability & Architectural Insights

- **Live Metrics Dashboard**: Real-time throughput (RPS), error rates, p50, p90, and p99 latency percentiles, queue depth indicators, and node utilization gauges.
- **Flow Visualizer**: Real-time animated packets traveling along edges with colored status dots for successful requests, queueing delays, timeouts, and dropped packets.
- **Architectural Advisor**: Automated topology linting that detects Single Points of Failure (SPOFs), missing breakers, unbounded queues, and unbuffered write spikes.
- **Cloud Vendor Sizing & Cost Estimator**: Compare monthly infrastructure bills and cloud SKUs across **AWS**, **Google Cloud (GCP)**, and **Microsoft Azure**.
- **System Design Glossary**: Built-in interactive reference on Little's Law, M/M/1 vs M/G/1 queueing models, CAP theorem, cache eviction policies, and consistency models.

---

## 🚢 Export & Infrastructure as Code

ScaleLab diagrams are not locked into the tool:

- **Mermaid.js Flowcharts**: Export clear, documented architecture diagrams directly into markdown or PR descriptions.
- **High-Res SVG & PNG**: Export styled vector or raster graphics with inline styling.
- **Topology JSON**: Save and share architecture templates using portable JSON design files or encoded URL hashes.

---

## 🚀 Quickstart

### Prerequisites
- [Bun](https://bun.sh) (v1.0+) or [Node.js](https://nodejs.org) (v20+)

### Installation & Local Setup

```bash
# Clone the repository
git clone https://github.com/ranjan-apu/scalelab.git
cd scalelab

# Install dependencies
bun install
# or: npm install

# Start the Vite development server
bun dev
# or: npm run dev
```

Open your browser at `http://localhost:5173` to explore ScaleLab.

### Available Scripts

| Command | Action |
| :--- | :--- |
| `bun dev` | Launch local development server with hot module replacement (HMR) |
| `bun run build` | Typecheck with TypeScript and build production bundle into `dist/` |
| `bun run preview` | Locally preview the production build |
| `bun run test` | Run the Vitest unit and integration test suite |
| `bun run typecheck` | Run standalone TypeScript type checking without emitting files |

---

## 📁 Project Architecture

The codebase is organized cleanly into pure simulation logic and reactive UI components:

```text
scalelab/
├── public/                # Static assets, fonts, and icons
├── src/
│   ├── sim/               # Pure discrete-event simulation engine (zero DOM/UI dependencies)
│   │   ├── engine.ts      # Core event-loop scheduler, priority queue, and tick processing
│   │   ├── types.ts       # Topology, NodeConfig, Edge, and Metric definitions
│   │   ├── presets.ts     # Architecture templates (Netflix, Uber, Discord, etc.)
│   │   ├── challenges.ts  # Guided debugging challenges & verification logic
│   │   ├── advisor.ts     # Architectural analysis & anti-pattern detection rules
│   │   └── behaviour-*.ts # Component-specific queue and processing behaviors
│   ├── components/        # React 19 UI presentation layer
│   │   ├── Canvas.tsx     # Interactive SVG canvas (nodes, edges, animated traffic)
│   │   ├── Inspector.tsx  # Dynamic node configuration and parameter tuning
│   │   ├── Metrics.tsx    # Live percentile charts, error graphs, and queue stats
│   │   ├── Advisor.tsx    # Topology health warnings and recommendations
│   │   ├── Cost.tsx       # Cloud vendor pricing calculator (AWS, GCP, Azure)
│   │   ├── Challenges.tsx # Challenge drawer, hints, and pass/fail evaluation
│   │   └── Glossary.tsx   # Integrated distributed systems knowledge base
│   ├── content/           # Cloud vendor mappings (AWS, GCP, Azure) and glossary text
│   ├── theme/             # Theme tokens, dark mode, and accessible contrast palettes
│   ├── exportFormats.ts   # Mermaid export generator
│   ├── imageExport.ts     # SVG and high-resolution PNG canvas renderer
│   ├── App.tsx            # Main application shell and simulation orchestration
│   └── main.tsx           # React entry point
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🛠️ Tech Stack

- **Core Engine**: Pure TypeScript Discrete-Event Simulator (Heap-based priority event queue)
- **UI Framework**: [React 19](https://react.dev/)
- **Build System**: [Vite](https://vitejs.dev/)
- **Runtime & Package Manager**: [Bun](https://bun.sh/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Testing**: [Vitest](https://vitest.dev/) with JSDOM

---

## 🤝 Contributing

Contributions are welcome! Whether you are adding new architecture presets, refining component behavior models, or improving simulation fidelity:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-preset`)
3. Commit your changes (`git commit -m 'Add Twitter recommendation architecture'`)
4. Push to the branch (`git push origin feature/amazing-preset`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
