import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { attachUser, requireAuth } from '../middleware/auth';
import * as Designs from '../controllers/designs.controller';

const r = new Hono<AppEnv>();

r.use('*', attachUser, requireAuth);
r.get('/', Designs.list);
r.post('/', Designs.create);
r.get('/:id', Designs.getOne);

export const designsRoutes = r;
