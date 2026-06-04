# Przywrócenie starych helperów `?` v1 — 2026-06-04

## Zakres

Przywrócono wyłącznie wygląd i sposób renderowania ikon pomocy `?` z poprzedniej działającej paczki.

## Zmienione pliki

- `js/app/shared/help-registry.js`
- `css/shared-overlays-choice.css`
- `css/wycena.css`
- `index.html` — tylko cache-busting/versioning
- `README.md`, `DEV.md` — wpis techniczny
- `tools/quote-generate-helper-duplicate-regression-smoke.js` — aktualizacja regresji po cofnięciu helperowego fallbacku

## Zachowane z poprzedniej paczki

- blokada podwójnego działania `Wyceń`,
- techniczny podpis duplikatu okucia po parametrach `Użyj do porównania`,
- testy WYCENY i katalogu okuć.

## Nieruszane obszary

Nie zmieniano PRO100, ROZRYS, PCV/obrzeży, import/export Excel, backupów ani modelu snapshotów ofert.

## Testy wykonane

- `node --check` dla zmienionych plików JS i testów.
- `tools/app-dev-smoke.js` — 109/109 OK.
- `tools/quote-generate-helper-duplicate-regression-smoke.js` — OK.
- `tools/wycena-generate-action-registry-smoke.js` — OK.
- `tools/wycena-generate-single-flow-smoke.js` — OK.
- `tools/wycena-duplicate-offer-guard-smoke.js` — OK.
- `tools/hardware-accessories-dev-smoke.js` — 57/57 OK.
- `tools/cabinet-hardware-requirements-live-edit-smoke.js` — OK.
- `tools/cabinet-hardware-requirements-panel-smoke.js` — OK.
- `tools/cabinet-hardware-pair-buttons-stacked-smoke.js` — OK.
- `tools/hardware-technical-completeness-smoke.js` — OK.
- `tools/check-index-load-groups.js` — OK.
