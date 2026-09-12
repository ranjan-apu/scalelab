import { useSyncExternalStore } from 'react';
import type { NodeKind } from '../sim/types';

/**
 * User preferences.
 *
 * A tiny external store rather than React context, for the same reason the
 * tooltip controller is one: a preference is read inside components that
 * re-render ten times a second while the simulation runs, and a context
 * provider would re-render every consumer on any change. `useSyncExternalStore`
 * lets a component subscribe to exactly the value it reads.
 *
 * Everything here is a per-person choice about how much interface to show. It
 * is deliberately small. A settings screen with twenty switches is how an app
 * stops having opinions, and this one should have opinions.
 */

export interface Preferences {
  /**
   * Show the dotted underlines and hover explanations on metric terms.
   *
   * OFF by default, deliberately. Forty dotted underlines on one screen make
   * the interface look busier than it is, and a student who wants the
   * explanations can turn them on. The glossary panel stays available either
   * way, so nothing becomes unreachable when this is off; it just stops
   * decorating every number.
   */
  tooltips: boolean;
  /** Draw the small trend line on each node. */
  sparklines: boolean;
  /** Snap node positions to the 8px grid while dragging. */
  snapToGrid: boolean;
  /**
   * Show the minimap over the canvas.
   *
   * OFF by default. A minimap earns its space on a twenty-node company
   * reconstruction and costs it on the three-node examples most people open
   * first, so it is offered rather than assumed.
   */
  minimap: boolean;
  /**
   * Colour theme.
   *
   * Three states rather than a boolean, because "follow the system" is a real
   * choice and not the absence of one: a student on a machine that switches
   * to dark at sunset should switch with it unless they have said otherwise.
   * A boolean would have to encode that as null, which is how a toggle ends
   * up with three meanings and no name for the third.
   */
  theme: ThemeChoice;
  /**
   * Clean Canvas mode: Hides live request telemetry, sparklines, and traffic load
   * counters, providing a clean architectural diagramming view like Excalidraw or draw.io.
   */
  cleanCanvas: boolean;
  /**
   * What the left rail offers: the system-design components, or the basic
   * shapes library.
   *
   * A two-value mode rather than a boolean, because "shapes" is not the
   * absence of components -- both are real, both are wanted, and a boolean
   * would have to encode the second one as a negation and then be read
   * backwards at every call site.
   *
   * Persisted with the other preferences: a mode a reader has to re-pick on
   * every reload is not a mode, it is a setting they keep losing. Switching it
   * also drives Clean Canvas (see setPaletteMode), because a whiteboard with
   * live telemetry drawn over it is two intentions fighting on one canvas.
   */
  paletteMode: PaletteMode;
  /** Group IDs of collapsed sections in the sidebar palette. */
  collapsedGroups: string[];
  /** Pinned node kinds appearing in the top Pinned section of the palette. */
  pinnedKinds: NodeKind[];
  /**
   * Multi-Cloud Infrastructure Cost Estimator.
   *
   * Calculates and displays estimated monthly infrastructure spend across
   * AWS, GCP, and Azure for the canvas architecture. ON by default.
   */
  costEstimator: boolean;
  /**
   * Architectural Advisor (Resilience linter).
   *
   * Inspects topology for single points of failure (SPOFs), bottlenecks,
   * and distributed resilience risks. ON by default.
   */
  advisor: boolean;
  /**
   * High-Level Design (HLD) RFC Export feature.
   *
   * Displays the HLD RFC header button to generate markdown RFC specs.
   * ON by default.
   */
  hldRfc: boolean;
}

/** What the reader picked. `system` defers to the OS. */
export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system'];

/**
 * Which library the rail shows.
 *
 * `components` is the system-design palette kLab has always had; `shapes` is
 * the whiteboard library. Named for what each one offers rather than for a
 * mode, because both are the same kind of thing: a shelf of things to drag
 * onto the canvas.
 */
export type PaletteMode = 'components' | 'shapes';

export const PALETTE_MODES: readonly PaletteMode[] = ['components', 'shapes'];

export const DEFAULT_PREFERENCES: Preferences = {
  costEstimator: true,
  advisor: true,
  hldRfc: true,
  cleanCanvas: false,
  tooltips: false,
  sparklines: true,
  snapToGrid: true,
  minimap: false,
  // ScaleLab Studio opens on its light paper workspace: the product's
  // identity is a design studio, not a dark ops console. Users who want
  // dark can still pick it (or follow the OS with `system`).
  theme: 'light',
  paletteMode: 'components',
  collapsedGroups: [],
  pinnedKinds: [],
};

const STORAGE_KEY = 'scalelab.preferences.v1';

export const ALL_NODE_KINDS: readonly NodeKind[] = [
  'client',
  'producer',
  'lb',
  'service',
  'cache',
  'db',
  'queue',
  'worker',
  'autoscaler',
  'region',
  'cdn',
  'ratelimiter',
  'breaker',
  'replica',
  'shard',
  'objectstore',
  'searchindex',
  'timeseriesdb',
  'graphdb',
  'coldstorage',
  'vectordb',
  'streambroker',
  'pubsub',
  'websocket',
  'apigateway',
  'sidecar',
  'lambda',
  'cron',
  'bulkhead',
  'retryqueue',
  'transcoder',
  'edgecompute',
  'writebehind',
  'loadshedder',
];

const VALID_NODE_KINDS = new Set<string>(ALL_NODE_KINDS);

const listeners = new Set<() => void>();
let current: Preferences = load();

/**
 * Read once at startup. Anything malformed falls back to the defaults rather
 * than throwing: a corrupt value in storage must never stop the app booting,
 * and a preference is not worth a blank screen.
 */
function load(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PREFERENCES;
    const p = parsed as Record<string, unknown>;
    // Each key is validated on its own, so an unknown or corrupt field costs
    // only that one preference rather than the whole set.
    return {
      costEstimator: bool(p.costEstimator, DEFAULT_PREFERENCES.costEstimator),
      advisor: bool(p.advisor, DEFAULT_PREFERENCES.advisor),
      hldRfc: bool(p.hldRfc, DEFAULT_PREFERENCES.hldRfc),
      cleanCanvas: bool(p.cleanCanvas, DEFAULT_PREFERENCES.cleanCanvas),
      tooltips: bool(p.tooltips, DEFAULT_PREFERENCES.tooltips),
      sparklines: bool(p.sparklines, DEFAULT_PREFERENCES.sparklines),
      snapToGrid: bool(p.snapToGrid, DEFAULT_PREFERENCES.snapToGrid),
      minimap: bool(p.minimap, DEFAULT_PREFERENCES.minimap),
      theme: theme(p.theme),
      paletteMode: paletteMode(p.paletteMode),
      collapsedGroups: stringArray(p.collapsedGroups, DEFAULT_PREFERENCES.collapsedGroups),
      pinnedKinds: nodeKindArray(p.pinnedKinds, DEFAULT_PREFERENCES.pinnedKinds),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function stringArray(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  return v.filter((item): item is string => typeof item === 'string');
}

function nodeKindArray(v: unknown, fallback: NodeKind[]): NodeKind[] {
  if (!Array.isArray(v)) return fallback;
  const result: NodeKind[] = [];
  for (const item of v) {
    if (typeof item === 'string' && VALID_NODE_KINDS.has(item) && !result.includes(item as NodeKind)) {
      result.push(item as NodeKind);
    }
  }
  return result;
}

function theme(v: unknown): ThemeChoice {
  return v === 'light' || v === 'dark' || v === 'system'
    ? v
    : DEFAULT_PREFERENCES.theme;
}

/** An unknown mode from a corrupt or older payload falls back rather than
 *  leaving the rail with no library to render. */
function paletteMode(v: unknown): PaletteMode {
  return v === 'shapes' || v === 'components' ? v : DEFAULT_PREFERENCES.paletteMode;
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Private browsing, a full quota, or storage disabled by policy. The
    // preference still applies for this session; it simply will not be
    // remembered, which is a far better outcome than throwing.
  }
}

export function getPreferences(): Preferences {
  return current;
}

export function setPreference<K extends keyof Preferences>(
  key: K,
  value: Preferences[K],
): void {
  if (current[key] === value) return;
  current = { ...current, [key]: value };
  persist();
  for (const l of listeners) l();
}

export type BooleanPreference = {
  [K in keyof Preferences]: Preferences[K] extends boolean ? K : never;
}[keyof Preferences];

export function togglePreference(key: BooleanPreference): void {
  setPreference(key, !current[key]);
}

export function toggleGroupCollapsed(groupId: string): void {
  const currentCollapsed = current.collapsedGroups;
  const next = currentCollapsed.includes(groupId)
    ? currentCollapsed.filter((id) => id !== groupId)
    : [...currentCollapsed, groupId];
  setPreference('collapsedGroups', next);
}

export function togglePinnedKind(kind: NodeKind): void {
  const currentPinned = current.pinnedKinds;
  const next = currentPinned.includes(kind)
    ? currentPinned.filter((k) => k !== kind)
    : [...currentPinned, kind];
  setPreference('pinnedKinds', next);
}

export function toggleCleanCanvas(): void {
  setPreference('cleanCanvas', !current.cleanCanvas);
}

export function setCleanCanvas(enabled: boolean): void {
  setPreference('cleanCanvas', enabled);
}

/**
 * Switch the rail between the components and the shapes library.
 *
 * This is the one writer of `paletteMode`, and it deliberately drives
 * `cleanCanvas` with it: someone who picks up the shapes library is
 * whiteboarding, and live request counters, sparklines and load sliders drawn
 * over a sketch are two intentions fighting for one canvas. Going back to the
 * components restores the telemetry, because wanting components is wanting the
 * system.
 *
 * The header's own Clean Canvas / Simulation switch stays live afterwards and
 * is not read back here: this is a stated coupling at the moment of choosing a
 * mode, not a permanent link. Someone who sketches and then wants the numbers
 * back can turn them on without being thrown out of the shapes library.
 */
export function setPaletteMode(mode: PaletteMode): void {
  if (current.paletteMode !== mode) setPreference('paletteMode', mode);
  const wantClean = mode === 'shapes';
  if (current.cleanCanvas !== wantClean) setPreference('cleanCanvas', wantClean);
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Subscribe to the whole set. Re-renders only when something actually changes. */
export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getPreferences, getPreferences);
}

/**
 * Subscribe to ONE preference.
 *
 * Components that read a single flag should use this: the snapshot is a
 * primitive, so `useSyncExternalStore` bails out of the re-render when an
 * unrelated preference changes.
 */
export function usePreference<K extends keyof Preferences>(key: K): Preferences[K] {
  return useSyncExternalStore(
    subscribe,
    () => current[key],
    () => DEFAULT_PREFERENCES[key],
  );
}

/** Test seam. Resets to defaults and clears storage. */
export function __resetPreferences(): void {
  current = DEFAULT_PREFERENCES;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
  for (const l of listeners) l();
}

/** Test seam. Reloads state from localStorage. */
export function __reloadPreferencesForTesting(): void {
  current = load();
  for (const l of listeners) l();
}
