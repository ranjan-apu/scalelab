import { useSyncExternalStore } from 'react';
import type { VendorId } from './vendors/types';
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
   * Name components after a cloud vendor's products.
   *
   * `generic` by default and deliberately so: a student meets "load
   * balancer" first and "ALB" second, and the concept outlives the product
   * name. A vendor is something to switch on once the idea has landed.
   */
  vendor: VendorId;
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
  /** Group IDs of collapsed sections in the sidebar palette. */
  collapsedGroups: string[];
  /** Pinned node kinds appearing in the top Pinned section of the palette. */
  pinnedKinds: NodeKind[];
}

/** What the reader picked. `system` defers to the OS. */
export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system'];

export const DEFAULT_PREFERENCES: Preferences = {
  tooltips: false,
  sparklines: true,
  snapToGrid: true,
  minimap: false,
  vendor: 'generic',
  // Follow the OS until told otherwise. Picking light as the default would
  // flash a bright page at someone whose machine is set to dark.
  theme: 'system',
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
      tooltips: bool(p.tooltips, DEFAULT_PREFERENCES.tooltips),
      sparklines: bool(p.sparklines, DEFAULT_PREFERENCES.sparklines),
      snapToGrid: bool(p.snapToGrid, DEFAULT_PREFERENCES.snapToGrid),
      minimap: bool(p.minimap, DEFAULT_PREFERENCES.minimap),
      vendor: vendor(p.vendor),
      theme: theme(p.theme),
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

function vendor(v: unknown): VendorId {
  return v === 'aws' || v === 'gcp' || v === 'azure' || v === 'generic'
    ? v
    : DEFAULT_PREFERENCES.vendor;
}

function theme(v: unknown): ThemeChoice {
  return v === 'light' || v === 'dark' || v === 'system'
    ? v
    : DEFAULT_PREFERENCES.theme;
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
