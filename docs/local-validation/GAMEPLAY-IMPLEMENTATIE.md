# Warrior en Rogue – lokale implementatie

Werkmap: outputs/azeroth-class-trials, branch codex/wow-classic-menus. Niets gepusht of gepubliceerd.

## Wijzigingen

- Missiebriefing kiest aangemaakte characters op naam; selectie gebruikt character-ID en ras, en remount ook bij twee characters van dezelfde class.
- Warrior en Rogue zijn beschikbaar in alle vijf trials en in Analysis. Warrior heeft DPS- en tankroutes in dungeon en raid; de speler vervangt daar de NPC-hoofdtank.
- Heroic Strike en Cleave worden klaargezet voor de volgende main-hand swing. Nogmaals drukken annuleert; rage wordt bij uitvoering betaald. Bij onvoldoende rage volgt een gewone slag. De knop toont de actieve selectie.
- Whirlwind-offhand krijgt de ontbrekende bijdrage van attack power.
- Rogue toont combo points in de bestaande resourcebalk. Codex beschrijft beide kits; er zijn geen verzonnen voorkeursscores toegevoegd.
- Analysis vergelijkt tankruns apart van DPS-runs. Oude saves krijgen bij migratie alleen hun oorspronkelijke drie legacy-characters.

## Damage-meting

Reproduceerbaar met `node scripts/measure-scaling.mjs`: 120 seconden tegen dezelfde-level dummy met Classic armor, vijf seeds per build, normale competent-bot, inclusief aanlooptijd. Ruwe gegevens: damage-scaling.json.

| Class/spec | L10 | L30 | L60 |
| --- | ---: | ---: | ---: |
| Warrior Arms | 12,3 | 53,2 | 187,2 |
| Warrior Fury | 12,3 | 55,0 | 232,6 |
| Rogue Assassination | 12,9 | 61,3 | 218,6 |
| Rogue Combat | 12,9 | 66,2 | 225,2 |
| Rogue Subtlety | 12,9 | 59,6 | 189,6 |

Op level 10 is er één basisbuild per class. De schade stijgt op alle gemeten specialisaties met level. Dit controleert de app-simulatie, niet definitieve live Forever-balans. Arms en enkele Rogue-builds blijven onder de algemene oudere L60-richtband van 230 DPS; geen kunstmatige buff toegevoegd om die grens te halen. Gear en L60-tuning zijn bestaande projectaannames.

## Controles

Volledige testsuite: 18 testbestanden, inclusief alle vijf trialmatrices (competent/careless, meerdere seeds), Warrior tank en Priest healer. Nieuwe regressietest voor queued strikes op 10/30/60: queue, cancel, uitgestelde ragebetaling, vervanging white swing, fallback bij onvoldoende rage. Build en asset/CSS-verificatie slagen.

Browser: bestaand lokaal testsave gebruikt; aangemaakte Tauren Warrior gekozen in briefing, juiste race vergrendeld, Protection/tank geselecteerd en dungeon gestart met speler + vier juiste NPC-rollen. Rogue Combat raid geopend, actionbar en energy/combo-display gecontroleerd. Screenshots: screenshots/warrior-tank-dungeon.jpg en screenshots/rogue-raid.jpg. De volledige gevechten zijn geautomatiseerd via de echte engine-inputroute getest; niet alle gevechten handmatig uitgespeeld.

Belangrijkste bronbestanden: src/engine/core.js, src/content/classes/warrior.js, src/content/encounters/t3-dungeon.js, t4-pvp.js, t5-raid.js, src/content/index.js, facts.js, src/analysis/model.js, analyze.js, src/ui/App.jsx, screens/Briefing.jsx, battle/ActionBar.jsx, Frames.jsx. Tests: next-swing.test.mjs, bots/trial-suite.mjs, bots/warrior.mjs en analysis.test.mjs.
