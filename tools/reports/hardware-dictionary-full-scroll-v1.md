# hardware-dictionary-full-scroll-v1

## Baza

`site_hardware_param_dictionary_choices_v1.zip`

## Zakres

- Poprawiono modal `Słowniki okuć`, aby parametry techniczne kategorii rozwijały się w głównym scrollu panelu, a nie w małym wewnętrznym okienku.
- Wprowadzono `panel-box-form__scroll hardware-dictionary-scroll` dla treści słowników oraz `panel-box-form__footer` dla akcji.
- Usunięto klasę `hardware-dictionary-list` z wewnętrznej listy parametrów kategorii i wyłączono limit wysokości/overflow dla list słownikowych.
- Dodano mobilne zawijanie gridów parametrów technicznych do jednej kolumny, żeby nie wymuszać poziomego scrolla.

## Poza zakresem

- Brak zmian w backupie, storage i polityce kopii.
- Brak zmian w import/export Excel.
- Brak zmian w silniku i podglądzie zamienników.
- Brak zmian w PRO100, usługach, ROZRYS, RYSUNKU i WYCENIE.

## Testy

- `node --check` dla zmienionych plików JS.
- Standardowe smoke/audyty przed wydaniem paczki.
