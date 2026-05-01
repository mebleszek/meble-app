# Dev test progress v1

Zakres: licznik postępu ręcznych testów w `dev_tests.html`.

## Zmiany

1. Dodano `js/testing/dev-tests-progress.js` jako osobny moduł UI postępu.
2. Rozszerzono `js/testing/shared/harness.js` o bezpieczny sink postępu i zdarzenia suite/test.
3. Podpięto ręczne emitowanie postępu w `js/testing/rozrys/tests.js`, bo ROZRYS ma własny runner i nie używa `H.runSuite`.
4. `js/testing/dev-tests-page.js` spina licznik z uruchomieniem testów oraz czyści sink po zakończeniu.
5. `dev_tests.html` dostał mały panel postępu z licznikiem `x/y`, nazwą sekcji i aktualnego testu.

## Granice

- Bez zmian runtime aplikacji.
- Bez zmian RYSUNKU.
- Bez zmian danych, storage, backupów i logiki testów.
- Zmiana dotyczy wyłącznie narzędzia developerskiego `dev_tests.html`.
