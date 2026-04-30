# Investor store boundary v1 — 2026-04-30

## Cel

Rozdzielenie `js/app/investor/investors-store.js` według odpowiedzialności bez zmiany UI, bez zmiany modelu danych i bez ruszania modułu RYSUNEK.

## Zakres

- `js/app/investor/investors-model.js` — klucze, domyślne statusy, daty/ID i normalizacja inwestora/pokoju.
- `js/app/investor/investors-local-repository.js` — lokalna granica storage inwestorów, aktualnego inwestora, usuniętych ID oraz odczyt źródeł recovery.
- `js/app/investor/investors-recovery.js` — odbudowa inwestorów ze snapshotu sesji, projektów i snapshotów Wyceny oraz izolacja danych testowych.
- `js/app/investor/investors-store.js` — cienka publiczna fasada `FC.investors` dla CRUD/search/current/sync.

## Kontrakt kompatybilności

Publiczne API `FC.investors` zostaje zachowane:

- `readAll`, `writeAll`, `search`, `getById`, `create`, `update`, `remove`,
- `getCurrentId`, `setCurrentId`, `sync`,
- `normalizeInvestor`, `normalizeRoom`, `DEFAULT_PROJECT_STATUS`, `KEY_*`,
- debugowe wejścia używane przez testy recovery.

## Cloud-readiness

- Nowe bezpośrednie użycia `localStorage` są ograniczone do `investors-local-repository.js` jako jawnej granicy adaptera.
- Logika normalizacji i recovery jest odseparowana od konkretnego storage, co ułatwia późniejszą wymianę lokalnego repozytorium na adapter Firestore/remote sync.
- Nie zmieniono formatu `fc_investors_v1`, `fc_current_investor_v1` ani `fc_investor_removed_ids_v1`, więc nie jest wymagana migracja danych.

## Testy / zabezpieczenia

- `node --check` dla nowych modułów inwestora: OK.
- `Index load-group audit`: OK.
- `APP smoke testy`: 24/24 OK; smoke pilnuje teraz obecności warstw `investorsModel`, `investorsLocalRepository`, `investorsRecovery` i fasady `FC.investors`.
- Dedykowany raport `INWESTOR smoke`: 26/26 OK z nowym kontraktem modułów inwestora.

- `node tools/rozrys-dev-smoke.js`: 72/72 OK.
- `node tools/local-storage-source-audit.js`: OK; 25 plików storage / 237 referencji, bez nowych rozproszonych zapisów poza świadomą granicą `investors-local-repository.js`.
- `node tools/dependency-source-audit.js`: OK; odświeżono `tools/reports/dependency-source-audit.md/json`.

## Nie ruszano

- UI inwestora.
- RYSUNEK.
- Model danych użytkownika i format localStorage.
- Backup/retencja backupów.
