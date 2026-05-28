# Hardware replacement button visibility fix v1

## Baza

`site_hardware_replacement_preview_ui_v1.zip`

## Cel

Poprawić przypadek, w którym przycisk `Zamienniki` nie był widoczny w realnym modalu edycji okucia mimo dodania HTML i modułu podglądu.

## Zmiany

- `js/app/material/price-modal-hardware-replacements.js` tworzy/odnajduje przycisk `Zamienniki` i panel podglądu w stopce modala, dzięki czemu nie zależy wyłącznie od statycznego fragmentu HTML.
- Źródło porównania jest budowane z pozycji katalogowej oraz pasywnego draftu formularza; zachowywane jest `id` edytowanej pozycji.
- Dodano obsługę aliasu `category` jako `hardwareCategory`, żeby podgląd nie znikał przy danych mających starszy lub uproszczony kształt kategorii.
- Test kontraktowy UI okuć sprawdza budowanie źródła z aliasem kategorii.

## Bez zmian

- Brak zapisu zamiennika.
- Brak zmian storage i backupu.
- Brak zmian import/export Excel.
- Brak zmian PRO100, ROZRYS, RYSUNKU i WYCENY.
