# Publicatievoorbereiding

Bestaande GitHub-bestemming: https://github.com/Thenoxius/Azeroth-Class-Trials

## Lokaal klaarzetten

`npm ci`, `npm test`, `npm run audit`, `node scripts/verify-classic.mjs`, `npm run prepare:site`.

`site-preview/index.html` is een volledig HTML-document met de gebundelde code en assets; `.nojekyll` staat erbij. De bronmap, onderzoeksdata, artmasters, recoverybestanden en tests horen niet in de hosting-upload. De bundel gebruikt hash-navigatie zodat subpaden op GitHub Pages geen rewrite vereisen.

`.github/workflows/validate.yml` valideert een pull request en bewaart een previewartifact zonder Pages-deployment. De bestaande `pages.yml` bouwt en publiceert bij een push naar main; die voert nu ook de ability-audit en asset/CSS-verificatie uit. De GitHub Pages-instelling moet op GitHub Actions staan. De accountinstellingen en remote Actions-run zijn niet veranderd of uitgevoerd.

## Voor daadwerkelijke publicatie

- Review de lokale branch en de bronstatussen in docs/ability-audit/RESULTATEN.md.
- Beslis of de beperkte Shaman-preview zichtbaar mag zijn en of de open simulatieschattingen voldoende duidelijk zijn voor een publieke preview. Dit is geen volledig exacte Forever-simulator.
- Controleer bestaande saves via Settings & data. Browserstorage is per origin: localhost, file:// en github.io delen hun saves niet. Exporteer de save vóór de overstap en importeer hem op de publieke site; accounts/cloudsaves bestaan niet.
- Vul de Ko-fi-URL alleen in als de eigenaar een echt profieladres opgeeft.
- Publiceer uitsluitend na expliciete opdracht. Een push/merge naar main activeert de bestaande deployment.

Geen push, merge, upload of publicatie uitgevoerd. GitHub-configuratie en CI op de remote zijn nog niet daadwerkelijk gevalideerd.

Referentie: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
