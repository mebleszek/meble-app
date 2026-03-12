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
   - `js/app/strip-solver.js`
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
- `js/boot.js` — bezpieczny start + czerwony banner błędów; po odświeżeniu zachowuje ostatni sensowny kontekst pracy zamiast wymuszać stronę główną.
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
- `js/app/cut-optimizer.js` — główny silnik rozkroju i eksport API Optimax.
- `js/app/strip-solver.js` — wydzielony solver trybów pasowych (`Preferuj pasy wzdłuż / w poprzek`), odseparowany od eksperymentów z trybem opcjonalnym.
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


- `js/app/settings-ui.js` — helpery ustawień pokoju i rozwijania kart wyjęte z `app.js`.


- `js/app/cabinet-summary.js` — helper tekstowych podsumowań szafek wydzielony z `app.js`.


- Step 17: safe dead-code cleanup in `js/app.js` (removed unused `deleteSelectedCabinet()` and duplicate/trailing ballast comments).


- `js/app/corner-sketch.js` — helper canvas szkicu narożnych szafek; wydzielony z `app.js` bez zmiany UI.


- `js/app/cabinet-cutlist.js` — helper obliczeniowy `getCabinetCutList(cab, room)` wydzielony z `app.js` z fallbackiem wstecznym.


- `js/app/project-bootstrap.js` — boot-time normalization helpers for project data; keep app.js lighter without changing UI.


- `js/app.js` ma też lekki, globalny debounce autosave projektu (`installProjectAutosave` / `scheduleProjectAutosave`) jako bezpiecznik na wypadek, gdy pojedynczy handler zmiany nie zapisze stanu od razu.

- Refresh behavior: normal page refresh no longer forces a return to Home; manual safe reset is available via `?safe=1` (and legacy `?reset=1`).

- Router widoków preferuje aktywny projekt (`roomType`) nad starym `entry: home`, żeby zwykły refresh nie wyrzucał na start.

- `js/app.js`: fallbacki dla `drawCornerSketch()` i `getCabinetExtraSummary()` zostały uproszczone do cienkich delegatorów; źródłem prawdy są moduły `js/app/corner-sketch.js` i `js/app/cabinet-summary.js`.


- Step 24: `app.js` odchudzone przez skrócenie dużych lokalnych wrapperów `material-common` i `front-hardware`; źródłem prawdy pozostają moduły `js/app/material-common.js` i `js/app/front-hardware.js`, a w `app.js` zostały tylko cienkie delegatory z minimalnym fallbackiem.

- `js/app.js` trzyma już tylko minimalny awaryjny fallback dla `getCabinetCutList()`; pełna logika siedzi w `js/app/cabinet-cutlist.js`.


- `js/app/cabinet-actions.js` — proste akcje szafek (dodanie/usunięcie) wydzielone z `app.js`.
- `js/app/cabinet-actions.js` i `js/app/cabinet-summary.js` są teraz również ładowane bezpośrednio przez `index.html`, więc `app.js` nie musi utrzymywać rozbudowanych fallbacków tylko z powodu braku skryptu.

- `project-bootstrap.js` ładowany tylko raz w `index.html`; usunięty duplikat include.

- js/app.js korzysta już z preładowanych modułów constants/utils/storage/ui-state jako źródeł prawdy; w app.js zostały tylko lokalne fallbacki awaryjne.


- `js/app/public-api.js` — publiczne bezpieczne API FC/App (boot/init, openRoom, safe akcje modali i zakładek).


- `js/app/core-failsafe.js` — awaryjne minimalne fallbacki dla `FC.actions` i `FC.modal`, ładowane przed `app.js`.
- `js/app/dom-guard.js` — walidacja wymaganych selektorów DOM, ładowana przed `app.js`.


- Step 33: trimmed app.js wrappers for dom-guard, project-bootstrap and calc/settings by delegating to preloaded modules with minimal local fallbacks.

- `js/app/project-autosave.js` — globalny debounce autosave projektu i instalacja lekkiego bezpiecznika autosave dla zmian w obszarze aplikacji.


- `js/app/material-registry.js` — registry producentów i helper `materialHasGrain()` wydzielone z `app.js`.

- `schema.js` is now the primary source of truth for project/room normalization; `app.js` keeps only a minimal emergency fallback.
- `js/app/material-registry.js` jest źródłem prawdy dla producentów materiałów i helpera `FC.materialHasGrain(...)`.

- Step 40: przebudowa UI części ROZRYS pod Optimax (profile A→DD, kierunek opcjonalnie/wzdłuż/w poprzek, rzaz, obrównanie, minimalny użyteczny odpad) oraz nowy pasowy packer `packStripBands()` dla trybów wzdłuż/w poprzek.

- Step 61: tryby pasowe `wzdłuż` / `w poprzek` dostały mocniejsze legacy-strip dopakowanie końcówek (`packStripBands`): preferencja orientacji zgodnej z kierunkiem, fill resztek po pasach przez wolne prostokąty oraz łagodny bonus dla pełnych rzędów/kolumn.


## Step 62
- Rewritten `packStripBands()` in `js/app/cut-optimizer.js` for stable `wzdłuż` / `w poprzek` strip modes.
- Strip selection now evaluates multiple candidate strip heights and uses a width DP to choose the best-fitting group for each strip.
- Residual free rectangles are also created under shorter pieces inside a strip, then globally filled.
- Goal: restore practical strip behavior (group-oriented, near-full strips, <=100 mm acceptable tail waste) without relying on `optional` heuristics.
- Step 63: tryby pasowe `wzdłuż` / `w poprzek` dostały twardą preferencję orientacji końcowej na poziomie doboru kandydatów (`preferredCandidatesForItem` w `js/app/cut-optimizer.js`). Jeśli dla elementu istnieje wariant zgodny z wybranym kierunkiem pasa, solver używa go zamiast mieszać orientacje w residual fill / planowaniu pasa.

- Step 64: `packStripBands()` przebudowany na pełny search wariantów dla jednej płyty. Tryby `wzdłuż` / `w poprzek` porównują teraz kilka strategii budowy pasów dla całego arkusza, wybierają najlepszy cały arkusz po occupancy / dużych pustkach, a dopiero potem przechodzą do następnej płyty. To ma ograniczyć duże białe pola i monotonne słabe układy.


## step65
- Strip modes (`wzdłuż` / `w poprzek`) dostały endgame dla ostatnich 2 płyt: dodatkowe strategie i więcej testów obrotu, oceniane wspólnie jako para arkuszy.
- W ogonie solver premiuje większe dociśnięcie przedostatniej płyty i bardziej kompaktową ostatnią płytę.

- step66: wzmocniono końcówkę trybów pasowych (`wzdłuż`/`w poprzek`) o strategie exact-band/exact-band-rot, silniejszą kontrolę pełnych pasów jednowymiarowych oraz scoring premiujący równomierne pasy na ostatnich 2 płytach.

- step67: profile A–D w Optimax przeszedł z budżetu czasowego na budżet prób (`maxAttempts`) z osobnym limitem `endgameAttempts=200` dla końcówki. `rozrys.js` pokazuje teraz próby zamiast sekund. W workerze strip modes dostały tylko lokalny polish ostatniego arkusza przez ponowne sortowanie/repack ostatniego sheetu; główne planowanie pasów nie zostało ruszone.

- step68: bez zmiany rdzenia algorytmu zmieniono nazwy trybów cięcia na uczciwsze (`Preferuj pasy wzdłuż/poprzek`) oraz poprawiono raportowanie postępu prób. Worker wysyła teraz osobno postęp prób głównych i końcówki ostatniego arkusza, dzięki czemu licznik nie stoi pozornie w miejscu ani nie skacze na końcu.

- step69: doprecyzowano raportowanie postępu prób w Optimax. Worker wysyła teraz nie tylko liczbę ukończonych prób, ale też numer aktualnie analizowanej próby (`currentAttempt` / `currentTailAttempt`) i fazę (`main` / `tail`). UI pokazuje dzięki temu bardziej realny stan: `Ukończone ...` oraz `W toku ...`, zamiast sprawiać wrażenie, że licznik stanął.
- step72: uproszczono UI postępu w `js/app/rozrys.js`. Usunięto górny globalny licznik/box postępu (`rozrysGlobalStatus`) i zostawiono tylko lokalny licznik przy aktualnie liczonym materiale. Z opisu zniknął też etap/faza liczenia — status pokazuje już tylko materiał i `Najlepsze`.
- step73: wydzielono tryby pasowe do osobnego pliku `js/app/strip-solver.js`. `js/app/cut-optimizer.js` zachowuje tylko wrapper `packStripBands()` + wspólne API, a `index.html` ładuje teraz osobno solver pasowy przed silnikiem głównym. Cel: odseparować `Preferuj pasy wzdłuż / w poprzek` od ryzykownych zmian w innych heurystykach Optimax.


## 2026-03-11 — step75
- `js/app/strip-solver.js`: stabilny solver trybów „Preferuj pasy wzdłuż / w poprzek”; nie mieszać z optional.
- `js/app/optional-solver.js`: nowy solver trybu „Opcjonalnie kierunek cięcia”. Liczy płyta po płycie, porównuje pełne warianty `along/across` oraz warianty hybrydowe z jednym głównym splitem i zmianą kierunku w drugiej części płyty. Końcówka dopieszcza ostatnie 2 płyty i jeszcze raz ostatnią.
- `js/app/panel-pro-worker.js`: worker importuje teraz `optional-solver.js` i dla trybu optional korzysta z oddzielnego toru liczenia, bez dotykania solvera pasowego.


- step76: optional dostał bardziej produkcyjny scoring końcówki: kara za śmieciowy odpad / utylizację (małe i pocięte resztki), premia za grupowanie drobnicy w jednym wspólnym rzędzie/pasie oraz finalny rebalance ostatnich 2 płyt przed polish ostatniej. Zmiany zamknięte wyłącznie w `js/app/optional-solver.js`; tryby pasowe w `js/app/strip-solver.js` pozostają bez zmian.
