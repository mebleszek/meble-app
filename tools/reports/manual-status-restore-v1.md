# Manual status restore v1 — raport

Baza: `site_prelim_replace_final_status_v1.zip`
Paczka: `site_manual_status_restore_v1.zip`

## Zakres

Naprawiono przypadek, w którym pokój wypadający ze wspólnej zaakceptowanej oferty wracał do `Nowy`, mimo że wcześniej miał ręcznie ustawiony status procesu, np. `Pomiar` albo `Wycena`.

## Zasada biznesowa

- `lastManualProjectStatus` jest ostatnim ręcznym statusem procesu pokoju.
- Oferta/snapshot może przykryć bieżący `projectStatus`, ale nie kasuje `lastManualProjectStatus`.
- Jeżeli pokój wypada ze wspólnego zaakceptowanego zakresu i nie ma aktywnej oferty dającej własny status, wraca do `lastManualProjectStatus`.
- Brak aktywnej oferty nie oznacza resetu do `Nowy`.
- Etapy po zaakceptowanej końcowej ofercie są prowadzone pojedynczo per pomieszczenie.

## Zmienione pliki

- `js/app/investor/investors-model.js`
- `js/app/investor/investor-persistence.js`
- `js/app/project/project-status-mirrors.js`
- `js/app/project/project-status-sync.js`
- `js/app/project/project-status-snapshot-flow.js`
- `js/testing/wycena/suites/status-reconciliation-regression.js`
- `DEV.md`
- `CLOUD_MIGRATION.md`
- `OPTIMIZATION_PLAN.md`
- `index.html`
- `dev_tests.html`

## Testy regresyjne

Dodano testy dla:

1. Rozpięcia wspólnej końcowej `A+S`, gdy `S` miało ręczne `Wycena`.
2. Rozpięcia wspólnej wstępnej `A+S`, gdy `S` miało ręczne `Pomiar`.
3. Zapisu `lastManualProjectStatus` przez ręczną zmianę statusu.
4. Zachowania legacy statusu ręcznego, gdy przed akceptacją wspólnej oferty pole `lastManualProjectStatus` jeszcze nie istniało.

## Wyniki

- `FC.wycenaDevTests.runAll()` w Node: 113/113 OK.
- Standardowe smoke/audyty przeszły bez błędów.
