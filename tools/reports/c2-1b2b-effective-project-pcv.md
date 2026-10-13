# C2.1b.2b — wspólne efektywne PCV projektu

Baza: `91b423c41acd7513006897cf2576f1da01d9931c`, main po PR #36. Zakres: jawny tryb obliczeniowy, bez przełączania UI i bez migracji danych.

## Odnalezione przepływy

| Miejsce | Dotychczasowa odpowiedzialność / zależność |
|---|---|
| `material-edge-store.js` | Technologiczne defaulty, kwalifikacja materiału, `edgingMetersForPart`, sumy i podział body/front. Instancja `createEdgeStore` czyta globalne `fc_edge_v1`; podpis materiał/nazwa/wymiary przypisuje jedne flagi całemu wierszowi qty. |
| `material-tab-data.js` | `collectRoomMaterials` i `collectEdgeMetersForRooms`, filtrowanie materiału/frontów/korpusów i sumy szafek/pokoi. Stare collectory tworzą edge store i ponownie liczą metry z części. |
| `js/tabs/material.js` | Render `entry.edgeMeters`, podsumowań i aktywnych checkboxów; odczyt/zapis globalnego podpisu przez edgeApi. Fallback bez modelu ma licznik zero. Nie zmieniono tego interfejsu. |
| `cabinet-derived-facts.js` | `edgeSplitFor` zapisuje odtwarzalny wynik legacy w RAM `derivedFacts.material.edgeMetersByMode`; generator cutlisty i drugi agregator ROZRYSU. Cache PCV nie uwzględnia kanonicznych override'ów, więc nowy tryb go nie używa. |
| `cabinet-cutlist.js`, `front-hardware-fronts.js`, `part-provenance.js` | Rzeczywiste wymiary, qty, role i grupy. `Bok ×2` ma dwa refs, półki mają grupę, fronty mieszanych szuflad dwie grupy, wspólne fronty zestawu mają setId. Generatory i geometria nie zostały zmienione. |
| `rozrys-scope.js`, `rozrys.js` | Agregacja kompatybilnych części według materiału, podpisu, kierunku i wymiarów. Dotąd nie liczyła metrów; metadane pochodzenia były przenoszone. |
| `rozrys-engine.js`, `rozrys-runner.js` | Mapper przekazuje flagi do optymalizatora/placements. Dotychczasowe deps i fallback runnera używają globalnego edge store. Nowy tryb obsługuje mapper silnika, ale runner UI pozostaje legacy. |
| `rozrys-cache.js` | Klucz cache rozkroju zawiera legacy edge store. W jawnej projektowej WYCENIE nie odczytujemy ani nie zapisujemy tego cache. |
| `rozrys-stock.js`, `rozrys-sheet-model.js` | Ponowne obliczenia na formatach z magazynu i odejmowanie wykorzystanych qty po kluczu. Integracja przekazuje projektowy klucz i aktualizuje ledger pozostałych ilości; same moduły/polityka magazynu nie są zmienione. |
| `wycena-core-source.js` | Wybór pomieszczeń i agregat z derivedFacts albo ROZRYSU. Nowy tryb ma osobną jawną ścieżkę bez fallbacku do innego projektu/cache. |
| `wycena-core-material-plan.js` | `collectEdgeMetersFromMaterialSource` deleguje do MATERIAŁU. `collectMaterialLines` i `buildEdgeLine` dzielą body/front, zaokrąglają surowe metry do 3 miejsc, dodają 10% jeden raz, wybierają istniejącą stawkę za mb i zaokrąglają kwotę do 2 miejsc. Ta polityka jest zachowana. |
| Historia ofert / rejestr kalkulacji / prezentacja ofert | Konsumują utrwalone linie i wynik, nie są nowym źródłem metrów. Nie zmieniono ani nie przeliczono historycznych ofert. |

## Wspólny resolver

Nowy `FC.projectPcvResolver` w `js/app/project/project-pcv-resolver.js` pracuje wyłącznie na aktywnym fizycznym projekcie z jawnym `projectId` i listą pokoi. `collect(rooms, options)` zwraca `{ok:true, details, edgeMeters, edgeMetersByMode, revision, ...}` albo diagnostykę `{ok:false, code, details}`. `requireCollection` zgłasza wyjątek `projectPcv:true` z kodem `PROJECT_PCV_*`; adaptery nie zamieniają go w zero ani legacy fallback.

Czytnik C2.1b.2a został rozszerzony o read-only `inspectRoom(projectId,roomId)` i `getForCalculation(address)`. Współdzielą dotychczasową kontrolę fizycznego projektu, inwestora, zgodności RAM z centralnym pokojem, istnienia właściciela/roli i poprawności override'u. Get/set/clear zachowują kontrakt i bramkę trwałej sesji. Czytnik kalkulacyjny dodatkowo zwraca zweryfikowane geometrie i ilości danego źródła; znany materiał niekwalifikowany do PCV ma jawnie `eligible:false`, cztery false i źródło `ineligible`. Nie obchodzi to walidacji właściciela ani nie pozwala go zapisać. Nieznany typ materiału daje diagnostykę zamiast zgadywania zerowego PCV.

Kolejność nowego obliczenia:

1. Świeży proof każdego pokoju i kanonicznego rekordu.
2. Natywna cutlista bez użycia cache szafki.
3. Sprawdzenie `sourceIssues`, pełnych adresów, geometrii i bilansu `refs.length + sum(groups.qty) === qty`. Osobny ref nie może zostać policzony dwa razy.
4. Odczyt aktualnego projektowego override'u / technologicznego defaultu przez API C2.1b.2a. Brak odczytu `fc_edge_v1` i brak mieszania trybów.
5. Metry każdej sztuki lub wkładu grupy poprzez istniejące `edgingMetersForPart`: `qty * ((w1+w2)*a + (h1+h2)*b) / 100`, dla a/b w cm.
6. Podział body/front według istniejącej polityki szafki. Jeżeli wspólny front zestawu ma emitujących członków o różnych trybach PCV, odmawiamy liczenia tego frontu (`SET_PCV_MODE_AMBIGUOUS`), zamiast wybierać przypadkowy pierwszy korpus. Zakres samych korpusów nadal działa.
7. Rozdzielenie surowego wiersza na jednorodne technologicznie wiersze PCV, później agregacja i powtórny proof wersji rekordu.

Resolver nie zapisuje storage, nie inicjuje sesji, nie czyści legacy i nie zmienia wspólnego RAM. Zwracane części, wkłady i szafki są niezależnymi kopiami. Memo pojedynczego odczytu adresu żyje tylko wewnątrz jednego wywołania — nie jest długotrwałym cache.

## Pochodzenie, indywidualne części i grupy

Opcjonalne `effectivePcv` jest wyłącznie metadanymi obliczenia w RAM:

```js
{
  projectId,
  key: 'body:1100', // technologiczny tryb i flagi; NIE adres źródłowy
  edges: {w1:true,w2:true,h1:false,h2:false},
  body, front, total,
  contributions: [{address, qty, aCm, bCm, edges, mode, meters, source}]
}
```

`sourceRefs` i `sourceGroups` pozostają odrębnymi źródłami. Ledger grupy zawiera jej bieżącą ilość; nie powstają indywidualne sloty półek. Set group zachowuje `ownerType:'set'` i `setId`. Nie zapisujemy tych metadanych do kanonicznego projektu.

Dwa boki o tych samych wymiarach z różnymi flagami zostają rozliczone jako dwie sztuki i dwa wiersze technologiczne. Późniejszy klucz agregacji zawiera również tryb/flagę PCV, więc nigdy nie zlewa odmiennych krawędzi. Formatki nadal trafiają do wspólnego rozkroju tego samego rzeczywistego materiału. `partProvenance.copy/merge` głęboko kopiuje/przenosi ledger i zachowuje pełne qty.

Mapper optymalizatora w jawnym trybie ponownie weryfikuje adresy, aktualne flagi, wymiary i ilości wkładów. Odrzuca niepełne krawędzie, stary PCV, niezgodną geometrię/metry, duplikaty i brak kontekstu. Klucze pozycji zawierają geometrię/podpis i projektowy wariant PCV, aby placements nie miały kolizji między różnymi częściami. Przy istniejącym vertical grain mapper zamienia tylko osie prezentacji; technologiczne w1/w2/h1/h2 w ledgerze pozostają oryginalne. Sam optimizer nadal wykonuje dotychczasową transformację flag przy obrocie. Nie zmieniono logiki słojów ani rotacji.

`withQuantity` przygotowuje kopię pozostałego wkładu, gdy adapter magazynu zmniejszył qty. Nie zmienia źródłowego adresu grupy i nie dodaje narzutu do metrów. Wspólny `planKey` jest przekazywany zarówno optimizerowi, jak i odejmowaniu wykorzystanych pozycji magazynu. PCV do ceny nadal pochodzi z pełnego zakresu źródłowego, a nie z samych części pozostałych do rozkroju na nowych arkuszach.

## Jawne API integracji

```js
const options = {pcvMode:'project', projectId:'physical-project-id'};
const rooms = ['kuchnia','salon'];
const selection = {selectedRooms:rooms, materialScope:{kind:'all',includeFronts:true,includeCorpus:true}};

FC.materialTabData.collectRoomMaterials('kuchnia', options);
FC.materialTabData.collectEdgeMetersForRooms(rooms, options);
FC.rozrys.aggregatePartsForProject(rooms, options);
FC.cabinetDerivedFacts.aggregatePartsForRooms(rooms, options);
const aggregate = FC.wycenaCoreSource.getSelectedAggregate(selection, options);
const lines = await FC.wycenaCoreMaterialPlan.collectMaterialLines(aggregate, selection, options);
```

Dla bezpośredniego rozkroju: `FC.rozrysEngine.computePlan(state, aggregate.groups[material].allParts, options)`. W razie potrzeby zachowujemy istniejące deps polityki rotacji. Kontekst projektowy musi być jawny; projektowy agregat bez tej opcji oraz legacy agregat przekazany do projektowej ceny są odrzucane. Nie dodano flagi globalnej ani kontrolki UI. Pełny UI `collectQuoteData`, runner, rysowanie list i przyciski nadal korzystają z dotychczasowej ścieżki. Nie sugerujemy, że użytkownik ma już przełączony program.

WYCENA weryfikuje świeżą wersję i cały wybrany ledger przed oraz po obliczeniach asynchronicznych. Ręcznie zmodyfikowany albo stary agregat nie może zostać użyty do ceny. Oddzielne i wspólne zakresy zachowują oddzielne wartości.

## Rzeczywiste przykłady z izolowanych fixture

| Przykład | Wynik surowy |
|---|---:|
| Bok a=68,2 cm: w1+w2, qty1 | 1,364 mb |
| Drugi identyczny bok: tylko w1, qty1 | 0,682 mb |
| Wspólnie te dwa boki | 2,046 mb |
| Półki a=56,4 cm, w1+w2, qty3 / qty5 | 3,384 / 5,640 mb |
| Fronty 600 × 139/283/283 mm, wszystkie krawędzie | 5,010 mb |
| Mały front bez w1 + dwa duże bez w2 | 0,878 + 2,332 = 3,210 mb |
| Dwie identyczne szafki fixture, tylko lewy bok pierwszej ma dodatkowe w2 | 17,122 mb |
| Drugie pomieszczenie fixture / wspólny zakres | 8,220 / 25,342 mb |

MATERIAŁ, oba agregatory ROZRYSU i źródło WYCENY mają identyczny ledger dla zakresu dwóch szafek: **17,122 mb**, te same geometrie i fizyczne ilości. Frontowe **5,010 mb** przechodzi przez istniejący cennik: **5,511 mb** z zapasem, kontrolna cena 5 zł/mb daje **27,56 zł**. Aktualizacja syntetycznej ceny do 7 zł/mb daje **38,58 zł** bez zmiany qty. To dane testowe, bez ingerencji w cennik użytkownika. Body i front mają osobne linie, każda z pojedynczym zapasem 10%.

## Cache i dane

Projektowe metry nie korzystają z `derivedFacts.material.edgeMetersByMode`, starej cutlisty cache ani trwałego cache rozkroju WYCENY. Zmiana PCV przy tej samej geometrii jest rozwiązywana ponownie, także gdy liczba metrów nie zmienia się, lecz zmieniają się konkretne krawędzie. Opaque `revision` / `projectPcvRevision` jest tylko proofem bieżącego rekordu w wyniku RAM; nie jest zapisywany. Nowy tryb nie odczytuje ani nie zapisuje `fc_rozrys_plan_cache_v1`. Nie dodano frameworka cache ani storage key.

Globalne cenniki i katalogi, stare trzy store formatek, projekty, historia ofert oraz backupy pozostają bez mutacji podczas obliczenia. Setter PCV nadal należy do C2.1b.2a; semantyka Zapisz/Anuluj, snapshot i warunkowy central save nie zostały zmienione. Kalkulacja nie zmienia editScope i nie tworzy ofert ani nie kończy sesji.

## Granica przełączenia i ryzyka

- Legacy UI nadal zapisuje/czyta globalne PCV. Nowy tryb jest dostępny wyłącznie dla świadomego wywołania API. D1–D6 w globalnych ścieżkach pozostają otwarte.
- Do przełączenia użytkownika potrzebne są zgodne launchery/settery oraz produkcyjne wyświetlanie właścicieli i zróżnicowanych krawędzi w MATERIALE, runnerze ROZRYSU i pełnym orchestratorze WYCENY. Nie wolno ograniczyć się do samego przełączenia ceny.
- Nie ma automatycznego importu legacy. SourceIssues, nieznane materiały, niekompletny kontekst, sprzeczny tryb zestawu i stale RAM są błędami do świadomego rozwiązania, a nie pretekstem do globalnego fallbacku.
- Tryb wymaga aktywnego fizycznego projektu i spójnego RAM wybranych pokoi. Detached projekty innych inwestorów nie są podpinane do ustawień bieżącego projektu. Zapisanej oferty nadal dotyczą istniejące zabezpieczenia zakończenia sesji i exact-scope; ten etap nie dodaje nowej drogi jej utrwalania.
- Native rola jest walidowana świeżym generatorem; koszt wielokrotnego odczytu jest większy niż legacy cache. Optymalizacja może nastąpić dopiero po pomiarach, z zachowaniem proofu wersji.
- LocalStorage nie zapewnia atomowego snapshotu między kartami. Ponowne odczyty, proof wersji i błędy przy konflikcie chronią testowane zmiany; pełna atomowość pozostaje zadaniem przyszłego backendu.
- Nie zmieniono optymalizatora, cen, marż, polityki zapasu ani istniejących ograniczeń obrotu/słojów i geometrii. Zapisane oferty nie są automatycznie przeliczane.

## Weryfikacja i pliki

Nowy `tools/effective-project-pcv-smoke.js`: **30/30 PASS**, obejmuje wymagane 20 scenariuszy, realne źródła/session/store, shared collectors, cenę, placements, stale cache i rzeczywisty adapter magazynu. Dodatkowo source ownership, grupy, geometria, owner rollback, begin/confirmed/cancel/global isolation, write failures, MATERIAŁ, historia ofert i APP: 18 plików regresji PASS po aktualizacji jednej asercji assetu. Bezpośrednie global-data-write-safety, hourly-rates-settings, company-transport-business-costs i catalog-migration-test-fix: PASS. Niezależna referencja wielopomieszczeniowa pozostaje **4/3/6 arkuszy**.

Pierwszy pełny preflight: 112/113 smoke — jedynym błędem była stara literalna wersja assetu cabinet-derived-facts w teście. Asercja ładowania zachowuje ścisłość z nową wersją; analogicznie whitelistę WYCENA aktualizowano tylko dla dwóch zmienionych modułów. Końcowy pełny preflight: **PRE-FLIGHT PASS** — składnia **518/518**, kolejność **317**, smoke **113/113**, APP **110/110**, audyty zależności/storage PASS. `node --check`: **15/15** zmienionych/dodanych JS PASS. `git diff --check`: PASS.

Zmienione pliki produkcyjne: nowy `project-pcv-resolver.js`; `project-pcv-overrides.js` (shared proof i odczyt kalkulacyjny); `material-tab-data.js`; `part-provenance.js`; `cabinet-derived-facts.js`; `rozrys-scope.js`, `rozrys.js`, `rozrys-engine.js`; `wycena-core-source.js`, `wycena-core-material-plan.js`. Ładowanie/cache-busting: `index.html`, `dev_tests.html`, `tools/index-load-groups.js`, `tools/app-dev-smoke-lib/file-list.js`. Testy: nowy smoke, wersje assetów w `tools/app-dev-smoke.js` i `tools/cabinet-derived-facts-cache-smoke.js`. Dokumentacja: niniejszy raport.
