# DEPENDENCY_SOURCE_AUDIT — raport źródłowy

Raport generowany przez `node tools/dependency-source-audit.js`. To jest raport pomocniczy do `DEPENDENCY_MAP.md`, nie zamiennik ręcznej analizy przed refaktorem.

## Podsumowanie

| Metryka | Wartość |
| --- | --- |
| Pliki JS | 295 |
| Skrypty w index.html | 230 |
| Skrypty w dev_tests.html | 250 |
| Krawędzie zależności po symbolach FC | 1464 |
| Symbole FC z właścicielem produkcyjnym | 219 |
| Symbole FC z właścicielem razem | 243 |
| Pliki z ryzykiem wysokim / nie ruszać | 10 |
| Pliki z ryzykiem średnim | 50 |

## Obszary

| Obszar | Pliki | Linie | Storage refs | Dialog refs | Wysokie | Średnie |
| --- | --- | --- | --- | --- | --- | --- |
| TESTY | 42 | 10772 | 234 | 1 | 6 | 22 |
| ROZRYS | 42 | 8860 | 6 | 0 | 1 | 4 |
| SZAFKI | 27 | 6388 | 0 | 0 | 0 | 3 |
| WYCENA | 42 | 6238 | 0 | 0 | 0 | 6 |
| INWESTOR | 23 | 3315 | 24 | 0 | 1 | 3 |
| UI | 27 | 3037 | 0 | 6 | 0 | 2 |
| PROJEKT | 10 | 2019 | 0 | 0 | 0 | 6 |
| MATERIAŁ | 14 | 1970 | 8 | 3 | 0 | 1 |
| POMIESZCZENIA | 12 | 1909 | 0 | 1 | 0 | 0 |
| OPTIMIZER | 12 | 1589 | 0 | 0 | 0 | 1 |
| RYSUNEK | 1 | 1459 | 0 | 11 | 1 | 0 |
| KATALOG/USŁUGI | 9 | 1349 | 0 | 0 | 0 | 1 |
| DANE/STORAGE | 15 | 1325 | 36 | 0 | 0 | 0 |
| BOOT/APP SHELL | 5 | 1273 | 4 | 0 | 1 | 1 |
| SHARED | 10 | 822 | 0 | 0 | 0 | 0 |
| ZAKŁADKI | 2 | 218 | 0 | 0 | 0 | 0 |
| CORE | 2 | 128 | 0 | 0 | 0 | 0 |

## Największe pliki

| Plik | Linie | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/tabs/rysunek.js | 1459 | RYSUNEK | nie ruszać bez osobnego planu |
| js/testing/investor/tests.js | 912 | TESTY | wysokie |
| js/app/rozrys/rozrys.js | 842 | ROZRYS | wysokie |
| js/app/cabinet/cabinet-fronts.js | 838 | SZAFKI | średnie |
| js/testing/project/tests.js | 835 | TESTY | wysokie |
| js/testing/cabinet/tests.js | 806 | TESTY | wysokie |
| js/app/cabinet/cabinet-modal-set-wizard.js | 693 | SZAFKI | średnie |
| js/app/cabinet/cabinet-modal.js | 650 | SZAFKI | średnie |
| js/testing/wycena/suites/central-status-sync.js | 649 | TESTY | wysokie |
| js/app.js | 591 | BOOT/APP SHELL | wysokie |
| js/app/investor/investor-ui.js | 589 | INWESTOR | wysokie |
| js/app/rozrys/rozrys-render.js | 493 | ROZRYS | średnie |
| js/testing/rozrys/tests.js | 475 | TESTY | wysokie |
| js/app/ui/actions-register.js | 449 | UI | średnie |
| js/app/cabinet/cabinet-modal-standing-specials.js | 434 | SZAFKI | niskie |
| js/app/rozrys/rozrys-pickers.js | 406 | ROZRYS | średnie |
| js/app/project/project-status-manual-guard.js | 395 | PROJEKT | średnie |
| js/testing/test-data-manager.js | 393 | TESTY | średnie |
| js/testing/rozrys/suites/helpers-bridges.js | 390 | TESTY | wysokie |
| js/app/cabinet/cabinet-choice-launchers.js | 388 | SZAFKI | niskie |

## Największy wpływ bezpośredni

| Plik | Zależne pliki | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/app/quote/quote-snapshot-store.js | 38 | WYCENA | średnie |
| js/app/shared/storage.js | 34 | DANE/STORAGE | niskie |
| js/app/investor/investors-store.js | 33 | INWESTOR | średnie |
| js/app/shared/utils.js | 33 | SHARED | niskie |
| js/app/shared/room-registry.js | 28 | POMIESZCZENIA | niskie |
| js/testing/shared/harness.js | 27 | TESTY | niskie |
| js/app.js | 24 | BOOT/APP SHELL | wysokie |
| js/app/project/project-store.js | 24 | PROJEKT | średnie |
| js/app/project/project-bridge.js | 23 | PROJEKT | średnie |
| js/app/ui/info-box.js | 23 | UI | niskie |
| js/testing/wycena/suites/core-offer-basics.js | 20 | TESTY | średnie |
| js/app/ui/confirm-box.js | 19 | UI | niskie |
| js/app/shared/constants.js | 18 | SHARED | niskie |
| js/app/investor/investor-persistence.js | 17 | INWESTOR | średnie |
| js/app/project/project-status-snapshot-flow.js | 17 | PROJEKT | średnie |
| js/app/project/project-status-sync.js | 17 | PROJEKT | średnie |
| js/app/optimizer/cut-optimizer.js | 16 | OPTIMIZER | średnie |
| js/testing/wycena/fixtures.js | 16 | TESTY | średnie |
| js/app/ui/panel-box.js | 15 | UI | niskie |
| js/testing/wycena/suites/architecture-contract.js | 15 | TESTY | średnie |

## Największy wpływ drugiego poziomu

| Plik | Pliki pośrednio zależne | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/app/shared/utils.js | 110 | SHARED | niskie |
| js/app/shared/storage.js | 107 | DANE/STORAGE | niskie |
| js/app/shared/constants.js | 93 | SHARED | niskie |
| js/app/shared/room-registry.js | 81 | POMIESZCZENIA | niskie |
| js/app/project/project-store.js | 73 | PROJEKT | średnie |
| js/app/investor/investors-store.js | 71 | INWESTOR | średnie |
| js/app/ui/info-box.js | 60 | UI | niskie |
| js/app/investor/session.js | 58 | INWESTOR | średnie |
| js/app/project/project-bridge.js | 58 | PROJEKT | średnie |
| js/app/quote/quote-snapshot-store.js | 58 | WYCENA | średnie |
| js/app/ui/confirm-box.js | 57 | UI | niskie |
| js/app.js | 56 | BOOT/APP SHELL | wysokie |
| js/app/quote/quote-snapshot.js | 52 | WYCENA | średnie |
| js/app/catalog/catalog-store.js | 50 | KATALOG/USŁUGI | średnie |
| js/app/investor/investor-persistence.js | 50 | INWESTOR | średnie |
| js/app/shared/ui-state.js | 50 | SHARED | niskie |
| js/app/rozrys/rozrys-scope.js | 46 | ROZRYS | średnie |
| js/app/rozrys/rozrys.js | 44 | ROZRYS | wysokie |
| js/app/bootstrap/reload-restore.js | 43 | BOOT/APP SHELL | niskie |
| js/app/rozrys/rozrys-shell.js | 43 | ROZRYS | niskie |

## Najwięcej bezpośrednich referencji storage

| Plik | Referencje | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/testing/project/tests.js | 112 | TESTY | wysokie |
| js/testing/data-safety/tests.js | 44 | TESTY | niskie |
| js/testing/investor/tests.js | 20 | TESTY | wysokie |
| js/testing/material/tests.js | 19 | TESTY | niskie |
| js/app/shared/storage.js | 17 | DANE/STORAGE | niskie |
| js/testing/test-data-manager.js | 15 | TESTY | średnie |
| js/testing/wycena/fixtures.js | 13 | TESTY | średnie |
| js/app/investor/session.js | 12 | INWESTOR | średnie |
| js/testing/rysunek/tests.js | 10 | TESTY | średnie |
| js/app/investor/investors-local-repository.js | 9 | INWESTOR | niskie |
| js/app/shared/data-storage-keys.js | 7 | DANE/STORAGE | niskie |
| js/app/material/material-part-options.js | 4 | MATERIAŁ | niskie |
| js/app/shared/data-storage-audit.js | 4 | DANE/STORAGE | niskie |
| js/app/bootstrap/reload-restore.js | 3 | BOOT/APP SHELL | niskie |
| js/app/investor/investor-project-repository.js | 3 | INWESTOR | niskie |
| js/app/material/material-edge-store.js | 3 | MATERIAŁ | niskie |
| js/app/shared/data-backup-snapshot-apply.js | 3 | DANE/STORAGE | niskie |
| js/app/shared/data-backup-storage.js | 3 | DANE/STORAGE | niskie |
| js/app/rozrys/rozrys-cache.js | 2 | ROZRYS | niskie |
| js/app/rozrys/rozrys-grain.js | 2 | ROZRYS | niskie |

## Pliki ryzykowne

| Plik | Ryzyko | Score | Linie | Direct impact | 2nd level | Powody |
| --- | --- | --- | --- | --- | --- | --- |
| js/testing/project/tests.js | wysokie | 15 | 835 | 13 | 30 | 600+ linii; dużo publicznych symboli FC; dużo zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą; łączy DOM/eventy i storage |
| js/app/rozrys/rozrys.js | wysokie | 9 | 842 | 9 | 44 | 600+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/central-status-sync.js | wysokie | 9 | 649 | 15 | 20 | 600+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/tests.js | wysokie | 9 | 475 | 7 | 29 | 400+ linii; kilka zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/testing/investor/tests.js | wysokie | 8 | 912 | 1 | 1 | 600+ linii; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/testing/cabinet/tests.js | wysokie | 8 | 806 | 6 | 30 | 600+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app.js | wysokie | 8 | 591 | 24 | 56 | 400+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/app/investor/investor-ui.js | wysokie | 8 | 589 | 7 | 20 | 400+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/helpers-bridges.js | wysokie | 8 | 390 | 14 | 29 | 250+ linii; dużo publicznych symboli FC; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/fixtures.js | średnie | 7 | 154 | 16 | 21 | dużo zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/tabs/rysunek.js | nie ruszać bez osobnego planu | 6 | 1459 | 2 | 25 | 600+ linii; systemowe dialogi |
| js/app/ui/actions-register.js | średnie | 6 | 449 | 0 | 0 | 400+ linii; dużo zależności wychodzących; systemowe dialogi |
| js/testing/rozrys/suites/scope-runtime-controllers.js | średnie | 6 | 369 | 7 | 17 | 250+ linii; kilka publicznych symboli FC; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/scope-entry.js | średnie | 6 | 361 | 15 | 20 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/investor-integration.js | średnie | 6 | 356 | 15 | 20 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/project-stock.js | średnie | 6 | 342 | 13 | 30 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/architecture-contract.js | średnie | 6 | 321 | 15 | 20 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/state-ui-runtime.js | średnie | 6 | 305 | 7 | 17 | 250+ linii; kilka publicznych symboli FC; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/core-offer-workflow.js | średnie | 6 | 277 | 15 | 20 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/app/quote/quote-snapshot.js | średnie | 6 | 257 | 10 | 52 | 250+ linii; dużo zależnych plików; kilka zależności wychodzących |
| js/testing/wycena/suites/core-offer-basics.js | średnie | 6 | 252 | 20 | 29 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rysunek/tests.js | średnie | 6 | 117 | 6 | 30 | kilka zależnych plików; kilka zależności wychodzących; bezpośredni storage poza oczywistą granicą; systemowe dialogi |
| js/app/cabinet/cabinet-modal-set-wizard.js | średnie | 5 | 693 | 0 | 0 | 600+ linii; kilka zależności wychodzących |
| js/app/project/project-status-manual-guard.js | średnie | 5 | 395 | 8 | 29 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/testing/test-data-manager.js | średnie | 5 | 393 | 7 | 24 | 250+ linii; kilka zależnych plików; bezpośredni storage poza oczywistą granicą |
| js/tabs/wycena.js | średnie | 5 | 348 | 6 | 22 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/app/rozrys/rozrys-scope.js | średnie | 5 | 317 | 14 | 46 | 250+ linii; dużo zależnych plików |
| js/app/quote/quote-snapshot-store.js | średnie | 5 | 315 | 38 | 58 | 250+ linii; dużo zależnych plików |
| js/app/project/project-status-scope.js | średnie | 5 | 313 | 5 | 25 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/app/project/project-status-sync.js | średnie | 5 | 309 | 17 | 38 | 250+ linii; dużo zależnych plików |
| js/app/project/project-status-snapshot-flow.js | średnie | 5 | 270 | 17 | 37 | 250+ linii; dużo zależnych plików |
| js/app/rozrys/rozrys-engine.js | średnie | 5 | 270 | 6 | 23 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/app/investor/session.js | średnie | 5 | 259 | 10 | 58 | 250+ linii; dużo zależnych plików |
| js/app/ui/views.js | średnie | 5 | 250 | 14 | 38 | 250+ linii; dużo zależnych plików; kilka zależności wychodzących |
| js/app/quote/quote-offer-store.js | średnie | 5 | 238 | 12 | 36 | dużo zależnych plików; kilka zależności wychodzących |

## Potencjalnie nieładowane przez index/dev_tests

- js/app/rozrys/rozrys-accordion.js
- js/app/rozrys/rozrys-grain-modal.js
- js/app/rozrys/rozrys-options-modal.js
- js/app/rozrys/rozrys-progress.js
- js/app/rozrys/rozrys-runner.js
- js/app/rozrys/rozrys-stock-modal.js

## Braki w HTML względem plików

- index.html — brakujące pliki wskazane w skryptach: brak
- dev_tests.html — brakujące pliki wskazane w skryptach: brak

## Szczegóły zależności dla największych punktów wpływu

### js/app/quote/quote-snapshot-store.js

- Obszar: WYCENA
- Kategoria: domain/controller
- Ryzyko: średnie (250+ linii; dużo zależnych plików)
- Definiuje FC: quoteSnapshotStore
- Bezpośrednio zależne pliki (38): js/app/project/project-schedule-status.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-scope.js<br>js/app/project/project-status-snapshot-flow.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-pdf.js<br>js/app/quote/quote-scope-entry-scope.js<br>js/app/quote/quote-scope-entry-utils.js +30
- Pośrednio zależne pliki (58): js/app/investor/investor-persistence.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-schedule-status.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-mirrors.js<br>js/app/project/project-status-scope-decision.js<br>js/app/project/project-status-scope.js +50

### js/app/shared/storage.js

- Obszar: DANE/STORAGE
- Kategoria: store/storage
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: storage
- Bezpośrednio zależne pliki (34): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-store.js<br>js/app/investor/investor-project-repository.js +26
- Pośrednio zależne pliki (107): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-selectors.js<br>js/app/catalog/catalog-store.js +99

### js/app/investor/investors-store.js

- Obszar: INWESTOR
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików)
- Definiuje FC: investors
- Bezpośrednio zależne pliki (33): js/app/investor/investor-persistence.js<br>js/app/investor/investor-project-patches.js<br>js/app/investor/investor-project-repository.js<br>js/app/investor/investor-rooms.js<br>js/app/project/project-schedule-status.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-mirrors.js<br>js/app/project/project-status-scope.js +25
- Pośrednio zależne pliki (71): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project-patches.js<br>js/app/investor/investor-project-repository.js<br>js/app/investor/investor-project-runtime.js<br>js/app/investor/investor-project.js<br>js/app/investor/investor-rooms.js +63

### js/app/shared/utils.js

- Obszar: SHARED
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: utils
- Bezpośrednio zależne pliki (33): js/app.js<br>js/app/cabinet/cabinet-fronts.js<br>js/app/cabinet/cabinet-modal-hanging.js<br>js/app/cabinet/cabinet-modal-module.js<br>js/app/cabinet/cabinet-modal-standing-corner-standard.js<br>js/app/cabinet/cabinet-modal-standing-front-controls.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/catalog/catalog-domain.js +25
- Pośrednio zależne pliki (110): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-selectors.js<br>js/app/catalog/catalog-store.js +102

### js/app/shared/room-registry.js

- Obszar: POMIESZCZENIA
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: roomRegistry
- Bezpośrednio zależne pliki (28): js/app/investor/investor-room-actions.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-mirrors.js<br>js/app/project/project-status-scope.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-scope-entry-scope.js +20
- Pośrednio zależne pliki (81): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project-runtime.js<br>js/app/investor/investor-room-actions.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui.js +73

### js/testing/shared/harness.js

- Obszar: TESTY
- Kategoria: test
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: testHarness
- Bezpośrednio zależne pliki (27): js/testing/cabinet/tests.js<br>js/testing/data-safety/tests.js<br>js/testing/dev-tests-page.js<br>js/testing/dev-tests-registry.js<br>js/testing/investor/tests.js<br>js/testing/material/tests.js<br>js/testing/project/tests.js<br>js/testing/rozrys/tests.js +19
- Pośrednio zależne pliki (26): js/testing/cabinet/tests.js<br>js/testing/dev-tests-page.js<br>js/testing/dev-tests-registry.js<br>js/testing/investor/tests.js<br>js/testing/project/tests.js<br>js/testing/rozrys/suites/helpers-bridges.js<br>js/testing/rozrys/suites/project-stock.js<br>js/testing/rozrys/tests.js +18

### js/app.js

- Obszar: BOOT/APP SHELL
- Kategoria: bootstrap/orchestrator
- Ryzyko: wysokie (400+ linii; dużo zależnych plików; dużo zależności wychodzących)
- Definiuje FC: project, appView
- Bezpośrednio zależne pliki (24): js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-project-patches.js<br>js/app/investor/investor-project-runtime.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js<br>js/app/project/project-bridge.js +16
- Pośrednio zależne pliki (56): js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-project-patches.js<br>js/app/investor/investor-project-runtime.js<br>js/app/investor/investor-project.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js +48

### js/app/project/project-store.js

- Obszar: PROJEKT
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików)
- Definiuje FC: projectStore
- Bezpośrednio zależne pliki (24): js/app/investor/investor-project-repository.js<br>js/app/project/project-bridge.js<br>js/app/project/project-schedule-status.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-mirrors.js<br>js/app/project/project-status-scope.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-scope-entry-flow.js +16
- Pośrednio zależne pliki (73): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project-patches.js<br>js/app/investor/investor-project-runtime.js<br>js/app/investor/investor-rooms.js +65

### js/app/project/project-bridge.js

- Obszar: PROJEKT
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików)
- Definiuje FC: project
- Bezpośrednio zależne pliki (23): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-project-patches.js<br>js/app/investor/investor-project-runtime.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js +15
- Pośrednio zależne pliki (58): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-project-patches.js<br>js/app/investor/investor-project-runtime.js<br>js/app/investor/investor-project.js<br>js/app/investor/project-autosave.js +50

### js/app/ui/info-box.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: infoBox
- Bezpośrednio zależne pliki (23): js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-modals.js<br>js/app/investor/investor-pdf.js<br>js/app/investor/investor-ui.js<br>js/app/material/magazyn.js<br>js/app/material/price-modal-context.js +15
- Pośrednio zależne pliki (60): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-ui.js<br>js/app/material/price-modal-filters.js<br>js/app/material/price-modal-item-form.js<br>js/app/material/price-modal-list.js<br>js/app/material/price-modal-options.js<br>js/app/material/price-modal-persistence.js +52

### js/testing/wycena/suites/core-offer-basics.js

- Obszar: TESTY
- Kategoria: test
- Ryzyko: średnie (250+ linii; dużo zależnych plików; dużo zależności wychodzących)
- Definiuje FC: registerWycenaTests, roomRegistry, confirmBox
- Bezpośrednio zależne pliki (20): js/testing/investor/tests.js<br>js/testing/rozrys/suites/helpers-bridges.js<br>js/testing/rozrys/suites/project-stock.js<br>js/testing/rozrys/tests.js<br>js/testing/wycena/fixtures.js<br>js/testing/wycena/suites/architecture-contract.js<br>js/testing/wycena/suites/central-status-sync.js<br>js/testing/wycena/suites/core-offer-workflow.js +12
- Pośrednio zależne pliki (29): js/testing/cabinet/tests.js<br>js/testing/dev-tests-registry.js<br>js/testing/investor/tests.js<br>js/testing/material/tests.js<br>js/testing/project/tests.js<br>js/testing/rozrys/suites/helpers-bridges.js<br>js/testing/rozrys/suites/optimizer-contracts.js<br>js/testing/rozrys/suites/output-bootstrap.js +21

### js/app/ui/confirm-box.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: confirmBox
- Bezpośrednio zależne pliki (19): js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/investor/investor-modals.js<br>js/app/investor/investor-ui.js<br>js/app/material/magazyn.js<br>js/app/material/material-part-options.js<br>js/app/material/price-modal-context.js<br>js/app/rozrys/rozrys-ui-tools.js +11
- Pośrednio zależne pliki (57): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/material/material-edge-store.js<br>js/app/material/price-modal-filters.js<br>js/app/material/price-modal-item-form.js<br>js/app/material/price-modal-list.js<br>js/app/material/price-modal-options.js<br>js/app/material/price-modal-persistence.js +49

### js/app/shared/constants.js

- Obszar: SHARED
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: constants
- Bezpośrednio zależne pliki (18): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/catalog/catalog-store.js<br>js/app/investor/investor-project-repository.js<br>js/app/investor/investors-model.js<br>js/app/investor/session.js<br>js/app/material/magazyn.js<br>js/app/project/project-bridge.js +10
- Pośrednio zależne pliki (93): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-selectors.js<br>js/app/catalog/catalog-store.js +85

### js/app/investor/investor-persistence.js

- Obszar: INWESTOR
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików)
- Definiuje FC: investorPersistence
- Bezpośrednio zależne pliki (17): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-status-mirrors.js<br>js/app/project/project-status-scope.js<br>js/app/project/project-status-snapshot-flow.js<br>js/app/ui/actions-register.js<br>js/app/ui/views.js +9
- Pośrednio zależne pliki (50): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-project-runtime.js<br>js/app/investor/investor-room-actions.js<br>js/app/investor/investor-ui.js<br>js/app/material/material-edge-store.js +42

### js/app/project/project-status-snapshot-flow.js

- Obszar: PROJEKT
- Kategoria: domain/controller
- Ryzyko: średnie (250+ linii; dużo zależnych plików)
- Definiuje FC: projectStatusSnapshotFlow, projectStatusSync
- Bezpośrednio zależne pliki (17): js/app/investor/investor-persistence.js<br>js/app/project/project-schedule-status.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-sync.js<br>js/app/shared/room-registry-impact.js<br>js/app/wycena/wycena-tab-status-bridge.js<br>js/testing/investor/tests.js<br>js/testing/wycena/suites/architecture-contract.js +9
- Pośrednio zależne pliki (37): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-schedule-status.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-mirrors.js +29
