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

## Next (in order, from design/phase4.md "Order of work" step 1)

1. Stances: a stance aura sets `u.stance` (battle / defensive / berserker),
   stance swap ability (1 s GCD, rage capped by Tactical Mastery), stance mods
   (Defensive: −10 % damage taken, +threat; Berserker: +crit, more damage taken).
   Who sets `u.stance` today: nobody — add it in `spawnUnit` from the template.
2. Stealth: aura that sets `u.flags.stealthed`, speed penalty, breaks on damage
   dealt/taken and on any non-stealth ability; enemies notice at reduced
   aggro radius (`ai.js checkAggro` already skips stealthed units entirely —
   change that to a shorter radius).
3. Poisons: `onWeaponHit` hook from melee swings and strikes; Instant, Deadly
   (stacks to 5), Crippling, Wound, Mind-numbing.
4. Charge / Intercept (dash + stun, `noRoot` already blocks while rooted),
   Overpower / Revenge / Execute readiness, Slam swing reset.
5. Player dual wield (real off-hand swings).
Then Warrior kit (step 2 of the plan), Rogue kit, trials, roster UI, Codex.

## How to resume

- `git checkout phase4`, `node tests/run-all.mjs` (expect 14/14), then the
  next item above. Commit per item on `phase4`; do not push.
