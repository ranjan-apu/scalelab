# Page 11: Build Record — big-bang implementation (this branch)

> Implemented on `work/fresh-from-main-20260912` after fast-forwarding to remote
> `main` at `7780a5d` (2 merged PRs). Choices honored: big-bang, auto-graded labs
> from day one, concepts live as a Guide tab. No level tiers. No external branding
> anywhere (`rg` clean over `src public index.html docs README.md`).

## Shipped (all tests green: 47 files, 1086 tests; `tsc -b` clean)

- **37 packs** (`src/content/interviewPacks.ts` + `src/content/packs/{core,social,realtime,transactions,media-infra}.ts`):
  3 founding + 34 new covering all 36 surveyed shapes plus a music-streaming bonus.
- **34 concepts** (`src/content/concepts.ts`): 9 core, 13 tech, 7 patterns, 5 advanced.
- **37 labs** (`src/content/labs.ts`): one per pack, `evaluateLab()` grades p99/p95/errorRate/
  goodput-ratio plus per-kind hitRate/utilization against the live snapshot, averaging
  history tails against flake. Thresholds calibrated from headless 60s engine runs per setup.
- **13 glossary terms** added (115 total): consistent-hashing, presigned-url, inverted-index,
  ttl-lock, heartbeat, idempotency-key, saga, durable-execution, geoshard, timeseries-rollup,
  sketch-counter, vector-ann, cdc.
- **4 preset variants** reusing proven topologies with lesson framing:
  `photofeed`, `auction`, `livefirehose`, `topk` (30 presets total).
- **Guide Concepts tab** (`ConceptsPane.tsx`): search + track filter over 34 lessons.
- **Interview Practice upgrade**: search + difficulty filter over 37 packs; 6th Practice Lab
  step with task checklist, one-click lab setup (preset + scenario), Run checks grading,
  completion persisted to localStorage.
- **App wiring**: `handleLoadLab` stamps the scenario onto sources in one undoable load.

## Counts vs survey

Survey Pages 5–6 list 36 shapes (32 written + 4 guided-only). Library holds 37 packs/labs:
all 36 covered, plus `music-stream` reusing the existing Spotify-style preset.
