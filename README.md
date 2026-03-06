# meble-app
Program do wyceny mebli i rozwijania modułów projektowania / rozkroju.

## Zasady pracy nad repo

- Nie zmieniać UI ani sposobu prezentacji bez zgody użytkownika.
- Po każdej serii zmian przygotować pełny `site.zip` z całą strukturą repo.
- W paczce zawsze muszą być `README.md` i `DEV.md`.
- Kolejne zmiany robić zawsze na ostatnim ZIP-ie wygenerowanym w rozmowie.

## Deploy (GitHub Pages)

Do repo trafia pełna paczka `site.zip` w root.
Workflow wypakuje ZIP do roota, usunie ZIP i zrobi commit.

## Główne aktywne pliki

- `index.html` — struktura widoków i kolejność ładowania skryptów
- `js/boot.js` — preflight + banner błędów
- `js/core/actions.js` — Actions registry + walidacja `data-action`
- `js/core/modals.js` — obsługa modali
- `js/app/bindings.js` — delegacja klików + listenery
- `js/app/actions-register.js` — rejestr akcji UI
- `js/app.js` — główny klej aplikacji; renderery `WYWIAD`, `MATERIAŁ` i `RYSUNEK` są już przeniesione do `js/tabs/*`
- stary, nieużywany helper listy wykończeń RYSUNKU został usunięty z `js/app.js`
- `js/app/rozrys.js` — zakładka rozrysu / Optimax
- `js/app/cut-optimizer.js` — silnik rozkroju

## Uwaga architektoniczna

Repo zawiera też pliki pomocnicze / historyczne, które nie zawsze są bezpośrednio ładowane przez `index.html`.
Przed edycją zawsze trzeba sprawdzić, czy plik jest aktywnym entrypointem, workerem, czy legacy.

Szczegóły utrzymywać i aktualizować w `DEV.md`.
