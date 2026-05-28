# hardware-form-price-wrapper-fix-v1

## Zakres

Hotfix po `site_hardware_supplier_pricing_v1.zip`: formularz dodawania/edycji akcesoriów/okuć odwoływał się do `formPriceWrapper()`, której brakowało po przebudowie formularza cenowego okuć.

## Zmiany

- Dodano lokalny helper `formPriceWrapper()` w `js/app/material/price-modal-item-form.js`.
- Zachowano ukrywanie starego prostego pola `Cena (PLN)` dla akcesoriów, bo akcesoria/okucia używają rozbudowanego modelu cenowego.
- Podbito cache-busting `price-modal-item-form.js` w `index.html` i `dev_tests.html`.
- Dodano kontrakt smoke chroniący otwieranie formularza okuć przed powrotem `ReferenceError: formPriceWrapper is not defined`.

## Poza zakresem

- Bez zmian modelu danych okuć.
- Bez zmian WYCENY, WYWIADU, MATERIAŁÓW, CZYNNOŚCI i RYSUNKU.
