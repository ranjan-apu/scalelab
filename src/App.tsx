import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Landing } from './landing/Landing';
import { cloudShareId, shareHashPresent } from './boot';

/**
 * App gate: landing first, studio on demand.
 *
 * The landing is rendered eagerly and is tiny (its styles ship inline in
 * index.html), so the page paints from HTML alone. The studio is a large
 * module graph and loads only when asked for. Two links open the studio
 * directly, past the gate: a share hash (`#d1...`) and a short cloud link
 * (`?d=`), because someone opening a shared design came for the design,
 * not for the pitch.
 */

const makeStudio = () => lazy(() => import('./Studio'));

type View = 'landing' | 'studio';

export default function App() {
  const [view, setView] = useState<View>(() =>
    shareHashPresent() || cloudShareId() !== null ? 'studio' : 'landing',
  );
  // Keyed by attempt: a failed chunk load retries by rebuilding the lazy
  // wrapper, since a rejected import() is cached inside the old one.
  const [attempt, setAttempt] = useState(0);
  const StudioLazy = useMemo(makeStudio, [attempt]);
  const pushedRef = useRef(false);

  const openStudio = useCallback(() => {
    if (pushedRef.current) return;
    pushedRef.current = true;
    setView('studio');
    try {
      // A history entry, so Back returns to the landing rather than
      // leaving the site. `#studio` is deliberately not a share fragment:
      // hasShareHash only recognises `d1.` payloads.
      history.pushState({ scalelabView: 'studio' }, '', '#studio');
    } catch {
      // Sandboxed history. The studio still opens; Back simply exits.
    }
  }, []);

  useEffect(() => {
    if (view !== 'studio') return;
    const onPop = (e: PopStateEvent) => {
      const state = e.state as { scalelabView?: string } | null;
      if (state?.scalelabView !== 'studio') setView('landing');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [view]);

  const retryStudio = useCallback(() => setAttempt((n) => n + 1), []);

  if (view === 'landing') return <Landing onOpen={openStudio} />;

  return (
    <StudioBoundary key={attempt} onRetry={retryStudio}>
      <Suspense fallback={<Landing opening onOpen={openStudio} />}>
        <StudioLazy />
      </Suspense>
    </StudioBoundary>
  );
}

interface BoundaryProps {
  onRetry: () => void;
  children: ReactNode;
}

interface BoundaryState {
  failed: boolean;
}

/**
 * Recovery for a studio chunk that never arrives (offline, stale deploy).
 * Without this a failed import() is a dead white screen; with it the
 * reader gets an explanation and a way back in.
 */
class StudioBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[ScaleLab] studio failed to load', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="lp-recover">
        <div className="lp-recover-card" role="alert">
          <div className="lp-recover-mark" aria-hidden="true">
            <LpMark />
          </div>
          <h2 className="lp-recover-title">The studio could not load</h2>
          <p className="lp-recover-body">
            The connection dropped while fetching the workspace. Your saved
            designs are safe in this browser.
          </p>
          <button type="button" className="lp-btn lp-btn-primary" onClick={this.props.onRetry}>
            Retry
          </button>
        </div>
      </div>
    );
  }
}

/** The ScaleLab mark, inline so the recovery card renders without assets. */
function LpMark() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--lp-ground)" />
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
      <circle cx="16" cy="16" r="3" fill="var(--lp-ground)" stroke="var(--lp-kind-traffic)" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="1.3" fill="#ffffff" />
    </svg>
  );
}
