## 2026-06-16 — WYCENA: Projekt i przygotowanie jako osobny dział v1

- W WYCENIE dodano osobny dział `Projekt i przygotowanie` z własnym totalem `project` w rejestrze wyliczeń, snapshotach, podsumowaniu i modalu szczegółów.
- Pozycje `Projekt techniczny — formatki` oraz `Projekt techniczny — nietypowa szafka` są zbierane przez osobny strumień `collectProjectPreparationLines`, a nie przez zwykłą `Robociznę szafek`.
- Klasyfikacja działa po roli/kategorii pozycji projektu (`project-design-*`, kategoria `Projekt`, źródła `cabinet.part_count` i `cabinet.unusual_project_count`), bez dublowania matematyki.
- Matematyka została bez zmian: formatki dalej liczą `1 min × stawka specjalistyczna × cabinet.part_count`, a nietypowy projekt dalej liczy `15 min + gabarytoczas 1 h/m³` po `cabinet.unusual_project_count`.
- Stare projekty po `Przelicz projekt` mają pokazywać pozycje projektu w nowej sekcji, a suma końcowa nadal zawiera te koszty.
- Nie ruszano transportu, wnoszenia, ORS, PCV, PDF, szuflad, cargo, klap ani skręcania korpusów.

Cache-busting: `20260616_project_preparation_section_v1`.

## 2026-06-15 — projekt techniczny z formatek v1

- W MATERIALE przy każdej szafce dodano podsumowanie `Formatki: X szt.` liczone z pozycji materiałowych szafki, razem z frontami i HDF/plecami.
- W modalu szafki dodano ptaszek `Nietypowy projekt`.
- Dodano źródła do cennika robocizny:
  - `cabinet.part_count` — ilość formatek szafki,
  - `cabinet.unusual_project_count` — 1, gdy szafka ma zaznaczony nietypowy projekt.
- Dodano opcję czasu `1 min` do wyboru czasu bazowego, czasu startowego i czasu za krok.
- Dodano startowe pozycje w cenniku:
  - `Projekt techniczny — formatki`: 1 min × stawka specjalistyczna × ilość formatek,
  - `Projekt techniczny — nietypowa szafka`: 15 min + gabarytoczas 1 h/m³ dla szafki z ptaszkiem.
- Podbito wersję `derivedFacts`, żeby stare cache bez nowych faktów nie były używane jako aktualne.

Cache-busting: `20260616_project_preparation_section_v1`.

## 2026-06-15 — wysokość korpusu bez nóg + nowe skręcanie v1

- Dla stojących szafek formatki korpusu liczą teraz wysokość korpusu bez nóżek/cokołu: `body_height = height - legHeight`.
- W modalu stojącej szafki dodano pole `Wys. nóżek / cokołu`; domyślnie bierze wartość z ustawień pomieszczenia, a w konkretnej szafce zapisuje się tylko indywidualne nadpisanie.
- Dodano źródła robocizny: `cabinet.body_height_mm` i `cabinet.body_volume_m3`.
- Cennik startowy skręcania korpusów został zastąpiony nowym czystym zestawem: progi 90/150/210/230/powyżej 230 cm po `body_height` oraz dopłaty za szerokość.
- Stare startowe pozycje skręcania oparte o pełne `cabinet.height_mm` są usuwane przez migrację/deduplikację cennika, a nie zostawiane jako wyłączone śmieci.

Cache-busting: `20260616_project_preparation_section_v1`.

## 2026-06-14 — CZYNNOŚCI: Inne czynności + czas dojazdu v1

- W zakładce CZYNNOŚCI pod `Czynności dodane ręcznie` dodano akordeon `Inne czynności`.
- Do `Inne czynności` trafiają ogólne czynności mebli niezwiązane z konkretną szafką. Na tym etapie automatycznie trafia tam `Czas dojazdu` z Inwestora.
- W CZYNNOŚCIACH dla transportu pokazywany jest czas dojazdu, bez kilometrów.
- W WYCENIE dodano osobną pozycję transportową `Czas dojazdu`, liczoną z czasu dojazdu przy inwestorze i stawki montażowej.
- Kilometry transportu zostają w osobnej pozycji `Transport do klienta`.

Cache-busting: `20260616_project_preparation_section_v1`.

## 2026-06-14 — WYCENA: wnoszenie jako osobny dział v1

- Wnoszenie/logistyka mebli zostały wyjęte z działu `Robocizna szafek` w WYCENIE.
- Automaty `labor_carrying_cabinet`, `labor_carrying_disassembly` oraz wnoszenie wysokich frontów dalej korzystają z tych samych cenników i stawek, ale ich wynik trafia do osobnego działu `Wnoszenie mebli`.
- `quoteCalculationRegister`, snapshot, podsumowanie WYCENY i modal szczegółów mają osobny total `carrying`.
- Nie usuwano żadnych trybów robocizny ani stawek; zmiana dotyczy klasyfikacji wyniku w WYCENIE.

Cache-busting: `20260616_project_preparation_section_v1`.


## 2026-06-09 — Źródła ilości robocizny w rejestrze v1

- Paczka: `site_labor_quantity_values_link_v1.zip`.
- Linie robocizny szafek w `quoteCalculationRegister` zachowują teraz metadane `quantitySource`, `quantitySourceLabel`, `quantitySourceValue` i `quantitySourceDisplay`.
- Nota/audyt linii robocizny pokazuje, z którego źródła pochodzi ilość, np. `Liczba zawiasów (hinge.count) = 4 szt.`.
- Rejestr zapisuje wynik użyty w ofercie jako snapshot kalkulacji, ale nie tworzy drugiej prawdy w aktualnych danych szafki.
- Źródła są odczytywane przez `FC.workQuantityFacts` podczas generowania WYCENY.

## 2026-06-06 — Rejestr jako kotwica nowych sum WYCENY v1

- Paczka: `site_quote_single_truth_pre_labor_tests_v1.zip`.
- `quoteCalculationRegister` jest traktowany jako główne źródło nowych sum WYCENY: materiały, akcesoria, robocizna szafek, robocizna/stawki, montaż AGD, rabat, suma przed rabatem i razem.
- `quoteSnapshot.buildSnapshot()` ma brać `totals` z `calculationRegister`, jeżeli rejestr jest dostępny. Fallbacki zostają tylko dla starszych snapshotów.
- Audyt WYCENY ma preferować `snapshot.calculationRegister`, żeby historia/oferty i szczegóły korzystały z tego samego wyniku.
- Dodano regresję `tools/quote-single-truth-pre-labor-smoke.js`, która pilnuje tej ścieżki przed podpięciem właściwego liczenia robocizny.

## 2026-06-04 — Zawias + prowadnik jako komplet lub składane części v1

- Paczka: `site_hinge_driver_components_v1.zip`.
- Dodano kategorię okuć `Prowadniki` oraz jawne parametry techniczne do parowania bez osobnej tabeli zgodności: `rola_kompletu`, `system_kompatybilnosci`, `typ_prowadnika`, `forma_prowadnika`, `pokrycie_prowadnika`.
- `Osobno` nie jest już typem prowadnika; jest sposobem pokrycia prowadnika (`w komplecie` / `osobno` / `bez prowadnika`). Typ prowadnika i forma prowadnika są osobnymi cechami technicznymi.
- `Zerowy uskok` pozostaje cechą zawiasu / klasy zawiasu, nie cechą prowadnika.
- WYCENA może pokryć `Komplet zawiasowy` gotowym kompletem z katalogu albo, gdy wybrany zawias wymaga prowadnika osobno, dobrać osobny prowadnik po tym samym producencie, systemie kompatybilności, typie i formie prowadnika. Nie dodano słownika zgodności — parowanie jest jawne po parametrach.
- W formularzu okucia brakujące obowiązkowe dane techniczne są oznaczane bezpośrednio przy polach: czerwona obwódka/tło i opis `Wymagane do wyceny`.
- Pola boolean, np. hamulec i sprężyna, rozróżniają `Nie ustawiono`, `Tak` i `Nie`; puste pole nie jest już traktowane jak `nie`.
- Dodano test `tools/hinge-driver-components-smoke.js` i rozszerzono testy kompletności danych technicznych.
- Cache-busting: `20260604_hinge_driver_components_v1`. Raport: `tools/reports/hinge-driver-components-v1.md`.

## 2026-06-04 — Zawias 107° jako zamiennik 110° + filtr danych technicznych v1

- Paczka: `site_hinge_107_tech_todo_filter_v1.zip`.
- Naprawiono dobór zawiasów w WYCENIE: `catalogOptionSourceItemIds` i bezpośrednie źródła opcji nie mogą blokować preferowanego producenta. Jeżeli preferencja w WYWIADZIE wskazuje np. GTV, a GTV ma zawias 107° z klasą `standardowy 90–120°` i tymi samymi cechami (`nakładany`, `prowadnik`, `hamulec`, `sprężyna`), WYCENA może dobrać GTV zamiast Bluma 110°.
- Opcje katalogowe zawiasów kanonicznych są grupowane po funkcji/klasie, a nie po samym kącie rzeczywistym. Kąt rzeczywisty jest rankingiem w obrębie tej samej klasy, nie blokadą zamiennika.
- Dodano centralny status kompletności danych technicznych `evaluateItemTechnicalStatus`. Pozycja z brakującymi wymaganymi parametrami technicznymi jest oznaczana jako `Do uzupełnienia tech.` i nie bierze udziału w automatycznym doborze WYCENY ani w podglądzie zamienników jako poprawny kandydat.
- W katalogu `Okucia i akcesoria` dodano jeden szybki filtr `Do uzupełnienia tech.` obejmujący zarówno brak danych, jak i dane niepełne.
- Na karcie okucia dodano czerwony chip `Do uzupełnienia tech.` dla pozycji problemowych. W modalu edycji, w sekcji `Dane techniczne`, program pokazuje listę brakujących parametrów do automatycznej wyceny.
- Dodano test `tools/hardware-technical-completeness-smoke.js` oraz rozbudowano test WYCENY, żeby pilnować przypadku GTV 107° vs Blum 110° i blokowania pozycji z niepełnymi danymi.
- Cache-busting: `20260604_hinge_107_tech_todo_filter_v1`. Raport: `tools/reports/hinge-107-tech-todo-filter-v1.md`.

## 2026-06-03 — Zawiasy: kąt rzeczywisty i klasa zamienności kąta v1

- Paczka: `site_hinge_angle_class_resolver_v1.zip`.
- Rozdzielono w danych technicznych zawiasów dwa znaczenia kąta: `kat_rzeczywisty` jako nominalny/rzeczywisty kąt konkretnego produktu oraz `klasa_kata` jako słownikowa klasa zamienności, np. `standardowy 90–120°`, `zerowy uskok 155°`, `narożny 170°`, `równoległy wpuszczany 95°`, `lodówkowy 95°`.
- Stare pole `kat_otwarcia` jest traktowane jako legacy/źródło migracyjne. Nie powinno być głównym polem edycji dla zawiasów; przy odczycie program przenosi jego wartość do `kat_rzeczywisty` i wylicza `klasa_kata`, jeśli jej brakuje.
- Dobór WYCENY porównuje cechy zawiasów łącznie: nałożenie, klasę zamienności kąta, prowadnik, hamulec/domyk, sprężynę i inne kluczowe parametry. Kąt rzeczywisty służy do rankingu: najpierw dokładny, potem najbliższy w tej samej klasie.
- Zawias 107° z klasą `standardowy 90–120°` może spełnić wymaganie zwykłego 110° przy tym samym nałożeniu/prowadniku/hamulcu. Zawias 170° narożny nie może spełnić wymagania 110°, bo ma inną klasę funkcjonalną.
- W technicznych definicjach zawiasów `Prowadnik / montaż` jest cechą kluczową i ma być porównywany, a nie ignorowany.
- Dodano/rozbudowano test `tools/wycena-hinge-requirement-override-smoke.js`: pilnuje, że GTV 107° w klasie 90–120° może zastąpić wymagane 110°, a 170° narożny nie jest dobierany jako zwykły zawias.
- Cache-busting: `20260603_hinge_angle_class_resolver_v1`. Raport: `tools/reports/hinge-angle-class-resolver-v1.md`.

## 2026-06-03 — WYCENA: ścisły dobór wariantu zawiasu po wymaganiu v1

- Paczka: `site_wycena_hinge_strict_resolver_v1.zip`.
- Naprawiono dobór konkretnego okucia w WYCENIE dla wymagań zawiasów bez `catalogOptionSourceItemIds` albo ze starszych danych. Wymaganie `110° nakładany` nie może dobrać zawiasu `170° narożny` tylko dlatego, że ogólny parametr kąta został potraktowany jako „minimum taki sam albo większy”.
- Resolver WYCENY dla `hardwareGroup: hinges` najpierw sprawdza kanoniczny typ techniczny kandydata: `110° nakładany`, `110° wpuszczany`, `155° zerowy uskok`, `170° narożny`, `równoległy wpuszczany`, `lodówkowy nakładany`. Jeżeli wymaganie jest kanoniczne, kandydat innego typu jest odrzucany.
- Zachowano wcześniejszą zasadę: aktualne wymagania zawiasów idą do WYCENY z centralnego helpera `cabinet-hardware-requirements`, a nie z opisowej kopii cutlisty.
- Rozbudowano test `tools/wycena-hinge-requirement-override-smoke.js`: legacy wymaganie `Zawias 110° nakładany` bez source IDs musi dobrać `71B3550+173L6100`, a nie `71T6550+174E6100`.
- Cache-busting: `20260603_wycena_hinge_strict_resolver_v1`. Raport: `tools/reports/wycena-hinge-strict-resolver-v1.md`.

## 2026-06-03 — WYCENA bierze ręczne wymagania zawiasów z jednej prawdy v1

- Paczka: `site_wycena_hinge_override_source_v1.zip`.
- Naprawiono ścieżkę `WYWIAD → wymagania zawiasów → WYCENA`: ręczne nadpisanie wymagań kompletu zawiasowego w modalu szafki musi zmieniać pozycję dobraną w WYCENIE i wynik finansowy, jeśli wybrany wariant ma inną cenę.
- `WYCENA` zbiera wymagania zawiasów bezpośrednio z centralnego helpera `cabinet-hardware-requirements`, a nie z opisowej/starej kopii w cutliście. Cutlista nadal może pokazywać okucia w MATERIAŁ/ROZRYS, ale dla zawiasów WYCENA ma źródło w wymaganiu technicznym szafki.
- Resolver WYCENY najpierw korzysta z `catalogOptionSourceItemIds` zapisanych przy wymaganiu z katalogu/słowników okuć. Dzięki temu wariant wybrany w panelu, np. równoległy wpuszczany albo lodówkowy, wskazuje konkretną pozycję katalogową wspierającą ten wariant, z preferencją producenta z WYWIADU.
- Różne wymagania lewych i prawych drzwiczek generują osobne linie akcesoriów w WYCENIE, z osobnymi cenami i ilościami. Nie wolno zlewać ich z powrotem do domyślnego `110° nakładany`.
- Dodano test `tools/wycena-hinge-requirement-override-smoke.js`, który symuluje stary/stale cutlist i sprawdza, że WYCENA nadal bierze aktualny override z centralnej logiki szafki.
- Cache-busting: `20260603_wycena_hinge_override_source_v1`. Raport: `tools/reports/wycena-hinge-override-source-v1.md`.

## 2026-06-03 — Wspólne przyciski zawiasów jeden pod drugim v1

- Paczka: `site_hinge_requirements_pair_buttons_stacked_v1.zip`.
- W panelu `Wymagania techniczne do wyceny` dla korpusu dwudrzwiowego wspólne akcje pod kolumnami `Lewe drzwiczki │ Prawe drzwiczki` mają teraz pełną szerokość i są ułożone jedna pod drugą: `Zmień oba`, a pod nim `Przywróć domyślne dla obu`.
- Osobne przyciski per strona (`Zmień`, `Przywróć domyślne`) zostają bez zmian, żeby nadal można było ustawić inne wymagania dla lewych i prawych drzwiczek.
- Zmiana dotyczy tylko układu UI przycisków wspólnych; nie zmieniono logiki wymagań zawiasów, kaskadowego wyboru, katalogu okuć ani danych override.
- Cache-busting: `20260603_hinge_requirements_pair_buttons_stacked_v1`. Raport: `tools/reports/hinge-requirements-pair-buttons-stacked-v1.md`.

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

## 2026-06-09 — Robocizna: quantitySource + conditions

Robocizna szafek w WYCENIE używa modelu:

- `quantitySource` — nazwane źródło ilości, np. `cabinet.count`, `front.count`, `hinge.count`, `shelf.count`, `drawer.count`.
- `conditions` — warunki zastosowania reguły, aktualnie numeryczne zakresy `range`, np. wysokość korpusu:

```json
{
  "source": "cabinet.height_mm",
  "operator": "range",
  "min": 721,
  "max": 1500
}
```

Brak `conditions` oznacza regułę ogólną. Jeżeli `conditions` istnieją, wszystkie muszą być spełnione (`AND`). Warunek nie może być po cichu pominięty: jeżeli WYCENA nie potrafi odczytać wartości źródła warunku, reguła nie jest liczona.

Rejestr wyliczeń dla robocizny zachowuje:

- `quantitySource`, `quantitySourceLabel`, `quantitySourceValue`, `quantitySourceDisplay`,
- `conditions`,
- `matchedConditions`,
- `skippedReason` dla diagnostyki pominiętych reguł, jeżeli informacja trafi do linii audytu.

Stare `autoRole` nie jest aktywnym modelem rejestru i nie jest używane do automatycznego odtwarzania nowych reguł. Nowe obliczenia mają wynikać wyłącznie z jawnego `quantitySource` oraz jawnych `conditions`.

## 2026-06-09 — UI warunków robocizny jako kaskada

Model danych `conditions[]` pozostaje czysty: każdy zapisany warunek ma `source`, `operator: "range"`, `min` i `max`. Zmieniono wyłącznie sposób edycji w UI:

- użytkownik nie klika `Dodaj warunek`,
- formularz pokazuje pierwszy pusty wybór warunku od razu,
- wybranie warunku odsłania `Minimum / od` i `Maksimum / do`,
- wybranie jednego warunku automatycznie tworzy kolejny pusty wybór,
- puste końcowe pole wyboru nie trafia do rejestru ani do katalogu,
- wybrany warunek bez żadnej granicy zakresu jest blokowany przy zapisie.

Rejestr wyceny nadal zapisuje wyłącznie realnie zapisane i spełnione warunki. Pusta pozycja końcowa w formularzu jest tylko elementem UI i nie jest stanem domenowym.
