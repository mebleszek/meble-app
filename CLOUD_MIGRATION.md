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
