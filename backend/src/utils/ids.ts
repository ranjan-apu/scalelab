import { SHARE_ALPHABET } from '../config/constants';

/**
 * Prefixed unique id, e.g. `sess_m5x1k2ab-Ab3xK9pQ...`.
 *
 * Shape: `<prefix>_<base36 unix ts><128-bit CSPRNG, base64url>`.
 *
 * The random half is 16 bytes from crypto.getRandomValues (128 bits),
 * which is the standard for session tokens — the previous build took only
 * the first 48 bits of a UUID, and its fallback was Math.random(), a
 * predictable-id path that must never exist for anything that gates access.
 * There is no fallback at all: if the CSPRNG is missing the call throws
 * and the request 500s. Failing closed is correct; issuing a guessable
 * session id is not.
 *
 * The base36 timestamp is operational, not security — it makes a session's
 * age legible in logs and D1. Uniqueness comes entirely from the 128 bits
 * (birthday collision ~2^64 ids, unreachable).
 */
export function newId(prefix: string): string {
  const rand = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/** Short public id for share links, e.g. `aB3xK9pQ`. */
export function shortId(n = 8): string {
  const buf = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(buf, (b) => SHARE_ALPHABET[b % SHARE_ALPHABET.length]).join('');
}

/* ------------------------------------------------------------------ *
 * base64url (RFC 4648 §5), no padding.
 *
 * Rolled by hand rather than btoa/Buffer because the alphabet is the
 * URL-safe one and the input is always a fixed 16 bytes; 22 output chars,
 * every one of them legal in a cookie value and a D1 TEXT primary key.
 * ------------------------------------------------------------------ */
const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const has1 = i + 1 < bytes.length;
    const has2 = i + 2 < bytes.length;
    const b1 = has1 ? bytes[i + 1]! : 0;
    const b2 = has2 ? bytes[i + 2]! : 0;
    out += B64URL[b0 >> 2];
    out += B64URL[((b0 & 3) << 4) | (b1 >> 4)];
    if (has1) out += B64URL[((b1 & 15) << 2) | (b2 >> 6)];
    if (has2) out += B64URL[b2 & 63];
  }
  return out;
}
