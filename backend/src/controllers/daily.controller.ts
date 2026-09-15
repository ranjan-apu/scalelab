/* Daily controller: thin HTTP wrapper. DB work lives in daily.service. */

import type { Context } from 'hono';
import type { AppEnv } from '../env';
import { recordDailyPlay } from '../services/daily.service';

type Ctx = Context<AppEnv>;

export async function play(c: Ctx) {
  const user = c.get('user')!;
  return c.json(await recordDailyPlay(c.env, user.id));
}
