# Wywiad labor header status v1 — 2026-05-26

## Baza

- Baza startowa: `site_fridge_single_front_hinges_fix_v1.zip`.
- Nowa paczka: `site_wywiad_labor_header_status_v1.zip`.

## Zakres

- Poprawiono podgląd montażu sprzętu i dodatkowych czynności na karcie szafki w zakładce WYWIAD.
- Status `Montaż sprzętu: bez montażu` jest wyróżniony na czerwono.
- Status `Montaż sprzętu: <nazwa sprzętu>` przy włączonym montażu jest wyróżniony na zielono.
- Dodatkowe czynności robocizny w nagłówku karty szafki są renderowane w osobnych liniach, zamiast jednej linii rozdzielonej przecinkami albo kropką.
- Zachowano dotychczasową wagę, wielkość i układ czcionek; zmieniono tylko kolor statusu i rozbicie tekstu na linie.
- Rozszerzono podgląd szczegółowy `Czynności robocizny`, żeby status montażu miał spójny czerwony/zielony kolor.

## Zmienione pliki

- `js/tabs/wywiad-labor-summary.js`
- `js/tabs/wywiad.js`
- `css/wywiad.css`
- `tools/app-dev-smoke.js`
- `index.html`
- `dev_tests.html`
- `README.md`
- `DEV.md`

## Testy regresji

- `app-dev-smoke` sprawdza teraz:
  - istnienie `renderHeaderSummary` i `getHeaderLines`,
  - osobne linie dla kolejnych czynności robocizny,
  - czerwony status bez montażu,
  - zielony status z montażem.

## Poza zakresem

Nie ruszano:

- panelu `Kategorie / rodzaje okuć`,
- animacji panelu kategorii,
- backupów i retencji,
- storage,
- import/export Excel,
- PRO100,
- usług stolarskich,
- ROZRYS,
- RYSUNKU,
- pełnego resolvera katalogowych okuć do WYCENY.
