# C2.1b.0 — stabilne role i pochodzenie formatek

Status: addytywny fundament w RAM, z jawnie zatrzymaną częścią wymagającą trwałych slotów. Nie jest to wdrożenie własności nadpisań PCV/słojów ani naprawa D1–D6.

Uwaga historyczna: decyzja C2.1b.1 / Issue #32 zastępuje rekomendację indywidualnych slotów dla grup standardowych szablonów. Aktualny model grup, stabilny właściciel frontów zestawu i pozostające ograniczenia opisuje [raport C2.1b.1](c2-1b1-template-part-groups.md). Poniższy opis pozostaje zapisem zakresu etapu C2.1b.0.

Baza: `ab2d9718514cad0639d6efebdad6e2e66720b0cc` (main po C2.1a).

## Model danych generowanych

`FC.partProvenance` oddziela adres źródłowy od istniejących podpisów produkcyjnych. Generator zachowuje dotychczasowe wiersze, geometrię i `qty`. Dodaje:

- `partRoleIds`: lokalne role konstrukcyjne przed agregacją wielu szafek;
- `sourceRefs`: osobne adresy `{ projectId, roomId, cabinetId, partRoleId }` każdej rozpoznanej sztuki;
- `sourceIssues`: nierozstrzygnięte grupy z kontekstem właściciela, rodziną, `qty` i powodem braku stabilnej tożsamości.

Przykład: wiersz `Bok`, `qty:2` ma role `body.side.left` i `body.side.right` oraz dwa odrębne adresy. Identyczny bok drugiej szafki lub pokoju ma inny adres. Agregacja identycznych boków nadal sumuje ilość, ale konkatenacja `sourceRefs` zachowuje wszystkich właścicieli. Nie nadajemy adresu pojedynczej sztuki przez numer pozycji w cutliście lub agregacie.

Adresy nie zawierają wymiarów, materiału, nazwy wyświetlanej, kierunku ani podpisu rozkroju. Zmiana geometrii nie zmienia istniejącej roli. Zmiana topologii może usunąć rolę lub utworzyć inną; nie przenosi tożsamości przez podobieństwo nazwy.

Pełne adresy powstają tylko przy kompletnym kontekście i unikalnych rolach odpowiadających ilości. Brak pewnego kontekstu daje `sourceIssues`, nigdy adres domyślnie przypisany do poprzedniego projektu.

## Obsługiwane role

| Element | Role |
|---|---|
| Para boków korpusu | `body.side.left`, `body.side.right` |
| Wieńce i plecy | `body.top`, `body.bottom`, `body.back` |
| Stała para trawersów | `body.top-traverse.a`, `body.top-traverse.b` |
| Korpus narożny | `body.corner.gl-side`, `body.corner.gp-side`, `body.corner.blind-side` |
| Zaślepka i blenda | `body.blind-panel`, `body.blend` |
| Jedno/dwoje drzwi lub klap | `front.door.single/left/right`, `front.flap.single/left/right` |
| Zmywarka, piekarnik | `front.dishwasher`, `front.oven.cover` |
| Lodówka | `front.fridge.single/lower/upper` |
| Front narożny | `front.corner.gl-gp`, `front.corner.st-sp` |
| Stały front szuflady nad drzwiami | `front.drawer.main` |
| Jedna skrzynka ze źródła `sink_front_drawer` lub `oven_drawer` | `drawer.<source>.side.left/right/back/bottom/construction-front`, jeśli dany komponent występuje |

Stałe pary wynikają z konstrukcyjnej roli, a nie kolejności zmiennej listy. Przykładowo usunięcie dolnego panelu lodówki nie nadaje jego adresu górnemu panelowi.

## Kontekst i propagacja

`getCabinetCutList(cabinet, roomId, { projectId })` ma opcjonalny trzeci argument. Czytelnik odłączonej kopii projektu powinien przekazać jawny identyfikator właściwego rekordu. To jest kontekst dostarczany przez caller, nie nowy zapisany identyfikator projektu.

Bez tego argumentu adres jest rozwiązywany tylko dla szafki faktycznie należącej do bieżącego `window.projectData`, z istniejącym rekordem centralnym i kontrolą zgodności inwestora/aktywnej sesji. Nie przypisujemy odłączonej szafki do aktywnego wskaźnika. Obiekt pokoju zamiast jego ID wymaga jawnego `roomId` w kontekście.

Metadane przechodzą przez natywny generator korpusu/frontów, odczyt MATERIAŁU, resolver kierunku, oba agregatory ROZRYSU, jego surową diagnostykę i istniejące źródło WYCENY. Klucze grupowania, ilości, algorytm układania i wzory cen pozostają bez zmian. Nie wprowadzono nowego UI.

Generator frontów wcześniej korygował liczniki szafki podczas odczytu. Publiczny odczyt teraz liczy na lokalnej kopii szafki i `details`; wewnętrzne korekty nadal działają na tej kopii. Nie zapisuje danych źródłowych.

`derivedFacts` pozostaje odtwarzalnym cache RAM. Podniesienie jego wersji wymusza odbudowę starych wpisów bez metadanych. Odczyt cache ponownie wiąże role z aktualnym właścicielem, także po skopiowaniu szafki/cache między projektami. Istniejące przygotowanie projektu do zapisu nadal usuwa `derivedFacts`; nie powstaje druga trwała cutlista. Trzy smoke testy otrzymały wyłącznie nowe oczekiwania wersji cache/URL, z zachowaniem pozostałych asercji.

## Część zatrzymana: powtarzalne sloty i zestawy

Poniższe elementy NIE mają gwarantowanej indywidualnej tożsamości w C2.1b.0:

- półki określone wyłącznie liczbą;
- fronty wielu szuflad oraz anonimowe grupy skrzynek;
- zmienne grupy drzwi/klap większe niż stała para;
- współdzielone fronty zestawów przypisane przez obecną logikę do pierwszej szafki zestawu.

Są nadal obliczane z poprawnym `qty`, ale emitują nierozstrzygnięte `sourceIssues`. Testy sprawdzają ten brak gwarancji; nie deklarują stabilności slotów przez samą obecność pola.

Istniejące `front.id` nie wystarczają: regeneracja frontów potrafi je zastąpić. Wizard zestawu może odtworzyć szafki z nowymi ID. Przypisanie frontów zestawu do pierwszego elementu tablicy nie jest stabilnym właścicielem. Nie dodano losowych ID przy renderze ani pozornego rozwiązania typu `shelf.0`, `drawer.1`.

Najmniejszy następny etap do zatwierdzenia:

1. Uzgodnić addytywne listy trwałych slotów w konfiguracji szafki w kanonicznym projekcie, dla półek/frontów/skrzynek. ID tworzyć tylko w potwierdzonej operacji edycji z durable begin, nigdy w getterze.
2. Operacje dodania/usunięcia mają wskazywać konkretny slot. Zmiana wymiarów zachowuje sloty; usunięcie nie renumeruje pozostałych. Sama liczba nie mówi, którą półkę usunięto, dlatego wymaga jawnej polityki zmiany liczby.
3. Kopia otrzymuje nowy `cabinetId`; konfiguracja powtarzalnych slotów musi mieć uzgodnioną politykę kopiowania bez aliasów i bez automatycznego kopiowania nadpisań.
4. Dla zestawów ustalić stabilne mapowanie frontu do właściciela szafki/roli i zachowanie ID przy przebudowie, zamiast wyboru właściciela przez kolejność tablicy.
5. Dopiero potem dopuścić scoped write nadpisań dla takich adresów. `sourceIssues` nie może być kluczem indywidualnego override'u.

Nie wykonano tej przebudowy w C2.1b.0. Nie dodano schematu slotów, migracji ani zapisów podczas odczytu.

## Weryfikacja i granice

Nowy `tools/part-provenance-stability-smoke.js` wykonuje 18 scenariuszy na rzeczywistych generatorach/resolverach/agregatorach. Sprawdza stabilność przy zmianie wymiarów, sortowaniu, zmianie właściciela, usunięciu panelu i odczycie skopiowanego cache, a także izolację zwracanych metadanych. Kontroluje zachowanie ilości, powierzchnię `1.64188 m²`, PCV `8.22 m`, brak zapisów i brak mutacji źródłowej szafki. Zwykły test wielopomieszczeniowy z włączonym helperem nadal sprawdza rzeczywiste wyniki `4 / 3 / 6` arkuszy i WYCENĘ dla właściwego zakresu.

Końcowa weryfikacja na Node 22.23.3:

- Nowy smoke: **18/18 PASS**.
- Pełny preflight: **PASS**, JavaScript **512/512**, kolejność **315**, smoke **109/109**, APP **110/110**.
- Audyt zależności: **PASS**, JS domenowe **391**, index **315**, dev_tests **343**.
- Audyt storage: **PASS**, referencje **326**, pliki **40**.
- Bezpośrednie regresje sesji/rollbacku, frontów, szuflad, MATERIAŁU i ROZRYSU oraz test wielopomieszczeniowy: **PASS**.
- `node --check` wszystkich zmienionych/dodanych plików JS: **15/15 PASS**; `git diff --check`: **PASS**.

Pierwszy preflight wykazał trzy nieaktualne oczekiwania wersji cache w testach. Po dostosowaniu tylko numerów wersji, bez osłabiania asercji, końcowy pełny przebieg przechodzi wszystkie kontrole.

Nie zmieniono semantyki Zapisz/Anuluj, globalnych katalogów/cenników, historii ofert, starych kluczy formatek ani ich odczytu/zapisu. D1–D6 nadal reprodukują się w oddzielnej diagnostyce; nie są oznaczone jako zaliczone testy bezpieczeństwa. Ten etap daje pochodzenie rozpoznanym częściom, ale sam nie izoluje istniejących globalnych nadpisań.

Przyszłe C2.1b.1 powinno rozwiązywać nadpisania indywidualnych części przed agregacją i odrzucać niepełne adresy. Ten raport nie stanowi zgody na implementację kolejnego etapu.
