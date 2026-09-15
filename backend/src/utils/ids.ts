import { SHARE_ALPHABET } from '../config/constants';

/** Prefixed unique id, e.g. `d_lzy...a1b2`. */
export function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/** Short public id for share links, e.g. `aB3xK9pQ`. */
export function shortId(n = 8): string {
  const buf = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(buf, (b) => SHARE_ALPHABET[b % SHARE_ALPHABET.length]).join('');
}
