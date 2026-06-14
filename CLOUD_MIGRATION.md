## 2026-06-15 — body height jako fakt pochodny szafki

- Nie dodano nowego obowiązkowego źródła prawdy dla każdego korpusu. `cabinet.body_height_mm` i `cabinet.body_volume_m3` są faktami pochodnymi z istniejącej wysokości szafki oraz efektywnej wysokości nóg.
- Indywidualna wysokość nóg jest zapisywana tylko wtedy, gdy różni się od domyślnej wartości z ustawień pomieszczenia.
- W przyszłej chmurze synchronizacji wymaga tylko ewentualne nadpisanie `details.legHeightCm`; fakty body height/body volume można odtworić.

## 2026-06-14 — Czas dojazdu jako pozycja transportowa

- Nie dodano nowego źródła danych wejściowych. Czas dojazdu jest odczytywany z istniejącego `investor.transport.durationMin`.
- W snapshot/rejestrze WYCENY czas dojazdu jest osobną linią w sekcji `Transport`, a w CZYNNOŚCIACH jest prezentowany jako ogólna czynność `Inne czynności`.
- Dane chmurowe nadal synchronizują transport inwestora i snapshot wyceny; nie powstała osobna prawda dla czasu dojazdu.

## 2026-06-14 — Wnoszenie jako osobny total WYCENY

- Nie dodano nowej prawdy danych wejściowych. `carrying` jest osobnym wynikiem rejestru/snapshotu, wyliczanym z tych samych faktów logistycznych szafki i z tych samych pozycji cennika.
- W przyszłej chmurze można synchronizować `carrying` jak pozostałe totals snapshotu; fakty logistyczne nadal są cachem możliwym do przeliczenia.

## 2026-06-14 — Czynności bez zmiany modelu danych

- Ręczne czynności szafki pozostają w dotychczasowym polu szafki; zmieniono tylko przepuszczanie ich do widoku CZYNNOŚCI i czytelność czasu.
- Nie dodano nowego źródła prawdy ani nowej struktury storage. Brak czasu jest stanem prezentacji/audytu, nie osobną migracją danych.
- Zmiana jest neutralna dla przyszłej chmury: nie zwiększa zakresu synchronizacji i nie przywraca ciężkich snapshotów.

## 2026-06-14 — Diagnostyka do pliku bez zmiany modelu danych

- Zapis raportu diagnostycznego WYCENY do `.txt` jest akcją przeglądarki i nie dodaje nowego trwałego klucza `localStorage`.
- Usunięcie dolnego bloku robocizny z WYWIADU jest zmianą prezentacji; nie zmienia modelu szafki, cache faktów ani snapshotów.
- `MD_CLEANUP_AUDIT.md` wskazuje pliki dokumentacji do przyszłego odchudzenia. Nie usunięto historii na ślepo, żeby nie zgubić aktywnych decyzji projektowych.

## 2026-06-14 — Fakty pochodne szafki/cache v1

`cabinet.derivedFacts` jest technicznym cachem wyniku kalkulatorów, a nie nowym źródłem prawdy. W przyszłej chmurze można go przechowywać jako cache dokumentu szafki albo pominąć przy migracji i przeliczyć po stronie aplikacji/workerem.

Zasady migracyjne:
- źródłem prawdy zostają dane szafki, dane inwestora `carrying`, katalogi/cenniki i ustawienia projektu; cache ma tylko `version` + `inputHash`,
- brak cache, stary hash albo stara wersja kalkulatora oznacza przeliczenie faktów, nie błąd danych,
- nie dodano nowego klucza `localStorage`; cache siedzi przy szafce w istniejącym modelu projektu,
- hash obejmuje znormalizowane dane wnoszenia inwestora, więc zmiana piętra/windy może unieważnić logistykę wszystkich szafek bez ręcznej mapy zależności,
- snapshoty ofert nadal powinny przechowywać wynik wyceny/historyczną ofertę, a nie odwołanie do bieżącego cache szafki,
- przy backendzie/chmurze trzeba wersjonować kalkulator faktów i móc masowo odświeżyć cache po zmianie algorytmu.

## 2026-06-14 — Wnoszenie wysokich frontów v1

- Wysokie fronty powyżej 2 m są traktowane jako osobne elementy logistyczne, a nie jako część wagi korpusu.
- Dane frontów są odczytywane z centralnych helperów frontów używanych przez MATERIAŁ/WYCENĘ, więc nie powstaje nowy magazyn wymiarów frontów.
- Wynik wnoszenia frontów jest liczony na żądanie do robocizny/WYCENY i snapshotowany w liniach robocizny oferty, tak jak pozostałe pozycje robocizny.
- Przy przyszłej chmurze przechowywać należy dane inwestora (`carrying`) oraz snapshot przeliczonej robocizny; nie duplikować listy wysokich frontów w inwestorze.

## 2026-06-14 — Wnoszenie: rozkręcone elementy i przekątne windy v2

Paczka `site_carrying_disassembled_elements_v2.zip` upraszcza i urealnia automat wnoszenia po praktycznych testach windy/schodów.

Zmiany:
- usunięto z UI, normalizacji danych i logiki pola udźwigu windy oraz szerokości kabiny; przy zapisie danych inwestora te pola nie są już utrzymywane,
- sprawdzanie całego korpusu do windy jest proste: para wymiarów przez drzwi + trzeci wymiar w głębokość windy, bez przekątnych dla całej skrzynki,
- jeżeli korpus wymaga rozkręcenia, program sprawdza duże płaskie elementy z formatek korpusu, m.in. boki, plecy, przegrody i długie wieńce,
- przekątna kabiny `wysokość × głębokość` jest dopuszczona tylko dla płaskich elementów po rozkręceniu i tylko wtedy, gdy drugi wymiar elementu mieści się w szerokości drzwi windy,
- wnoszenie po schodach po rozkręceniu liczone jest tylko dla elementów, które nie weszły do windy; elementy, które weszły do windy, nie podbijają mnożnika schodów,
- dodano fakt `carrying.stairs_item_count` do audytu/źródeł ilości,
- cennik nadal ma dwie osobne pozycje: `labor_carrying_cabinet` oraz `labor_carrying_disassembly`, ale pierwsza opisowo działa teraz jako **Wnoszenie korpusu / elementów**,
- zaktualizowano test `tools/carrying-lift-logistics-smoke.js`.

Nie przebudowano WYCENY, ORS, oferty klienta, PCV, kosztów firmy, `drawer.count`, automatów AGD ani wymagań technicznych szafek. Cache-busting: `20260615_body_height_legs_labor_v1`. Raport: `tools/reports/carrying-disassembled-elements-v2.md`.

## 2026-06-13 — Wnoszenie i winda v1

- Dodano pole `investor.carrying` w rekordzie inwestora. Dane są częścią inwestora, a nie osobnym storage: `floorNumber`, `elevatorStatus`, `elevator.doorWidthCm`, `elevator.doorHeightCm`, `elevator.cabinDepthCm`, `elevator.cabinHeightCm`, `note`.
- Fakty logistyczne (`cabinet.weight_kg`, `carrying.floor_units`, `carrying.people_count`, `carrying.requires_disassembly`, `carrying.lift_fits`) są wyliczane na żądanie z danych inwestora i szafki. Nie są drugą prawdą zapisaną w projekcie.
- Waga korpusu powstaje z centralnej listy formatek korpusu; fronty, półki luźne, blendy, cokoły i okucia są pomijane przy decyzji logistycznej.
- Snapshot WYCENY powinien przechowywać wynikowe linie robocizny i audyt wnoszenia, tak aby późniejsza zmiana piętra/windy/cennika nie zmieniała starych ofert.
- W przyszłej chmurze `investor.carrying` należy migrować razem z dokumentem inwestora. Kalkulator wnoszenia pozostaje deterministycznym read-only helperem aplikacji.

## 2026-06-13 — ORS: walidacja geokodowania miejscowości

- Nie dodano nowego trwałego klucza `localStorage`; dodatkowe metadane geokodowania są częścią istniejącego `investor.transport`.
- Automatyczne przeliczenie trasy akceptuje tylko wynik geokodowania zgodny z miejscowością/kodem wynikającym z danych inwestora albo firmy.
- Jeżeli geocoder zwróci tylko kandydatów z inną miejscowością, status transportu zmienia się na `geocode_mismatch`, ale poprzednie/ręczne kilometry nie są nadpisywane.
- Zasada pod przyszłą chmurę: backend/proxy ORS też powinien walidować wynik geokodowania przed routingiem, a nie ufać pierwszemu kandydatowi Pelias/ORS.
- Nie dodano ręcznego wyboru kandydatów adresu; automatyka ma działać tylko przy pewnym dopasowaniu, a przy wątpliwości zostaje ręczny fallback.

## 2026-06-13 — OpenRouteService: diagnostyka geokodowania i trasy

- Dane diagnostyczne ORS są częścią istniejącego `investor.transport`, a nie osobnym localStorage: `originGeocode`, `destinationGeocode`, `routeDistanceMeters`, `routeDurationSeconds`, `orsMapsUrl`.
- To są metadane wyniku ostatniego świadomego kliknięcia **Przelicz trasę**. Nie tworzą drugiej prawdy; kanoniczne km do WYCENY nadal idą przez `FC.investorTransport.getCurrentTransportContext()` i źródło `transport.distance_km`.
- Oryginalne adresy firmy i klienta pozostają niezmienione. Oczyszczone zapytanie geokodowania służy tylko do ORS i jest zapisywane diagnostycznie, żeby później dało się wyjaśnić różnice między mapami.
- W przyszłej wersji chmurowej klucz ORS nadal nie powinien być trzymany jawnie we froncie. Docelowy backend/proxy powinien logować/limitować zapytania i zapisywać wynik trasy oraz diagnostykę jako metadane inwestora albo konkretnego projektu.

## 2026-06-13 — OpenRouteService / odległość do klienta

- Nie dodano nowego trwałego klucza `localStorage`; dane trasy są częścią istniejącego rekordu inwestora `transport`, a ustawienia ORS są częścią istniejącego profilu firmy `fc_company_profile_v1`.
- `transport.distanceKm` pozostaje dystansem w jedną stronę, a `transport.distance_km` dla WYCENY jest wyliczane na żądanie przez ustawienia firmy: tryb w jedną stronę / tam i z powrotem, zaokrąglenie i minimum km.
- Wynik ORS zapisuje status, czas, datę, provider/source, profil trasy oraz hash adresu firmy i klienta. Hash służy wyłącznie do wykrywania nieaktualnego wyniku po zmianie adresu; nie jest osobną prawdą danych.
- Testy automatyczne używają mocka odpowiedzi ORS i nie wykonują realnych zapytań sieciowych.
- Lokalny frontend może przechowywać klucz ORS wpisany przez użytkownika, ale w wersji chmurowej klucz nie powinien być trzymany w publicznym froncie. Docelowo routing powinien iść przez backend/proxy użytkownika/aplikacji, z limitem, logowaniem błędów i ochroną klucza.
- Integracja jest darmowa tylko w ramach limitów zewnętrznego dostawcy OpenRouteService; przekroczenie limitów albo błąd usługi musi zostawić ręczny fallback kilometrów.

## 2026-06-13 — PCV korpusu pod kolor frontów

- Nie dodano nowego trwałego klucza `localStorage`; `bodyPcvMode` jest polem istniejących rekordów preferencji strefowych pokoju oraz szafek w projekcie.
- Wartości trybu PCV są proste i przenaszalne do chmury: `body` = PCV pod kolor płyty, `front` = PCV pod kolor frontów.
- Ręczne zaznaczenia oklejanych krawędzi w MATERIAŁACH pozostają dotychczasowym źródłem ilości metrów; nowy tryb tylko rozdziela te metry na dwa strumienie ilościowe.
- Pozycja katalogowa `PCV-FRONT` jest zwykłym rekordem istniejącego katalogu materiałów/obrzeży, więc migruje razem z katalogiem materiałów, nie jako osobna kolekcja.
- Snapshot WYCENY zapisuje wynikowe linie materiałowe dla standardowego PCV i PCV pod kolor frontów, dzięki czemu późniejsza zmiana ceny za mb nie zmienia starych ofert.

## 2026-06-11 — Sposoby naliczania ceny w cenniku

- Nie dodano nowego klucza `localStorage`; tryb naliczania ceny jest polem istniejących rekordów `quoteRates`.
- Nowe pola `pricingMode`, `startPrice` i `includedQty` należą do definicji pozycji cennika robocizny/usług i powinny migrować razem z katalogiem stawek/pozycji.
- `transport_distance_km` pozostaje kanoniczną pozycją katalogu, ale może być liczony jako `startPrice + max(0, km - includedQty) * price`.
- Snapshot oferty ma zapisywać wynik i audyt użytego trybu, w tym płatne km / ilość po odjęciu limitu, żeby późniejsza zmiana cennika nie zmieniała starych ofert.

## 2026-06-11 — Transport w WYCENIE: kanoniczna pozycja i total

- Transport pozostaje rekordem cennika w istniejącym katalogu `quoteRates`, z trwałym ID `transport_distance_km`, więc przyszła chmura powinna traktować go jako element katalogu stawek/pozycji wyceny, a nie jako osobną kolekcję.
- Konsolidacja duplikatów działa w boundary `laborCatalog` / `catalogStore`; UI nie zapisuje dodatkowych kopii ceny transportu.
- `totals.transport` w snapshotach ofert jest jawniejszym podziałem kwot dla użytkownika, ale źródłowa linia nadal pochodzi z `quoteRateLines` i rejestru wyliczeń.

## 2026-06-10 — Robocizna: osobne automaty montażu AGD

- Nie dodano nowego klucza `localStorage`.
- Osobne automaty AGD są definicjami w istniejącym cenniku robocizny `quoteRates`, więc backupują się razem ze stawkami/czynnościami.
- Źródła `appliance.<typ>.count` są odczytem z bieżącej szafki i ustawienia `Z montażem / Bez montażu`; nie tworzą drugiej kopii danych AGD.
- Linie ofertowe `Montaż AGD` zapisują wynik i kod automatu w snapshotcie oferty, co jest zgodne z docelowym modelem chmurowym: oferta przechowuje wynik/audyt decyzji, a nie ponownie cały projekt.

## 2026-06-10 — Cloud-ready audyt robocizny

- Czytelny audyt robocizny opiera się na strukturalnych polach w `quoteCalculationRegister`, a nie na jednym długim stringu z opisem. To ułatwia późniejsze przeniesienie ofert do dokumentów backendowych.
- Nie dodano osobnego magazynu ani drugiej prawdy; dane audytu są częścią snapshotu konkretnej oferty.
- Kierunek dla chmury pozostaje: oferta ma przechowywać wynik i audyt decyzji użytych do tej konkretnej wyceny, a bieżący projekt pozostaje osobnym źródłem danych roboczych.

## 2026-06-10 — Cloud-ready kierunek dla szuflad/prowadnic

- Nie dodano nowego trwałego klucza `localStorage`.
- Jawne `drawerRequirements` są częścią dokumentu/rekordu szafki, więc później mogą zostać przeniesione do chmury razem z projektem bez osobnego magazynu.
- `drawer.count` jest odczytem z centralnego modułu wymagań, a nie z luźnych legacy pól. To zmniejsza ryzyko rozjechania danych między lokalnym projektem, ofertą i przyszłą chmurą.
- Legacy pola szufladowe są czyszczone przy draftach/klonowaniu/zapisie, bo aplikacja jest w trakcie tworzenia i nie utrzymujemy zgodności ze starymi testowymi śmieciami.

## 2026-06-10 — WYCENA: przygotowanie historii ofert pod chmurę

- Historia ofert została dalej odchudzona bez zmiany wyniku wyceny: snapshot ma zachować dane potrzebne do podglądu, audytu i statusów, ale nie powinien trzymać ciężkich technicznych odcisków porównawczych.
- `quoteFingerprint` jest kompaktowy i deterministyczny, więc nadaje się jako lokalny/przyszły backendowy indeks porównania wariantów, zamiast zapisywać pełny JSON porównawczy w dokumencie oferty.
- Diagnostyka `topKeys` pomaga oddzielać dane użytkownika od cache/sesji technicznych przed migracją do backendu.


## WYCENA — historia ofert i lokalny storage maintenance — 2026-06-10

- Historia ofert nadal jest lokalna, ale model został przygotowany pod późniejszą chmurę: `quoteSnapshotStore` przechowuje lekkie snapshoty ofert zamiast pełnych katalogów/projektów/cache.
- Docelowy kierunek chmurowy pozostaje: indeks ofert i szczegóły oferty powinny być osobnymi dokumentami/kolekcjami, a nie jednym wielkim JSON-em localStorage.
- Lokalny etap `quote-snapshot-storage-maintenance` usuwa wyłącznie śmieci techniczne/cache oraz nadmiar lokalnych backupów przy błędzie quota. Nie dodaje nowego trwałego klucza i nie miesza cache z danymi użytkownika.
- Limit 30 ofert na projekt jest lokalnym zabezpieczeniem przed puchnięciem `localStorage`; w chmurze odpowiednikiem powinno być stronicowanie/paginacja historii ofert.


## 2026-06-10 — WYCENA: pełny magazyn nie może ukrywać policzonego wyniku

- Zapis historii ofert nadal idzie przez istniejący `quoteSnapshotStore` i klucz snapshotów; nie dodano nowego trwałego klucza `localStorage`.
- Jeżeli zapis historii WYCENY nie powiedzie się przez limit magazynu albo stare ciężkie dane, wynik może być pokazany jako niezapisany podgląd runtime. Taki podgląd nie jest nową prawdą danych i nie udaje zapisanego snapshotu.
- Docelowe czyszczenie starych ciężkich snapshotów/backupu powinno być osobnym, jawnym etapem z raportem danych, a nie ukrytą migracją przy kliknięciu `Wyceń`.


## 2026-06-09 — Źródła ilości robocizny a przyszła chmura

- `quantitySource` w cenniku robocizny jest konfiguracją użytkownika w istniejącym katalogu stawek/czynności.
- Odczyt wartości przez `FC.workQuantityFacts` nie dodaje nowego trwałego klucza storage i nie zapisuje kopii danych szafki.
- W snapshotach/ofertach i `quoteCalculationRegister` wolno zapisać wynik oraz metadane użytego źródła, bo to jest historia konkretnej oferty, a nie druga prawda bieżącej szafki.
- Przyszły kreator nietypowych korpusów ma wystawiać te same źródła ilości co zwykłe szafki, aby WYCENA nie musiała mieć osobnej logiki dla korpusów użytkownika.


## 2026-06-09 — Źródło ilości w cenniku robocizny v1

- Dodano wyłącznie pole konfiguracyjne `quantitySource` w pozycjach `quoteRates`.
- `quantitySource` jest kodem technicznym wskazującym istniejące źródło danych, np. `front.count` albo `hinge.count`; nie tworzy nowego magazynu danych ani drugiej prawdy w szafce.
- Etap nie dodaje nowego klucza `localStorage`, nie zmienia modelu projektu i nie zapisuje faktów szafki poza istniejącym cennikiem robocizny.
- WYCENA i `quoteCalculationRegister` nie zostały jeszcze przełączone na użycie `quantitySource`.


## 2026-06-09 — Work quantity facts reader v1

- Dodano `FC.workQuantityFacts` jako read-only adapter danych szafki do przyszłych czynności i WYCENY.
- Adapter nie tworzy nowych kluczy localStorage, nie zapisuje danych w projekcie i nie dubluje pól szafki.
- Fakty są wyliczane na żądanie z istniejących danych WYWIADU oraz centralnych helperów frontów/zawiasów/AGD.
- To jest warstwa odczytu, nie nowy magazyn danych. Do chmury/snapshotów nie dochodzi nowa struktura trwała.

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



## Hardware missing supplier duplicate fix v1 — 2026-05-13

- Import `Ceny_dostawcow` pozostaje w istniejącym boundary import/export i store katalogu; nie dodano nowych kluczy `localStorage`.
- Poprawiono dopasowanie ceny do istniejącego okucia po `producent + symbol`, gdy to samo okucie występuje równocześnie w aktualnym katalogu i w arkuszu `Okucia` z eksportu.
- Brakujący albo nierozpoznany dostawca nie jest zapisywany automatycznie i nie tworzy nowego dostawcy. Wiersz trafia do resolvera wyboru z kontrolowanej listy dostawców albo jest świadomie pomijany.
- Zmiana jest zgodna z przyszłą chmurą: cena dostawcy pozostaje powiązana z istniejącym okuciem i istniejącym dostawcą, bez tworzenia śmieciowych rekordów z literówek lub błędnych komórek XLSX.


## Hardware catalog UX v1 — 2026-05-10

- Status ceny w katalogu okuć jest obecnie wyliczany wyłącznie w UI na podstawie istniejących pól: cena, źródło ceny i data ceny. Nie dodano nowego trwałego pola ani nowego klucza storage.
- Szybkie filtry `Do sprawdzenia cen`/`Brak ceny`/`Stara cena` są runtime UI i nie pogłębiają modelu danych. Jeśli później potrzebny będzie trwały workflow kontroli cen, zrobić to jako osobną zmianę modelu katalogu i przyszłej chmury.
- Import plików dostał lepszą diagnostykę Android/Google Sheets oraz fallback `FileReader`, ale zapis po imporcie nadal przechodzi przez `catalogStore` i wersjonowane klucze `fc_*`.


## Hardware bundle/import UX v1 — 2026-05-09

- Model okuć rozdziela jednostkę od złożoności pozycji: `kpl.` to komplet jako jednostka, a składany zestaw wynika z `bundleItems` / arkusza `Sklad_zestawow`.
- `para` nie jest docelową jednostką danych; legacy/importowane wartości `para` normalizować do `kpl.`, żeby późniejsza chmura nie miała dwóch znaczeń tego samego kompletu.
- Import XLSX nadal zapisuje przez `catalogStore` do wersjonowanych kluczy `fc_*`; nie dodano nowych luźnych kluczy localStorage.
- Tryb importu w UI jest wyborem przed zapisem, a nie osobną akcją zapisującą dane. To ogranicza przypadkowe zastąpienie katalogu przy przyszłej synchronizacji/chmurze.


## Hardware price sources, quote snapshot i zakupy — plan przyszły — 2026-05-10

- Docelowy model okuć nie powinien trzymać jednej płaskiej ceny jako jedynej prawdy. Pozycja katalogowa ma być produktem technicznym, a ceny u dostawców osobnymi rekordami powiązanymi z tym produktem.
- Przykładowe przyszłe kolekcje/namespace'y chmurowe: `hardwareItems`, `hardwareSupplierPrices`, `quoteHardwareSnapshots`, `projectHardwarePurchases`. Lokalny etap przejściowy musi nadal używać wersjonowanych kluczy `fc_*` i istniejącego store/repository boundary.
- `hardwareSupplierPrices` powinno trzymać m.in. dostawcę/źródło, cenę netto/brutto, VAT, rabat, datę ceny, status aktualności, notatkę i informację czy cena nadaje się do wyceny.
- WYCENA nie może zależeć od późniejszej aktualnej ceny w katalogu. Przy generowaniu oferty trzeba zapisać snapshot: okucie, ilość, cena użyta do wyceny, źródło ceny, data, narzut/cena dla klienta oraz ewentualny koszt planowany.
- Domyślna cena do oferty może wynikać z kolejności źródeł, np. lokalna hurtownia → Bivert → MAGO → ręcznie/do sprawdzenia. Ta reguła ma służyć wycenie, nie automatycznemu finalnemu zakupowi.
- Po akceptacji oferty ma powstawać lista zakupów jako osobny etap procesu: system może sugerować najtańsze lub logistycznie najrozsądniejsze źródło zakupu, ale użytkownik zatwierdza gdzie faktycznie kupuje i za ile.
- Raport rentowności ma rozdzielać: koszt przyjęty w ofercie, sugerowany koszt zakupu, rzeczywisty koszt zakupu i różnicę zakupową. Ta różnica nie powinna automatycznie zmieniać zaakceptowanej oferty klienta.
- Przy przyszłej chmurze trzeba zachować historię: zmiana cennika/dostawcy nie może przepisać historycznych ofert, list zakupów ani faktycznych kosztów projektu.


## 2026-06-13 — Zamrożony model oferty klienta a przyszła chmura

- `snapshot.clientOffer` jest świadomie zapisaną częścią historii oferty, a nie nowym bieżącym magazynem danych projektu.
- Model klienta jest budowany przy tworzeniu snapshotu WYCENY i zamraża dane potrzebne do podglądu/PDF: klienta, firmę, zakres, materiały opisowe, okucia, AGD, cenę końcową oraz warunki handlowe.
- Podgląd oferty nie powinien odczytywać aktualnego projektu ani aktualnego inwestora, jeśli pokazuje zapisaną ofertę. To chroni historię przed zmianą po późniejszych poprawkach projektu.
- W chmurze `clientOffer` powinien być polem dokumentu oferty/snapshotu, np. `users/{userId}/quotes/{quoteId}.clientOffer`, a nie osobną prawdą bieżącego projektu.
- PDF klienta w przyszłości ma renderować ten sam `clientOffer`, bez osobnego liczenia i bez ponownego pobierania bieżących danych projektu.

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

Szczegółowy aktualny kontrakt lokalnego backupu jest w `BACKUP.md`. Przy każdej zmianie backupu, storage, eksportu/importu danych i testów bezpieczeństwa danych czytać `BACKUP.md` razem z tym plikiem.

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

## Czynności labor calc help v1 — 2026-05-04

- Zmiana dotyczy tylko prezentacji i helperów UI katalogu robocizny oraz podglądu kalkulacji w `CZYNNOŚCI`; nie dodano nowego storage ani nowego klucza danych.
- Do snapshotów robocizny dodano jawne pole `laborPrice` w szczegółach komponentu, żeby widok mógł pokazać rozbicie ceny bez ponownego zgadywania formuły. To jest część przeliczonego snapshotu robocizny, a nie osobny magazyn danych.


## 2026-05-04 — cennik robocizny: reguła gabarytu

- Decyzja danych: w definicji robocizny pola `volumePricePerM3` i `volumeTimeMode` nadal mogą istnieć w modelu, ale runtime nie powinien liczyć ich podwójnie.
- Jeśli `volumeTimeMode` jest aktywny i faktycznie generuje `volumeHours`, kalkulacja ignoruje `volumePricePerM3`; dzięki temu oferta/snapshot nie zawyża kosztu przez dwa nośniki tego samego gabarytu.
- To utrzymuje model gotowy pod chmurę: nie trzeba migrować struktury rekordu, zmienia się interpretacja reguły i snapshot nadal zapisuje gotowy wynik kalkulacji.

## Hardware catalog model v1 — 2026-05-04

- Katalog okuć pozostaje danymi katalogowymi użytkownika, oddzielonymi od projektów i ofert. W przyszłej chmurze powinien mapować się do dokumentów katalogowych użytkownika, np. `users/{userId}/catalogs/hardware/items/{itemId}` oraz osobnej listy producentów albo słownika producentów.
- Dodano nowy lokalny klucz katalogowy `hardwareManufacturers` przez `catalogStore`, nie przez bezpośrednie zapisy UI do `localStorage`.
- Pozycje akcesoriów/okuć trzymają dane handlowe i źródłowe: jednostkę, kategorię, serię, cenę zakupu, narzut, cenę do wyceny, źródło ceny, datę ceny, status i notatkę. Te dane nie są snapshotem oferty — snapshot okuć będzie osobnym późniejszym etapem.
- Przy późniejszym podpięciu do szafek i WYCENY trzeba zapisywać snapshot ceny, jednostki, źródła i daty ceny w ofercie, żeby zmiana katalogu nie przeliczała historii.

## Hardware supplier pricing v1 — 2026-05-04

- Dodano rozdzielenie katalogu okuć na pozycje (`accessories`), producentów (`hardwareManufacturers`), dostawców (`hardwareSuppliers`) i ustawienia cen (`hardwareSettings`). W chmurze powinno to mapować się na osobne dokumenty/słowniki użytkownika, nie na dane projektu.
- Cena do wyceny i koszt firmy są różnymi polami domenowymi. Przyszły snapshot oferty powinien zamrażać obie wartości: cenę dla klienta oraz koszt zakupu firmy z dnia wyceny, żeby raport rentowności działał po zmianach katalogu.
- Rabat dostawcy służy do liczenia realnego kosztu firmy; domyślna baza ceny do wyceny może pozostać `catalogGross`, czyli cena katalogowa bez rabatu + narzut.
- Przyszłe raporty rentowności projektu powinny używać snapshotów kosztów materiałów/okuć/robocizny oraz później wpisanych realnych godzin montażu, liczby ludzi i kosztów dodatkowych. Nie wyliczać raportów z aktualnych cen katalogowych po czasie.



## Hardware catalog seed v1 — 2026-05-07

- Seed realnych okuć jest traktowany jako katalogowy bootstrap użytkownika, nie jako dane projektu i nie jako snapshot oferty.
- Merge seedów działa po stabilnym `id` oraz podpisie producent+symbol+nazwa, żeby można było później mapować pozycje do dokumentów katalogowych w chmurze bez duplikowania.
- Ręcznie zmienione pozycje użytkownika nie są nadpisywane przez seed; wyjątek dotyczy tylko dokładnego starego placeholdera `Zawias Blum`, który nie jest realnym rekordem biznesowym.
- Przy przyszłym snapshotowaniu do WYCENY trzeba zamrażać użyte ceny, źródło i datę ceny z katalogu, bo seedy mogą być później poprawione ręcznie albo zsynchronizowane z chmurą.

## Hardware bundle inputs v1 — 2026-05-05

- Zestawy okuć zapisują `bundleItems` jako referencje do istniejących pozycji katalogowych plus ilości, a nie jako skopiowane pełne rekordy. To jest zgodne z przyszłą chmurą, bo pozwala trzymać katalog jako osobną kolekcję.
- Jednocześnie pozycja zestawu zapisuje podsumowania `bundleComponentsCatalogGross` i `bundleComponentsPurchaseGross`, aby można było łatwo robić podgląd i późniejszy snapshot kosztu w ofercie.
- Przy przyszłym snapshotowaniu do WYCENY trzeba zamrażać cenę zestawu i jego skład z daty oferty, bo późniejsza zmiana ceny składnika nie może zmieniać starej oferty.
- Dane cenowe okuć dalej rozdzielają koszt firmy od ceny do wyceny klienta; to zostaje fundamentem przyszłych raportów rentowności projektu.


## Hardware import/export v1 — 2026-05-07

- Import/eksport katalogu okuć jest traktowany jako boundary danych katalogowych użytkownika, nie jako backup technicznego cache.
- JSON/XLSX obejmuje pozycje okuć, producentów, dostawców i ustawienia cenowe. Te dane powinny w przyszłej chmurze mapować się do katalogu użytkownika, np. `users/{userId}/catalogs/hardware/*`.
- Import zapisuje przez `catalogStore`, więc późniejsza migracja może podmienić lokalny adapter na chmurowy bez przepisywania UI importu.
- Kolumna `id` w XLSX musi pozostać stabilną kotwicą rekordu. Nowe wiersze bez `id` dostają lokalne `hw_user_*`; po przyszłej synchronizacji będą wymagały mapowania lokalnego ID na dokument chmurowy.
- Import `merge` nie usuwa brakujących rekordów, a tryb `replace` jest osobną świadomą operacją. To ogranicza ryzyko utraty danych przed wdrożeniem prawdziwej synchronizacji/chmury.
- Snapshot ofert/WYCENY nadal musi w przyszłości zamrażać użyte ceny i koszt firmy; import katalogu nie może przeliczać starych ofert.

## Reguła kluczy lokalnych pod backup i przyszłą chmurę — 2026-05-07

- Każdy lokalny klucz z danymi użytkownika, katalogów, cenników, inwestorów, projektów, ofert albo ustawień biznesowych, który ma wejść do globalnego backupu, musi zaczynać się od `fc_` i mieć wersję, np. `fc_hardware_suppliers_v1`.
- Luźne klucze bez prefiksu `fc_`, np. `hardwareSuppliers` albo `hardwareSettings`, mogą istnieć tylko jako stare źródła migracji. Nowy kod nie powinien ich używać jako docelowego storage danych biznesowych.
- Migracja ma działać bez utraty danych: odczytać nowy `fc_*`, jeśli istnieje; jeśli nie istnieje, odczytać legacy; zapisać wynik pod nowym `fc_*`; dopiero po tym usunąć dokładny legacy klucz.
- Dla chmury ta zasada jest etapem przejściowym: `fc_*` stanowi lokalny adapter/snapshot użytkownika, a później powinien mapować się do dokumentów/kolekcji Firestore bez przepisywania UI.

## Backup storage keys v1 — 2026-05-07

- Dostawcy okuć migrują z `hardwareSuppliers` do `fc_hardware_suppliers_v1`.
- Ustawienia katalogu okuć migrują z `hardwareSettings` do `fc_hardware_settings_v1`.
- `catalogStore` nadal jest lokalnym adapterem katalogu; nowy `catalog-storage-policy.js` tylko pilnuje nazw kluczy i migracji legacy → `fc_*`.
- Globalny backup Ustawień powinien od tej paczki obejmować pozycje okuć (`fc_accessories_v1`), producentów (`fc_hardware_manufacturers_v1`), dostawców (`fc_hardware_suppliers_v1`) i ustawienia (`fc_hardware_settings_v1`).

## Hardware Excel template v1 — 2026-05-07

- XLSX katalogu okuć jest warstwą wejścia/wyjścia dla danych katalogowych użytkownika, ale źródłem prawdy pozostaje znormalizowany model katalogu po stronie aplikacji.
- Formuły i listy wyboru w Excelu są udogodnieniem roboczym; import nadal przechodzi przez walidację i normalizację `hardware-catalog.js`, co jest zgodne z przyszłą chmurą i późniejszą synchronizacją.
- Nowe wiersze bez `id` dostają lokalne `hw_user_*`. Przy wdrożeniu chmury trzeba będzie utrzymać mapowanie lokalnego ID na dokument w katalogu użytkownika, żeby import z Excela nie tworzył duplikatów.
- Arkusz nie może aktualizować historycznych snapshotów WYCENY. Import zmienia katalog bieżący, a przyszłe oferty muszą zamrażać użyte ceny/koszty osobno.


## Hardware Excel import defaults — 2026-05-09

- Import XLSX katalogu okuć nadal zapisuje dane przez `catalogStore`, a nie bezpośrednio bokiem do `localStorage`; dzięki temu pozostaje przygotowany pod późniejsze zastąpienie lokalnego adaptera chmurą.
- Nowe pozycje z Excela mogą mieć puste `id`; przy imporcie aplikacja nadaje stabilne `hw_user_*`, a kolejne eksporty przenoszą już to ID do końcowej kolumny arkusza.
- Braki pól obowiązkowych są rozwiązywane przed zbudowaniem planu importu, pozycja po pozycji. Do store trafiają dopiero rekordy kompletne albo świadomie pominięte.
- Dane domyślne importu, takie jak VAT, dostawca, rabat, narzut, baza ceny, sposób liczenia i data ceny, pochodzą z ustawień katalogu albo kontrolowanych domysłów importu. Nie tworzyć nowych luźnych kluczy storage dla tych ustawień.

## Hardware file snapshot fix v1 — 2026-05-09

- Import katalogu okuć nadal pozostaje lokalnym boundary danych katalogowych, ale odczyt pliku wejściowego musi być wykonywany natychmiast po wyborze pliku.
- Parser i resolver braków obowiązkowych nie powinny przenosić dalej żywej referencji `File`; mają pracować na snapshocie danych w pamięci, co ułatwia późniejsze przepięcie importu na chmurę lub kolejkę synchronizacji bez zależności od systemowego uchwytu pliku.


## Hardware supplier prices v1 — 2026-05-10

- Wiele cen dostawców jest teraz częścią rekordu okucia w `fc_accessories_v1` jako `supplierPrices`; to pozostaje w lokalnym adapterze katalogu i nie dodaje nowego niebackupowanego klucza.
- Cloud-ready model: w Firestore `supplierPrices` może zostać tablicą przy pozycji katalogu albo podkolekcją `supplierPrices` pod `hardware/items/{itemId}`. Klucz logiczny dla bieżącej ceny to `item + supplier`, a nie ręcznie zarządzane `priceId` w Excelu.
- W katalogu żywym nie utrwalać wartości łatwo wyliczalnych z dostawcy, takich jak VAT/rabat/zakup po rabacie, poza pochodnymi legacy polami kompatybilności. Źródłem prawdy ceny dostawcy jest cena katalogowa netto/brutto, dostawca, data i `useForQuote`.
- Snapshot WYCENY w przyszłym etapie musi zapisać pełne wartości użyte w ofercie: dostawcę ceny, VAT/rabat z dnia wyceny, zakup po rabacie i cenę do wyceny. Nie wolno później przeliczać starej oferty z aktualnego katalogu.
- Import XLSX `Ceny_dostawcow` ma być idempotentny po `okucie + dostawca`: duplikowanie wiersza i zmiana dostawcy/ceny tworzy albo aktualizuje cenę tego dostawcy bez wymagania ręcznego `id_ceny`.

## Hardware supplier price status/types v1 — 2026-05-11

- Dodano katalogowe słowniki `fc_hardware_categories_v1` i `fc_hardware_types_v1`; oba są danymi użytkownika i muszą być objęte globalnym backupem oraz przyszłą synchronizacją/chmurą.
- W przyszłym Firestore kategorie i typy/cechy powinny być oddzielnymi dokumentami/słownikami użytkownika, np. `users/{userId}/catalogs/hardware/categories` i `users/{userId}/catalogs/hardware/types`, a nie twardą listą w kodzie.
- Typ/cecha przechowuje listę dozwolonych kategorii. To mapowanie jest decyzją użytkownika i nie może być zgadywane automatycznie przy imporcie.
- Dla zamienników producentów klucz logiczny ma pozostać prosty: `manufacturer + category + hardwareType`. W aktywnym katalogu użytkownika taka kombinacja powinna wskazywać maksymalnie jedną pozycję.
- Status ceny jest częścią konkretnej ceny dostawcy (`supplierPrices[].priceStatus`), nie globalnym statusem okucia. Snapshot oferty w przyszłości nadal musi zamrażać faktycznie użyty status/źródło/cenę z dnia wyceny.

## Hardware supplier price import fix v1 — 2026-05-11

- Import cen dostawców pozostaje idempotentny po kluczu logicznym `hardware item + supplier`; nie dodawać ręcznego `id_ceny` jako wymagania dla użytkownika Excela.
- Dane użytkownika w katalogu mają przechowywać cenę katalogową netto/brutto, dostawcę, datę ceny, status ceny i `useForQuote`. Pochodne wartości mogą być liczone przy normalizacji, a snapshot oferty ma je zamrozić dopiero w WYCENIE.
- Błędy arkusza (`#REF!`, `#VALUE!`, itd.) są traktowane jako śmieci importu, nie jako dane domenowe. Przy przyszłej chmurze nie wolno synchronizować takich wartości do `hardware/items` ani podkolekcji cen.
- Status `current` importowany z `Ceny_dostawcow` jest statusem konkretnej ceny dostawcy, a nie globalnym statusem pozycji. Nie używać go do masowego oznaczania okucia jako `Do sprawdzenia`.


## Hardware import bulk/diff/types fix v1 — 2026-05-11

- Zmiana pozostaje w obecnym lokalnym modelu katalogu i nie dodaje nowych trwałych kluczy storage. Import po analizie zapisuje przez `catalogStore` do istniejących danych katalogu okuć.
- Hurtowy import cen nie wymaga technicznych ID od użytkownika. Dla przyszłej chmury oznacza to jasny kontrakt dopasowania: stabilne ID ma pierwszeństwo, ale użytkowy klucz `producent + symbol + dostawca` jest obsługiwany jako bezpieczny import z cenników hurtowni.
- Podgląd importu liczy realny diff: oddziela okucia bez zmian od okuć zmienionych oraz ceny dodane/zmienione/bez zmian/pominięte. To ogranicza przypadkowe nadpisy przy przyszłej synchronizacji.
- Excel pozostaje formularzem wejściowym bez zapętlonych formuł netto/brutto; obliczenie brakującej strony ceny jest częścią importu/modelu, a nie logiką arkusza.


## Hardware supplier price create item v1 — 2026-05-12

- Zmiana dotyczy lokalnego importu/exportu katalogu okuć i nadal pracuje przez istniejące boundary `catalogStore`; nie dodano nowych kluczy `localStorage`.
- Nowe okucia utworzone z arkusza `Ceny_dostawcow` trafiają do istniejącej kolekcji katalogu okuć `fc_accessories_v1` razem z `supplierPrices` przy pozycji.
- Import nie tworzy nowych producentów ani dostawców z nazw wpisanych w cenach dostawców. Producent i dostawca muszą być rozpoznane z istniejących słowników, co zmniejsza ryzyko rozjazdu danych przy przyszłej synchronizacji chmurowej.
- Klucz użytkowy dla hurtowego importu ceny pozostaje jawny i przenośny do chmury: `producent + symbol + dostawca`. Techniczne `okucie_id` i `dostawca_id` pozostają pomocnicze, nie wymagane w ręcznej pracy z cennikiem.
- Brakująca data ceny jest uzupełniana przy imporcie po stronie aplikacji, a nie formułami arkusza; snapshot przyszłej WYCENY nadal musi zamrażać wartości osobno.

## Hardware import create item resolver v1 — 2026-05-12

- Zmiana dotyczy importu danych katalogu okuć i nie dodaje nowych kluczy storage.
- Nowe kategorie dodawane z modala resolvera importu są zapisywane przez istniejący `catalogStore.saveHardwareCategories()` i nadal trafiają do `fc_hardware_categories_v1`.
- Nowe okucia utworzone z `Ceny_dostawcow` nadal trafiają do istniejącej listy `fc_accessories_v1`; dane cen dostawców pozostają w `supplierPrices` przy okuciu.
- Import nie używa numeru wiersza Excela jako klucza danych. Powiązanie pozostaje po danych użytkowych `producent + symbol + dostawca`, z technicznym `okucie_id` jako opcjonalną szybką ścieżką.
- Zablokowano automatyczne domyślne wartości `Inne`/`szt.` dla nowych okuć z arkusza cen, żeby nie tworzyć brudnych rekordów przed przyszłą synchronizacją/chmurą.



## Hardware import resolver supplier gap v1 — 2026-05-12

- Zmiana dotyczy istniejącego boundary import/export katalogu okuć i nie dodaje nowego storage.
- Uzupełnianie braków przy imporcie nowych okuć z arkusza `Ceny_dostawcow` obejmuje teraz dostawcę, kategorię i jednostkę jako świadome wybory użytkownika. To ogranicza śmiecenie danych domyślnymi wartościami i jest bezpieczniejsze pod przyszłą synchronizację.
- Dopasowanie wielu cen pozostaje oparte na danych użytkowych `producent + symbol + dostawca`, a techniczne `okucie_id`/`dostawca_id` są pomocnicze.
- Nie powstał nowy klucz `localStorage`; słowniki i katalog dalej przechodzą przez `catalogStore` oraz istniejące klucze `fc_*`.


## Hardware supplier missing resolver v1 — 2026-05-12

- Zmiana nie dodaje nowych kluczy storage. Ceny dostawców nadal są częścią rekordu okucia w `fc_accessories_v1`, a dostawcy pozostają w `fc_hardware_suppliers_v1`.
- Brakujący albo nieznany dostawca przy imporcie ceny jest rozwiązywany przed zbudowaniem planu zapisu. Do katalogu nie trafia cena bez jawnie rozpoznanego `supplierId`.
- Resolver nie tworzy dostawców z modala wyboru ceny. Nowy dostawca musi wejść przez kontrolowany słownik programu albo przez arkusz `Dostawcy`, co ogranicza duplikaty nazw przy przyszłej synchronizacji.
- `Ignoruj` i `Ignoruj wszystko` oznaczają świadome pominięcie wierszy importu, nie błąd danych. Podgląd importu liczy takie wiersze jako pominięte ceny.

## Hardware price change confirmation v1 — 2026-05-13

- Zmiana nie dodaje żadnego nowego klucza storage. Potwierdzenia nowych/zmienionych cen dostawców są stanem przejściowym importu w pamięci, przed zapisem przez `catalogStore`.
- Plan importu zawiera jawny diff cen dostawców (`supplierPriceChanges`), co jest zgodne z przyszłą chmurą: klient może pokazać użytkownikowi zmiany przed zapisem/synchronizacją, zamiast wykonywać ciche nadpisania.
- Pominięcie ceny w potwierdzeniu oznacza `__skipImport` na wierszu roboczym importu, a nie trwały stan domenowy. Do Firestore/synchronizacji nie powinny trafiać flagi techniczne resolvera.
- Dodanie lub aktualizacja ceny nadal zapisuje dane w istniejącym modelu `supplierPrices` przy okuciu w `fc_accessories_v1`; dostawcy pozostają w `fc_hardware_suppliers_v1`.
- Potwierdzenie pokazuje szczególnie ceny `Do wyceny`, ale nie zmienia jeszcze snapshotów WYCENY. Przyszły moduł ofert musi nadal zamrażać wartości użyte w ofercie osobno.

## Hardware global VAT + import stabilization v1 — 2026-05-13

Paczka `site_hardware_global_vat_import_stabilization_v1.zip` nie dodaje nowych kluczy storage.

Zmiana modelu danych:

- aktywny VAT dostawcy okuć został usunięty z modelu biznesowego;
- globalny VAT okuć pozostaje w `fc_hardware_settings_v1.defaultVatRate`;
- dostawcy w `fc_hardware_suppliers_v1` przechowują nazwę, rabat domyślny i aktywność;
- legacy pole `defaultVatRate` przy dostawcy jest ignorowane/normalizowane przy odczycie i imporcie;
- eksport XLSX `Dostawcy` nie zawiera już kolumny `vat_domyslny_proc`;
- import XLSX nie powinien wykorzystywać VAT-u dostawcy, nawet jeśli stary plik go posiada.

Stabilizacja chmurowa/importowa:

- `buildImportPlan()` ma być operacją bez skutków ubocznych: przygotowuje plan, ale nie mutuje aktualnych rekordów katalogu;
- zmiany cen dostawców są aplikowane dopiero przez właściwy flow zatwierdzania importu;
- dodano test antyregresyjny chroniący przed mutacją katalogu na etapie podglądu.

W przyszłej migracji chmurowej należy mapować VAT okuć do ustawień tenant/profil firmy, a nie do dokumentów pojedynczych dostawców. Rabat dostawcy pozostaje atrybutem dostawcy.


## 2026-05-14 — Hardware import/export refactor v1

- Refaktor nie dodaje nowych kluczy storage i nie zmienia polityki backupów. Dane katalogu okuć nadal przechodzą przez istniejący `catalogStore` i wersjonowane klucze `fc_*`.
- Import/export został rozdzielony pod przyszłą chmurę na granice: eksport/snapshot, parser pliku, plan importu i finalny apply. To ułatwia późniejsze przeniesienie planu importu do warstwy repository/synchronizacji bez mieszania go z UI.
- Publiczne fasady `FC.hardwareCatalogImportExport` i `FC.hardwareSupplierPriceXlsx` pozostają kompatybilne z obecnym UI, ale ciężka logika nie jest już skupiona w dwóch plikach 400+ linii.
- Nadal obowiązuje zasada: `buildImportPlan()` nie zapisuje danych użytkownika, a zapis następuje dopiero w `applyImportPlan()`.


## 2026-05-14 — Hardware import/export deep tests v1

- Paczka testowa nie dodaje nowych kluczy storage i nie zmienia modelu danych.
- Dodane testy wzmacniają kontrakt wymagany pod przyszłą chmurę: `buildImportPlan()` przygotowuje plan bez zapisu danych użytkownika, a trwały zapis odbywa się dopiero przez `applyImportPlan()`.
- Testy pilnują, żeby techniczne flagi importu typu `__skipImport` pozostały stanem roboczym importu, a nie domenowymi danymi do synchronizacji.
- Testy potwierdzają, że dostawcy nie dostają VAT-u per rekord, globalny VAT pozostaje w ustawieniach, a rabat jest atrybutem dostawcy.

## PRO100 / drobne usługi stolarskie — 2026-05-14

- Import PRO100 nie dostał nowego klucza storage; korzysta z istniejących granic `fc_service_orders_v1` oraz katalogu materiałów zarządzanego przez `catalogStore`.
- Formatki PRO100 są częścią zlecenia usługowego w `cutting.parts`: wymiary, ilość, krawędzie, materiał, grubość, `hasGrain` i źródło `pro100`.
- Brakujące kolory z importu są dopisywane jako zwykłe materiały katalogowe przez `catalogStore.savePriceList('materials')`, dzięki czemu późniejsza chmura może synchronizować je tak jak resztę cennika materiałów.
- Nie tworzyć osobnego, lokalnego storage dla wklejek PRO100. Jeśli później powstanie historia importów, musi dostać wersjonowany klucz `fc_*` albo osobny repository/adapter.


## PRO100 file import v1 — 2026-05-14

- Wczytanie pliku PRO100 nie dodaje nowego storage ani nowych kluczy `localStorage`; jest tylko alternatywnym źródłem wejściowym dla istniejącego parsera i modelu `cutting.parts`.
- Brakujące kolory nadal zapisuje istniejący `catalogStore` materiałów arkuszowych, tak jak w imporcie przez wklejkę; rekordy materiałów pozostają mapowalne do przyszłej chmury.
- Pliki XLSX/CSV/TXT są czytane lokalnie po stronie przeglądarki i nie są utrwalane jako pliki ani cache.

## Room preferences stage1 v1 — 2026-05-15

- `room.preferences` jest częścią modelu konkretnego pokoju/projektu, a nie osobnym magazynem danych. W przyszłej chmurze powinno mapować się na dokument/podpole pokoju, np. `projects/{projectId}/rooms/{roomId}.preferences`.
- Zmiana nie dodaje nowych kluczy `localStorage`, nie zmienia polityki backupów i zapisuje się przez istniejący przepływ projektu/inwestora.
- Migracja V9→V10 dopisuje pusty obiekt preferencji do istniejących pokoi. Brak preferencji pozostaje bezpiecznym stanem i oznacza użycie dotychczasowych fallbacków przy tworzeniu nowej szafki.
- Preferencje są traktowane jako domyślne ustawienia dla nowych szafek. Zapis preferencji nie modyfikuje istniejących szafek ani snapshotów wyceny, dzięki czemu przyszła synchronizacja nie będzie wykonywać ukrytych masowych zmian.
- `hardwareManufacturer` w preferencjach jest na razie tylko preferencją użytkownika. Nie tworzy relacji do pozycji katalogu okuć i nie uruchamia zamiany producentów. Późniejszy silnik zamiany powinien nadal pracować po katalogowym `kategoria + typ/cecha + producent`.

## Program defaults settings v1 — 2026-05-16

- Dodano nowy klucz danych użytkownika `fc_program_defaults_v1` dla globalnych domyślnych materiałów i preferowanych marek okuć.
- Klucz jest wersjonowany prefiksem `fc_`, więc wchodzi do backupów i później może być mapowany jako osobny dokument ustawień użytkownika, np. `users/{userId}/settings/programDefaults`.
- Zapis przechodzi przez `FC.storage` w module `js/app/settings/program-defaults-store.js`; fallback bezpośredni do `localStorage` jest tylko awaryjny w granicy store.
- Dane pozostają oddzielone od `room.preferences`: ustawienia programu są fallbackiem globalnym, a preferencje pomieszczenia/projektu będą rozwijane osobno.
- Nie zmieniono polityki backupów ani istniejących kluczy projektu.

## Program defaults UI fix v1 — 2026-05-16

- Poprawka jest UI-only i nie dodaje nowych kluczy storage.
- Model `fc_program_defaults_v1` zostaje bez zmian; nadal jest globalnym ustawieniem użytkownika mapowalnym w przyszłości na dokument ustawień programu.
- Usunięcie natywnych selectów nie zmienia danych ani kontraktu backupu.


## Room zone preferences v1 — 2026-05-16

- `room.preferences` zostaje w danych projektu/pomieszczenia i jest normalizowane przez schema/migrację do wersji 11.
- Nowy model strefowy używa `preferences.zones.lower|middle|upper`, bez osobnego storage dla preferencji pokoju.
- Globalne fallbacki materiałów/okuć pozostają pod wersjonowanym kluczem `fc_program_defaults_v1`, więc są objęte istniejącym backupem.
- Nie dodano nowych luźnych kluczy `localStorage`; nie zmieniano polityki backupów.

## Front material source v1 — 2026-05-16

- Nie dodano nowych kluczy `localStorage`; etap rozszerza istniejące dane projektu/pomieszczenia, szafek i zestawów.
- `frontMaterialSource` na wygenerowanych frontach jest metadaną pochodną/snapshotową, a źródło decyzji pozostaje w `cab.details` dla lodówek oraz w `set.frontSource` dla zestawów.
- W przyszłej chmurze `set.frontSource` i pola `fridgeFrontSource*` powinny synchronizować się razem z projektem, bez osobnego dokumentu ustawień.
- Brak źródła materiału jest stanem legacy i powinien być interpretowany jako `custom`, z zachowaniem zapisanych `frontMaterial/frontColor`.
- `schemaVersion: 12` nie wymaga przebudowy backupów ani zmiany polityki synchronizacji; to rozszerzenie kontraktu danych projektu.


## Set materials unify v1 — dane projektu — 2026-05-17

- Zmiana dopisuje dane do istniejącego modelu projektu, a nie do osobnego storage: `room.sets[]` zapisuje `bodyColor`, `backMaterial` i `openingSystem` dla zestawu.
- Wygenerowane korpusy w `room.cabinets[]` dostają te same wartości, więc przyszła synchronizacja chmurowa nadal traktuje zestaw jako część dokumentu/projektu.
- Nie dodano nowego klucza `localStorage`; brak migracji między store.
- Przy przyszłym podziale projektu w chmurze trzeba zachować powiązanie `setId` między `room.sets[]`, `room.cabinets[]` i `room.fronts[]`.

## Preferences / front source cleanup v1 — 2026-05-17

- Etap nie dodaje nowego storage ani nowego klucza `localStorage`.
- Uporządkowano logikę odczytu preferencji materiałowych przez centralny resolver domenowy. Dane nadal siedzą w projekcie (`room.preferences`) i globalnym kluczu `fc_program_defaults_v1`.
- Kolejność fallbacku cloud-ready pozostaje jawna: preferencje strefy w projekcie → globalne ustawienia programu → fallback runtime.
- Zmiana ułatwia przyszłą synchronizację/chmurę, bo nowe szafki, zestawy i źródła frontów używają jednego kontraktu, a nie kilku rozproszonych ścieżek.

## Bulk apply zone preferences v1 — dane projektu — 2026-05-17

- Etap nie dodaje nowego storage ani nowego klucza `localStorage`.
- Bulk apply modyfikuje istniejący dokument projektu: `room.cabinets[]`, `room.fronts[]` oraz `room.sets[]`.
- Plan zmian jest stanem UI/runtime i nie wymaga synchronizacji chmurowej jako osobny dokument.
- Źródłem reguł pozostają `room.preferences.zones`, globalne `fc_program_defaults_v1` oraz metadane frontów specjalnych `frontMaterialSource` / `frontSource`.
- Przy przyszłej chmurze operacja bulk powinna być transakcją na projekcie albo zapisem całego projektu po zatwierdzeniu użytkownika. Nie wykonywać częściowego zapisu bez potwierdzenia.
- `custom` na froncie specjalnym jest ręcznym wyjątkiem użytkownika i nie powinien być nadpisywany przez masowe zastosowanie stref.

## Hardware technical data + Excel v1 — 2026-05-18

- Nie dodano nowego storage ani nowych kluczy `localStorage`; techniczne dane okuć są częścią istniejących rekordów katalogu okuć przechowywanych przez `catalogStore`.
- Nowe pola (`hardwareSystem`, `drawerProfile`, `drawerLengthMm`, `drawerLoadKg`, `drawerReinforced`, `hardwareColor`, `hardwareUsage`, `technicalNote`) są mapowalne bezpośrednio na przyszłe pola dokumentu okucia w chmurze.
- Import/export XLSX/JSON przenosi nowe pola jako część rekordu okucia. Arkusz `Ceny_dostawcow` może używać tych pól przy tworzeniu nowego okucia, ale szybka aktualizacja ceny istniejącej pozycji nie nadpisuje danych technicznych.
- `series` pozostaje legacy aliasem dla `hardwareSystem`; przy migracji chmurowej docelowym polem jest `hardwareSystem`.


## 2026-05-20 — hardware_dynamic_technical_params_v1

- Dodano nowy klucz danych użytkownika `fc_hardware_technical_params_v1` dla definicji dynamicznych parametrów technicznych okuć.
- Klucz jest objęty backupem i klasyfikacją danych użytkownika.
- Rekordy okuć mogą zawierać nowe pole `technicalParams`, które będzie potrzebne przy przyszłej chmurze, liście zakupowej i zamianie producentów/systemów okuć.
- Import/export XLSX obsługuje definicje parametrów przez arkusz `Parametry_techniczne` oraz arkusze grupowe `Okucia_<kategoria>`.
- Szybka aktualizacja cen przez `Ceny_dostawcow` pozostaje niezależna od pełnych danych technicznych, żeby nie blokować pracy z cennikami dostawców.

## 2026-05-20 — hardware_technical_params_serialization_fix_v1

- Doprecyzowano normalizację wartości `technicalParams` dla przyszłej chmury: wartości wyborów nie mogą być serializowane jako `"[object Object]"`; powinny być tekstem, liczbą, booleanem albo zakresem `{ from, to }`.
- Stary tekst `"[object Object]"` jest traktowany jako śmieć i nie powinien być utrwalany dalej przy normalizacji katalogu okuć.
- Nie dodano nowych kluczy storage ani nie zmieniono zakresu backupu.

## Hardware compare modes / storage cleanup v1 — 2026-05-21

- Etap nie dodaje nowych kluczy storage i nie zmienia adapterów danych.
- Doprecyzowano semantykę porównywania dynamicznych parametrów technicznych okuć: `withinRange` wymaga pełnego objęcia wymaganej wartości/zakresu przez zamiennik, a luźne przecięcie zakresów zostaje w `rangeOverlap`. To jest ważne dla późniejszej zamiany producentów/systemów bez rozluźniania dopasowania.
- Uzupełniono klasyfikację diagnostyczną kluczy okuć: `fc_hardware_manufacturers_v1`, `fc_hardware_suppliers_v1`, `fc_hardware_settings_v1`, `fc_hardware_categories_v1`, `fc_hardware_types_v1`, `fc_hardware_technical_params_v1`. Wszystkie są danymi użytkownika i powinny być objęte backupem oraz przyszłą synchronizacją chmurową.
- Nie zmieniono polityki backupów, retencji, restore ani import/export Excel.


## Hardware replacement engine preview v1 — 2026-05-22

- Etap nie dodaje nowych kluczy storage, nie zmienia adapterów danych i nie zapisuje wyników podglądu zamienników.
- `js/app/catalog/hardware-replacement-engine.js` jest czystą warstwą domenową: wejściem są rekord źródłowego okucia, lista kandydatów, definicje parametrów technicznych i opcje porównania; wyjściem jest raport zgodności.
- Przy przyszłej chmurze silnik może działać po danych pobranych z `users/{userId}/catalogs/hardware/*` bez zmiany kontraktu: nie wymaga osobnego dokumentu ani kolekcji dla wyników podglądu.
- Wyniki `compareItems()` / `findCandidates()` są stanem runtime/raportem UI. Nie synchronizować ich jako danych użytkownika, chyba że później powstanie świadoma historia decyzji zamiany z osobnym modelem.
- Brak ceny dostawcy `Do wyceny` jest na razie atrybutem raportu, nie zmianą danych katalogu.


## Hinge angle class resolver v1 — 2026-06-03

- Model danych technicznych zawiasów rozdziela nominalny `kat_rzeczywisty` od słownikowej `klasa_kata`. To jest zmiana cloud-ready: zakres zamienności nie jest wpisywanym tekstem ani losowym zakresem od-do, tylko kontrolowaną wartością słownikową możliwą do mapowania na przyszły dokument Firestore.
- Stare `kat_otwarcia` pozostaje obsługiwane jako legacy przy odczycie/normalizacji, bez tworzenia nowego rozproszonego storage.
- Dobór WYCENY dla zawiasów porównuje pełny zestaw cech technicznych, a nie tylko kąt. Dzięki temu cena/snapshot opiera się na tej samej decyzji technicznej co WYWIAD i katalog okuć.



## Hinge 107 tech todo filter v1 — 2026-06-04

- Dodano centralną ocenę kompletności danych technicznych pozycji katalogowych. To jest cloud-ready: status nie jest nowym trwałym polem w storage, tylko wyliczanym widokiem z definicji parametrów i `technicalParams` pozycji.
- Pozycje niepełne nie są automatycznie używane w WYCENIE jako dobrane okucia. W przyszłej chmurze filtr `Do uzupełnienia tech.` może działać jako widok kontrolny katalogu bez dodawania osobnej flagi do dokumentów.
- Dobór zawiasów preferuje producenta z WYWIADU, ale nadal wymaga pełnych parametrów technicznych i tej samej klasy funkcjonalnej kąta.


## Hinge driver components v1 — 2026-06-04

- Dodano cloud-ready model jawnego parowania zawiasu z osobnym prowadnikiem: producent + `system_kompatybilnosci` + `typ_prowadnika` + `forma_prowadnika`. Nie wprowadzono osobnego słownika zgodności między systemami.
- Model danych rozdziela `rola_kompletu` (`komplet zawiasowy`, `zawias`, `prowadnik`) od sposobu pokrycia prowadnika (`pokrycie_prowadnika`).
- Kategoria `Prowadniki` jest osobną kategorią katalogu okuć i może być eksportowana/importowana przez istniejący mechanizm dynamicznych parametrów.
- Booleany w danych technicznych zachowują stan nieustawiony, żeby przyszła synchronizacja z chmurą nie myliła braku danych z wartością `false`.
- Cache-busting: `20260604_hinge_driver_components_v1`.

## 2026-06-09 — Profile stawek godzinowych robocizny

Etap `site_labor_rate_profiles_restore_clean_v1.zip` nie dodaje nowego trwałego klucza localStorage. Profile stawek godzinowych pozostają częścią istniejącego katalogu `quoteRates` i są normalizowane po stałym kodzie technicznym (`rateKey`/`rateCode`). Dla przyszłej chmury kod stawki jest stabilnym kluczem domenowym, a nazwa przyjazna i kwota są edytowalnymi właściwościami użytkownika.


## Źródła danych do czynności i wyceny — clean v1 — 2026-06-09

- Etap `site_work_quantity_sources_settings_clean_v1.zip` nie dodaje nowego trwałego storage i nie tworzy drugiej kopii danych szafek.
- `workQuantitySources` jest słownikiem systemowych nazw/kontraktów odczytu, a nie repozytorium danych użytkownika.
- Podpięcie do szafek, WYCENY i quoteCalculationRegister musi pozostać osobnym etapem z zasadą jednej prawdy.


## 2026-06-09 — Podgląd faktów szafek poza modalem

- Podgląd w trybiku `Dane do czynności i wyceny` nie dodaje nowego storage ani nowych trwałych kluczy `localStorage`.
- Dane są odczytywane na żądanie z aktualnego projektu przez `FC.workQuantityFacts`; nie powstaje drugi zapis wartości szafki.
- Etap jest zgodny z kierunkiem cloud-ready: nazwy źródeł i fakty szafki są widokiem/adaptacją danych projektu, a nie osobnym modelem zapisu.

## 2026-06-09 — Robocizna: autoRole nie jest migrowane do nowych reguł

Dla przyszłej chmury `autoRole` nie jest docelowym kontraktem domenowym i nie powinno być mapowane automatycznie na nowe reguły. Program jest jeszcze budowany, więc zamiast utrzymywać stare automaty, nowe i edytowane dokumenty `quoteRates` mają używać czystego modelu:

- `quantitySource` — stabilny kod źródła ilości,
- `conditions` — lista warunków zastosowania reguły,
- `conditions[].min` / `conditions[].max` — uniwersalne granice zakresu niezależne od wybranego faktu.

Stare `autoRole` może zostać usunięte/pominięte przy porządkowaniu danych; nie wolno z niego odtwarzać aktywnych reguł robocizny po cichu.

Warunki dostępne w UI powinny pochodzić tylko z aktywnych, zaimplementowanych i liczbowych źródeł `workQuantitySources`. Źródła planowane, tekstowe lub bez kalkulatora nie powinny być wybieralne jako aktywny warunek w cenniku. Nie dodawać nowych aktywnych warunków, takich jak osobne maksymalne wymiary frontu, bez osobnej decyzji użytkownika.

## 2026-06-09 — Robocizna: zapis warunków z kaskadowego UI

Dla przyszłej chmury kaskadowy wygląd formularza nie zmienia kontraktu danych. Dokument `quoteRates` przechowuje tylko jawne, kompletne warunki:

- `conditions[].source`,
- `conditions[].operator = range`,
- `conditions[].min`,
- `conditions[].max`.

Pusty końcowy launcher wyboru warunku nie jest danym do zapisu i nie powinien istnieć w API/chmurze. Walidacja klienta blokuje zapis warunku, jeżeli wybrano `source`, ale nie podano ani `min`, ani `max`.


## 2026-06-10 — Robocizna: edytor warunków i podgląd reguły

- Nie dodano nowego klucza `localStorage` ani nowego magazynu faktów szafki.
- `conditions[]` i `quantitySource` pozostają częścią istniejących pozycji cennika robocizny (`quoteRates`).
- Podgląd działania reguły jest wyłącznie UI/runtime i nie zapisuje osobnych danych.
- WYCENA nadal czyta wartości przez read-only adapter `FC.workQuantityFacts`, więc nie powstaje druga prawda dla wymiarów, frontów, zawiasów, półek ani szuflad.


## 2026-06-11 — Porządek kategorii AGD / Montaż AGD

- Zmiana nie dodaje nowego klucza `localStorage`.
- Stare seedowane pozycje robocizny w kategorii `AGD` są odcinane podczas normalizacji katalogu stawek wyceny, bo były wygenerowanymi danymi startowymi programu, nie osobnym modelem użytkownika.
- Docelowy model chmurowy powinien traktować `Montaż AGD` jako kategorię robocizny, a konkretne automaty jako stabilne techniczne kody typu `oven_mount`, `dishwasher_mount`, `hood_under_cabinet_mount`.
