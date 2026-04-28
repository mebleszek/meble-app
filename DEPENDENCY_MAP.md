# DEPENDENCY_MAP — mapa zależności i wpływu zmian

Ten dokument służy do planowania refaktorów, splitów i optymalizacji bez strzelania. Przed cięciem pliku trzeba sprawdzić nie tylko bezpośrednie zależności, ale też wpływ drugiego poziomu: co korzysta z pliku, a potem co korzysta z tych korzystających plików.

Raport źródłowy generuje narzędzie:

```bash
node tools/dependency-source-audit.js
```

Wyniki pomocnicze są zapisywane do:

- `tools/reports/dependency-source-audit.md`,
- `tools/reports/dependency-source-audit.json`.

Raport jest heurystyką opartą głównie o symbole `FC.*`, load order i proste sygnały ryzyka. Nie zastępuje ręcznego przejścia ścieżek przed refaktorem.

## Zasada pracy przed refaktorem

1. Ustal, czy plik jest ładowany w `index.html`, `dev_tests.html`, przez lazy loader, przez worker albo przez narzędzia Node.
2. Sprawdź symbole, które plik wystawia do `FC.*`.
3. Sprawdź, które pliki tych symboli używają.
4. Sprawdź wpływ drugiego poziomu: jeżeli ruszysz plik bazowy, które przepływy mogą ucierpieć pośrednio.
5. Sprawdź, czy plik dotyka storage, danych użytkownika, statusów, backupów, cache albo UI.
6. Najpierw dopisz lub wzmocnij test kontraktowy, potem tnij/przenoś kod.
7. Po zmianie porównaj ścieżkę stary → nowy moduł: load order, API `FC.*`, timing inicjalizacji, fallbacki i skutki uboczne.

## Aktualny model ładowania

### `index.html`

Aplikacja produkcyjna ładuje obecnie 184 skrypty. Kolejność można czytać jako warstwy:

1. `boot`, core i guardy: `js/boot.js`, `js/core/*`, `js/app/shared/core-failsafe.js`, `dom-guard`.
2. Shared/dane: constants, utils, migrate, schema, storage, data-storage, backup.
3. Projekt/inwestor/pomieszczenia/katalogi/usługi.
4. UI shell i akcje.
5. Materiały i modale cenników.
6. Szafki, hardware, bootstrapy app state/UI i reload/restore.
7. `js/app.js` oraz public API.
8. Moduły cięższych działów: inwestor-project, tabs, wycena, optimizer, magazyn, ROZRYS.

### `dev_tests.html`

Testy ręczne ładują obecnie 192 skrypty. Układ jest podobny, ale uproszczony i dołożony o test harness oraz moduły testowe. To jedyne ręczne wejście do testów. W tej paczce dołożono jawne ładowanie `project-autosave.js` oraz rozbite suite testów ROZRYS.

### Lazy/special load

Poniższe pliki nie są bezpośrednio w `index.html`/`dev_tests.html`, ale nie wolno ich z automatu uznać za martwe:

- `js/app/rozrys/rozrys-accordion.js` — używany w smoke ROZRYS i przez lazy/kontrakty ROZRYS,
- `js/app/rozrys/rozrys-grain-modal.js` — lazy manifest ROZRYS,
- `js/app/rozrys/rozrys-options-modal.js` — lazy manifest ROZRYS,
- `js/app/rozrys/rozrys-progress.js` — lazy manifest ROZRYS,
- `js/app/rozrys/rozrys-runner.js` — lazy manifest ROZRYS,
- `js/app/rozrys/rozrys-stock-modal.js` — lazy manifest ROZRYS,
- `js/app/investor/project-autosave.js` — rozstrzygnięty po audycie: to aktywny runtime boundary autosave, ładowany jawnie po `reload-restore.js` w `index.html` i `dev_tests.html`; nie ładować go do Node `app-dev-smoke` jako zwykłego pliku, bo ten runner ma własny, uproszczony kontekst.

## Podsumowanie audytu 2026-04-26

| Metryka | Wynik |
| --- | ---: |
| Pliki JS | 240 |
| Skrypty w `index.html` | 185 |
| Skrypty w `dev_tests.html` | 192 |
| Krawędzie zależności po symbolach `FC.*` | 1023 |
| Produkcyjne symbole `FC.*` z właścicielem | 173 |
| Wszystkie symbole `FC.*` z właścicielem, razem z testami | 196 |
| Pliki wysokiego ryzyka / nie ruszać bez planu | 15 |
| Pliki średniego ryzyka | 36 |

## Obszary według rozmiaru i ryzyka

| Obszar | Pliki | Linie | Storage refs | Dialog refs | Wysokie | Średnie |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ROZRYS | 42 | 8836 | 6 | 0 | 1 | 2 |
| TESTY | 26 | 8386 | 179 | 1 | 5 | 9 |
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

## Fundamenty o dużym wpływie

Te pliki mogą wyglądać niewinnie, ale mają szeroki wpływ bezpośredni i pośredni. Zmiany w nich wymagają testu kontraktowego albo bardzo świadomego ograniczenia zakresu.

| Plik | Direct impact | 2nd level | Wniosek |
| --- | ---: | ---: | --- |
| `js/app/shared/storage.js` | 31 | 83 | Główna techniczna granica storage; dobry kierunek porządków, ale każda zmiana wpływa szeroko. |
| `js/app/shared/utils.js` | 32 | 79 | Fundament helperów; zmieniać małymi krokami. |
| `js/app/shared/constants.js` | 18 | 71 | Stałe bazowe; duży drugi poziom przez projekty, inwestorów i cenniki. |
| `js/app/shared/room-registry.js` | 23 | 62 | Kluczowy styk pomieszczeń z inwestorem, wyceną i statusem. |
| `js/app/shared/ui-state.js` | 14 | 55 | Stan UI szeroko używany przez shell i działy. |
| `js/app/ui/info-box.js` | 20 | 44 | Wspólne UI powiadomień; niskie ryzyko domenowe, ale duży wpływ wizualno-interakcyjny. |
| `js/app/ui/confirm-box.js` | 17 | 38 | Wspólne potwierdzenia; nie zmieniać zachowania/wyglądu bez zgody. |

## Gorące punkty domenowe

### App shell

- `js/app.js` — 791 linii, wysokie ryzyko, 22 zależne pliki, 37 plików drugiego poziomu.
- Po stage 1 nie ma już bezpośredniego `localStorage`/`sessionStorage`, ale nadal jest grubym klejem aplikacji.
- Kolejne porządki powinny wyjmować tylko mechaniki boczne o jasnym kontrakcie: bootstrap, widoki, routing stanu, inicjalizacja sekcji.

### Inwestor / projekt

- `js/app/investor/investors-store.js` — 610 linii, wysokie ryzyko, bezpośredni storage, 24 zależne pliki, 56 drugiego poziomu.
- `js/app/project/project-store.js` — średnie ryzyko, 20 zależnych plików, 52 drugiego poziomu.
- `js/app/project/project-bridge.js` — krótki, ale wpływowy most `FC.project`; 21 zależnych plików, 39 drugiego poziomu.
- `js/app/project/project-status-sync.js` — 644 linie, wysokie ryzyko; statusy łączą inwestora, projekty i wyceny.

Wniosek: nie zaczynać tu od dużej migracji storage. Najpierw kontrakty: model inwestora, model projektu, status, snapshot oferty, zachowanie przy cofaniu statusu.

### Wycena

- `js/app/quote/quote-snapshot-store.js` — 659 linii, wysokie ryzyko, 21 zależnych plików.
- `js/app/wycena/wycena-core.js` — 653 linie, wysokie ryzyko, 14 zależnych i 16 wychodzących zależności.
- `js/tabs/wycena.js` — 809 linii, wysokie ryzyko.

Wycena jest spięta z materiałami, ROZRYS, statusem projektu, snapshotem oferty i PDF. Split bez testów ścieżek ofert/statusów grozi regresją.

### ROZRYS

- 42 pliki, 8836 linii, duży obszar, ale częściowo już zmodularyzowany.
- `js/app/rozrys/rozrys.js` — 842 linie, wysokie ryzyko, 7 bezpośrednich zależnych, 31 drugiego poziomu.
- Najważniejsze zależności wychodzą do: cabinet cutlist, material part options, optimizer, run/controller/render/scope/prefs/project source.
- Pliki modalowe ROZRYS są lazy-loaded i testowane pośrednio; nie kasować ich jako „nieładowanych”.

Wniosek: dalsze cięcie ROZRYS tylko po ścieżkach. Dobry kierunek to nie wielki split `rozrys.js`, tylko wyjmowanie jasno nazwanych mechanik z testem kontraktowym.

### RYSUNEK

- `js/tabs/rysunek.js` — 1459 linii, 11 systemowych dialogów, kategoria: nie ruszać bez osobnego planu.
- Ma mało formalnych zależności `FC.*`, ale miesza render SVG, interakcje, inspektor, listy i stare dialogi.

Wniosek: zanim ciąć, najpierw usunąć albo zabezpieczyć systemowe dialogi przez własne modale i dołożyć testy kontraktowe render/interakcje.

### Materiał

- Obszar ma mniejszy rozmiar niż inwestor/wycena/ROZRYS, ale jest połączony z ROZRYS i wyceną.
- `js/app/material/magazyn.js` — 251 linii, średnie ryzyko, bezpośredni storage i 3 systemowe dialogi.
- `js/app/material/material-part-options.js` — 265 linii, bezpośredni storage, używany przez `material-edge-store`, `rozrys.js` i testy ROZRYS.

Wniosek: materiał może być następnym bezpieczniejszym etapem, ale dopiero po kontrakcie: jakie dane są katalogiem, jakie są ustawieniem projektu, a jakie są wejściem ROZRYS.

## Klasy ryzyka przed zmianami

### Niskie ryzyko

Warunek: mały plik, jedna odpowiedzialność, mało skutków ubocznych, brak danych użytkownika albo storage za boundary.

Można robić małymi paczkami, ale nadal uruchamiać testy.

### Średnie ryzyko

Warunek: plik ma 250+ linii, dużo zależności, storage poza boundary, systemowe dialogi albo miesza UI z domeną.

Wymagane przed zmianą:

- sprawdzić wejścia/wyjścia,
- dopisać test kontraktowy,
- ograniczyć zakres do jednej odpowiedzialności.

### Wysokie ryzyko

Warunek: 600+ linii, dużo wpływu drugiego poziomu, statusy/projekty/inwestorzy/wycena, gruby app shell albo krytyczny store.

Wymagane przed zmianą:

- ręczna analiza ścieżek,
- test kontraktowy przed refaktorem,
- porównanie starych i nowych ścieżek po zmianie,
- brak ukrytej migracji danych.

### Nie ruszać bez osobnego planu

Dotyczy obecnie szczególnie `js/tabs/rysunek.js` oraz większych zmian na styku inwestor/projekt/wycena/status. Tu najpierw plan, potem testy, potem kod.

## Najlepsze następne kandydaty po tej mapie

### 1. Testy ROZRYS — etap splitu wykonany

`js/testing/rozrys/tests.js` został rozbity na cienki runner i suite'y w `js/testing/rozrys/suites/*`. Raport dla użytkownika ma pozostać taki sam, a kolejne zmiany w testach ROZRYS należy dokładać do właściwej suite zamiast znowu powiększać runner.

### 2. `project-autosave.js` — rozstrzygnięty jako aktywny runtime boundary

Plik nie był ładowany w głównych wejściach, mimo że `app.js` deleguje do `FC.projectAutosave`. Po audycie został jawnie dodany do `index.html`, `dev_tests.html` i `tools/index-load-groups.js`, a test projektu sprawdza obecność tego boundary. Nie kasować go jako martwego pliku. W Node `app-dev-smoke` nie jest ładowany bezpośrednio, bo runner nie odwzorowuje pełnego runtime `index.html`; tam sprawdzana jest obecność w HTML.

### 3. Materiał stage — tylko po kontrakcie danych

Powód: mniejsze ryzyko niż inwestor/projekt, ale ma styki z ROZRYS i wyceną.

Bezpieczny zakres: najpierw testy/kontrakty dla `material-part-options`, `material-edge-store`, `magazyn`, bez zmiany UI.

### 4. App shell stage 2

Powód: `app.js` nadal ma 791 linii i duży wpływ. Po reload/restore da się szukać kolejnych bocznych mechanik, ale tylko po ścieżkach.

Bezpieczny zakres: wyłącznie jedna mechanika naraz, np. czysty bootstrap/sekcje/routing, bez danych biznesowych.

### 5. Status/project/quote — osobny etap wysokiego ryzyka

Powód: statusy są krytyczne biznesowo i łączą inwestora, projekt oraz oferty.

Warunek: przed kodem testy synchronizacji i opis kontraktu.

## Decyzja po audycie

Następnego refaktoru nie wybierać na oko. Najpierw użyć tej mapy i raportu, potem dobrać pracę według relacji zysk/ryzyko:

- szybki zysk, niskie ryzyko: split dużych testów,
- średni zysk, średnie ryzyko: materiał z kontraktem danych,
- duży zysk, wysokie ryzyko: app shell/statusy/projekty,
- osobny plan: RYSUNEK.

## 2026-04-26 — ROZRYS smoke dependency note
- `tools/rozrys-dev-smoke.js` ładuje `js/app/rozrys/rozrys-stock.js` przed suite’ami ROZRYS, bo bezpośredni test opcji domyślnych korzysta z `FC.rozrysStock.getDefaultRozrysOptionValues`.

## Wycena status contract v1

- `dev_tests.html` i `tools/app-dev-smoke-lib/file-list.js` ładują `js/testing/wycena/suites/status-contract.js` po `central-status-sync.js`.
- Kontrakt dotyczy zależności: `quoteSnapshotStore` → `projectStatusSync` → `investorPersistence/projectStore/project.save` oraz debug-wejść z `wycena.js`.
- Runtime load order aplikacji bez zmian.

## ROZRYS speed-max split v1

- `js/app/optimizer/speed-max.js` nie jest już monolitem algorytmu; po splicie ma pozostać cienką fasadą `FC.rozkrojSpeeds.max`.
- Aktywny load order optymalizatora MAX: `cut-optimizer.js` → `speed-max-core.js` → `speed-max-bands.js` → `speed-max-sheet-plan.js` → `speed-max-half-sheet.js` → `speed-max.js`.
- Ten sam load order musi być utrzymany w `index.html`, `dev_tests.html`, `tools/index-load-groups.js`, `tools/rozrys-dev-smoke.js` i `panel-pro-worker.js`.
- Po audycie źródłowym OPTIMIZER ma 12 plików i 1589 linii; największy nowy plik `speed-max-bands.js` ma 380 linii i wymaga ostrożności przy dalszym dokładaniu logiki.

## App shell / WYWIAD split v1 — 2026-04-27

- `js/app.js` po splicie ma 590 linii i pozostaje plikiem o podwyższonym wpływie, ale nie zawiera już właściwego renderu kontenera zakładek ani renderu kart WYWIAD.
- Nowy właściciel renderu kontenera: `js/app/ui/cabinets-render.js` (`FC.cabinetsRender.renderCabinets`).
- Nowy właściciel renderu zakładki WYWIAD: `js/tabs/wywiad.js` (`FC.tabsWywiad.renderWywiadTab`, `FC.tabsWywiad.renderSingleCabinetCard`).
- Zachowany kontrakt globalny: `renderCabinets()`, `renderWywiadTab()` i `renderSingleCabinetCard()` nadal istnieją w `app.js` jako delegatory.
- `index.html` ma teraz 190 skryptów; `verifyIndex()` potwierdza zgodność z `tools/index-load-groups.js`.

## Wycena contracts audit v1 — 2026-04-27

- Nowa suite: `js/testing/wycena/suites/architecture-contract.js`, ładowana po `status-contract.js` i przed pozostałymi suite'ami Wyceny.
- Nowe narzędzie: `tools/wycena-architecture-audit.js`; raport: `tools/reports/wycena-contracts-audit-v1.md`.
- Chronione fasady przed splitem: `FC.wycenaCore`, `FC.quoteSnapshotStore`, `FC.projectStatusSync`, `FC.wycenaTabDebug`.
- Najbardziej zależnościowo ryzykowne pliki Wyceny pozostają bez zmian runtime: `js/tabs/wycena.js`, `js/app/quote/quote-snapshot-store.js`, `js/app/wycena/wycena-core.js`, `js/app/project/project-status-sync.js`.

## Wycena preview split v1 — 2026-04-28

- Load order Wyceny zawiera teraz `js/app/wycena/wycena-tab-preview.js` przed `js/tabs/wycena.js`.
- `FC.wycenaTabPreview.renderPreview(...)` jest wywoływane z `js/tabs/wycena.js` i dostaje jawne zależności: helpery renderu, snapshoty, status bridge, PDF/akceptację oraz detekcję ofert wstępnych.
- Moduł preview nie jest granicą danych ani statusów; to tylko warstwa DOM/render. Nie wolno przenosić do niego zapisu snapshotów, synchronizacji statusów ani scope ofert.
- `tools/app-dev-smoke-lib/file-list.js` i `tools/index-load-groups.js` muszą utrzymywać ten sam load order co `index.html` i `dev_tests.html`.

## Wycena shell split v1 — 2026-04-28

- Load order Wyceny rozszerzony o `wycena-tab-dom.js`, `wycena-tab-status-actions.js` i `wycena-tab-shell.js` przed `js/tabs/wycena.js`.
- Zależności runtime: `tabs/wycena.js` pozostaje fasadą stanu i przekazuje jawne zależności do `wycena-tab-shell`, `wycena-tab-preview`, `wycena-tab-history`, `wycena-tab-selection`, `wycena-tab-editor` oraz `wycena-tab-status-actions`.
- `wycena-tab-status-actions.js` zależy od `wycena-tab-status-bridge.js`; nie powinien bezpośrednio zastępować `project-status-sync.js` ani `quote-snapshot-store.js`.
- `wycena-tab-shell.js` używa `FC.wycenaCore` tylko do akcji generowania wyceny i `FC.quotePdf` tylko do przycisku PDF; resztę dostaje przez jawne zależności z fasady.
- Audyt po paczce: największe ryzyka Wyceny to nadal `quote-snapshot-store.js`, `wycena-core.js` i `project-status-sync.js`; `tabs/wycena.js` spadł do ok. 590 linii.

## 2026-04-28 — Wycena snapshot scope split v1

- Dodano `js/app/quote/quote-snapshot-scope.js` ładowany bezpośrednio przed `quote-snapshot-store.js` w `index.html`, `dev_tests.html`, `tools/index-load-groups.js` i `tools/app-dev-smoke-lib/file-list.js`.
- Zależność krytyczna: `quote-snapshot-store.js` wymaga `FC.quoteSnapshotScope` przed startem i celowo rzuca błąd, jeśli helper scope nie jest dostępny.
- Publiczne helpery scope są dalej eksportowane przez `FC.quoteSnapshotStore` jako delegaty, aby nie złamać istniejących zależności Wyceny, statusów i PDF.
