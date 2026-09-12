# Page 9: Integration Plan — ScaleLab-native lessons (no external branding)

> Policy: product code/UI/docs-user-facing never mention the reference site's name.
> All lesson prose is written fresh from first principles + our simulation. This survey
> (Pages 0–8) is the only place the source is discussed, and even here prose is paraphrased.

## 1. Where things plug in today (fresh worktree)

- Packs: `src/content/interviewPacks.ts` (`INTERVIEW_PACKS`, 3 packs: `timeline`,
  `url-shortener`, `group-chat`) + contract `src/content/interviewPacks.test.ts`
  (full track required; `hldPresetId` must exist in `src/sim/presets.ts`).
- Presets: `src/sim/presets.ts` — verified IDs include `ticketmaster`, `tinyurl`,
  `leetcode`, `cache-aside`, `twitter`, `whatsapp`, `uber`, `stripe`, plus patterns
  (`retry-storm`, `sharded-database`, `read-replicas`, `rate-limited-api`, `cdn-origin`,
  `async-workers`, `resilient-delivery`, `event-driven` …).
- Glossary: `src/content/glossary.ts` (999 lines; categories latency/throughput/failure/
  capacity/component/unit) + `Glossary.tsx` panel + tooltip wiring tests.
- Practice UI: `src/components/InterviewPractice.tsx` (pin-to-canvas + starter load).

## 2. Schema additions (backward-compatible, optional fields)

```ts
// interviewPacks.ts — ADD (optional, existing packs untouched):
interface PackOptionLadder { bad?: string; good?: string[]; great?: string[] }
interface PackDeepDive { /* existing */ options?: PackOptionLadder }
interface InterviewPack {
  /* existing */ levelExpectations?: { mid: string; senior: string; staff: string };
  concepts?: string[];   // glossary ids introduced
  patterns?: string[];   // Page 4 slugs: realtime | contention | multistep | reads | writes | blobs | longjobs
}
```

Tests: extend `interviewPacks.test.ts` with *conditional* checks (only if fields present),
plus "every `concepts[]` id exists in GLOSSARY" and "every `hldPresetId` exists" (already).

## 3. Pack roadmap (original titles — never mirror external names)

| Phase | New pack (working title) | Starter preset (exists?) | Why |
|---|---|---|---|
| P0-1 | Seat Hold & Checkout | `ticketmaster` ✅ | Strong-consistency + contention flagship; preset exists so pack is cheap |
| P0-2 | Photo Share Feed | `twitter` ✅ (clone-tune) / new `photofeed` | Blob pipeline + CDN + feed scale; reuses timeline pedagogy |
| P0-3 | Code Runner & Board | `leetcode` ✅ | Queue+workers+burst; contest Top-K teaser |
| P0-4 | Ride Dispatch | `uber` ✅ | Geo ingest, dispatch lock, peak queue |
| P1-1 | Flash Inventory Drop | `rate-limited-api`+`resilient-delivery` ✅ combo / new | Waiting room + shedder + breaker sim showcase |
| P1-2 | Live Comments Burst | new `livefanout` | Write-absorption + ordered fan-out |
| P1-3 | Team Notify Hub | `event-driven` ✅ tune | Routing, batching, DLQ, prefs |
| P1-4 | Trending Now (Top-K) | new `topk-stream` (worker-aggregate) | Windowed counters, precompute |
| P1-5 | Money Movement (lite) | `stripe` ✅ | Idempotency, saga, reconcile |
| P1-6 | Docs Together (lite) | new `collab-session` (WS gateway) | Stateful routing, merge |
| P1-7 | Crawl & Index (lite) | new `crawl-fetch` (queue+workers+search) | Frontier, politeness, dedup |
| P1-8 | Service Telemetry | new `metrics-pipe` (time-series note) | Downsample, retention, alerts |

Each pack: prompt (original), 3 checkpoints, 3–4 functional, 4 nonfunctional, 3 estimations,
3 entities, 3–5 endpoints, 3–5 hldSteps, 3 deepDives with approach[]+tradeoff (+optional ladder).

## 4. Glossary additions (glossary-first, no new boxes needed)

`consistent-hashing`, `inverted-index`, `cdc`, `idempotency-key`, `ttl-lock`,
`dlq`, `backpressure`, `geoshard`, `heartbeat`, `sequence-gap`, `saga`,
`durable-execution`, `approx-counter` (HLL/Bloom/CM sketches), `timeseries-rollup`,
`vector-ann`, `presigned-url`, `adaptive-bitrate`, `waiting-room`.
Style per file header: one-line `short`, 2–3 sentence `why` addressed as "you",
`see` cross-links, aliases.

## 5. Simulation tie-ins (differentiation — the reference has no runnable sim)

- Seat/Flash packs: Spike traffic + shedder/breaker tripping live.
- Feed/Top-K: Ramp + cache hit-rate vs DB load; precompute toggle as note.
- Chat/Docs/Live: steady high-connection + heartbeat/sequence notes; trace view.
- Crawler/Judge/Telemetry: async-workers queue-depth + autoscale boot delay.
Every P0/P1 pack must name the exact control-deck scenario + which chart proves the tradeoff.

## 6. Execution order (small PRs, tests green)

1. Schema + tests (no content change; `npm test`, `typecheck` green).
2. Glossary batch 1 (hashing, index, idempotency, TTL-lock, DLQ, backpressure).
3. P0-1 Seat Hold & Checkout pack → preset exists → practice pane verified.
4. P0-2…P0-4 one PR each.
5. P1 in priority order; new presets only where listed.
6. Docs: update `README.md` Interview Practice count + preset table; HLD export sanity.

## 7. Acceptance

- `npx vitest run src/content/interviewPacks.test.ts src/content/glossary*.test.ts` green.
- Every pack loads its starter, pins notes, runs a traffic scenario without errors.
- `rg -i "hello.?interview" src public index.html` returns **nothing** (no brand leak).
- No lesson text matches the reference beyond generic terms (spot-check 3-sentence windows).

— End of dossier (Pages 0–9). Next action: confirm P0 order, then implement schema PR.
