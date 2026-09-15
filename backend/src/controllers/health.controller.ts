/* Health controller: liveness probe. */

import type { Context } from 'hono';
import type { AppEnv } from '../env';

export function health(c: Context<AppEnv>) {
  return c.json({ ok: true, time: Date.now() });
}
