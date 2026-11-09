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
