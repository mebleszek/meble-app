# OpenRouteService / odległość do klienta v1 — raport

Build: `20260613_openrouteservice_transport_diag_v1`
Paczka bazowa: `site_client_offer_preview_v1.zip`

## Zakres

Dodano darmowe przeliczanie trasy do klienta przez OpenRouteService/OpenStreetMap bez Google Maps API i bez płatnej integracji. Przeliczenie działa wyłącznie po kliknięciu przycisku **Przelicz trasę** w panelu inwestora.

## Zmienione moduły

- `js/app/investor/openrouteservice-transport.js` — nowy moduł geokodowania, wyznaczania trasy, statusów i hashy adresów.
- `js/app/investor/investor-transport.js` — panel inwestora, komunikaty, status/stale, zapis wyniku i ręczny fallback.
- `js/app/investor/investors-model.js` — normalizacja nowych pól `transport`.
- `js/app/investor/investor-editor-state.js` — ręczne km zachowują fallback i czyszczą metadane ORS.
- `js/app/ui/data-settings-company-view.js` — opis własnego darmowego klucza ORS i brak Google Maps API.
- `css/investor-form.css` — status/ostrzeżenie nieaktualnego wyniku.
- `index.html`, `dev_tests.html`, `tools/index-load-groups.js` — ładowanie modułu i cache-busting.
- `tools/openrouteservice-distance-smoke.js` — test z mockiem ORS.
- `README.md`, `DEV.md`, `CLOUD_MIGRATION.md` — dokumentacja.

## Testy

- `node tools/openrouteservice-distance-smoke.js`
- `node tools/company-transport-business-costs-smoke.js`
- `node tools/transport-catalog-quote-fix-smoke.js`
- `node tools/pricing-modes-calculation-coverage-smoke.js`

Test ORS nie wykonuje realnych zapytań do OpenRouteService.
