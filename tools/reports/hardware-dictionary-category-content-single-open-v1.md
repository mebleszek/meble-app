# Hardware dictionary category content / single open v1

## Baza

`site_hardware_dictionary_categories_accordion_v1.zip`

## Zakres

- Poprawka widoczności zawartości wspólnego akordeonu `Kategorie / rodzaje okuć` w modalu `Słowniki okuć`.
- Zmiana akordeonu listy kategorii z natywnego `details` na kontrolowany panel aplikacyjny z `aria-expanded` i `hidden` na treści.
- W `Parametry techniczne kategorii` dodano zasadę jednego otwartego akordeonu kategorii technicznej naraz.

## Decyzje

- Nie zmieniano modelu danych kategorii ani parametrów.
- Nie zmieniano backupów, storage, import/export Excel ani silnika zamienników.
- Poprawka pozostaje w istniejącym module słowników, bo dotyczy tylko renderu jednego modala.

## Pliki

- `js/app/material/price-modal-hardware-dictionaries.js`
- `css/price-item-popup.css`
- `tools/app-dev-smoke.js`
- `index.html`
- `dev_tests.html`
- `README.md`
- `DEV.md`

## Testy

- `node --check js/app/material/price-modal-hardware-dictionaries.js`
- `node --check tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/rozrys-dev-smoke.js`
- `node tools/local-storage-source-audit.js`
- `node tools/dependency-source-audit.js`
- `node tools/wycena-architecture-audit.js`
- `node tools/hardware-accessories-dev-smoke.js`
- `node tools/hardware-import-export-deep-smoke.js`
- `node tools/service-pro100-dev-smoke.js`
