# DEV — porządek rozwoju meble-app / Optimax

## Stałe zasady pracy

1. **Bez zmiany UI bez zgody użytkownika.**
   - Nie zmieniać wyglądu, układu, sposobu prezentacji ani sposobu rysowania bez zgody.
   - Dopuszczalne są tylko drobne fixy błędów technicznych, które nie zmieniają wyglądu.

2. **Każda seria zmian kończy się pełną paczką `site.zip`.**
   - ZIP ma zawierać całą strukturę repo.
   - Obowiązkowo muszą być w nim `README.md` i `DEV.md`.
   - Nic nie może „zniknąć” z paczki przez przypadek.

3. **Zawsze pracujemy na ostatnim ZIP-ie wygenerowanym w rozmowie.**
   - To jest jedyna baza do kolejnych zmian.
   - Nie wracamy do starszych ZIP-ów, chyba że użytkownik wyraźnie tak każe.

4. **Najpierw porządek architektoniczny, potem duży rozwój.**
   - Aktualizować mapę aktywnych plików.
   - Oznaczać pliki legacy / nieładowane przez `index.html`.
   - Utrzymywać checklistę regresji.

5. **Nowe akcje UI dodajemy przez `data-action` + Actions registry.**
   - HTML: `data-action="twoja-akcja"`
   - Rejestr: `js/app/actions-register.js`
   - Unikać dokładania luźnych `onclick` / `addEventListener`, jeśli nie są naprawdę konieczne.

6. **Optimax rozwijamy głównie w tych plikach:**
   - `js/app/rozrys.js`
   - `js/app/cut-optimizer.js`
   - Nie dokładamy tam logiki bokiem do `app.js`, poza koniecznymi mostami do istniejących danych projektu.

7. **Duży `js/app.js` traktować ostrożnie.**
   - Stopniowo wyciągać logikę do właściwych modułów.
   - Bez przebudowy UI.
   - Bez mieszania kilku odpowiedzialności w jednym miejscu bardziej niż to konieczne.

8. **Szczególnie uważać na regresje w:**
   - `js/app.js`
   - `js/app/bindings.js`
   - modalach
   - przełączaniu widoków
   - `renderCabinets()`
   - zapisie / odczycie sesji projektu

---

## Mapa aktywnych plików (entrypointy i główne odpowiedzialności)

### Start / core
- `index.html` — struktura widoków i lista realnie ładowanych skryptów.
- `js/boot.js` — bezpieczny start + czerwony banner błędów.
- `js/core/actions.js` — registry dla `data-action`.
- `js/core/modals.js` — wspólna obsługa modali.

### App — aktywnie ładowane przez `index.html`
- `js/app/constants.js` — stałe.
- `js/app/utils.js` — helpery.
- `js/app/storage.js` — wrappery localStorage.
- `js/app/ui-state.js` — stan UI.
- `js/app/session.js` — zapis / odczyt sesji projektu.
- `js/app/investors-store.js` — dane inwestorów.
- `js/app/investor-ui.js` — aktywne UI inwestora.
- `js/app/sections.js` — sekcje widoków typu inwestor / rozrys / magazyn.
- `js/app/views.js` — przełączanie widoków.
- `js/app/validate.js` — walidacja danych.
- `js/app/bindings.js` — listenery i delegacja zdarzeń.
- `js/app/actions-register.js` — rejestr akcji `data-action`.
- `js/app.js` — główny klej aplikacji + nadal część logiki domenowej; renderery `WYWIAD`, `MATERIAŁ` i `RYSUNEK` są już wydzielone do `js/tabs/*`.
- `js/app/investor-project.js` — projekt inwestora.
- `js/app/tabs-router.js` — routing zakładek.
- `js/app/cut-optimizer.js` — silnik rozkroju.
- `js/app/magazyn.js` — logika magazynu.
- `js/app/rozrys.js` — logika zakładki rozrysu / Optimax.

### Zakładki aktywnie ładowane przez `index.html`
- `js/tabs/wywiad.js — WYWIAD (pełny renderer w module)` — aktywny renderer zakładki WYWIAD.
- `js/tabs/rysunek.js` — aktywny renderer zakładki RYSUNEK.
- `js/tabs/material.js` — aktywny renderer zakładki MATERIAŁ.
- `js/tabs/czynnosci.js`
- `js/tabs/wycena.js`

---

## Pliki obecne w repo, ale nieładowane bezpośrednio przez `index.html`

Te pliki **nie są entrypointami strony** i przed poprawkami trzeba najpierw sprawdzić, czy są naprawdę używane pośrednio:

- `js/app/inwestor.js` — stary wariant UI inwestora; w praktyce aktywnym plikiem jest `investor-ui.js`.
- `js/app/calc.js` — warstwa obliczeń pomocniczych; obecnie nieładowana z `index.html`.
- `js/app/migrate.js` — migracje schematu; obecnie nieładowane z `index.html`.
- `js/app/schema.js` — osobny moduł schematu; obecnie nieładowany z `index.html`.
- `js/app/panel-pro-worker.js` — nie jest ładowany jako zwykły script, ale jest używany pośrednio jako Web Worker z `rozrys.js`.

### Zasada dla takich plików
Najpierw sprawdzić, czy plik jest:
1. ładowany przez `index.html`,
2. tworzony dynamicznie (np. Worker),
3. tylko historyczny / legacy.

Dopiero potem go zmieniać.

---

## Gdzie szukać problemów

- **klik nie działa** → `js/app/bindings.js`, `js/app/actions-register.js`
- **akcja robi złą rzecz** → `js/app/actions-register.js` + handler domenowy
- **modal źle się zamyka / nakłada** → `js/core/modals.js` + miejsca domenowe w `app.js`
- **widok źle się przełącza** → `js/app/views.js`, `js/app/sections.js`, `setActiveTab()` w `js/app.js`
- **rozjeżdżają się dane projektu** → `js/app/session.js`, `js/app/storage.js`, `js/app/validate.js`, fragmenty `js/app.js`
- **szafki renderują się źle / znikają** → `renderCabinets()` i wszystko, co go wywołuje
- **Optimax / rozrys działa źle** → `js/app/rozrys.js`, `js/app/cut-optimizer.js`, ewentualnie worker

---

## Najbardziej ryzykowne miejsca pod regresje

1. `js/app.js` — duży plik z wieloma odpowiedzialnościami.
2. `renderCabinets()` — centralny render części aplikacji.
3. `setActiveTab()` — łatwo zepsuć przełączanie i odświeżanie.
4. `initUI()` — start i spinanie całej aplikacji.
5. `js/app/bindings.js` — łatwo dodać duble listenerów.
6. modale — overlay / ESC / zamykanie po akcji.
7. zapis i przywracanie sesji projektu.
8. mosty między główną aplikacją a zakładką rozrysu / Optimax.

---

## Checklista regresji przed wydaniem ZIP-a

### Start / nawigacja
- [ ] Strona główna startuje bez błędu.
- [ ] Kafelki / przejścia z ekranu startowego działają.
- [ ] Widoki przełączają się poprawnie.
- [ ] Nie ma martwych klików po powrocie między ekranami.

### Inwestor / projekt
- [ ] Lista inwestorów się otwiera.
- [ ] Nowy inwestor działa.
- [ ] Edycja inwestora działa.
- [ ] `Zapisz` zapisuje.
- [ ] `Anuluj` nie zapisuje i przywraca poprzedni stan.
- [ ] Wejście do projektu / pomieszczenia działa.

### Zakładki projektu
- [ ] `WYWIAD` działa.
- [ ] `RYSUNEK` działa.
- [ ] `MATERIAŁ` działa.
- [ ] `CZYNNOŚCI` działa.
- [ ] `WYCENA` działa.
- [ ] Przełączanie zakładek nie psuje danych.

### Szafki / render
- [ ] Dodanie szafki działa.
- [ ] Edycja szafki działa.
- [ ] Usunięcie działa.
- [ ] `renderCabinets()` nie wywala błędów.

### Modale / mobile safety
- [ ] Modale otwierają się i zamykają poprawnie.
- [ ] Overlay zamyka modal tam, gdzie powinien.
- [ ] ESC zamyka poprawny modal.
- [ ] Nie ma click-through po zamknięciu modala.

### Optimax / rozrys / magazyn
- [ ] Zakładka rozrysu się otwiera.
- [ ] Liczenie rozkroju działa.
- [ ] Zmiana ustawień rozkroju działa.
- [ ] Worker (jeśli użyty) nie wywala błędu.
- [ ] Magazyn nie gubi danych.

### Trwałość danych
- [ ] Odświeżenie strony nie gubi aktywnego projektu.
- [ ] Zapis do localStorage działa.
- [ ] Odczyt z localStorage działa.
- [ ] Stare dane nie rozwalają startu aplikacji.

### Techniczne minimum
- [ ] `node --check js/app.js`
- [ ] ZIP zawiera cały repo, w tym `README.md` i `DEV.md`

---

## Kierunek dalszego porządkowania bez zmiany UI

1. Nie dopisywać nowych dużych rzeczy do `js/app.js`, jeśli mają naturalne miejsce w module.
2. Stopniowo wynosić logikę domenową z `app.js` do właściwych plików.
3. Utrzymywać jedną prawdę dla akcji UI: `data-action` + registry.
4. Przy każdej większej zmianie aktualizować ten plik (`DEV.md`).


- `js/app/price-modal.js (renderer + akcje modala cenników)` — wydzielony renderer modala cenników; `app.js` ma być tu tylko delegatorem.
- Martwy helper `renderFinishList()` został usunięty z `app.js`; aktywna logika wykończeń dla RYSUNKU ma siedzieć w module zakładki.


- `js/app/tab-navigation.js` — centralna nawigacja zakładek i skoki między WYWIAD ↔ MATERIAŁ; źródło prawdy dla `setActiveTab()` i helperów focus/scroll.
- `js/app/layout-state.js` — helpery layoutu/wykończeń RYSUNKU i zapisu projektu; źródło prawdy dla `ensureLayout()`, `saveProject()` i pokrewnych helperów.


- `js/app/material-common.js` — wspólne helpery materiałowe i formatowanie wydzielone z `app.js`.

- `js/app/front-hardware.js` — wspólne obliczenia frontów i okuć (fronty do Materiałów, zawiasy BLUM, AVENTOS).
- `js/app/cabinet-fronts.js` — reguły typów/podtypów, fronty, walidacja AVENTOS i generowanie frontów; źródło prawdy dla logiki frontów używanej przez modal i materiały.
- `js/app/cabinet-modal.js` — pełna logika modala szafki i kreatora zestawów; źródło prawdy dla renderu modala, dynamicznych pól i zapisu zestawów.


- `js/app/calc.js` — aktywny moduł lekkich helperów obliczeniowych (wysokość góry, top zestawów).
