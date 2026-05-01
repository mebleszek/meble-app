# Wycena core platform split v1 — 2026-05-01

## Cel

Rozdzielić `js/app/wycena/wycena-core.js`, bo plik mieszał: katalog usług/cen, źródła projektu, most do ROZRYS, budowę linii oferty, draft handlowy i orchestrację snapshotu.

## Zakres

Bez zmian UI, bez RYSUNKU, bez zmiany storage, bez zmiany formatu danych.

## Nowe moduły

- `js/app/wycena/wycena-core-utils.js` — helpery tekstu/slug/clone.
- `js/app/wycena/wycena-core-catalog.js` — AGD defaults, katalog usług i lookup cen.
- `js/app/wycena/wycena-core-source.js` — aktywny projekt, pokoje, szafki i agregacja materiałów.
- `js/app/wycena/wycena-core-material-plan.js` — most do ROZRYS i linie materiałowe po arkuszach.
- `js/app/wycena/wycena-core-offer.js` — draft oferty, commercial i stawki oferty.
- `js/app/wycena/wycena-core-lines.js` — linie elementów, okuć, AGD i szczegóły klienta/PDF.
- `js/app/wycena/wycena-core.js` — cienka fasada publicznego API `FC.wycenaCore`.

## Zabezpieczenia

- Zachowano stare publiczne API `FC.wycenaCore`.
- Zaktualizowano load order w `index.html`, `dev_tests.html`, `tools/index-load-groups.js`, `tools/app-dev-smoke-lib/file-list.js`.
- Dodano kontrakt smoke dla warstw core.
- Rozszerzono kontrakt architektury Wyceny o nowe moduły.

## Wyniki lokalne

- `node tools/check-index-load-groups.js` — OK.
- `node tools/app-dev-smoke.js` — 28/28 OK.
- `node tools/rozrys-dev-smoke.js` — 72/72 OK.
- `node tools/local-storage-source-audit.js` — OK, raport odświeżony.
- `node tools/dependency-source-audit.js` — OK, raport odświeżony.
- `node tools/wycena-architecture-audit.js` — OK, raport odświeżony.
- `FC.wycenaDevTests.runNodeSmoke()` — 15/15 OK.

## Uwagi

Pełny `FC.wycenaDevTests.runAll()` nie został użyty jako źródło raportu Node w tej paczce, bo pełna suite jest przeznaczona głównie do `dev_tests.html` i może obejmować ścieżki zależne od środowiska przeglądarkowego. Do ręcznego potwierdzenia po wdrożeniu: `dev_tests.html` → `Testy aplikacji`.
