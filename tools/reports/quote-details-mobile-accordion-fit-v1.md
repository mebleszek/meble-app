# WYCENA — mobile akordeony audytu robocizny v1

Paczka: `site_quote_details_mobile_accordion_fit_v1.zip`

## Zakres

Poprawka dotyczy wyłącznie modala szczegółów/audytu WYCENY, szczególnie widoku `Robocizna szafek` na mobile.

## Zmiany

- Zwiększono użyteczny obszar mobile modala przez mniejszy górny offset i większy bufor scrolla w body.
- Nagłówek akordeonu audytu przeszedł z układu flex na grid `minmax(0,1fr) auto`, żeby lewa część z długim tytułem nie wchodziła w kwotę i chevron.
- Zwinięte akordeony mają osobną minimalną wysokość i brak dolnej kreski, żeby nie wyglądały jak przycięte.
- Tytuły akordeonów mają jawne `font-size` i `line-height`, a prawa część ma stałe minimum szerokości.
- Kliknięcie otwierające akordeon przewija sekcję do początku głównego scrolla body modala, co ogranicza widok półuciętych kart nad aktywną sekcją.

## Testy

- Rozszerzono `tools/quote-details-accordion-scroll-smoke.js` o kontrolę:
  - nowego cache-bustingu,
  - mobile offsetu modala,
  - minimalnych wysokości nagłówków,
  - jawnego line-height tytułów,
  - scrollowania otwartej sekcji po `offsetTop`.

## Poza zakresem

Nie zmieniano wyliczeń WYCENY, robocizny, `quoteCalculationRegister`, snapshotów, materiałów, zawiasów, wariantów szafek, import/export, backupów ani UI poza modalem szczegółów WYCENY.
