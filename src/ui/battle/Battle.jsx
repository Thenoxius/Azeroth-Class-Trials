// The battle screen: owns the simulation loop, input, HUD and telemetry feed.
import {
  createBattle,
  step,
  drainEvents,
  playerCast,
  setMoveDir,
  moveTo,
  setTarget,
  cycleTarget,
  petCommand,
  petCast,
  togglePetAutocast,
  stopCasting,
} from '../../engine/core.js';
import { createTracker } from '../../telemetry/tracker.js';
import { Battlefield } from './Battlefield.jsx';
import { UnitFrame, PartyFrames, RaidFrames, PlayerCastBar } from './Frames.jsx';
import { ActionButton, AbilityTooltip, PetBar } from './ActionBar.jsx';
import { createFx, ingestFx, pruneFx } from './fx.js';
import { HOTKEYS, fmtTime, fmtNum, cx } from '../util.js';

const { useEffect, useRef, useState, useCallback, useMemo } = React;

const DT = 0.05;
const SPEEDS = [0.5, 0.75, 1, 1.25];
const MOVE_KEYS = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };

export function Battle({ sel, kit, trial, settings, sessionMeta, onEnd, onExit, onSettings }) {
  const stateRef = useRef(null);
  const fxRef = useRef(null);
  const trackerRef = useRef(null);
  const keysRef = useRef(new Set());
  const [, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [autoPaused, setAutoPaused] = useState(false);
  const [speed, setSpeed] = useState(settings.speed || 1);
  const [hover, setHover] = useState(null); // {id, pet}
  const [targeting, setTargeting] = useState(null); // ability id awaiting a ground click
  const hoverMemberRef = useRef(null); // party/raid frame under the mouse: heals hotkeyed there go to it
  const [cursor, setCursor] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [showLog, setShowLog] = useState(true);
  const [ended, setEnded] = useState(false);
  const pausedRef = useRef(false);
  const speedRef = useRef(speed);
  const endedRef = useRef(false);

  if (!stateRef.current) {
    stateRef.current = createBattle(trial, {
      classId: kit.id,
      level: sel.level,
      spec: sel.spec,
      role: sel.role,
      race: sel.race,
      trialId: trial.id,
      kit,
      seed: sessionMeta.seed,
    });
    fxRef.current = createFx();
    trackerRef.current = createTracker({
      ...sessionMeta,
      trialId: trial.id,
      classId: kit.id,
      level: sel.level,
      spec: sel.spec,
      role: sel.role,
      race: sel.race,
      kind: trial.kind,
    });
    const p = stateRef.current.units[stateRef.current.playerId];
    if (p) p.flags.wandMacro = settings.wandMacro !== false;
  }
  const state = stateRef.current;
  if (typeof window !== 'undefined') window.__act = state; // debugging aid
  const fx = fxRef.current;
  const tracker = trackerRef.current;
  const P = state.units[state.playerId];
  const pet = P && P.petId ? state.units[P.petId] : null;
  const build = state.build || { bar: [], consumables: [] };

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const finish = useCallback(
    (extra = {}) => {
      if (endedRef.current) return;
      endedRef.current = true;
      setEnded(true);
      const s = stateRef.current;
      const session = tracker.finish(s, extra);
      onEnd({
        session,
        outcome: s.outcome,
        summary: trial.summary ? trial.summary(s) : [],
        report: trial.report && !extra.abandoned ? trial.report(s) : null,
        state: s,
        abandoned: !!extra.abandoned,
      });
    },
    [onEnd, trial, tracker],
  );

  // Main loop.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let outcomeAt = null;
    const loop = (now) => {
      const real = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      if (!pausedRef.current && !endedRef.current) {
        acc += real * speedRef.current;
        let n = 0;
        while (acc >= DT && n < 6) {
          step(s, DT);
          acc -= DT;
          n++;
        }
      }
      const evs = drainEvents(s);
      tracker.ingest(evs, s);
      ingestFx(fx, evs, s);
      pruneFx(fx, s.t);
      if (s.outcome && outcomeAt === null) outcomeAt = now;
      if (outcomeAt !== null && now - outcomeAt > 1800) finish();
      setFrame((f) => (f + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [finish, fx, tracker]);

  const togglePause = useCallback(
    (why = 'manual') => {
      setPaused((p) => {
        const np = !p;
        tracker.ui(np ? 'pause' : 'resume', { why });
        return np;
      });
      setAutoPaused(false);
    },
    [tracker],
  );

  // Auto-pause when the tab is hidden (a child needs you — the fight waits).
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && !pausedRef.current && !endedRef.current) {
        setPaused(true);
        setAutoPaused(true);
        tracker.ui('pause', { why: 'hidden' });
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [tracker]);

  const useAbility = useCallback(
    (id, opts = {}) => {
      const s = stateRef.current;
      const p = s.units[s.playerId];
      if (!p || endedRef.current) return;
      const ab = p.ab[id];
      if (!ab) return;
      if (ab.target === 'point' && !opts.point) {
        setTargeting(id);
        tracker.ui('targeting', { ability: id });
        return;
      }
      setTargeting(null);
      // Mouseover healing: a helpful spell cast while hovering a party frame lands on that member.
      const hm = hoverMemberRef.current && s.units[hoverMemberRef.current];
      if (!opts.targetId && hm && hm.alive && (ab.target === 'ally' || ab.target === 'any')) {
        tracker.ui('mouseover', { ability: id });
        opts = { ...opts, targetId: hm.id };
      }
      playerCast(s, id, opts);
    },
    [tracker],
  );

  const doPetCommand = useCallback((cmd) => petCommand(stateRef.current, cmd), []);
  const doPetAbility = useCallback((id) => petCast(stateRef.current, id), []);
  const doToggleAuto = useCallback((id) => togglePetAutocast(stateRef.current, id), []);

  const partyList = useMemo(
    () => () => stateRef.current.list.filter((u) => u.side === 'player' && !u.hidden && (u.kind === 'ally' || u.kind === 'player' || u.kind === 'pet')),
    [],
  );

  // Keyboard.
  useEffect(() => {
    const updateMove = () => {
      let x = 0,
        y = 0;
      for (const k of keysRef.current) {
        const v = MOVE_KEYS[k];
        if (v) {
          x += v[0];
          y += v[1];
        }
      }
      setMoveDir(stateRef.current, x || y ? { x, y } : null);
    };
    const onDown = (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (endedRef.current) return;
      const k = e.key.toLowerCase();
      if (MOVE_KEYS[k]) {
        if (!keysRef.current.has(k)) {
          keysRef.current.add(k);
          updateMove();
        }
        e.preventDefault();
        return;
      }
      if (k === ' ') {
        e.preventDefault();
        togglePause('key');
        return;
      }
      if (k === 'tab') {
        e.preventDefault();
        cycleTarget(stateRef.current);
        return;
      }
      if (k === 'escape') {
        setTargeting(null);
        stopCasting(stateRef.current);
        return;
      }
      if (/^f[1-5]$/.test(k)) {
        e.preventDefault();
        const m = partyList()[Number(k.slice(1)) - 1];
        if (m) setTarget(stateRef.current, m.id);
        return;
      }
      const s = stateRef.current;
      if (e.shiftKey && /^digit[1-9]$/.test(e.code.toLowerCase())) {
        e.preventDefault();
        const n = Number(e.code.slice(5)) - 1;
        const cmds = ['attack', 'follow', 'stay'];
        if (n < 3) doPetCommand(cmds[n]);
        else {
          const pb = (s.build && s.build.pet && s.build.pet.bar) || [];
          if (pb[n - 3]) doPetAbility(pb[n - 3]);
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const keyLabel = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const slots = [...(s.build ? s.build.bar : []), ...(s.build ? s.build.consumables : [])];
      const idx = HOTKEYS.indexOf(keyLabel);
      if (idx >= 0 && slots[idx]) {
        e.preventDefault();
        useAbility(slots[idx]);
      }
    };
    const onUp = (e) => {
      const k = e.key.toLowerCase();
      if (keysRef.current.has(k)) {
        keysRef.current.delete(k);
        updateMove();
      }
    };
    const onBlur = () => {
      keysRef.current.clear();
      setMoveDir(stateRef.current, null);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [togglePause, useAbility, doPetCommand, doPetAbility, partyList]);

  const onGround = useCallback(
    (w, e) => {
      const s = stateRef.current;
      if (targeting) {
        useAbility(targeting, { point: w });
        setTargeting(null);
        return;
      }
      if (e.button === 2) return;
      moveTo(s, w.x, w.y);
    },
    [targeting, useAbility],
  );
  const onUnit = useCallback((u, e) => {
    const s = stateRef.current;
    setTarget(s, u.id);
    if (e && e.button === 2 && s.units[s.playerId] && s.units[s.playerId].petId && u.side === 'enemy') petCommand(s, 'attack', u.id);
  }, []);

  const onSpeed = (v) => {
    setSpeed(v);
    tracker.ui('speed', { speed: v });
    onSettings && onSettings({ speed: v });
  };

  const autopilotOn = P && P.flags.autopilot;
  const toggleAutopilot = () => {
    if (!P) return;
    P.flags.autopilot = autopilotOn ? null : build.filler;
    tracker.ui('autopilot', { on: !autopilotOn, ability: build.filler });
  };

  const leave = () => {
    tracker.ui('abandon', {});
    finish({ abandoned: true });
  };

  const tgt = P && P.target ? state.units[P.target] : null;
  const objectives = trial.objectives ? trial.objectives(state) : [];
  const hoverAb = hover && (hover.pet ? pet && pet.ab[hover.id] : P && P.ab[hover.id]);
  let hoverRing = null;
  const ringAb = targeting ? P && P.ab[targeting] : hoverAb;
  if (ringAb && P) {
    const aoe = (ringAb.effects || []).find((x) => x.aoe);
    if (targeting && aoe)
      hoverRing = {
        r: typeof aoe.aoe.radius === 'number' ? aoe.aoe.radius : 8,
        school: ringAb.school,
        at: 'cursor',
        x: cursor && cursor.x,
        y: cursor && cursor.y,
        fill: true,
      };
    else if (ringAb.target === 'none' && aoe) hoverRing = { r: typeof aoe.aoe.radius === 'number' ? aoe.aoe.radius : 8, school: ringAb.school, fill: true };
    else if (ringAb.range && ringAb.target !== 'self')
      hoverRing = { r: typeof ringAb.range === 'number' ? ringAb.range : 30, school: ringAb.school, min: ringAb.minRange };
  }
  const hud = trial.hud || {};
  const showParty = hud.party || state.list.some((u) => u.kind === 'ally');
  const raidMode = hud.raid;
  const errors = fx.errors;
  const banner = state.banner && state.banner.until > state.t ? state.banner : null;
  const slots = [...build.bar];
  const consumables = build.consumables || [];
  const meterRows = hud.meters ? meters(state) : null;

  return (
    <div className={cx('battle', 'theme-' + (state.arena.theme || 'forest'))}>
      <header className="b-top">
        <div className="b-title">
          <span className="b-trial">{trial.title}</span>
          <span className="b-place">
            {trial.place} · Level {sel.level} {kit.name}
            {sel.spec ? ` · ${specName(kit, sel)}` : ''}
            {sel.role === 'healer' ? ' · Healer' : ''}
          </span>
        </div>
        <div className="b-controls">
          <span className="b-clock" title="Fight time">
            {fmtTime(state.t)}
          </span>
          <button type="button" className={cx('btn', 'small', paused && 'on')} onClick={() => togglePause('button')}>
            {paused ? 'Resume' : 'Pause'} <kbd>Space</kbd>
          </button>
          <div className="seg" role="group" aria-label="Game speed">
            {SPEEDS.map((v) => (
              <button type="button" key={v} className={cx('seg-b', speed === v && 'on')} onClick={() => onSpeed(v)}>
                {v}×
              </button>
            ))}
          </div>
          {build.filler && trial.kind === 'raid' && (
            <button
              type="button"
              className={cx('btn', 'small', autopilotOn && 'on')}
              onClick={toggleAutopilot}
              title="When on, your filler spell is cast automatically whenever you are idle. Everything else stays manual."
            >
              Filler autopilot {autopilotOn ? 'on' : 'off'}
            </button>
          )}
          <button type="button" className="btn small ghost" onClick={() => setConfirmLeave(true)}>
            Leave
          </button>
        </div>
      </header>

      <div className={cx('b-main', showParty && 'with-party', raidMode && 'with-raid')}>
        {showParty && (
          <aside className="b-side">
            {raidMode ? (
              <RaidFrames
                state={state}
                onPick={(u) => setTarget(state, u.id)}
                onHoverMember={(id) => (hoverMemberRef.current = id)}
                selectedId={P && P.target}
                kitColor={kit.color}
              />
            ) : (
              <PartyFrames
                state={state}
                onPick={(u) => setTarget(state, u.id)}
                onHoverMember={(id) => (hoverMemberRef.current = id)}
                selectedId={P && P.target}
                kitColor={kit.color}
              />
            )}
            <p className="b-side-hint">Click a frame to target it. Hover a frame and press a heal key to heal that member.</p>
            {meterRows && <Meters rows={meterRows} />}
          </aside>
        )}
        <div className="b-field">
          <div className="b-frames">
            <div className="b-frames-left">
              <UnitFrame u={P} kind="player" state={state} kitColor={kit.color} />
              {pet && <UnitFrame u={pet} kind="pet" state={state} kitColor={kit.color} compact onClick={() => setTarget(state, pet.id)} />}
            </div>
            <UnitFrame u={tgt} kind="target" state={state} kitColor={kit.color} />
          </div>
          <div className="b-stage">
            <Battlefield
              state={state}
              fx={fx}
              kitColor={kit.color}
              targeting={!!targeting}
              hoverRing={hoverRing}
              onGround={onGround}
              onUnit={onUnit}
              onHover={targeting ? setCursor : null}
            />
          </div>
          {errors.length > 0 && (
            <div className="b-errors" role="status">
              {errors.slice(-2).map((e) => (
                <div key={e.id}>{e.text}</div>
              ))}
            </div>
          )}
          {banner && (
            <div key={banner.seq} className={cx('b-banner', 'tone-' + banner.tone)}>
              <div className="b-banner-text">{banner.text}</div>
              {banner.sub && <div className="b-banner-sub">{banner.sub}</div>}
            </div>
          )}
          {targeting && <div className="b-hint">Click the ground to place {P && P.ab[targeting] ? P.ab[targeting].name : ''} · Esc to cancel</div>}
          {paused && !ended && (
            <div className="b-paused" onClick={() => togglePause('overlay')}>
              <div className="b-paused-card" onClick={(e) => e.stopPropagation()}>
                <div className="b-paused-title">Paused</div>
                <p>{autoPaused ? 'The game paused itself when you switched away.' : 'Take your time. You can still pick targets and queue an ability.'}</p>
                <button type="button" className="btn primary" onClick={() => togglePause('overlay')}>
                  Resume
                </button>
              </div>
            </div>
          )}
          {state.outcome && (
            <div className={cx('b-outcome', 'o-' + state.outcome.result)}>
              <div className="b-outcome-text">{state.outcome.result === 'victory' ? 'Victory' : state.outcome.result === 'escaped' ? 'Escaped' : 'Defeat'}</div>
              <div className="b-outcome-sub">{state.outcome.reason}</div>
            </div>
          )}
        </div>
        <aside className="b-right">
          {objectives.length > 0 && (
            <div className="objectives">
              <div className="panel-title">Objectives</div>
              {objectives.map((o, i) => (
                <div key={i} className={cx('obj', o.done && 'done', o.failed && 'failed')}>
                  <span className="obj-mark">{o.done ? '✔' : o.failed ? '✖' : '•'}</span>
                  <span>{o.text}</span>
                  {o.progress && <span className="obj-prog">{o.progress}</span>}
                </div>
              ))}
            </div>
          )}
          {!showParty && meterRows && <Meters rows={meterRows} />}
          <div className={cx('log', !showLog && 'collapsed')}>
            <button type="button" className="panel-title as-btn" onClick={() => setShowLog((v) => !v)} aria-expanded={showLog}>
              Combat log {showLog ? '▾' : '▸'}
            </button>
            {showLog && (
              <div className="log-lines">
                {fx.log.slice(-14).map((l, i) => (
                  <div key={i} className={'ll ll-' + l.kind}>
                    <span className="ll-t">{fmtTime(l.t)}</span> {l.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      <footer className="b-bottom">
        <PlayerCastBar u={P} />
        <div className="bars">
          <div className="actionbar" role="toolbar" aria-label="Abilities">
            {slots.map((id, i) => (
              <ActionButton
                key={id}
                state={state}
                u={P}
                id={id}
                hotkey={HOTKEYS[i]}
                onUse={(x) => useAbility(x)}
                onHover={(x) => setHover(x ? { id: x } : null)}
                queued={P && P.queued && P.queued.id === id}
              />
            ))}
          </div>
          <div className="actionbar consum" role="toolbar" aria-label="Consumables">
            {consumables.map((id, i) => (
              <ActionButton
                key={id}
                small
                state={state}
                u={P}
                id={id}
                hotkey={HOTKEYS[slots.length + i]}
                onUse={(x) => useAbility(x)}
                onHover={(x) => setHover(x ? { id: x } : null)}
              />
            ))}
          </div>
          {pet && (
            <PetBar
              state={state}
              pet={pet}
              bar={build.pet && build.pet.bar}
              onCommand={(c) => doPetCommand(c)}
              onPetAbility={doPetAbility}
              onToggleAuto={doToggleAuto}
              onHover={(x, isPet) => setHover(x ? { id: x, pet: isPet } : null)}
            />
          )}
        </div>
        <div className="b-help">
          {/* The tooltip floats over the help text so the footer (and the battlefield) never resizes. */}
          {hover && <AbilityTooltip state={state} u={P} id={hover.id} petUnit={hover.pet ? pet : null} />}
          {
            <div className="controls-help" style={hover ? { visibility: 'hidden' } : undefined}>
              <b>Move</b> WASD / arrows or click the ground · <b>Target</b> click a unit, Tab{showParty ? ', F1–F5 or a party frame' : ''} · <b>Cast</b> 1–0, -,
              = or click · <b>Pause</b> Space{pet ? ' · Pet: Shift+1–6, right-click an enemy to send it' : ''}
              {build.loopHint && <div className="loop-hint">{build.loopHint}</div>}
            </div>
          }
        </div>
      </footer>

      {confirmLeave && (
        <div className="modal-back" onClick={() => setConfirmLeave(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Leave trial">
            <h3>Leave this trial?</h3>
            <p>The attempt is recorded as left early. That is useful information too — leaving a fight you’re not enjoying says something.</p>
            <div className="row gap">
              <button type="button" className="btn" onClick={() => setConfirmLeave(false)}>
                Keep playing
              </button>
              <button type="button" className="btn danger" onClick={leave}>
                Leave trial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function specName(kit, sel) {
  const list = (kit.specs && (kit.specs[sel.level] || kit.specs[60] || kit.specs[30])) || [];
  const s = list.find((x) => x.id === sel.spec);
  return s ? s.name : sel.spec;
}

function meters(state) {
  const rows = [];
  const dur = Math.max(1, state.combatStart != null ? state.t - state.combatStart : state.t);
  for (const u of state.list) {
    if (u.side !== 'player' || u.hidden) continue;
    const dmg = state.meters.dmg[u.id] || 0;
    const heal = state.meters.heal[u.id] || 0;
    if (!dmg && !heal) continue;
    rows.push({
      id: u.id,
      name: u.id === state.playerId ? 'You' : u.kind === 'pet' ? u.name + ' (pet)' : u.name,
      dmg,
      heal,
      dps: dmg / dur,
      hps: heal / dur,
      classId: u.classId,
      me: u.id === state.playerId || u.kind === 'pet',
    });
  }
  return rows;
}

function Meters({ rows }) {
  const [mode, setMode] = useState('dmg');
  const list = [...rows].sort((a, b) => b[mode] - a[mode]).filter((r) => r[mode] > 0);
  const top = list.length ? list[0][mode] : 1;
  return (
    <div className="meters">
      <div className="panel-title">
        <button type="button" className={cx('linkish', mode === 'dmg' && 'on')} onClick={() => setMode('dmg')}>
          Damage
        </button>
        <button type="button" className={cx('linkish', mode === 'heal' && 'on')} onClick={() => setMode('heal')}>
          Healing
        </button>
      </div>
      {list.slice(0, 8).map((r) => (
        <div key={r.id} className={cx('meter', r.me && 'me')}>
          <div className="meter-fill" style={{ width: `${(r[mode] / top) * 100}%` }} />
          <span className="meter-name">{r.name}</span>
          <span className="meter-val">
            {fmtNum(r[mode])} ({fmtNum(mode === 'dmg' ? r.dps : r.hps)}/s)
          </span>
        </div>
      ))}
      {!list.length && <div className="muted small">No numbers yet.</div>}
    </div>
  );
}
