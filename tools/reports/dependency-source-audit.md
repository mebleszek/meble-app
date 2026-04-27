# DEPENDENCY_SOURCE_AUDIT — raport źródłowy

Raport generowany przez `node tools/dependency-source-audit.js`. To jest raport pomocniczy do `DEPENDENCY_MAP.md`, nie zamiennik ręcznej analizy przed refaktorem.

## Podsumowanie

| Metryka | Wartość |
| --- | --- |
| Pliki JS | 247 |
| Skrypty w index.html | 190 |
| Skrypty w dev_tests.html | 200 |
| Krawędzie zależności po symbolach FC | 1082 |
| Symbole FC z właścicielem produkcyjnym | 178 |
| Symbole FC z właścicielem razem | 201 |
| Pliki z ryzykiem wysokim / nie ruszać | 15 |
| Pliki z ryzykiem średnim | 37 |

## Obszary

| Obszar | Pliki | Linie | Storage refs | Dialog refs | Wysokie | Średnie |
| --- | --- | --- | --- | --- | --- | --- |
| TESTY | 34 | 8979 | 189 | 3 | 6 | 15 |
| ROZRYS | 42 | 8836 | 6 | 0 | 1 | 3 |
| SZAFKI | 27 | 6388 | 0 | 0 | 0 | 3 |
| WYCENA | 13 | 4826 | 0 | 0 | 3 | 4 |
| INWESTOR | 17 | 2987 | 28 | 0 | 2 | 3 |
| UI | 26 | 2888 | 0 | 6 | 0 | 2 |
| MATERIAŁ | 14 | 1970 | 8 | 3 | 0 | 1 |
| POMIESZCZENIA | 12 | 1909 | 0 | 1 | 0 | 0 |
| OPTIMIZER | 12 | 1589 | 0 | 0 | 0 | 1 |
| RYSUNEK | 1 | 1476 | 0 | 0 | 1 | 0 |
| BOOT/APP SHELL | 5 | 1473 | 4 | 0 | 1 | 1 |
| KATALOG/USŁUGI | 9 | 1349 | 0 | 0 | 0 | 1 |
| DANE/STORAGE | 15 | 1313 | 36 | 0 | 0 | 0 |
| PROJEKT | 5 | 1305 | 0 | 0 | 1 | 3 |
| SHARED | 10 | 822 | 0 | 0 | 0 | 0 |
| INNE | 1 | 145 | 0 | 0 | 0 | 0 |
| CORE | 2 | 128 | 0 | 0 | 0 | 0 |
| ZAKŁADKI | 2 | 46 | 0 | 0 | 0 | 0 |

## Największe pliki

| Plik | Linie | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/tabs/rysunek.js | 1476 | RYSUNEK | nie ruszać bez osobnego planu |
| js/testing/investor/tests.js | 903 | TESTY | wysokie |
| js/app/rozrys/rozrys.js | 842 | ROZRYS | wysokie |
| js/app/cabinet/cabinet-fronts.js | 838 | SZAFKI | średnie |
| js/testing/project/tests.js | 835 | TESTY | wysokie |
| js/tabs/wycena.js | 814 | WYCENA | wysokie |
| js/testing/cabinet/tests.js | 806 | TESTY | wysokie |
| js/app.js | 791 | BOOT/APP SHELL | wysokie |
| js/app/cabinet/cabinet-modal-set-wizard.js | 693 | SZAFKI | średnie |
| js/app/quote/quote-snapshot-store.js | 659 | WYCENA | wysokie |
| js/app/wycena/wycena-core.js | 653 | WYCENA | wysokie |
| js/app/cabinet/cabinet-modal.js | 650 | SZAFKI | średnie |
| js/app/project/project-status-sync.js | 644 | PROJEKT | wysokie |
| js/testing/wycena/suites/central-status-sync.js | 643 | TESTY | wysokie |
| js/app/investor/investors-store.js | 610 | INWESTOR | wysokie |
| js/app/investor/investor-ui.js | 592 | INWESTOR | wysokie |
| js/app/rozrys/rozrys-render.js | 493 | ROZRYS | średnie |
| js/app/quote/quote-scope-entry.js | 489 | WYCENA | średnie |
| js/testing/rozrys/tests.js | 459 | TESTY | wysokie |
| js/app/wycena/wycena-tab-selection.js | 452 | WYCENA | średnie |

## Największy wpływ bezpośredni

| Plik | Zależne pliki | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/app/shared/utils.js | 32 | SHARED | niskie |
| js/app/shared/storage.js | 31 | DANE/STORAGE | niskie |
| js/app/investor/investors-store.js | 25 | INWESTOR | wysokie |
| js/app/shared/room-registry.js | 24 | POMIESZCZENIA | niskie |
| js/app.js | 22 | BOOT/APP SHELL | wysokie |
| js/app/quote/quote-snapshot-store.js | 22 | WYCENA | wysokie |
| js/app/project/project-bridge.js | 21 | PROJEKT | średnie |
| js/app/project/project-store.js | 21 | PROJEKT | średnie |
| js/app/ui/info-box.js | 21 | UI | niskie |
| js/app/ui/confirm-box.js | 19 | UI | niskie |
| js/app/shared/constants.js | 18 | SHARED | niskie |
| js/testing/shared/harness.js | 18 | TESTY | niskie |
| js/app/optimizer/cut-optimizer.js | 16 | OPTIMIZER | średnie |
| js/app/ui/panel-box.js | 16 | UI | niskie |
| js/app/shared/ui-state.js | 14 | SHARED | niskie |
| js/app/ui/views.js | 14 | UI | średnie |
| js/app/wycena/wycena-core.js | 14 | WYCENA | wysokie |
| js/testing/rozrys/suites/helpers-bridges.js | 13 | TESTY | wysokie |
| js/app/investor/investor-persistence.js | 12 | INWESTOR | średnie |
| js/testing/rozrys/suites/project-stock.js | 12 | TESTY | średnie |

## Największy wpływ drugiego poziomu

| Plik | Pliki pośrednio zależne | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/app/shared/storage.js | 86 | DANE/STORAGE | niskie |
| js/app/shared/utils.js | 81 | SHARED | niskie |
| js/app/shared/constants.js | 73 | SHARED | niskie |
| js/app/shared/room-registry.js | 70 | POMIESZCZENIA | niskie |
| js/app/investor/investors-store.js | 58 | INWESTOR | wysokie |
| js/app/project/project-store.js | 55 | PROJEKT | średnie |
| js/app/shared/ui-state.js | 55 | SHARED | niskie |
| js/app/ui/info-box.js | 52 | UI | niskie |
| js/app/investor/session.js | 50 | INWESTOR | średnie |
| js/app/ui/confirm-box.js | 50 | UI | niskie |
| js/app/ui/views.js | 49 | UI | średnie |
| js/app/project/project-bridge.js | 47 | PROJEKT | średnie |
| js/app.js | 45 | BOOT/APP SHELL | wysokie |
| js/app/catalog/catalog-store.js | 44 | KATALOG/USŁUGI | średnie |
| js/app/investor/investor-persistence.js | 39 | INWESTOR | średnie |
| js/app/bootstrap/reload-restore.js | 38 | BOOT/APP SHELL | niskie |
| js/app/rozrys/rozrys.js | 38 | ROZRYS | wysokie |
| js/app/shared/schema.js | 38 | SHARED | niskie |
| js/app/rozrys/rozrys-shell.js | 37 | ROZRYS | niskie |
| js/app/cabinet/cabinet-cutlist.js | 36 | SZAFKI | niskie |

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
| js/testing/project/tests.js | wysokie | 15 | 835 | 10 | 22 | 600+ linii; dużo publicznych symboli FC; dużo zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą; łączy DOM/eventy i storage |
| js/app/wycena/wycena-core.js | wysokie | 10 | 653 | 14 | 35 | 600+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/app/investor/investors-store.js | wysokie | 10 | 610 | 25 | 58 | 600+ linii; dużo zależnych plików; bezpośredni storage poza oczywistą granicą |
| js/app/rozrys/rozrys.js | wysokie | 9 | 842 | 7 | 38 | 600+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/tabs/wycena.js | wysokie | 9 | 814 | 5 | 16 | 600+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app.js | wysokie | 9 | 791 | 22 | 45 | 600+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/app/project/project-status-sync.js | wysokie | 9 | 644 | 10 | 23 | 600+ linii; dużo zależnych plików; kilka zależności wychodzących |
| js/testing/rozrys/tests.js | wysokie | 9 | 459 | 6 | 21 | 400+ linii; kilka zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/testing/investor/tests.js | wysokie | 8 | 903 | 1 | 1 | 600+ linii; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/testing/cabinet/tests.js | wysokie | 8 | 806 | 6 | 22 | 600+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app/quote/quote-snapshot-store.js | wysokie | 8 | 659 | 22 | 33 | 600+ linii; dużo zależnych plików |
| js/testing/wycena/suites/central-status-sync.js | wysokie | 8 | 643 | 8 | 13 | 600+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app/investor/investor-ui.js | wysokie | 8 | 592 | 7 | 27 | 400+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/helpers-bridges.js | wysokie | 8 | 390 | 13 | 22 | 250+ linii; dużo publicznych symboli FC; dużo zależnych plików; dużo zależności wychodzących |
| js/app/ui/actions-register.js | średnie | 6 | 449 | 0 | 0 | 400+ linii; dużo zależności wychodzących; systemowe dialogi |
| js/testing/rozrys/suites/scope-runtime-controllers.js | średnie | 6 | 369 | 7 | 16 | 250+ linii; kilka publicznych symboli FC; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/project-stock.js | średnie | 6 | 342 | 12 | 23 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/state-ui-runtime.js | średnie | 6 | 305 | 7 | 16 | 250+ linii; kilka publicznych symboli FC; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/core-offer-basics.js | średnie | 6 | 252 | 12 | 22 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rysunek/tests.js | średnie | 6 | 126 | 6 | 22 | kilka zależnych plików; kilka zależności wychodzących; bezpośredni storage poza oczywistą granicą; systemowe dialogi |
| js/tabs/rysunek.js | nie ruszać bez osobnego planu | 5 | 1476 | 2 | 23 | 600+ linii |
| js/app/cabinet/cabinet-modal-set-wizard.js | średnie | 5 | 693 | 0 | 0 | 600+ linii; kilka zależności wychodzących |
| js/app/quote/quote-scope-entry.js | średnie | 5 | 489 | 4 | 20 | 400+ linii; kilka zależności wychodzących |
| js/app/wycena/wycena-tab-selection.js | średnie | 5 | 452 | 2 | 10 | 400+ linii; kilka zależności wychodzących |
| js/testing/wycena/suites/scope-entry.js | średnie | 5 | 361 | 8 | 13 | 250+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app/rozrys/rozrys-scope.js | średnie | 5 | 317 | 10 | 34 | 250+ linii; dużo zależnych plików |
| js/app/project/project-status-manual-guard.js | średnie | 5 | 296 | 6 | 19 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/testing/wycena/suites/core-offer-workflow.js | średnie | 5 | 273 | 8 | 13 | 250+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app/rozrys/rozrys-engine.js | średnie | 5 | 270 | 6 | 29 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/app/quote/quote-snapshot.js | średnie | 5 | 257 | 8 | 29 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/app/ui/views.js | średnie | 5 | 250 | 14 | 49 | 250+ linii; dużo zależnych plików; kilka zależności wychodzących |
| js/app/quote/quote-offer-store.js | średnie | 5 | 238 | 10 | 29 | dużo zależnych plików; kilka zależności wychodzących |
| js/app/cabinet/cabinet-fronts.js | średnie | 4 | 838 | 0 | 0 | 600+ linii |
| js/app/cabinet/cabinet-modal.js | średnie | 4 | 650 | 0 | 0 | 600+ linii |
| js/app/rozrys/rozrys-render.js | średnie | 4 | 493 | 4 | 10 | 400+ linii |

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

### js/app/shared/utils.js

- Obszar: SHARED
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: utils
- Bezpośrednio zależne pliki (32): js/app.js<br>js/app/cabinet/cabinet-fronts.js<br>js/app/cabinet/cabinet-modal-hanging.js<br>js/app/cabinet/cabinet-modal-module.js<br>js/app/cabinet/cabinet-modal-standing-corner-standard.js<br>js/app/cabinet/cabinet-modal-standing-front-controls.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/catalog/catalog-domain.js +24
- Pośrednio zależne pliki (81): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-selectors.js<br>js/app/catalog/catalog-store.js +73

### js/app/shared/storage.js

- Obszar: DANE/STORAGE
- Kategoria: store/storage
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: storage
- Bezpośrednio zależne pliki (31): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-store.js<br>js/app/investor/investor-ui.js +23
- Pośrednio zależne pliki (86): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-selectors.js<br>js/app/catalog/catalog-store.js +78

### js/app/investor/investors-store.js

- Obszar: INWESTOR
- Kategoria: store/storage
- Ryzyko: wysokie (600+ linii; dużo zależnych plików; bezpośredni storage poza oczywistą granicą)
- Definiuje FC: investors
- Bezpośrednio zależne pliki (25): js/app.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js<br>js/app/investor/investor-rooms.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-sync.js<br>js/app/project/project-store.js<br>js/app/quote/quote-offer-store.js +17
- Pośrednio zależne pliki (58): js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js<br>js/app/investor/investor-rooms.js +50

### js/app/shared/room-registry.js

- Obszar: POMIESZCZENIA
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: roomRegistry
- Bezpośrednio zależne pliki (24): js/app.js<br>js/app/investor/investor-room-actions.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-scope-entry.js<br>js/app/quote/quote-snapshot-store.js +16
- Pośrednio zależne pliki (70): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js +62

### js/app.js

- Obszar: BOOT/APP SHELL
- Kategoria: bootstrap/orchestrator
- Ryzyko: wysokie (600+ linii; dużo zależnych plików; dużo zależności wychodzących)
- Definiuje FC: project, appView
- Bezpośrednio zależne pliki (22): js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-project.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js<br>js/app/project/project-bridge.js<br>js/app/project/project-status-sync.js +14
- Pośrednio zależne pliki (45): js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js<br>js/app/project/project-status-manual-guard.js +37

### js/app/quote/quote-snapshot-store.js

- Obszar: WYCENA
- Kategoria: domain/controller
- Ryzyko: wysokie (600+ linii; dużo zależnych plików)
- Definiuje FC: quoteSnapshotStore
- Bezpośrednio zależne pliki (22): js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-pdf.js<br>js/app/quote/quote-scope-entry.js<br>js/app/quote/quote-snapshot.js<br>js/app/shared/room-registry-impact.js<br>js/app/shared/room-scope-resolver.js<br>js/app/wycena/wycena-tab-helpers.js +14
- Pośrednio zależne pliki (33): js/app/investor/investor-persistence.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-pdf.js<br>js/app/quote/quote-scope-entry.js +25

### js/app/project/project-bridge.js

- Obszar: PROJEKT
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików)
- Definiuje FC: project
- Bezpośrednio zależne pliki (21): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-project.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js<br>js/app/project/project-status-sync.js +13
- Pośrednio zależne pliki (47): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js +39

### js/app/project/project-store.js

- Obszar: PROJEKT
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików)
- Definiuje FC: projectStore
- Bezpośrednio zależne pliki (21): js/app/investor/investor-project.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-bridge.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-scope-entry.js<br>js/app/quote/quote-snapshot.js +13
- Pośrednio zależne pliki (55): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js +47

### js/app/ui/info-box.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: infoBox
- Bezpośrednio zależne pliki (21): js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-modals.js<br>js/app/investor/investor-pdf.js<br>js/app/investor/investor-ui.js<br>js/app/material/magazyn.js<br>js/app/material/price-modal-context.js +13
- Pośrednio zależne pliki (52): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-ui.js<br>js/app/material/price-modal-filters.js<br>js/app/material/price-modal-item-form.js<br>js/app/material/price-modal-list.js<br>js/app/material/price-modal-options.js<br>js/app/material/price-modal-persistence.js +44

### js/app/ui/confirm-box.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: confirmBox
- Bezpośrednio zależne pliki (19): js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/investor/investor-modals.js<br>js/app/investor/investor-ui.js<br>js/app/material/magazyn.js<br>js/app/material/material-part-options.js<br>js/app/material/price-modal-context.js<br>js/app/rozrys/rozrys-ui-tools.js +11
- Pośrednio zależne pliki (50): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/material/material-edge-store.js<br>js/app/material/price-modal-filters.js<br>js/app/material/price-modal-item-form.js<br>js/app/material/price-modal-list.js<br>js/app/material/price-modal-options.js<br>js/app/material/price-modal-persistence.js +42

### js/app/shared/constants.js

- Obszar: SHARED
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: constants
- Bezpośrednio zależne pliki (18): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/catalog/catalog-store.js<br>js/app/investor/investor-project.js<br>js/app/investor/investors-store.js<br>js/app/investor/session.js<br>js/app/material/magazyn.js<br>js/app/project/project-bridge.js +10
- Pośrednio zależne pliki (73): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-selectors.js<br>js/app/catalog/catalog-store.js +65

### js/testing/shared/harness.js

- Obszar: TESTY
- Kategoria: test
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: testHarness
- Bezpośrednio zależne pliki (18): js/testing/cabinet/tests.js<br>js/testing/data-safety/tests.js<br>js/testing/dev-tests-registry.js<br>js/testing/investor/tests.js<br>js/testing/material/tests.js<br>js/testing/project/tests.js<br>js/testing/rysunek/tests.js<br>js/testing/service/tests.js +10
- Pośrednio zależne pliki (18): js/testing/cabinet/tests.js<br>js/testing/dev-tests-page.js<br>js/testing/dev-tests-registry.js<br>js/testing/investor/tests.js<br>js/testing/project/tests.js<br>js/testing/rozrys/suites/helpers-bridges.js<br>js/testing/rozrys/suites/project-stock.js<br>js/testing/rozrys/tests.js +10

### js/app/optimizer/cut-optimizer.js

- Obszar: OPTIMIZER
- Kategoria: shared/domain/helper
- Ryzyko: średnie (250+ linii; dużo zależnych plików)
- Definiuje FC: cutOptimizer
- Bezpośrednio zależne pliki (16): js/app/optimizer/panel-pro-worker.js<br>js/app/optimizer/speed-dokladnie.js<br>js/app/optimizer/speed-max-bands.js<br>js/app/optimizer/speed-max-half-sheet.js<br>js/app/optimizer/speed-max-sheet-plan.js<br>js/app/optimizer/speed-max.js<br>js/app/optimizer/speed-turbo.js<br>js/app/rozrys/rozrys-engine.js +8
- Pośrednio zależne pliki (35): js/app/optimizer/panel-pro-worker.js<br>js/app/optimizer/speed-dokladnie.js<br>js/app/optimizer/speed-max-half-sheet.js<br>js/app/optimizer/speed-max-sheet-plan.js<br>js/app/optimizer/speed-max.js<br>js/app/optimizer/speed-turbo.js<br>js/app/rozrys/rozrys-engine.js<br>js/app/rozrys/rozrys-lazy-loader.js +27

### js/app/ui/panel-box.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: panelBox
- Bezpośrednio zależne pliki (16): js/app/investor/investor-modals.js<br>js/app/material/material-part-options.js<br>js/app/rozrys/rozrys-grain-modal.js<br>js/app/rozrys/rozrys-options-modal.js<br>js/app/rozrys/rozrys-pickers.js<br>js/app/rozrys/rozrys-stock-modal.js<br>js/app/rozrys/rozrys-summary.js<br>js/app/rozrys/rozrys-ui-tools.js +8
- Pośrednio zależne pliki (26): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/material/material-edge-store.js<br>js/app/rozrys/rozrys-selection-ui.js<br>js/app/rozrys/rozrys-ui-bridge.js<br>js/app/rozrys/rozrys.js<br>js/app/service/cutting/service-cutting-rozrys.js<br>js/app/service/service-orders.js +18

### js/app/shared/ui-state.js

- Obszar: SHARED
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: uiState
- Bezpośrednio zależne pliki (14): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-ui.js<br>js/app/material/price-modal-context.js<br>js/app/rozrys/rozrys-shell.js +6
- Pośrednio zależne pliki (55): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-project.js<br>js/app/investor/investor-room-actions.js +47
