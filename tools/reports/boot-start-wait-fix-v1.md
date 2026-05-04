# boot-start-wait-fix-v1

## Cel

Zmniejszyć ryzyko fałszywego błędu `Nie znaleziono funkcji startowej aplikacji` przy pierwszym wejściu po świeżym wdrożeniu, gdy cache jeszcze nie ma nowych skryptów i mobile ładuje pliki wolniej.

## Zmiany

- `js/boot.js` podniesiony do `boot-clean-1.5`.
- Boot czeka dłużej na funkcję startową i uwzględnia `window.load` oraz grace period.
- Usunięto krótki kontrakt `tries > 60` jako warunek pokazania błędu braku init.
- `index.html` ma podbity cache-busting `boot.js`.
- `tools/app-dev-smoke.js` ma statyczny kontrakt chroniący przed powrotem do krótkiego limitu.

## Zakres

Nie zmieniano danych, UI, katalogu okuć, robocizny, WYCENY, RYSUNKU ani PDF.
