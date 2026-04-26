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

## Bieżące długi do pilnowania

- `fc_project_v1`, `fc_projects_v1` i `fc_project_inv_*_v1` nadal pokazują historyczną duplikację modelu projektu. Nie dokładać nowych mechanizmów, które ją pogłębiają.
- `fc_edge_v1` jest relatywnie duże i może wymagać później powiązania z konkretnym projektem/pomieszczeniem zamiast globalnego rośnięcia bez kontroli.
- Backup lokalny działa, ale przy wielu inwestorach nie może być traktowany jako docelowa chmura. To tylko zabezpieczenie lokalne.
- Testy i narzędzia pamięci muszą dalej pilnować, czy dane techniczne/cache nie trafiają do backupu użytkownika.
