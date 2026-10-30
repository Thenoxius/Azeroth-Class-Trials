// "How the verdict is reached": the whole method, in plain language, from the
// same constants the analysis uses — so this page cannot drift from the code.
import {
  KIND_LABEL,
  KIND_BLURB,
  OBSERVED_RULES,
  STATUS_FACTOR,
  STATUS_NAMES,
  KIND_CAPS,
  NEUTRAL_PRIOR,
  OBSERVED_VS_SELF,
  DIM_WEIGHT_FORMULA,
  DIM_NAMES,
  DIM_IDS,
  SELF_WEIGHTS,
  FACT_BASE_WEIGHT,
  SELF_MAP,
  KIND_NAMES,
} from '../../analysis/model.js';
import { cx } from '../util.js';

export function Method({ onBack }) {
  return (
    <div className="method">
      <header className="an-head">
        <button type="button" className="btn small ghost" onClick={onBack}>
          ← Back
        </button>
        <h2>How the verdict is reached</h2>
        <span />
      </header>
      <section className="panel">
        <p>
          There is no personality test and no hidden score. Every class gets a score from 0 to 100 on eleven rows (leveling, combat depth, dungeons, raids, PvP,
          world utility, solo independence, short sessions, long-term engagement, role flexibility, character fantasy). Each row starts neutral at 50 and moves
          only when there is evidence. The class total is a weighted average of its rows, using the weights you set.
        </p>
      </section>
      <section className="method-grid">
        {Object.keys(KIND_LABEL).map((k) => (
          <div key={k} className="panel">
            <div className="panel-title">
              <span className={cx('badge', 'kind-' + k)}>{KIND_LABEL[k]}</span>
            </div>
            <p>{KIND_BLURB[k]}</p>
            <p className="muted small">
              Cap per row: total weight {KIND_CAPS[k]} — after that, more items of this kind are scaled down so they cannot drown out the rest.
            </p>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panel-title">Scoring one row</div>
        <ol>
          <li>Every evidence item has a direction (−1 … +1) and a weight.</li>
          <li>
            Each kind’s weights are capped (above). When you have answered questions, observed behaviour may weigh at most {Math.round(OBSERVED_VS_SELF * 100)}{' '}
            % of your answers.
          </li>
          <li>
            Score = 50 + 50 × (Σ weight × direction) ÷ (Σ weight + {NEUTRAL_PRIOR}). The +{NEUTRAL_PRIOR} is an imaginary neutral witness, so one item never
            swings a row to an extreme.
          </li>
          <li>Confidence is “solid” only with real weight from your play or your answers, not from facts alone.</li>
        </ol>
      </section>
      <section className="panel">
        <div className="panel-title">Facts (WoW: Forever research)</div>
        <p>A fact counts with weight {FACT_BASE_WEIGHT} × a source factor, and pushes a row at most ±0.6:</p>
        <ul className="method-status">
          {Object.entries(STATUS_FACTOR).map(([s, f]) => (
            <li key={s}>
              <span className={cx('badge', 'st-' + s)}>{STATUS_NAMES[s]}</span> × {f}
            </li>
          ))}
        </ul>
        <p className="muted small">
          Context facts (neither for nor against) count at 30 % and pull toward neutral. The beta stopped at level 30, so nothing about level 60 is better than
          a guide projection.
        </p>
      </section>
      <section className="panel">
        <div className="panel-title">What you said</div>
        <p>
          After a trial you may answer three scales (enjoyment, how much the class got in your way, would you queue it again) and pick a highlight. “Not sure”
          is stored as no answer, never as a 3.
        </p>
        <ul className="small">
          <li>
            Weights: enjoyment {SELF_WEIGHTS.enjoyment}, frustration {SELF_WEIGHTS.frustration}, play again {SELF_WEIGHTS.again}, highlight{' '}
            {SELF_WEIGHTS.moment}, “none of these” {SELF_WEIGHTS.none}.
          </li>
          <li>
            “Not frustrating” is not the same as fun: low frustration adds only a little; high frustration subtracts a lot. Frustration reported right after a
            loss counts 60 %.
          </li>
          <li>
            Which rows an answer touches:{' '}
            {Object.entries(SELF_MAP)
              .map(
                ([kind, m]) =>
                  `${KIND_NAMES[kind]} → ${Object.entries(m)
                    .map(([d, x]) => `${DIM_NAMES[d]}${x < 1 ? ` (${x})` : ''}`)
                    .join(', ')}`,
              )
              .join(' · ')}
            .
          </li>
        </ul>
      </section>
      <section className="panel">
        <div className="panel-title">What you did — the observed rules</div>
        <p className="muted small">Always compared with your own play on the other classes in the same trial, never with an ideal player.</p>
        <table className="method-rules">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Rows</th>
              <th>What it measures</th>
            </tr>
          </thead>
          <tbody>
            {OBSERVED_RULES.map((r) => (
              <tr key={r.id}>
                <td>
                  <b>{r.id}</b> {r.name}
                </td>
                <td className="small">{r.dims}</td>
                <td className="small">{r.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel">
        <div className="panel-title">How much each row counts</div>
        <table className="method-rules">
          <tbody>
            {DIM_IDS.map((d) => (
              <tr key={d}>
                <td>{DIM_NAMES[d]}</td>
                <td className="small mono">{DIM_WEIGHT_FORMULA[d]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          The sliders on the analysis screen set Questing, Dungeons, Raids, PvP, the depth ↔ convenience balance and how much your existing character should
          matter.
        </p>
      </section>
      <section className="panel">
        <div className="panel-title">What the trials can and cannot tell you</div>
        <ul>
          <li>
            Spell and talent numbers are the real Forever values, read from the live client data (Wowhead’s datamined spellbook, build 1.60.1.70630). Combat
            follows Classic 1.12 rules: armor, misses against higher-level enemies, glancing and crushing blows, spell resistance. Nothing is tuned per class,
            so classes can differ — as they do in the game.
          </li>
          <li>
            Three things are estimates. Gear: Forever items are not public yet, so each level uses typical Classic gear (quest greens at 10 and 30, fresh
            dungeon blues at 60). Enemies: bodies come from real Classic mobs of the same level (health, armor, damage; dungeon zealots are real elites), and
            each trial says how its enemies differ from an ordinary mob. Boss mechanics are our own designs, sized to these numbers.
          </li>
          <li>
            Your dungeon party and raid are real classes too — Warrior tanks with rage and Sunder Armor, Combat Rogues with energy and combo points, Warlocks
            with their curses and banes, Restoration Shamans, and Mage, Priest and Hunter raiders on the same kits you play — with their datamined spells and
            Classic stats, played by an AI that sometimes reacts late. Not modelled yet: the Warlock’s demon pet.
          </li>
          <li>Ability names, levels and mechanics follow the research; every tooltip says where it comes from.</li>
          <li>
            Five short trials are not hundreds of hours. The analysis says “early read” until you have played a fair share, and lists what is still unknown.
          </li>
          <li>Your performance (winning, losing, damage) is only used as capability in solo trials — never as a proxy for whether you liked a class.</li>
        </ul>
      </section>
    </div>
  );
}
