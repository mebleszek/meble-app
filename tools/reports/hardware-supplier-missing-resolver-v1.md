# Hardware supplier missing resolver v1 — 2026-05-12

## Baza

- Start: `site_hardware_import_resolver_supplier_gap_v1.zip`.
- Nie użyto odrzuconej paczki `site_hardware_excel_row_date_autofill_v1.zip`.

## Zakres

- Dodano rozpoznawanie wierszy `Ceny_dostawcow`, które pasują do istniejącego okucia po `okucie_id` albo danych użytkowych, mają cenę, ale nie mają rozpoznanego dostawcy.
- Taki wiersz trafia do resolvera braków jako `supplierPriceSupplier` i wymaga wyboru dostawcy z listy.
- Resolver nie ma przycisku dodawania dostawcy. Nowy dostawca musi być dodany wcześniej w programie albo w arkuszu `Dostawcy`.
- Po wyborze dostawcy standardowy import aktualizuje albo dodaje cenę przy okuciu po `item + supplier`.
- `Ignoruj wszystko` dla wpisów z brakującym dostawcą pomija wszystkie nierozwiązane ceny z brakującym/nieznanym dostawcą w tym imporcie.
- Pominięte przez resolver wiersze są liczone w `supplierPricesSkipped`.

## Pliki

- `js/app/catalog/hardware-catalog-supplier-price-xlsx.js`
- `js/app/catalog/hardware-catalog-import-export.js`
- `js/app/material/price-modal-hardware-import-resolver.js`
- `tools/app-dev-smoke.js`
- `index.html`, `dev_tests.html` — cache-busting

## Storage / chmura

- Brak nowych kluczy storage.
- Dane zostają w istniejących `fc_accessories_v1` i `fc_hardware_suppliers_v1`.
- Resolver działa przed planem zapisu, więc do katalogu nie trafia cena bez jawnie rozpoznanego dostawcy.
