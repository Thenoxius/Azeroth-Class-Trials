// The Forever codex: what is known about WoW: Forever for the playable classes,
// with every line's source status, and the open questions.
import { GLOBAL_FACTS, CLASS_FACTS, SOURCES, RESEARCH_DATE } from '../../content/facts.js';
import { STATUS_SHORT, STATUS_LABEL, CLASS_COLORS, cx } from '../util.js';
import { DIM_NAMES } from '../../analysis/model.js';

const { useState } = React;

const Badge = ({ status }) => <span className={cx('badge', 'st-' + status)} title={STATUS_LABEL[status] || status}>{STATUS_SHORT[status] || status}</span>;
const src = (id) => SOURCES.find((s) => s.id === id);

function SourceLink({ id }) {
  const s = src(id);
  if (!s) return null;
  return <a className="cx-src" href={s.url} target="_blank" rel="noreferrer noopener" title={s.title}>{s.title.split(' — ')[0]}</a>;
}

export function Codex({ onBack, kits, classOrder }) {
  const [tab, setTab] = useState('global');
  const tabs = [['global', 'WoW: Forever'], ...classOrder.map((c) => [c, kits[c].name]), ['sources', 'Sources']];
  return (
    <div className="codex">
      <header className="an-head">
        <button type="button" className="btn small ghost" onClick={onBack}>← Hall</button>
        <h2>Forever codex</h2>
        <span className="muted small">Beta research as of {RESEARCH_DATE} · the live game may differ</span>
      </header>
      <div className="cx-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button type="button" role="tab" aria-selected={tab === id} key={id} className={cx('chip', tab === id && 'on')} style={CLASS_COLORS[id] ? { '--cc': CLASS_COLORS[id] } : undefined} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'global' && (
        <section className="panel">
          <ul className="cx-facts">
            {GLOBAL_FACTS.map((f, i) => (
              <li key={i}><b>{f.topic}</b> <Badge status={f.status} /> {f.text} <SourceLink id={f.src} /></li>
            ))}
          </ul>
        </section>
      )}
      {CLASS_FACTS[tab] && <ClassPage cls={tab} kit={kits[tab]} f={CLASS_FACTS[tab]} />}
      {tab === 'sources' && (
        <section className="panel">
          <ul className="cx-facts">
            {SOURCES.map((s) => (
              <li key={s.id}><span className="badge">{s.kind}</span> <a href={s.url} target="_blank" rel="noreferrer noopener">{s.title}</a> <span className="muted small">{s.date}</span></li>
            ))}
          </ul>
          <p className="muted small">Icy Veins, Warcraft Tavern and Wowhead pages were read during the beta; official Blizzard deep dives and development notes take precedence where they disagree.</p>
        </section>
      )}
    </div>
  );
}

function ClassPage({ cls, kit, f }) {
  return (
    <div className="cx-class" style={{ '--cc': kit.color }}>
      <section className="panel">
        <h3 style={{ color: kit.color }}>{kit.name}</h3>
        <p>{f.summary}</p>
        <p className="muted">{f.identity}</p>
      </section>
      <section className="cx-specs">
        {f.specs.map((s) => (
          <div key={s.id} className="panel">
            <div className="panel-title">{s.name} <span className="muted small">· {s.role}</span></div>
            <p>{s.identity}</p>
            <p className="small"><b>At level 60:</b> {s.raidLoop} <span className="muted">({s.loopStatus})</span></p>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panel-title">Toolkit by level (highlights)</div>
        <div className="cx-toolkit">
          {Object.entries(f.toolkit).map(([lv, names]) => (
            <div key={lv}><b>Level {lv}</b><p className="small">{names.join(' · ')}</p></div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-title">For and against, per row</div>
        {Object.entries(f.dims).map(([dim, list]) => (
          <div key={dim} className="cx-dim">
            <div className="cx-dim-name">{DIM_NAMES[dim]}</div>
            <ul className="cx-facts">
              {list.map((x, i) => (
                <li key={i} className={x.sign > 0 ? 'pos' : x.sign < 0 ? 'neg' : 'neu'}>{x.sign > 0 ? '▲' : x.sign < 0 ? '▼' : '•'} <Badge status={x.status} /> {x.text} <SourceLink id={x.src} /></li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <section className="cx-two">
        <div className="panel"><div className="panel-title">Risks</div><ul>{f.risks.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
        <div className="panel"><div className="panel-title">Open questions</div><ul>{f.openQuestions.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
      </section>
    </div>
  );
}
