import { expect, test } from 'vitest';
import {
  hasAuthMarker,
  isLocalHost,
  shouldSkipAuthCall,
} from './sessionFlag';

test('isLocalHost covers loopback names only', () => {
  expect(isLocalHost('localhost')).toBe(true);
  expect(isLocalHost('127.0.0.1')).toBe(true);
  expect(isLocalHost('0.0.0.0')).toBe(true);
  expect(isLocalHost('scalelab.apurba.top')).toBe(false);
  expect(isLocalHost('example.com')).toBe(false);
});

test('hasAuthMarker reads the presence cookie', () => {
  expect(hasAuthMarker('scalelab-auth=1')).toBe(true);
  expect(hasAuthMarker('other=1; scalelab-auth=1')).toBe(true);
  expect(hasAuthMarker('')).toBe(false);
  expect(hasAuthMarker('other=1')).toBe(false);
  // A longer name that merely shares the prefix is not the marker.
  expect(hasAuthMarker('scalelab-authx=1')).toBe(false);
});

const PROD = 'scalelab.apurba.top';
const MARKER = 'scalelab-auth=1';

test('localhost always checks, even with no marker or flag', () => {
  expect(
    shouldSkipAuthCall({ hostname: 'localhost', cookie: '', noSession: true }),
  ).toBe(false);
  expect(
    shouldSkipAuthCall({ hostname: '127.0.0.1', cookie: '', noSession: true }),
  ).toBe(false);
});

test('prod without the marker skips', () => {
  expect(
    shouldSkipAuthCall({ hostname: PROD, cookie: '', noSession: false }),
  ).toBe(true);
});

test('prod with the marker and no flag fires', () => {
  expect(
    shouldSkipAuthCall({ hostname: PROD, cookie: MARKER, noSession: false }),
  ).toBe(false);
});

test('prod with a known-dead session skips even when the marker lingers', () => {
  expect(
    shouldSkipAuthCall({ hostname: PROD, cookie: MARKER, noSession: true }),
  ).toBe(true);
});
