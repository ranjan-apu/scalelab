import { describe, expect, it } from 'vitest';
import {
  DAILY_ROTATION,
  dailyPreset,
  dailyPresetId,
  readDaily,
  recordDailyPlay,
  type DailyStore,
} from './daily';
import { PRESETS } from '../sim/presets';

function fakeStore(seed: Record<string, string> = {}): DailyStore & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe('daily challenge', () => {
  it('is deterministic per date', () => {
    expect(dailyPresetId('2026-09-14')).toBe(dailyPresetId('2026-09-14'));
  });

  it('rotates through distinct presets on consecutive days', () => {
    const seen = new Set<string>();
    for (let d = 0; d < DAILY_ROTATION.length; d += 1) {
      const key = `2026-01-${String(d + 1).padStart(2, '0')}`;
      seen.add(dailyPresetId(key));
    }
    expect(seen.size).toBe(DAILY_ROTATION.length);
  });

  it('points the rotation only at real presets', () => {
    const ids = new Set(PRESETS.map((p) => p.id));
    for (const id of DAILY_ROTATION) expect(ids.has(id), id).toBe(true);
    expect(new Set(DAILY_ROTATION).size).toBe(DAILY_ROTATION.length);
  });

  it('resolves the preset object with a safe fallback', () => {
    expect(dailyPreset('discord').id).toBe('discord');
    expect(dailyPreset('no-such-id').id).toBe(PRESETS[0]!.id);
  });

  it('starts the streak at one on first play', () => {
    const store = fakeStore();
    expect(recordDailyPlay(store, '2026-09-14')).toEqual({ lastPlayed: '2026-09-14', streak: 1 });
  });

  it('never double-counts the same day', () => {
    const store = fakeStore();
    recordDailyPlay(store, '2026-09-14');
    expect(recordDailyPlay(store, '2026-09-14')).toEqual({ lastPlayed: '2026-09-14', streak: 1 });
  });

  it('extends the streak on consecutive days', () => {
    const store = fakeStore();
    recordDailyPlay(store, '2026-09-12');
    expect(recordDailyPlay(store, '2026-09-13').streak).toBe(2);
    expect(recordDailyPlay(store, '2026-09-14').streak).toBe(3);
  });

  it('restarts at one after a skipped day', () => {
    const store = fakeStore();
    recordDailyPlay(store, '2026-09-10');
    expect(recordDailyPlay(store, '2026-09-14')).toEqual({ lastPlayed: '2026-09-14', streak: 1 });
  });

  it('survives corrupt storage', () => {
    const store = fakeStore({ 'scalelab.daily.v1': 'not json{{' });
    expect(readDaily(store)).toEqual({ lastPlayed: null, streak: 0 });
    expect(recordDailyPlay(store, '2026-09-14').streak).toBe(1);
  });

  it('survives a null store', () => {
    expect(readDaily(null)).toEqual({ lastPlayed: null, streak: 0 });
    expect(recordDailyPlay(null, '2026-09-14')).toEqual({ lastPlayed: '2026-09-14', streak: 1 });
  });
});
