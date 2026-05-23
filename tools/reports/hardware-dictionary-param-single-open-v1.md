# Hardware dictionary param single open v1

## Baza

- Start: `site_hardware_dictionary_param_accordions_v1.zip`
- Wynik: `site_hardware_dictionary_param_single_open_v1.zip`

## Zakres

- UI-only w modalu `Słowniki okuć`.
- Parametry techniczne wewnątrz jednej kategorii działają jak akordeony z zasadą: tylko jeden parametr rozwinięty naraz.
- Otwieranie nowego parametru zamyka poprzedni otwarty parametr w tej samej kategorii.
- Nowo dodany parametr nadal otwiera się automatycznie.

## Pliki zmienione

- `js/app/material/price-modal-hardware-dictionaries.js`
- `tools/app-dev-smoke.js`
- `index.html`
- `dev_tests.html`
- `README.md`
- `DEV.md`

## Poza zakresem

Nie zmieniono:

- storage ani modelu danych,
- backupu i retencji kopii,
- import/export Excel,
- silnika i UI zamienników,
- PRO100,
- usług stolarskich,
- ROZRYS,
- RYSUNKU,
- WYCENY.

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
