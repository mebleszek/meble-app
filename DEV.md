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
- `js/app/optional-solver.js` — przepisany solver trybu `Opcjonalnie`; buduje arkusz od 1–2 pasów startowych z grup podobnych wymiarów, a resztę prostokąta dogęszcza solverem pasowym.
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
- **MAX wygląda na zawieszony na starcie** → najpierw sprawdzić `js/app/rozrys.js` (start workera / fallbacki / status UI), potem `js/app/panel-pro-worker.js`; nie wpadać cicho w ciężki sync fallback na głównym wątku.

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
- [ ] Picker zakresu / materiału w ROZRYS otwiera własne okno zamiast systemowej listy.
- [ ] Wybór jednego materiału pokazuje tylko ten materiał.
- [ ] Zwinięte accordiony po rozwinięciu dalej pokazują wszystkie arkusze.

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
- step89: tryb `Opcjonalnie` dostał mocniejsze reguły konstrukcyjne pod pasy startowe i słabe pasy. Solver próbuje teraz startować od konkretnych dużych formatek, wymusza 2. pas tylko gdy oba pasy mają >=90% zapełnienia, po pasie startowym ocenia resztę zarówno wzdłuż, jak i w poprzek, a słabe pasy (>20% odpadu) próbuje przebudować przez wyrzucenie zbyt małych elementów i dołożenie podobnej drobnicy w grupie +/- 75 mm. Worker dostał nowy znacznik cache `20260312_optional_v8` / `20260312_optional_rewrite_v8`.

- step77: tryby pasowe (`js/app/strip-solver.js`) dostały scrap-aware tail polish w obrębie residual fill i score: kara za śmieciowy odpad / długie cienkie ścinki oraz nowy shared-row fill dla drobnicy w resztkowych prostokątach, żeby częściej grupować małe elementy obok siebie zamiast otwierać wiele pojedynczych mikro-stref.


- `js/app/optional-solver.js` — solver trybu „Opcjonalnie”; od step79 uczy się od stabilnych solverów pasowych (`along/across`) przez kandydaty bazowe i dogęszczanie największych wolnych prostokątów przeciwnym kierunkiem, bez zmiany działania samych trybów pasowych.

- step81: `js/app/optional-solver.js` dostał nowy typ kandydatów `seed-*` inspirowany proponowanym algorytmem pasa startowego: optional próbuje zbudować 1 mocny pas startowy z grupy podobnych formatów (oraz 2. pas tylko gdy oba są bardzo dobrze wypełnione), a dopiero resztę płyty dopycha solverem pasowym. Kandydaty `seed-*` korzystają z grupowania podobnych wymiarów i mogą używać obrotu formatek, jeśli wolno. To pierwszy krok w stronę modelu „1–2 pasy startowe + dalsze liczenie reszty płyty”.


## 2026-03-12 — optional solver rewrite v2
- `js/app/optional-solver.js` przepisany ponownie jako konstrukcyjny solver: 1–2 pasy startowe z klastrów podobnych wymiarów, potem dogęszczenie reszty drugim kierunkiem przez solver pasowy.
- Nie zmieniano `js/app/strip-solver.js`; tryby wzdłuż / w poprzek pozostają bezpieczne i osobne.
- Podbito wersję workera w `js/app/rozrys.js`, żeby przeglądarka nie trzymała starego worker cache.

- 2026-03-12: optional solver v3 — naprawa cache workera (importScripts z query string), poprawka klastrów podobnych wymiarów (<= tolerancji zamiast >), mocniejsza preferencja zmiany kierunku po pasie startowym.

- Step 85: Optional solver tightened to avoid immediate fallback when no 80% seed band exists; it now picks the best constructive seed candidate, forces opposite-direction residual fill after 1-2 seed bands, and bumps worker/script cache versions to v4.


- 2026-03-12 step86: Opcjonalny residual po 1-2 pasach jest już budowany własnym konstruktorem przeciwnych pasów (`packBandsInAxis`), a nie przez miękki fallback do solvera pasowego. Dodany cache-bust v5 dla workera/solverów.

- 2026-03-12: optional-solver v6 — seed plans oparte na klastrach rodzin szerokości/wysokości (z preferencją szerokich pasów), maxAttempts steruje realną liczbą sprawdzanych konstrukcyjnych wariantów; worker i cache-busting podbite do v6.

- 2026-03-12: Optionalnie v7: residual po pasach startowych wypełniany najpierw solverem pasowym w osi przeciwnej; wybór kandydatów preferuje wyższą zajętość arkusza i szerszy pierwszy pas; tail rebalance i polish tylko przy realnej poprawie zajętości/odpadu.

- 2026-03-12 step90: usunięto tryb `Opcjonalnie` z UI ROZRYS i ścieżki workera. Kierunek cięcia został zredukowany do dwóch trybów: `Preferuj pasy wzdłuż` oraz `Preferuj pasy w poprzek`. Stare konfiguracje `auto/optional` są normalizowane do `along`, a worker nie importuje już `optional-solver.js`.


## 2026-03-12 — krok 91: tryb Optima w Optimax
- Dodano nowy solver `js/app/optima-solver.js` i nową opcję kierunku cięcia `Optima`.
- `Optima` działa osobno od klasycznych pasów wzdłuż/poprzek: próbuje obu orientacji arkusza, startuje od mocnych pasów i robi lokalną poprawę końcówki.
- W `rozrys.js` dodano wstępny szacunek liczby płyt na podstawie sumy pól formatek i pokazywanie go podczas liczenia.
- Web Worker ma nowy cache-bust `20260312_optima_v1` i ładuje `optima-solver.js`.
- Profile A/B/C/D dla trybu `Optima` mają większy budżet czasu na płytę niż klasyczne tryby pasowe.

## 2026-03-12 — krok 92: korekta trybu Optima
- Podniesiono docelowe wypełnienie dalszych pasów z 80% do 90% i mocniej karane są końcówki pasa z dużym pustym ogonem.
- `js/app/optima-solver.js` dostał dodatkowe dogęszczanie wolnych prostokątów po głównych 1–2 pasach, żeby lepiej wypełniać końce pasów i resztki po obrocie.
- Podbito cache-bust workera/solverów do `20260312_optima_v2`.


## 2026-03-13 — site_step99_remove_time_limits
- Usunięto limity czasowe z trybów Optimax (Optima / wzdłuż / w poprzek) w ścieżce workerowej.
- Profile A/B/C/D różnią się dalej liczbą prób/seedów, ale nie timeoutem na płytę.
- Usunięto timeout watchdoga w `computePlanPanelProAsync`, żeby worker nie kończył liczenia przedwcześnie.
- `packGuillotineBeam` nie ucina już liczenia budżetem `timeMs`; kończy po domknięciu arkusza.

## 2026-03-14 — krok 106: przebudowa rozrysu na osobne moduły kierunku i szybkości
- Usunięto stare pliki solverów rozkroju: `js/app/strip-solver.js`, `js/app/optima-solver.js`, `js/app/optional-solver.js`.
- Dodano osobne moduły kierunku startu:
  - `js/app/start-along.js` → `Pierwsze pasy wzdłuż` (wymusza oś `along`)
  - `js/app/start-across.js` → `Pierwsze pasy w poprzek` (wymusza oś `across`)
  - `js/app/start-optimax.js` → `Opti-max`
- Dodano osobne moduły szybkości liczenia:
  - `js/app/speed-turbo.js` → `Turbo` (shelf)
  - `js/app/speed-dokladnie.js` → `Dokładnie`
  - `js/app/speed-max.js` → `MAX`
- `MAX` realizuje aktualny rdzeń algorytmu użytkownika: 1–2 pasy startowe, sprawdzanie pasa po powierzchni, obowiązkowa zmiana kierunku po pasach startowych, bez otwierania nowej płyty przed zamknięciem poprzedniej.
- `js/app/cut-optimizer.js` został uproszczony do wspólnych narzędzi i shelf fallbacku.
- `js/app/panel-pro-worker.js` został napisany od nowa pod nowy podział start/szybkość.
- `js/app/rozrys.js` i `index.html` zostały przepięte na nowe opcje UI i nowe pliki.

- Step 18: kept cut-direction select order as `wzdłuż -> w poprzek -> Opti-max` to match requested UI order without changing solver logic.

- 2026-03-14: swapped runtime behavior of `start-along` and `start-across` for all Panel PRO speed modes (Turbo, Dokładnie, MAX) so labels stay the same but `wzdłuż` starts along board length and `w poprzek` starts across board width; bumped solver cache-busting version to `20260314_max_plan_v1`.

- `js/app/rozrys.js` steruje teraz też stanem przycisku generowania: brak cache = zielony `Generuj rozkrój`, cache hit / gotowy wynik = niebieski `Generuj ponownie`, liczenie = czerwony `Anuluj`.

- 2026-03-14: przebudowano `js/app/speed-max.js`, żeby `MAX` wybierał najlepszy pełny plan arkusza po ocenie całych kandydatów 1–2 pasów startowych, a nie tylko pojedynczego najlepszego pierwszego pasa. `MAX` dalej zamyka arkusz przed otwarciem następnego, trzyma obowiązkową zmianę kierunku po pasach startowych i zachowuje repair słabego pasa; podbito cache-busting do `20260314_max_plan_v1`.


---

## Ostatnie zmiany robocze

- ROZRYS: dodany widoczny status liczenia z animacją, paskiem postępu orientacyjnego, licznikiem sekundowym i opisem aktualnie liczonego materiału / koloru.
- ROZRYS: przy starcie generowania wymuszony repaint UI przed cięższą pracą, żeby przycisk szybciej przechodził w czerwony stan `Anuluj` także na telefonach.
- ROZRYS: status pokazuje też szacunkową liczbę płyt i bieżący numer arkusza, jeśli worker raportuje postęp.
- ROZRYS: pozostawiony fallback twardego zatrzymania workera, żeby UI nie wisiało przy anulowaniu.
- ROZRYS: usunięto górny, zdublowany status z licznikiem; zostawiono tylko jeden status w obszarze wyniku.
- ROZRYS: pasek postępu idzie teraz proporcjonalnie do policzonych płyt względem oszacowania (np. 3 z ~5 = 60%%).
- 2026-03-14: przebudowano `js/app/speed-max.js` jeszcze raz pod spec użytkownika: `MAX` liczy teraz pojedynczy wariant arkusza dla zadanego startu osi, robi 1–2 idealne pasy startowe, potem obowiązkowo zmienia kierunek i domyka resztę kolejnymi idealnymi pasami; dopiero gdy w danej osi nie ma idealnego pasa, sprawdza zmianę osi i na końcu fallback do najlepszego nieidealnego pasa. `Opti-max` porównuje już tylko 1 wariant startu wzdłuż vs 1 wariant startu w poprzek. Worker i UI dostały dokładniejsze fazy progresu oraz licznik „zamknięta płyta X / liczę płytę Y”.

- 2026-03-14: przebudowano `js/app/speed-max.js` jeszcze raz pod doprecyzowaną specyfikację użytkownika: `MAX` buduje każdy pas od największego aktualnie pasującego elementu, sprawdza dla tego pasa obie dozwolone orientacje, dobiera formatki o tej samej grubości pasa lub mniejsze maks. o 75 mm, próbuje kolejno progi 90% i 80% (z wyjątkiem drugiego pasa startowego, który powstaje tylko przy 90%), a dopiero po niepowodzeniu zmienia kierunek lub schodzi do fallbacku. Nie ruszano działania trybów startu `wzdłuż` / `w poprzek`; podbito cache-busting do `20260314_max_user_algo_v1`.


## 2026-03-15 — MAX seed sweep and tiny-block grouping
- `js/app/speed-max.js`: MAX now reviews all sensible seed starts for a band (unique fitting start sizes, biggest-to-smaller) before lowering threshold or switching axis.
- `js/app/speed-max.js`: tiny repeat parts can be paired into grouped block candidates inside a band to reduce scattered micro-strips.
- `js/app/panel-pro-worker.js`, `js/app/rozrys.js`, `index.html`: cache-busting bumped for the new MAX solver build.

- 2026-03-15: MAX now scans seeds sequentially from largest area to smaller and accepts the first seed that reaches the requested occupancy target; ROZRYS waste summary uses full board dimensions and drawing shows the trim border around the usable area.

- 2026-03-15: ROZRYS — dodano procent odpadu przy nagłówku każdego arkusza (widok i eksport PDF/druk), liczony od pełnej płyty.

- 2026-03-15: `js/app/speed-max.js` tuned per user request: MAX now tests only the top 5 unique seed starts for each band (largest unique candidates first) and raises the secondary occupancy threshold from 80% to 85%; cache-busting updated to `20260315_max_top5_90_85_v1`.
- 2026-03-15: `js/app/speed-max.js` — start-pass 1 i 2 mają teraz twardą kolejność `90% -> 85% -> dopiero fallback`, z testem top 5 unikalnych seedów i obu orientacji każdego seeda; fallback został przerobiony na preferencję fizycznego cięcia po długości płyty (wewnętrzna oś `across`) z układaniem od najszerszych do najwęższych elementów.
- 2026-03-15: `js/app/speed-max.js` — ostatni arkusz może być oznaczony jako wirtualne `0.5` płyty, jeśli komplet pozostałych elementów mieści się na połowie formatu; `js/app/rozrys.js` liczy wtedy podsumowanie i % odpadu dla tej połówki, ale nadal rysuje arkusz na pełnej płycie.
- 2026-03-15: `js/app/panel-pro-worker.js`, `js/app/rozrys.js` — cache-busting bumped to `20260315_max_virtual_half_v1`.

- 2026-03-15: magazyn rozróżnia teraz pełne i realne pół płyty przez format; ROZRYS wybiera największy format jako hint, a MAX może użyć realnej połówki z magazynu na końcówce (rysowanej nadal na pełnym arkuszu) lub tylko oznaczyć wirtualne 0,5, gdy realnej połówki brak.


## 2026-03-15 – real_half_inventory_v2
- Half-sheet detection is now strict: full length + half short side only; no rotated whole-half acceptance.
- Virtual/real half preview uses lengthwise-only logic.
- Added dashed divider line on rendered sheets when half-board logic is active.

- 2026-03-15: MAX updated: band similarity 50mm, thresholds 95%/90%, and last-sheet virtual half now re-runs normal MAX on 2800x1030 and replaces the last layout before drawing on full board. Half divider drawn as stronger dashed line above placements.
- step: uproszczono panel ROZRYS — usunięto tekst wstępny pod nagłówkiem, a opcje dodatkowe (jednostki, wymiary do cięcia, rzaz, obrównanie i minimalny użyteczny odpad) przeniesiono do pływającego okna „Opcje rozkroju” z zapisem w localStorage.


- `js/app/confirm-box.js` — współdzielony modal potwierdzeń (zamiast natywnego `confirm()`), do użycia także w innych miejscach aplikacji.

- `js/app/info-box.js` — mały, wielorazowy modal informacji/pomocy otwierany z ikon `?` przy polach paneli.
- 2026-03-18: `js/app/panel-box.js` + `js/app/rozrys-validation.js` — dodano współdzielone okno list/diagnostyki dla ROZRYS oraz walidację rozkroju względem snapshotu; `Lista formatek` pokazuje teraz RAW snapshot 1:1 z Materiałów, listę do rozkroju po scaleniu i wynik walidacji, a każdy arkusz ma własną listę formatek.
- 2026-03-20: `js/app/rozrys.js`, `js/app/magazyn.js`, `css/style.css`, `index.html` — przebudowano źródło wyboru ROZRYS pod jeden inwestor + wiele pomieszczeń: dodano picker pomieszczeń, nowy picker materiałów per kolor z trybem fronty/korpusy, usunięto wyszukiwarkę z pickera materiałów, a lista materiałów buduje się teraz z zaznaczonych pomieszczeń i sumuje ten sam materiał między nimi. Zapis formatu z ROZRYS do Magazynu dodaje już +1 szt. do istniejącego lub nowego formatu po własnym potwierdzeniu; pola formatu i przycisk `Dodaj format` są teraz w jednym rzędzie. Regresje do sprawdzenia: wielopomieszczeniowe sumowanie HDF i laminatów, pojedynczy materiał z samymi frontami / samym korpusem / obiema grupami, ponowne generowanie z cache po zmianie pomieszczeń i poprawne dodawanie kolejnych sztuk tego samego formatu do magazynu.
