/* Shares controller: short-link create / resolve. Create is auth-required
 * (see routes) and also upserts the payload into the owner's cloud library
 * so shared designs appear in "Your designs"; resolve stays a public read. */

import type { Context } from 'hono';
import type { AppEnv } from '../env';
import { parseCreateShare } from '../schemas/payloads.schema';
import { bumpShareViews, createShare, resolveShare } from '../services/shares.service';

type Ctx = Context<AppEnv>;

export async function create(c: Ctx) {
  const parsed = parseCreateShare(await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const result = await createShare(c.env, c.get('user')!.id, parsed.value.payload);
  if (!result.ok) return c.json({ error: result.error }, result.status as 413);
  return c.json({ id: result.id });
}

export async function resolve(c: Ctx) {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'Not found.' }, 404);
  const payload = await resolveShare(c.env, id);
  if (payload === null) return c.json({ error: 'Not found.' }, 404);
  // Fire-and-forget view counter; never block the read.
  c.executionCtx.waitUntil(bumpShareViews(c.env, id));
  return c.json({ payload });
}
