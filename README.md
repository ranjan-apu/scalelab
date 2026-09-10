<div align="center">

# <img src="public/favicon.svg" width="32" height="32" alt="ScaleLab Logo" align="center" /> ScaleLab

**A system design studio: diagram architectures, simulate real load, and practice interviews, all in the browser.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x%20%7C%207.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-Vitest-6e9f18?logo=vitest&logoColor=white)](https://vitest.dev/)

Draw a system on the canvas, push traffic through it, and watch real queueing behavior emerge: latency percentiles climbing, queues filling, circuit breakers tripping, retry storms collapsing a system that was healthy a moment earlier. Then rehearse explaining it with guided interview packs.

[Features](#-key-features) • [System Presets](#-presets) • [Interview Practice](#-interview-practice) • [Quickstart](#-quickstart) • [Architecture](#-project-architecture) • [Exporting](#-export--share)

</div>

---

## 📖 Overview

System design is hard to test before shipping to production. Whiteboard diagrams don't move, and production scale testing is expensive and risky.

**ScaleLab** closes that gap with three things in one workspace:

1. **A diagramming canvas** with 34 architecture components, notes, sections, requirements cards, and a freehand pen with eraser.
2. **A discrete-event simulation engine** that runs real traffic through whatever you draw, with Gamma-distributed service times, concurrency limits, backpressure, and failure cascades.
3. **Guided interview practice** that walks classic design problems from requirements to deep dives, pinnable onto the canvas next to a runnable starter system.

Everything runs locally in the browser. No account, no backend.

---

## ✨ Key Features

### 🧮 Discrete-Event Simulation Engine
- **Queueing in action**: true discrete-event mechanics, concurrency limits, and Little's Law dynamics. Every number comes from the simulation, never a formula.
- **Failure & resilience patterns**:
  - **Retry storms & backpressure**: unmanaged retries multiplying traffic and crushing recovering databases.
  - **Circuit breakers**: *Closed*, *Open*, and *Half-Open* states isolating failing downstreams.
  - **Rate limiters & load shedders**: shedding low-priority traffic at the gateway before backlogs form.
  - **Bulkheads & sidecars**: isolating failure domains and offloading cross-cutting concerns.
  - **Autoscaling**: instance scaling with realistic boot delays and hysteresis.
- **Traffic scenarios**: Steady, Ramp, Spike, and Diurnal (24-hour day/night) shapes applied to every source at once from the control deck.

### 🧩 34 Architecture Components
The Library covers modern cloud topologies in seven groups:

| Group | Components |
| :--- | :--- |
| **Traffic** | Client, Event producer, Load balancer, CDN, Edge compute |
| **Compute** | Service, Worker, Queue, Retry queue, Transcoder |
| **Data** | Database, Cache, Write-behind cache, Read replicas, Sharded store |
| **Specialised stores** | Object storage, Search index, Time-series store, Graph database, Vector database, Cold storage |
| **Messaging** | Stream broker, Pub/sub topic, WebSocket gateway, Lambda, Cron job |
| **Control** | Rate limiter, Load shedder, Circuit breaker, Bulkhead, Autoscaler, Region, API gateway, Sidecar proxy |

### 🖥️ Studio Workspace
- **Clean Canvas / Simulation modes**: pure diagramming without telemetry, or live traffic with the control deck.
- **Library + activity rail**: searchable components, `Cmd/Ctrl+K` jump-to-search, collapsible rails, and a review dock that opens only when asked.
- **Studio review**: live monthly cloud-cost estimate for the design on the canvas.
- **Autosave + share links**: work persists in the browser; the Share button copies a self-contained link carrying the whole design (components, pins, traffic patterns included).
- **Light & dark themes** with measured contrast, and layouts for laptop, tablet, and phone.

### 🎤 Interview Practice
Three guided packs (Timeline Feed, URL Shortener, Group Chat), each following the interview track: problem checkpoints, functional and non-functional requirements, estimations, core entities, API design, endpoint-by-endpoint build order, and deep dives with tradeoffs. Every section pins to the canvas as a note, and each pack loads a runnable starter system.

### ✏️ Pen, Eraser & Annotations
- **Pen toolbar** (floating island, `P`): five theme-aware colours, size and opacity sliders with live previews. Settings are per-visit; new strokes copy them at commit.
- **Eraser** (`E`): drag across ink strokes to condemn and delete them in one undo step, with an adjustable nib.
- **Notes, sections, and requirements cards** with interview templates, plus freehand ink that saves and shares with the design.

---

## 🏛️ Presets

26 ready-to-run systems, from distributed patterns to reconstructions of production architectures:

### 🏢 Real-World Reconstructions
- **Discord**: millions of concurrent WebSockets, gateway limits, pub/sub fan-out, channel sharding under hot-key skew.
- **Uber**: high-frequency driver GPS streams, Kafka consumer lag, dispatch contention, payment breakers.
- **Netflix**: edge CDN delivery, routing, licensing breakers, async encoding queues.
- **Spotify**: audio streaming separate from metadata APIs, batch index contention, ingestion queues.
- **Twitter / X**: fan-out-on-write timeline caches, celebrity bursts, worker lag.
- **Stripe**: idempotency keys, ledger consistency, brownout breakers, dead-letter webhooks.
- **WhatsApp**: connection holding, offline message buffers, queue depth observability.

### 🎯 Interview-Style Systems
- **Ticketmaster**: high-contention seat holds and checkout concurrency.
- **TinyURL**: shortening, redirects, click analytics, cache-heavy reads.
- **LeetCode**: judges, queues, leaderboards, contest bursts.

### 📐 Foundational Patterns
Single server, load balanced, cache-aside, async workers, retry storm, CDN + origin, rate-limited API, circuit breaker, read replicas, sharded database, autoscaling service, multi-region, full stack, specialised stores, event-driven, resilient delivery.

---

## 🔍 Observability & Design Review

- **Live metrics**: throughput, goodput, error and drop rates, p50/p90/p99 latency charts, queue depth, per-node utilization and sparklines.
- **Flow visualizer**: animated packets on edges, coloured by health; per-edge rates and severed-wire states.
- **Request tracing**: follow individual requests through the topology.
- **Advisor drawer**: structural linting that flags single points of failure, unprotected downstreams, and missing resilience.
- **Cost modal**: per-component monthly estimates across **AWS, GCP, and Azure** SKUs, plus the live ticker in Studio review.
- **Glossary**: built-in reference for queueing, consistency, caching, and resilience terms, linked from inline explanations.

---

## 🚢 Export & Share

Designs are never locked in:

- **HLD RFC (Markdown)**: one-click architecture document with the diagram, component matrix, data flows, and cost estimate.
- **Mermaid.js**: flowcharts for markdown docs and PR descriptions.
- **SVG & PNG**: high-resolution diagram exports.
- **Design files (JSON)**: save, reopen, and version named designs locally.
- **Share links**: URL-encoded designs that restore components, annotations, and traffic settings on open.

---

## 🚀 Quickstart

### Prerequisites
- [Node.js](https://nodejs.org) v20+ ([Bun](https://bun.sh) works too)

### Local Setup

```bash
# Clone the repository
git clone https://github.com/ranjan-apu/scalelab.git
cd scalelab

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open `http://localhost:5173` to explore ScaleLab.

### Available Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Local dev server with hot module replacement |
| `npm run build` | Typecheck and build the production bundle into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the Vitest suite |
| `npm run typecheck` | Standalone TypeScript checking |

---

## 📁 Project Architecture

Pure simulation logic stays DOM-free under `src/sim`; React components stay presentational:

```text
scalelab/
├── public/                # Static assets and icons
├── src/
│   ├── sim/               # Discrete-event engine (no DOM dependencies)
│   │   ├── engine.ts      # Event-loop scheduler, priority queue, tick processing
│   │   ├── types.ts       # Topology, NodeConfig, edges, metrics
│   │   ├── presets.ts     # 26 architecture templates
│   │   ├── advisor.ts     # Structural lint rules (SPOFs, unprotected paths)
│   │   ├── costs.ts       # Cost rollup over a topology
│   │   ├── sketch.ts      # Ink model, pen settings, eraser constants
│   │   └── behaviour-*.ts # Per-component queueing behaviours
│   ├── content/           # Glossary, preferences, interview packs, cloud pricing
│   ├── components/        # React presentation layer
│   │   ├── Canvas.tsx     # SVG canvas: nodes, edges, ink, gestures
│   │   ├── Palette.tsx    # Component library, annotation tools, Cmd+K search
│   │   ├── Inspector.tsx  # Node/annotation configuration, ink editing
│   │   ├── PenToolbar.tsx # Floating pen/eraser island
│   │   ├── StudioPanel.tsx# Review dock: cost estimate
│   │   ├── Metrics.tsx    # Percentile charts and system stats
│   │   ├── Trace.tsx      # Request tracing
│   │   ├── AdvisorDrawer.tsx # Design findings drawer
│   │   ├── CostModal.tsx  # Multi-cloud cost breakdown
│   │   ├── InterviewPractice.tsx # Guided interview sessions
│   │   ├── Examples.tsx   # Preset gallery dialog
│   │   ├── Designs.tsx    # Saved designs
│   │   ├── guide/         # Help guide panes (overview, traffic, practice)
│   │   └── Glossary.tsx   # Knowledge base panel
│   ├── theme/             # Design tokens and contrast-checked palettes
│   ├── hldExport.ts       # HLD RFC Markdown generator
│   ├── exportFormats.ts   # Mermaid generator
│   ├── imageExport.ts     # SVG/PNG renderer
│   ├── designFile.ts      # JSON design file format
│   ├── share.ts           # URL-encoded sharing
│   ├── App.tsx            # Shell, panels, toolbar, orchestration
│   └── main.tsx           # Entry point
├── package.json
└── vite.config.ts
```

---

## 🛠️ Tech Stack

- **Engine**: hand-rolled TypeScript discrete-event simulator (heap-based priority queue)
- **UI**: [React 19](https://react.dev/), SVG canvas, [Lucide](https://lucide.dev/) icons
- **Build**: [Vite](https://vitejs.dev/), TypeScript, [Vitest](https://vitest.dev/) + JSDOM

---

## 🤝 Contributing

Contributions are welcome: new presets, behaviour models, interview packs, or simulation fidelity.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/my-preset`)
3. Commit your changes (`git commit -m 'Add ...'`)
4. Push to the branch (`git push origin feat/my-preset`)
5. Open a Pull Request

---

## 📄 License

Open source under the [MIT License](LICENSE).
