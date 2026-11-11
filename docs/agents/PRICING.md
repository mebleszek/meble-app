# Kontrakt reguł WYCENY

Szczegóły obowiązujących zasad z [AGENTS.md](../../AGENTS.md); dokument jest jego częścią, nie osobnym źródłem zgód. Numeracja § odsyła do AGENTS.md. Czytaj tylko przy pracy objętej poniższym zakresem. Przeniesione procedury zachowują daty decyzji.

## 4. Logika biznesowa ma pierwszeństwo przed „ładniejszym kodem”

Meble-App odwzorowuje rzeczywistą pracę stolarni. Nie zgaduj reguł dotyczących m.in.:

- WYCENY,
- materiałów,
- robocizny,
- zawiasów,
- szuflad i prowadnic,
- okuć,
- transportu i wnoszenia,
- kosztów firmy,
- ofert i snapshotów.

Jeżeli reguła biznesowa nie wynika jednoznacznie z aktualnego kodu, testów lub dokumentacji, zatrzymaj się i zapytaj użytkownika zamiast przyjmować własne założenie.

### Jedno źródło reguł WYCENY — decyzja właściciela 08.11.2026

WYCENA, CZYNNOŚCI i HARMONOGRAM muszą korzystać ze wspólnego kalkulatora oraz aktualnych, jawnych reguł cennika. Kod ustala fakty i ilości; nie może potajemnie zastępować stawki, formuły, czasu startowego, progów, kroków, mnożnika, warunków ani zakresu naliczania własnym wyliczeniem. Wszystkie parametry wpływające na koszt lub normoczas muszą być widoczne i ustawiane we właściwym cenniku/ustawieniach, ze wskazanym źródłem, bez niezależnej ukrytej kopii wartości. Techniczne przeliczenia jednostek nie są osobnymi normami biznesowymi.

Gdy właściciel zmienia zasadę (np. wnoszenie według stawki montażowej dwóch osób), należy zmienić właściwą istniejącą definicję reguły w zatwierdzonym zakresie i zapewnić odczyt tej definicji przez kalkulator. Nie wolno zostawić w formularzu 80 zł/h, a naliczać w automacie 250 zł/h. Ustawienie pochodne, np. cena kilometra z paliwa, musi mieć jedno jawne powiązanie z regułą; samo nadpisanie lokalnej kopii definicji w WYCENIE nie zapewnia spójności interfejsu.

Każdą taką zmianę sprawdzaj od edycji reguły przez LOCAL-FIRST do ilości/czasu/kosztu, harmonogramu i zapisu nowej oferty. Sprawdź zero, warunki, mnożnik, zakres i brak podwójnego naliczania. Istniejące oferty pozostają zamrożone. Nie nadpisuj indywidualnych reguł w tle; potrzebną aktualizację istniejących danych przygotuj do osobnego, jawnego zatwierdzenia. Wykryte obecne odstępstwa podlegają diagnozie i decyzji właściciela — ta zasada nie upoważnia do hurtowej naprawy, migracji ani zmian UI.

### Automaty i dodatki — decyzja właściciela 11.11.2026

Standardowe prace wynikające z konstrukcji szafki, szuflad, frontów, okuć i AGD są naliczane automatycznie. Ręczne czynności, np. otwór Ø60 lub wycięcie na rury, są dodatkami i nigdy nie zastępują ani nie wyłączają automatów. Oba selektory korzystają ze wspólnej kwalifikacji według powiązania źródła ilości, zakresu i tożsamości operacji; samo `internalOnly` nie rozstrzyga, bo występuje także w dodatkach. Historyczne przypisania pozostają zapisane, ale nie przejmują automatu ani nie naliczają go drugi raz. Systemowa ochrona przed dublowaniem i konfliktami tej samej operacji pozostaje obowiązkowa.

Jawne `fixedPrice:0` oznacza zero w kalkulatorze, opisie i ręcznej pozycji. Potwierdzona ilość 0 oraz poprawnie niespełniony warunek nie są brakiem danych. Brak wymaganej ilości/warunku lub konflikt automatyki w wybranym zakresie blokuje utworzenie nowej zaniżonej wyceny; nie przelicza starych ofert. Zachowuj zatwierdzone zakresy naliczania i wybór usług. Transport nadal liczy istniejąca ścieżka oferty, nie każda szafka.

W materiale tryb ręcznej ceny ukrywa Narzut (%), a zakup + narzut go pokazuje. Przełączanie zachowuje wpisane wartości i zmienia podgląd bez zapisu katalogu ani nadpisywania ceny ręcznej. Cenę pochodną utrwala wyłącznie jawny Zapisz z istniejącym potwierdzeniem; 299 zł + 50% = 448,50 zł, różnica +149,50 zł. Decyzja nie dodaje norm/cen, migracji ani zgody na zmianę innych elementów UI.

Doprecyzowanie QA 11.11: sam zakres `room`, `quote` lub `day` nie czyni pozycji automatem. Ręczne dodatki mogą korzystać z tych zakresów; systemowa przerwa `labor_daily_break` pozostaje automatyczna dzięki zatwierdzonej definicji. Dla trybów `fixed` i `advanced` formularz pokazuje faktyczną kwotę stałą (`fixedPrice`, jeśli podana), a świadomy zapis ujednolica ją z edytowaną ceną; zero da się zachować i później zmienić.

### Tryb AUTOMAT / RĘCZNA — decyzja właściciela 11.11.2026

W formularzu CZYNNOŚCI tryb jest jawny i niezależny od `billingScope`. Nowe własne czynności są domyślnie ręczne. Przełączenie na automat wymaga aktywnego, liczbowego źródła ilości obsługiwanego przez silnik szafki; bez niego zapis jest blokowany. Źródła transportu i wnoszenia korzystają z osobnych istniejących automatów i nie są dozwolone dla własnego automatu ogólnego. Ręczna czynność nie nalicza się automatycznie, nawet gdy jej rekord zawiera starsze źródło ilości.

Zatwierdzone automaty fabryczne rozpoznaje się wyłącznie przez kanoniczny identyfikator i zatwierdzoną fabryczną definicję, a nie przez nazwę, etykietę ani zmienialne parametry. Formularz pokazuje `AUTOMAT FABRYCZNY` w nieedytowalnym wyborze; użytkownik może modyfikować cenę, formułę, czas i pozostałe parametry, ale nie przełączyć trybu na ręczny. Fabryczne ręczne dodatki pozostają ręczne. Automat fabryczny nie może utracić wymaganego źródła ilości przy zmianie sposobu naliczania.

Katalog przechowuje opcjonalne `automationMode:'manual'|'automatic'` dla zapisanych definicji. Brak pola we wcześniejszej definicji własnej zachowuje dotychczasowe rozpoznawanie przez źródło ilości wyłącznie dla zgodności; przy otwarciu i zapisie formularza tryb staje się jawny. Fabryczne dane źródłowe pozostają bez dopisywania pola do rekordów domyślnych. Kontrakt 14 domen akceptuje nowe pole, bez uruchamiania synchronizacji i bez migracji istniejących danych.
