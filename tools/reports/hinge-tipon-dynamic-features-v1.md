# Hinge TIP-ON dynamic features v1

Paczka: `site_hinge_tipon_dynamic_features_v1.zip`

## Zakres

Naprawiono centralną logikę wymagań zawiasów w modalu szafki, MATERIALE i WYCENIE:

- domyślne zawiasy dla normalnego otwierania mają `hamulec: tak` i `sprężyna: tak`,
- otwieranie `TIP-ON` jest rozpoznawane po polu `cabinet.openingSystem`,
- dla `TIP-ON` wymagania zawiasów są dzielone per drzwiczki/front:
  - bez hamulca, ze sprężyną: `floor(ilość / 2)`,
  - bez hamulca, bez sprężyny: `ceil(ilość / 2)`,
- panel `Zmień` pobiera ważne cechy z dynamicznych parametrów technicznych kategorii `Zawiasy`, zamiast bazować na płytkiej ręcznej liście,
- warianty różniące się cechami technicznymi, np. hamulcem i sprężyną, dostają odrębny techniczny identyfikator wyboru i nie nadpisują kanonicznych typów 110° / 155° / 170° / równoległy wpuszczany,
- WYCENA rozpoznaje klasę funkcjonalną zawiasu osobno od cech porównania, dzięki czemu nadal może używać zamienników kątowych, ale wymaga zgodności pól oznaczonych `Użyj do porównania`.

## Zmienione moduły

- `js/app/cabinet/cabinet-hardware-requirements.js`
- `js/app/cabinet/cabinet-hardware-requirements-panel.js`
- `js/app/cabinet/cabinet-hardware-requirement-options.js`
- `js/app/wycena/wycena-core-lines.js`
- `js/app/catalog/hardware-catalog-seed-data.js`
- `tools/cabinet-hinge-tipon-spring-smoke.js`
- `tools/cabinet-hardware-requirements-live-edit-smoke.js`
- `tools/wycena-hinge-requirement-override-smoke.js`
- `tools/hinge-driver-components-smoke.js`

## Nie ruszano

Nie zmieniano PRO100, ROZRYS/Optimax jako algorytmu rozkroju, PCV/obrzeży, backupów, import/export Excel ani modelu snapshotów ofert. Nie dodano nowych kluczy storage ani migracji localStorage.

## Uwaga o istniejącym katalogu użytkownika

Starterowe seedy zawiasów zostały poprawione na `hamulec: tak` i `sprężyna: tak`, ale aplikacja nie nadpisuje automatycznie istniejącego katalogu użytkownika w localStorage. Jeżeli stary lokalny katalog ma zawiasy z `sprężyna: nie`, WYCENA może wymagać ręcznej korekty parametrów technicznych tych pozycji w katalogu okuć albo ponownego importu poprawionych danych.

## Testy

- `node --check tools/*.js`
- `node tools/cabinet-hinge-tipon-spring-smoke.js`
- `node tools/cabinet-hardware-requirements-panel-smoke.js`
- `node tools/cabinet-hardware-requirements-live-edit-smoke.js`
- `node tools/wycena-hinge-requirement-override-smoke.js`
- `node tools/hardware-accessories-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/quote-generate-helper-duplicate-regression-smoke.js`
- `node tools/wycena-generate-action-registry-smoke.js`
- `node tools/wycena-generate-single-flow-smoke.js`
- `node tools/wycena-duplicate-offer-guard-smoke.js`
- `node tools/help-qmark-global-shape-smoke.js`
- `node tools/help-registry-label-trigger-smoke.js`
- `node tools/wycena-question-mark-shape-smoke.js`
- `node tools/cabinet-hardware-pair-buttons-stacked-smoke.js`
- `node tools/hardware-technical-completeness-smoke.js`
- `node tools/hinge-driver-components-smoke.js`

## Cache-busting

`20260605_hinge_tipon_dynamic_features_v1`
