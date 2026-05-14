# Hardware import/export refactor v1 — 2026-05-14

## Baza

- Start: `site_hardware_accessory_tests_v1.zip`.
- Odrzucona paczka `site_hardware_excel_row_date_autofill_v1.zip` nie była używana.

## Zakres

Refaktor bez zmiany UI i bez celowej zmiany zachowania importu/exportu okuć.

## Nowy podział modułów

### Ceny dostawców

- `js/app/catalog/hardware-supplier-price-export.js` — eksport arkusza `Ceny_dostawcow`, kolumny, puste wiersze i walidacje XLSX.
- `js/app/catalog/hardware-supplier-price-import.js` — parser wierszy, dopasowanie okucia/dostawcy, resolvery braków, diff i aplikowanie cen.
- `js/app/catalog/hardware-catalog-supplier-price-xlsx.js` — cienka fasada zachowująca dotychczasowe publiczne API `FC.hardwareSupplierPriceXlsx`.

### Import/export katalogu okuć

- `js/app/catalog/hardware-catalog-export-xlsx.js` — snapshot, eksport JSON/XLSX, arkusze i walidacje.
- `js/app/catalog/hardware-catalog-import-parser.js` — parser JSON/XLSX bez zapisu i bez decyzji importu.
- `js/app/catalog/hardware-catalog-import-plan.js` — plan importu, walidacja, diff, resolvery danych i finalny zapis.
- `js/app/catalog/hardware-catalog-import-export.js` — cienka fasada zachowująca dotychczasowe publiczne API `FC.hardwareCatalogImportExport`.

## Zachowane kontrakty

- Import po `producent + symbol` bez ręcznego ID.
- Wiele cen dostawców dla jednego okucia.
- Brak tworzenia dostawcy w resolverze importu.
- Brak tworzenia producenta z literówki.
- Nowe okucie z `Ceny_dostawcow` wymaga kategorii i jednostki.
- Podgląd importu nie mutuje katalogu przed zatwierdzeniem.
- Globalny VAT pozostaje w ustawieniach, rabat pozostaje przy dostawcy.
- Publiczne fasady `FC.hardwareCatalogImportExport` i `FC.hardwareSupplierPriceXlsx` zostają kompatybilne.

## Testy

Dodano testy architektoniczne w:

- `tools/app-dev-smoke.js`,
- `js/testing/material/accessories-tests.js`.

Sprawdzają, że publiczne fasady delegują do rozdzielonych modułów i że nowe moduły są w load-order.

