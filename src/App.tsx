import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type {
  AnimationEvent,
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  CSSProperties,
  DragEvent,
  ReactNode,
} from 'react';
import type { NodeConfig, NodeKind, SimEdge, SimNode, SimSnapshot, Topology, TrafficPattern } from './sim/types';
import { useCoarsePointer } from './useCoarsePointer';
import { Engine } from './sim/engine';
import { PRESETS, makeNode } from './sim/presets';
import type { Preset } from './sim/presets';
import { CostModal } from './components/CostModal';
import { AdvisorDrawer } from './components/AdvisorDrawer';
import { calculateCloudCosts } from './content/cloudPricing';
import { auditTopology } from './sim/advisor';
import { exportToHldMarkdown } from './hldExport';
import Canvas, {
  GRID,
  NODE_H,
  NODE_W,
  SPARK_LEN,
  readoutFor,
  sourceBacklogs,
} from './components/Canvas';
import { Inspector, TrafficControl } from './components/Inspector';
import { Metrics } from './components/Metrics';
import { Palette } from './components/Palette';
import { Glossary } from './components/Glossary';
import { Shortcuts } from './components/Shortcuts';
import { Examples } from './components/Examples';
import { InterviewPractice } from './components/InterviewPractice';
import { PenToolbar } from './components/PenToolbar';
import { INTERVIEW_PACKS } from './content/interviewPacks';
import { LABS } from './content/labs';
import { Guide } from './components/guide';
import { cloneSubgraph, isTopology, selectionSubgraph } from './clipboard';
import type { ClipboardSubgraph } from './clipboard';
import {
  NOTE_DEFAULT_WIDTH,
  SECTION_MIN_HEIGHT,
  SECTION_MIN_WIDTH,
  TEXTBOX_DEFAULT_HEIGHT,
  TEXTBOX_DEFAULT_WIDTH,
  TEXTBOX_MIN_HEIGHT,
  TEXTBOX_MIN_WIDTH,
  NOTE_MAX_SCALE,
  NOTE_MAX_WIDTH,
  NOTE_MIN_SCALE,
  NOTE_MIN_WIDTH,
  SECTION_TONE_COUNT,
  isInk,
  isNote,
  isSection,
  isTextBox,
  sanitizeAnnotations,
} from './sim/annotations';
import type { Annotation, AnnotationFont, Note, TextBox, TextBoxStyle } from './sim/annotations';
import {
  INK_MAX_POINTS,
  INK_MAX_WIDTH,
  INK_MIN_OPACITY,
  INK_MIN_WIDTH,
} from './sim/sketch';
import type { InkTone } from './sim/sketch';
import { DEFAULT_PEN_SETTINGS } from './sim/sketch';
import type { PenSettings } from './sim/sketch';
import {
  NEW_NOTE_TEXT,
  NEW_TEXTBOX_TEXT,
  NEW_TEXTBOX_TITLE,
} from './components/annotationLayout';
import type { InterviewTemplate } from './components/annotationLayout';
import type { AnnotationTool } from './components/Palette';
import { TooltipLayer, setGlossaryNavigate } from './components/Tooltip';
import { togglePreference, usePreference } from './content/preferences';
import { Settings } from './components/Settings';
import { MainMenu } from './components/MainMenu';
import { Designs } from './components/Designs';
import { getDesign, saveDesign } from './savedDesigns';
import { PanelResizer } from './components/PanelResizer';
import { applyTheme } from './theme/applyTheme';
import { usePresence } from './components/presence';
import { SessionHistory, syncEngine } from './history';
import type { HistoryEntry, HistorySnapshot } from './history';
import { buildShareUrl, decodeTopology, hasShareHash } from './share';
import { DESIGN_FILE_ACCEPT, downloadDesign, readDesignFile } from './designFile';
import { downloadBlob, svgToPng } from './imageExport';
import { exportToMermaid } from './exportFormats';
import './App.css';

/* ------------------------------------------------------------------ *
 * Persistence
 * ------------------------------------------------------------------ */

const STORAGE_KEY = 'scalelab.session.v1';

/* ------------------------------------------------------------------ *
 * Layout persistence
 *
 * Which panels are open is kept separate from the session: clearing a
 * topology should never reset a student's layout, and vice versa.
 *
 * The inspector is deliberately NOT in here. It is selection-driven (see
 * the inspector state in App), and persisting "hidden" would mean a
 * student who dismissed it once could select nodes forever after and
 * never see their settings again, with nothing on screen to explain why.
 * ------------------------------------------------------------------ */

const LAYOUT_KEY = 'scalelab.layout.v1';

/**
 * How far a sheet must be pulled down before releasing closes it.
 *
 * 64px is roughly a thumb's comfortable travel and well past the slop of a
 * tap that happened to move. Short of it the sheet springs back, which is
 * the feedback that tells a reader the gesture exists at all.
 */
const SHEET_DISMISS_PX = 64;

/** The gap below the studio bar. Set to 0 for docked studio layout. */
const BAR_GAP_PX = 0;

interface LayoutPrefs {
  /** The left component rail. */
  library: boolean;
  /** The bottom charts strip. */
  metrics: boolean;
  /**
   * Panel sizes in px, dragged from the seam between a panel and the canvas.
   *
   * Stored because a student who widened the rail to read long component
   * names meant it, and having to redo it every visit would teach them not
   * to bother. Clamped on the way in as well as on the way out: a number
   * that arrives out of range from edited storage would otherwise render a
   * rail wider than the window with no way to grab its handle.
   */
  railW: number;
  insW: number;
  stripH: number;
}

/**
 * Size limits, in px. The minimums are the point at which a panel stops
 * being able to show its own content; the maximums stop a panel from taking
 * the window and leaving no canvas to look at.
 */
export const PANEL_LIMITS = {
  railW: { min: 180, max: 420, base: 224 },
  insW: { min: 260, max: 520, base: 320 },
  stripH: { min: 140, max: 420, base: 220 },
} as const;

export type PanelKey = keyof typeof PANEL_LIMITS;

const clampPanel = (key: PanelKey, v: unknown): number => {
  const { min, max, base } = PANEL_LIMITS[key];
  return typeof v === 'number' && Number.isFinite(v)
    ? Math.min(Math.max(Math.round(v), min), max)
    : base;
};

/**
 * First run: the rail is open because it is the app's verbs — components
 * to add and examples to load — and a canvas with no visible way to act
 * on it is a dead end. The charts start closed: the top bar already
 * carries p99, goodput, errors and dropped, so the strip is depth to be
 * opened when a headline number needs explaining, not a fixture.
 */
/**
 * Is the shell narrow enough that panels have to be sheets?
 *
 * Matches the 720px breakpoint in App.css, and is stated here as well
 * because two things need it that CSS cannot do: panels must become
 * MUTUALLY EXCLUSIVE (two stacked sheets would bury the canvas the sheets
 * exist to explain), and the components rail must not boot open, which is a
 * default rather than a style.
 *
 * A media query rather than a device or touch test. The question is how much
 * room the shell has, and a small desktop window has exactly the same
 * problem as a phone; a tablet in landscape has neither.
 */
const PHONE_QUERY = '(max-width: 720px)';

function subscribePhone(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function isPhone(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(PHONE_QUERY).matches;
}

/** Server snapshot: no window, so never the phone layout. */
function isPhoneServer(): boolean {
  return false;
}

const DEFAULT_LAYOUT: LayoutPrefs = {
  library: true,
  metrics: false,
  railW: PANEL_LIMITS.railW.base,
  insW: PANEL_LIMITS.insW.base,
  stripH: PANEL_LIMITS.stripH.base,
};

function loadLayout(): LayoutPrefs {
  /* The components rail opens on a desktop because a blank canvas with no
     visible way to act on it is a dead end. On a phone the same default is
     the opposite of helpful: the rail is a sheet, so it opens ON TOP of the
     canvas and the first thing a reader sees is a list of components with a
     sliver of diagram behind it. They arrive from a link to LOOK at
     something, so the canvas gets the screen and the rail is a tap away. */
  const base: LayoutPrefs = isPhone()
    ? { ...DEFAULT_LAYOUT, library: false }
    : DEFAULT_LAYOUT;

  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return base;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return base;
    const p = parsed as Partial<LayoutPrefs>;
    return {
      /* A rail opened on a desktop must not reopen as a sheet on a phone:
         the same person on the same account gets a covered canvas on the
         device where it hurts most. */
      library: isPhone()
        ? false
        : typeof p.library === 'boolean'
          ? p.library
          : base.library,
      metrics: typeof p.metrics === 'boolean' ? p.metrics : base.metrics,
      railW: clampPanel('railW', p.railW),
      insW: clampPanel('insW', p.insW),
      stripH: clampPanel('stripH', p.stripH),
    };
  } catch {
    // Blocked or corrupt storage: the default layout, never a crash.
    return base;
  }
}

function saveLayout(layout: LayoutPrefs): void {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // Persistence is a convenience; losing it must stay invisible.
  }
}

/**
 * One shape for the three panel-toggle glyphs: a frame with the edge that
 * panel lives on marked. The icon states position, the accessible name and
 * `title` state content, so together the button says "the thing over here".
 */
function PanelGlyph({ edge }: { edge: 'left' | 'right' | 'bottom' }) {
  const d = edge === 'left' ? 'M9 4v16' : edge === 'right' ? 'M15 4v16' : 'M4 14h16';
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d={d} />
    </svg>
  );
}

/**
 * Presence wrapper for one collapsible shell panel.
 *
 * THE STRUCTURAL FIX for panel motion. The shell used to render each panel
 * conditionally, so a closing panel was out of the DOM a frame before any
 * transition could run; there was literally nothing left to animate. This
 * wrapper keeps the panel mounted through its exit (usePresence), and the
 * panel slides from its own edge via TRANSFORM keyframes in App.css.
 *
 * Why transform, not an animated width or grid track: the canvas's
 * world-to-screen maths reads its viewport rect, so a layout that changes on
 * every animation frame would make an in-progress node drag drift and force
 * a re-fit per frame. The slots are absolutely positioned OVER the stage
 * (App.css), so in fact no state of this animation, and not even the slot's
 * mount or unmount, can change the canvas's rect: the diagram holds the same
 * screen pixels through any toggle, including one mid-drag, and the slide is
 * a pure transform that invalidates no layout at all.
 *
 * While closing the slot is `inert`: the leaving panel cannot take focus and
 * is invisible to a screen reader, and at animationend it unmounts outright,
 * so nothing hidden lingers in the DOM and an idle shell pays nothing.
 *
 * Children are FROZEN during the exit: the last element rendered while open
 * keeps rendering until unmount. The inspector needs this, because the
 * selection that justified its content is often already gone by the time it
 * slides out, and re-rendering it empty mid-exit would flash a blank panel.
 *
 * The entrance animation is skipped on the slot's very first appearance at
 * app boot (a panel restored from the saved layout is simply present, and
 * content that is simply present does not get an entrance), and plays on
 * every toggle after that.
 */
function PanelSlot({
  open,
  edge,
  children,
  onDismiss,
}: {
  open: boolean;
  edge: 'left' | 'right' | 'bottom';
  children: ReactNode;
  /**
   * Close this panel from inside it. Phone only: on a desktop a rail sits
   * BESIDE the canvas and dismissing it by touching the canvas would fight
   * every drag; as a sheet it sits OVER the canvas, so the canvas showing
   * through is the obvious way out and a sheet that ignores it feels stuck.
   * Omitted, the sheet has no scrim and no handle.
   */
  onDismiss?: () => void;
}) {
  const { mounted, closing, unmount } = usePresence(open);

  /**
   * Swipe-down-to-close.
   *
   * Tracked on the handle only, not the whole sheet: the panels scroll
   * internally, and a downward drag anywhere on a scrolling list means
   * scroll, not dismiss. A grabber at the top is the one place where down
   * can only mean "put this away", which is why every sheet on every phone
   * puts one there.
   *
   * The sheet follows the finger while dragging (no transition, so it tracks
   * exactly) and commits past a threshold; released short of it, it springs
   * back. Distance rather than velocity: a slow deliberate pull and a flick
   * both read as intent, and a velocity gate makes the slow one feel broken.
   */
  const dragRef = useRef<{ id: number; startY: number } | null>(null);
  const [dragY, setDragY] = useState(0);

  /* Escape closes a sheet, the way it closes every other temporary layer in
     this app. Phone only, because onDismiss is what makes it a sheet: on a
     desktop the same key would collapse a rail the reader deliberately
     opened and left open. */
  useEffect(() => {
    if (!onDismiss || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss, open]);

  const onHandleDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onDismiss) return;
    dragRef.current = { id: e.pointerId, startY: e.clientY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a convenience; the move handler still tracks without it.
    }
  };

  const onHandleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    // Down only. An upward pull is not a gesture here, and letting it lift
    // the sheet off its edge would expose the canvas underneath it.
    setDragY(Math.max(0, e.clientY - d.startY));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    const travelled = Math.max(0, e.clientY - d.startY);
    setDragY(0);
    if (travelled > SHEET_DISMISS_PX) onDismiss?.();
  };

  const lastChildren = useRef(children);
  if (open) lastChildren.current = children;

  // "Has this slot ever been toggled": false until `open` first differs from
  // its value at mount, true forever after. A slot that has never toggled is
  // showing boot state and gets no entrance; one that has animates every
  // appearance. Render-phase adjustment, same pattern as usePresence.
  const [bootOpen] = useState(open);
  const [toggled, setToggled] = useState(false);
  if (!toggled && open !== bootOpen) setToggled(true);

  // The entrance class is REMOVED once its animation completes, symmetric
  // with the exit handler. A finished keyframe replays nothing, so leaving
  // the class cost little at runtime, but any remount (HMR, a key change)
  // would replay the slide on content that was simply present.
  const [entered, setEntered] = useState(false);
  const prevOpen = useRef(open);
  if (prevOpen.current !== open) {
    prevOpen.current = open;
    if (open) setEntered(false);
  }

  if (!mounted) return null;

  const state = closing ? ' is-closing' : toggled && !entered ? ' is-entering' : '';

  return (
    <>
      {/* The way out. Covers the canvas the sheet is sitting on, so a tap
          anywhere off the sheet closes it, and dims what is behind so the
          sheet reads as the layer in front. Hidden above the breakpoint by
          CSS, where the panels are rails and there is nothing to dismiss. */}
      {onDismiss ? (
        <div
          className={`app-scrim${closing ? ' is-closing' : ''}`}
          onPointerDown={onDismiss}
          aria-hidden="true"
        />
      ) : null}
      <div
        className={`app-slot app-slot-${edge}${state}`}
        inert={closing || undefined}
        /* Following the finger is a transform, like the slide itself, so it
           invalidates no layout and cannot move the canvas underneath. */
        style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined}
        onAnimationEnd={(e: AnimationEvent<HTMLDivElement>) => {
          // Only the slot's own animations count. Animations on children (a
          // chart transition, a button) bubble through here too.
          if (e.target !== e.currentTarget) return;
          if (closing) unmount();
          else setEntered(true);
        }}
      >
        {onDismiss ? (
          <div
            className="app-grabber"
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            role="button"
            tabIndex={-1}
            aria-label="Close panel"
            onClick={onDismiss}
          >
            <span className="app-grabber-bar" />
          </div>
        ) : null}
        {open ? children : lastChildren.current}
      </div>
    </>
  );
}

/** Snapshot rate for React. The engine still advances every animation frame. */
const SNAPSHOT_HZ = 10;
const SNAPSHOT_INTERVAL_MS = 1000 / SNAPSHOT_HZ;

/**
 * Largest frame delta we hand the engine. A backgrounded tab produces one
 * enormous delta on return; without this the sim would try to catch up on
 * minutes of simulated time in a single frame.
 */
const MAX_FRAME_MS = 100;

/**
 * One press of Step advances this much simulated time. The engine exposes no
 * step() of its own — only advance(dt) — so a step is simply one manual frame
 * at a size big enough to visibly move the state.
 */
const STEP_MS = 100;

/**
 * Sparkline cadence. 1Hz x 60 samples = the same 60s window the charts show.
 * The engine emits history every 250ms; sampling at 1Hz keeps the node
 * sparkline and the metrics charts describing the same span of time.
 */
const SPARK_INTERVAL_MS = 1000;

/*
 * The series each node kind's sparkline plots is `readoutFor(...).spark`:
 * the SAME per-kind primary metric the canvas headlines, taken from the same
 * function, so the trend line under a number is a trend line OF that number.
 * A local per-kind switch lived here before and had already drifted from the
 * canvas's choices for most kinds (everything defaulted to utilisation,
 * which is hardwired 0 for every gate and controller kind).
 */

interface Session {
  topology: Topology;
  rps: number;
  presetId: string | null;
}

/*
 * Structural validation of the stored session lives in clipboard.ts
 * (isTopology), because the clipboard paste path validates the exact same
 * shape and two hand-maintained copies of a 33-kind allowlist would drift.
 */

function loadSession(): Session {
  // A first-time visitor lands in their OWN empty studio, not on a preset
  // cloned from another product. The Studio guide (auto-opened on first
  // run) and the Examples gallery are the on-ramps from here.
  const fallback: Session = {
    topology: { nodes: [], edges: [], annotations: [] },
    rps: 50,
    presetId: null,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    const s = parsed as Partial<Session>;
    if (!isTopology(s.topology)) return fallback;
    const rps = Number.isFinite(s.rps) ? (s.rps as number) : offeredRpsFor(s.topology);
    // isTopology validates what the ENGINE dereferences; annotations are
    // presentation data it never sees, so they cross the trust boundary
    // through their own sanitizer. Anything malformed is dropped entry by
    // entry rather than costing the student the whole restored session.
    const annotations = sanitizeAnnotations(
      (s.topology as { annotations?: unknown }).annotations,
    );
    return {
      topology: {
        nodes: s.topology.nodes,
        edges: s.topology.edges,
        ...(annotations.length > 0 ? { annotations } : {}),
      },
      rps: Math.min(5000, Math.max(0, rps)),
      presetId: typeof s.presetId === 'string' ? s.presetId : null,
    };
  } catch {
    // Corrupt JSON, blocked storage (private mode, disabled cookies) — any
    // failure here falls back to an empty studio rather than breaking boot.
    return fallback;
  }
}

function saveSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Quota exceeded or storage unavailable. Persistence is a convenience,
    // never a correctness requirement, so this is silent by design.
  }
}

/**
 * Is this tab opening a share link?
 *
 * Read once, synchronously, before the first render. Decoding it is
 * asynchronous (inflating is stream-based), so the app boots on the stored
 * session and swaps the shared design in when it arrives; this flag is what
 * holds the session WRITE back in the meantime, so a recipient who opens
 * someone else's link and closes the tab still has their own work waiting
 * for them next time.
 */
function shareHashPresent(): boolean {
  try {
    return hasShareHash(window.location.hash);
  } catch {
    // No DOM (a test importing App), or a locked-down location object.
    return false;
  }
}

/** Every traffic source on the canvas. Presets routinely have several. */
function findTrafficSources(t: Topology): SimNode[] {
  return t.nodes.filter((n) => n.kind === 'client' || n.kind === 'producer');
}

/**
 * Total offered load: the SUM over every traffic source. The header used to
 * mirror a separate `rps` state cell that only the slider wrote, which came
 * apart two ways — a multi-client preset offered more than the header
 * admitted (Spotify: goodput 5.7k/s under "Offered load 5k"), and deleting
 * then re-adding a client left the header frozen on the old value while the
 * new client sent 50/s. Deriving from the topology makes the number a fact.
 */
function offeredRpsFor(t: Topology): number {
  let sum = 0;
  for (const source of findTrafficSources(t)) sum += source.config.rps;
  return sum;
}

/* ------------------------------------------------------------------ *
 * App
 * ------------------------------------------------------------------ */

export default function App() {
  // Read storage once, before the first paint, so the app never flashes a
  // preset and then swaps to the restored session.
  const [initial] = useState(loadSession);

  /**
   * "A share link is on the URL and has not been dealt with yet."
   *
   * While this is true the session is not written to storage. The
   * recipient's own design stays exactly as they left it until they
   * actually change something on the shared one, which is the whole of the
   * read-only promise this feature makes.
   */
  const [sharePending, setSharePending] = useState(shareHashPresent);

  const [topology, setTopology] = useState<Topology>(initial.topology);
  const [rps, setRps] = useState<number>(initial.rps);
  const [presetId, setPresetId] = useState<string | null>(initial.presetId);
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [advisorDrawerOpen, setAdvisorDrawerOpen] = useState(false);
  const [architectureTitle, setArchitectureTitle] = useState<string>(() => {
    if (initial.presetId) {
      const p = PRESETS.find((preset) => preset.id === initial.presetId);
      if (p) return p.name;
    }
    return 'System Architecture';
  });
  /**
   * Canvas selection. Node ids and edge ids share this one set; an edge id is
   * `from->to`, which can never collide with a node id, so the namespace is
   * unambiguous and a single set covers both.
   *
   * The Inspector still edits exactly one node, so `selectedNode` below
   * resolves the set down to a single node — a multi-selection simply shows
   * the empty inspector rather than an arbitrary member.
   */
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [running, setRunning] = useState(true);

  /**
   * The glossary side sheet.
   *
   * `glossaryFocusId` is the entry to land on. It is cleared when the sheet
   * closes so that reopening from the top bar starts at the top of the list
   * rather than resuming wherever the last "see also" link happened to go.
   */
  /* The theme is applied to <html>, which is outside React, so this is a
     genuine external-system synchronisation rather than derived state. */
  const themeChoice = usePreference('theme');
  const cleanCanvas = usePreference('cleanCanvas');
  const costEstimator = usePreference('costEstimator');
  useEffect(() => {
    applyTheme(themeChoice);
  }, [themeChoice]);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [glossaryFocusId, setGlossaryFocusId] = useState<string | undefined>(undefined);

  /** The keyboard shortcuts dialog. Ctrl+/ and the top-bar button. */
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [designsOpen, setDesignsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(() => {
    try {
      // Clear legacy keys so the first-run policy below governs alone.
      localStorage.removeItem('scalelab.guide-dismissed');
      sessionStorage.removeItem('scalelab.guide-dismissed');
      // First launch ever: the guide opens by itself. Afterwards it only
      // opens from the sidebar, never automatically.
      return localStorage.getItem('scalelab.guide-seen-v1') !== 'true';
    } catch {
      return true; // If storage is unavailable, show the guide anyway.
    }
  });

  /**
   * Whether the canvas has reached storage yet.
   *
   * Work has always persisted and the app has never said so, which left a
   * student with no way to know whether closing the tab would cost them the
   * last twenty minutes. Starts 'saved', because what is on screen at boot
   * came out of storage in the first place.
   */
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');

  const [examplesOpen, setExamplesOpen] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  /** Pack preselected when practice opens from a concept lesson. Cleared on close. */
  const [pendingPackId, setPendingPackId] = useState<string | null>(null);

  /**
   * The pen as currently held. Session state, reset every visit by
   * construction: useState initialises once per page load and nothing
   * persists it. A stroke copies these values at commit; later changes
   * never follow already-drawn ink.
   */
  const [penSettings, setPenSettings] = useState<PenSettings>(DEFAULT_PEN_SETTINGS);

  const handlePenSettingsChange = useCallback((patch: Partial<PenSettings>) => {
    setPenSettings((s) => ({ ...s, ...patch }));
  }, []);

  /**
   * Cmd+K landing ping for the library search. Incremented, never reset:
   * the Palette focuses its search box on each change.
   */
  const [paletteFocusNonce, setPaletteFocusNonce] = useState(0);

  /* ---------------- panel layout ---------------- */

  const [layout, setLayout] = useState<LayoutPrefs>(loadLayout);

  const phone = useSyncExternalStore(subscribePhone, isPhone, isPhoneServer);
  const coarse = useCoarsePointer();

  /**
   * Where the bar actually ends, so everything that must clear it can.
   *
   * `--bar-clear` was a constant (84px, 116px on a phone), which held while
   * the bar was one row of a known height. It stopped holding the moment the
   * bar could WRAP: at 412px it stands 223px tall and the constant put the
   * components toggle underneath it. A number that has to be re-guessed
   * every time the bar's contents change is a number that will be wrong
   * again, so it is measured instead.
   *
   * Measured, not derived from the breakpoint: the bar's height depends on
   * what wrapped, which depends on the text, the font and the width. Only
   * the element knows.
   */
  const barRef = useRef<HTMLElement | null>(null);
  const [barBottom, setBarBottom] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    /* The bar's BOTTOM edge, not its height.
    
       The bar floats: it sits --sp-3 down from the top, so its height alone
       is short by that offset and the panels started flush against it with
       no gap at all. Reading the bottom of its rect includes the offset
       whatever that offset happens to be, which is the point of measuring
       rather than restating the arithmetic. */
    const measure = () => setBarBottom(Math.round(el.getBoundingClientRect().bottom));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();

    /* A phone's address bar collapsing resizes the VIEWPORT without resizing
       the header, so the ResizeObserver above never fires while everything
       measured against the window shifts underneath it. visualViewport is
       the event that reports it; `resize` covers orientation changes and any
       browser without it. */
    const vv = window.visualViewport;
    vv?.addEventListener('resize', measure);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      vv?.removeEventListener('resize', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);

  /* On a phone a panel is a sheet over the canvas, so opening one closes the
     other: two stacked sheets would cover the diagram they exist to explain,
     and the reader would have no way to see the effect of what they changed.
     On a desktop the two are rails on opposite edges and coexist happily. */
  /**
   * The right dock hosts TWO things: the node inspector while a selection
   * exists, and the Studio review (cost, advisor, RFC) when nothing is
   * selected. It starts closed so a first-time visitor meets the canvas,
   * and selecting anything opens it via the effect below. Pressing I (or
   * the toggle) with an empty selection opens the Studio review instead.
   * Deliberately not persisted, for the same reason as before.
   */
  const [inspectorHidden, setInspectorHidden] = useState(true);
  /** Manual-close veto for the auto-open effect below. */
  const dismissRef = useRef(false);

  /* On a phone the three panels are SHEETS stacked over the canvas, so only
     one may be open: two of them cover the diagram they exist to explain,
     and the reader loses the thing they changed it to see. The inspector is
     part of this too, and was not before, which is how three could stack.
     On a desktop they are rails on three different edges and coexist. */
  const toggleLibrary = useCallback(() => {
    setLayout((l) => ({
      ...l,
      library: !l.library,
      metrics: !l.library && phone ? false : l.metrics,
    }));
    if (phone) setInspectorHidden(true);
  }, [phone]);

  const toggleMetrics = useCallback(() => {
    setLayout((l) => ({
      ...l,
      metrics: !l.metrics,
      library: !l.metrics && phone ? false : l.library,
    }));
    if (phone) setInspectorHidden(true);
  }, [phone]);

  useEffect(() => {
    saveLayout(layout);
  }, [layout]);

  /**
   * The right dock is dual-purpose: node settings while a selection
   * exists, Studio review when nothing is selected. `inspectorHidden` is
   * the manual override — pressing I (or the toggle) flips it either way,
   * and the effect below clears it on the next selection gesture, so
   * selecting something always brings the settings back. Deliberately not
   * persisted: a dismissed dock stays dismissed for this selection only.
   */

  useEffect(() => {
    if (selectedIds.size > 0) {
      // A new selection opens the dock, unless the reader explicitly
      // closed it for this exact selection. Without the guard, closing
      // the dock and then rubber-banding one more node would pop it
      // straight back open.
      if (!dismissRef.current) setInspectorHidden(false);
    } else {
      // Nothing selected means nothing to configure AND no review to
      // push: the dock closes and stays closed until the reader opens
      // it or selects something. The Studio review never appears
      // uninvited, not on boot, not on preset load, not on deselect.
      setInspectorHidden(true);
      dismissRef.current = false;
    }
  }, [selectedIds]);

  const toggleInspector = useCallback(() => {
    setInspectorHidden((h) => {
      // Closing by hand vetoes the auto-open above until the selection
      // itself changes. Opening by hand clears the veto.
      dismissRef.current = !h;
      return !h;
    });
  }, []);

  /**
   * The selection, split into the three things it can hold. Node ids and
   * edge ids share `selectedIds` with annotation ids; nodes and annotations
   * are identified by lookup and whatever remains is an edge. Kept in ONE
   * memo so the Inspector can never be handed a node list and an edge count
   * computed from different renders.
   */
  const { selectedNodes, selectedEdgeCount } = useMemo(() => {
    if (selectedIds.size === 0) {
      return { selectedNodes: EMPTY_NODES, selectedEdgeCount: 0, selectedAnnCount: 0 };
    }
    const nodes = topology.nodes.filter((n) => selectedIds.has(n.id));
    const anns = (topology.annotations ?? []).filter((a) => selectedIds.has(a.id));
    return {
      selectedNodes: nodes,
      // Whatever in the set is neither a node nor an annotation is an edge.
      selectedEdgeCount: selectedIds.size - nodes.length - anns.length,
      selectedAnnCount: anns.length,
    };
  }, [topology.nodes, topology.annotations, selectedIds]);

  const selectedTextBox = useMemo<TextBox | null>(() => {
    if (selectedIds.size !== 1) return null;
    const [id] = selectedIds;
    const ann = (topology.annotations ?? []).find((a) => a.id === id);
    return ann && isTextBox(ann) ? ann : null;
  }, [selectedIds, topology.annotations]);

  const selectedNote = useMemo<Note | null>(() => {
    if (selectedIds.size !== 1) return null;
    const [id] = selectedIds;
    const ann = (topology.annotations ?? []).find((a) => a.id === id);
    return ann && isNote(ann) ? ann : null;
  }, [selectedIds, topology.annotations]);

  const selectedInk = useMemo<import('./sim/sketch').Ink | null>(() => {
    if (selectedIds.size !== 1) return null;
    const [id] = selectedIds;
    const ann = (topology.annotations ?? []).find((a) => a.id === id);
    return ann && isInk(ann) ? ann : null;
  }, [selectedIds, topology.annotations]);

  const selectedEdge = useMemo<SimEdge | null>(() => {
    if (selectedNodes.length > 0 || selectedIds.size !== 1) return null;
    const [id] = selectedIds;
    return topology.edges.find((e) => e.id === id) ?? null;
  }, [selectedNodes.length, selectedIds, topology.edges]);

  const edgeSourceNode = useMemo<SimNode | null>(() => {
    if (!selectedEdge) return null;
    return topology.nodes.find((n) => n.id === selectedEdge.from) ?? null;
  }, [selectedEdge, topology.nodes]);

  const edgeTargetNode = useMemo<SimNode | null>(() => {
    if (!selectedEdge) return null;
    return topology.nodes.find((n) => n.id === selectedEdge.to) ?? null;
  }, [selectedEdge, topology.nodes]);

  /**
   * "Something the INSPECTOR can talk about is selected."
   * Nodes, edges, Requirements Cards (TextBoxes), Notes and ink strokes are
   * configurable.
   */
  const hasSelection =
    selectedNodes.length + selectedEdgeCount > 0 ||
    selectedEdge !== null ||
    selectedTextBox !== null ||
    selectedNote !== null ||
    selectedInk !== null;
  const inspectorVisible = !inspectorHidden;

  /**
   * The uncovered-canvas sentinel (see .stage-safe in App.css): an inert div
   * the shell keeps inset to the part of the canvas no floating panel
   * covers. The canvas measures it when aiming the camera (fit, palette
   * placement, paste, keyboard zoom), so content is always framed into the
   * visible area; it never triggers a camera move by changing.
   */
  const stageSafeRef = useRef<HTMLDivElement | null>(null);

  const openGlossary = useCallback((id?: string) => {
    setGlossaryFocusId(id);
    setGlossaryOpen(true);
  }, []);

  const closeGlossary = useCallback(() => {
    setGlossaryOpen(false);
    setGlossaryFocusId(undefined);
  }, []);

  /**
   * Where a tooltip's "see also" links go.
   *
   * Registered once with the tooltip module rather than threaded down as a
   * prop, which is what lets <Term> stay a props-free wrapper at every one of
   * its call sites. Unregistered on unmount so a stale closure can never
   * outlive this shell.
   */
  useEffect(() => {
    setGlossaryNavigate(openGlossary);
    return () => setGlossaryNavigate(null);
  }, [openGlossary]);

  /**
   * The engine is a mutable simulation owned outside React's render cycle.
   * Held in state with a lazy initializer rather than a ref written during
   * render: the instance must exist for the very first render (so a snapshot
   * is available immediately), and this keeps the render phase pure. The
   * value is never replaced, so it behaves as a stable instance —
   * StrictMode's double render reuses the same engine.
   */
  const [engine] = useState(() => new Engine(initial.topology));

  /**
   * Seeded from the engine's initial state rather than set by an effect, so
   * the very first paint already shows the loaded system instead of an empty
   * canvas followed by a second render.
   */
  const [snapshot, setSnapshot] = useState<SimSnapshot | null>(() => engine.snapshot());

  /**
   * Live mirrors of the play/pause state. The rAF loop is started once and
   * reads these on each frame, so toggling pause never tears down and
   * rebuilds the loop (which would drop the accumulated frame timing).
   */
  const runningRef = useRef(running);
  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  /* ---------------- per-node sparkline history ----------------
   *
   * `SimSnapshot.history` is system-wide — `HistoryPoint` carries no node id —
   * so there is no per-node series in the engine to draw, and src/sim is not
   * ours to change. The ring buffer therefore lives here.
   *
   * Sampled when the engine's own clock crosses a 1000ms boundary rather than
   * on a wall-clock timer, so the trace stays correct while paused, while
   * single-stepping, and after a tab-away. 60 samples at 1Hz is the same 60s
   * window the charts below the canvas show.
   */
  const sparkRef = useRef(new Map<string, Float32Array>());
  const sparkTickRef = useRef(-1);
  const [spark, setSpark] = useState<ReadonlyMap<string, Float32Array>>(
    () => new Map(),
  );

  useEffect(() => {
    if (!snapshot) return;
    const tick = Math.floor(snapshot.system.timeMs / SPARK_INTERVAL_MS);
    if (tick === sparkTickRef.current) return;
    // A reset moves the clock backwards; drop the stale trace rather than
    // splicing new samples onto the tail of the previous run.
    const rewound = tick < sparkTickRef.current;
    sparkTickRef.current = tick;

    const prev = sparkRef.current;
    const next = new Map<string, Float32Array>();
    // Pull-based consumers headline the backlog of the buffers feeding them.
    const backlogs = sourceBacklogs(topology, snapshot.nodes);

    for (const n of topology.nodes) {
      const s = snapshot.nodes[n.id];
      const old = rewound ? undefined : prev.get(n.id);
      // NaN, not 0, marks "not yet sampled". A zero-filled buffer made a
      // young trace draw a long false flat line along the baseline and then
      // jump vertically to the first real sample, which read as a broken
      // axis rather than as data. Spark skips non-finite slots entirely.
      const buf = new Float32Array(SPARK_LEN).fill(Number.NaN);
      if (old) buf.set(old.subarray(1));
      buf[SPARK_LEN - 1] = s
        ? readoutFor(n.kind, s, n.config, backlogs.get(n.id) ?? 0).spark
        : 0;
      next.set(n.id, buf);
    }

    // Entries for removed nodes are dropped by virtue of rebuilding from the
    // current topology, so the map cannot leak across preset loads.
    sparkRef.current = next;
    setSpark(next);
  }, [snapshot, topology.nodes]);

  /* ---------------- the simulation loop ---------------- */

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let sinceSnapshot = 0;
    let cancelled = false;

    const frame = (now: number) => {
      if (cancelled) return;
      raf = requestAnimationFrame(frame);

      const dt = now - last;
      last = now;

      if (!runningRef.current) return;

      // Clamp so a long tab-away does not replay minutes of simulated time.
      engine.advance(Math.min(dt, MAX_FRAME_MS));

      // React re-renders at ~10Hz, not once per frame. The engine keeps
      // full temporal resolution regardless.
      sinceSnapshot += dt;
      if (sinceSnapshot >= SNAPSHOT_INTERVAL_MS) {
        sinceSnapshot = 0;
        setSnapshot(engine.snapshot());
      }
    };

    raf = requestAnimationFrame(frame);

    return () => {
      // StrictMode double-invokes this effect in development. `cancelled`
      // guarantees the frame scheduled by the discarded run cannot queue a
      // successor after its cleanup, so only one loop is ever live.
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [engine]);

  /* ---------------- persistence ---------------- */

  useEffect(() => {
    // A share link is still being decoded, or has just been opened and not
    // yet edited. Writing here would overwrite the recipient's own saved
    // design with someone else's before they had touched anything.
    if (sharePending) return;
    // Debounced: dragging a node or a slider must not write on every frame.
    // Between a change and the write, the work genuinely is not saved yet,
    // and the indicator says so rather than reassuring early.
    setSaveState('saving');
    const id = window.setTimeout(() => {
      saveSession({ topology, rps, presetId });
      setSaveState('saved');
    }, 400);
    return () => window.clearTimeout(id);
  }, [topology, rps, presetId, sharePending]);

  /* ---------------- undo / redo ---------------- */

  /**
   * History of full `{ topology, selectedIds, rps, presetId }` snapshots.
   * The stacks live in SessionHistory (a plain object, unit-tested on its
   * own); this state cell exists only to re-render when they change, and
   * canUndo/canRedo below are DERIVED from the stacks on every render, never
   * cached, so the buttons can never disagree with the stack contents.
   */
  const [, setHistVersion] = useState(0);
  const [history] = useState(
    () =>
      new SessionHistory({
        onChange: () => {
          setHistVersion((v) => v + 1);
          // An entry landing is the definition of "the reader changed
          // something", so it is also the moment a design opened from a
          // share link stops being someone else's and starts being theirs.
          // Saving resumes from here; see sharePending.
          setSharePending((p) => (p ? false : p));
        },
      }),
  );
  const canUndo = history.canUndo;
  const canRedo = history.canRedo;

  /**
   * The state a history entry captures, as of the LAST COMMITTED RENDER.
   * Written in an effect, so inside an event handler this is still the
   * pre-edit state: exactly what a baseline snapshot wants.
   */
  const snapRef = useRef<HistorySnapshot>({
    topology: initial.topology,
    selectedIds: new Set<string>(),
    rps: initial.rps,
    presetId: initial.presetId,
  });
  // Layout effect, not a passive one: the mirror must be current before the
  // NEXT event handler runs (a pointerup reading the final drag position),
  // and passive effects offer no such ordering guarantee.
  useLayoutEffect(() => {
    snapRef.current = { topology, selectedIds, rps, presetId };
  }, [topology, selectedIds, rps, presetId]);

  /**
   * The topology as of the LAST EVENT HANDLER, not the last committed render.
   *
   * snapRef above is refreshed by a layout effect, which only helps if React
   * renders between two handlers. Pointer moves are continuous-priority
   * events: React schedules their re-render through the scheduler, so a fast
   * flick can deliver pointerup BEFORE the render for the final pointermove
   * has committed. endGesture would then compare the drag's baseline against
   * a pre-drag snapshot, conclude the gesture went nowhere, and drop the
   * entry — a fast node drag became invisible to undo and left a stale redo
   * stack behind. Verified with a real three-event drag in a background tab.
   *
   * Every handler that writes the topology writes this ref in the same
   * synchronous breath, so a gesture's end always sees the state its own
   * moves produced, whether or not React has caught up.
   */
  const topoLiveRef = useRef<Topology>(initial.topology);
  useLayoutEffect(() => {
    topoLiveRef.current = topology;
  }, [topology]);

  /**
   * Toast naming what was undone or redone. On a large canvas the reverted
   * change can be off screen (a preset load, a node deleted at the far
   * edge), and without the toast an off-screen undo is indistinguishable
   * from a dead keypress; a two-second label is the cheapest possible proof
   * that something happened. `id` keys the element so consecutive undos
   * restart the entrance animation instead of freezing on one message.
   */
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const toastSeq = useRef(0);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const applyEntry = useCallback(
    (entry: HistoryEntry, verb: 'Undid' | 'Redid') => {
      // The engine first, via the same non-resetting paths a forward edit
      // uses: updateNodeConfig for a config-only difference, setTopology for
      // structure. Nothing here resets the simulation or its metrics.
      syncEngine(engine, snapRef.current.topology, entry.topology);
      setTopology(entry.topology);
      setSelectedIds(new Set(entry.selectedIds));
      setRps(entry.rps);
      setPresetId(entry.presetId);
      toastSeq.current += 1;
      setToast({ text: `${verb} ${entry.label}`, id: toastSeq.current });
    },
    [engine],
  );

  const handleUndo = useCallback(() => {
    const entry = history.undo(snapRef.current);
    if (entry) applyEntry(entry, 'Undid');
  }, [history, applyEntry]);

  const handleRedo = useCallback(() => {
    const entry = history.redo(snapRef.current);
    if (entry) applyEntry(entry, 'Redid');
  }, [history, applyEntry]);

  /* ---------------- structural edits ---------------- */

  /**
   * Structural changes (add/remove nodes or edges, moves) must be pushed
   * into the engine wholesale. The engine preserves per-node state for ids
   * it already knows, so editing the graph does not disturb in-flight work.
   */
  const applyTopology = useCallback(
    (next: Topology) => {
      topoLiveRef.current = next;
      setTopology(next);
      engine.setTopology(next);
      // Refresh the snapshot immediately so a topology edit made while PAUSED
      // shows the new node's readouts at once, instead of blank rows sitting
      // next to headline numbers from the previous run until the next tick.
      setSnapshot(engine.snapshot());
      setPresetId(null);
    },
    [engine],
  );

  const handleMoveNode = useCallback(
    (id: string, x: number, y: number) => {
      // Inside a pointer drag the history baseline was captured at promotion
      // (handleMoveStart below) and will commit at gesture end, so the
      // per-frame stream stays out of history entirely. A move arriving
      // OUTSIDE a gesture is an arrow-key nudge; key-repeat makes that a
      // stream too, so it takes the debounced path and one nudge burst
      // settles into one entry.
      if (!history.inGesture) history.touch('move', snapRef.current);
      // Position is presentation only — the engine does not care, so this
      // skips setTopology and avoids clearing the active preset badge.
      // Computed eagerly from the live mirror (and written back to it) so a
      // pointerup arriving before React commits still sees this move.
      const t = topoLiveRef.current;
      const next = {
        ...t,
        nodes: t.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
      };
      topoLiveRef.current = next;
      setTopology(next);
    },
    [history],
  );

  /** One drag is ONE history entry: baseline at promotion, commit at end.
   *  The canvas names the gesture ('move', 'resize') so the undo toast can
   *  say what it undid; unnamed callers stay a 'move'. */
  const handleMoveStart = useCallback(
    (label?: string) => {
      history.beginGesture(label ?? 'move', snapRef.current);
    },
    [history],
  );

  const handleMoveEnd = useCallback(() => {
    // The topology from the live mirror, never from snapRef alone: a flick's
    // pointerup can outrun the render for its last pointermove, and endGesture
    // fed the stale mirror would drop the entry as a no-op (see topoLiveRef).
    history.endGesture({ ...snapRef.current, topology: topoLiveRef.current });
  }, [history]);

  /* ---------------- annotations: notes and sections ----------------
   *
   * PRESENTATION ONLY. Every writer here goes through setAnnotations, which
   * updates React state and the live mirror and NOTHING else: the engine is
   * never told (it has no field to be told in), the snapshot is not
   * refreshed, and the active preset badge survives, exactly as it does for
   * a node move. History granularity matches nodes 1:1 — one drag or resize
   * is one entry at the gesture boundary, a creation or text edit is one
   * discrete commit.
   */

  const setAnnotations = useCallback((next: Annotation[]) => {
    const t = topoLiveRef.current;
    const nt: Topology = { ...t, annotations: next };
    topoLiveRef.current = nt;
    setTopology(nt);
  }, []);

  /** `kind-N` ids of the same shape freshId in clipboard.ts mints, scanned
   *  against the live list because a restored session's ids predate this
   *  tab's counters. */
  const freshAnnId = useCallback((prefix: 'note' | 'section' | 'textbox' | 'ink'): string => {
    const used = new Set((topoLiveRef.current.annotations ?? []).map((a) => a.id));
    let n = 1;
    while (used.has(`${prefix}-${n}`)) n += 1;
    return `${prefix}-${n}`;
  }, []);

  const handleMoveAnnotation = useCallback(
    (id: string, x: number, y: number) => {
      // Same shape as handleMoveNode: inside a pointer drag the baseline
      // was captured at promotion; a move arriving outside a gesture is a
      // future streamed path and takes the debounced entry.
      if (!history.inGesture) history.touch('move', snapRef.current);
      setAnnotations(
        (topoLiveRef.current.annotations ?? []).map((a) =>
          a.id === id ? { ...a, x, y } : a,
        ),
      );
    },
    [history, setAnnotations],
  );

  const handleResizeNote = useCallback(
    (id: string, x: number, width: number) => {
      if (!history.inGesture) history.touch('resize', snapRef.current);
      setAnnotations(
        (topoLiveRef.current.annotations ?? []).map((a) =>
          a.id === id && isNote(a)
            ? {
                ...a,
                x,
                // Clamped here as well as in the canvas, because this is the
                // boundary the model is written through: a width that only
                // the gesture bounded could still arrive out of range from a
                // future caller.
                width: Math.min(Math.max(width, NOTE_MIN_WIDTH), NOTE_MAX_WIDTH),
              }
            : a,
        ),
      );
    },
    [history, setAnnotations],
  );

  const handleScaleNote = useCallback(
    (id: string, x: number, width: number, scale: number) => {
      if (!history.inGesture) history.touch('resize', snapRef.current);
      setAnnotations(
        (topoLiveRef.current.annotations ?? []).map((a) => {
          if (a.id !== id || !isNote(a)) return a;
          const next: Note = {
            ...a,
            x,
            width: Math.min(Math.max(width, NOTE_MIN_WIDTH), NOTE_MAX_WIDTH),
            scale: Math.min(Math.max(scale, NOTE_MIN_SCALE), NOTE_MAX_SCALE),
          };
          // Back at 1 is the absence of a scale, not a scale of one: storing
          // it would put a redundant field in every share link.
          if (next.scale === 1) delete next.scale;
          return next;
        }),
      );
    },
    [history, setAnnotations],
  );

  const handleResizeSection = useCallback(
    (id: string, x: number, y: number, w: number, h: number) => {
      if (!history.inGesture) history.touch('resize', snapRef.current);
      setAnnotations(
        (topoLiveRef.current.annotations ?? []).map((a) =>
          a.id === id && isSection(a)
            ? {
                ...a,
                x,
                y,
                width: Math.max(w, SECTION_MIN_WIDTH),
                height: Math.max(h, SECTION_MIN_HEIGHT),
              }
            : a,
        ),
      );
    },
    [history, setAnnotations],
  );

  const handleCreateNote = useCallback(
    (x: number, y: number): string => {
      const anns = topoLiveRef.current.annotations ?? [];
      const id = freshAnnId('note');
      history.commit('add note', snapRef.current);
      setAnnotations([
        ...anns,
        {
          id,
          kind: 'note',
          text: NEW_NOTE_TEXT,
          x,
          y,
          width: NOTE_DEFAULT_WIDTH,
          size: 'md',
        },
      ]);
      setSelectedIds(new Set([id]));
      return id;
    },
    [freshAnnId, history, setAnnotations],
  );

  const handleCreateSection = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const anns = topoLiveRef.current.annotations ?? [];
      const id = freshAnnId('section');
      history.commit('add section', snapRef.current);
      setAnnotations([
        ...anns,
        {
          id,
          kind: 'section',
          label: 'Section',
          x,
          y,
          width: Math.max(w, SECTION_MIN_WIDTH),
          height: Math.max(h, SECTION_MIN_HEIGHT),
          // Rotate through the palette so adjacent frames differ by default.
          tone: anns.filter(isSection).length % SECTION_TONE_COUNT,
        },
      ]);
      setSelectedIds(new Set([id]));
    },
    [freshAnnId, history, setAnnotations],
  );

  const handleCreateTextBox = useCallback(
    (
      x: number,
      y: number,
      title = NEW_TEXTBOX_TITLE,
      text = NEW_TEXTBOX_TEXT,
    ): string => {
      const anns = topoLiveRef.current.annotations ?? [];
      const id = freshAnnId('textbox');
      history.commit('add text box', snapRef.current);
      setAnnotations([
        ...anns,
        {
          id,
          kind: 'textbox',
          title,
          text,
          x,
          y,
          width: TEXTBOX_DEFAULT_WIDTH,
          height: TEXTBOX_DEFAULT_HEIGHT,
          size: 'md',
          tone: 1,
        },
      ]);
      setSelectedIds(new Set([id]));
      return id;
    },
    [freshAnnId, history, setAnnotations],
  );

  /**
   * Commit a finished stroke. The canvas already decimated the samples and
   * normalised them relative to (x, y), so this is a plain append plus the
   * history entry — one stroke, one undo.
   */
  const handleCreateInk = useCallback(
    (x: number, y: number, points: number[]) => {
      const anns = topoLiveRef.current.annotations ?? [];
      const id = freshAnnId('ink');
      history.commit('draw', snapRef.current);
      setAnnotations([
        ...anns,
        {
          id,
          kind: 'ink',
          x,
          y,
          points: points.slice(0, INK_MAX_POINTS * 2),
          tone: penSettings.tone,
          width: penSettings.width,
          opacity: penSettings.opacity,
        },
      ]);
    },
    [freshAnnId, history, setAnnotations, penSettings],
  );

  /** Discrete tone change from the inspector's swatch row: one commit. */
  const handleSetInkTone = useCallback(
    (id: string, tone: InkTone) => {
      const anns = topoLiveRef.current.annotations ?? [];
      const cur = anns.find((a) => a.id === id);
      if (!cur || !isInk(cur) || cur.tone === tone) return;
      history.commit('change ink colour', snapRef.current);
      setAnnotations(anns.map((a) => (a.id === id && isInk(a) ? { ...a, tone } : a)));
    },
    [history, setAnnotations],
  );

  /**
   * Streaming width/opacity from the inspector's sliders: touch, never
   * commit-per-frame, so a slider drag is one history entry on settle.
   */
  const handleInkStyle = useCallback(
    (id: string, patch: { width?: number; opacity?: number }) => {
      const anns = topoLiveRef.current.annotations ?? [];
      const cur = anns.find((a) => a.id === id);
      if (!cur || !isInk(cur)) return;
      const width = patch.width !== undefined
        ? Math.min(INK_MAX_WIDTH, Math.max(INK_MIN_WIDTH, patch.width))
        : cur.width;
      const opacity = patch.opacity !== undefined
        ? Math.min(1, Math.max(INK_MIN_OPACITY, patch.opacity))
        : cur.opacity;
      if (width === cur.width && opacity === cur.opacity) return;
      if (!history.inGesture) history.touch('ink style', snapRef.current);
      setAnnotations(
        anns.map((a) => (a.id === id && isInk(a) ? { ...a, width, opacity } : a)),
      );
    },
    [history, setAnnotations],
  );

  const handleResizeTextBox = useCallback(
    (id: string, x: number, y: number, w: number, h: number) => {
      if (!history.inGesture) history.touch('resize', snapRef.current);
      setAnnotations(
        (topoLiveRef.current.annotations ?? []).map((a) =>
          a.id === id && isTextBox(a)
            ? {
                ...a,
                x,
                y,
                width: Math.max(w, TEXTBOX_MIN_WIDTH),
                height: Math.max(h, TEXTBOX_MIN_HEIGHT),
              }
            : a,
        ),
      );
    },
    [history, setAnnotations],
  );

  const handleEditTextBox = useCallback(
    (id: string, text: string, title?: string) => {
      const anns = topoLiveRef.current.annotations ?? [];
      const cur = anns.find((a) => a.id === id);
      if (!cur || cur.kind !== 'textbox') return;
      const nextText = text.slice(0, 5000);
      const nextTitle = title !== undefined ? title.slice(0, 200) : cur.title;
      if (!nextText.trim() && !nextTitle?.trim() && cur.cardStyle !== 'outline') {
        // An emptied or unedited blank text box is removed outright: invisible and unselectable,
        // it would otherwise be litter the user cannot find to delete. Outline boxes have a visible border
        // so they can remain as clean empty bounding frames.
        history.commit('delete text box', snapRef.current);
        setAnnotations(anns.filter((a) => a.id !== id));
        setSelectedIds((sel) => {
          if (!sel.has(id)) return sel;
          const out = new Set(sel);
          out.delete(id);
          return out;
        });
        return;
      }
      if (nextText === cur.text && nextTitle === cur.title) return;
      history.commit('edit text box', snapRef.current);
      setAnnotations(
        anns.map((a) =>
          a.id === id ? { ...a, text: nextText, title: nextTitle } : a,
        ),
      );
    },
    [history, setAnnotations],
  );

  const handleSetTextBoxStyle = useCallback(
    (
      id: string,
      change: {
        cardStyle?: TextBoxStyle;
        font?: AnnotationFont;
        size?: TextBox['size'];
        bold?: 'toggle';
        italic?: 'toggle';
      },
    ) => {
      const anns = topoLiveRef.current.annotations ?? [];
      const cur = anns.find((a) => a.id === id);
      if (!cur || cur.kind !== 'textbox') return;

      const next: TextBox = { ...cur };
      if (change.cardStyle) next.cardStyle = change.cardStyle;
      if (change.font) next.font = change.font;
      if (change.size) next.size = change.size;
      for (const flag of ['bold', 'italic'] as const) {
        if (change[flag] !== 'toggle') continue;
        if (cur[flag]) delete next[flag];
        else next[flag] = true;
      }
      history.commit('box style', snapRef.current);
      setAnnotations(anns.map((a) => (a.id === id ? next : a)));
    },
    [history, setAnnotations],
  );

  const handleApplyTextBoxTemplate = useCallback(
    (id: string, template: InterviewTemplate) => {
      const anns = topoLiveRef.current.annotations ?? [];
      const cur = anns.find((a) => a.id === id);
      if (!cur || cur.kind !== 'textbox') return;
      history.commit('apply template', snapRef.current);
      setAnnotations(
        anns.map((a) =>
          a.id === id && a.kind === 'textbox'
            ? {
                ...a,
                title: template.title,
                text: template.text,
                tone: template.tone,
              }
            : a,
        ),
      );
    },
    [history, setAnnotations],
  );

  const handleDeleteTextBox = useCallback(
    (id: string) => {
      const anns = topoLiveRef.current.annotations ?? [];
      history.commit('delete text box', snapRef.current);
      setAnnotations(anns.filter((a) => a.id !== id));
      setSelectedIds((sel) => {
        if (!sel.has(id)) return sel;
        const out = new Set(sel);
        out.delete(id);
        return out;
      });
    },
    [history, setAnnotations],
  );

  const handleEditNote = useCallback(
    (id: string, text: string) => {
      const anns = topoLiveRef.current.annotations ?? [];
      const cur = anns.find((a) => a.id === id);
      if (!cur || cur.kind !== 'note') return;
      const next = text.slice(0, 2000);
      if (!next.trim()) {
        // An emptied note is removed outright: invisible and unselectable,
        // it would otherwise be litter the reader cannot find to delete.
        history.commit('delete', snapRef.current);
        setAnnotations(anns.filter((a) => a.id !== id));
        setSelectedIds((sel) => {
          if (!sel.has(id)) return sel;
          const out = new Set(sel);
          out.delete(id);
          return out;
        });
        return;
      }
      if (next === cur.text) return;
      history.commit('note edit', snapRef.current);
      setAnnotations(anns.map((a) => (a.id === id ? { ...a, text: next } : a)));
    },
    [history, setAnnotations],
  );

  const handleEditSectionLabel = useCallback(
    (id: string, label: string) => {
      const anns = topoLiveRef.current.annotations ?? [];
      const cur = anns.find((a) => a.id === id);
      if (!cur || cur.kind !== 'section') return;
      const next = label.slice(0, 200);
      if (next === cur.label) return;
      history.commit('label edit', snapRef.current);
      setAnnotations(anns.map((a) => (a.id === id ? { ...a, label: next } : a)));
    },
    [history, setAnnotations],
  );

  const handleSetNoteSize = useCallback(
    (id: string, size: Note['size']) => {
      const anns = topoLiveRef.current.annotations ?? [];
      const cur = anns.find((a) => a.id === id);
      if (!cur || cur.kind !== 'note' || cur.size === size) return;
      history.commit('note size', snapRef.current);
      setAnnotations(anns.map((a) => (a.id === id ? { ...a, size } : a)));
    },
    [history, setAnnotations],
  );

  const handleSetNoteStyle = useCallback(
    (
      id: string,
      change: {
        font?: AnnotationFont;
        tone?: number | null;
        bold?: 'toggle';
        italic?: 'toggle';
        underline?: 'toggle';
      },
    ) => {
      const anns = topoLiveRef.current.annotations ?? [];
      const cur = anns.find((a) => a.id === id);
      if (!cur || cur.kind !== 'note') return;

      const next: Note = { ...cur };
      if (change.font) next.font = change.font;
      // Absent rather than false when off, so a note that was never styled
      // stores nothing and a share link stays as short as it can be.
      for (const flag of ['bold', 'italic', 'underline'] as const) {
        if (change[flag] !== 'toggle') continue;
        if (cur[flag]) delete next[flag];
        else next[flag] = true;
      }
      if (change.tone !== undefined) {
        if (change.tone === null) delete next.tone;
        else
          next.tone =
            ((Math.floor(change.tone) % SECTION_TONE_COUNT) + SECTION_TONE_COUNT) %
            SECTION_TONE_COUNT;
      }
      history.commit('note style', snapRef.current);
      setAnnotations(anns.map((a) => (a.id === id ? next : a)));
    },
    [history, setAnnotations],
  );

  const handleSetSectionTone = useCallback(
    (id: string, tone: number) => {
      const anns = topoLiveRef.current.annotations ?? [];
      const cur = anns.find((a) => a.id === id);
      if (!cur || (cur.kind !== 'section' && cur.kind !== 'textbox') || cur.tone === tone) return;
      // Wrapped rather than clamped, matching sanitizeAnnotations, so a shade
      // index can never land outside the palette and render an unstyled frame.
      const next =
        ((Math.floor(tone) % SECTION_TONE_COUNT) + SECTION_TONE_COUNT) %
        SECTION_TONE_COUNT;
      history.commit('shade', snapRef.current);
      setAnnotations(anns.map((a) => (a.id === id && a.kind === 'section' ? { ...a, tone: next } : a)));
    },
    [history, setAnnotations],
  );

  /** Palette click (no drop point): place at the centre of the current
   *  view, the same aim handlePaletteAdd uses for components. */
  const handlePaletteAnnotation = useCallback(
    (tool: AnnotationTool) => {
      // Arm the tool; do not place a shape. A section dropped at the view
      // centre lands on whatever is already there, and a node that ends up
      // inside its bounds is silently carried along the next time the frame
      // is dragged. Arming lets the student draw the frame around what they
      // meant, which is the only way the canvas can know what they meant.
      if (armToolRef.current) {
        armToolRef.current(tool);
        return;
      }
      // No canvas mounted to arm (the rail can outlive it during a layout
      // change). Falling back to placing one is better than the click doing
      // nothing at all — except for the pen and the eraser, which place
      // nothing: there is no canvas to draw on, so the click arms nothing
      // and says nothing.
      if (tool === 'ink' || tool === 'eraser') return;
      const centre = viewCenterRef.current?.() ?? { x: 240, y: 200 };
      const gx = (v: number) => Math.round(v / GRID) * GRID;
      if (tool === 'note') {
        handleCreateNote(gx(centre.x - NOTE_DEFAULT_WIDTH / 2), gx(centre.y));
      } else if (tool === 'textbox') {
        handleCreateTextBox(gx(centre.x - TEXTBOX_DEFAULT_WIDTH / 2), gx(centre.y));
      } else {
        handleCreateSection(gx(centre.x - 160), gx(centre.y - 112), 320, 224);
      }
    },
    [handleCreateNote, handleCreateSection, handleCreateTextBox],
  );

  const handleAddNode = useCallback(
    (kind: NodeKind, x: number, y: number) => {
      const node = makeNode(kind, x, y);
      history.commit('add', snapRef.current);
      applyTopology({
        ...topology,
        nodes: [...topology.nodes, node],
      });
      setSelectedIds(new Set([node.id]));
    },
    [applyTopology, topology, history],
  );

  /**
   * Filled by the canvas with a "world point at the centre of the current
   * view" getter. A palette CLICK has no drop point of its own; the old
   * placement (max x + 220) marched monotonically rightward, so after a few
   * clicks each new node — entrance animation and all — landed entirely
   * outside the viewport and the click looked like a no-op. Measured: two
   * palette clicks on the company preset created nodes at screen y ≈ -257.
   */
  const viewCenterRef = useRef<(() => { x: number; y: number }) | null>(null);
  const armToolRef = useRef<((tool: AnnotationTool) => void) | null>(null);
  const exportSvgRef = useRef<(() => string | null) | null>(null);
  const [armedTool, setArmedTool] = useState<AnnotationTool | null>(null);

  /**
   * Node id to display name, for the request trace.
   *
   * Keyed off the node list rather than the snapshot, because the strip
   * re-renders ten times a second and these names change only when someone
   * renames or deletes a component.
   */
  const nodeNames = useMemo(() => {
    const out: Record<string, string> = {};
    for (const n of topology.nodes) out[n.id] = n.label;
    return out;
  }, [topology.nodes]);

  /** Palette click (no drop point): place at the centre of the current view. */
  const handlePaletteAdd = useCallback(
    (kind: NodeKind) => {
      const centre = viewCenterRef.current?.();
      if (!centre) {
        // No canvas yet (should not happen in practice): old fallback.
        const maxX = topology.nodes.reduce((m, n) => Math.max(m, n.x), 0);
        handleAddNode(kind, maxX + 220, 200);
        return;
      }
      // Centre the node on the view, snapped to the grid. A small ring of
      // nearby offsets dodges an exact pile-up from repeated clicks, but the
      // search never leaves the neighbourhood: on a dense diagram the node
      // simply lands at the centre and overlaps, which the student can see
      // and fix — a node placed "helpfully" outside the viewport cannot be.
      const cx = Math.round((centre.x - NODE_W / 2) / GRID) * GRID;
      const cy = Math.round((centre.y - NODE_H / 2) / GRID) * GRID;
      const occupied = (px: number, py: number) =>
        topology.nodes.some(
          (n) => Math.abs(n.x - px) < NODE_W && Math.abs(n.y - py) < NODE_H,
        );
      const STEP = GRID * 4;
      const ring: [number, number][] = [
        [0, 0],
        [STEP, STEP],
        [-STEP, STEP],
        [STEP, -STEP],
        [-STEP, -STEP],
        [2 * STEP, 0],
        [0, 2 * STEP],
        [-2 * STEP, 0],
        [0, -2 * STEP],
      ];
      const spot = ring.find(([dx, dy]) => !occupied(cx + dx, cy + dy)) ?? [0, 0];
      handleAddNode(kind, cx + spot[0], cy + spot[1]);
    },
    [handleAddNode, topology.nodes],
  );

  const handleConnect = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return;
      const id = `${fromId}->${toId}`;
      if (topology.edges.some((e) => e.id === id)) return;
      history.commit('connection', snapRef.current);
      applyTopology({
        ...topology,
        edges: [...topology.edges, { id, from: fromId, to: toId, weight: 1 }],
      });
    },
    [applyTopology, topology, history],
  );

  const handleUpdateEdge = useCallback(
    (edgeId: string, patch: Partial<SimEdge>) => {
      history.commit('edge-config', snapRef.current);
      applyTopology({
        ...topology,
        edges: topology.edges.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)),
      });
    },
    [applyTopology, topology, history],
  );

  /**
   * Delete a whole selection in ONE topology edit.
   *
   * Deleting N items with N sequential single-item calls is a bug waiting to
   * happen: each call closes over the topology as it was at render time, so
   * the second delete would resurrect what the first removed. Partitioning
   * up front and filtering once is both correct and cheaper.
   */
  const handleDeleteSelection = useCallback(
    (
      nodeIds: readonly string[],
      edgeIds: readonly string[],
      annotationIds: readonly string[] = [],
    ) => {
      if (nodeIds.length === 0 && edgeIds.length === 0 && annotationIds.length === 0) {
        return;
      }
      const dropNodes = new Set(nodeIds);
      const dropEdges = new Set(edgeIds);
      const dropAnns = new Set(annotationIds);
      // ONE entry for the whole selection, orphaned edges included: the
      // filter below is a single topology edit, so its baseline is too.
      history.commit('delete', snapRef.current);

      // An annotation-only delete stays a presentation edit: the engine is
      // not disturbed and the preset badge survives, matching every other
      // annotation path. Anything structural goes through applyTopology.
      if (nodeIds.length === 0 && edgeIds.length === 0) {
        setAnnotations((topology.annotations ?? []).filter((a) => !dropAnns.has(a.id)));
      } else {
        applyTopology({
          ...topology,
          nodes: topology.nodes.filter((n) => !dropNodes.has(n.id)),
          edges: topology.edges.filter(
            (e) =>
              // Explicitly deleted, or orphaned by a node that just went away.
              !dropEdges.has(e.id) && !dropNodes.has(e.from) && !dropNodes.has(e.to),
          ),
          ...(topology.annotations
            ? {
                annotations: topology.annotations.filter((a) => !dropAnns.has(a.id)),
              }
            : {}),
        });
      }
      setSelectedIds((cur) => {
        if (cur.size === 0) return cur;
        const next = new Set(cur);
        for (const id of dropNodes) next.delete(id);
        for (const id of dropEdges) next.delete(id);
        for (const id of dropAnns) next.delete(id);
        return next;
      });
    },
    [applyTopology, setAnnotations, topology, history],
  );

  /** The Inspector's single-node delete routes through the same path. */
  const handleDeleteNode = useCallback(
    (id: string) => handleDeleteSelection([id], []),
    [handleDeleteSelection],
  );

  /**
   * Delete every node in a multi-selection. Routes through the same single
   * topology edit as everything else, so orphaned edges go with it.
   */
  const handleDeleteMany = useCallback(
    (ids: readonly string[]) => handleDeleteSelection(ids, []),
    [handleDeleteSelection],
  );

  /* ---------------- duplicate & paste ---------------- */

  /**
   * Append a cloned subgraph in ONE topology edit and make the clones the
   * new selection (nodes and internal edges both), which is what lets a
   * repeated Ctrl+D walk copies across the canvas. Shared by Ctrl+D,
   * alt-drag and paste so the three cannot disagree about what a copy is.
   */
  const appendClones = useCallback(
    (clones: ClipboardSubgraph) => {
      applyTopology({
        ...topology,
        nodes: [...topology.nodes, ...clones.nodes],
        edges: [...topology.edges, ...clones.edges],
      });
      const next = new Set<string>();
      for (const n of clones.nodes) next.add(n.id);
      for (const e of clones.edges) next.add(e.id);
      setSelectedIds(next);
    },
    [applyTopology, topology],
  );

  /**
   * Ctrl+D: duplicate the selection two grid steps down-right. The offset is
   * small enough that the copy reads as "yours, here" and large enough that
   * it never lands exactly on its source and looks like nothing happened.
   */
  const handleDuplicate = useCallback(() => {
    const sub = selectionSubgraph(topology, selectedIds);
    if (!sub) return;
    // ONE entry for the whole duplicate, selection included.
    history.commit('duplicate', snapRef.current);
    appendClones(cloneSubgraph(sub, topology, GRID * 2, GRID * 2));
  }, [topology, selectedIds, history, appendClones]);

  /**
   * Alt+drag: the same duplication as Ctrl+D, but born under the pointer as
   * a drag. Called by the canvas once at drag promotion; clones are placed
   * exactly on their sources (offset 0) because the drag itself supplies the
   * displacement, and the return value tells the canvas which clones the
   * gesture now carries. History: this opens a gesture the canvas's
   * onMoveEnd closes, so the entire duplicate-and-drag is one undo step
   * whose baseline predates the clones.
   */
  const handleDuplicateForDrag = useCallback(
    (primaryId: string) => {
      if (!topology.nodes.some((n) => n.id === primaryId)) return null;
      // Same scope rule as a plain drag: grabbing a member of a
      // multi-selection copies the whole selection, anything else copies
      // just the grabbed node.
      const scope: ReadonlySet<string> =
        selectedIds.has(primaryId) && selectedIds.size > 1
          ? selectedIds
          : new Set([primaryId]);
      const sub = selectionSubgraph(topology, scope);
      if (!sub) return null;
      const clones = cloneSubgraph(sub, topology, 0, 0);
      // cloneSubgraph preserves order, so source i maps to clone i.
      let primary: string | null = null;
      const group: { id: string; x: number; y: number }[] = [];
      for (let i = 0; i < sub.nodes.length; i++) {
        const clone = clones.nodes[i]!;
        if (sub.nodes[i]!.id === primaryId) primary = clone.id;
        else group.push({ id: clone.id, x: clone.x, y: clone.y });
      }
      if (!primary) return null;
      history.beginGesture('duplicate', snapRef.current);
      appendClones(clones);
      return { id: primary, group };
    },
    [topology, selectedIds, history, appendClones],
  );

  /**
   * Ctrl+V: a validated subgraph off the system clipboard, aimed at the
   * pointer. The payload's ids are whatever the copy carried (possibly from
   * another tab) and are never trusted: cloneSubgraph mints fresh ones
   * against the live topology. The bounding-box centre lands on the pointer,
   * moved by a grid-snapped delta so the subgraph's internal offsets survive
   * exactly and grid-aligned content stays aligned.
   */
  const handlePaste = useCallback(
    (sub: ClipboardSubgraph, at: { x: number; y: number }) => {
      if (sub.nodes.length === 0) return;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const n of sub.nodes) {
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x + NODE_W > maxX) maxX = n.x + NODE_W;
        if (n.y + NODE_H > maxY) maxY = n.y + NODE_H;
      }
      const dx = Math.round((at.x - (minX + maxX) / 2) / GRID) * GRID;
      const dy = Math.round((at.y - (minY + maxY) / 2) / GRID) * GRID;
      history.commit('paste', snapRef.current);
      appendClones(cloneSubgraph(sub, topology, dx, dy));
    },
    [topology, history, appendClones],
  );

  /* ---------------- live config edits ---------------- */

  /**
   * Knob changes are applied to the running engine in place. No reset: the
   * whole point is watching the system respond to a change under load.
   */
  const handleConfigChange = useCallback(
    (id: string, patch: Partial<NodeConfig>) => {
      // A slider fires this every frame, so the history side is debounced:
      // the first frame captures the pre-edit baseline, and the entry lands
      // once the value settles. One knob gesture, one undo step.
      history.touch('setting change', snapRef.current);
      engine.updateNodeConfig(id, patch);
      setTopology((t) => ({
        ...t,
        nodes: t.nodes.map((n) =>
          n.id === id ? { ...n, config: { ...n.config, ...patch } } : n,
        ),
      }));
      // No slider sync needed: the header's offered load is DERIVED from the
      // topology's client nodes, so a per-node rps knob updates it for free.
    },
    [engine, history],
  );

  /**
   * Apply ONE patch to MANY nodes. Deliberately not a loop over
   * handleConfigChange: each call would close over the topology as it was at
   * render time, so the second write would resurrect the first node's old
   * config. The engine is told node-by-node (its API is per-node and applies
   * in place, so that part is safe to iterate), but React state is rebuilt in
   * a single pass over one `Set`.
   */
  const handleConfigChangeMany = useCallback(
    (ids: readonly string[], patch: Partial<NodeConfig>) => {
      if (ids.length === 0) return;
      history.touch('setting change', snapRef.current);
      const targets = new Set(ids);
      for (const id of targets) engine.updateNodeConfig(id, patch);
      setTopology((t) => ({
        ...t,
        nodes: t.nodes.map((n) =>
          targets.has(n.id) ? { ...n, config: { ...n.config, ...patch } } : n,
        ),
      }));
      // No slider sync needed: the header derives offered load from the
      // topology, so editing any client's rps here updates it for free.
    },
    [engine, history],
  );

  const handleRename = useCallback(
    (id: string, label: string) => {
      // Fired per keystroke; debounced the same way a slider is, so one
      // typed name settles into one entry.
      history.touch('rename', snapRef.current);
      setTopology((t) => ({
        ...t,
        nodes: t.nodes.map((n) => (n.id === id ? { ...n, label } : n)),
      }));
    },
    [history],
  );

  const handleDescriptionChange = useCallback(
    (id: string, description: string) => {
      history.touch('edit description', snapRef.current);
      setTopology((t) => ({
        ...t,
        nodes: t.nodes.map((n) => (n.id === id ? { ...n, description } : n)),
      }));
    },
    [history],
  );

  /**
   * The top-bar slider sets the TOTAL offered load. One client gets the value
   * outright; several are scaled proportionally so a preset's deliberate
   * traffic mix survives the drag, with the remainder placed on the first
   * client so the distributed parts always sum to exactly `next`.
   */
  const handleRpsChange = useCallback(
    (next: number) => {
      setRps(next);
      const sources = findTrafficSources(topology);
      if (sources.length === 0) return;
      if (sources.length === 1) {
        handleConfigChange(sources[0]!.id, { rps: next });
        return;
      }
      const total = sources.reduce((s, source) => s + source.config.rps, 0);
      const shares = sources.map((source) =>
        Math.max(
          0,
          Math.round(
            next * (total > 0 ? source.config.rps / total : 1 / sources.length),
          ),
        ),
      );
      const spread = shares.reduce((s, v) => s + v, 0);
      shares[0] = Math.max(0, shares[0]! + (next - spread));
      // One history baseline, one engine pass, one topology write.
      history.touch('setting change', snapRef.current);
      const byId = new Map(sources.map((source, i) => [source.id, shares[i]!]));
      for (const [id, rps] of byId) engine.updateNodeConfig(id, { rps });
      setTopology((t) => ({
        ...t,
        nodes: t.nodes.map((n) =>
          byId.has(n.id) ? { ...n, config: { ...n.config, rps: byId.get(n.id)! } } : n,
        ),
      }));
    },
    [handleConfigChange, topology, history, engine],
  );

  /* ---------------- presets & reset ---------------- */

  /**
   * State backing the lost-per-second derivation further down (see the
   * cumulativeLost memo). Declared here because reset and preset load must
   * zero it SYNCHRONOUSLY: leaving it to the effect meant the old run's
   * "Dropped 104k/s" sat on screen next to p99 0ms until the next effect
   * pass — indefinitely, while paused.
   */
  const lostPrevRef = useRef<number | null>(null);
  const lostPrevTimeRef = useRef(0);
  const [lostRps, setLostRps] = useState(0);

  const resetLostRate = useCallback(() => {
    lostPrevRef.current = null;
    lostPrevTimeRef.current = 0;
    setLostRps(0);
  }, []);

  /**
   * Bumped when the diagram is replaced wholesale, so the canvas re-frames
   * the new content. Node edits never bump it: the camera belongs to the
   * student, and add/delete/undo must not move it.
   */
  const [fitNonce, setFitNonce] = useState(0);

  /**
   * Replace the whole design, as one history entry.
   *
   * Loading an example and opening a file are the same act from the
   * student's side: the diagram they were looking at is gone and another
   * one is in its place. They share this so they can never drift into
   * disagreeing about what "replace" means, and in particular so an
   * imported design is undoable on exactly the terms an example load is.
   * The caller owns the copy it passes; this takes it as given.
   */
  const replaceDesign = useCallback(
    (fresh: Topology, nextPresetId: string | null, label: string) => {
      // ONE entry, captured before the load, so a student who replaces a
      // half-built system can undo back to what they had.
      history.commit(label, snapRef.current);
      setTopology(fresh);
      setRps(offeredRpsFor(fresh));
      setPresetId(nextPresetId);
      setSelectedIds(new Set<string>());
      topoLiveRef.current = fresh;
      engine.setTopology(fresh);
      engine.reset();
      resetLostRate();
      setSnapshot(engine.snapshot());
      setFitNonce((n) => n + 1);
    },
    [engine, history, resetLostRate],
  );

  /**
   * Open a saved design.
   *
   * Through replaceDesign, so it lands with the same single history entry a
   * preset load or a file import does: a student who opens the wrong one can
   * undo straight back to what they had.
   */
  const handleOpenSaved = useCallback(
    (id: string) => {
      const saved = getDesign(id);
      if (!saved) {
        toastSeq.current += 1;
        setToast({ text: 'That design is no longer saved.', id: toastSeq.current });
        return;
      }
      setArchitectureTitle(saved.name);
      replaceDesign(structuredClone(saved.topology), null, 'open design');
      toastSeq.current += 1;
      setToast({ text: `Opened ${saved.name}`, id: toastSeq.current });
    },
    [replaceDesign],
  );

  const handleSaveNamed = useCallback((name: string) => {
    const result = saveDesign(name, topoLiveRef.current);
    toastSeq.current += 1;
    if (!result.ok) {
      setToast({ text: result.error, id: toastSeq.current });
      return;
    }
    setArchitectureTitle(name);
    // The eviction is said out loud. A shelf that silently drops the
    // oldest thing on it is a shelf that loses work.
    setToast({
      text: result.evicted
        ? `Saved ${name}. Removed the oldest, ${result.evicted}.`
        : `Saved ${name}`,
      id: toastSeq.current,
    });
  }, []);

  /**
   * Pin an interview section onto the canvas as a textbox, centred on the
   * current view. Practice notes live beside the diagram they describe.
   */
  const handlePinSection = useCallback(
    (title: string, text: string) => {
      const centre = viewCenterRef.current?.() ?? { x: 240, y: 200 };
      const gx = (v: number) => Math.round(v / GRID) * GRID;
      handleCreateTextBox(gx(centre.x - TEXTBOX_DEFAULT_WIDTH / 2), gx(centre.y), title, text);
      toastSeq.current += 1;
      setToast({ text: 'Pinned section to canvas', id: toastSeq.current });
    },
    [handleCreateTextBox],
  );

  /**
   * One eraser sweep, however many strokes it caught. The generic delete
   * path already commits once, skips the engine for annotation-only
   * deletes, and prunes the selection, which is exactly the erase
   * contract, so there is no second implementation to drift.
   */
  const handleEraseInk = useCallback(
    (ids: readonly string[]) => {
      handleDeleteSelection([], [], [...ids]);
    },
    [handleDeleteSelection],
  );

  const handleLoadPreset = useCallback(
    (preset: Preset) => {
      // Deep copy: presets are module-level constants and must never be
      // mutated by editing the loaded system.
      setArchitectureTitle(preset.name);
      replaceDesign(structuredClone(preset.topology), preset.id, 'example load');
    },
    [replaceDesign],
  );

  /**
   * Load a practice-lab setup: the preset topology plus the lab traffic
   * scenario stamped onto every source, in one history entry. Stamping
   * before replaceDesign (rather than a pattern change after) keeps the
   * load undoable in a single step.
   */
  const handleLoadLab = useCallback(
    (preset: Preset, pattern: TrafficPattern) => {
      const fresh = structuredClone(preset.topology);
      for (const node of fresh.nodes) {
        if (node.kind === 'client' || node.kind === 'producer') {
          node.config.traffic = pattern;
        }
      }
      setArchitectureTitle(preset.name);
      replaceDesign(fresh, preset.id, 'lab setup load');
    },
    [replaceDesign],
  );

  const handleNewCanvas = useCallback(() => {
    const madeSomething = presetId === null && topology.nodes.length > 0;
    if (
      madeSomething &&
      !window.confirm(
        'Starting a new canvas replaces what is on the canvas. Your design is not saved anywhere else. Continue?',
      )
    ) {
      return;
    }
    setArchitectureTitle('System Architecture');
    replaceDesign({ nodes: [], edges: [], annotations: [] }, null, 'new canvas');
    toastSeq.current += 1;
    setToast({ text: 'Created a new empty canvas', id: toastSeq.current });
  }, [replaceDesign, presetId, topology.nodes.length]);

  const handleExportHldMarkdown = useCallback(() => {
    const title =
      architectureTitle.trim() ||
      (presetId ? (PRESETS.find((p) => p.id === presetId)?.name ?? 'System Architecture') : 'System Architecture');
    const md = exportToHldMarkdown(topology, {
      systemName: title,
      includeCostEstimate: costEstimator,
    });
    const stem = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    downloadBlob(
      new Blob([md], { type: 'text/markdown;charset=utf-8' }),
      `${stem || 'hld-architecture'}-rfc.md`,
    );
    toastSeq.current += 1;
    setToast({
      text: 'Exported Architecture Design RFC document (.md)',
      id: toastSeq.current,
    });
  }, [topology, architectureTitle, presetId, costEstimator]);

  /**
   * What the menu offers.
   *
   * Ordered by how often a student reaches for it: a new canvas or an example
   * is how most sessions start, the glossary is what they need mid-run, and
   * the shortcuts and settings are consulted rarely. Bindings are printed
   * here as well as in the shortcuts dialog, so a key can be learned from
   * the menu without opening a second thing to read about the first.
   */
  const menuItems = useMemo(
    () => [
      {
        label: 'New canvas',
        icon: 'M12 5v14M5 12h14',
        onSelect: handleNewCanvas,
      },
      {
        label: 'Studio guide',
        icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
        onSelect: () => setGuideOpen(true),
      },
      {
        label: 'Your designs',
        icon: 'M4 4a2 2 0 0 1 2-2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM13 2v5h5M9 13h6M9 17h6',
        onSelect: () => setDesignsOpen(true),
      },
      {
        label: 'Examples',
        icon: 'M3 4a1 1 0 0 1 1-1h6v7H3zM14 3h6a1 1 0 0 1 1 1v5h-7zM3 13h7v8H4a1 1 0 0 1-1-1zM14 13h7v7a1 1 0 0 1-1 1h-6z',
        onSelect: () => setExamplesOpen(true),
      },
      {
        label: 'Interview practice',
        icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h6',
        onSelect: () => setInterviewOpen(true),
      },
      {
        label: 'Glossary',
        icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
        ...(coarse ? {} : { hint: '?' }),
        onSelect: () => openGlossary(),
      },
      /* Dropped entirely on a touch device: a list of key bindings is not
         "less useful" without a keyboard, it is inapplicable, and a menu
         that offers it is describing an app the reader does not have. The
         binding printed beside the Glossary row goes for the same reason. */
      ...(coarse
        ? []
        : [
            {
              label: 'Keyboard shortcuts',
              icon: 'M2 5.5A2.5 2.5 0 0 1 4.5 3h15A2.5 2.5 0 0 1 22 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 18.5zM6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M9 13h6M7 17h10',
              hint: 'Ctrl+/',
              onSelect: () => setShortcutsOpen(true),
            },
          ]),
      ...(costEstimator
        ? [
            {
              label: 'Cost estimate',
              icon: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z',
              onSelect: () => setCostModalOpen(true),
            },
          ]
        : []),
      {
        label: 'Resilience advisor',
        icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10',
        onSelect: () => setAdvisorDrawerOpen(true),
      },
      {
        label: 'Export HLD RFC',
        icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
        onSelect: handleExportHldMarkdown,
      },
      {
        label: 'Settings',
        icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1 2.83-2.83l.06-.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
        onSelect: () => setSettingsOpen(true),
      },
    ],
    [handleNewCanvas, openGlossary, coarse, handleExportHldMarkdown, costEstimator],
  );

  /* ---------------- design files ----------------
   *
   * A share link moves a design between two browsers; a file moves it
   * between two people, and it is the only copy that outlives the browser
   * profile it was drawn in. Both directions live in designFile.ts; what
   * is here is the wiring, plus the one rule that matters on the way in:
   * a file that does not hold up says so and CHANGES NOTHING. A student
   * who opens the wrong file must still be looking at their own work.
   */

  const [importError, setImportError] = useState<string | null>(null);
  useEffect(() => {
    if (!importError) return;
    const t = window.setTimeout(() => setImportError(null), 5000);
    return () => window.clearTimeout(t);
  }, [importError]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Save the diagram as a picture.
   *
   * SVG is the honest default for a diagram (it stays sharp and its text is
   * still text), so PNG is offered beside it rather than instead of it: a
   * slide deck and a chat window both want a raster.
   */
  const handleExportImage = useCallback(
    async (format: 'svg' | 'png') => {
      const svg = exportSvgRef.current?.();
      if (!svg) {
        toastSeq.current += 1;
        setToast({
          text: 'There is nothing on the canvas to export yet.',
          id: toastSeq.current,
        });
        return;
      }
      const stem = presetId
        ? (PRESETS.find((p) => p.id === presetId)?.name ?? 'design')
        : 'design';
      const name = stem
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      try {
        if (format === 'svg') {
          downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${name}.svg`);
          return;
        }
        const m = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(svg);
        const w = m ? Number(m[1]) : 1200;
        const h = m ? Number(m[2]) : 800;
        downloadBlob(await svgToPng(svg, w, h), `${name}.png`);
      } catch {
        // A failed export must say so. Silence here reads as a broken button.
        toastSeq.current += 1;
        setToast({ text: 'That picture could not be saved.', id: toastSeq.current });
      }
    },
    [presetId],
  );

  const handleExport = useCallback(() => {
    const preset = PRESETS.find((p) => p.id === presetId);
    downloadDesign(topology, preset?.name ?? null);
  }, [topology, presetId]);

  const handleExportMermaid = useCallback(() => {
    const code = exportToMermaid(topology);
    void navigator.clipboard
      .writeText(code)
      .then(() => {
        toastSeq.current += 1;
        setToast({
          text: 'Copied Mermaid flowchart to clipboard',
          id: toastSeq.current,
        });
      })
      .catch(() => {
        toastSeq.current += 1;
        setToast({ text: 'Could not copy to clipboard.', id: toastSeq.current });
      });
  }, [topology]);

  const importDesign = useCallback(
    async (file: File) => {
      const result = await readDesignFile(file);
      if (!result.ok) {
        setImportError(result.error);
        return;
      }
      // The imported design is no longer any example, so the preset id is
      // cleared: leaving it set would have the Examples gallery claim a
      // file the student opened is the example it was edited from.
      if (result.name) setArchitectureTitle(result.name);
      replaceDesign(result.topology, null, 'file import');
      setImportError(null);
      toastSeq.current += 1;
      setToast({
        text: result.name ? `Opened ${result.name}` : 'Opened design',
        id: toastSeq.current,
      });
    },
    [replaceDesign],
  );

  const handleImportPick = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Cleared so choosing the same file twice in a row fires again; a
      // picker that silently does nothing the second time reads as broken.
      e.target.value = '';
      if (file) void importDesign(file);
    },
    [importDesign],
  );

  /**
   * A design dropped onto the canvas.
   *
   * On the wrapper rather than inside the canvas: the gesture router owns
   * `.cv-surface` and a file drop is not one of its gestures. The
   * dragover handler exists only to call preventDefault, without which
   * the browser navigates away from the app to render the JSON, losing
   * whatever was on the canvas.
   */
  const handleFileDragOver = useCallback((e: DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleFileDrop = useCallback(
    (e: DragEvent) => {
      const file = e.dataTransfer.files[0];
      if (!file) return;
      e.preventDefault();
      void importDesign(file);
    },
    [importDesign],
  );

  /* ---------------- share links ---------------- */

  /**
   * Open the design carried on the URL, INSTEAD of the stored session.
   *
   * Runs once. The decode is asynchronous, so the app has already painted
   * the stored session by the time this lands; swapping here rather than
   * blocking the first paint means a link with a mangled payload shows a
   * working app with a sentence explaining itself, never a blank screen.
   * The hash is left on the URL so the recipient can copy the link on to
   * someone else, and `sharePending` stays true until they edit something,
   * which is what keeps their own saved design intact.
   *
   * Anything that fails validation falls through to the ordinary startup
   * path with the toast saying so.
   */
  useEffect(() => {
    if (!sharePending) return;
    let cancelled = false;
    void decodeTopology(window.location.hash).then((result) => {
      if (cancelled) return;
      if (result.status === 'ok') {
        setTopology(result.topology);
        setRps(offeredRpsFor(result.topology));
        setPresetId(null);
        setSelectedIds(new Set<string>());
        topoLiveRef.current = result.topology;
        engine.setTopology(result.topology);
        engine.reset();
        resetLostRate();
        setSnapshot(engine.snapshot());
        setFitNonce((n) => n + 1);
        toastSeq.current += 1;
        setToast({ text: 'Opened a shared design', id: toastSeq.current });
        return;
      }
      // Not ours, or ours and broken. Either way the stored session that
      // is already on screen stays, and saving resumes.
      setSharePending(false);
      if (result.status === 'invalid') {
        toastSeq.current += 1;
        setToast({ text: result.message, id: toastSeq.current });
      }
    });
    return () => {
      cancelled = true;
    };
    // Once, at boot. `sharePending` is deliberately absent from the deps:
    // the recipient's first edit clears it, and re-running this then would
    // reload the link over the change they had just made.
  }, [engine, resetLostRate]);

  const [copiedLink, setCopiedLink] = useState(false);

  /**
   * Copy link. Writes the whole design into the URL fragment and puts that
   * URL on the clipboard, so the confirmation the reader gets is the same
   * receipt undo and redo use.
   */
  const handleCopyLink = useCallback(() => {
    void (async () => {
      let text: string;
      try {
        text = await buildShareUrl(topology, window.location.href);
        await navigator.clipboard.writeText(text);
      } catch {
        toastSeq.current += 1;
        setToast({
          text: 'Could not copy the link. Your browser blocked clipboard access.',
          id: toastSeq.current,
        });
        return;
      }
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
      toastSeq.current += 1;
      setToast({
        text: 'Link copied. It carries the whole design.',
        id: toastSeq.current,
      });
    })();
  }, [topology]);

  const handleReset = useCallback(() => {
    engine.reset();
    // Synchronously, not via the derivation effect: Reset must never leave
    // the previous run's Dropped figure standing beside a zeroed clock.
    resetLostRate();
    setSnapshot(engine.snapshot());
  }, [engine, resetLostRate]);

  const handleToggleRun = useCallback(() => setRunning((r) => !r), []);

  /**
   * Advance one fixed tick with the loop stopped. Stepping while running
   * would race the rAF loop and make the delta non-deterministic, so a step
   * always pauses first — the same contract a debugger's step button has.
   */
  const handleStep = useCallback(() => {
    setRunning(false);
    runningRef.current = false;
    engine.advance(STEP_MS);
    setSnapshot(engine.snapshot());
  }, [engine]);

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Never steal keys from a field the user is typing into.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      /*
       * Undo / redo. Bound by e.code, not e.key: KeyZ is the physical key in
       * the Z position, so the chord works on layouts (Cyrillic, Greek) where
       * pressing that key produces no letter "z" at all — the exact bug
       * Excalidraw shipped and fixed. Ctrl+Shift+Z and Ctrl+Y are both redo,
       * matching the two conventions users arrive with. Inert in text fields
       * via the guard above, so the browser keeps its own text undo.
       */
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === 'KeyY') {
        e.preventDefault();
        handleRedo();
        return;
      }

      /*
       * Cmd/Ctrl+K jumps to the library search: the rail opens (sheets
       * close on a phone, the way the Build tab does) and the search box
       * takes focus so typing filters immediately.
       */
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.code === 'KeyK') {
        e.preventDefault();
        setLayout((l) =>
          l.library ? l : { ...l, library: true, metrics: phone ? false : l.metrics },
        );
        if (phone) setInspectorHidden(true);
        setPaletteFocusNonce((n) => n + 1);
        return;
      }

      /*
       * Duplicate. By e.code for the same layout reasons as undo, and
       * preventDefault matters doubly here: Ctrl+D is the browser's
       * bookmark chord.
       */
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === 'KeyD') {
        e.preventDefault();
        handleDuplicate();
        return;
      }

      /*
       * The shortcuts dialog, on Ctrl+/ — the settled convention for "show
       * me the keys" in tools whose "?" is already spoken for, and ours is:
       * "?" has toggled the glossary since it shipped, and stealing a taught
       * binding to advertise the other bindings would be self-defeating.
       */
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === 'Slash') {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setRunning((r) => !r);
        return;
      }

      // Step one tick. Ignored with a modifier held so it cannot shadow
      // browser shortcuts like Cmd/Ctrl+S.
      if ((e.key === 's' || e.key === 'S') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleStep();
        return;
      }

      /*
       * The glossary. `?` is the long-standing convention for "show me the
       * reference", and it collides with nothing here: Space is play/pause,
       * S steps, Delete and Escape belong to the canvas. It is also inert
       * inside a text field by the guard at the top of this handler, which
       * matters because `?` is an ordinary character a student may well type
       * into the node-name box or the glossary's own search.
       *
       * Matched on e.key rather than a code plus Shift, so it works on the
       * keyboard layouts where `?` is not Shift+/ at all.
       *
       * It TOGGLES. A student who opened the panel with a key expects the
       * same key to shut it, and hunting for the close button after that is
       * exactly the small friction this whole feature exists to remove.
       */
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (glossaryOpen) closeGlossary();
        else openGlossary();
        return;
      }

      /*
       * Panel toggles. Single letters, like S above, and inert inside a
       * text field by the same guard: C for the components rail, M for the
       * metrics strip, I for the inspector. All three ignore held
       * modifiers so they can never shadow Cmd/Ctrl+C, Cmd/Ctrl+M or
       * Cmd/Ctrl+I in the browser.
       *
       * I toggles the right dock either way: node settings with a
       * selection, Studio review without one.
       */
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          toggleLibrary();
          return;
        }
        if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          toggleMetrics();
          return;
        }
        if (e.key === 'i' || e.key === 'I') {
          e.preventDefault();
          toggleInspector();
          return;
        }
        /*
         * G for the grid snap. It sits with the panel toggles because it
         * obeys the same rules, but it is the one of these you press while
         * a drag is already in flight, which is the whole reason it is a
         * key: it was in Settings, and opening a modal mid-arrangement is
         * not something anyone does.
         *
         * Ctrl held during a drag still bypasses the snap for that drag
         * alone. The two do not fight: this is the standing setting, that
         * is the momentary override.
         */
        if (e.key === 'g' || e.key === 'G') {
          e.preventDefault();
          togglePreference('snapToGrid');
          return;
        }
      }

      // Delete/Backspace, Escape and Ctrl/Cmd+A belong to the canvas, which
      // owns the selection and knows how to partition it. Handling them here
      // too would double-fire.
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleStep,
    handleUndo,
    handleRedo,
    handleDuplicate,
    glossaryOpen,
    openGlossary,
    closeGlossary,
    toggleLibrary,
    toggleMetrics,
    toggleInspector,
    hasSelection,
  ]);

  /* ---------------- derived ---------------- */

  /**
   * The single-node subject. Still resolved separately because the Inspector's
   * `node` prop drives the whole single-node view; `selectedNodes` only takes
   * over when it holds two or more.
   */
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0]! : null;

  const selectedStats =
    selectedNode && snapshot ? (snapshot.nodes[selectedNode.id] ?? null) : null;

  const cloudCostEstimate = useMemo(
    () =>
      costEstimator
        ? calculateCloudCosts(topology)
        : { totalAws: 0, totalGcp: 0, totalAzure: 0, components: [] },
    [topology, costEstimator],
  );
  const architecturalFindings = useMemo(() => auditTopology(topology), [topology]);
  const spofCount = useMemo(
    () => architecturalFindings.filter((f) => f.severity === 'critical').length,
    [architecturalFindings],
  );
  const warningCount = useMemo(
    () => architecturalFindings.filter((f) => f.severity === 'warning').length,
    [architecturalFindings],
  );

  /**
   * The header's offered load, derived from the topology's client nodes (the
   * sum, so multi-client presets add up) rather than mirrored in a separate
   * state cell that add/delete paths forgot to reconcile. `rps` state remains
   * only as the persisted slider value for session restore.
   */
  const offeredRps = useMemo(() => offeredRpsFor(topology), [topology]);

  /**
   * The scenario shared by every traffic source, or 'mixed' when sources
   * disagree. Tabs show no selection rather than a lie in that case.
   */
  const trafficPattern = useMemo(() => {
    const sources = findTrafficSources(topology);
    if (sources.length === 0) return 'steady' as const;
    const first = sources[0]!.config.traffic ?? 'steady';
    return sources.every((s) => (s.config.traffic ?? 'steady') === first)
      ? first
      : ('mixed' as const);
  }, [topology]);

  /** One scenario for every source: the engine scales each baseline, so the
   *  mix survives the switch. */
  const handlePatternChange = useCallback(
    (pattern: TrafficPattern) => {
      const ids = findTrafficSources(topology).map((s) => s.id);
      if (ids.length > 0) handleConfigChangeMany(ids, { traffic: pattern });
    },
    [topology, handleConfigChangeMany],
  );

  /**
   * Requests actually lost PER SECOND, derived from the engine's per-reason
   * counters. This is the single source of truth for "dropped": the top bar
   * and the throughput chart previously derived it two different ways
   * (`errorRate * offeredRps` and `offered - goodput`) and disagreed with
   * each other and with the failures panel. Neither derivation is loss —
   * `offered - goodput` counts in-flight work, and the errorRate product
   * rides a smoothed fraction against an instantaneous rate.
   *
   * `failuresByReason` is a LIFETIME COUNT, not a rate: the engine does
   * `this.failures[reason]++` per failure and zeroes it only on reset().
   * Summing it and labelling the total `/s` was wrong three ways — the unit
   * was a lie, the figure could only ever grow, and a recovered system still
   * read hundreds of thousands "dropped per second" because a counter cannot
   * fall. Observed directly: goodput 76/s and ERRORS 0% next to DROPPED
   * 218k/s.
   *
   * Differencing successive samples against elapsed SIM time turns the
   * counter into the rate this claims to be. Sim time is the right clock —
   * it follows pause, step and reset, where a wall clock would invent
   * traffic while the simulation is stopped. This mirrors the identical
   * derivation in Metrics.tsx, which fixed this same bug for the failures
   * panel. The backing refs and state live up beside handleReset, which must
   * zero them synchronously.
   */
  const cumulativeLost = useMemo(() => {
    if (!snapshot) return 0;
    let s = 0;
    for (const v of Object.values(snapshot.failuresByReason)) {
      if (Number.isFinite(v)) s += v;
    }
    return s;
  }, [snapshot]);

  const simTimeMs = snapshot?.system.timeMs ?? 0;

  /**
   * One definition of "the strip is open", shared by the slot and the
   * has-metrics class so the panel and the geometry that clears it (chrome
   * offsets, the safe-area sentinel) can never disagree.
   */
  const metricsVisible = layout.metrics && snapshot !== null;

  useEffect(() => {
    if (!Number.isFinite(simTimeMs)) return;
    const prev = lostPrevRef.current;
    const dtMs = simTimeMs - lostPrevTimeRef.current;

    // First sample, or a reset (sim time or the counter moved backwards):
    // adopt the count as the new baseline and report nothing this frame.
    if (prev === null || dtMs < 0 || cumulativeLost < prev) {
      lostPrevRef.current = cumulativeLost;
      lostPrevTimeRef.current = simTimeMs;
      setLostRps(0);
      return;
    }

    // Sample no faster than 250ms of sim time: below that the divisor is
    // tiny and the quotient is mostly quantisation noise.
    if (dtMs < 250) return;

    const delta = cumulativeLost - prev;
    lostPrevRef.current = cumulativeLost;
    lostPrevTimeRef.current = simTimeMs;
    setLostRps(delta > 0 ? (delta * 1000) / dtMs : 0);
  }, [cumulativeLost, simTimeMs]);

  return (
    <div className="app">
      <header className="app-bar" ref={barRef}>
        <div className="app-island app-island-brand">
          {/* The wordmark is the one place the product speaks in its own
            voice. Two words, sentence case, no abbreviation — a student
            opening this should be able to say what it is out loud. */}
          <div className="app-brand">
            <div className="app-brand-mark" aria-hidden="true">
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient
                    id="brand-sl-core"
                    x1="4"
                    y1="4"
                    x2="28"
                    y2="28"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="50%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#4338CA" />
                  </linearGradient>
                  <linearGradient
                    id="brand-sl-accent"
                    x1="8"
                    y1="8"
                    x2="24"
                    y2="24"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="#06B6D4" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                  <filter id="brand-sl-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#6366F1" floodOpacity="0.4" />
                  </filter>
                </defs>
                <rect width="32" height="32" rx="8" fill="#090D16" />
                <rect width="32" height="32" rx="8" stroke="#1E293B" strokeWidth="1" />
                <g filter="url(#brand-sl-glow)">
                  <rect x="6.5" y="7" width="8" height="8" rx="2.5" fill="url(#brand-sl-accent)" />
                  <rect x="17.5" y="17" width="8" height="8" rx="2.5" fill="url(#brand-sl-core)" />
                  <path
                    d="M14.5 11 H19.5 C20.6 11 21.5 11.9 21.5 13 V17"
                    stroke="#38BDF8"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M17.5 21 H12.5 C11.4 21 10.5 20.1 10.5 19 V15"
                    stroke="#818CF8"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <circle cx="16" cy="16" r="3" fill="#090D16" stroke="#38BDF8" strokeWidth="1.5" />
                  <circle cx="16" cy="16" r="1.3" fill="#FFFFFF" />
                </g>
              </svg>
            </div>
            <div className="app-brand-text">
              <h1 className="app-title">ScaleLab</h1>
              <span className="app-studio-badge">STUDIO</span>
            </div>
          </div>

          <div className="app-bar-sep" aria-hidden="true" />

          <div className="app-doc-info" title="Click to rename architecture">
            <input
              type="text"
              className="app-doc-title-input"
              value={architectureTitle}
              onChange={(e) => setArchitectureTitle(e.target.value)}
              aria-label="Architecture Title"
              placeholder="System Architecture"
              maxLength={60}
            />
          </div>

          {/*
            Says the work is safe.

            role=status, so it is announced rather than only drawn: someone
            who cannot see the dot has the same reason to worry about closing
            the tab as someone who can.
          */}
          <p
            className={`app-saved is-${saveState}`}
            role="status"
            title={
              saveState === 'saved'
                ? 'Your work is saved in this browser'
                : 'Saving your work'
            }
          >
            <span className="app-saved-dot" aria-hidden="true" />
            {saveState === 'saved' ? 'Saved' : 'Saving'}
          </p>

          {/*
          Undo / redo. Beside the wordmark, at the editing end of the bar,
          away from the run/pause cluster: these operate on the DIAGRAM, not
          on the simulation. Disabled state is derived from the history
          stacks on every render, so the buttons can never claim emptiness
          while entries exist (the cached-boolean regression Excalidraw
          shipped). Icon-only, because "curved arrow left" is one of the few
          icons with a universally settled meaning, and the title carries the
          shortcut for anyone hovering to check.
        */}
          <div className="app-history">
            <button
              type="button"
              className="btn btn-sm btn-icon"
              disabled={!canUndo}
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
              onClick={handleUndo}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
              </svg>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-icon"
              disabled={!canRedo}
              aria-label="Redo"
              title="Redo (Ctrl+Shift+Z)"
              onClick={handleRedo}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m15 14 5-5-5-5" />
                <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
              </svg>
            </button>
          </div>
        </div>

        {/* Center: Mode Switcher & Studio Telemetry */}
        <div className="app-center-studio">
          <div className="app-mode-switch" role="group" aria-label="Workspace mode">
            <button
              type="button"
              className={`app-mode-btn${cleanCanvas ? ' is-active' : ''}`}
              title="Clean Canvas mode: Draw & architecture view without live request counters"
              aria-pressed={cleanCanvas}
              onClick={() => {
                if (!cleanCanvas) togglePreference('cleanCanvas');
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="m9 9 6 6" />
                <path d="m15 9-6 6" />
              </svg>
              <span className="app-mode-label">Clean Canvas</span>
            </button>
            <button
              type="button"
              className={`app-mode-btn${!cleanCanvas ? ' is-active' : ''}`}
              title="Simulation mode: live traffic load slider, requests/second, and telemetry"
              aria-pressed={!cleanCanvas}
              onClick={() => {
                if (cleanCanvas) togglePreference('cleanCanvas');
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span className="app-mode-label">Simulation</span>
            </button>
          </div>

          <div className="app-studio-telemetry" role="region" aria-label="Studio insights">
            {costEstimator && (
              <button
                type="button"
                className="app-studio-pill-btn app-cost-pill"
                title="Multi-Cloud Monthly Spend Estimate across AWS, GCP, Azure"
                onClick={() => setCostModalOpen(true)}
              >
                <span className="app-studio-pill-icon" aria-hidden="true">☁️</span>
                <span className="app-studio-pill-val">${cloudCostEstimate.totalAws.toLocaleString()}/mo</span>
                <span className="app-studio-pill-tag">AWS</span>
              </button>
            )}

            <button
              type="button"
              className={`app-studio-pill-btn app-advisor-pill${spofCount > 0 ? ' is-spof' : warningCount > 0 ? ' is-warn' : ' is-good'}`}
              title="Architectural Advisor: Linter for SPOFs & Resilience"
              onClick={() => setAdvisorDrawerOpen(true)}
            >
              <span className="app-studio-pill-icon" aria-hidden="true">
                {spofCount > 0 ? '🚨' : warningCount > 0 ? '⚠️' : '🛡️'}
              </span>
              <span className="app-studio-pill-val">
                {spofCount > 0
                  ? `${spofCount} SPOF${spofCount > 1 ? 's' : ''}`
                  : warningCount > 0
                  ? `${warningCount} Warning${warningCount > 1 ? 's' : ''}`
                  : 'Resilient'}
              </span>
            </button>

            <button
              type="button"
              className="app-studio-pill-btn app-rfc-pill"
              title="Export Architecture High-Level Design (HLD) RFC (.md)"
              onClick={handleExportHldMarkdown}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span className="app-studio-pill-val">HLD RFC</span>
            </button>
          </div>
        </div>

        <div className="app-island app-island-menu">
          <button
            type="button"
            className={`app-share-btn${copiedLink ? ' is-copied' : ''}`}
            title="Share design: copy link to clipboard"
            aria-label="Share design"
            onClick={handleCopyLink}
          >
            {copiedLink ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
              </svg>
            )}
            <span className="app-share-label">
              {copiedLink ? 'Copied!' : 'Share'}
            </span>
          </button>

          {/*
          Everything that is reference or setup, behind one button.

          Examples, Shortcuts, Settings and Glossary were four buttons
          competing with the load control and the live readouts. They are all
          reached BETWEEN actions rather than during one, so folding them
          here leaves the bar carrying only what changes while the simulation
          runs, which is the thing a reader is actually watching.
        */}
          <div className="app-menu-wrap">
            <button
              type="button"
              className="btn btn-icon app-menu-btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Menu"
              title="Examples, settings and help"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <MainMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              items={menuItems}
            />
          </div>
        </div>
      </header>

      {/*
        The has-* classes drive every piece of geometry that must clear an
        open panel: the strip's side insets, the toggle and canvas-chrome
        offsets, and the .stage-safe sentinel (all in App.css). They flip at
        toggle time, while a closing panel is still sliding out, so the
        chrome and the panel move on the same clock.
      */}
      <div
        className={
          'app-body' +
          (layout.library ? ' has-library' : '') +
          (inspectorVisible ? ' has-inspector' : '') +
          (metricsVisible ? ' has-metrics' : '') +
          (!cleanCanvas ? ' is-sim' : ' is-clean')
        }
        /* The three panel sizes, written here because .app-body is where the
           slots and the strip's insets all read them from. A drag rewrites
           these same properties directly on this element and only commits to
           React at the end, so the canvas does not re-render per frame. */
        style={
          {
            '--rail-w': `${layout.railW}px`,
            '--ins-w': `${layout.insW}px`,
            '--strip-h': `${layout.stripH}px`,
            /* The bar's own height plus the gap it floats in. Falls back to
               the stylesheet's constant until the first measurement lands. */
            ...(barBottom === null
              ? {}
              : { '--bar-clear': `${barBottom + BAR_GAP_PX}px` }),
          } as CSSProperties
        }
      >
        {/* Activity rail: the studio's stable command strip. On laptop widths
          the three floating canvas toggles hide and this rail carries the
          same three actions (plus Examples and the guide) in one place that
          never moves. Below the breakpoint the rail hides and the floating
          toggles and phone tab bar take over, so touch layouts keep their
          larger, edge-placed targets. */}
        <nav className="app-activity" aria-label="Studio panels">
          <button
            type="button"
            className={`btn btn-icon app-activity-btn${layout.library ? ' is-active' : ''}`}
            aria-expanded={layout.library}
            aria-label={layout.library ? 'Hide library' : 'Show library'}
            title={layout.library ? 'Hide library (C)' : 'Show library (C)'}
            onClick={toggleLibrary}
          >
            <PanelGlyph edge="left" />
          </button>
          <button
            type="button"
            className={`btn btn-icon app-activity-btn${inspectorVisible ? ' is-active' : ''}`}
            aria-expanded={inspectorVisible}
            aria-label={inspectorVisible ? 'Hide review' : 'Show review'}
            title={inspectorVisible ? 'Hide review (I)' : 'Show review (I)'}
            onClick={toggleInspector}
          >
            <PanelGlyph edge="right" />
          </button>
          <button
            type="button"
            className={`btn btn-icon app-activity-btn${layout.metrics ? ' is-active' : ''}`}
            aria-expanded={layout.metrics}
            aria-label={layout.metrics ? 'Hide charts' : 'Show charts'}
            title={layout.metrics ? 'Hide charts (M)' : 'Show charts (M)'}
            onClick={toggleMetrics}
          >
            <PanelGlyph edge="bottom" />
          </button>
          <div className="app-activity-sep" aria-hidden="true" />
          <button
            type="button"
            className="btn btn-icon app-activity-btn"
            aria-label="Open examples"
            title="Examples"
            onClick={() => setExamplesOpen(true)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M3 4a1 1 0 0 1 1-1h6v7H3zM14 3h6a1 1 0 0 1 1 1v5h-7zM3 13h7v8H4a1 1 0 0 1-1-1zM14 13h7v7a1 1 0 0 1-1 1h-6z" />
            </svg>
          </button>
          <button
            type="button"
            className="btn btn-icon app-activity-btn"
            aria-label="Open studio guide"
            title="Studio guide"
            onClick={() => setGuideOpen(true)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
        </nav>
        <PanelSlot
          open={layout.library}
          edge="left"
          onDismiss={phone ? toggleLibrary : undefined}
        >
          <Palette
            onAdd={handlePaletteAdd}
            onAddAnnotation={handlePaletteAnnotation}
            armedTool={armedTool}
            searchFocusSignal={paletteFocusNonce}
          />
          <PanelResizer
            edge="left"
            property="--rail-w"
            size={layout.railW}
            min={PANEL_LIMITS.railW.min}
            max={PANEL_LIMITS.railW.max}
            onCommit={(railW) => setLayout((l) => ({ ...l, railW }))}
            onReset={() => setLayout((l) => ({ ...l, railW: PANEL_LIMITS.railW.base }))}
            label="Resize the components rail"
          />
        </PanelSlot>

        <main className="app-stage">
          {/*
            The canvas plus the chrome that floats OVER it. The toggles are
            SIBLINGS of the Canvas, never children of .cv-surface, so the
            canvas gesture router cannot see a press on them; data-chrome is
            belt and braces on top of that, matching the exclusion selector
            the router uses.

            Each panel's toggle lives at the canvas edge the panel occupies
            and stays there in both states, so collapsing something never
            leaves a dead edge: the affordance that closed it is the
            affordance that brings it back, in the same place.
          */}
          {/*
            A design file dropped anywhere on the canvas opens it. The
            handlers sit on this wrapper rather than inside the Canvas
            because a file drop is not one of the pointer router's
            gestures, and because without the dragover preventDefault the
            browser would leave the app to display the JSON.
          */}
          <div
            className="stage-canvas"
            onDragOver={handleFileDragOver}
            onDrop={handleFileDrop}
          >
            {/*
              The uncovered-canvas sentinel. Inert and invisible; a sibling
              of the Canvas, outside .cv-surface, so the gesture router can
              never see it. Its rect is the canvas minus every open panel.
            */}
            <div ref={stageSafeRef} className="stage-safe" aria-hidden="true" />
            <Canvas
              topology={topology}
              snapshot={snapshot}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onMoveNode={handleMoveNode}
              onMoveStart={handleMoveStart}
              onMoveEnd={handleMoveEnd}
              onConnect={handleConnect}
              onDeleteSelection={handleDeleteSelection}
              onDropNode={handleAddNode}
              onRename={handleRename}
              onDuplicateForDrag={handleDuplicateForDrag}
              onPaste={handlePaste}
              onMoveAnnotation={handleMoveAnnotation}
              onResizeSection={handleResizeSection}
              onResizeTextBox={handleResizeTextBox}
              onResizeNote={handleResizeNote}
              onScaleNote={handleScaleNote}
              onCreateNote={handleCreateNote}
              onCreateSection={handleCreateSection}
              onCreateTextBox={handleCreateTextBox}
              onCreateInk={handleCreateInk}
              onEraseInk={handleEraseInk}
              penSettings={penSettings}
              eraserWidth={penSettings.eraserWidth}
              onEditNote={handleEditNote}
              onEditSectionLabel={handleEditSectionLabel}
              onEditTextBox={handleEditTextBox}
              onSetNoteSize={handleSetNoteSize}
              onSetSectionTone={handleSetSectionTone}
              onSetNoteStyle={handleSetNoteStyle}
              spark={spark}
              viewCenterRef={viewCenterRef}
              armToolRef={armToolRef}
              exportSvgRef={exportSvgRef}
              onToolChange={setArmedTool}
              fitSignal={fitNonce}
              visibleRef={stageSafeRef}
            />

            {/* Studio control deck (only in Simulate mode) */}
            {!cleanCanvas && (
              <aside className="app-sim-dock" aria-label="Studio control deck">
                <TrafficControl
                  rps={offeredRps}
                  onRpsChange={handleRpsChange}
                  running={running}
                  onToggleRun={handleToggleRun}
                  onStep={handleStep}
                  onReset={handleReset}
                  system={snapshot?.system ?? EMPTY_SYSTEM}
                  lost={lostRps}
                  empty={topology.nodes.length === 0}
                  noTrafficSource={findTrafficSources(topology).length === 0}
                  pattern={trafficPattern}
                  onPatternChange={handlePatternChange}
                />
              </aside>
            )}

            {/* Pen island: settings for the armed pen or eraser, floating
              bottom-centre above the simulation dock. Switching tools here
              re-arms without disarming, so one tap moves between drawing
              and cleaning up; Esc or the close button puts it away. */}
            {(armedTool === 'ink' || armedTool === 'eraser') && (
              <PenToolbar
                tool={armedTool}
                settings={penSettings}
                onToolChange={handlePaletteAnnotation}
                onSettingsChange={handlePenSettingsChange}
                onClose={() => handlePaletteAnnotation(armedTool)}
              />
            )}
            <button
              type="button"
              className="btn btn-sm btn-icon stage-toggle stage-toggle-library"
              data-chrome="layout"
              aria-expanded={layout.library}
              aria-label={layout.library ? 'Hide components' : 'Show components'}
              title={layout.library ? 'Hide components (C)' : 'Show components (C)'}
              onClick={toggleLibrary}
            >
              <PanelGlyph edge="left" />
            </button>
            {/* The dock toggle is always present: with a selection it shows
              settings, with none it shows the Studio review. The affordance
              that opens the dock is the affordance that brings it back. */}
            <button
              type="button"
              className="btn btn-sm btn-icon stage-toggle stage-toggle-inspector"
              data-chrome="layout"
              aria-expanded={inspectorVisible}
              aria-label={inspectorVisible ? 'Hide inspector' : 'Show inspector'}
              title={inspectorVisible ? 'Hide inspector (I)' : 'Show inspector (I)'}
              onClick={toggleInspector}
            >
              <PanelGlyph edge="right" />
            </button>
            <button
              type="button"
              className="btn btn-sm btn-icon stage-toggle stage-toggle-metrics"
              data-chrome="layout"
              aria-expanded={layout.metrics}
              aria-label={layout.metrics ? 'Hide charts' : 'Show charts'}
              title={layout.metrics ? 'Hide charts (M)' : 'Show charts (M)'}
              onClick={toggleMetrics}
            >
              <PanelGlyph edge="bottom" />
            </button>
          </div>
          <PanelSlot
            open={metricsVisible}
            edge="bottom"
            onDismiss={phone ? toggleMetrics : undefined}
          >
            {snapshot ? (
              <Metrics
                snapshot={snapshot}
                nodeNames={nodeNames}
              />
            ) : null}
            <PanelResizer
              edge="bottom"
              property="--strip-h"
              size={layout.stripH}
              min={PANEL_LIMITS.stripH.min}
              max={PANEL_LIMITS.stripH.max}
              onCommit={(stripH) => setLayout((l) => ({ ...l, stripH }))}
              onReset={() =>
                setLayout((l) => ({ ...l, stripH: PANEL_LIMITS.stripH.base }))
              }
              label="Resize the charts strip"
            />
          </PanelSlot>
        </main>

        <PanelSlot
          open={inspectorVisible}
          edge="right"
          onDismiss={phone ? toggleInspector : undefined}
        >
          <Inspector
            node={selectedNode}
            stats={selectedStats}
            onChange={handleConfigChange}
            onDelete={handleDeleteNode}
            onRename={handleRename}
            onDescribe={handleDescriptionChange}
            selectedNodes={selectedNodes}
            selectedEdgeCount={selectedEdgeCount}
            onChangeMany={handleConfigChangeMany}
            onDeleteMany={handleDeleteMany}
            textBox={selectedTextBox}
            onEditTextBox={handleEditTextBox}
            onSetTextBoxTone={handleSetSectionTone}
            onSetTextBoxStyle={handleSetTextBoxStyle}
            onApplyTextBoxTemplate={handleApplyTextBoxTemplate}
            onDeleteTextBox={handleDeleteTextBox}
            note={selectedNote}
            onEditNote={handleEditNote}
            onSetNoteSize={handleSetNoteSize}
            onSetNoteStyle={handleSetNoteStyle}
            onDeleteNote={(id) => handleDeleteSelection([], [], [id])}
            ink={selectedInk}
            onSetInkTone={handleSetInkTone}
            onInkStyle={handleInkStyle}
            onDeleteInk={(id) => handleDeleteSelection([], [], [id])}
            cleanCanvas={cleanCanvas}
            topology={topology}
            costEstimator={costEstimator}
            onOpenSettings={() => setSettingsOpen(true)}
            edge={selectedEdge}
            sourceNode={edgeSourceNode}
            targetNode={edgeTargetNode}
            onUpdateEdge={handleUpdateEdge}
            onDeleteEdge={(edgeId) => handleDeleteSelection([], [edgeId], [])}
          />
          <PanelResizer
            edge="right"
            property="--ins-w"
            size={layout.insW}
            min={PANEL_LIMITS.insW.min}
            max={PANEL_LIMITS.insW.max}
            onCommit={(insW) => setLayout((l) => ({ ...l, insW }))}
            onReset={() => setLayout((l) => ({ ...l, insW: PANEL_LIMITS.insW.base }))}
            label="Resize the inspector"
          />
        </PanelSlot>
      </div>

      {/*
        The phone tab bar.

        CSS decides whether this is visible, not JS: it reads the same panel
        state the desktop's edge toggles read, so the two can never disagree
        about whether a panel is open. Above the breakpoint it is
        display:none and costs a reader nothing.

        The Review tab opens the right dock in both states: node settings
        with a selection, Studio review without one.
      */}
      <nav className="app-tabbar" aria-label="Panels">
        <button
          type="button"
          className="app-tab"
          aria-expanded={layout.library}
          onClick={toggleLibrary}
        >
          <PanelGlyph edge="left" />
          Build
        </button>
        <button
          type="button"
          className="app-tab"
          aria-expanded={inspectorVisible}
          onClick={toggleInspector}
        >
          <PanelGlyph edge="right" />
          Review
        </button>
        <button
          type="button"
          className="app-tab"
          aria-expanded={layout.metrics}
          onClick={toggleMetrics}
        >
          <PanelGlyph edge="bottom" />
          Charts
        </button>
      </nav>

      {/*
        Mounted ONCE for the whole app. Every <Term> anywhere in the tree is a
        stateless trigger that this single layer renders the panel for, so the
        cost of an explanation is paid per tooltip OPEN rather than per term
        present. Both of these portal to <body>, so their position here is
        about ownership, not stacking.
      */}
      {/*
        Undo/redo receipt. role="status" (polite live region) so a screen
        reader hears the same confirmation a sighted user sees; keyed by id so
        rapid consecutive undos restart the entrance rather than sitting
        still on a message that appears not to change.
      */}
      {toast ? (
        <div key={toast.id} className="app-toast" role="status">
          {toast.text}
        </div>
      ) : null}

      {/*
        A refused import. role="alert" rather than "status" because this
        reports a failure the student needs to notice, and it sits longer
        than the toast does: the sentence names what was wrong with the
        file, and there is nothing else on screen that changed to say so.
        Nothing on the canvas moved, which is the point.
      */}
      {importError ? (
        <div className="app-toast app-toast-error" role="alert">
          {importError}
        </div>
      ) : null}

      <TooltipLayer />
      <Glossary open={glossaryOpen} onClose={closeGlossary} focusId={glossaryFocusId} />
      <Shortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <Guide
        open={guideOpen}
        onClose={() => {
          setGuideOpen(false);
          try {
            localStorage.setItem('scalelab.guide-seen-v1', 'true');
          } catch {
            /* quota / private browsing */
          }
        }}
        onOpenExamples={() => setExamplesOpen(true)}
        onOpenInterview={() => setInterviewOpen(true)}
        onLoadDemoPreset={(presetId, pattern) => {
          const preset = PRESETS.find((p) => p.id === presetId);
          if (preset) handleLoadLab(preset, pattern);
        }}
        onPinSection={handlePinSection}
        onOpenGlossary={(id) => openGlossary(id)}
        onPracticePack={(packId) => {
          setPendingPackId(packId);
          setGuideOpen(false);
          setInterviewOpen(true);
        }}
      />
      {/* The real file input, kept off screen. A bare one cannot be styled,
          so the Settings row calls click() on this. It lives beside the
          dialogs rather than in the top bar, which no longer carries any
          save or share control. */}
      <input
        ref={fileInputRef}
        type="file"
        className="app-file-input"
        accept={DESIGN_FILE_ACCEPT}
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleImportPick}
      />
      <Designs
        open={designsOpen}
        onClose={() => setDesignsOpen(false)}
        onOpen={handleOpenSaved}
        onSave={handleSaveNamed}
        onNewCanvas={handleNewCanvas}
        suggestedName={
          presetId ? (PRESETS.find((p) => p.id === presetId)?.name ?? '') : ''
        }
      />
      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onExport={handleExport}
        onImport={() => fileInputRef.current?.click()}
        onExportImage={handleExportImage}
        onExportMermaid={handleExportMermaid}
        onExportHldMarkdown={handleExportHldMarkdown}
      />

      {costEstimator && (
        <CostModal
          open={costModalOpen}
          onClose={() => setCostModalOpen(false)}
          topology={topology}
        />
      )}

      <AdvisorDrawer
        open={advisorDrawerOpen}
        onClose={() => setAdvisorDrawerOpen(false)}
        topology={topology}
        onSelectNodes={(nodeIds) => {
          setSelectedIds(new Set(nodeIds));
          setAdvisorDrawerOpen(false);
        }}
      />

      <Examples
        open={examplesOpen}
        onClose={() => setExamplesOpen(false)}
        presets={PRESETS}
        activePresetId={presetId}
        onLoad={handleLoadPreset}
        onNewCanvas={handleNewCanvas}
      />
      <InterviewPractice
        open={interviewOpen}
        onClose={() => {
          setInterviewOpen(false);
          setPendingPackId(null);
        }}
        initialPackId={pendingPackId ?? undefined}
        packs={INTERVIEW_PACKS}
        presets={PRESETS}
        activePresetId={presetId}
        onLoadPreset={handleLoadPreset}
        onPinSection={handlePinSection}
        labs={LABS}
        snapshot={snapshot}
        topology={topology}
        onLoadLab={handleLoadLab}
      />
    </div>
  );
}

/**
 * Stable empty array for the no-selection case. A fresh `[]` each render
 * would give the Inspector a new prop identity every 100ms and defeat any
 * memoisation it does.
 */
const EMPTY_NODES: readonly SimNode[] = [];

/** Shown for the single frame before the first snapshot exists. */
const EMPTY_SYSTEM = {
  timeMs: 0,
  offeredRps: 0,
  goodputRps: 0,
  errorRate: 0,
  p50: 0,
  p95: 0,
  p99: 0,
  totalRequests: 0,
  totalFailed: 0,
};
