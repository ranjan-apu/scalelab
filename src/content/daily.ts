import { PRESETS } from '../sim/presets';

/**
 * The daily design challenge.
 *
 * One preset a day, on a deterministic UTC rotation, so every student gets
 * the same system on the same day and a classroom can argue about one
 * diagram. Playing (loading today's preset) records the day; consecutive
 * days build the streak. Storage is a tiny JSON blob behind a minimal
 * interface so tests pass fakes and the gallery passes localStorage.
 */

const STORAGE_KEY = 'scalelab.daily.v1';

/** Rotation order: lessons first, new arrivals mixed in, no two same-family days adjacent. */
export const DAILY_ROTATION: readonly string[] = [
  'retry-storm',
  'ticketmaster',
  'discord',
  'cache-aside',
  'stream-processing',
  'uber',
  'circuit-breaker',
  'saas-tenants',
  'twitter',
  'sharded-database',
  'photofeed',
  'load-balanced',
  'event-driven',
  'stripe',
];

export interface DailyStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface DailyState {
  lastPlayed: string | null;
  streak: number;
}

/** UTC calendar day, so the challenge flips at the same moment worldwide. */
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, m! - 1, d) / 86_400_000);
}

/** Which preset id is today's challenge. Pure function of the date. */
export function dailyPresetId(key: string = todayKey()): string {
  return DAILY_ROTATION[dayNumber(key) % DAILY_ROTATION.length]!;
}

export function readDaily(store: DailyStore | null): DailyState {
  if (!store) return { lastPlayed: null, streak: 0 };
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return { lastPlayed: null, streak: 0 };
    const parsed = JSON.parse(raw) as Partial<DailyState>;
    if (typeof parsed.lastPlayed !== 'string' && parsed.lastPlayed !== null) {
      return { lastPlayed: null, streak: 0 };
    }
    return {
      lastPlayed: parsed.lastPlayed ?? null,
      streak: Number.isFinite(parsed.streak) && (parsed.streak ?? 0) > 0 ? Math.floor(parsed.streak!) : 0,
    };
  } catch {
    return { lastPlayed: null, streak: 0 };
  }
}

/**
 * Record playing today. Same day replays never double-count; yesterday
 * extends the streak; anything older restarts it at one.
 */
export function recordDailyPlay(store: DailyStore | null, key: string = todayKey()): DailyState {
  const state = readDaily(store);
  if (state.lastPlayed === key) return state;
  const next: DailyState = {
    lastPlayed: key,
    streak: state.lastPlayed !== null && dayNumber(key) - dayNumber(state.lastPlayed) === 1 ? state.streak + 1 : 1,
  };
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Private browsing: the streak simply does not persist. */
  }
  return next;
}

/** The preset object for a challenge id, for galleries that render cards. */
export function dailyPreset(presetId: string = dailyPresetId()) {
  return PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]!;
}
