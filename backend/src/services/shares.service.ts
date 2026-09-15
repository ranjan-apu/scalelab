/* Shares service: short /d/<id> links backed by D1. */

import type { Bindings } from '../env';
import { MAX_PAYLOAD_BYTES } from '../config/constants';
import { shortId } from '../utils/ids';
import { nowSec } from '../utils/time';

export async function createShare(
  env: Bindings,
  ownerUserId: string | null,
  payload: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  const raw = JSON.stringify(payload);
  if (raw.length > MAX_PAYLOAD_BYTES) {
    return { ok: false, error: 'Design too large.', status: 413 };
  }
  const id = shortId();
  await env.DB.prepare(
    `INSERT INTO shares (id, owner_user_id, payload, created_at) VALUES (?, ?, ?, ?)`,
  )
    .bind(id, ownerUserId, raw, nowSec())
    .run();
  return { ok: true, id };
}

export async function resolveShare(
  env: Bindings,
  id: string,
): Promise<unknown | null> {
  const row = await env.DB.prepare(`SELECT payload FROM shares WHERE id = ?`)
    .bind(id)
    .first<{ payload: string }>();
  if (!row) return null;
  return JSON.parse(row.payload);
}

/** Fire-and-forget view counter. Never throws — callers must not await it critically. */
export async function bumpShareViews(env: Bindings, id: string): Promise<void> {
  try {
    await env.DB.prepare(`UPDATE shares SET views = views + 1 WHERE id = ?`)
      .bind(id)
      .run();
  } catch {
    // Views are best-effort; ignore failures.
  }
}
