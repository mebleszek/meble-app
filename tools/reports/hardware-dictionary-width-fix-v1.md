# Hardware dictionary width fix v1

## Baza

- `site_hardware_dictionary_full_scroll_v1.zip`

## Zakres

Poprawka UI/CSS dla modala `Słowniki okuć`. Parametry techniczne kategorii po przejściu na główny scroll nadal miały układ szerokości odziedziczony po starych selectorach `#priceModal` / `#priceItemModal`, przez co na telefonie siatki parametrów nie przechodziły w jedną kolumnę i prawa część formularza była ucinana.

## Zmiany

- Dodano selektory `.hardware-dictionary-panel` dla siatek parametrów technicznych.
- W panelu słowników `grid-2` i `grid-3` używają `minmax(0, 1fr)`, żeby dzieci siatki mogły się realnie zwężać.
- Na mobile pola parametrów technicznych w słownikach przechodzą w jedną kolumnę.
- Zmniejszono poziome marginesy/padding w panelu słowników na mobile.
- Przycisk cykliczny `Typ pola` / `Sposób porównania` może łamać tekst i nie wypycha układu poza ekran.

## Poza zakresem

- Brak zmian w backupie, storage, import/export Excel, zamiennikach, PRO100, ROZRYS, RYSUNKU i WYCENIE.
- Brak zmian w modelu danych parametrów technicznych.
