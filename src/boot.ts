import { hasShareHash } from './share';

/**
 * Boot-location reads shared by the landing gate and the studio.
 *
 * Both live here rather than inside Studio.tsx so the landing gate in
 * App.tsx can decide whether to show the landing WITHOUT pulling the
 * studio's module graph into the first bundle: importing from Studio.tsx
 * would defeat the entire code split.
 */

/**
 * Is this tab opening a share link?
 *
 * Read once, synchronously, before the first render. Decoding it is
 * asynchronous (inflating is stream-based), so the app boots on the stored
 * session and swaps the shared design in when it arrives; this flag is what
 * holds the session WRITE back in the meantime, so a recipient who opens
 * someone else's link and closes the tab still has their own work waiting
 * for them next time. It is also what sends a share link straight to the
 * studio, past the landing.
 */
export function shareHashPresent(): boolean {
  try {
    return hasShareHash(window.location.hash);
  } catch {
    // No DOM (a test importing the module), or a locked-down location object.
    return false;
  }
}

/**
 * A short cloud share link, `?d=<id>` (see handleCopyLink). Validated
 * against the id shape the Worker issues so a junk query string never
 * costs a network request. Read once, like the hash.
 */
export function cloudShareId(): string | null {
  try {
    const id = new URLSearchParams(window.location.search).get('d');
    return id && /^[A-Za-z0-9]{8}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
