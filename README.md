### 2026-04-26 — app shell storage boundary stage 1
- `js/app/bootstrap/reload-restore.js` now owns session-scoped reload/scroll restore.
- `js/app.js` no longer directly references `localStorage` or `sessionStorage`; it only delegates reload/restore through the app shell boundary.
- `js/app/shared/storage.js` exposes small session helpers used by the reload boundary.
- APP smoke test coverage now includes the reload/restore contract.

### 2026-04-24 — data safety foundation
- Added a system-wide backup module for all app data (`fc_*` localStorage keys), not just investors.
- Start screen now has a gear settings entry for `Dane programu`: create backup, save safe state, export/import JSON, restore saved backup, pin/delete backups, copy diagnostics.
- Dev tests now use the same backup module before each run and always cleanup marked test data after runs.

### 2026-04-24 — investor storage recovery visibility fix
- Normal app hides leaked developer-test investors and can recover missing investor records from the edit-session snapshot as well as project/quote stores.
- Updated cache-busting for `investors-store.js`.

# meble-app
Program do wyceny mebli i rozwijania modułów projektowania / rozkroju.

## Zasady pracy nad repo

- Nie zmieniać UI ani sposobu prezentacji bez zgody użytkownika.
- Po każdej serii zmian przygotować pełny `site.zip` z całą strukturą repo.
- W paczce zawsze muszą być `README.md` i `DEV.md`.
- Kolejne zmiany robić zawsze na ostatnim ZIP-ie wygenerowanym w rozmowie.


## Etap architektury — 2 tryby pracy (stage 1)

Program startuje teraz z 2 głównych wejść:
- `Projekty meblowe`
- `Drobne usługi stolarskie`

W tej paczce wdrożono pierwszy bezpieczny etap rozdzielenia odpowiedzialności:
- ekran startowy prowadzi do 2 osobnych hubów kontekstowych,
- cenniki nie są już pokazywane jako jedno wspólne centrum na starcie,
- katalog danych został logicznie rozdzielony na:
  - `sheetMaterials` / materiały arkuszowe,
  - `accessories` / akcesoria,
  - `quoteRates` / stawki wyceny mebli,
  - `workshopServices` / usługi stolarskie,
  - `serviceOrders` / drobne zlecenia usługowe.

### Nowe aktywne moduły stage 1

- `js/app/catalog/catalog-store.js` — centralny store katalogów; rozdziela legacy `materials/services` na nowe byty i utrzymuje kompatybilność wsteczną.
- `js/app/ui/work-mode-hub.js` — render 2 trybów pracy i kontekstowych wejść po wejściu w dany tryb.
- `js/app/service/service-orders.js` — osobna lista i edytor drobnych zleceń usługowych.

### Zakres etapu 1

To jeszcze nie jest pełna przebudowa całej domeny pod chmurę.
Etap 1 porządkuje wejścia, routing i podstawowe byty danych bez przepinania całego projektu meblowego i całej wyceny na nowy model naraz.

## Testy developerskie

- `dev_tests.html` — główna, użytkowa strona testów w przeglądarce.
- `js/testing/rozrys/tests.js` — cienki runner testów ROZRYS. Szczegółowe suite'y są w `js/testing/rozrys/suites/*`; nie scalać ich ponownie w jeden duży plik.
- `tools/app-dev-smoke.js` — cienki runner techniczny Node dla APP; szczegóły środowiska smoke są w `tools/app-dev-smoke-lib/`.
- `tools/local-storage-source-audit.js` — źródłowy audyt bezpośrednich użyć `localStorage` / `sessionStorage`.
- `OPTIMIZATION_PLAN.md` — plan wspólnych mechanik, duplikacji i kolejności porządkowania.

## Deploy (GitHub Pages)

Do repo trafia pełna paczka `site.zip` w root.
Workflow wypakuje ZIP do roota, usunie ZIP i zrobi commit.

## Główne aktywne pliki

- `index.html` — struktura widoków i kolejność ładowania skryptów
- `css/base-ui.css` — bazowe zmienne i fundament UI, ładowany jako pierwszy plik stylów.
- `css/app-runtime.css`, `css/cabinet-common.css`, `css/drawing-home-confirm.css`, `css/shared-overlays-choice.css`, `css/rozrys-main.css`, `css/investor-table-sync.css`, `css/wycena.css`, `css/wywiad.css` — pełny split dawnego `css/style.css` na ciągłe bloki ładowane w tej samej kolejności co dawny monolit.
- `css/style.css` — pusty placeholder zgodności po pełnym splicie CSS; nie dokładać tu nowych reguł.
- `js/boot.js` — preflight + banner błędów
- `js/core/actions.js` — Actions registry + walidacja `data-action`
- `js/core/modals.js` — obsługa modali
- `js/app/ui/bindings.js` — delegacja klików + listenery
- `js/app/ui/actions-register.js` — rejestr akcji UI
- `js/app.js` — główny klej aplikacji; renderery `WYWIAD`, `MATERIAŁ` i `RYSUNEK` są już przeniesione do `js/tabs/*`
- `js/app/rozrys/rozrys.js` — zakładka rozrysu / Optimax
- `js/app/optimizer/cut-optimizer.js` — silnik rozkroju

## Uwaga architektoniczna

Repo zawiera też pliki pomocnicze / historyczne, które nie zawsze są bezpośrednio ładowane przez `index.html`.
Przed edycją zawsze trzeba sprawdzić, czy plik jest aktywnym entrypointem, workerem, czy legacy.

Szczegóły utrzymywać i aktualizować w `DEV.md`.


- `js/app/material/price-modal.js (renderer + akcje modala cenników)` — wydzielony renderer modala cenników; `app.js` ma być tu tylko delegatorem.
- Martwy helper `renderFinishList()` został usunięty z `app.js`; aktywna logika wykończeń dla RYSUNKU ma siedzieć w module zakładki.


- `js/app/ui/tab-navigation.js` — centralna nawigacja zakładek i skoki między WYWIAD ↔ MATERIAŁ; źródło prawdy dla `setActiveTab()` i helperów focus/scroll.
- `js/app/ui/layout-state.js` — helpery layoutu/wykończeń RYSUNKU i zapisu projektu; źródło prawdy dla `ensureLayout()`, `saveProject()` i pokrewnych helperów.


- `js/app/material/material-common.js` — wspólne helpery materiałowe i formatowanie wydzielone z `app.js`.
- `js/app/material/material-edge-store.js` — store oklein/obrzeży dla zakładki MATERIAŁ: podpisy formatek, domyślne krawędzie, zapis `fc_edge_v1` i liczenie mb.
- `js/app/material/material-tab-data.js` — model danych zakładki MATERIAŁ: zbiera szafki, cutlisty, sumy m² i mb oklein przed renderem.

- `js/app/cabinet/front-hardware.js` — cienki shell kompatybilności dla front-hardware; logika jest w `front-hardware-weights.js`, `front-hardware-fronts.js`, `front-hardware-hinges.js` oraz splicie AVENTOS (`front-hardware-aventos-data.js`, `front-hardware-aventos-calc.js`, `front-hardware-aventos-selector.js`, `front-hardware-aventos.js`).
- `js/app/cabinet/cabinet-fronts.js` — reguły typów/podtypów, fronty, walidacja AVENTOS i generowanie frontów; źródło prawdy dla logiki frontów używanej przez modal i materiały.
- `js/app/cabinet/cabinet-modal.js` — pełna logika modala szafki i kreatora zestawów; źródło prawdy dla renderu modala, dynamicznych pól i zapisu zestawów.


- `js/app/shared/calc.js` — aktywny moduł lekkich helperów obliczeniowych (wysokość góry, top zestawów).


- `js/app/ui/settings-ui.js` — helpery ustawień pokoju i rozwijania kart wyjęte z `app.js`.


- `js/app/cabinet/cabinet-summary.js` — helper tekstowych podsumowań szafek wydzielony z `app.js`.


- Step 17: safe dead-code cleanup in `js/app.js` (removed unused `deleteSelectedCabinet()` and duplicate/trailing ballast comments).


- `js/app/cabinet/corner-sketch.js` — helper canvas szkicu narożnych szafek; wydzielony z `app.js` bez zmiany UI.


- `js/app/cabinet/cabinet-cutlist.js` — helper obliczeniowy `getCabinetCutList(cab, room)` wydzielony z `app.js` z fallbackiem wstecznym.


- `js/app/investor/project-bootstrap.js` — boot-time normalization helpers for project data; keep app.js lighter without changing UI.


- `js/app.js` deleguje lekki, globalny debounce autosave projektu (`installProjectAutosave` / `scheduleProjectAutosave`) do `js/app/investor/project-autosave.js` jako bezpiecznik na wypadek, gdy pojedynczy handler zmiany nie zapisze stanu od razu.

- Refresh behavior: normal page refresh no longer forces a return to Home; manual safe reset is available via `?safe=1` (and legacy `?reset=1`).

- Router widoków preferuje aktywny projekt (`roomType`) nad starym `entry: home`, żeby zwykły refresh nie wyrzucał na start.

- `js/app.js`: fallbacki dla `drawCornerSketch()` i `getCabinetExtraSummary()` zostały uproszczone do cienkich delegatorów; źródłem prawdy są moduły `js/app/cabinet/corner-sketch.js` i `js/app/cabinet/cabinet-summary.js`.


Step 24: `app.js` further trimmed by reducing duplicated `material-common` and `front-hardware` wrappers to thin delegators with minimal fallbacks.

- `js/app.js` trzyma już tylko minimalny awaryjny fallback dla `getCabinetCutList()`; pełna logika siedzi w `js/app/cabinet/cabinet-cutlist.js`.


- `js/app/cabinet/cabinet-actions.js` — proste akcje szafek (dodanie/usunięcie) wydzielone z `app.js`.
- `js/app/cabinet/cabinet-actions.js` i `js/app/cabinet/cabinet-summary.js` są teraz również ładowane bezpośrednio przez `index.html`, więc `app.js` nie musi utrzymywać rozbudowanych fallbacków tylko z powodu braku skryptu.

- `project-bootstrap.js` ładowany tylko raz w `index.html`; usunięty duplikat include.

- js/app.js korzysta już z preładowanych modułów constants/utils/storage/ui-state jako źródeł prawdy; bezpośrednie `localStorage` / `sessionStorage` zostały przeniesione poza `app.js`.


- `js/app/shared/public-api.js` — publiczne bezpieczne API FC/App (boot/init, openRoom, safe akcje modali i zakładek).


- `js/app/shared/core-failsafe.js` — awaryjne minimalne fallbacki dla `FC.actions` i `FC.modal`, ładowane przed `app.js`.
- `js/app/shared/dom-guard.js` — walidacja wymaganych selektorów DOM, ładowana przed `app.js`.


- Step 33: trimmed app.js wrappers for dom-guard, project-bootstrap and calc/settings by delegating to preloaded modules with minimal local fallbacks.

- `js/app/investor/project-autosave.js` — aktywny runtime boundary autosave ładowany jawnie w `index.html` i `dev_tests.html`; globalny debounce autosave projektu i instalacja lekkiego bezpiecznika autosave dla zmian w obszarze aplikacji.


## Update
- Aktywowane moduły techniczne przed `app.js`: `js/app/shared/migrate.js`, `js/app/shared/schema.js`.
- `app.js` deleguje teraz normalizację projektu/room do `FC.schema` z lekkim fallbackiem awaryjnym.


- `js/app/material/material-registry.js` — registry producentów i helper `materialHasGrain()` wydzielone z `app.js`.

- `schema.js` is now the primary source of truth for project/room normalization; `app.js` keeps only a minimal emergency fallback.
- `js/app/material/material-registry.js` jest źródłem prawdy dla producentów materiałów i helpera `FC.materialHasGrain(...)`.

## Testy developerskie ROZRYS

Repo ma teraz prostą warstwę anty-regresyjną dla ROZRYS.

### Wariant 1 — skrypt Node

Uruchom w katalogu projektu:

```bash
node tools/rozrys-dev-smoke.js
```

Skrypt sprawdza podstawowe rzeczy bez odpalania całej aplikacji:
- store stanu ROZRYS,
- model arkuszy i magazynu,
- walidację planu,
- stabilność cache,
- prosty plan engine,
- strukturę HTML wydruku.

Jeśli któryś test nie przejdzie, skrypt kończy się błędem.

### Wariant 2 — strona developerska

Otwórz w przeglądarce plik:

- `dev_tests.html`

Na stronie jest przycisk `Uruchom testy ROZRYS`, który pokazuje wynik PASS/FAIL dla przygotowanych smoke-testów.

### Ważne

To nie zastępuje końcowego sprawdzenia działania UI na realnych danych.
To jest techniczna siatka bezpieczeństwa, która ma szybciej wyłapywać regresje po dużych zmianach w ROZRYS.


## ROZRYS — strona testowa

Plik `dev_tests.html` uruchamia smoke-testy ROZRYS przez stronę.
Po kliknięciu `Uruchom testy ROZRYS` pokazuje czytelny raport: co przeszło, co nie przeszło, krótki powód błędu oraz podsumowanie `X/Y OK`.
Raport ma też akcje `Kopiuj raport` oraz `Kopiuj tylko błędy`, żeby łatwo przenieść samą listę niezaliczonych testów.
Przycisk `Kopiuj raport` pozwala szybko skopiować wynik do wklejenia w rozmowie.


### ROZRYS smoke — dodatkowy test agregacji projektu
Strona `dev_tests.html` sprawdza już nie tylko cache/walidację/magazyn, ale też regresję pustego ROZRYS: test `ROZRYS buduje materiały z projektu i resolvera cutlist` pilnuje, żeby prosty projekt z szafką nie kończył się komunikatem o braku materiałów.


## Struktura katalogów po porządkach architektonicznych

- `js/app/shared/` — helpery wspólne, storage, validate, public API, lekkie utils
- `js/app/ui/` — routing zakładek, bindings, boxy/modale współdzielone, pamięć scrolla, helpers layoutu
- `js/app/cabinet/` — logika szafki, frontów, okuć, cutlisty i modala szafki
- `js/app/investor/` — inwestor, sesja projektu, bootstrap/autosave projektu
- `js/app/material/` — rejestr materiałów, magazyn, opcje formatek, cenniki
- `js/app/optimizer/` — solver, worker i profile szybkości/startu
- `js/app/rozrys/` — cały obszar ROZRYS
- `js/testing/` — strony i moduły smoke-testów developerskich

### Strony testowe

- `dev_tests.html` — smoke-testy ROZRYS
- `dev_tests.html` — smoke-testy projektu, materiałów i szafek


## 2026-04-07 — etap 2 trybów pracy
- Dodano moduły `js/app/catalog/catalog-domain.js` i `js/app/catalog/catalog-migration.js` jako wspólną warstwę domeny katalogów oraz migracji legacy danych.
- `catalog-store.js` korzysta teraz z tych modułów i publiczne `migrateLegacy()` domyślnie przebudowuje split z legacy danych, a init aplikacji zachowuje bezpieczne preferowanie już rozdzielonych katalogów.
- Dodano wspólny modal zarządzania pomieszczeniami inwestora przez `roomRegistry.openManageRoomsModal()`.


- 2026-04-07 stage2 fix v2: rozdzielono draft wspólnego modala pomieszczeń od sesji projektu/inwestora, `Anuluj` w modalu pomieszczeń resetuje tylko lokalne zmiany bez zamykania okna, a `dev_tests.html` ładuje już `constants.js` i `storage.js`, dzięki czemu testy katalogów używają prawdziwych kluczy storage. Dodatkowo ROZRYS dopuszcza retry dla niestandardowych kluczy pomieszczeń także przy aktywnym inwestorze.

## Etap 3 architektury — rozdzielenie domen

Aplikacja ma teraz dodatkową warstwę przygotowującą ją pod chmurę i dalszy rozwój bez mieszania odpowiedzialności:

- `project-model / project-store` — oddzielają dane projektu meblowego od samego inwestora,
- `service-order-store` — daje osobny byt dla drobnych zleceń usługowych,
- `catalog-selectors` — daje wspólne selektory katalogów dla modułów biznesowych,
- `quote-snapshot` — buduje czysty snapshot wyceny meblowej z materiałów, akcesoriów i stawek.

Na tym etapie UI nie został przebudowany szeroko — zmiana dotyczy głównie architektury danych, warstw pośrednich i antyregresji. Dzięki temu kolejne kroki (np. PDF wyceny, historia wycen, chmura, wieloprojektowość) można wdrażać bez rozpruwania całej aplikacji.


## 2026-04-08 boot fix
- Przywrócono jawne wystawianie startu aplikacji (`FC.init`, `App.init`, `initApp`, `initUI`) z `js/app.js`.
- `js/boot.js` dostał awaryjne doładowanie `js/app.js` i `js/app/shared/public-api.js`, jeśli po starcie strony nie ma funkcji init.

- 2026-04-08: Boot/start hardening: app now exposes init earlier, and stale roomType after deleted investor/test cleanup falls back safely instead of crashing renderCabinets.

## 2026-04-08 — etap 4 cleanup + snapshoty
- testy developerskie oznaczają dane testowe markerem `meta.testData` i sprzątają je po uruchomieniu, bez ruszania realnych danych;
- `dev_tests.html` ma też ręczny przycisk `Usuń dane testowe`;
- wycena ma osobny magazyn snapshotów (`quoteSnapshotStore`) przygotowany pod późniejszy PDF klienta i historię wycen;
- `serviceOrderStore` i `investors` zachowują metadane rekordów, co ułatwia późniejszą migrację do chmury i bezpieczny cleanup.


## 2026-04-08 — Stage 5: quote PDF + snapshot history
- W zakładce Wycena dodano niebieski przycisk PDF oparty o zapisany quoteSnapshot, a nie o DOM.
- Dodano historię snapshotów wyceny dla bieżącego projektu z akcjami Podgląd i PDF.


## 2026-04-08 — Stage 5B: quote history UX polish
- `Historia wycen` w `Wycena` ma teraz zwarte, niskie karty zamiast wysokich pustych pól.
- Kliknięcie `Podgląd` wyraźnie oznacza oglądany snapshot i automatycznie przewija do aktywnego podglądu wyceny.
- Aktywny wpis historii ma wyróżniony stan i nie udaje, że nic się nie stało po przełączeniu snapshotu.

- Stage 6: Wycena ma pola handlowe, robociznę/stawki meblowe, snapshot oferty i PDF klienta zgodny z wybraną wersją.

- Etap historii ofert: sekcja handlowa w Wycena działa jako accordion; snapshot oferty można usunąć lub oznaczyć jako zaakceptowany, co ustawia status projektu na `zaakceptowany`.

## 2026-04 quote status sync
- Wycena obsługuje flagę wstępnej wyceny, akceptację wstępnej -> Pomiar oraz akceptację właściwej wyceny -> Zaakceptowany.
- Ręczna zmiana statusu projektu w Inwestorze synchronizuje stan zaakceptowanej oferty w Wycena.


## 2026-04-10 preliminary quote fix
- removed project status `Po pomiarze`; after measurement use `Wycena` directly
- preliminary quote drafts now survive scope switch from investor-only to project-bound draft
- preliminary history entries are archived only when a newer normal quote exists

- 2026-04-12: zaległe testy działowe — dodano `js/testing/service/tests.js` z osobną sekcją `USŁUGI` dla store zleceń usługowych, listy statusów, upsertu bez duplikatów i cleanup testowych rekordów. `dev_tests.html` dostał osobne przyciski uruchamiania działów: PROJEKT, INWESTOR, MATERIAŁY, WYCENA, SZAFKI, USŁUGI, a runner Node `tools/app-dev-smoke.js` został rozszerzony o nową sekcję testów.

- 2026-04-12: cross smoke tests for `Wycena` now cover status sync with `Inwestor`, room selection filtered through `ROZRYS`, and final client PDF after converting a preliminary quote.


### Dodatkowe testy fundamentu danych
- `INWESTOR`: smoke testy obejmują teraz synchronizację statusu projektu z `projectStore` i historią ofert oraz bezpieczną aktualizację pojedynczego pomieszczenia.
- `MATERIAŁY`: smoke testy pilnują, że zapis płyt nie miesza akcesoriów z materiałami arkuszowymi i że migracja `preferStoredSplit` nie przywraca legacy danych przy pierwszym starcie.
- `USŁUGI`: smoke testy obejmują spójność `catalogStore` ↔ `serviceOrderStore` oraz brak pustego rekordu przy tworzeniu szkicu zlecenia.

- 2026-04-12: Naprawiono synchronizację `catalogStore` ↔ `serviceOrderStore` dla zleceń usługowych i dodano regresję pod odczyt po bezpośrednim zapisie do store.

### 2026-04-24 — session test include fix
- Naprawiono stronę testów aplikacji: `dev_tests.html` ładuje teraz moduł sesji inwestora przed testami projektu, więc test `FC.session.begin` ma dostęp do właściwego API.
- Podbito cache-busting dla `session.js`.



## 2026-04-24 — AVENTOS message tones
- Przywrócono kolory komunikatów AVENTOS: czerwony błąd, pomarańczowe ostrzeżenie, zielony komunikat OK/zalecenie.


### 2026-04-24 — AVENTOS API/message fix
Przywrócono kompatybilne globalne API AVENTOS po splicie hardware i naprawiono czerwony/pomarańczowy/zielony komunikat walidacji.


### 2026-04-24 — investor recovery leak fix
- Naprawiono przypadek, w którym po przerwanym teście developerskim lista inwestorów mogła pokazać tylko fixture `Jan Test` i blokować odzysk pozostałych rekordów z projectStore/snapshotów.
- Dane testowe są teraz mocniej oznaczane i sprzątane przez cleanup testów.

## 2026-04-25 — settings menu shell
- Startowy trybik `⚙` otwiera teraz menu ustawień, a `Backup i dane` jest osobnym, głębszym panelem.
- Panel backupów używa akordeonów dla danych użytkownika i danych technicznych oraz ma czytelniejsze nazwy akcji backupu.



## Dokumenty techniczne

- `DEV.md` — aktywne zasady rozwoju i workflow paczek.
- `CLOUD_MIGRATION.md` — zasady danych, storage i przyszłej migracji do chmury.
- `OPTIMIZATION_PLAN.md` — plan optymalizacji i scalania wspólnych mechanik.
- `DEPENDENCY_MAP.md` — mapa zależności, wpływu drugiego poziomu i kolejności bezpiecznych refaktorów.
- `tools/dependency-source-audit.js` — narzędzie generujące raporty `tools/reports/dependency-source-audit.md/json`.


## 2026-05-11 — Hardware import bulk/diff/types fix v1

- Import cen dostawców obsługuje hurtowe wklejanie po `producent + symbol + dostawca` bez ręcznego pilnowania ID.
- Puste `typ_cecha` w okuciu pozostaje puste; słownik typów jest listą opcji, a nie automatycznym wyborem.
- Podgląd importu rozróżnia okucia/ceny bez zmian od realnie zmienionych rekordów.


## Hardware supplier price create item v1 — 2026-05-12

- Import XLSX okuć pozwala utworzyć nowe okucie z arkusza `Ceny_dostawcow`, gdy wiersz ma istniejącego producenta, symbol, nazwę, istniejącego dostawcę i cenę.
- Nie wymaga ręcznego `okucie_id`; nie tworzy producentów z literówek.
- Brakująca `data_ceny` dla nowej lub zmienionej ceny jest uzupełniana przy imporcie i widoczna po kolejnym eksporcie.
