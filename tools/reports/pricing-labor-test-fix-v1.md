# Pricing labor test fix v1

## Zakres

Naprawa za ciasnego testu `Migracja z preferStoredSplit trzyma zapisane listy rozdzielone mimo starych legacy danych` po dodaniu domyślnych definicji robocizny do katalogu `quoteRates`.

## Przyczyna

Po `pricing_labor_rules_v1` migracja zachowuje zapisane `quoteRates`, ale dodatkowo dokleja brakujące domyślne definicje robocizny przez `FC.laborCatalog.ensureDefaultDefinitions()`. Stary test oczekiwał dokładnie jednej zapisanej stawki, więc mylił poprawne dosianie definicji z utratą zapisanych danych.

## Zmiana

Test sprawdza teraz właściwy kontrakt:

- `stored_rate` nadal istnieje,
- `legacy_rate` ze starego klucza `services` nie jest wskrzeszany,
- `labor_rate_workshop` zostaje dołączony jako wymagana domyślna definicja nowego cennika robocizny.

## Runtime

Bez zmian runtime. Nie zmieniono UI, WYCENY, statusów, RYSUNKU, PDF ani storage aplikacji.
