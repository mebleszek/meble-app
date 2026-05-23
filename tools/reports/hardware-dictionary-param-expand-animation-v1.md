# Hardware dictionary param expand animation v1

- Wynik: `site_hardware_dictionary_param_expand_animation_v1.zip`
- Start: `site_hardware_dictionary_param_scroll_before_open_v1.zip`
- Zakres: wyłącznie UI/UX mini-akordeonów parametrów technicznych w słownikach okuć.

## Zmiany

- Dodano animowane otwieranie treści parametru po doscrollowaniu do jego nagłówka.
- Dodano animowane zamykanie poprzedniego parametru zamiast natychmiastowego `open=false`.
- Zostawiono zasadę jednego otwartego parametru w kategorii.
- Dodano fallback dla `prefers-reduced-motion: reduce`, który wyłącza animację.
- Zachowano korektę pozycji nagłówka po zmianie wysokości akordeonów.

## Poza zakresem

- Brak zmian modelu danych.
- Brak zmian storage i backupu.
- Brak zmian import/export Excel.
- Brak zmian silnika/podglądu zamienników.
- Brak zmian PRO100, usług, ROZRYS, RYSUNKU i WYCENY.

## Pliki

- `js/app/material/price-modal-hardware-dictionaries.js`
- `css/price-item-popup.css`
- `index.html`
- `dev_tests.html`
- `README.md`
- `DEV.md`
