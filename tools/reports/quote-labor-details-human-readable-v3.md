# quote-labor-details-human-readable-v3

## Cel

Naprawić realny brak wyświetlania czasu, stawki i pełnego działania w modalu `Szczegóły robocizny szafek`, widoczny po wdrożeniu v2.

## Przyczyna

Renderer v2 zakładał, że dane szczegółowe robocizny będą dostępne w `row.raw`. W praktyce linie rejestru/snapshotów często mają czas bazowy, czas wyceniony i stawkę w istniejących polach `note` oraz `calculation`. Dlatego ekran pokazywał tylko `Dotyczy` i `Razem`, bez `Czas na 1 sztukę`, `Czas razem` i `Stawka`.

## Zakres zmiany

- Bez zmiany algorytmów liczenia.
- Bez przebudowy `quoteCalculationRegister`.
- Bez przebudowy działu CZYNNOŚCI i stawek.
- Renderer modala parsuje istniejące dane z `note` / `calculation` jako fallback prezentacyjny.
- Usunięto `?` przy pojedynczych liniach robocizny, bo główne wyliczenie jest teraz jawne.

## Testy

Uruchomione w paczce:

- `node --check js/app/wycena/wycena-summary-details-modal.js`
- `node tools/quote-labor-details-human-readable-smoke.js`
- `node tools/quote-details-accordion-scroll-smoke.js`
- `node tools/quote-labor-single-truth-smoke.js`
- `node tools/labor-rate-profiles-foundation-smoke.js`
- `node tools/quote-generate-helper-duplicate-regression-smoke.js`
- `node tools/app-dev-smoke.js`
