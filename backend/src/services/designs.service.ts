/* Designs service: D1 CRUD for cloud-saved topologies. */

import type { Bindings } from '../env';
import { MAX_PAYLOAD_BYTES } from '../config/constants';
import type { DesignDetail, DesignSummaryRow } from '../entities/design';
import { newId } from '../utils/ids';
import { nowSec } from '../utils/time';

export async function listDesigns(
  env: Bindings,
  userId: string,
): Promise<DesignSummaryRow[]> {
  const rows = await env.DB.prepare(
    `SELECT id, name, created_at, updated_at, LENGTH(data) AS size
     FROM designs WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100`,
  )
    .bind(userId)
    .all<DesignSummaryRow>();
  return rows.results;
}

export async function createDesign(
  env: Bindings,
  userId: string,
  name: string,
  data: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  const raw = JSON.stringify(data);
  if (raw.length > MAX_PAYLOAD_BYTES) {
    return { ok: false, error: 'Design too large.', status: 413 };
  }
  const id = newId('d');
  const now = nowSec();
  await env.DB.prepare(
    `INSERT INTO designs (id, user_id, name, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, userId, name, raw, now, now)
    .run();
  return { ok: true, id };
}

export async function getDesign(
  env: Bindings,
  userId: string,
  id: string,
): Promise<DesignDetail | null> {
  const row = await env.DB.prepare(
    `SELECT id, name, data, created_at, updated_at FROM designs
     WHERE id = ? AND user_id = ?`,
  )
    .bind(id, userId)
    .first<{ id: string; name: string; data: string; created_at: number; updated_at: number }>();
  if (!row) return null;
  return { ...row, data: JSON.parse(row.data) };
}
