# Page 10: Full-Coverage Build Analysis — every problem + concept + practice (no level tiers)

> Request: ship **all** surveyed problems and concepts as native ScaleLab content,
> skip `levelExpectations`, add **practice lessons** (hands-on labs, not just walkthroughs).
> All titles/prose original; no external brand strings in `src/`, `public/`, docs UI.

## 1. Current platform inventory (what we reuse)

| Area | Today | File | Constraint |
|---|---|---|---|
| Problem walkthroughs | 3 packs (`timeline`, `url-shortener`, `group-chat`) | `src/content/interviewPacks.ts` + `interviewPacks.test.ts` | Full-track contract; `hldPresetId` must exist in presets; difficulty `Core/Popular/Hard`; minutes 20–60 |
| Term explanations | 102 entries | `src/content/glossary.ts` + tests | `short` <=60 chars no period, `why` >40 chars, no em dashes, `see[]` must resolve |
| Runnables | ~26 presets (`ticketmaster`, `tinyurl`, `leetcode`, `twitter`, `whatsapp`, `uber`, `stripe`, `cache-aside`, `async-workers`, `retry-storm`, `sharded-database`, `read-replicas`, `rate-limited-api`, `cdn-origin`, `event-driven`, `resilient-delivery` …) | `src/sim/presets.ts` | `Preset { id, name, tagline, description, topology }` |
| Walkthrough UI | 5-step modal (Requirements/Entities/API/HLD/Deep Dives) + pack sidebar + Pin + Load starter | `src/components/InterviewPractice.tsx` | Sidebar fits 3; needs search/filter past ~8 |
| Concept teaching | 6 static Guide tabs (Overview/Building/Traffic/Resilience/Presets/Shortcuts) + Glossary panel + tooltips | `src/components/guide/*`, `Glossary.tsx` | No lesson object yet; panes are hardcoded TSX |
| Live proof | p50/p99, throughput/goodput, errors/drops, queue depth, per-node stats in `SystemStats`/`HistoryPoint` | `src/sim/types.ts`, `Metrics.tsx` | Checks can read these for auto-grading later |

## 2. Target content set (from Pages 2–8, renamed originally)

- **Concepts: ~34 lessons** — 9 core (networking, API, modeling, indexing, caching,
  sharding, hashing, consistency, numbers) + ~13 tech briefs (relational, NoSQL, blob,
  search, gateway, LB, queue, stream, lock, cache-dist, CDN/edge, workers, coordination)
  + 7 patterns (realtime, contention, multistep, reads, writes, blobs, longjobs) + 5 advanced
  (geo-search, timeseries, sketches, vector-ann, CDC).
- **Problems: 36 packs** — Pages 5–6. 8 map to existing presets directly; ~10 reuse a
  generic preset tuned; ~12–14 want a small new/forked preset (auction room, flash queue,
  collab session, top-K aggregator, crawl frontier, telemetry pipe, live fan-out …).
- **Practice labs: new type** — each lab = runnable task with goal + checks. V1 = checklist
  the learner ticks; V2 = auto-checks reading `SystemStats` (p99/loss/hit-rate).

## 3. Proposed content model (additive, no breaking changes)

```ts
// src/content/concepts.ts (NEW, split per file under src/content/concepts/)
interface ConceptLesson {
  id: string;                 // e.g. 'caching', 'contention', 'sketches'
  title: string;              // original title
  track: 'core' | 'tech' | 'pattern' | 'advanced';
  summary: string;            // 2–3 sentences
  whenToUse: string[];        // bullets
  pitfalls: string[];         // what goes wrong
  simDemo: { presetId: string; scenario: string; watch: string };
  glossaryIds: string[];      // must exist in GLOSSARY
  checkYourself: string[];    // 2–3 self-quiz prompts
}

// interviewPacks.ts — ADD only optional links (no level tiers per request):
interface InterviewPack {
  /* existing fields unchanged */
  concepts?: string[];  // ConceptLesson ids introduced
  patterns?: string[];  // pattern ids reused
}

// src/content/practice.ts (NEW)
interface PracticeLab {
  id: string;               // e.g. 'lab-cache-p99'
  title: string;
  packId?: string;          // parent problem (optional)
  conceptIds: string[];
  objective: string;
  setupPresetId: string;    // must exist in PRESETS
  scenario: 'steady' | 'ramp' | 'spike' | 'diurnal';
  tasks: { title: string; detail: string; hint?: string }[];
  checksV1: string[];       // self-check statements (ticked manually)
  // V2 (later): checksAuto: { metric: 'p99'|'errorRate'|'hitRate'|...; op: '<'|'>'; value: number }[]
}
```

Tests to add (mirror existing style): unique ids per collection; every `presetId`/`setupPresetId`
exists; every `glossaryIds`/`conceptIds`/`packId` resolves; no banned brand strings;
content budgets (e.g. pack prompt < 600 chars) to keep bundle sane.

## 4. File + UI plan (keeps diffs reviewable)

- **Files:** `src/content/concepts/{core,tech,patterns,advanced}.ts` + `index.ts` re-exporting
  `CONCEPTS`; `src/content/packs/{easy,social,realtime,transactions,infra,media}.ts` +
  keep `interviewPacks.ts` as index re-export so `App.tsx` import is unchanged;
  `src/content/practice/{labs-*.ts}` + `practice.ts`. One test file per collection.
- **Problem UI:** extend `InterviewPractice` sidebar with search input + difficulty filter
  (`Core/Popular/Hard`) + track groups; virtualize only if slow (36 rows is fine without).
- **Concept UI (recommended):** new `Concepts` tab in `GuideModal` (or a `Learn` modal if
  Guide gets crowded) rendering `CONCEPTS` grouped by track, each with Pin-to-canvas +
  "Open demo preset" (same primitives as practice). Glossary panel gains "Lesson" link
  where `glossaryIds` back-references exist.
- **Practice UI (V1):** new `PracticeLabs` section inside Interview Practice (or its own modal):
  objective → setup loader (preset + scenario) → task checklist with per-task Pin/Hint →
  self-check ticks → "Mark complete" stored in `localStorage`. No grading engine in V1.
- **V2 auto-checks (deferred):** a `evaluateLab(stats: SystemStats)` helper + "Run checks"
  button; thresholds per lab (e.g. `p99 < 200`, `dropRate == 0`). Needs lab-tuned thresholds
  from real sim runs — do not guess.

## 5. Preset strategy (avoid 14 new topologies if possible)

- Reuse-first: shortener→`tinyurl`/`cache-aside`; feed/social→`twitter` fork with copy change;
  chat/notify/live→`whatsapp`/`event-driven`; payments→`stripe`; ride/delivery→`uber`;
  judge/CI/crawl→`async-workers` + queue tune; search→`specialised-stores` + search-index note.
- New only where the sim story is unique: auction/bid room, flash-sale admission queue,
  collab session (WS gateway affinity), top-K windowed aggregator, telemetry pipe
  (timeseries note), crawler frontier (politeness shards). Each new preset = fork an existing
  topology JSON + retag, not a from-scratch build.
- Rule: every pack ships with a named `scenario` + "what to watch" chart (p99, hit-rate,
  queue depth, error %) so the sim proves the tradeoff.

## 6. Phasing + effort (honest)

| Phase | Scope | Why this order |
|---|---|---|
| 0. Infra | Split pack files, add `CONCEPTS` + `PRACTICE` scaffolds + tests, sidebar search/filter | Unblocks parallel content PRs; no prose yet |
| 1. Core concepts (9) + glossary batch (~18 terms) | Highest reuse; every pack links here | Prose-heavy but preset-free |
| 2. P0 problems (8, presets exist) | Ticket-hold, photo feed, code runner, ride dispatch + 4 short ones | Runnable day one |
| 3. Tech + patterns (20) | Fills lesson browser | Reuses P0 demos |
| 4. P1 problems (~14, small preset forks) | Auction, flash sale, collab, notify, top-K, telemetry, crawler, payments-lite … | Needs sim tuning per preset |
| 5. Practice labs V1 (12–16 labs for P0/P1) | Checklist labs tied to packs/concepts | No grading engine |
| 6. Advanced (5) + remaining problems + V2 auto-checks | Sketches, TSDB, vectors, geo, CDC; leftover guided-only shapes | Polish; thresholds from real runs |

Rough size: concept ~30–45 min each, problem pack ~1–2 h each (original prose + estimates +
preset verify), lab V1 ~45–60 min each, preset fork ~1–2 h each. Full 36+34+16 in one go is a
**multi-day, multi-PR** effort — phases above keep `main` green after each merge.

## 7. Recommended next step

Confirm: (a) phased vs big-bang, (b) practice V1 checklist vs V2 auto-graded now,
(c) concept home (Guide tab vs separate Learn modal). Then implement Phase 0 + first
content batch. Suggested start: Phase 0 + 9 core concepts + 4 P0 packs + 4 labs.
