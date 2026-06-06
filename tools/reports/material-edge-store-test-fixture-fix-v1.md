# material-edge-store-test-fixture-fix-v1

## Zakres

Poprawiono wyłącznie test przeglądarkowy MATERIAŁU, który sprawdza wydzielony model danych i edge store.

## Przyczyna

Test podstawiał część z materiałem `Biały test`. Po obecnej polityce programu okleina/PCV ma być liczona tylko dla laminatu, więc taki niejednoznaczny materiał nie jest kwalifikowany do edge store. To dawało fałszywy błąd:

```text
Model materiałów nie policzył okleiny z edge store
```

## Zmiana

Fixture testu używa teraz materiału `Laminat test`, czyli jawnie kwalifikującego się do okleiny. Komunikat asercji został doprecyzowany, że chodzi o jawny laminat.

## Pliki

- `js/testing/material/tests.js`
- `dev_tests.html`
- `DEV.md`
- `README.md`
- `tools/reports/material-edge-store-test-fixture-fix-v1.md`

## Niezmienione

Nie zmieniano logiki runtime aplikacji, renderu MATERIAŁÓW, WYCENY, zawiasów, PRO100, backupów, import/export ani snapshotów ofert.
