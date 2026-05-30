# DEPENDENCY_SOURCE_AUDIT — raport źródłowy

Raport generowany przez `node tools/dependency-source-audit.js`. To jest raport pomocniczy do `DEPENDENCY_MAP.md`, nie zamiennik ręcznej analizy przed refaktorem.

## Podsumowanie

| Metryka | Wartość |
| --- | --- |
| Pliki JS | 361 |
| Skrypty w index.html | 285 |
| Skrypty w dev_tests.html | 318 |
| Krawędzie zależności po symbolach FC | 1887 |
| Symbole FC z właścicielem produkcyjnym | 261 |
| Symbole FC z właścicielem razem | 289 |
| Pliki z ryzykiem wysokim / nie ruszać | 10 |
| Pliki z ryzykiem średnim | 68 |

## Obszary

| Obszar | Pliki | Linie | Storage refs | Dialog refs | Wysokie | Średnie |
| --- | --- | --- | --- | --- | --- | --- |
| TESTY | 53 | 12480 | 242 | 1 | 5 | 32 |
| ROZRYS | 42 | 8860 | 6 | 0 | 1 | 5 |
| WYCENA | 47 | 8229 | 8 | 0 | 2 | 6 |
| SZAFKI | 31 | 7597 | 0 | 0 | 0 | 4 |
| MATERIAŁ | 27 | 5702 | 8 | 3 | 0 | 3 |
| KATALOG/USŁUGI | 24 | 4789 | 4 | 0 | 1 | 2 |
| UI | 32 | 4261 | 0 | 6 | 0 | 2 |
| INWESTOR | 25 | 3725 | 29 | 0 | 0 | 5 |
| PROJEKT | 10 | 2067 | 0 | 0 | 0 | 6 |
| POMIESZCZENIA | 12 | 1909 | 0 | 1 | 0 | 0 |
| OPTIMIZER | 12 | 1589 | 0 | 0 | 0 | 1 |
| RYSUNEK | 1 | 1459 | 0 | 11 | 1 | 0 |
| BOOT/APP SHELL | 7 | 1390 | 4 | 0 | 0 | 2 |
| INNE | 7 | 1333 | 2 | 0 | 0 | 0 |
| DANE/STORAGE | 15 | 1332 | 36 | 0 | 0 | 0 |
| SHARED | 11 | 1268 | 0 | 0 | 0 | 0 |
| ZAKŁADKI | 3 | 627 | 0 | 0 | 0 | 0 |
| CORE | 2 | 128 | 0 | 0 | 0 | 0 |

## Największe pliki

| Plik | Linie | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/tabs/rysunek.js | 1459 | RYSUNEK | nie ruszać bez osobnego planu |
| js/testing/cabinet/tests.js | 1010 | TESTY | wysokie |
| js/app/cabinet/cabinet-modal-set-wizard.js | 858 | SZAFKI | średnie |
| js/app/cabinet/cabinet-fronts.js | 854 | SZAFKI | średnie |
| js/testing/project/tests.js | 848 | TESTY | wysokie |
| js/app/rozrys/rozrys.js | 842 | ROZRYS | wysokie |
| js/app/cabinet/cabinet-modal.js | 684 | SZAFKI | średnie |
| js/testing/wycena/suites/central-status-sync.js | 649 | TESTY | wysokie |
| js/testing/material/accessories-tests.js | 614 | TESTY | średnie |
| js/app/material/price-modal-hardware-dictionaries.js | 609 | MATERIAŁ | średnie |
| js/app/cabinet/cabinet-modal-standing-specials.js | 602 | SZAFKI | średnie |
| js/app/catalog/hardware-catalog.js | 584 | KATALOG/USŁUGI | średnie |
| js/app/wycena/wycena-diagnostics.js | 583 | WYCENA | wysokie |
| js/app/wycena/wycena-context-repair.js | 578 | WYCENA | wysokie |
| js/app/material/price-modal-hardware-form.js | 563 | MATERIAŁ | niskie |
| js/app/catalog/catalog-store.js | 524 | KATALOG/USŁUGI | wysokie |
| js/app/rozrys/rozrys-render.js | 493 | ROZRYS | średnie |
| js/testing/rozrys/tests.js | 475 | TESTY | wysokie |
| js/app/ui/actions-register.js | 473 | UI | średnie |
| js/app/cabinet/cabinet-choice-launchers.js | 423 | SZAFKI | niskie |

## Największy wpływ bezpośredni

| Plik | Zależne pliki | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/app/bootstrap/app-core-namespace.js | 75 | BOOT/APP SHELL | średnie |
| js/app/investor/investors-store.js | 45 | INWESTOR | średnie |
| js/app/quote/quote-snapshot-store.js | 44 | WYCENA | średnie |
| js/app/shared/utils.js | 42 | SHARED | niskie |
| js/app/shared/storage.js | 37 | DANE/STORAGE | niskie |
| js/testing/shared/harness.js | 37 | TESTY | niskie |
| js/app/shared/room-registry.js | 34 | POMIESZCZENIA | niskie |
| js/app/project/project-store.js | 31 | PROJEKT | średnie |
| js/app/ui/info-box.js | 29 | UI | niskie |
| js/app/project/project-bridge.js | 25 | PROJEKT | średnie |
| js/app/ui/panel-box.js | 24 | UI | niskie |
| js/testing/wycena/suites/core-offer-basics.js | 23 | TESTY | średnie |
| js/app/shared/constants.js | 21 | SHARED | niskie |
| js/app/material/price-modal-context.js | 20 | MATERIAŁ | średnie |
| js/app/ui/confirm-box.js | 20 | UI | niskie |
| js/app/catalog/catalog-store.js | 19 | KATALOG/USŁUGI | wysokie |
| js/app/catalog/hardware-catalog.js | 18 | KATALOG/USŁUGI | średnie |
| js/app/investor/investor-persistence.js | 18 | INWESTOR | średnie |
| js/app/project/project-status-snapshot-flow.js | 17 | PROJEKT | średnie |
| js/app/project/project-status-sync.js | 17 | PROJEKT | średnie |

## Największy wpływ drugiego poziomu

| Plik | Pliki pośrednio zależne | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/app/bootstrap/app-core-namespace.js | 195 | BOOT/APP SHELL | średnie |
| js/app/shared/storage.js | 167 | DANE/STORAGE | niskie |
| js/app/shared/utils.js | 164 | SHARED | niskie |
| js/app/shared/constants.js | 122 | SHARED | niskie |
| js/app/project/project-bridge.js | 113 | PROJEKT | średnie |
| js/app/investor/investors-store.js | 103 | INWESTOR | średnie |
| js/app/project/project-store.js | 99 | PROJEKT | średnie |
| js/app/shared/schema.js | 98 | SHARED | niskie |
| js/app/investor/session.js | 96 | INWESTOR | średnie |
| js/app/shared/room-registry.js | 96 | POMIESZCZENIA | niskie |
| js/app/ui/info-box.js | 76 | UI | niskie |
| js/app/ui/confirm-box.js | 73 | UI | niskie |
| js/app/quote/quote-snapshot-store.js | 70 | WYCENA | średnie |
| js/app/shared/ui-state.js | 69 | SHARED | niskie |
| js/app/quote/quote-snapshot.js | 61 | WYCENA | średnie |
| js/app/investor/investor-persistence.js | 60 | INWESTOR | średnie |
| js/app/catalog/catalog-store.js | 57 | KATALOG/USŁUGI | wysokie |
| js/app/investor/investors-model.js | 53 | INWESTOR | niskie |
| js/app/catalog/catalog-domain.js | 52 | KATALOG/USŁUGI | niskie |
| js/app/rozrys/rozrys.js | 51 | ROZRYS | wysokie |

## Najwięcej bezpośrednich referencji storage

| Plik | Referencje | Obszar | Ryzyko |
| --- | --- | --- | --- |
| js/testing/project/tests.js | 112 | TESTY | wysokie |
| js/testing/data-safety/tests.js | 36 | TESTY | niskie |
| js/testing/material/tests.js | 23 | TESTY | średnie |
| js/testing/investor/suites/recovery-isolation.js | 20 | TESTY | średnie |
| js/app/shared/storage.js | 17 | DANE/STORAGE | niskie |
| js/app/investor/session.js | 15 | INWESTOR | średnie |
| js/testing/test-data-manager.js | 15 | TESTY | średnie |
| js/testing/wycena/fixtures.js | 13 | TESTY | średnie |
| js/testing/investor/suites/recovery-sources.js | 12 | TESTY | średnie |
| js/testing/rysunek/tests.js | 10 | TESTY | średnie |
| js/app/investor/investors-local-repository.js | 9 | INWESTOR | niskie |
| js/app/shared/data-storage-keys.js | 7 | DANE/STORAGE | niskie |
| js/app/wycena/wycena-context-repair.js | 5 | WYCENA | wysokie |
| js/app/catalog/catalog-storage-policy.js | 4 | KATALOG/USŁUGI | niskie |
| js/app/material/material-part-options.js | 4 | MATERIAŁ | niskie |
| js/app/shared/data-storage-audit.js | 4 | DANE/STORAGE | niskie |
| js/app/bootstrap/reload-restore.js | 3 | BOOT/APP SHELL | niskie |
| js/app/investor/investor-project-repository.js | 3 | INWESTOR | niskie |
| js/app/material/material-edge-store.js | 3 | MATERIAŁ | niskie |
| js/app/shared/data-backup-snapshot-apply.js | 3 | DANE/STORAGE | niskie |

## Pliki ryzykowne

| Plik | Ryzyko | Score | Linie | Direct impact | 2nd level | Powody |
| --- | --- | --- | --- | --- | --- | --- |
| js/testing/project/tests.js | wysokie | 15 | 848 | 14 | 38 | 600+ linii; dużo publicznych symboli FC; dużo zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą; łączy DOM/eventy i storage |
| js/testing/cabinet/tests.js | wysokie | 10 | 1010 | 6 | 33 | 600+ linii; kilka publicznych symboli FC; kilka zależnych plików; dużo zależności wychodzących; dużo DOM i publicznego API |
| js/app/rozrys/rozrys.js | wysokie | 10 | 842 | 11 | 51 | 600+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/tests.js | wysokie | 10 | 475 | 10 | 37 | 400+ linii; dużo zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/testing/wycena/suites/central-status-sync.js | wysokie | 9 | 649 | 15 | 23 | 600+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/app/wycena/wycena-diagnostics.js | wysokie | 8 | 583 | 2 | 3 | 400+ linii; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/app/wycena/wycena-context-repair.js | wysokie | 8 | 578 | 2 | 4 | 400+ linii; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/app/catalog/catalog-store.js | wysokie | 8 | 524 | 19 | 57 | 400+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/helpers-bridges.js | wysokie | 8 | 390 | 14 | 36 | 250+ linii; dużo publicznych symboli FC; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/test-data-manager.js | średnie | 7 | 393 | 15 | 32 | 250+ linii; dużo zależnych plików; kilka zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/testing/wycena/fixtures.js | średnie | 7 | 154 | 16 | 24 | dużo zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/tabs/rysunek.js | nie ruszać bez osobnego planu | 6 | 1459 | 2 | 7 | 600+ linii; systemowe dialogi |
| js/testing/material/accessories-tests.js | średnie | 6 | 614 | 1 | 1 | 600+ linii; dużo zależności wychodzących |
| js/app/catalog/hardware-catalog.js | średnie | 6 | 584 | 18 | 25 | 400+ linii; dużo zależnych plików |
| js/app/ui/actions-register.js | średnie | 6 | 473 | 0 | 0 | 400+ linii; dużo zależności wychodzących; systemowe dialogi |
| js/testing/rozrys/suites/scope-runtime-controllers.js | średnie | 6 | 369 | 7 | 21 | 250+ linii; kilka publicznych symboli FC; kilka zależnych plików; dużo zależności wychodzących |
| js/app/investor/investor-ui.js | średnie | 6 | 363 | 7 | 23 | 250+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/scope-entry.js | średnie | 6 | 361 | 15 | 23 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/tabs/wycena.js | średnie | 6 | 359 | 6 | 25 | 250+ linii; kilka zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/investor-integration.js | średnie | 6 | 356 | 15 | 23 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/project-stock.js | średnie | 6 | 342 | 16 | 38 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/app/quote/quote-snapshot-store.js | średnie | 6 | 329 | 44 | 70 | 250+ linii; dużo zależnych plików; kilka zależności wychodzących |
| js/testing/wycena/suites/architecture-contract.js | średnie | 6 | 321 | 15 | 23 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/rozrys/suites/state-ui-runtime.js | średnie | 6 | 305 | 7 | 21 | 250+ linii; kilka publicznych symboli FC; kilka zależnych plików; dużo zależności wychodzących |
| js/app/quote/quote-snapshot.js | średnie | 6 | 301 | 11 | 61 | 250+ linii; dużo zależnych plików; kilka zależności wychodzących |
| js/testing/wycena/suites/core-offer-workflow.js | średnie | 6 | 277 | 15 | 23 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/wycena/suites/core-offer-basics.js | średnie | 6 | 252 | 23 | 37 | 250+ linii; dużo zależnych plików; dużo zależności wychodzących |
| js/testing/investor/suites/recovery-isolation.js | średnie | 6 | 208 | 8 | 9 | kilka zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/app/investor/investors-store.js | średnie | 6 | 204 | 45 | 103 | dużo zależnych plików; bezpośredni storage poza oczywistą granicą |
| js/testing/investor/suites/recovery-sources.js | średnie | 6 | 168 | 8 | 9 | kilka zależnych plików; dużo zależności wychodzących; bezpośredni storage poza oczywistą granicą |
| js/testing/rysunek/tests.js | średnie | 6 | 117 | 6 | 33 | kilka zależnych plików; kilka zależności wychodzących; bezpośredni storage poza oczywistą granicą; systemowe dialogi |
| js/app/cabinet/cabinet-modal-set-wizard.js | średnie | 5 | 858 | 0 | 0 | 600+ linii; kilka zależności wychodzących |
| js/app/cabinet/cabinet-modal.js | średnie | 5 | 684 | 0 | 0 | 600+ linii; kilka zależności wychodzących |
| js/app/material/price-modal-hardware-dictionaries.js | średnie | 5 | 609 | 0 | 0 | 600+ linii; kilka zależności wychodzących |
| js/app/project/project-status-manual-guard.js | średnie | 5 | 395 | 8 | 31 | 250+ linii; kilka zależnych plików; kilka zależności wychodzących |

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
- Bezpośrednio zależne pliki (75): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-fronts.js<br>js/app/cabinet/cabinet-modal-hanging.js<br>js/app/cabinet/cabinet-modal-module.js +67
- Pośrednio zależne pliki (195): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-fronts.js<br>js/app/cabinet/cabinet-modal-hanging.js<br>js/app/cabinet/cabinet-modal-labor.js +187

### js/app/investor/investors-store.js

- Obszar: INWESTOR
- Kategoria: store/storage
- Ryzyko: średnie (dużo zależnych plików; bezpośredni storage poza oczywistą granicą)
- Definiuje FC: investors
- Bezpośrednio zależne pliki (45): js/app/investor/investor-persistence.js<br>js/app/investor/investor-project-patches.js<br>js/app/investor/investor-project-repository.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/session.js<br>js/app/project/project-bridge.js<br>js/app/project/project-schedule-status.js<br>js/app/project/project-status-manual-guard.js +37
- Pośrednio zależne pliki (103): js/app.js<br>js/app/bootstrap/app-core-namespace.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js +95

### js/app/quote/quote-snapshot-store.js

- Obszar: WYCENA
- Kategoria: domain/controller
- Ryzyko: średnie (250+ linii; dużo zależnych plików; kilka zależności wychodzących)
- Definiuje FC: quoteSnapshotStore
- Bezpośrednio zależne pliki (44): js/app/project/project-schedule-status.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-scope.js<br>js/app/project/project-status-snapshot-flow.js<br>js/app/project/project-status-sync.js<br>js/app/quote/quote-pdf.js<br>js/app/quote/quote-scope-entry-scope.js<br>js/app/quote/quote-scope-entry-utils.js +36
- Pośrednio zależne pliki (70): js/app/investor/investor-persistence.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui-status-flow.js<br>js/app/project/project-schedule-status.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-mirrors.js<br>js/app/project/project-status-scope-decision.js<br>js/app/project/project-status-scope.js +62

### js/app/shared/utils.js

- Obszar: SHARED
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: utils
- Bezpośrednio zależne pliki (42): js/app/bootstrap/app-core-namespace.js<br>js/app/cabinet/cabinet-fronts.js<br>js/app/cabinet/cabinet-modal-hanging.js<br>js/app/cabinet/cabinet-modal-module.js<br>js/app/cabinet/cabinet-modal-standing-corner-standard.js<br>js/app/cabinet/cabinet-modal-standing-front-controls.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/catalog/catalog-domain.js +34
- Pośrednio zależne pliki (164): js/app.js<br>js/app/bootstrap/app-core-namespace.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-fronts.js<br>js/app/cabinet/cabinet-modal-hanging.js +156

### js/app/shared/storage.js

- Obszar: DANE/STORAGE
- Kategoria: store/storage
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: storage
- Bezpośrednio zależne pliki (37): js/app.js<br>js/app/bootstrap/app-core-namespace.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/catalog/catalog-store.js +29
- Pośrednio zależne pliki (167): js/app.js<br>js/app/bootstrap/app-core-namespace.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-fronts.js<br>js/app/cabinet/cabinet-modal-hanging.js +159

### js/testing/shared/harness.js

- Obszar: TESTY
- Kategoria: test
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: testHarness
- Bezpośrednio zależne pliki (37): js/testing/cabinet/tests.js<br>js/testing/data-safety/tests.js<br>js/testing/dev-tests-page.js<br>js/testing/dev-tests-registry.js<br>js/testing/investor/suites/architecture.js<br>js/testing/investor/suites/misc.js<br>js/testing/investor/suites/model-actions.js<br>js/testing/investor/suites/recovery-isolation.js +29
- Pośrednio zależne pliki (35): js/testing/cabinet/tests.js<br>js/testing/dev-tests-page.js<br>js/testing/dev-tests-registry.js<br>js/testing/investor/suites/architecture.js<br>js/testing/investor/suites/misc.js<br>js/testing/investor/suites/model-actions.js<br>js/testing/investor/suites/recovery-isolation.js<br>js/testing/investor/suites/recovery-sources.js +27

### js/app/shared/room-registry.js

- Obszar: POMIESZCZENIA
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: roomRegistry
- Bezpośrednio zależne pliki (34): js/app/investor/investor-room-actions.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-mirrors.js<br>js/app/project/project-status-scope.js<br>js/app/quote/quote-offer-store.js<br>js/app/quote/quote-scope-entry-scope.js +26
- Pośrednio zależne pliki (96): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project-runtime.js<br>js/app/investor/investor-room-actions.js<br>js/app/investor/investor-rooms.js<br>js/app/investor/investor-ui-render.js +88

### js/app/project/project-store.js

- Obszar: PROJEKT
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików)
- Definiuje FC: projectStore
- Bezpośrednio zależne pliki (31): js/app/investor/investor-project-repository.js<br>js/app/investor/investors-store.js<br>js/app/investor/session.js<br>js/app/project/project-bridge.js<br>js/app/project/project-schedule-status.js<br>js/app/project/project-status-manual-guard.js<br>js/app/project/project-status-mirrors.js<br>js/app/project/project-status-scope.js +23
- Pośrednio zależne pliki (99): js/app.js<br>js/app/bootstrap/app-core-namespace.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-persistence.js<br>js/app/investor/investor-project-patches.js<br>js/app/investor/investor-project-repository.js +91

### js/app/ui/info-box.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: infoBox
- Bezpośrednio zależne pliki (29): js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-modals.js<br>js/app/investor/investor-pdf.js<br>js/app/investor/investor-ui-status-flow.js<br>js/app/material/magazyn.js<br>js/app/material/price-modal-context.js +21
- Pośrednio zależne pliki (76): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-ui-render.js<br>js/app/investor/investor-ui.js<br>js/app/material/price-modal-field-help.js<br>js/app/material/price-modal-filters.js<br>js/app/material/price-modal-hardware-bundle.js<br>js/app/material/price-modal-hardware-dictionaries.js +68

### js/app/project/project-bridge.js

- Obszar: PROJEKT
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików)
- Definiuje FC: project
- Bezpośrednio zależne pliki (25): js/app.js<br>js/app/bootstrap/app-core-namespace.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-set-wizard.js<br>js/app/investor/investor-project-patches.js<br>js/app/investor/investor-project-runtime.js<br>js/app/investor/project-autosave.js +17
- Pośrednio zależne pliki (113): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-fronts.js<br>js/app/cabinet/cabinet-modal-hanging.js<br>js/app/cabinet/cabinet-modal-module.js +105

### js/app/ui/panel-box.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: panelBox
- Bezpośrednio zależne pliki (24): js/app/investor/investor-modals.js<br>js/app/material/material-part-options.js<br>js/app/material/price-modal-field-help.js<br>js/app/material/price-modal-hardware-bundle.js<br>js/app/material/price-modal-hardware-dictionaries.js<br>js/app/material/price-modal-hardware-filter-sort.js<br>js/app/material/price-modal-hardware-form.js<br>js/app/material/price-modal-hardware-import-export.js +16
- Pośrednio zależne pliki (24): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/material/material-edge-store.js<br>js/app/rozrys/rozrys-selection-ui.js<br>js/app/rozrys/rozrys-ui-bridge.js<br>js/app/rozrys/rozrys.js<br>js/app/service/cutting/service-cutting-rozrys.js<br>js/app/service/service-orders.js +16

### js/testing/wycena/suites/core-offer-basics.js

- Obszar: TESTY
- Kategoria: test
- Ryzyko: średnie (250+ linii; dużo zależnych plików; dużo zależności wychodzących)
- Definiuje FC: registerWycenaTests, roomRegistry, confirmBox
- Bezpośrednio zależne pliki (23): js/testing/investor/suites/architecture.js<br>js/testing/investor/suites/registry-core.js<br>js/testing/investor/suites/registry-manage.js<br>js/testing/investor/suites/status-flow.js<br>js/testing/rozrys/suites/helpers-bridges.js<br>js/testing/rozrys/suites/project-stock.js<br>js/testing/rozrys/tests.js<br>js/testing/wycena/fixtures.js +15
- Pośrednio zależne pliki (37): js/testing/cabinet/tests.js<br>js/testing/dev-tests-registry.js<br>js/testing/investor/suites/architecture.js<br>js/testing/investor/suites/misc.js<br>js/testing/investor/suites/model-actions.js<br>js/testing/investor/suites/recovery-isolation.js<br>js/testing/investor/suites/recovery-sources.js<br>js/testing/investor/suites/registry-core.js +29

### js/app/shared/constants.js

- Obszar: SHARED
- Kategoria: shared/domain/helper
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: constants
- Bezpośrednio zależne pliki (21): js/app.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/catalog/catalog-store.js<br>js/app/investor/investor-project-repository.js<br>js/app/investor/investors-model.js<br>js/app/investor/investors-store.js<br>js/app/investor/session.js<br>js/app/material/magazyn.js +13
- Pośrednio zależne pliki (122): js/app.js<br>js/app/bootstrap/app-core-namespace.js<br>js/app/bootstrap/app-state-bootstrap.js<br>js/app/bootstrap/app-ui-bootstrap.js<br>js/app/bootstrap/reload-restore.js<br>js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal-labor.js<br>js/app/cabinet/cabinet-modal-set-wizard.js +114

### js/app/material/price-modal-context.js

- Obszar: MATERIAŁ
- Kategoria: domain/controller
- Ryzyko: średnie (dużo zależnych plików; kilka zależności wychodzących)
- Definiuje FC: priceModal, priceModalContext
- Bezpośrednio zależne pliki (20): js/app/material/price-modal-field-help.js<br>js/app/material/price-modal-filters.js<br>js/app/material/price-modal-hardware-bundle.js<br>js/app/material/price-modal-hardware-dictionaries.js<br>js/app/material/price-modal-hardware-filter-sort.js<br>js/app/material/price-modal-hardware-form.js<br>js/app/material/price-modal-hardware-import-export.js<br>js/app/material/price-modal-hardware-manufacturers.js +12
- Pośrednio zależne pliki (28): js/app/material/price-modal-hardware-import-export.js<br>js/app/ui/actions-register.js<br>js/testing/investor/suites/architecture.js<br>js/testing/investor/suites/registry-core.js<br>js/testing/investor/suites/registry-manage.js<br>js/testing/investor/suites/status-flow.js<br>js/testing/material/accessories-tests.js<br>js/testing/material/tests.js +20

### js/app/ui/confirm-box.js

- Obszar: UI
- Kategoria: ui/render/events
- Ryzyko: niskie (dużo zależnych plików)
- Definiuje FC: confirmBox
- Bezpośrednio zależne pliki (20): js/app/cabinet/cabinet-actions.js<br>js/app/cabinet/cabinet-modal.js<br>js/app/investor/investor-modals.js<br>js/app/investor/investor-ui-status-flow.js<br>js/app/material/magazyn.js<br>js/app/material/material-part-options.js<br>js/app/material/price-modal-context.js<br>js/app/material/price-modal-hardware-import-export.js +12
- Pośrednio zależne pliki (73): js/app/bootstrap/app-ui-bootstrap.js<br>js/app/investor/investor-actions.js<br>js/app/investor/investor-ui.js<br>js/app/material/material-edge-store.js<br>js/app/material/price-modal-field-help.js<br>js/app/material/price-modal-filters.js<br>js/app/material/price-modal-hardware-bundle.js<br>js/app/material/price-modal-hardware-dictionaries.js +65
