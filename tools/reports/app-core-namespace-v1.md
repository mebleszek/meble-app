# App core namespace split v1

Baza startowa: `site_investor_ui_split_v1.zip`.

## Zakres

- Wydzielono z `js/app.js` bootstrap namespace `FC`, fallback storage i fallback projektu do `js/app/bootstrap/app-core-namespace.js`.
- Zaktualizowano load order w `index.html` i `tools/index-load-groups.js`.
- Dla spójności test hub ładuje nowy moduł w `dev_tests.html`.
- `tools/app-dev-smoke.js` dostał kontrakt `App core namespace jest wydzielony z app.js`.

## Efekt rozmiaru

- `js/app.js`: ok. 590 → ok. 464 linii.
- `js/app/bootstrap/app-core-namespace.js`: ok. 171 linii, jedna odpowiedzialność: bootstrap/fallback namespace.

## Decyzje

- Nie ruszano UI, RYSUNKU, statusów/ofert, backupów ani formatu danych.
- Nie dodano nowych kluczy storage.
- Nowy moduł korzysta z istniejących `FC.storage`, `FC.schema` i `FC.project`, a fallback zachowuje kompatybilność awaryjną.

## Testy

- `node --check` dla nowych/zmienionych JS.
- `node tools/check-index-load-groups.js`.
- `node tools/app-dev-smoke.js`.
- `node tools/rozrys-dev-smoke.js`.
- `FC.wycenaDevTests.runAll()` w Node.
- `node tools/local-storage-source-audit.js`.
- `node tools/dependency-source-audit.js`.
- `node tools/wycena-architecture-audit.js`.
- Ręczny runtime load smoke w Node dla grup do `app-runtime` włącznie.
