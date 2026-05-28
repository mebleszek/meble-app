# Hardware price change confirmation v1 — 2026-05-13

## Baza

- Start: `site_hardware_missing_supplier_duplicate_fix_v1.zip`.
- Odrzucona paczka `site_hardware_excel_row_date_autofill_v1.zip` nie została użyta.

## Zakres

- Dodano jawne potwierdzanie nowych i aktualizowanych cen dostawców podczas importu `Ceny_dostawcow`.
- Plan importu przechowuje `supplierPriceChanges`: typ zmiany, wiersz Excela, okucie, dostawcę, starą cenę, nową cenę i informację o `Do wyceny`.
- Nowy moduł UI `price-modal-hardware-price-confirm.js` pokazuje pytanie: dodać nową cenę albo zaktualizować cenę dostawcy, z akcjami pojedynczymi i hurtowymi.

## Ograniczenia

- Zmiana nie dotyka WYCENY ani snapshotów ofert.
- Nie tworzy nowych dostawców i nie zmienia logiki wyboru dostawcy w resolverze.
- Nie wykonano dużego splitu import/export; pozostaje dług techniczny przy plikach `hardware-catalog-import-export.js` i `hardware-catalog-supplier-price-xlsx.js`.

## Testy

- `node --check` dla zmienionych JS.
- `node tools/check-index-load-groups.js`.
- `node tools/app-dev-smoke.js` z nowym kontraktem potwierdzeń cen.
- Pozostałe audyty przed paczką w finalnym logu wydania.
