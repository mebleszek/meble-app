# WYCENA — akordeony audytu 1:1 z Accordion ROZRYS + ruch v1

Paczka: `site_quote_details_accordion_rozrys_1to1_v1.zip`
Data: 2026-06-07

## Zakres

Poprawka dotyczy tylko modala szczegółów/audytu WYCENY.

Celem było usunięcie własnego układu akordeonów WYCENY i zastosowanie struktury oraz zachowania 1:1 ze wzorca `dev_ui_patterns.html → Accordion ROZRYS + ruch`.

## Zmiany

- Renderer sekcji audytu używa teraz struktury:
  - `rozrys-material-accordion`,
  - `rozrys-material-accordion__head`,
  - `rozrys-material-accordion__trigger`,
  - `rozrys-material-accordion__title`,
  - `rozrys-material-accordion__title-line1`,
  - `rozrys-material-accordion__title-line2`,
  - `rozrys-material-accordion__chevron`,
  - `rozrys-material-accordion__body`.
- Usunięto boczny wrapper `quote-detail-group__right` z kwotą i chevronem.
- Kwota sekcji jest pokazana w drugiej linii nagłówka razem z liczbą pozycji, dzięki czemu nagłówek nie ma osobnych proporcji WYCENY.
- Chevron nie ma już osobnego stylu WYCENY, więc nie powstaje podwójna strzałka.
- Animacja używa klasy `is-ui-pattern-animating`, tak jak wzorzec UI.
- Zewnętrzny akordeon ostrzeżeń ma ten sam wygląd co pozostałe akordeony; pomarańczowy styl został tylko na wewnętrznych komunikatach ostrzegawczych.

## Poza zakresem

Nie zmieniano:

- wyliczeń WYCENY,
- robocizny,
- `quoteCalculationRegister`,
- snapshotów/ofert,
- materiałów,
- zawiasów,
- wariantów szafek,
- import/export,
- backupów,
- storage.

## Testy

Uruchomiono:

- `node tools/quote-details-accordion-scroll-smoke.js`
- `node tools/quote-labor-single-truth-smoke.js`
- `node tools/quote-single-truth-pre-labor-smoke.js`
- `node tools/cabinet-hinge-quantity-kg-smoke.js`
- `node tools/cabinet-set-material-cutlist-smoke.js`
- `node tools/wycena-hinge-quote-replacement-flow-smoke.js`
- `node tools/wycena-snapshot-clean-store-smoke.js`
- `node tools/app-dev-smoke.js`
- `node -c js/app/wycena/wycena-summary-details-modal.js`
- `node -c tools/quote-details-accordion-scroll-smoke.js`

Wynik: OK.
