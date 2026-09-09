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
          <div className="gd-sc-keys"><kbd>G</kbd></div>
          <div className="gd-sc-desc">Toggle Snap to Grid</div>
        </div>
        <div className="gd-sc-row">
          <div className="gd-sc-keys"><kbd>N</kbd> / <kbd>B</kbd></div>
          <div className="gd-sc-desc">Arm Note tool (<kbd>N</kbd>) or Section Frame tool (<kbd>B</kbd>)</div>
        </div>
        <div className="gd-sc-row">
          <div className="gd-sc-keys"><kbd>T</kbd></div>
          <div className="gd-sc-desc">Arm Text Box tool (<kbd>T</kbd>), or double-click the canvas (draw.io style)</div>
        </div>
        <div className="gd-sc-row">
          <div className="gd-sc-keys"><kbd>P</kbd></div>
          <div className="gd-sc-desc">Arm Pen tool (<kbd>P</kbd>) and draw freehand</div>
        </div>
        <div className="gd-sc-row">
          <div className="gd-sc-keys"><kbd>Ctrl</kbd> + <kbd>D</kbd></div>
          <div className="gd-sc-desc">Duplicate selected components</div>
        </div>
        <div className="gd-sc-row">
          <div className="gd-sc-keys"><kbd>Shift</kbd> + drag</div>
          <div className="gd-sc-desc">Marquee box-select multiple nodes</div>
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
