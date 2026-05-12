# Hardware supplier price create item v1 — 2026-05-12

## Baza

- Start: `site_hardware_import_bulk_diff_types_v1.zip`.
- Odrzucona paczka robocza `site_hardware_excel_row_date_autofill_v1.zip` nie była użyta jako baza.

## Zakres

1. Arkusz `Ceny_dostawcow` może utworzyć nowe okucie bez ręcznego `okucie_id`, jeżeli w wierszu ceny są podane:
   - istniejący producent,
   - `okucie_symbol`,
   - `okucie_nazwa`,
   - istniejący dostawca,
   - cena netto albo brutto.
2. Producent jest dopasowywany do istniejącego słownika bez rozróżniania wielkości liter, np. `blum` → `Blum`.
3. Import nie tworzy nowych producentów z literówek. Wiersz z producentem spoza słownika jest pomijany z ostrzeżeniem.
4. Dopasowanie istniejącej ceny nadal działa po `producent + symbol + dostawca`; nie wróciło wiązanie po numerze wiersza.
5. Brakująca data ceny przy nowej lub zmienionej cenie jest uzupełniana datą importu, żeby następny eksport XLSX miał już `data_ceny`.
6. Kolumna `producent` w arkuszu `Ceny_dostawcow` ma walidację z arkusza `Producenci`.
7. Podgląd importu pokazuje osobno liczbę okuć utworzonych z arkusza cen.

## Ograniczenia świadome

- Nowe okucie utworzone tylko z `Ceny_dostawcow` dostaje domyślnie `kategoria = Inne` i `jednostka = szt.`, jeżeli arkusz nie zawiera dodatkowych kolumn z kategorią/jednostką.
- Program nie tworzy nowych dostawców z arkusza cen; dostawca musi istnieć.
- Nie zmieniano snapshotów WYCENY ani automatyki wyboru najtańszego dostawcy.

## Testy

- Dodano smoke test: `Ceny dostawców mogą utworzyć nowe okucie bez ręcznego ID`.
