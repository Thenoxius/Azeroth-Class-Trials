// Settings and data: defaults, export/import, reset.
import { exportJSON, importJSON } from '../../telemetry/store.js';
import { cx } from '../util.js';

const { useState } = React;

export function Settings({ progress, evidence, onChange, onImport, onReset, onBack }) {
  const s = progress.settings;
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const exportText = exportJSON(progress, evidence);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setMsg('Copied to the clipboard.');
    } catch {
      setMsg('Copy was blocked here. Select the text in the box and copy it by hand.');
    }
  };
  const doImport = () => {
    try {
      const v = importJSON(text);
      onImport(v);
      setMsg(`Imported ${v.evidence.sessions.length} sessions.`);
      setText('');
    } catch (e) {
      setMsg(e.message || 'That text could not be read.');
    }
  };
  return (
    <div className="settings">
      <header className="hall-head">
        <button type="button" className="btn small ghost" onClick={onBack}>
          ← Hall
        </button>
        <h2>Settings &amp; data</h2>
        <span />
      </header>
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-title">Play</div>
          <label className="field">
            <span>Default game speed</span>
            <select id="set-speed" value={s.speed} onChange={(e) => onChange({ speed: Number(e.target.value) })}>
              {[0.5, 0.75, 1, 1.25].map((v) => (
                <option key={v} value={v}>
                  {v}×
                </option>
              ))}
            </select>
          </label>
          <label className="field check">
            <input id="set-wand" type="checkbox" checked={s.wandMacro !== false} onChange={(e) => onChange({ wandMacro: e.target.checked })} />
            <span>Priest wand resumes after a spell (like the common “/cast + /shoot” macro)</span>
          </label>
          <p className="muted small">Speed changes are recorded with each attempt, but they are never read as liking or disliking a class.</p>
        </section>
        <section className="panel">
          <div className="panel-title">Your data</div>
          <p className="small">
            {evidence.sessions.length} attempts and {evidence.feedback.length} feedback notes are stored in this browser only. Gameplay progress and preference
            evidence are kept in separate stores.
          </p>
          <textarea id="set-export" className="mono" readOnly value={exportText} rows={5} onFocus={(e) => e.target.select()} />
          <div className="row gap">
            <button type="button" className="btn small" onClick={copy}>
              Copy export
            </button>
          </div>
          <textarea
            id="set-import"
            className="mono"
            placeholder="Paste an export here to restore it"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
          />
          <div className="row gap">
            <button type="button" className="btn small" onClick={doImport} disabled={!text.trim()}>
              Import
            </button>
            {!confirmReset ? (
              <button type="button" className="btn small danger" onClick={() => setConfirmReset(true)}>
                Erase everything…
              </button>
            ) : (
              <>
                <span className="small">Erase all progress and evidence?</span>
                <button
                  type="button"
                  className="btn small danger"
                  onClick={() => {
                    onReset();
                    setConfirmReset(false);
                    setMsg('Everything was erased.');
                  }}
                >
                  Yes, erase
                </button>
                <button type="button" className="btn small" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </>
            )}
          </div>
          {msg && <p className={cx('small', 'note')}>{msg}</p>}
        </section>
      </div>
    </div>
  );
}
