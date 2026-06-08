# WYCENA — ludzkie szczegóły robocizny szafek v1

Paczka wynikowa: `site_quote_labor_details_human_readable_v1.zip`

## Zakres

- Poprawiono wyłącznie prezentację modala szczegółów/audytu WYCENY dla sekcji `Robocizna szafek`.
- Nagłówek sekcji robocizny dostał język użytkowy: `Szczegóły robocizny szafek` oraz `Sprawdź, co zostało policzone i skąd wzięła się kwota.`.
- Podsumowanie akordeonu szafki pokazuje `czynność/czynności razem = ... zł`, bez skrótu `poz.`.
- Linie robocizny pokazują układ: `Dotyczy`, `Czas`, `Stawka`, `Razem`.
- Dla montażu frontów renderer używa istniejącej notatki źródłowej do wyciągnięcia liczby i wymiaru frontów, ale nie pokazuje technicznego tekstu `Fronty z MATERIAŁ/WYCENA` w głównym opisie.
- Widok dla człowieka używa `zł`, przecinka dziesiętnego i znaku `×`.
- Komunikat ceny startowej jest mapowany w widoku na: `To jest stawka startowa. Przed wysłaniem oferty sprawdź ją w cenniku.`.

## Celowo bez zmian

- Brak zmian w algorytmach WYCENY.
- Brak zmian w `quoteCalculationRegister` poza odczytem istniejących danych do renderu.
- Brak zmian w dziale CZYNNOŚCI.
- Brak zmian w materiałach, okuciach, AGD, szafkach, stawkach i snapshotach ofert.
- Brak nowych trwałych kluczy storage.

## Testy

- Dodano `tools/quote-labor-details-human-readable-smoke.js`.
- Zaktualizowano cache-busting w `index.html`, `dev_tests.html` i smoke testach.
- Uruchomiono:
  - `node tools/quote-labor-details-human-readable-smoke.js`
  - `node tools/quote-details-accordion-scroll-smoke.js`
  - `node tools/quote-labor-single-truth-smoke.js`
  - `node tools/labor-rate-profiles-foundation-smoke.js`
  - `node tools/quote-generate-helper-duplicate-regression-smoke.js`
  - `node tools/app-dev-smoke.js`
