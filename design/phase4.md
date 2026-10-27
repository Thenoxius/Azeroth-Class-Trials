# Phase 4 — every class playable (Warrior and Rogue first)

Prepared 2026-10-27, after phase 3 (NPC party/raid as real classes), race choice
(v10) and the targeting fixes (v12). Nothing in this file is built yet.

## Goal

Warrior and Rogue become playable on the same footing as Hunter, Mage and Priest:
every trial (T1–T5) at its levels, three specs, race choice, a bot that plays
each spec competently and carelessly, Codex facts, analysis and telemetry.
Warlock and Shaman follow with the same recipe; Paladin and Druid last (no
NPC kits yet).

Rule from Thomas: we play **WoW: Forever**, not Classic. Spell ranks, talents and
racials come from the Forever beta data; Classic only where Forever has no
value, and the Codex labels it.

## Data already in hand

- `research/forever-warrior-rogue.json` — Wowhead Forever `/changes/spellbook`
  and `/changes/talents` for Warrior and Rogue, build 1.60.1.70630, read
  2026-10-27: every rank (level, spell id, Forever change lines, cost, range,
  cast, cooldown, tooltip) and every talent rank.
  - Warrior: 36 spells, 62 talents (Arms / Fury / Protection).
  - Rogue: 34 spells, 60 talents (Assassination / Combat / Subtlety).
- Forever changes worth knowing up front:
  - Warrior: Mortal Strike, Bloodthirst and Shield Slam are **trained at 48**
    (no longer 31-point talents). Victory Rush at 20. Tactical Mastery is
    baseline at 14. Battle Shout lasts 3 min but gives less AP.
  - Rogue: Mutilate is trained at 40, Hemorrhage at 46. Poisons at 20.
- Portraits (approved, in `art-source/horde-handoff-v15`): Warrior — Orc,
  Troll, Tauren, Undead, Skyborne; Rogue — Orc, Troll, Undead, Skyborne.
- Spell icons: `ability-map.json` covers the NPC Warrior/Rogue abilities.
  New player abilities need mappings from the same package (or keep their SVG).
- Racials for all five Horde races are in `src/content/races.js`.

## What exists (NPC kits, phase 3)

| | Warrior (`classes/warrior.js`) | Rogue (`classes/rogue.js`) |
|---|---|---|
| Levels | 30, 60 (no 10) | 30, 60 (no 10) |
| Specs | Protection only | Combat only |
| Abilities | Sunder, Revenge, Shield Block, Heroic Strike, Cleave, Thunder Clap, Demo Shout, Taunt, Shield Bash, Shield Slam, Bloodrage, Shield Wall, Last Stand | Sinister Strike, Eviscerate, Slice and Dice, Kick, Blade Flurry, Adrenaline Rush, Evasion, Feint |
| Engine | rage (Classic formula), block, "next swing" (Heroic Strike/Cleave) | energy, combo points |
| Flag | `npcOnly: true` | `npcOnly: true` |

## Work list

### 1. Engine mechanics still missing

| Mechanic | Needed for | Notes |
|---|---|---|
| Stances (Battle / Defensive / Berserker) with stance-gated abilities, rage loss on swap (Tactical Mastery keeps some) | Warrior | One stance aura; `requiresStance` on abilities; GCD 1 s. |
| Charge / Intercept: rush to the target, stun, generate rage; Charge only out of combat | Warrior | Movement dash + stun aura; `outOfCombat` already exists. |
| Overpower (after the target dodges), Revenge (after you block/dodge/parry), Execute (target < 20 %) | Warrior | `onAvoid` hook exists for Hunter; reuse for "ready" auras. |
| Slam (cast that resets the swing), Whirlwind, Mortal Strike healing debuff | Warrior | `healTaken` mod exists. |
| Stealth: move slower, enemies notice at short range, broken by damage/abilities | Rogue | `flags.stealthed` exists in aggro checks; needs the aura, speed, break rules. |
| Openers that need stealth: Ambush, Cheap Shot, Garrote, Sap | Rogue | `requiresStealth`. |
| Positional: Backstab, Ambush, Garrote from behind | Rogue | `G.behind` exists (AI); add `requiresBehind` to canCast. |
| Poisons on weapon hits: Instant, Deadly (stacking), Crippling, Wound, Mind-numbing | Rogue | New `onWeaponHit` hook from melee swings and strikes. |
| Finishers spending combo points (Rupture, Kidney Shot, Expose Armor), Vanish, Blind, Gouge, Sprint, Distract | Rogue | Combo points exist; Vanish = drop threat + stealth. |
| Dual wield for the player (off-hand swings, miss penalty) | Rogue, Fury | Hunter Survival models a combined weapon; Fury/Rogue need real off-hand swings for poisons and Sword Spec procs. |

### 2. Kits (`classes/warrior.js`, `classes/rogue.js`)

- Add level 10 and the full 30/60 kits from the Forever data, ranks checked by
  `tests/ranks.test.mjs` like the other classes.
- Specs at 30 and 60:
  - Warrior: Arms, Fury, Protection.
  - Rogue: Assassination, Combat, Subtlety.
- Talent picks per spec as for Hunter/Mage/Priest: a 21-point build at 30 and
  a 51-point build at 60, from Forever talent data (source + status label per
  pick).
- Bars, loop hints, fillers (Warrior: Heroic Strike / Slam; Rogue: Sinister
  Strike / Backstab), passives list, `newSince`.
- Gear and weapons in `stats.js`: DPS-warrior and tank-warrior profiles,
  rogue already present; Fury two one-handers, Arms a two-hander.
- Keep `npcOnly` NPC builds working (party/raid) — the NPC tank keeps
  Protection, the NPC rogue keeps Combat.
- Races: extend `CLASS_RACES` in `races.js` (Warrior: orc, troll, tauren,
  undead, skyborne; Rogue: orc, troll, undead, skyborne) and run `npm run art`.

### 3. Trials

| Trial | Warrior | Rogue |
|---|---|---|
| T1 questing (10/30) | Charge-pull, rage from hits, eat between pulls | Stealth openers, eat between pulls |
| T2 ambush (30) | Intimidating Shout / Retaliation to survive the pack | Vanish / Blind / Sprint escape |
| T3 dungeon (30) | **Role choice: tank or DPS.** As tank the NPC Gorrak is replaced by a DPS; threat on several mobs is the test | DPS; Kick the Zealot Priest's heals |
| T4 duel (60) | Mirror match vs the Warrior duelist; Hamstring, Intercept, Disarm, Pummel | Openers, Kidney Shot, Blind, Vanish reset |
| T5 raid (60) | Role choice: main tank or DPS. Tank duty = hold Vorgrath through Frenzy | DPS; duty = Kick the Ember Imps' Ember Bolts |

- `t5-raid.js dutyFor` and `rolesFor`, `t3-dungeon.js` party composition and
  `rolesFor`, `t4-pvp.js` per-class intro and opponent tuning all branch on
  `classId` today (≈70 places across T3–T5).
- Each trial's `intro(classId, level, role)` needs Warrior/Rogue text and tips.

### 4. UI

- `CLASS_ORDER` / `KITS` in `content/index.js`: add warrior and rogue (drop
  `npcOnly` for the player build).
- Hall grid: five class columns per trial instead of three — check width on
  laptop and phone; class order stays alphabetical-neutral, no recommendation.
- Action bar: stance bar (like the pet bar), combo-point pips on the target
  frame, rage/energy bars (colours exist in `RES_COLORS`).
- Briefing: role choice for Warrior in T3/T5 (the component already supports
  roles).
- Title screen sigils: still three; decide whether to show five.

### 5. Bots and tests

- `tests/bots/warrior.mjs`, `tests/bots/rogue.mjs`: competent and careless
  policies per spec and role, like `hunter.mjs`.
- Every trial test (`t1`–`t5`) picks classes from `CLASS_ORDER`, so the new
  classes join the matrix automatically once the bots exist.
- Balance targets as for the other classes: within ±15 % on the dummy, raid
  player ÷ best NPC 0.8–1.5, careless clearly worse.
- `races.test.mjs` already loops over `CLASS_RACES`.

### 6. Codex, analysis, telemetry

- `facts.js`: Warrior and Rogue sections (sources, status labels) from the
  research file and Icy Veins / Wowhead Forever guides.
- `analysis/model.js` and `analyze.js`: class lists and per-class systems
  (rage pooling, combo-point spending, stance use, poisons kept up).
- `telemetry/tracker.js`: auto-repeat damage counts melee swings for Warrior and
  Rogue; stance swaps and opener use as tracked moments.

## Order of work

1. Engine mechanics (stances, stealth/openers, positional, poisons, dual wield,
   Charge/Intercept) with unit tests — no UI.
2. Warrior kit (10/30/60, three specs) + bot + T1/T2 at 10/30.
3. Rogue kit + bot + T1/T2.
4. T3 tank role and T5 tank/DPS roles for Warrior; Rogue duties.
5. T4 duel for both.
6. UI: Hall with five classes, stance bar, combo points, briefing roles.
7. Codex facts, analysis, telemetry; icon mappings; publish.

Each step ends with the full suite green, a rebuild and a publish to the same
artifact.

## Decisions

- 2026-10-27, Thomas: the Warrior can **tank** in the dungeon (T3) and the raid (T5), next to DPS. Tanking is a role choice in the briefing; the NPC tank Gorrak steps aside (dungeon: a DPS takes his place; raid: he becomes off-tank).
- 2026-10-27, Thomas: **character roster instead of a class grid.** When the site
  loads you create (or pick) a few characters of your choice: race + class (+ a
  name). The Hall shows all of them together, each with its own row of trials
  and its own progress; every character is visible at once. This replaces the
  fixed three-class columns and the per-class race memory ()
  — a character *is* a race/class pair. Only playable classes can be created;
  existing progress maps to the three current default characters
  (Orc Hunter, Undead Mage, Undead Priest). Telemetry and analysis then compare
  characters, grouped by class.
- 2026-10-27, Thomas: class order after Warrior and Rogue does not matter. We do
  **Warlock and Shaman next** (their NPC kits exist), then Paladin and Druid.

## Work added by the roster decision (UI step 6)

- Character creation screen on first load: pick race and class (only valid Horde
  pairs, portrait preview), optional name; create several; edit/delete later.
- Store: ;
  runs and sessions keyed by character id (migration from class keys).
- Hall: one row (or card) per character with its trials; "suggested next"
  per character; add-character button.
- Briefing: no race picker any more (the character fixes it); spec and role stay.
- Analysis: per character and per class; the verdict still compares classes.

