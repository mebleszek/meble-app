# meble-app
Program do wyceny mebli

## Deploy (GitHub Pages)

Wrzucaj do repo plik `site.zip` (do roota). Workflow wypakuje ZIP do roota, usunie ZIP i zrobi commit.
W paczce `site.zip` powinny być **wszystkie pliki repo** (w tym `README.md` i `DEV.md`).


## Struktura JS (skrót)
- `js/app/bindings.js` — eventy UI (`data-action`)
- `js/app/actions-register.js` — mapa akcji (Actions registry)
- `js/app.js` — główna logika
