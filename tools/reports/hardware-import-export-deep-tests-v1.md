# Hardware import/export deep tests v1 — 2026-05-14

## Baza

- Start: `site_hardware_import_export_refactor_v1.zip`.
- Odrzucona paczka `site_hardware_excel_row_date_autofill_v1.zip` nie była używana jako baza.

## Zakres

Dodano głęboką suite testów import/export okuć po refaktorze:

- `js/testing/material/accessories-import-export-deep-tests.js`,
- `tools/hardware-import-export-deep-smoke.js`.

Testy podpięto też do `dev_tests.html` przez `js/testing/material/tests.js`, więc `MATERIAŁY` w przeglądarce uruchamiają teraz także scenariusze import/export deep.

## Scenariusze objęte testami

1. Podgląd aktualizacji ceny nie mutuje `catalogStore`.
2. Podgląd dodania nowej ceny dostawcy nie mutuje `catalogStore`.
3. `applyImportPlan()` zapisuje zaakceptowaną aktualizację.
4. Wiersz `__skipImport` nie zapisuje ceny po apply.
5. Import identycznej ceny jest liczony jako `bez zmian`.
6. Różna nazwa z cennika nie nadpisuje nazwy katalogowej przy zgodnym `producent + symbol`.
7. Brakujący albo śmieciowy dostawca przy istniejącym okuciu trafia do resolvera.
8. Ten sam rekord z katalogu i arkusza `Okucia` nie blokuje resolvera dostawcy.
9. Nowe okucie z arkusza cen bez kategorii/jednostki wymaga resolvera.
10. Nowe okucie z pełnym wierszem cen tworzy pozycję i cenę bez ręcznego ID.
11. Literówka producenta nie tworzy producenta ani okucia.
12. `Do wyceny` przenosi ptaszek na nowego dostawcę dopiero po zatwierdzeniu.
13. Globalny VAT z ustawień liczy brakujące netto/brutto.
14. Rabat dostawcy jest zachowany po imporcie ceny.
15. `#REF!` nie jest ceną, ale poprawne drugie pole jest przeliczane.
16. Eksport dostawców i cen nie zawiera VAT-u dostawcy ani formuł w pustych wierszach cen.
17. Potwierdzenie `Zostaw starą` zwraca plan bez aktualizacji.
18. Potwierdzenie `Zaktualizuj` zostawia aktualizację w planie i zapisuje ją dopiero po `applyImportPlan()`.

## Wynik

- `node tools/hardware-import-export-deep-smoke.js` — `18/18 OK`.
- `FC.materialDevTests.runAll()` w symulacji Node — `63/63 OK`.
- `node tools/hardware-accessories-dev-smoke.js` — `39/39 OK`.

## Zmiany runtime

Brak. Paczka dodaje testy i narzędzie developerskie, bez zmiany UI, modelu danych ani logiki import/export runtime.
