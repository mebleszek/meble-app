# Orphan fixture cleanup v1 — 2026-05-01

## Zakres

Naprawa testów i bezpieczeństwa danych po wykryciu, że ręczne testy aplikacji potrafiły po uruchomieniu ponownie pokazywać osierocone sloty `fc_project_inv_*_v1`.

## Przyczyna

`withInvestorProjectFixture` w testach Wyceny przełączał aktywnego inwestora przez publiczne `FC.investors.setCurrentId`. Po splicie `investor-project` ta ścieżka poprawnie mirroruje aktywny projekt do legacy slotów `fc_project_inv_*_v1`. Fixture przywracał inwestorów, projectStore, snapshoty i aktywny projekt, ale nie przywracał pełnego zestawu legacy slotów projektu. W efekcie testowe sloty mogły zostać jako osierocone dane diagnostyczne.

## Zmiany

- `js/testing/wycena/fixtures.js`
  - dodano snapshot i restore wszystkich realnych legacy slotów `fc_project_inv_*_v1`, z pominięciem kluczy backupowych,
  - cleanup fixture przywraca teraz dokładnie poprzedni zestaw legacy slotów po przywróceniu inwestora.
- `js/testing/wycena/suites/architecture-contract.js`
  - dodano kontrakt, że fixture Wyceny nie zostawia po sobie nowych slotów projektu.
- `js/testing/data-safety/tests.js`
  - dodano kontrakt, że czyszczenie osieroconych projektów fizycznie usuwa osierocony slot i zostawia slot aktywnego inwestora.
- `dev_tests.html`
  - podbito cache-busting zmienionych testów.

## Wyniki sprawdzeń

- `node --check` dla zmienionych testów — OK.
- `node tools/app-dev-smoke.js` — 27/27 OK.
- `node tools/rozrys-dev-smoke.js` — 72/72 OK.
- `node tools/check-index-load-groups.js` — OK.
- `node tools/local-storage-source-audit.js` — 26 plików / 244 referencje; wzrost tylko w test tooling.
- `node tools/dependency-source-audit.js` — OK, raport odświeżony.
- `node tools/wycena-architecture-audit.js` — OK.
- Celowane testy danych + Wycena w Node: DATA 7/7 OK, WYCENA 98/98 OK, osierocone sloty po przebiegu: 0.

## Decyzja

To nie jest zmiana runtime aplikacji ani UI. To naprawa izolacji fixture testów i zabezpieczenie, żeby ręczne testy nie produkowały diagnostycznych sierot `fc_project_inv_*_v1`.
