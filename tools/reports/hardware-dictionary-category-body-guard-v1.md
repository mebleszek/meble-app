# Hardware dictionary category body guard v1

## Baza

`site_hardware_dictionary_category_regression_fix_v1.zip`

## Problem

Akordeon `Słowniki okuć → Kategorie / rodzaje okuć` miał zawartość w DOM, ale na telefonie mógł być nadal wizualnie pusty albo przycięty. Przyczyną była animacja `max-height`: po otwarciu wspólnego akordeonu body mogło zostać z za małym limitem wysokości albo z układem, który pokazywał tylko górę pierwszej karty.

## Zmiana

- Wspólny akordeon listy kategorii otwiera się teraz w trybie bezpiecznym bez przycinania treści.
- Po otwarciu body ma pełną widoczność (`overflow: visible`) i nie zostaje z wymuszonym `max-height`.
- Dodano CSS fail-safe dla `.hardware-dictionary-categories-accordion.is-open > .hardware-dictionary-section-body`.
- Mini-akordeony parametrów technicznych nie zostały zmienione i zachowują płynne rozwijanie.

## Testy

Zaostrzono test regresji w `tools/app-dev-smoke.js`. Test sprawdza teraz nie tylko obecność tekstów, ale też:

- realne wiersze `.hardware-dictionary-row`,
- input pierwszej kategorii `Zawiasy`,
- przycisk `Usuń`,
- przycisk `Dodaj kategorię`,
- brak `hidden` na otwartym body,
- brak stylu `max-height: 0px/1px` i `overflow: hidden` po ponownym otwarciu.

## Poza zakresem

Bez zmian backupów, storage, import/export Excel, zamienników, PRO100, ROZRYS jako funkcji, RYSUNKU i WYCENY.
