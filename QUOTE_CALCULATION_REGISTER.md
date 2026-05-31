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

## Odłożone na później

Nie zrobione w v1 i nie zgubić przy kolejnych etapach:

1. Pełny automat robocizny frontów, zawiasów, regulacji, szuflad/prowadnic, podnośników i cargo wynikający bezpośrednio z konstrukcji szafki.
2. Osobny model blend, paneli i cokołów: materiałowo jak fronty/laminat, robocizna w osobnym dziale „Robocizna dodatkowa / elementy wykończeniowe”.
3. Procent odpadów arkuszowych i analiza wykorzystania arkusza.
4. Dokładniejszy model blatów, gdy pojawią się realne długości i docinki.
5. Szczegółowy PDF dla klienta jako opcjonalny tryb — nie domyślnie.
6. Lista zakupowa i zestawienia wykonawcze generowane z tego samego rejestru, po potwierdzeniu poprawności audytu.
7. Porządkowy refaktor `quote-snapshot-store.js` dopiero po stabilizacji rejestru.
