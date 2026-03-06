# DEV — jak rozwijać aplikację (żeby jej nie psuć)

## 0) Stałe zasady pracy nad repo

- Nie zmieniamy UI / układu / sposobu rysowania bez zgody użytkownika.
- Bazą do kolejnych zmian jest zawsze **ostatni ZIP zaczynający się od `site`** wygenerowany w rozmowie.
- Po każdej serii zmian wydajemy **kompletną paczkę ZIP z pełną strukturą repo**, koniecznie z `README.md` i `DEV.md`.
- Przed większym rozwojem najpierw utrzymujemy porządek: mapa aktywnych plików, legacy, checklista regresji.

## 1) Zasady anty-rozrostowe dla `js/app.js`

`js/app.js` ma być tylko **bootstrapem i klejem**. Nie dokładamy tam ciężkiej logiki domenowej tylko dlatego, że plik jest pod ręką.

Twarde reguły:
- nowa funkcja trafia od razu do właściwego modułu,
- jedna odpowiedzialność na plik,
- nowe akcje UI dodajemy przez `data-action` + Actions registry,
- przed dodaniem feature ustalamy osobno: render, akcję, zapis danych i obliczenia,
- robimy regularne małe refaktory zamiast czekać aż plik urośnie absurdalnie,
- przed wydaniem sprawdzamy, czy `app.js` nie dostał kolejnej dużej funkcji i czy nie doszły luźne `onclick` / duplikacje.

## 2) Dodawanie nowego przycisku / akcji UI

1. W HTML dodaj atrybut:
   - `data-action="twoja-akcja"`
2. W kodzie dopisz handler w `js/app/actions-register.js` (Actions registry) **albo** w przyszłości w module:
   - `FC.actions.register({ 'twoja-akcja': (ctx) => { ...; return true; } })`
3. Start aplikacji ma **fail-fast**: jeśli w HTML jest `data-action`, którego nie ma w Actions registry — zobaczysz błąd w czerwonym bannerze.

**Zasada:** nie dodajemy nowych `addEventListener('click', ...)` na pojedyncze przyciski, jeśli wystarczy delegacja + `data-action`.

## 3) Modale

Używamy `FC.modal` (plik `js/core/modals.js`):

- Otwieranie: `FC.modal.open('priceModal')`
- Zamykanie: `FC.modal.close('priceModal')` **lub** funkcja domenowa `closePriceModal()` (zarejestrowana w `FC.modal.register()`).

Wbudowane zabezpieczenia:
- klik w tło (overlay) zamyka modal,
- `ESC` zamyka ostatnio otwarty modal (stack),
- blokada scrolla jest wspólna.

## 4) Fail-fast DOM

Lista wymaganych elementów jest w `window.APP_REQUIRED_SELECTORS`.
Jeżeli po zmianach w HTML coś zniknie / zmieni ID — aplikacja nie wystartuje i pokaże listę braków w bannerze.

## 5) Minimalny check przed wrzutą na serwer

Jeśli masz Node:
- `node --check js/app.js`

To eliminuje najczęstsze `SyntaxError` na produkcji.

## 6) Konwencje

- Klikalne elementy: zawsze `data-action`.
- Dane użytkownika w UI: preferuj `textContent` / `createElement` zamiast `innerHTML`.
- Nie dokładamy nowej logiki do `app.js`, jeśli istnieje już właściwy moduł domenowy.

## 7) Mapa aktywnych plików (źródło prawdy)

### Start / core
- `js/boot.js` — bezpieczny start + czerwony pasek błędów.
- `js/core/actions.js` — Actions registry + walidacja `data-action` (fail-fast).
- `js/core/modals.js` — modal manager.

### App: aktywne moduły ładowane przez `index.html`
- `js/app/constants.js` — klucze i stałe.
- `js/app/utils.js` — helpery.
- `js/app/storage.js` — wrappery `localStorage`.
- `js/app/ui-state.js` — stan widoków / UI.
- `js/app/session.js` — zapis / odczyt sesji projektu.
- `js/app/investors-store.js` — dane inwestorów.
- `js/app/investor-ui.js` — aktywne UI inwestora / lista.
- `js/app/sections.js` — sekcje typu INWESTOR / ROZRYS / MAGAZYN.
- `js/app/views.js` — przełączanie głównych widoków.
- `js/app/validate.js` — walidacja i normalizacja danych.
- `js/app/bindings.js` — listenery / delegacja klików.
- `js/app/actions-register.js` — rejestracja `data-action`.
- `js/app/investor-project.js` — most inwestor ↔ projekt.
- `js/app/tabs-router.js` — router zakładek.
- `js/app/cut-optimizer.js` — algorytm Optimax / rozkroju.
- `js/app/magazyn.js` — logika magazynu.
- `js/app/rozrys.js` — UI zakładki ROZRYS / Optimax.
- `js/tabs/wywiad.js` — zakładka WYWIAD.
- `js/tabs/rysunek.js` — zakładka RYSUNEK.
- `js/tabs/material.js` — zakładka MATERIAŁ.
- `js/tabs/czynnosci.js` — zakładka CZYNNOŚCI.
- `js/tabs/wycena.js` — zakładka WYCENA.
- `js/app.js` — bootstrap + klej + wciąż duża część starej logiki domenowej. **Nie rozbudowywać dalej bez potrzeby.**

## 8) Pliki nieładowane bezpośrednio przez `index.html` (legacy / pomocnicze)

Te pliki leżą w repo, ale **nie są zwykłym entrypointem**. Nie traktować ich jako pierwszego miejsca do nowych zmian bez sprawdzenia kontekstu.

- `js/app/inwestor.js` — starszy wariant UI inwestora; nieładowany bezpośrednio przez `index.html`.
- `js/app/calc.js` — pomocnicza warstwa obliczeń; obecnie nieładowana bezpośrednio.
- `js/app/migrate.js` — wydzielone migracje schematu; obecnie nieładowane bezpośrednio.
- `js/app/schema.js` — wydzielony schemat projektu; obecnie nieładowany bezpośrednio.
- `js/app/panel-pro-worker.js` — worker pomocniczy dla cięższego liczenia rozkroju; nie jest zwykłym skryptem `<script>`.

## 9) Gdzie dodawać nowe rzeczy

- nowa akcja przycisku / kafelka → `js/app/actions-register.js`
- delegacja klików / listenery → `js/app/bindings.js`
- przełączanie ekranów → `js/app/views.js`
- przełączanie zakładek → `js/app/tabs-router.js`
- nowa logika Optimax → `js/app/rozrys.js` + `js/app/cut-optimizer.js`
- dane / zapis / walidacja → `storage.js`, `session.js`, `validate.js`
- nowy render konkretnej zakładki → odpowiedni plik w `js/tabs/`
- `js/app.js` tylko wtedy, gdy naprawdę chodzi o bootstrap / spięcie modułów

## 10) Miejsca największego ryzyka regresji

Przed ruszeniem tych obszarów sprawdzić cały przepływ, nie tylko jeden ekran:
- `js/app.js`
- `js/app/bindings.js`
- modale (`priceModal`, `cabinetModal` i ich close/open)
- przełączanie widoków w `views.js` / `sections.js`
- `renderCabinets()`
- `setActiveTab()`
- zapis / odczyt sesji projektu
- wejście inwestor → pomieszczenia → zakładki → powrót
- ROZRYS / Optimax po zmianach materiałów i formatek

## 11) Checklista regresji przed wydaniem

### Start i nawigacja
- Strona główna startuje bez czerwonego bannera błędów.
- Działają kafelki / przyciski na stronie startowej.
- Otwiera się lista inwestorów.
- Działa wejście w nowego inwestora.
- Działa wejście do pomieszczenia z ekranu wyboru.

### Sesja / inwestor
- `Zapisz` zapisuje aktualny stan.
- `Anuluj` wychodzi z edycji i przywraca stan sprzed wejścia.
- Po odświeżeniu sesja projektu czyta się poprawnie.
- Powiązanie inwestor ↔ projekt nie znika po odświeżeniu.

### Zakładki i szafki
- Przełączanie zakładek działa bez znikania treści.
- Dodawanie szafki działa.
- Edycja szafki działa.
- `renderCabinets()` odświeża listę poprawnie po zmianach.
- RYSUNEK renderuje się poprawnie.
- MATERIAŁ i CZYNNOŚCI nie gubią danych.
- WYCENA przelicza się bez błędu.

### Modale i mobile safety
- `priceModal` otwiera się i zamyka poprawnie.
- `cabinetModal` otwiera się i zamyka poprawnie.
- ESC zamyka ostatni modal.
- Klik w overlay zamyka tylko właściwy modal.
- Po zamknięciu modala nie ma przypadkowego click-through na mobile.

### Optimax / magazyn
- ROZRYS otwiera się poprawnie.
- Optimax liczy bez błędu JS.
- Zmiana opcji rozkroju nie wywala UI.
- Magazyn otwiera się i renderuje.
- Dane materiałów z `hasGrain` nie gubią się.

## 12) Reguła pracy na przyszłość

Każda większa zmiana ma zostawić repo **czytelniejsze niż przed zmianą**: mniej logiki w `app.js`, więcej jasnych odpowiedzialności w modułach i zaktualizowany opis w `DEV.md`.
