## 2026-06-03 — Wspólne akcje zawiasów dla szafki dwudrzwiowej v1

- Paczka: `site_hinge_requirements_pair_actions_v1.zip`.
- W skróconym panelu `Wymagania techniczne do wyceny` dla korpusu dwudrzwiowego zostają osobne akcje per strona: `Zmień` i `Przywróć domyślne` dla lewych oraz prawych drzwiczek.
- Pod obydwoma kolumnami dodano wspólne akcje: `Zmień oba` oraz `Przywróć domyślne dla obu`, żeby jednym wyborem ustawić ten sam komplet zawiasowy na lewą i prawą stronę albo zresetować oba override.
- Wspólna akcja nie zastępuje wyboru per strona. Asymetryczne wymagania nadal są możliwe, a układ `Lewe drzwiczki │ Prawe drzwiczki` pozostaje bez zmian.
- `Zmień oba` korzysta z tego samego kaskadowego wyboru wymagań technicznych: typ/nakładanie → kąt → prowadnik → hamulec/domyk. Nadal nie wybieramy producenta, modelu ani symbolu katalogowego w modalu szafki.
- Cache-busting: `20260603_hinge_requirements_pair_actions_v1`. Raport: `tools/reports/hinge-requirements-pair-actions-v1.md`.

## 2026-06-03 — Kaskadowy wybór wymagań zawiasów w panelu szafki

- Wymagania `komplet zawiasowy` w WYWIADZIE są nadal technicznym wejściem dla WYCENY, nie wyborem produktu.
- Wybór ręcznego override zawiasów ma być kaskadowy po cechach: typ/nakładanie → kąt → prowadnik → hamulec/domyk. To zabezpiecza przyszłe katalogi z większą liczbą wariantów, bez długiej listy produktów.
- Wariant katalogowy nie niesie ilości kompletów. Ilość wynika wyłącznie z geometrii i strony drzwiczek konkretnej szafki. Audyt i WYCENA mają pokazywać tę ilość z centralnego wymagania szafki.
- Dla dwóch drzwiczek override lewy/prawy musi pozostać osobny. Zmiana jednej strony nie może scalać wymagań do jednego bloku ani gubić układu lewe/prawe.
- Cache-busting: `20260603_hinge_requirements_cascade_keep_doors_v1`. Raport: `tools/reports/hinge-requirements-cascade-keep-doors-v1.md`.

## 2026-06-03 — Skrócony widok wymagań zawiasów w WYWIADZIE

- Widok wymagań zawiasów w modalu szafki ma być prosty: skrót + status `Domyślnie`/`Ręcznie` + przyciski `Zmień` i `Przywróć domyślne`.
- Pełna technika nie ma zaśmiecać prostej szafki na starcie. Szczegóły są dostępne dopiero po akcji `Zmień`.
- `Przywróć domyślne` usuwa override dla konkretnych drzwiczek i przywraca regułę centralną, bez ręcznego kasowania danych.
- WYCENA nadal ma korzystać z centralnego wymagania `komplet zawiasowy`; modal szafki nie wybiera producenta/modelu.
- Cache-busting: `20260603_hinge_requirements_cascade_keep_doors_v1`. Raport: `tools/reports/hinge-requirements-compact-actions-v1.md`.

## 2026-06-03 — Wymagania zawiasów z katalogu okuć v1

- Panel szafki ma budować listę wymagań zawiasów z katalogu okuć/akcesoriów i parametrów technicznych, nie z ręcznie wpisanej listy presetów.
- Deduplikacja odbywa się po cechach technicznych wymagania, dzięki czemu np. Blum i GTV o tych samych cechach dają jedną opcję techniczną `110° nakładany`.
- Wymaganie zawiasowe w danych szafki to `komplet zawiasowy`, czyli potrzeba techniczna zawias + prowadnik z cechami, a nie osobne luźne wpisy `zawias` i `prowadnik`.
- WYCENA ma później pokryć to wymaganie gotowym kompletem katalogowym albo składnikami, zachowując ostrzeżenia, jeśli czegoś nie da się dobrać.
- Cutlista nie powinna zaszywać producenta w źródłowym materiale okucia; dla zawiasów używać `Okucia: komplet zawiasowy`.
- Cache-busting: `20260603_hinge_requirements_cascade_keep_doors_v1`. Raport: `tools/reports/hinge-catalog-requirement-options-v1.md`.

## 2026-06-02 — Doprecyzowanie: wymaganie techniczne a pokrycie katalogowe okuć

- Wymaganie techniczne szafki nie jest tym samym co pozycja katalogowa. Szafka ma zapisywać potrzebę funkcjonalno-montażową, a WYCENA ma dopiero znaleźć sposób pokrycia tej potrzeby w katalogu.
- Dla drzwiczek właściwym wymaganiem jest `komplet zawiasowy`, nie dwa luźne wymagania `zawias` i `prowadnik`. `Komplet zawiasowy` zawiera cechy: typ/nakładanie, kąt otwarcia, wymagany prowadnik, hamulec i ilość kompletów na dane drzwiczki.
- Katalog może spełnić to wymaganie jedną pozycją typu komplet `zawias + prowadnik` albo kilkoma pozycjami składowymi, np. osobny zawias i osobny prowadnik. To jest decyzja resolvera WYCENY, a nie modala szafki.
- Strategia resolvera: najpierw szukać gotowego kompletu spełniającego wszystkie cechy, potem — jeśli komplet nie istnieje — próbować dobrać wymagane składniki osobno. Jeśli brakuje składnika, audyt ma pokazać brak pokrycia wymagania.
- Nie wolno łatać tego ogólnym tekstem typu `zawiasy Blum` albo `prowadnik standardowy` bez powiązania z wymaganiem technicznym.
- Ta sama zasada ma obowiązywać przyszłe okucia: prowadnice/szuflady, podnośniki, cargo, systemy narożne, profile LED, drążki i inne akcesoria. Wymaganie opisuje funkcję i cechy, katalog może ją pokrywać kompletem lub elementami.
- Lista wyboru wymagań w panelu szafki ma być budowana z danych systemu: słowników/kategorii okuć, katalogu i `technicalParams`, z deduplikacją po cechach. Nie dodawać hardcodowanych presetów jako źródła prawdy.

## 2026-06-02 — Wymagania zawiasów per drzwiczki w WYWIADZIE

- Panel `Wymagania techniczne do wyceny` w modalu szafki pokazuje i zapisuje wymagania zawiasów jako dane techniczne szafki, nie jako konkretny produkt katalogowy.
- Dla korpusu dwudrzwiowego wymagania lewych i prawych drzwiczek mogą być inne. WYCENA ma dobierać produkty po tych wymaganiach, a nie po ogólnym tekście typu `zawiasy Blum`.
- Zmiana typu zawiasu w panelu jest przygotowaniem pod przyszłe przeliczanie geometrii frontu dla zawiasów wpuszczanych/nakładanych.

# Rejestr wyliczeń oferty — ustalenia i zakres v1

Plik opisuje ustalenia dla etapu `site_quote_calculation_register_v1.zip`. Czytać przed dalszymi zmianami w WYCENIE, cennikach materiałów, robociznie i snapshotach ofert.

## Cel

WYCENA nie ma już liczyć kosztów „bokiem” i potem tylko pokazywać sum. Każda złotówka w podsumowaniu oferty ma mieć pozycję źródłową w centralnym rejestrze wyliczeń. Podsumowanie w WYCENIE ma wyświetlać sumy z tego rejestru, a kliknięcie zwykłej linijki podsumowania ma otwierać wewnętrzny modal audytu.

Szczegóły są tylko dla użytkownika programu. PDF dla klienta pozostaje prosty, bez pełnego rozbicia kosztów.

## Zasady cennika materiałów

Każda pozycja materiałowa w cenniku ma jawnie ustawioną jednostkę ceny:

- `arkusz` — płyty/laminaty i materiały arkuszowe liczone z ROZRYSU,
- `m²` — gotowe fronty lakierowane/akrylowe oraz HDF/plecy,
- `mb` — obrzeża,
- `szt.` — blaty i inne całe sztuki.

WYCENA nie zgaduje jednostki po samej nazwie, tylko bazuje na polu `priceUnit`. Fallback po nazwie/typie istnieje wyłącznie zabezpieczająco dla starych danych.

## Zasady liczenia materiałów

- Laminaty / płyta meblowa: liczba arkuszy z ROZRYSU × cena za arkusz.
- Korpus i front z tego samego realnego materiału mają trafić do wspólnego rozkroju, bo koszt może spaść przy wspólnym arkuszu.
- Front lakierowany / akrylowy: m² gotowego frontu × cena za m². Nie mnożyć przez dwie strony.
- HDF / plecy: m² × cena za m².
- Obrzeża: realne mb oklejanych krawędzi + 10% zapasu × cena za mb. W szczegółach ma być widać metry z elementów i metry po doliczeniu 10%.
- Blaty: całe sztuki, startowo jako blat 4,1 m.
- Procent odpadów z arkuszy zostaje odłożony na później — w v1 nie dodawać osobnego narzutu odpadów.

## Cena startowa

Ceny startowe nie są ukryte. Mają być normalnymi pozycjami w cennikach, widocznymi i edytowalnymi.

Etykieta `Cena startowa` ma być widoczna przy pozycji na liście cennika, a nie dopiero w środku formularza edycji.

Zasada:

- pozycja startowa ma `starterPrice: true` i brak `priceUserEditedAt`,
- po pierwszym ręcznym zapisie/edycji pozycja dostaje `starterPrice: false` oraz `priceUserEditedAt`,
- wtedy etykieta `Cena startowa` znika.

To oznacza, że program sprawdza, czy pozycja była choć raz ręcznie edytowana.

## Robocizna szafek

Robocizna szafek ma być pokazywana po numerach szafek z WYWIADU. Modal szczegółów ma pokazać każdą szafkę i czynności przy niej, np. skręcenie korpusu, półki, ręczne czynności, później montaż frontów, zawiasów, regulację, szuflady, podnośniki, cargo.

W v1 działa istniejące rozbicie robocizny po szafkach oraz szczegóły reguł, które już są w modelu robocizny. Automaty dla montażu frontów, zawiasów, regulacji, szuflad, podnośników i cargo jako pełne wykrywanie z konstrukcji szafki są do dopracowania w kolejnych etapach.

## Modal szczegółów WYCENY

Klikalne są zwykłe linijki podsumowania. Nie zmieniać ich wizualnie na przyciski ani akordeony.

Kliknięcie otwiera modal:

- `Materiały` — podział na arkusze/rozkrój, m²/gotowe fronty, HDF, obrzeża, sztuki/blaty.
- `Akcesoria` — okucia i akcesoria z ilością, jednostką, ceną i ostrzeżeniami.
- `Robocizna szafek` — grupowanie po szafkach.
- `Robocizna / stawki wyceny` — ręczne stawki/pozycje robocizny.
- `Montaż AGD` — urządzenia z zaznaczonym montażem.
- `Razem` — analiza oferty, ranking największych kosztów, procentowy podział i ostrzeżenia.

Przy pozycjach mają być ikony `?` z opisem algorytmu liczenia.

## Ostrzeżenia

Rejestr wyliczeń ma pokazywać ostrzeżenia, m.in.:

- brak ceny jednostkowej,
- suma działu 0 zł,
- cena startowa,
- brak pozycji w danym dziale,
- brak cennika obrzeża mimo wykrytych mb obrzeża.


## Doprecyzowanie po testach modala — 2026-06-01

- W modalach szczegółów działy mają działać jako akordeony aplikacyjne: otwarcie jednego zwija pozostałe, a środkowa część modala ma własny scroll. Treść nie może być ucinana przez stopkę z przyciskiem `Wróć`.
- Ostrzeżenia mają być przypisane do właściwego działu. Widok `Razem` może zbierać wszystkie ostrzeżenia, ale `Materiały`, `Akcesoria`, `Robocizna szafek`, `Robocizna / stawki wyceny` i `Montaż AGD` pokazują tylko swoje sprawy.
- Obrzeże startowe w cenniku materiałów: używać `Obrzeże PCV standard`. Nie dodawać osobnej pozycji ABS jako startowej, bo ABS traktujemy jako zamienny i niepotrzebny na tym etapie.
- Akcesoria muszą być rozpoznawane po wymaganiu technicznym, nie po ogólnym napisie. Dla pozycji z cutlist/formatki musi być przekazywane `hardwareRequirement`: grupa, kategoria, cechy techniczne, reguła źródłowa i ilość. WYCENA ma próbować dobrać konkretną pozycję katalogową z producenta/preferencji i cech. Jeżeli się nie da, ma pokazać wymaganie i ostrzeżenie zamiast udawać, że `zawiasy Blum` jest konkretnym produktem.
- Jeżeli dla jakiegoś rodzaju szafki/akcesorium brakuje `hardwareRequirement`, zapisać to jako regresję/odłożone zadanie i poprawiać całościowo dla wszystkich typów szafek, nie jednorazową łatą pod jeden przypadek.

## Doprecyzowanie PCV: jedna prawda MATERIAŁ → WYCENA — 2026-06-01

- Ilość obrzeża w WYCENIE musi pochodzić z tej samej logiki co `Okleiny — suma mb` w MATERIAŁ. WYCENA nie może liczyć PCV niezależnie z agregatu ROZRYSU.
- PCV / obrzeże jest właściwością realnego materiału formatki, nie typu elementu. Bok, półka, front, wieniec lub inna formatka może mieć PCV tylko wtedy, gdy jej materiał ma typ `laminat`.
- Dla lakieru, akrylu, HDF, blatów, okuć i innych materiałów nie-laminatowych checkboxy PCV w MATERIAŁ nie są dostępne, a stare zapisane krawędzie są ignorowane w obliczeniach.
- W audycie WYCENY linia obrzeża pokazuje: realne mb z elementów, zapas +10%, mb do wyceny, cenę za mb i koszt.
- Startowe obrzeże pozostaje tylko jako `Obrzeże PCV standard`. Nie dodawać ABS.


## Doprecyzowanie WYWIAD → WYCENA: wymagania techniczne widoczne przy szafce — 2026-06-02

- Modal dodawania/edycji szafki ma pokazywać sekcję `Wymagania techniczne do wyceny`, żeby użytkownik widział, jakie cechy techniczne dana szafka przekazuje później do WYCENY.
- Sekcja nie może pokazywać konkretnych produktów katalogowych ani producentów typu `Blum zawias nakładany`. Pokazuje wymagania: np. zawias, cecha/nakładanie, kąt otwarcia, prowadnik, hamulec, ilość i reguła źródłowa.
- Źródłem tej sekcji jest centralny helper `cabinet-hardware-requirements`. Modal nie ma tworzyć własnej logiki okuć; jest widokiem tej samej prawdy, z której później korzysta WYCENA.
- Jeżeli szafka nie wymaga zawiasów, panel ma pokazać jawny powód, np. szafka szufladowa, zmywarka, lodówka bez włączonych zawiasów meblowych.
- Dla kolejnego etapu prowadnice/szuflady mają zostać dodane do centralnych wymagań technicznych per szuflada. Domyślna długość prowadnicy ma wynikać z głębokości: szuflada frontowa `głębokość - 1 cm`, szuflada wewnętrzna `głębokość - 3 cm`. Ręczna zmiana może być mniejsza, ale nie większa niż dozwolony limit.


## Odłożone na później

Nie zrobione w v1 i nie zgubić przy kolejnych etapach:

1. Pełny automat robocizny frontów, zawiasów, regulacji, szuflad/prowadnic, podnośników i cargo wynikający bezpośrednio z konstrukcji szafki.
2. Osobny model blend, paneli i cokołów: materiałowo jak fronty/laminat, robocizna w osobnym dziale „Robocizna dodatkowa / elementy wykończeniowe”.
3. Procent odpadów arkuszowych i analiza wykorzystania arkusza.
4. Dokładniejszy model blatów, gdy pojawią się realne długości i docinki.
5. Szczegółowy PDF dla klienta jako opcjonalny tryb — nie domyślnie.
6. Lista zakupowa i zestawienia wykonawcze generowane z tego samego rejestru, po potwierdzeniu poprawności audytu.
7. Porządkowy refaktor `quote-snapshot-store.js` dopiero po stabilizacji rejestru.


## Doprecyzowanie po kontroli ilości — 2026-06-01

- Główny widok WYCENY nie może dublować szczegółów rejestru. Widoczne zostają metadane oferty, podsumowanie i historia; szczegóły materiałów/akcesoriów/robocizny są tylko w modalach audytu.
- Agregat ROZRYS przechowuje wymiary formatek w mm (`w/h`), natomiast zakładka MATERIAŁ liczy powierzchnie i okleiny ze źródłowych części w cm (`a/b`). Rejestr WYCENY musi konwertować mm na m²/mb poprawnie, żeby HDF, fronty i obrzeża nie były zawyżone ×100.
- Startowe obrzeże PCV ma zostać dopisane do istniejących cenników użytkownika, jeżeli nie ma żadnej pozycji obrzeża/mb. To jest normalna, widoczna pozycja startowa w cenniku, nie ukryty fallback.
