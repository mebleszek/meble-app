# Globalna naprawa renderowania helperów `?` v2

## Przyczyna

W poprzedniej paczce kształt `.info-trigger` był blokowany globalnie, ale część helperów w WYCENIE i ROZRYS/Optimax w ogóle nie dostawała klasy `.info-trigger`. Centralna funkcja `helpRegistry.labelWithInfo()` używała jednego pola `className` dla kontenera etykiety i przekazywała ten sam obiekt do `createTrigger()`. Domyślna wartość `className:'label-help'` trafiała więc również na przycisk.

Skutek: zamiast okrągłego `?` powstawał przycisk z klasą `.label-help`, który style ROZRYS/WYCENA traktowały jak wiersz etykiety. Na mobile wyglądało to jak pusty pionowy prostokąt.

## Zmiana

- `labelWithInfo()` rozdziela klasę kontenera i przycisku.
- `className` nadal oznacza klasę wiersza, domyślnie `label-help`.
- `triggerClassName` oznacza klasę przycisku, domyślnie `info-trigger`.
- `createTrigger()` dostaje osobny `triggerCfg`, więc przycisk nie dziedziczy już klasy kontenera.

## Zakres

Zmieniono tylko:

- `js/app/shared/help-registry.js`
- `tools/help-registry-label-trigger-smoke.js`
- dokumentację/raport/cache-busting

Nie zmieniano logiki WYCENY, ROZRYS, okuć, PRO100, PCV, backupów ani import/export.

## Testy

- `node --check js/app/shared/help-registry.js`
- `node --check tools/help-registry-label-trigger-smoke.js`
- `node tools/help-registry-label-trigger-smoke.js`
- `node tools/help-qmark-global-shape-smoke.js`
- `node tools/wycena-question-mark-shape-smoke.js`
- `node tools/app-dev-smoke.js`
- `node tools/quote-generate-helper-duplicate-regression-smoke.js`
- `node tools/wycena-generate-action-registry-smoke.js`
- `node tools/wycena-generate-single-flow-smoke.js`
- `node tools/hardware-accessories-dev-smoke.js`
- `node tools/cabinet-hardware-requirements-panel-smoke.js`
- `node tools/check-index-load-groups.js`
