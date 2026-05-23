# Hardware dictionary param accordions v1 — 2026-05-23

## Baza

- `site_hardware_param_choice_launcher_fix_v1.zip`

## Zakres

- Poprawa czytelności `Słowniki okuć → Parametry techniczne kategorii` na telefonie.
- Parametry wewnątrz rozwiniętej kategorii są teraz osobnymi mini-akordeonami z lekkim wcięciem.
- Nagłówek mini-akordeonu pokazuje nazwę parametru i skrót ustawień: typ pola, sposób porównania, cechy kluczowe, budowanie typu, aktywność i liczbę wartości słownikowych.
- Nowo dodany parametr otwiera się automatycznie, żeby można było go od razu uzupełnić.

## Granice zmiany

- Bez zmian w modelu danych.
- Bez nowych kluczy storage.
- Bez zmian w backupie i retencji backupów.
- Bez zmian w imporcie/eksporcie Excel.
- Bez zmian w silniku i podglądzie zamienników.
- Bez zmian w PRO100, usługach, ROZRYS, RYSUNKU i WYCENIE.

## Dodatkowe zabezpieczenie

- Usuwanie parametru w słownikach działa teraz na realnym rekordzie listy parametrów kategorii, a nie na kopii draftu tworzonej przy renderowaniu wiersza.

## Testy

- `node --check js/app/material/price-modal-hardware-dictionaries.js`
- `node --check tools/app-dev-smoke.js`
- pełny zestaw smoke/audit przed wydaniem paczki.
