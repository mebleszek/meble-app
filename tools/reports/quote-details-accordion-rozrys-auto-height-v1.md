# WYCENA — akordeony audytu ROZRYS 1:1 z auto wysokością v1

## Cel

Doprowadzić akordeony w modalu szczegółów/audytu WYCENY do zachowania zgodnego z `Wzorce UI → Accordion ROZRYS + ruch`, bez przycinania zwiniętych nagłówków i rozwiniętej treści.

## Diagnoza

Wzorzec `Accordion ROZRYS + ruch` ma automatyczną wysokość treści po zakończeniu animacji. Mechanizm otwierania ustawia chwilowo `max-height` na `scrollHeight`, a po animacji czyści style inline, więc panel wraca do naturalnej wysokości.

Problem w WYCENIE nie wynikał z samego wzorca, tylko z kontenera modala: `quote-detail-modal__body` był flex-kolumną. Dzieci flex domyślnie mogą się kurczyć, więc przy wielu akordeonach przeglądarka ściskała zwinięte sekcje. Ponieważ akordeon ROZRYS ma `overflow:hidden`, nagłówki wyglądały jak ucięte do wąskich pasków.

## Zmiany

- `quote-detail-modal__body` zmieniono z `display:flex` na `display:block`, z zachowaniem głównego scrolla modala.
- Akordeony audytu dostały `flex:0 0 auto` jako zabezpieczenie, gdyby w przyszłości trafiły do kontenera flex.
- Odstępy między akordeonami przeniesiono na marginesy zgodne z układem wzorca: pierwszy element ma `margin-top:0`, kolejne `margin-top:12px`.
- Nie zmieniano struktury akordeonu, mechanizmu `scrollHeight/max-height`, chevrona ani linii WYCENY.

## Zakres nieruszony

Nie zmieniano logiki WYCENY, robocizny, `quoteCalculationRegister`, materiałów, zawiasów, snapshotów/ofert, import/export, backupów, storage ani wariantów szafek.

## Testy

- `tools/quote-details-accordion-scroll-smoke.js` pilnuje teraz, że body modala nie jest flex-kolumną i że akordeony nie mogą być ściskane przez flex layout.
