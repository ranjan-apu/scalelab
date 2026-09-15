/* Request-body validation (schemas). Controllers call these before services. */

import { MAX_DESIGN_NAME } from '../config/constants';

export interface CreateDesignInput {
  name: string;
  data: unknown;
}

export function parseCreateDesign(body: unknown):
  | { ok: true; value: CreateDesignInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'name and data are required.' };
  const { name, data } = body as { name?: unknown; data?: unknown };
  if (typeof name !== 'string' || !name.trim() || data === undefined || data === null) {
    return { ok: false, error: 'name and data are required.' };
  }
  return { ok: true, value: { name: name.trim().slice(0, MAX_DESIGN_NAME), data } };
}

export interface CreateShareInput {
  payload: unknown;
}

export function parseCreateShare(body: unknown):
  | { ok: true; value: CreateShareInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'payload is required.' };
  const { payload } = body as { payload?: unknown };
  if (payload === undefined || payload === null) {
    return { ok: false, error: 'payload is required.' };
  }
  return { ok: true, value: { payload } };
}
