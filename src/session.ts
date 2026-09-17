import { isTopology, sanitizeTopology } from './clipboard';
import { sanitizeAnnotations } from './sim/annotations';
import { sanitizePlayground } from './sim/playground';
import type { Topology } from './sim/types';

/* ------------------------------------------------------------------ *
 * Autosaved session.
 *
 * While a student is designing, every change lands in localStorage a
 * moment later, so an accidental refresh costs them nothing. This module
 * owns that shelf: what is stored, how it is validated on the way back,
 * and the guarantee that a failure (corrupt JSON, blocked storage, a
 * half-written tab kill) falls back to an empty studio instead of
 * breaking boot.
 *
 * Everything read back crosses a trust boundary. Storage can be edited
 * by hand or left over from an older format, so nothing here trusts its
 * own shelf: topology through isTopology + sanitizeTopology, annotations
 * and playground through their own sanitizers, scalars through range
 * checks. Anything malformed is dropped entry by entry rather than
 * costing the whole restored session.
 * ------------------------------------------------------------------ */

/** Where the in-progress design lives. Stable: renaming it orphans saves. */
export const SESSION_KEY = 'scalelab.session.v1';

/** Longest architecture title kept. Matches the title input's maxLength. */
export const SESSION_TITLE_MAX = 60;

export interface Session {
  topology: Topology;
  rps: number;
  presetId: string | null;
  /**
   * The renamed architecture title, or null when none was stored (older
   * saves, or a title that did not survive validation). Callers fall back
   * to the preset name, then to 'System Architecture'.
   */
  title: string | null;
}

/** Total offered load: the sum over every traffic source. */
function offeredRpsFor(t: Topology): number {
  let sum = 0;
  for (const n of t.nodes) {
    if (n.kind === 'client' || n.kind === 'producer') sum += n.config.rps;
  }
  return sum;
}

/** A stored title survives only as trimmed text within the length limit. */
export function cleanSessionTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, SESSION_TITLE_MAX);
}

function fallback(): Session {
  // A first-time visitor lands in their OWN empty studio, not on a preset
  // cloned from another product.
  return {
    topology: { nodes: [], edges: [], annotations: [] },
    rps: 50,
    presetId: null,
    title: null,
  };
}

export function loadSession(): Session {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return fallback();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback();
    const s = parsed as Partial<Session> & {
      topology?: unknown;
      rps?: unknown;
      presetId?: unknown;
      title?: unknown;
    };
    if (!isTopology(s.topology)) return fallback();
    const rps = Number.isFinite(s.rps) ? (s.rps as number) : offeredRpsFor(s.topology);
    // isTopology validates what the ENGINE dereferences; annotations are
    // presentation data it never sees, so they cross the trust boundary
    // through their own sanitizer. Anything malformed is dropped entry by
    // entry rather than costing the whole restored session.
    const annotations = sanitizeAnnotations(
      (s.topology as { annotations?: unknown }).annotations,
    );
    // The playground crosses the same boundary: presentation data the
    // engine never reads, sanitized rather than structurally required, so
    // a half-written sheet costs nothing but the sheet.
    const playground = sanitizePlayground(
      (s.topology as { playground?: unknown }).playground,
    );
    // Node geometry is bounded on the same principle: a stored shape box
    // is clamped rather than trusted, so a half-written save cannot place
    // a box large enough to break fit-to-view.
    const clean = sanitizeTopology(s.topology);
    return {
      topology: {
        nodes: clean.nodes,
        edges: clean.edges,
        ...(annotations.length > 0 ? { annotations } : {}),
        ...(playground ? { playground } : {}),
      },
      rps: Math.min(5000, Math.max(0, rps)),
      presetId: typeof s.presetId === 'string' ? s.presetId : null,
      title: cleanSessionTitle(s.title),
    };
  } catch {
    // Corrupt JSON, blocked storage (private mode, disabled cookies) — any
    // failure here falls back to an empty studio rather than breaking boot.
    return fallback();
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Quota exceeded or storage unavailable. Persistence is a convenience,
    // never a correctness requirement, so this is silent by design.
  }
}
