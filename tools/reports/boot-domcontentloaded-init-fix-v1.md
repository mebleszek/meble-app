# boot-domcontentloaded-init-fix-v1

## Cel

Usunąć fałszywy błąd pierwszego uruchomienia po świeżym wdrożeniu: `Nie znaleziono funkcji startowej aplikacji` z `boot-clean-1.5`.

## Diagnoza

`boot.js` jest pierwszym skryptem `defer` w `index.html`. Przy takim ładowaniu przeglądarka potrafi ustawić `document.readyState` na `interactive`, chociaż kolejne deferred scripts nadal się wykonują. Poprzedni boot startował już w tym stanie i mógł szukać `FC.init()` przed dojściem do `app.js`. Na pierwszym wejściu, gdy pliki nie były jeszcze w cache, timeout mógł pokazać czerwony błąd. Po odświeżeniu pliki ładowały się szybciej i problem znikał.

## Zmiany

- `js/boot.js` podniesiony do `boot-clean-1.6`.
- Start aplikacji jest wykonywany dopiero po `DOMContentLoaded` albo gdy dokument jest już `complete`.
- Raport `Nie znaleziono funkcji startowej aplikacji` wymaga `window.load`; timeout liczony jest od `loadAt`, nie od pierwszego wykonania `boot.js`.
- Wczesne listenery błędów zostają bez zmian, więc realne `SyntaxError` i błędy Promise nadal pojawią się w czerwonym bannerze.
- `index.html` ma nowy cache-busting `20260611_boot_domcontentloaded_init_fix_v1`.
- Dodano test `tools/boot-domcontentloaded-init-fix-smoke.js` i zaktualizowano kontrakt w `tools/app-dev-smoke.js`.

## Zakres

Nie zmieniano transportu, WYCENY, inwestora, kosztów firmy, robocizny, danych, snapshotów, `drawer.count`, katalogów ani UI.
