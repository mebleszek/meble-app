# hardware-dictionary-param-scroll-smooth-v1

## Baza

- `site_hardware_dictionary_param_scroll_focus_v1.zip`

## Zakres

- Mikro-poprawka UI/UX w `Słowniki okuć → Parametry techniczne kategorii`.
- Krótkie auto-przewinięcia zostały zachowane.
- Przy otwieraniu parametru z samego dołu usunięto startowe szarpnięcie powodowane jednoczesnym zwinięciem poprzedniego parametru i przewinięciem do nowego.

## Implementacja

- Dodano `preserveActiveParamPosition()`, które kompensuje zmianę wysokości listy przy zamykaniu poprzedniego parametru, żeby kliknięty nagłówek nie skoczył zanim zacznie się właściwy scroll.
- Dodano `afterDictionaryLayout()`, żeby doscrollowanie startowało po ustabilizowaniu układu akordeonu.
- Dodano próg widoczności: jeśli nagłówek jest już w dobrym miejscu, scroll nie uruchamia się ponownie.
- Dodano `overflow-anchor:none` dla scrolla słowników i akordeonów parametrów, żeby przeglądarka nie walczyła z kontrolowanym pozycjonowaniem.

## Poza zakresem

- Brak zmian danych/storage.
- Brak zmian backupu.
- Brak zmian import/export Excel.
- Brak zmian w zamiennikach.
- Brak zmian PRO100, ROZRYS, RYSUNKU, WYCENY i usług.
