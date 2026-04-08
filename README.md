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

## Deploy (GitHub Pages)

Do repo trafia pełna paczka `site.zip` w root.
Workflow wypakuje ZIP do roota, usunie ZIP i zrobi commit.

## Główne aktywne pliki

- `index.html` — struktura widoków i kolejność ładowania skryptów
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

- `js/app/cabinet/front-hardware.js` — wspólne obliczenia frontów i okuć (fronty do Materiałów, zawiasy BLUM, AVENTOS).
- `js/app/cabinet/cabinet-fronts.js` — reguły typów/podtypów, fronty, walidacja AVENTOS i generowanie frontów; źródło prawdy dla logiki frontów używanej przez modal i materiały.
- `js/app/cabinet/cabinet-modal.js` — pełna logika modala szafki i kreatora zestawów; źródło prawdy dla renderu modala, dynamicznych pól i zapisu zestawów.


- `js/app/shared/calc.js` — aktywny moduł lekkich helperów obliczeniowych (wysokość góry, top zestawów).


- `js/app/ui/settings-ui.js` — helpery ustawień pokoju i rozwijania kart wyjęte z `app.js`.


- `js/app/cabinet/cabinet-summary.js` — helper tekstowych podsumowań szafek wydzielony z `app.js`.


- Step 17: safe dead-code cleanup in `js/app.js` (removed unused `deleteSelectedCabinet()` and duplicate/trailing ballast comments).


- `js/app/cabinet/corner-sketch.js` — helper canvas szkicu narożnych szafek; wydzielony z `app.js` bez zmiany UI.


- `js/app/cabinet/cabinet-cutlist.js` — helper obliczeniowy `getCabinetCutList(cab, room)` wydzielony z `app.js` z fallbackiem wstecznym.


- `js/app/investor/project-bootstrap.js` — boot-time normalization helpers for project data; keep app.js lighter without changing UI.


- `js/app.js` ma też lekki, globalny debounce autosave projektu (`installProjectAutosave` / `scheduleProjectAutosave`) jako bezpiecznik na wypadek, gdy pojedynczy handler zmiany nie zapisze stanu od razu.

- Refresh behavior: normal page refresh no longer forces a return to Home; manual safe reset is available via `?safe=1` (and legacy `?reset=1`).

- Router widoków preferuje aktywny projekt (`roomType`) nad starym `entry: home`, żeby zwykły refresh nie wyrzucał na start.

- `js/app.js`: fallbacki dla `drawCornerSketch()` i `getCabinetExtraSummary()` zostały uproszczone do cienkich delegatorów; źródłem prawdy są moduły `js/app/cabinet/corner-sketch.js` i `js/app/cabinet/cabinet-summary.js`.


Step 24: `app.js` further trimmed by reducing duplicated `material-common` and `front-hardware` wrappers to thin delegators with minimal fallbacks.

- `js/app.js` trzyma już tylko minimalny awaryjny fallback dla `getCabinetCutList()`; pełna logika siedzi w `js/app/cabinet/cabinet-cutlist.js`.


- `js/app/cabinet/cabinet-actions.js` — proste akcje szafek (dodanie/usunięcie) wydzielone z `app.js`.
- `js/app/cabinet/cabinet-actions.js` i `js/app/cabinet/cabinet-summary.js` są teraz również ładowane bezpośrednio przez `index.html`, więc `app.js` nie musi utrzymywać rozbudowanych fallbacków tylko z powodu braku skryptu.

- `project-bootstrap.js` ładowany tylko raz w `index.html`; usunięty duplikat include.

- js/app.js korzysta już z preładowanych modułów constants/utils/storage/ui-state jako źródeł prawdy; w app.js zostały tylko lokalne fallbacki awaryjne.


- `js/app/shared/public-api.js` — publiczne bezpieczne API FC/App (boot/init, openRoom, safe akcje modali i zakładek).


- `js/app/shared/core-failsafe.js` — awaryjne minimalne fallbacki dla `FC.actions` i `FC.modal`, ładowane przed `app.js`.
- `js/app/shared/dom-guard.js` — walidacja wymaganych selektorów DOM, ładowana przed `app.js`.


- Step 33: trimmed app.js wrappers for dom-guard, project-bootstrap and calc/settings by delegating to preloaded modules with minimal local fallbacks.

- `js/app/investor/project-autosave.js` — globalny debounce autosave projektu i instalacja lekkiego bezpiecznika autosave dla zmian w obszarze aplikacji.


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
