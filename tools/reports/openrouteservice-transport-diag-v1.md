# OpenRouteService transport diagnostics v1 — 2026-06-13

## Zakres

- Dodano diagnostykę geokodowania ORS w panelu inwestora.
- Rozdzielono widok surowej trasy z ORS od kilometrów do wyceny.
- Dodano wzór liczenia km do wyceny: tryb tam/powrót, zaokrąglenie i minimum.
- Dodano przycisk „Sprawdź w ORS”.
- Oczyszczono zapytanie geokodowania z numeru mieszkania/lokalu bez zmiany danych inwestora.

## Nietknięte obszary

- WYCENA poza odczytem `transport.distance_km`.
- PCV, oferta klienta, PDF, koszty firmy, stawki godzinowe, tryby naliczania ceny, `drawer.count`, automaty AGD, wymagania techniczne szafek, materiały i okucia.

## Testy

- `node tools/openrouteservice-distance-smoke.js`
- `node tools/company-transport-business-costs-smoke.js`
- `node tools/transport-catalog-quote-fix-smoke.js`
- `node tools/pricing-modes-calculation-coverage-smoke.js`
- `node tools/client-offer-preview-smoke.js`
- `node tools/pcv-front-color-mode-smoke.js`
- `node tools/labor-time-minutes-smoke.js`
- `node tools/app-dev-smoke.js`

Test ORS korzysta z mocka i nie wykonuje realnych zapytań do API.
