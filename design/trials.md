# Trial design briefs

> Written for the first three classes and T1–T5. All six classes now play every trial, and T6 The Proving Grounds is a fixed one-minute dummy test with a leaderboard (`content/encounters/t6-dummy.js`).

Shared goals: each trial must be *mechanically interactive* (not text choices), give all three classes a fair chance to show their identity, produce `marker` events for telemetry, and be winnable by competent play at 1× speed (pause allowed) and losable by careless play. Real-time, but readable: telegraphs ≥ 1.5 s, casts that matter are visible on nameplates. Length targets are *fight time at 1×*.

Naming: original place and NPC names (Warcraft-flavoured, not lifted wholesale from Blizzard content). Enemy portraits must use ids from the SPEC portrait list. Every enemy ability gets a `name`, `icon`, `school`, `desc`. Namespaced ids: `t1.*`, `t2.*` … for templates and abilities.

Difficulty calibration uses the class kits (src/content/classes/*.js) and the bot policies in `tests/bots/<class>.mjs`. Each trial ships `tests/<trial>.test.mjs` running every class (and the Priest healer role where offered) over ≥ 8 seeds with (a) a *competent* bot (uses the class's tools sensibly, reacts to mechanics) and (b) a *careless* bot (only presses the main filler, never moves, ignores mechanics). Targets: competent win rate ≥ 75 % for every class; careless bot clearly worse (lower win rate, much lower HP at the end, or — in group trials, where an NPC healer tops you up — more than twice the damage taken); no class more than ~25 % faster than another on median clear time unless that difference is an authentic class trait you document.

---

## Trial 1 — The Long Road (questing) · Level 10, replayable at Level 30

**Place:** Fenwick Hollow, a road through a dark forest with farmsteads overrun by gnolls/kobolds/wolves (pick a coherent theme).
**Purpose:** ordinary questing pace: pull → fight → downtime → next pull. Compare flow, downtime and how "full" the button bar feels at 10 vs 30.
**Structure:** a quest with 4–5 sequential pulls the player approaches at their own pace (enemies idle with `aggroRadius`, some patrol). Mostly single mobs, one caster mob (ranged spell, interruptible), one pair (linked `group`). Arena ~70×36 yards with trees/rocks (LoS matters for casters: pulling a caster around a tree is a real tactic).
**Downtime:** `item.rest` between pulls (compressed). The objective tracker shows kills and "time spent resting". Do not force rest; low resources simply make the next pull risky.
**Level 30 variant (`levels:[10,30]`):** same road, tougher mobs (scaled), one more mob type that uses the wider toolkit (e.g. a runner that flees at 20 % and brings a friend if not stopped; a mob with a dispellable/curse effect). The point is to *feel* the toolkit breadth difference after "dozens of hours".
**Markers:** `pull` for each pull, `danger` only if something surprising happens (runner return).
**Victory:** quest complete (all quest mobs dead). **Defeat:** player dies. (Pet death is not defeat.)
**Summary lines:** quest time, time resting (and its uncompressed equivalent), number of rests, damage taken.

## Trial 2 — Unexpected Danger · Level 30

**Place:** a lakeside camp / ruined watchtower.
**Purpose:** improvisation under surprise. Tests positioning, control, pet management, defensive tools.
**Structure:** player is asked to kill a named mob (normal) at its camp. ~8 s into the fight (or at 60 % HP of the first mob) an ambusher (fast melee, e.g. a stealthy bandit or raptor) appears close behind the player → `marker danger "Ambush!"`; ~10 s later the first mob tries to flee at 25 % HP toward a second camp (runner) and, if it arrives, a third enemy (caster) joins → second `danger` marker. Banners and yells telegraph both.
**Tools that should shine (not required):** Mage: Frost Nova + step back, Polymorph the ambusher, Counterspell the caster, Blink; Hunter: pet taunts/holds the ambusher, Freezing Trap, Concussive the runner, Feign Death to reset (FD with pet on passive should make mobs evade → that's a legitimate "reset" outcome but the quest target then heals; the player must re-engage); Priest: Psychic Scream (risky: fleeing mobs can aggro more), Power Word: Shield, Mind Blast/Silence/Mind Flay slow on the runner, Fade, self-heals.
**Escape option:** a road exit on one side; running out of the arena with all enemies alive ends with `escaped` (counts as survival, not victory). Telemetry records it.
**Victory:** all hostile mobs dead. **Defeat:** death.

## Trial 3 — The Sunken Reliquary (dungeon) · Level 30 · Priest may choose Healer

**Place:** a flooded crypt-cathedral held by crimson zealots (the `zealot*` and `abbot` portraits).
**Party (since 2026-10-27 real level-30 classes from `src/content/party.js`: Protection Warrior, Combat Rogue, Destruction Warlock, plus a Restoration Shaman — or a Frost Mage when the player heals; the original brief follows):** Tank (orc-warrior, `tank` AI with a taunt), Rogue (troll-rogue, `mdps`), plus either an NPC healer (orc-shaman, `allyHealer`, finite mana — a nod to the player's old Shaman) when the player is DPS, or **no NPC healer when the Priest heals**. Allies are fallible on purpose (`ai.skill` 0.6–0.85, `react` 0.8–1.4 s): sometimes they stand in fire a little too long.
**Part A — trash pull:** 4 zealots: a Guard (tanky), two Footmen, and a Zealot Priest that casts an interruptible heal and a shadow bolt. Before the pull the player can pre-CC one target (sheep / trap / Shackle-type if the kit has one) — a `mechanic` marker of kind `cc` opens when the pull starts. The healer-zealot's big heal opens `mechanic interrupt` windows. One footman, if ignored, runs at the healer (NPC or player) → `mechanic peel`.
**Part B — Abbot Varnath (boss):** ~70–90 s. Abilities: a frontal Cleave (tank; punishes melee standing in front), "Censure" — a 2.5 s cast interruptible heal or fear (interrupt window → `mechanic interrupt`), "Smouldering Censer" — telegraphed fire circles on random party members (move → `mechanic move`), "Call the Faithful" at 50 % — 2–3 weak adds that head for the healer (AoE/peel/CC check → `mechanic add`), and a magic debuff "Brand of Zeal" on a random ally that ticks hard until dispelled (Priest/Mage dispel/decurse windows — Mage: give it a curse variant if the Mage kit has Remove Curse; otherwise only magic).
**Healer mode (Priest):** party frames on the left, F1–F5 targeting, mana pressure: the fight should leave a careful healer at 10–30 % mana and punish spam with OOM. Damage patterns: steady tank damage, spiky cleave if the tank is misplaced, AoE pulses, the Brand. Healer threat matters: heals put the healer on adds' threat tables; Fade / shields / letting the tank taunt should matter.
**DPS mode:** responsibilities above + damage. The NPC healer can run out of mana if the player takes avoidable damage — consequences flow from play.
**Victory:** boss dead. **Defeat:** player dead, or tank + healer dead (wipe).
**Summary lines:** interrupts/dispels/CC handled out of opportunities, deaths, damage or healing done, mana at end.

## Trial 4 — Battleground Duel · Level 60

**Place:** a contested battleground node (stables / blacksmith of an Arathi-like basin) with 3–5 pillars and crates for line of sight. Arena ~44×30.
**Opponent:** "Sergeant Aldric Vane", an Alliance (Human) Warrior, `kind:'opponent'` (diminishing returns on), with Charge (only from range > 8, out of combat-ish), Intercept (stun, cd), Hamstring, Mortal Strike (healing reduction), Overpower-like, Pummel (interrupt, locks school), Berserker Rage (fear immunity window), Intimidating Shout (short AoE fear), a PvP trinket (breaks one CC, 2 min), Recklessness/Retaliation-style burst at low HP, and a bandage attempt when he's out of combat range. Damage tuned so a passive player dies in ~15–20 s of uninterrupted melee.
**Adaptive behaviour (the core of this trial):** best of 3 rounds (HP/resources reset; 75 s soft cap per round → higher HP% wins). After each round the AI updates a profile of the player: (1) how often the player hard-cast in melee range → Pummel earlier/more; (2) whether control was used immediately on first contact (fear/nova/trap) → round 2 he baits it (feints in, uses Berserker Rage before closing, saves trinket for the long CC); (3) how much the player kited → saves Intercept for after roots break, uses Hamstring more; (4) whether the pet was the main pressure → he hits the pet / uses Intimidating Shout; (5) whether the player used defensives early or late. Every adaptation is *readable* (a yell/emote or combat-log line: "Aldric keeps his distance, watching your hands.") so the player can counter it. Telemetry markers: `danger` at round start, `mechanic counterplay` when an adaptation fires and `mechanicResolved` if the player beat it (e.g. waited out Berserker Rage before fearing).
**Fairness:** all three classes must be able to win with their real identity: Mage (Nova/Blink/Cone/Ice Block/Polymorph/shatter burst), Hunter (range, Concussive/Wing Clip/Scatter, traps, pet, Feign Death), Shadow Priest (Shield, Psychic Scream, DoTs, Mind Flay slow, Mind Blast, Silence irrelevant vs warrior, Vampiric healing, Dispel). Priest healer role is not offered here; Priest plays Shadow (or Discipline if the kit offers a damage-capable Disc spec at 60 — your call, documented).
**Victory:** win 2 rounds. **Defeat:** lose 2 rounds.

## Trial 5 — The Ember Tyrant (raid) · Level 60 · Priest may choose Healer

**Place:** a molten raid chamber (`molten` theme, lava obstacles). Boss: Vorgrath the Ember Tyrant (`ember-tyrant` portrait), adds `ember-imp`, `core-hound`.
**Raid (since 2026-10-27: 13 real level-60 classes from `src/content/party.js` — two Warrior tanks, three Rogues, Mage, two Warlocks on Recklessness / Elements, Marksman Hunter, two Restoration Shamans and a Holy Priest; class buffs come from who is in the raid, NPCs decurse and dispel with their own spells; the original brief follows):** abstract 20–40-person raid shown as ~12–16 NPC allies on the field (tanks, melee clump, ranged spread) plus raid frames (`hud.raid`). Raid NPC DPS is scaled so the fight lasts **~3–4 minutes at 1×** — long enough that the player repeats the core loop dozens of times. The player's output measurably matters (±20–30 s of fight length) but the raid does not fail if the player's DPS is merely mediocre.
**Phases:** P1 100–60 %: tank-and-spank with periodic raid AoE "Ember Volley", "Magma Pools" placed under random raiders (move), and class duties (below). P2 60–25 %: imps/hounds spawn in waves (AoE/threat check: pulling threat from the tank with AoE gets you hit — Feign Death, Fade, Ice Block/Invisibility-type tools matter). P3 < 25 %: burn — cooldown usage matters; the boss "Frenzies" more often.
**Class duties (each a real responsibility window with `mechanic` markers):**
- Hunter: **Frenzy** every ~30 s — Tranquilizing Shot removes it (only if the kit has it at 60; else use the closest real hunter tool documented by research); untranquilised frenzy hammers the tank. Also pet management (passive vs AoE adds).
- Mage: **Curse of Ash** on raiders — decurse (Remove Lesser Curse / Remove Curse) within a few seconds; or **Ignite** interrupt windows on imps (Counterspell) if the kit lacks decurse.
- Priest (Shadow): **Searing Shackles** magic debuff to dispel on raiders + keeping Shadow Weaving-type stacks / DoTs up if the kit has them; (Healer): assigned to the tank group + raid healing; mana must last the whole fight (Hymn/Spirit/potions/regen windows matter).
Duties have a fallback (raid NPCs handle it slower/worse) so failing a duty costs time or a death but does not instantly wipe.
**Repetition & engagement:** the trial is where "willingness to repeat a rotation" is measured. The UI offers *Filler autopilot* (casts `build.filler` when idle) — never required, tracked when used. Show a DPS/HPS meter.
**Victory:** boss dead. **Defeat:** player dead (they can be "battle-rezzed" once by a raid druid NPC after 10 s — still recorded), or raid wipe (tanks dead).
**Summary lines:** fight time, your DPS/HPS and rank on the meter, duties handled (x/y), deaths, mana/OOM time, autopilot share.
