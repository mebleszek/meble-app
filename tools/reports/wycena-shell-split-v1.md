# Wycena shell split v1 — 2026-04-28

Zakres: dalszy techniczny split `js/tabs/wycena.js` bez zmiany UI, zachowania WYCENY, danych, storage, RYSUNKU ani ROZRYS.

## Zmiany

1. Dodano `js/app/wycena/wycena-tab-dom.js` jako właściciela małych helperów DOM zakładki WYCENA (`h`, `labelWithInfo`).
2. Dodano `js/app/wycena/wycena-tab-status-actions.js` jako cienki adapter między `tabs/wycena.js` i istniejącym `wycena-tab-status-bridge`.
3. Dodano `js/app/wycena/wycena-tab-shell.js` jako właściciela renderu głównego shellu zakładki, topbara `Wyceń/PDF`, obsługi busy-state i scrolla po podglądzie.
4. `js/tabs/wycena.js` został zmniejszony z ok. 710 do ok. 590 linii i zostaje tymczasowo fasadą/spinaczem stanu, selekcji, historii i debug API.
5. Zaktualizowano load order w `index.html`, `dev_tests.html`, `tools/index-load-groups.js` i `tools/app-dev-smoke-lib/file-list.js`.
6. Rozszerzono kontrakt architektury Wyceny oraz szybki Node smoke o nowe moduły shell/status-actions/dom.

## Granice odpowiedzialności

- `wycena-tab-dom.js` — tylko małe helpery DOM zgodne z dotychczasowym markupiem.
- `wycena-tab-status-actions.js` — tylko adapter/delegowanie statusów do istniejącego status bridge, bez nowego storage i bez nowych reguł statusów.
- `wycena-tab-shell.js` — tylko render głównej karty, przyciski topbara i scroll; nie zapisuje snapshotów i nie rozstrzyga statusów.
- `tabs/wycena.js` — nadal trzyma stan zakładki, zależności i publiczne debug API, ale nie powinien już odzyskiwać renderu preview/shell ani statusowych delegatorów inline.

## Czego nie zmieniono

- Brak zmian UI i wyglądu.
- Brak zmian w modelu danych, storage, backupach i snapshot-store.
- Brak zmian w `project-status-sync.js`, `quote-snapshot-store.js`, `wycena-core.js` i runtime ROZRYS/RYSUNEK.
- Brak nowych systemowych `alert/confirm/prompt`.

## Testy wykonane przy paczce

- `node --check js/app/wycena/wycena-tab-dom.js`
- `node --check js/app/wycena/wycena-tab-status-actions.js`
- `node --check js/app/wycena/wycena-tab-shell.js`
- `node --check js/tabs/wycena.js`
- `node --check js/testing/wycena/suites/architecture-contract.js`
- `node --check tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js` → 24/24 OK
- `node tools/rozrys-dev-smoke.js` → 72/72 OK
- `node tools/wycena-architecture-audit.js`
- `node tools/dependency-source-audit.js`

## Następne bezpieczne kroki

1. Nie dokładać kolejnej logiki do `tabs/wycena.js`; jeśli trzeba kontynuować WYCENĘ, kolejnym etapem powinny być fixture old/new dla `wycena-core.js`, `quote-snapshot-store.js` albo `project-status-sync.js`.
2. Nie ciąć `quote-snapshot-store.js` ani `project-status-sync.js` bez porównania exact-scope, selected/rejected i cofania statusów na fixture.
3. `wycena-tab-selection.js` jest nadal 400+ linii i wymaga osobnego planu, ale nie mieszać go z krytycznym store/status split.
