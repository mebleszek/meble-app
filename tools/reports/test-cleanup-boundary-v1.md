# Test cleanup boundary v1 — 2026-05-01

## Cel

Naprawa sprzątania danych testowych po pełnych przebiegach `dev_tests.html`, bez zmiany UI aplikacji i bez ruszania RYSUNKU.

Problem po poprzednich etapach: testy przechodziły, ale w normalnej liście inwestorów mogły zostawać wpisy fixture typu `Jan Test` i `Room patch`, a powiązane legacy sloty `fc_project_inv_*_v1` mogły wracać jako osierocone projekty.

## Zmiany

1. `js/testing/test-data-manager.js`
   - dodano `seedInvestor()` jako kontrolowaną ścieżkę tworzenia testowego inwestora z markerami `__test`, `__testRunId` i `meta.testData`, z zachowaniem przekazanego `id`,
   - rozszerzono klasyfikację legacy fixture’ów testowych po nazwach, źródłach i znanych ID,
   - cleanup usuwa teraz pełny łańcuch danych testowych: inwestor → projectStore → legacy slot `fc_project_inv_*` → snapshoty Wyceny → drafty ofert → wskaźniki current,
   - cleanup usuwa też techniczne wpisy w rejestrze usuniętych ID, jeśli należą do testów.

2. `js/testing/investor/tests.js`
   - testy inwestora, które dotąd tworzyły fixture przez bezpośrednie `FC.investors.create`, używają teraz `seedInvestor()`; dzięki temu nawet przerwany test zostawia rekord oznaczony i możliwy do posprzątania.

3. `js/testing/wycena/fixtures.js`
   - fixture Wyceny oznacza inwestora i projekt przez `FC.testDataManager.markRecord()`, więc przerwany przebieg nie zostawia nieoznaczonych danych.

4. `js/testing/data-safety/tests.js`
   - dodano kontrakt: cleanup usuwa legacy inwestorów testowych razem z projektami, snapshotami, draftami i slotami, ale zostawia realnego inwestora oraz jego slot.

5. `js/app/investor/investors-recovery.js`
   - rozszerzono runtime filter legacy fixture’ów testowych, żeby nie pokazywać znanych nieoznaczonych testowych inwestorów w normalnej aplikacji, jeśli kiedyś wrócą z recovery.

## Zasady bezpieczeństwa

- Nie zmieniono formatu danych użytkownika.
- Nie dodano nowego produkcyjnego storage.
- Nie zmieniono retencji ręcznych/programowych backupów.
- Nie ruszano RYSUNKU.
- Czyszczenie nadal jest ograniczone do modułów testowych / dev tools i znanych fixture’ów testowych.

## Testy

Przeszło:

- `node --check` dla zmienionych JS,
- `node tools/check-index-load-groups.js`,
- `node tools/app-dev-smoke.js` — 28/28 OK,
- `node tools/rozrys-dev-smoke.js` — 72/72 OK,
- `node tools/local-storage-source-audit.js`,
- `node tools/dependency-source-audit.js`,
- `node tools/wycena-architecture-audit.js`,
- `FC.dataSafetyDevTests.runAll()` w Node — 9/9 OK,
- `FC.wycenaDevTests.runNodeSmoke()` w Node — 15/15 OK.

Uwaga: pełny `WYCENA runAll()` nie jest traktowany jako stabilny Node smoke w projekcie; pełny przebieg Wyceny sprawdzać z `dev_tests.html` w przeglądarce.
