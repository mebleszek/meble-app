# meble-app
Program do wyceny mebli

## Deploy (GitHub Pages)

Wrzucaj do repo plik `site.zip` (do roota). Workflow wypakuje ZIP do roota, usunie ZIP i zrobi commit.
W paczce `site.zip` powinny być **wszystkie pliki repo** (w tym `README.md` i `DEV.md`).

## Zasady pracy nad repo

- Nie zmieniaj UI ani sposobu rysowania bez zgody.
- Pracuj zawsze na ostatnim wygenerowanym `site.zip`.
- Po każdej serii zmian wydawaj kompletny `site.zip` z całą strukturą repo.
- Nowe akcje UI dodawaj przez `data-action` + `js/app/actions-register.js`, nie przez przypadkowe pojedyncze listenery.
- Rozwój Optimax prowadź głównie w `js/app/rozrys.js` i `js/app/cut-optimizer.js`.
- Przed wydaniem sprawdź checklistę regresji z `DEV.md`.

## Struktura JS (skrót)

### Aktywne skrypty
- `js/boot.js` — preflight + banner błędów
- `js/core/actions.js` — Actions registry + walidacja `data-action`
- `js/core/modals.js` — modal manager
- `js/app/bindings.js` — delegacja klików + listenery inputów
- `js/app/actions-register.js` — rejestracja wszystkich `data-action`
- `js/app.js` — logika aplikacji + render + modale
- `js/app/investor-ui.js` — aktywne UI inwestora
- `js/app/investor-project.js` — separacja projektu per inwestor
- `js/app/rozrys.js` — zakładka ROZRYS / Optimax
- `js/app/cut-optimizer.js` — silnik rozkroju
- `js/app/magazyn.js` — magazyn płyt

### Legacy / nieaktywne na dziś
- `js/app/inwestor.js`
- `js/app/calc.js`
- `js/app/schema.js`
- `js/app/migrate.js`

Szczegóły: patrz `DEV.md`.
