# Cennik: poprawka otwierania formularza sposobów naliczania ceny v1

## Zakres

Poprawiono błąd zgłoszony po paczce `site_pricing_modes_v1.zip`:

```text
ReferenceError: formServicePriceWrapper is not defined
```

Błąd pojawiał się przy otwieraniu modala edycji pozycji w **Cenniku robocizny i usług**, bo `syncLaborPricingModeUi()` próbował ukrywać/pokazywać wrapper pola `formServicePrice`, ale w `price-modal-item-form.js` brakowało helpera `formServicePriceWrapper()`.

## Zmiany

- Dodano `formServicePriceWrapper()` obok pozostałych helperów wrapperów formularza.
- Nie zmieniono modelu danych ani kalkulatora trybów naliczania ceny.
- Nie zmieniono transportu, WYCENY, stawek godzinowych ani kosztów firmy.
- Dodano `tools/pricing-modes-form-service-price-fix-smoke.js`.

## Testy

- `node --check js/app/material/price-modal-item-form.js`
- `node tools/pricing-modes-form-service-price-fix-smoke.js`
- `node tools/pricing-modes-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/hourly-rates-settings-smoke.js`
- `node tools/transport-catalog-quote-fix-smoke.js`
