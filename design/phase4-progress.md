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

## Next (plan step 2: Warrior kit)

1. `classes/warrior.js`: level 10/30/60 player builds for Arms, Fury, Protection from
   `research/forever-warrior-rogue.json` (ranks checked by `tests/ranks.test.mjs`);
   abilities Charge, Rend, Hamstring, Overpower (ready aura via onAttackAvoided),
   Execute (≤20 %, extra rage → damage), Slam (resetsSwing), Mortal Strike /
   Bloodthirst / Whirlwind / Shield Slam (trained at 48 in Forever), Victory Rush,
   Intercept, Pummel, Berserker Rage, Battle Shout, Intimidating Shout, Retaliation,
   Recklessness; talent picks per spec (21 points at 30, 51 at 60).
   Keep the `npcOnly` Protection NPC tank working (`tests/npc-kits.test.mjs`).
2. `tests/bots/warrior.mjs` competent/careless; add warrior to `CLASS_ORDER` only when
   T1/T2 pass for it (the trial tests loop over CLASS_ORDER).
3. Then the Rogue kit (plan step 3), T3/T5 tank role, T4, roster UI, Codex.

## How to resume

- `git checkout phase4`, `node tests/run-all.mjs` (expect 14/14), then the
  next item above. Commit per item on `phase4`; do not push.
