import type { CSSProperties } from 'react';
import {
  ERASER_MAX_WIDTH,
  ERASER_MIN_WIDTH,
  INK_MAX_WIDTH,
  INK_MIN_OPACITY,
  INK_MIN_WIDTH,
  INK_TONE_COUNT,
} from '../sim/sketch';
import type { InkTone, PenSettings } from '../sim/sketch';
import './PenToolbar.css';

/* ------------------------------------------------------------------ *
 * Pen toolbar.
 *
 * A floating island that appears only while the pen or eraser is armed:
 * the reader sets the mark BEFORE making it, the way every drawing tool
 * works, instead of drawing first and restyling through the inspector
 * after. Settings are session state owned by the shell: a new stroke
 * copies them at commit, and committed strokes never follow later
 * changes.
 *
 * Pen side: five tone dots, a width slider with a live preview line, and
 * an opacity slider. Eraser side: one nib-width slider with a circle
 * preview. The Pen/Eraser switch flips the armed tool without disarming,
 * so one tap moves between drawing and cleaning up.
 * ------------------------------------------------------------------ */

export interface PenToolbarProps {
  tool: 'ink' | 'eraser';
  settings: PenSettings;
  onToolChange: (tool: 'ink' | 'eraser') => void;
  onSettingsChange: (patch: Partial<PenSettings>) => void;
  onClose: () => void;
}

function fillPct(v: number, min: number, max: number): string {
  return `${max <= min ? 0 : ((v - min) / (max - min)) * 100}%`;
}

export function PenToolbar({
  tool,
  settings,
  onToolChange,
  onSettingsChange,
  onClose,
}: PenToolbarProps) {
  const pen = tool === 'ink';
  return (
    <aside className="app-pen-toolbar" aria-label={pen ? 'Pen settings' : 'Eraser settings'}>
      <div
        className="pen-tool-switch"
        role="group"
        aria-label="Drawing tool"
      >
        <button
          type="button"
          className={`pen-tool-btn${pen ? ' is-active' : ''}`}
          aria-pressed={pen}
          title="Pen (P)"
          onClick={() => onToolChange('ink')}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
          <span>Pen</span>
        </button>
        <button
          type="button"
          className={`pen-tool-btn${!pen ? ' is-active' : ''}`}
          aria-pressed={!pen}
          title="Eraser (E)"
          onClick={() => onToolChange('eraser')}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
            <path d="M22 21H7" />
          </svg>
          <span>Eraser</span>
        </button>
      </div>

      {pen ? (
        <>
          <div className="pen-tones" role="group" aria-label="Pen colour">
            {Array.from({ length: INK_TONE_COUNT }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`pen-tone${settings.tone === i ? ' is-active' : ''}`}
                style={{ backgroundColor: `var(--ann-${i}-ink)` }}
                aria-label={`Pen colour ${i + 1}`}
                aria-pressed={settings.tone === i}
                onClick={() => onSettingsChange({ tone: i as InkTone })}
              />
            ))}
          </div>

          <label className="pen-slider">
            <span className="label">Size</span>
            <input
              className="slider"
              type="range"
              min={INK_MIN_WIDTH}
              max={INK_MAX_WIDTH}
              step={1}
              value={settings.width}
              style={{ '--fill-pct': fillPct(settings.width, INK_MIN_WIDTH, INK_MAX_WIDTH) } as CSSProperties}
              aria-label="Pen size"
              onChange={(e) => onSettingsChange({ width: Number(e.currentTarget.value) })}
            />
            <svg
              className="pen-preview"
              width="44"
              height="20"
              viewBox="0 4 44 20"
              aria-hidden="true"
            >
              <line
                x1="2"
                y1="14"
                x2="42"
                y2="14"
                stroke={`var(--ann-${settings.tone}-ink)`}
                strokeWidth={Math.max(1, Math.min(12, settings.width / 2))}
                strokeLinecap="round"
                opacity={settings.opacity}
              />
            </svg>
          </label>

          <label className="pen-slider pen-slider-narrow">
            <span className="label">Opacity</span>
            <input
              className="slider"
              type="range"
              min={Math.round(INK_MIN_OPACITY * 100)}
              max={100}
              step={5}
              value={Math.round(settings.opacity * 100)}
              style={
                {
                  '--fill-pct': fillPct(
                    Math.round(settings.opacity * 100),
                    Math.round(INK_MIN_OPACITY * 100),
                    100,
                  ),
                } as CSSProperties
              }
              aria-label="Pen opacity"
              onChange={(e) =>
                onSettingsChange({ opacity: Number(e.currentTarget.value) / 100 })
              }
            />
          </label>
        </>
      ) : (
        <label className="pen-slider pen-slider-wide">
          <span className="label">Eraser size</span>
          <input
            className="slider"
            type="range"
            min={ERASER_MIN_WIDTH}
            max={ERASER_MAX_WIDTH}
            step={2}
            value={settings.eraserWidth}
            style={
              {
                '--fill-pct': fillPct(settings.eraserWidth, ERASER_MIN_WIDTH, ERASER_MAX_WIDTH),
              } as CSSProperties
            }
            aria-label="Eraser size"
            onChange={(e) => onSettingsChange({ eraserWidth: Number(e.currentTarget.value) })}
          />
          <span
            className="pen-eraser-preview"
            aria-hidden="true"
            style={{
              width: `${Math.max(8, Math.min(24, settings.eraserWidth / 2))}px`,
              height: `${Math.max(8, Math.min(24, settings.eraserWidth / 2))}px`,
            }}
          />
        </label>
      )}

      <button
        type="button"
        className="btn btn-icon pen-close"
        aria-label="Put the pen away"
        title="Disarm (Esc)"
        onClick={onClose}
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
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </aside>
  );
}
