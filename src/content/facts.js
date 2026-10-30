// WoW: Forever facts used by briefings, the codex and the analysis.
// Curated from research/research-{global,hunter,mage,priest}.json (read 2026-10-24/25,
// beta capped at level 30, final beta build Oct 15/16). Every line keeps the status
// of its weakest source; level-60 play was never testable, so anything about 60 is
// at best a guide projection.
//
// SOURCES: [{ id, title, url, kind:'official'|'guide'|'news'|'community', date }]
// GLOBAL_FACTS: [{ topic, text, status, src }]
// CLASS_FACTS[classId] = {
//   summary, identity,
//   specs: [{ id, name, role, identity, raidLoop, loopStatus }],
//   dims: { <dimension>: [{ text, status, src, sign: +1 | 0 | -1 }] },   // sign: favours / context / counts against
//   toolkit: { 10: [names], 30: [names], 60: [names] },
//   risks: [text], openQuestions: [text],
// }
// status: 'confirmed-official' | 'reported-guide' | 'beta-observation' | 'classic-baseline' | 'approximation' | 'speculative'

export const DIMENSIONS = [
  { id: 'leveling', name: 'Leveling enjoyment' },
  { id: 'combatDepth', name: 'Combat depth' },
  { id: 'dungeon', name: 'Dungeon gameplay' },
  { id: 'raid', name: 'Raid gameplay' },
  { id: 'pvp', name: 'PvP enjoyment' },
  { id: 'worldUtility', name: 'World exploration & utility' },
  { id: 'soloIndependence', name: 'Solo independence' },
  { id: 'shortSessions', name: 'Short play sessions' },
  { id: 'longTerm', name: 'Long-term engagement' },
  { id: 'roleFlexibility', name: 'Role flexibility' },
  { id: 'fantasy', name: 'Character fantasy & attachment' },
];

export const RESEARCH_DATE = '2026-10-25';

export const SOURCES = [
  {
    id: 'bz-announce',
    title: 'Blizzard — Carve a New Path with WoW: Forever',
    url: 'https://worldofwarcraft.blizzard.com/en-us/news/24302093',
    kind: 'official',
    date: '2026',
  },
  {
    id: 'bz-dd-hunter',
    title: 'Blizzard — Class Deep Dives: Hunter and Druid',
    url: 'https://worldofwarcraft.blizzard.com/en-us/news/24301515',
    kind: 'official',
    date: '2026-09-30',
  },
  {
    id: 'bz-dd-priest',
    title: 'Blizzard — Class Deep Dives: Priest and Warrior',
    url: 'https://worldofwarcraft.blizzard.com/en-us/news/24301514',
    kind: 'official',
    date: '2026-09-30',
  },
  {
    id: 'bz-dd-mage',
    title: 'Blizzard — Class Deep Dives: Mage and Shaman',
    url: 'https://worldofwarcraft.blizzard.com/en-us/news/24302097',
    kind: 'official',
    date: '2026-10-07',
  },
  {
    id: 'bz-dd-warrior',
    title: 'Blizzard — Forever Class Deep Dives: Priest and Warrior',
    url: 'https://worldofwarcraft.blizzard.com/en-us/news/24301514/world-of-warcraft-forever-class-deep-dives-priest-and-warrior',
    kind: 'official',
    date: '2026-10-02',
  },
  {
    id: 'bz-dd-rogue',
    title: 'Blizzard — Forever Class Deep Dives: Rogue and Warlock',
    url: 'https://worldofwarcraft.blizzard.com/news/24310968',
    kind: 'official',
    date: '2026-10',
  },
  {
    id: 'bz-dd-shaman',
    title: 'Blizzard — Forever Class Deep Dives: Mage and Shaman',
    url: 'https://worldofwarcraft.blizzard.com/en-us/news/24302097/world-of-warcraft-forever-class-deep-dives-mage-and-shaman',
    kind: 'official',
    date: '2026-10-07',
  },
  {
    id: 'bz-devnotes',
    title: 'Blizzard forums — Beta Development Notes (Sep 24 – Oct 15 builds)',
    url: 'https://us.forums.blizzard.com/en/wow/t/wow-forever-beta-development-notes-%E2%80%93-updated-october-15/2360696',
    kind: 'official',
    date: '2026-10-15',
  },
  {
    id: 'bz-camp',
    title: 'Blizzard — Gather Around the Campfire',
    url: 'https://worldofwarcraft.blizzard.com/en-us/news/24301516',
    kind: 'official',
    date: '2026',
  },
  {
    id: 'bz-dungeons',
    title: 'Blizzard — Explore the New Dungeons',
    url: 'https://worldofwarcraft.blizzard.com/en-us/news/24301455',
    kind: 'official',
    date: '2026',
  },
  { id: 'bz-raids', title: 'Blizzard — Raid Overview', url: 'https://worldofwarcraft.blizzard.com/en-us/news/24303009', kind: 'official', date: '2026' },
  {
    id: 'bz-pvp',
    title: 'Blizzard — How PvP Progression Works',
    url: 'https://worldofwarcraft.blizzard.com/en-us/news/24303316',
    kind: 'official',
    date: '2026',
  },
  {
    id: 'bz-darkspear',
    title: 'Blizzard — Battle for the Darkspear Islands',
    url: 'https://worldofwarcraft.blizzard.com/en-us/news/24307308',
    kind: 'official',
    date: '2026',
  },
  {
    id: 'bz-rulesets',
    title: 'Blizzard — Choose Your Ruleset',
    url: 'https://worldofwarcraft.blizzard.com/en-us/news/24302070',
    kind: 'official',
    date: '2026',
  },
  {
    id: 'iv-overview',
    title: 'Icy Veins — WoW Forever Overview',
    url: 'https://www.icy-veins.com/wow-forever/wow-forever-overview',
    kind: 'guide',
    date: '2026-10-22',
  },
  { id: 'iv-main', title: 'Icy Veins — Choosing Your Main', url: 'https://www.icy-veins.com/wow-forever/choosing-your-main', kind: 'guide', date: '2026-10' },
  { id: 'iv-camping', title: 'Icy Veins — Camping System Guide', url: 'https://www.icy-veins.com/wow-forever/camping', kind: 'guide', date: '2026-10' },
  { id: 'iv-legacy', title: 'Icy Veins — Legacy System', url: 'https://www.icy-veins.com/wow-forever/legacy-system', kind: 'guide', date: '2026-10' },
  { id: 'iv-raids', title: 'Icy Veins — Raid Overview', url: 'https://www.icy-veins.com/wow-forever/raid-overview', kind: 'guide', date: '2026-10-24' },
  { id: 'iv-pvp', title: 'Icy Veins — PvP Overview', url: 'https://www.icy-veins.com/wow-forever/pvp-overview', kind: 'guide', date: '2026-10' },
  {
    id: 'iv-bm',
    title: 'Icy Veins — Beast Mastery Hunter guide',
    url: 'https://www.icy-veins.com/wow-forever/beast-mastery-hunter-ranged-dps-pve-guide',
    kind: 'guide',
    date: '2026-10',
  },
  {
    id: 'iv-mm',
    title: 'Icy Veins — Marksmanship Hunter guide',
    url: 'https://www.icy-veins.com/wow-forever/marksmanship-hunter-ranged-dps-pve-guide',
    kind: 'guide',
    date: '2026-10',
  },
  {
    id: 'iv-sv',
    title: 'Icy Veins — Survival Hunter guide',
    url: 'https://www.icy-veins.com/wow-forever/survival-hunter-melee-dps-pve-guide',
    kind: 'guide',
    date: '2026-10',
  },
  {
    id: 'iv-frost',
    title: 'Icy Veins — Frost Mage guide',
    url: 'https://www.icy-veins.com/wow-forever/frost-mage-ranged-dps-pve-guide',
    kind: 'guide',
    date: '2026-10',
  },
  {
    id: 'iv-fire',
    title: 'Icy Veins — Fire Mage guide',
    url: 'https://www.icy-veins.com/wow-forever/fire-mage-ranged-dps-pve-guide',
    kind: 'guide',
    date: '2026-10',
  },
  {
    id: 'iv-arcane',
    title: 'Icy Veins — Arcane Mage guide',
    url: 'https://www.icy-veins.com/wow-forever/arcane-mage-ranged-dps-pve-guide',
    kind: 'guide',
    date: '2026-10',
  },
  {
    id: 'iv-shadow',
    title: 'Icy Veins — Shadow Priest guide',
    url: 'https://www.icy-veins.com/wow-forever/shadow-priest-ranged-dps-pve-guide',
    kind: 'guide',
    date: '2026-10',
  },
  {
    id: 'iv-holy',
    title: 'Icy Veins — Holy Priest guide',
    url: 'https://www.icy-veins.com/wow-forever/holy-priest-healer-pve-guide',
    kind: 'guide',
    date: '2026-10',
  },
  {
    id: 'iv-disc',
    title: 'Icy Veins — Discipline Priest guide',
    url: 'https://www.icy-veins.com/wow-forever/discipline-priest-healer-pve-guide',
    kind: 'guide',
    date: '2026-10',
  },
  {
    id: 'wt-bm',
    title: 'Warcraft Tavern — Beast Mastery Hunter (level-60 projection)',
    url: 'https://www.warcrafttavern.com/forever/guides/beast-mastery-hunter/',
    kind: 'guide',
    date: '2026-10',
  },
  {
    id: 'wt-mm',
    title: 'Warcraft Tavern — Marksmanship Hunter (level-60 projection)',
    url: 'https://www.warcrafttavern.com/forever/guides/marksmanship-hunter/',
    kind: 'guide',
    date: '2026-10',
  },
  {
    id: 'wt-shadow',
    title: 'Warcraft Tavern — Shadow Priest (level-60 projection)',
    url: 'https://www.warcrafttavern.com/forever/guides/shadow-priest/',
    kind: 'guide',
    date: '2026-10',
  },
  {
    id: 'wt-disc',
    title: 'Warcraft Tavern — Discipline Priest (level-60 projection)',
    url: 'https://www.warcrafttavern.com/forever/guides/discipline-priest/',
    kind: 'guide',
    date: '2026-10',
  },
  {
    id: 'wt-holy',
    title: 'Warcraft Tavern — Holy Priest (level-60 projection)',
    url: 'https://www.warcrafttavern.com/forever/guides/holy-priest/',
    kind: 'guide',
    date: '2026-10',
  },
  {
    id: 'wh-forever',
    title: 'Wowhead — WoW Forever class guides, spellbook and talent changes (datamined)',
    url: 'https://www.wowhead.com/forever',
    kind: 'guide',
    date: '2026-10',
  },
  { id: 'wowtbc-frost', title: 'wowtbc.gg — speculative level-60 Frost priority', url: 'https://wowtbc.gg', kind: 'community', date: '2026-10' },
  {
    id: 'bnet-forums',
    title: 'Blizzard beta forums — player threads (Hunter, Mage, Priest)',
    url: 'https://us.forums.blizzard.com/en/wow/',
    kind: 'community',
    date: '2026-09/10',
  },
];

export const GLOBAL_FACTS = [
  {
    topic: 'Launch',
    text: 'WoW: Forever launches globally on November 4, 2026 (3:00 p.m. PST). It is a permanent, non-seasonal mode included with a normal subscription.',
    status: 'confirmed-official',
    src: 'bz-announce',
  },
  {
    topic: 'Level cap',
    text: 'The level cap is 60, with long-term horizontal progression instead of cap raises. The beta stopped at level 30 (cap raised from 20 on October 1).',
    status: 'confirmed-official',
    src: 'bz-devnotes',
  },
  {
    topic: 'Talents',
    text: 'Talents still start at 10 with the 11/21/31-point milestone talents, plus a new 16-point milestone in every tree. Respec at a city class trainer; Dual Specialization unlocks at 40. Still 51 points at 60.',
    status: 'confirmed-official',
    src: 'bz-dd-hunter',
  },
  {
    topic: 'Mana',
    text: 'Mana regeneration follows the five-second rule: regen from Spirit pauses for 5 s after a completed mana-costing cast. Wands, potions and food do not trigger it.',
    status: 'reported-guide',
    src: 'iv-shadow',
  },
  {
    topic: 'Mana',
    text: 'Hunter, Mage and Priest each have talents that keep Spirit regen going while casting, and Blizzard buffed them (Bestial Discipline, Mage Armor/Arcane Meditation, Meditation).',
    status: 'confirmed-official',
    src: 'bz-dd-hunter',
  },
  { topic: 'Downtime', text: 'Guides say drinking downtime, not spell damage, limits caster leveling speed.', status: 'reported-guide', src: 'iv-arcane' },
  {
    topic: 'Wands & Auto Shot',
    text: 'Wands and Auto Shot need you to stand still for 0.5 s before firing. Wands no longer gain damage from spell power.',
    status: 'confirmed-official',
    src: 'bz-devnotes',
  },
  {
    topic: 'Down-ranking',
    text: 'Spell ranks far below your level get less benefit from spell power and lower proc chances.',
    status: 'confirmed-official',
    src: 'bz-devnotes',
  },
  {
    topic: 'Camping',
    text: 'Sitting a minute at a campsite gives 1-hour buffs from camp features (weaker copies of class buffs such as Fortitude, Arcane Intellect, Divine Spirit). No source says camping makes eating or drinking faster.',
    status: 'confirmed-official',
    src: 'bz-camp',
  },
  {
    topic: 'Legacy',
    text: 'Account-wide Legacy points buy per-character perks: faster rested XP, talents up to 5 levels early, health and mana on killing blows, free reagents.',
    status: 'reported-guide',
    src: 'iv-legacy',
  },
  {
    topic: 'Dungeons',
    text: '35 five-player dungeons (9 new) from level 13 to 60, grouped through a Classic-style listing tool. No Dungeon Finder teleport and no summoning stones.',
    status: 'reported-guide',
    src: 'bz-dungeons',
  },
  {
    topic: 'Raids',
    text: 'Raids open December 9: Barrow Deeps (10 players), Hyjal Summit (20) and Onyxia’s Lair (40). Fixed sizes, weekly lockouts, no difficulty modes, world buffs stripped inside.',
    status: 'confirmed-official',
    src: 'bz-raids',
  },
  {
    topic: 'Raids',
    text: 'Many group buffs became raid-wide, including Hunter Trueshot Aura and Mage Arcane Brilliance.',
    status: 'confirmed-official',
    src: 'bz-devnotes',
  },
  {
    topic: 'PvP',
    text: 'No Arena. Battlegrounds: Warsong Gulch, Arathi Basin, the new 15v15 Darkspear Islands (30–60) and Alterac Valley. Seasonal personal rank with weekly caps and no decay.',
    status: 'confirmed-official',
    src: 'bz-pvp',
  },
  { topic: 'PvP', text: 'Critical strikes no longer have reduced effect in PvP (beta change).', status: 'confirmed-official', src: 'bz-devnotes' },
  {
    topic: 'Mounts',
    text: 'First riding at level 40 (about 100 gold) according to fan guides only; the level-30 beta could not show it.',
    status: 'reported-guide',
    src: 'iv-overview',
  },
  {
    topic: 'Races',
    text: 'Horde options: Hunter (Orc, Tauren, Troll, Skyborne), Mage (Orc, Undead, Troll), Priest (Undead, Troll). Undead still cannot be Hunters.',
    status: 'reported-guide',
    src: 'iv-main',
  },
  {
    topic: 'Races',
    text: 'Also in these trials: Warrior (Orc, Troll, Tauren, Undead, Skyborne) and Rogue (Orc, Troll, Undead, Skyborne), from the Forever race pages. The Shaman is Orc here so far; more Shaman races are not in the trials yet.',
    status: 'beta-observation',
    src: 'wh-forever',
  },
  {
    topic: 'Uncertainty',
    text: 'Every level-60 rotation in guides is a projection: the beta never went past 30, and Blizzard says abilities “may continue to evolve”.',
    status: 'confirmed-official',
    src: 'bz-dd-mage',
  },
];

const F = (text, status, src, sign = 0) => ({ text, status, src, sign });

export const CLASS_FACTS = {
  hunter: {
    summary:
      'Ranged physical damage with a permanent pet. Auto Shot and the pet do much of the work; your buttons shape it. Mana with the five-second rule; pets use continuously regenerating Focus.',
    identity:
      'Pet partnership, long range, traps and kiting. Blizzard: the longest range of any class, but no stuns or interrupts of its own and a damage-only role.',
    specs: [
      {
        id: 'bm',
        name: 'Beast Mastery',
        role: 'Ranged DPS (pet-centred)',
        identity: 'The pet tanks and deals most damage; Summon Hawk (16-point) adds up to two temporary hawks; Bestial Wrath is the burst window.',
        raidLoop:
          'Projected: keep two hawks rolling, Aimed Shot on cooldown, Serpent Sting up, Arcane Shot only with spare mana, Rapid Fire + Bestial Wrath together.',
        loopStatus: 'reported-guide (level-60 projection)',
      },
      {
        id: 'mm',
        name: 'Marksmanship',
        role: 'Ranged DPS (own shots, optional petless)',
        identity:
          'Your own shots: Careful Aim, Rapid Killing/Recuperation, raid-wide Trueshot Aura, Lone Wolf (+20 % with no pet) and the 4 s Sniper Shot capstone.',
        raidLoop: 'Projected: Sniper Shot and Aimed Shot on cooldown, Serpent Sting up, Arcane Shot on cooldown, Rapid Fire on cooldown.',
        loopStatus: 'reported-guide (level-60 projection; Sniper Shot value disputed)',
      },
      {
        id: 'sv',
        name: 'Survival',
        role: 'Melee DPS with traps',
        identity:
          'Reworked into a dual-wield melee and trap spec: Raptor Strike, Mongoose Bite via Expose Prey, Strider Kick, Lacerating Strikes bleed. Plays ranged until about 30–40.',
        raidLoop: 'Unknown at 60; no published rotation.',
        loopStatus: 'unknown',
      },
    ],
    dims: {
      leveling: [
        F(
          'Guides rate Beast Mastery the strongest leveling spec in the game; the pet is called “the single greatest leveling tool any class gets”.',
          'reported-guide',
          'iv-bm',
          +1,
        ),
        F('Beta players report Hunters as very strong from 10 to 30; one reported 1–30 in about 22 hours played.', 'beta-observation', 'bnet-forums', +1),
        F('Levels 1–9 have no pet and are called a slow start.', 'reported-guide', 'iv-bm', -1),
        F('Guides advise letting Auto Shot and the pet kill at low mana instead of drinking, so downtime stays low.', 'reported-guide', 'iv-bm', +1),
      ],
      combatDepth: [
        F(
          'Guides call BM “relatively straightforward” and the easiest Hunter spec; the main skill is keeping two hawks rolling and controlling the pet.',
          'reported-guide',
          'wt-bm',
          -1,
        ),
        F('Survival is described as “a considerably more involved rotation”, weaving melee and ranged.', 'reported-guide', 'iv-sv', +1),
        F(
          'Traps now work in combat, with separate Fire and Frost cooldowns, which adds tactical placement during fights.',
          'confirmed-official',
          'bz-dd-hunter',
          +1,
        ),
        F('Your abilities no longer clip Auto Shot, so there is no swing-timer dance.', 'reported-guide', 'iv-bm', 0),
      ],
      dungeon: [
        F(
          'Group duties are damage, Freezing Trap crowd control and pulling with Feign Death. No interrupt, no dispel on allies.',
          'confirmed-official',
          'bz-dd-hunter',
          0,
        ),
        F('Uncontrolled pets (Growl on, Aggressive mode) and early AoE are the classic way Hunters annoy tanks.', 'reported-guide', 'iv-bm', -1),
        F('Icy Veins rates MM (Lone Wolf + Trueshot Aura) the best Hunter dungeon AoE spec at 30.', 'reported-guide', 'iv-mm', +1),
      ],
      raid: [
        F('Trueshot Aura is now raid-wide (ranged AP only), a real raid contribution.', 'confirmed-official', 'bz-devnotes', +1),
        F('Players worry pets and hawks will die to raid AoE, pushing raiders toward MM / Lone Wolf.', 'beta-observation', 'bnet-forums', -1),
        F(
          'Tranquilizing Shot is listed at 60 but how Forever teaches it is unconfirmed (Classic: Molten Core tome; Molten Core is not a launch raid).',
          'beta-observation',
          'wh-forever',
          0,
        ),
        F('Level-60 Hunter raid loops exist only as guide projections.', 'reported-guide', 'wt-mm', 0),
      ],
      pvp: [
        F('Guides call Hunters strong kiters: longest range, Concussive Shot, Frost Trap, Wing Clip, Sniper Shot range boost.', 'reported-guide', 'iv-pvp', +1),
        F('The 8-yard dead zone remains, a weakness against melee.', 'confirmed-official', 'bz-dd-hunter', -1),
        F('The strongest PvP pet abilities (Dismember, Sonic Blast, Mine!) were nerfed in the final beta build.', 'confirmed-official', 'bz-devnotes', -1),
      ],
      worldUtility: [
        F('Tracking, Eagle Eye, Eyes of the Beast (2 min control) and Aspect of the Cheetah before mounts at 40.', 'beta-observation', 'wh-forever', +1),
        F('Ongoing chores: ammo and quiver space, feeding the pet, learning pet ranks by taming.', 'reported-guide', 'wt-bm', -1),
      ],
      soloIndependence: [
        F(
          'The pet tanks while you shoot; Feign Death resets bad pulls. Icy Veins calls Hunter one of the easiest classes to recommend for soloing.',
          'reported-guide',
          'iv-main',
          +1,
        ),
      ],
      shortSessions: [
        F('Little drinking and pet-tanked pulls mean a short session is mostly fighting, not waiting.', 'reported-guide', 'iv-bm', +1),
        F('Pet upkeep (feeding, reviving) adds small chores at the start of a session.', 'reported-guide', 'wt-bm', -1),
      ],
      longTerm: [
        F('Three specs with different identities (pet, archer, melee) and dual spec at 40.', 'confirmed-official', 'bz-dd-hunter', +1),
        F('Collecting and training pets (every family has a unique ability; Foxes are new) is open-ended.', 'confirmed-official', 'bz-dd-hunter', +1),
        F('BM is called the easiest spec, which can mean a simple long-term raid loop.', 'reported-guide', 'wt-bm', -1),
      ],
      roleFlexibility: [
        F('Damage only. The pet can tank solo and in small groups, but the Hunter has no tank or heal role.', 'confirmed-official', 'bz-dd-hunter', -1),
      ],
      fantasy: [
        F('Beast companion fantasy is front and centre; Survival adds a melee hunter option.', 'confirmed-official', 'bz-dd-hunter', +1),
        F('Undead cannot be Hunters, so a Horde Hunter means a new Orc, Troll, Tauren or Skyborne character.', 'reported-guide', 'iv-main', 0),
      ],
    },
    toolkit: {
      10: ['Auto Shot', 'Raptor Strike', 'Serpent Sting', 'Arcane Shot', "Hunter's Mark", 'Concussive Shot', 'Aspect of the Monkey/Hawk', 'Tame Beast + pet'],
      30: [
        'Aimed Shot (baseline at 20)',
        'Multi-Shot',
        'Wing Clip',
        'Mend Pet',
        'Immolation Trap',
        'Freezing Trap',
        'Disengage',
        'Rapid Fire',
        'Feign Death',
        'Summon Hawk (BM)',
      ],
      60: [
        'Explosive Trap',
        'Frost Trap',
        'Volley',
        'Viper Sting',
        'Bestial Wrath (BM)',
        'Sniper Shot (MM)',
        'Trueshot Aura (MM)',
        'Tranquilizing Shot (unconfirmed source)',
      ],
    },
    risks: [
      'Level-60 raid rotations are projections; BM may feel simple.',
      'Pets and hawks may struggle with raid AoE.',
      'No interrupt or dispel: group responsibility is mostly damage and traps.',
    ],
    openQuestions: [
      'How Tranquilizing Shot is learned in Forever.',
      'Whether Sniper Shot is a damage gain in PvE.',
      'Aimed Shot cast time: 2 s (Wowhead) vs 3 s (warcraft.wiki.gg).',
    ],
  },
  mage: {
    summary:
      'Pure ranged magic damage with three schools that Blizzard wants to play “more actively moment-to-moment”. Strong control (Frost Nova, Polymorph, Counterspell), conjured food and water, portals.',
    identity:
      'Pick the right spell for the moment: Frost layers control and procs, Fire builds toward crits and Heating Up Pyroblasts, Arcane spends and manages mana.',
    specs: [
      {
        id: 'frost',
        name: 'Frost',
        role: 'Ranged DPS (control)',
        identity:
          'Ice Lance (+200 % vs Frozen), Fingers of Frost and Frostbite procs, Shatter, Winter’s Chill feeding Cone of Cold; Ice Block and Ice Barrier for safety.',
        raidLoop: 'Speculative: Frostbolt filler, Ice Lance on Fingers of Frost, Cone of Cold at 5 Winter’s Chill, keep Ice Barrier up.',
        loopStatus: 'speculative (wowtbc.gg)',
      },
      {
        id: 'fire',
        name: 'Fire',
        role: 'Ranged DPS (crit / burst)',
        identity: 'Heating Up: crits shorten the next Pyroblast to 1.5 s; per-Mage Ignite; Improved Scorch; Combustion. Weak until crit gear, scales well.',
        raidLoop: 'Unknown at 60; level-30 loop: Fireball filler, Fire Blast on cooldown, Pyroblast at 3 Heating Up stacks, Scorch stacks.',
        loopStatus: 'unknown at 60',
      },
      {
        id: 'arcane',
        name: 'Arcane',
        role: 'Ranged DPS (mana management)',
        identity:
          'Arcane Blast stacks spell damage while raising its own cost; Missile Barrage makes Arcane Missiles free and fast; Arcane Wrath scales with max mana.',
        raidLoop: 'Unknown at 60; reworked on Oct 15 after most guides were written.',
        loopStatus: 'unknown at 60',
      },
      {
        id: 'frostfire',
        name: 'Frostfire (hybrid)',
        role: 'Ranged DPS (Fire + Frost talents)',
        identity:
          'Frostfire Bolt (baseline at 40) counts as Fire and Frost, so Ignite, Ice Shards, Shatter and Heating Up can all apply. Blizzard built it for hybrid builds.',
        raidLoop: 'Unknown; no guide has a tested hybrid rotation.',
        loopStatus: 'confirmed spell, untested build',
      },
    ],
    dims: {
      leveling: [
        F('Frost is reported as the strongest level-30 beta build and the traditional leveling spec.', 'reported-guide', 'iv-frost', +1),
        F('Mana and drinking define leveling pace more than damage; Mage Armor at 34 greatly cuts downtime.', 'reported-guide', 'iv-arcane', -1),
        F('Conjure Water/Food now make 20 per cast; you never buy drinks.', 'beta-observation', 'wh-forever', +1),
        F('Level 20 is a big spike: Blink, Evocation, Mana Shield, Blizzard, the 11-point talent spells.', 'reported-guide', 'iv-frost', +1),
      ],
      combatDepth: [
        F('Blizzard’s stated goal: each school plays more actively, choosing the right spell for the moment.', 'confirmed-official', 'bz-dd-mage', +1),
        F(
          'Frost reacts to procs (Fingers of Frost, Frostbite → Ice Lance shatter); Fire reacts to crits (Heating Up); Arcane manages a mana curve.',
          'confirmed-official',
          'bz-dd-mage',
          +1,
        ),
        F('Beta players found level-30 Arcane single-target underwhelming and Fire slow and clunky before crit gear.', 'beta-observation', 'bnet-forums', -1),
        F('Icy Veins: a manageable rotation with no especially difficult timings.', 'reported-guide', 'iv-frost', 0),
      ],
      dungeon: [
        F(
          'Expected duties: Polymorph, Counterspell, Remove Lesser Curse (now also Banes), AoE, food and water, Arcane Intellect.',
          'reported-guide',
          'iv-frost',
          +1,
        ),
        F('Strong AoE (Arcane Explosion, Flamestrike, Blizzard, Blast Wave) with real threat risk.', 'reported-guide', 'iv-fire', +1),
        F('Mass AoE farming was deliberately weakened (shorter Cone of Cold, Improved Blizzard capped at 40 % slow).', 'confirmed-official', 'bz-dd-mage', 0),
      ],
      raid: [
        F('No level-60 Mage raid rotation exists; guides cannot advise beyond 30.', 'reported-guide', 'iv-frost', 0),
        F('Raid duties: decursing, Arcane Brilliance (now raid-wide at 56), hit cap matters against bosses.', 'beta-observation', 'wh-forever', +1),
        F('Frostfire Bolt opens hybrid raid builds Blizzard explicitly designed for.', 'confirmed-official', 'bz-dd-mage', +1),
      ],
      pvp: [
        F(
          'Frost is called the main PvP spec; Ice Block mandatory, Cold Snap near-mandatory, Improved Counterspell essential.',
          'reported-guide',
          'wh-forever',
          +1,
        ),
        F(
          'Toolkit: Blink (breaks stuns/roots), Polymorph, Frost Nova, Cone of Cold, instant Ice Lance/Fire Blast on the move, Mana Shield.',
          'beta-observation',
          'wh-forever',
          +1,
        ),
      ],
      worldUtility: [
        F('Teleports from 20 and portals from 40 are the fastest travel in Forever, which has limited fast travel.', 'reported-guide', 'iv-overview', +1),
        F('New Mage-only tradeskill Comprehension: decipher scrolls into buffs, imbues and familiars.', 'confirmed-official', 'bz-dd-mage', +1),
        F('Conjured food and water for you and the group.', 'beta-observation', 'wh-forever', +1),
      ],
      soloIndependence: [
        F('Frost’s control (Frost Nova, slows, Ice Block) makes it the safest Mage spec solo.', 'reported-guide', 'iv-frost', +1),
        F('Cloth armour and no pet: a mistake costs more than on a Hunter.', 'classic-baseline', 'iv-main', -1),
      ],
      shortSessions: [F('Drinking between pulls eats into short sessions; portals save travel time.', 'reported-guide', 'iv-arcane', 0)],
      longTerm: [
        F('Three reworked schools plus a Frostfire hybrid path, dual spec at 40.', 'confirmed-official', 'bz-dd-mage', +1),
        F('Arcane may have spare talent points at 60, pushing hybrid builds.', 'beta-observation', 'wh-forever', +1),
        F('Level-60 rotation variety and repetitiveness are unknown.', 'reported-guide', 'iv-frost', 0),
      ],
      roleFlexibility: [F('Damage only; no tank or heal role in any spec.', 'confirmed-official', 'bz-dd-mage', -1)],
      fantasy: [
        F('Undead Mage remains possible; Orc Mages are new.', 'reported-guide', 'iv-main', 0),
        F('You raided as a Mage in BfA; the Forever Mage is mechanically a different class (procs, Heating Up, Frostfire).', 'approximation', 'bz-dd-mage', 0),
      ],
    },
    toolkit: {
      10: ['Fireball', 'Frostbolt', 'Fire Blast', 'Arcane Missiles', 'Polymorph', 'Frost Nova', 'Frost Armor', 'Conjure Food/Water'],
      30: [
        'Arcane Explosion',
        'Flamestrike',
        'Blink',
        'Evocation',
        'Mana Shield',
        'Blizzard',
        'Scorch',
        'Counterspell',
        'Frost Blast',
        'Cone of Cold',
        'Remove Lesser Curse',
        'Ice Lance / Pyroblast / Arcane Blast (talent)',
      ],
      60: ['Frostfire Bolt (40)', 'Mage Armor', 'Portals', 'Ice Barrier / Combustion / Arcane Power (capstones)', 'Arcane Brilliance'],
    },
    risks: ['Mana and drinking dominate leveling pace.', 'Fire and Arcane felt weak or clunky at 30 in the beta.', 'Level-60 play is untested for every spec.'],
    openQuestions: [
      'How strong Frostfire hybrids are at 60 compared with pure Fire or Frost.',
      'Winter’s Chill numbers (two different values in the Oct 15 notes).',
      'Cooldowns of Ice Block, Presence of Mind, Arcane Power and Combustion are not stated for Forever.',
    ],
  },
  priest: {
    summary:
      'Cloth caster with two healing specs and Shadow damage. Every tree was reworked: Discipline is a shield-and-prevention healer, Holy a reactive multi-target healer, Shadow a vampiric DoT caster with better mana.',
    identity:
      'The most versatile healer (HoTs, direct heals, absorbs) or a DoT-and-channel caster that heals the party through Vampiric Embrace. Fragile, few escapes.',
    specs: [
      {
        id: 'shadow',
        name: 'Shadow',
        role: 'Ranged DPS',
        identity:
          'SW:P, baseline Devouring Plague, Mind Blast, ramping Mind Flay, new Shadow Word: Death; Vampiric Embrace from 25 (16-point); Shadowform at 40 halves Shadow costs.',
        raidLoop: 'Projected: keep SW:P and Devouring Plague up, Mind Blast and SW:D on cooldown, Vampiric Embrace up, unclipped Mind Flay filler.',
        loopStatus: 'reported-guide (level-60 projection)',
      },
      {
        id: 'disc',
        name: 'Discipline',
        role: 'Healer (prevention)',
        identity: 'Power Word: Shield centred (Soul Warding, Renewed Hope), Penance channel at 30, Divine Aegis absorbs, Power Infusion.',
        raidLoop: 'Projected: Renew + shield the tank, Penance for burst, Flash/Binding for quick heals, Greater Heal + Inner Focus for big hits.',
        loopStatus: 'reported-guide (level-60 projection)',
      },
      {
        id: 'holy',
        name: 'Holy',
        role: 'Healer (reactive, multi-target)',
        identity: 'Binding Heal (16-point), Prayer of Mending (31-point), Litany of Light rewards alternating heals; Lightwell removed.',
        raidLoop:
          'Projected: Renew on many targets, shields where damage lands, Binding/Flash for quick heals, Prayer of Mending and Prayer of Healing for groups.',
        loopStatus: 'reported-guide (level-60 projection)',
      },
    ],
    dims: {
      leveling: [
        F('Early Shadow is SW:P + Mind Blast + wand; Mind Flay (talent, earliest 20) only pays off around 24–28.', 'reported-guide', 'iv-shadow', -1),
        F('No core Shadow spell moves earlier in Forever; Shadowform is still the capstone (earliest 40).', 'reported-guide', 'iv-shadow', -1),
        F('Vampiric Embrace now comes at 25 and makes Spirit Tap trigger on any death under it, improving mana.', 'confirmed-official', 'bz-dd-priest', +1),
        F('Shadowform at 40 halves Shadow spell costs; guides say mana and damage “improve drastically”.', 'confirmed-official', 'bz-dd-priest', +1),
        F('Undead Priests get Dark Sacrifice (health into mana) and Cannibalize now restores mana too.', 'confirmed-official', 'bz-dd-priest', +1),
      ],
      combatDepth: [
        F('Shadow at 60 juggles two DoTs, two cooldowns, Vampiric Embrace upkeep and an unclipped ramping Mind Flay.', 'reported-guide', 'wt-shadow', +1),
        F(
          'Healing is reactive triage with mana pressure; Litany of Light rewards alternating heals instead of spamming one.',
          'confirmed-official',
          'bz-dd-priest',
          +1,
        ),
        F('Before ~25 every spec plays like a generic Priest: wand, SW:P, Mind Blast, Smite.', 'reported-guide', 'wh-forever', -1),
      ],
      dungeon: [
        F('Discipline is rated top-tier for dungeons (“Cream of the Crop”) as a single-target/tank healer.', 'reported-guide', 'iv-disc', +1),
        F(
          'Priest group kit: Fortitude, baseline Divine Spirit, Fear Ward for every race, Dispel Magic, Cure Disease, Shackle Undead.',
          'confirmed-official',
          'bz-dd-priest',
          +1,
        ),
        F('Silence now also interrupts (Shadow talent), the only Priest interrupt.', 'confirmed-official', 'bz-devnotes', +1),
      ],
      raid: [
        F(
          'Healers are always needed; Priest healing tools (shields, Prayer of Mending, Prayer of Healing) cover tank and raid damage.',
          'reported-guide',
          'wt-holy',
          +1,
        ),
        F(
          'Shadow Weaving now buffs only the Priest, so a raid Shadow Priest earns its spot on its own damage plus Vampiric Embrace.',
          'confirmed-official',
          'bz-dd-priest',
          -1,
        ),
        F('All level-60 Priest loops are projections; Shadowform and Prayer of Mending were never testable.', 'confirmed-official', 'bz-devnotes', 0),
      ],
      pvp: [
        F('Wowhead calls Shadow a strong solo/duel PvP spec; Mind Flay’s slow and Mana Burn are PvP staples.', 'reported-guide', 'wh-forever', +1),
        F('Fear Ward now has a 3-minute cooldown; Psychic Scream is unchanged.', 'beta-observation', 'wh-forever', 0),
        F('No Priest PvP data from beta battlegrounds.', 'reported-guide', 'iv-pvp', 0),
      ],
      worldUtility: [
        F('Levitate, Mind Vision, Mind Soothe, resurrection; buffs others want (Fortitude, Divine Spirit).', 'beta-observation', 'wh-forever', +1),
      ],
      soloIndependence: [
        F('Shields, self-heals and Vampiric Embrace let Shadow solo safely, but there is no pet and few escapes.', 'reported-guide', 'iv-shadow', 0),
        F(
          'Healing specs level slowly solo; guides recommend Shadow talents for questing and a respec (or dual spec at 40) for groups.',
          'reported-guide',
          'iv-holy',
          -1,
        ),
      ],
      shortSessions: [
        F('Drinking between pulls, especially before Shadowform and Meditation.', 'reported-guide', 'iv-shadow', -1),
        F(
          'Dungeon groups form through a listing tool with no teleport, so a dungeon run needs travel time whatever the role.',
          'reported-guide',
          'bz-dungeons',
          0,
        ),
      ],
      longTerm: [
        F('Three reworked specs, two roles; dual spec at 40 lets you quest as Shadow and heal groups.', 'confirmed-official', 'bz-dd-priest', +1),
        F(
          'Race-specific Priest spells add variety (Undead: Touch of Weakness, Dark Sacrifice; Troll: Hex of Weakness, Shadowguard).',
          'confirmed-official',
          'bz-dd-priest',
          +1,
        ),
      ],
      roleFlexibility: [F('Healer or ranged DPS, switchable with dual spec at 40.', 'confirmed-official', 'bz-dd-priest', +1)],
      fantasy: [
        F('You already have an Undead Priest from the beta (cap 30); beta progress does not carry over to live.', 'confirmed-official', 'bz-devnotes', 0),
        F('Shadow’s identity “only shows up pretty late”, around Shadowform.', 'reported-guide', 'iv-shadow', -1),
      ],
    },
    toolkit: {
      10: ['Smite', 'Lesser Heal', 'Shadow Word: Pain', 'Power Word: Shield', 'Renew', 'Fade', 'Mind Blast', 'Wand'],
      30: [
        'Mind Flay (talent)',
        'Devouring Plague (all races)',
        'Vampiric Embrace (talent)',
        'Psychic Scream',
        'Flash Heal',
        'Heal',
        'Holy Fire',
        'Dispel Magic',
        'Silence (talent)',
        'Penance / Binding Heal (healer talents)',
      ],
      60: ['Shadow Word: Death (32)', 'Shadowform (40)', 'Greater Heal', 'Prayer of Healing', 'Prayer of Mending (Holy)', 'Power Infusion (Disc)'],
    },
    risks: [
      'Shadow leveling stays “DoT + Mind Blast + wand” until the mid-20s.',
      'Shadow’s raid spot depends on its own damage now that Shadow Weaving is self-only.',
      'Your existing beta Priest is an emotional pull, not evidence about gameplay.',
    ],
    openQuestions: [
      'Whether Lightwell exists at 40 (official post says removed; datamine shows it trained).',
      'Final values of 31-point talents (Shadowform, Prayer of Mending, Power Infusion).',
      'Whether Silence works on raid bosses.',
    ],
  },
};

for (const [id, summary, names, toolkit] of [
  [
    'warrior',
    'Melee damage or tanking with rage, weapon swings and stances. Heroic Strike and Cleave replace the next main-hand swing; their rage is paid when it lands.',
    ['Arms', 'Fury', 'Protection'],
    {
      10: ['Charge', 'Heroic Strike', 'Rend', 'Battle Stance', 'Defensive Stance'],
      30: ['Slam', 'Execute', 'Victory Rush', 'Revenge', 'Shield Block'],
      60: ['Mortal Strike', 'Bloodthirst', 'Whirlwind', 'Shield Slam'],
    },
  ],
  [
    'rogue',
    'Melee damage with energy, stealth, poisons and target-specific combo points. Build points with weapon attacks and spend them on finishers.',
    ['Assassination', 'Combat', 'Subtlety'],
    {
      10: ['Stealth', 'Sinister Strike', 'Backstab', 'Eviscerate'],
      30: ['Poisons', 'Kick', 'Kidney Shot', 'Vanish'],
      60: ['Mutilate', 'Hemorrhage', 'Adrenaline Rush'],
    },
  ],
])
  CLASS_FACTS[id] = {
    summary,
    identity:
      'The implemented kit uses the stored Forever research snapshot, Classic stat formulas and estimated gear. Damage at 60 is a simulation projection.',
    specs: names.map((name) => ({
      id: name.toLowerCase(),
      name,
      role: name === 'Protection' ? 'Tank' : 'Melee DPS',
      identity:
        name === 'Protection'
          ? 'Shield, threat and defensive cooldowns.'
          : id === 'warrior'
            ? 'Weapon damage, rage management and stance requirements.'
            : 'Energy pacing, combo points and positional attacks.',
      raidLoop: 'See the selected build’s briefing for its abilities and rotation.',
      loopStatus: 'simulation approximation',
    })),
    toolkit,
    dims: {},
    risks: [
      id === 'warrior'
        ? 'Rage depends on fighting; queued strikes replace rage-generating white swings.'
        : 'Leather armor, melee positioning and energy limit sustained damage.',
    ],
    openQuestions: ['Level-60 gear and final Forever tuning remain estimates. No preference prior is assigned from simulation DPS.'],
  };

// Sourced rows for the classes added in phase 4. A row stays empty where no source says
// anything: the analysis then leaves facts on that row out of the score for every class.
CLASS_FACTS.warrior.dims = {
  leveling: [
    F('Victory Rush activates for 20 s after killing a non-trivial enemy and heals 10 % of maximum health.', 'confirmed-official', 'bz-dd-warrior', +1),
    F('Very little natural healing, so leveling alone can be less forgiving than on a Hunter or Warlock.', 'reported-guide', 'iv-main', -1),
  ],
  combatDepth: [F('Built around weapons, rage, stances and momentum; a talent lets Rend trigger Overpower.', 'confirmed-official', 'bz-dd-warrior', 0)],
  dungeon: [F('“Any party or raid is happy to add a Warrior as either a tank or damage dealer.”', 'confirmed-official', 'bz-dd-warrior', +1)],
  raid: [
    F(
      'Unique buffs and debuffs, and a strength in sustained damage to multiple melee targets. Battle Shout is raid-wide.',
      'confirmed-official',
      'bz-dd-warrior',
      +1,
    ),
  ],
  soloIndependence: [F('“They lack the tools to easily recover from taking too much damage.”', 'confirmed-official', 'bz-dd-warrior', -1)],
  roleFlexibility: [F('Tank or melee damage. Bloodthirst no longer heals.', 'confirmed-official', 'bz-dd-warrior', +1)],
  fantasy: [F('Described as “a durable, hard-hitting combatant”.', 'confirmed-official', 'bz-dd-warrior', 0)],
};
CLASS_FACTS.rogue.dims = {
  combatDepth: [
    F('Combat tricks, bleeds, cleave with Blade Flurry and poisons, depending on spec. Sap no longer breaks Stealth.', 'confirmed-official', 'bz-dd-rogue', 0),
  ],
  dungeon: [F('“Welcome in any party or raid for their Stealth and control abilities.”', 'confirmed-official', 'bz-dd-rogue', +1)],
  raid: [F('“The highest potential single-target melee damage in the game.” Potential, not a measured live ranking.', 'confirmed-official', 'bz-dd-rogue', +1)],
  roleFlexibility: [F('Melee damage is the only role.', 'reported-guide', 'iv-main', -1)],
  fantasy: [F('“The masters of Stealth”, and the only class with poisons.', 'confirmed-official', 'bz-dd-rogue', 0)],
};
CLASS_FACTS.warrior.openQuestions.push(
  'No sourced Forever statement yet on Warrior PvP, world utility, session length or long-term play: those rows have no facts.',
);
CLASS_FACTS.rogue.openQuestions.push(
  'No sourced Forever statement yet on Rogue leveling, PvP, world utility, solo play, session length or long-term play: those rows have no facts.',
);

CLASS_FACTS.shaman = {
  summary: 'Elemental ranged damage, Enhancement melee and Restoration healing, with manually placed elemental totems.',
  identity: 'One totem of each element. Level 10 baseline; three builds at 30 and 60. Orc portrait currently available.',
  specs: [
    {
      id: 'elemental',
      name: 'Elemental',
      role: 'Ranged DPS',
      identity: 'Flame Shock, Lava Burst and lightning.',
      raidLoop: 'Flame Shock, Lava Burst, Lightning Bolt; Chain Lightning for multiple targets.',
      loopStatus: 'official mechanics; provisional tuning',
    },
    {
      id: 'enhancement',
      name: 'Enhancement',
      role: 'Melee DPS',
      identity: 'Two-handed melee, Stormstrike and Maelstrom.',
      raidLoop: 'Stormstrike then Earth Shock; Lightning Bolt with Maelstrom.',
      loopStatus: 'official mechanics; provisional tuning',
    },
    {
      id: 'resto',
      name: 'Restoration',
      role: 'Healer',
      identity: 'Triage and healing cooldowns.',
      raidLoop: 'Healing Wave; Riptide then Chain Heal at 60.',
      loopStatus: 'datamined healing ranks; simulation approximation',
    },
  ],
  dims: {
    combatDepth: [F('A diverse toolkit; four totems with placement, Totemic Projection and Recall.', 'confirmed-official', 'bz-dd-shaman', 0)],
    dungeon: [F('Totems “buff, heal, and solve problems for any party or raid they join”.', 'confirmed-official', 'bz-dd-shaman', +1)],
    raid: [
      F(
        'Resistance, Windfury and other totems reach the raid or party; Grace of Air and Strength of Earth are raid-wide.',
        'confirmed-official',
        'bz-dd-shaman',
        +1,
      ),
    ],
    pvp: [F('“Lack an effective crowd control.”', 'confirmed-official', 'bz-dd-shaman', -1)],
    soloIndependence: [
      F(
        '“Among the sturdiest of classes” with Mail and a Shield, yet they “need allies” for weaknesses in control and survivability.',
        'confirmed-official',
        'bz-dd-shaman',
        0,
      ),
    ],
    shortSessions: [F('Weapon imbues now last 60 minutes and totems have a 1 s global cooldown, so less upkeep.', 'confirmed-official', 'bz-dd-shaman', +1)],
    roleFlexibility: [F('“Effective melee or spell damage dealers and healers.” No tank spec.', 'confirmed-official', 'bz-dd-shaman', +1)],
    fantasy: [F('“Masters of totems.”', 'confirmed-official', 'bz-dd-shaman', 0)],
  },
  toolkit: {
    10: ['Lightning Bolt', 'Earth Shock', 'Flame Shock', 'Healing Wave', 'Earthbind', 'Searing Totem'],
    30: ['Lava Burst / Stormstrike / Mana Tide', 'Totemic Recall', 'Totemic Projection'],
    60: ['Elemental Mastery / Rage of the Far Seer / Riptide', 'Grace of Air'],
  },
  risks: [
    'Totems have limited range; mana and positioning matter.',
    'Damage ranks without retained Forever exports, unspecified proc rates, coefficients and gear are estimates.',
  ],
  openQuestions: [
    'Final beta tuning; unexported ranks and coefficients.',
    'No sourced Forever statement yet on Shaman leveling, world utility or long-term play: those rows have no facts.',
    'Call of the Elements uses a fixed support preset. Additional utility totems and other weapon imbues are outside this trial kit.',
  ],
};
