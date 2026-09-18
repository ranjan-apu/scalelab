import { useCallback, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

/**
 * The landing page.
 *
 * This component is a mirror of the static markup inside index.html: the
 * page paints from that HTML alone, and when React mounts it renders this
 * identical tree over it so nothing visibly changes. The two must stay in
 * step — same elements, same classes, same order — or the handoff flashes.
 * Landing styles live only in the inline <style> block of index.html.
 *
 * What React adds on top of the static page:
 *   - the studio open action (the studio itself is a lazy chunk)
 *   - an "opening" state on the CTAs while that chunk loads
 *   - pointer parallax on the hero scene, coarse-pointer and
 *     reduced-motion users excluded
 */

interface LandingProps {
  onOpen: () => void;
  opening?: boolean;
}

/** Entrance-stagger custom property, one per node/chip. */
const d = (value: string) => ({ '--d': value }) as CSSProperties;

const clamp1 = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);

export function Landing({ onOpen, opening = false }: LandingProps) {
  const sceneRef = useRef<HTMLElement | null>(null);

  /* Pointer parallax. The tilt lives in CSS custom properties consumed
     inside the stage's keyframes, so updates recalculate the held
     animation frame rather than fighting it. A rAF loop eases the vars,
     which also smooths the return to rest when the pointer leaves. */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (typeof matchMedia !== 'function') return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (matchMedia('(pointer: coarse)').matches) return;

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let running = false;

    const tick = () => {
      x += (targetX - x) * 0.12;
      y += (targetY - y) * 0.12;
      scene.style.setProperty('--lp-tx', x.toFixed(4));
      scene.style.setProperty('--lp-ty', y.toFixed(4));
      if (Math.abs(targetX - x) + Math.abs(targetY - y) > 0.002) {
        raf = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };

    const wake = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    const onMove = (e: PointerEvent) => {
      const r = scene.getBoundingClientRect();
      targetX = clamp1(((e.clientX - r.left) / r.width) * 2 - 1);
      targetY = clamp1(((e.clientY - r.top) / r.height) * 2 - 1);
      wake();
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      wake();
    };

    scene.addEventListener('pointermove', onMove, { passive: true });
    scene.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      scene.removeEventListener('pointermove', onMove);
      scene.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  const open = useCallback(() => {
    if (opening) return;
    onOpen();
  }, [onOpen, opening]);

  const ctaLabel = (
    <>
      {opening ? <span className="lp-spinner" aria-hidden="true" /> : null}
      {opening ? 'Opening the studio' : 'Open the studio'}
    </>
  );

  return (
    <>
      <a className="lp-skip" href="#lp-main">
        Skip to content
      </a>

      <header className="lp-nav">
        <div className="lp-shell lp-nav-inner">
          <a className="lp-brand" href="#lp-top">
            <span className="lp-brand-mark" aria-hidden="true">
              <LpMarkSvg />
            </span>
            ScaleLab
          </a>
          <nav className="lp-nav-links" aria-label="Sections">
            <a href="#lp-simulate">The studio</a>
            <a href="#lp-failures">Failure modes</a>
            <a href="#lp-presets">Presets</a>
          </nav>
          <button
            type="button"
            className="lp-btn lp-btn-primary lp-btn-sm lp-nav-cta"
            data-lp-open
            data-opening={opening || undefined}
            onClick={open}
          >
            {ctaLabel}
          </button>
        </div>
      </header>

      <main id="lp-main">
        <section className="lp-hero" id="lp-top">
          <div className="lp-shell lp-hero-inner">
            <p className="lp-eyebrow">System design studio</p>
            <h1 className="lp-h1">
              Draw the system. Run the traffic.{' '}
              <span className="lp-h1-accent">Watch what breaks.</span>
            </h1>
            <p className="lp-lede">
              ScaleLab turns the diagram on your canvas into a running discrete-event
              simulation. Queues fill, breakers trip, p99 climbs, and a system that was
              healthy a moment ago collapses under a retry storm. Then rehearse explaining
              all of it, with guided interview packs.
            </p>
            <div className="lp-cta-row">
              <button
                type="button"
                className="lp-btn lp-btn-primary"
                data-lp-open
                data-opening={opening || undefined}
                onClick={open}
              >
                {ctaLabel}
              </button>
              <a className="lp-btn lp-btn-ghost" href="#lp-presets">
                Watch a preset run
              </a>
            </div>
            <ul className="lp-hero-facts" role="list">
              <li>
                <strong>34</strong> architecture components
              </li>
              <li>
                <strong>32</strong> ready-to-run presets
              </li>
              <li>
                <strong>39</strong> guided interview packs
              </li>
            </ul>
          </div>

          <div className="lp-shell lp-scene-wrap">
            <figure
              ref={sceneRef}
              className="lp-scene"
              role="img"
              aria-label="A ScaleLab simulation mid-run: clients pushing traffic through an API gateway, a service, a cache, a database, and a queue with workers, while latency, cache hit rate and queue depth tick in floating readouts."
            >
              <div className="lp-scene-bar" aria-hidden="true">
                <span className="lp-scene-live">
                  <span className="lp-dot lp-dot-live"></span> discrete-event engine
                </span>
                <span>t +00:42 · steady 12k rps</span>
              </div>
              <div className="lp-scene-inner" aria-hidden="true">
                <div className="lp-stage">
                  <svg
                    className="lp-stage-svg"
                    viewBox="0 0 1000 560"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <g
                      className="lp-edges"
                      fill="none"
                      stroke="var(--lp-line)"
                      strokeWidth="1.5"
                      opacity="0.9"
                    >
                      <path d="M130 95 C 230 95, 340 80, 402 80" />
                      <path d="M452 108 C 480 160, 540 190, 572 220" />
                      <path d="M545 262 C 460 300, 360 310, 307 313" strokeDasharray="5 6" />
                      <path d="M625 262 C 690 275, 760 285, 796 294" />
                      <path d="M570 282 C 540 350, 470 400, 428 432" />
                      <path d="M440 458 C 510 462, 610 468, 650 470" />
                      <path d="M705 440 C 740 400, 790 350, 818 330" />
                    </g>
                    <g className="lp-packets" fill="var(--lp-accent)">
                      <circle r="3.5">
                        <animateMotion dur="2.6s" begin="0s" repeatCount="indefinite" path="M130 95 C 230 95, 340 80, 402 80" />
                      </circle>
                      <circle r="3.5">
                        <animateMotion dur="2.2s" begin="0.7s" repeatCount="indefinite" path="M452 108 C 480 160, 540 190, 572 220" />
                      </circle>
                      <circle r="3.5">
                        <animateMotion dur="2.9s" begin="1.4s" repeatCount="indefinite" path="M625 262 C 690 275, 760 285, 796 294" />
                      </circle>
                      <circle r="3.5">
                        <animateMotion dur="3.1s" begin="0.4s" repeatCount="indefinite" path="M570 282 C 540 350, 470 400, 428 432" />
                      </circle>
                      <circle r="3.5">
                        <animateMotion dur="2.4s" begin="1.1s" repeatCount="indefinite" path="M440 458 C 510 462, 610 468, 650 470" />
                      </circle>
                      <circle r="3.5">
                        <animateMotion dur="2.8s" begin="1.8s" repeatCount="indefinite" path="M705 440 C 740 400, 790 350, 818 330" />
                      </circle>
                    </g>
                  </svg>

                  <div className="lp-node lp-n-client" style={d('0.45s')}>
                    <div className="lp-node-card" style={{ '--kc': 'var(--lp-kind-traffic)' } as CSSProperties}>
                      <span className="lp-node-head">
                        <NodeGlyph path="monitor" />
                        <span className="lp-node-name">Client</span>
                      </span>
                      <span className="lp-node-foot">
                        <span className="lp-node-val">12.4k rps</span>
                      </span>
                    </div>
                  </div>

                  <div className="lp-node lp-n-gateway" style={d('0.55s')}>
                    <div className="lp-node-card" style={{ '--kc': 'var(--lp-kind-traffic)' } as CSSProperties}>
                      <span className="lp-node-head">
                        <NodeGlyph path="diamond" />
                        <span className="lp-node-name">API gateway</span>
                      </span>
                      <span className="lp-node-foot">
                        <span className="lp-node-val">rate 5k/s</span>
                      </span>
                    </div>
                  </div>

                  <div className="lp-node lp-n-service" style={d('0.65s')}>
                    <div className="lp-node-card" style={{ '--kc': 'var(--lp-kind-compute)' } as CSSProperties}>
                      <span className="lp-node-head">
                        <NodeGlyph path="service" />
                        <span className="lp-node-name">Service</span>
                      </span>
                      <span className="lp-node-foot">
                        <span className="lp-node-val">util 74%</span>
                        <svg className="lp-spark" viewBox="0 0 64 18" width="56" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <polyline points="1,13 9,11 17,12 25,8 33,9 41,5 49,7 57,4 63,5" />
                        </svg>
                      </span>
                    </div>
                  </div>

                  <div className="lp-node lp-n-cache" style={d('0.75s')}>
                    <div className="lp-node-card" style={{ '--kc': 'var(--lp-kind-data)' } as CSSProperties}>
                      <span className="lp-node-head">
                        <NodeGlyph path="bolt" />
                        <span className="lp-node-name">Cache</span>
                      </span>
                      <span className="lp-node-foot">
                        <span className="lp-node-val">hit 96%</span>
                      </span>
                    </div>
                  </div>

                  <div className="lp-node lp-n-db" style={d('0.85s')}>
                    <div className="lp-node-card" style={{ '--kc': 'var(--lp-kind-data)' } as CSSProperties}>
                      <span className="lp-node-head">
                        <NodeGlyph path="db" />
                        <span className="lp-node-name">Database</span>
                      </span>
                      <span className="lp-node-foot">
                        <span className="lp-node-val">p99 284ms</span>
                        <svg className="lp-spark" viewBox="0 0 64 18" width="56" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <polyline points="1,9 9,10 17,7 25,9 33,6 41,11 49,8 57,12 63,10" />
                        </svg>
                      </span>
                    </div>
                  </div>

                  <div className="lp-node lp-n-queue" style={d('0.95s')}>
                    <div className="lp-node-card" style={{ '--kc': 'var(--lp-kind-compute)' } as CSSProperties}>
                      <span className="lp-node-head">
                        <NodeGlyph path="queue" />
                        <span className="lp-node-name">Queue</span>
                      </span>
                      <span className="lp-node-foot">
                        <span className="lp-node-val">depth 12</span>
                        <svg className="lp-spark" viewBox="0 0 64 18" width="56" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <polyline points="1,14 9,13 17,11 25,12 33,9 41,7 49,8 57,5 63,4" />
                        </svg>
                      </span>
                    </div>
                  </div>

                  <div className="lp-node lp-n-worker" style={d('1.05s')}>
                    <div className="lp-node-card" style={{ '--kc': 'var(--lp-kind-compute)' } as CSSProperties}>
                      <span className="lp-node-head">
                        <NodeGlyph path="worker" />
                        <span className="lp-node-name">Worker</span>
                      </span>
                      <span className="lp-node-foot">
                        <span className="lp-node-val">&times;4</span>
                      </span>
                    </div>
                  </div>

                  <div className="lp-chip lp-c-breaker" style={d('1.15s')}>
                    <span className="lp-chip-pill">
                      <span className="lp-dot"></span>breaker <b>closed</b>
                    </span>
                  </div>
                  <div className="lp-chip lp-c-p99" style={d('1.25s')}>
                    <span className="lp-chip-pill">p99 <b>284 ms</b></span>
                  </div>
                  <div className="lp-chip lp-c-hit" style={d('1.35s')}>
                    <span className="lp-chip-pill">cache hit <b>96.2%</b></span>
                  </div>
                  <div className="lp-chip lp-c-depth" style={d('1.45s')}>
                    <span className="lp-chip-pill">queue depth <b>12</b></span>
                  </div>
                </div>
              </div>
            </figure>
          </div>
        </section>

        <section className="lp-section" id="lp-simulate">
          <div className="lp-shell">
            <p className="lp-eyebrow lp-reveal">The studio</p>
            <h2 className="lp-h2 lp-reveal">Three tools around one canvas</h2>
            <ol className="lp-modes" role="list">
              <li className="lp-mode lp-reveal">
                <span className="lp-mode-num" aria-hidden="true">01</span>
                <div>
                  <h3 className="lp-mode-title">Diagram <span>/ the canvas</span></h3>
                  <p className="lp-mode-text">
                    Thirty-four real parts, from load balancers and caches to sharded
                    stores, sidecars, and vector databases. Wire them, annotate with the
                    pen, pin requirements cards, and sketch freehand. Clean Canvas mode
                    strips the telemetry away when you just want to draw.
                  </p>
                  <ul className="lp-chiprow" role="list">
                    <li>notes &amp; sections</li>
                    <li>pen &amp; eraser</li>
                    <li>requirements cards</li>
                    <li>Cmd+K search</li>
                  </ul>
                </div>
              </li>
              <li className="lp-mode lp-reveal">
                <span className="lp-mode-num" aria-hidden="true">02</span>
                <div>
                  <h3 className="lp-mode-title">Simulate <span>/ the engine</span></h3>
                  <p className="lp-mode-text">
                    Steady, ramp, spike, and diurnal traffic shapes run through your
                    topology with gamma-distributed service times, concurrency limits,
                    and backpressure. Every number comes from the discrete-event engine,
                    never a formula: p50 through p99, queue depth, goodput, per-node
                    utilization, and a request tracer that follows one call through the
                    whole path.
                  </p>
                  <ul className="lp-chiprow" role="list">
                    <li>p50 / p90 / p99</li>
                    <li>queue depth</li>
                    <li>goodput</li>
                    <li>request tracing</li>
                    <li>cost estimate</li>
                  </ul>
                </div>
              </li>
              <li className="lp-mode lp-reveal">
                <span className="lp-mode-num" aria-hidden="true">03</span>
                <div>
                  <h3 className="lp-mode-title">Rehearse <span>/ interview practice</span></h3>
                  <p className="lp-mode-text">
                    Thirty-nine guided packs walk the classics, from URL shortening to
                    flash sales: requirements, estimations, entities, API design, and
                    deep dives with tradeoffs. Pin every section onto the canvas beside a
                    runnable starter system, then grade yourself with auto-checked labs
                    against the live simulation.
                  </p>
                  <ul className="lp-chiprow" role="list">
                    <li>39 packs</li>
                    <li>34 concept lessons</li>
                    <li>auto-graded labs</li>
                    <li>glossary</li>
                  </ul>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className="lp-section lp-dark" id="lp-failures">
          <div className="lp-shell">
            <p className="lp-eyebrow lp-reveal">The engine</p>
            <h2 className="lp-h2 lp-reveal">Break it here, not in production</h2>
            <p className="lp-section-lede lp-reveal">
              The simulator ships the failure modes that actually take systems down.
              Each one is a behavior of the engine, not a label on a box, and each one
              is yours to trigger, watch, and design against.
            </p>
            <ul className="lp-fails" role="list">
              <li className="lp-sd-danger lp-reveal">
                <h3>Retry storms</h3>
                <p>Unmanaged retries multiply traffic and crush a database that was already recovering.</p>
              </li>
              <li className="lp-sd-warn lp-reveal">
                <h3>Circuit breakers</h3>
                <p>Closed, open, half-open: failing downstreams get isolated before they take callers with them.</p>
              </li>
              <li className="lp-sd-warn lp-reveal">
                <h3>Backpressure</h3>
                <p>Queues fill, latency climbs, and consumers fall behind until shedding kicks in.</p>
              </li>
              <li className="lp-sd-ok lp-reveal">
                <h3>Rate limiting</h3>
                <p>The gateway sheds low-priority traffic before backlogs form downstream.</p>
              </li>
              <li className="lp-sd-ok lp-reveal">
                <h3>Bulkheads</h3>
                <p>Failure domains stay isolated when one pool drowns; the rest of the system keeps serving.</p>
              </li>
              <li className="lp-sd-ok lp-reveal">
                <h3>Autoscaling</h3>
                <p>Instances boot with realistic delays and hysteresis, so scale-out never saves you instantly.</p>
              </li>
              <li className="lp-sd-warn lp-reveal">
                <h3>Hot keys</h3>
                <p>Celebrity bursts skew sharded fan-out and one partition burns while the rest idle.</p>
              </li>
              <li className="lp-sd-danger lp-reveal">
                <h3>Cascade failure</h3>
                <p>One saturated node slows its neighbors, times them out, and walks the outage across the map.</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="lp-section" id="lp-presets">
          <div className="lp-shell">
            <p className="lp-eyebrow lp-reveal">Presets</p>
            <h2 className="lp-h2 lp-reveal">Start from a system you know</h2>
            <p className="lp-section-lede lp-reveal">
              Thirty-two ready-to-run presets: reconstructions of real production
              architectures, interview classics, and foundational patterns. Open one,
              run its traffic, then bend it until something snaps.
            </p>
          </div>
          <div className="lp-marquee lp-reveal" aria-label="Preset systems">
            <div className="lp-marquee-track">
              <PresetsRow />
              <PresetsRow ariaHidden />
            </div>
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-shell lp-final-inner">
            <h2 className="lp-h2 lp-reveal">Your next design deserves a load test</h2>
            <p className="lp-final-body lp-reveal">
              Everything runs in your browser. No account, no backend, nothing leaves
              your machine.
            </p>
            <button
              type="button"
              className="lp-btn lp-btn-primary"
              data-lp-open
              data-opening={opening || undefined}
              onClick={open}
            >
              {ctaLabel}
            </button>
            <p className="lp-final-meta">runs locally &middot; open source &middot; MIT</p>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-shell lp-footer-inner">
          <span className="lp-brand">
            <span className="lp-brand-mark" aria-hidden="true">
              <LpMarkSvg />
            </span>
            ScaleLab
          </span>
          <p className="lp-footer-line">A system design studio: diagram, simulate, rehearse.</p>
          <nav className="lp-footer-links" aria-label="Footer">
            <a href="https://github.com/ranjan-apu/scalelab" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a
              href="https://github.com/ranjan-apu/scalelab/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
            >
              MIT License
            </a>
            <a href="#lp-top">Back to top</a>
          </nav>
        </div>
      </footer>
    </>
  );
}

/** The ScaleLab mark, drawn from the landing palette. */
function LpMarkSvg() {
  return (
    <svg viewBox="0 0 32 32" width="18" height="18">
      <rect x="6.5" y="7" width="8" height="8" rx="2.5" fill="var(--lp-kind-traffic)" />
      <rect x="17.5" y="17" width="8" height="8" rx="2.5" fill="var(--lp-kind-data)" />
      <path
        d="M14.5 11 H19.5 C20.6 11 21.5 11.9 21.5 13 V17"
        stroke="var(--lp-kind-traffic)"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M17.5 21 H12.5 C11.4 21 10.5 20.1 10.5 19 V15"
        stroke="var(--lp-kind-compute)"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="16" cy="16" r="3" fill="#090d16" stroke="var(--lp-kind-traffic)" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="1.3" fill="#ffffff" />
    </svg>
  );
}

const GLYPHS = {
  monitor: (
    <>
      <rect x="2" y="3" width="12" height="8" rx="1.5" />
      <path d="M8 11v2M5 13h6" />
    </>
  ),
  diamond: <path d="M8 2l6 6-6 6-6-6z" />,
  service: (
    <>
      <rect x="2.5" y="2.5" width="11" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="11" height="4.5" rx="1" />
    </>
  ),
  bolt: <path d="M9 1.5 3.5 9h4L7 14.5 12.5 7h-4z" />,
  db: (
    <>
      <ellipse cx="8" cy="4" rx="5.5" ry="2.2" />
      <path d="M2.5 4v8c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2V4" />
    </>
  ),
  queue: (
    <>
      <path d="M6 4h8M6 8h5M6 12h8" />
      <circle cx="3" cy="4" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="3" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="3" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  worker: (
    <>
      <circle cx="8" cy="8" r="2.6" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" />
    </>
  ),
} as const;

function NodeGlyph({ path }: { path: keyof typeof GLYPHS }) {
  return (
    <svg
      className="lp-node-glyph"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[path]}
    </svg>
  );
}

const PRESETS: ReadonlyArray<{ name: string; note?: string }> = [
  { name: 'Discord', note: 'websocket fan-out' },
  { name: 'Uber', note: 'GPS streams' },
  { name: 'Netflix', note: 'edge CDN' },
  { name: 'Spotify', note: 'audio vs metadata' },
  { name: 'Twitter / X', note: 'timeline caches' },
  { name: 'Stripe', note: 'idempotency keys' },
  { name: 'WhatsApp', note: 'connection holding' },
  { name: 'Ticketmaster', note: 'seat holds' },
  { name: 'TinyURL', note: 'cache-heavy reads' },
  { name: 'LeetCode', note: 'contest bursts' },
  { name: 'CDN + origin' },
  { name: 'Sharded DB' },
  { name: 'Multi-region' },
  { name: 'Event-driven' },
];

function PresetsRow({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <ul className="lp-marquee-row" role="list" aria-hidden={ariaHidden || undefined}>
      {PRESETS.map((p) => (
        <li key={p.name}>
          <b>{p.name}</b>
          {p.note ? <> &middot; {p.note}</> : null}
        </li>
      ))}
    </ul>
  );
}
