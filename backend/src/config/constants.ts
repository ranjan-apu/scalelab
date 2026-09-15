/* Shared constants. Tunables live here, not scattered across services. */

export const SESSION_COOKIE = '__Host-scalelab-session';
/** Legacy cookie name accepted on read (before __Host- prefix). */
export const SESSION_COOKIE_LEGACY = 'scalelab-session';
/** 30 days, in seconds. */
export const SESSION_TTL_S = 60 * 60 * 24 * 30;

export const SHARE_ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Max JSON payload for a design / share (matches frontend 512KB cap). */
export const MAX_PAYLOAD_BYTES = 512_000;

/** Max design name length. */
export const MAX_DESIGN_NAME = 60;
