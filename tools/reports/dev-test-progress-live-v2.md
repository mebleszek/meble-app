# DEV TEST PROGRESS LIVE V2 — 2026-05-01

Zakres: poprawka narzędzia `dev_tests.html`, bez zmian runtime aplikacji, UI produkcyjnego, danych, storage i backupów.

## Problem

Licznik postępu testów był renderowany w DOM, ale długie synchroniczne pętle testów nie oddawały sterowania przeglądarce. W efekcie Chrome malował aktualizację dopiero po zakończeniu przebiegu i użytkownik widział licznik praktycznie jako wynik końcowy.

## Zmiana

1. `js/testing/shared/harness.js` dostał `yieldToBrowser()` i oddaje sterowanie między zdarzeniami progressu (`suite-start`, `test-start`, `test-done`, `suite-done`).
2. `js/testing/rozrys/tests.js` używa tego samego mechanizmu w swoim ręcznym runnerze, bo ROZRYS nie korzystał w pełni ze wspólnego `runSuite`.
3. `dev_tests.html` ma podbity cache-busting: `20260501_dev_test_progress_live_v2`.

## Zabezpieczenia

- Brak zmian w logice testów i asercjach.
- Brak zmian w runtime aplikacji.
- Brak zmian w RYSUNEK.
- Brak zmian w danych i backupach.
