/* Designs controller: HTTP mapping. DB work lives in designs.service. */

import type { Context } from 'hono';
import type { AppEnv } from '../env';
import { parseCreateDesign } from '../schemas/payloads.schema';
import { createDesign, getDesign, listDesigns } from '../services/designs.service';

type Ctx = Context<AppEnv>;

export async function list(c: Ctx) {
  const user = c.get('user')!;
  return c.json({ designs: await listDesigns(c.env, user.id) });
}

export async function create(c: Ctx) {
  const user = c.get('user')!;
  const parsed = parseCreateDesign(await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const result = await createDesign(c.env, user.id, parsed.value.name, parsed.value.data);
  if (!result.ok) return c.json({ error: result.error }, result.status as 413);
  return c.json({ id: result.id });
}

export async function getOne(c: Ctx) {
  const user = c.get('user')!;
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'Not found.' }, 404);
  const design = await getDesign(c.env, user.id, id);
  if (!design) return c.json({ error: 'Not found.' }, 404);
  return c.json(design);
}
