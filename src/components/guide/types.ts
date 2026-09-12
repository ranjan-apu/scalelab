import type { TrafficPattern } from '../../sim/types';

export type GuideTab =
  | 'overview'
  | 'building'
  | 'traffic'
  | 'resilience'
  | 'concepts'
  | 'presets'
  | 'shortcuts';

export interface TabDef {
  id: GuideTab;
  label: string;
  badge?: string;
  icon: string;
}

export interface GuideProps {
  open: boolean;
  onClose: () => void;
  /** Tab selected when the dialog opens. Defaults to overview. */
  initialTab?: GuideTab;
  onOpenExamples?: () => void;
  onOpenInterview?: () => void;
  /** Load a concept demo: preset plus traffic scenario for every source. */
  onLoadDemoPreset?: (presetId: string, pattern: TrafficPattern) => void;
  /** Pin a lesson section onto the canvas as a textbox. */
  onPinSection?: (title: string, text: string) => void;
  /** Open the glossary focused on one term. */
  onOpenGlossary?: (id: string) => void;
  /** Jump to interview practice with one pack preselected. */
  onPracticePack?: (packId: string) => void;
  /** Open the dedicated full-page Concept Academy reader. */
  onOpenConceptsAcademy?: (id?: string) => void;
}
