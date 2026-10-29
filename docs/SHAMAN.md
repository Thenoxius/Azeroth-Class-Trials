# Shaman na Claude’s overdracht — 29 oktober 2026

## Uitgangspunt

Vaste projectmap: C:\Users\thoma\OneDrive\Documents\projects\azeroth-class-trials. Branch: codex/azeroth-local, basis 033cef5. Claude’s commits 7414cca en 033cef5 zijn behouden: desktop, geen Ko-fi, metalen battle-bovenrand, labelverplaatsing en art als losse bestanden. Alle 212 reeds gecommitte artbestanden zijn byte-identiek gebleven. Er is niets gepusht, gemerged of gepubliceerd. De live site van Claude is hierdoor niet gewijzigd.

## Speelbaar

- Level 10: basiskit, inclusief Lightning Bolt, Shocks, Healing Wave, Lightning Shield, Rockbiter en Earth/Fire-totems.
- Level 30 en 60: Elemental en Enhancement als DPS; Restoration als healer in dungeon en raid.
- Alle vijf trials ondersteunen bestaande Shaman-characters. Roster, Hall en saves blijven gebruikt worden. Orc blijft de beschikbare player-race; uitbreiding van races valt buiten deze stap.
- Goedgekeurde Earth/Fire/Water/Air-art wordt lokaal gebundeld. Eén eigen totem per element, vaste positie, bereik, vervanging, levensduur, overlijden/vernietiging, Recall en Projection.
- Mana Spring/Healing Stream/Mana Tide werken binnen een gesimuleerde subgroep van maximaal vijf; Strength/Grace hebben raidbereik. De bestaande NPC-buffabstractie blijft behouden; gelijke buffs stapelen niet.
- Shields zijn wederzijds exclusief. Weapon imbues vervangen elkaar. Stormstrike, Maelstrom, Clearcasting, Elemental Mastery en Rage of the Farseer zijn aangesloten op de werkelijke cast-/damagepaden.

Dit is een trial-kit, geen implementatie van elk spellbook-onderdeel. Call of the Elements heeft een vast supportpreset (drie totems op 30, vier op 60). Extra Call-presets, overige utility-totems, Ghost Wolf en aanvullende weapon imbues zijn niet toegevoegd.

## Gevonden en gecorrigeerd

- Onmogelijke talentcombinaties vervangen door expliciete 21-/51-puntsbuilds. Tests controleren rijen, vereisten en aantallen tegen de opgeslagen talentboom.
- Ontbrekende Clearcasting en Eye of the Storm aangesloten. Geen eigen DPS-correctiefactoren, extra classbuffs of gewijzigde vijandwaarden gebruikt.
- Mana Tide mist zijn vierde puls niet meer; 4 × 290 mana op 60.
- Shocks delen cooldowns; misses zetten geen Flame/Frost Shock-debuff. Een misser bewaart Stormstrike; een volledig geabsorbeerde maar geraakte spell verbruikt hem.
- Maelstrom verlaagt zowel casttijd als manakosten. Enhancement-autopilot gebruikt Stormstrike, zodat hij Attack niet continu aan/uit schakelt.
- Mana Springs stapelen niet; vervangen/verwijderen van totems ruimt hun buffs op. Totems zijn geen heal-doelen en verschijnen niet als extra raidleden.
- De healer-testbot blijft achter de tank en probeert geen vijand te benaderen zodra healing klaar is. De DPS-bot gebruikt racials, stopt runners en kan met weinig mana op melee terugvallen.

## Bronstatus

**Gecontroleerd tegen opgeslagen Forever-datamine:** rankvelden, mana, beschikbare cast times/range/cooldowns en talentteksten in research/forever-shaman-{spellbook,talents,tree,ranks}.json. Shaman heeft 31 geregistreerde abilities. De totale audit bevat 752 veldvergelijkingen, met 0 afwijkingen. Een match tegen de datamine is geen officiële runtimebevestiging.

**Officieel ondersteunde mechaniek:** de recente class/development notes, waaronder de totem-GCD, plaatsing/Recall/Projection en de gewijzigde capstones. De details staan naast de abilities; de audit noemt beta-data en officiële claims afzonderlijk.

**Nog schatting of onbevestigd:** gear en wapens; Classic-afgeleide health/mana/AP/crit/regen; niet rechtstreeks geëxporteerde spellpowercoëfficiënten; Maelstrom-prockans (20% als expliciete voorlopige modelparameter); Windfury-lockout (3 s Classic-aanname); Water Shield-triggerinterval (3,5 s); tickcoëfficiënten en het precieze Searing-aanvalsinterval. Raid-subgroepen zijn een trialindeling, geen reconstructie van een echte raid.

**Bronconflict:** de opgeslagen level-60 Lava Burst-tooltip noemt 54% bonus bij Flame Shock, terwijl de officiële class-uitleg 20% beschrijft. De implementatie behoudt 20% en markeert de discrepantie. Het lage directe damagebereik van Chain Lightning is wel overgenomen uit de Forever-export, zonder normalisatie omhoog.

**Open mechaniek:** AoE/DoT-vatbaarheid van totems is niet voor Forever bevestigd. De huidige engine laat grondschade toe; totems kunnen daarin verdwijnen. Ik heb geen Classic-immuniteit als vermeende bevestigde Forever-buff toegevoegd. NPC-totems blijven abstracte buffs en hebben daardoor geen identieke levenscyclus aan player-totems.

## Validatie

- npm test: **21/21 testbestanden geslaagd**, inclusief alle vijf trialmatrices, bestaande classes en gerichte Shaman-regressies.
- npm run audit: **752 velden, nul afwijkingen** binnen de vergeleken bronvelden.
- node scripts/verify-classic.mjs: **14 assets / 181 CSS-regels** gecontroleerd.
- npm run art en npm run prepare:site: geslaagd; preview.html + art/ voor de site en index.html als inline artifact blijven gescheiden volgens Claude’s build.
- Echte browser op 1280×720 en 1920×1080 desktop: bestaand Audit Shaman-save zichtbaar, Hall/briefing/spec-/role-keuzes en echte action-barbediening gecontroleerd. Vier totems via Call of the Elements geplaatst; **13 raidframes vóór en na plaatsing**. Geen nieuwe menu-CSS of gewijzigde gevechtsafmetingen.
- T2: Elemental **4/6**, Enhancement **6/6** competent; beide careless **0/6**. Dit zijn botresultaten, geen Forever-balanceoordeel.
- Geen mobiele validatie, overeenkomstig de nieuwe desktop-afspraak. Geen handmatig volledig gevecht op de live site gespeeld.

### Damage-schaalmeting

120 seconden tegen een trainingsdummy, vijf seeds, dezelfde bestaande geschatte gearprofielen. Dit meet de implementatie en botstrategie; het is geen live Forever-DPS-benchmark en geen balansdoel.

| Level | Build | Gemiddelde DPS | Bereik |
|---|---|---:|---:|
| 10 | Basiskit | 15.5 | 15–17 |
| 30 | elemental | 39.7 | 37–41 |
| 30 | enhancement | 95.5 | 87–104 |
| 60 | elemental | 197.4 | 177–206 |
| 60 | enhancement | 269.5 | 252–304 |

### Bestanden

Gameplay: src/content/classes/shaman.js, shaman-builds.js, shaman-totems.js; src/content/data/shaman-ranks.js; stats, party, common, content registry en T3/T5-aansluiting. Engine-aanpassingen beperken zich tot totemselectie en API-toegang. UI: bestaande Roster, Shaman-briefingdata, totemtokens en uitsluiting uit raidframes. Geen restyling van de innerlijke combatlayout.

Brondata en audit: research/forever-shaman*.json, forever-ranks.json, scripts/audit-abilities.mjs, docs/ability-audit/. Tests: tests/shaman-mechanics.test.mjs, shaman-preview.test.mjs, bots/shaman.mjs en trial-suite.mjs. Art: assets/shaman-totems-v1/, spell-icons-extra/, src/ui/art/img/ en art-images.gen.js.

Logs staan in docs/local-validation/shaman-{tests,audit,scaling,t2}.txt en shaman-validation.json. Screenshot: shaman-enhancement-totems.png.
