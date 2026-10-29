// App shell: navigation between screens, the two stores, and session bookkeeping.
import { KITS, CLASS_ORDER, PLAYABLE, TRIALS, trialById, trialSupports } from '../content/index.js';
import { RACES, validRace } from '../content/races.js';
import { loadProgress, saveProgress, loadEvidence, saveEvidence, runKey, emptyProgress, emptyEvidence, resetAll } from '../telemetry/store.js';
import { Title } from './screens/Title.jsx';
import { Hall } from './screens/Hall.jsx';
import { Briefing } from './screens/Briefing.jsx';
import { Result } from './screens/Result.jsx';
import { Settings } from './screens/Settings.jsx';
import { Analysis } from './screens/Analysis.jsx';
import { Codex } from './screens/Codex.jsx';
import { Method } from './screens/Method.jsx';
import { Battle } from './battle/Battle.jsx';
import { Roster } from './screens/Roster.jsx';
import { ClassicShell, ClassicBattleFrame } from './chrome/ClassicShell.jsx';
import { CLASSIC_CONFIG } from './chrome/classic-config.js';

const { useState, useEffect, useCallback, useRef, useMemo } = React;

// Developer shortcut: #play-t1-mage-10-frost-dps jumps straight into a fight
// (#brief-… opens the briefing; #screen-hall / #screen-analysis open a screen).
function hashStart() {
  try {
    const h = (window.location.hash || '').slice(1);
    const m = h.match(/^(play|brief)-(t\d)-(\w+)-(\d+)(?:-(\w+))?(?:-(\w+))?$/);
    if (m && KITS[m[3]] && trialById(m[2])) return { screen: m[1] === 'play' ? 'battle' : 'briefing', sel: { trialId: m[2], classId: m[3], level: Number(m[4]), spec: m[5] && m[5] !== 'x' ? m[5] : undefined, role: m[6] || undefined } };
    const s = h.match(/^screen-(\w+)$/);
    if (s) return { screen: s[1] };
  } catch {
    /* no location */
  }
  return null;
}

export function App({ initial }) {
  const [boot] = useState(() => hashStart());
  const [progress, setProgress] = useState(() => (initial && initial.progress) || loadProgress());
  const [evidence, setEvidence] = useState(() => (initial && initial.evidence) || loadEvidence());
  const [screen, setScreen] = useState(() => (boot ? boot.screen : initial && initial.screen && initial.screen !== 'battle' ? initial.screen : 'title'));
  const [sel, setSel] = useState(() => {
    if (boot && boot.sel) {
      const k = KITS[boot.sel.classId];
      const specs = (k.specs && k.specs[boot.sel.level]) || [];
      const t = trialById(boot.sel.trialId);
      return { ...boot.sel, spec: boot.sel.spec || (specs[0] && specs[0].id) || null, role: boot.sel.role || (t.rolesFor ? t.rolesFor(k.id)[0] : 'dps') };
    }
    return (initial && initial.sel) || null;
  });
  const [result, setResult] = useState(null);
  const [battleKey, setBattleKey] = useState(0);
  const [backTo, setBackTo] = useState('hall');
  const seedRef = useRef(1);

  useEffect(() => { saveProgress(progress); }, [progress]);
  useEffect(() => { saveEvidence(evidence); }, [evidence]);
  useEffect(() => {
    try { window.scrollTo(0, 0); } catch { /* ignore */ }
    setEvidence((e) => ({ ...e, ui: [...(e.ui || []).slice(-300), { t: new Date().toISOString(), screen }] }));
  }, [screen]);

  // Keep the current screen across a live republish of the artifact.
  useEffect(() => {
    const hot = window.claude && window.claude.hot;
    if (hot && hot.snapshot) hot.snapshot(() => ({ screen: screen === 'battle' ? 'briefing' : screen === 'result' ? 'hall' : screen, sel }));
  }, [screen, sel]);

  // Characters (race + class + name). Older saves without a roster get the three original
  // characters, with the race last picked per class; a fresh start begins with none.
  const characters = useMemo(() => {
    if (Array.isArray(progress.characters)) return progress.characters;
    if (!evidence.sessions.length && !progress.seenIntro) return [];
    return ['hunter', 'mage', 'priest'].map((c) => { const r = validRace(c, (progress.last.race || {})[c]); return { id: 'legacy-' + c, name: `${RACES[r].name} ${KITS[c].name}`, race: r, classId: c }; });
  }, [progress.characters, progress.last.race, evidence.sessions.length, progress.seenIntro]);
  const setCharacters = (list) => setProgress((p) => ({ ...p, characters: list }));
  // Race shown for a class outside a character context (analysis, codex): its first character's.
  const raceOf = (classId) => validRace(classId, ((characters.find((c) => c.classId === classId) || {}).race) || (progress.last.race || {})[classId]);
  const VIEW_KITS = useMemo(() => Object.fromEntries(Object.entries(KITS).map(([id, k]) => { const r = raceOf(id); return [id, { ...k, race: RACES[r].name, raceId: r, portrait: r + '-' + id }]; })), [characters, progress.last.race]);
  // The selected character's own race and portrait.
  const kit = sel ? { ...VIEW_KITS[sel.classId], ...(sel.race ? { race: RACES[sel.race].name, raceId: sel.race, portrait: sel.race + '-' + sel.classId } : {}) } : null;
  const trial = sel ? trialById(sel.trialId) : null;

  const pick = useCallback((p) => {
    setSel((old) => ({ trialId: p.trialId, classId: p.classId, level: p.level, race: p.race || raceOf(p.classId), charId: p.charId, spec: p.spec ?? (progress.last.spec || {})[`${p.classId}:${p.level}`], role: p.role ?? (progress.last.role || {})[`${p.classId}:${p.trialId}`] }));
    setScreen('briefing');
  }, [progress]);

  const start = ({ spec, role, race }) => {
    setSel((s) => ({ ...s, spec, role, race }));
    setProgress((p) => ({ ...p, seenIntro: true, last: { ...p.last, classId: sel.classId, race: { ...(p.last.race || {}), [sel.classId]: race }, spec: { ...(p.last.spec || {}), [`${sel.classId}:${sel.level}`]: spec }, role: { ...(p.last.role || {}), [`${sel.classId}:${sel.trialId}`]: role } } }));
    seedRef.current = (Date.now() % 100000) + 1;
    setBattleKey((k) => k + 1);
    setScreen('battle');
  };

  const priorSessions = sel ? evidence.sessions.filter((s) => s.trialId === sel.trialId && s.classId === sel.classId && s.level === sel.level) : [];
  const sessionMeta = sel
    ? {
        attempt: priorSessions.length + 1,
        afterWin: priorSessions.some((s) => s.outcome === 'victory'),
        replayOfOtherClass: evidence.sessions.some((s) => s.trialId === sel.trialId && s.classId !== sel.classId),
        seed: seedRef.current,
        orderIndex: evidence.sessions.length,
      }
    : null;

  const onEnd = useCallback(({ session, outcome, summary, abandoned }) => {
    setEvidence((e) => ({ ...e, sessions: [...e.sessions, session] }));
    setProgress((p) => {
      const k = runKey(session.trialId, session.classId, session.level);
      const r = p.runs[k] || { attempts: 0, wins: 0 };
      const won = outcome && outcome.result === 'victory';
      return { ...p, runs: { ...p.runs, [k]: { ...r, attempts: r.attempts + 1, wins: r.wins + (won ? 1 : 0), lastResult: abandoned ? 'abandoned' : outcome ? outcome.result : null, lastAt: new Date().toISOString(), bestTime: won ? Math.min(r.bestTime || 1e9, session.simSeconds) : r.bestTime } } };
    });
    setResult({ session, outcome, summary, abandoned });
    setScreen('result');
  }, []);

  const onFeedback = (fb) => setEvidence((e) => ({ ...e, feedback: [...e.feedback, fb] }));
  const updateSettings = (patch) => setProgress((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

  let body = null;
  if (screen === 'title') {
    body = <Title onStart={() => { setProgress((p) => ({ ...p, seenIntro: true, characters })); setScreen(characters.length ? 'hall' : 'roster'); }} onMethod={() => { setBackTo('title'); setScreen('method'); }} hasProgress={evidence.sessions.length > 0} sessions={evidence.sessions.length} />;
  } else if (screen === 'hall') {
    body = <Hall trials={TRIALS} kits={VIEW_KITS} characters={characters} onRoster={() => setScreen('roster')} progress={progress} evidence={evidence} onPick={pick} onAnalysis={() => setScreen('analysis')} onCodex={() => setScreen('codex')} onSettings={() => setScreen('settings')} onTitle={() => setScreen('title')} />;
  } else if (screen === 'briefing' && kit && trial) {
    body = <Briefing key={(sel.charId || sel.classId) + sel.trialId + sel.level} trial={trial} kit={kit} level={sel.level} initialSpec={sel.spec} initialRole={sel.role} initialRace={sel.race} raceLocked={!!sel.charId} onStart={start} onBack={() => setScreen('hall')} onSwitchCharacter={(c) => pick({ ...sel, classId: c.classId, charId: c.id, race: c.race, spec: undefined, role: undefined })} characters={characters.filter((c) => trialSupports(trial.id, c.classId))} characterId={sel.charId} kits={VIEW_KITS} />;
  } else if (screen === 'battle' && kit && trial) {
    body = <Battle key={battleKey} sel={sel} kit={kit} trial={trial} settings={progress.settings} sessionMeta={sessionMeta} onEnd={onEnd} onSettings={updateSettings} />;
  } else if (screen === 'result' && result && kit && trial) {
    body = (
      <Result
        result={result}
        trial={trial}
        kit={kit}
        sel={sel}
        classOrder={PLAYABLE}
        kits={VIEW_KITS}
        feedbackGiven={evidence.feedback.some((f) => f.sessionId === result.session.id)}
        onFeedback={onFeedback}
        onRetry={() => setScreen('briefing')}
        onOtherClass={(c) => pick({ trialId: sel.trialId, classId: c, level: sel.level })}
        onHall={() => setScreen('hall')}
        onAnalysis={() => setScreen('analysis')}
      />
    );
  } else if (screen === 'analysis') {
    body = <Analysis evidence={evidence} kits={VIEW_KITS} trials={TRIALS} classOrder={CLASS_ORDER} weights={progress.settings.weights} onWeights={(w) => updateSettings({ weights: w })} onBack={() => setScreen('hall')} onMethod={() => { setBackTo('analysis'); setScreen('method'); }} onPlay={pick} />;
  } else if (screen === 'roster') {
    body = <Roster characters={characters} kits={KITS} playable={PLAYABLE} onChange={setCharacters} onDone={() => setScreen('hall')} onBack={characters.length ? () => setScreen('hall') : () => setScreen('title')} trialCount={(c) => TRIALS.filter((t) => trialSupports(t.id, c)).length} />;
  } else if (screen === 'codex') {
    body = <Codex kits={VIEW_KITS} classOrder={CLASS_ORDER} onBack={() => setScreen('hall')} />;
  } else if (screen === 'method') {
    body = <Method onBack={() => setScreen(backTo)} />;
  } else if (screen === 'settings') {
    body = (
      <Settings
        progress={progress}
        evidence={evidence}
        onChange={updateSettings}
        onImport={(v) => { setProgress(v.progress); setEvidence(v.evidence); }}
        onReset={() => { resetAll(); setProgress(emptyProgress()); setEvidence(emptyEvidence()); }}
        onBack={() => setScreen('hall')}
      />
    );
  } else {
    body = <Hall trials={TRIALS} kits={VIEW_KITS} characters={characters} onRoster={() => setScreen('roster')} progress={progress} evidence={evidence} onPick={pick} onAnalysis={() => setScreen('analysis')} onCodex={() => setScreen('codex')} onSettings={() => setScreen('settings')} onTitle={() => setScreen('title')} />;
  }
  if (screen === 'battle') return <ClassicBattleFrame>{body}</ClassicBattleFrame>;
  const navigateClassic = (destination) => {
    if (destination === 'method' && screen !== 'method') setBackTo(screen);
    setScreen(destination === 'hall' && !characters.length ? 'roster' : destination);
  };
  return <ClassicShell screen={screen} onNavigate={navigateClassic} hasCharacters={characters.length > 0} supportHref={CLASSIC_CONFIG.supportHref}>
    <div className={'app screen-' + screen}>{body}</div>
  </ClassicShell>;
}
