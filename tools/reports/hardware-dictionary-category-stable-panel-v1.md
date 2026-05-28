# hardware-dictionary-category-stable-panel-v1

Baza: `site_hardware_dictionary_categories_details_body_fix_v1.zip`.

## Problem

Wspólny panel `Kategorie / rodzaje okuć` był poprawnie zbudowany w DOM, ale na telefonie renderował się jako pusta albo ucięta karta. Poprzednie poprawki powielały ten sam błąd: próbowały naprawiać objaw przez `max-height`, `overflow`, `details/open` albo klasy body ROZRYS.

## Decyzja

Panel kategorii nie korzysta już z mechaniki `details` ani z animowanego body ROZRYS. Został rozdzielony na:

- `hardware-dictionary-categories-card` — zewnętrzna karta z ramką/cieniem jak ROZRYS,
- `hardware-dictionary-categories-body` — zwykły nieanimowany kontener listy kategorii.

Body nie ma `max-height`, nie jest clipowane i nie dziedziczy klas `rozrys-material-accordion__body` ani `hardware-dictionary-section-body`.

## Zakres

- UI słowników okuć: panel `Kategorie / rodzaje okuć`.
- Testy regresji w `tools/app-dev-smoke.js`.
- Cache-busting `index.html` i `dev_tests.html`.

## Poza zakresem

Bez zmian w backupie, storage, imporcie/eksporcie, zamiennikach, PRO100, ROZRYS jako funkcji, RYSUNKU i WYCENIE.
