# System Design Knowledge Survey — Page 0: Index

> Research dossier compiled in `scalelab-fresh` worktree (`work/fresh-from-main-20260912`,
> base `84bce44`). Purpose: survey a popular public interview-prep site's **system
> design** track so we can design **original** ScaleLab lessons. All notes below are
> paraphrased summaries — no copied prose, no brand naming in product code.

## How this dossier is organized (page indices)

| Page | File | What it holds |
|------|------|---------------|
| 0 | `00-index.md` | This index + method + coverage counts |
| 1 | `01-course-map-and-delivery.md` | Course track layout + the 6-step delivery framework |
| 2 | `02-core-concepts.md` | 9 technology-agnostic fundamentals |
| 3 | `03-key-technologies.md` | ~13 building-block categories + 9 tech deep-dives |
| 4 | `04-common-patterns.md` | 7 reusable interview patterns |
| 5 | `05-problem-catalog-a.md` | Design problems 1–16 (Easy + first Medium batch) |
| 6 | `06-problem-catalog-b.md` | Design problems 17–36 (rest of Medium + Hard + guided-only) |
| 7 | `07-breakdown-anatomy.md` | Template every breakdown follows + 6 sampled structures (own words) |
| 8 | `08-advanced-wild-quiz-practice.md` | Advanced topics, real-world posts, quizzes, practice modes |
| 9 | `09-integration-plan.md` | Clean-room plan to add lessons/concepts to ScaleLab (no external branding) |

## Method

1. Opened the reference site in a real browser (Helium via `browser-tools`) and walked
   the left nav: Introduction → How to Prepare → Delivery → Core Concepts →
   Key Technologies → Common Patterns → Question Breakdowns → Advanced → In the Wild.
2. Extracted headings/link structure via DOM (`document.querySelectorAll`), not screenshots.
3. Used `fetch_content` readability extraction for Core Concepts / Key Technologies prose,
   then **summarized** — the dossier never reproduces full paragraphs.
4. Sampled 6 breakdowns (shortener, photo feed, ride-share, ticketing, chat, video)
   for heading structure only, to learn the teaching template.

## Coverage counts (observed Sept 2026)

- Core concepts: **9**
- Key-technology categories: **~13** (Core DB, Blob, Search, Gateway, LB, Queue, Streams,
  Distributed Lock, Distributed Cache, CDN, + more) + **9** named tech deep-dives
- Common patterns: **7**
- Written breakdowns: **32** (4 Easy, ~16 Medium, ~12 Hard by site labels)
- Guided-only practice (no write-up): **4** (Food Review, Leaderboard, Donations, CI runner)
- Advanced deep-dives: **5** + 5 real-world "in the wild" posts
- Interview delivery steps: **6** (Requirements → Entities → API → [Data Flow] → HLD → Deep dives)

## Clean-room rule (read before Page 9)

- Product code, UI strings, lesson titles and lesson bodies must be **original**.
- Do not paste breakdown text, do not reuse problem statements verbatim, do not show
  the reference site's brand anywhere in the app.
- What transfers is **structure and topic coverage**: which concepts to teach, which
  problem shapes to cover, which deep-dive questions to pose, and how to map each to
  a runnable ScaleLab preset + simulation.

Next → Page 1: `01-course-map-and-delivery.md`
