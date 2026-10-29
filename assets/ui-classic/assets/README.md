# Stijlassets

Deze assets zijn gemaakt uit de door Thomas aangeleverde screenshot van de originele WoW Community Site, aangevuld met twee kleine handmatig gedefinieerde SVG's. Ze volgen de goedgekeurde mockup. Er zijn geen nieuwe character-/terrainbeelden gegenereerd. Herkomst en uitsneden staan in het manifest. Het WoW-beeldmateriaal blijft bestaand Blizzard-beeldmateriaal uit die referentie.

## Gebruik

- `metal-top-tile`: horizontaal herhalen, native hoogte 87 px. Geen scene- of characterdelen in deze tegel.
- `forest-left` en `forest-right`: eenmaal links/rechts onder de bovenrand; zwarte pagina-achtergrond laat de beelden wegvallen. Niet horizontaal herhalen als een boskaart.
- `night-elf-side-plate`: één decoratieve plaat links van de sidebar, 196 x 516 px; bestaande donkere achtergrond. Geen transparante cutout, geen interactieve content. Verbergen wanneer de breedte onvoldoende is.
- `wow-wordmark`: originele woordmerkuitsnede, 183 x 73 px. Voeg Class Trials als live tekst toe of gebruik het complete SVG-alternatief.
- `parchment-tile`: herhaalbare inhoudstextuur. Het tekstcontrast komt uit de CSS, niet uit het beeld.
- `content-edge-left/right`: decoratieve verticale randstroken. Boven inhoud als pointer-events:none of buiten de contentbox plaatsen. Behoud een leesbare padding naast de randen.
- `blue-title-middle`: herhaalbaar blauw midden, zonder letters. De titel is echte tekst.
- `blue-title-left/right`: aparte eindstukken; niet uitrekken over de hele balk.
- `nav-left-cap`: het bestaande kleine menu-embleem.
- `nav-right-chevron`: nieuwe eenvoudige SVG-eindcap met pijl, passend bij een direct navbutton; geen misleidend plusje voor een accordion die niet bestaat.
- `world-of-warcraft-class-trials.svg`: compleet logo-alternatief met embedded woordmerk en vectorondertitel.

De PNG's behouden de screenshotpixels. WebP's hebben dezelfde afmetingen, kwaliteit 90 en zijn kleiner voor de build. Vergelijk de contact sheet bij twijfel. De bron is screenshotresolutie, geen opnieuw teruggevonden hoge-resolutie artwork. De goedgekeurde compositie is bij native schaal uitvoerbaar; voorkom sterk opschalen.

Menu-materialen worden niet toegepast op bestaande actionbar, frames, tooltip of terrein. Zie BATTLE_GRENZEN.md.
