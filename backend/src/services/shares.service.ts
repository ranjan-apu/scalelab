/* Shares service: short /d/<id> links backed by D1. */

import type { Bindings } from '../env';
import { MAX_DESIGN_NAME, MAX_PAYLOAD_BYTES } from '../config/constants';
import { shortId } from '../utils/ids';
import { nowSec } from '../utils/time';
import { createDesign } from './designs.service';

/** Design name carried inside a share payload, if it has a valid one. */
function shareDesignName(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const name = (payload as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim()) {
      return name.trim().slice(0, MAX_DESIGN_NAME);
    }
  }
  return 'Shared design';
}

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
  // A logged-in share also lands in the owner's cloud library, so it shows
  // up in "Your designs" alongside saves. Same-name shares update the
  // existing row (see createDesign's upsert); best-effort so a library
  // hiccup never fails the share itself.
  if (ownerUserId) {
    try {
      let data: unknown = payload;
      if (typeof payload === 'object' && payload !== null) {
        const { name: _name, ...rest } = payload as Record<string, unknown>;
        data = rest;
      }
      await createDesign(env, ownerUserId, shareDesignName(payload), data);
    } catch {
      // Ignore: the short link is already stored above.
    }
  }
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
