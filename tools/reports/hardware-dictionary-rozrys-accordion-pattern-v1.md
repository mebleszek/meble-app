# Hardware dictionary ROZRYS accordion pattern v1

## Baza

`site_hardware_dictionary_category_content_single_open_v1.zip`

## Zakres

- Uzupełniono `dev_ui_patterns.html` w karcie `Accordion ROZRYS + ruch`.
- Wzorzec UI pokazuje teraz dokładny wygląd akordeonu z ROZRYSU oraz zachowanie ruchu: natychmiastowe zamknięcie starej sekcji i płynne otwarcie nowej.
- W `Słowniki okuć → Kategorie / rodzaje okuć` wspólny akordeon dostał rzeczywisty element `rozrys-material-accordion__chevron` zamiast lokalnej pseudo-strzałki.
- Ten sam akordeon korzysta z klas ROZRYS dla nagłówka, tytułów, body i chevrona.
- Dodano animację otwierania wspólnego akordeonu kategorii oraz natychmiastowe zamykanie, zgodnie z aktualnym UX mini-akordeonów parametrów.

## Decyzje

- Nie normalizowano pozostałych akordeonów w całej aplikacji.
- Nie zmieniano modelu danych, backupu, storage, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Zmiana zostaje przy wzorcu UI oraz przy aktualnie zgłoszonym akordeonie słowników okuć.

## Pliki

- `dev_ui_patterns.html`
- `js/app/material/price-modal-hardware-dictionaries.js`
- `css/price-item-popup.css`
- `tools/app-dev-smoke.js`
- `index.html`
- `dev_tests.html`
- `README.md`
- `DEV.md`

## Testy

- `node --check js/app/material/price-modal-hardware-dictionaries.js`
- `node --check tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/rozrys-dev-smoke.js`
