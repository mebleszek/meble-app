# DEPENDENCY_SOURCE_AUDIT — raport źródłowy

Raport generowany przez `node tools/dependency-source-audit.js`. To jest raport pomocniczy do `DEPENDENCY_MAP.md`, nie zamiennik ręcznej analizy przed refaktorem.

## Podsumowanie

| Metryka | Wartość |
| --- | --- |
| Pliki JS | 260 |
| Skrypty w index.html | 198 |
| Skrypty w dev_tests.html | 214 |
| Krawędzie zależności po symbolach FC | 1260 |
| Symbole FC z właścicielem produkcyjnym | 186 |
| Symbole FC z właścicielem razem | 209 |
| Pliki z ryzykiem wysokim / nie ruszać | 13 |
| Pliki z ryzykiem średnim | 44 |

## Obszary

| Obszar | Pliki | Linie | Storage refs | Dialog refs | Wysokie | Średnie |
| --- | --- | --- | --- | --- | --- | --- |
| TESTY | 39 | 9707 | 189 | 1 | 6 | 20 |
| ROZRYS | 42 | 8836 | 6 | 0 | 1 | 3 |
| SZAFKI | 27 | 6388 | 0 | 0 | 0 | 3 |
| WYCENA | 20 | 5357 | 0 | 0 | 2 | 5 |
| UI | 27 | 3013 | 0 | 6 | 0 | 2 |
| INWESTOR | 17 | 2987 | 28 | 0 | 2 | 3 |
| MATERIAŁ | 14 | 1970 | 8 | 3 | 0 | 1 |
| POMIESZCZENIA | 12 | 1909 | 0 | 1 | 0 | 0 |
| OPTIMIZER | 12 | 1589 | 0 | 0 | 0 | 1 |
| RYSUNEK | 1 | 1459 | 0 | 11 | 1 | 0 |
| PROJEKT | 6 | 1371 | 0 | 0 | 0 | 4 |
| KATALOG/USŁUGI | 9 | 1349 | 0 | 0 | 0 | 1 |
| DANE/STORAGE | 15 | 1313 | 36 | 0 | 0 | 0 |
| BOOT/APP SHELL | 5 | 1273 | 4 | 0 | 1 | 1 |
| SHARED | 10 | 822 | 0 | 0 | 0 | 0 |
| ZAKŁADKI | 2 | 218 | 0 | 0 | 0 | 0 |
| CORE | 2 | 128 | 0 | 0 | 0 | 0 |

## Największe pliki

| Plik | Linie | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/tabs/rysunek.js | 1459 | RYSUNEK | nie ruszać bez osobnego planu |
| js/testing/investor/tests.js | 903 | TESTY | wysokie |
| js/app/rozrys/rozrys.js | 842 | ROZRYS | wysokie |
| js/app/cabinet/cabinet-fronts.js | 838 | SZAFKI | średnie |
| js/testing/project/tests.js | 835 | TESTY | wysokie |
| js/testing/cabinet/tests.js | 806 | TESTY | wysokie |
| js/app/cabinet/cabinet-modal-set-wizard.js | 693 | SZAFKI | średnie |
| js/app/cabinet/cabinet-modal.js | 650 | SZAFKI | średnie |
| js/testing/wycena/suites/central-status-sync.js | 643 | TESTY | wysokie |
| js/app/investor/investors-store.js | 610 | INWESTOR | wysokie |
| js/app/investor/investor-ui.js | 592 | INWESTOR | wysokie |
| js/app.js | 591 | BOOT/APP SHELL | wysokie |
| js/tabs/wycena.js | 590 | WYCENA | wysokie |
| js/app/wycena/wycena-core.js | 540 | WYCENA | wysokie |
| js/app/rozrys/rozrys-render.js | 493 | ROZRYS | średnie |
| js/app/quote/quote-scope-entry.js | 489 | WYCENA | średnie |
| js/testing/rozrys/tests.js | 459 | TESTY | wysokie |
| js/app/wycena/wycena-tab-selection.js | 452 | WYCENA | średnie |
| js/app/ui/actions-register.js | 449 | UI | średnie |
| js/app/cabinet/cabinet-modal-standing-specials.js | 434 | SZAFKI | niskie |

## Największy wpływ bezpośredni

| Plik | Zależne pliki | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/app/shared/storage.js | 33 | DANE/STORAGE | niskie |
| js/app/shared/utils.js | 33 | SHARED | niskie |
| js/app/quote/quote-snapshot-store.js | 30 | WYCENA | średnie |
| js/app/investor/investors-store.js | 27 | INWESTOR | wysokie |
| js/app/shared/room-registry.js | 27 | POMIESZCZENIA | niskie |
| js/app.js | 23 | BOOT/APP SHELL | wysokie |
| js/app/project/project-store.js | 23 | PROJEKT | średnie |
| js/testing/shared/harness.js | 23 | TESTY | niskie |
| js/app/project/project-bridge.js | 22 | PROJEKT | średnie |
| js/app/ui/info-box.js | 22 | UI | niskie |
| js/app/ui/confirm-box.js | 19 | UI | niskie |
| js/app/shared/constants.js | 18 | SHARED | niskie |
| js/testing/wycena/suites/core-offer-basics.js | 18 | TESTY | średnie |
| js/app/wycena/wycena-core.js | 17 | WYCENA | wysokie |
| js/app/optimizer/cut-optimizer.js | 16 | OPTIMIZER | średnie |
| js/app/ui/panel-box.js | 15 | UI | niskie |
| js/app/investor/investor-persistence.js | 14 | INWESTOR | średnie |
| js/app/shared/ui-state.js | 14 | SHARED | niskie |
| js/app/ui/views.js | 14 | UI | średnie |
| js/testing/rozrys/suites/helpers-bridges.js | 14 | TESTY | wysokie |

## Największy wpływ drugiego poziomu

| Plik | Pliki pośrednio zależne | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/app/shared/storage.js | 97 | DANE/STORAGE | niskie |
| js/app/shared/utils.js | 95 | SHARED | niskie |
| js/app/shared/constants.js | 82 | SHARED | niskie |
| js/app/shared/room-registry.js | 68 | POMIESZCZENIA | niskie |
| js/app/project/project-store.js | 64 | PROJEKT | średnie |
| js/app/ui/info-box.js | 57 | UI | niskie |
| js/app/ui/confirm-box.js | 56 | UI | niskie |
| js/app/investor/investors-store.js | 55 | INWESTOR | wysokie |
| js/app/project/project-bridge.js | 55 | PROJEKT | średnie |
| js/app.js | 53 | BOOT/APP SHELL | wysokie |
| js/app/investor/session.js | 53 | INWESTOR | średnie |
| js/app/shared/ui-state.js | 47 | SHARED | niskie |
| js/app/catalog/catalog-store.js | 46 | KATALOG/USŁUGI | średnie |
| js/app/investor/investor-persistence.js | 46 | INWESTOR | średnie |
| js/app/rozrys/rozrys.js | 44 | ROZRYS | wysokie |
| js/app/quote/quote-snapshot-store.js | 43 | WYCENA | średnie |
| js/app/rozrys/rozrys-shell.js | 43 | ROZRYS | niskie |
| js/app/wycena/wycena-core.js | 43 | WYCENA | wysokie |
| js/app/cabinet/cabinet-cutlist.js | 41 | SZAFKI | niskie |
| js/app/ui/views.js | 41 | UI | średnie |

## Najwięcej bezpośrednich referencji storage

| Plik | Referencje | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/testing/project/tests.js | 112 | TESTY | wysokie |
| js/testing/investor/tests.js | 20 | TESTY | wysokie |
| js/testing/data-safety/tests.js | 19 | TESTY | niskie |
| js/testing/material/tests.js | 19 | TESTY | niskie |
| js/app/shared/storage.js | 17 | DANE/STORAGE | niskie |
| js/app/investor/session.js | 12 | INWESTOR | średnie |
| js/app/investor/investors-store.js | 10 | INWESTOR | wysokie |
| js/testing/rysunek/tests.js | 10 | TESTY | średnie |
| js/testing/test-data-manager.js | 8 | TESTY | średnie |
| js/app/shared/data-storage-keys.js | 7 | DANE/STORAGE | niskie |
| js/app/investor/investor-project.js | 6 | INWESTOR | średnie |
| js/app/material/material-part-options.js | 4 | MATERIAŁ | niskie |
| js/app/shared/data-storage-audit.js | 4 | DANE/STORAGE | niskie |
| js/app/bootstrap/reload-restore.js | 3 | BOOT/APP SHELL | niskie |
| js/app/material/material-edge-store.js | 3 | MATERIAŁ | niskie |
| js/app/shared/data-backup-snapshot-apply.js | 3 | DANE/STORAGE | niskie |
| js/app/shared/data-backup-storage.js | 3 | DANE/STORAGE | niskie |
| js/app/rozrys/rozrys-cache.js | 2 | ROZRYS | niskie |
| js/app/rozrys/rozrys-grain.js | 2 | ROZRYS | niskie |
| js/app/rozrys/rozrys-prefs.js | 2 | ROZRYS | niskie |

## Pliki ryzykowne

| Plik | Ryzyko | Score | Linie | Direct impact | 2nd level | Powody |
| --- | --- | --- | --- | --- | --- | --- |
| js/testing/project/tests.js | wysokie | 15 | 835 | 11 | 28 | 600+ linii; dużo publicznych symboli FC; dużo zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą; łączy DOM/eventy i storage |
| js/app/investor/investors-store.js | wysokie | 10 | 610 | 27 | 55 | 600+ linii; dużo zależnych plików; bezpośredni storage poza oczywistą granicą |
| js/app/rozrys/rozrys.js | wysokie | 9 | 842 | 8 | 44 | 600+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/central-status-sync.js | wysokie | 9 | 643 | 13 | 18 | 600+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/app/wycena/wycena-core.js | wysokie | 9 | 540 | 17 | 43 | 400+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/tests.js | wysokie | 9 | 459 | 7 | 27 | 400+ linii; kilka zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/testing/investor/tests.js | wysokie | 8 | 903 | 1 | 1 | 600+ linii; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/testing/cabinet/tests.js | wysokie | 8 | 806 | 6 | 28 | 600+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app/investor/investor-ui.js | wysokie | 8 | 592 | 7 | 31 | 400+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app.js | wysokie | 8 | 591 | 23 | 53 | 400+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/tabs/wycena.js | wysokie | 8 | 590 | 6 | 22 | 400+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/helpers-bridges.js | wysokie | 8 | 390 | 14 | 27 | 250+ linii; dużo publicznych symboli FC; dużo zależnych plików; dużo zależności wychodzących |
| js/app/quote/quote-scope-entry.js | średnie | 7 | 489 | 5 | 26 | 400+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/tabs/rysunek.js | nie ruszać bez osobnego planu | 6 | 1459 | 2 | 24 | 600+ linii; systemowe dialogi |
| js/app/ui/actions-register.js | średnie | 6 | 449 | 0 | 0 | 400+ linii; dużo zależności wychodzących; systemowe dialogi |
| js/app/project/project-status-sync.js | średnie | 6 | 398 | 13 | 31 | 250+ linii; dużo zależnych plików; kilka zależności wychodzących |
| js/testing/rozrys/suites/scope-runtime-controllers.js | średnie | 6 | 369 | 7 | 17 | 250+ linii; kilka publicznych symboli FC; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/scope-entry.js | średnie | 6 | 361 | 13 | 18 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/project-stock.js | średnie | 6 | 342 | 13 | 28 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/state-ui-runtime.js | średnie | 6 | 305 | 7 | 17 | 250+ linii; kilka publicznych symboli FC; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/core-offer-workflow.js | średnie | 6 | 273 | 13 | 18 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/app/quote/quote-snapshot.js | średnie | 6 | 257 | 10 | 39 | 250+ linii; dużo zależnych plików; kilka zależności wychodzących |
| js/testing/wycena/suites/core-offer-basics.js | średnie | 6 | 252 | 18 | 27 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rysunek/tests.js | średnie | 6 | 117 | 6 | 28 | kilka zależnych plików; kilka zależności wychodzących; bezpośredni storage poza oczywistą granicą; systemowe dialogi |
| js/app/cabinet/cabinet-modal-set-wizard.js | średnie | 5 | 693 | 0 | 0 | 600+ linii; kilka zależności wychodzących |
| js/app/wycena/wycena-tab-selection.js | średnie | 5 | 452 | 2 | 15 | 400+ linii; kilka zależności wychodzących |
| js/app/rozrys/rozrys-scope.js | średnie | 5 | 317 | 11 | 40 | 250+ linii; dużo zależnych plików |
| js/app/quote/quote-snapshot-store.js | średnie | 5 | 315 | 30 | 43 | 250+ linii; dużo zależnych plików |
| js/app/project/project-status-manual-guard.js | średnie | 5 | 296 | 6 | 26 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/app/rozrys/rozrys-engine.js | średnie | 5 | 270 | 6 | 32 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/app/ui/views.js | średnie | 5 | 250 | 14 | 41 | 250+ linii; dużo zależnych plików; kilka zależności wychodzących |
| js/testing/wycena/suites/investor-integration.js | średnie | 5 | 247 | 13 | 18 | dużo zależnych plików; dużo zależności wychodzących |
| js/app/quote/quote-offer-store.js | średnie | 5 | 238 | 11 | 35 | dużo zależnych plików; kilka zależności wychodzących |
| js/testing/wycena/suites/architecture-contract.js | średnie | 5 | 220 | 13 | 18 | dużo zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/status-anti-regression.js | średnie | 5 | 161 | 13 | 18 | dużo zależnych plików; dużo zależności wychodzących |

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

### js/app/shared/storage.js

- Obszar: DANE/STORAGE
- Kategoria: store/storage
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: storage
- Bezpośrednio zależne pliki (33): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-store.js<br>js/app/investor/investor-ui.js +25
- Pośrednio zależne pliki (97): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-selectors.js<br>js/app/catalog/catalog-store.js +89

### js/app/shared/utils.js

- Obszar: SHARED
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: utils
- Bezpośrednio zależne pliki (33): js/app.js<br>js/app/cabinet/cabinet-fronts.js<br>js/app/cabinet/cabinet-modal-hanging.js<br>js/app/cabinet/cabinet-modal-module.js<br>js/app/cabinet/cabinet-modal-standing-corner-standard.js<br>js/app/cabinet/cabinet-modal-standing-front-controls.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/catalog/catalog-domain.js +25
- Pośrednio zależne pliki (95): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-selectors.js<br>js/app/catalog/catalog-store.js +87

### js/app/quote/quote-snapshot-store.js

- Obszar: WYCENA
- Kategoria: domain/controller
- Ryzyko: średnie (250+ linii; dużo zależnych plików)
- Definiuje FC: quoteSnapshotStore
- Bezpośrednio zależne pliki (30): js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-scope.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-pdf.js<br>js/app/quote/quote-scope-entry.js<br>js/app/quote/quote-snapshot.js<br>js/app/shared/room-registry-impact.js<br>js/app/shared/room-scope-resolver.js +22
- Pośrednio zależne pliki (43): js/app/investor/investor-persistence.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-scope.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-pdf.js +35

### js/app/investor/investors-store.js

- Obszar: INWESTOR
- Kategoria: store/storage
- Ryzyko: wysokie (600+ linii; dużo zależnych plików; bezpośredni storage poza oczywistą granicą)
- Definiuje FC: investors
- Bezpośrednio zależne pliki (27): js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js<br>js/app/investor/investor-rooms.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-scope.js<br>js/app/project/project-status-sync.js<br>js/app/project/project-store.js<br>js/app/quote/quote-offer-store.js +19
- Pośrednio zależne pliki (55): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-bridge.js<br>js/app/project/project-status-manual-guard.js +47

### js/app/shared/room-registry.js

- Obszar: POMIESZCZENIA
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: roomRegistry
- Bezpośrednio zależne pliki (27): js/app/investor/investor-room-actions.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-status-scope.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-scope-entry.js<br>js/app/quote/quote-snapshot-scope.js +19
- Pośrednio zależne pliki (68): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js<br>js/app/investor/investor-room-actions.js<br>js/app/investor/investor-ui.js<br>js/app/material/material-edge-store.js +60

### js/app.js

- Obszar: BOOT/APP SHELL
- Kategoria: bootstrap/orchestrator
- Ryzyko: wysokie (400+ linii; dużo zależnych plików; dużo zależności wychodzących)
- Definiuje FC: project, appView
- Bezpośrednio zależne pliki (23): js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-project.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js<br>js/app/project/project-bridge.js<br>js/app/project/project-status-scope.js +15
- Pośrednio zależne pliki (53): js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js<br>js/app/project/project-status-manual-guard.js +45

### js/app/project/project-store.js

- Obszar: PROJEKT
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików)
- Definiuje FC: projectStore
- Bezpośrednio zależne pliki (23): js/app/investor/investor-project.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-bridge.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-scope.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-scope-entry.js +15
- Pośrednio zależne pliki (64): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js +56

### js/testing/shared/harness.js

- Obszar: TESTY
- Kategoria: test
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: testHarness
- Bezpośrednio zależne pliki (23): js/testing/cabinet/tests.js<br>js/testing/data-safety/tests.js<br>js/testing/dev-tests-registry.js<br>js/testing/investor/tests.js<br>js/testing/material/tests.js<br>js/testing/project/tests.js<br>js/testing/rysunek/tests.js<br>js/testing/service/tests.js +15
- Pośrednio zależne pliki (24): js/testing/cabinet/tests.js<br>js/testing/dev-tests-page.js<br>js/testing/dev-tests-registry.js<br>js/testing/investor/tests.js<br>js/testing/project/tests.js<br>js/testing/rozrys/suites/helpers-bridges.js<br>js/testing/rozrys/suites/project-stock.js<br>js/testing/rozrys/tests.js +16

### js/app/project/project-bridge.js

- Obszar: PROJEKT
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików)
- Definiuje FC: project
- Bezpośrednio zależne pliki (22): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-project.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js<br>js/app/project/project-status-scope.js +14
- Pośrednio zależne pliki (55): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js +47

### js/app/ui/info-box.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: infoBox
- Bezpośrednio zależne pliki (22): js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-modals.js<br>js/app/investor/investor-pdf.js<br>js/app/investor/investor-ui.js<br>js/app/material/magazyn.js<br>js/app/material/price-modal-context.js +14
- Pośrednio zależne pliki (57): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-ui.js<br>js/app/material/price-modal-filters.js<br>js/app/material/price-modal-item-form.js<br>js/app/material/price-modal-list.js<br>js/app/material/price-modal-options.js<br>js/app/material/price-modal-persistence.js +49

### js/app/ui/confirm-box.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: confirmBox
- Bezpośrednio zależne pliki (19): js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/investor/investor-modals.js<br>js/app/investor/investor-ui.js<br>js/app/material/magazyn.js<br>js/app/material/material-part-options.js<br>js/app/material/price-modal-context.js<br>js/app/rozrys/rozrys-ui-tools.js +11
- Pośrednio zależne pliki (56): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/material/material-edge-store.js<br>js/app/material/price-modal-filters.js<br>js/app/material/price-modal-item-form.js<br>js/app/material/price-modal-list.js<br>js/app/material/price-modal-options.js<br>js/app/material/price-modal-persistence.js +48

### js/app/shared/constants.js

- Obszar: SHARED
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: constants
- Bezpośrednio zależne pliki (18): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/catalog/catalog-store.js<br>js/app/investor/investor-project.js<br>js/app/investor/investors-store.js<br>js/app/investor/session.js<br>js/app/material/magazyn.js<br>js/app/project/project-bridge.js +10
- Pośrednio zależne pliki (82): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-selectors.js<br>js/app/catalog/catalog-store.js +74

### js/testing/wycena/suites/core-offer-basics.js

- Obszar: TESTY
- Kategoria: test
- Ryzyko: średnie (250+ linii; dużo zależnych plików; dużo zależności wychodzących)
- Definiuje FC: registerWycenaTests, roomRegistry, confirmBox
- Bezpośrednio zależne pliki (18): js/testing/investor/tests.js<br>js/testing/rozrys/suites/helpers-bridges.js<br>js/testing/rozrys/suites/project-stock.js<br>js/testing/rozrys/tests.js<br>js/testing/wycena/fixtures.js<br>js/testing/wycena/suites/architecture-contract.js<br>js/testing/wycena/suites/central-status-sync.js<br>js/testing/wycena/suites/core-offer-workflow.js +10
- Pośrednio zależne pliki (27): js/testing/cabinet/tests.js<br>js/testing/dev-tests-registry.js<br>js/testing/investor/tests.js<br>js/testing/material/tests.js<br>js/testing/project/tests.js<br>js/testing/rozrys/suites/helpers-bridges.js<br>js/testing/rozrys/suites/optimizer-contracts.js<br>js/testing/rozrys/suites/output-bootstrap.js +19

### js/app/wycena/wycena-core.js

- Obszar: WYCENA
- Kategoria: domain/controller
- Ryzyko: wysokie (400+ linii; dużo zależnych plików; dużo zależności wychodzących)
- Definiuje FC: materialHasGrain, wycenaCore
- Bezpośrednio zależne pliki (17): js/app/material/material-registry.js<br>js/app/material/price-modal-persistence.js<br>js/app/project/project-status-manual-guard.js<br>js/app/quote/quote-pdf.js<br>js/app/quote/quote-scope-entry.js<br>js/app/quote/quote-snapshot.js<br>js/app/wycena/wycena-tab-selection.js<br>js/app/wycena/wycena-tab-shell.js +9
- Pośrednio zależne pliki (43): js/app/investor/investor-persistence.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui.js<br>js/app/material/price-modal-options.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-scope.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-pdf.js +35

### js/app/optimizer/cut-optimizer.js

- Obszar: OPTIMIZER
- Kategoria: shared/domain/helper
- Ryzyko: średnie (250+ linii; dużo zależnych plików)
- Definiuje FC: cutOptimizer
- Bezpośrednio zależne pliki (16): js/app/optimizer/panel-pro-worker.js<br>js/app/optimizer/speed-dokladnie.js<br>js/app/optimizer/speed-max-bands.js<br>js/app/optimizer/speed-max-half-sheet.js<br>js/app/optimizer/speed-max-sheet-plan.js<br>js/app/optimizer/speed-max.js<br>js/app/optimizer/speed-turbo.js<br>js/app/rozrys/rozrys-engine.js +8
- Pośrednio zależne pliki (36): js/app/optimizer/panel-pro-worker.js<br>js/app/optimizer/speed-dokladnie.js<br>js/app/optimizer/speed-max-half-sheet.js<br>js/app/optimizer/speed-max-sheet-plan.js<br>js/app/optimizer/speed-max.js<br>js/app/optimizer/speed-turbo.js<br>js/app/rozrys/rozrys-engine.js<br>js/app/rozrys/rozrys-lazy-loader.js +28
