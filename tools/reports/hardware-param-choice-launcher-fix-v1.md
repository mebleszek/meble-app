# Hardware param choice launcher fix v1

## Baza

- `site_hardware_dictionary_width_fix_v1.zip`

## Zakres

- Naprawiono widoczność i działanie launchera wyboru dla tekstowych parametrów technicznych okuć, które mają dozwolone wartości w słowniku.
- Formularz nie pokazuje już wyłącznie podglądu `Wartość: ...`; obok danych technicznych jest widoczny przycisk wyboru aplikacyjnego.
- Jeśli standardowy `ctx.mountChoice` nie zamontuje launchera, moduł tworzy go bezpośrednio przez `FC.rozrysChoice`.

## Poza zakresem

- Nie zmieniono backupów ani retencji.
- Nie zmieniono storage ani modelu danych.
- Nie zmieniono import/export Excel.
- Nie zmieniono silnika ani UI zamienników.
- Nie ruszono PRO100, usług, ROZRYS, RYSUNKU ani WYCENY.

## Testy

- `node --check js/app/material/price-modal-hardware-form.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/rozrys-dev-smoke.js`
- `node tools/local-storage-source-audit.js`
- `node tools/dependency-source-audit.js`
- `node tools/wycena-architecture-audit.js`
- `node tools/hardware-accessories-dev-smoke.js`
- `node tools/hardware-import-export-deep-smoke.js`
- `node tools/service-pro100-dev-smoke.js`
