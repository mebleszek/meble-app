# Wycena snapshot selection split v1 — 2026-04-28

## Zakres

Techniczny split `quote-snapshot-store.js` bez zmiany UI, działania Wyceny, danych, storage ani backupów.

## Zmiany

- Dodano `js/app/quote/quote-snapshot-selection.js` jako moduł fabryki API dla selection/status flow snapshotów:
  - `markSelectedForProject`,
  - `syncSelectionForProjectStatus`,
  - `getRecommendedStatusForProject`,
  - `getRecommendedStatusMapForProject`,
  - `convertPreliminaryToFinal`.
- `quote-snapshot-store.js` deleguje selection/status flow do `FC.quoteSnapshotSelection.createApi(...)`, a sam zostaje właścicielem storage, normalizacji snapshotu i list/filter API.
- `quote-snapshot-store.js` spadł z ok. 438 linii do ok. 314 linii.
- Dodano kontrakty `js/testing/wycena/suites/snapshot-selection-contract.js`.
- `WYCENA node smoke` rozszerzono do 9 testów i obejmuje teraz architekturę, scope oraz selection split.

## Zachowane kontrakty

- `FC.quoteSnapshotStore` zachowuje publiczne API używane przez Wycena/status/PDF.
- Nie zmieniono semantyki `rejected`: wybór nowej oferty dla tego samego exact-scope odznacza poprzednią selekcję, ale nie archiwizuje jej automatycznie jako rejected.
- `convertPreliminaryToFinal` nadal promuje wycenę wstępną do finalnej i czyści kolidujące zaznaczenia w tym samym zakresie.
- Brak nowego storage i brak zmian modelu danych.

## Wynik techniczny

- `quote-snapshot-store.js` ma ok. 314 linii i jest teraz średnim store/fasadą, a nie miejscem pełnej logiki selection.
- `quote-snapshot-selection.js` ma ok. 208 linii i jedną odpowiedzialność: selection/status flow snapshotów po wstrzyknięciu zależności ze store.
- Kolejny najbardziej logiczny etap Wyceny to `wycena-core.js` collect/validation split albo `project-status-sync.js`, ale dopiero po osobnych kontraktach/fiksturach dla danego obszaru.
