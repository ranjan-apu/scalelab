/**
 * Practice labs: hands-on tasks graded against the live simulation.
 *
 * A pack walks the interview track; a lab proves the system meets its SLO.
 * Each lab loads a preset plus a traffic scenario, assigns a few tasks, and
 * grades checks against the current snapshot. Thresholds come from headless
 * engine runs over every setup (60s sim time each), with headroom added so a
 * healthy system passes and a broken one cannot.
 *
 * Grading reads `SystemStats` (p50/p95/p99, errorRate, goodput/offered) and,
 * for node checks, nodes of one kind in the loaded topology. System latency
 * and error checks average the recent history tail so a single spike sample
 * cannot flake the verdict.
 */

import type { NodeKind, SimSnapshot, Topology, TrafficPattern } from '../sim/types';

export type LabMetric =
  | 'p99'
  | 'p95'
  | 'errorRate'
  | 'goodputRatio'
  | 'hitRate'
  | 'utilization';

export interface LabCheck {
  id: string;
  label: string;
  scope: 'system' | 'node';
  nodeKind?: NodeKind;
  metric: LabMetric;
  op: '<' | '>';
  value: number;
}

export interface LabTask {
  title: string;
  detail: string;
  hint?: string;
}

export interface PracticeLab {
  id: string;
  title: string;
  packId: string;
  conceptIds: string[];
  objective: string;
  setupPresetId: string;
  scenario: TrafficPattern;
  tasks: LabTask[];
  checks: LabCheck[];
}

export interface CheckResult {
  check: LabCheck;
  actual: number;
  pass: boolean;
}

/** Mean of the last few history points, so one sample cannot flake a verdict. */
function recentMean(
  history: SimSnapshot['history'],
  pick: (p: SimSnapshot['history'][number]) => number,
): number | null {
  if (history.length === 0) return null;
  const tail = history.slice(-10);
  const sum = tail.reduce((acc, p) => acc + pick(p), 0);
  return sum / tail.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function evaluateLab(
  snapshot: SimSnapshot,
  topology: Topology,
  lab: PracticeLab,
): CheckResult[] {
  return lab.checks.map((check) => {
    let actual = NaN;
    if (check.scope === 'system') {
      switch (check.metric) {
        case 'p99':
          actual = recentMean(snapshot.history, (p) => p.p99) ?? snapshot.system.p99;
          break;
        case 'p95':
          actual = recentMean(snapshot.history, (p) => p.p95) ?? snapshot.system.p95;
          break;
        case 'errorRate':
          actual =
            recentMean(snapshot.history, (p) => p.errorRate) ?? snapshot.system.errorRate;
          break;
        case 'goodputRatio':
          actual =
            snapshot.system.offeredRps > 0
              ? snapshot.system.goodputRps / snapshot.system.offeredRps
              : 1;
          break;
        default:
          actual = NaN;
      }
    } else if (check.nodeKind) {
      const stats = topology.nodes
        .filter((n) => n.kind === check.nodeKind)
        .map((n) => snapshot.nodes[n.id])
        .filter((s) => s !== undefined);
      if (stats.length > 0) {
        if (check.metric === 'hitRate') {
          actual = stats.reduce((acc, s) => acc + s.hitRate, 0) / stats.length;
        } else if (check.metric === 'utilization') {
          actual = Math.max(...stats.map((s) => s.utilization));
        }
      }
    }
    const pass =
      Number.isFinite(actual) && (check.op === '<' ? actual < check.value : actual > check.value);
    return { check, actual: Number.isFinite(actual) ? round2(actual) : NaN, pass };
  });
}

export function labPassed(results: readonly CheckResult[]): boolean {
  return results.length > 0 && results.every((r) => r.pass);
}

const stdTasks = {
  load: 'Load the lab setup below, then start the scenario and watch one full cycle.',
  pin: 'Pin the failing chart to the canvas as a note before changing anything.',
};

export const LABS: readonly PracticeLab[] = [
  {
    id: 'lab-url-shortener',
    title: 'Serve redirects from memory',
    packId: 'url-shortener',
    conceptIds: ['caching', 'scaling-reads'],
    objective: 'Keep redirect latency flat while opens outnumber shortens a hundred to one.',
    setupPresetId: 'tinyurl',
    scenario: 'steady',
    tasks: [
      { title: 'Run the redirect path', detail: stdTasks.load },
      {
        title: 'Starve the cache',
        detail: 'Drop the cache hit rate toward 0.4 and watch p99 climb, then restore it.',
        hint: 'Select the cache node and move hit rate in the Inspector.',
      },
      {
        title: 'Confirm recovery',
        detail: 'With the cache healthy again, run the checks below.',
      },
    ],
    checks: [
      { id: 'p99', label: 'Redirect p99 under 120ms', scope: 'system', metric: 'p99', op: '<', value: 120 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'hit', label: 'Cache tier above 80% hits', scope: 'node', nodeKind: 'cache', metric: 'hitRate', op: '>', value: 0.8 },
    ],
  },
  {
    id: 'lab-timeline',
    title: 'Hold feed reads to one hit',
    packId: 'timeline',
    conceptIds: ['scaling-reads', 'caching'],
    objective: 'Serve a celebrity-burst timeline without reads fanning out per open.',
    setupPresetId: 'twitter',
    scenario: 'steady',
    tasks: [
      { title: 'Run the feed', detail: stdTasks.load },
      {
        title: 'Force the merge path',
        detail: 'Bypass the timeline cache mentally: which reads would fan out, and what would p99 do?',
        hint: 'Watch the fanout worker utilization while the burst fires.',
      },
      { title: 'Confirm the precompute win', detail: 'With the cache path live, run the checks below.' },
    ],
    checks: [
      { id: 'p99', label: 'Feed p99 under 160ms', scope: 'system', metric: 'p99', op: '<', value: 160 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'hit', label: 'Timeline cache above 75% hits', scope: 'node', nodeKind: 'cache', metric: 'hitRate', op: '>', value: 0.75 },
    ],
  },
  {
    id: 'lab-group-chat',
    title: 'Deliver while devices flap',
    packId: 'group-chat',
    conceptIds: ['realtime-updates', 'message-queue'],
    objective: 'Buffer for offline devices without losing a message or stalling senders.',
    setupPresetId: 'whatsapp',
    scenario: 'steady',
    tasks: [
      { title: 'Run steady chat', detail: stdTasks.load },
      {
        title: 'Watch the offline buffer',
        detail: 'Find the offline queue and confirm depth drains instead of errors rising.',
      },
      { title: 'Confirm delivery health', detail: 'Run the checks below with the buffer draining.' },
    ],
    checks: [
      { id: 'p99', label: 'Send p99 under 250ms', scope: 'system', metric: 'p99', op: '<', value: 250 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'ratio', label: 'Goodput keeps up with offered load', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.95 },
    ],
  },
  {
    id: 'lab-seat-hold',
    title: 'Survive the on-sale spike',
    packId: 'seat-hold',
    conceptIds: ['contention-control', 'distributed-lock'],
    objective: 'Meter the rush, hold seats fairly, and never double-book.',
    setupPresetId: 'ticketmaster',
    scenario: 'spike',
    tasks: [
      { title: 'Fire the on-sale burst', detail: stdTasks.load },
      {
        title: 'Read the waiting room',
        detail: 'Watch queue depth absorb the burst while booking errors stay flat.',
      },
      { title: 'Confirm fairness', detail: 'Run the checks at the height of the spike.' },
    ],
    checks: [
      { id: 'p99', label: 'Booking p99 under 60ms', scope: 'system', metric: 'p99', op: '<', value: 60 },
      { id: 'err', label: 'Error rate under 5%', scope: 'system', metric: 'errorRate', op: '<', value: 0.05 },
      { id: 'ratio', label: 'Goodput above 90% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.9 },
    ],
  },
  {
    id: 'lab-photo-feed',
    title: 'Deliver media instantly',
    packId: 'photo-feed',
    conceptIds: ['large-blobs', 'cdn-edge'],
    objective: 'Keep photo opens instant while uploads climb through the ramp.',
    setupPresetId: 'photofeed',
    scenario: 'ramp',
    tasks: [
      { title: 'Ride the ramp', detail: stdTasks.load },
      {
        title: 'Separate the paths',
        detail: 'Confirm media bytes ride the edge while metadata takes the API path.',
      },
      { title: 'Confirm edge health', detail: 'Run the checks near peak ramp.' },
    ],
    checks: [
      { id: 'p99', label: 'Open p99 under 160ms', scope: 'system', metric: 'p99', op: '<', value: 160 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'hit', label: 'Feed cache above 70% hits', scope: 'node', nodeKind: 'cache', metric: 'hitRate', op: '>', value: 0.7 },
    ],
  },
  {
    id: 'lab-code-runner',
    title: 'Judge bursts without losing runs',
    packId: 'code-runner',
    conceptIds: ['workers-async', 'long-running-tasks'],
    objective: 'Queue contest submissions and drain them without a lost run.',
    setupPresetId: 'leetcode',
    scenario: 'steady',
    tasks: [
      { title: 'Run submissions', detail: stdTasks.load },
      {
        title: 'Watch the judge pool',
        detail: 'Confirm workers stay below saturation while the queue stays near zero.',
      },
      { title: 'Confirm judging health', detail: 'Run the checks below.' },
    ],
    checks: [
      { id: 'p99', label: 'Submit p99 under 100ms', scope: 'system', metric: 'p99', op: '<', value: 100 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'util', label: 'No worker past 90% utilization', scope: 'node', nodeKind: 'worker', metric: 'utilization', op: '<', value: 0.9 },
    ],
  },
  {
    id: 'lab-ride-dispatch',
    title: 'Match through the day curve',
    packId: 'ride-dispatch',
    conceptIds: ['scaling-writes', 'proximity-search'],
    objective: 'Match riders across a full day of driver movement without stale pickups.',
    setupPresetId: 'uber',
    scenario: 'diurnal',
    tasks: [
      { title: 'Run the day', detail: stdTasks.load },
      {
        title: 'Compare the streams',
        detail: 'Note how location writes dwarf rider reads, then find the consumer that trails.',
      },
      { title: 'Confirm matching health', detail: 'Run the checks near the afternoon peak.' },
    ],
    checks: [
      { id: 'p99', label: 'Request p99 under 200ms', scope: 'system', metric: 'p99', op: '<', value: 200 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'ratio', label: 'Goodput above 90% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.9 },
    ],
  },
  {
    id: 'lab-file-sync',
    title: 'Sync deltas, not whole files',
    packId: 'file-sync',
    conceptIds: ['large-blobs', 'cdn-edge'],
    objective: 'Keep sync fast with chunked uploads and edge-served downloads.',
    setupPresetId: 'full-stack',
    scenario: 'steady',
    tasks: [
      { title: 'Run sync traffic', detail: stdTasks.load },
      {
        title: 'Split metadata from bytes',
        detail: 'Confirm small metadata writes and large blob transfers take different paths.',
      },
      { title: 'Confirm sync health', detail: 'Run the checks below.' },
    ],
    checks: [
      { id: 'p99', label: 'Sync p99 under 130ms', scope: 'system', metric: 'p99', op: '<', value: 130 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'hit', label: 'Edge cache above 60% hits', scope: 'node', nodeKind: 'cdn', metric: 'hitRate', op: '>', value: 0.6 },
    ],
  },
  {
    id: 'lab-local-reviews',
    title: 'Search nearby without scanning',
    packId: 'local-reviews',
    conceptIds: ['search-index', 'proximity-search'],
    objective: 'Answer geo plus text queries from indexes, never from scans.',
    setupPresetId: 'specialised-stores',
    scenario: 'steady',
    tasks: [
      { title: 'Run review traffic', detail: stdTasks.load },
      {
        title: 'Isolate the search path',
        detail: 'Confirm search queries leave primary write pools untouched.',
      },
      { title: 'Confirm search health', detail: 'Run the checks below.' },
    ],
    checks: [
      { id: 'p99', label: 'Search p99 under 300ms', scope: 'system', metric: 'p99', op: '<', value: 300 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'ratio', label: 'Goodput above 90% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.9 },
    ],
  },
  {
    id: 'lab-delivery-dispatch',
    title: 'Dispatch the dinner rush',
    packId: 'delivery-dispatch',
    conceptIds: ['scaling-writes', 'multistep-sagas'],
    objective: 'Assign every dinner-rush order exactly once while couriers move.',
    setupPresetId: 'uber',
    scenario: 'spike',
    tasks: [
      { title: 'Fire the dinner spike', detail: stdTasks.load },
      {
        title: 'Watch dispatch absorb it',
        detail: 'Track queue depth and matching latency through the burst peak.',
      },
      { title: 'Confirm dispatch health', detail: 'Run the checks at burst peak.' },
    ],
    checks: [
      { id: 'p99', label: 'Dispatch p99 under 1200ms', scope: 'system', metric: 'p99', op: '<', value: 1200 },
      { id: 'err', label: 'Error rate under 5%', scope: 'system', metric: 'errorRate', op: '<', value: 0.05 },
      { id: 'ratio', label: 'Goodput above 90% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.9 },
    ],
  },
  {
    id: 'lab-match-feed',
    title: 'Discover without hot spots',
    packId: 'match-feed',
    conceptIds: ['sharding', 'proximity-search'],
    objective: 'Spread discovery reads evenly while profiles concentrate in cities.',
    setupPresetId: 'sharded-database',
    scenario: 'steady',
    tasks: [
      { title: 'Run discovery reads', detail: stdTasks.load },
      {
        title: 'Heat one shard',
        detail: 'Raise the hot key fraction and watch one partition pull away from the rest.',
        hint: 'Select the sharded store and move the hot key control.',
      },
      {
        title: 'Confirm balance',
        detail: 'Restore even keys and run the checks below.',
      },
    ],
    checks: [
      { id: 'p99', label: 'Discovery p99 under 180ms', scope: 'system', metric: 'p99', op: '<', value: 180 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'ratio', label: 'Goodput above 90% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.9 },
    ],
  },
  {
    id: 'lab-activity-tracker',
    title: 'Ingest every stride',
    packId: 'activity-tracker',
    conceptIds: ['scaling-writes', 'event-streams'],
    objective: 'Absorb GPS write streams while feeds and leaderboards read on.',
    setupPresetId: 'event-driven',
    scenario: 'ramp',
    tasks: [
      { title: 'Ride the workout ramp', detail: stdTasks.load },
      {
        title: 'Find the lagging consumer',
        detail: 'Compare consumer groups and name which one trails first.',
      },
      { title: 'Confirm ingest health', detail: 'Run the checks near ramp peak.' },
    ],
    checks: [
      { id: 'p99', label: 'Ingest p99 under 140ms', scope: 'system', metric: 'p99', op: '<', value: 140 },
      { id: 'err', label: 'Error rate under 8%', scope: 'system', metric: 'errorRate', op: '<', value: 0.08 },
      { id: 'ratio', label: 'Goodput above 90% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.9 },
    ],
  },
  {
    id: 'lab-live-comments',
    title: 'Order the goal-moment burst',
    packId: 'live-comments',
    conceptIds: ['realtime-updates', 'scaling-writes'],
    objective: 'Fan out a broadcast burst in order without dropping late joiners.',
    setupPresetId: 'livefirehose',
    scenario: 'spike',
    tasks: [
      { title: 'Fire the burst', detail: stdTasks.load },
      {
        title: 'Read lag, not errors',
        detail: 'Confirm push tiers saturate while senders keep succeeding.',
      },
      { title: 'Confirm burst health', detail: 'Run the checks at burst peak.' },
    ],
    checks: [
      { id: 'p99', label: 'Comment p99 under 600ms', scope: 'system', metric: 'p99', op: '<', value: 600 },
      { id: 'err', label: 'Error rate under 25%', scope: 'system', metric: 'errorRate', op: '<', value: 0.25 },
      { id: 'ratio', label: 'Goodput above 70% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.7 },
    ],
  },
  {
    id: 'lab-news-aggregator',
    title: 'Cluster the news cycle',
    packId: 'news-aggregator',
    conceptIds: ['workers-async', 'scaling-reads'],
    objective: 'Dedup and rank the ingest flood without blocking readers.',
    setupPresetId: 'async-workers',
    scenario: 'steady',
    tasks: [
      { title: 'Run article ingest', detail: stdTasks.load },
      {
        title: 'Watch workers drain',
        detail: 'Confirm the backlog stays near zero while ranking reads stay fast.',
      },
      { title: 'Confirm pipeline health', detail: 'Run the checks below.' },
    ],
    checks: [
      { id: 'p99', label: 'Pipeline p99 under 50ms', scope: 'system', metric: 'p99', op: '<', value: 50 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'util', label: 'No worker past 90% utilization', scope: 'node', nodeKind: 'worker', metric: 'utilization', op: '<', value: 0.9 },
    ],
  },
  {
    id: 'lab-notify-hub',
    title: 'Shed notifications gracefully',
    packId: 'notify-hub',
    conceptIds: ['realtime-updates', 'message-queue'],
    objective: 'Stay fast under a notification flood by shedding excess instead of queueing it.',
    setupPresetId: 'event-driven',
    scenario: 'spike',
    tasks: [
      { title: 'Flood the hub', detail: stdTasks.load },
      {
        title: 'Prefer fast over total',
        detail: 'Confirm p99 stays flat while goodput trails offered: that gap is shedding, not failure.',
      },
      { title: 'Confirm shedding health', detail: 'Run the checks at flood peak.' },
    ],
    checks: [
      { id: 'p99', label: 'Notify p99 under 160ms', scope: 'system', metric: 'p99', op: '<', value: 160 },
      { id: 'ratio', label: 'Goodput above 35% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.35 },
    ],
  },
  {
    id: 'lab-auction-room',
    title: 'Close with one winner',
    packId: 'auction-room',
    conceptIds: ['contention-control', 'distributed-lock'],
    objective: 'Serialize closing-second bids so exactly one bidder wins.',
    setupPresetId: 'auction',
    scenario: 'spike',
    tasks: [
      { title: 'Fire the closing rush', detail: stdTasks.load },
      {
        title: 'Watch serialization',
        detail: 'Confirm bids queue and losers fail fast instead of timing out.',
      },
      { title: 'Confirm close health', detail: 'Run the checks at the rush peak.' },
    ],
    checks: [
      { id: 'p99', label: 'Bid p99 under 60ms', scope: 'system', metric: 'p99', op: '<', value: 60 },
      { id: 'err', label: 'Error rate under 5%', scope: 'system', metric: 'errorRate', op: '<', value: 0.05 },
      { id: 'ratio', label: 'Goodput above 90% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.9 },
    ],
  },
  {
    id: 'lab-flash-sale',
    title: 'Choose what fails',
    packId: 'flash-sale',
    conceptIds: ['contention-control', 'load-balancer'],
    objective: 'Protect checkout with admission control while the crowd gets a fair queue.',
    setupPresetId: 'resilient-delivery',
    scenario: 'spike',
    tasks: [
      { title: 'Open the floodgates', detail: stdTasks.load },
      {
        title: 'Shed the low priority lane',
        detail: 'Confirm the shedder drops browsing traffic while checkout stays fast.',
      },
      { title: 'Confirm protection health', detail: 'Run the checks at flood peak.' },
    ],
    checks: [
      { id: 'p99', label: 'Checkout p99 under 120ms', scope: 'system', metric: 'p99', op: '<', value: 120 },
      { id: 'ratio', label: 'Goodput above 35% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.35 },
      { id: 'err', label: 'Error rate under 70%', scope: 'system', metric: 'errorRate', op: '<', value: 0.7 },
    ],
  },
  {
    id: 'lab-payments-ledger',
    title: 'Never charge twice',
    packId: 'payments-ledger',
    conceptIds: ['multistep-sagas', 'contention-control'],
    objective: 'Apply every charge once while retries and webhooks redeliver freely.',
    setupPresetId: 'stripe',
    scenario: 'steady',
    tasks: [
      { title: 'Run payment traffic', detail: stdTasks.load },
      {
        title: 'Retry on purpose',
        detail: 'Confirm duplicate submits answer from stored results instead of recharging.',
      },
      { title: 'Confirm ledger health', detail: 'Run the checks below.' },
    ],
    checks: [
      { id: 'p99', label: 'Charge p99 under 800ms', scope: 'system', metric: 'p99', op: '<', value: 800 },
      { id: 'err', label: 'Error rate under 5%', scope: 'system', metric: 'errorRate', op: '<', value: 0.05 },
      { id: 'ratio', label: 'Goodput above 90% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.9 },
    ],
  },
  {
    id: 'lab-trading-quotes',
    title: 'Fan out quotes, guard orders',
    packId: 'trading-quotes',
    conceptIds: ['realtime-updates', 'contention-control'],
    objective: 'Stream quotes to everyone while order placement stays strictly serialized.',
    setupPresetId: 'event-driven',
    scenario: 'spike',
    tasks: [
      { title: 'Ride the market spike', detail: stdTasks.load },
      {
        title: 'Separate the lanes',
        detail: 'Confirm quotes degrade gracefully while order writes stay correct.',
      },
      { title: 'Confirm market health', detail: 'Run the checks at spike peak.' },
    ],
    checks: [
      { id: 'p99', label: 'Market p99 under 160ms', scope: 'system', metric: 'p99', op: '<', value: 160 },
      { id: 'ratio', label: 'Goodput above 35% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.35 },
    ],
  },
  {
    id: 'lab-collab-docs',
    title: 'Merge concurrent edits',
    packId: 'collab-docs',
    conceptIds: ['realtime-updates', 'consistency-models'],
    objective: 'Keep every editor in sync with ordered, lossless edit delivery.',
    setupPresetId: 'discord',
    scenario: 'steady',
    tasks: [
      { title: 'Run editing sessions', detail: stdTasks.load },
      {
        title: 'Stress the session tier',
        detail: 'Confirm connection holders, not request queues, set the ceiling.',
      },
      { title: 'Confirm sync health', detail: 'Run the checks below.' },
    ],
    checks: [
      { id: 'p99', label: 'Edit p99 under 200ms', scope: 'system', metric: 'p99', op: '<', value: 200 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'ratio', label: 'Goodput above 90% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.9 },
    ],
  },
  {
    id: 'lab-video-platform',
    title: 'Stream while encoding lags',
    packId: 'video-platform',
    conceptIds: ['large-blobs', 'long-running-tasks'],
    objective: 'Serve viewers from the edge while the encode farm works through uploads.',
    setupPresetId: 'netflix',
    scenario: 'ramp',
    tasks: [
      { title: 'Ride the evening ramp', detail: stdTasks.load },
      {
        title: 'Split serving from processing',
        detail: 'Confirm edge hits stay high even as the encode backlog grows.',
      },
      { title: 'Confirm streaming health', detail: 'Run the checks near ramp peak.' },
    ],
    checks: [
      { id: 'p99', label: 'Playback p99 under 250ms', scope: 'system', metric: 'p99', op: '<', value: 250 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'hit', label: 'Edge cache above 90% hits', scope: 'node', nodeKind: 'cdn', metric: 'hitRate', op: '>', value: 0.9 },
    ],
  },
  {
    id: 'lab-web-crawler',
    title: 'Crawl politely at scale',
    packId: 'web-crawler',
    conceptIds: ['workers-async', 'scaling-writes'],
    objective: 'Fetch the frontier steadily with deduped URLs and a drained queue.',
    setupPresetId: 'async-workers',
    scenario: 'steady',
    tasks: [
      { title: 'Run the crawl', detail: stdTasks.load },
      {
        title: 'Watch fetch workers',
        detail: 'Confirm workers stay below saturation while the queue stays near zero.',
      },
      { title: 'Confirm crawl health', detail: 'Run the checks below.' },
    ],
    checks: [
      { id: 'p99', label: 'Crawl p99 under 50ms', scope: 'system', metric: 'p99', op: '<', value: 50 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'util', label: 'No worker past 90% utilization', scope: 'node', nodeKind: 'worker', metric: 'utilization', op: '<', value: 0.9 },
    ],
  },
  {
    id: 'lab-metrics-pipe',
    title: 'Alert on windows, not spikes',
    packId: 'metrics-pipe',
    conceptIds: ['timeseries-stores', 'scaling-writes'],
    objective: 'Ingest host metrics while dashboards read rolled-up history.',
    setupPresetId: 'specialised-stores',
    scenario: 'steady',
    tasks: [
      { title: 'Run metric ingest', detail: stdTasks.load },
      {
        title: 'Separate raw from rolled',
        detail: 'Confirm dashboard reads never compete with the ingest stream.',
      },
      { title: 'Confirm pipeline health', detail: 'Run the checks below.' },
    ],
    checks: [
      { id: 'p99', label: 'Pipeline p99 under 300ms', scope: 'system', metric: 'p99', op: '<', value: 300 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'ratio', label: 'Goodput above 90% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.9 },
    ],
  },
  {
    id: 'lab-topk-trending',
    title: 'Rank the viral moment',
    packId: 'topk-trending',
    conceptIds: ['scaling-reads', 'event-streams'],
    objective: 'Count a viral view spike into rankings without slowing the board.',
    setupPresetId: 'topk',
    scenario: 'spike',
    tasks: [
      { title: 'Go viral', detail: stdTasks.load },
      {
        title: 'Count async, serve sync',
        detail: 'Confirm the board serves precomputed ranks while counters absorb the spike.',
      },
      { title: 'Confirm ranking health', detail: 'Run the checks at viral peak.' },
    ],
    checks: [
      { id: 'p99', label: 'Board p99 under 120ms', scope: 'system', metric: 'p99', op: '<', value: 120 },
      { id: 'ratio', label: 'Goodput above 50% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.5 },
      { id: 'hit', label: 'Ranking cache above 80% hits', scope: 'node', nodeKind: 'cache', metric: 'hitRate', op: '>', value: 0.8 },
    ],
  },
  {
    id: 'lab-ad-clicks',
    title: 'Bill clicks approximately right',
    packId: 'ad-clicks',
    conceptIds: ['scaling-writes', 'sketch-structures'],
    objective: 'Aggregate click streams into billable windows without double counting.',
    setupPresetId: 'event-driven',
    scenario: 'ramp',
    tasks: [
      { title: 'Ride the click ramp', detail: stdTasks.load },
      {
        title: 'Window the stream',
        detail: 'Confirm aggregation trails the flood while serving stays flat.',
      },
      { title: 'Confirm billing health', detail: 'Run the checks near ramp peak.' },
    ],
    checks: [
      { id: 'p99', label: 'Click p99 under 140ms', scope: 'system', metric: 'p99', op: '<', value: 140 },
      { id: 'err', label: 'Error rate under 8%', scope: 'system', metric: 'errorRate', op: '<', value: 0.08 },
      { id: 'ratio', label: 'Goodput above 90% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.9 },
    ],
  },
  {
    id: 'lab-post-search',
    title: 'Search recency, not just relevance',
    packId: 'post-search',
    conceptIds: ['search-index', 'change-capture'],
    objective: 'Serve fresh post search from an index that trails writes by seconds.',
    setupPresetId: 'specialised-stores',
    scenario: 'steady',
    tasks: [
      { title: 'Run search traffic', detail: stdTasks.load },
      {
        title: 'Measure the lag',
        detail: 'State how stale a new post may be before searchers notice.',
      },
      { title: 'Confirm search health', detail: 'Run the checks below.' },
    ],
    checks: [
      { id: 'p99', label: 'Search p99 under 300ms', scope: 'system', metric: 'p99', op: '<', value: 300 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'ratio', label: 'Goodput above 90% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.9 },
    ],
  },
  {
    id: 'lab-cache-service',
    title: 'Size for the head',
    packId: 'cache-service',
    conceptIds: ['distributed-cache', 'consistent-hashing'],
    objective: 'Hold the working set in memory and prove the database barely notices.',
    setupPresetId: 'cache-aside',
    scenario: 'steady',
    tasks: [
      { title: 'Run cache traffic', detail: stdTasks.load },
      {
        title: 'Evict the tail',
        detail: 'Confirm the head of the distribution carries the hit rate alone.',
      },
      { title: 'Confirm cache health', detail: 'Run the checks below.' },
    ],
    checks: [
      { id: 'p99', label: 'Read p99 under 100ms', scope: 'system', metric: 'p99', op: '<', value: 100 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'hit', label: 'Cache above 75% hits', scope: 'node', nodeKind: 'cache', metric: 'hitRate', op: '>', value: 0.75 },
    ],
  },
  {
    id: 'lab-edge-rate-limiter',
    title: 'Refuse at the door',
    packId: 'edge-rate-limiter',
    conceptIds: ['api-gateway', 'api-design'],
    objective: 'Shed abusive bursts at the edge while legitimate callers stay fast.',
    setupPresetId: 'rate-limited-api',
    scenario: 'spike',
    tasks: [
      { title: 'Send the abusive spike', detail: stdTasks.load },
      {
        title: 'Read the refusal',
        detail: 'Confirm refused requests fail fast instead of queueing behind each other.',
      },
      { title: 'Confirm limiter health', detail: 'Run the checks at spike peak.' },
    ],
    checks: [
      { id: 'p99', label: 'Served p99 under 400ms', scope: 'system', metric: 'p99', op: '<', value: 400 },
      { id: 'ratio', label: 'Goodput above 25% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.25 },
      { id: 'err', label: 'Error rate under 80%', scope: 'system', metric: 'errorRate', op: '<', value: 0.8 },
    ],
  },
  {
    id: 'lab-job-scheduler',
    title: 'Fire every trigger once',
    packId: 'job-scheduler',
    conceptIds: ['workers-async', 'coordination'],
    objective: 'Execute scheduled jobs exactly once even as owners change.',
    setupPresetId: 'async-workers',
    scenario: 'steady',
    tasks: [
      { title: 'Run scheduled jobs', detail: stdTasks.load },
      {
        title: 'Own each trigger',
        detail: 'Confirm one owner per trigger while workers drain steadily.',
      },
      { title: 'Confirm scheduler health', detail: 'Run the checks below.' },
    ],
    checks: [
      { id: 'p99', label: 'Trigger p99 under 50ms', scope: 'system', metric: 'p99', op: '<', value: 50 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'ratio', label: 'Goodput above 95% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.95 },
    ],
  },
  {
    id: 'lab-price-tracker',
    title: 'Poll millions of products',
    packId: 'price-tracker',
    conceptIds: ['workers-async', 'realtime-updates'],
    objective: 'Sweep product pages on schedule and alert only on real drops.',
    setupPresetId: 'async-workers',
    scenario: 'diurnal',
    tasks: [
      { title: 'Run the daily sweep', detail: stdTasks.load },
      {
        title: 'Spread the polls',
        detail: 'Confirm workers stay lazy on average and busy only at sweep peaks.',
      },
      { title: 'Confirm tracker health', detail: 'Run the checks near the sweep peak.' },
    ],
    checks: [
      { id: 'p99', label: 'Sweep p99 under 50ms', scope: 'system', metric: 'p99', op: '<', value: 50 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'ratio', label: 'Goodput above 90% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.9 },
    ],
  },
  {
    id: 'lab-chess-live',
    title: 'Hold the game session',
    packId: 'chess-live',
    conceptIds: ['realtime-updates', 'consistency-models'],
    objective: 'Relay moves with clocks intact and resume cleanly on reconnect.',
    setupPresetId: 'discord',
    scenario: 'steady',
    tasks: [
      { title: 'Run live games', detail: stdTasks.load },
      {
        title: 'Pin the session tier',
        detail: 'Confirm game state rides sticky sessions, not the database.',
      },
      { title: 'Confirm game health', detail: 'Run the checks below.' },
    ],
    checks: [
      { id: 'p99', label: 'Move p99 under 200ms', scope: 'system', metric: 'p99', op: '<', value: 200 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'ratio', label: 'Goodput above 90% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.9 },
    ],
  },
  {
    id: 'lab-ai-chat',
    title: 'Stream under burst load',
    packId: 'ai-chat',
    conceptIds: ['realtime-updates', 'message-queue'],
    objective: 'Stream tokens with session affinity while bursts queue instead of dropping.',
    setupPresetId: 'event-driven',
    scenario: 'spike',
    tasks: [
      { title: 'Burst the assistant', detail: stdTasks.load },
      {
        title: 'Queue, do not drop',
        detail: 'Confirm prompts wait their turn while streams stay ordered.',
      },
      { title: 'Confirm streaming health', detail: 'Run the checks at burst peak.' },
    ],
    checks: [
      { id: 'p99', label: 'Chat p99 under 160ms', scope: 'system', metric: 'p99', op: '<', value: 160 },
      { id: 'ratio', label: 'Goodput above 35% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.35 },
    ],
  },
  {
    id: 'lab-game-leaderboard',
    title: 'Rank the contest live',
    packId: 'game-leaderboard',
    conceptIds: ['scaling-reads', 'sketch-structures'],
    objective: 'Update live ranks from score submits without serializing every write.',
    setupPresetId: 'leetcode',
    scenario: 'spike',
    tasks: [
      { title: 'Fire contest submits', detail: stdTasks.load },
      {
        title: 'Rank from sets',
        detail: 'Confirm the board reads sorted sets while submits queue behind judges.',
      },
      { title: 'Confirm board health', detail: 'Run the checks at submit peak.' },
    ],
    checks: [
      { id: 'p99', label: 'Board p99 under 120ms', scope: 'system', metric: 'p99', op: '<', value: 120 },
      { id: 'ratio', label: 'Goodput above 50% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.5 },
      { id: 'hit', label: 'Board cache above 80% hits', scope: 'node', nodeKind: 'cache', metric: 'hitRate', op: '>', value: 0.8 },
    ],
  },
  {
    id: 'lab-donations',
    title: 'Absorb the viral campaign',
    packId: 'donations',
    conceptIds: ['multistep-sagas', 'contention-control'],
    objective: 'Take a viral donation spike without double-charging a single donor.',
    setupPresetId: 'stripe',
    scenario: 'spike',
    tasks: [
      { title: 'Go viral for good', detail: stdTasks.load },
      {
        title: 'Shed, never double-apply',
        detail: 'Confirm excess sheds at the door while the ledger applies each gift once.',
      },
      { title: 'Confirm donation health', detail: 'Run the checks at spike peak.' },
    ],
    checks: [
      { id: 'p99', label: 'Donation p99 under 1200ms', scope: 'system', metric: 'p99', op: '<', value: 1200 },
      { id: 'ratio', label: 'Goodput above 35% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.35 },
      { id: 'err', label: 'Error rate under 70%', scope: 'system', metric: 'errorRate', op: '<', value: 0.7 },
    ],
  },
  {
    id: 'lab-ci-runner',
    title: 'Drain the monorepo queue',
    packId: 'ci-runner',
    conceptIds: ['workers-async', 'long-running-tasks'],
    objective: 'Buffer push bursts in queue depth while the fleet drains steadily.',
    setupPresetId: 'async-workers',
    scenario: 'spike',
    tasks: [
      { title: 'Push the monorepo', detail: stdTasks.load },
      {
        title: 'Let depth absorb it',
        detail: 'Confirm the queue grows into the thousands while errors stay at zero.',
      },
      { title: 'Confirm fleet health', detail: 'Run the checks mid-burst.' },
    ],
    checks: [
      { id: 'p99', label: 'Accept p99 under 80ms', scope: 'system', metric: 'p99', op: '<', value: 80 },
      { id: 'err', label: 'Error rate under 2%', scope: 'system', metric: 'errorRate', op: '<', value: 0.02 },
      { id: 'ratio', label: 'Goodput above 90% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.9 },
    ],
  },
  {
    id: 'lab-food-review',
    title: 'Rank every dish nearby',
    packId: 'food-review',
    conceptIds: ['scaling-reads', 'proximity-search'],
    objective: 'Serve nearby dish boards in milliseconds while reviews pour in.',
    setupPresetId: 'specialised-stores',
    scenario: 'steady',
    tasks: [
      { title: 'Run dinner browsing', detail: stdTasks.load },
      {
        title: 'Precompute the boards',
        detail: 'Confirm per-cell leaderboards refresh on timers, not per request.',
      },
      { title: 'Confirm board health', detail: 'Run the checks below.' },
    ],
    checks: [
      { id: 'p99', label: 'Browse p99 under 300ms', scope: 'system', metric: 'p99', op: '<', value: 300 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'ratio', label: 'Goodput above 90% of offered', scope: 'system', metric: 'goodputRatio', op: '>', value: 0.9 },
    ],
  },
  {
    id: 'lab-music-stream',
    title: 'Separate audio from metadata',
    packId: 'music-stream',
    conceptIds: ['large-blobs', 'vector-search'],
    objective: 'Stream audio from the edge while recommendations read their own index.',
    setupPresetId: 'spotify',
    scenario: 'steady',
    tasks: [
      { title: 'Run listening traffic', detail: stdTasks.load },
      {
        title: 'Split the paths',
        detail: 'Confirm audio bytes and metadata queries saturate different tiers.',
      },
      { title: 'Confirm streaming health', detail: 'Run the checks below.' },
    ],
    checks: [
      { id: 'p99', label: 'Stream p99 under 250ms', scope: 'system', metric: 'p99', op: '<', value: 250 },
      { id: 'err', label: 'Error rate under 1%', scope: 'system', metric: 'errorRate', op: '<', value: 0.01 },
      { id: 'hit', label: 'Edge cache above 70% hits', scope: 'node', nodeKind: 'cdn', metric: 'hitRate', op: '>', value: 0.7 },
    ],
  },
];

export const LABS_BY_ID: ReadonlyMap<string, PracticeLab> = new Map(
  LABS.map((l) => [l.id, l]),
);
