# Transport catalog quote fix v1

Build: `20260611_transport_catalog_quote_fix_v1`
Package: `site_transport_catalog_quote_fix_v1.zip`

## Problem

Po edycji startowej pozycji **Transport do klienta** w cenniku mogła powstać druga pozycja z ceną użytkownika. Automatyczna WYCENA nadal szukała kanonicznego ID `transport_distance_km`; jeśli ten wpis miał cenę 0, transport nie pojawiał się w ofercie mimo kilometrów zapisanych przy inwestorze.

Dodatkowo próba usunięcia startowej pozycji była myląca, bo domyślne seedy programu odtwarzały ją przy następnym zapisie/migracji katalogu.

## Zmiany

- `js/app/pricing/labor-catalog.js`
  - dodano konsolidację domyślnych definicji po `id` oraz podpisie `kategoria + nazwa + quantitySource`,
  - cena użytkownika z duplikatu przechodzi na `transport_distance_km`,
  - eksport pomocniczy `isDefaultLaborDefinitionRow()` dla UI.
- `js/app/material/price-modal-persistence.js`
  - zapis edytowanej pozycji zachowuje ID edytowanego rekordu,
  - domyślnych definicji robocizny/transportu nie da się usuwać przez mylący przycisk.
- `js/app/material/price-modal-item-form.js`
  - przycisk Usuń jest ukryty dla domyślnych definicji cennika robocizny/transportu.
- `js/app/quote/quote-calculation-register.js`
  - linie z `sourceRole:'transport-distance'` / `quantitySource:'transport.distance_km'` trafiają do sekcji `transport`.
- `js/app/quote/quote-snapshot.js`
  - snapshot liczy osobny `totals.transport`.
- `js/app/wycena/wycena-tab-preview.js`
  - podsumowanie WYCENY pokazuje wiersz **Transport**.
- `js/app/wycena/wycena-summary-details-modal.js`
  - audyt sumy pokazuje transport jako osobny dział.
- `js/app/quote/quote-snapshot-store.js`
  - fingerprint ofert uwzględnia `totals.transport`, a kompaktowe linie zachowują pola źródła transportu.

## Poza zakresem

- Nie zmieniano OpenRouteService ani danych firmy.
- Nie zmieniano ręcznego wpisywania kilometrów przy inwestorze.
- Nie podłączano kosztów firmy do narzutu WYCENY.
- Nie ruszano robocizny szafek, automatów AGD, `drawer.count`, WYWIADU ani modala szafki.

## Testy

- `node --check` dla zmienionych plików JS — OK.
- `node tools/check-index-load-groups.js` — OK.
- `node tools/app-dev-smoke.js` — OK, 109/109.
- `node tools/company-transport-business-costs-smoke.js` — OK.
- `node tools/transport-catalog-quote-fix-smoke.js` — OK.
