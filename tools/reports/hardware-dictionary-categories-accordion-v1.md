# Hardware dictionary categories accordion v1

## Baza

- `site_hardware_dictionary_param_instant_close_v1.zip`

## Zakres

- Dodano jeden wspólny akordeon dla sekcji `Kategorie / rodzaje okuć` w modalu `Słowniki okuć`.
- Wewnątrz panelu pozostają dotychczasowe wiersze kategorii oraz przycisk `Dodaj kategorię`.
- Celem jest szybkie zwinięcie całej listy kategorii, żeby na telefonie wygodniej pracować na `Parametry techniczne kategorii`.

## Poza zakresem

- Bez zmian w modelu danych.
- Bez zmian w backupach i storage.
- Bez zmian w imporcie/eksporcie Excel.
- Bez zmian w silniku i podglądzie zamienników.
- Bez zmian w PRO100, usługach, ROZRYS, RYSUNKU i WYCENIE.

## Testy

- `node --check js/app/material/price-modal-hardware-dictionaries.js`
- `node --check tools/app-dev-smoke.js`
- Standardowe smoke/audyty przed paczką.
