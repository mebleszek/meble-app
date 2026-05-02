# schedule-status-prep-v1

Baza startowa: `site_manual_status_preserve_v1.zip`.

Zakres:

- przygotowanie statusów pod przyszły harmonogram bez budowy UI kalendarza,
- zapis planu harmonogramu w `DEV.md`,
- dodanie read-only boundary `js/app/project/project-schedule-status.js`,
- dodanie kontraktów testowych `js/testing/wycena/suites/schedule-status-contract.js`.

Decyzje:

- `Pomiar` jest kolejką `measurement`.
- `Wycena` po pomiarze jest kolejką `finalQuote`.
- Brak wyceny wstępnej nie blokuje statusu procesowego.
- Pomieszczenie bez szafek może czekać na wycenę końcową, ale boundary zwraca `quoteBlockedReason: Brak szafek`.
- Zaakceptowana wspólna wycena wstępna pozostaje jednym snapshotem z wieloma `roomIds`; harmonogram ma rozpoznawać zakres bez duplikowania oferty per pokój.

Nie zmieniono:

- UI,
- RYSUNKU,
- backupów,
- storage i migracji danych,
- logiki kalkulacji Wyceny.

Nowe / zmienione punkty ładowania:

- `index.html`,
- `dev_tests.html`,
- `tools/index-load-groups.js`,
- `tools/app-dev-smoke-lib/file-list.js`,
- kontrakt app smoke `Statusy pod harmonogram mają read-only boundary`.

Testy wykonane przed paczką:

- `node --check js/app/project/project-schedule-status.js`,
- `node --check js/testing/wycena/suites/schedule-status-contract.js`,
- `node --check tools/app-dev-smoke.js`,
- `node --check tools/index-load-groups.js`,
- `node --check tools/app-dev-smoke-lib/file-list.js`,
- `node tools/check-index-load-groups.js` — OK,
- `node tools/app-dev-smoke.js` — 32/32 OK,
- pełne `FC.wycenaDevTests.runAll()` w Node — 103/103 OK,
- `node tools/rozrys-dev-smoke.js` — 72/72 OK,
- `node tools/local-storage-source-audit.js` — OK,
- `node tools/dependency-source-audit.js` — OK,
- `node tools/wycena-architecture-audit.js` — OK.
