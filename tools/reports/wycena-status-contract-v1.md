# Wycena status contract v1

Zakres paczki: zabezpieczenie kontraktu statusów Wycena ↔ projekt ↔ inwestor ↔ snapshoty ofert przed większym refaktorem `wycena.js` / `project-status-sync.js`.

## Co zostało zabezpieczone

1. Akceptacja wstępnej oferty dla jednego pokoju ustawia `masterStatus`, `mirrorStatus`, `projectStore.status` i `loadedProject.meta.projectStatus` według exact-scope tego pokoju.
2. Rozłączny pokój z własną zaakceptowaną ofertą nie traci statusu ani `selectedByClient`, gdy akceptowana jest oferta innego pokoju.
3. Ręczne cofnięcie statusu jednego pokoju czyści selection/reject tylko w jego exact-scope i nie rusza zaakceptowanej oferty innego pokoju.
4. Usunięcie zaakceptowanej końcowej oferty solo wraca do własnej historii pokoju, bez agregacji statusu z innych pokoi.

## Decyzja techniczna

Nie ruszano runtime Wycena ani UI. Dodano wyłącznie kontrakt testowy `js/testing/wycena/suites/status-contract.js` oraz podpięcie do `dev_tests.html` i `tools/app-dev-smoke-lib/file-list.js`.

## Wynik testów

- `node tools/app-dev-smoke.js` → `195/195 OK`
- `node tools/rozrys-dev-smoke.js` → `62/62 OK`
