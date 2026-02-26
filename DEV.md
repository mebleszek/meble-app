# DEV — jak rozwijać aplikację (żeby jej nie psuć)

## 1) Dodawanie nowego przycisku / akcji UI

1. W HTML dodaj atrybut:
   - `data-action="twoja-akcja"`
2. W kodzie dopisz handler w ``js/app/actions-register.js` (Actions registry)` (plik `js/app/actions-register.js`) **albo** w przyszłości w module:
   - `FC.actions.register({ 'twoja-akcja': (ctx) => { ...; return true; } })`
3. Start aplikacji ma **fail-fast**: jeśli w HTML jest `data-action`, którego nie ma w Actions registry — zobaczysz błąd w czerwonym bannerze.

**Zasada:** nie dodajemy nowych `addEventListener('click', ...)` na pojedyncze przyciski. Klik jest obsługiwany delegacją + `data-action`.

## 2) Modale

Używamy `FC.modal` (plik `js/core/modals.js`):

- Otwieranie: `FC.modal.open('priceModal')`
- Zamykanie: `FC.modal.close('priceModal')` **lub** funkcja domenowa `closePriceModal()` (zarejestrowana w `FC.modal.register()`).

Wbudowane zabezpieczenia:
- klik w tło (overlay) zamyka modal,
- `ESC` zamyka ostatnio otwarty modal (stack),
- blokada scrolla jest wspólna.

## 3) Fail-fast DOM

Lista wymaganych elementów jest w `window.APP_REQUIRED_SELECTORS`.
Jeżeli po zmianach w HTML coś zniknie/zmieni ID — aplikacja nie wystartuje i pokaże listę braków w bannerze.

## 4) Minimalny check przed wrzutą na serwer

Jeśli masz Node:
- `node --check js/app.js`

To eliminuje 99% sytuacji typu `SyntaxError` na produkcji.

## 5) Konwencje

- Klikalne elementy: zawsze `data-action`.
- Dane użytkownika w UI: preferuj `textContent` / `createElement` zamiast `innerHTML`.

## 6) Struktura JS (ważne)

- `js/boot.js` – bezpieczny start + czerwony pasek błędów.
- `js/core/actions.js` – Actions registry (`data-action`).
- `js/core/modals.js` – modal manager.
- `js/app/bindings.js` – **same listenery** (delegacja `data-action` + listenery inputów). Wywoływane z `initUI()`.
- `js/app.js` – reszta logiki aplikacji (UI/render/obliczenia/dane).
