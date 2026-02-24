# DEV – Jak rozwijać aplikację bez psucia

Ten projekt ma **jedno źródło prawdy dla klików**: `data-action` + `Actions registry` w `js/app.js`.

## 1) Dodawanie nowej funkcji (przycisk/akcja)

1. W HTML dodaj element z atrybutem:
   - `data-action="moja-akcja"`
2. W `js/app.js` dopisz handler w `Actions registry` (w `initUI()`):
   - `Actions['moja-akcja'] = ({ event, el, target }) => { ...; return true; };`
3. Jeśli dodajesz nowy widok/modal z elementami wymaganymi do startu:
   - dopisz selektory do `window.APP_REQUIRED_SELECTORS` (fail-fast).

**Zasada:** nie dodawaj nowych `addEventListener('click', ...)` na przyciski. Klik jest tylko przez delegację.

## 2) Modale

Używaj `Modal` (stack-based) w `initUI()`:
- `Modal.openPrice('materials'|'services')`
- `Modal.closePrice()`
- `Modal.openCabinetAdd()`
- `Modal.closeCabinet()`
- `Modal.closeTop()` (ESC)

Dzięki temu:
- overlay click zamyka modal
- ESC zamyka aktualny modal
- brak click-through (klik pod spodem)

## 3) Reguły bezpieczeństwa UI

- Każdy element z `data-action` **musi mieć handler** w `Actions`.
  Jeśli nie ma – aplikacja rzuci błąd (banner w `boot.js`).
- Nie używaj `innerHTML` z danymi użytkownika (nazwy/symbole/opisy). Preferuj `textContent`.

## 4) Szybki check przed wrzutą na serwer (żeby nie wrócił SyntaxError)

Jeśli masz Node.js lokalnie:
```bash
node --check js/app.js
```

## 5) Co wrzucać na serwer po zmianach

Zwykle:
- `js/app.js`

Jeśli zmieniasz HTML (np. nowe `data-action`, nowe elementy):
- `index.html` + `js/app.js`
