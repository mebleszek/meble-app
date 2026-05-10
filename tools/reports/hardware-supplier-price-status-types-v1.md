# Hardware supplier price status/types v1 — raport

## Baza

Start: `site_wycena_core_cache_fix_v1.zip`.

## Zakres

- Wiele cen dostawców przy okuciu zostało doprecyzowane o per-cenę: status ceny, data, netto/brutto i dokładnie jeden wybór `Do wyceny`.
- Globalne widoczne pole statusu w formularzu okucia zostało zastąpione polem `Typ / cecha`.
- Dodano edytowalne słowniki kategorii okuć i typów/cech technicznych z ręcznym przypisaniem typów do dozwolonych kategorii.
- Import/export XLSX dostał arkusze słowników oraz status ceny w `Ceny_dostawcow`.
- Dodano walidację unikalności `producent + kategoria + typ/cecha`.

## Pliki kluczowe

- `js/app/catalog/hardware-catalog.js`
- `js/app/catalog/catalog-store.js`
- `js/app/catalog/catalog-storage-policy.js`
- `js/app/catalog/hardware-catalog-supplier-price-xlsx.js`
- `js/app/catalog/hardware-catalog-import-export.js`
- `js/app/material/price-modal-hardware-supplier-prices.js`
- `js/app/material/price-modal-hardware-dictionaries.js`
- `js/app/material/price-modal-hardware-form.js`
- `js/app/material/price-modal-persistence.js`
- `css/price-item-popup.css`

## Antyregresja

- Nie przywracać globalnego statusu ceny jako widocznego pola formularza okucia.
- `Do wyceny` pozostaje wyborem 1 z wielu cen dostawców.
- `Typ / cecha` ma pochodzić z edytowalnego słownika i być filtrowany po kategorii.
- `Ceny_dostawcow` ma nadal umożliwiać duplikowanie wiersza i zmianę dostawcy/ceny bez ręcznego pilnowania ID ceny.
