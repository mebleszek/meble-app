# Hardware Excel row/date autofill v1 — 2026-05-12

## Baza

- Start: `site_hardware_import_bulk_diff_types_v1.zip`.
- Zakres: katalog okuć, XLSX `Ceny_dostawcow`, import/export i testy ochronne.

## Co zmieniono

1. Import ceny dostawcy potrafi dopasować wiersz `Ceny_dostawcow` do wiersza `Okucia` po tym samym numerze wiersza, jeżeli w cenie nie ma ręcznie wpisanych danych okucia ani `okucie_id`.
2. Dzięki temu przy dodawaniu nowej pozycji w Excelu można wpisać produkt w arkuszu `Okucia`, a w arkuszu `Ceny_dostawcow` na tym samym wierszu podać tylko dostawcę i jedną cenę.
3. Import uzupełnia brakującą `data_ceny` dzisiejszą datą lokalną, jeśli wiersz ceny ma poprawną cenę netto/brutto, ale data jest pusta.
4. Eksport `Ceny_dostawcow` pokazuje datę również dla istniejącej ceny dostawcy z pustą datą, żeby kolejny arkusz roboczy nie miał pustej daty przy wycenianej cenie.
5. Kolejny eksport uzupełnia `okucie_nazwa`, `okucie_symbol` i `producent` w `Ceny_dostawcow` dla ceny, która została dopasowana po numerze wiersza.

## Zabezpieczenia

- Dopasowanie po numerze wiersza działa tylko wtedy, gdy wiersz ceny nie ma własnych danych okucia (`okucie_id`, `okucie_symbol`, `okucie_nazwa`, `producent`). Jeśli dane są podane, dotychczasowy matching po ID albo `producent + symbol` ma pierwszeństwo.
- Import dodaje ostrzeżenie w podglądzie, że cena została dopasowana po tym samym numerze wiersza. To nie jest ciche zgadywanie.
- Brak powrotu zapętlonych formuł netto/brutto w Excelu. Arkusz pozostaje prostym formularzem wejściowym, a kalkulacja brakującej strony ceny należy do programu.
- Test APP pilnuje scenariusza: nowa pozycja w `Okucia` w wierszu 20 oraz cena dostawcy w `Ceny_dostawcow` w wierszu 20 bez ręcznego ID.

## Czego nie zmieniano

- Nie ruszano WYCENY, MATERIAŁÓW, WYWIADU, RYSUNKU ani backupów.
- Nie dodano nowego storage.
- Nie wprowadzono automatycznego tworzenia okuć wyłącznie z arkusza cen, jeśli brak odpowiadającego wiersza w `Okucia`.
