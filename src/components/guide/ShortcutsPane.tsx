export function ShortcutsPane() {
  return (
    <div className="gd-pane">
      <h3>⌨️ Essential Keyboard Shortcuts &amp; Gestures</h3>

      <div className="gd-shortcuts-table">
        <div className="gd-sc-row">
          <div className="gd-sc-keys"><kbd>Space</kbd></div>
          <div className="gd-sc-desc">Play or pause simulation</div>
        </div>
        <div className="gd-sc-row">
          <div className="gd-sc-keys"><kbd>S</kbd></div>
          <div className="gd-sc-desc">Step one tick (advances single frame)</div>
        </div>
        <div className="gd-sc-row">
          <div className="gd-sc-keys"><kbd>P</kbd></div>
          <div className="gd-sc-desc">Arm Freehand Pen / Marker tool to sketch (<kbd>Esc</kbd> or <kbd>P</kbd> to disarm)</div>
        </div>
        <div className="gd-sc-row">
          <div className="gd-sc-keys"><kbd>T</kbd> / Double-click</div>
          <div className="gd-sc-desc">Add Normal Box, Sticky Note, or Card at cursor (draw.io style)</div>
        </div>
        <div className="gd-sc-row">
          <div className="gd-sc-keys"><kbd>N</kbd> / <kbd>B</kbd></div>
          <div className="gd-sc-desc">Place Text Note (<kbd>N</kbd>) or frame functional tier Section (<kbd>B</kbd>)</div>
        </div>
        <div className="gd-sc-row">
          <div className="gd-sc-keys"><kbd>G</kbd></div>
          <div className="gd-sc-desc">Toggle Snap to Grid</div>
        </div>
        <div className="gd-sc-row">
          <div className="gd-sc-keys"><kbd>Ctrl</kbd> + <kbd>D</kbd></div>
          <div className="gd-sc-desc">Duplicate selected components</div>
        </div>
        <div className="gd-sc-row">
          <div className="gd-sc-keys"><kbd>Shift</kbd> + drag</div>
          <div className="gd-sc-desc">Marquee multi-select nodes, boxes, and ink strokes</div>
        </div>
        <div className="gd-sc-row">
          <div className="gd-sc-keys"><kbd>Del</kbd> / <kbd>Backspace</kbd></div>
          <div className="gd-sc-desc">Delete selected components, boxes, or ink strokes</div>
        </div>
        <div className="gd-sc-row">
          <div className="gd-sc-keys"><kbd>Ctrl</kbd> + <kbd>Z</kbd></div>
          <div className="gd-sc-desc">Undo last canvas or simulation action (<kbd>Shift</kbd> to Redo)</div>
        </div>
        <div className="gd-sc-row">
          <div className="gd-sc-keys"><kbd>Ctrl</kbd> + <kbd>/</kbd></div>
          <div className="gd-sc-desc">Open full keyboard shortcuts dialog</div>
        </div>
        <div className="gd-sc-row">
          <div className="gd-sc-keys"><kbd>?</kbd></div>
          <div className="gd-sc-desc">Toggle distributed systems Glossary &amp; definitions</div>
        </div>
      </div>
    </div>
  );
}
