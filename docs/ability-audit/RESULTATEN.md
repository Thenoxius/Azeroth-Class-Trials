# Forever-audit en Shaman-preview — 29 oktober 2026

Alles staat in de vaste projectmap, op `codex/azeroth-local`. Er is niets gepusht, gemerged of gepubliceerd.

## Wat de audit wel en niet bevestigt

De audit omvat alle 183 geregistreerde abilities van Hunter, Mage, Priest, Warrior, Rogue, de bestaande NPC-Warlock, Shaman, racials en Hunter-pets. Per ability staan definitie, bron, verwachte/werkelijke velden en onzekerheden in `audit.json`.

- **88 abilities:** de vastgelegde basisvelden komen overeen met `research/forever-ranks.json`.
- **40 abilities:** een deel van bereik, cooldown, casttijd of kosten is vergeleken met de ruwe Warrior/Rogue-spellbookdata.
- **55 abilities:** geen voldoende onafhankelijke numerieke referentie in het pakket; als schatting/onbevestigd gemarkeerd.
- **587 veldcontroles**, na correcties geen afwijkingen tegen de beschikbare referentievelden.

Dit zijn geen 183 volledig live-gevalideerde abilities. De opgeslagen clientdata is build 1.60.1.70630. Waar officiële patchnotes recenter zijn dan de vastgelegde tooltipinterpretatie, gaan die voor. Veel Wowhead-spellbookpagina's leveren via de webtool alleen een JavaScript-/botcontrolepagina. Een ontbrekende coëfficiënt is daarom niet als bevestigd gepresenteerd.

## Gecorrigeerd

- Warrior: Taunt 5 yards; Shield Wall 900s basis en 240s alleen met het betreffende talent; Impale vergroot de ability-critbonus en geen white crits; Two-Handed Weapon Specialization 3% volgens de beschikbare boom.
- Rogue: Precision 3%; Lethality maximaal 20% en alleen op de genoemde generators; offhand-specialisatie vermenigvuldigt de basisstraf van 50%; Aggression alleen op de genoemde abilities. Improved Poisons verhoogt proc-kans, Vile Poisons damage; Malice/Precision werken ook op poisons. Evasion 300s basis; Slice and Dice 100 yards volgens de raw reference. Blade Flurry krijgt geen tweede armorberekening of crit.
- Mage: Ignite krijgt de bronbonussen niet opnieuw over damage waarin die al verwerkt zijn.
- Priest: Renew en Devouring Plague kunnen critten, expliciet per effect ingeschakeld.
- Hunter: Lacerating Strikes kan critten.
- Shaman: Riptide direct coefficient .214, periodiek .1 per tick; Purification op het periodieke deel; eigen Riptide op het eerste Chain Heal-target geeft de beschreven 25%-bonus.
- Racial-update 26 oktober: Savage verwijderd, Command terug voor Hunter/Warlock-pets, Blood Fury 120s, Berserking 15s, Endurance alleen +5% health, Plainsrunning 2% per stack, Touch of the Grave 15s interne cooldown, Wind Blessed 2%, Skysight 15%/15s. Oude datamined labels zijn niet automatisch 'officieel'.

Alle concrete bronbevindingen staan in `reviewed-findings.json`. De officiële bevestiging geldt voor het benoemde onderdeel, niet automatisch voor de gehele abilityberekening.

## Bekende schattingen en open punten

- Classic-attributen, statconversies, gearprofielen, weapons, hit-/critformules, armor/resist-modellen en diverse powercoëfficiënten blijven benaderingen. Forever heeft gewijzigde itemisatie; gelijke basisranks maken einddamage niet exact.
- Exacte poison-AP-coëfficiënten zijn niet bevestigd. Het huidige poisonmodel heeft geen AP-bijdrage; dit is een inhoudelijk open punt, geen bewezen correcte nulcoëfficiënt. Charges worden niet gesimuleerd.
- Mutilate modelleert beide wapens samen; exacte onafhankelijke hand-procs/hitsemantiek blijven een vereenvoudiging. Hack and Slash gebruikt een haste-benadering. Diverse talentbuilds zijn geselecteerde simulatiewaarden, geen volledig gevalideerde talentcalculator.
- Sunder-threat/AP, Deep Wounds-AP en enkele bleed-/procinteracties hebben geen volledig geverifieerde live-formule.
- Riptide-tooltip en onderliggende effectvelden verschillen op sommige databasepagina's. De basissnapshot is behouden; de expliciete coefficients en Chain Heal-interactie zijn apart verwerkt.
- Leyline-/convergencebonusvoorwaarden en ontbrekende classsystemen zijn geen onderdeel van deze trials.
- Enemy health, reaction times en andere encounterwaarden zijn gameontwerp. De raidboss is na de broncorrecties van 340000 naar 300000 HP herijkt om de bestaande duur te behouden. Dat is geen Forever-bosswaarde.

De oude testgrenzen op damage ten opzichte van een NPC Rogue waren gebaseerd op te hoge NPC-waarden. Die zijn vervangen door controles op daadwerkelijke raidbijdrage/rolverdeling; spells zijn niet kunstmatig gebufft om een oude ratio te halen. De bot gebruikt nu een passende specialisatie en level-10 stealth-opener.

## Shaman: eerste speelbare stap

Restoration-preview voor Orc op level 30 (T3) en 60 (T5), via dezelfde characterflow. Level 10, T1/T2/T4, Elemental, Enhancement en handmatige totemplaatsing zijn niet beschikbaar. Totems werken voorlopig als de bestaande groepsbuffabstractie. Deze beperkingen staan in de UI en Codex. Geen nieuwe art toegevoegd.

Geautomatiseerd: drie seeds in de dungeon en drie in de raid, met een healerbot op de echte engine-inputroute. Browser: character aanmaken, alleen ondersteunde trials kiezen, juiste healer-party, bestaande portretten en actionbar gecontroleerd. De browsercontrole gebruikte een aparte localhost-origin op poort 4175 om bestaande saves te sparen.

## Herhaalbare controles

- `npm test`: alle class-, trial-, source-/mechanic-regressies en Shaman-previewtests.
- `npm run audit`: auditbestanden regenereren en bronveldafwijkingen laten falen.
- `node scripts/measure-scaling.mjs`: 120s dummy, vijf seeds, alle vijf volledige speelbare classes en specs op 10/30/60. Output: `docs/local-validation/damage-scaling.json`. Dit is simulatie-DPS, geen live Forever-benchmark. Shaman wordt via healingtests gecontroleerd.
- `npm run prepare:site`: lokale standalone publicatiebundel in `site-preview/`.

## Primaire bronnen

- [Officiële beta development notes, inclusief 26 oktober](https://us.forums.blizzard.com/en/wow/t/wow-forever-beta-development-notes-%E2%80%93-updated-october-26/2360696/1)
- [Officiële Mage/Shaman deep dive](https://worldofwarcraft.blizzard.com/en-us/news/24302097/world-of-warcraft-forever-class-deep-dives-mage-and-shaman)
- [Riptide-spelldata](https://www.wowhead.com/forever/spell=1239243/riptide) — datamine, geen officiële runtimegarantie.
- Projectbronnen: `research/forever-ranks.json`, `research/forever-warrior-rogue.json`, `research/research-{hunter,mage,priest,global}.json`.

## Definitieve validatie

Op 29 oktober 2026: **20/20 testbestanden geslaagd**, 587 bronveldcontroles zonder afwijking tegen de beschikbare snapshotvelden, build en controle van 14 assets/184 CSS-regels geslaagd. De standalone publicatiebundel is bytegelijk aan de geteste HTML. Logs: `docs/local-validation/ability-audit-tests.txt` en `ability-audit-scaling.txt`. Browsercontrole en screenshot: `docs/local-validation/shaman-restoration-preview.jpg`.

Dit groene resultaat neemt de inhoudelijke onzekerheden hierboven niet weg. De 55 abilities zonder voldoende numerieke referentie en de genoemde formules zijn niet als live-bevestigd opgewaardeerd.


## Shaman-vervolg na Claude 033cef5

De eerdere beperkingen van de Restoration-preview zijn achterhaald. Zie `../SHAMAN.md` voor de drie speelbare builds, de nieuwe broncontrole, de resterende schattingen en actuele validatie. Claude’s losse-artbuild, desktopkeuze en verwijderde Ko-fi-link blijven behouden.
