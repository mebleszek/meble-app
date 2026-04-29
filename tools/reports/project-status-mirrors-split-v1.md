# Project status mirrors split v1 — 2026-04-28

## Zakres

Techniczny split statusów Wyceny/projektu bez zmiany UI, wyglądu, storage, backupów ani logiki biznesowej.

## Zmiany

- Dodano `js/app/project/project-status-mirrors.js`.
- Z `js/app/project/project-status-sync.js` wydzielono techniczne zapisy mirrorów statusu:
  - `saveInvestorRooms`,
  - `updateProjectRecord`,
  - `updateLoadedProject`,
  - `syncStatusMirrors`,
  - `refreshStatusViews`.
- `project-status-sync.js` zachowuje publiczne API `FC.projectStatusSync` i deleguje zapisy do `FC.projectStatusMirrors`.
- `project-status-sync.js` spadł z ok. 397 do ok. 317 linii.
- Dodano kontrakty `js/testing/wycena/suites/project-status-mirrors-contract.js`.

## Load order

Krytyczna kolejność:

1. `js/app/project/project-status-scope.js`
2. `js/app/project/project-status-mirrors.js`
3. `js/app/project/project-status-sync.js`

Zaktualizowano:

- `index.html`,
- `dev_tests.html`,
- `tools/index-load-groups.js`,
- `tools/app-dev-smoke-lib/file-list.js`.

## Zachowane kontrakty

- `FC.projectStatusSync.syncStatusMirrors` pozostaje publicznym wejściem i wskazuje wydzieloną implementację mirrorów.
- `_debug.saveInvestorRooms` i `_debug.updateLoadedProject` nadal są dostępne przez `FC.projectStatusSync._debug`.
- `applyProjectStatusChange(...)` nadal zapisuje status pokoju inwestora.
- `syncStatusMirrors(...)` nadal zapisuje `projectStore.status`, `loadedProject.meta.projectStatus` i `loadedProject.meta.roomDefs[*].projectStatus`.

## Cloud-readiness

Nie dodano nowych bezpośrednich zapisów do `localStorage/sessionStorage`. Warstwa mirrorów nadal używa istniejących fasad (`investorPersistence`, `investors`, `projectStore`, `project.save`), ale ma teraz osobny moduł, który w przyszłości będzie naturalnym miejscem pod adapter zapisu chmurowego.

## Testy wykonane w paczce

- `node --check` dla nowych i zmienionych plików JS.
- `node tools/check-index-load-groups.js`.
- `node tools/app-dev-smoke.js`.
- `WYCENA node smoke` przez `FC.wycenaDevTests.runNodeSmoke()`.
- `node tools/rozrys-dev-smoke.js`.
- `node tools/wycena-architecture-audit.js`.
- `node tools/dependency-source-audit.js`.
- Test poprawności ZIP-a.
