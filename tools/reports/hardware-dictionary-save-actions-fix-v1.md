# Hardware dictionary save actions fix v1

## Paczka

`site_hardware_dictionary_save_actions_fix_v1.zip`

## Przyczyna

Po poprzednim etapie zmiany w modalu `Słowniki okuć` mogły nie przełączać stopki na `Anuluj` + `Zapisz`. Szczególnie dotyczyło to parametrów systemowych zawiasów, bo normalizacja definicji ponownie narzucała wartości domyślne (`Użyj do porównania`, `Buduje nazwę techniczną`, `Sposób porównania`, `Aktywna`, `Kolejność`). W efekcie podpis danych po zmianie wyglądał jak niezmieniony i UI zostawiał tylko `Wyjdź`.

## Zmiany

- Dodano wewnętrzną flagę `userTouched` w modalu słowników okuć.
- Każda realna edycja kategorii albo parametru technicznego wywołuje `markTouched()`, dzięki czemu `Zapisz` i `Anuluj` pojawiają się od razu po zmianie.
- `normalizeDefinition()` nadal nadaje bezpieczne wartości domyślne dla parametrów systemowych, ale nie nadpisuje już jawnych decyzji użytkownika.
- Zachowano ukrywanie nieaktywnych parametrów `legacy` w UI słowników.
- Nie dodano nowych kluczy `localStorage`; zapis nadal idzie przez istniejący `catalogStore`.

## Pliki

- `js/app/catalog/hardware-technical-params.js`
- `js/app/material/price-modal-hardware-dictionaries.js`
- `index.html`
- `dev_tests.html`
- `tools/hardware-dictionary-save-actions-smoke.js`
- `README.md`
- `DEV.md`

## Testy

- `node --check js/app/catalog/hardware-technical-params.js`
- `node --check js/app/material/price-modal-hardware-dictionaries.js`
- `node tools/hardware-dictionary-save-actions-smoke.js`
- `node tools/hardware-technical-name-ui-smoke.js`
- `node tools/hardware-technical-completeness-smoke.js`
- `node tools/app-dev-smoke.js`
- `node tools/hardware-accessories-dev-smoke.js`
- `node tools/hardware-import-export-deep-smoke.js`
- `node tools/cabinet-hinge-tipon-spring-smoke.js`
- `node tools/wycena-hinge-quote-replacement-flow-smoke.js`

## Zakres nieruszony

Nie zmieniano WYCENY, PRO100, ROZRYS/Optimax, PCV/obrzeży, backupów, snapshotów ofert ani import/export poza zachowaniem istniejących pól parametrów technicznych.
