# Phase 4 — progress log (resume here)

Branch: `phase4` (local only). Thomas: **push only when phase 4 is finished**;
until then commit on this branch and do not publish the artifact.
`main` on GitHub = v12 (published artifact) + the phase 4 plan.

Plan and decisions: `design/phase4.md`. Data: `research/forever-warrior-rogue.json`.

## Done

- 2026-10-27 — Engine cast gates in `src/engine/core.js` `canCast`:
  `ab.requiresStance` (array of stance ids, checked against `u.stance`),
  `ab.requiresStealth` (`u.flags.stealthed`), `ab.requiresBehind` (uses the new
  exported `isBehind(u, t)`: outside the 180° cone the target faces). Failure
  texts `stance` / `stealth` / `behind` in `REASONS`. Test:
  `tests/phase4-engine.test.mjs`. Suite 14/14.
- 2026-10-29 — Engine step 1 finished (all in `tests/phase4-engine.test.mjs`, suite 14/14):
  - **Stances** (`classes/warrior.js` `STANCES`, abilities `warrior.stance.*`):
    a permanent aura with `def.stance` sets `u.stance` in `computeCC`; a swap removes the
    old stance and keeps rage up to `rageKept(u)` (Tactical Mastery 10 from level 14,
    +15 with `impTacticalMastery`). The NPC tank's Defensive Stance aura carries
    `stance: 'defensive'`.
  - **Stealth** (`classes/rogue.js` `STEALTH`, ability `rogue.stealth`): `def.stealth`
    sets `u.flags.stealthed`; −30 % speed (slow); breaks on action (`cancelOnAction`;
    Sap-like abilities use `keepsAura: 'rogue.stealth'`), on damage taken and dealt; no
    white swings while stealthed; mobs notice a stealthed unit at 35 % of their aggro
    radius (`ai.js` `STEALTH_DETECT`, approximation).
  - **Poisons**: engine hook `onWeaponHit({ dst, pk, hand })` after every landed melee
    hit; `classes/rogue.js` `POISONS` + `poisonOnHit` (Instant, Deadly ×5, Crippling,
    Mind-numbing; Forever ranks at 30/60); poison per hand in `u.meta.poisons = { mh, oh }`.
  - **Warrior hooks**: `onAttackAvoided({ dst, avoid })` for the attacker on a
    dodge/parry (Overpower readiness); `ab.resetsSwing` restarts the swing timer when the
    cast lands (Slam). Charge/Intercept need no engine work: the `teleport` effect, a
    stun aura and `outOfCombat` / `noRoot` already exist (see `t4.charge`).
  - **Dual wield**: `melee.oh = { min, max, speed, coef?, mult? }` swings on its own
    timer (`u.ohSwingT`) for 50 %, with the `melee.dualWield` miss penalty, hand 'oh'.

- 2026-10-29 — **Playable Warrior** (plan step 2), `classes/warrior.js`:
  - `KIT.build(opts)`: `opts.npc` → the old Protection NPC build (`npcBuild`, party.js now
    passes `npc: true`); otherwise `playerBuild` + `applyRace`. Specs Arms / Fury /
    Protection at 30 and 60 (`specsFor`: tank role = Protection), level 10 without spec.
    `rolesFor`: T3/T5 offer dps or tank. Races: orc, troll, tauren, undead, skyborne.
  - New abilities (Forever ranks at 10/30/60): Attack (melee toggle), Charge, Rend,
    Hamstring, Overpower, Execute, Slam (18 s cd in Forever), Mortal Strike / Bloodthirst
    (trained at 48), Whirlwind, Victory Rush, Intercept, Pummel, Berserker Rage, Battle
    Shout, Intimidating Shout, Retaliation, Recklessness, Death Wish. Revenge, Shield
    Block and Taunt now need Defensive Stance. Level-10 ranks for Sunder, Heroic Strike,
    Thunder Clap.
  - Talents: `PLAYER_TALENTS` (Arms/Fury 21 and 51 points; Protection reuses `TALENTS`);
    hooks for Overpower ready, Victory Rush ready, Deep Wounds, Flurry, Unbridled Wrath,
    Enrage, Anger Management.
  - Gear/weapons in `stats.js`: `GEAR.warriorDps`, `warriorTank[10]`, `WEAPONS.twoHand`,
    `fury1h`, `tank1h[10]` (our estimates, raised once after the dummy check).
  - **Forever rage rules** in `core.js` (Blizzard dev notes): player Warriors gain 100 %
    more rage from critical white hits; rage is computed from damage before armor (the
    "rebalanced for 20–40 % armor" note, details unpublished — approximation).
  - Bot `tests/bots/warrior.mjs`; test `tests/warrior-kit.test.mjs` (builds × races,
    stance starts, T1 L10/L30 and T2 L30 for Arms/Fury: competent 3/3, careless 0–1/3).
  - `races.test.mjs` checks classes outside CLASS_ORDER via `NPC_KITS`. Art rebuilt
    (`npm run art`): all Warrior race portraits bundled. Suite 15/15.
  - **Open balance item:** dummy DPS at 60 is Arms ≈160, Fury ≈225 (Hunter 329, Mage 429;
    band 230–520). On a dummy nobody hits the Warrior, so rage starves; trials are fine.
    Revisit in the balance pass (talent values, gear, maybe Forever's rage numbers).
  - Warrior is **not yet in `CLASS_ORDER`**: T3/T4/T5 and the UI need it first.

- 2026-10-28 — **Character roster** (Thomas asked for it early; plan UI step pulled forward):
  - `progress.characters = [{ id, name, race, classId, createdAt }]`. A fresh start
    goes Title → Roster (`ui/screens/Roster.jsx`: pick class, then race, optional name;
    remove characters). Old saves get three legacy characters (Orc Hunter / Undead Mage /
    Undead Priest, or the race last picked per class).
  - Hall columns are characters (rotated per trial); runs stay keyed per **class**
    (`runKey`), so two characters of one class share progress — revisit if Thomas wants
    per-character progress. "Characters" button in the Hall header.
  - Briefing: a character fixes the race (`raceLocked`), racial traits stay listed.
  - `content/index.js`: `KITS` now includes warrior; `PLAYABLE` (roster classes) and
    `trialSupports(trialId, classId)` — Warrior plays T1/T2; T3–T5 show "Not available
    yet". `CLASS_ORDER` (analysis, shared trial tests) is still Hunter/Mage/Priest.
  - Checked in the local preview: fresh roster → Tauren Warrior + Troll Mage → Hall →
    Fury briefing (race locked) → fight starts in Berserker Stance.

## Next

1. Rogue kit (plan step 3): `classes/rogue.js` player builds Assassination / Combat /
   Subtlety at 10/30/60 (keep `npc: true` → current Combat NPC build), openers (Ambush,
   Cheap Shot, Garrote, Sap with `requiresStealth` / `requiresBehind`), Backstab,
   finishers (Rupture, Kidney Shot, Expose Armor), Vanish, Blind, Gouge, Sprint,
   Mutilate (40) / Hemorrhage (46); poisons from `POISONS` via `u.meta.poisons`;
   dual-wield melee with `melee.oh`. Bot + `tests/rogue-kit.test.mjs` like the Warrior's.
2. T3 / T5: Warrior tank role (Gorrak steps aside / becomes off-tank), Rogue duties;
   T4 duel intros and opponent per class.
3. Add warrior and rogue to `CLASS_ORDER`; trial tests then cover them automatically.
4. Roster UI (characters in the Hall), stance bar, combo points; Codex/analysis.

## How to resume

- `git checkout phase4`, `node tests/run-all.mjs` (expect 15/15), then the
  next item above. Commit per item on `phase4`; do not push.
