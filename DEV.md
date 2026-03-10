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

- Step 41: dopracowanie Optimax opcjonalnego — hybrydowy wybór między gilotyną i pasami, osobne obrównanie dla nowej płyty i odpadu (`edgeTrimNewSheet` / `edgeTrimScrap`) w UI i silniku oraz cięższe strojenie profilu DD (większy beam, dłuższy post-pass, więcej hybrydowych prób).
- Step 42: przestrojenie trybu „Opcjonalnie kierunek cięcia” — mocniejsza preferencja układów pasowych, kara za rozdrobnienie i spójniejsze porównywanie rodzin kandydatów.
- Step 43: naprawa licznika postępu Optimax — status liczy teraz wszystkie sprawdzone warianty od początku (nie tylko końcowe restarty), aktualizuje się także w ciężkiej fazie opcjonalnej/DD; w UI etykieta zmieniona z „Próby” na „Warianty”.
- Step 42: mocniejsze strojenie trybu `Opcjonalnie kierunek cięcia` w workerze — preferencja układów pasowych przy zbliżonym odpadzie, silniejsza kara za rozdrobnienie i wąskie ścinki oraz lepsze ważenie spójności rzędów/kolumn przy wyborze między gilotyną a pasami.

- Step 44: tryb `Opcjonalnie` w Optimaxie dostał nowy adaptacyjny wariant pasowy w workerze (`js/app/panel-pro-worker.js`): wybór osi płyta-po-płycie, grupowanie po dominujących wysokościach/szerokościach, budowa pasów i dopychanie końcówek jako tail-fill zamiast luźnego globalnego porównania rodzin układów.

- step45: w Optimax optional dodano mocniejszą ocenę wykorzystania ostatniej płyty oraz deterministyczny post-pass repakujący ogon (ostatnie 2-3 arkusze) trybami adaptive/strip, żeby ograniczyć pusty 5. arkusz.

- Step 46: tryb `Opcjonalnie` w Optimax został przebudowany z wyboru globalnej rodziny układów na adaptacyjne pasy/bloki dobierane region-po-regionie w workerze; celem jest lepsze wykorzystanie ogona i możliwość lokalnej zmiany osi bez psucia całego arkusza.


- Step 47: `js/app/panel-pro-worker.js` — przebudowa trybu `Opcjonalnie` w kierunku rekurencyjnego drzewa cięć regionów (lokalna zmiana osi per region, kandydaci line-size, lokalny backtracking kolejności dzieci) zamiast samego multi-startu od zera.

- Step 48: `js/app/panel-pro-worker.js` — tryb `Opcjonalnie` dostał pierwszy prawdziwy kandydat blokowo‑rekurencyjny: poza pełnymi pasami rozważa też wycięcie pojedynczego bloku kotwiczonego w lewym górnym rogu regionu i dalsze rekurencyjne dzielenie prawego/dolnego dziecka, co ma zbliżyć solver do „fraktalnych” lokalnych zmian osi z Optimika.

- Step 49: `js/app/panel-pro-worker.js` — tryb `Opcjonalnie` dostał prawdziwy kandydat split-recursive (czysty podział regionu na 2 dzieci bez wymuszania pełnego pasa) oraz mocniejszy budżet/priorytet dla rodziny rekurencyjnej, bo poprzednie kroki w praktyce dalej przegrywały z układami pasowymi i dawały niemal identyczne wyniki.
- Step 50: `js/app/panel-pro-worker.js` — tryb `Opcjonalnie` przestał być tylko hybrydowym wrapperem i dostał nowy główny solver `packOptionalTreeBeam()`: beam-search po częściowych drzewach cięć regionów (open/closed regions, lokalne splity/bandy/bloki, cofanie przez utrzymywanie wielu stanów naraz). To jest pierwszy krok w stronę realnego „odtwarzania ruchów wstecz” zamiast samych restartów od zera.

- Step 51: `Opcjonalnie` wróciło na solver portfelowy (treebeam/recursive/adaptive/strip/guillotine) zamiast wymuszać sam `treebeam`; dodano rozpoznawanie typu zadania (wąskie powtarzalne formatki vs mieszane korpusowe) i bias wyboru rodziny układu.

- Step 52: tryb `Opcjonalnie` został przepisany na sekwencyjny solver „best next sheet” w `js/app/panel-pro-worker.js`: każda kolejna płyta wybierana jest osobno z portfela rodzin (`treebeam` / `recursive` / `adaptive` / `strip` / `guillotine`), z prostym look-aheadem na następną płytę i karą za pozostawianie złego ogona / osieroconych grup wymiarowych.

- Step 53: `Opcjonalnie` dostał lokalne dopychanie free-rectów wewnątrz pasów (`split-band fill`) w `js/app/panel-pro-worker.js`; po osadzeniu większego elementu pas/kolumna tworzy mniejsze regiony do dalszego upychania zamiast zostawiać je martwe.

- Step 54: `js/app/panel-pro-worker.js` — `Opcjonalnie` dostał nowe kandydaty pod drobnicę i słupki 2-up/3-up: wybór line-size uwzględnia teraz „compact minor lines” (małe rzędy startowe / boczne kolumny z obróconych małych elementów), splity mogą brać rozmiary dużych bloków zamiast tylko dominujących pasów, a band/adaptive dostają dodatkowy bonus za takie kompaktowe układy. Celem jest lepsze myślenie o przypadkach typu: małe elementy po 2 w kolumnie oraz header-row zamiast pustego ogona.

- Step 55: optional / DD dostał mocniejsze punktowanie lokalnych ruchów pod kompaktowe kolumny i małe rzędy: w portfolio dochodzi analiza możliwości „repacku” drobnicy w wolnych prostokątach, słabsze premiowanie czystych pasów przy wysokiej koherencji osi oraz większe budżety treebeam/recursive dla wczesnych arkuszy.

- Step 56: `Opcjonalnie` dostało nową rodzinę kandydatów `compact-header`, która najpierw buduje mały rząd lub boczną kolumnę z drobnicy (także po obrocie), a dopiero potem dopakowuje resztę regionów solverem mozaikowym. `buildAdaptiveMosaicSheet()` rozważa teraz po kilka line-size na region zamiast tylko jednego najlepszego.

- Step 57: `Opcjonalnie` dostało globalne dopychanie resztkowych wolnych prostokątów na końcu budowy arkusza (`fillResidualFreeRects`), szerszą ocenę możliwości repacku pozostałych elementów w białych polach (`estimateBroadFitOpportunity`) oraz karę za powtarzanie tego samego dominującego kierunku na kolejnych płytach, jeśli w wolnych prostokątach da się jeszcze sensownie upchnąć resztę.
