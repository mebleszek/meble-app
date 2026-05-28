# Hardware dictionary param instant close v1

## Baza

- Start: `site_hardware_dictionary_param_expand_animation_slow_v1.zip`

## Zakres

- Mikro-poprawka UI mini-akordeonów parametrów technicznych w słownikach okuć.
- Nowo otwierany parametr dalej rozwija się płynnie.
- Poprzednio otwarty parametr zamyka się natychmiast, bez animowanego zwijania.
- Kolejność UX: scroll do klikniętego nagłówka → natychmiastowe zamknięcie starego parametru → płynne rozwinięcie nowego.

## Poza zakresem

- Brak zmian modelu danych.
- Brak zmian storage i backupu.
- Brak zmian import/export Excel.
- Brak zmian zamienników, PRO100, ROZRYS, RYSUNKU i WYCENY.

## Testy

- `node --check js/app/material/price-modal-hardware-dictionaries.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/rozrys-dev-smoke.js`
- `node tools/local-storage-source-audit.js`
- `node tools/dependency-source-audit.js`
- `node tools/wycena-architecture-audit.js`
- `node tools/hardware-accessories-dev-smoke.js`
- `node tools/hardware-import-export-deep-smoke.js`
- `node tools/service-pro100-dev-smoke.js`
