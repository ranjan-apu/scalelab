export type GuideTab =
  | 'overview'
  | 'building'
  | 'traffic'
  | 'resilience'
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
  onOpenExamples?: () => void;
  onOpenChallenges?: () => void;
}
