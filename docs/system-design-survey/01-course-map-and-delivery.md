# Page 1: Course Map + Delivery Framework

## 1. Track layout (as observed in left nav)

```
Introduction
How to Prepare
Delivery Framework
Core Concepts (9 articles)
Key Technologies (~13 sections + 9 tech deep-dives)
Common Patterns (7)
Question Breakdowns (32 + 4 guided-only)
Advanced Topics (5)
In the Wild (5 posts)
Quizzes / Guided Practice / Mock interviews (practice layer)
```

Study advice on the site (paraphrased): build foundations first (delivery + concepts +
technologies + patterns), then practice problems actively (whiteboard → compare with
key → peer mock), rather than passively reading.

## 2. The 6-step delivery framework (paraphrased structure, timings as shown on site)

Total ~45 min interview. Steps and timeboxes observed:

1. **Requirements (~5 min)** — split into:
   - Functional: 3–5 verbs the system must do.
   - Non-functional: availability/latency/scale/consistency in numbers.
   - Capacity sketch: only when it drives a decision (shard? cache? geo?).
2. **Core Entities (~2 min)** — 3–5 nouns + the fields that shape sharding/API.
3. **API / System Interface (~5 min)** — 4–5 endpoints, protocol + why; stop fast.
4. **[Optional] Data Flow (~5 min)** — numbered pipeline for flow-heavy systems
   (upload → encode → distribute; request → match → dispatch).
5. **High-Level Design (~10–15 min)** — endpoint-by-endpoint build-up, simplest
   working cut first, then cache/queue/replica/shard as numbers demand.
6. **Deep Dives (~10 min)** — 2–3 hard questions with Bad → Good → Great option ladder
   + explicit tradeoff + level expectations (Mid / Senior / Staff+).

## 3. Why this matters for ScaleLab

Our existing `InterviewPack` interface already mirrors steps 1–6:

| Framework step | ScaleLab `InterviewPack` field |
|---|---|
| Requirements | `functional`, `nonfunctional`, `estimations`, `checkpoints` |
| Entities | `entities` |
| API | `api { protocol, protocolWhy, endpoints }` |
| Data flow | `dataFlow?` |
| HLD build-up | `hldPresetId` + `hldSteps` |
| Deep dives | `deepDives { title, problem, approach[], tradeoff }` |

Gap: the reference adds **"What is expected at each level"** (Mid/Senior/Staff+) and a
**Bad/Good/Great ladder** per deep dive. Proposal (detailed in Page 9): add optional
`levelExpectations` and `optionLadder` to packs without changing existing packs.

Next → Page 2: `02-core-concepts.md`
