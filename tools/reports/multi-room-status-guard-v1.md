# Multi-room status guard v1 — raport

Baza: `site_wycena_tab_boundary_v1.zip`.

## Problem

W modalu statusu projektu w zakładce Inwestor status `Pomiar`/`Wycena` dla pokoju objętego wspólną wyceną kilku pomieszczeń był blokowany komunikatem typu `Brak wyceny wstępnej`. Dla pojedynczego pokoju działało poprawnie, bo guard szukał głównie exact-scope/solo.

## Zmiana

- `project-status-manual-guard.js` przy analizie pojedynczego pokoju bierze pod uwagę snapshoty, których scope zawiera ten pokój.
- Legacy/project-wide snapshot bez room scope nadal nie odblokowuje wielu pokoi na ślepo; fallback project-wide zostaje dopuszczony tylko dla inwestora z jednym pokojem.
- Niezaakceptowana wspólna wycena wstępna jest traktowana jako istniejąca, ale niezaakceptowana podstawa, więc status pozostaje zablokowany bez fałszywego komunikatu `brak wyceny`.

## Zabezpieczenia

- Zaktualizowano test Wycena ↔ Inwestor dla zaakceptowanej wspólnej wyceny wstępnej.
- Przeszedł celowany test Node dla `projectStatusManualGuard.validateManualStatusChange()` i `buildManualStatusChoiceStates()`.
- Brak nowych `localStorage`/`sessionStorage`, brak zmian UI, brak zmian RYSUNKU.
