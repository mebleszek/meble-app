# C2.1b.1 — stabilne grupy formatek szablonowych

Baza: `4597522ab633d5199f39ac7daf6a59dd27d45cad`, main po PR #31 / C2.1b.0.

Aktualizacja C2.1b.1a: wspólny resolver usuwa opisaną niżej rozbieżność geometrii standardowych szuflad. Obowiązujący wzór i wyniki przed/po: [raport C2.1b.1a](c2-1b1a-drawer-front-geometry.md). Nie zmienia to odłożonego zakresu migracji/zapisu nadpisań.

## Decyzja produktowa i reprezentacja

Zgodnie z decyzją użytkownika przytoczoną z [Issue #32](https://github.com/mebleszek/meble-app/issues/32), standardowa szafka z `+` jest szablonem. Jedna równoważna konstrukcyjnie grupa ma wspólne ustawienie produkcyjne. Nie wprowadzamy indywidualnych slotów półek ani wyjątków w grupie. Tryb Zaawansowane / tworzenie nietypowych korpusów pozostaje odłożony. Odczyt issue przez API był zablokowany (`Forbidden`); nie deklarujemy znajomości dodatkowej treści poza decyzjami użytkownika.

Indywidualne `sourceRefs` z C2.1b.0 pozostają. Nowe `sourceGroups` zawiera płaskie rekordy:

```json
{
  "projectId": "project-A",
  "roomId": "kuchnia",
  "ownerType": "cabinet",
  "cabinetId": "cab-17",
  "groupRoleId": "body.shelves",
  "qty": 3
}
```

Adres to powyższe pola BEZ `qty`. Półki 3 → 5 → 0 → 3 nie zmieniają roli grupy; przy zerowej ilości grupa po prostu nie jest emitowana. Nie ma ID zależnego od wymiarów, materiału, podpisu, nazwy wyświetlanej ani indeksu tablicy.

`sourceGroupRoles` jest lokalną deklaracją generatora, ponownie wiązaną z właścicielem na odczycie. `sourceGroups` służy konsumentom. Oba pola są odtwarzalne, tylko w RAM. Kopie są niezależne; agregator konkatenacją zachowuje wkład każdej grupy w wiersz produkcyjny. Suma `sourceRefs.length + sum(sourceGroups.qty) + sum(sourceIssues.qty)` odpowiada fizycznemu `qty`, bez podwójnego liczenia. Nie rozbijamy wierszy tylko dla potrzeb adresowania.

## Obsłużone grupy

| Źródło | Rola / reguła |
|---|---|
| Standardowe półki korpusu | `body.shelves` |
| Równe fronty standardowych szuflad | `front.drawer.standard` |
| Rozpoznany mieszany układ 3_1_2_2, przy zgodnej liczbie 3 | `front.drawer.small` (1), `front.drawer.large` (2), odrębne konstrukcje nawet przy agregacji geometrii |
| Skrzynki szuflad | `drawer.<source>.sides/back/bottom/construction-front`, niezależnie dla frontowych, wewnętrznych, zlewowych i dolnych podblatowych |

Źródła skrzynek to istniejące semantyczne `front_drawers`, `inner_drawers`, `sink_front_drawer`, `sink_inner_drawers`, `oven_drawer`, `under_counter_front_drawers`, `under_counter_inner_drawers`. Podwójne/manualne wymagania nie są automatycznie grupą szablonu. Stałe pojedyncze skrzynki zlewowe/piekarnikowe zachowują rozpoznane indywidualne role boków, tyłu, dna i frontu konstrukcyjnego.

Lewy/prawy bok, wieńce, plecy i pozostałe stałe role C2.1b.0 nie zostały zastąpione grupami. Nieznane układy frontów, niespójna liczba dla mieszanego szablonu oraz ręczne wymagania zachowują nierozstrzygnięte ilości w `sourceIssues`.

## Fronty wspólne zestawu

Właściciel ma `ownerType:'set'`, `setId` i NIE ma `cabinetId`. Przykładowy adres to `{ projectId, roomId, ownerType:'set', setId, groupRoleId:'front.C.panels' }`.

- Wizard edycji używa `cabinetModalState.setEditId` jako `set.id`; nie generuje nowego ID zestawu. Odtwarzane ID szafek i frontów nie są właścicielem wspólnych frontów. Test rzeczywistego wizarda kontroluje zachowanie set ID i powiązań nowych szafek/frontów.
- Szablony C/D mają `front.C.panels` / `front.D.panels`; liczba paneli 1/2 pozostaje ilością, a nie częścią adresu.
- Szablon A ma osobne `front.A.single`, `front.A.left`, `front.A.right`, bo boczne pola `w1`/`w2` są niezależnymi konstrukcjami. Nawet identyczne wymiary nie zlewają tych właścicieli.
- Przypisanie dotyczy tylko rozpoznanego rekordu zestawu. Cały multizbiór rzeczywiście używanych frontów musi odpowiadać szablonowi pod względem aktualnej geometrii i materiału. Sprawdzenie to walidacja pochodzenia, nie źródło identyfikatora. Role pochodzą z semantyki rekordu. Nie używamy losowych `front.id`, etykiet ani sortowania do nadawania tożsamości.
- Przy niespójnym, osieroconym lub nieznanym zestawie pozostaje issue z `setId`; nie wymyślamy właściciela szafki. Odłączony kontekst innego fizycznego projektu nie otrzymuje grup z aktualnego RAM.
- Dotychczasowy pierwszy korpus emituje fronty tylko raz dla kalkulacji. Zmiana kolejności może zmienić miejsce emisji, ale nie adres właściciela zestawu. Cache uwzględnia rekord zestawu, jego fronty, aktualnego emitującego korpusu i kontekst projektu. Bez tego mieszanka starego cache i nowego odczytu mogłaby dublować fronty.

Nie przebudowano wizarda ani zasad ilości frontów/zawiasów.

## Propagacja i bezpieczeństwo

Grupy przechodzą przez natywną cutlistę, MATERIAŁ, resolver kierunku, oba agregatory ROZRYSU, surową diagnostykę ROZRYSU, źródło WYCENY oraz cache cutlists.all/corpus/fronts. Odczyt cache wiąże lokalne role z aktualnym właścicielem. Nowa wersja cache usuwa użycie starego formatu metadanych; dane cache nadal są usuwane przez istniejące przygotowanie projektu do persistence.

Nie zmieniono wzorów powierzchni/PCV, cen, optymalizatora, historii ofert, UI, session, katalogów ani żadnego klucza storage. Czytniki nie uruchamiają begin i nie zapisują nowych danych. Nie wdrożono setterów grup ani migracji globalnych override'ów.

## Ograniczenia i najmniejszy następny krok

- C2.1b.2 może używać kompletnych rozpoznanych adresów grup do scoped operacji we właściwym pokoju/rekordzie. `qty` nie jest częścią klucza. Każdy zapis musi ponownie sprawdzić właściciela, rolę, kontekst, durable begin i confirmed central save. Nie może używać `sourceIssues` jako adresu ani wracać do globalnego store przy błędzie kontekstu.
- Nie wszystkie legacy/ręczne konfiguracje mają grupę. Ich niejednoznaczność ma pozostać widoczna do osobnej decyzji, bez migracji przy renderze.
- W C2.1b.1a naprawiono wcześniejszą rozbieżność generatorów standardowych frontów szuflad. Oba generatory korzystają z `drawerLayout` i wspólnej geometrii; stary licznik `details.drawers` nie wpływa na ilość. Mały front mieszanego layoutu ma wysokość `H_korpusu - 581`, dwie duże sztuki po 283 mm. Nie zmieniono identyfikatorów grup. Nieprawidłowy korpus jest walidowany, zamiast tworzyć pozorne wymiary lub pustą kalkulację.
- D1–D6 pozostają otwarte: stare globalne PCV/kierunki/wyjątki wciąż nie są danymi kanonicznego projektu. Ten etap nie dowodzi bezpieczeństwa istniejących globalnych setterów.
- Zaawansowane przekształcenie grupy w osobne elementy będzie wymagało jawnej operacji z trwałymi ID i mapowaniem wspólnych ustawień. Nie implementujemy tego teraz.

Rekomendacja: ograniczony C2.1b.2 dla zweryfikowanych adresów i clone-first confirmed write w gałęzi pokoju, ze wspólnym resolverem przed agregacją. Korekta standardowych frontów została wykonana w C2.1b.1a, bez zmian silnika rozkroju lub cen. Bez automatycznego importu legacy nadpisań.

## Weryfikacja

Nowy `tools/template-part-groups-smoke.js` obejmuje 21 scenariuszy rzeczywistych generatorów, źródeł i agregatorów. Dotychczasowy test pochodzenia zachowuje 18 scenariuszy stabilności i pełną kontrolę ilości, z uwzględnieniem nowego rodzaju źródła. Regresja rzeczywistego wizarda dodatkowo potwierdza zachowanie `set.id`.

Kontrolne wartości pozostają `1.64188 m²`, `8.22 m` PCV oraz wielopomieszczeniowe `4 / 3 / 6` arkuszy. Pełny preflight i bezpośrednie testy sesji, rollbacku, MATERIAŁU, ROZRYSU oraz kalkulacji są obowiązkową bramką przed commitem.

Końcowy wynik na Node 22.23.3:

- `template-part-groups-smoke`: **21/21 PASS**.
- `part-provenance-stability-smoke`: **18/18 PASS**.
- Pełny preflight: **PASS** — JS **513/513**, kolejność **315**, smoke **110/110**, APP **110/110**.
- Dependency **PASS** (JS domenowe 391, index 315, dev_tests 343); storage **PASS** (326 referencji, 40 plików).
- Bezpośrednie regresje: owner rollback **26/26**, durable begin **10/10**, cancel failure **10/10**, confirmed save **5/5**, odświeżanie DOM **17/17**; testy MATERIAŁU, ROZRYSU, szuflad, zestawów, cache i wielopomieszczeniowej kalkulacji **PASS**.
- `node --check` zmienionych/dodanych JS: **10/10 PASS**; `git diff --check`: **PASS**.
- Diagnostyka D1–D6: **6/6 otwartych defektów odtworzonych**, poza testami akceptacyjnymi/preflight.

Zmienione pliki: cztery moduły `js/app/cabinet/{part-provenance,cabinet-cutlist,front-hardware-fronts,cabinet-derived-facts}.js`; `index.html`, `dev_tests.html` (wersje assetów); nowy `tools/template-part-groups-smoke.js`; istniejące smoke `part-provenance-stability`, `cabinet-modal-safe-dirty`, `cabinet-derived-facts-cache`, `project-design-parts`, `project-recalculate` (nowy kontrakt ilości/metadanych, dodatkowe asercje lub wyłącznie wersja cache); trzy raporty `c2-1b-part-override-contract.md`, `c2-1b0-stable-part-provenance.md`, `c2-1b1-template-part-groups.md`.
