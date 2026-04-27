# RYSUNEK rebuild fix v1 — 2026-04-27

## Problem

Po paczce `rysunek dialogs/contracts v1` przycisk `Odbuduj z listy szafek` w zakładce RYSUNEK reagował wizualnie na kliknięcie, ale w części kontekstów nie wykonywał odbudowy.

## Przyczyna

Adapter `js/app/rysunek/rysunek-dialogs.js` zakładał, że `FC.confirmBox.ask()` zawsze zwraca Promise i wywoływał bezpośrednio `.then(...)`. Gdy potwierdzenie było dostarczone synchronicznie jako `true`, adapter wpadał w `catch` i zwracał `false`, więc akcja odbudowy cicho się anulowała.

Dodatkowo sam test kliknięcia wymagał bezpiecznego stubu zapisu przez `FC.layoutState.saveProject`, żeby nie opierać się na niejawnych bindingach testowego VM.

## Zmiany

- `js/app/rysunek/rysunek-dialogs.js`: wynik `FC.confirmBox.ask()` jest normalizowany przez `Promise.resolve(result)`, więc działa zarówno Promise, jak i wartość synchroniczna.
- `js/tabs/rysunek.js`: akcja odbudowy zapisuje przez lokalny helper `saveRysunekProject()`, który najpierw używa istniejącego `FC.layoutState.saveProject()`, a dopiero potem legacy `saveProject()`.
- `js/testing/rysunek/tests.js`: dodano test regresji dla przycisku `Odbuduj z listy szafek` z synchronicznym i asynchronicznym `confirmBox.ask()`.
- `index.html` i `dev_tests.html`: podbito cache-busting dla zmienionych plików RYSUNKU.

## Bez zmian

- Bez zmian UI.
- Bez zmian wyglądu.
- Bez zmian algorytmu ROZRYS.
- Bez zmian WYCENY.
- Bez zmian danych, storage i backupów.

## Testy wykonane

- `node --check js/app/rysunek/rysunek-dialogs.js` — OK.
- `node --check js/tabs/rysunek.js` — OK.
- `node --check js/testing/rysunek/tests.js` — OK.
- Izolowany smoke RYSUNEK — 5/5 OK, w tym regresja odbudowy.
- Manualne wywołanie `verifyIndex('index.html')` — 190 skryptów, 0 błędów.

## Testy nieukończone w środowisku narzędziowym

- `node tools/app-dev-smoke.js` nie zwrócił wyniku w czasie wykonania narzędzia.
- `node tools/rozrys-dev-smoke.js` nie zwrócił wyniku w czasie wykonania narzędzia.

Nie zostały oznaczone jako zaliczone. Zmiana jest ograniczona do RYSUNKU i została pokryta izolowanym testem regresji przycisku odbudowy.
