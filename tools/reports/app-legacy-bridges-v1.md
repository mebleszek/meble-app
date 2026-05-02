# App legacy bridges split v1 — 2026-05-02

## Baza

- Start: `site_app_core_namespace_v1.zip`
- Wynik: `site_app_legacy_bridges_v1.zip`

## Zakres

- Bez zmiany UI.
- Bez RYSUNKU.
- Bez zmian statusów/ofert.
- Bez zmian backupów, storage i formatu danych.

## Zmiany

- `js/app.js` odchudzony z ok. 464 do ok. 354 linii.
- Dodano `js/app/bootstrap/app-legacy-bridges.js` jako cienki bridge zgodności dla globalnych delegatorów:
  - cabinet/front rules,
  - cabinet modal/set wizard/actions,
  - price modal,
  - material/common/front hardware/cutlist.
- Zaktualizowano load order i smoke kontrakt w narzędziach.

## Decyzja architektoniczna

`app.js` ma pozostać shellem runtime. `app-legacy-bridges.js` zachowuje stare globalne funkcje, ale nie zawiera implementacji domenowej — deleguje do modułów `FC.*`.

## Testy

- `node --check` dla zmienionych JS — OK.
- `node tools/check-index-load-groups.js` — OK.
- `node tools/app-dev-smoke.js` — 35/35 OK.
- `node tools/rozrys-dev-smoke.js` — 72/72 OK.
- `FC.wycenaDevTests.runAll()` — 113/113 OK.
- `node tools/local-storage-source-audit.js` — OK, brak nowego storage.
- `node tools/dependency-source-audit.js` — OK.
- `node tools/wycena-architecture-audit.js` — OK.
- Runtime app load smoke przez grupy do `app-runtime` — OK.
