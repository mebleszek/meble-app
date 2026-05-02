# Status reconcile — wstępna zastępuje końcową v1

## Baza

- Start: `site_status_reconcile_v1.zip`
- Wynik: `site_prelim_replace_final_status_v1.zip`

## Zakres

Poprawka usuwa regresję, w której po zaakceptowaniu wyceny wstępnej `A + S` pomieszczenie `A` mogło zostać na statusie `Zaakceptowany`, jeśli wcześniej istniała zaakceptowana końcowa oferta `A`, która została potem odrzucona po zmianie zakresu.

## Decyzja biznesowa

- Wycena wstępna zaakceptowana → zakres oferty ma status `Pomiar`.
- Wycena końcowa zaakceptowana → zakres oferty ma status `Zaakceptowany`.
- Jeśli zaakceptowana wstępna zastępuje wcześniejszą zaakceptowaną końcową ofertę, status `Zaakceptowany` wynikający z tej poprzedniej końcowej oferty nie może zostać zachowany.
- Ręczny status `Wycena` pokoju, który nie wynikał z odrzuconej końcowej oferty, zostaje zachowany.
- Pokoje spoza zakresu akceptowanej oferty nie są ruszane.

## Pliki

- `js/app/project/project-status-snapshot-flow.js`
- `js/app/project/project-status-sync.js`
- `js/testing/wycena/suites/status-reconciliation-regression.js`
- `index.html`
- `dev_tests.html`
- `DEV.md`
- `CLOUD_MIGRATION.md`
- `OPTIMIZATION_PLAN.md`

## Testy

- `node --check` dla zmienionych JS.
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- pełne `FC.wycenaDevTests.runAll()` w Node: 111/111 OK.
- `node tools/rozrys-dev-smoke.js`
- `node tools/local-storage-source-audit.js`
- `node tools/dependency-source-audit.js`
- `node tools/wycena-architecture-audit.js`
