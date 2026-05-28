# Hardware supplier import + dictionary UX fix v1 — 2026-05-11

## Baza

- Start: `site_hardware_supplier_price_import_fix_v1.zip`.
- Wyjście: `site_hardware_supplier_import_dictionary_ux_fix_v1.zip`.

## Zakres

- Import `Ceny_dostawcow`: widoczna kolumna `dostawca` ma pierwszeństwo przed technicznym `dostawca_id`, gdy użytkownik skopiuje wiersz w Excelu/Google Sheets i zmieni tylko nazwę dostawcy oraz cenę.
- Import cen: brakujące netto/brutto nadal liczy się według VAT dostawcy; `#REF!` i inne błędy arkusza nie są traktowane jako ceny.
- Słowniki okuć: poprawiony stan akcji `Wyjdź` vs `Anuluj`/`Zapisz`, zapis odświeża formularz i migruje istniejące tekstowe użycia zmienionej nazwy typu/cechy.
- Typ / cecha: opcje już zajęte przez tego samego producenta w tej samej kategorii są blokowane w pickerze przed zapisem.
- Lista okuć: przycisk `Edytuj` jest niski i umieszczony w linii statusu ceny.

## Dane/chmura

- Bez nowych kluczy storage.
- Ceny dostawców nadal są w `supplierPrices` przy pozycji w `fc_accessories_v1`.
- Słowniki pozostają w `fc_hardware_categories_v1` i `fc_hardware_types_v1`.

## Testy

- `node --check` dla zmienionych plików JS.
- `node tools/check-index-load-groups.js`.
- `node tools/app-dev-smoke.js`.
- `node tools/rozrys-dev-smoke.js`.
- `node tools/local-storage-source-audit.js`.
- `node tools/dependency-source-audit.js`.
- `node tools/wycena-architecture-audit.js`.
- `unzip -t` gotowego ZIP-a.
