# Wywiad labor header compact v1

## Baza

- `site_wywiad_labor_header_status_v1.zip`

## Cel

Uprościć informację o czynnościach robocizny w nagłówku karty szafki w WYWIADZIE: nagłówek ma służyć jako szybki sygnał, a szczegółowe ilości zostają w rozwiniętym bloku `Czynności robocizny`.

## Zmiany

- `js/tabs/wywiad-labor-summary.js`
  - Linie nagłówka dla czynności pokazują teraz tylko nazwę czynności, np. `Czynności: Otwór fi 60`.
  - Usunięto dopisywanie ilości `×N` z nagłówka.
  - `getHeaderText()` nadal działa jako tekstowy fallback/test, ale też nie zawiera ilości czynności.

- `css/wywiad.css`
  - Status montażu zostaje zielony/czerwony.
  - Linie czynności w nagłówku dostały kolor pomarańczowy `#f97316`.
  - Nie zmieniano wielkości, wagi ani ogólnej typografii.

- `tools/app-dev-smoke.js`
  - Dodano regresję, że nagłówek nie zawiera `×2` ani `×3`.
  - Dodano kontrakt koloru pomarańczowego dla czynności w nagłówku.

- `index.html`, `dev_tests.html`
  - Zaktualizowano cache-busting zmienionych zasobów.

## Poza zakresem

Nie ruszano panelu `Kategorie / rodzaje okuć`, backupów, storage, import/export Excel, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani pełnego resolvera katalogowych pozycji okuć do WYCENY.
