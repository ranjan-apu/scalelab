import { describe, expect, it } from 'vitest';

/**
 * Guards the RULE about which ports can start a link.
 *
 * A node wears two discs: the output on its right edge and the input on its
 * left. Only the output used to be a link origin — the input case fell through
 * to a pan, so a press on the port facing the target scrolled the canvas out
 * from under the pointer instead of drawing a wire. Every right-to-left arrow
 * is drawn with exactly that gesture, which made half of a diagram's edges
 * awkward to draw and looked like a broken tool rather than a missing
 * affordance.
 *
 * The canvas's pointer router cannot be exercised without mounting it (the
 * pointer events, the SVG hit-testing and the camera all come with it), so
 * this asserts on the source, the way Canvas.snap.wiring.test.ts does: any
 * edit that sends a port press back to `pan`, or drops a port from the link
 * branch, fails here instead of failing silently in someone's hands.
 */
const SOURCES = import.meta.glob('./Canvas.tsx', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const CANVAS = Object.values(SOURCES)[0] ?? '';

/** The press-routing switch's port section, from `port-in` to the next break. */
function portInBranch(): string {
  const switchAt = CANVAS.indexOf('switch (p.hit.kind) {');
  expect(switchAt).toBeGreaterThan(-1);
  const block = CANVAS.slice(switchAt);
  const at = block.indexOf("case 'port-in':");
  expect(at).toBeGreaterThan(-1);
  const tail = block.slice(at);
  const breakAt = tail.indexOf('break;');
  expect(breakAt).toBeGreaterThan(-1);
  return tail.slice(0, breakAt);
}

describe('both ports start a link', () => {
  it('routes a press on the input port to the link gesture', () => {
    const branch = portInBranch();
    expect(branch).toContain("p.mode = 'link'");
    // The regression: falling through to a pan makes the canvas move instead
    // of a wire appearing.
    expect(branch).not.toContain("p.mode = 'pan'");
  });

  it('gives the preview the side the gesture started from', () => {
    // A link that begins on the left disc has to leave by the left edge; the
    // side is carried in the gesture state and handed to the router.
    expect(CANVAS).toContain("side: p.hit.kind === 'port-in' ? 'left' : 'right'");
    expect(CANVAS).toContain('previewPath(nodeRect(previewFrom), link.x, link.y, link.side)');
  });
});
