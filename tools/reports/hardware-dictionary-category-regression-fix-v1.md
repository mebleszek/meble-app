# Hardware dictionary category regression fix v1

## Baza

- `site_hardware_dictionary_rozrys_accordion_pattern_v1.zip`

## Zakres

- Naprawiono pusty akordeon `Kategorie / rodzaje okuć` w modalu `Słowniki okuć`.
- Stan widoczności akordeonu jest teraz synchronizowany po renderze treści, żeby lista kategorii nie znikała po zmianie układu/animacji.
- Selektory body/summary akordeonu mają fallback bez `:scope`, co zmniejsza ryzyko pustego panelu w środowisku z nietypową obsługą selektorów.
- Na małych ekranach chevron w akordeonie kategorii i we wzorcu UI ma równe odstępy od góry, dołu i prawej strony.
- Dodano test regresji w `tools/app-dev-smoke.js`; mini DOM wspiera teraz `hidden` i `:scope > ...`.

## Testy uruchomione

- `node --check js/app/material/price-modal-hardware-dictionaries.js`
- `node --check tools/app-dev-smoke-lib/mini-document.js`
- `node --check tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js` — 100/100 OK
- `node tools/rozrys-dev-smoke.js` — 72/72 OK
- `node tools/hardware-accessories-dev-smoke.js` — 57/57 OK
- `node tools/hardware-import-export-deep-smoke.js` — 21/21 OK
- `node tools/service-pro100-dev-smoke.js` — 18/18 OK

## Poza zakresem

- Bez zmian w backupie, storage, imporcie/eksporcie, zamiennikach, PRO100, RYSUNKU, WYCENIE i logice ROZRYSU.
