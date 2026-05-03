# CLOUD_MIGRATION — plan przygotowania meble-app pod chmurę

Ten plik jest stałym punktem odniesienia dla zmian dotyczących danych. `DEV.md` trzyma ogólne zasady pracy, a ten plik trzyma zasady migracji danych, localStorage, backupów i przyszłej synchronizacji.

## Cel

Przygotować aplikację tak, żeby obecny tryb lokalny działał dalej, ale żeby dane można było później przenieść do chmury bez przepisywania całego programu.

Docelowy kierunek techniczny: Google/Firebase, najpewniej Firebase Authentication + Cloud Firestore. To nie oznacza natychmiastowego wdrożenia chmury. Najpierw porządkujemy model danych, repozytoria i granice odpowiedzialności.

## Obowiązkowa checklista przy każdej zmianie danych

Przed wydaniem paczki, która tworzy albo mocno zmienia zapis/odczyt danych, sprawdzić:

1. Czy nie powstał nowy bezpośredni zapis do `localStorage` rozsiany po UI albo module domenowym.
2. Czy zapis idzie przez istniejący store/repository/helper albo czy zmiana przynajmniej przesuwa kod w stronę takiej granicy.
3. Czy dane użytkownika są oddzielone od cache, stanu UI i danych technicznych.
4. Czy nie powielamy tego samego inwestora/projektu/szafek w kilku trwałych miejscach bez jasnej potrzeby.
5. Czy rekordy mają stabilne ID, które nadają się później do dokumentów Firestore.
6. Czy model da się mapować na kolekcje/dokumenty, a nie tylko na jeden wielki JSON.
7. Czy import/export/backup jasno obejmują dane użytkownika, a nie przypadkowy cache albo robocze kopie.
8. Czy testy danych nadal oznaczają dane testowe przez `__test:true` i `__testRunId`.
9. Czy zmiana nie utrudnia późniejszej synchronizacji między telefonem, tabletem i komputerem.
10. Czy ewentualny większy problem migracyjny został wpisany tutaj albo zgłoszony użytkownikowi jako osobny etap.

Małe lokalne poprawki cloud-ready robić od razu, jeśli nie zmieniają UI ani zachowania biznesowego. Większe zmiany między domenami zgłaszać jako osobny etap, nie robić ukrytego refaktoru.

## Podział danych docelowo

### Dane użytkownika — docelowo do chmury

- inwestorzy,
- projekty,
- pomieszczenia,
- szafki i ich parametry,
- materiały, formatki, okleiny i ustawienia użyte w projekcie,
- wyceny, historia ofert i drafty ofert,
- zlecenia usługowe,
- cenniki materiałów, akcesoriów, usług i stawek wyceny,
- świadomie zapisane backupy/snapshoty, jeśli później zdecydujemy się na backupy chmurowe.

### Dane techniczne — lokalne albo pomocnicze

- stan UI,
- rozwinięcia accordionów,
- aktywna zakładka,
- cache ROZRYS,
- tymczasowe dane sesji edycji,
- techniczne flagi restore/reload,
- raporty diagnostyczne,
- dane testowe.

Dane techniczne nie powinny być mieszane z danymi użytkownika. Backup użytkownika nie powinien obejmować cache, tymczasowych sesji ani roboczych kopii awaryjnych.

## Obecne lokalne magazyny i kierunek migracji

### Inwestorzy

Obecnie: `fc_investors_v1` oraz mechanizmy recovery/removed IDs.

Kierunek: kolekcja `users/{userId}/investors/{investorId}`. Inwestor powinien mieć stabilne ID i podstawowe dane kontaktowe. Usunięcia/recovery trzeba docelowo rozwiązać przez status/soft delete albo osobną historię operacji.

### Projekty

Obecnie występują równolegle m.in. `fc_project_v1`, `fc_projects_v1` i sloty `fc_project_inv_*_v1`.

Kierunek: jedno kanoniczne repozytorium projektów. Docelowo `users/{userId}/projects/{projectId}` z powiązaniem do inwestora i pomieszczenia. Stare sloty per inwestor traktować jako dług migracyjny i nie dokładać nowych trwałych duplikatów bez wyraźnej potrzeby.

### Wyceny i oferty

Obecnie: snapshoty/drafty ofert oraz store wyceny.

Kierunek: oddzielić bieżący stan wyceny od historii zaakceptowanych/zapisanych ofert. Historia ofert może być osobną kolekcją, np. `users/{userId}/quotes/{quoteId}` albo podkolekcją projektu.

### Cenniki i katalogi

Obecnie: różne klucze katalogowe/cennikowe i część legacy.

Kierunek: repozytorium katalogów z wersjonowaniem albo jasnym podziałem na katalog użytkownika i wartości domyślne. Nie mieszać katalogów z konkretnymi projektami, poza snapshotem wartości użytych w ofercie/projekcie.

### ROZRYS

Dane wejściowe do ROZRYS mogą być użytkowe, ale wygenerowany cache planu jest techniczny.

Kierunek: w chmurze trzymać dane wejściowe i ewentualnie zapisany wynik tylko wtedy, gdy użytkownik świadomie go zapisuje. Cache generowany automatycznie zostaje lokalny.

### Backupy

Obecnie: `fc_data_backups_v1` w localStorage, z retencją programu i testów.

Kierunek: krótkoterminowo zostaje lokalnie. Później możliwy osobny mechanizm backupów chmurowych, ale nie przez wrzucanie całego localStorage jako jednego trwałego dokumentu bez kontroli rozmiaru i zakresu.

## Proponowane etapy migracji

### Etap 1 — audyt i granice danych

- wypisać wszystkie bezpośrednie użycia `localStorage`,
- oznaczyć je jako user/technical/cache/test,
- wskazać, które powinny przejść za repozytorium,
- nie zmieniać UI ani zachowania biznesowego.

### Etap 2 — lokalne repozytoria/adaptery

- wprowadzać cienkie repozytoria danych dla inwestorów, projektów, wycen, zleceń i katalogów,
- najpierw adapter nadal zapisuje do localStorage,
- UI i domeny nie powinny pisać bezpośrednio do localStorage.

### Etap 3 — model Firestore

- zaprojektować kolekcje i dokumenty,
- ustalić limity dokumentów i wielkości projektów,
- zdecydować, które dane są dokumentami, a które podkolekcjami,
- przygotować reguły bezpieczeństwa i logowanie.

### Etap 4 — ręczna synchronizacja/pilotaż

- dodać logowanie,
- dodać ręczne `Wyślij do chmury` / `Pobierz z chmury`,
- nie robić od razu pełnej dwukierunkowej synchronizacji,
- dodać raport porównania lokalne vs chmura.

### Etap 5 — pełniejsza synchronizacja

- auto-save,
- offline cache,
- rozwiązywanie konfliktów,
- historia zmian,
- backup chmurowy.

## Zasady zakazane

- Nie dodawać nowego trwałego klucza `localStorage` bez sprawdzenia, czy nie powinien być częścią istniejącego store/repository.
- Nie wrzucać całego programu do jednego dokumentu chmury jako jeden JSON.
- Nie mieszać cache i danych użytkownika w jednym rekordzie bez wyraźnego powodu.
- Nie ukrywać dużej migracji danych w paczce, która miała być zwykłą poprawką UI.
- Nie tworzyć kolejnych trwałych kopii projektu tylko po to, żeby „na szybko” coś przywrócić.



## Czynności labor UI adjust v1 — 2026-05-03

- Poprawka jest UI-only: nie dodaje nowego storage, nie zmienia modelu `cabinet.laborItems`, nie zmienia katalogu `quoteRates` ani snapshotów ofert.
- Zachowany kierunek cloud-ready: zakładka `CZYNNOŚCI` jest workspace robocizny, ale dane nadal idą przez istniejące store/selekcje i draft oferty, bez nowych trwałych kluczy lokalnych.


## Pricing labor display fix v1 — 2026-05-03

- Poprawka nie dodaje nowego storage i nie zmienia formatu danych. Zachowuje istniejące `quoteRates` jako katalog użytkownika oraz `cabinet.laborItems` jako dane przypięte do konkretnej szafki.
- Dla przyszłej chmury ważny kontrakt: katalog robocizny jest czytany przez selektory/repository boundary, a WYCENA zapisuje wynik w snapshotach ofert; UI nie powinien czytać bezpośrednio z localStorage.
- `catalogStore.getPriceList(kind)` pozostaje bazowym adapterem lokalnym, ale publiczne aliasy `getQuoteRates` itp. są utrzymane dla kompatybilności modułów domenowych.

## Audyt źródeł storage — 2026-04-26

Dodano narzędzie `tools/local-storage-source-audit.js`, które skanuje źródła `js` pod kątem bezpośrednich referencji do `localStorage` i `sessionStorage`.

Aktualny wynik po etapie `app shell storage boundary stage 1`:

- 25 plików z referencjami do storage,
- 229 referencji storage razem,
- 150 referencji w testach i narzędziach testowych,
- `js/app.js` nie ma już bezpośredniego `localStorage` ani `sessionStorage`; reload/restore jest w `js/app/bootstrap/reload-restore.js`,
- kontrolowane granice: `js/app/shared/storage.js`, `js/app/bootstrap/reload-restore.js`, `js/app/shared/data-storage-*`, `js/app/shared/data-backup-*`, store domenowe i `js/app/investor/session.js`,
- obszary do dalszego wygaszania bezpośrednich zapisów: `js/boot.js` jako boot-level wyjątek, `js/app/investor/investor-project.js`, `js/app/material/*`, `js/app/rozrys/*`.

Decyzja po stage 1: `fc_reload_restore_v1` zostaje technicznym, sesyjnym stanem UI i nie jest danymi użytkownika. Może być obsługiwany przez session boundary, nie przez repozytorium projektów.

Decyzja: nie robić ukrytej migracji danych w paczkach porządkowych. Przy następnych zmianach danych lokalnie przesuwać zapisy/odczyty do store/repository/adaptera, jeśli zmiana jest mała i nie zmienia UI ani zachowania biznesowego. Większe przepięcia projektów, inwestorów i cenników robić jako osobne etapy z testami kontraktowymi.

## Bieżące długi do pilnowania

- `fc_project_v1`, `fc_projects_v1` i `fc_project_inv_*_v1` nadal pokazują historyczną duplikację modelu projektu. Nie dokładać nowych mechanizmów, które ją pogłębiają.
- `fc_edge_v1` jest relatywnie duże i może wymagać później powiązania z konkretnym projektem/pomieszczeniem zamiast globalnego rośnięcia bez kontroli.
- Backup lokalny działa, ale przy wielu inwestorach nie może być traktowany jako docelowa chmura. To tylko zabezpieczenie lokalne.
- Testy i narzędzia pamięci muszą dalej pilnować, czy dane techniczne/cache nie trafiają do backupu użytkownika.

## Decyzja status/meta Wyceny — 2026-04-26

- `projectData.meta` jest częścią modelu projektu i normalizacja projektu nie może go gubić. `meta.projectStatus` pozostaje lustrem statusu używanym przez Wycena/status bridge oraz przyszły adapter chmurowy.
- Testy cleanup/izolacji nie mogą interpretować inwestorów odbudowanych z realnych snapshotów Wyceny jako danych testowych. Przy testach należy izolować źródła recovery i przywracać je po zakończeniu, bez kasowania danych użytkownika i bez dotykania backupów.

## Wycena status contract v1

Dodane testy statusów utrwalają zasadę cloud-ready: snapshot oferty, status pokoju, `projectStore.status` i `loadedProject.meta.projectStatus` muszą być spójne według exact-scope. To ogranicza ryzyko późniejszej migracji do zdalnego repozytorium, gdzie stan pokoju i historia ofert nie mogą rozjeżdżać się przez lokalne fallbacki.

## Wycena contracts audit v1 — 2026-04-27

- Etap był audytowo-testowy: bez zmian runtime, modelu danych, storage i backupów.
- Kontrakty Wyceny utrwalają granice istotne pod chmurę: snapshot oferty, exact-scope pokojów, status projektu/pokoju i fasady `quoteSnapshotStore` / `projectStatusSync` muszą pozostać spójne przy przyszłych splitach.
- Przyszły split `quote-snapshot-store.js` albo `project-status-sync.js` wymaga porównania old/new na danych fixture przed wydaniem, bo te moduły są bezpośrednio związane z docelowym modelem `quotes` i statusem projektu w Firestore.

## Wycena snapshot scope split v1 — 2026-04-28

- Wydzielono czyste helpery scope snapshotów do `js/app/quote/quote-snapshot-scope.js` bez dodawania storage i bez zmiany modelu danych.
- To poprawia cloud-readiness historii ofert: zakres pokoi, etykiety, materialScope, exact-scope i overlap są teraz oddzielone od trwałego store, więc późniejszy adapter Firestore może użyć tej samej logiki bez mieszania z localStorage.
- `quote-snapshot-store.js` nadal pozostaje lokalnym repozytorium snapshotów i nie powinien dostać nowej logiki statusów ani UI. Kolejny etap danych Wyceny powinien osobno zabezpieczyć selection/rejected/accepted flow.

## 2026-04-28 — Wycena snapshot selection split v1

- Split selection snapshotów nie dodaje nowego storage ani nowego formatu danych.
- `quote-snapshot-selection.js` dostaje `readAll/writeAll/getById/listForProject` przez dependency injection ze store, co utrzymuje granicę przyszłego repozytorium/adaptera.
- To jest korzystne pod chmurę: logika wyboru/akceptacji oferty jest oddzielona od konkretnej implementacji lokalnego storage.
- Nie zmieniono polityki rejected/selected ani modelu snapshotu, więc nie jest wymagana migracja danych.

## 2026-04-28 — Wycena core selection split v1

- Split selection/validation Wyceny nie dodaje nowego storage, nie zmienia modelu snapshotów i nie wymaga migracji danych.
- `wycena-core-selection.js` oddziela wybór pomieszczeń i material scope od collect/build snapshot, co ułatwia przyszłe mapowanie Wyceny na repozytorium/adapter chmurowy.
- Publiczne wejścia `FC.wycenaCore` pozostają bez zmian, więc późniejszy adapter Firestore może być wprowadzany etapowo bez zmiany UI.

## 2026-04-28 — Project status scope split v1

- Split status scope nie dodaje storage, nie zmienia modelu danych i nie wymaga migracji.
- `project-status-scope.js` oddziela wyliczanie zakresów/statusów od zapisu mirrorów w `project-status-sync.js`, co poprawia przyszłą mapowalność statusów pokoi/projektów do Firestore.
- Granica zapisu pozostaje w `project-status-sync.js` przez istniejące store/fasady; nie wprowadzono nowych bezpośrednich zapisów do `localStorage`.
- Dalsze prace przy statusach muszą zachować spójność: status pokoju, status projektu, zaakceptowana oferta i snapshot historii ofert.


## 2026-04-30 — Investor store boundary v1

- `FC.investors` pozostaje publiczną fasadą, ale model/normalizacja, lokalne storage i recovery zostały rozdzielone do osobnych modułów.
- `js/app/investor/investors-local-repository.js` jest teraz jawną lokalną granicą dla `fc_investors_v1`, `fc_current_investor_v1`, `fc_investor_removed_ids_v1` oraz odczytów źródeł recovery.
- `js/app/investor/investors-recovery.js` nie powinien zapisywać danych użytkownika; ma tylko budować listę kandydatów recovery i filtrować testowe źródła.
- Nie zmieniono formatu danych, więc etap nie wymaga migracji. Przy przyszłym adapterze Firestore można wymieniać repository bez zmiany publicznej fasady `FC.investors`.
- Nadal nie rozwiązuje to długu `js/app/investor/investor-project.js`, który ma własne bezpośrednie użycia `localStorage` i powinien być kolejnym kandydatem danych inwestora/projektu.

## 2026-04-30 — Investor project boundary v1

- `investor-project.js` nie zapisuje już samodzielnie per-inwestorowych slotów i nie miesza storage z patchowaniem API. Lokalna granica `fc_project_inv_*_v1` została wydzielona do `js/app/investor/investor-project-repository.js`.
- Nie zmieniono formatu danych: nadal istnieją `fc_project_v1`, `fc_projects_v1` i legacy sloty `fc_project_inv_*_v1`, ale nowe odwołania w obszarze inwestor/projekt powinny przechodzić przez repository/runtime zamiast rozproszonego `localStorage`.
- To jest etap przygotowawczy pod przyszły adapter chmurowy: `investor-project-runtime.js` obsługuje aktywny projekt i zachowuje dotychczasowe publiczne wejścia, a repository jest miejscem późniejszej wymiany lokalnych slotów na Firestore/remote sync.
- Nadal nie robiono ukrytej migracji ani automatycznego czyszczenia backupów/slotów; polityka backupów pozostaje bez zmian.

## Decyzja — status boundary v1 (`site_project_status_boundary_v1.zip`)

- Synchronizacja statusu projektu/pomieszczeń została rozdzielona bez zmiany formatu danych i bez nowego `localStorage`.
- Zapis luster statusów idzie przez istniejące granice `FC.investorPersistence`, `FC.investors`, `FC.projectStore` i `FC.project.save`; `project-status-sync.js` nie powinien bezpośrednio zapisywać storage.
- Workflow zaakceptowanych ofert/snapshotów jest osobnym modułem `project-status-snapshot-flow.js`, co ułatwia późniejsze mapowanie statusów i historii ofert na dokumenty Firestore.

## 2026-05-01 — Orphan fixture cleanup v1

- Testy Wyceny nie mogą zostawiać trwałych `fc_project_inv_*_v1`, bo legacy sloty projektu są danymi użytkownika/kompatybilności, a nie śmietnikiem testowym.
- Fixture testów przywraca teraz dokładny zestaw legacy slotów sprzed testu, co ogranicza sztuczne osierocone dane i ułatwia późniejsze rozdzielenie lokalnych slotów od docelowego repozytorium chmurowego.
- Nie zmieniono modelu danych ani nie dodano migracji; poprawka dotyczy izolacji testów i ręcznego sprzątania osieroconych slotów.


## 2026-05-01 — Retencja backupów testowych

- Automatyczne backupy testowe `before-tests` są danymi technicznymi/testowymi, nie docelowym archiwum użytkownika.
- Ustalono twardy lokalny limit: maksymalnie 10 najnowszych backupów testowych; najstarsze testowe kopie są automatycznie usuwane przy zapisie kolejnych.
- Ręczne backupy programu pozostają na wcześniejszej, bezpieczniejszej polityce retencji i nie są ograniczane tym limitem.

## 2026-05-01 — Wycena core platform split v1

- `wycena-core.js` został odchudzony do orchestratorka bez bezpośredniego storage i bez UI.
- Logika Wyceny została rozdzielona na warstwy przydatne do przyszłej chmury:
  - `wycena-core-catalog.js` — katalog/usługi/ceny jako przyszła granica adaptera katalogu,
  - `wycena-core-source.js` — odczyt aktywnego projektu, pokojów i agregacji jako granica źródeł danych,
  - `wycena-core-material-plan.js` — most Wycena ↔ ROZRYS dla liczenia arkuszy,
  - `wycena-core-offer.js` — draft handlowy i stawki oferty,
  - `wycena-core-lines.js` — budowa linii oferty bez zapisu danych.
- Nie dodano nowych bezpośrednich użyć `localStorage`/`sessionStorage` w Wycena core. Dalsze zmiany cennika/ofert powinny iść przez repozytoria/adapters, żeby łatwo mapować dane do Firestore.

## 2026-05-01 — Test cleanup boundary v1

- Sprzątanie danych testowych zostało domknięte jako osobny testowy boundary, bez zmiany produkcyjnego modelu danych.
- Testowe rekordy inwestorów/projektów mają stabilne markery i mogą później mapować się do osobnej przestrzeni technicznej w chmurze zamiast mieszać się z realnymi dokumentami użytkownika.
- Cleanup testów usuwa powiązania po `investorId` i `projectId`, co odpowiada przyszłemu podejściu repozytoryjnemu/adapterowemu: usunięcie technicznego rekordu testowego musi usuwać też jego podrzędne dokumenty techniczne.


## 2026-05-01 — Quote scope entry boundary v1

- Split `quote-scope-entry.js` nie dodaje storage i nie zmienia modelu danych snapshotów/ofert.
- Zakres wejścia do Wyceny (`roomIds`, exact-scope, nazwy wersji) został odseparowany od modali i flow tworzenia snapshotu, co ułatwia późniejsze mapowanie ofert na dokumenty chmurowe.
- `quote-scope-entry-flow.js` nadal używa istniejących fasad `quoteOfferStore`, `quoteSnapshotStore`, `wycenaCore`, `projectStore` i `projectStatusSync`; nie wolno w tym flow dodawać bezpośrednich zapisów do `localStorage`.

## 2026-05-01 — Status po pomiarze jako oczekiwanie na wycenę końcową

- Dla przyszłej chmury i harmonogramu status `wycena` po etapie `pomiar` należy traktować jako procesowy stan „czeka na wycenę końcową po pomiarze”, a nie jako zmianę decyzji klienta wobec wstępnej oferty.
- Zaakceptowana wycena wstępna pozostaje dokumentem historycznym/punktem odniesienia; nie jest automatycznie oznaczana jako odrzucona przy przejściu do końcowej wyceny.
- Przy późniejszym modelu Firestore rozdzielać dokument/status oferty (`selectedByClient`, `rejectedAt`, `acceptedStage`) od procesu projektu/pokoju (`pomiar`, `wycena`, `zaakceptowany`).

## 2026-05-02 — Wycena selection split v1

- Split wyboru zakresu Wyceny nie dodaje storage, nie zmienia modelu danych i nie wymaga migracji.
- `wycena-tab-selection-scope.js` trzyma normalizację zakresu pomieszczeń i summary, a `wycena-tab-selection-version.js` trzyma nazwy wersji/snapshotów. Dzięki temu przyszły adapter chmurowy może mapować scope i historię ofert bez zależności od renderu/pickerów.
- `wycena-tab-selection-pickers.js` i `wycena-tab-selection-render.js` są warstwami UI bez zapisów danych; zmiany w nich nie powinny dodawać bezpośredniego `localStorage` ani zmieniać semantyki snapshotów.


## 2026-05-02 — Wycena tab boundary v1

- Split `tabs/wycena.js` nie dodał żadnych nowych zapisów ani odczytów `localStorage`/`sessionStorage`.
- Dostęp zakładki WYCENA do bieżącego projektu, inwestora, historii snapshotów i draftu oferty jest zamknięty w `js/app/wycena/wycena-tab-data.js`.
- Ten adapter jest przygotowany jako przyszły punkt wymiany źródła danych na repository/chmurę; pozostałe warstwy zakładki nie powinny znać szczegółów storage.
- Stan UI zakładki (`previewSnapshotId`, przywracanie scrolla, otwarcie edytora) jest w `wycena-tab-state.js` i nie jest traktowany jako dane użytkownika do synchronizacji.

## 2026-05-02 — Multi-room quote scope in manual status guard

- Zmiana nie dodaje pól, migracji ani nowych zapisów storage; używa istniejącego `scope.selectedRooms` snapshotów Wyceny.
- Dla przyszłej chmury ważna zasada: status pokoju może być oparty na ofercie/snapshotcie obejmującym więcej niż jeden pokój, jeśli ten pokój należy do scope zaakceptowanej oferty.
- Nie mieszać tego z duplikowaniem ofert per pokój. Wspólna oferta powinna pozostać jednym dokumentem z wieloma `roomIds`, a guard statusu ma rozpoznawać przynależność pokoju do tego scope.



## 2026-05-02 — Status / quote scope v1

- Zmiana nie dodaje nowych pól storage ani migracji danych; wykorzystuje istniejące statusy pomieszczeń/projektu oraz `scope.selectedRooms` snapshotów Wyceny.
- Dla przyszłej chmury utrwalono rozdział: oferta/snapshot jest dokumentem z zakresem `roomIds`, a status procesu pokoju/projektu może istnieć także bez wyceny wstępnej.
- `Pomiar` i `Wycena` bez wyceny wstępnej są legalnym stanem procesowym, który późniejszy harmonogram może filtrować jako: trzeba umówić pomiar albo trzeba przygotować wycenę końcową po pomiarze.
- Przy kilku zaakceptowanych zakresach obejmujących pokój decyzja statusu jest jawna i runtime'owa; nie duplikować dokumentów ofert per pokój tylko po to, żeby rozstrzygać status.
- `wycena-room-availability.js` rozdziela kalkulację oferty od procesu: pomieszczenie bez szafek może mieć status `Pomiar/Wycena`, ale nie wchodzi do kalkulacji Wyceny, dopóki nie ma elementów do policzenia.
- Nie dodano bezpośrednich zapisów do `localStorage`/`sessionStorage`; zmiany idą przez istniejące fasady statusu, persistence i selection.

## 2026-05-02 — Manual status preserve v1

- Nie zmieniono formatu danych ani kluczy storage.
- Doprecyzowano semantykę statusów pokoi: ręczna zmiana statusu jednego pokoju jest operacją scoped i nie może przepisywać statusów innych pokoi fallbackiem z braku ofert.
- To wspiera przyszłą chmurę, bo rozdziela dwa typy zdarzeń: ręczne ustawienie statusu pokoju oraz rekonsyliację wynikającą ze zmiany/usunięcia zaakceptowanej oferty. Te zdarzenia powinny w przyszłości być osobnymi zapisami/komendami w repozytorium.


## 2026-05-02 — Schedule status prep v1

- Nie dodano nowych kluczy storage ani migracji.
- Przyszły harmonogram ma być zasilany z read-only API `FC.projectScheduleStatus`, które składa dane z istniejących rekordów inwestora, projektu i snapshotów Wyceny.
- Semantyka pod chmurę: status pokoju jest stanem procesu, a oferta/snapshot jest dokumentem handlowym ze scope `roomIds`; nie duplikować wspólnych ofert per pokój.
- `Pomiar` i `Wycena` bez wyceny wstępnej są legalnymi stanami procesowymi i powinny być zapisywane jako osobne komendy/statusy pokoju, nie jako sztuczne snapshoty.
- Pomieszczenie bez szafek może istnieć w kolejce `finalQuote`, ale kalkulacja Wyceny musi nadal sprawdzać dostępność przez `wycena-room-availability`.


## Statusy scoped pod harmonogram — 2026-05-02

- Status pokoju i historia ofert pozostają osobnymi warstwami danych: oferta ma `scope`, a status pokoju może wynikać z oferty albo z ręcznej decyzji procesowej.
- Rekonsyliacja po akceptacji oferty jest zakresowa: zapis statusu dotyka tylko pokoi z zakresu oferty oraz świadomie zwolnionych pokoi po zmianie zaakceptowanego zakresu. Nie wolno globalnie wyliczać `Nowy` dla wszystkich pokoi inwestora tylko dlatego, że nie mają snapshotu.
- To jest ważne pod przyszłą chmurę/harmonogram: zadania `Pomiar` i `Wycena` mogą istnieć bez wyceny wstępnej, a późniejszy kalendarz ma czytać statusy procesowe przez boundary, nie przez ponowną interpretację historii ofert w UI.


## 2026-05-02 — Status źródłowy oferty przy zastępowaniu zakresów

- Nie zmieniono formatu danych ani storage; poprawka działa na istniejących snapshotach i statusach pokoi.
- Dla przyszłej chmury ważna jest zasada źródła statusu: status pokoju wynikający z zaakceptowanej końcowej oferty może zostać cofnięty, jeśli ta konkretna końcowa oferta zostanie zastąpiona/odrzucona przez zaakceptowaną wycenę wstępną obejmującą ten zakres.
- Ręczny status pokoju pozostaje osobnym źródłem procesu i nie może być nadpisywany globalną rekonsyliacją ofert spoza swojego zakresu.
- Ten podział źródeł będzie istotny przy modelowaniu Firestore: `quotes`/snapshoty ofert i statusy procesowe pokoi muszą być synchronizowane zakresowo, nie globalnie po inwestorze.


## 2026-05-02 — Manual status restore v1

- Dodano pole domenowe pokoju `lastManualProjectStatus` jako lokalny odpowiednik przyszłego zdarzenia/komendy: ostatnia ręczna decyzja procesowa użytkownika dla pomieszczenia.
- To nie jest nowy klucz storage i nie tworzy osobnego magazynu danych; pole jest częścią rekordu pokoju inwestora, więc później może mapować się do dokumentu `rooms/{roomId}` albo do eventu statusowego w Firestore.
- Chmurowy model powinien rozróżniać: status wynikający z zaakceptowanej oferty (`quotes` ze scope) oraz ostatni ręczny status procesu (`lastManualProjectStatus` / event manual status). Rekonsyliacja ma być zakresowa, a nie globalna po inwestorze.
- Gdy pokój wypada ze wspólnej zaakceptowanej oferty, brak aktywnej oferty dla tego pokoju oznacza powrót do ostatniego ręcznego statusu, nie automatyczny reset do `Nowy`.


## 2026-05-02 — App core namespace split v1

- Zmiana nie dodaje nowego klucza storage, migracji ani formatu danych.
- Fallback storage/project został przeniesiony z `app.js` do `js/app/bootstrap/app-core-namespace.js`, ale produkcyjnie nadal korzysta z istniejących granic `FC.storage`, `FC.schema` i `FC.project` / `project-bridge`.
- To poprawia cloud-readiness app shell: bootstrapping namespace jest oddzielony od runtime shellu, a przyszła wymiana lokalnego `FC.project` na adapter zdalny nie będzie wymagała dopisywania logiki do `app.js`.
- Nie zmieniono polityki backupów ani nie ruszono retencji/oczyszczania.


## 2026-05-02 — App legacy bridges split v1

- Wydzielenie `js/app/bootstrap/app-legacy-bridges.js` nie dodało żadnego nowego storage ani nie zmieniło formatu danych.
- `app.js` pozostaje bez bezpośredniego `localStorage/sessionStorage`; globalne delegatory cabinet/material/price są teraz oddzielone od shellu runtime.
- Dla przyszłej chmury ważne: nie dopisywać do `app-legacy-bridges.js` zapisu danych ani adapterów. Ten moduł ma być wyłącznie warstwą zgodności wywołań.


## 2026-05-03 — Optimization checkpoint v1 / test storage isolation

- Nie dodano nowego storage ani nie zmieniono formatu danych runtime.
- Zmieniono tylko izolację testów: suita recovery Inwestora lokalnie czyści i przywraca techniczny klucz `fc_edit_session_v1`, żeby testy odzysku inwestorów z `projectStore`/snapshotów ofert nie odzyskiwały danych z sesji edycji zostawionej przez wcześniejszy test.
- Dla przyszłej chmury wniosek pozostaje taki sam: snapshot sesji edycji jest technicznym stanem tymczasowym i nie może być traktowany jak trwałe źródło domenowe na równi z inwestorem/projektem/ofertą.


## 2026-05-03 — Pricing labor rules v1

- Model robocizny/czynności został dodany jako rozszerzony katalog `quoteRates`, ale bez nowych bezpośrednich zapisów `localStorage`. Dane nadal przechodzą przez istniejący store katalogów.
- Dla przyszłej chmury robocizna powinna być traktowana jako osobny namespace/collection katalogu wycen: stawki godzinowe, definicje robocizny, reguły gabarytu i pakiety ilościowe.
- Wewnętrzne wyliczenia WYCENY zapisują snapshot `lines.labor`; stara oferta ma zachować przeliczone nazwy, normoczasy, stawki, gabaryty i kwoty z dnia wygenerowania. Nie przeliczać historycznych ofert po zmianie katalogu robocizny.
- `labor-catalog-definitions.js` zawiera domyślne seed records, a `labor-catalog.js` normalizację/kalkulację. Przy migracji do chmury te definicje powinny być migracją katalogu użytkownika, nie technicznym cache.
- Dane robocizny przy szafce docelowo mogą trafić do modelu szafki jako referencje do definicji (`laborItems`), ale snapshot oferty musi zapisywać pełne przeliczone szczegóły.
- W tej paczce `laborItems` są już zapisywane przy szafce jako referencje do definicji robocizny z ilością; przy chmurze traktować to jako dane domenowe szafki, nie cache.


## 2026-05-03 — Pricing labor test fix v1

- Zmiana dotyczy tylko testu migracji katalogów po rozszerzeniu `quoteRates` o robociznę.
- Dla przyszłej chmury utrzymujemy zasadę: zapisane katalogi użytkownika mają pierwszeństwo przed legacy kluczami, ale migracja może dołączyć brakujące systemowe/defaultowe definicje katalogu robocizny jako dane użytkownika do dalszej edycji.
- Historyczne oferty nadal muszą trzymać snapshot `lines.labor`, a nie odczytywać po czasie aktualnych definicji katalogu.

## 2026-05-03 — Pricing labor unified picker v1

- Definicje robocizny są traktowane jako wspólny katalog czynności (`usage: universal`). Dla przyszłej chmury nie modelować osobnych kolekcji `manualRates` i `cabinetRates`; lepszy kierunek to jedna kolekcja definicji robocizny z polami zastosowania, `autoRole`, aktywnością i metadanymi.
- Wybory użytkownika pozostają danymi projektu/oferty: czynności ręcznie dodane w WYCENIE są zapisywane jako selekcje oferty, a czynności przy szafce jako dane tej szafki. Definicja katalogowa i użycie w projekcie nie mogą być tym samym dokumentem.
- Montaż AGD wynikający z typu szafki ma jawny override w danych szafki (`applianceMountingMode`): brak wartości oznacza domyślny montaż dla kompatybilności, a `none` oznacza świadome wyłączenie automatycznej pozycji.
- Snapshot oferty powinien nadal zamrażać przeliczone linie robocizny i stawki; zmiana katalogu robocizny w chmurze nie może przeliczać starych ofert.

## Pricing labor manual accordion v1 — 2026-05-03

- Poprawka nie zmienia modelu danych ani storage: `rateSelections` dalej pozostaje częścią draftu/snapshotu oferty.
- Zmiana jest UI/render-only dla WYCENY: ręczne czynności są renderowane w osobnym akordeonie, ale dane pozostają w tym samym cloud-ready kontrakcie oferty.

## 2026-05-03 — Czynności labor workspace v1

- Przeniesienie UI robocizny do zakładki `CZYNNOŚCI` nie dodaje nowego storage. Ręczne czynności nadal zapisują się w istniejącym draft boundary `quoteOfferStore.rateSelections`.
- Podgląd czynności szafek jest wyliczany z aktualnych danych projektu i katalogu robocizny, bez nowego cache. To pozostaje zgodne z przyszłym adapterem chmurowym: źródłami prawdy są projekt/szafki, katalog robocizny i draft oferty.
