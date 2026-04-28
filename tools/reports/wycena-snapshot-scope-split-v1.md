# Wycena snapshot scope split v1 — 2026-04-28

## Zakres

Techniczny split `quote-snapshot-store.js` bez zmiany UI, działania Wyceny, danych, storage ani backupów.

## Zmiany

- Dodano `js/app/quote/quote-snapshot-scope.js` jako czysty moduł helperów scope ofert:
  - normalizacja pokojów,
  - etykiety zakresu,
  - materialScope,
  - nazwy wersji ofert,
  - exact-scope,
  - overlap scope,
  - rejected snapshot helpers.
- `js/app/quote/quote-snapshot-store.js` deleguje helpery zakresu do `FC.quoteSnapshotScope`, a sam zostaje odpowiedzialny za odczyt/zapis listy snapshotów, selekcję oferty i zmianę flag selected/rejected.
- `quote-snapshot-store.js` spadł z ok. 658 linii do ok. 438 linii.
- Dodano kontrakty `js/testing/wycena/suites/snapshot-scope-contract.js`.
- `WYCENA node smoke` rozszerzono o kontrakty snapshot scope.

## Zachowane kontrakty

- `FC.quoteSnapshotStore` zachowuje publiczne API używane przez Wycena/status/PDF.
- Publiczne helpery `normalizeRoomIds`, `getScopeRoomLabels`, `getSnapshotRoomIds`, `filterRowsByRoomScope`, `sameRoomScope`, `snapshotScopeOverlaps` i `isRejectedSnapshot` pozostają dostępne przez `FC.quoteSnapshotStore`.
- Store deleguje te helpery do `FC.quoteSnapshotScope`; dalsze zmiany scope mają iść do nowego modułu, nie z powrotem do store.
- Brak nowego storage i brak zmian modelu danych.

## Wynik techniczny

- `quote-snapshot-store.js` nadal ma ok. 438 linii i jest plikiem średniego ryzyka ze względu na wpływ na Wycena/status/PDF.
- `quote-snapshot-scope.js` ma ok. 303 linie i jedną odpowiedzialność: pure helpers scope snapshotów.
- Kolejne cięcie snapshot-store powinno dotyczyć selection/rejected albo status candidate flow, ale dopiero po osobnym kontrakcie dla `markSelectedForProject`, `syncSelectionForProjectStatus` i `convertPreliminaryToFinal`.
