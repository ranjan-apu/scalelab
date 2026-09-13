import { useEffect, useRef, useState } from 'react';

/**
 * The two-second action label (undo/redo, save, export, ...).
 *
 * Extracted verbatim from App.tsx: same state, same auto-dismiss effect.
 * Callers keep using `toastSeq.current += 1; setToast({...})` unchanged.
 */
export function useToast() {
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const toastSeq = useRef(0);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  return { toast, setToast, toastSeq };
}

export type Toast = ReturnType<typeof useToast>;
