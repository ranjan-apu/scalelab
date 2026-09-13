import { useCallback, useState } from 'react';
import type { GuideTab } from '../components/guide/types';

/**
 * Every overlay/sheet/dialog open flag in the shell, in one hook.
 *
 * Extracted verbatim from App.tsx: same state, same lazy initializers, same
 * callbacks. Callers destructure the exact names App used, so no call site
 * changes. No effects live here -- the tooltip "see also" registration
 * (setGlossaryNavigate) stays in App next to the module it talks to.
 */
export function useModals() {
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [advisorDrawerOpen, setAdvisorDrawerOpen] = useState(false);

  /**
   * The glossary side sheet.
   *
   * `glossaryFocusId` is the entry to land on. It is cleared when the sheet
   * closes so that reopening from the top bar starts at the top of the list
   * rather than resuming wherever the last "see also" link happened to go.
   */
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [glossaryFocusId, setGlossaryFocusId] = useState<string | undefined>(undefined);

  /** The keyboard shortcuts dialog. Ctrl+/ and the top-bar button. */
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [designsOpen, setDesignsOpen] = useState(false);
  const [guideTab, setGuideTab] = useState<GuideTab>('overview');
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

  const [examplesOpen, setExamplesOpen] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [conceptsOpen, setConceptsOpen] = useState(false);
  const [conceptInitialId, setConceptInitialId] = useState<string | null>(null);

  const openConcepts = useCallback((id?: string) => {
    if (id) setConceptInitialId(id);
    setConceptsOpen(true);
  }, []);

  /** Pack preselected when practice opens from a concept lesson. Cleared on close. */
  const [pendingPackId, setPendingPackId] = useState<string | null>(null);

  const openGlossary = useCallback((id?: string) => {
    setGlossaryFocusId(id);
    setGlossaryOpen(true);
  }, []);

  const closeGlossary = useCallback(() => {
    setGlossaryOpen(false);
    setGlossaryFocusId(undefined);
  }, []);

  return {
    costModalOpen,
    setCostModalOpen,
    advisorDrawerOpen,
    setAdvisorDrawerOpen,
    glossaryOpen,
    setGlossaryOpen,
    glossaryFocusId,
    setGlossaryFocusId,
    openGlossary,
    closeGlossary,
    shortcutsOpen,
    setShortcutsOpen,
    settingsOpen,
    setSettingsOpen,
    menuOpen,
    setMenuOpen,
    designsOpen,
    setDesignsOpen,
    guideTab,
    setGuideTab,
    guideOpen,
    setGuideOpen,
    examplesOpen,
    setExamplesOpen,
    interviewOpen,
    setInterviewOpen,
    conceptsOpen,
    setConceptsOpen,
    conceptInitialId,
    setConceptInitialId,
    openConcepts,
    pendingPackId,
    setPendingPackId,
  };
}

export type Modals = ReturnType<typeof useModals>;
