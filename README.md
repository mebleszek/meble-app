# meble-app
Program do wyceny mebli.

## Deploy (GitHub Pages)

Wrzucaj do repo paczkę ZIP zaczynającą się od `site` (np. `site.zip`, `site_v2.zip`, `site_fixed.zip`). Workflow wypakuje ZIP do roota, usunie ZIP i zrobi commit.

W paczce muszą być **wszystkie pliki repo** — bez wyjątków — w tym koniecznie `README.md` i `DEV.md`.

## Zasady pracy nad repo

- Nie zmieniać UI / układu / sposobu rysowania bez zgody użytkownika.
- Zawsze pracować na **ostatniej paczce ZIP zaczynającej się od `site`** wygenerowanej w rozmowie.
- `js/app.js` traktować jako bootstrap / klej, nie jako miejsce na kolejne szybkie dopiski domenowe.
- Nowe akcje UI dodawać przez `data-action` + `js/app/actions-register.js`.
- Rozwój Optimax prowadzić głównie w `js/app/rozrys.js` i `js/app/cut-optimizer.js`.
- Po każdej większej zmianie zaktualizować `DEV.md` (mapa aktywnych plików, legacy, checklista regresji).

## Mapa aktywnych plików (skrót)

### Start / core
- `js/boot.js` — preflight + banner błędów.
- `js/core/actions.js` — Actions registry + walidacja `data-action`.
- `js/core/modals.js` — wspólna obsługa modali.

### Aktywne moduły aplikacji
- `js/app/bindings.js` — delegacja klików + listenery inputów.
- `js/app/actions-register.js` — rejestracja wszystkich `data-action`.
- `js/app/views.js` / `js/app/sections.js` — przełączanie ekranów.
- `js/app/investor-ui.js` / `js/app/investors-store.js` / `js/app/investor-project.js` — inwestor i powiązanie z projektem.
- `js/app/session.js` / `js/app/storage.js` / `js/app/validate.js` — stan, zapis i walidacja danych.
- `js/app/rozrys.js` / `js/app/cut-optimizer.js` — Optimax / rozkrój.
- `js/app/magazyn.js` — magazyn.
- `js/tabs/*.js` — render i logika zakładek.
- `js/app.js` — bootstrap + klej + część starej logiki wymagającej stopniowego wydzielania.

Pełna mapa aktywnych plików, lista legacy i checklista regresji są w `DEV.md`.
