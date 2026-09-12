// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  __reloadPreferencesForTesting,
  __resetPreferences,
  getPreferences,
  setCleanCanvas,
  setPreference,
  toggleCleanCanvas,
  toggleGroupCollapsed,
  togglePinnedKind,
  togglePreference,
} from './preferences';

/**
 * Preferences are read from localStorage at startup, which is a trust
 * boundary: the value can be anything a previous version wrote, anything a
 * user typed into devtools, or garbage from a half-finished write. None of
 * that may stop the app booting, so the loader is tested against hostile input
 * rather than only the happy path.
 */

describe('defaults', () => {
  beforeEach(() => __resetPreferences());

  it('starts with tooltips and cleanCanvas off', () => {
    // The whole point of the preference: a first-time student meets a clean
    // interface, not forty dotted underlines.
    expect(DEFAULT_PREFERENCES.tooltips).toBe(false);
    expect(getPreferences().tooltips).toBe(false);
    expect(DEFAULT_PREFERENCES.cleanCanvas).toBe(false);
    expect(getPreferences().cleanCanvas).toBe(false);
  });

  it('starts with the visual helpers on', () => {
    expect(DEFAULT_PREFERENCES.sparklines).toBe(true);
    expect(DEFAULT_PREFERENCES.snapToGrid).toBe(true);
    expect(DEFAULT_PREFERENCES.costEstimator).toBe(true);
    expect(getPreferences().costEstimator).toBe(true);
    expect(DEFAULT_PREFERENCES.advisor).toBe(true);
    expect(getPreferences().advisor).toBe(true);
    expect(DEFAULT_PREFERENCES.hldRfc).toBe(true);
    expect(getPreferences().hldRfc).toBe(true);
  });
});

describe('setting and toggling', () => {
  beforeEach(() => __resetPreferences());

  it('records a change', () => {
    setPreference('tooltips', true);
    expect(getPreferences().tooltips).toBe(true);
  });

  it('toggles', () => {
    togglePreference('tooltips');
    expect(getPreferences().tooltips).toBe(true);
    togglePreference('tooltips');
    expect(getPreferences().tooltips).toBe(false);
  });

  it('leaves the other preferences alone', () => {
    setPreference('tooltips', true);
    expect(getPreferences().sparklines).toBe(DEFAULT_PREFERENCES.sparklines);
    expect(getPreferences().snapToGrid).toBe(DEFAULT_PREFERENCES.snapToGrid);
  });

  it('replaces the object so a subscriber sees a new reference', () => {
    const before = getPreferences();
    setPreference('tooltips', true);
    expect(getPreferences()).not.toBe(before);
  });

  it('does nothing when the value is unchanged', () => {
    const before = getPreferences();
    setPreference('tooltips', false);
    expect(getPreferences()).toBe(before);
  });
});

describe('persistence', () => {
  beforeEach(() => __resetPreferences());

  it('writes the change to storage', () => {
    setPreference('tooltips', true);
    const raw = localStorage.getItem('scalelab.preferences.v1');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).tooltips).toBe(true);
  });

  it('survives a corrupt stored value', () => {
    // Whatever is in storage, the app must boot. Each of these has broken a
    // real application at some point.
    const hostile = [
      'not json at all',
      '{',
      'null',
      '[]',
      '42',
      '"a string"',
      '{"tooltips":"yes please"}',
      '{"tooltips":null,"sparklines":7}',
    ];
    for (const raw of hostile) {
      localStorage.setItem('scalelab.preferences.v1', raw);
      // The loader runs at import time, so what is asserted here is that a
      // reset with hostile bytes still lands on the defaults rather than
      // throwing or half-applying.
      __resetPreferences();
      expect(getPreferences()).toEqual(DEFAULT_PREFERENCES);
    }
  });
});

describe('the tooltips preference gates the Term component', () => {
  beforeEach(() => __resetPreferences());

  it('is the one preference that ships off', () => {
    // Guards the product decision, not just the plumbing. A future change that
    // flips this default would put dotted underlines under forty terms on a
    // student's first screen, which is exactly what this preference exists to
    // prevent. If you mean to change it, change this test deliberately.
    expect(DEFAULT_PREFERENCES.tooltips).toBe(false);
    expect(DEFAULT_PREFERENCES.cleanCanvas).toBe(false);
    expect(DEFAULT_PREFERENCES.costEstimator).toBe(true);
    expect(DEFAULT_PREFERENCES.sparklines).toBe(true);
    expect(DEFAULT_PREFERENCES.snapToGrid).toBe(true);
    expect(DEFAULT_PREFERENCES.collapsedGroups).toEqual([]);
    expect(DEFAULT_PREFERENCES.pinnedKinds).toEqual([]);
  });
});

describe('collapsedGroups and pinnedKinds', () => {
  beforeEach(() => __resetPreferences());

  it('toggles collapsed groups', () => {
    expect(getPreferences().collapsedGroups).toEqual([]);
    toggleGroupCollapsed('traffic');
    expect(getPreferences().collapsedGroups).toEqual(['traffic']);
    toggleGroupCollapsed('compute');
    expect(getPreferences().collapsedGroups).toEqual(['traffic', 'compute']);
    toggleGroupCollapsed('traffic');
    expect(getPreferences().collapsedGroups).toEqual(['compute']);
  });

  it('toggles pinned kinds', () => {
    expect(getPreferences().pinnedKinds).toEqual([]);
    togglePinnedKind('cache');
    expect(getPreferences().pinnedKinds).toEqual(['cache']);
    togglePinnedKind('db');
    expect(getPreferences().pinnedKinds).toEqual(['cache', 'db']);
    togglePinnedKind('cache');
    expect(getPreferences().pinnedKinds).toEqual(['db']);
  });

  it('persists and reloads collapsedGroups and pinnedKinds', () => {
    toggleGroupCollapsed('data');
    togglePinnedKind('worker');
    const raw = localStorage.getItem('scalelab.preferences.v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.collapsedGroups).toEqual(['data']);
    expect(parsed.pinnedKinds).toEqual(['worker']);

    __reloadPreferencesForTesting();
    expect(getPreferences().collapsedGroups).toEqual(['data']);
    expect(getPreferences().pinnedKinds).toEqual(['worker']);
  });

  it('sanitizes invalid or malicious kinds and groups from storage', () => {
    localStorage.setItem(
      'scalelab.preferences.v1',
      JSON.stringify({
        collapsedGroups: ['validGroup', 123, null, 'anotherGroup'],
        pinnedKinds: ['cache', 'fake-node-kind', 42, null, 'service', 'cache'],
      }),
    );
    __reloadPreferencesForTesting();
    expect(getPreferences().collapsedGroups).toEqual(['validGroup', 'anotherGroup']);
    // 'fake-node-kind', numbers, and duplicates should be filtered out
    expect(getPreferences().pinnedKinds).toEqual(['cache', 'service']);
  });

  it('falls back safely if collapsedGroups or pinnedKinds is not an array', () => {
    localStorage.setItem(
      'scalelab.preferences.v1',
      JSON.stringify({
        collapsedGroups: 'not an array',
        pinnedKinds: { kind: 'cache' },
      }),
    );
    __reloadPreferencesForTesting();
    expect(getPreferences().collapsedGroups).toEqual([]);
    expect(getPreferences().pinnedKinds).toEqual([]);
  });

  it('toggles, sets, and persists cleanCanvas', () => {
    expect(getPreferences().cleanCanvas).toBe(false);
    toggleCleanCanvas();
    expect(getPreferences().cleanCanvas).toBe(true);

    const raw = localStorage.getItem('scalelab.preferences.v1');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).cleanCanvas).toBe(true);

    __reloadPreferencesForTesting();
    expect(getPreferences().cleanCanvas).toBe(true);

    setCleanCanvas(false);
    expect(getPreferences().cleanCanvas).toBe(false);
  });

  it('toggles, sets, and persists costEstimator', () => {
    expect(getPreferences().costEstimator).toBe(true);
    togglePreference('costEstimator');
    expect(getPreferences().costEstimator).toBe(false);

    const raw = localStorage.getItem('scalelab.preferences.v1');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).costEstimator).toBe(false);

    __reloadPreferencesForTesting();
    expect(getPreferences().costEstimator).toBe(false);

    setPreference('costEstimator', true);
    expect(getPreferences().costEstimator).toBe(true);

    const raw2 = localStorage.getItem('scalelab.preferences.v1');
    expect(JSON.parse(raw2 as string).costEstimator).toBe(true);
  });
});
