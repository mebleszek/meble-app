# Project status boundary v1

Zakres: rozdzielenie odpowiedzialności w statusach projektu/Wyceny bez zmiany UI, bez zmiany formatu danych i bez ruszania RYSUNKU.

## Problem przed zmianą

`js/app/project/project-status-sync.js` mieszał w jednym pliku:

1. zapis luster statusów do inwestora/projektu/aktywnego projektu,
2. odświeżanie widoków po zmianie statusu,
3. silnik `apply/reconcile` dla statusu projektu i pomieszczeń,
4. workflow zaakceptowanych snapshotów ofertowych.

To naruszało główne kryterium optymalizacji: plik z 2+ odpowiedzialnościami jest długiem architektonicznym.

## Podział po zmianie

1. `js/app/project/project-status-mirrors.js`
   - zapisuje statusy/lustra do danych,
   - odświeża zależne widoki,
   - nie decyduje o statusie biznesowym.

2. `js/app/project/project-status-sync.js`
   - zostaje centralnym silnikiem rekonsyliacji i aplikowania statusów,
   - deleguje zapis luster do `FC.projectStatusMirrors`,
   - utrzymuje publiczną fasadę `FC.projectStatusSync`.

3. `js/app/project/project-status-snapshot-flow.js`
   - obsługuje zaakceptowanie snapshotu, cofnięcie po usunięciu snapshotu i promocję wstępnej oferty do końcowej,
   - rozszerza kompatybilnie `FC.projectStatusSync`.

## Testy i audyty

- `node --check` dla nowych/zmienionych JS — OK.
- `node tools/check-index-load-groups.js` — OK.
- `node tools/app-dev-smoke.js` — 27/27 OK.
- `node tools/rozrys-dev-smoke.js` — 72/72 OK.
- `node tools/local-storage-source-audit.js` — bez nowych storage refs; 25 plików / 234 referencje.
- `node tools/dependency-source-audit.js` — raport odświeżony.
- `node tools/wycena-architecture-audit.js` — raport odświeżony.

## Decyzje bezpieczeństwa

- Nie zmieniano formatu danych.
- Nie dodano nowego `localStorage`.
- Nie zmieniano UI.
- Nie ruszano RYSUNKU.
- Publiczne wejścia `FC.projectStatusSync.*` zostały zachowane.
