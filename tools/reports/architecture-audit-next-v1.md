# Architecture audit — next v1

Data: 2026-04-26

Zakres tej paczki: audyt techniczny po naprawie Wyceny oraz jedna bezpieczna poprawka testowa bez zmian UI, danych użytkownika i backupów.

## Największe pliki JS / tooling

| Linie | Plik |
|---:|---|
| 1459 | `js/tabs/rysunek.js` |
| 903 | `js/testing/investor/tests.js` |
| 842 | `js/app/rozrys/rozrys.js` |
| 838 | `js/app/cabinet/cabinet-fronts.js` |
| 835 | `js/testing/project/tests.js` |
| 814 | `js/tabs/wycena.js` |
| 806 | `js/testing/cabinet/tests.js` |
| 791 | `js/app.js` |
| 786 | `js/app/optimizer/speed-max.js` |
| 693 | `js/app/cabinet/cabinet-modal-set-wizard.js` |
| 659 | `js/app/quote/quote-snapshot-store.js` |
| 653 | `js/app/wycena/wycena-core.js` |
| 650 | `js/app/cabinet/cabinet-modal.js` |
| 644 | `js/app/project/project-status-sync.js` |
| 643 | `js/testing/wycena/suites/central-status-sync.js` |
| 610 | `js/app/investor/investors-store.js` |
| 592 | `js/app/investor/investor-ui.js` |
| 493 | `js/app/rozrys/rozrys-render.js` |
| 489 | `js/app/quote/quote-scope-entry.js` |
| 458 | `js/testing/rozrys/tests.js` |

## Wniosek z audytu

- Największe ryzyka architektoniczne nadal są w dużych plikach runtime (`rysunek.js`, `rozrys.js`, `wycena.js`, `app.js`) oraz w dużych suite’ach smoke.
- Na ten etap nie wprowadzono dużego splitu runtime, bo ostatnie prace dotyczyły Wyceny/statusów i najpierw trzeba utrzymać zielone testy.
- Bezpieczna poprawka w tej paczce dotyczy tylko smoke ROZRYS: test domyślnego obrównania 1 cm / 10 mm jest teraz chroniony również w bezpośrednim `rozrys-dev-smoke`, a runner ładuje jawnie zależność `rozrys-stock.js`.

## Co dalej

1. Kolejny sensowny krok: osobna paczka pod stabilizację/split testów Wyceny albo status sync, bez ruszania UI.
2. Duże refaktory runtime robić dopiero po potwierdzeniu zielonych smoke testów i z małym zakresem.
3. Backupów nie ruszać; limit localStorage traktować jako ograniczenie lokalnego trybu pracy do czasu chmury.
