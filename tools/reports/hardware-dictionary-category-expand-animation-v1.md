# Hardware dictionary category expand animation v1

## Baza

- Start: `site_hardware_dictionary_category_stable_panel_v1.zip`
- Wynik: `site_hardware_dictionary_category_expand_animation_v1.zip`

## Zakres

- Dodano płynne otwieranie wspólnego panelu `Kategorie / rodzaje okuć` w modalu `Słowniki okuć`.
- Zamknięcie panelu pozostaje natychmiastowe.
- Otwarty stan końcowy body kategorii jest zwykły: bez trwałego `max-height`, bez `overflow:hidden`, bez klas `rozrys-material-accordion__body` i `hardware-dictionary-section-body`.
- Ramka zewnętrzna pozostaje spójna ze wzorcem ROZRYS.

## Zabezpieczenia

- Nie dodano nowych kluczy storage.
- Nie zmieniano backupu, import/export Excel, zamienników, PRO100, usług, ROZRYS, RYSUNKU ani WYCENY.
- `app-dev-smoke` pilnuje pełnej zawartości listy kategorii po zamknięciu i ponownym otwarciu oraz obecności nowej klasy animacji `hardware-categories-animating`.

## Testy

- `node --check js/app/material/price-modal-hardware-dictionaries.js`
- `node --check tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/rozrys-dev-smoke.js`
- `node tools/local-storage-source-audit.js`
- `node tools/dependency-source-audit.js`
- `node tools/wycena-architecture-audit.js`
- `node tools/hardware-accessories-dev-smoke.js`
- `node tools/hardware-import-export-deep-smoke.js`
- `node tools/service-pro100-dev-smoke.js`
