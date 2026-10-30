# Phase 4 — status and handoff

Last checked against the code on 2026-10-30. This replaces the old day-by-day log; history is in
git. `design/phase4.md` holds the original plan and its design decisions.

## Working agreements

- **Forever data only.** Abilities, talents, racials and mechanics come from Forever sources
  (Wowhead Forever datamine, Blizzard deep dives and dev notes). Classic only where Forever has no
  value, and it is labelled. **We do not tune class values to reach a DPS ratio.** Enemy health and
  damage are trial design and may be set by us.
- **Desktop only.** Phone layouts are out of scope.
- **Several agents work on this repo.** Check `git status` and `git worktree list` first, keep
  commits small, run `npm run format` before committing (CI fails on unformatted code).
- A push to `main` goes live on classtrials.com straight away. Push only when Thomas asks.

## What is finished

- **Six playable classes:** Hunter, Mage, Priest, Warrior, Rogue, Shaman, in all trials
  (`TRIAL_SUPPORT` in `content/index.js` is empty). Specs at 30 and 60, one baseline at 10.
  Warrior tanks and Priest and Shaman heal in T3 and T5.
- **Six trials:** T1 questing, T2 danger, T3 dungeon, T4 duel, T5 raid, T6 Proving Grounds
  (one minute on a fixed level-63 dummy, damage report, local leaderboard).
- **Characters:** `progress.characters`, with a stable id. Trial progress belongs to the character:
  `runKey(trial, class, level, charId)`. Sessions carry `charId` and `race`.
- **Old saves:** `migrateProgress` (store.js) moves class-level results to `progress.legacyRuns`.
  They are kept and counted per class, never assigned to a character. Old sessions without a
  `charId` count at class level as "not linked".
- **Priest racial spells follow the race:** Undead Touch of Weakness and Dark Sacrifice, Troll Hex
  of Weakness and Shadowguard (`RACE_SPELLS` in `classes/priest.js`).
- **Class analysis for six classes** (`analysis/`, see below).
- **Art:** original Class Trials branding and procedural menu chrome; no crops of the WoW site.
- **Forever audit:** `npm run audit`, results in `docs/ability-audit/`.

## How the analysis stays fair

- Four kinds of evidence stay apart: fact, observed, self, prediction.
- **Facts never rank a class alone.** A class without own runs or answers has no total.
- **Facts only score on rows where all six classes have a sourced fact**
  (`factRowsComparable()`: now combat depth, dungeon, raid, role flexibility, fantasy). Other facts
  are listed as "not scored". Missing research is therefore no penalty.
- **Status:** `empty` (nothing played), `single` (one class, nothing to compare), `early`,
  `ready`. `ready` needs every class in at least 2 trials and half of all trial × class cells.
- **Observed rules were checked for class bias.** Activity (R1, R17, predictions) only compares the
  same pace of play (`paceOf`); rage, energy, weapon-swing and Auto Shot kits have no fair
  counterpart and get no evidence there. Breadth (R4) is a share of the kit. Removed from scoring:
  wand reliance (R2), time to first action (R16), questing utility tags (R21), duty windows (R20,
  shown only), and the class-specific Priest and Hunter forecasts. R18 no longer penalises
  unplayed classes. R19 covers every class with more than one role.
- The Undead Priest attachment is opt-in: the slider defaults to 0.

## What is missing

- **Classes:** Warlock (NPC kit only), Paladin and Druid. Alliance racials are not built.
- **Shaman races:** Orc only in the game, though Forever also has Troll, Tauren and Skyborne.
- **Facts:** no sourced Forever statement stored yet for Warrior PvP, world utility, session length
  and long-term play; Rogue leveling, PvP, world utility, solo play, session length and long-term
  play; Shaman leveling, world utility and long-term play. Those rows score no facts for anyone.
- **Simulation estimates:** level-60 gear, stat conversions, hit, crit and armor models, some
  coefficients (see `docs/ability-audit/RESULTATEN.md` and `docs/SHAMAN.md`). Hex of Weakness and
  Touch of Weakness simulate their attack power loss as −10 % melee damage.
- **After launch (2026-11-04):** the data is beta build 1.60.1.70630. Re-read it and rerun the audit.
- **The analysis was tested with bots and constructed saves,** not with long real play.

## Building

```bash
npm ci
npm test                       # all test files
npm run audit                  # regenerates docs/ability-audit; fails on a source mismatch
node scripts/verify-classic.mjs
npm run build                  # dist/preview.html + dist/art (site), dist/index.html (single file)
npm start                      # build and serve locally
npm run format                 # Prettier
```

## Regenerating art

The game needs none of this to build: the results are committed. Masters are gitignored and only
exist locally, in the main checkout (OneDrive):

| Command | Needs | Writes |
| --- | --- | --- |
| `npm run art` | `art-source/horde-handoff-v15/` (local), `assets/spell-icons-extra/`, `assets/shaman-totems-v1/` (tracked) | `src/ui/art/img/`, `art-images.gen.js` |
| `node scripts/build-chrome.mjs` | nothing: drawn by code. The logo and forest in `assets/ui-classic/` are already resized; their masters are in `assets/original-branding-v1/` (local) | `assets/ui-classic/`, `classic-assets.gen.js` |

Rerun `npm run art` after adding abilities or units. Without `art-source/` it cannot run; do not
delete `src/ui/art/img/` in that case. `assets/alliance-portraits-v1`, `druid-forms-v2` and
`shapeshift-portraits-v1` are local packs for later classes.
