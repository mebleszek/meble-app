# DEPENDENCY_SOURCE_AUDIT — raport źródłowy

Raport generowany przez `node tools/dependency-source-audit.js`. To jest raport pomocniczy do `DEPENDENCY_MAP.md`, nie zamiennik ręcznej analizy przed refaktorem.

## Podsumowanie

| Metryka | Wartość |
| --- | --- |
| Pliki JS | 240 |
| Skrypty w index.html | 185 |
| Skrypty w dev_tests.html | 192 |
| Krawędzie zależności po symbolach FC | 1023 |
| Symbole FC z właścicielem produkcyjnym | 173 |
| Symbole FC z właścicielem razem | 196 |
| Pliki z ryzykiem wysokim / nie ruszać | 15 |
| Pliki z ryzykiem średnim | 36 |

## Obszary

| Obszar | Pliki | Linie | Storage refs | Dialog refs | Wysokie | Średnie |
| --- | --- | --- | --- | --- | --- | --- |
| ROZRYS | 42 | 8836 | 6 | 0 | 1 | 3 |
| TESTY | 32 | 8628 | 179 | 1 | 6 | 13 |
| SZAFKI | 27 | 6388 | 0 | 0 | 0 | 3 |
| WYCENA | 13 | 4821 | 0 | 0 | 3 | 4 |
| INWESTOR | 17 | 2987 | 28 | 0 | 2 | 3 |
| UI | 26 | 2888 | 0 | 6 | 0 | 2 |
| MATERIAŁ | 14 | 1970 | 8 | 3 | 0 | 1 |
| POMIESZCZENIA | 12 | 1909 | 0 | 1 | 0 | 0 |
| OPTIMIZER | 8 | 1483 | 0 | 0 | 0 | 2 |
| BOOT/APP SHELL | 5 | 1473 | 4 | 0 | 1 | 1 |
| RYSUNEK | 1 | 1459 | 0 | 11 | 1 | 0 |
| KATALOG/USŁUGI | 9 | 1349 | 0 | 0 | 0 | 1 |
| DANE/STORAGE | 15 | 1313 | 36 | 0 | 0 | 0 |
| PROJEKT | 5 | 1302 | 0 | 0 | 1 | 3 |
| SHARED | 10 | 822 | 0 | 0 | 0 | 0 |
| CORE | 2 | 128 | 0 | 0 | 0 | 0 |
| ZAKŁADKI | 2 | 46 | 0 | 0 | 0 | 0 |

## Największe pliki

| Plik | Linie | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/tabs/rysunek.js | 1459 | RYSUNEK | nie ruszać bez osobnego planu |
| js/testing/investor/tests.js | 903 | TESTY | wysokie |
| js/app/rozrys/rozrys.js | 842 | ROZRYS | wysokie |
| js/app/cabinet/cabinet-fronts.js | 838 | SZAFKI | średnie |
| js/testing/project/tests.js | 827 | TESTY | wysokie |
| js/tabs/wycena.js | 809 | WYCENA | wysokie |
| js/testing/cabinet/tests.js | 806 | TESTY | wysokie |
| js/app.js | 791 | BOOT/APP SHELL | wysokie |
| js/app/optimizer/speed-max.js | 786 | OPTIMIZER | średnie |
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
| js/testing/rozrys/tests.js | 458 | TESTY | wysokie |

## Największy wpływ bezpośredni

| Plik | Zależne pliki | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/app/shared/utils.js | 32 | SHARED | niskie |
| js/app/shared/storage.js | 31 | DANE/STORAGE | niskie |
| js/app/investor/investors-store.js | 24 | INWESTOR | wysokie |
| js/app/shared/room-registry.js | 24 | POMIESZCZENIA | niskie |
| js/app.js | 22 | BOOT/APP SHELL | wysokie |
| js/app/project/project-bridge.js | 21 | PROJEKT | średnie |
| js/app/quote/quote-snapshot-store.js | 21 | WYCENA | wysokie |
| js/app/project/project-store.js | 20 | PROJEKT | średnie |
| js/app/ui/info-box.js | 20 | UI | niskie |
| js/app/shared/constants.js | 18 | SHARED | niskie |
| js/app/ui/confirm-box.js | 17 | UI | niskie |
| js/testing/shared/harness.js | 17 | TESTY | niskie |
| js/app/ui/panel-box.js | 15 | UI | niskie |
| js/app/shared/ui-state.js | 14 | SHARED | niskie |
| js/app/ui/views.js | 14 | UI | średnie |
| js/app/wycena/wycena-core.js | 14 | WYCENA | wysokie |
| js/app/optimizer/cut-optimizer.js | 12 | OPTIMIZER | średnie |
| js/app/investor/investor-persistence.js | 11 | INWESTOR | średnie |
| js/testing/rozrys/suites/helpers-bridges.js | 11 | TESTY | wysokie |
| js/testing/rozrys/suites/project-stock.js | 11 | TESTY | średnie |

## Największy wpływ drugiego poziomu

| Plik | Pliki pośrednio zależne | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/app/shared/storage.js | 85 | DANE/STORAGE | niskie |
| js/app/shared/utils.js | 80 | SHARED | niskie |
| js/app/shared/constants.js | 72 | SHARED | niskie |
| js/app/shared/room-registry.js | 68 | POMIESZCZENIA | niskie |
| js/app/investor/investors-store.js | 57 | INWESTOR | wysokie |
| js/app/shared/ui-state.js | 54 | SHARED | niskie |
| js/app/project/project-store.js | 53 | PROJEKT | średnie |
| js/app/investor/session.js | 49 | INWESTOR | średnie |
| js/app/ui/info-box.js | 48 | UI | niskie |
| js/app/ui/views.js | 48 | UI | średnie |
| js/app/project/project-bridge.js | 45 | PROJEKT | średnie |
| js/app.js | 43 | BOOT/APP SHELL | wysokie |
| js/app/catalog/catalog-store.js | 43 | KATALOG/USŁUGI | średnie |
| js/app/ui/confirm-box.js | 41 | UI | niskie |
| js/app/investor/investor-persistence.js | 38 | INWESTOR | średnie |
| js/app/bootstrap/reload-restore.js | 37 | BOOT/APP SHELL | niskie |
| js/app/shared/schema.js | 37 | SHARED | niskie |
| js/app/rozrys/rozrys.js | 36 | ROZRYS | wysokie |
| js/app/project/project-model.js | 35 | PROJEKT | niskie |
| js/app/rozrys/rozrys-shell.js | 35 | ROZRYS | niskie |

## Najwięcej bezpośrednich referencji storage

| Plik | Referencje | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/testing/project/tests.js | 102 | TESTY | wysokie |
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
| js/testing/project/tests.js | wysokie | 14 | 827 | 9 | 20 | 600+ linii; dużo publicznych symboli FC; kilka zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą; łączy DOM/eventy i storage |
| js/app/wycena/wycena-core.js | wysokie | 10 | 653 | 14 | 33 | 600+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/app/investor/investors-store.js | wysokie | 10 | 610 | 24 | 57 | 600+ linii; dużo zależnych plików; bezpośredni storage poza oczywistą granicą |
| js/app/rozrys/rozrys.js | wysokie | 9 | 842 | 7 | 36 | 600+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/tabs/wycena.js | wysokie | 9 | 809 | 5 | 14 | 600+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app.js | wysokie | 9 | 791 | 22 | 43 | 600+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/tests.js | wysokie | 9 | 458 | 6 | 19 | 400+ linii; kilka zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/testing/investor/tests.js | wysokie | 8 | 903 | 1 | 1 | 600+ linii; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/testing/cabinet/tests.js | wysokie | 8 | 806 | 6 | 20 | 600+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app/quote/quote-snapshot-store.js | wysokie | 8 | 659 | 21 | 31 | 600+ linii; dużo zależnych plików |
| js/app/project/project-status-sync.js | wysokie | 8 | 644 | 9 | 22 | 600+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/testing/wycena/suites/central-status-sync.js | wysokie | 8 | 643 | 7 | 11 | 600+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app/investor/investor-ui.js | wysokie | 8 | 592 | 7 | 26 | 400+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/helpers-bridges.js | wysokie | 8 | 390 | 11 | 20 | 250+ linii; dużo publicznych symboli FC; dużo zależnych plików; dużo zależności wychodzących |
| js/tabs/rysunek.js | nie ruszać bez osobnego planu | 6 | 1459 | 2 | 23 | 600+ linii; systemowe dialogi |
| js/app/optimizer/speed-max.js | średnie | 6 | 786 | 5 | 12 | 600+ linii; kilka zależnych plików |
| js/app/ui/actions-register.js | średnie | 6 | 449 | 0 | 0 | 400+ linii; dużo zależności wychodzących; systemowe dialogi |
| js/testing/rozrys/suites/scope-runtime-controllers.js | średnie | 6 | 369 | 6 | 15 | 250+ linii; kilka publicznych symboli FC; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/project-stock.js | średnie | 6 | 342 | 11 | 21 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/state-ui-runtime.js | średnie | 6 | 295 | 6 | 15 | 250+ linii; kilka publicznych symboli FC; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/rysunek/tests.js | średnie | 6 | 117 | 6 | 20 | kilka zależnych plików; kilka zależności wychodzących; bezpośredni storage poza oczywistą granicą; systemowe dialogi |
| js/app/cabinet/cabinet-modal-set-wizard.js | średnie | 5 | 693 | 0 | 0 | 600+ linii; kilka zależności wychodzących |
| js/app/quote/quote-scope-entry.js | średnie | 5 | 489 | 4 | 19 | 400+ linii; kilka zależności wychodzących |
| js/app/wycena/wycena-tab-selection.js | średnie | 5 | 452 | 2 | 9 | 400+ linii; kilka zależności wychodzących |
| js/testing/wycena/suites/scope-entry.js | średnie | 5 | 361 | 7 | 11 | 250+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app/rozrys/rozrys-scope.js | średnie | 5 | 317 | 10 | 33 | 250+ linii; dużo zależnych plików |
| js/app/project/project-status-manual-guard.js | średnie | 5 | 296 | 6 | 18 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/testing/wycena/suites/core-offer-workflow.js | średnie | 5 | 273 | 7 | 11 | 250+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app/rozrys/rozrys-engine.js | średnie | 5 | 270 | 5 | 28 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/app/quote/quote-snapshot.js | średnie | 5 | 257 | 8 | 28 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/app/ui/views.js | średnie | 5 | 250 | 14 | 48 | 250+ linii; dużo zależnych plików; kilka zależności wychodzących |
| js/app/quote/quote-offer-store.js | średnie | 5 | 238 | 10 | 28 | dużo zależnych plików; kilka zależności wychodzących |
| js/testing/wycena/suites/core-offer-basics.js | średnie | 5 | 221 | 10 | 19 | dużo zależnych plików; dużo zależności wychodzących |
| js/app/cabinet/cabinet-fronts.js | średnie | 4 | 838 | 0 | 0 | 600+ linii |
| js/app/cabinet/cabinet-modal.js | średnie | 4 | 650 | 0 | 0 | 600+ linii |

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
- Pośrednio zależne pliki (80): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-selectors.js<br>js/app/catalog/catalog-store.js +72

### js/app/shared/storage.js

- Obszar: DANE/STORAGE
- Kategoria: store/storage
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: storage
- Bezpośrednio zależne pliki (31): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-store.js<br>js/app/investor/investor-ui.js +23
- Pośrednio zależne pliki (85): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-selectors.js<br>js/app/catalog/catalog-store.js +77

### js/app/investor/investors-store.js

- Obszar: INWESTOR
- Kategoria: store/storage
- Ryzyko: wysokie (600+ linii; dużo zależnych plików; bezpośredni storage poza oczywistą granicą)
- Definiuje FC: investors
- Bezpośrednio zależne pliki (24): js/app.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js<br>js/app/investor/investor-rooms.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-sync.js<br>js/app/project/project-store.js<br>js/app/quote/quote-offer-store.js +16
- Pośrednio zależne pliki (57): js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js<br>js/app/investor/investor-rooms.js +49

### js/app/shared/room-registry.js

- Obszar: POMIESZCZENIA
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: roomRegistry
- Bezpośrednio zależne pliki (24): js/app.js<br>js/app/investor/investor-room-actions.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-scope-entry.js<br>js/app/quote/quote-snapshot-store.js +16
- Pośrednio zależne pliki (68): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js +60

### js/app.js

- Obszar: BOOT/APP SHELL
- Kategoria: bootstrap/orchestrator
- Ryzyko: wysokie (600+ linii; dużo zależnych plików; dużo zależności wychodzących)
- Definiuje FC: project, appView
- Bezpośrednio zależne pliki (22): js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-project.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js<br>js/app/project/project-bridge.js<br>js/app/project/project-status-sync.js +14
- Pośrednio zależne pliki (43): js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js<br>js/app/project/project-status-manual-guard.js +35

### js/app/project/project-bridge.js

- Obszar: PROJEKT
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików)
- Definiuje FC: project
- Bezpośrednio zależne pliki (21): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-project.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js<br>js/app/project/project-status-sync.js +13
- Pośrednio zależne pliki (45): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js +37

### js/app/quote/quote-snapshot-store.js

- Obszar: WYCENA
- Kategoria: domain/controller
- Ryzyko: wysokie (600+ linii; dużo zależnych plików)
- Definiuje FC: quoteSnapshotStore
- Bezpośrednio zależne pliki (21): js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-pdf.js<br>js/app/quote/quote-scope-entry.js<br>js/app/quote/quote-snapshot.js<br>js/app/shared/room-registry-impact.js<br>js/app/shared/room-scope-resolver.js<br>js/app/wycena/wycena-tab-helpers.js +13
- Pośrednio zależne pliki (31): js/app/investor/investor-persistence.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-pdf.js<br>js/app/quote/quote-scope-entry.js +23

### js/app/project/project-store.js

- Obszar: PROJEKT
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików)
- Definiuje FC: projectStore
- Bezpośrednio zależne pliki (20): js/app/investor/investor-project.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-bridge.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-scope-entry.js<br>js/app/quote/quote-snapshot.js +12
- Pośrednio zależne pliki (53): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js +45

### js/app/ui/info-box.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: infoBox
- Bezpośrednio zależne pliki (20): js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-modals.js<br>js/app/investor/investor-pdf.js<br>js/app/investor/investor-ui.js<br>js/app/material/magazyn.js<br>js/app/material/price-modal-context.js +12
- Pośrednio zależne pliki (48): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-ui.js<br>js/app/material/price-modal-filters.js<br>js/app/material/price-modal-item-form.js<br>js/app/material/price-modal-list.js<br>js/app/material/price-modal-options.js<br>js/app/material/price-modal-persistence.js +40

### js/app/shared/constants.js

- Obszar: SHARED
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: constants
- Bezpośrednio zależne pliki (18): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/catalog/catalog-store.js<br>js/app/investor/investor-project.js<br>js/app/investor/investors-store.js<br>js/app/investor/session.js<br>js/app/material/magazyn.js<br>js/app/project/project-bridge.js +10
- Pośrednio zależne pliki (72): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-selectors.js<br>js/app/catalog/catalog-store.js +64

### js/app/ui/confirm-box.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: confirmBox
- Bezpośrednio zależne pliki (17): js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/investor/investor-modals.js<br>js/app/investor/investor-ui.js<br>js/app/material/magazyn.js<br>js/app/material/material-part-options.js<br>js/app/material/price-modal-context.js<br>js/app/rozrys/rozrys-ui-tools.js +9
- Pośrednio zależne pliki (41): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/material/material-edge-store.js<br>js/app/material/price-modal-filters.js<br>js/app/material/price-modal-item-form.js<br>js/app/material/price-modal-list.js<br>js/app/material/price-modal-options.js<br>js/app/material/price-modal-persistence.js +33

### js/testing/shared/harness.js

- Obszar: TESTY
- Kategoria: test
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: testHarness
- Bezpośrednio zależne pliki (17): js/testing/cabinet/tests.js<br>js/testing/data-safety/tests.js<br>js/testing/dev-tests-registry.js<br>js/testing/investor/tests.js<br>js/testing/material/tests.js<br>js/testing/project/tests.js<br>js/testing/rysunek/tests.js<br>js/testing/service/tests.js +9
- Pośrednio zależne pliki (16): js/testing/cabinet/tests.js<br>js/testing/dev-tests-page.js<br>js/testing/dev-tests-registry.js<br>js/testing/investor/tests.js<br>js/testing/project/tests.js<br>js/testing/rozrys/suites/project-stock.js<br>js/testing/rozrys/tests.js<br>js/testing/rysunek/tests.js +8

### js/app/ui/panel-box.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: panelBox
- Bezpośrednio zależne pliki (15): js/app/investor/investor-modals.js<br>js/app/material/material-part-options.js<br>js/app/rozrys/rozrys-grain-modal.js<br>js/app/rozrys/rozrys-options-modal.js<br>js/app/rozrys/rozrys-pickers.js<br>js/app/rozrys/rozrys-stock-modal.js<br>js/app/rozrys/rozrys-summary.js<br>js/app/rozrys/rozrys-ui-tools.js +7
- Pośrednio zależne pliki (23): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/material/material-edge-store.js<br>js/app/rozrys/rozrys-selection-ui.js<br>js/app/rozrys/rozrys-ui-bridge.js<br>js/app/rozrys/rozrys.js<br>js/app/service/cutting/service-cutting-rozrys.js<br>js/app/service/service-orders.js +15

### js/app/shared/ui-state.js

- Obszar: SHARED
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: uiState
- Bezpośrednio zależne pliki (14): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-ui.js<br>js/app/material/price-modal-context.js<br>js/app/rozrys/rozrys-shell.js +6
- Pośrednio zależne pliki (54): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-project.js<br>js/app/investor/investor-room-actions.js +46

### js/app/ui/views.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: średnie (250+ linii; dużo zależnych plików; kilka zależności wychodzących)
- Definiuje FC: views
- Bezpośrednio zależne pliki (14): js/app.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/investor/investor-project.js<br>js/app/investor/investor-room-actions.js<br>js/app/investor/investor-ui.js<br>js/app/material/material-edge-store.js<br>js/app/material/material-part-options.js +6
- Pośrednio zależne pliki (48): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js +40
