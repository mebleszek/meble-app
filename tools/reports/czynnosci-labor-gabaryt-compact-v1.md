# Raport: site_czynnosci_labor_gabaryt_compact_v1

## Zakres

- Zabezpieczenie reguł robocizny przed nieświadomym podwójnym naliczaniem gabarytu.
- Kompaktowa typografia rozpiski kalkulacji w zakładce `CZYNNOŚCI`.
- Czytelniejszy opis `gabarytoczasu` w podglądzie: przy trybie `h/m³` pokazuje wzór objętość × h/m³ = czas.

## Decyzja

Jeśli reguła ma aktywny `gabarytoczas` i generuje dodatkowy czas, `volumePricePerM3` nie zwiększa ceny. Dla użytkownika oznacza to wybór jednego sposobu liczenia gabarytu:
- gabaryt jako czas,
- albo gabaryt jako dopłata kwotowa.

## Pliki

- `js/app/pricing/labor-catalog.js`
- `js/app/material/price-modal-item-form.js`
- `js/app/material/price-modal-field-help.js`
- `js/app/wycena/wycena-core-labor.js`
- `js/tabs/czynnosci.js`
- `css/quote-labor-picker.css`
- `css/price-item-popup.css`
- `tools/app-dev-smoke.js`
