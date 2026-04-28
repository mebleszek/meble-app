# DEPENDENCY_SOURCE_AUDIT — raport źródłowy

Raport generowany przez `node tools/dependency-source-audit.js`. To jest raport pomocniczy do `DEPENDENCY_MAP.md`, nie zamiennik ręcznej analizy przed refaktorem.

## Podsumowanie

| Metryka | Wartość |
| --- | --- |
| Pliki JS | 252 |
| Skrypty w index.html | 194 |
| Skrypty w dev_tests.html | 206 |
| Krawędzie zależności po symbolach FC | 1133 |
| Symbole FC z właścicielem produkcyjnym | 182 |
| Symbole FC z właścicielem razem | 205 |
| Pliki z ryzykiem wysokim / nie ruszać | 15 |
| Pliki z ryzykiem średnim | 38 |

## Obszary

| Obszar | Pliki | Linie | Storage refs | Dialog refs | Wysokie | Średnie |
| --- | --- | --- | --- | --- | --- | --- |
| TESTY | 35 | 9235 | 189 | 1 | 6 | 16 |
| ROZRYS | 42 | 8836 | 6 | 0 | 1 | 3 |
| SZAFKI | 27 | 6388 | 0 | 0 | 0 | 3 |
| WYCENA | 17 | 5152 | 0 | 0 | 3 | 4 |
| UI | 27 | 3013 | 0 | 6 | 0 | 2 |
| INWESTOR | 17 | 2987 | 28 | 0 | 2 | 3 |
| MATERIAŁ | 14 | 1970 | 8 | 3 | 0 | 1 |
| POMIESZCZENIA | 12 | 1909 | 0 | 1 | 0 | 0 |
| OPTIMIZER | 12 | 1589 | 0 | 0 | 0 | 1 |
| RYSUNEK | 1 | 1459 | 0 | 11 | 1 | 0 |
| KATALOG/USŁUGI | 9 | 1349 | 0 | 0 | 0 | 1 |
| DANE/STORAGE | 15 | 1313 | 36 | 0 | 0 | 0 |
| PROJEKT | 5 | 1305 | 0 | 0 | 1 | 3 |
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
| js/app/quote/quote-snapshot-store.js | 659 | WYCENA | wysokie |
| js/app/wycena/wycena-core.js | 653 | WYCENA | wysokie |
| js/app/cabinet/cabinet-modal.js | 650 | SZAFKI | średnie |
| js/app/project/project-status-sync.js | 644 | PROJEKT | wysokie |
| js/testing/wycena/suites/central-status-sync.js | 643 | TESTY | wysokie |
| js/app/investor/investors-store.js | 610 | INWESTOR | wysokie |
| js/app/investor/investor-ui.js | 592 | INWESTOR | wysokie |
| js/app.js | 591 | BOOT/APP SHELL | wysokie |
| js/tabs/wycena.js | 590 | WYCENA | wysokie |
| js/app/rozrys/rozrys-render.js | 493 | ROZRYS | średnie |
| js/app/quote/quote-scope-entry.js | 489 | WYCENA | średnie |
| js/testing/rozrys/tests.js | 459 | TESTY | wysokie |
| js/app/wycena/wycena-tab-selection.js | 452 | WYCENA | średnie |

## Największy wpływ bezpośredni

| Plik | Zależne pliki | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/app/shared/storage.js | 33 | DANE/STORAGE | niskie |
| js/app/shared/utils.js | 32 | SHARED | niskie |
| js/app/investor/investors-store.js | 26 | INWESTOR | wysokie |
| js/app/quote/quote-snapshot-store.js | 26 | WYCENA | wysokie |
| js/app/shared/room-registry.js | 25 | POMIESZCZENIA | niskie |
| js/app.js | 22 | BOOT/APP SHELL | wysokie |
| js/app/project/project-store.js | 22 | PROJEKT | średnie |
| js/app/ui/info-box.js | 22 | UI | niskie |
| js/app/project/project-bridge.js | 21 | PROJEKT | średnie |
| js/app/ui/confirm-box.js | 19 | UI | niskie |
| js/testing/shared/harness.js | 19 | TESTY | niskie |
| js/app/shared/constants.js | 18 | SHARED | niskie |
| js/app/optimizer/cut-optimizer.js | 16 | OPTIMIZER | średnie |
| js/app/wycena/wycena-core.js | 16 | WYCENA | wysokie |
| js/app/ui/panel-box.js | 15 | UI | niskie |
| js/app/shared/ui-state.js | 14 | SHARED | niskie |
| js/app/ui/views.js | 14 | UI | średnie |
| js/testing/rozrys/suites/helpers-bridges.js | 14 | TESTY | wysokie |
| js/testing/wycena/suites/core-offer-basics.js | 14 | TESTY | średnie |
| js/app/investor/investor-persistence.js | 13 | INWESTOR | średnie |

## Największy wpływ drugiego poziomu

| Plik | Pliki pośrednio zależne | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/app/shared/storage.js | 92 | DANE/STORAGE | niskie |
| js/app/shared/utils.js | 88 | SHARED | niskie |
| js/app/shared/constants.js | 78 | SHARED | niskie |
| js/app/shared/room-registry.js | 63 | POMIESZCZENIA | niskie |
| js/app/project/project-store.js | 57 | PROJEKT | średnie |
| js/app/investor/session.js | 53 | INWESTOR | średnie |
| js/app/ui/info-box.js | 53 | UI | niskie |
| js/app/ui/confirm-box.js | 52 | UI | niskie |
| js/app/project/project-bridge.js | 50 | PROJEKT | średnie |
| js/app.js | 48 | BOOT/APP SHELL | wysokie |
| js/app/investor/investors-store.js | 48 | INWESTOR | wysokie |
| js/app/shared/ui-state.js | 47 | SHARED | niskie |
| js/app/catalog/catalog-store.js | 45 | KATALOG/USŁUGI | średnie |
| js/app/investor/investor-persistence.js | 42 | INWESTOR | średnie |
| js/app/rozrys/rozrys.js | 40 | ROZRYS | wysokie |
| js/app/ui/views.js | 40 | UI | średnie |
| js/app/bootstrap/reload-restore.js | 39 | BOOT/APP SHELL | niskie |
| js/app/rozrys/rozrys-shell.js | 39 | ROZRYS | niskie |
| js/app/shared/schema.js | 39 | SHARED | niskie |
| js/app/cabinet/cabinet-cutlist.js | 37 | SZAFKI | niskie |

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
| js/testing/project/tests.js | wysokie | 15 | 835 | 11 | 24 | 600+ linii; dużo publicznych symboli FC; dużo zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą; łączy DOM/eventy i storage |
| js/app/wycena/wycena-core.js | wysokie | 10 | 653 | 16 | 37 | 600+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/app/investor/investors-store.js | wysokie | 10 | 610 | 26 | 48 | 600+ linii; dużo zależnych plików; bezpośredni storage poza oczywistą granicą |
| js/app/rozrys/rozrys.js | wysokie | 9 | 842 | 8 | 40 | 600+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app/project/project-status-sync.js | wysokie | 9 | 644 | 12 | 26 | 600+ linii; dużo zależnych plików; kilka zależności wychodzących |
| js/testing/rozrys/tests.js | wysokie | 9 | 459 | 7 | 23 | 400+ linii; kilka zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/testing/investor/tests.js | wysokie | 8 | 903 | 1 | 1 | 600+ linii; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/testing/cabinet/tests.js | wysokie | 8 | 806 | 6 | 24 | 600+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app/quote/quote-snapshot-store.js | wysokie | 8 | 659 | 26 | 36 | 600+ linii; dużo zależnych plików |
| js/testing/wycena/suites/central-status-sync.js | wysokie | 8 | 643 | 9 | 14 | 600+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app/investor/investor-ui.js | wysokie | 8 | 592 | 7 | 30 | 400+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app.js | wysokie | 8 | 591 | 22 | 48 | 400+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/tabs/wycena.js | wysokie | 8 | 590 | 6 | 18 | 400+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/helpers-bridges.js | wysokie | 8 | 390 | 14 | 23 | 250+ linii; dużo publicznych symboli FC; dużo zależnych plików; dużo zależności wychodzących |
| js/app/quote/quote-scope-entry.js | średnie | 7 | 489 | 5 | 22 | 400+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/tabs/rysunek.js | nie ruszać bez osobnego planu | 6 | 1459 | 2 | 23 | 600+ linii; systemowe dialogi |
| js/app/ui/actions-register.js | średnie | 6 | 449 | 0 | 0 | 400+ linii; dużo zależności wychodzących; systemowe dialogi |
| js/testing/rozrys/suites/scope-runtime-controllers.js | średnie | 6 | 369 | 7 | 17 | 250+ linii; kilka publicznych symboli FC; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/project-stock.js | średnie | 6 | 342 | 13 | 24 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/state-ui-runtime.js | średnie | 6 | 305 | 7 | 17 | 250+ linii; kilka publicznych symboli FC; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/core-offer-basics.js | średnie | 6 | 252 | 14 | 23 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rysunek/tests.js | średnie | 6 | 117 | 6 | 24 | kilka zależnych plików; kilka zależności wychodzących; bezpośredni storage poza oczywistą granicą; systemowe dialogi |
| js/app/cabinet/cabinet-modal-set-wizard.js | średnie | 5 | 693 | 0 | 0 | 600+ linii; kilka zależności wychodzących |
| js/app/wycena/wycena-tab-selection.js | średnie | 5 | 452 | 2 | 11 | 400+ linii; kilka zależności wychodzących |
| js/testing/wycena/suites/scope-entry.js | średnie | 5 | 361 | 9 | 14 | 250+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app/rozrys/rozrys-scope.js | średnie | 5 | 317 | 10 | 37 | 250+ linii; dużo zależnych plików |
| js/app/project/project-status-manual-guard.js | średnie | 5 | 296 | 6 | 21 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/testing/wycena/suites/core-offer-workflow.js | średnie | 5 | 273 | 9 | 14 | 250+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/app/rozrys/rozrys-engine.js | średnie | 5 | 270 | 6 | 31 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/app/quote/quote-snapshot.js | średnie | 5 | 257 | 8 | 34 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |
| js/app/ui/views.js | średnie | 5 | 250 | 14 | 40 | 250+ linii; dużo zależnych plików; kilka zależności wychodzących |
| js/app/quote/quote-offer-store.js | średnie | 5 | 238 | 11 | 31 | dużo zależnych plików; kilka zależności wychodzących |
| js/testing/wycena/fixtures.js | średnie | 5 | 88 | 10 | 15 | dużo zależnych plików; dużo zależności wychodzących |
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

### js/app/shared/storage.js

- Obszar: DANE/STORAGE
- Kategoria: store/storage
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: storage
- Bezpośrednio zależne pliki (33): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-store.js<br>js/app/investor/investor-ui.js +25
- Pośrednio zależne pliki (92): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-selectors.js<br>js/app/catalog/catalog-store.js +84

### js/app/shared/utils.js

- Obszar: SHARED
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: utils
- Bezpośrednio zależne pliki (32): js/app.js<br>js/app/cabinet/cabinet-fronts.js<br>js/app/cabinet/cabinet-modal-hanging.js<br>js/app/cabinet/cabinet-modal-module.js<br>js/app/cabinet/cabinet-modal-standing-corner-standard.js<br>js/app/cabinet/cabinet-modal-standing-front-controls.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/catalog/catalog-domain.js +24
- Pośrednio zależne pliki (88): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-selectors.js<br>js/app/catalog/catalog-store.js +80

### js/app/investor/investors-store.js

- Obszar: INWESTOR
- Kategoria: store/storage
- Ryzyko: wysokie (600+ linii; dużo zależnych plików; bezpośredni storage poza oczywistą granicą)
- Definiuje FC: investors
- Bezpośrednio zależne pliki (26): js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js<br>js/app/investor/investor-rooms.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-sync.js<br>js/app/project/project-store.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-scope-entry.js +18
- Pośrednio zależne pliki (48): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-bridge.js<br>js/app/project/project-status-manual-guard.js +40

### js/app/quote/quote-snapshot-store.js

- Obszar: WYCENA
- Kategoria: domain/controller
- Ryzyko: wysokie (600+ linii; dużo zależnych plików)
- Definiuje FC: quoteSnapshotStore
- Bezpośrednio zależne pliki (26): js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-pdf.js<br>js/app/quote/quote-scope-entry.js<br>js/app/quote/quote-snapshot.js<br>js/app/shared/room-registry-impact.js<br>js/app/shared/room-scope-resolver.js<br>js/app/wycena/wycena-tab-helpers.js +18
- Pośrednio zależne pliki (36): js/app/investor/investor-persistence.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-pdf.js<br>js/app/quote/quote-scope-entry.js +28

### js/app/shared/room-registry.js

- Obszar: POMIESZCZENIA
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: roomRegistry
- Bezpośrednio zależne pliki (25): js/app/investor/investor-room-actions.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-scope-entry.js<br>js/app/quote/quote-snapshot-store.js<br>js/app/quote/quote-snapshot.js +17
- Pośrednio zależne pliki (63): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js<br>js/app/investor/investor-room-actions.js<br>js/app/investor/investor-ui.js<br>js/app/material/material-edge-store.js +55

### js/app.js

- Obszar: BOOT/APP SHELL
- Kategoria: bootstrap/orchestrator
- Ryzyko: wysokie (400+ linii; dużo zależnych plików; dużo zależności wychodzących)
- Definiuje FC: project, appView
- Bezpośrednio zależne pliki (22): js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-project.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js<br>js/app/project/project-bridge.js<br>js/app/project/project-status-sync.js +14
- Pośrednio zależne pliki (48): js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js<br>js/app/project/project-status-manual-guard.js +40

### js/app/project/project-store.js

- Obszar: PROJEKT
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików)
- Definiuje FC: projectStore
- Bezpośrednio zależne pliki (22): js/app/investor/investor-project.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-bridge.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-scope-entry.js<br>js/app/quote/quote-snapshot.js +14
- Pośrednio zależne pliki (57): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js +49

### js/app/ui/info-box.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: infoBox
- Bezpośrednio zależne pliki (22): js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-modals.js<br>js/app/investor/investor-pdf.js<br>js/app/investor/investor-ui.js<br>js/app/material/magazyn.js<br>js/app/material/price-modal-context.js +14
- Pośrednio zależne pliki (53): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-ui.js<br>js/app/material/price-modal-filters.js<br>js/app/material/price-modal-item-form.js<br>js/app/material/price-modal-list.js<br>js/app/material/price-modal-options.js<br>js/app/material/price-modal-persistence.js +45

### js/app/project/project-bridge.js

- Obszar: PROJEKT
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików)
- Definiuje FC: project
- Bezpośrednio zależne pliki (21): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-project.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js<br>js/app/project/project-status-sync.js +13
- Pośrednio zależne pliki (50): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project.js<br>js/app/investor/project-autosave.js<br>js/app/investor/project-bootstrap.js +42

### js/app/ui/confirm-box.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: confirmBox
- Bezpośrednio zależne pliki (19): js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/investor/investor-modals.js<br>js/app/investor/investor-ui.js<br>js/app/material/magazyn.js<br>js/app/material/material-part-options.js<br>js/app/material/price-modal-context.js<br>js/app/rozrys/rozrys-ui-tools.js +11
- Pośrednio zależne pliki (52): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/material/material-edge-store.js<br>js/app/material/price-modal-filters.js<br>js/app/material/price-modal-item-form.js<br>js/app/material/price-modal-list.js<br>js/app/material/price-modal-options.js<br>js/app/material/price-modal-persistence.js +44

### js/testing/shared/harness.js

- Obszar: TESTY
- Kategoria: test
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: testHarness
- Bezpośrednio zależne pliki (19): js/testing/cabinet/tests.js<br>js/testing/data-safety/tests.js<br>js/testing/dev-tests-registry.js<br>js/testing/investor/tests.js<br>js/testing/material/tests.js<br>js/testing/project/tests.js<br>js/testing/rysunek/tests.js<br>js/testing/service/tests.js +11
- Pośrednio zależne pliki (20): js/testing/cabinet/tests.js<br>js/testing/dev-tests-page.js<br>js/testing/dev-tests-registry.js<br>js/testing/investor/tests.js<br>js/testing/project/tests.js<br>js/testing/rozrys/suites/helpers-bridges.js<br>js/testing/rozrys/suites/project-stock.js<br>js/testing/rozrys/tests.js +12

### js/app/shared/constants.js

- Obszar: SHARED
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: constants
- Bezpośrednio zależne pliki (18): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/catalog/catalog-store.js<br>js/app/investor/investor-project.js<br>js/app/investor/investors-store.js<br>js/app/investor/session.js<br>js/app/material/magazyn.js<br>js/app/project/project-bridge.js +10
- Pośrednio zależne pliki (78): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-selectors.js<br>js/app/catalog/catalog-store.js +70

### js/app/optimizer/cut-optimizer.js

- Obszar: OPTIMIZER
- Kategoria: shared/domain/helper
- Ryzyko: średnie (250+ linii; dużo zależnych plików)
- Definiuje FC: cutOptimizer
- Bezpośrednio zależne pliki (16): js/app/optimizer/panel-pro-worker.js<br>js/app/optimizer/speed-dokladnie.js<br>js/app/optimizer/speed-max-bands.js<br>js/app/optimizer/speed-max-half-sheet.js<br>js/app/optimizer/speed-max-sheet-plan.js<br>js/app/optimizer/speed-max.js<br>js/app/optimizer/speed-turbo.js<br>js/app/rozrys/rozrys-engine.js +8
- Pośrednio zależne pliki (36): js/app/optimizer/panel-pro-worker.js<br>js/app/optimizer/speed-dokladnie.js<br>js/app/optimizer/speed-max-half-sheet.js<br>js/app/optimizer/speed-max-sheet-plan.js<br>js/app/optimizer/speed-max.js<br>js/app/optimizer/speed-turbo.js<br>js/app/rozrys/rozrys-engine.js<br>js/app/rozrys/rozrys-lazy-loader.js +28

### js/app/wycena/wycena-core.js

- Obszar: WYCENA
- Kategoria: domain/controller
- Ryzyko: wysokie (600+ linii; dużo zależnych plików; dużo zależności wychodzących)
- Definiuje FC: materialHasGrain, wycenaCore
- Bezpośrednio zależne pliki (16): js/app/material/material-registry.js<br>js/app/material/price-modal-persistence.js<br>js/app/project/project-status-manual-guard.js<br>js/app/quote/quote-pdf.js<br>js/app/quote/quote-scope-entry.js<br>js/app/quote/quote-snapshot.js<br>js/app/wycena/wycena-tab-selection.js<br>js/app/wycena/wycena-tab-shell.js +8
- Pośrednio zależne pliki (37): js/app/investor/investor-persistence.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui.js<br>js/app/material/price-modal-options.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-pdf.js +29

### js/app/ui/panel-box.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: panelBox
- Bezpośrednio zależne pliki (15): js/app/investor/investor-modals.js<br>js/app/material/material-part-options.js<br>js/app/rozrys/rozrys-grain-modal.js<br>js/app/rozrys/rozrys-options-modal.js<br>js/app/rozrys/rozrys-pickers.js<br>js/app/rozrys/rozrys-stock-modal.js<br>js/app/rozrys/rozrys-summary.js<br>js/app/rozrys/rozrys-ui-tools.js +7
- Pośrednio zależne pliki (24): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/material/material-edge-store.js<br>js/app/rozrys/rozrys-selection-ui.js<br>js/app/rozrys/rozrys-ui-bridge.js<br>js/app/rozrys/rozrys.js<br>js/app/service/cutting/service-cutting-rozrys.js<br>js/app/service/service-orders.js +16
