# DEPENDENCY_SOURCE_AUDIT — raport źródłowy

Raport generowany przez `node tools/dependency-source-audit.js`. To jest raport pomocniczy do `DEPENDENCY_MAP.md`, nie zamiennik ręcznej analizy przed refaktorem.

## Podsumowanie

| Metryka | Wartość |
| --- | --- |
| Pliki JS | 316 |
| Skrypty w index.html | 242 |
| Skrypty w dev_tests.html | 273 |
| Krawędzie zależności po symbolach FC | 1700 |
| Symbole FC z właścicielem produkcyjnym | 232 |
| Symbole FC z właścicielem razem | 258 |
| Pliki z ryzykiem wysokim / nie ruszać | 7 |
| Pliki z ryzykiem średnim | 60 |

## Obszary

| Obszar | Pliki | Linie | Storage refs | Dialog refs | Wysokie | Średnie |
| --- | --- | --- | --- | --- | --- | --- |
| TESTY | 51 | 11124 | 242 | 1 | 5 | 30 |
| ROZRYS | 42 | 8860 | 6 | 0 | 1 | 4 |
| WYCENA | 45 | 6917 | 0 | 0 | 0 | 6 |
| SZAFKI | 28 | 6572 | 0 | 0 | 0 | 3 |
| INWESTOR | 25 | 3446 | 24 | 0 | 0 | 4 |
| UI | 27 | 3037 | 0 | 6 | 0 | 2 |
| MATERIAŁ | 14 | 2128 | 8 | 3 | 0 | 1 |
| PROJEKT | 10 | 2019 | 0 | 0 | 0 | 6 |
| POMIESZCZENIA | 12 | 1909 | 0 | 1 | 0 | 0 |
| OPTIMIZER | 12 | 1589 | 0 | 0 | 0 | 1 |
| RYSUNEK | 1 | 1459 | 0 | 11 | 1 | 0 |
| KATALOG/USŁUGI | 9 | 1381 | 0 | 0 | 0 | 1 |
| BOOT/APP SHELL | 7 | 1347 | 4 | 0 | 0 | 2 |
| DANE/STORAGE | 15 | 1325 | 36 | 0 | 0 | 0 |
| SHARED | 10 | 822 | 0 | 0 | 0 | 0 |
| ZAKŁADKI | 3 | 543 | 0 | 0 | 0 | 0 |
| INNE | 3 | 390 | 0 | 0 | 0 | 0 |
| CORE | 2 | 128 | 0 | 0 | 0 | 0 |

## Największe pliki

| Plik | Linie | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/tabs/rysunek.js | 1459 | RYSUNEK | nie ruszać bez osobnego planu |
| js/app/rozrys/rozrys.js | 842 | ROZRYS | wysokie |
| js/app/cabinet/cabinet-fronts.js | 838 | SZAFKI | średnie |
| js/testing/project/tests.js | 835 | TESTY | wysokie |
| js/testing/cabinet/tests.js | 806 | TESTY | wysokie |
| js/app/cabinet/cabinet-modal-set-wizard.js | 693 | SZAFKI | średnie |
| js/app/cabinet/cabinet-modal.js | 655 | SZAFKI | średnie |
| js/testing/wycena/suites/central-status-sync.js | 649 | TESTY | wysokie |
| js/app/rozrys/rozrys-render.js | 493 | ROZRYS | średnie |
| js/testing/rozrys/tests.js | 475 | TESTY | wysokie |
| js/app/ui/actions-register.js | 449 | UI | średnie |
| js/app/cabinet/cabinet-modal-standing-specials.js | 434 | SZAFKI | niskie |
| js/app/rozrys/rozrys-pickers.js | 406 | ROZRYS | średnie |
| js/app/project/project-status-manual-guard.js | 395 | PROJEKT | średnie |
| js/testing/test-data-manager.js | 393 | TESTY | średnie |
| js/testing/rozrys/suites/helpers-bridges.js | 390 | TESTY | wysokie |
| js/app/cabinet/cabinet-choice-launchers.js | 388 | SZAFKI | niskie |
| js/app/optimizer/speed-max-bands.js | 381 | OPTIMIZER | niskie |
| js/tabs/material.js | 380 | MATERIAŁ | niskie |
| js/testing/rozrys/suites/scope-runtime-controllers.js | 369 | TESTY | średnie |

## Największy wpływ bezpośredni

| Plik | Zależne pliki | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/app/bootstrap/app-core-namespace.js | 67 | BOOT/APP SHELL | średnie |
| js/app/investor/investors-store.js | 41 | INWESTOR | średnie |
| js/app/quote/quote-snapshot-store.js | 41 | WYCENA | średnie |
| js/app/shared/storage.js | 35 | DANE/STORAGE | niskie |
| js/testing/shared/harness.js | 35 | TESTY | niskie |
| js/app/shared/utils.js | 34 | SHARED | niskie |
| js/app/shared/room-registry.js | 32 | POMIESZCZENIA | niskie |
| js/app/project/project-store.js | 27 | PROJEKT | średnie |
| js/app/project/project-bridge.js | 24 | PROJEKT | średnie |
| js/app/ui/info-box.js | 23 | UI | niskie |
| js/testing/wycena/suites/core-offer-basics.js | 23 | TESTY | średnie |
| js/app/ui/confirm-box.js | 19 | UI | niskie |
| js/app/investor/investor-persistence.js | 18 | INWESTOR | średnie |
| js/app/shared/constants.js | 18 | SHARED | niskie |
| js/app/project/project-status-snapshot-flow.js | 17 | PROJEKT | średnie |
| js/app/project/project-status-sync.js | 17 | PROJEKT | średnie |
| js/app/optimizer/cut-optimizer.js | 16 | OPTIMIZER | średnie |
| js/app/ui/panel-box.js | 16 | UI | niskie |
| js/testing/rozrys/suites/project-stock.js | 16 | TESTY | średnie |
| js/testing/wycena/fixtures.js | 16 | TESTY | średnie |

## Największy wpływ drugiego poziomu

| Plik | Pliki pośrednio zależne | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/app/bootstrap/app-core-namespace.js | 164 | BOOT/APP SHELL | średnie |
| js/app/shared/storage.js | 141 | DANE/STORAGE | niskie |
| js/app/shared/utils.js | 136 | SHARED | niskie |
| js/app/project/project-bridge.js | 103 | PROJEKT | średnie |
| js/app/shared/constants.js | 102 | SHARED | niskie |
| js/app/shared/room-registry.js | 93 | POMIESZCZENIA | niskie |
| js/app/shared/schema.js | 85 | SHARED | niskie |
| js/app/project/project-store.js | 84 | PROJEKT | średnie |
| js/app/investor/investors-store.js | 83 | INWESTOR | średnie |
| js/app/quote/quote-snapshot-store.js | 67 | WYCENA | średnie |
| js/app/ui/info-box.js | 62 | UI | niskie |
| js/app/investor/session.js | 61 | INWESTOR | średnie |
| js/app/investor/investor-persistence.js | 60 | INWESTOR | średnie |
| js/app/ui/confirm-box.js | 60 | UI | niskie |
| js/app/quote/quote-snapshot.js | 58 | WYCENA | średnie |
| js/app/shared/ui-state.js | 54 | SHARED | niskie |
| js/app/investor/investors-model.js | 49 | INWESTOR | niskie |
| js/app/rozrys/rozrys-scope.js | 48 | ROZRYS | średnie |
| js/app/rozrys/rozrys.js | 48 | ROZRYS | wysokie |
| js/app/project/project-status-sync.js | 47 | PROJEKT | średnie |

## Najwięcej bezpośrednich referencji storage

| Plik | Referencje | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/testing/project/tests.js | 112 | TESTY | wysokie |
| js/testing/data-safety/tests.js | 44 | TESTY | niskie |
| js/testing/material/tests.js | 19 | TESTY | niskie |
| js/app/shared/storage.js | 17 | DANE/STORAGE | niskie |
| js/testing/investor/suites/recovery-isolation.js | 16 | TESTY | średnie |
| js/testing/test-data-manager.js | 15 | TESTY | średnie |
| js/testing/wycena/fixtures.js | 13 | TESTY | średnie |
| js/app/investor/session.js | 12 | INWESTOR | średnie |
| js/testing/investor/suites/recovery-sources.js | 12 | TESTY | średnie |
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

## Pliki ryzykowne

| Plik | Ryzyko | Score | Linie | Direct impact | 2nd level | Powody |
| --- | --- | --- | --- | --- | --- | --- |
| js/testing/project/tests.js | wysokie | 15 | 835 | 14 | 38 | 600+ linii; dużo publicznych symboli FC; dużo zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą; łączy DOM/eventy i storage |
| js/testing/rozrys/tests.js | wysokie | 10 | 475 | 10 | 37 | 400+ linii; dużo zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/app/rozrys/rozrys.js | wysokie | 9 | 842 | 9 | 48 | 600+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/central-status-sync.js | wysokie | 9 | 649 | 15 | 23 | 600+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/cabinet/tests.js | wysokie | 8 | 806 | 6 | 33 | 600+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/helpers-bridges.js | wysokie | 8 | 390 | 14 | 36 | 250+ linii; dużo publicznych symboli FC; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/test-data-manager.js | średnie | 7 | 393 | 15 | 32 | 250+ linii; dużo zależnych plików; kilka zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/testing/wycena/fixtures.js | średnie | 7 | 154 | 16 | 24 | dużo zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/tabs/rysunek.js | nie ruszać bez osobnego planu | 6 | 1459 | 2 | 7 | 600+ linii; systemowe dialogi |
| js/app/ui/actions-register.js | średnie | 6 | 449 | 0 | 0 | 400+ linii; dużo zależności wychodzących; systemowe dialogi |
| js/testing/rozrys/suites/scope-runtime-controllers.js | średnie | 6 | 369 | 7 | 21 | 250+ linii; kilka publicznych symboli FC; kilka zależnych plików; dużo zależności wychodzących |
| js/app/investor/investor-ui.js | średnie | 6 | 363 | 7 | 23 | 250+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/scope-entry.js | średnie | 6 | 361 | 15 | 23 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/tabs/wycena.js | średnie | 6 | 359 | 6 | 25 | 250+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/investor-integration.js | średnie | 6 | 356 | 15 | 23 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/project-stock.js | średnie | 6 | 342 | 16 | 38 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/architecture-contract.js | średnie | 6 | 321 | 15 | 23 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/app/quote/quote-snapshot-store.js | średnie | 6 | 315 | 41 | 67 | 250+ linii; dużo zależnych plików; kilka zależności wychodzących |
| js/testing/rozrys/suites/state-ui-runtime.js | średnie | 6 | 305 | 7 | 21 | 250+ linii; kilka publicznych symboli FC; kilka zależnych plików; dużo zależności wychodzących |
| js/app/quote/quote-snapshot.js | średnie | 6 | 301 | 10 | 58 | 250+ linii; dużo zależnych plików; kilka zależności wychodzących |
| js/testing/wycena/suites/core-offer-workflow.js | średnie | 6 | 277 | 15 | 23 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/core-offer-basics.js | średnie | 6 | 252 | 23 | 37 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/investor/suites/recovery-sources.js | średnie | 6 | 168 | 8 | 9 | kilka zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/testing/investor/suites/recovery-isolation.js | średnie | 6 | 162 | 8 | 9 | kilka zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/testing/rysunek/tests.js | średnie | 6 | 117 | 6 | 33 | kilka zależnych plików; kilka zależności wychodzących; bezpośredni storage poza oczywistą granicą; systemowe dialogi |
| js/app/cabinet/cabinet-modal-set-wizard.js | średnie | 5 | 693 | 0 | 0 | 600+ linii; kilka zależności wychodzących |
| js/app/cabinet/cabinet-modal.js | średnie | 5 | 655 | 0 | 0 | 600+ linii; kilka zależności wychodzących |
| js/app/project/project-status-manual-guard.js | średnie | 5 | 395 | 8 | 31 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/app/catalog/catalog-store.js | średnie | 5 | 318 | 12 | 39 | 250+ linii; dużo zależnych plików; kilka zależności wychodzących |
| js/app/rozrys/rozrys-scope.js | średnie | 5 | 317 | 14 | 48 | 250+ linii; dużo zależnych plików |
| js/app/project/project-status-scope.js | średnie | 5 | 313 | 5 | 25 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/app/project/project-status-sync.js | średnie | 5 | 309 | 17 | 47 | 250+ linii; dużo zależnych plików |
| js/app/bootstrap/app-ui-bootstrap.js | średnie | 5 | 288 | 7 | 21 | 250+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app/project/project-status-snapshot-flow.js | średnie | 5 | 270 | 17 | 46 | 250+ linii; dużo zależnych plików |
| js/app/rozrys/rozrys-engine.js | średnie | 5 | 270 | 6 | 27 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |

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

### js/app/bootstrap/app-core-namespace.js

- Obszar: BOOT/APP SHELL
- Kategoria: bootstrap/orchestrator
- Ryzyko: średnie (kilka publicznych symboli FC; dużo zależnych plików)
- Definiuje FC: appCoreNamespace, utils, storage, project
- Bezpośrednio zależne pliki (67): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-fronts.js<br>js/app/cabinet/cabinet-modal-hanging.js<br>js/app/cabinet/cabinet-modal-module.js +59
- Pośrednio zależne pliki (164): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-fronts.js<br>js/app/cabinet/cabinet-modal-hanging.js<br>js/app/cabinet/cabinet-modal-labor.js +156

### js/app/investor/investors-store.js

- Obszar: INWESTOR
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików)
- Definiuje FC: investors
- Bezpośrednio zależne pliki (41): js/app/investor/investor-persistence.js<br>js/app/investor/investor-project-patches.js<br>js/app/investor/investor-project-repository.js<br>js/app/investor/investor-rooms.js<br>js/app/project/project-schedule-status.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-mirrors.js<br>js/app/project/project-status-scope.js +33
- Pośrednio zależne pliki (83): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project-patches.js<br>js/app/investor/investor-project-repository.js<br>js/app/investor/investor-project-runtime.js<br>js/app/investor/investor-project.js<br>js/app/investor/investor-rooms.js +75

### js/app/quote/quote-snapshot-store.js

- Obszar: WYCENA
- Kategoria: domain/controller
- Ryzyko: średnie (250+ linii; dużo zależnych plików; kilka zależności wychodzących)
- Definiuje FC: quoteSnapshotStore
- Bezpośrednio zależne pliki (41): js/app/project/project-schedule-status.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-scope.js<br>js/app/project/project-status-snapshot-flow.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-pdf.js<br>js/app/quote/quote-scope-entry-scope.js<br>js/app/quote/quote-scope-entry-utils.js +33
- Pośrednio zależne pliki (67): js/app/investor/investor-persistence.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui-status-flow.js<br>js/app/project/project-schedule-status.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-mirrors.js<br>js/app/project/project-status-scope-decision.js<br>js/app/project/project-status-scope.js +59

### js/app/shared/storage.js

- Obszar: DANE/STORAGE
- Kategoria: store/storage
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: storage
- Bezpośrednio zależne pliki (35): js/app.js<br>js/app/bootstrap/app-core-namespace.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-store.js +27
- Pośrednio zależne pliki (141): js/app.js<br>js/app/bootstrap/app-core-namespace.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-fronts.js<br>js/app/cabinet/cabinet-modal-hanging.js +133

### js/testing/shared/harness.js

- Obszar: TESTY
- Kategoria: test
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: testHarness
- Bezpośrednio zależne pliki (35): js/testing/cabinet/tests.js<br>js/testing/data-safety/tests.js<br>js/testing/dev-tests-page.js<br>js/testing/dev-tests-registry.js<br>js/testing/investor/suites/architecture.js<br>js/testing/investor/suites/misc.js<br>js/testing/investor/suites/model-actions.js<br>js/testing/investor/suites/recovery-isolation.js +27
- Pośrednio zależne pliki (34): js/testing/cabinet/tests.js<br>js/testing/dev-tests-page.js<br>js/testing/dev-tests-registry.js<br>js/testing/investor/suites/architecture.js<br>js/testing/investor/suites/misc.js<br>js/testing/investor/suites/model-actions.js<br>js/testing/investor/suites/recovery-isolation.js<br>js/testing/investor/suites/recovery-sources.js +26

### js/app/shared/utils.js

- Obszar: SHARED
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: utils
- Bezpośrednio zależne pliki (34): js/app/bootstrap/app-core-namespace.js<br>js/app/cabinet/cabinet-fronts.js<br>js/app/cabinet/cabinet-modal-hanging.js<br>js/app/cabinet/cabinet-modal-module.js<br>js/app/cabinet/cabinet-modal-standing-corner-standard.js<br>js/app/cabinet/cabinet-modal-standing-front-controls.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/catalog/catalog-domain.js +26
- Pośrednio zależne pliki (136): js/app.js<br>js/app/bootstrap/app-core-namespace.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-fronts.js<br>js/app/cabinet/cabinet-modal-hanging.js +128

### js/app/shared/room-registry.js

- Obszar: POMIESZCZENIA
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: roomRegistry
- Bezpośrednio zależne pliki (32): js/app/investor/investor-room-actions.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-mirrors.js<br>js/app/project/project-status-scope.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-scope-entry-scope.js +24
- Pośrednio zależne pliki (93): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project-runtime.js<br>js/app/investor/investor-room-actions.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui-render.js +85

### js/app/project/project-store.js

- Obszar: PROJEKT
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików)
- Definiuje FC: projectStore
- Bezpośrednio zależne pliki (27): js/app/investor/investor-project-repository.js<br>js/app/project/project-bridge.js<br>js/app/project/project-schedule-status.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-mirrors.js<br>js/app/project/project-status-scope.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-scope-entry-flow.js +19
- Pośrednio zależne pliki (84): js/app.js<br>js/app/bootstrap/app-core-namespace.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project-patches.js<br>js/app/investor/investor-project-runtime.js +76

### js/app/project/project-bridge.js

- Obszar: PROJEKT
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików)
- Definiuje FC: project
- Bezpośrednio zależne pliki (24): js/app.js<br>js/app/bootstrap/app-core-namespace.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-project-patches.js<br>js/app/investor/investor-project-runtime.js<br>js/app/investor/project-autosave.js +16
- Pośrednio zależne pliki (103): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-fronts.js<br>js/app/cabinet/cabinet-modal-hanging.js<br>js/app/cabinet/cabinet-modal-module.js +95

### js/app/ui/info-box.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: infoBox
- Bezpośrednio zależne pliki (23): js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-modals.js<br>js/app/investor/investor-pdf.js<br>js/app/investor/investor-ui-status-flow.js<br>js/app/material/magazyn.js<br>js/app/material/price-modal-context.js +15
- Pośrednio zależne pliki (62): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-ui-render.js<br>js/app/investor/investor-ui.js<br>js/app/material/price-modal-filters.js<br>js/app/material/price-modal-item-form.js<br>js/app/material/price-modal-list.js<br>js/app/material/price-modal-options.js +54

### js/testing/wycena/suites/core-offer-basics.js

- Obszar: TESTY
- Kategoria: test
- Ryzyko: średnie (250+ linii; dużo zależnych plików; dużo zależności wychodzących)
- Definiuje FC: registerWycenaTests, roomRegistry, confirmBox
- Bezpośrednio zależne pliki (23): js/testing/investor/suites/architecture.js<br>js/testing/investor/suites/registry-core.js<br>js/testing/investor/suites/registry-manage.js<br>js/testing/investor/suites/status-flow.js<br>js/testing/rozrys/suites/helpers-bridges.js<br>js/testing/rozrys/suites/project-stock.js<br>js/testing/rozrys/tests.js<br>js/testing/wycena/fixtures.js +15
- Pośrednio zależne pliki (37): js/testing/cabinet/tests.js<br>js/testing/dev-tests-registry.js<br>js/testing/investor/suites/architecture.js<br>js/testing/investor/suites/misc.js<br>js/testing/investor/suites/model-actions.js<br>js/testing/investor/suites/recovery-isolation.js<br>js/testing/investor/suites/recovery-sources.js<br>js/testing/investor/suites/registry-core.js +29

### js/app/ui/confirm-box.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: confirmBox
- Bezpośrednio zależne pliki (19): js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/investor/investor-modals.js<br>js/app/investor/investor-ui-status-flow.js<br>js/app/material/magazyn.js<br>js/app/material/material-part-options.js<br>js/app/material/price-modal-context.js<br>js/app/rozrys/rozrys-ui-tools.js +11
- Pośrednio zależne pliki (60): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-ui.js<br>js/app/material/material-edge-store.js<br>js/app/material/price-modal-filters.js<br>js/app/material/price-modal-item-form.js<br>js/app/material/price-modal-list.js<br>js/app/material/price-modal-options.js +52

### js/app/investor/investor-persistence.js

- Obszar: INWESTOR
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików)
- Definiuje FC: investorPersistence
- Bezpośrednio zależne pliki (18): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-status-mirrors.js<br>js/app/project/project-status-scope.js<br>js/app/project/project-status-snapshot-flow.js<br>js/app/ui/actions-register.js<br>js/app/ui/views.js +10
- Pośrednio zależne pliki (60): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-project-runtime.js<br>js/app/investor/investor-room-actions.js<br>js/app/investor/investor-ui-render.js<br>js/app/investor/investor-ui-status-flow.js +52

### js/app/shared/constants.js

- Obszar: SHARED
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: constants
- Bezpośrednio zależne pliki (18): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/catalog/catalog-store.js<br>js/app/investor/investor-project-repository.js<br>js/app/investor/investors-model.js<br>js/app/investor/session.js<br>js/app/material/magazyn.js<br>js/app/project/project-bridge.js +10
- Pośrednio zależne pliki (102): js/app.js<br>js/app/bootstrap/app-core-namespace.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-labor.js<br>js/app/cabinet/cabinet-modal-set-wizard.js +94

### js/app/project/project-status-snapshot-flow.js

- Obszar: PROJEKT
- Kategoria: domain/controller
- Ryzyko: średnie (250+ linii; dużo zależnych plików)
- Definiuje FC: projectStatusSnapshotFlow, projectStatusSync
- Bezpośrednio zależne pliki (17): js/app/investor/investor-persistence.js<br>js/app/project/project-schedule-status.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-sync.js<br>js/app/shared/room-registry-impact.js<br>js/app/wycena/wycena-tab-status-bridge.js<br>js/testing/investor/suites/status-flow.js<br>js/testing/wycena/suites/architecture-contract.js +9
- Pośrednio zależne pliki (46): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui-status-flow.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-schedule-status.js<br>js/app/project/project-status-manual-guard.js +38
