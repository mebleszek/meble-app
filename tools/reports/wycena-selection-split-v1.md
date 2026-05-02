# Wycena selection split v1 — 2026-05-02

## Zakres

Techniczny split `js/app/wycena/wycena-tab-selection.js` bez zmiany UI, storage, danych, statusów ani zachowania biznesowego Wyceny.

## Nowy podział

- `wycena-tab-selection-scope.js` — normalizacja wyboru zakresu, etykiety pokojów i summary pól wyboru.
- `wycena-tab-selection-version.js` — nazwy wersji wyceny, sprawdzanie konfliktów exact-scope i prompt nazwy kolejnego wariantu.
- `wycena-tab-selection-model.js` — cienka fasada modelu łącząca scope i version.
- `wycena-tab-selection-pickers.js` — otwieranie pickerów pomieszczeń i zakresu elementów.
- `wycena-tab-selection-render.js` — render sekcji wyboru zakresu w zakładce WYCENA.
- `wycena-tab-selection.js` — publiczna fasada `FC.wycenaTabSelection` zachowująca dotychczasowy kontrakt.

## Zabezpieczenia

- Load order zaktualizowany równolegle w `index.html`, `dev_tests.html`, `tools/index-load-groups.js` i `tools/app-dev-smoke-lib/file-list.js`.
- `tools/app-dev-smoke.js` ma nowy kontrakt pilnujący warstw scope/version/model/pickers/render/fasada.
- `tools/wycena-architecture-audit.js` uwzględnia nowe moduły w raporcie Wyceny.

## Linie po splicie

- `wycena-tab-selection-version.js` — ok. 194 linie.
- `wycena-tab-selection-pickers.js` — ok. 158 linii.
- `wycena-tab-selection-scope.js` — ok. 106 linii.
- `wycena-tab-selection-render.js` — ok. 63 linie.
- `wycena-tab-selection-model.js` — ok. 10 linii.
- `wycena-tab-selection.js` — ok. 11 linii.

## Nie ruszano

- RYSUNEK.
- UI wizualnego pickerów i sekcji wyboru zakresu.
- Logiki statusów `Pomiar → Wycena` i historii zaakceptowanej wyceny wstępnej.
- Storage, backupów i modelu snapshotów.
