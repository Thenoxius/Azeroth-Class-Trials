# Azeroth Class Trials — build spec & content contract

A browser mini-RPG that helps one experienced WoW player decide whether to main **Hunter, Mage or Priest** in **World of Warcraft: Forever** (2026). It is *not* a quiz: the player plays real-time-with-pause combat trials with each class at level 10 / 30 / 60 snapshots, the game records what they actually do, and a final analysis separates (1) Forever facts, (2) observed behaviour, (3) self-reports, (4) predictions.

Ships as one self-contained HTML page (Claude Artifact). React 18 UMD from cdnjs; everything else is bundled by esbuild into one inline script.

## Player profile (design input — do not hard-code a winner)

- Veteran: Shaman in Vanilla/TBC/Wrath (wants something fresh), Priest briefly in Legion (never max level), Mage raider in BfA, Undead Priest in the Forever beta (cap 30).
- Likes meaningful interaction, varied abilities, tactical decisions. Finds low-level Priest damage dull ("DoT + wand") until Shadow develops (~25). Finds Hunter (pet) and Mage (Frost Nova, control) fun early. Worried about simple, repetitive level-60 raid rotations. Dungeon healing may be more engaging than DPS.
- Wants a mix of questing/exploration, dungeons, raids, battlegrounds/PvP. Two young kids → fragmented sessions; but do NOT assume convenience beats gameplay, and do NOT default to Hunter because they're a parent.
- Hates transparent, predictable questions and personality profiling. Wants critical, independent feedback. Existing Undead Priest attachment must not predetermine the outcome.

## File layout & ownership

```
build.mjs                     esbuild → dist/index.html (artifact page)
src/shell.html                page head/body template
src/styles.css                all CSS (dark fantasy theme tokens)
src/main.jsx                  boot
src/engine/*                  simulation (pure JS, no DOM) — OWNED BY LEAD, read-only for others
src/content/common.js         shared helpers: spawnPlayer(), consumables, shared auras
src/content/classes/{hunter,mage,priest}.js   class kits
src/content/enemies.js        shared enemy templates & enemy abilities (classicMob: real Classic mob bodies)
src/content/stats.js          Classic stat rules, gear profiles, weapons, class buffs
src/content/data/*.js         generated Classic tables (cmangos): base stats, pets, mobs
src/content/classes/{warrior,rogue,warlock,shaman}.js   NPC class kits (playable later)
src/content/party.js          NPC party/raid members built from class kits + per-class priorities
src/engine/combat.js          Classic attack table, armor, spell hit, resists
src/content/encounters/t1-questing.js … t5-raid.js
src/content/facts.js          WoW: Forever facts (from research/forever-facts.json) for briefings/codex/analysis
src/telemetry/{tracker,store}.js   behaviour tracking + persistence (separate from gameplay state)
src/analysis/analyze.js       evidence-based comparison
src/ui/**                     React components (JSX)
src/ui/art/{portraits,icons}.jsx   original SVG art
tests/*.mjs                   headless bots / sim tests (node)
```

Rules for parallel contributors: only edit files you own. Don't modify `src/engine/*`; if you need an engine feature, implement it in your own file via hooks/custom effects or note it in your final report. Everything under `src/engine` and `src/content` must stay plain JS (no JSX, no DOM) so node tests can import it. Use explicit `.js` extensions in imports.

## Accuracy policy (non-negotiable)

Every ability/talent object carries `forever: { status, note?, src? }` where status is one of
`confirmed-official` · `reported-guide` · `beta-observation` · `classic-baseline` · `approximation`.
- Use the research files (`research/forever-research.md`, `research/forever-facts.json`) for names, levels, mechanics.
- Never present an invented talent/spell/rotation as a Forever fact. If research doesn't confirm it, label `classic-baseline` (known from Classic, unconfirmed in Forever) or `approximation` (our simplification). Spell numbers are the datamined Forever ranks (research/forever-ranks.json); character stats follow Classic rules with an estimated gear set (src/content/stats.js). Say in `forever.note` when a value differs from the datamine or is our estimate.
- Gameplay authenticity > completeness: a small honest kit beats a large invented one.

## Engine contract (src/engine/core.js)

Fixed-step real-time sim; distances in yards (melee 5, most spells 30, Hunter min range 8 when the kit uses it). Run speed 7 yd/s. GCD 1.5 s. Mana uses the five-second rule (`regen.spirit` only outside FSR unless `castRegen`). Damage pushback 0.5 s ×2 per cast; shields (absorbs) prevent pushback. Threat tables with 110%/130% pull-over; healing threat 0.5× split. Diminishing returns when `state.flags.pvpDR` or target `kind:'opponent'`. Line of sight blocked by arena obstacles.

### Unit template (spawnUnit(state, templateOrId, overrides))
```js
{ name, side:'player'|'enemy', kind:'player'|'pet'|'ally'|'enemy'|'boss'|'opponent', isPlayer, ownerId,
  classId, role:'tank'|'healer'|'dps', level, portrait:'<portrait id>', color, tags:['beast','humanoid','undead','caster','elemental'],
  x, y, radius:0.8, speed:7, maxHp, resources:{ mana:500 } | { focus:100 } | { rage:100 } | { energy:100 },
  regen:{ spirit /*mana/s outside FSR*/, mp5 /*mana/s always*/, castRegen /*0..1 of spirit while in FSR*/, hpOOC, hpIC, focus, energy },
  stats:{ sp, heal, ap, rap, critSpell, critPhys, hit }, physMit:0..0.6, resist:{ fire:0.1 },
  melee:{ min, max, speed, range }, ranged:{ kind:'autoshot'|'wand'|'npc', min, max, speed, range, minRange, windup, school, visual, coef },
  abilities:[ids], ai:{ type, rotation:[...], range, react, skill, fleeAt, fleeTo, taunt, spot, patrol },
  aggroRadius, group /*linked pull*/, leash, immune:{ stun, root, incap, fear, slow, silence, taunt, cc, knockback, damage },
  hooks:{ onCast, beforeDamage, afterDamage, beforeDamageTaken, afterDamageTaken, beforeHeal, afterHeal, onKill, onPartyKill, onAutoHit, preventDeath, beforePetDamage },
  autocast:{ abilityId:true }, petMode:'aggressive'|'defensive'|'passive', flags:{ wandMacro, noEvade, noLeash, autopilot, dr }, auras:[auraDefs applied at spawn], elite, hidden }
```

### Ability definition (registerAbilities({ 'mage.frostbolt': {...} }))
```js
{ name:'Frostbolt', icon:'bolt-frost' /*glyph id*/, school:'frost'|'fire'|'arcane'|'shadow'|'holy'|'nature'|'physical',
  mechanic:'spell'|'physical' /*physical ignores silence & school lockout*/, ranged:true /*physical ranged*/,
  category:'damage'|'filler'|'dot'|'control'|'defensive'|'utility'|'heal'|'pet'|'movement'|'buff'|'resource'|'cooldown'|'interrupt'|'dispel'|'consumable',
  tags:['core','optional-utility','aoe','burst','rotation'], learn: 4 /*level learned*/,
  desc:'Short functional tooltip.', forever:{ status, note, src },
  target:'enemy'|'ally'|'self'|'none'|'point'|'pet'|'deadAlly'|'any', range:30, minRange:0,
  castTime:2.5, channel:{ duration:3, ticks:3, tickOnStart:false, effects:[...], projectile:{speed} }, gcd:1.5 /*0 = off GCD*/, cooldown:0,
  cost:{ mana:25 } | { focus:30 }, costPct:0.1 /*of max*/, castWhileMoving, outOfCombat, usableWhileCC, noPushback,
  sharedCooldown:{ otherId:secs }, startsAutoShot, keepsWand, toggle:'autoshot'|'wand'|'melee'|fn, petAbility:'<pet ability id>',
  projectile:{ speed:28, visual:'frost' } /*effects resolve on impact*/,
  effects:[ ...effect objects... ], canUse(ctx)=>true|'custom:Message', onCast(ctx), onTick(ctx), onChannelStart(ctx), onChannelEnd(ctx),
  byLevel:{ 10:{ dmg:[20,25], cost:{mana:25} }, 30:{...}, 60:{...} } /*merged for the caster's level; string refs like amount:'dmg' resolve here*/ }
```
Effect objects (`type`):
- `damage` `{ amount:[min,max]|'key', coef, power:'sp'|'ap'|'rap', school, kind:'spell'|'melee'|'ranged', threat, critBonus, critBonusFn(ctx), multFn(ctx), noMiss, aoe }`
- `heal` `{ amount, coef, aoe }` (heal power = stats.heal)
- `aura` `{ aura:{...auraDef}, to:'self'|'target', aoe }`
- `removeAura {id,to}` · `interrupt {lockout}` · `dispel {types:['magic','curse','poison','disease'], count, which:'debuff'|'buff'}`
- `resource {resource, amount|pct, to}` · `threat {mode:'drop'|'taunt'|'add', value, duration}`
- `teleport {mode:'blink'|'toTarget'|'behindTarget'|'point'|'back', distance}` · `knockback {distance}`
- `summon {template, at, count, engage, owned, overrides}` · `zone {zone:{...zoneDef}, at:'self'|'target'|'point'}` · `custom {fn(ctx)}`
- any effect: `chance`, `if(ctx)`, `aoe:{ center:'self'|'target'|'point', radius, affects:'enemies'|'allies'|'party'|'all', maxTargets, excludePrimary }`
`ctx` = `{ state, u /*caster*/, t /*target*/, ab, point, api, tick }`. `api` is the bag of engine functions exported at the end of core.js (spawnUnit, dealDamage, healUnit, applyAura, interruptCast, banner, say, emit, threat helpers, G geometry…).

### Aura definition
```js
{ id, name, icon, school, debuff:true, duration, permanent, unique:'target' /*one per target from any source*/,
  maxStacks, stackMods, dispel:'magic'|'curse'|'poison'|'disease',
  tick:{ interval, type:'damage'|'heal'|'mana'|'custom', amount:[min,max]|'key', coef, school, power, perStack, fn },
  mods:{ dmgDone:{all|school|kind:mult}, dmgTaken:{...}, healDone, healTaken, crit:+0.1, critTaken, castTime:mult, cooldown, threat:mult,
         slow:0.5 /*strongest slow wins*/, speed:0.3, castSlow:0.5, castRegen:+0.15, manaRegen:mult, focusRegen, meleeHaste, rangedHaste, pushbackResist, costMult, gcd },
  cc:'stun'|'root'|'incap'|'fear'|'silence'|'disarm' | [..], frozen /*Shatter*/, immune /*Ice Block-like*/, absorb, absorbSchools,
  breakOnDamage /*poly, trap*/, breakDamage, breakDamagePct, ignoreTicks, dr:'stun'|'incap'|'fear'|'root'|'silence', pvpDuration,
  cancelOnMove, cancelOnAction, persistDeath, onApply(ctx), onRemove(ctx) }
```

### Zones (ground effects & telegraphs) — spawnZone(state, z)
`{ shape:{type:'circle',r}|{type:'cone',range,angle,dir}|{type:'ring',r,inner}|{type:'rect',w,h}, x, y, owner, side, telegraph /*secs warning*/, duration, interval, effects:[damage|aura|heal|custom], armEffects, onArm, onTick, trigger:'enter' /*traps*/, lifetime, maxTargets, affects:'hostile'|'friendly'|'all', follow:unitId, visual:'fire'|'shadow'|'frost'|'holy'|'nature'|'arcane'|'trap'|'void', label, harmless }`. Allies with `ai.skill` dodge telegraphs after `ai.react` seconds (sometimes late — they are fallible on purpose).

### AI behaviours (src/engine/ai.js)
`melee`, `caster`, `healer` (enemy), `idle`, `pet`, `tank`, `mdps`, `rdps`, `allyHealer`, `follow`; custom ones via `registerBehavior(name, (state,u,api)=>{})`. Rotation entries `{ id, when(state,u,t), target:'target'|'self'|'lowestAlly'|'randomEnemy'|'healer'|'tank'|fn, chance, say, point(state,u,t) }`. Party focus target: `state.script.focusId`; tank drag spot: `state.script.tankSpot`; tank focus: `state.script.tankFocusId`. Pets obey `petMode` and `petCmd` (`attack`/`follow`/`stay`) and only use rotation entries whose `autocast[id] !== false`.

### Player commands (UI → engine)
`playerCast(state,id,{targetId,point})` (queues within 0.4 s of GCD end), `stopCasting`, `setMoveDir(state,{x,y})`, `moveTo(state,x,y)`, `setTarget`, `cycleTarget`, `petCommand(state,'attack'|'follow'|'stay'|'aggressive'|'defensive'|'passive')`, `petCast(state, petAbilityId)`, `togglePetAutocast`. `player.flags.autopilot = abilityId` makes the engine cast that filler when idle (raid "autopilot" option — tracked by telemetry).

### Events (state.events, drained each frame by UI + telemetry)
`spawn, castStart{cat,castTime,channel}, cast{ability,cat,tags,dst}, castStop{reason:'complete'|'moved'|'interrupted'|'cc'|'stopped'|...}, channelTick, error{reason,text}, damage{src,owner,dst,ability,amount,absorbed,overkill,crit,school,kind,tick}, heal{amount,overheal,crit,tick}, miss, immune, auraApply{aura,debuff,cc,dr,duration}, auraRefresh, auraFade{reason}, interrupt, interruptMiss, dispel, dispelMiss, resource, death, revive, aggro, retarget, taunt, evade, evadeEnd, flee, fleeArrive, combatStart, combatEnd{duration}, pushback, teleport, impact, zone, zoneArm, zoneTrigger, zoneEnd, swing, autoShot, toggle, petCommand{cmd,ability,on}, moveOrder, target, say{text,kind}, banner, marker{key,label,data}, autopilotCast, outcome{result,reason}`.
Encounters MUST emit `marker` events at meaningful moments so telemetry can measure reactions: `{type:'marker', key:'danger', label:'Ambush!'}` (unexpected threat appears), `key:'pull'`, `key:'phase'`, `key:'mechanic', data:{kind:'interrupt'|'dispel'|'tranq'|'move'|'cc'|'add', id}` (a responsibility window opens) and `key:'mechanicResolved', data:{kind, id, by, ok}`.

## Class kit contract (src/content/classes/<id>.js)

```js
export const KIT = {
  id:'mage', name:'Mage', color:'#3FC7EB', resource:'mana', race:'Undead', portrait:'undead-mage',
  fantasy:'one paragraph', strengthsSummary, risksSummary,
  specs:{ 30:[{id,name,blurb,forever}], 60:[...] },              // spec choices offered at 30 / 60
  rolesFor(trialId) => ['dps'] | ['dps','healer'],
  build({ level, spec, role, trialId }) => ({
    template,            // unit template for the player (isPlayer:true, side:'player', kind:'player')
    bar:[abilityIds],    // action bar order (hotkeys 1-0, -, =, then Q E R F Z X C V)
    pet:null | { template, bar:[petAbilityIds], autocast:{} },
    consumables:[ids],   // potions/food/drink ability ids (from common.js)
    newSince:{ from:10, ids:[...] }, // for the briefing "what changed since level 10"
    loopHint:'text',     // the core loop at this level in one or two sentences
  }),
};
```
Stat blocks come from `src/content/stats.js` (Classic rules, base stats, a gear profile per level) and spell values from the datamined Forever ranks — no per-class tuning multipliers. Trials are made winnable by adjusting encounters, never classes. Each level snapshot must differ in toolkit breadth/decisions, not just numbers.

## Encounter contract (src/content/encounters/tN-*.js)

```js
export const TRIAL = {
  id:'t1', order:1, title, place, level:10, levels:[10,30] /*playable snapshots*/, kind:'questing'|'danger'|'dungeon'|'pvp'|'raid',
  rolesFor(classId) => ['dps'] (+'healer' for priest in t3/t5),
  intro(classId, level, role) => ({ text, goals:[...], tips:[...] }),
  arena:{ w, h, theme:'forest'|'ruins'|'crypt'|'basin'|'molten', obstacles:[{x,y,r,kind:'tree'|'rock'|'pillar'|'crate'}], decor:[...] },
  hud:{ party:false, raid:false, meters:true, timer:true, threat:true },
  setup(state, api), onTick(state, api, dt), onDeath(state, api, u, killer), onDamage(state, api, info), onEngage(state, api, enemy, unit), onFleeArrive(state, api, u),
  objectives(state) => [{ text, done, progress }],
  checkOutcome(state, api) => null | { result:'victory'|'defeat'|'escaped', reason },
  summary(state) => [{ label, value }],   // result-screen lines
};
```
`state.opts` = `{ classId, level, spec, role, trialId, kit, seed }`. Use `spawnPlayer(state, api, {x,y})` from common.js (builds the kit's player + pet). Rest/downtime between pulls in questing trials uses the consumables from common.js (Drink/Eat are channels, out of combat only, time-compressed and labelled as such).

## Telemetry (src/telemetry) — gameplay vs preference data are separate stores

- `tracker = createTracker({ trialId, classId, level, spec, role, attempt, voluntary })`; UI calls `tracker.ingest(events, state)` every frame, `tracker.ui(type, data)` for UI events (pause, resume, speed, autopilot on/off, tooltip, retreat), `tracker.finish(state) → SessionRecord`.
- SessionRecord: ability use counts by id/category/tag, optional-utility uses, pet commands & manual pet ability uses, defensive/control uses with timing quality, reaction to `marker:danger` (latency + first response category), resource decisions (rest count, % at rest start, OOM seconds, potion use), GCD utilisation timeline (per 15 s bucket), idle time, cast cancels by moving, interrupts/dispels attempted & succeeded, healing effective/overheal, autopilot seconds, pause count/time, speed time, real duration, outcome.
- Store (`localStorage`, try/catch everywhere): `act.v1.progress` (gameplay: completions, best results, last selections) and `act.v1.evidence` (sessions + feedback). Export/import JSON text; reset buttons.
- Optional feedback after each trial: enjoyment / frustration / desire to replay on 5-step scales **plus** "Not sure / skip", and a "moment" pick built from the fight's own highlights (e.g. "Frost Nova at 0:42 froze two enemies") with "None of these" and a custom text answer. Never ask transparent preference questions ("do you like healing?").

### SessionRecord (v1) — produced by tracker.finish(state, extra)
```js
{ version:1, id, trialId, classId, level, spec, role, kind /*trial kind*/, attempt, afterWin, replayOfOtherClass, seed, orderIndex,
  startedAt, endedAt, realMs, pausedMs, autoPausedMs, simSeconds, combatSeconds,
  outcome:'victory'|'defeat'|'escaped'|'abandoned', abandoned:bool,
  abilities:{ id:count }, categories:{ cat:count }, tags:{ tag:count }, casts, castsCancelledByMove, castsInterruptedByEnemy, errors:{ reason:count },
  gcd:{ activeSeconds, idleSeconds, utilization /*0..1 of in-combat time spent casting or on GCD*/, buckets:[{ t0, util }] /*15 s of combat each*/ },
  movement:{ yards, moveOrders, movingSeconds },
  pet:{ present, commands:{ attack, follow, stay, aggressive, defensive, passive, ability, autocast }, manualAbilities, autocastToggles, deaths, mendPetCasts, damageShare },
  control:{ uses, targets, brokenBySelf }, defensive:{ uses, timely }, interrupts:{ attempts, success }, dispels:{ attempts, success },
  resource:{ restCount, restStarts:[{ hp, res }], restSeconds, oomSeconds, lowResSeconds, potions:{ heal, mana }, endResPct },
  danger:[{ label, at, latency, firstCategory, firstAbility }],         // from marker key 'danger'
  mechanics:[{ kind, id, ok, by, latency }],                            // from marker 'mechanic' / 'mechanicResolved'
  healing:{ done, overheal, overhealPct, onTank, onOthers, onSelf, frameTargets },
  damage:{ done, petDone, taken, deaths },
  ui:{ pauses, pauseSeconds, autoPauses, speedSeconds:{ '0.5':s, '0.75':s, '1':s, '1.25':s }, autopilotSeconds, autopilotCasts, tooltips, targeting },
  moments:[{ t, kind, system, text }] }  // highlight candidates for feedback ("Frost Nova at 0:42 froze two enemies")
```
`system` values: `pet, control, burst, healing, dot, rotation, mobility, utility, defensive, teamplay, counterplay, resource`.

### FeedbackRecord
`{ sessionId, trialId, classId, level, spec, role, at, enjoyment:1..5|null, frustration:1..5|null, again:1..5|null, moment:{ kind, system, text }|'none'|null, custom:string|null, skipped:bool }` — null means "not sure / skipped", never a midpoint.

### Ability tagging (kits must follow — telemetry depends on it)
`category` is the primary role of the button; `tags` add facets: `core` (main damage/heal loop), `filler`, `optional-utility` (useful but skippable), `control`, `defensive`, `mobility`, `pet`, `cooldown`, `aoe`, `dot`, `heal`, `interrupt`, `dispel`, `resource`. Kits also expose `build().filler` (the ability the raid autopilot may cast).

## Analysis (src/analysis/analyze.js)

`analyze({ sessions, feedback, facts, weights }) → { classes:{hunter,mage,priest:{ dims:{ <dim>:{ score|null, confidence, evidence:[{kind:'fact'|'observed'|'self'|'prediction', text, weight}] } } }}, ranking, recommendation:{ main, alt, why:[...], strongestAlternative, whatWouldChange:[...] }, conflicts:[...], gaps:[...] }`.
Dimensions: leveling, combatDepth, dungeon, raid, pvp, worldUtility, soloIndependence, shortSessions, longTerm, roleFlexibility, fantasy. The method is shown to the player (no hidden personality score); weights are visible and adjustable; mixed evidence is reported as mixed; poor performance is not read as low enjoyment.

## Art (src/ui/art) — original SVG only

`<Portrait id size />` and `<AbilityIcon icon school size />`. No official Blizzard art. Class colours: Hunter #AAD372, Mage #3FC7EB, Priest #FFFFFF; schools: fire #ff7a2f, frost #7fd4ff, arcane #c78bff, shadow #9b6bff, holy #ffe08a, nature #7ed957, physical #d8c7a8.

Portrait ids: `undead-priest, undead-mage, troll-mage, orc-hunter, troll-hunter, tauren-hunter, undead-hunter, pet-wolf, pet-cat, pet-boar, pet-raptor, wolf, kobold, kobold-geomancer, gnoll, gnoll-brute, bandit, bandit-mage, spider, raptor, zealot, zealot-priest, zealot-guard, abbot, human-warrior, nelf-rogue, ember-tyrant, ember-imp, core-hound, orc-warrior, tauren-warrior, troll-rogue, orc-shaman, undead-warlock, troll-priest, raid-member, generic`.

Icon glyph ids: `bolt, bolt-frost, fireball, flame, flamestrike, pyro, scorch, meteor, snowflake, nova, cone-cold, blizzard, ice-block, ice-barrier, ice-lance, frostfire, missiles, arcane-blast, arcane-explosion, blink, sheep, counterspell, evocation, mana-gem, mana-shield, teleport, portal, intellect, arrow, arrows, multishot, aimed, arcane-shot, serpent, sting, mark, trap-freeze, trap-fire, trap-frost, concussive, scatter, wing-clip, raptor-strike, mongoose, disengage, feign, rapid-fire, aspect-hawk, aspect-monkey, aspect-cheetah, aspect-viper, volley, tranq, paw, claw, bite, growl, dash, mend-pet, call-pet, revive-pet, beast-wrath, kill-command, eye, skull, swp, mind-blast, mind-flay, shadowform, shadow-word-death, vampiric, silence, scream, fade, shield, renew, heal, flash-heal, greater-heal, prayer, holy-fire, smite, inner-fire, dispel, cure, wand, devour, touch-weakness, power-infusion, penance, spirit, star, sun, moon, hourglass, potion-red, potion-blue, bread, cup, bandage, sword, axe, shield-wall, taunt, generic`.

## Style

Dark fantasy, single deliberate dark theme. Display face: "Marcellus SC" (Friz-like, used sparingly for headings/titles); body: "Alegreya Sans"; numbers/data: "Alegreya Sans" with tabular-nums. Tokens live in `src/styles.css` `:root`. Gold-trimmed iron/leather frames, readable 15–16px body text, high-contrast unit frames (green HP, blue mana, yellow energy/focus, red rage).

## Testing

`node tests/run-all.mjs` runs every `tests/*.test.mjs`. Content authors write headless bot tests: a bot that plays sensibly should win most seeds; a bot that only spams its filler / ignores mechanics should lose or struggle where the design intends. Bots use the same `playerCast` / `setMoveDir` / `moveTo` commands as the UI.
