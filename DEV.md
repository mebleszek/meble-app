## 2026-04-24 — investor/rooms perf hotfix + manage-rooms layout cleanup
- `js/app/investor/investor-ui.js` — usunięte podwójne `refreshActionBar()` przy zwykłych polach edycji inwestora. Wcześniej każdy wpis znaku w formularzu odpalał odświeżenie paska akcji dwa razy; przy większej liczbie pomieszczeń mnożyło to niepotrzebne blokowanie/odblokowywanie akcji i spowalniało edycję.
- `js/app/shared/room-registry-modals-manage-remove.js` — modal `Edytuj pomieszczenia` nie liczy już stanu zmian przez pełne porównywanie całej listy po każdym znaku. Zamiast tego śledzi tylko zmienione/usunięte pokoje, co ogranicza lagi przy dużej liczbie pomieszczeń. Dodatkowo przycisk `Usuń` został przeniesiony do tego samego rzędu co pole nazwy, po prawej stronie.
- `css/investor-layout.css` — dopięty układ jednego rzędu dla pola nazwy i przycisku `Usuń` w modalu zarządzania pomieszczeniami.
- Instrukcja antyregresyjna: przy polach formularza inwestora nie dublować odświeżania paska akcji (`refreshActionBar`) w helperze i w samym handlerze zdarzenia naraz. W modalu zarządzania pomieszczeniami nie wracać do pełnego porównywania całej listy na każdy `input`; stan zmian ma być liczony przyrostowo.

## 2026-04-24 — investor/manage rooms modal perf + inline delete layout
- `js/app/shared/room-registry-modals-manage-remove.js` — modal `Edytuj pomieszczenia` nie liczy już stanu zmian przez porównywanie całej listy pokojów przy każdym wpisanym znaku. Zamiast tego śledzi zmiany lekko per pokój (`changedRoomIds` + `removedRoomIds`), więc edycja przy większej liczbie pomieszczeń jest wyraźnie lżejsza. To samo okno dostało też nowy układ wiersza: przycisk `Usuń` siedzi teraz w tym samym rzędzie co pole nazwy, po prawej stronie.
- `css/investor-layout.css` — dodane style dla nowego układu wiersza modala zarządzania pomieszczeniami (`room-registry-manage-row__controls`), tak aby input zajmował szerokość, a `Usuń` był po prawej, także na mobile.
- `js/app/investor/investor-ui.js` — `refreshActionBar()` nie przepina już na nowo wyborów statusów wszystkich pomieszczeń przy każdym wpisanym znaku w trybie edycji inwestora. W tym trybie statusy i tak są zablokowane, więc ich ponowne montowanie tylko spowalniało ekran przy większej liczbie pomieszczeń.
- Instrukcja antyregresyjna: przy dalszych zmianach tego modala nie wracać do pełnego porównywania wszystkich draftów na każde `input`. Dla dużej liczby pomieszczeń trzeba trzymać lekkie śledzenie zmian per wiersz i dopiero przy zapisie robić pełną walidację listy.

## 2026-04-23 — room core package 1: shared room scope + explicit registry cache invalidation + lighter session dirty tracking
- `js/app/shared/room-scope-resolver.js` — nowy wspólny moduł zakresu pomieszczeń. Trzyma jedno miejsce dla: normalizacji `roomIds`, zachowania exact-scope nawet gdy zapisany pokój już zniknął, fallbacku do aktywnych pomieszczeń oraz exact filtrowania snapshotów po pokoju. Dzięki temu `WYCENA` i statusy nie muszą już dublować tych samych reguł po swojemu.
- `js/app/wycena/wycena-core.js` + `js/app/project/project-status-sync.js` + `js/app/project/project-status-manual-guard.js` — przepięte na `room-scope-resolver`, żeby dobór pokoju, exact-scope i walidacja brakującego pokoju szły jedną ścieżką. To wzmacnia przypadek „zapisany stary pokój” oraz ogranicza ciche podmiany scope.
- `js/app/shared/room-registry-project-sync.js` + `js/app/shared/room-registry-impact.js` — mutacje pokojów (`create/update/remove/manage`) jawnie unieważniają cache rejestru aktywnych pomieszczeń. Dzięki temu po zmianie pokoju lista aktywnych pokoi odświeża się od razu bez ręcznego resetu widoku.
- `js/app/investor/session.js` — dirty tracking sesji jest teraz lżejszy: zamiast polegać głównie na pełnym skanowaniu storage, sesja podsłuchuje `localStorage.setItem/removeItem/clear`, oznacza zmienione klucze od razu i zostawia pełny skan tylko jako bezpieczny fallback. `commit/cancel/persistSession` są wykonywane z wyłączonym śledzeniem własnych zapisów, żeby sesja sama sobie nie robiła fałszywego `dirty`.
- `js/testing/project/tests.js` + `js/testing/investor/tests.js` — dodane antyregresje dla nowego resolvera zakresu pokoi, nowego dirty trackingu sesji oraz jawnego odświeżania cache aktywnych pokoi po mutacji registry.
- `tools/app-dev-smoke.js` + `index.html` + `dev_tests.html` + `tools/index-load-groups.js` — dopięte ładowanie `session.js`, pełnego splitu `room-registry` i nowego `room-scope-resolver.js` w kolejności potrzebnej do realnych testów tego pakietu.
- Zakres świadomie NIE obejmuje przebudowy `Rysunku` ani ogólnego bootstrapu aplikacji; zostały tylko zmiany konieczne dla rdzenia pokoi / statusów / sesji.

## 2026-04-23 — restore stable room/wycena flow + safe cherry-pick only for sets/auto-height
- Baza tej paczki to ostatni wskazany przez użytkownika stabilny ZIP `site_investor_tab_bulk_status_perf_v1.zip`. Świadomie NIE przenoszono późniejszego splitu `app-room-render` ani późniejszych prób napraw room label / wycena routing, bo to właśnie one rozwalały `WYCENA`, nazwy pokoi i przyciski dodawania pomieszczeń.
- Zachowane zostały architektoniczne porządki obecne już w tej stabilnej bazie (`room-registry` hardening, bootstrapy, lazy/warmup ROZRYS, investor perf bulk status). Naprawy po tej bazie zostały cherry-picknięte tylko tam, gdzie były odseparowane od ryzykownego room-flow: `cabinet-modal-set-wizard.js`, `front-hardware.js`, `cabinet-fronts.js`, `shared/calc.js`, `ui/settings-ui.js`.
- Efekt: wraca stabilny przepływ `INWESTOR` / `WYWIAD` / `WYCENA` i poprawne nazwy pomieszczeń z tej bazy, a zostają też późniejsze bezpieczne poprawki: natychmiastowa synchronizacja materiał/kolor frontów zestawu, wspólne fronty i zawiasy tylko na pierwszym korpusie zestawu oraz auto-wysokość liczona dla aktywnego pokoju zamiast stałej kuchni.
- Instrukcja antyregresyjna: jeśli później znowu rozwijamy routing pokoju / `WYCENA` / nazwy pokoi, najpierw porównać zachowanie do tej stabilnej bazy plik-po-pliku. Nie mieszać napraw room-flow z innymi zmianami domenowymi (zestawy, fronty, kalkulacje), bo wtedy trudniej namierzyć regresję.

## 2026-04-22 — room-registry hardening: utils + spójne mutacje + impact contract
- `js/app/shared/room-registry-utils.js` — nowy wspólny helper registry. Trzyma tylko rzeczy powtarzalne i neutralne architektonicznie: `createElement`, `cloneRoomDrafts`, `serializeRoomDrafts`, `mergeRoomCollections`. Dzięki temu te same helpery nie siedzą już osobno w `manage/remove` i w sync warstw danych.
- `js/app/shared/room-registry-impact.js` — utwardzony kontrakt skutków ubocznych. Głównym API skutków usunięcia jest teraz `buildRoomRemovalImpact(...)`, a stary `buildRoomRemovalWarningMessage(...)` jest cienką adaptacją pod wcześniejsze call-site'y. Dodane też czytelniejsze `listRoomRemovalSnapshots(...)` obok kompatybilnego aliasu.
- `js/app/shared/room-registry-project-sync.js` — warstwa mutacji ma teraz spójne operacje `createRoomRecord`, `updateRoomRecord`, `removeRoomByIdDetailed`, `applyManageRoomsDraftDetailed`, które zwracają ujednolicone obiekty wyniku (`ok`, `room`/`roomId`, `rooms`, `project`). Stare metody (`removeRoomById`, `applyManageRoomsDraft`) zostają jako kompatybilne cienkie wrappery.
- `js/app/shared/room-registry-modals-add-edit.js` + `room-registry-modals-manage-remove.js` — warstwa UI nie grzebie już bokiem w `projectData/meta/investors.update`, tylko przechodzi przez API core/project-sync. To uszczelnia granicę UI ↔ domena.
- `js/testing/investor/tests.js` — rozszerzone testy kontraktowe registry: utils, spójna delegacja core, kontrakt create/update/remove i impact po rename/remove pokoju.
- Instrukcja antyregresyjna: przy zmianach w modalu pokoju nie obchodzić architektury bezpośrednim zapisem do `projectData` albo `FC.investors.update`. UI ma używać `roomRegistryCore` / `roomRegistryProjectSync`. Jeśli potrzeba nowego helpera współdzielonego przez kilka warstw registry, najpierw sprawdzić `room-registry-utils.js`, zamiast duplikować go w modalach lub sync. Przy nowych skutkach ubocznych usunięcia/rename najpierw rozwijać `buildRoomRemovalImpact(...)`, a dopiero na końcu adapter komunikatu.

## 2026-04-22 — room-registry core split into foundation + definitions + impact + project-sync
- `js/app/shared/room-registry-foundation.js` — nowa baza rejestru pokoi. Trzyma tylko helpers środowiska/projektu (`projectData`, zapis projektu, meta, current investor, template pokoju), bez normalizacji nazw, bez mutacji room setów i bez ostrzeżeń o skutkach usunięcia.
- `js/app/shared/room-registry-definitions.js` — wydzielona warstwa definicji i odczytu: normalizacja nazw/etykiet, `slug`, wykrywanie aktywnych pomieszczeń, legacy kitchen i porównania nazw. Dzięki temu reguły nazw nie siedzą już w tym samym pliku co mutacje projektu lub usuwanie wycen.
- `js/app/shared/room-registry-impact.js` — osobna warstwa skutków ubocznych: ostrzeżenia przed usunięciem, snapshoty wycen, liczenie szafek, synchronizacja statusów i selekcji po zmianie zbioru pokoi.
- `js/app/shared/room-registry-project-sync.js` — osobna warstwa mutacji projektu/inwestora: tworzenie danych pokoju, zastosowanie draftu listy pokoi, usuwanie pokoju i sync listy pokoi inwestora.
- `js/app/shared/room-registry-core.js` — odchudzony do cienkiej fasady sklejącej foundation + definitions + impact + project-sync. Nie dokarmiać go z powrotem logiką domenową; nowe rzeczy dokładać do właściwej warstwy.
- `index.html` + `dev_tests.html` + `tools/index-load-groups.js` — krytyczna kolejność startupu to teraz: `room-registry-foundation` -> `room-registry-definitions` -> `room-registry-impact` -> `room-registry-project-sync` -> `room-registry-core` -> dalsze warstwy UI registry.
- `js/testing/investor/tests.js` — kontrakt splitu pilnuje istnienia nowych warstw i tego, że `roomRegistryCore` deleguje do definitions / impact / project-sync, zamiast znowu stawać się workiem na wszystko.
- Instrukcja antyregresyjna: jeśli zmiana dotyczy reguł nazw/etykiet lub aktywnego zestawu pokoi, trafia do `room-registry-definitions.js`; jeśli dotyczy zapisów/usuwania/synchronizacji danych projektu lub inwestora, trafia do `room-registry-project-sync.js`; jeśli dotyczy ostrzeżeń, snapshotów wycen albo skutków ubocznych po zmianie zbioru pokoi, trafia do `room-registry-impact.js`. Nie dopisywać tych rzeczy z powrotem do `room-registry-core.js`.

## 2026-04-21 — room-registry modal layer split into add/edit + manage/remove
- `js/app/shared/room-registry-modals-add-edit.js` — nowy moduł trzyma tylko modale dodawania i edycji pojedynczego pomieszczenia. Dzięki temu formularz typu/nazwy i zapis pojedynczego pokoju nie siedzą już w tym samym pliku co zarządzanie całą listą.
- `js/app/shared/room-registry-modals-manage-remove.js` — nowy moduł trzyma modal zarządzania listą pomieszczeń oraz dedykowany modal usuwania. To oddziela pracę na wielu pokojach/draftach od formularza pojedynczego pokoju.
- `js/app/shared/room-registry-modals.js` — odchudzony do cienkiego shell-a, który tylko scala API z dwóch modułów modalnych (`add-edit` oraz `manage-remove`).
- `index.html` + `dev_tests.html` + `tools/index-load-groups.js` — nowa kolejność krytycznych assetów: `room-registry-core` -> `room-registry-modals-add-edit` -> `room-registry-modals-manage-remove` -> `room-registry-modals` -> `room-registry-render` -> `room-registry`.
- `js/testing/investor/tests.js` — kontrakt splitu pilnuje istnienia obu nowych modułów i tego, że shelle `roomRegistryModals` oraz `roomRegistry` delegują do właściwych warstw.
- Instrukcja antyregresyjna: dalsze zmiany formularza pojedynczego pomieszczenia (`Dodaj` / `Edytuj`) dokładać do `room-registry-modals-add-edit.js`, a zmiany zarządzania listą i usuwania do `room-registry-modals-manage-remove.js`. Nie dokarmiać ponownie `room-registry-modals.js` ciężkim UI.

## 2026-04-21 — app-ui-bootstrap fixture-document fix really versioned + bootstrap API now overrides stale namespace
- `js/app/bootstrap/app-ui-bootstrap.js` — helper `getById(...)` dalej wspiera fixture-root bez `getElementById`, ale teraz moduł jawnie nadpisuje `FC.appUiBootstrap.{registerCoreActions,initApp,initUI}` przy załadowaniu zamiast zostawiać stare implementacje pod warunkiem `if(typeof ... !== 'function')`. To usuwa ryzyko, że test runner albo cache utrzyma starą wersję API w namespace i nadal będzie rzucał `doc.getElementById is not a function` mimo poprawionego helpera.
- `index.html` + `dev_tests.html` — podbity query-string dla `app-ui-bootstrap.js` i `js/testing/project/tests.js`, żeby po wdrożeniu nie zostać na starej wersji plików z cache/CDN.
- Instrukcja antyregresyjna: gdy poprawka ma usunąć regresję testów/startupu, zawsze sprawdzić, czy rzeczywiście został podbity cache-busting wszystkich dotkniętych plików. Nie deklarować „podbitej wersji”, jeśli URL assetu pozostał bez zmian.

## 2026-04-21 — startup blank-screen guard for empty shell views
- `js/app/bootstrap/app-ui-bootstrap.js` — po `applyViews(...)` bootstrap sprawdza teraz, czy startup nie schował Startu i nie zostawił pustego shell view (`modeHubView`, `investorsListView`, `serviceOrdersListView`). Jeśli shell jest pusty nawet po próbie dogrania jego renderera, bootstrap odzyskuje bezpieczny ekran `Start`, czyści kontekst entry i zapisuje poprawiony `uiState`, zamiast zostawić użytkownika na pustej stronie.
- `js/testing/project/tests.js` — dodany test antyregresyjny pilnujący, że pusty shell view po restore/startupie wraca do `Start`, a nie zostawia białego ekranu.
- Instrukcja antyregresyjna: przy ekranach-shellach bez własnej statycznej treści (`modeHub`, listy, podobne root-only widoki) bootstrap startu musi mieć recovery do `Start`, jeśli renderer nie narysuje niczego. Nie zostawiać pustych rootów jako „poprawnego” stanu po restore.

## 2026-04-21 — room-registry split: modal layer + render layer
- `js/app/shared/room-registry-modals.js` — nowy moduł modali rejestru pomieszczeń. Trzyma `Dodaj / Edytuj / Usuń / Zarządzaj`, bez logiki core i bez renderu listy widoku.
- `js/app/shared/room-registry-render.js` — osobny moduł renderu kafli `roomsView`. Dzięki temu render pokojów nie siedzi już w tym samym pliku co modale.
- `js/app/shared/room-registry.js` — shell został odchudzony do cienkiego sklejenia API: deleguje core do `room-registry-core`, modale do `room-registry-modals`, a render do `room-registry-render`.
- `index.html` + `dev_tests.html` + `tools/index-load-groups.js` — nowa kolejność krytycznych assetów: `room-registry-core` -> `room-registry-modals` -> `room-registry-render` -> `room-registry`.
- `js/testing/investor/tests.js` — test kontraktowy pilnuje istnienia nowych warstw i tego, że shell deleguje `openManageRoomsModal` oraz `renderRoomsView` do dedykowanych modułów.
- Instrukcja antyregresyjna: nowe modale rejestru pokoi dokładać do `room-registry-modals.js`, nowy DOM/render list widoków do `room-registry-render.js`, a `room-registry.js` zostawić jako cienki shell bez dokładania własnego UI lub logiki danych.

## 2026-04-21 — room-registry split: core + UI shell
- `js/app/shared/room-registry-core.js` — nowy moduł rdzenia rejestru pomieszczeń. Trzyma logikę projektu/meta, normalizację etykiet, wykrywanie aktywnych pomieszczeń, mutacje draftów i usuwanie/synchronizację statusów bez kodu modali.
- `js/app/shared/room-registry.js` — odchudzony shell UI. Zostawia dotychczasowe modale (`dodaj/edytuj/usuń/zarządzaj`) i `renderRoomsView`, ale deleguje logikę danych do `FC.roomRegistryCore`. Dzięki temu `room-registry.js` nie miesza już pełnego core domeny z warstwą UI.
- `index.html` + `dev_tests.html` + `tools/index-load-groups.js` — `room-registry-core.js` jest krytycznym assetem `startup-foundation` i musi być ładowany przed `room-registry.js`.
- `js/testing/investor/tests.js` — dodany kontrakt splitu: core ma istnieć, shell ma zachować publiczne API i delegować `getActiveRoomDefs()` spójnie do core.
- Instrukcja antyregresyjna: nową logikę projektu/normalizacji/usuwania pokoi dokładać do `room-registry-core.js`. Do `room-registry.js` dokładać tylko UI/modale/render powiązane bezpośrednio z DOM. Nie dokarmiać shell-a trzecią odpowiedzialnością.

## 2026-04-21 — Start/home clears project context + fallback bootstrap respects roomless WYCENA
- `js/app/ui/views.js` — przejścia widoków (`openHome/openModeHub/openInvestorsList/openServiceOrdersList/openRooms/openRoom/back`) synchronizują teraz także globalne `uiState`, nie tylko zapis przez `FC.uiState.set(...)`. Dzięki temu po wyjściu do Startu nie zostaje w pamięci stary aktywny kontekst typu `wycena + currentInvestorId`, który mógł później wracać przy reloadzie.
- `js/app/ui/views.js` — `openHome()` czyści też kontekst projektu/inwestora (`currentInvestorId`, `roomType`, `lastRoomType`, `selectedCabinetId`, `showPriceList`) oraz czyści `reload restore` przez `FC.reloadRestore.clear()`. To ma zapobiegać sytuacji, w której Start po odświeżeniu wracał do starego projektu/zakładki.
- `js/app.js` — wystawione jawne API `FC.reloadRestore.{read,clear,persist}`, żeby router/nawigacja mogły świadomie wyczyścić snapshot reloadu przy przejściu na ekrany typu Start/hub, zamiast liczyć tylko na pasywny cleanup w init.
- `js/app/bootstrap/app-ui-bootstrap.js` — fallback bootstrapu rozumie teraz także `roomless WYCENA` (wejście do WYCENA bez wybranego pokoju), więc jeśli główny router widoków nie zadziała, awaryjny fallback pokaże `appView`, a nie `roomsView` z aktywną zakładką WYCENA.
- `js/testing/project/tests.js` — dodane antyregresje dla obu rzeczy: fallback roomless WYCENA oraz `openHome()` czyszczącego kontekst projektu/reload restore.
- Instrukcja antyregresyjna: przy ekranach poza workflow projektu (Start, hub trybów, lista usług) czyścić także kontekst projektu/inwestora i reload snapshot, a nie tylko sam `entry`. Samo przełączenie widoku bez wyczyszczenia kontekstu może później dać pozorny „powrót” do starego projektu po odświeżeniu.

## 2026-04-20 — ROZRYS bootstrap tests accept deferred startup manifest
- `js/testing/rozrys/tests.js` — testy `Bootstrap i splity` dla ROZRYS nie zakładają już, że każdy runtime asset musi siedzieć bezpośrednio w `index.html`. Jeśli asset został świadomie przeniesiony do `js/app/rozrys/rozrys-lazy-manifest.js`, test sprawdza kolejność właśnie w tym deferred entrypoincie.
- `dev_tests.html` — podbity cache-busting dla zaktualizowanego smoke testu ROZRYS, żeby runner nie trzymał starej wersji oczekującej bezpośrednich wpisów w `index.html`.
- Instrukcja antyregresyjna: przy kolejnych splitach startupu nie przywracać ciężkich assetów ROZRYS do `index.html` tylko po to, żeby zadowolić test. Test ma pilnować realnego kontraktu entrypointu (`index.html` albo deferred manifest), a nie zamrażać starą architekturę.

## 2026-04-20 — app.js bootstrap split: state bootstrap + UI bootstrap
- `js/app/bootstrap/app-state-bootstrap.js` — wydzielony bootstrap stanu startowego z `app.js`: składa materiały, stawki, projekt oraz `uiDefaults/uiState` przez jedno jawne API `FC.appStateBootstrap.createInitialState(...)`. Dzięki temu `app.js` nie trzyma już całego ciężkiego bloku bootstrapa danych na wejściu.
- `js/app/bootstrap/app-ui-bootstrap.js` — wydzielona warstwa startu UI z `app.js`: rejestracja core modali/akcji, wejściowy `initApp()` i `initUI()` z restore po reloadzie, bindingami, autosave oraz background warmup ROZRYS. `app.js` zostawia tylko cienkie wrappery przekazujące kontekst i callbacki.
- `index.html` + `tools/index-load-groups.js` — nowe moduły bootstrapu są częścią `app-runtime` i muszą być ładowane przed `js/app.js`; audyt `tools/check-index-load-groups.js` pilnuje tej kolejności.
- `dev_tests.html` + `js/testing/project/tests.js` — dodane kontraktowe testy wydzielonych bootstrapów: pakiet stanu startowego oraz init UI bez zależności od pełnego `app.js`.
- Instrukcja antyregresyjna: nie dopisywać z powrotem ciężkiej logiki startowej do `app.js`. Nowe rzeczy typu initial state / restore / init UI dokładać do wydzielonych bootstrapów, a w `app.js` zostawiać tylko cienkie wrappery i lokalny glue potrzebny reszcie modułów. Traktować `js/app/bootstrap/app-state-bootstrap.js` i `js/app/bootstrap/app-ui-bootstrap.js` jako krytyczne assety startowe — przy zmianach entrypointu zawsze aktualizować też `index.html` i audit load groups.


## 2026-04-20 — ROZRYS background warmup after base startup
- `js/app/rozrys/rozrys-lazy-loader.js` — lazy loader ROZRYS dostał tryb rozgrzewki w tle po starcie (`scheduleWarmup`). Loader czeka na pełne załadowanie strony (`window.load`), potem na krótki delay i idle slot (`requestIdleCallback` z timeoutem), a dopiero wtedy dociąga deferred runtime zakładki ROZRYS. Jeśli użytkownik kliknie zakładkę wcześniej, nadal działa ten sam główny `ensureFeatureLoaded()` bez duplikacji ładowania.
- `js/app/rozrys/rozrys-lazy-loader.js` — dodane bezpieczniki dla słabego łącza: warmup nie startuje automatycznie przy `navigator.connection.saveData` ani dla `2g/slow-2g`. To ma chronić start aplikacji na gorszych urządzeniach/łączach, zamiast ślepo dogrywać ciężki moduł zawsze i wszędzie.
- `js/app.js` — po podstawowym renderze UI (`renderTopHeight()` + `renderCabinets()`) aplikacja planuje background warmup ROZRYS zamiast czekać wyłącznie na pierwszy klik w zakładkę. Dzięki temu pierwszy wejściowy klik w `ROZRYS` powinien zwykle być szybszy, ale krytyczny bootstrap dalej nie jest obciążony pełnym runtime od razu.
- Instrukcja antyregresyjna: background warmup ma tylko dogrywać deferred runtime po starcie podstawy. Nie dokładać do niego ciężkich efektów ubocznych zależnych od aktywnej zakładki ani synchronizacji, które zmieniają stan UI bez wejścia użytkownika w `ROZRYS`.

## 2026-04-20 — Index load groups baseline + audit
- `index.html` — sekcja skryptów dostała jawne grupy ładowania przez `data-load-group` i komentarze bloków (`startup-foundation`, `business-domains`, `ui-shell`, `app-runtime`, `cabinet-wywiad`, `tabs-quote-wycena`, `optimizer-and-stock`, `rozrys-feature`). Kolejność skryptów nie została zmieniona; celem jest uczynienie bootstrapu czytelnym i przygotowanie gruntu pod przyszłe lazy-load / dalsze odchudzanie startu bez zgadywania zależności.
- `tools/index-load-groups.js` — nowe źródło prawdy dla kolejności grup startowych w `index.html`; trzyma ordered listę grup i skryptów bez query-stringów, żeby kolejne splity nie rozjeżdżały ręcznie entrypointu.
- `tools/check-index-load-groups.js` — nowy audyt `index.html`: pilnuje liczby skryptów, dokładnej kolejności oraz zgodności `data-load-group` z configiem. To ma łapać regresje bootstrap/load-order zanim zaczniemy dalej przenosić ciężkie feature'y poza krytyczny start.
- Instrukcja antyregresyjna: przy dodawaniu/przenoszeniu skryptu w `index.html` najpierw dopasować go do jednej z jawnych grup startowych, a potem zaktualizować `tools/index-load-groups.js`. Nie dokładać już „anonimowych” skryptów między blokami, bo to znowu rozmyje load order i utrudni późniejsze lazy-load / split startupu.

## 2026-04-20 — ROZRYS bootstrap/split tests refactor to module contracts
- `js/testing/rozrys/tests.js` — testy `Bootstrap i splity` dla ROZRYS nie pilnują już ciasno snippetów `rozrys.js` typu konkretne `const ... = ...` albo lokalny układ glue. Zamiast tego pilnują load-order assetów oraz kontraktów modułów (`part helpers`, `runtime bundle`, `controller bridges`, `render compose`, `panel workspace`, `output controller`) dostępnych po załadowaniu aplikacji.
- `js/testing/rozrys/tests.js` — zachowania modułów nadal są sprawdzane osobnymi testami kontraktowymi (`Part helpers`, `Runtime bundle`, `Controller bridges`, `Panel workspace`, `Scope helpers`, `Output controller`), więc bootstrap testy nie blokują już sensownego prucia `rozrys.js` tylko dlatego, że zmienił się kształt snippetów.
- `dev_tests.html` — podbity cache-busting dla `js/testing/rozrys/tests.js`.
- Instrukcja antyregresyjna: przy kolejnych splitach ROZRYS najpierw oceniać, czy test pilnuje kontraktu/zachowania czy tylko starego kształtu implementacji. Jeśli test zaczyna zamrażać architekturę bez wartości użytkowej, przepinać go na kontrakt modułów, kolejność ładowania albo rzeczywisty przepływ przez API.

## 2026-04-20 — Inwestor recovery non-destructive read + session snapshot backfill
- `js/app/investor/investors-store.js` — recovery inwestorów przy `readAll()` nie zapisuje już automatycznie odbudowanych szkieletów do `fc_investors_v1`. Dzięki temu awaryjne odczyty z projektów/snapshotów nie nadpisują trwałej listy inwestorów ubogimi rekordami bez telefonu/maila/adresu.
- `js/app/investor/investors-store.js` — `readStoredAll()` robi best-effort merge brakujących pól kontaktowych z `fc_edit_session_v1.snapshot.fc_investors_v1`, jeśli taka sesyjna migawka istnieje. To daje szansę odzyskać telefon/mail/adres dla tych samych `investorId` bez zgadywania i bez ruszania innych danych.
- `index.html` + `dev_tests.html` — podbity cache-busting dla `investors-store.js`.
- Instrukcja antyregresyjna: `readAll()` w store inwestorów nie może mieć efektu ubocznego zapisującego zrekonstruowane szkielety jako nowy stan źródłowy. Recovery ma pomagać w odczycie, a nie utrwalać stratę pól kontaktowych zubożonym fallbackiem z projektów/snapshotów.

## 2026-04-20 — ROZRYS runtime bundle split (plan/output/run assembler)
- `js/app/rozrys/rozrys-runtime-bundle.js` — nowy moduł assemblera runtime ROZRYS. Składa trzy czułe odnogi `render()` bez ruszania bootstrap orderu: `createPlanHelpers(...)`, `createOutputController(...)` i `createRunController(...)`. To jest bezpieczny split warstwy spinającej plan/cache/output/run, a nie split pickerów albo agregacji.
- `js/app/rozrys/rozrys.js` — nie trzyma już lokalnego bridge/fallback bloku dla `rozrysPlanHelpers`, `rozrysRunController` i `rozrysOutputController`, ani ręcznego składania controllerów przez osobne API. Render nadal zachowuje lokalne hoistowane fasady (`tryAutoRenderFromCache`, `buildEntriesForScope`, `splitMaterialAccordionTitle`, `createMaterialAccordionSection`, `renderOutput`, `renderLoadingInto`) oraz kolejność `outputCtrl` -> `runCtrl`.
- `js/testing/rozrys/tests.js` — dodane testy antyregresyjne dla nowego runtime bundle i rozszerzone testy load-order: `rozrys-runtime-bundle.js` ma być ładowany przed `rozrys.js`, a `rozrys.js` ma składać plan helpers / output / run przez `runtimeBundleApi`, nie wracać do lokalnego `runControllerApi` / `outputControllerApi`.
- `index.html` + `dev_tests.html` + `tools/rozrys-dev-smoke.js` + `tools/app-dev-smoke.js` — dopięte ładowanie nowego modułu i podbity cache-busting.
- Instrukcja antyregresyjna: kolejne duże splity w `rozrys.js` robić od strony assemblerów runtime i warstw spinających, zostawiając lokalnie tylko hoistowane fasady potrzebne selection/bootstrapowi. Nie przenosić `tryAutoRenderFromCache` / `splitMaterialAccordionTitle` / `buildEntriesForScope` do późno wiązanych `const`, jeśli bootstrap pickerów albo plan helpers potrzebują tych callbacków wcześniej.

## 2026-04-20 — Inwestor recovery test-isolation guard for empty list
- `js/app/investor/investors-store.js` — recovery pustej listy inwestorów nadal odbudowuje dane z normalnych snapshotów/projektów w realnym użyciu, ale jeśli w storage leżą jawne rekordy testowe recovery (`meta.testData` lub `test-*` source), recovery preferuje wyłącznie te testowe źródła zamiast mieszać do wyniku stare zwykłe snapshoty użytkownika.
- `js/testing/investor/tests.js` — dodany antyregres pod mieszany scenariusz: pusta lista inwestorów + zwykły snapshot użytkownika + testowy snapshot recovery ma zwrócić tylko rekord testowy.
- `index.html` + `dev_tests.html` — podbity cache-busting dla `investors-store.js` i testów inwestora.
- Instrukcja antyregresyjna: przy recovery pustej listy rozróżniać realny awaryjny odzysk danych od izolowanych testów. Jeśli w storage są jawne rekordy testowe recovery, nie wolno mieszać do wyniku zwykłych historycznych snapshotów użytkownika, bo rozwala to deterministykę testów i maskuje prawdziwe wyniki.

## 2026-04-20 — Inwestor recovery scope guard + snapshot label guard
- `js/app/investor/investors-store.js` — recovery inwestorów zostało zawężone dla list niepustych: przy normalnym `readAll()` nie zasysa już dowolnych historycznych projektów/snapshotów do istniejącej listy inwestorów. Dla list niepustych odzysk działa tylko dla jawnych rekordów test/recovery (`meta.testData` lub `meta/source` zaczynające się od `test-`), co zatrzymuje brudzenie izolacyjnych testów usług/projektów przez stare dane użytkownika.
- `js/app/quote/quote-snapshot-store.js` — przy budowie kanonicznego scope snapshot zachowuje już przekazane `roomLabels` bez niepotrzebnego pytania `roomRegistry` o etykietę, jeśli jawna etykieta już istnieje. To usuwa boczną ścieżkę `quoteSnapshotStore.writeAll() -> roomRegistry -> investors.readAll()` która potrafiła odpalić recovery inwestorów w trakcie samego zapisu snapshotu.
- `index.html` + `dev_tests.html` — podbity cache-busting dla `investors-store.js` i `quote-snapshot-store.js`.
- Instrukcja antyregresyjna: store inwestorów nie może samorzutnie „dosysać” historycznych inwestorów do już istniejącej listy podczas obcych testów/flow (np. usługi). A snapshoty z jawnymi `roomLabels` nie powinny przy zapisie odpalać live odczytu etykiet z `roomRegistry`, bo to miesza zależności i może uruchomić recovery store'ów bokiem.

## 2026-04-20 — Inwestor emergency recovery from projectStore / quote snapshots
- `js/app/investor/investors-store.js` — dodany pakiet ratunkowy przy odczycie listy inwestorów: jeśli w `fc_investors_v1` brakuje rekordów, store odbudowuje brakujących inwestorów z `projectStore` i/lub `quoteSnapshotStore`, bez kasowania istniejących wpisów. Recovery zbiera też pokoje z `projectData.meta.roomDefs`, `roomOrder` oraz exact-scope snapshotów.
- `js/app/investor/investors-store.js` — dodane lekkie tombstone `KEY_REMOVED`, żeby celowo usunięty inwestor nie wracał od razu z historycznych snapshotów po zwykłym `remove(id)`.
- `js/testing/investor/tests.js` — dodane dwa antyregresy dokładnie pod recovery listy: (1) brakujący stary rekord wraca obok istniejącego nowego wpisu, (2) pusta lista odbudowuje się z samych snapshotów ofert.
- `index.html` + `dev_tests.html` — podbity cache-busting dla `investors-store.js` i testów inwestora.
- Instrukcja antyregresyjna: przy przyszłych zmianach store inwestorów traktować `projectStore` i `quoteSnapshotStore` jako źródła awaryjnej rekonstrukcji listy, ale nie wolno przez recovery wskrzeszać rekordów usuniętych świadomie przez użytkownika.

## 2026-04-19 — ROZRYS scope/material API consolidation split
- `js/app/rozrys/rozrys-scope.js` — dodane `createApi(...)`, które wiąże live zależności (`getRooms`, `aggregatePartsForProject`, `splitMaterialAccordionTitle`) i zwraca gotowe bound helpery scope/material dla `ROZRYS`. Surowe funkcje modułu nadal istnieją dla innych działów (`Wycena`, snapshoty, store), ale `ROZRYS` nie musi już trzymać własnych lokalnych wrapperów do tych samych helperów.
- `js/app/rozrys/rozrys.js` — usunięty lokalny blok wrapperów `roomLabel/normalizeRoomSelection/encode/decode/makeMaterialScope/...`; teraz czyta bound `scopeApi` z `FC.rozrysScope.createApi(...)`. W `render()` `getScopeSummary/getRoomsSummary` też są już związane przez `renderScopeApi` zamiast lokalnych funkcji delegujących.
- `js/testing/rozrys/tests.js` — dodane antyregresje dla `rozrysScope.createApi(...)` oraz rozszerzony test bootstrap/load-order: `rozrys-scope.js` ma się ładować przed `rozrys.js`, a `rozrys.js` nie może wracać do lokalnych wrapperów scope/material.
- `index.html` + `dev_tests.html` — podbity cache-busting dla `rozrys-scope.js` i `rozrys.js`.
- Instrukcja antyregresyjna: kolejne splity scope/material w `ROZRYS` robić przez rozwijanie `rozrys-scope.js` i jego `createApi(...)`, a nie przez dokładanie nowych lokalnych wrapperów w `rozrys.js`. Szczególnie helpery zależne od live `getRooms` lub live `aggregatePartsForProject` mają być wiązane przez bound API, żeby selection/cache/generate dalej czytały ten sam aktualny stan.

## 2026-04-19 — ROZRYS panel/workspace split (options + action/status host)
- `js/app/rozrys/rozrys-panel-workspace.js` — wydzielony większy blok panelu roboczego ROZRYS: hidden controls opcji (`unitSel`, `edgeSel`, `inW/inH`, `inK`, `inTrim`, `inMinW/inMinH`), compact choice launchery `heurSel/dirSel`, action row (`Opcje`, `Dodaj płytę`, `Generuj rozkrój`), status/progress host i `out`. Moduł zwraca live refsy oraz helpery `persistOptionPrefs`, `applyUnitChange`, `getBaseState`.
- `js/app/rozrys/rozrys.js` — nie trzyma już lokalnie dużego bloku panelu opcji/workspace; tylko składa `panelWorkspaceApi.createWorkspace(...)` i przekazuje zwrócone refsy/helpery dalej do `selectionUi`, `outputCtrl` i `runCtrl`. Nie były ruszane: bootstrap/selection launcherów `Pomieszczenia` i `Materiał / grupa`, `resolveInitialSelectedRooms`, `aggregatePartsForProject`, room-registry i `rysunek`.
- `js/testing/rozrys/tests.js` — dodane antyregresje dla nowego modułu: live getter `selectedRooms/materialScope` w `persistOptionPrefs`, delegacja `getBaseState()` do `rozrysState.buildBaseStateFromControls` oraz load order `rozrys-panel-workspace.js` przed `rozrys.js`.
- `index.html` + `dev_tests.html` + `tools/app-dev-smoke.js` + `tools/rozrys-dev-smoke.js` — dopięte ładowanie nowego modułu przed `rozrys.js`, podbity cache-busting i asset source do smoke.
- Instrukcja antyregresyjna: przy kolejnych splitach w `render()` nie wycinać pojedynczych helperów opcji osobno. Panel/workspace musi pozostać jednym spójnym modułem z live refami, bo `runCtrl`, `outputCtrl` i bootstrap selection czytają te same elementy/values w różnych momentach.

## 2026-04-19 — ROZRYS output controller hoist/bootstrap hotfix
- `js/app/rozrys/rozrys.js` — output controller nadal jest wydzielony, ale helpery używane już podczas bootstrapu `render()` (`tryAutoRenderFromCache`, `buildEntriesForScope`, `splitMaterialAccordionTitle`, `createMaterialAccordionSection`, `renderMaterialAccordionPlans`, `renderOutput`, `renderLoadingInto`) wróciły jako hoistowane funkcje-fasady. Dzięki temu `selectionUi.createController(...)` i `rozrysPlanHelpers.createApi(...)` dostają callable helpery już w momencie tworzenia controllerów, zamiast wpadać w TDZ/późne bindowanie `const outputCtrl = ...`.
- `js/testing/rozrys/tests.js` — test load-order/output-controller pilnuje teraz nie tylko samego `createController`, ale też obecności hoistowanych fasad helperów output/cache w `rozrys.js`, bo to właśnie brak hoistingu rozwalał bootstrap launcherów `Pomieszczenia` / `Materiał / grupa`.
- `index.html` + `dev_tests.html` — podbity cache-busting dla `rozrys-output-controller.js`, `rozrys.js` i smoke testów.
- Instrukcja antyregresyjna: jeśli helper z `rozrys.js` jest używany przez `selectionUi` albo `planHelpers` jeszcze przed pełnym złożeniem controllerów w `render()`, po splicie musi pozostać hoistowaną funkcją-fasadą albo równoważnie wcześnie dostępnym API. Nie zamieniać takich helperów na późno przypisane `const`, jeśli bootstrap już ich potrzebuje.

## 2026-04-19 — ROZRYS output controller split (output/render/cache path)
- `js/app/rozrys/rozrys-output-controller.js` — wydzielony większy controller ścieżki wyników `ROZRYS`: przejął `tryAutoRenderFromCache`, `buildEntriesForScope`, `splitMaterialAccordionTitle`, `createMaterialAccordionSection`, `renderMaterialAccordionPlans`, `renderOutput` i `renderLoadingInto`. To jest jedna spójna warstwa output/render/cache zamiast kolejnego mikro-helpera.
- `js/app/rozrys/rozrys.js` — po splicie nie trzyma już lokalnie całego bloku wyników/cache; tylko składa `outputCtrl` i czyta z niego metody używane przez selection glue i run controller. Nie były ruszane: bootstrap launcherów `Pomieszczenia` / `Materiał / grupa`, `aggregatePartsForProject`, `resolveInitialSelectedRooms`, wejście do zakładki ani `generate()`.
- `js/testing/rozrys/tests.js` — dodane antyregresje dla nowego controllera: kontrakt cache/render/accordion, load order nowego modułu przed `rozrys.js` oraz bezpieczny fallback `createController` w samym `rozrys.js`.
- `tools/rozrys-dev-smoke.js` + `tools/app-dev-smoke.js` + `index.html` + `dev_tests.html` — dopięte ładowanie i asset source nowego modułu do smoke i produkcji.
- Instrukcja antyregresyjna: przy ścieżce output/render/cache sprawdzać nie tylko główny tor `renderOutput`, ale też odnogi współbieżne: `tryAutoRenderFromCache`, accordion callbacki (`renderOutput`, `tryAutoRenderFromCache`) oraz render z pustego stanu. To jest jeden controller z rozgałęzieniami, nie kilka niezależnych helperów.


## 2026-04-19 — ROZRYS run controller split (progress/generate/add-stock glue)
- `js/app/rozrys/rozrys-run-controller.js` — wydzielony controller akcji ROZRYS: most do `rozrysProgress`, `rozrysRunner` i modala `Dodaj płytę`. Przejął `createProgressApi` glue, `generate(force)` oraz `openAddStockModal()`, ale nie dotyka pickerów, scope, `aggregatePartsForProject`, `resolveInitialSelectedRooms` ani bootstrapu launcherów.
- `js/app/rozrys/rozrys.js` — po splicie tylko tworzy `runCtrl` i używa zwróconych metod (`setGenBtnMode`, `requestCancel`, `isRozrysRunning`, `getRozrysBtnMode`, `generate`, `openAddStockModal`). Eventy launcherów `Pomieszczenia` / `Materiał / grupa` oraz selection glue pozostają lokalnie bez zmian.
- `js/testing/rozrys/tests.js` — dodane antyregresje dla kontraktu run controllera: pełny payload `progressCtrl` / `agg` / wartości kontrolek do `rozrysRunner.generate`, ctx/deps do `Dodaj płytę` i load order nowego modułu przed `rozrys.js`.
- Instrukcja antyregresyjna: przy kolejnych splitach action/run najpierw rozpisywać dwie odnogi użycia `agg`: (1) `generate()` -> runner/engine, (2) `Dodaj płytę` -> modal magazynu. To jest współdzielony punkt i nie wolno przenosić go lokalnie „jak jednego helpera”, bo obie ścieżki muszą dalej czytać ten sam aktualny aggregate w czasie kliknięcia.
## 2026-04-19 — ROZRYS part helpers split (cutlist/source/rotation adapters)
- `js/app/rozrys/rozrys-part-helpers.js` — wydzielone helpery części używane przez agregację, engine i plan helpers: `resolveCabinetCutListFn`, `resolveRozrysPartFromSource`, `materialPartDirectionLabel`, `isPartRotationAllowed`, `isFrontMaterialKey`, `normalizeFrontLaminatMaterialKey`. To jest blok techniczny bez wpływu na bootstrap launcherów ani start renderu `ROZRYS`.
- `js/app/rozrys/rozrys.js` — zamiast trzymać lokalne implementacje helperów części czyta je z `FC.rozrysPartHelpers.createApi(...)`; reszta ścieżek wysokiego ryzyka (`aggregatePartsForProject`, pickery, launchery, render startowy, generate) pozostaje funkcjonalnie bez zmian.
- `js/testing/rozrys/tests.js` — dodane antyregresje pilnujące kontraktu helperów części oraz load order nowego modułu przed `rozrys.js`.
- `index.html` + `dev_tests.html` + `tools/*smoke.js` — dopięte ładowanie `rozrys-part-helpers.js` i asset source do smoke.
- Instrukcja antyregresyjna: przy splitach helperów domenowych, które są używane równocześnie przez agregację, plan helpers i engine bridge, najpierw porównać starą listę wywołań 1:1 (kto bierze cutlist, kto resolve part, kto pyta o rotation), a dopiero potem wynosić moduł. Nie mieszać tego z bootstrapem UI launcherów.

## 2026-04-19 — ROZRYS UI bridge smoke test hotfix v2
- `js/testing/rozrys/tests.js` — test dla `rozrysUiTools.labelWithInfo(...)` przestał polegać wyłącznie na jednym helperze `collectNodes(...)`. Najpierw próbuje znaleźć `.info-trigger` przez `querySelector`, potem przez bezpośrednie `children`, a dopiero na końcu przez rekurencyjne `collectNodes`. Dzięki temu smoke nie zgłasza fałszywego błędu przy działającym programie, gdy środowisko testowe inaczej wystawia dzieci węzła.
- `dev_tests.html` — podbity query string dla `js/testing/rozrys/tests.js`, żeby po wdrożeniu nie trzymał starej wersji smoke testu w cache.
- Instrukcja antyregresyjna: jeśli test helpera UI ma sprawdzać obecność elementu w DOM, najpierw używać natywnego `querySelector`/`children`, a dopiero później własnych helperów rekurencyjnych. Przy dobrym programie nie wolno utrzymywać czerwonego smoke tylko dlatego, że selektor testowy jest zbyt kruchy.

## 2026-04-19 — ROZRYS UI bridge split (ui tools + modal/progress adapters)
- `js/app/rozrys/rozrys-ui-tools.js` — wydzielone lekkie helpery UI ROZRYS: `h`, `labelWithInfo`, `openRozrysInfo`, `getSelectOptionLabel`, `setChoiceLaunchValue`, `createChoiceLauncher`, `openRozrysChoiceOverlay`, `askRozrysConfirm`. To jest tylko warstwa delegacji do `infoBox` / `panelBox` / `confirmBox` / `rozrysChoice`; nie dotyka scope ani logiki generowania.
- `js/app/rozrys/rozrys-ui-bridge.js` — wydzielony techniczny bridge dla `rozrys-options-modal`, `rozrys-stock-modal` i `rozrys-progress`: `openOptionsModal`, `openAddStockModal`, `createProgressApi`. `ROZRYS` dalej zachowuje stare payloady ctx/deps 1:1, ale nie trzyma już lokalnie bloku wrapperów modal/progress.
- `js/app/rozrys/rozrys.js` — odchudzony o helpery UI i wrappery modal/progress; wysokiego ryzyka ścieżki (`aggregatePartsForProject`, pickery, start renderu, `generate`) nie były zmieniane funkcjonalnie.
- `js/testing/rozrys/tests.js` — dodane antyregresje: (1) `rozrysUiTools` dalej buduje `labelWithInfo` z `info-trigger` i deleguje confirm przez `confirmBox`, (2) `rozrysUiBridge` dalej przekazuje 1:1 payload do `rozrys-options-modal` / `rozrys-stock-modal` i utrzymuje kontrakt `progress -> uiState`.
- `index.html` + `dev_tests.html` + `tools/app-dev-smoke.js` + `tools/rozrys-dev-smoke.js` — dopięte ładowanie `rozrys-ui-tools.js` i `rozrys-ui-bridge.js` przed `rozrys.js`.
- Instrukcja antyregresyjna: przy kolejnych splitach wrapperów UI nie przenosić tylko samej funkcji klikanej lokalnie. Najpierw porównać stary i nowy payload `ctx/deps` 1:1 dla modali/controllerów oraz sprawdzić, czy bridge nadal zapisuje `uiState` w tych samych momentach (`setGenBtnMode`, `isRozrysRunning`, `requestCancel`).

## 2026-04-19 — ROZRYS engine bridge split (engine + sheet-draw adapters)
- `js/app/rozrys/rozrys-engine-bridge.js` — wydzielony techniczny bridge dla delegacji do `rozrysEngine` i `rozrysSheetDraw`: `computePlan`, `getOptimaxProfilePreset`, `normalizeCutDirection`, `speedLabel`, `directionLabel`, `formatHeurLabel`, `computePlanPanelProAsync`, `drawSheet`, `scheduleSheetCanvasRefresh`.
- `js/app/rozrys/rozrys.js` — dalej trzyma wejście do zakładki, scope, pickery, start renderu, `tryAutoRenderFromCache` i `generate`, ale nie trzyma już lokalnie bloku delegacji engine/draw. Wysokiego ryzyka ścieżki (`aggregatePartsForProject`, launchery, start renderu, `generate`) nie były zmieniane funkcjonalnie.
- `js/testing/rozrys/tests.js` — dodane antyregresje dla nowego bridge: `computePlan` nadal przekazuje 1:1 `loadEdgeStore / partSignature / isPartRotationAllowed / cutOptimizer`, a scheduler canvasów nadal dostaje działający helper `drawSheet` z `mmToUnitStr`.
- `index.html` + `dev_tests.html` + `tools/app-dev-smoke.js` + `tools/rozrys-dev-smoke.js` — dopięte ładowanie `rozrys-engine-bridge.js` przed `rozrys.js`.
- Instrukcja antyregresyjna: przy kolejnych splitach adapterów render/engine porównywać nie tylko wynik końcowy, ale też payload przekazywany do delegowanych modułów (`deps` dla `rozrysEngine`, helpery dla `rozrysSheetDraw`). To są ścieżki techniczne, które łatwo zepsuć bez widocznego błędu składni.

## 2026-04-19 — ROZRYS grain exceptions modal hotfix after plan helper split
- `js/app/rozrys/rozrys-plan-helpers.js` — przy delegacji `openMaterialGrainExceptions(...)` wrócił brakujący helper DOM `h` w payloadzie przekazywanym do `rozrys-grain-modal`. Po splicie plan helpers modal reagował na klik, ale nie otwierał się, bo próbował budować DOM bez `ctx.h`.
- `js/app/rozrys/rozrys.js` — `createApi(...)` dla `rozrys-plan-helpers` znowu przekazuje `h`, tak jak w starej ścieżce przed splitem.
- `js/testing/rozrys/tests.js` — test dla modala wyjątków słojów pilnuje już nie tylko `unitValue` i callbacku refresh, ale też obecności działającego helpera DOM `h`.
- Instrukcja antyregresyjna: przy splitach helperów modalowych porównywać payload przekazywany do modala 1:1 ze starą ścieżką, nie tylko listę helperów biznesowych. Brak `h` może nie wyjść w smoke, ale rozwala realne otwieranie modala.

## 2026-04-19 — ROZRYS plan helpers split (stock/grain/cache adapter block)
- `js/app/rozrys/rozrys-plan-helpers.js` — wydzielony techniczny adapter planu ROZRYS: delegacje do `rozrys-stock`, `rozrys-cache`, `rozrys-engine` i `rozrys-grain-modal` dla helperów magazynu/formatów, grain exceptions oraz cache key (`getRealHalfStockForMaterial`, `toMmByUnit`, `getDefaultRozrysOptionValues`, `buildStockSignatureForMaterial`, `getExactSheetStockForMaterial`, `getLargestSheetFormatForMaterial`, `applySheetStockLimit`, `materialHasGrain`, `openMaterialGrainExceptions`, `loadPlanCache`, `savePlanCache`, `makePlanCacheKey` itd.).
- `js/app/rozrys/rozrys.js` — dalej trzyma wejście do zakładki, scope, pickery, start renderu, `tryAutoRenderFromCache` i `generate`, ale nie trzyma już lokalnie dużego bloku delegacji stock/cache/grain. Wysokiego ryzyka ścieżki (`aggregatePartsForProject`, launchery, startowy render, `generate`) nie były zmieniane funkcjonalnie.
- `js/testing/rozrys/tests.js` — dodane testy antyregresyjne dla nowego modułu: cache key nadal dostaje ten sam kontrakt helperów, a modal wyjątków słojów dostaje bieżącą jednostkę i callback refresh. Usunięty zaległy smoke test dla niewdrożonej notki pustego pokoju, żeby runner nie raportował fałszywej regresji po cofnięciu tamtego pomysłu.
- `index.html` + `dev_tests.html` + `tools/app-dev-smoke.js` + `tools/rozrys-dev-smoke.js` — dopięte ładowanie `rozrys-plan-helpers.js` przed `rozrys.js`.
- Instrukcja antyregresyjna: kolejne splity `ROZRYS` dalej prowadzić tylko przez techniczne adaptery/delegacje. Nie ruszać razem z nimi scope, pickerów, launcherów ani ścieżki `generate`, dopóki nie ma osobno rozpisanej mapy starych i nowych przebiegów.

## 2026-04-19 — ROZRYS runtime utils split (diagnostics + export/print helpers)
- `js/app/rozrys/rozrys-runtime-utils.js` — wydzielone techniczne helpery ROZRYS, które nie sterują wejściem do zakładki ani wyborem pokoju: `buildResolvedSnapshotFromParts`, `buildRawSnapshotForMaterial`, `buildRozrysDiagnostics`, `validationSummaryLabel`, `openValidationListModal`, `openSheetListModal`, `buildCsv`, `downloadText`, `openPrintView`, `pxToMm`, `measurePrintHeaderMm`.
- `js/app/rozrys/rozrys.js` — zostaje orchestrator-em; ścieżki wysokiego ryzyka (`resolveInitialSelectedRooms`, `aggregatePartsForProject`, pickery, start renderu, generate`) nie były ruszane. Stary przepływ `renderOutput -> buildRozrysDiagnostics/summary/listy/druk` został zachowany 1:1 przez delegację do `runtimeUtils`.
- `js/testing/rozrys/tests.js` — dodane testy dla wydzielonego runtime: RAW snapshot nadal filtruje exact pokój + scope fronty/korpusy, a diagnostyka dalej przechodzi przez summary z helperami snapshotów.
- `index.html` + `dev_tests.html` + `tools/app-dev-smoke.js` + `tools/rozrys-dev-smoke.js` — dopięte ładowanie nowego modułu przed `rozrys.js`.
- Instrukcja antyregresyjna: przy dalszym cięciu `ROZRYS` najpierw rozpisywać starą ścieżkę wywołań, a do pierwszych splitów wybierać tylko helpery techniczne bez wpływu na scope, launchery i startowy render panelu.

## 2026-04-19 — ROZRYS room-context scope guard over stale global prefs
- `js/app/rozrys/rozrys.js` — start ROZRYS w kontekście pokoju (`uiState.roomType`) bierze teraz exact bieżący pokój jako wejściowy scope, zamiast odziedziczyć stary globalny `selectedRooms` z poprzednio otwartego pokoju. Dzięki temu fix exact-scope nie zeruje ROZRYS dla pokoju z szafkami tylko dlatego, że w prefs został pusty pokój otwarty wcześniej.
- `js/testing/rozrys/tests.js` — dodany test pilnujący, że stale zapisany scope innego pokoju nie może nadpisać bieżącego roomType przy starcie ROZRYS.
- Instrukcja antyregresyjna: przy wejściu do działu w kontekście konkretnego pokoju nie ufać bezwarunkowo globalnym prefs zakresu pokoi. Najpierw ustalić bieżący room context z `uiState`, a dopiero potem stosować zapisany scope jako fallback poza kontekstem pokoju.

## 2026-04-19 — Exact room scope guard for empty room in ROZRYS/WYCENA
- `js/app/rozrys/rozrys.js` — naprawiony centralny fallback agregacji: jeśli użytkownik wybiera istniejący pokój/exact scope i ten pokój nie ma szafek, ROZRYS nie może już po cichu rozszerzać zakresu do innych pokoi projektu. Retry do pełnej listy pokoi wolno robić tylko wtedy, gdy wejściowy wybór pokoi realnie znormalizował się do pustego scope (np. stary/nieistniejący zapis).
- `js/testing/rozrys/tests.js` — dodany test pilnujący, że pusty, ale istniejący pokój zostaje pusty i nie pożycza materiałów z innego pokoju.
- `js/testing/wycena/suites/cross-systems.js` — dodany test pilnujący, że Wycena dla takiego exact scope kończy się `empty_quote_scope`, a nie ofertą policzoną z obcego pokoju.
- Instrukcja antyregresyjna: przy scope pokoi rozróżniać dwa przypadki: (1) exact room istnieje, ale nie ma danych — wynik ma zostać pusty; (2) zapisany wybór jest nieprawidłowy/stary i po normalizacji znika — dopiero wtedy można retryować pełną listę realnych pokoi projektu.

## 2026-04-19 — Wywiad standing extras split into corner/standard + specials
- `js/app/cabinet/cabinet-modal-standing-corner-standard.js` — wydzielone z dużego `cabinet-modal-standing-extras.js` rzeczy narożno-standardowe: `narozna_l` (GL/GP/ST/SP + szkic) oraz blok `standardowa / rogowa_slepa / narozna_l`.
- `js/app/cabinet/cabinet-modal-standing-specials.js` — wydzielone subtype’y specjalne `stojąca`: `szuflady`, `zlewowa`, `zmywarkowa`, `lodowkowa`, `piekarnikowa`, razem z ostrzeżeniem systemowym dla GTV/Rejs.
- `js/app/cabinet/cabinet-modal-standing-extras.js` — zostaje cienkim routerem API zgodnym z dotychczasowym kontraktem; tylko deleguje do dwóch nowych modułów.
- `index.html` + `dev_tests.html` + `tools/app-dev-smoke.js` — dopięte nowe pliki do realnego ładowania aplikacji i smoke runnera.
- Instrukcja antyregresyjna: przy kolejnych zmianach `stojąca` nie dokładać wszystkiego do jednego `standing-extras`. Rzeczy narożne/standardowe trzymać w `cabinet-modal-standing-corner-standard.js`, a subtype’y specjalne w `cabinet-modal-standing-specials.js`.

## 2026-04-19 — Wywiad standing split into smaller technical modules
- `js/app/cabinet/cabinet-modal-standing-extras.js` — wydzielone ciężkie renderery subtype'ów `stojąca`: narożna L (wymiary + szkic), szuflady, zlewowa, zmywarkowa, lodówkowa, piekarnikowa oraz blok `standardowa / rogowa_slepa / narozna_l`, bez zmiany UI i bez zmiany logiki pól.
- `js/app/cabinet/cabinet-modal-standing-front-controls.js` — wydzielone sterowanie `frontCount`/hintami/półkami dla typu `stojąca` oraz efekt zmiany subtype `zmywarkowa`.
- `js/app/cabinet/cabinet-modal-standing.js` — zostaje cienkim adapterem rodziny `stojąca`; tylko deleguje render extra details, konfigurację front controls i hook po zmianie subtype do dwóch nowych modułów.
- `index.html` + `dev_tests.html` + `tools/app-dev-smoke.js` — dopięte nowe pliki do realnego ładowania aplikacji i smoke runnera.
- Instrukcja antyregresyjna: przy kolejnych zmianach subtype'ów `stojąca` nie rozrastać znowu `cabinet-modal-standing.js`; nowe pola/render wrzucać do `cabinet-modal-standing-extras.js`, a logikę sterowania frontami / hooki subtype do `cabinet-modal-standing-front-controls.js`.

## 2026-04-19 — Wywiad finalize/save split from cabinet modal
- `js/app/cabinet/cabinet-modal-finalize.js` — wydzielona finalizacja zwykłej szafki: sync draftu z formularza, walidacja Aventosa, rozróżnienie add/edit, zapis do `projectData`, persist `project/ui`, odświeżenie listy i zamknięcie modala. Tryb `zestaw` pozostaje obsługiwany przez delegację do `cabinet-modal-set-wizard.js`.
- `js/app/cabinet/cabinet-modal.js` — orchestrator nie trzyma już lokalnie dużego bloku zapisu z przycisku `Dodaj / Zapisz zmiany`; binduje top save przez moduł finalizacji.
- `js/testing/cabinet/tests.js` + `tools/app-dev-smoke.js` — dodane antyregresje dla zapisu dodawanej i edytowanej szafki oraz dopięte do node smoke brakujące moduły `set-wizard / standing / hanging / module / finalize`, żeby runner wykonywał realny stan `Wywiadu`, a nie okrojoną wersję bez splitów.
- Instrukcja antyregresyjna: dalszy zapis zwykłej szafki rozwijać w `cabinet-modal-finalize.js`, nie wrzucać z powrotem do `cabinet-modal.js`. Orchestrator ma tylko spinać tryb, render i delegację do finalizacji.

## 2026-04-19 — Wywiad fridge launcher regression real fix
- `js/app/cabinet/cabinet-modal.js` — naprawiony realny błąd fallbacku dla legacy/test fixture lodówkowej: wcześniejszy fallback po `subType` był martwy, bo `getCabinetModalTypeApi(...)` najpierw bezwarunkowo ufał `type`. Teraz warstwa UI sprawdza zgodność `type` z dozwolonymi subtype’ami danej rodziny i tylko gdy `subType` jednoznacznie należy do innej rodziny (`lodowkowa`, `zlewowa`, `zmywarkowa`, `piekarnikowa`, `dolna_podblatowa`), deleguje render do właściwego modułu typu.
- `index.html` + `dev_tests.html` — podbity cache-busting `cabinet-modal.js`, żeby przeglądarka nie trzymała starej wersji z martwym fallbackiem.
- Instrukcja antyregresyjna: przy legacy/test danych z niespójnym `type`/`subType` nie wystarczy fallback „gdy type jest pusty”. Najpierw sprawdzić, czy wskazany `type` w ogóle posiada dany `subType`; dopiero potem można bezpiecznie użyć wąskiego fallbacku po jednoznacznym `subType`, wyłącznie dla warstwy UI/renderu.

## 2026-04-19 — Wywiad lodówkowa niche restore + legacy dynamic renderer fallback
- `js/app/cabinet/cabinet-modal-standing.js` — przywrócona pełna lista wysokości niszy lodówkowej z wcześniejszej wersji (`82`, `122`, `158`, `178`, `194`, `204`) oraz dawny wariant opcji lodówki wolnostojącej (`Brak`, `Podest`, `Obudowa`), bez zmiany logiki wyliczeń lodówkowej.
- `js/app/cabinet/cabinet-modal.js` — `renderCabinetExtraDetailsInto(...)` ma wąski fallback antyregresyjny dla jednoznacznych subtype'ów (`zlewowa`, `zmywarkowa`, `lodowkowa`, `piekarnikowa`, `dolna_podblatowa`), więc legacy/test fixture z niezgodnym `type` nie traci dynamicznych selectów i launcherów.
- `js/testing/cabinet/tests.js` — dodany test pilnujący, że lodówkowa nie gubi wysokich nisz po refaktorze typów.
- Instrukcja antyregresyjna: przy kolejnych porządkach `Wywiadu` nie zakładać, że sam `type` w test fixture/legacy danych zawsze jest poprawny. Dla renderu dynamicznych pól można stosować tylko wąski fallback dla subtype'ów jednoznacznie należących do jednej rodziny, bez rozlewania tego na logikę biznesową.

## 2026-04-19 — Wywiad type split: standing / hanging / module
- `js/app/cabinet/cabinet-modal-standing.js` — wydzielona logika typu `stojąca`: dodatkowe pola subtype'ów (`szuflady`, `zlewowa`, `zmywarkowa`, `lodowkowa`, `piekarnikowa`, `standardowa`, `rogowa_slepa`, `narozna_l`), konfiguracja frontCount UI i reakcja na zmianę subtype bez zmiany zachowania modala.
- `js/app/cabinet/cabinet-modal-hanging.js` — wydzielona logika typu `wisząca`: `dolna_podblatowa`, `rogowa_slepa`, `narozna_l`, `uchylne`, wraz z frontCount/flap UI i plecami podblatowej.
- `js/app/cabinet/cabinet-modal-module.js` — wydzielona logika typu `moduł`: `standardowa`, `szuflady`, `uchylne`, wraz z drawer extras, flap UI i reakcją na zmianę subtype na klapę.
- `js/app/cabinet/cabinet-modal.js` — orchestrator deleguje już render dodatkowych pól, konfigurację frontów i reakcję na zmianę subtype do modułów typów; nie trzyma lokalnie tej logiki.
- Instrukcja antyregresyjna: przy kolejnych zmianach w `Wywiadzie` nie dopisywać nowych subtype'ów z powrotem do `cabinet-modal.js`. Najpierw sprawdzać odpowiedni moduł typu (`standing` / `hanging` / `module`) i tam trzymać logikę specyficzną dla rodziny.

## 2026-04-18 — Wywiad set wizard split from cabinet modal
- `js/app/cabinet/cabinet-modal-set-wizard.js` — wyjęta z monolitu pełna obsługa trybu `zestaw`: wejście w edycję, render kafli i parametrów, live-przeliczanie wynikowych pól, blok frontów, detekcja trybu zestawu dla górnego przycisku oraz zapis/aktualizacja zestawu bez zmiany UI i bez zmiany logiki biznesowej.
- `js/app/cabinet/cabinet-modal.js` — `zestaw` nie siedzi już lokalnie w środku pliku; modal deleguje tryb zestawu do osobnego modułu i zostaje cieńszym orchestrator-em.
- `js/testing/cabinet/tests.js` — nowy test pilnuje edycji istniejącego zestawu po wydzieleniu set-wizarda: preset, parametry i kolor frontów muszą się wczytać bez regresji.
- Instrukcja antyregresyjna: kolejne etapy (`stojąca`, `wisząca`, `moduł`) mają iść tym samym kierunkiem — logika specyficzna dla trybu/rodziny ma siedzieć we własnym module, a `cabinet-modal.js` ma tylko spinać ścieżkę renderu i zapisu.

## 2026-04-18 — Wywiad cabinet modal foundation split (draft / fields / validation)
- `js/app/cabinet/cabinet-modal-validation.js` — wyjęte z monolitu bezpieczne delegatory/guardy do `cabinetFronts` i `calc` oraz normalizacja legacy subtype (`szufladowa` -> `szuflady`).
- `js/app/cabinet/cabinet-modal-draft.js` — wyjęte przygotowanie draftu i techniczne ustawianie stanu modala dla dodawania/edycji/zestawu, bez zmiany typów realnie używanych w programie (`stojąca`, `wisząca`, `moduł`, `zestaw`).
- `js/app/cabinet/cabinet-modal-fields.js` — wyjęte helpery pól formularza: populowanie selectów i techniczne dokładanie dynamicznych pól select/number do `cmExtraDetails`, bez zmiany renderu UI.
- `js/app/cabinet/cabinet-modal.js` — zostaje głównym orchestrator-em, ale korzysta już z nowych modułów fundamentu zamiast trzymać cały ten kod lokalnie.
- Instrukcja antyregresyjna: w kolejnych etapach nie wrzucać z powrotem draftu, helperów pól ani guardów kompatybilności do `cabinet-modal.js`; nowe typy i `zestaw` mają nad tym tylko budować własne warstwy.

## 2026-04-18 — cabinet modal legacy subtype alias for inner drawer launcher test
- `js/app/cabinet/cabinet-modal.js` — `renderCabinetExtraDetailsInto(...)` normalizuje legacy alias `subType:'szufladowa'` do aktualnego `szuflady` na potrzeby renderu dodatkowych pól. Dzięki temu stary draft/test fixture dalej pokazuje właściwe pola szafek szufladowych, w tym launcher `Ilość szuflad wewnętrznych`, bez zmiany aktualnej logiki UI dla bieżących subtype'ów.
- Instrukcja antyregresyjna: jeśli test/legacy dane używają starej nazwy subtype, nie poprawiać tego zgadywaniem po całym kodzie ani przez zmianę UI; najpierw normalizować alias przy wejściu do warstwy renderu/odczytu.

## 2026-04-18 — Wywiad room params real data source fix + dynamic launcher hidden-root guard
- `js/app/ui/wywiad-room-settings.js` — topka `Wywiad` nie czyta już tylko `window.projectData/window.uiState`; najpierw bierze wspólny stan aplikacji (`projectData`, `uiState`), a dopiero potem fallbacki na `window.*`. To domyka realny błąd przycisku `Parametry`, który wyglądał na zbindowany, ale nie otwierał modala, bo moduł nie widział aktualnych ustawień pokoju.
- `js/app/cabinet/cabinet-choice-launchers.js` — hidden-root guard dla launcherów obejmuje też strukturalne rooty modala/test-fixture (`cabinetFormArea`, `cabinet-choice-sync`, lokalny test fixture), ale nadal nie ignoruje lokalnie ukrytych wrapperów konkretnych pól. Dzięki temu testowe/dynamiczne selecty lodówki i szuflad wewnętrznych dalej dostają launchery bez regresji dla naprawdę schowanych pól.
- `js/boot.js` — recovery nie doładowuje już ponownie `js/app.js`; przy klasycznym skrypcie z top-level state dawało to fałszywy `SyntaxError: Identifier ... has already been declared` i maskowało prawdziwy problem startu.
- Instrukcja antyregresyjna: helpery UI poza `app.js` nie mogą zakładać, że cały stan żyje na `window.*`. Najpierw próbować współdzielonych globali aplikacji (`projectData`, `uiState` itd.), a dopiero potem fallback do `window.*`. Przy launcherach rozróżniać ukryty root testowy/strukturalny od naprawdę ukrytego pola.

## 2026-04-18 — Wywiad room params compact top + direct trigger + dev-tests sync
- `index.html` + `css/style.css` + `js/app/ui/wywiad-room-settings.js` — góra `Wywiad` została odchudzona do kompaktowego shellu: krótki tytuł, auto-wysokość, jedna zwarta linia parametrów i mniejszy przycisk `Parametry`; przycisk ma też bezpośredni binding jako bezpieczny fallback, więc nie zależy wyłącznie od delegacji `data-action`.
- `js/app/cabinet/cabinet-choice-launchers.js` — dynamiczne selecty mogą dostać launcher także wtedy, gdy cały `cabinetModal` jest jeszcze ukrytym rootem testowym; nadal nie montujemy launcherów dla lokalnie ukrytych pól typu `display:none` we wrapperze.
- `dev_tests.html` + `js/testing/project/tests.js` — strona testów ładuje teraz także `panel-box` i `wywiad-room-settings`, a test projektu pilnuje kompaktowego summary zamiast starej siatki/pigułek.
- Instrukcja antyregresyjna: przy następnych zmianach góra `Wywiad` ma pozostać mała i użytkowa; nie wracać do ciężkiej listy wielu pigułek ani do przycisku zależnego wyłącznie od jednej ścieżki eventów.

## 2026-04-18 — Wywiad góra jako lekki shell + parametry pomieszczenia w osobnym oknie
- `index.html` + `js/app/ui/wywiad-room-settings.js` — ciężki blok parametrów nad listą szafek został zastąpiony lekkim shellem z podsumowaniem i jednym wejściem `Parametry pomieszczenia`; sama edycja odbywa się w programowym oknie `panelBox` w stylu ROZRYS, bez systemowych dialogów i bez ruszania logiki obliczeń.
- `js/app.js` — render `Wywiad` nie próbuje już zasilać stałych inputów w topce; zamiast tego odświeża kompaktowe podsumowanie parametrów pokoju.
- `css/style.css` — nowe klasy `wywiad-room-settings-*` utrzymują lekki wygląd topki i spójny modal z własnym wewnętrznym układem pól.
- Instrukcja antyregresyjna: parametry pomieszczenia w `Wywiad` mają pozostać lekkim summary + osobne okno. Nie przywracać pełnej siatki inputów stale wiszącej nad listą szafek.

## 2026-04-18 — Wywiad programowe pickery full sync + bez systemowego confirm
- `js/app/cabinet/cabinet-choice-launchers.js` — naprawiony realny powód regresji: fallback launcherów nie sprząta już własnych pickerów po ukryciu selecta źródłowego. Select z launcherem jest traktowany jako nadal aktywne źródło prawdy, a cały modal można odświeżyć jednym wywołaniem `refreshCabinetChoices(...)`.
- `index.html` + `js/app/cabinet/cabinet-modal.js` — wszystkie główne i dynamiczne selecty modala szafki / zestawu są jawnie oznaczone jako źródła pickerów (`cabinet-choice-source` + `data-choice-*`), więc konfiguracja nie opiera się już na kruchym zgadywaniu etykiet.
- `css/style.css` — select pod launcherem nie jest już chowany przez `display:none`, tylko bezpiecznie wyprowadzany poza ekran (`pointer-events:none`, off-screen), żeby Android nie wracał do systemowego popupu przy kolejnych przebiegach renderu.
- `js/app/cabinet/cabinet-actions.js` — usuwanie szafki w `Wywiad` nie ma już fallbacku do systemowego `window.confirm`; używa wyłącznie programowego okna aplikacji.
- `js/testing/cabinet/tests.js` — nowy test pilnuje dokładnie tej regresji: kolejny przebieg fallbacku nie może już usunąć launchera i odsłonić natywnego selecta.
- Instrukcja antyregresyjna: w `Wywiad` nie wracać do `display:none` jako mechanizmu chowania selectów źródłowych pod launcherem. Select ma zostać aktywnym źródłem prawdy poza ekranem, a nie „znikać” z layoutu w sposób, który psuje kolejne przebiegi mountu.


## 2026-04-18 — Wywiad launcher hotfix v7
- `js/app/cabinet/cabinet-choice-launchers.js` — launchery szafki mają już lokalny fallback API kopiujący overlay/launcher ROZRYS, więc jeśli `FC.rozrysChoice` nie jest jeszcze gotowe albo nie jest dostępne, widoczny UI nadal nie wraca do surowego systemowego selecta.
- `js/app/cabinet/cabinet-modal.js` — tryb zestawu montuje launchery `setFront*` jeszcze przed wyjściem z gałęzi `zestaw`; dynamiczne `addSelect(...)` oznacza też pola klasą `cabinet-dynamic-choice-source`, żeby fallback widział je po rerenderze.
- `css/style.css` — w `#cabinetModal` każdy select oznaczony `cabinet-choice-source--enhanced` jest ukrywany globalnie jako źródło prawdy, a launcher zostaje jedynym widocznym UI.
- Instrukcja antyregresyjna: w `Wywiad` nie stylizować już natywnego selecta jako „udawanego launchera”. Jeśli pole ma być wybierane jak reszta aplikacji, select ma zostać tylko ukrytym źródłem prawdy pod launcherem.

## 2026-04-18 — UI patterns fixture + Wywiad no-system-dialog step
- `dev_tests.html` + `dev_ui_patterns.html` — w testach pojawiła się sekcja `Wzorce UI` z żywymi referencjami do kopiowania 1:1: modal / header / X / stopka z ROZRYS oraz input z Inwestor. To jest teraz źródło prawdy przy nowych modalach i polach.
- `js/app/cabinet/cabinet-choice-launchers.js` + `js/app/cabinet/cabinet-modal.js` — kolejny krok Wywiadu bez systemowych elementów: launchery obejmują już także dynamiczne selecty lodówki oraz select ilości szuflad wewnętrznych; natywny `select` dalej zostaje źródłem prawdy.
- `js/app/cabinet/cabinet-actions.js` + `js/app/cabinet/cabinet-modal.js` — w dotkniętym obszarze Wywiadu nie wracamy do systemowych `alert/confirm`; pierwszeństwo mają `FC.infoBox` i `FC.confirmBox`.
- Instrukcja antyregresyjna: przy nowych oknach i polach nie tworzyć lokalnych wariantów „podobnych”. Najpierw sprawdzać sekcję `Wzorce UI` i kopiować odpowiedni wzorzec 1:1. W Wywiadzie widoczny UI ma iść przez launchery / modale aplikacji; native select zostaje tylko źródłem prawdy pod spodem.

## 2026-04-18 — Wywiad broader launcher coverage + top/cards/set grid polish
- `js/app/cabinet/cabinet-choice-launchers.js` — launchery obejmują już nie tylko bezpieczne pola główne modala szafki, ale też dynamiczne selecty dokładane w `cmExtraDetails` oraz selecty bloku `Fronty w zestawie` (`setFrontCount`, `setFrontMaterial`, `setFrontColor`). Native `select` dalej zostaje źródłem prawdy.
- `js/app/cabinet/cabinet-modal.js` — dynamiczne selecty dostają stałe id/etykiety pod launcher, kompaktowe pola liczbowe (`Ilość półek`, podobne krótkie pola) nie rozciągają się już bez sensu na pełną szerokość, a siatka parametrów zestawu dostała lokalne klasy do równego wyrównania etykiet i pól.
- `index.html` + `css/style.css` + `js/app.js` — góra `Wywiad` i karty szafek dostały lokalny shell/rytmy (`wywiad-room-shell`, `wywiad-cabinets-shell`, `cabinet-card-shell`) bez ruszania logiki; karty i parametry pomieszczenia są wizualnie lżejsze i spójniejsze z resztą aplikacji.
- `js/testing/cabinet/tests.js` — testy pilnują launcherów dla dynamicznego pola `Wnętrze` oraz launcherów bloku `Fronty w zestawie`, żeby przy kolejnych zmianach nie wróciły systemowe selecty.
- Instrukcja antyregresyjna: w `Wywiad` każde nowe pole wyboru ma najpierw dostać lokalny launcher nad natywnym `select` (źródło prawdy zostaje), a rzędy parametrów zestawu mają być wyrównywane klasami lokalnymi (`set-param-*`) zamiast ręcznego stylowania inline.

## 2026-04-18 — Wycena prompt text tweak + Wywiad modal form rhythm sync
- `js/app/wycena/wycena-tab-selection.js` — komunikat modala nowego wariantu używa teraz naturalnej formy `Dla pomieszczenia ...` / `Dla pomieszczeń ...` zależnie od liczby wybranych pokoi, zamiast stałego `Dla zakresu ...`.
- `css/style.css` — modal nazwy wyceny dostał dodatkowy dolny oddech w stopce akcji, bez ruszania reszty `Wycena`.
- `index.html` + `js/app/cabinet/cabinet-modal.js` + `css/style.css` — wnętrze modala szafki w `Wywiad` ma teraz bardziej uporządkowany shell formularza: lokalne klasy konfiguracji (`cabinet-config-card`, `cabinet-form-grid`, `cabinet-extra-details`, `cabinet-inline-hint`) porządkują rytm sekcji, etykiety, hinty i dodatkowe pola bez zmiany logiki formularza.
- `js/testing/wycena/suites/scope-entry.js` + `js/testing/cabinet/tests.js` — testy pilnują nowego komunikatu `pomieszczenie/pomieszczenia` oraz lokalnego shellu konfiguracji `Wywiad` po bezpiecznych poprawkach UI.
- Instrukcja antyregresyjna: w `Wycena` traktować komunikat modala jako tekst zależny od liczby wybranych pokoi, nie od technicznego słowa `zakres`. W `Wywiad` porządkować wnętrze modala tylko lokalnymi klasami namespacowanymi dla formularza szafki; nie ruszać globalnych styli modali ani logiki selectów.

## 2026-04-18 — Wycena modal ref header/footer sync + Wywiad second safe launcher batch
- `js/app/quote/quote-scope-entry.js` + `css/style.css` — modal `Nazwa nowej wyceny` używa teraz shellu `panel-box--rozrys`, a stopka akcji jest złożona z tych samych klas co w referencyjnym modalu `Wybierz materiał / grupę` (`rozrys-picker-footer*`). Dzięki temu header, kwadratowy `X`, rytm górnej belki i prawa, lekka stopka z mniejszymi przyciskami są kopiowane z referencji zamiast stylizowane „podobnie”.
- `js/app/cabinet/cabinet-choice-launchers.js` — druga paczka bezpiecznych launcherów w `Wywiad`: do launcherów dochodzą `cmFrontColor`, `cmFrontCount` oraz warunkowe launchery `cmFlapVendor` / `cmFlapKind`; nadal native `select` zostaje źródłem prawdy i launcher ma tylko przykrywać UI.
- `js/testing/cabinet/tests.js` + `js/testing/wycena/suites/scope-entry.js` — rozszerzone testy pilnują nowego shellu/stopek modala `Wycena` oraz drugiej partii launcherów `Wywiad` bez utraty natywnych `select`.
- Instrukcja antyregresyjna: przy dalszym dopinaniu modali w `Wycena` kopiować header/footer przez te same klasy co w zaakceptowanym modalu ROZRYS (`panel-box--rozrys`, `rozrys-picker-footer*`), zamiast odtwarzać je lokalnymi przybliżeniami. W `Wywiad` każde kolejne pole launcherowe musi przechodzić przez `shouldMount`/`cleanupLauncher`, żeby pola dynamicznie ukrywane nie zostawiały martwych launcherów.

## 2026-04-18 — Wywiad safe choice launchers + quote name modal local ref sync
- `js/app/cabinet/cabinet-choice-launchers.js` — nowy, mały moduł launcherów dla najbezpieczniejszych selectów modala szafki (`cmSubType`, `cmFrontMaterial`, `cmBackMaterial`, `cmBodyColor`, `cmOpeningSystem`). Native `select` zostaje źródłem prawdy; launcher tylko przykrywa UI i po wyborze aktualizuje oryginalny select + odpala jego `change`.
- `js/app/cabinet/cabinet-modal.js` — render modala szafki montuje launchery dopiero po zasileniu selectów opcjami i po podpięciu istniejących handlerów; nie przenosi stanu do osobnego store launchera.
- `css/style.css` — launchery `Wywiad` są namespacowane przez `.cabinet-choice-sync`, więc nie ruszają innych selectów / launcherów w aplikacji.
- `js/app/quote/quote-scope-entry.js` + `css/style.css` — modal nazwy nowej wyceny używa lokalnych klas `quote-scope-entry-name__*` na shellu `panel-box`, żeby nie dziedziczyć starego, ogólnego CSS `quote-scope-entry-modal__*` i nie rozjeżdżać się względem referencyjnego modala.
- Instrukcja antyregresyjna: przy kolejnych polach `Wywiadu` nie ukrywać selecta globalnie ani nie robić osobnego stanu launchera. Launcher ma być tylko lokalną nakładką na konkretny select. Przy poprawkach modala `Wycena` nie mieszać lokalnych klas `quote-scope-entry-name__*` z ogólnymi `quote-scope-entry-modal__*` używanymi przez inne okna scope.

## 2026-04-18 — Wywiad modal helper dependency hotfix
- `js/app/cabinet/cabinet-modal.js` — modal szafki nie zależy już od globalnych wrapperów z `app.js` przy odczycie helperów frontów; lokalne, namespacowane resolvery czytają `FC.cabinetFronts` (z fallbackiem), więc testy i środowiska bez `app.js` nie wpadają już w `getSubTypeOptionsForType is not defined`.
- `js/testing/cabinet/tests.js` — dodany antyregresyjny test pilnujący, że modal renderuje warianty także po usunięciu globalnej `getSubTypeOptionsForType`; źródłem prawdy ma być moduł `FC.cabinetFronts`.
- Instrukcja antyregresyjna: przy dalszych pracach nad `Wywiad` nie opierać modala szafki o przypadkowe globalne helpery z `app.js`. Jeżeli logika należy do domeny szafek/frontów, czytać ją przez namespace `FC.cabinetFronts` albo lokalny resolver namespacowany.

## 2026-04-17 — Wywiad test hardening before UI changes
- `js/testing/cabinet/tests.js` — mocno rozszerzone testy działu `Wywiad` / modala szafki: domyślny draft kuchni, klonowanie ostatniej szafki, opcje otwierania dla wiszącej vs stojącej, render modala w trybie dodawania, obecność natywnych selectów źródłowych (`cmSubType`, `cmFrontMaterial`, `cmBackMaterial`, `cmBodyColor`, `cmOpeningSystem`), aktualizacja draftu po zmianie tych pól oraz render modala w trybie edycji z CTA `Zapisz zmiany`.
- `dev_tests.html` + `tools/app-dev-smoke.js` — środowiska testowe ładują teraz także `js/app/cabinet/cabinet-fronts.js`, `js/app/cabinet/cabinet-modal.js` i `js/app/cabinet/cabinet-actions.js`, żeby testy `Wywiad` nie były ślepe na realny modal szafki.
- Instrukcja antyregresyjna: zanim ruszy UI `Wywiadu`, utrzymywać natywne selecty jako źródło prawdy i pilnować ich obecności/testów. Każda przyszła warstwa launcher/picker ma tylko przykrywać native `select`, nie zastępować go własnym stanem.

## 2026-04-17 — hotfix lokalnego shellu modala nazwy wyceny
- `js/app/quote/quote-scope-entry.js` — modal `Nazwa nowej wyceny` dostał lokalny shell oparty o istniejące klasy `panel-box` / `panel-box-form`, ale tylko dla tego jednego okna; usunięty osobny blok `Pomieszczenia`, a `Anuluj / OK` siedzą w stopce 50/50 bez dotykania wyglądu reszty `Wycena`.
- `css/style.css` — dodane wyłącznie namespacowane reguły `.quote-scope-entry-modal--name ...`; nie zmieniać przy tym wspólnych klas `panel-box*`, `info-trigger`, `label-help` ani launcherów/sekcji `Wycena`.
- `js/testing/wycena/suites/scope-entry.js` — dodany test antyregresyjny pilnujący, że modal nazwy ma shell `panel-box`, brak bloku `Pomieszczenia` i układ akcji 50/50.
- Instrukcja antyregresyjna: poprawiając pojedynczy modal, dopisywać lokalne klasy namespacowane dla tego modala zamiast ruszać współdzielone style używane przez inne sekcje (`info-trigger`, `panel-box`, launchery, sekcje Wycena/ROZRYS).

## 2026-04-17 — hotfix kanonicznego scope dla nazw i historii wycen
- `js/app/quote/quote-snapshot.js` + `js/app/quote/quote-snapshot-store.js` — scope ofert traktuje teraz `selectedRooms` jako kanoniczne źródło prawdy dla etykiet pokoi; `roomLabels` są odtwarzane z `selectedRooms` zamiast ślepo ufać starym/złym labelom zapisanym w snapshotcie.
- `js/app/quote/quote-snapshot-store.js` — zapis snapshotu prostuje auto-nazwy z obcego scope (`J` zapisane pod `a`, `a+J` itd.) do bieżącego exact-scope zanim trafią do historii; `getEffectiveVersionName()` oraz `getScopeRoomLabels()` prostują też stare skażone snapshoty przy odczycie.
- `js/app/wycena/wycena-tab-history.js`, `js/tabs/wycena.js`, `js/app/quote/quote-pdf.js` — historia, preview i PDF czytają już etykiety scope przez wspólny resolver zamiast z surowego `scope.roomLabels`.
- `js/testing/wycena/suites/scope-entry.js` — dodane dwa antyregresyjne testy pod flow `a / J / a+J`: (1) zapis nowej wyceny prostuje auto-nazwę i roomLabels na save, (2) odczyt historii prostuje stare snapshoty ze złym `roomLabels`/`versionName`.
- Instrukcja antyregresyjna: w `Wycena` i PDF nie ufać bezpośrednio `scope.roomLabels`; źródłem prawdy dla zakresu są `scope.selectedRooms`, a etykiety mają być wyliczane wspólnym resolverem. Auto-nazwy wygenerowane przez aplikację, które nie pasują do bieżącego scope, mają być prostowane już na save, nie tylko maskowane w UI.

## 2026-04-17 — WYCENA status bridge split
- `js/app/wycena/wycena-tab-status-bridge.js` przejął workflow statusów zakładki `Wycena`: `currentProjectStatus`, `setProjectStatusFromSnapshot`, `syncGeneratedQuoteStatus`, `commitAcceptedSnapshotWithSync`, `reconcileAfterSnapshotRemoval`, `promotePreliminarySnapshotToFinal`, `acceptSnapshot`. `js/tabs/wycena.js` ma tylko delegować do bridge'a.
- Instrukcja antyregresyjna: nowa logika statusów i akceptacji nie wraca już do `js/tabs/wycena.js`; jeśli trzeba zmieniać flow `accept/remove/promote`, robić to w `wycena-tab-status-bridge.js` albo w `project-status-sync.js`, nie dopisywać lokalnych wyjątków do taba.

## 2026-04-17 — hotfix znikającej historii wycen po splicie
- `js/tabs/wycena.js` — hotfix po wydzieleniu `wycena-tab-history.js`: do zależności przekazywanych do modułu historii wrócił `currentProjectStatus`, bez którego render historii wpadał w cichy wyjątek i cała sekcja znikała z UI.
- `js/testing/wycena/suites/core-offer-basics.js` — dodany test antyregresyjny renderu: zapisany snapshot musi zbudować sekcję `Historia wycen` i wpisy listy po renderze zakładki `Wycena`.
- Instrukcja antyregresyjna: przy kolejnych splitach renderujących modułów `Wycena` testować nie tylko helpery biznesowe, ale też pełny render sekcji w DOM. Jeśli wrapper delegacji ma `try/catch`, brak zależności może schować błąd i wyczyścić cały fragment UI bez czerwonego wyjątku.

## 2026-04-16 — wycena history/preview/scroll split + krótki modal nazwy
- `js/app/wycena/wycena-tab-scroll.js` — wydzielona pamięć i przywracanie scrolla historii/podglądu w `Wycena`; `js/tabs/wycena.js` tylko deleguje do modułu.
- `js/app/wycena/wycena-tab-history.js` — wydzielony render historii ofert, preview snapshotu i wybór aktualnie wyświetlanej oferty bez ruszania workflow statusów `accept/remove/promote`.
- `js/app/wycena/wycena-tab-selection.js` + `js/app/quote/quote-scope-entry.js` — modal nazwy nowej wyceny używa krótkiego komunikatu nad polem i nie pokazuje dolnego opisu/hintu.
- Instrukcja antyregresyjna: przy dalszym splicie `Wycena` zostawić workflow statusów (`commitAcceptedSnapshotWithSync`, `reconcileAfterSnapshotRemoval`, `promotePreliminarySnapshotToFinal`, `acceptSnapshot`) w `js/tabs/wycena.js`, dopóki nie powstanie osobny status bridge. Moduły historii/scrolla mają tylko renderować i obsługiwać stan widoku.

## 2026-04-16 — wycena helper split hotfix
- `js/tabs/wycena.js` — hotfix po pierwszym splicie helperów: przywrócone lokalne funkcje, które nie miały jeszcze wychodzić z taba (`h`, `getCurrentProjectId`, `getCurrentInvestorId`, `getSnapshotHistory`, `normalizeSnapshot`, `getOfferDraft`, `patchOfferDraft`, `resolveDisplayedQuote`). To usuwa regres `normalizeSnapshot is not defined` / `getCurrentProjectId is not defined` bez cofania samego wydzielenia czystych helperów do `js/app/wycena/wycena-tab-helpers.js`.
- Instrukcja antyregresyjna: przy kolejnych etapach splitu `js/tabs/wycena.js` najpierw porównać listę funkcji wyciętych z listą realnych wywołań w tabie. Nie wynosić z taba helperów stanu/odczytu draftu/historii ani funkcji render-selection bez jednoczesnego podpięcia nowego modułu i testów.

## 2026-04-16 — status tests mini-package 5
- `js/testing/wycena/tests.js` — dopięte antyregresje dla późnych etapów procesu (`umowa`, `produkcja`, `montaz`, `zakonczone`): sekwencja późnych statusów utrzymuje scoped końcową ofertę, nie przywraca martwych zaznaczeń starych wycen i nie rusza rozłącznego pokoju.
- `js/testing/wycena/tests.js` — dodany guard coverage dla późnych etapów: bez zaakceptowanej wyceny końcowej exact-scope ręczne przejścia na późne statusy mają być blokowane, a po zaakceptowaniu finalnej oferty mają się odblokować.
- `js/testing/investor/tests.js` — dopięty test przepływu z poziomu `Inwestor`: ręczne przejścia `umowa -> produkcja -> montaz -> zakonczone` zwracają poprawny `masterStatus`/`mirrorStatus`, aktualizują lustra i nie ruszają zaakceptowanej oferty rozłącznego pokoju.
- Instrukcja antyregresyjna: przy dokładaniu kolejnych reguł dla późnych etapów zawsze testować dwa scenariusze naraz: (1) pełną sekwencję późnych statusów dla jednego pokoju, (2) współistnienie drugiego, rozłącznego pokoju z własną zaakceptowaną ofertą. Brak regresji oznacza nie tylko poprawny status pokoju docelowego, ale też brak zmian `selectedByClient`, `acceptedStage`, `rejected*` i statusu snapshotów w rozłącznym scope.

## 2026-04-16 — scoped accept/convert hotfix + refresh restore
- `js/app/quote/quote-snapshot-store.js` — naprawiony kolejny regres multi-scope z historii wycen: akceptacja snapshotu dla jednego pokoju nie może już nadpisywać `project.status` w rozłącznych snapshotach tego samego `projectId`; nieimpaktowane scope są zostawiane bez bocznych dopisków statusu.
- `js/app/quote/quote-snapshot-store.js` — `convertPreliminaryToFinal(projectId, snapshotId)` działa teraz tylko na **kolidującym scope** targetu. Konwersja pokoju A do oferty końcowej nie zdejmuje już akceptacji, nie zmienia typu i nie narzuca końcowego statusu snapshotom rozłącznego pokoju B.
- `js/app.js` — dodany lekki mechanizm przywracania kontekstu po zwykłym odświeżeniu w tej samej karcie (`sessionStorage`): zapisuje aktualny `uiState` i scroll przy `pagehide/beforeunload`, a po reloadzie przywraca ostatni widok zamiast wypadać na stronę główną. To jest techniczny restore tylko na refresh/tej samej karcie, nie nowy globalny stan aplikacji.
- `js/testing/wycena/tests.js` — dopięte antyregresje: (1) akceptacja solo scope nie nadpisuje statusu snapshotów rozłącznego scope, (2) konwersja wstępnej oferty do końcowej nie zdejmuje akceptacji z innego solo pokoju.
- Instrukcja antyregresyjna: przy logice `markSelectedForProject` i `convertPreliminaryToFinal` rozróżniać **scope impaktowany** od **scope rozłącznego**. Rozłączne snapshoty mogą współistnieć i nie wolno im masowo czyścić `selectedByClient`, `acceptedAt`, `acceptedStage`, `rejected*` ani `project.status` tylko dlatego, że dzielą ten sam techniczny `projectId`.
- Instrukcja antyregresyjna: fix odświeżenia ma działać jako restore ostatniego realnego widoku w tej samej karcie. Nie przywracać strony przez zgadywanie na podstawie samego `currentInvestorId`; źródłem ma być zapisany bieżący kontekst z chwili refreshu.

## 2026-04-16 — multi-scope accepted quotes hotfix
- `js/app/quote/quote-snapshot-store.js` — hotfix regresji statusów: akceptacja oferty dla jednego, rozłącznego scope nie może już odrzucać ani zdejmować akceptacji z innego solo scope tego samego inwestora/projektu-kontenera. Selekcja snapshotów działa teraz per **zakres kolidujący**, a nie globalnie dla całego `projectId`; rozłączne pokoje mogą mieć równolegle własne zaakceptowane oferty.
- `js/app/quote/quote-snapshot-store.js` — `getSelectedForProject(projectId, { roomIds })` obsługuje teraz scoped odczyt wybranej oferty exact-scope; przy dalszym rozwoju wszędzie, gdzie wybór ma dotyczyć konkretnego pokoju lub exact scope, używać tej wersji zamiast szerokiego odczytu projektowego bez scope.
- `js/testing/wycena/tests.js` — dodany test antyregresyjny: zaakceptowanie solo oferty dla pokoju A nie może odrzucić ani odznaczyć zaakceptowanej solo oferty pokoju B.
- Instrukcja antyregresyjna: przy logice akceptacji/odrzucania snapshotów traktować `projectId` tylko jako kontener techniczny. Reguły `selectedByClient`, `acceptedAt`, `rejectedAt` i `rejectedReason` wolno zmieniać tylko w obrębie **kolidującego scope** (overlap), nigdy globalnie dla wszystkich snapshotów projektu, jeśli scope są rozłączne.

## 2026-04-15 — status cleanup mini-package 4
- `js/tabs/wycena.js` — mini-paczka 4: wycięte stare wysokopoziomowe fallbacki statusów dla akceptacji / usuwania / konwersji snapshotów. `Wycena` nie wraca już do lokalnego `markSelectedForProject`, ogólnego `reconcileProjectStatuses` ani lokalnej konwersji + ręcznego zapisu statusów, jeśli zabraknie dedykowanych helperów centralnego syncu. Zostaje tylko najniższy fallback kompatybilności w `setProjectStatusFromSnapshot()` jako awaryjna ścieżka techniczna.
- `js/app/project/project-status-sync.js` — uporządkowany silnik map statusów: `computeRecommendedRoomStatusMap()` przejął rolę jednej ścieżki liczenia rekomendowanych statusów pokoi; stary `buildRecommendedRoomStatusMap()` został sprowadzony do wrappera kompatybilności zamiast osobnej, dublującej logiki fallbacków.
- `js/testing/wycena/tests.js` — dodane antyregresje dla ETAPU 4: brak dedykowanych helperów centralnego syncu nie może już uruchamiać starych lokalnych fallbacków w `Wycena`.
- Instrukcja antyregresyjna na dalszy rozwój: jeśli dokładamy nowe flow statusowe, to dedykowany helper ma powstać w `project-status-sync.js`, a `js/tabs/wycena.js` ma go tylko wywołać. Nie dopisywać już nowych lokalnych obejść typu „jak nie ma helpera, to zróbmy selekcję snapshotu / reconcile / zapis luster ręcznie w Wycena”.

## 2026-04-15 — status engine responsibilities mini-package 3
- `js/app/project/project-status-sync.js` — mini-paczka 3: dopięte jawne role silnika statusów. Sync ma teraz nie tylko liczyć `masterStatus` i lustra, ale też orkiestruje trzy przepływy statusowe z `Wycena`: akceptację oferty (`commitAcceptedSnapshot`), rekonsyliację po usunięciu snapshotu (`reconcileStatusAfterSnapshotRemoval`) oraz konwersję zaakceptowanej wstępnej oferty do końcowej (`promotePreliminarySnapshotToFinal`). To ogranicza rozproszenie reguł biznesowych poza `wycena.js`.
- `js/tabs/wycena.js` — lokalne sklejanie akceptacji / usuwania / konwersji snapshotów zostało odchudzone do wywołań centralnego syncu. `Wycena` zostaje warstwą UI/orchestration zamiast trzymać własne boczne reguły statusowe.
- `js/app/project/project-status-manual-guard.js` — dopisany komentarz kontraktowy: guard ma tylko walidować ręczne przejścia statusu i nie może sam zapisywać końcowego stanu projektu ani luster.
- `js/app/quote/quote-snapshot-store.js` — dopisany komentarz kontraktowy: snapshot store przechowuje i filtruje historię exact-scope ofert, ale nie jest miejscem finalnego liczenia biznesowego statusu projektu.
- `js/testing/wycena/tests.js` — dodane antyregresje dla mini-paczki 3: `Wycena` deleguje akceptację/usuwanie/konwersję do centralnego syncu; guard pozostaje read-only; snapshot store sam nie ustala statusu projektu.
- Instrukcja na dalszy rozwój statusów: nowe etapy i nowe reguły biznesowe dopisywać najpierw w `project-status-sync.js` (finalny wynik) i `project-status-manual-guard.js` (dozwoloność ręcznych przejść). `quote-snapshot-store.js` ma tylko dostarczać dane/historyczne snapshoty, a `js/tabs/wycena.js` ma jedynie wywoływać centralne helpery syncu bez dokładania równoległej logiki statusowej.

## 2026-04-15 — status scope rules mini-package 1
- `js/app/project/project-status-sync.js` — mini-paczka 1 logiki statusów: brak jawnego scope nie skleja już automatycznie wszystkich pokoi inwestora w jeden projekt; scoped zmiany i scoped rekonsyliacje liczą status kompatybilności tylko z exact scope, a brak pokoi wraca do `nowy`.
- `js/tabs/wycena.js` — usuwanie oferty przekazuje do rekonsyliacji exact scope usuwanego snapshotu zamiast niejawnie wpadać w cały zestaw pokoi inwestora.
- `js/testing/wycena/tests.js` — dodane antyregresje dla mini-paczki 1: brak niejawnej agregacji po całym inwestorze oraz ignorowanie obcego pokoju przy scoped statusie A+B.
- `js/tabs/wycena.js` — poprawiony scroll po akceptacji oferty z przycisku pod `Podsumowanie`; widok zostaje w miejscu zamiast skakać na górę.
- `js/app/quote/quote-snapshot.js`, `js/app/quote/quote-offer-store.js`, `js/app/quote/quote-snapshot-store.js`, `js/app/quote/quote-scope-entry.js`, `js/app/wycena/wycena-core.js` — domyślne nazwy ofert i wariantów uwzględniają teraz scope pomieszczeń (`Oferta — Kuchnia + Salon`, `Wstępna oferta — Salon — wariant 2`).
## 2026-04-15 — quote accept + roomless wycena + tab order
- `js/tabs/wycena.js` — dodany wspólny helper akceptacji oferty i nowy przycisk `Zaakceptuj ofertę` pod `Podsumowanie`, podpięty do tej samej logiki co karta historii.
- `js/app/ui/views.js` + `js/app/ui/tab-navigation.js` + `js/app.js` — wejście zakładką `WYCENA` bez wybranego pokoju otwiera teraz od razu moduł wyceny zamiast ekranu `Wybierz pomieszczenie`; render tabów działa też dla roomless `WYCENA`.
- `index.html` — przestawiona kolejność zakładek: u góry `MATERIAŁ` przed `RYSUNEK`, na dole `INWESTOR`, `WYCENA`, `ROZRYS`, `MAGAZYN`; podbity cache-busting zmienionych plików.
- `js/testing/project/tests.js` + `js/testing/wycena/tests.js` — dodane antyregresje dla roomless wejścia do `WYCENA`, kolejności zakładek oraz kwalifikacji przycisku akceptacji w podglądzie oferty.


## 2026-04-12 — foundation tests follow-up
- rozszerzone smoke testy działowe dla `Inwestor`, `Materiały` i `Usługi`
- `Inwestor`: status projektu z poziomu inwestora synchronizuje `projectStore` i wybór oferty; aktualizacja jednego pomieszczenia nie narusza pozostałych i odświeża etykietę rejestru
- `Materiały`: zapis listy płyt nie przepuszcza akcesoriów do materiałów arkuszowych; `migrateLegacy({ preferStoredSplit:true })` trzyma rozdzielone listy zamiast wskrzesić legacy dane
- `Usługi`: `catalogStore` i `serviceOrderStore` są testowane jako jedno źródło danych; szkic zlecenia nie zapisuje pustego rekordu przy pierwszym wejściu
- lokalny runner `APP` po zmianach: 53/53 OK
- 2026-04-06 — `site_two_mode_stage1.zip`: wdrożony etap 1 architektury 2 trybów pracy. Start pokazuje tylko `Projekty meblowe` i `Drobne usługi stolarskie`; dodane kontekstowe huby wejść, nowy `catalog-store.js` z rozdzieleniem `sheetMaterials/accessories/quoteRates/workshopServices/serviceOrders`, osobny moduł `service-orders.js` oraz poprawki testów/ROZRYS pod tę przebudowę.

- 2026-04-06 — `site_price_popup_tests_queue.zip`: `Dodaj`/`Edytuj` w cennikach dostało mobilny popup w stylu aplikacji przez osobny arkusz `css/price-item-popup.css`; `dev_tests.html` dostał przycisk `Kopiuj tylko błędy`; do testów dopięto brakujące moduły (`investor-persistence`, `rozrys-scope`, `rozrys-render`, `rozrys`) oraz poprawiono fake DOM dla render-smoke w przeglądarce.

- 2026-04-06 — `site_quote_ui_pdf_price_choices.zip`: zakładka `Wycena` dostała własny, wąski layout bez odziedziczonych szerokości z list ROZRYS; cennik materiałów/usług przeszedł z systemowych selectów i `alert/confirm` na aplikacyjne launchery + nasze boxy; inwestor dostał osobny moduł `investor-pdf.js` oraz przycisk `PDF` do karty segregatorowej.

- 2026-04-06 — `site_source_picker_merge_sumcheck.zip`: przywrócona produkcyjna rola listy `Skomasowana` (bez sztucznego `OK` w kolumnach), dodana osobna kontrolka sum `RAW` vs `Skomasowana`, poprawiony eksport PDF list, usunięty separator nad `Usuń/Edytuj`, nowe domyślne `BRAK` w dodatkowych informacjach nowego inwestora oraz aplikacyjna lista wyboru `Źródło`.

- 2026-03-28 — `site_rozrys_choice_noarrow.zip`: usunięta strzałka z kompaktowych kafli `Szybkość liczenia` i `Kierunek cięcia`; zostawiony sam wystający kafel z nazwą wybranej opcji.
- 2026-03-28 — site_rozrys_choice_clean.zip
  - ROZRYS: uproszczono kafle wyboru `Szybkość liczenia` i `Kierunek cięcia` — usunięto tekst `Kliknij, aby wybrać/zmienić`, zostawiono samą nazwę wybranej opcji oraz nowy, bardziej aplikacyjny znak klikalności po prawej.
## Struktura katalogów (po paczce arch_dirs_tests)

- `js/app/shared/` — helpery wspólne, storage, validate, public API.
- `js/app/ui/` — bindingi, routing zakładek, boxy, scroll-memory, layout helpers.
- `js/app/cabinet/` — modal szafki, fronty, okucia, cutlista i szkice.
- `js/app/investor/` — inwestor, sesja projektu, bootstrap/autosave.
- `js/app/material/` — magazyn, registry materiałów, opcje formatek, modal cenników.
- `js/app/optimizer/` — solver, worker, profile startu/szybkości.
- `js/app/rozrys/` — cały ROZRYS.
- `js/testing/` — smoke-testy developerskie (`rozrys`, `project`, `investor`, `material`, `wycena`, `cabinet`).

### Paczka 2026-03-28 — arch_dirs_tests
- Przeniesiono płaski katalog `js/app/*` do grup domenowych i technicznych bez zmiany UI.
- Usunięto martwy `js/app/rozrys.js.bak`.
- Usunięto stary workflow `.github/workflows/deploy-from-zip.disabled`.
- Dodano nową stronę `dev_tests.html` oraz smoke-testy dla projektu, materiałów i szafek.
- Dla Node dodano `tools/app-dev-smoke.js` jako szybki runner tych testów poza przeglądarką.

# DEV — porządek rozwoju meble-app / Optimax

- 2026-03-28 — `site_dev_smoke_more_scenarios.zip`: rozbudowa smoke-testów ROZRYS do 18 scenariuszy; dodane testy bardziej życiowe dla wyjątków słojów, stabilności podpisu magazynu, formatu obróconego, nadmiaru walidacji, zmian klucza cache po wyjątkach/okleinach oraz układu 2 małych arkuszy na jednej stronie wydruku.

## Ostatnia paczka zmian

### 2026-04-04 — rozrys_lists_tabs_pdf_v1
- `js/app/rozrys/rozrys-summary.js` — modal `Lista formatek` dostał 3 osobne zakładki (`RAW`, `Skomasowana`, `Walidacja`) zamiast jednego długiego widoku; dodane lokalne przyciski PDF dla `RAW` i `Skomasowanej` oraz PDF dla `Listy formatek arkusza`.
- `js/app/rozrys/rozrys.js` — wrappery otwierania list przekazują teraz także `openPrintView`, żeby PDF/druk list działał z poziomu modali bez ruszania innych sekcji ROZRYS.
- `css/style.css` — dodane lekkie style zakładek w modalu list formatek, bez zmiany zaakceptowanego wyglądu reszty ROZRYS.
- `index.html` — podbity cache-busting dla `style.css`, `rozrys-summary.js` i `rozrys.js` dla tej paczki.

### 2026-03-29 — checkbox_chip_checked_accent_v1
- `css/rozrys-checkbox-chip-selected-accent.css` — nowy, mały moduł wizualny tylko do stanu zaznaczonego checkbox-chipów ROZRYS; dodaje delikatny gradient, lekko mocniejszy obrys i subtelny lift całego przycisku, żeby aktywny stan był czytelniejszy bez trzeciego stanu.
- `index.html` — dopięty nowy moduł CSS i podbity cache-busting dla tej paczki.
- `js/testing/rozrys/tests.js` + `tools/rozrys-dev-smoke.js` + `dev_tests.html` — dodany test anty-regresyjny pilnujący, że zaznaczony checkbox-chip ma osobny akcent wizualny całego przycisku i checkboxa.

### 2026-03-29 — material_scope_chip_sync_v1
- `css/rozrys-scope-chip-room-sync.css` — nowy, mały moduł CSS tylko do synchronizacji zachowania małych kafelków `Fronty/Korpusy` w pickerze `Materiał / grupa` z wzorcem kafelków wyboru pomieszczeń; usuwa zieloną ramkę / zielony tekst z małego kafelka i zostawia tylko niebieski stan samego checkboxa.
- `css/rozrys-checkbox-chip-pattern.css` — wspólny wzorzec checkbox/chip dla ROZRYS z wariantem dużym; używany do kafelków wyboru pomieszczeń, żeby trzymały ten sam język wizualny co małe chipy `Fronty/Korpusy`.
- `js/app/rozrys/rozrys-selection-ui.js` — małe kafelki zakresu materiału dostają dedykowany modifier `rozrys-scope-chip--room-match`, żeby poprawka była punktowa i nie rozlewała się na inne checkboxy ROZRYS.
- `js/testing/rozrys/tests.js` + `tools/rozrys-dev-smoke.js` + `dev_tests.html` — dodane testy anty-regresyjne pod ten przypadek: sprawdzenie modifiera na małym kafelku i obecności dedykowanego CSS sync.
- `index.html` — dopięty nowy moduł CSS i podbity cache-busting dla `rozrys-selection-ui.js`.

### 2026-03-27 — rozrys_split_v6
- `js/app/rozrys/rozrys-scope.js` — wydzielony zakres / selekcja ROZRYS: pomieszczenia, scope materiałów, kolejność materiałów, klucz accordionu i agregacja formatek projektu.
- `js/app/rozrys/rozrys-engine.js` — wydzielone helpery engine ROZRYS: normalizacja kierunku, etykiety heurystyk, liczenie sync, liczenie workerowe i wspólny fallback `computePlanWithCurrentEngine()`.
- `js/app/rozrys/rozrys-sheet-helpers.js` — wydzielone helpery canvas arkusza: metryki planszy, snap do pixela, trim area, divider połówki i rysowanie pojedynczej formatki.
- `js/app/rozrys/rozrys-print-layout.js` — wydzielony layout PDF/druk: dobór skali, grupowanie 1–2 arkuszy na stronę i generowanie HTML wydruku bez zmiany wyglądu.
- `js/app/rozrys/rozrys.js` + `js/app/rozrys/rozrys-sheet-draw.js` + `js/app/rozrys/rozrys-render.js` — przepięte na nowe moduły, dzięki czemu `rozrys.js` dalej schudł i zostało w nim mniej ciężkiej logiki domenowej.
- `index.html` — dopięte nowe pliki i podbity pełny cache-busting pakietu `rozrys-*` do `20260327_rozrys_split_v6`.

### 2026-03-27 — rozrys_stock_validation_fix_v2
- `js/app/rozrys/rozrys-stock.js` — walidacja dla arkuszy `z magazynu` dostała dodatkowe, odporniejsze odejmowanie wykorzystanych formatek: jeśli placement z planu magazynowego nie wróci z idealnie dopasowanym `key`, moduł rozpoznaje go jeszcze po nazwie i wymiarze, więc formatki użyte na płycie magazynowej nie są już dublowane na płytach `zamówić`.
- `js/app/rozrys/rozrys.js` + `js/app/rozrys/rozrys-render.js` — podbity `stockPolicy` do `v4`, żeby po tej poprawce nie wracały stare, błędne plany z cache.
- `index.html` — podbite cache-busting dla całego zestawu modułów `rozrys-*` do `20260327_rozrys_stock_validation_v4`.

### 2026-03-26 — rozrys_validation_fix_v1
- `js/app/rozrys/rozrys-stock.js` — naprawiona regresja po module split: odejmowanie formatek już wykorzystanych z magazynu znowu używa pełnego `partSignature()`, więc brakujące elementy nie są dublowane na płytach zamawianych; dodatkowo filtr dopasowania do arkusza magazynowego znowu respektuje blokadę obrotu wynikającą ze słojów.
- `js/app/rozrys/rozrys.js` — wrapper do `applySheetStockLimit()` przekazuje wymagane zależności (`partSignature`, `isPartRotationAllowed`) i podbija `stockPolicy` do `v3`, żeby nie używać błędnych planów z cache po poprzedniej paczce.
- `index.html` — podbite cache-busting dla całego zestawu modułów ROZRYS powiązanych z tą paczką.

### 2026-03-26 — rozrys_module_split_v2
- `js/app/rozrys/rozrys.js` — dalsze odchudzenie przez przeniesienie pickerów, rysowania arkuszy, limitu stanów magazynowych i renderu accordionu do modułów pomocniczych bez zmiany UI.
- `js/app/rozrys/rozrys-pickers.js` — wydzielone modale wyboru pomieszczeń oraz materiału / grupy w ROZRYS.
- `js/app/rozrys/rozrys-sheet-draw.js` — wydzielone odświeżanie canvasów i rysowanie arkuszy / formatek.
- `js/app/rozrys/rozrys-stock.js` — przejęta logika `applySheetStockLimit()` dla wykorzystania stanów magazynowych przed pełną płytą.
- `js/app/rozrys/rozrys-accordion.js` — przejęty render sekcji materiałów w accordionie wyników.
- `index.html` — dopięte nowe pliki i pełny cache-busting `20260326_rozrys_split_v2`.

### 2026-03-26 — rozrys_module_split_v1
- `js/app/rozrys/rozrys.js` — odchudzony przez delegację części funkcji do nowych modułów pomocniczych bez zmiany UI i bez zmiany solverów.
- `js/app/rozrys/rozrys-choice.js` — wydzielone launchery wyboru i overlay wyboru dla customowych dropdownów ROZRYS.
- `js/app/rozrys/rozrys-print.js` — wydzielone CSV / pobieranie / otwieranie wydruku oraz pomiar nagłówka PDF.
- `js/app/rozrys/rozrys-stock.js` — wydzielone helpery formatu bazowego, magazynu i podaży arkuszy.
- `js/app/rozrys/rozrys-cache.js` — wydzielone helpery cache planów rozkroju.
- `js/app/rozrys/rozrys-accordion.js` — wydzielone helpery accordionu materiałów i tytułów sekcji.
- `index.html` — podbite cache-busting dla wszystkich plików powiązanych z tą paczką i dopięte nowe moduły ROZRYS.

### 2026-03-26 — list_scroll_restore_v1
- `js/app/ui/list-scroll-memory.js` — nowy, mały moduł pamięci pozycji listy dla `WYWIAD` i `MATERIAŁ`; zapamiętuje aktywną szafkę i offset scrolla przed wejściem w edycję, a po `Zatwierdź / Anuluj` przywraca dokładnie ten sam rejon listy zamiast wyrzucać na górę.
- `js/app/cabinet/cabinet-modal.js` — modal szafki zapisuje kontekst listy przy wejściu w `Edytuj` i po zamknięciu próbuje odtworzyć poprzednią pozycję.
- `js/app.js` — po przebudowie listy woła przywrócenie scrolla, żeby zapis edycji nie zrzucał użytkownika na początek.
- `index.html` — podbite cache-busting dla wszystkich plików powiązanych z tą paczką i dodany nowy moduł listy.

### 2026-03-21 — rozrys_ui_pdf_guard_v1
- `js/app/rozrys/rozrys.js` — uporządkowane akcje i logika stanów `Wyjdź / Anuluj / Zapisz/Zatwierdź` w pickerach ROZRYS oraz w modalu `Dodaj płytę do magazynu`; modal dodawania płyty przeniesiony na wspólny `panelBox`; eksport PDF ma bezpieczniejsze liczenie wysokości nagłówka przy długich nazwach materiałów.
- `js/app/ui/panel-box.js` — `panelBox.open()` obsługuje teraz opcjonalny `beforeClose`, żeby modal mógł zablokować zamknięcie przy niezapisanych zmianach.
- `css/style.css` — wzmocnione zawijanie długich nazw w nagłówkach/pickerach/akordeonach oraz usunięta kolizja układu paska akcji ROZRYS między CSS a inline-style.
- `index.html` — podbite cache-busting dla plików powiązanych z tą paczką.

## Stałe zasady pracy

1. **Bez zmiany UI bez zgody użytkownika.**
   - Nie zmieniać wyglądu, układu, sposobu prezentacji ani sposobu rysowania bez zgody.
   - Dopuszczalne są tylko drobne fixy błędów technicznych, które nie zmieniają wyglądu.

2. **Każda seria zmian kończy się pełną paczką `site.zip`.**
   - ZIP ma zawierać całą strukturę repo.
   - Obowiązkowo muszą być w nim `README.md` i `DEV.md`.
   - Nic nie może „zniknąć” z paczki przez przypadek.

3. **Zawsze pracujemy na ostatnim ZIP-ie wygenerowanym w rozmowie.**
   - To jest jedyna baza do kolejnych zmian.
   - Nie wracamy do starszych ZIP-ów, chyba że użytkownik wyraźnie tak każe.

4. **Najpierw porządek architektoniczny, potem duży rozwój.**
   - Aktualizować mapę aktywnych plików.
   - Oznaczać pliki legacy / nieładowane przez `index.html`.
   - Utrzymywać checklistę regresji.

5. **Nowe akcje UI dodajemy przez `data-action` + Actions registry.**
   - HTML: `data-action="twoja-akcja"`
   - Rejestr: `js/app/ui/actions-register.js`
   - Unikać dokładania luźnych `onclick` / `addEventListener`, jeśli nie są naprawdę konieczne.

6. **Optimax rozwijamy głównie w tych plikach:**
   - `js/app/rozrys/rozrys.js`
   - `js/app/optimizer/cut-optimizer.js`
   - `js/app/strip-solver.js`
   - Nie dokładamy tam logiki bokiem do `app.js`, poza koniecznymi mostami do istniejących danych projektu.

7. **Duży `js/app.js` traktować ostrożnie.**
   - Stopniowo wyciągać logikę do właściwych modułów.
   - Bez przebudowy UI.
   - Bez mieszania kilku odpowiedzialności w jednym miejscu bardziej niż to konieczne.

8. **Szczególnie uważać na regresje w:**
   - `js/app.js`
   - `js/app/ui/bindings.js`
   - modalach
   - przełączaniu widoków
   - `renderCabinets()`
   - zapisie / odczycie sesji projektu

---

## Mapa aktywnych plików (entrypointy i główne odpowiedzialności)

### Start / core
- `index.html` — struktura widoków i lista realnie ładowanych skryptów.
- `js/boot.js` — bezpieczny start + czerwony banner błędów; po odświeżeniu zachowuje ostatni sensowny kontekst pracy zamiast wymuszać stronę główną.
- `js/core/actions.js` — registry dla `data-action`.
- `js/core/modals.js` — wspólna obsługa modali.

### App — aktywnie ładowane przez `index.html`
- `js/app/shared/constants.js` — stałe.
- `js/app/shared/utils.js` — helpery.
- `js/app/shared/storage.js` — wrappery localStorage.
- `js/app/shared/ui-state.js` — stan UI.
- `js/app/investor/session.js` — zapis / odczyt sesji projektu.
- `js/app/investor/investors-store.js` — dane inwestorów.
- `js/app/investor/investor-ui.js` — aktywne UI inwestora.
- `js/app/investor/investor-pdf.js` — karta PDF danych inwestora do druku / segregatora, generowana z modelu danych.
- `js/app/ui/sections.js` — sekcje widoków typu inwestor / rozrys / magazyn.
- `js/app/ui/views.js` — przełączanie widoków.
- `js/app/shared/validate.js` — walidacja danych.
- `js/app/ui/bindings.js` — listenery i delegacja zdarzeń.
- `js/app/ui/actions-register.js` — rejestr akcji `data-action`.
- `js/app.js` — główny klej aplikacji + nadal część logiki domenowej; renderery `WYWIAD`, `MATERIAŁ` i `RYSUNEK` są już wydzielone do `js/tabs/*`.
- `js/app/investor/investor-project.js` — projekt inwestora.
- `js/app/ui/tabs-router.js` — routing zakładek.
- `js/app/optimizer/cut-optimizer.js` — główny silnik rozkroju i eksport API Optimax.
- `js/app/strip-solver.js` — wydzielony solver trybów pasowych (`Preferuj pasy wzdłuż / w poprzek`), odseparowany od eksperymentów z trybem opcjonalnym.
- `js/app/optional-solver.js` — przepisany solver trybu `Opcjonalnie`; buduje arkusz od 1–2 pasów startowych z grup podobnych wymiarów, a resztę prostokąta dogęszcza solverem pasowym.
- `js/app/material/magazyn.js` — logika magazynu.
- `js/app/material/price-modal.js` — modal cenników z aplikacyjnymi launcherami wyboru i boxami zamiast systemowych dialogów.
- `css/rozrys-reference-sync.css` — wizualne ujednolicenie ROZRYS względem zaakceptowanych wzorców UI.
- `css/rozrys-checkboxes.css` — wspólna skórka checkboxów ROZRYS bez systemowego highlightu.
- `css/rozrys-scope-chip-room-sync.css` — punktowy override tylko dla małych kafelków zakresu materiału w pickerze `Materiał / grupa`, żeby zachowywały się jak kafelki wyboru pomieszczeń.
- `js/app/rozrys/rozrys-choice.js` — launchery i overlaye wyboru w ROZRYS.
- `js/app/rozrys/rozrys-state.js` — centralny store stanu ROZRYS (selection/options/ui/cache) używany jako wspólne źródło prawdy dla zakładki.
- `js/app/rozrys/rozrys-print.js` — eksport CSV / druk / helpery PDF w ROZRYS.
- `js/app/rozrys/rozrys-print-layout.js` — techniczny layout PDF/druk dla ROZRYS.
- `js/app/rozrys/rozrys-sheet-model.js` — model arkuszy/magazynu: dopasowanie formatów, podpisy, odejmowanie zużytych formatek, helpery podaży arkuszy.
- `js/app/rozrys/rozrys-sheet-helpers.js` — helpery canvas dla rysowania arkuszy.
- `js/app/rozrys/rozrys-sheet-draw.js` — główne rysowanie arkuszy na canvas.
- `js/app/rozrys/rozrys-stock.js` — helpery magazynu, formatu bazowego i podaży arkuszy dla ROZRYS; po tej paczce deleguje model danych do `rozrys-sheet-model.js`.
- `js/app/rozrys/rozrys-cache.js` — helpery cache planów ROZRYS.
- `js/app/rozrys/rozrys-accordion.js` — helpery accordionu materiałów ROZRYS.
- `js/app/rozrys/rozrys-lists.js` — listy i karty wyników ROZRYS: `Lista formatek`, `Formatki arkusza`, karta podsumowania, launchery eksportu i karty arkuszy.
- `js/app/rozrys/rozrys-render.js` — helpery auto-renderu z cache, renderu wyników i spinnera ROZRYS; po tej paczce deleguje karty/listy do `rozrys-lists.js`.
- `js/app/rozrys/rozrys-summary.js` — diagnostyka i modale walidacji/list ROZRYS, oparte o `rozrys-lists.js`.
- `js/app/rozrys/rozrys.js` — główna logika zakładki rozrysu / Optimax po dalszym oddelegowaniu pickerów, stanu, modelu arkuszy, rysowania, logiki stock-limit, auto-renderu i renderu wyników do modułów pomocniczych.

### Zakładki aktywnie ładowane przez `index.html`
- `js/tabs/wywiad.js — WYWIAD (pełny renderer w module)` — aktywny renderer zakładki WYWIAD.
- `js/tabs/rysunek.js` — aktywny renderer zakładki RYSUNEK.
- `js/tabs/material.js` — aktywny renderer zakładki MATERIAŁ.
- `js/tabs/czynnosci.js`
- `js/tabs/wycena.js` — zakładka `Wycena` z własnym layoutem list i snapshotem wyceny.

---

## Pliki obecne w repo, ale nieładowane bezpośrednio przez `index.html`

Te pliki **nie są entrypointami strony** i przed poprawkami trzeba najpierw sprawdzić, czy są naprawdę używane pośrednio:

- `js/app/investor/inwestor.js` — stary wariant UI inwestora; w praktyce aktywnym plikiem jest `investor-ui.js`.
- `js/app/shared/calc.js` — warstwa obliczeń pomocniczych; obecnie nieładowana z `index.html`.
- `js/app/shared/migrate.js` — migracje schematu; obecnie nieładowane z `index.html`.
- `js/app/shared/schema.js` — osobny moduł schematu; obecnie nieładowany z `index.html`.
- `js/app/optimizer/panel-pro-worker.js` — nie jest ładowany jako zwykły script, ale jest używany pośrednio jako Web Worker z `rozrys.js`.

### Zasada dla takich plików
Najpierw sprawdzić, czy plik jest:
1. ładowany przez `index.html`,
2. tworzony dynamicznie (np. Worker),
3. tylko historyczny / legacy.

Dopiero potem go zmieniać.

---

## Gdzie szukać problemów

- **klik nie działa** → `js/app/ui/bindings.js`, `js/app/ui/actions-register.js`
- **akcja robi złą rzecz** → `js/app/ui/actions-register.js` + handler domenowy
- **modal źle się zamyka / nakłada** → `js/core/modals.js` + miejsca domenowe w `app.js`
- **widok źle się przełącza** → `js/app/ui/views.js`, `js/app/ui/sections.js`, `setActiveTab()` w `js/app.js`
- **rozjeżdżają się dane projektu** → `js/app/investor/session.js`, `js/app/shared/storage.js`, `js/app/shared/validate.js`, fragmenty `js/app.js`
- **szafki renderują się źle / znikają** → `renderCabinets()` i wszystko, co go wywołuje
- **Optimax / rozrys działa źle** → `js/app/rozrys/rozrys.js`, `js/app/optimizer/cut-optimizer.js`, ewentualnie worker
- **MAX wygląda na zawieszony na starcie** → najpierw sprawdzić `js/app/rozrys/rozrys.js` (start workera / fallbacki / status UI), potem `js/app/optimizer/panel-pro-worker.js`; nie wpadać cicho w ciężki sync fallback na głównym wątku.

---

## Najbardziej ryzykowne miejsca pod regresje

1. `js/app.js` — duży plik z wieloma odpowiedzialnościami.
2. `renderCabinets()` — centralny render części aplikacji.
3. `setActiveTab()` — łatwo zepsuć przełączanie i odświeżanie.
4. `initUI()` — start i spinanie całej aplikacji.
5. `js/app/ui/bindings.js` — łatwo dodać duble listenerów.
6. modale — overlay / ESC / zamykanie po akcji.
7. zapis i przywracanie sesji projektu.
8. mosty między główną aplikacją a zakładką rozrysu / Optimax.

---

## Checklista regresji przed wydaniem ZIP-a

### Start / nawigacja
- [ ] Strona główna startuje bez błędu.
- [ ] Kafelki / przejścia z ekranu startowego działają.
- [ ] Widoki przełączają się poprawnie.
- [ ] Nie ma martwych klików po powrocie między ekranami.

### Inwestor / projekt
- [ ] Lista inwestorów się otwiera.
- [ ] Nowy inwestor działa.
- [ ] Edycja inwestora działa.
- [ ] `Zapisz` zapisuje.
- [ ] `Anuluj` nie zapisuje i przywraca poprzedni stan.
- [ ] Wejście do projektu / pomieszczenia działa.

### Zakładki projektu
- [ ] `WYWIAD` działa.
- [ ] `RYSUNEK` działa.
- [ ] `MATERIAŁ` działa.
- [ ] `CZYNNOŚCI` działa.
- [ ] `WYCENA` działa.
- [ ] Przełączanie zakładek nie psuje danych.

### Szafki / render
- [ ] Dodanie szafki działa.
- [ ] Edycja szafki działa.
- [ ] Usunięcie działa.
- [ ] `renderCabinets()` nie wywala błędów.

### Modale / mobile safety
- [ ] Modale otwierają się i zamykają poprawnie.
- [ ] Overlay zamyka modal tam, gdzie powinien.
- [ ] ESC zamyka poprawny modal.
- [ ] Nie ma click-through po zamknięciu modala.

### Optimax / rozrys / magazyn
- [ ] Zakładka rozrysu się otwiera.
- [ ] Liczenie rozkroju działa.
- [ ] Zmiana ustawień rozkroju działa.
- [ ] Worker (jeśli użyty) nie wywala błędu.
- [ ] Magazyn nie gubi danych.
- [ ] Picker zakresu / materiału w ROZRYS otwiera własne okno zamiast systemowej listy.
- [ ] Wybór jednego materiału pokazuje tylko ten materiał.
- [ ] Zwinięte accordiony po rozwinięciu dalej pokazują wszystkie arkusze.

### Trwałość danych
- [ ] Odświeżenie strony nie gubi aktywnego projektu.
- [ ] Zapis do localStorage działa.
- [ ] Odczyt z localStorage działa.
- [ ] Stare dane nie rozwalają startu aplikacji.

### Techniczne minimum
- [ ] `node --check js/app.js`
- [ ] ZIP zawiera cały repo, w tym `README.md` i `DEV.md`

---

## Kierunek dalszego porządkowania bez zmiany UI

1. Nie dopisywać nowych dużych rzeczy do `js/app.js`, jeśli mają naturalne miejsce w module.
2. Stopniowo wynosić logikę domenową z `app.js` do właściwych plików.
3. Utrzymywać jedną prawdę dla akcji UI: `data-action` + registry.
4. Przy każdej większej zmianie aktualizować ten plik (`DEV.md`).


- `js/app/material/price-modal.js (renderer + akcje modala cenników)` — wydzielony renderer modala cenników; `app.js` ma być tu tylko delegatorem.
- Martwy helper `renderFinishList()` został usunięty z `app.js`; aktywna logika wykończeń dla RYSUNKU ma siedzieć w module zakładki.


- `js/app/ui/tab-navigation.js` — centralna nawigacja zakładek i skoki między WYWIAD ↔ MATERIAŁ; źródło prawdy dla `setActiveTab()` i helperów focus/scroll.
- `js/app/ui/layout-state.js` — helpery layoutu/wykończeń RYSUNKU i zapisu projektu; źródło prawdy dla `ensureLayout()`, `saveProject()` i pokrewnych helperów.

- `js/app/ui/list-scroll-memory.js` — cienka pamięć pozycji scrolla i kotwicy szafki przy przejściach `Edytuj ↔ lista` w `WYWIAD` i `MATERIAŁ`.


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


- Step 24: `app.js` odchudzone przez skrócenie dużych lokalnych wrapperów `material-common` i `front-hardware`; źródłem prawdy pozostają moduły `js/app/material/material-common.js` i `js/app/cabinet/front-hardware.js`, a w `app.js` zostały tylko cienkie delegatory z minimalnym fallbackiem.

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


- `js/app/material/material-registry.js` — registry producentów i helper `materialHasGrain()` wydzielone z `app.js`.

- `schema.js` is now the primary source of truth for project/room normalization; `app.js` keeps only a minimal emergency fallback.
- `js/app/material/material-registry.js` jest źródłem prawdy dla producentów materiałów i helpera `FC.materialHasGrain(...)`.

- Step 40: przebudowa UI części ROZRYS pod Optimax (profile A→DD, kierunek opcjonalnie/wzdłuż/w poprzek, rzaz, obrównanie, minimalny użyteczny odpad) oraz nowy pasowy packer `packStripBands()` dla trybów wzdłuż/w poprzek.

- Step 61: tryby pasowe `wzdłuż` / `w poprzek` dostały mocniejsze legacy-strip dopakowanie końcówek (`packStripBands`): preferencja orientacji zgodnej z kierunkiem, fill resztek po pasach przez wolne prostokąty oraz łagodny bonus dla pełnych rzędów/kolumn.


## Step 62
- Rewritten `packStripBands()` in `js/app/optimizer/cut-optimizer.js` for stable `wzdłuż` / `w poprzek` strip modes.
- Strip selection now evaluates multiple candidate strip heights and uses a width DP to choose the best-fitting group for each strip.
- Residual free rectangles are also created under shorter pieces inside a strip, then globally filled.
- Goal: restore practical strip behavior (group-oriented, near-full strips, <=100 mm acceptable tail waste) without relying on `optional` heuristics.
- Step 63: tryby pasowe `wzdłuż` / `w poprzek` dostały twardą preferencję orientacji końcowej na poziomie doboru kandydatów (`preferredCandidatesForItem` w `js/app/optimizer/cut-optimizer.js`). Jeśli dla elementu istnieje wariant zgodny z wybranym kierunkiem pasa, solver używa go zamiast mieszać orientacje w residual fill / planowaniu pasa.

- Step 64: `packStripBands()` przebudowany na pełny search wariantów dla jednej płyty. Tryby `wzdłuż` / `w poprzek` porównują teraz kilka strategii budowy pasów dla całego arkusza, wybierają najlepszy cały arkusz po occupancy / dużych pustkach, a dopiero potem przechodzą do następnej płyty. To ma ograniczyć duże białe pola i monotonne słabe układy.


## step65
- Strip modes (`wzdłuż` / `w poprzek`) dostały endgame dla ostatnich 2 płyt: dodatkowe strategie i więcej testów obrotu, oceniane wspólnie jako para arkuszy.
- W ogonie solver premiuje większe dociśnięcie przedostatniej płyty i bardziej kompaktową ostatnią płytę.

- step66: wzmocniono końcówkę trybów pasowych (`wzdłuż`/`w poprzek`) o strategie exact-band/exact-band-rot, silniejszą kontrolę pełnych pasów jednowymiarowych oraz scoring premiujący równomierne pasy na ostatnich 2 płytach.

- step67: profile A–D w Optimax przeszedł z budżetu czasowego na budżet prób (`maxAttempts`) z osobnym limitem `endgameAttempts=200` dla końcówki. `rozrys.js` pokazuje teraz próby zamiast sekund. W workerze strip modes dostały tylko lokalny polish ostatniego arkusza przez ponowne sortowanie/repack ostatniego sheetu; główne planowanie pasów nie zostało ruszone.

- step68: bez zmiany rdzenia algorytmu zmieniono nazwy trybów cięcia na uczciwsze (`Preferuj pasy wzdłuż/poprzek`) oraz poprawiono raportowanie postępu prób. Worker wysyła teraz osobno postęp prób głównych i końcówki ostatniego arkusza, dzięki czemu licznik nie stoi pozornie w miejscu ani nie skacze na końcu.

- step69: doprecyzowano raportowanie postępu prób w Optimax. Worker wysyła teraz nie tylko liczbę ukończonych prób, ale też numer aktualnie analizowanej próby (`currentAttempt` / `currentTailAttempt`) i fazę (`main` / `tail`). UI pokazuje dzięki temu bardziej realny stan: `Ukończone ...` oraz `W toku ...`, zamiast sprawiać wrażenie, że licznik stanął.
- step72: uproszczono UI postępu w `js/app/rozrys/rozrys.js`. Usunięto górny globalny licznik/box postępu (`rozrysGlobalStatus`) i zostawiono tylko lokalny licznik przy aktualnie liczonym materiale. Z opisu zniknął też etap/faza liczenia — status pokazuje już tylko materiał i `Najlepsze`.
- step73: wydzielono tryby pasowe do osobnego pliku `js/app/strip-solver.js`. `js/app/optimizer/cut-optimizer.js` zachowuje tylko wrapper `packStripBands()` + wspólne API, a `index.html` ładuje teraz osobno solver pasowy przed silnikiem głównym. Cel: odseparować `Preferuj pasy wzdłuż / w poprzek` od ryzykownych zmian w innych heurystykach Optimax.


## 2026-03-11 — step75
- `js/app/strip-solver.js`: stabilny solver trybów „Preferuj pasy wzdłuż / w poprzek”; nie mieszać z optional.
- `js/app/optional-solver.js`: nowy solver trybu „Opcjonalnie kierunek cięcia”. Liczy płyta po płycie, porównuje pełne warianty `along/across` oraz warianty hybrydowe z jednym głównym splitem i zmianą kierunku w drugiej części płyty. Końcówka dopieszcza ostatnie 2 płyty i jeszcze raz ostatnią.
- `js/app/optimizer/panel-pro-worker.js`: worker importuje teraz `optional-solver.js` i dla trybu optional korzysta z oddzielnego toru liczenia, bez dotykania solvera pasowego.


- step76: optional dostał bardziej produkcyjny scoring końcówki: kara za śmieciowy odpad / utylizację (małe i pocięte resztki), premia za grupowanie drobnicy w jednym wspólnym rzędzie/pasie oraz finalny rebalance ostatnich 2 płyt przed polish ostatniej. Zmiany zamknięte wyłącznie w `js/app/optional-solver.js`; tryby pasowe w `js/app/strip-solver.js` pozostają bez zmian.
- step89: tryb `Opcjonalnie` dostał mocniejsze reguły konstrukcyjne pod pasy startowe i słabe pasy. Solver próbuje teraz startować od konkretnych dużych formatek, wymusza 2. pas tylko gdy oba pasy mają >=90% zapełnienia, po pasie startowym ocenia resztę zarówno wzdłuż, jak i w poprzek, a słabe pasy (>20% odpadu) próbuje przebudować przez wyrzucenie zbyt małych elementów i dołożenie podobnej drobnicy w grupie +/- 75 mm. Worker dostał nowy znacznik cache `20260312_optional_v8` / `20260312_optional_rewrite_v8`.

- step77: tryby pasowe (`js/app/strip-solver.js`) dostały scrap-aware tail polish w obrębie residual fill i score: kara za śmieciowy odpad / długie cienkie ścinki oraz nowy shared-row fill dla drobnicy w resztkowych prostokątach, żeby częściej grupować małe elementy obok siebie zamiast otwierać wiele pojedynczych mikro-stref.


- `js/app/optional-solver.js` — solver trybu „Opcjonalnie”; od step79 uczy się od stabilnych solverów pasowych (`along/across`) przez kandydaty bazowe i dogęszczanie największych wolnych prostokątów przeciwnym kierunkiem, bez zmiany działania samych trybów pasowych.

- step81: `js/app/optional-solver.js` dostał nowy typ kandydatów `seed-*` inspirowany proponowanym algorytmem pasa startowego: optional próbuje zbudować 1 mocny pas startowy z grupy podobnych formatów (oraz 2. pas tylko gdy oba są bardzo dobrze wypełnione), a dopiero resztę płyty dopycha solverem pasowym. Kandydaty `seed-*` korzystają z grupowania podobnych wymiarów i mogą używać obrotu formatek, jeśli wolno. To pierwszy krok w stronę modelu „1–2 pasy startowe + dalsze liczenie reszty płyty”.


## 2026-03-12 — optional solver rewrite v2
- `js/app/optional-solver.js` przepisany ponownie jako konstrukcyjny solver: 1–2 pasy startowe z klastrów podobnych wymiarów, potem dogęszczenie reszty drugim kierunkiem przez solver pasowy.
- Nie zmieniano `js/app/strip-solver.js`; tryby wzdłuż / w poprzek pozostają bezpieczne i osobne.
- Podbito wersję workera w `js/app/rozrys/rozrys.js`, żeby przeglądarka nie trzymała starego worker cache.

- 2026-03-12: optional solver v3 — naprawa cache workera (importScripts z query string), poprawka klastrów podobnych wymiarów (<= tolerancji zamiast >), mocniejsza preferencja zmiany kierunku po pasie startowym.

- Step 85: Optional solver tightened to avoid immediate fallback when no 80% seed band exists; it now picks the best constructive seed candidate, forces opposite-direction residual fill after 1-2 seed bands, and bumps worker/script cache versions to v4.


- 2026-03-12 step86: Opcjonalny residual po 1-2 pasach jest już budowany własnym konstruktorem przeciwnych pasów (`packBandsInAxis`), a nie przez miękki fallback do solvera pasowego. Dodany cache-bust v5 dla workera/solverów.

- 2026-03-12: optional-solver v6 — seed plans oparte na klastrach rodzin szerokości/wysokości (z preferencją szerokich pasów), maxAttempts steruje realną liczbą sprawdzanych konstrukcyjnych wariantów; worker i cache-busting podbite do v6.

- 2026-03-12: Optionalnie v7: residual po pasach startowych wypełniany najpierw solverem pasowym w osi przeciwnej; wybór kandydatów preferuje wyższą zajętość arkusza i szerszy pierwszy pas; tail rebalance i polish tylko przy realnej poprawie zajętości/odpadu.

- 2026-03-12 step90: usunięto tryb `Opcjonalnie` z UI ROZRYS i ścieżki workera. Kierunek cięcia został zredukowany do dwóch trybów: `Preferuj pasy wzdłuż` oraz `Preferuj pasy w poprzek`. Stare konfiguracje `auto/optional` są normalizowane do `along`, a worker nie importuje już `optional-solver.js`.


## 2026-03-12 — krok 91: tryb Optima w Optimax
- Dodano nowy solver `js/app/optima-solver.js` i nową opcję kierunku cięcia `Optima`.
- `Optima` działa osobno od klasycznych pasów wzdłuż/poprzek: próbuje obu orientacji arkusza, startuje od mocnych pasów i robi lokalną poprawę końcówki.
- W `rozrys.js` dodano wstępny szacunek liczby płyt na podstawie sumy pól formatek i pokazywanie go podczas liczenia.
- Web Worker ma nowy cache-bust `20260312_optima_v1` i ładuje `optima-solver.js`.
- Profile A/B/C/D dla trybu `Optima` mają większy budżet czasu na płytę niż klasyczne tryby pasowe.

## 2026-03-12 — krok 92: korekta trybu Optima
- Podniesiono docelowe wypełnienie dalszych pasów z 80% do 90% i mocniej karane są końcówki pasa z dużym pustym ogonem.
- `js/app/optima-solver.js` dostał dodatkowe dogęszczanie wolnych prostokątów po głównych 1–2 pasach, żeby lepiej wypełniać końce pasów i resztki po obrocie.
- Podbito cache-bust workera/solverów do `20260312_optima_v2`.


## 2026-03-13 — site_step99_remove_time_limits
- Usunięto limity czasowe z trybów Optimax (Optima / wzdłuż / w poprzek) w ścieżce workerowej.
- Profile A/B/C/D różnią się dalej liczbą prób/seedów, ale nie timeoutem na płytę.
- Usunięto timeout watchdoga w `computePlanPanelProAsync`, żeby worker nie kończył liczenia przedwcześnie.
- `packGuillotineBeam` nie ucina już liczenia budżetem `timeMs`; kończy po domknięciu arkusza.

## 2026-03-14 — krok 106: przebudowa rozrysu na osobne moduły kierunku i szybkości
- Usunięto stare pliki solverów rozkroju: `js/app/strip-solver.js`, `js/app/optima-solver.js`, `js/app/optional-solver.js`.
- Dodano osobne moduły kierunku startu:
  - `js/app/optimizer/start-along.js` → `Pierwsze pasy wzdłuż` (wymusza oś `along`)
  - `js/app/optimizer/start-across.js` → `Pierwsze pasy w poprzek` (wymusza oś `across`)
  - `js/app/optimizer/start-optimax.js` → `Opti-max`
- Dodano osobne moduły szybkości liczenia:
  - `js/app/optimizer/speed-turbo.js` → `Turbo` (shelf)
  - `js/app/optimizer/speed-dokladnie.js` → `Dokładnie`
  - `js/app/optimizer/speed-max.js` → `MAX`
- `MAX` realizuje aktualny rdzeń algorytmu użytkownika: 1–2 pasy startowe, sprawdzanie pasa po powierzchni, obowiązkowa zmiana kierunku po pasach startowych, bez otwierania nowej płyty przed zamknięciem poprzedniej.
- `js/app/optimizer/cut-optimizer.js` został uproszczony do wspólnych narzędzi i shelf fallbacku.
- `js/app/optimizer/panel-pro-worker.js` został napisany od nowa pod nowy podział start/szybkość.
- `js/app/rozrys/rozrys.js` i `index.html` zostały przepięte na nowe opcje UI i nowe pliki.

- Step 18: kept cut-direction select order as `wzdłuż -> w poprzek -> Opti-max` to match requested UI order without changing solver logic.

- 2026-03-14: swapped runtime behavior of `start-along` and `start-across` for all Panel PRO speed modes (Turbo, Dokładnie, MAX) so labels stay the same but `wzdłuż` starts along board length and `w poprzek` starts across board width; bumped solver cache-busting version to `20260314_max_plan_v1`.

- `js/app/rozrys/rozrys.js` steruje teraz też stanem przycisku generowania: brak cache = zielony `Generuj rozkrój`, cache hit / gotowy wynik = niebieski `Generuj ponownie`, liczenie = czerwony `Anuluj`.

- 2026-03-14: przebudowano `js/app/optimizer/speed-max.js`, żeby `MAX` wybierał najlepszy pełny plan arkusza po ocenie całych kandydatów 1–2 pasów startowych, a nie tylko pojedynczego najlepszego pierwszego pasa. `MAX` dalej zamyka arkusz przed otwarciem następnego, trzyma obowiązkową zmianę kierunku po pasach startowych i zachowuje repair słabego pasa; podbito cache-busting do `20260314_max_plan_v1`.


---

## Ostatnie zmiany robocze

- ROZRYS: dodany widoczny status liczenia z animacją, paskiem postępu orientacyjnego, licznikiem sekundowym i opisem aktualnie liczonego materiału / koloru.
- ROZRYS: przy starcie generowania wymuszony repaint UI przed cięższą pracą, żeby przycisk szybciej przechodził w czerwony stan `Anuluj` także na telefonach.
- ROZRYS: status pokazuje też szacunkową liczbę płyt i bieżący numer arkusza, jeśli worker raportuje postęp.
- ROZRYS: pozostawiony fallback twardego zatrzymania workera, żeby UI nie wisiało przy anulowaniu.
- ROZRYS: usunięto górny, zdublowany status z licznikiem; zostawiono tylko jeden status w obszarze wyniku.
- ROZRYS: pasek postępu idzie teraz proporcjonalnie do policzonych płyt względem oszacowania (np. 3 z ~5 = 60%%).
- 2026-03-14: przebudowano `js/app/optimizer/speed-max.js` jeszcze raz pod spec użytkownika: `MAX` liczy teraz pojedynczy wariant arkusza dla zadanego startu osi, robi 1–2 idealne pasy startowe, potem obowiązkowo zmienia kierunek i domyka resztę kolejnymi idealnymi pasami; dopiero gdy w danej osi nie ma idealnego pasa, sprawdza zmianę osi i na końcu fallback do najlepszego nieidealnego pasa. `Opti-max` porównuje już tylko 1 wariant startu wzdłuż vs 1 wariant startu w poprzek. Worker i UI dostały dokładniejsze fazy progresu oraz licznik „zamknięta płyta X / liczę płytę Y”.

- 2026-03-14: przebudowano `js/app/optimizer/speed-max.js` jeszcze raz pod doprecyzowaną specyfikację użytkownika: `MAX` buduje każdy pas od największego aktualnie pasującego elementu, sprawdza dla tego pasa obie dozwolone orientacje, dobiera formatki o tej samej grubości pasa lub mniejsze maks. o 75 mm, próbuje kolejno progi 90% i 80% (z wyjątkiem drugiego pasa startowego, który powstaje tylko przy 90%), a dopiero po niepowodzeniu zmienia kierunek lub schodzi do fallbacku. Nie ruszano działania trybów startu `wzdłuż` / `w poprzek`; podbito cache-busting do `20260314_max_user_algo_v1`.


## 2026-03-15 — MAX seed sweep and tiny-block grouping
- `js/app/optimizer/speed-max.js`: MAX now reviews all sensible seed starts for a band (unique fitting start sizes, biggest-to-smaller) before lowering threshold or switching axis.
- `js/app/optimizer/speed-max.js`: tiny repeat parts can be paired into grouped block candidates inside a band to reduce scattered micro-strips.
- `js/app/optimizer/panel-pro-worker.js`, `js/app/rozrys/rozrys.js`, `index.html`: cache-busting bumped for the new MAX solver build.

- 2026-03-15: MAX now scans seeds sequentially from largest area to smaller and accepts the first seed that reaches the requested occupancy target; ROZRYS waste summary uses full board dimensions and drawing shows the trim border around the usable area.

- 2026-03-15: ROZRYS — dodano procent odpadu przy nagłówku każdego arkusza (widok i eksport PDF/druk), liczony od pełnej płyty.

- 2026-03-15: `js/app/optimizer/speed-max.js` tuned per user request: MAX now tests only the top 5 unique seed starts for each band (largest unique candidates first) and raises the secondary occupancy threshold from 80% to 85%; cache-busting updated to `20260315_max_top5_90_85_v1`.
- 2026-03-15: `js/app/optimizer/speed-max.js` — start-pass 1 i 2 mają teraz twardą kolejność `90% -> 85% -> dopiero fallback`, z testem top 5 unikalnych seedów i obu orientacji każdego seeda; fallback został przerobiony na preferencję fizycznego cięcia po długości płyty (wewnętrzna oś `across`) z układaniem od najszerszych do najwęższych elementów.
- 2026-03-15: `js/app/optimizer/speed-max.js` — ostatni arkusz może być oznaczony jako wirtualne `0.5` płyty, jeśli komplet pozostałych elementów mieści się na połowie formatu; `js/app/rozrys/rozrys.js` liczy wtedy podsumowanie i % odpadu dla tej połówki, ale nadal rysuje arkusz na pełnej płycie.
- 2026-03-15: `js/app/optimizer/panel-pro-worker.js`, `js/app/rozrys/rozrys.js` — cache-busting bumped to `20260315_max_virtual_half_v1`.

- 2026-03-15: magazyn rozróżnia teraz pełne i realne pół płyty przez format; ROZRYS wybiera największy format jako hint, a MAX może użyć realnej połówki z magazynu na końcówce (rysowanej nadal na pełnym arkuszu) lub tylko oznaczyć wirtualne 0,5, gdy realnej połówki brak.


## 2026-03-15 – real_half_inventory_v2
- Half-sheet detection is now strict: full length + half short side only; no rotated whole-half acceptance.
- Virtual/real half preview uses lengthwise-only logic.
- Added dashed divider line on rendered sheets when half-board logic is active.

- 2026-03-15: MAX updated: band similarity 50mm, thresholds 95%/90%, and last-sheet virtual half now re-runs normal MAX on 2800x1030 and replaces the last layout before drawing on full board. Half divider drawn as stronger dashed line above placements.
- step: uproszczono panel ROZRYS — usunięto tekst wstępny pod nagłówkiem, a opcje dodatkowe (jednostki, wymiary do cięcia, rzaz, obrównanie i minimalny użyteczny odpad) przeniesiono do pływającego okna „Opcje rozkroju” z zapisem w localStorage.


- `js/app/ui/confirm-box.js` — współdzielony modal potwierdzeń (zamiast natywnego `confirm()`), do użycia także w innych miejscach aplikacji.

- `js/app/ui/info-box.js` — mały, wielorazowy modal informacji/pomocy otwierany z ikon `?` przy polach paneli.
- 2026-03-18: `js/app/ui/panel-box.js` + `js/app/rozrys/rozrys-validation.js` — dodano współdzielone okno list/diagnostyki dla ROZRYS oraz walidację rozkroju względem snapshotu; `Lista formatek` pokazuje teraz RAW snapshot 1:1 z Materiałów, listę do rozkroju po scaleniu i wynik walidacji, a każdy arkusz ma własną listę formatek.
- 2026-03-20: `js/app/rozrys/rozrys.js`, `js/app/material/magazyn.js`, `css/style.css`, `index.html` — przebudowano źródło wyboru ROZRYS pod jeden inwestor + wiele pomieszczeń: dodano picker pomieszczeń, nowy picker materiałów per kolor z trybem fronty/korpusy, usunięto wyszukiwarkę z pickera materiałów, a lista materiałów buduje się teraz z zaznaczonych pomieszczeń i sumuje ten sam materiał między nimi. Zapis formatu z ROZRYS do Magazynu dodaje już +1 szt. do istniejącego lub nowego formatu po własnym potwierdzeniu; pola formatu i przycisk `Dodaj format` są teraz w jednym rzędzie. Regresje do sprawdzenia: wielopomieszczeniowe sumowanie HDF i laminatów, pojedynczy materiał z samymi frontami / samym korpusem / obiema grupami, ponowne generowanie z cache po zmianie pomieszczeń i poprawne dodawanie kolejnych sztuk tego samego formatu do magazynu.
- 2026-03-21: `js/app/rozrys/rozrys.js`, `css/style.css`, `index.html` — dopracowano panel ROZRYS po przebudowie wielopomieszczeniowej. Pola formatu i przycisk `Dodaj format` zostały przeniesione przy przycisku `Generuj rozkrój`, a mobile layout przestał wypychać format poza kartę. Picker pomieszczeń i picker materiału mają teraz dynamiczne stopki: bez wyboru pokazują niebieski `Zamknij`, po wyborze czerwony `Anuluj`, a zielony `Zatwierdź` aktywuje się dopiero po realnym zaznaczeniu. W pickerze materiału karty z frontami/korpusami startują bez domyślnego zaznaczenia, a górna krawędź pierwszej karty nie jest już przycinana. Poprawiono też warstwowanie `info/confirm`, żeby komunikaty nie wpadały pod główne okno panelowe. Dodatkowo ROZRYS respektuje teraz limit stanów magazynowych dla dokładnie wybranego formatu: arkusze mieszczące się w stanie są oznaczane na zielono `z magazynu`, a brakujące na czerwono `zamówić`; przy niedoborze mniejszego formatu brakujące arkusze są doplanowywane na największym formacie dla materiału zamiast bez końca schodzić poniżej stanu. Regresje do sprawdzenia: brak zasłoniętych komunikatów przy pustym wyborze pomieszczeń, poprawne położenie sekcji `Dodaj format` obok `Generuj rozkrój`, zapis materiału dopiero po ręcznym zaznaczeniu frontów/korpusów oraz oznaczenia `z magazynu` / `zamówić` przy różnych stanach magazynowych.

- 2026-03-22: ROZRYS mobile/UI fix — akcje formatu utrzymane obok przycisku generowania, picker materiału działa jako pojedynczy wybór (albo Wszystkie, albo 1 materiał), a brakujące arkusze po wyczerpaniu mniejszego formatu mają przechodzić na pełny format z aktualnych pól zamiast zamawiać kolejne małe formatki.

- 2026-03-22: `js/app/rozrys/rozrys.js`, `js/app/material/magazyn.js`, `index.html` — ROZRYS zużywa teraz najpierw realne formaty dostępne w magazynie dla danego materiału (do maksymalnego stanu i tylko w takiej liczbie arkuszy, jaka naprawdę pasuje), a dopiero brakujące elementy doplanowuje na pełnej płycie z aktualnych pól ROZRYS. Poprawiono też styl akcyjnych przycisków w obszarze ROZRYS/MAGAZYN na warianty z białą czcionką oraz usunięto natywne `confirm()`/`alert()` z bieżąco poprawianego magazynu płyt. Regresje do sprawdzenia: mały format z magazynu musi być użyty przed pełną płytą, po wyczerpaniu stanu kolejne arkusze mają mieć pełny format z pól ROZRYS, a przyciski `Dodaj format`, `Dodaj do magazynu` i `Usuń` mają zachować spójny styl kolorystyczny.
- 2026-03-22: `js/app/rozrys/rozrys.js`, `js/app/material/magazyn.js`, `css/style.css`, `index.html` — dopięto pamiętanie ROZRYS po odświeżeniu względem stanów magazynowych: klucz cache uwzględnia teraz pełny podpis formatów i ilości z magazynu dla materiału, a auto-podgląd z cache odtwarza ten sam stan co ręczne generowanie. Logika stock-first została poprawiona tak, żeby mniejsze formaty z magazynu były testowane najpierw tylko dla formatek, które fizycznie mieszczą się na danym arkuszu; dopiero reszta idzie na pełną płytę z pól ROZRYS. W Magazynie przycisk `Dodaj do magazynu` inkrementuje istniejący format zamiast nadpisywać ilość, a potwierdzenie usuwania ma już czerwone `✕ NIE` i zielone `✓ TAK` z białą czcionką. Regresje do sprawdzenia: po odświeżeniu ten sam rozkrój ma wracać z cache przy niezmienionych ustawieniach, stan magazynu ma być zużywany najpierw dla pasujących małych arkuszy, a pozycje dodawane drugi/trzeci raz do Magazynu mają zwiększać ilość zamiast ją resetować.


## 2026-03-22 — ROZRYS / format bazowy vs magazyn
- Format bazowy arkusza został przeniesiony do opcji rozkroju.
- Główny panel nie może już zmieniać bazowego formatu przez dodawanie płyty do magazynu.
- Przycisk w ROZRYS otwiera osobny modal dodawania płyty do magazynu (materiał, format, ilość).
- Regresja do sprawdzenia: po dodaniu małej płyty do magazynu bazowy format rozrysu ma pozostać bez zmian po odświeżeniu i po ponownym wejściu do ROZRYS.

- 2026-03-22: ROZRYS — opcje rozkroju: przywróć domyślne + stan Wyjdź/Anuluj/Zapisz; wizualizacja arkuszy ma używać faktycznego rozmiaru arkusza z magazynu, nie globalnego formatu bazowego.
- 2026-03-22: `js/app/rozrys/rozrys.js`, `index.html` — naprawiono reset „Przywróć domyślne” w Opcjach rozkroju tak, żeby zawsze wracał także do jednostek `cm`. Render arkuszy używa teraz wspólnej skali względem formatu bazowego, więc mniejsze płyty z magazynu są rysowane wizualnie proporcjonalnie mniejsze zamiast rozciągać się do szerokości całej karty.

- 2026-03-22: `js/app/rozrys/rozrys.js`, `index.html` — eksport PDF/druk ROZRYS przerobiony na strony A4 landscape, jedna strona = jeden arkusz z własnym nagłówkiem. Usunięto sztuczne rozciąganie obrazów w PDF (`img` nie ma już `width:100%`), więc małe arkusze z magazynu zachowują proporcjonalnie mniejszy rozmiar także w wydruku. Regresje do sprawdzenia: brak pustych stron między arkuszami, pierwszy arkusz nie może lądować samotnie po tytule, a mały arkusz z magazynu ma pozostać mniejszy wizualnie od pełnej płyty również w podglądzie PDF.
- 2026-03-22: PDF/druk ROZRYS — poprawiono składanie stron: tytuł i arkusz na tej samej stronie, bez pustych stron między arkuszami; wymuszono layout A4 poziomo i czekanie na załadowanie obrazów przed otwarciem wydruku.


- PDF/druk ROZRYS: małe arkusze mogą trafić 2 na stronę tylko bez zmiany wspólnej skali względem pełnej płyty; nie wolno ich rozciągać do wolnego miejsca strony.


- 2026-03-22: PDF eksport ROZRYS — wszystkie arkusze obracane o 90° w druku; małe arkusze mogą wejść 2 na stronę tylko przy tej samej skali względem pełnej płyty.

- 2026-03-21: ROZRYS picker materiałów — pojedyncze zakresy (np. samo `Korpusy` przy HDF) renderowane jako checkbox-chip w tym samym stylu co reszta opcji; usunięty zielony badge-only dla takich kart.
- 2026-03-22: ROZRYS action row corrected from site_hdf_checkbox base: Opcje moved into shared panel-box modal with field descriptions, top extra settings block removed, action buttons ordered Opcje → Dodaj płytę → Generuj in one row, selection launchers widened with rooms more compact and material wider.

- 2026-03-22: ROZRYS action row — przywrócono poprzedni, kolorowy styl przycisków `Opcje` / `Dodaj płytę` / `Generuj ponownie` z bazy `site_rozrys_action_row_fix.zip` i dodano delikatny glow dookoła każdego z nich bez zmiany układu jednego rzędu ani wysokości wzorcowego przycisku `Generuj ponownie`.

- 2026-03-22: ROZRYS action row — usunięto glow wokół przycisków `Opcje` / `Dodaj płytę` / `Generuj ponownie`, dodano subtelniejszą ciemną ramkę oraz obniżono wysokość przycisków, zachowując układ jednego rzędu i kolejność `Opcje → Dodaj płytę → Generuj ponownie`.

- 2026-03-22: ROZRYS action row — obniżono wysokość przycisków `Opcje` / `Dodaj płytę` / `Generuj ponownie` o kolejne 8 px względem paczki `site_rozrys_action_border_low.zip`, bez zmiany kolejności i układu jednego rzędu.

- 2026-03-22: ROZRYS action row buttons now have explicit `font-size: 16px` in `.rozrys-action-btn` so the label style no longer depends on inherited browser/default sizing.

- 2026-03-22: ROZRYS action row buttons keep explicit 16px font on larger screens and 13px on screens <=640px; layout/order unchanged.

- 2026-03-22: Wariant C przycisków ROZRYS: warsztatowy / panelowy.

- 2026-03-22: workshop variant ROZRYS action row — fixed dark text on green action buttons locally for btn-success / btn-generate-green, including hover/active/focus.

- 2026-03-22: workshop variant ROZRYS action row — wszystkie przyciski w rzędzie mają teraz ciemny napis; lekko rozjaśniono tła kolorów (zielony/niebieski/czerwony) oraz subtelnie rozjaśniono ramki, zachowując układ, wysokość i warsztatowy charakter.

- 2026-03-22: ROZRYS action row (workshop softlight) — all button labels switched to graphite (#374151); cache-busting bumped for css/style.css.

- 2026-03-22: Wariant workshop ROZRYS — przyciemniono kolor napisów przycisków z grafitu #374151 do ciemniejszego antracytu #1f2937, bez zmian układu, wysokości i tła.

- 2026-03-22: Global button press/focus visual updated across the app: removed blue rectangular tap highlight and replaced it with a rounded white press flash matching each button's border radius.
- 2026-03-22: Globalnie ujednolicono kolorowe przyciski (.btn-primary/.btn-success/.btn-danger/.btn-generate-* oraz confirm-btn w tonach success/danger/neutral) do wzorca z rzędu ROZRYS: jaśniejsze tła, rozjaśnione ramki, ciemny napis, wspólny biały flash, desktop 16px / mobile 13px; większe warianty (np. home-btn btn-primary) ścięto do tej samej wysokości wzorcowej.


## 2026-03-22 — globalny system przycisków + ROZRYS popup choice v2
- Przyciski w całej aplikacji: usunięte unoszenie przy hover/active, cień ustawiony lekko po skosie w dół/prawo, biały press flash zachowany w kształcie przycisku.
- Kolory bazowych przycisków (.btn / .btn-* / confirm-btn / room-btn / floating-add / info-trigger) dopasowane do zaakceptowanego wzorca z rzędu ROZRYS.
- Przyciski strony głównej (.home-btn) zachowują swoją dotychczasową wysokość/padding — cofnięto wcześniejsze spłaszczenie kolorowego CTA.
- ROZRYS: Szybkość liczenia i Kierunek cięcia używają własnych popupów wyboru zamiast systemowych selectów.
- Opcje rozkroju: stałe opisy pod polami usunięte; informacje są dostępne spod ikony ? przy etykietach.
- Opcje rozkroju: Jednostki i Wymiary do cięcia też używają własnych popupów wyboru zamiast systemowych selectów.

- 2026-03-22: UI polish v3 — przywrócono duży font przycisków home-btn, dopieszczono górny tab `CZYNNOŚCI` (bardziej wyśrodkowany, delikatnie ciaśniejszy napis na mobile), etykiety ROZRYS wyrównano do lewej, ikony `?` dostały własny styl graficzny, a akordeony materiałów/arkuszy w ROZRYS dostały ramkę i cień zgodne z przyciskami.


## 2026-03-22 — modal typography unify + global window close UX
- Wszystkie okna/popupy dostały ujednoliconą typografię tytułów na wzór ROZRYS/Optimax.
- Zamknięcia okien ujednolicone do kółka z `×` (panel-box, info-box, stare modale, lista inwestorów, choice popupy ROZRYS).
- `Wróć` w potwierdzeniach ustawione jako niebieski wariant neutralny.
- Górne przyciski sesji: gdy brak zmian pokazywany jest jeden niebieski `Wyjdź`; gdy są zmiany wracają `Anuluj` + `Zapisz`.


## 2026-03-23 — modal/session/cabinet fix
- Naprawiono `refreshSessionButtons` w `js/app/ui/bindings.js` (błąd zakresu po refaktorze delegacji).
- Przywrócono właściwy header modala szafki: `Anuluj` + `Zatwierdź`, bez `X`.
- Usuwanie szafki w wywiadzie korzysta z `confirmBox`, nie z systemowego `confirm()`.
- `panel-box` dostał tytuł jak nagłówek Optimax także na mobile.

- 2026-03-23: UI polish follow-up — modal szafki: przy dodawaniu zielony CTA = 'Dodaj', przy edycji = 'Zapisz zmiany'; MAGAZYN: szerokie pole materiału + dolny rząd szer./wys./ilość/przycisk; ROZRYS: lepiej wyśrodkowane etykiety względem ikon ?, czytelniejsza ikona ?, oraz 3-liniowy opis w launcherze materiału.

- 2026-03-23: Fix mobilnego scrolla w modalach pełnoekranowych. `.modal` działa teraz jako kolumna flex z przewijalnym `.modal .body`, żeby dodawanie/edycja szafki i podobne okna dały się przewijać na telefonie.

- 2026-03-24: ROZRYS — usunięty globalny checkbox struktury; sterowanie słojami przeniesione per materiał (accordion) z popupem wyjątków. Dodany helper js/app/rozrys/rozrys-grain.js i naprawione utrwalanie hasGrain w validate.js.

- 2026-03-25: Słój per formatka: dodano js/app/material/material-part-options.js, modal "Opcje formatki" w zakładce Materiał, kierunek słojów (domyślny/poziom/pion/bez znaczenia), oraz poprawiono modal "Wyjątki słojów" na mechanikę Wyjdź/Anuluj/Zapisz.

- 2026-03-25: grain modal polish v2 — sticky/footer actions for `Opcje formatki` and `Wyjątki słojów`, neutral preview for `Domyślny z materiału`, stronger disabled styling for grain controls.

- 2026-03-25: grain dirs v3 — fixed visible footer actions in `Opcje formatki` and `Wyjątki słojów` by switching both modals to a `panel-box-form` layout with separate scroll area + bottom action bar; corrected `Domyślny z materiału` preview to show the default grain direction from material (axis 1 / horizontal).

- 2026-03-25: panel-box large windows unified again: contentNode-based panel boxes now top-align with ~20dvh offset, internal body scroll, and sticky footer; message-only small boxes stay centered. Cache-busting updated to `20260325_panelbox_top20_v1`.

- 2026-03-26: panel-box forms on mobile now reset scroll on open, keep 20dvh top offset, and use inner form scroll with stable sticky footer to avoid action buttons dropping below viewport.

## Dalsze propozycje porządkowania ROZRYS (częściowo wdrożone)

1. `js/app/rozrys/rozrys-choice.js` — wdrożone w tej paczce jako pierwszy krok zamiast większego `rozrys-pickers.js`.
   - wydzielone: `getSelectOptionLabel()`, `setChoiceLaunchValue()`, `createChoiceLauncher()`, `openRozrysChoiceOverlay()`.
   - dalszy krok: dołożyć tu jeszcze `openRoomsPicker()` i `openMaterialPicker()`.

2. `js/app/rozrys/rozrys-print.js` — wdrożone w tej paczce.
   - wydzielone: `buildCsv()`, `downloadText()`, `openPrintView()`, `pxToMm()`, `measurePrintHeaderMm()`.

3. `js/app/rozrys/rozrys-sheet-draw.js`
   - wydzielić: `scheduleSheetCanvasRefresh()`, `drawSheet()`, helpery wymiarów, etykiet i rysowania oklein;
   - po co: warstwa canvas jest duża i wizualnie ryzykowna, więc powinna być odseparowana od logiki danych.

4. `js/app/rozrys/rozrys-stock.js` — wdrożone częściowo w tej paczce.
   - wydzielone: helpery formatu bazowego, magazynu i podaży arkuszy (`getSheetRowsForMaterial()`, `getExactSheetStockForMaterial()`, `getLargestSheetFormatForMaterial()`, `clonePlanSheetsWithSupply()` i powiązane funkcje).
   - dalszy krok: przenieść tam jeszcze całe `applySheetStockLimit()`.

5. `js/app/rozrys-cache-progress.js`
   - wydzielić: `tryAutoRenderFromCache()`, cache planów, ticker globalny, status generowania i anulowanie liczenia;
   - po co: postęp liczenia i cache są dziś w jednym miejscu z renderem, a to utrudnia dalsze rozwijanie trybów `Super` i `Ultra`.

6. `js/app/rozrys/rozrys-accordion.js` — wdrożone częściowo w tej paczce.
   - wydzielone: `splitMaterialAccordionTitle()`, `createMaterialAccordionSection()`.
   - dalszy krok: przenieść tam jeszcze `renderMaterialAccordionPlans()`.


## 2026-03-27 — ROZRYS split v3 (render/cache preview)
- Dodano `js/app/rozrys/rozrys-render.js`.
- Z `js/app/rozrys/rozrys.js` wydzielono: `buildEntriesForScope()`, `tryAutoRenderFromCache()`, `renderOutput()`, `renderLoadingInto()`.
- `index.html` dopięty do nowego modułu i cały pakiet skryptów `rozrys-*` dostał wspólny cache-busting `20260327_rozrys_stock_validation_v4`.
- Usunięto martwy, nieużywany `deriveAggForMode()` z `js/app/rozrys/rozrys.js`.
- Efekt: dalsze odchudzenie `rozrys.js` bez zmiany UI i bez ruszania solverów.


## 2026-03-27 — ROZRYS split v5 (4 kolejne wydzielenia)
- Dodano nowe moduły: `js/app/rozrys/rozrys-summary.js`, `js/app/rozrys/rozrys-progress.js`, `js/app/rozrys/rozrys-stock-modal.js`, `js/app/rozrys/rozrys-runner.js`.
- Z `js/app/rozrys/rozrys.js` wydzielono: diagnostykę/walidację list (`Lista formatek`, `lista arkusza`), stan/progres/anulowanie generowania, modal `Dodaj płytę do magazynu`, oraz przebieg generowania materiałów (`generate()` + `runOne()` jako osobny runner).
- `index.html` dostał wspólny cache-busting `20260327_rozrys_split_v5` dla całego pakietu `rozrys-*`.
- Cel paczki: dalsze odchudzenie `rozrys.js` bez zmiany UI i bez ruszania solverów.


## 2026-03-27 — ROZRYS split v7 (state + sheet-model + lists)
- Dodano nowe moduły: `js/app/rozrys/rozrys-state.js`, `js/app/rozrys/rozrys-sheet-model.js`, `js/app/rozrys/rozrys-lists.js`.
- `rozrys-state.js` wprowadza centralny store stanu ROZRYS (`selection`, `options`, `ui`, `cache`) oraz helper budowy bazowego stanu z kontrolek panelu.
- `rozrys-sheet-model.js` przejął modelowanie arkuszy/magazynu: dopasowanie formatów, podpisy formatek, odejmowanie zużytych elementów i helpery podaży arkuszy.
- `rozrys-lists.js` przejął warstwę list/kart wyników ROZRYS: tabela `Lista formatek`, tabela `Formatki arkusza`, karta podsumowania, akcje eksportu i karty arkuszy.
- `js/app/rozrys/rozrys-stock.js` deleguje logikę modelu danych do `rozrys-sheet-model.js` zamiast trzymać wszystko w jednym pliku.
- `js/app/rozrys/rozrys-render.js` i `js/app/rozrys/rozrys-summary.js` delegują UI list i kart do `rozrys-lists.js`.
- `js/app/rozrys/rozrys.js` został spięty z centralnym store stanu ROZRYS, dzięki czemu wybory zakresu, podstawowy stan opcji, status przycisku i ostatni stan cache są utrzymywane w jednym miejscu.
- `index.html` dostał nowy wspólny cache-busting pakietu `rozrys-*`: `20260327_rozrys_split_v7`.

## 2026-03-27 — ROZRYS dev tests / anty-regresja
- Dodano `js/testing/rozrys/fixtures.js` — stałe scenariusze testowe dla ROZRYS (prosty plan, plan mieszany magazyn+zamówić, przypadki cache i wydruku).
- Dodano `js/testing/rozrys/tests.js` — lekki runner smoke-testów sprawdzający store stanu, model arkuszy/magazynu, walidację, cache, prosty engine shelf i strukturę HTML wydruku.
- Dodano `tools/rozrys-dev-smoke.js` — uruchamialny z Node skrypt developerski bez zależności zewnętrznych; zwraca kod błędu, jeśli któryś smoke-test nie przejdzie.
- Dodano `dev_tests.html` — prostą stronę developerską do ręcznego odpalenia testów w przeglądarce, bez ingerencji w główne UI aplikacji.
- Paczka nie zmienia UI użytkownika końcowego; dokłada techniczną siatkę bezpieczeństwa pod kolejne refaktory ROZRYS.


## 2026-03-28 — dev smoke page report
- Dopracowano `dev_tests.html`, żeby raport był czytelny dla użytkownika nietechnicznego.
- Strona pokazuje teraz wynik ogólny, sekcje testów, opis po co jest dany test, powód błędu oraz przycisk `Kopiuj raport`.

## 2026-03-28 — ROZRYS arch v8 (prefs + selection-ui + options modal + grain modal)
- Dodano nowe moduły: `js/app/rozrys/rozrys-prefs.js`, `js/app/rozrys/rozrys-selection-ui.js`, `js/app/rozrys/rozrys-options-modal.js`, `js/app/rozrys/rozrys-grain-modal.js`.
- `rozrys-prefs.js` przejął helpery trwałości/stanu pomocniczego ROZRYS: prefs panelu, prefs accordionu, store oklein, podpis formatek oraz most do store słojów.
- `rozrys-selection-ui.js` przejął orkiestrację wyboru zakresu: aktualizację launcherów `Pomieszczenia` i `Materiał / grupa`, sync ukrytych inputów, utrwalanie wyboru oraz otwieranie pickerów przez jeden kontroler.
- `rozrys-options-modal.js` przejął cały modal `Opcje rozkroju` razem z logiką `Wyjdź / Anuluj / Zapisz`, resetem do domyślnych wartości i konwersją jednostek.
- `rozrys-grain-modal.js` przejął modal `Wyjątki słojów`, bez zmiany zachowania UI.
- `js/app/rozrys/rozrys.js` został dalej odchudzony i deleguje do nowych modułów zamiast trzymać storage + modal opcji + sterowanie pickerami + modal wyjątków w jednym pliku.
- `index.html` dostał wspólny cache-busting pakietu `rozrys-*`: `20260328_rozrys_arch_v8`.


## 2026-03-28 — paczka: rozrys_empty_fix_and_smoke19
- Naprawa regresji ROZRYS, gdzie potrafił pokazać pusty stan „Brak rozpiski materiałów”, mimo że projekt miał szafki.
- `js/app/rozrys/rozrys.js` dostał bezpieczny resolver źródła cutlisty: najpierw `FC.cabinetCutlist.getCabinetCutList`, potem fallback globalny.
- Dzięki temu agregacja formatek do ROZRYS nie zależy już od kruchego jednego mostu.
- Warstwa smoke-testów została rozszerzona o test projektu/agregacji, który sprawdza, czy ROZRYS z prostego projektu faktycznie buduje materiał zamiast pustego stanu.
- Aktualny wynik smoke-testów po tej paczce: 19/19 OK.


## 2026-03-28 — rozrys project source fallback fix
- Start base: site_rozrys_project_rooms_fix.zip
- Fixed ROZRYS project source resolution: prefers the richest available project source (in-memory, window.projectData, FC.project.load()).
- Added fallback aggregation retry over discovered project room keys when saved room selection yields empty aggregate.
- Expanded smoke tests to catch empty-ROZRYS regressions caused by source desync and stale room selection.
- Smoke result after patch: 22/22 OK.


## 2026-03-28 — ROZRYS visual reference sync
- Dodano `css/rozrys-reference-sync.css` jako osobny moduł stylów tylko dla wizualnego ujednolicenia ROZRYS względem dwóch wzorców UI: `Wybierz materiał / grupę` oraz accordionów arkuszy.
- Ujednolicono typografię i karty launcherów ROZRYS (`Pomieszczenia`, `Materiał / grupa`, wybory opcji), żeby miały bliższą wagę tekstu, promienie, obramowania i cienie jak wzorcowe okna ROZRYS.
- Modale `Opcje rozkroju`, `Dodaj płytę do magazynu` i `Wyjątki słojów` dostały dodatkowe klasy (`rozrys-panel-*`), dzięki czemu ich pola i sekcje są wizualnie bliższe kartom z pickera materiałów.
- Zielona strzałka accordionu została zastąpiona bardziej aplikacyjnym chevronem w osobnym kafelku, z zachowaniem tej samej mechaniki rozwijania.

## 2026-03-28 — ROZRYS visual sync: remove frame-in-frame
- Base: `site_rozrys_visual_sync.zip`
- Goal: keep ROZRYS aligned with the material-picker / sheet-accordion references, but remove the extra boxed-in-boxed look introduced in option-style modals.
- Changes:
  - `css/rozrys-reference-sync.css`: flattened `rozrys-panel-field` containers so fields no longer render as cards inside cards
  - toned down accordion chevron glow to better match the app
  - kept the single-field control frame as the main visual boundary inside ROZRYS option/add-stock dialogs
- Result:
  - `Opcje rozkroju` and `Dodaj płytę do magazynu` no longer show a nested frame around already framed controls.

- 2026-03-29: ROZRYS UI tweak — top label rows (Pomieszczenia / Materiał / grupa / Szybkość liczenia / Kierunek cięcia) lowered visually to align closer with the ? help triggers above the cards; no logic changes.


## 2026-03-29 — custom checkbox style in ROZRYS
- Added `css/rozrys-checkboxes.css`.
- Replaced native-looking checkbox appearance in ROZRYS pickers/chips with custom app-styled square checkbox.
- First target: `Materiał / grupa` modal, with shared ROZRYS checkbox styling available for other ROZRYS pickers.

- 2026-03-29: `site_rozrys_checkbox_press_fix.zip` — usunięty systemowy niebieski highlight checkboxów w ROZRYS; checkboxy dostały własny efekt naciśnięcia w stylu przycisków ROZRYS (biały, zaokrąglony press/focus ring), bez zmiany logiki zaznaczania.

## 2026-03-29 — Paczka: ROZRYS checkbox press fix v3
- Naprawa systemowego niebieskiego highlightu przy checkboxach w ROZRYS.
- Źródłem problemu był nie tylko sam checkbox, ale też otaczające go label/chip/card.
- Wygaszono tap highlight na wrapperach i przeniesiono efekt naciśnięcia na cały chip/card w stylu przycisków ROZRYS.
- Checkbox wewnątrz chipa ma pointer-events:none, żeby klik przechodził przez wrapper bez systemowego efektu.
- 2026-03-29: Fix press/highlight for material cards in `Wybierz materiał / grupę` by disabling system tap highlight on the whole picker card and adding the same white rounded press ring direction used elsewhere in ROZRYS.


## 2026-03-29 — ROZRYS visual polish (active picker stability + shadows + gradient headers)
- Stabilized active green frame in Material / group picker by deriving selected card from actual local scope chips.
- Added panel-box boxClass support and marked ROZRYS panel-box modals with `panel-box--rozrys`.
- Added ROZRYS-only gradient underline treatment for section labels and ROZRYS modal titles.
- Added button-like shadows to picker chips/buttons and close X buttons in ROZRYS.


## 2026-03-29 — ROZRYS picker stability + shadows polish
- Naprawiono natychmiastowe zaznaczanie aktywnej karty w `Materiał / grupa` po kliknięciu ptaszka.
- Karty materiałów/pomieszczeń w pickerach dostały bardziej "X-like" styl: 14px radius, delikatny gradient, stabilny cień.
- Chipy `Fronty` / `Korpusy` zachowują cień również po zaznaczeniu i pokazują stan aktywny bez gubienia obramowania karty.

- 2026-03-29: site_rozrys_header_gradient_field.zip — usunięto gradientowe paski pod tytułami w ROZRYS i pod etykietami sekcji; nagłówki okien ROZRYS dostały subtelne tło biały→szary z mocniejszym przejściem przy dolnych ~20%.

## 2026-03-29 — Paczka: room picker chip pattern
- Start base: `site_material_scope_chip_sync.zip`.
- Picker `Wybierz pomieszczenia` dostał duży wariant wspólnego wzorca checkbox/chip (`css/rozrys-checkbox-chip-pattern.css`) zamiast starego pełnego kafla listy.
- `js/app/rozrys/rozrys-pickers.js` nadaje teraz kafelkom pomieszczeń klasy `rozrys-checkbox-chip rozrys-checkbox-chip--large` i utrzymuje `is-checked` zgodnie z realnym stanem checkboxa.
- Nowy wzorzec zachowuje neutralny kafelek i nie przenosi zielonej ramki na całe zaznaczone pole; stan zaznaczenia komunikuje głównie checkbox i spójny chipowy kształt.
- Smoke/testy dostały anty-regresję sprawdzającą render dużego checkbox-chipa pomieszczeń oraz obecność neutralnego pattern CSS.


- 2026-03-29: room picker now uses large scope-chip pattern based on the material Fronty/Korpusy chips; browser dev tests inject a fake document through deps instead of mutating window.document.


- 2026-03-29: room chip pattern v3 — picker pomieszczeń został przepięty na dokładnie bazowy markup scope-chip jak w Material / grupa (bez legacy `rozrys-picker-check`), a duży wariant dostał wygaszenie overlay focus/active, żeby po kliknięciu nie zostawał grubszy obrys. Zaktualizowano test anty-regresyjny i wersjonowanie assetów.

- 2026-03-29: Checkbox/chip buttons in ROZRYS now use a strict two-state visual model (base/unchecked = same as after uncheck, checked = selected). Mobile sticky-hover regression for room picker chips was fixed by gating hover styles to real hover devices and zeroing chip focus overlays.

- 2026-03-29: Checkbox-chip proportions tuned in ROZRYS. Small chips now use 12px vertical padding with unchanged horizontal offset; room-picker chips use 16px vertical padding with a 24px inner row minimum so top/bottom spacing matches the left checkbox gutter without moving the checkbox right.
- 2026-03-29: Checkbox-chip small variant tightened for mobile fit: base `.rozrys-scope-chip` reduced to `min-height:46px` with `padding:11px 12px 11px 11px` so three material cards fit better on narrow phone screens; large room-option variant unchanged.

- 2026-03-29: checkbox-chip polish v2 — małe chipy ciaśniejsze (44px, 10/12/10/10), karty materiałów niższe o 1 px góra/dół i zaznaczone karty mają zieloną ramkę/cień jak wzorzec wyboru trybu; duże chipy pomieszczeń dostały taki sam promień narożników jak małe.

- 2026-03-29: selected picker/material cards in ROZRYS now share the exact same green border and shadow tokens as the accepted `Szybkość liczenia` selected card; extra green halo overlay on selected material cards was removed.
- 2026-03-29: `site_material_picker_match_speed_exact.zip` — picker materiału w `Wybierz materiał / grupę` dostał dokładnie ten sam rytm odstępów i parametry kart co modal `Szybkość liczenia`: gap 12px, dół listy 20px pod cień, karty 18px/20px desktop i 16px/18px mobile, z tym samym zielonym border/shadow zaznaczenia.

- 2026-03-29: `site_material_picker_scroll_gutter.zip` — W `Wybierz materiał / grupę` lista dużych kart dostała prawy gutter (`padding-right`) i `scrollbar-gutter: stable`, żeby pionowy scroll nie nachodził już na prawą ramkę kart; test anty-regresyjny pilnuje teraz także tego zapasu pod scrollbar.

- 2026-03-29: Wybór materiału zsynchronizowany dokładniej z modalem `Szybkość liczenia`: osobny moduł `css/rozrys-picker-exact-sync.css` pilnuje rytmu pola kart (gap 12px, prawy gutter na scrollbar, dolny zapas 20px) oraz pionowego wyśrodkowania stopki akcji.

- 2026-03-30: Picker materiału i pomieszczeń — stopka akcji dostała większy, spokojniejszy oddech (60px / mobile 58px, padding 6px 0 8px), żeby pionowe osadzenie dolnych przycisków było bliżej rytmu strefy górnego przycisku X.

- 2026-03-30: Picker footer spacing now follows the exact close-button math from the modal header shell (desktop 20px/20px, mobile 18px/18px) so bottom action buttons inherit the same vertical breathing as the top X.

- 2026-03-30: Picker footer spacing fix — removed extra picker-level gap and footer padding so bottom action buttons no longer create an oversized empty band below the card list; the list keeps the 20px shadow breathing and the modal body keeps the outer bottom breathing.

- 2026-03-30: picker footer align v1 — material picker got its own footer modifier (`.rozrys-picker-footer--material`) with a small bottom padding so the single `Wyjdź` button sits like the footer in room picker; room picker footer left unchanged. Updated `rozrys-pickers.js`, `rozrys-picker-exact-sync.css`, picker regression tests, and cache-busting.

- 2026-03-30: material picker footer drop v1 — cofnięto błędne podnoszenie samotnego `Wyjdź`; stopka materiałów używa teraz górnego paddingu (`20px` desktop / `18px` mobile), żeby przycisk siedział niżej bez ruszania room pickera.


## 2026-03-30 — material picker footer unified with rooms footer
- Material picker footer no longer uses a dedicated modifier spacing block.
- `Wybierz materiał / grupę` and `Wybierz pomieszczenia` now share the same base `rozrys-picker-footer` rhythm.
- The bottom breathing under material cards stays on the list (`padding-bottom: 20px`) instead of on a separate material footer padding block.


## 2026-03-30 — material footer restore after bad unify
- Cofnięto regresję z unifikacji stopki `Wybierz materiał / grupę` z oknem `Wybierz pomieszczenia`.
- Material picker znów używa własnego modifiera `.rozrys-picker-footer--material` z top paddingiem 20px desktop / 18px mobile.
- Room picker pozostawiono bez zmian.

- 2026-03-30: `Opcje rozkroju` wróciły do praktycznego układu bez zmiany funkcjonalnej siatki; launchery wyboru w tym modalu nie pokazują już helpera „Kliknij, aby wybrać” ani strzałek, a pola wpisywane mają niższy, wklęsły styl (`css/rozrys-panel-modal-sync.css`, `js/app/rozrys/rozrys-options-modal.js`, test anty-regresyjny w `js/testing/rozrys/tests.js`).
- 2026-03-30: `Opcje rozkroju` dostały reusable shell ROZRYS dla modali formularzowych (`css/rozrys-panel-modal-sync.css`): rytm jak w zatwierdzonych oknach ROZRYS oraz wklęsłe pola input dla ręcznie wpisywanych wartości.

- 2026-03-30: Opcje rozkroju zachowują shell ROZRYS i wklęsłe pola, ale krótkie pola liczbowe wróciły do kompaktowych szerokości (moduł `rozrys-panel-modal-sync.css`, klasy `rozrys-panel-input--compact`, `rozrys-panel-input--compact-wide`, `rozrys-panel-inline--compact-pair`).

- 2026-03-30: Opcje rozkroju — przywrócono praktyczny układ rzędów zgodnie z ustaleniem: 1) Jednostki + Wymiary do cięcia, 2) Rzaz piły + Obrównanie, 3) Format bazowy arkusza, 4) Najmniejszy użyteczny odpad. Siatka opcji ma jawnie trzymać 2 kolumny także na telefonie; launcher pól wyboru pozostaje bez helpera i bez strzałki.

- 2026-03-31: ROZRYS `Dodaj płytę do magazynu` dostał własny shell formularza (`rozrys-stock-modal-sync.css`) zgodny z zatwierdzonym wzorcem ROZRYS: 2-kolumnowa siatka, wklęsłe pola, przewijalne body `panel-box-form`, kompaktowe pole ilości i stopka akcji jak w innych modalach edycyjnych.

- 2026-03-31: `Opcje rozkroju` dostały dokładniejszy, praktyczny układ pól bez zmiany logiki: lewa kolumna jest węższa (Jednostki jak Rzaz piły), prawa rozciąga się na resztę rzędu, drugi rząd ma wyrównane pole wejściowe mimo wielowierszowej etykiety, a dolne pary pól (`Format bazowy`, `Najmniejszy użyteczny odpad`) mają równą szerokość przez wspólny układ `rozrys-panel-inline--options-pair`.
- 2026-03-31: ROZRYS `Dodaj płytę do magazynu` przestał używać systemowego selecta materiału; modal korzysta teraz z istniejącego aplikacyjnego launchera i overlayu wyboru (`createChoiceLauncher` + `openRozrysChoiceOverlay`) ze stylem `.rozrys-choice-launch--stock-clean`, bez helpera i bez strzałki.

## 2026-03-31 — rooms/lists/investor sync batch
- Added `js/app/shared/room-registry.js` as dynamic room registry for investor/project room definitions.
- Investor detail view now uses app-style choice launchers for `Typ` and `Status`, plus compact app-style inputs.
- Investor quick-room section now renders dynamic rooms from current investor and exposes `Dodaj pomieszczenie`.
- ROZRYS room discovery now prefers dynamic investor/project rooms through room registry labels.
- Validation/list tables now support vertical headers, stacked dimensions, room/source/cabinet columns.
- Sheet lists are enriched from raw snapshot metadata to show room/source/cabinet context when available.

## 2026-04-02 — investor refactor + room registry hardening
- `Inwestor` został rozdzielony na nowe moduły pomocnicze:
  - `js/app/investor/investor-editor-state.js`
  - `js/app/investor/investor-choice.js`
  - `js/app/investor/investor-links.js`
  - `js/app/investor/investor-modals.js`
  - `js/app/investor/investor-rooms.js`
- Dodano osobne style `css/investor-layout.css` i `css/investor-form.css` dla układu, pól, launcherów i akcji inwestora.
- `Inwestor` ma teraz tryb podglądu/edycji:
  - spoczynek = `Usuń` + `Edytuj`
  - edycja bez zmian = `Wyjdź`
  - edycja po zmianach = `Anuluj` + `Zapisz`
- W trybie spoczynkowym `Status` można zmieniać od razu, ale tylko po potwierdzeniu przez nasz modal.
- W trybie edycji zablokowane są górne zakładki i szybki wybór pomieszczeń inwestora.
- `Typ` i `Status` w inwestorze używają niskich launcherów w stylu aplikacji; `NIP` pojawia się tylko dla `Firma` obok pola `Źródło`.
- W trybie nieedytowalnym `Telefon` i `Email` pokazują ikonki akcji tylko wtedy, gdy pole ma wartość.
- Rejestr pomieszczeń (`room-registry`) wymusza teraz nazwę pomieszczenia i blokuje duplikaty nazw dla jednego inwestora; dodano też widoczną pozycję legacy `kuchnia stary program` dla starych danych kuchni.
- Usunięto nieużywany legacy plik `js/app/investor/inwestor.js`.
- Domyślne `Obrównanie krawędzi` zmieniono z `2 cm` / `20 mm` na `1 cm` / `10 mm`.
- W `Dodaj płytę do magazynu` poprawiono lewy zapas launchera `Wybierz materiał` i jego aktywny stan.
- W tabelach rozkroju poprawiono układ komórki `Szafka` (numer + `?`) tak, żeby nie nachodziły na siebie.

- 2026-04-02: followup v2 — `Dodaj płytę do magazynu` dostał wspólny lewy rytm dla pól i stopki; `Lista formatek` uspokoiła kolumnę `Ilość`/`Szafka` (centrowanie ilości + rozdzielenie numeru i `?`), a `room-registry` porównuje nazwy pomieszczeń akcento-niezależnie (`dół` = `dol`). W `Inwestorze` ikonki telefonu/email dostały mocniejszy, czytelniejszy wariant.

- 2026-04-02 — followup v3: domknięto zaległe poprawki po ostatnich uwagach: wyrównany lewy rytm modala dodawania płyty, wzmocnione akcje telefon/email i spłaszczony widok pól inwestora w trybie nieedytowalnym, poprawiony render kolumny Szafka także w ogólnej liście formatek, oraz dodana osłona na mobile ghost-click przy przejściach pełnoekranowych typu Otwórz inwestora / Lista inwestorów.

- 2026-04-03: investor follow-up — Typ readonly wrócił do spłaszczonego preview, action bar inwestora siedzi pod blokiem danych, telefon/email dostały lekkie ikony SVG i kompaktowe akcje, lista inwestorów blokuje przycisk Lista w edycji, listy formatek wróciły do pionowych nagłówków z dopasowanymi szerokościami kolumn, fallback obrównania utrzymany na 1 cm / 10 mm.


## 2026-04-03 — site_investor_green_icons_tables_tight
- INWESTOR: `Osoba` -> `Osoba prywatna`, poprawiona typografia labeli Telefon/Email i zielone ikonki akcji w stylu `Zapisz`.
- INWESTOR: w trybie edycji blokowane są także górne przyciski sesji `Anuluj` / `Zapisz`.
- LISTY FORMATek: zwężone kolumny liczbowo-statusowe, delikatniejsze pionowe separatory i ciemniejsze poziome linie w listach ogólnej / do rozkroju / arkusza.

## 2026-04-04 — site_investor_arch_sync_tables_blue
- INWESTOR: wdrożono 4 kroki optymalizacji architektury bez zmiany ogólnego UI:
  - `js/app/investor/investor-persistence.js` — jedno wejście do CRUD inwestora pod przyszły adapter Firestore,
  - `js/app/investor/investor-navigation-guard.js` — jedno miejsce do blokad top nav / Lista / pokoje / sesja,
  - `js/app/investor/investor-field-render.js` — wspólne renderowanie pól readonly/editable i sztywnych rzędów,
  - `js/app/investor/investor-actions.js` — wydzielona logika action bara inwestora.
- INWESTOR: karta inwestora została przestawiona na sztywne rzędy par pól (`name/phone`, `city/email`) i pełne rzędy (`adres`, `źródło`, `notatki`), żeby linie i baseline nie rozjeżdżały się między lewą i prawą kolumną.
- INWESTOR: ikonki telefonu/email wróciły do niebieskiego tonu zgodnego z `Dodaj pomieszczenie`.
- LISTY FORMATek: dalej zwężono kolumny liczbowe / wymiarowe i przyciemniono poziome linie na około 60% szarości.
- ACTIONS REGISTRY: akcje create/open/assign/delete inwestora korzystają teraz z warstwy `investorPersistence`, a nie bezpośrednio z `FC.investors`.

## 2026-04-04 — site_rozrys_table_column_tuning
- LISTY FORMATek: utrzymano kolumnę `Formatka` bez zmian i dociśnięto techniczne szerokości pod realne treści:
  - `Wymiar` pod układ `XXX.x / x / XXX.x`,
  - `Potrzebne` i `Rozrysowane` pod 3 cyfry,
  - `Różnica` i `Status` pod 3 znaki.
- LISTA DO ROZKROJU: przestawiono kolejność kolumn tak, aby `Różnica` i `Status` siedziały zaraz po `Rozrysowane`, przed sekcją `Szafka`.
- SZAFKA: rozdzielono sekcję `Szafka` na wspólny nagłówek z dwiema kolumnami:
  - wąska kolumna z `?`,
  - właściwa kolumna z listą szafek.
- SZAFKA: numery szafek renderują się po 5 pozycji w rzędzie, maksymalnie w 3 widocznych rzędach; przy większej liczbie pojawia się wewnętrzny scroll.
- LISTY FORMATek: poziome linie zostały utrzymane wyraźniej, a pionowe pozostały delikatniejsze.
- STATUS: statusy skrócono do krótkich form (`OK`, `BRK`, `NAD`), żeby mieściły się w węższej kolumnie bez rozwalania układu.


## 2026-04-04 — investor_project_status + rozrys_pdf_row
- Inwestor: usunięty status inwestora; dodana edytowalna data dodania; lista inwestorów pokazuje datę; projekty/pomieszczenia na dole mają własne statusy i wspólny układ kart.
- Inwestor: odświeżenie w zakładce Inwestor trzyma kontekst wybranego inwestora; wyjście z widoku inwestora górnym Zapisz/Anuluj prowadzi do listy inwestorów.
- ROZRYS: PDF skrócony do `PDF`, przyciski osadzone w rzędzie zakładek/akcji; usunięty słupek `?`; szerokości tabel ujednolicone z dynamiczną kolumną szafek.
- Testy: app smoke 12/12 OK, rozrys smoke 31/31 OK.

## 2026-04-04 — site_rozrys_render_rooms_company_owner
- ROZRYS: naprawiono regresję braku kart arkuszy/rozrysów pod podsumowaniem w accordionach materiałów; renderer ma teraz awaryjny fallback budujący karty arkuszy nawet wtedy, gdy warstwa list zwróci pusty wynik, oraz podbite wersje plików JS, żeby GitHub Pages nie trzymał starego kodu w cache.
- ROZRYS: wybór pomieszczeń w panelu rozkroju dla inwestora bierze się z realnie dodanych pomieszczeń inwestora (`room_*`), a nie z generatorowych typów bazowych `kuchnia/szafa/pokój/łazienka`.
- INWESTOR: dla typu `Firma` dodano osobne pole `Właściciel — imię i nazwisko`; `Źródło` i `Notatki` rozciągnięto na cały rząd, a `NIP` ma własny pełny rząd pod właścicielem.
- TESTY: app smoke 14/14 OK; rozrys smoke 31/31 OK.

- 2026-04-04: site_investor_company_layout_room_labels.zip — naprawa etykiet pomieszczeń w ROZRYS (bez technicznych room_*), poprawa układu firmy w Inwestorze: właściciel pod mailem, NIP pod właścicielem, pełny rząd dla Źródła i Dodatkowych informacji, neutralniejsze tło pól oraz cache-busting dla zmienionych skryptów.

- 2026-04-05: Paczka site_investor_validation_room_delete_summary_cleanup.zip — uproszczenie podsumowania ROZRYS, poprawa układu firmy w Inwestorze, modal usuwania pomieszczenia, walidacja obowiązkowych pól i ostrzeżenia o duplikatach, nowy inwestor otwierany od razu w edycji.


## 2026-04-05 — investor followup v2
- investor create flow moved to transient draft before first real save (no empty investor records)
- investor top session buttons detached from investor form save/cancel path
- room delete modal now lists full active room set including legacy rooms
- investor rooms header tightened: Pomieszczenia + Dodaj/Usuń in one row
- resolved table widths treated as reference for RAW/validation/sheet list widths

## 2026-04-05 — site_fix_investor_render_recursion
- INWESTOR: naprawiono regresję boot-clean-1.4 z pętlą renderu w zakładce Inwestor. Gdy zapisany/current investor ID nie wskazuje już istniejącego wpisu, UI czyści kontekst detail, wyłącza blokady i bezpiecznie wraca do listy inwestorów zamiast wpadać w rekurencję render() -> render().
- CACHE-BUSTING: podbita wersja `investor-ui.js`, żeby GitHub Pages nie trzymał starej wersji skryptu.
- TESTY: app smoke 15/15 OK; rozrys smoke 31/31 OK.


## 2026-04-05 — wycena start + regression bundle
- fix ghost click/click-through on `create-investor` by swallowing follow-up global click after action dispatch on mobile-like flows.
- investor duplicate guard now also warns when company `ownerName` matches an existing private investor `name`.
- RAW / Walidacja / Lista arkuszy now share explicit reference col widths via `rozrys-lists.js` colgroup widths instead of relying only on CSS mode-specific rules.
- added `js/app/wycena/wycena-core.js` as first modular quote layer: seeds AGD service defaults, collects selected-room aggregate, material sheet counts from ROZRYS cache/generation, accessory rows from cabinet cutlists and built-in AGD service rows from cabinet subtypes.
- `tabs/wycena.js` replaced placeholder with first working estimate view and `Wyceń` action.
- service catalog auto-seeds editable AGD installation items for future quote integration.


## 2026-04-05 — field unify + width sync
- ujednolicono styl pól formularza inwestora przez wspólny wzorzec `.investor-form-control` i usunięto wyjątek dla `invOwnerName`
- dopięto focus/autofill/read-only pod jeden system stylu dla pól formularza
- RAW, Walidacja i Lista arkuszy korzystają z referencyjnych szerokości kolumn ze Skomasowanej; kolumna Szafka jest dynamiczna z limitem max

## 2026-04-06 — ROZRYS anti-regression + merge validation
- rozdzielono render ROZRYS na sekcje summary / actions / sheets oraz dodano guard po renderze kart arkuszy i canvasów,
- przy błędzie renderu arkuszy widok próbuje fallback kart arkuszy, a dopiero potem pokazuje komunikat fail-safe,
- lista `Skomasowana` przestała być sztucznym `OK`; korzysta teraz z rzeczywistej walidacji RAW → scalanie,
- dodano smoke testy ROZRYS dla walidacji scalania oraz dla obecności sekcji/kart/canvasów w DOM.

- 2026-04-06 13:xx: spacing under investor divider + session cancel reload restore fix.


- 2026-04-07: dodano `js/app/investor/investor-room-actions.js` jako osobny binder akcji Dodaj/Edytuj dla pomieszczeń inwestora, żeby nie trzymać tej logiki w `investor-ui.js`.


## 2026-04-07 — etap 2 trybów pracy
- Dodano moduły `js/app/catalog/catalog-domain.js` i `js/app/catalog/catalog-migration.js` jako wspólną warstwę domeny katalogów oraz migracji legacy danych.
- `catalog-store.js` korzysta teraz z tych modułów i publiczne `migrateLegacy()` domyślnie przebudowuje split z legacy danych, a init aplikacji zachowuje bezpieczne preferowanie już rozdzielonych katalogów.
- Dodano wspólny modal zarządzania pomieszczeniami inwestora przez `roomRegistry.openManageRoomsModal()`.


- 2026-04-07 stage2 fix v2: rozdzielono draft wspólnego modala pomieszczeń od sesji projektu/inwestora, `Anuluj` w modalu pomieszczeń resetuje tylko lokalne zmiany bez zamykania okna, a `dev_tests.html` ładuje już `constants.js` i `storage.js`, dzięki czemu testy katalogów używają prawdziwych kluczy storage. Dodatkowo ROZRYS dopuszcza retry dla niestandardowych kluczy pomieszczeń także przy aktywnym inwestorze.

## 2026-04-08 — etap 3 architektury: domeny projektu / usług / wyceny
- Dodano `js/app/project/project-model.js`, `js/app/project/project-store.js` i `js/app/project/project-bridge.js`.
  - `project-model` normalizuje dane projektu niezależnie od widoku,
  - `project-store` trzyma osobne rekordy projektów powiązane z inwestorem,
  - bridge utrzymuje zgodność z dotychczasowym `FC.project`, więc reszta aplikacji nadal działa bez masowego przepinania.
- Dodano `js/app/service/service-order-store.js` jako osobny store dla `serviceOrders`; `catalog-store` zachowuje tylko mostki kompatybilności dla starego API.
- Dodano `js/app/catalog/catalog-selectors.js` jako wspólną warstwę odczytu katalogów dla dalszej chmury i dla wyceny.
- Dodano `js/app/quote/quote-snapshot.js` jako pierwszy czysty model snapshotu wyceny meblowej, niezależny od DOM.
- `wycena-core.js` korzysta już z selektorów katalogów i buduje snapshot bez mieszania `workshopServices` do wyceny mebli.
- `service-orders.js` korzysta bezpośrednio z `serviceOrderStore`, więc drobne zlecenia nie wiszą już logicznie pod katalogami.
- `investor-project.js` synchronizuje projekt inwestora także do `project-store`, przygotowując grunt pod przyszłe rozdzielenie `investor` i `project` jako osobnych bytów domenowych.
- `dev_tests.html` i smoke-runner Node ładują nowe moduły domenowe; smoke po zmianach: app 27/27 OK, rozrys 34/34 OK.


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
- Nowy moduł: `js/app/quote/quote-pdf.js` — buduje drukowalny PDF wyceny z snapshotu.
- `js/tabs/wycena.js` pokazuje ostatni snapshot, historię snapshotów projektu oraz akcje Podgląd/PDF.
- `js/testing/wycena/tests.js` dostał test PDF wyceny oparty o snapshot.


## 2026-04-08 — Stage 5B: quote history UX polish
- `Historia wycen` w `Wycena` ma teraz zwarte, niskie karty zamiast wysokich pustych pól.
- Kliknięcie `Podgląd` wyraźnie oznacza oglądany snapshot i automatycznie przewija do aktywnego podglądu wyceny.
- Aktywny wpis historii ma wyróżniony stan i nie udaje, że nic się nie stało po przełączeniu snapshotu.

- Stage 6: quote-offer-store trzyma draft oferty (stawki + pola handlowe) per projekt; quote snapshot i PDF drukują dokładnie tę wersję wyceny.

- Etap historii ofert: sekcja handlowa w Wycena działa jako accordion; snapshot oferty można usunąć lub oznaczyć jako zaakceptowany, co ustawia status projektu na `zaakceptowany`.

## 2026-04 quote status sync
- Wycena obsługuje flagę wstępnej wyceny, akceptację wstępnej -> Pomiar oraz akceptację właściwej wyceny -> Zaakceptowany.
- Ręczna zmiana statusu projektu w Inwestorze synchronizuje stan zaakceptowanej oferty w Wycena.


## 2026-04-10 preliminary quote fix
- removed project status `Po pomiarze`; after measurement use `Wycena` directly
- preliminary quote drafts now survive scope switch from investor-only to project-bound draft
- preliminary history entries are archived only when a newer normal quote exists

## 2026-04-10 — stage9_quote_sync_v1
- WYCENA: domknięto draft oferty o `selection` (pomieszczenia + zakres korpusy/fronty) oraz `commercial.versionName`.
- WYCENA: snapshot i historia zapisują nazwę wersji oferty oraz zakres elementów (`materialScope`, `materialScopeMode`).
- WYCENA: tab `Wycena` dostał własny wybór pomieszczeń i zakresu bez wchodzenia do ROZRYS; `Wyceń` używa tego wyboru do rozkroju w tle.
- WYCENA: historia ofert i podgląd zostały zsynchronizowane ze statusem projektu (`wstepna_wycena`, `pomiar`, `wycena`, statusy finalne).
- WYCENA: po usunięciu snapshotu wykorzystywany jest rekomendowany status projektu, żeby nie zostawał błędny stary etap.
- WYCENA UI: aktywna oferta i stany zaakceptowane korzystają z zielonych akcentów; accordion i info-box wzorowane na istniejących kierunkach z ROZRYS.
- PDF: dopracowano layout PDF oferty bez zmiany logiki danych snapshotu.
- TESTY: rozszerzono smoke testy Wycena o zapis wyboru pomieszczeń/zakresu, nazwę wersji oferty, status po usunięciu oferty oraz zawartość PDF.


## 2026-04-10 — stage10_quote_polish_v1
- WYCENA: klik `Podgląd` naprawdę przełącza oglądany snapshot i tylko ten klik przewija do górnego podglądu; pozostałe akcje nie mają już sztucznego skoku scrolla.
- WYCENA: po ręcznym cofnięciu statusu przed etap `Wycena` wcześniejsze wyceny wstępne znowu są odblokowane zamiast zostawać na siłę wygaszone przez późniejszą wycenę końcową.
- WYCENA UI: launcher pomieszczeń ukrywa obcy mały trójkąt; chip `Wpływa na kolejny snapshot`, zielone zaznaczenie aktywnej historii i chevron accordiona zostały podciągnięte bliżej realnych wzorców z ROZRYS.
- WYCENA: domyślne nazwy wersji to teraz `Oferta` i `Wstępna oferta`; kliknięcie pola nazwy zaznacza całą wartość, więc można od razu pisać nad starą nazwą.
- WYCENA: badge `Wstępna` jest pomarańczowy, badge `Zaakceptowana` czerwony.
- WYCENA: przy zaakceptowanej wycenie wstępnej pojawia się mały przycisk `Do końcowej`, który przygotowuje draft zwykłej wyceny na bazie tej wersji i przełącza projekt na etap `Wycena`.
- TESTY: smoke testy Wycena dostały kontrolę domyślnych nazw wersji (`Oferta` / `Wstępna oferta`).

## 2026-04-11 — stage11_quote_followup_v1
- WYCENA: `Oglądany` i `Zaakceptowana` zostały rozdzielone — zielona obwódka dotyczy już tylko aktualnie oglądanej karty, a sama akceptacja zostaje oznaczona czerwonym badge'em i stanem przycisku.
- WYCENA: akcje `Zaakceptuj`, `Usuń` i `Końcowa` zapamiętują pozycję scrolla; tylko `Podgląd` przewija do górnego podglądu oferty.
- WYCENA UI: zielone zaznaczenie aktywnej karty historii dostało dokładny promień, obrys i cień jak zaznaczona karta w ROZRYS (`MAX` / picker-option), zamiast wcześniejszego przybliżenia.
- WYCENA: `Końcowa` nie przerzuca już do obcego draftu — konwertuje tę samą zaakceptowaną wycenę wstępną na zwykłą końcową ofertę i ustawia status projektu na `zaakceptowany`.
- WYCENA: po zaakceptowaniu zwykłej oferty wszystkie wyceny wstępne są wygaszane spójnie dla całej historii, niezależnie od pozycji nad/pod ofertą końcową.
- TESTY: smoke testy Wycena sprawdzają teraz także konwersję wstępnej oferty do końcowej oraz wygaszanie wycen wstępnych po zaakceptowaniu zwykłej oferty.

- 2026-04-11: `js/tabs/wycena.js`, `css/style.css`, `index.html`, `dev_tests.html` — Wycena dostała polskie etykiety `Wersja oferty`, żeńskie formy dla oferty, usunięty badge `Oglądany`, scroll akcji historii oparty o przywracanie pozycji jak w działających częściach programu oraz accordion ustawień oferty przepięty wizualnie na shell i chevron z ROZRYS.

- 2026-04-11: `js/tabs/wycena.js`, `css/style.css`, `index.html` — Wycena: naprawione rozjechanie bloku „Ustawienia oferty do nowej wyceny” przez przepięcie headera accordiona na układ wzorowany na ROZRYS (trigger + osobny dolny rząd meta), poprawione przewijanie `Podgląd` do początku sekcji podglądu oraz przywracanie scrolla po akcjach historii z fallbackiem do sąsiedniej karty / sekcji historii zamiast skoku na górę.

- 2026-04-11: `js/tabs/wycena.js`, `index.html` — Wycena: akcje historii, które nie mają celowo przewijać (`Zaakceptuj`, `Usuń`, `Końcowa`), zapamiętują pozycję scrolla bardziej agresywnie jak w działających częściach programu: pamięć jest łapana jeszcze przed potwierdzeniem modala, przy anulowaniu czyszczona, a przy odtworzeniu scroll jest dosuwany kilkukrotnie po rerenderze, żeby nie wracał na górę po ubocznych odświeżeniach statusu/projektu.
- 2026-04-12: Wycena — domknięcie wizualne top sekcji pod wzorzec z ROZRYS: selekcja pomieszczeń/zakresu przełączona na układ `rozrys-selection-grid`, pola dostały shell `rozrys-field`, a karta używa syncu `panel-box--rozrys`, żeby helpery `?`, launchery i proporcje były kopiowane z ROZRYS zamiast lokalnego wariantu.

- 2026-04-12: Paczka `site_quote_scope_pdf.zip` na bazie `site_quote_visual_sync.zip`. W `Wycena` przeniesiono wybór zakresu fronty/korpusy do osobnego modala wzorowanego na pickerach z `ROZRYS`, poprawiono launcher i wielkość czcionek przy wyborze pomieszczeń, przeniesiono checkbox `Wstępna wycena (bez pomiaru)` pod przyciski `Wyceń` / `PDF`, a generator PDF klienta został przebudowany na wersję handlową: tylko cena końcowa bez rozbicia kosztów, z listą elementów, materiałów/kolorów, akcesoriów, usług i sprzętów/AGD. Dodatkowo snapshoty zapisują ukrytą listę elementów dla PDF, bez zmiany szczegółowego podglądu w programie.
- 2026-04-12: Hotfix po paczce site_quote_scope_pdf.zip — przywrócono funkcję collectCommercialDraft w js/app/wycena/wycena-core.js, dzięki czemu aplikacja znowu wstaje bez boot-clean-1.4 oraz export FC.wycenaCore.ensureServiceCatalog jest dostępny dla smoke testu katalogu usług AGD bez duplikowania pozycji.
- 2026-04-12: ROZRYS test fixture isolation + first-run room retry fix — dodałem override projektu dla testów ROZRYS, żeby aggregatePartsForProject i retry po pokojach nie łapały starego projektu przy pierwszym uruchomieniu testów; podbite wersje rozrys.js i js/testing/rozrys/tests.js.

- 2026-04-12: Wycena — zapis wyboru pomieszczeń został uszczelniony na wzór ROZRYS: quoteOfferStore i wycenaCore nie czyszczą już jawnie wybranego zestawu pokoi tylko dlatego, że roomRegistry chwilowo zwróci pustą lub niepełną listę; dodatkowo górny checkbox/pole `Wstępna wycena (bez pomiaru)` został wyśrodkowany w osi lewo-prawo. Smoke testy Wycena dostały regresję na pusty roomRegistry przy zachowaniu selectedRooms.

- 2026-04-12: PDF klienta w Wycena bez listy formatek / elementów technicznych. Dokument pokazuje tylko handlowe sekcje: materiały / kolory, akcesoria z ilościami, usługi, AGD i cenę końcową. Dodany regresyjny smoke test PDF bez `Elementy w ofercie`.

- 2026-04-12: zaległe testy działowe — dodano `js/testing/service/tests.js` z osobną sekcją `USŁUGI` dla store zleceń usługowych, listy statusów, upsertu bez duplikatów i cleanup testowych rekordów. `dev_tests.html` dostał osobne przyciski uruchamiania działów: PROJEKT, INWESTOR, MATERIAŁY, WYCENA, SZAFKI, USŁUGI, a runner Node `tools/app-dev-smoke.js` został rozszerzony o nową sekcję testów.

- 2026-04-12: ROZRYS first-run scoped rooms fix — aggregatePartsForProject spina teraz safeGetProject i listę pokoi z tego samego scoped projektu, więc pierwszy przebieg testów nie filtruje już `salon` / `inne` po globalnych domyślnych pokojach. Retry po pokojach używa discovered rooms z tego samego kandydata projektu. Dodany regresyjny smoke test na pierwszy przebieg ze scoped pokojami.

- 2026-04-12: Testy przekrojowe Wycena — rozszerzono `js/testing/wycena/tests.js` o scenariusze `Wycena ↔ Inwestor`, `Wycena ↔ Pomieszczenia ↔ ROZRYS` oraz `Wycena ↔ PDF`: ręczna zmiana statusu inwestora synchronizuje projectStore i wskazaną ofertę, wybór pokoi w Wycena filtruje elementy dokładnie po aktywnych pomieszczeniach projektu, pusty wybór wraca do wszystkich realnych pokoi inwestora, a PDF zapisanej końcowej oferty po konwersji z wstępnej zachowuje handlowy charakter bez technicznej listy formatek.

- 2026-04-12: Hotfix testów USŁUGI — catalogStore.serviceOrders czyta teraz zawsze aktualny stan z serviceOrderStore zamiast wiszącego cache; dodany regres na synchronizację po bezpośrednim zapisie do store.

- 2026-04-12: Statusy Wycena/Inwestor zostały uszczelnione per pomieszczenie bez pełnego refaktoru ETAPU 2. `js/tabs/wycena.js` przestał opierać status oferty o pierwszy pokój inwestora i aktualizuje tylko pokoje z `scope.selectedRooms` snapshotu; wycena wspólna zmienia tylko pokoje objęte zakresem. `js/app/investor/investor-persistence.js` nie nadpisuje już wszystkich pokoi przy ręcznej zmianie jednego statusu, tylko liczy zagregowany status projektu z realnych statusów pokoi. `js/app/quote/quote-snapshot-store.js` dostał scoped helpery roomIds do doboru/rekomendacji ofert. Smoke testy Wycena dostały regresje na statusy per pomieszczenie, wyceny wspólne i brak fallbacku do pierwszego pokoju.

- 2026-04-12: Domknięto regresję przełączania akceptacji wycen scoped między wspólną a jednopomieszczeniową. `js/tabs/wycena.js` po akceptacji / cofnięciu / usunięciu wyceny przelicza statusy wszystkich znanych pomieszczeń projektu na podstawie scoped historii ofert zamiast zostawiać stare `pomiar` w pokojach zdjętych z akceptacji. `js/app/investor/investor-persistence.js` po ręcznej zmianie statusu jednego pokoju utrzymuje ten pokój jako źródło intencji użytkownika, ale przelicza pozostałe pokoje z ich własnej historii ofert. `js/app/quote/quote-snapshot-store.js` dostał helper `getRecommendedStatusMapForProject`, a `js/testing/wycena/tests.js` dostał regresję na przełączenie akceptacji z wyceny wspólnej na wycenę jednego pomieszczenia.

- 2026-04-12: ROZRYS first-click fix — getRoomsForProject nie blokuje już pokojów odkrytych w projekcie przez chwilowo stare roomRegistry aktywnego inwestora; testy ROZRYS pokrywają niestandardowe klucze i retry także przy aktywnym roomRegistry.

- 2026-04-12: ETAP 2 statusów — dodany centralny moduł `js/app/project/project-status-sync.js` jako wspólny mechanizm zmiany statusów projektu/pomieszczeń dla `Inwestor` i `Wycena`. `js/app/investor/investor-persistence.js` oraz `js/tabs/wycena.js` zostały przepięte na ten sam serwis, bez zmiany reguł biznesowych z ETAPU 1. Smoke testy Wycena dostały regresje potwierdzające, że oba wejścia wołają jeden wspólny mechanizm i że centralny serwis synchronizuje inwestora, projectStore oraz wskazaną ofertę.

- 2026-04-12: ETAP 3 statusów — usunięto stary duplikujący mostek synchronizacji z `js/app/investor/investor-persistence.js`; ręczna zmiana statusu opiera się już na centralnym `js/app/project/project-status-sync.js`, a lokalny fallback ogranicza się tylko do awaryjnego patcha pokoju. `js/tabs/wycena.js` został odchudzony z dawnej pełnej zapasowej ścieżki zapisu/odczytu statusów i zostawia już tylko lekki fallback awaryjny + ostrzeżenie w konsoli, gdyby centralny serwis nie był dostępny. `js/testing/wycena/tests.js` dostał regresję pilnującą, że po sprzątaniu nie wraca stare lokalne `updateInvestorRoom` jako drugi mechanizm zapisu statusów.


- 2026-04-12: Hotfix po ETAPIE 3 statusów — `js/app/project/project-status-sync.js` nie bierze już do agregacji projectStore obcych / starych statusów z `roomRegistry`, jeśli projekt i inwestor mają już własną listę pokojów. Przy zapisie statusów centralny serwis agreguje teraz status projektu po zakresie bieżącej zmiany (`scope.selectedRooms` albo wskazany pokój), a nie po przypadkowych pokojach wiszących w runtime. `js/testing/wycena/tests.js` dostał regresję na „brudny roomRegistry”, który wcześniej potrafił zostawić `projectStore.status = wycena` mimo poprawnej zmiany scoped na `pomiar`.

- 2026-04-13: Statusy ręczne w `Inwestor` dostały nowy guard `js/app/project/project-status-manual-guard.js`. Ręczne wejście na `Pomiar` wymaga teraz zaakceptowanej wyceny wstępnej solo dla danego pokoju; ręczne wejście na `Zaakceptowany` i dalsze statusy końcowe wymaga zaakceptowanej wyceny końcowej solo. Gdy brakuje wyceny solo, `Inwestor` pokazuje modal z pytaniem o wygenerowanie odpowiedniej wyceny dla tego jednego pomieszczenia i po potwierdzeniu przerzuca do `Wycena`; gdy wycena solo istnieje, ale nie jest zaakceptowana, pokazuje komunikat blokujący bez cichego podnoszenia statusu. Dodatkowo rekomendacja statusów per pokój po rozpięciu wspólnej wyceny wraca teraz do własnych ofert solo (`nowy` albo `wstepna_wycena`) zamiast liczyć dalej starą wycenę wspólną jako podstawę dla pokoju pojedynczego. Smoke testy Wycena/Inwestor dostały regresje na blokady ręcznych zmian, brak wyceny solo i powrót do statusu solo po zdjęciu wspólnej akceptacji.

- 2026-04-13: Rozbicie zaakceptowanej wyceny wspólnej nie zostawia już jej jako ukrytego blokera dla ofert solo. `js/app/quote/quote-snapshot-store.js` oznacza poprzednio zaakceptowaną ofertę jako odrzuconą po zmianie zakresu (`rejectedReason: scope_changed`), zamiast tylko cicho zdejmować akceptację; dzięki temu oferta wspólna przestaje blokować ponowną akceptację wycen solo. `js/tabs/wycena.js` renderuje taki stan jako żeńskie `Odrzucona`, a archiwizacja wstępnych ofert patrzy już po dokładnie tym samym zakresie pomieszczeń zamiast po całym projekcie. `js/app/project/project-status-manual-guard.js` blokuje też ręczne wejście na status `wycena` bez własnej zaakceptowanej wyceny wstępnej solo. `js/testing/wycena/tests.js` dostał regresje na odrzucenie wspólnej oferty po rozbiciu zakresu, odblokowanie solo wstępnych i blokadę ręcznego wejścia na `wycena` bez zaakceptowanej podstawy solo.

- 2026-04-14: Usługi stolarskie dostały uproszczony detal cięcia oparty na silniku ROZRYS (nowe pliki w js/app/service/cutting/). Poprawiono też scoped rekomendację statusu po odrzuceniu wspólnej oferty oraz zamieniono kolory przycisków na ekranie Start.

- 2026-04-14: Hotfix ręcznych statusów w `Inwestor` — `js/app/project/project-status-manual-guard.js` przestał traktować blokady tylko jako ruch „w górę”. Statusy wymagające podstawy ofertowej (`pomiar`, `wycena`, końcowe) są teraz walidowane zawsze względem własnej zaakceptowanej oferty solo dla danego pokoju, nawet jeśli bieżący status pokoju był omyłkowo wyższy. Dzięki temu nie da się już ręcznie wskoczyć ani wrócić na `Pomiar` / `Wycena` bez zaakceptowanej wyceny wstępnej solo. `js/app/investor/investor-choice.js`, `js/app/investor/investor-rooms.js` i `js/app/rozrys/rozrys-choice.js` dostały zgodne wsparcie dla zablokowanych opcji w overlayu wyboru statusu, a `js/testing/wycena/tests.js` dostał regresję na pokój z błędnie wyższym statusem, który bez zaakceptowanej wyceny wstępnej solo nie może już przejść na `Pomiar` ani `Wycena`.


## 2026-04-14 — choice click fix
- Naprawa overlayu wyboru statusu: tylko faktycznie zablokowane opcje dostają disabled; dozwolone znów klikają się poprawnie.
- Dodany lekki helper js/app/ui/app-view.js eksportujący FC.appView.shouldHideRoomSettingsForTab także dla dev_tests bez ładowania całego js/app.js.

## 2026-04-14: Scope-aware entry do Wstępnej wyceny
- Dodano nowy moduł `js/app/quote/quote-scope-entry.js` jako jedno źródło prawdy dla wejścia do wyceny scoped. Moduł rozpoznaje dokładny `scope.selectedRooms`, odróżnia solo od kombinacji A+B, umie znaleźć istniejącą wycenę tego samego typu i scope oraz prowadzi flow `Otwórz istniejącą` / `Utwórz nową` z drugim krokiem nadania nazwy wariantowi.
- `js/app/quote/quote-snapshot-store.js` dostał helpery exact-scope (`listExactScopeSnapshots`, `findExactScopeSnapshot`) filtrowane po typie wyceny i dokładnym zestawie pomieszczeń, bez mieszania scope solo i wspólnego.
- `js/app/investor/investor-ui.js` przechwytuje wejście na status `wstepna_wycena` i zamiast ślepo tylko przestawiać status otwiera scoped flow wyceny. Jeżeli draft Wyceny ma zaznaczoną kombinację pomieszczeń zawierającą kliknięty pokój, flow używa tej kombinacji; w przeciwnym razie spada do scope solo.
- `js/app/project/project-status-manual-guard.js` został przepięty na nowe scoped wejście przy generowaniu wyceny z blokad ręcznych statusów, dzięki czemu także ścieżka guardów korzysta z tych samych reguł exact-scope i nie robi cichych duplikatów.
- `js/tabs/wycena.js` dostał helper `showSnapshotPreview`, żeby flow `Otwórz istniejącą` mogło otworzyć dokładnie wskazaną wersję w historii bez generowania nowego snapshotu.
- `css/style.css` dostał lokalny styl modali scope-entry, a `index.html` / `dev_tests.html` zostały zaktualizowane o nowy moduł i cache-busting.
- `js/testing/wycena/tests.js` rozszerzono o regresje na: istniejącą wycenę solo, istniejącą wycenę wspólną dla konkretnej kombinacji, brak exact-scope dla innego zakresu, rozróżnienie A od A+B, podpowiedź nazwy kolejnego wariantu oraz otwarcie istniejącej wyceny bez tworzenia duplikatu.

- 2026-04-14: Room cleanup + status fallback fix — `js/app/shared/room-registry.js` pozwala teraz zapisać pustą listę pomieszczeń w modalu zarządzania, czyści zaznaczenie pokoi w draftcie `Wycena` po usunięciu pokoi i po zmianie zestawu pokojów przelicza statusy projektu/pokoi bez zostawiania starych etapów. `js/app/project/project-status-sync.js` dostał helper `reconcileProjectStatuses`, używany do pełnego przeliczenia statusów po sprzątaniu danych zamiast ręcznego nadpisywania tylko jednego scope. `js/app/quote/quote-snapshot-store.js` nie zostawia już statusu `wstepna_wycena` po skasowaniu ostatniej oferty — bez aktywnych ofert fallback wraca do `nowy` (poza `odrzucone`). `js/tabs/wycena.js` po usunięciu snapshotu woła pełną rekonsyliację statusów projektu, dzięki czemu usunięcie scope A+B nie zeruje błędnie solo A. `js/testing/investor/tests.js` i `js/testing/wycena/tests.js` dostały regresje na: zapis pustej listy pomieszczeń, czyszczenie scope draftu, powrót statusu do `nowy` po usunięciu ostatniej wyceny wstępnej oraz zachowanie solo A po usunięciu wspólnej wyceny A+B. `tools/app-dev-smoke.js` ładuje też `js/app/quote/quote-scope-entry.js`, więc pełny smoke node obejmuje teraz również testy scope-entry.


### 2026-04-16 — dev_tests fixture sync
- `dev_tests.html` now includes hidden app-view fixture nodes (`topTabs`, `roomsView`, `appView`, session/floating controls) so project smoke tests can validate tab order and roomless WYCENA entry against a stable DOM.
- `js/app/ui/views.js` is loaded in `dev_tests.html`, because project tests assert `FC.views.shouldOpenRoomlessWycena()` and `FC.views.applyFromState()` directly.

- WYCENA: po faktycznym utworzeniu nowej wyceny wstępnej `quote-scope-entry` pokazuje prosty modal tylko z `OK`; otwarcie istniejącej wersji ani zwykłej wyceny końcowej nie pokazuje tego komunikatu.
- WYCENA: przycisk `Zaakceptuj ofertę` pod `Podsumowanie` rozciąga się teraz na szerokość sekcji akcji, żeby był wyrównany do układu lewo-prawo tej karty.

- 2026-04-16: WYCENA dostała twardą walidację pustych ofert w `js/app/wycena/wycena-core.js`: brak pomieszczeń, nieistniejący scope albo scope bez żadnych danych do wyceny nie zapisuje już zerowego snapshotu. `js/tabs/wycena.js` pokazuje wtedy prosty komunikat tylko z `OK` zamiast tworzyć pustą ofertę. Dodatkowo `js/app/ui/info-box.js` obsługuje teraz wariant `okOnly`, a `js/app/quote/quote-scope-entry.js` używa go jako domyślnego potwierdzenia po faktycznym utworzeniu nowej wyceny wstępnej. `dev_tests.html` ładuje też `info-box.js`, a `js/testing/wycena/tests.js` dostał regresje na: brak pomieszczeń, nieistniejący wybrany pokój, pusty scope bez danych i domyślny komunikat OK po nowej wycenie wstępnej.

- 2026-04-15: Odtworzona paczka cabinet_room_quote_cleanup na bazie site_quote_guard_notice_fix.zip. Naprawa cabinet-cutlist (bez kruchej zależności od luźnych globali), czyszczenie wycen solo/wspólnych przy usuwaniu pomieszczeń oraz ostrzeżenia o kasowanych wycenach w modalach usuwania pokoju.

- 2026-04-15: WYCENA — przy kliknięciu `Wyceń` dla zakresu, który ma już exact-scope historię tego samego typu, `js/tabs/wycena.js` wymusza teraz nadanie nazwy kolejnemu wariantowi jeszcze przed zapisaniem snapshotu. Nowy flow używa modalnego pola nazwy z przyciskami `OK` / `Anuluj`, z proponowaną unikalną nazwą wariantu oraz walidacją duplikatu po normalizacji (case/spacing/diacritics) w `js/app/quote/quote-scope-entry.js`. `js/testing/wycena/tests.js` dostał regresje na wymuszenie nazwania nowego wariantu przy istniejącej historii scope oraz na blokadę nazwy różniącej się tylko zapisem.


## 2026-04-15 — wywiad room choice + cabinet cutlist guard
- `js/app/ui/tab-navigation.js`: `WYWIAD` bez aktywnego pokoju wraca do wyboru pomieszczeń (`roomsView`) zamiast przeskakiwać do `Inwestor`.
- `js/app/cabinet/cabinet-cutlist.js`: obudowano wywołania helperów frontów/okuć (`frontHardware`) bezpiecznymi fallbackami, żeby testy i podstawowa geometria korpusu nie wysypywały się przez brak kontekstu projektu.
- `js/testing/project/tests.js`: dodany regres pod wejście do `WYWIAD` bez aktywnego pomieszczenia.


## 2026-04-16 — async runner + home restore
- `js/testing/shared/harness.js` uruchamia i **awaituje** testy asynchroniczne, żeby suite `WYCENA` nie zostawiała po sobie stubów `FC.cabinetCutlist.getCabinetCutList` przed sekcją `Szafki`.
- `js/testing/dev-tests-page.js` zbiera raporty asynchronicznie; `APP` czeka teraz na pełne zakończenie suite zamiast scalać niegotowe obietnice.
- `js/app/ui/views.js` traktuje `entry:'home'` jako nadrzędne wobec helpera roomless `WYCENA`, więc po wyjściu na stronę główną i odświeżeniu nie powinno już wskakiwać z powrotem do `WYCENA` tylko dlatego, że zachował się `currentInvestorId`.
- `js/testing/project/tests.js` ma regresję pilnującą, że zapisany kontekst inwestora nie otwiera roomless `WYCENA` z ekranu głównego.

- 2026-04-15: Fix test fixture in `js/testing/wycena/tests.js` so explicit `rooms: []` stays empty instead of falling back to default rooms; this restores the `no_rooms` regression path for quote validation tests.

## 2026-04-15 — mini-paczka 2 / status master + mirrors
- `js/app/project/project-status-sync.js`: scoped status projektu został nazwany i domknięty jako centralny `masterStatus`; `projectStore.status` oraz `meta.projectStatus` są zapisywane wyłącznie jako lustra (`mirrorStatus`) przez jedną ścieżkę sync.
- `js/app/investor/investor-persistence.js`: `setInvestorProjectStatus(..., { returnDetails:true })` zwraca teraz wynik centralnego syncu zamiast gubić go w `result:null`.
- `js/testing/wycena/tests.js`, `js/testing/investor/tests.js`: testy pilnują zgodności master ↔ mirror dla scoped rekonsyliacji i ręcznej zmiany statusu z poziomu Inwestora.
- Cache-busting podbity w `index.html` i `dev_tests.html` dla modułów/statusów i testów tej paczki.


## 2026-04-16 — wycena anti-regression package 1
- `js/testing/wycena/fixtures.js` — wydzielone wspólne fixture/helpery dla testów `Wycena`, żeby dalszy split testów i samego `wycena.js` nie wymagał kopiowania setupów po plikach.
- `js/testing/wycena/suites/status-anti-regression.js` — nowy moduł exact-scope podpięty pod jeden runner `dev_tests.html`; dopięte antyregresje dla 3 krytycznych flow: (1) usunięcie zaakceptowanej końcowej oferty jednego pokoju nie rusza rozłącznego pokoju i wraca do aktywnej historii tego scope, (2) promocja zaakceptowanej wstępnej do końcowej nie zdejmuje `selectedByClient` z drugiego pokoju, (3) manual guard późnych etapów sprawdza exact-scope pokoju zamiast obcej końcowej oferty z innego pokoju.
- `js/testing/wycena/tests.js` — zostaje wejściem/startem dla testów `Wycena`, ale potrafi już zbierać dodatkowe moduły testowe z rejestru; to ma być wzorzec na dalsze porządki zamiast dokładania wszystkiego do jednego kloca.
- `dev_tests.html` — nadal jeden punkt wejścia; nowe moduły testów ładujemy z folderu `js/testing/wycena/suites/`, żeby nie robić bałaganu w repo.
- Instrukcja antyregresyjna: przed rozbijaniem `js/tabs/wycena.js` utrzymywać jeden browser runner i dokładać nowe suite'y modułowo pod `js/testing/wycena/suites/`, a nie przez nowe strony testowe.
- Instrukcja organizacyjna: dla nowych testów zostawiać tylko plik startowy/agregujący jako wejście (`js/testing/wycena/tests.js`), a kolejne moduły trzymać w podfolderach (`fixtures`, `suites`, itp.), żeby repo i GitHub Pages nie puchły od luźnych plików na wierzchu.


## WYCENA testy — organizacja
- Punkt wejścia dla użytkownika pozostaje jeden: `dev_tests.html`.
- Punkt wejścia kodu dla testów Wycena pozostaje jeden: `js/testing/wycena/tests.js`.
- Nowe i rozdzielane suite’y testów Wycena trafiają do folderu `js/testing/wycena/suites/`, a nie do katalogu głównego `js/testing/wycena/`.
- `js/testing/wycena/tests.js` ma być cienkim runnerem zbierającym testy z rejestru; nie doklejać z powrotem dużych inline suite’ów do tego pliku.
- Przy kolejnych paczkach antyregresyjnych dla Wycena dopinać nowe suite’y jako osobne pliki w `suites/`, zachowując jeden runner i jedną stronę testową.


## WYCENA — split i antyregresja
- `js/app/wycena/wycena-tab-helpers.js` przechowuje czyste helpery formatowania, klasyfikacji snapshotów i normalizacji scope dla zakładki `Wycena`; nie wrzucać ich z powrotem do `js/tabs/wycena.js`.
- `js/tabs/wycena.js` po starcie splitu ma być odchudzany etapami; najpierw helpery bez skutków ubocznych, dopiero później selection/history/status workflow.
- `js/app/wycena/wycena-tab-status-bridge.js` jest jedynym miejscem mostkującym workflow statusów między `Wycena` a `project-status-sync`; nie cofać `accept/remove/promote` do `js/tabs/wycena.js`.


## 2026-04-16 — WYCENA split / ROZRYS room picker guard
- `js/app/wycena/wycena-tab-selection.js` przejął selection UI zakładki `Wycena` (wybór pomieszczeń, zakres fronty/korpusy, summary, naming exact-scope). `js/tabs/wycena.js` ma tylko delegować do tego modułu, bez przywracania dużego inline bloku selection UI.
- W ROZRYS lista/picker pomieszczeń nie może mieszać realnych pokoi inwestora z legacy kreatorami `kuchnia/szafa/pokoj/lazienka`, jeśli te legacy klucze są tylko pustymi szablonami projektu. Przy aktywnym inwestorze pokazywać realne pokoje + ewentualnie pokoje odkryte w projekcie z rzeczywistymi danymi.

## 2026-04-16 — WYCENA editor split + shorter scope-entry copy
- `js/app/wycena/wycena-tab-editor.js` przejął editor handlowy zakładki `Wycena` (stawki, pola handlowe, toggle `wstępna / końcowa`, accordion ustawień oferty). `js/tabs/wycena.js` ma tylko delegować do tego modułu i nie odzyskiwać już dużego inline bloku edytora.
- Modal nadawania nazwy kolejnej wyceny exact-scope ma używać krótszego, praktycznego komunikatu; gdy caller poda pusty `hint`, `js/app/quote/quote-scope-entry.js` nie dokleja już dodatkowego bloku wyjaśniającego pod polem nazwy.

- 2026-04-17: dev_tests.html i tools/app-dev-smoke.js muszą ładować js/app/ui/tabs-router.js, bo testy renderu zakładki Wycena korzystają z FC.tabsRouter.get; nie zakładać już fallbacku tylko do FC.tabs w środowisku testowym.

- 2026-04-17: `js/app/wycena/wycena-tab-selection.js` ma resetować roboczą nazwę oferty po zmianie wybranego scope, jeśli draft niesie auto-/snapshotową nazwę z poprzedniego exact-scope; nie wolno przenosić nazw wariantów jednego pokoju na inny pokój albo scope wspólne. Dopina to test w `js/testing/wycena/suites/scope-entry.js`.
- 2026-04-17: Po analizie flow `Wyceń` wyszło, że zły warunek nie siedział w exact-scope modala, tylko w przenoszeniu starej auto-nazwy do nowego zakresu przy samym generowaniu. `js/app/wycena/wycena-tab-selection.js` prostuje teraz draftową nazwę także tuż przed `Wyceń`, jeśli ta sama auto-nazwa występuje w innym exact-scope projektu; `js/app/quote/quote-snapshot-store.js` oraz podgląd/modale/PDF używają scoped fallbacku nazwy dla starych snapshotów z regresji a / J / a+J, żeby historia nie udawała dalej wariantu pokoju J dla zakresów a i a+J. Test antyregresyjny siedzi w `js/testing/wycena/suites/scope-entry.js`.

## 2026-04-18 — WYWIAD launcher fallback + wzorce poza test runnerem
- `dev_tests.html` nie osadza już wzorców UI nad wynikami testów; wzorce otwierają się osobnym przyciskiem `Wzorce UI` i osobną stroną `dev_ui_patterns.html`, żeby wyniki smoke/testów nie mieszały się z referencjami do kopiowania 1:1.
- `js/app/cabinet/cabinet-modal.js` nie może zależeć od globalnej `calcTopForSet` z `app.js`; render zestawów ma używać namespacowanego helpera `FC.calc` przez lokalny safe-wrapper.
- `js/app/cabinet/cabinet-choice-launchers.js` ma po zwykłym montażu robić fallback-scan widocznych selectów w formularzu szafki i zakładać launcher także dla pól, które pojawiły się późno lub przeszły przez dynamiczny rerender (np. `cmFlapKind`, `setFrontCount`).
- W obszarze szafki natywne `select` pozostają źródłem prawdy, ale widoczny UI nie może wracać do systemowego selecta, jeśli pole jest objęte launcherem aplikacji.

## 2026-04-18 — Wywiad set preset SVG icons fix
- `js/app/cabinet/cabinet-modal-set-wizard.js` — presety `zestaw` przestały być rysowane inline w JS. Modal ładuje teraz osobne pliki SVG, dzięki czemu ikonki nie są zaszyte w monolicie i łatwiej je później poprawiać bez ryzyka rozjechania logiki.
- `assets/set-presets/preset-a.svg`, `preset-c.svg`, `preset-d.svg` — nowe, osobne miniatury lepiej odpowiadają realnym presetom: `A` pokazuje dwa doły + moduł u góry, `C` dół + moduł na pełnej szerokości, `D` dół + moduł środkowy + moduł górny w pionie.
- Instrukcja antyregresyjna: kolejne poprawki miniaturek presetów robić w osobnych plikach SVG, a nie przez ponowne zaszywanie kształtów inline w `cabinet-modal-set-wizard.js`.

## 2026-04-19 — room-registry / ROZRYS project-source split
- `js/app/shared/room-registry.js` został odchudzony i nie może znowu mieszać całego rdzenia rejestru, skutków ubocznych usuwania pokoju i UI modali w jednym pliku. Rdzeń definicji/merge/sort siedzi w `js/app/shared/room-registry-core.js`, a cleanup/sync po zmianie listy pokoi w `js/app/shared/room-registry-removal.js`.
- `js/app/rozrys/rozrys.js` oddaje wykrywanie kandydatów projektu i widocznych pokoi do `js/app/rozrys/rozrys-project-source.js`; nie doklejać z powrotem logiki odkrywania pokoi/projektów do monolitu zakładki.
- `dev_tests.html`, `tools/app-dev-smoke.js` i `tools/rozrys-dev-smoke.js` muszą ładować nowe moduły w tej samej kolejności co aplikacja (`room-registry-core` → `room-registry-removal` → `room-registry`, oraz `rozrys-prefs` / `rozrys-project-source` przed `rozrys.js`), inaczej smoke może zgłaszać fałszywe regresje.
- Antyregresja: `js/testing/investor/tests.js` pilnuje, że aktywne pokoje scalają meta projektu z kolejnością inwestora bez gubienia etykiet; `js/testing/rozrys/tests.js` pilnuje, że ROZRYS trzyma kolejność meta i odrzuca puste legacy pokoje.
- Uwaga architektoniczna: w tym etapie nie ruszać `js/tabs/rysunek.js` — jest tymczasowy i ma być przebudowywany osobno.


- do not split room-registry again without reproducing live app behavior against the real global `projectData` from app.js and legacy-kitchen fallback rules; tests must cover investor rooms with no `window.projectData` mirror.
## 2026-04-19 — Revert broken ROZRYS empty-room picker note
- Cofnięta ostatnia próba dopisku `Brak elementów do rozkroju` w pickerze pomieszczeń ROZRYS. Zmiana była zbyt szeroka i rozwaliła launcher pól `Pomieszczenia` / `Materiał / grupa` przez usunięcie działającego `getRoomsSummary(...)` z `js/app/rozrys/rozrys.js`.
- Przywrócone stabilne wersje: `js/app/rozrys/rozrys.js`, `js/app/rozrys/rozrys-pickers.js`, `js/app/rozrys/rozrys-selection-ui.js`, `css/rozrys-checkbox-chip-pattern.css` z bazy `site_rozrys_room_scope_start_fix_v1.zip`.
- Instrukcja antyregresyjna: przy małych zmianach UI pickera nie dotykać jednocześnie kontraktu launcherów (`getRoomsSummary`, `getMaterialsSummary`) i struktury chipów. Najpierw porównać ścieżki wejścia starego launchera 1:1, potem dopinać notki/UI.


- ROZRYS split gate: before future bridge/controller splits, keep smoke tests that explicitly verify launcher bootstrap (`updateRoomsPickerButton`, `updateMaterialPickerButton`, `syncHiddenSelections`, click bindings) and script load order/fallback contract for every new bridge loaded before `rozrys.js`.

## 2026-04-20 — investors-store recovery recursion hotfix
- `js/app/investor/investors-store.js` nie może budować recovery przez znormalizowane `FC.quoteSnapshotStore.readAll()`, bo snapshot normalization woła `room-registry`, a ten może wrócić do `FC.investors.readAll()` i zawiesić aplikację pętlą. Recovery ma czytać surowe rekordy snapshotów/projektów ze storage albo działać za reentry guardem.

- Quote snapshot store przy odczycie historii musi kanonizować `roomLabels` z `selectedRooms`/`roomRegistry`, a nie ufać ślepo starym labelom zapisanym w snapshotach z innego scope.

- `js/app/investor/investors-store.js`: przy recovery pustej listy decyzję o preferowaniu testowych snapshotów robić po zebraniu kandydatów, nie przez zbyt wczesny globalny `testOnly`; jeśli istnieją jawne testowe źródła recovery, do wyniku mają wejść tylko one, bez mieszania zwykłych snapshotów użytkownika.
- 2026-04-20: `quoteSnapshotStore.writeAll/save` nie mogą podczas normalizacji jawnych `roomLabels` odpalać `roomRegistry` i pośrednio `investors.readAll()`. Na zapisie zachowujemy kompletne explicit labels bez lookupu; kanonizacja/stara korekta etykiet ma działać dopiero przy odczycie (`readAll`).

- 2026-04-20: Po splicie runtime bundle kolejny bezpieczny split ROZRYS to mosty selection/output. Można wydzielać adaptery kontrolerów i scope summary, ale trzeba zachować lokalną kolejność bootstrapu `outputCtrl -> runCtrl` oraz hoistowane wrappery (`splitMaterialAccordionTitle`, `tryAutoRenderFromCache`, `buildEntriesForScope`).

- ROZRYS: po splicie panel workspace rozrys.js ma pobierać helpery/refy z obiektu `workspace` przez live property refs (`workspace.xxx`), nie przez duże destrukturyzowanie, bo smoke/testy pilnują tego bezpiecznego spięcia po wydzieleniu panelu.

- 2026-04-20: kolejny bezpieczny split ROZRYS może wynosić duże obiekty `ctx/deps` z `render()` do osobnego assemblera configów, ale bez ruszania launcherów, `aggregatePartsForProject(...)`, `resolveInitialSelectedRooms(...)` i bez zmiany jawnej kolejności `selectionBridge.init()` oraz `outputCtrl -> runCtrl`.

## 2026-04-20 — ROZRYS lazy tab bootstrap shell
- `index.html` — ciężki interaktywny stos zakładki `ROZRYS` nie jest już ładowany w krytycznym starcie. W startupie zostają shared API (`scope`, `prefs`, `engine`, `render`, pickery itd.), a sam tab-specific runtime (`state`, modale, workspace, runtime bundle, controllers, `rozrys.js`) jest dociągany dopiero przy wejściu do zakładki.
- `js/app/rozrys/rozrys-lazy-manifest.js` + `rozrys-lazy-loader.js` — jawny manifest i loader sekwencyjny dla deferred skryptów ROZRYS. To ma utrzymać kolejność bootstrapu bez dokładania ręcznych `<script>` do `index.html`.
- `js/app/rozrys/rozrys-shell.js` — lekki shell API dla `FC.rozrys`: daje helpery potrzebne innym działom (`safeGetProject`, `aggregatePartsForProject`, room discovery) i placeholder `render()` uruchamiający lazy-load właściwego modułu. Dzięki temu `Wycena` i inne działy nie muszą czekać na pełen tab runtime.
- `js/app/rozrys/rozrys.js` — końcowy eksport nie nadpisuje już ślepo `FC.rozrys`, tylko merguje się z istniejącym shellem. To zachowuje pola pomocnicze typu `__projectOverride` i nie gubi stanu po lazy-loadzie.
- Instrukcja antyregresyjna: kolejne helpery wykorzystywane poza zakładką `ROZRYS` trafiają do startup shared API albo lekkiego shellu, a nie do deferred tab runtime. Do lazy group wrzucać tylko moduły naprawdę potrzebne dopiero po wejściu w `ROZRYS`.

## 2026-04-20 — ROZRYS bootstrap tests use deferred entrypoint for runtime/scope bundles too
- `js/testing/rozrys/tests.js` — pozostałe dwa testy `Bootstrap i splity` (`run controller/runtime bundle` oraz `scope/panel/runtime/output`) też zostały przepięte na wspólny helper `getRozrysStartupOrderSource(...)`. Dzięki temu dla nowych splitów startupu test sprawdza prawdziwy entrypoint ROZRYS (`index.html` albo `rozrys-lazy-manifest.js`), zamiast ślepo wymuszać stare wpisy bezpośrednio w `index.html`.
- `dev_tests.html` — podbity cache-busting dla testów ROZRYS po tej korekcie.
- Instrukcja antyregresyjna: jeśli runtime asset ROZRYS jest świadomie deferred, test bootstrapu ma pilnować jego kolejności w realnym entrypoincie, a nie traktować braku wpisu w `index.html` jako błąd sam w sobie.

## 2026-04-21 — startup fallback home guard + ROZRYS mixed entrypoint tests
- `js/app/bootstrap/app-ui-bootstrap.js` — awaryjny fallback widoków nie pokazuje już domyślnie `roomsView` przy błędzie/ braku routera widoków. Zamiast tego robi pełne `showOnly` dla znanych ekranów i odtwarza logikę entrypointu (`home`, `modeHub`, `rooms`, `app`, `investor`, `rozrys`, `magazyn`). Dzięki temu po odświeżeniu nie może już przykleić starego ekranu pomieszczeń pod ekran Start.
- `js/testing/project/tests.js` — dodany test antyregresyjny dla awaryjnego fallbacku startu: jeśli `views.applyFromState` rzuci wyjątek, Start ma pozostać jedynym widokiem i nie może pojawić się `roomsView` ani top tabs.
- `js/testing/rozrys/tests.js` — helper startup entrypointu akceptuje teraz także mieszany model eager+deferred: część assetów ROZRYS może siedzieć w `index.html` (np. `rozrys-scope.js`), a część w `js/app/rozrys/rozrys-lazy-manifest.js`. Test nadal pilnuje kontraktu kolejności, ale nie wymusza już sztucznie jednego wspólnego źródła.
- Instrukcja antyregresyjna: jeśli fallback startu musi przejąć routing, ma używać pełnego `showOnly` dla wszystkich głównych widoków, a nie tylko przełączać `roomsView/appView`. Przy testach bootstrapu ROZRYS dopuszczać rozdzielony entrypoint eager+deferred, o ile kolejność pozostaje poprawna.
- Bootstrap UI test harness may pass a fixture element instead of full document; startup fallback helpers must support both getElementById and querySelector roots to avoid false regressions.

- 2026-04-22: Registry/performance hardening: `room-registry-definitions` now caches active room defs/ids/labels by lightweight room/project signatures, and `room-registry-modals-manage-remove` uses structural draft comparison instead of repeated JSON serialization on each footer refresh. `FC.session.isDirty()` now caches comparable keys and short-window dirty checks; storage writes invalidate the cache. Do not reintroduce repeated full recomputation of room labels/active rooms on hot UI paths without profiling.

## 2026-04-22 — Investor tab perf: bulk manual-status guard for room cards
- `js/app/project/project-status-manual-guard.js` — dodane `evaluateManualStatusChangeFromBasis(...)` i `buildManualStatusChoiceStates(...)`. Guard może teraz policzyć analizę exact-scope pokoju raz i użyć jej do wielu statusów zamiast powtarzać ciężkie `analyzeRoomQuoteState` dla każdego `<option>` osobno.
- `js/app/investor/investor-rooms.js` — mount statusów projektu na kartach pokoi używa najpierw bulkowego `buildManualStatusChoiceStates(...)`, a dopiero awaryjnie spada do starego `validateManualStatusChange(...)`. To ma zmniejszyć lag zakładki Inwestor widoczny przy kilku pokojach i szybkich przełączeniach.
- `js/testing/wycena/suites/investor-integration.js` — test kontraktowy pilnuje, że bulkowy guard zwraca te same blokady/odblokowania co pojedyncze `validateManualStatusChange`.
- Instrukcja antyregresyjna: przy renderach list/kart z wieloma statusami nie wołać ciężkiego guardu per opcja, jeśli wszystkie opcje dotyczą tego samego pokoju/bazy. Najpierw budować wspólną analizę exact-scope i dopiero z niej wyprowadzać stany wielu opcji.


## 2026-04-23 — cabinet tests runtime must load front-hardware for set front/hinge contract
- `dev_tests.html` (oraz `autorun_cabinet_tests.html`, jeśli jest używany) musi ładować `js/app/cabinet/front-hardware.js` przed testami szafek. Sam `cabinet-cutlist.js` nie wystarcza, bo wtedy testy materiałów zestawu lecą fallbackiem bez frontów i zawiasów.
- Instrukcja antyregresyjna: przy przenoszeniu stabilnej bazy lub cherry-pickach zmian zestawów sprawdzać nie tylko `index.html`, ale też pełne środowisko testowe. Jeśli funkcja produkcyjna zależy od modułu pomocniczego (`front-hardware`, `calc`, itp.), test runner musi go ładować jawnie.
