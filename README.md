# meble-app
Program do wyceny mebli

## Deploy (GitHub Pages)

Wrzucaj do repo plik `site.zip` (do roota). Workflow wypakuje ZIP do roota, usunie ZIP i zrobi commit.
W paczce `site.zip` powinny być **wszystkie pliki repo** (w tym `README.md` i `DEV.md`).

## Struktura JS (skrót)

- `js/boot.js` — preflight + banner błędów
- `js/core/actions.js` — Actions registry + walidacja `data-action`
- `js/app/bindings.js` — delegacja klików + listenery inputów
- `js/app/actions-register.js` — rejestracja wszystkich `data-action`
- `js/app.js` — logika aplikacji + render + modale


## Nowe moduły (2026-02-26)
- `js/app/ui-state.js` — stan UI (uiState) + zapis do localStorage.
- `js/app/views.js` — przełączanie widoków i tabów (rooms/app).
