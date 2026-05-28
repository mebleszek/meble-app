# Preliminary measure final-wait v1 — 2026-05-01

Zakres: poprawka logiki statusów po akceptacji wyceny wstępnej.

## Problem

Ręczna zmiana statusu pokoju/projektu z `Pomiar` na `Wycena` po zaakceptowanej wycenie wstępnej traktowała zaakceptowaną wstępną ofertę jak wybór do wyczyszczenia/odrzucenia. W historii Wyceny mogła zostać oznaczona jako odrzucona mimo braku nowej oferty końcowej.

## Decyzja biznesowa

`Pomiar → Wycena` oznacza etap „po pomiarze, czeka na wycenę końcową”, a nie odrzucenie zaakceptowanej wyceny wstępnej. Wycena wstępna pozostaje w historii jako zaakceptowana podstawa/punkt odniesienia do czasu ręcznego odrzucenia albo świadomego zastąpienia inną logiką.

## Zmiany

- `js/app/quote/quote-snapshot-selection.js`
  - `syncSelectionForProjectStatus(..., 'wycena')` zachowuje aktywnie zaakceptowaną wycenę wstępną, jeśli nie ma zaakceptowanej oferty końcowej w tym scope.
  - `getRecommendedStatusForProject(..., 'wycena')` przy zaakceptowanej wycenie wstępnej zachowuje status `wycena`, żeby rekonsyliacja nie cofała projektu automatycznie na `pomiar`.
- `js/testing/wycena/suites/core-offer-workflow.js`
  - zaktualizowano kontrakt: przejście `Pomiar → Wycena` nie odpina i nie odrzuca zaakceptowanej wstępnej oferty.
- `js/testing/wycena/suites/investor-integration.js`
  - zaktualizowano kontrakt Inwestor ↔ Wycena dla ręcznej zmiany statusu po pomiarze.

## Sprawdzenia

- `node --check` dla zmienionych plików — OK.
- `node tools/check-index-load-groups.js` — OK.
- `node tools/app-dev-smoke.js` — 29/29 OK.
- `node tools/rozrys-dev-smoke.js` — 72/72 OK.
- `node tools/local-storage-source-audit.js` — OK.
- `node tools/dependency-source-audit.js` — OK.
- `node tools/wycena-architecture-audit.js` — OK.
- `FC.wycenaDevTests.runNodeSmoke()` — 15/15 OK.
- Pełne `FC.wycenaDevTests.runAll()` w Node: 97/98, z tym samym znanym błędem środowiskowym `Brak pomieszczeń blokuje tworzenie pustej wyceny` widocznym już przed tą poprawką.

## Uwagi

Nie zmieniono UI, storage, RYSUNKU, backupów ani formatu danych. To jest celowana poprawka semantyki statusu i historii ofert.
