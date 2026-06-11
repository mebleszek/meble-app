# Company transport / WYCENA core boot fix v1

Build: `20260611_company_transport_wycena_core_boot_fix_v1`

## Cel

Usunięto błąd pierwszego startu po wdrożeniu, w którym `wycena-core.js` mógł przerwać boot aplikacji komunikatem o braku modułów `FC.wycenaCore*`.

## Zmiany

- `js/app/wycena/wycena-core.js` nie rzuca już wyjątku podczas samego ładowania pliku, jeżeli zależności WYCENY chwilowo nie są jeszcze dostępne.
- Zależności `FC.wycenaCoreSelection`, `FC.wycenaCoreCatalog`, `FC.wycenaCoreSource`, `FC.wycenaCoreMaterialPlan`, `FC.wycenaCoreOffer`, `FC.wycenaCoreLines` i `FC.wycenaCoreLabor` są sprawdzane dopiero przy realnym użyciu API WYCENY.
- Publiczne API `FC.wycenaCore` zostaje dostępne od razu, więc `boot-clean` nie powinien wyświetlać czerwonego błędu przy pierwszym czystym wejściu po deployu.
- Dodano diagnostyczne `FC.wycenaCore._debugMissingDeps()` do szybkiego sprawdzenia brakujących zależności bez zabijania startu aplikacji.

## Zakres nietknięty

- Nie zmieniono liczenia WYCENY, robocizny, materiałów, transportu, kosztów firmy ani danych inwestora.
- Nie zmieniono kolejności skryptów w `index.html` poza cache-bustingiem.
- Nie dodano nowego storage ani migracji danych.

## Testy

- `node --check js/app/wycena/wycena-core.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js` — 109/109 OK
- `node tools/company-transport-business-costs-smoke.js`
