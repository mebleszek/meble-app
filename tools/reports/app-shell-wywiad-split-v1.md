# app shell / WYWIAD split v1 — 2026-04-27

## Baza

Start z paczki `site_rozrys_speedmax_split_v1_download.zip`, czyli ostatniej stabilnej bazy sprzed zmian RYSUNKU. Zmiany z paczek `site_rysunek_dialogs_contracts_v1.zip`, `site_rysunek_rebuild_fix_v1.zip` i `site_rysunek_rebuild_fresh_v1.zip` nie zostały przeniesione.

## Zakres

- Bez zmian UI.
- Bez zmian zachowania funkcji.
- Bez ruszania ROZRYS / algorytmu rozkroju.
- Bez ruszania RYSUNKU.
- Bez ruszania runtime Wyceny.
- Bez zmian danych, storage i backupów.

## Co przeniesiono

1. `renderCabinets()` został wyciągnięty z `js/app.js` do `js/app/ui/cabinets-render.js`.
2. Render aktywnej zakładki WYWIAD, czyli `renderWywiadTab()` i `renderSingleCabinetCard()`, został przeniesiony do `js/tabs/wywiad.js`.
3. `js/app.js` zachowuje stare globalne funkcje jako cienkie delegatory, żeby istniejące wywołania `renderCabinets()`, `renderWywiadTab()` i `renderSingleCabinetCard()` nie zmieniły kontraktu.
4. Dodano `js/app/ui/cabinets-render.js` do load order w `index.html`, `dev_tests.html`, `tools/index-load-groups.js` i `tools/app-dev-smoke-lib/file-list.js`.

## Wynik linii

- `js/app.js`: 790 → 590 linii.
- `js/app/ui/cabinets-render.js`: 124 linie.
- `js/tabs/wywiad.js`: 197 linii.

## Kontrakt zachowany

- `renderCabinets()` nadal istnieje globalnie.
- `renderWywiadTab()` nadal istnieje globalnie przez delegator w `app.js`.
- `renderSingleCabinetCard()` nadal istnieje globalnie przez delegator w `app.js`.
- Router zakładek nadal rejestruje `wywiad` przez `js/tabs/wywiad.js`.
- Karta szafki zachowuje te same klasy, markup akcji i zachowanie kliknięć.
- Akcje `Edytuj`, `Materiały`, `Usuń` nadal delegują do tych samych starych funkcji.

## Testy i ograniczenia środowiska

- Sprawdzono składnię zmienionych plików przez parser `new Function(...)`.
- Sprawdzono `index.html` przez eksportowane `verifyIndex()` z `tools/check-index-load-groups.js`: 190 skryptów, 0 błędów.
- `node tools/rozrys-dev-smoke.js`: 72/72 OK.
- `node tools/app-dev-smoke.js` nie zwrócił wyniku w tym środowisku narzędziowym; runner wisi na asynchronicznych testach/timerach, więc nie jest wpisany jako zaliczony.

## Następny krok

Po tej paczce nie dokładać już logiki renderu listy szafek do `app.js`. Następny bezpieczny punkt optymalizacji to WYCENA, ale tylko po ścieżkach: `js/tabs/wycena.js`, `wycena-core.js`, `quote-snapshot-store.js` i `project-status-sync.js` mają zostać ruszone osobnymi etapami z kontraktami statusów/ofert.
