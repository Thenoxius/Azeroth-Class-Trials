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
- 2026-10-29 — Engine step 1 finished (all in , suite 14/14):
  - **Stances** ( , abilities ):
    a permanent aura with  sets  in ; swap removes the
    old stance and keeps rage up to  (Tactical Mastery 10 from level 14,
    +15 with ). The NPC tank's Defensive Stance aura carries
    .
  - **Stealth** ( , ability ):     sets ; −30 % speed (slow), breaks on action
    (; Sap-like abilities use ), on damage
    taken and on damage dealt; no white swings while stealthed; mobs notice a
    stealthed unit at 35 % of their aggro radius (, approximation).
  - **Poisons**: engine hook  after every landed melee
    hit;   +  (Instant, Deadly ×5, Crippling,
    Mind-numbing; Forever ranks at 30/60), poison per hand in .
  - **Warrior hooks**:  for the attacker on a
    dodge/parry (Overpower readiness);  restarts the swing timer when
    the cast lands (Slam). Charge/Intercept need no engine work:  effect +
    stun aura +  /  already exist (see ).
  - **Dual wield**:  swings on its own
    timer () for 50 %, with the  miss penalty, hand 'oh'.

## Next (plan step 2: Warrior kit)

1. : level 10/30/60 player builds for Arms, Fury, Protection
   from  (ranks via );
   abilities Charge, Rend, Hamstring, Overpower (ready aura via onAttackAvoided),
   Execute (≤20 %, extra rage → damage), Slam (resetsSwing), Mortal Strike /
   Bloodthirst / Whirlwind / Shield Slam (trained at 48 in Forever), Victory Rush,
   Intercept, Pummel, Berserker Rage, Battle Shout, Intimidating Shout, Retaliation,
   Recklessness; talent picks per spec (21 pts at 30, 51 at 60).
   Keep  builds (Protection NPC tank) working — .
2.  competent/careless; add warrior to    only when T1/T2 pass for it (the trial tests loop over CLASS_ORDER).
3. Then Rogue kit (plan step 3), trials T3/T5 tank role, T4, roster UI, Codex.

## How to resume

- `git checkout phase4`, `node tests/run-all.mjs` (expect 14/14), then the
  next item above. Commit per item on `phase4`; do not push.
