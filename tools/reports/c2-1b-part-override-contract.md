# C2.1b — proponowany kontrakt własności danych formatek

Status: propozycja do zatwierdzenia, NIE wdrożony model. C2.1a zmienia wyłącznie odczyt wyjątków w `rozrys-prefs.js`. Nie migruje danych ani nie usuwa kluczy.

Aktualizacja C2.1b.1: fundament pochodzenia jest już wdrożony w RAM; poniższy model trwałych nadpisań nadal pozostaje propozycją do C2.1b.2. Decyzja użytkownika z [Issue #32](https://github.com/mebleszek/meble-app/issues/32): standardowe szafki z `+` są szablonowe; równoważne konstrukcyjnie elementy jednej szafki mają jedno wspólne ustawienie grupowe. Tryb Zaawansowane i kreator niestandardowych mebli pozostają odłożone. API GitHub nie udostępniło treści issue w tym środowisku (`Forbidden`); wykorzystano decyzje przytoczone w poleceniu użytkownika.

## 1. Stan po C2.1a i reprodukcje

`getMaterialGrainExceptions(material, allowedKeys, hasGrain)` odczytuje pełną mapę, tworzy niezależną kopię i filtruje ją w RAM. Dla listy aktywnych podpisów zachowuje dotychczasowe wartości boolean; bez listy zwraca kopię pełnej mapy. Pusta lista zwraca pustą mapę. Nie inicjalizuje storage, nie zmienia `enabled`, nie uruchamia sesji i nie wywołuje destrukcyjnego `pruneMaterialExceptions()`.

Reprodukcje na pamięciowym storage, bez danych użytkownika:

```sh
node tools/material-grain-read-safety-smoke.js
node tools/material-part-ownership-diagnostic.js
```

Pierwszy plik jest obowiązkowym smoke: 10/10 PASS po poprawce. Kontrolne uruchomienie tego samego testu z oryginalnym modułem z bazowego main dało 0/10 PASS; test rzeczywiście wykrywa trwałe mutacje odczytu, zmianę zwracanej mapy i nadpisanie uszkodzonego legacy JSON. Kontrola bazowego kodu nie jest częścią obowiązkowego preflight.

Drugi plik nie ma sufiksu `-smoke.js`, nie jest rejestrowany w preflight i NIE dowodzi bezpieczeństwa. Kod wyjścia 0 oznacza odtworzenie opisanych OTWARTYCH defektów; jeśli defekt przestanie się odtwarzać, diagnostyka prosi o ponowną ocenę zamiast osłabiać asercję.

| Przypadek | Obecny reprodukowalny problem | Docelowe zabezpieczenie |
|---|---|---|
| D1 | Ten sam materiał/nazwa/wymiary w różnych szafkach i pokojach daje jeden podpis; kierunek i PCV przenikają. | Adres elementu z właścicielem i rolą. |
| D2 | Ustawienie z projektu A odczytywane jest w identycznej formatce B, także dla wyjątku obrotu. | Odczyt wyłącznie z jawnie wskazanego projektu. |
| D3 | Zmiana wymiaru zmienia podpis; stary override pozostaje osierocony, nowa formatka wraca do defaultu. | Tożsamość niezależna od wymiarów. |
| D4 | Jawny zapis `fc_rozrys_grain_state_v1` nie należy do sesji pokoju; Cancel cofa projekt, lecz nie te ustawienia. | Dane słojów w tej samej gałęzi pokoju co edycja. |
| D5 | WYCENA wywołująca surowy `rozrysEngine.computePlan` nie przekazuje zależności polityki rotacji/podpisu używanych przez bridge ROZRYSU. | Jeden adapter efektywnych danych produkcyjnych i polityki rotacji. |
| D6 | Zapis zmienionego modala wyjątków przekazuje mapę widocznego zakresu do globalnego settera, zastępując wyjątki innych zakresów. | Aktualizacja tylko jawnych adresów należących do operacji. |

D5: formatka 1900 × 2600 mm, arkusz 2800 × 2070 mm, trim 10 mm, pilnowanie słojów włączone, brak wyjątku. Bridge nie umieszcza formatki, a ścieżka WYCENY umieszcza ją obróconą. Samo porównanie liczby arkuszy ukrywa różnicę, bo plan bez umieszczonej formatki może mieć pusty arkusz. Diagnostyka porównuje `placements`. Nie zmieniono silnika ani cen w C2.1a. Regresja akceptacyjna sprawdza zgodną politykę resolverów oraz rzeczywiste umieszczenie/obrót przy dozwolonej rotacji; nie deklaruje naprawienia D5.

## 2. Jedno źródło prawdy i proponowana struktura

Właścicielem jest fizyczny rekord `fc_projects_v1[id === projectId]` i istniejąca gałąź `projectData[roomId]`. `investorId` jest powiązaniem rekordu, nie identyfikatorem pojedynczej formatki. Nie dodajemy klucza localStorage, równoległego magazynu ani trwałej pełnej cutlisty.

Przykład gałęzi pokoju:

```json
{
  "cabinets": [{ "id": "cab-17" }],
  "production": {
    "partOverridesVersion": 1,
    "partOverrides": {
      "cab-17": {
        "body.side.left": {
          "edges": { "w1": false, "w2": false, "h1": false, "h2": false },
          "grain": { "direction": "vertical", "rotationAllowed": true }
        }
      }
    },
    "materialGrainPolicy": {
      "existing-material-id": { "enabled": false }
    }
  }
}
```

- `projectId` i `roomId` wynikają z lokalizacji w kanonicznym projekcie; nie zapisujemy ich jako konkurencyjnych pól wewnątrz override'u.
- `cabinetId` musi wskazywać istniejącą szafkę tego pokoju; rola musi należeć do jej generowanego zestawu elementów.
- PCV i słoje są niezależne: brak `edges` nie oznacza braku ręcznego kierunku i odwrotnie.
- `edges` opisuje istniejące technologiczne osie `w1/w2/h1/h2` = `1A/1B/2A/2B`, a nie położenie na ekranie. Nie wprowadzamy modelu kolorów PCV.
- `grain.direction` zachowuje `default/horizontal/vertical/none`. Brak pola oznacza dotychczasowy resolver defaultu; wybór defaultu usuwa zbędny override po świadomym zapisie.
- `rotationAllowed` odpowiada obecnemu wyjątkowi: przy wyłączonym pilnowaniu słojów albo kierunku `none` obrót jest dozwolony; przy pilnowaniu słojów wyjątek `true` pozwala obracać. Nie dodajemy nowej, sprzecznej semantyki blokady obrotu.
- `materialGrainPolicy` przenosi znaczenie obecnego `enabled` do właściciela pokoju. Klucz jest istniejącym stabilnym identyfikatorem materiału; brak identyfikatora wymaga jawnego resolvera, nie dopasowania po samej wyświetlanej nazwie. Metadane katalogu pozostają tylko źródłem defaultu, bez kopiowania cennika.
- Puste gałęzie override'ów usuwa się podczas jawnej zmiany; sam render niczego nie canonicalizuje ani nie zapisuje.

## 3. Stabilna tożsamość i ilość

Adres źródłowy: `{ projectId, roomId, cabinetId, partRoleId }`. Etykieta, dekor, grubość, rozmiar, kolejność w cutliście, kierunek i podpis agregacji NIE są identyfikatorem.

Generator powinien nadawać stałe role, np. `body.side.left`, `body.side.right`, `body.bottom`, `body.back`. Nie wystarczy obecny `name:'Bok', qty:2`: lewy i prawy bok są osobnymi elementami. Jeśli UI pozwala edytować je razem, operacja ma jawnie wskazywać oba adresy, a nie utrwalać decyzję pod wspólnym podpisem.

Standardowe powtarzane półki, fronty i komponenty szuflad NIE wymagają indywidualnych slotów. Aktualna decyzja zastępuje wcześniejsze zalecenie slotów dla takich szablonów. Adres grupy szafki to `{ projectId, roomId, ownerType:'cabinet', cabinetId, groupRoleId }`, a jej udział w wierszu opisuje osobne `qty`. Zmiana półek 3 → 5 zachowuje `body.shelves`; zmiana liczby nie jest zmianą tożsamości grupy. Druga szafka/pokój/projekt ma własny adres.

`sourceRefs` nadal opisuje konkretne sztuki, np. dwa boki. `sourceGroups` opisuje wspólne ustawienie i liczbę sztuk, nigdy jedną sztukę udającą grupę. `sourceIssues` obejmuje nierozstrzygniętą ilość. Dla każdego wiersza suma liczby refs, ilości grup oraz ilości issues musi równać się `qty`. Przy agregacji zachowujemy wszystkie wkłady, nawet gdy różne grupy konstrukcyjne mają identyczną geometrię.

Fronty wspólnego zestawu mają jawnego właściciela `{ projectId, roomId, ownerType:'set', setId, groupRoleId }`. `set.id` jest zachowywane przez obecny wizard przy edycji; nowe ID szafek/frontów nie jest nowym właścicielem tego frontu zestawu. Pierwsza szafka pozostaje jedynie miejscem emisji ilości w dotychczasowym algorytmie. Rola pochodzi z rozpoznanego szablonu zestawu, a nie z pozycji szafki/frontu. Niespójny lub nieznany zestaw pozostaje issue przypisanym do `setId`, bez sztucznego `cabinetId`.

Przyszłe przekształcenie standardowej grupy w osobne elementy w trybie Zaawansowane musi być jawną operacją kanonicznego projektu, ze stabilnymi ID, mapowaniem ustawień i potwierdzonym zapisem. Sam render ani zmiana liczby sztuk nie uruchamia tego procesu. Nie implementujemy tego trybu w C2.1b.1.

## 4. Źródło a agregacja produkcyjna

1. Pobierz spójny kanoniczny rekord dla jawnego `projectId` i `selectedRooms`.
2. Wygeneruj części wyłącznie w RAM, z adresami źródłowymi.
3. Rozwiąż PCV, kierunek i rotację dla każdego adresu, przed agregacją.
4. Dopiero potem agreguj po rzeczywiście kompatybilnym materiale, grubości, wymiarach i ograniczeniach produkcyjnych. Zachowaj listę adresów źródłowych oraz mapowanie egzemplarzy/ilości.
5. Formatki z różnymi PCV mogą być na jednym arkuszu, ale ich indywidualne oznaczenia krawędzi nie mogą się zgubić. Różne ograniczenia rotacji nie mogą zostać zlane w jedno ustawienie grupy.
6. Identyfikator pozycji optymalizatora jest tylko RAM-owym odwołaniem do źródła. Ani klucz grupy, ani `#1/#2` wygenerowane z ilości nie trafiają do trwałych override'ów.

MATERIAŁ, liczenie metrów PCV, ROZRYS i WYCENA mają używać tego samego read-only resolvera efektywnych części. Odczyt bez kontekstu projektu ma zwracać błąd kontekstu lub jawny podgląd defaultów, nigdy dane poprzedniego projektu ani zapis do globalnego store. `persist:false` oznacza zero trwałych mutacji i zero `session.begin()`.

## 5. Cykl życia

| Operacja | Reguła |
|---|---|
| Zmiana wymiarów | Ten sam adres roli; zachowaj świadome override'y i przelicz aktualne wymiary/defaulty w RAM. |
| Zmiana typu/topologii | Nie przenoś decyzji przez nazwę lub indeks. Nieaktywne role nie wpływają na kalkulację; odczyt ich nie kasuje. Jawne czyszczenie może nastąpić tylko w potwierdzonej operacji edycji. |
| Nowa szafka | Nowe ID i sloty; brak dziedziczenia ręcznych decyzji innej szafki o takim samym rozmiarze. |
| Kopiowanie szafki | Nowy `cabinetId`; domyślnie kopiujemy konfigurację źródłową bez ręcznych decyzji produkcyjnych. Opcjonalne „kopiuj także nadpisania” wymaga jawnej decyzji i mapowania stabilnych ról/slotów. Nigdy aliasów obiektów. |
| Kopia pokoju/projektu | Nowi właściciele; jawna polityka kopiowania override'ów jak wyżej. Bez odczytu przypadkowego globalnego RAW. |
| Przeniesienie szafki | Operacja dwóch gałęzi, poza zwykłą sesją jednego pokoju; użyj potwierdzonej domenowej operacji z kontrolą wersji. Nie uruchamiaj niejawnego zapisu innego pokoju. |
| Usunięcie szafki/pokoju | Usunięcie wyłącznie odpowiedniej gałęzi override'ów wraz ze źródłem, w tej samej potwierdzonej zmianie. Brak usuwania archiwalnych ofert. |
| Powrót do defaultu | Usuń tylko wskazany komponent override'u; zachowaj drugi komponent i pozostałych właścicieli. Zapis kanonicznego pokoju naturalnie wraca do clean względem jego baseline. |

## 6. Zapis, sesja i awarie

Publiczna operacja zapisu ma otrzymywać jawny adres i kompletny patch, przygotowywać kopię pokoju/projektu, rozpoznawać semantic no-op oraz wymagać `session.begin() === true` PRZED mutacją współdzielonego RAM lub storage. Musi sprawdzać zgodność `projectId + roomId`, obecność szafki i rolę. Wynik `{ ok, project }` pochodzi z istniejącego `saveConfirmed()`; RAM i modal uznają zmianę za zatwierdzoną tylko przy `ok === true`.

Nie wprowadzamy równoległej trwałej kopii override'ów ani globalnego transaction framework. Snapshot sesji już obejmuje źródłowy projekt, a rollback C2.0b jest przypisany do pokoju. Umieszczenie nowych pól w jego gałęzi pozwala cofać je razem z szafkami i zachować nowsze dane innych pokoi/rekordów.

Brak właściciela, konflikt, failed begin lub failed central save: zero udawanego sukcesu, draft zachowany, edycja/persist zablokowane zgodnie z dotychczasowym kontraktem. Nie używamy lokalnie globalnego Cancel do kompensacji innej operacji. `commit()` nadal wymaga potwierdzonego trwałego zakończenia sesji. Obliczenia nadal wymagają zakończenia edycji według C2.0b.

## 7. Stare globalne nadpisania

`fc_edge_v1`, `fc_material_part_options_v1`, `fc_rozrys_grain_state_v1` zachowujemy byte-for-byte jako legacy dane. Nie kasujemy ich, nie resetujemy i nie dopisujemy ID projektu do ich nazw.

Nie można automatycznie ustalić właściciela globalnego podpisu. Nawet jeden pasujący element w aktualnie otwartym pokoju nie dowodzi, że wpis nie pochodzi z innego projektu. Normalny resolver C2.1b nie może automatycznie zastosować takiego legacy wpisu do każdego nowego projektu.

Rekomendacja: brak automatycznej migracji. Opcjonalny osobny import pokazuje istniejący RAW, wszystkie kandydatury i wymaga jawnego wskazania właściciela/roli oraz zatwierdzenia. Wpis niejednoznaczny pozostaje niewłączony i zachowany w starym store. Uszkodzony JSON nie jest nadpisywany fallbackiem. Import ma ten sam durable/confirmed kontrakt co zwykła edycja; nie usuwa legacy klucza po częściowym sukcesie.

Do czasu C2.1b nie należy deklarować bezpiecznego globalnego Cancel dla formatek: zmiana `fc_edge_v1` lub opcji kierunku blokuje Cancel zgodnie z C2.0; jawne ustawienia słojów ROZRYSU pozostają poza snapshotem (D4). C2.1a naprawia tylko destrukcję podczas odczytu. Nadal istnieją globalne settery, destrukcyjny publiczny `pruneMaterialExceptions()` i zastępowanie mapy podczas świadomego zapisu modala (D6); nie są używane przez poprawiony odczyt.

## 8. Cache, oferty i testy akceptacyjne C2.1b

Cache bieżącego rozkroju musi uwzględniać projekt, dokładny calculationScope, świeże źródła oraz efektywne PCV/kierunek/rotację. Zmiana wymiarów lub override'u unieważnia wynik bieżący, nie historię oferty. `editScope`, `calculationScope` i `offerScope` pozostają niezależne. Oferta A+B nadal nie zastępuje A ani B i nie jest przeliczana z nowego cache/cennika.

Przed wdrożeniem C2.1b wymagane są zielone rzeczywiste testy:

- identyczne formatki różnych szafek, pokojów i fizycznych projektów mają niezależne PCV, kierunek i wyjątki;
- role/sloty zachowują decyzję przy zmianie wymiarów, sortowaniu i usunięciu sąsiedniej półki;
- kopiowanie/usuwanie zmienia wyłącznie jawnych właścicieli;
- Cancel oraz Save/restart działają na kanonicznych polach, nie na globalnej kopii;
- failed begin, zapis, cleanup i konflikt nie powodują utraty draftu ani fałszywego sukcesu;
- RAM-only read i `persist:false` nie wykonują write/remove/begin;
- oba silnikowe wejścia otrzymują identyczne źródła, klucze i politykę obrotu: test z D5 musi porównywać placements, nie tylko liczbę arkuszy;
- sumy PCV oraz WYCENA dla A, B i A+B wynikają z właściwych nadpisań; referencja 4/3/6 arkuszy pozostaje;
- selekcja aktywnych ról nie kasuje innych trwałych ról, a zapis modala nie usuwa innych zakresów;
- niejednoznaczne i uszkodzone legacy dane pozostają dostępne i nie migrują podczas renderu;
- historyczne oferty, globalne katalogi/cenniki i rollback innych pokojów pozostają nienaruszone.

Zalecana kolejność po C2.1b.1: najpierw scoped confirmed write dla rozpoznanych indywidualnych ról i standardowych grup; następnie integracja efektywnych danych MATERIAŁ–ROZRYS–WYCENA (w tym D5), cache i ewentualny jawny import. Indywidualne sloty standardowych półek są zbędne zgodnie z decyzją użytkownika. Odłożone funkcje Zaawansowane wymagają osobnego zatwierdzenia.

## 9. Kontrakt następnego C2.1b.2

Kanoniczne dane pokoju mogą otrzymać oddzielne przestrzenie `production.partOverrides[cabinetId][partRoleId]`, `production.cabinetGroupOverrides[cabinetId][groupRoleId]` i `production.setGroupOverrides[setId][groupRoleId]`. To propozycja, NIE pola zapisywane przez C2.1b.1. Wszystkie pozostają w tej samej gałęzi kanonicznego projektu; nie tworzymy osobnego store.

Operacja ma sprawdzić właściwy fizyczny rekord i pokój, istnienie właściciela oraz aktywną rolę. Liczba sztuk nie jest częścią klucza override'u. Ustawienie grupowe stosuje się do całego aktualnego wkładu tej grupy; nie można dodać wyjątku pojedynczej półki w szablonie. PCV i grain mają niezależne komponenty. Brak pewnego kontekstu, `sourceIssues` lub konflikt oznacza odmowę zapisu, bez dopasowania po nazwie, wymiarach lub legacy podpisie.

Zmianę należy przygotować na kopii, sprawdzić semantic no-op, wymagać durable begin i confirmed room save; RAM aktualizować tylko po sukcesie. Nie wpisywać do projektu pełnej cutlisty, `sourceRefs`, `sourceGroups`, ilości pochodnych ani cache. Przy agregacji grup ustawienia produkcyjne należy rozwiązać PRZED grupowaniem, zachowując dotychczasowe obliczenia i zakresy ofert. Copy/delete oraz powrót do defaultu dotyczą wyłącznie jawnego właściciela.

Szczegółowy zakres obsłużonych grup i ograniczenia generatorów: [C2.1b.1](c2-1b1-template-part-groups.md). Rozpoznane adresy mogą być fundamentem zapisu C2.1b.2, ale nie dowodzą jeszcze bezpieczeństwa globalnych setterów ani naprawienia D1–D6.
