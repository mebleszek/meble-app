# Hardware global VAT + import stabilization v1

Data: 2026-05-13
Baza: `site_hardware_price_change_confirmation_v1.zip`
Paczka: `site_hardware_global_vat_import_stabilization_v1.zip`

## Zakres

- Usunięto aktywny VAT dostawcy okuć z modelu, UI i eksportu XLSX.
- VAT okuć jest pobierany z globalnych ustawień cen okuć.
- Rabat pozostaje przy dostawcy.
- Import starych danych z VAT-em dostawcy ignoruje ten VAT i liczy po globalnym ustawieniu.
- Podgląd importu cen dostawców nie mutuje już katalogu przed zatwierdzeniem.

## Zmienione obszary

- `js/app/catalog/hardware-catalog.js`
- `js/app/catalog/catalog-store.js`
- `js/app/catalog/hardware-catalog-import-export.js`
- `js/app/catalog/hardware-catalog-supplier-price-xlsx.js`
- `js/app/material/price-modal-hardware-suppliers.js`
- `js/app/material/price-modal-hardware-supplier-prices.js`
- `js/app/material/price-modal-hardware-form.js`
- `js/app/material/price-modal-field-help.js`
- `tools/app-dev-smoke.js`
- `index.html`
- `dev_tests.html`

## Testy

- `node --check` dla zmienionych JS
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/rozrys-dev-smoke.js`
- `node tools/local-storage-source-audit.js`
- `node tools/dependency-source-audit.js`
- `node tools/wycena-architecture-audit.js`
- `unzip -t` gotowego ZIP-a

## Nie ruszano

- RYSUNEK
- WYWIAD
- MATERIAŁY
- WYCENA
- backupy
- snapshoty ofert
- automatyczna zamiana producentów
