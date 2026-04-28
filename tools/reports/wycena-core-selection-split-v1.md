# Wycena core selection split v1 — 2026-04-28

## Zakres

Techniczny split `js/app/wycena/wycena-core.js` bez zmiany UI, wyglądu, storage i logiki biznesowej.

## Zmiany

- Dodano `js/app/wycena/wycena-core-selection.js`.
- Przeniesiono do niego wybór pomieszczeń, material scope i walidację wejścia wyceny:
  - `getActiveRooms`,
  - `normalizeMaterialScope`,
  - `normalizeQuoteSelection`,
  - `decodeSelectedRooms`,
  - `decodeMaterialScope`,
  - `validateQuoteSelection`,
  - `validateQuoteContent`,
  - `createQuoteValidationError`.
- `js/app/wycena/wycena-core.js` zachowuje stare publiczne API przez delegaty do modułu selection.
- `wycena-core.js` spadł z ok. 652 linii do ok. 539 linii.
- Dodano kontrakty `js/testing/wycena/suites/core-selection-contract.js`.

## Kontrakty

Nowa suite pilnuje, że:

1. `FC.wycenaCoreSelection` ma komplet funkcji selection/validation.
2. Publiczne funkcje `FC.wycenaCore` nadal istnieją.
3. `FC.wycenaCore` i `FC.wycenaCoreSelection` dają ten sam wynik dla normalizacji i walidacji wyboru pokoju.
4. Nieistniejący pokój nadal daje `selected_room_missing`.
5. Pusta oferta nadal daje `empty_quote_scope`.

## Load order

Nowa kolejność krytyczna:

```text
js/app/wycena/wycena-core-selection.js
js/app/wycena/wycena-core.js
```

Ta kolejność została wpisana w:

- `index.html`,
- `dev_tests.html`,
- `tools/index-load-groups.js`,
- `tools/app-dev-smoke-lib/file-list.js`.

## Czego nie ruszano

- Brak zmian UI i CSS.
- Brak zmian RYSUNKU.
- Brak zmian ROZRYS i optymalizatora.
- Brak zmian `quote-snapshot-store.js`, `project-status-sync.js`, PDF i historii ofert.
- Brak nowych kluczy storage i brak migracji danych.

## Następne kandydaty

- `project-status-sync.js` — największy i najbardziej ryzykowny obszar statusów; wymaga dedykowanych kontraktów old/new.
- `tabs/wycena.js` / `wycena-tab-selection.js` — dalszy UI-flow selection, ale bez mieszania ze store statusów.
- `wycena-core.js` — kolejne cięcie dopiero po kontraktach dla collect material/AGD/quote-rate lines.
