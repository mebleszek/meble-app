## 2026-04-16 — status tests mini-package 5
- `js/testing/wycena/tests.js` — dopięte antyregresje dla późnych etapów procesu (`umowa`, `produkcja`, `montaz`, `zakonczone`): sekwencja późnych statusów utrzymuje scoped końcową ofertę, nie przywraca martwych zaznaczeń starych wycen i nie rusza rozłącznego pokoju.
- `js/testing/wycena/tests.js` — dodany guard coverage dla późnych etapów: bez zaakceptowanej wyceny końcowej exact-scope ręczne przejścia na późne statusy mają być blokowane, a po zaakceptowaniu finalnej oferty mają się odblokować.
- `js/testing/investor/tests.js` — dopięty test przepływu z poziomu `Inwestor`: ręczne przejścia `umowa -> produkcja -> montaz -> zakonczone` zwracają poprawny `masterStatus`/`mirrorStatus`, aktualizują lustra i nie ruszają zaakceptowanej oferty rozłącznego pokoju.
- Instrukcja antyregresyjna: przy dokładaniu kolejnych reguł dla późnych etapów zawsze testować dwa scenariusze naraz: (1) pełną sekwencję późnych statusów dla jednego pokoju, (2) współistnienie drugiego, rozłącznego pokoju z własną zaakceptowaną ofertą. Brak regresji oznacza nie tylko poprawny status pokoju docelowego, ale też brak zmian `selectedByClient`, `acceptedStage`, `rejected*` i statusu snapshotów w rozłącznym scope.

## 2026-04-16 — scoped accept/convert hotfix + refresh restore
- `js/app/quote/quote-snapshot-store.js` — naprawiony kolejny regres multi-scope z historii wycen: akceptacja snapshotu dla jednego pokoju nie może już nadpisywać `project.status` w rozłącznych snapshotach tego samego `projectId`; nieimpaktowane scope są zostawiane bez bocznych dopisków statusu.
- `js/app/quote/quote-snapshot-store.js` — `convertPreliminaryToFinal(projectId, snapshotId)` działa teraz tylko na **kolidującym scope** targetu. Konwersja pokoju A do oferty końcowej nie zdejmuje już akceptacji, nie zmienia typu i nie narzuca końcowego statusu snapshotom rozłącznego pokoju B.
- `js/app.js` — dodany lekki mechanizm przywracania kontekstu po zwykłym odświeżeniu w tej samej karcie (`sessionStorage`): zapisuje aktualny `uiState` i scroll przy `pagehide/beforeunload`, a po reloadzie przywraca ostatni widok zamiast wypadać na stronę główną. To jest techniczny restore tylko na refresh/tej samej karcie, nie nowy globalny stan aplikacji.
- `js/testing/wycena/tests.js` — dopięte antyregresje: (1) akceptacja solo scope nie nadpisuje statusu snapshotów rozłącznego scope, (2) konwersja wstępnej oferty do końcowej nie zdejmuje akceptacji z innego solo pokoju.
- Instrukcja antyregresyjna: przy logice `markSelectedForProject` i `convertPreliminaryToFinal` rozróżniać **scope impaktowany** od **scope rozłącznego**. Rozłączne snapshoty mogą współistnieć i nie wolno im masowo czyścić `selectedByClient`, `acceptedAt`, `acceptedStage`, `rejected*` ani `project.status` tylko dlatego, że dzielą ten sam techniczny `projectId`.
- Instrukcja antyregresyjna: fix odświeżenia ma działać jako restore ostatniego realnego widoku w tej samej karcie. Nie przywracać strony przez zgadywanie na podstawie samego `currentInvestorId`; źródłem ma być zapisany bieżący kontekst z chwili refreshu.

## 2026-04-16 — multi-scope accepted quotes hotfix
- `js/app/quote/quote-snapshot-store.js` — hotfix regresji statusów: akceptacja oferty dla jednego, rozłącznego scope nie może już odrzucać ani zdejmować akceptacji z innego solo scope tego samego inwestora/projektu-kontenera. Selekcja snapshotów działa teraz per **zakres kolidujący**, a nie globalnie dla całego `projectId`; rozłączne pokoje mogą mieć równolegle własne zaakceptowane oferty.
- `js/app/quote/quote-snapshot-store.js` — `getSelectedForProject(projectId, { roomIds })` obsługuje teraz scoped odczyt wybranej oferty exact-scope; przy dalszym rozwoju wszędzie, gdzie wybór ma dotyczyć konkretnego pokoju lub exact scope, używać tej wersji zamiast szerokiego odczytu projektowego bez scope.
- `js/testing/wycena/tests.js` — dodany test antyregresyjny: zaakceptowanie solo oferty dla pokoju A nie może odrzucić ani odznaczyć zaakceptowanej solo oferty pokoju B.
- Instrukcja antyregresyjna: przy logice akceptacji/odrzucania snapshotów traktować `projectId` tylko jako kontener techniczny. Reguły `selectedByClient`, `acceptedAt`, `rejectedAt` i `rejectedReason` wolno zmieniać tylko w obrębie **kolidującego scope** (overlap), nigdy globalnie dla wszystkich snapshotów projektu, jeśli scope są rozłączne.

## 2026-04-15 — status cleanup mini-package 4
- `js/tabs/wycena.js` — mini-paczka 4: wycięte stare wysokopoziomowe fallbacki statusów dla akceptacji / usuwania / konwersji snapshotów. `Wycena` nie wraca już do lokalnego `markSelectedForProject`, ogólnego `reconcileProjectStatuses` ani lokalnej konwersji + ręcznego zapisu statusów, jeśli zabraknie dedykowanych helperów centralnego syncu. Zostaje tylko najniższy fallback kompatybilności w `setProjectStatusFromSnapshot()` jako awaryjna ścieżka techniczna.
- `js/app/project/project-status-sync.js` — uporządkowany silnik map statusów: `computeRecommendedRoomStatusMap()` przejął rolę jednej ścieżki liczenia rekomendowanych statusów pokoi; stary `buildRecommendedRoomStatusMap()` został sprowadzony do wrappera kompatybilności zamiast osobnej, dublującej logiki fallbacków.
- `js/testing/wycena/tests.js` — dodane antyregresje dla ETAPU 4: brak dedykowanych helperów centralnego syncu nie może już uruchamiać starych lokalnych fallbacków w `Wycena`.
- Instrukcja antyregresyjna na dalszy rozwój: jeśli dokładamy nowe flow statusowe, to dedykowany helper ma powstać w `project-status-sync.js`, a `js/tabs/wycena.js` ma go tylko wywołać. Nie dopisywać już nowych lokalnych obejść typu „jak nie ma helpera, to zróbmy selekcję snapshotu / reconcile / zapis luster ręcznie w Wycena”.

## 2026-04-15 — status engine responsibilities mini-package 3
- `js/app/project/project-status-sync.js` — mini-paczka 3: dopięte jawne role silnika statusów. Sync ma teraz nie tylko liczyć `masterStatus` i lustra, ale też orkiestruje trzy przepływy statusowe z `Wycena`: akceptację oferty (`commitAcceptedSnapshot`), rekonsyliację po usunięciu snapshotu (`reconcileStatusAfterSnapshotRemoval`) oraz konwersję zaakceptowanej wstępnej oferty do końcowej (`promotePreliminarySnapshotToFinal`). To ogranicza rozproszenie reguł biznesowych poza `wycena.js`.
- `js/tabs/wycena.js` — lokalne sklejanie akceptacji / usuwania / konwersji snapshotów zostało odchudzone do wywołań centralnego syncu. `Wycena` zostaje warstwą UI/orchestration zamiast trzymać własne boczne reguły statusowe.
- `js/app/project/project-status-manual-guard.js` — dopisany komentarz kontraktowy: guard ma tylko walidować ręczne przejścia statusu i nie może sam zapisywać końcowego stanu projektu ani luster.
- `js/app/quote/quote-snapshot-store.js` — dopisany komentarz kontraktowy: snapshot store przechowuje i filtruje historię exact-scope ofert, ale nie jest miejscem finalnego liczenia biznesowego statusu projektu.
- `js/testing/wycena/tests.js` — dodane antyregresje dla mini-paczki 3: `Wycena` deleguje akceptację/usuwanie/konwersję do centralnego syncu; guard pozostaje read-only; snapshot store sam nie ustala statusu projektu.
- Instrukcja na dalszy rozwój statusów: nowe etapy i nowe reguły biznesowe dopisywać najpierw w `project-status-sync.js` (finalny wynik) i `project-status-manual-guard.js` (dozwoloność ręcznych przejść). `quote-snapshot-store.js` ma tylko dostarczać dane/historyczne snapshoty, a `js/tabs/wycena.js` ma jedynie wywoływać centralne helpery syncu bez dokładania równoległej logiki statusowej.

## 2026-04-15 — status scope rules mini-package 1
- `js/app/project/project-status-sync.js` — mini-paczka 1 logiki statusów: brak jawnego scope nie skleja już automatycznie wszystkich pokoi inwestora w jeden projekt; scoped zmiany i scoped rekonsyliacje liczą status kompatybilności tylko z exact scope, a brak pokoi wraca do `nowy`.
- `js/tabs/wycena.js` — usuwanie oferty przekazuje do rekonsyliacji exact scope usuwanego snapshotu zamiast niejawnie wpadać w cały zestaw pokoi inwestora.
- `js/testing/wycena/tests.js` — dodane antyregresje dla mini-paczki 1: brak niejawnej agregacji po całym inwestorze oraz ignorowanie obcego pokoju przy scoped statusie A+B.
- `js/tabs/wycena.js` — poprawiony scroll po akceptacji oferty z przycisku pod `Podsumowanie`; widok zostaje w miejscu zamiast skakać na górę.
- `js/app/quote/quote-snapshot.js`, `js/app/quote/quote-offer-store.js`, `js/app/quote/quote-snapshot-store.js`, `js/app/quote/quote-scope-entry.js`, `js/app/wycena/wycena-core.js` — domyślne nazwy ofert i wariantów uwzględniają teraz scope pomieszczeń (`Oferta — Kuchnia + Salon`, `Wstępna oferta — Salon — wariant 2`).
## 2026-04-15 — quote accept + roomless wycena + tab order
- `js/tabs/wycena.js` — dodany wspólny helper akceptacji oferty i nowy przycisk `Zaakceptuj ofertę` pod `Podsumowanie`, podpięty do tej samej logiki co karta historii.
- `js/app/ui/views.js` + `js/app/ui/tab-navigation.js` + `js/app.js` — wejście zakładką `WYCENA` bez wybranego pokoju otwiera teraz od razu moduł wyceny zamiast ekranu `Wybierz pomieszczenie`; render tabów działa też dla roomless `WYCENA`.
- `index.html` — przestawiona kolejność zakładek: u góry `MATERIAŁ` przed `RYSUNEK`, na dole `INWESTOR`, `WYCENA`, `ROZRYS`, `MAGAZYN`; podbity cache-busting zmienionych plików.
- `js/testing/project/tests.js` + `js/testing/wycena/tests.js` — dodane antyregresje dla roomless wejścia do `WYCENA`, kolejności zakładek oraz kwalifikacji przycisku akceptacji w podglądzie oferty.


## 2026-04-12 — foundation tests follow-up
- rozszerzone smoke testy działowe dla `Inwestor`, `Materiały` i `Usługi`
- `Inwestor`: status projektu z poziomu inwestora synchronizuje `projectStore` i wybór oferty; aktualizacja jednego pomieszczenia nie narusza pozostałych i odświeża etykietę rejestru
- `Materiały`: zapis listy płyt nie przepuszcza akcesoriów do materiałów arkuszowych; `migrateLegacy({ preferStoredSplit:true })` trzyma rozdzielone listy zamiast wskrzesić legacy dane
- `Usługi`: `catalogStore` i `serviceOrderStore` są testowane jako jedno źródło danych; szkic zlecenia nie zapisuje pustego rekordu przy pierwszym wejściu
- lokalny runner `APP` po zmianach: 53/53 OK
- 2026-04-06 — `site_two_mode_stage1.zip`: wdrożony etap 1 architektury 2 trybów pracy. Start pokazuje tylko `Projekty meblowe` i `Drobne usługi stolarskie`; dodane kontekstowe huby wejść, nowy `catalog-store.js` z rozdzieleniem `sheetMaterials/accessories/quoteRates/workshopServices/serviceOrders`, osobny moduł `service-orders.js` oraz poprawki testów/ROZRYS pod tę przebudowę.

- 2026-04-06 — `site_price_popup_tests_queue.zip`: `Dodaj`/`Edytuj` w cennikach dostało mobilny popup w stylu aplikacji przez osobny arkusz `css/price-item-popup.css`; `dev_tests.html` dostał przycisk `Kopiuj tylko błędy`; do testów dopięto brakujące moduły (`investor-persistence`, `rozrys-scope`, `rozrys-render`, `rozrys`) oraz poprawiono fake DOM dla render-smoke w przeglądarce.

- 2026-04-06 — `site_quote_ui_pdf_price_choices.zip`: zakładka `Wycena` dostała własny, wąski layout bez odziedziczonych szerokości z list ROZRYS; cennik materiałów/usług przeszedł z systemowych selectów i `alert/confirm` na aplikacyjne launchery + nasze boxy; inwestor dostał osobny moduł `investor-pdf.js` oraz przycisk `PDF` do karty segregatorowej.

- 2026-04-06 — `site_source_picker_merge_sumcheck.zip`: przywrócona produkcyjna rola listy `Skomasowana` (bez sztucznego `OK` w kolumnach), dodana osobna kontrolka sum `RAW` vs `Skomasowana`, poprawiony eksport PDF list, usunięty separator nad `Usuń/Edytuj`, nowe domyślne `BRAK` w dodatkowych informacjach nowego inwestora oraz aplikacyjna lista wyboru `Źródło`.

- 2026-03-28 — `site_rozrys_choice_noarrow.zip`: usunięta strzałka z kompaktowych kafli `Szybkość liczenia` i `Kierunek cięcia`; zostawiony sam wystający kafel z nazwą wybranej opcji.
- 2026-03-28 — site_rozrys_choice_clean.zip
  - ROZRYS: uproszczono kafle wyboru `Szybkość liczenia` i `Kierunek cięcia` — usunięto tekst `Kliknij, aby wybrać/zmienić`, zostawiono samą nazwę wybranej opcji oraz nowy, bardziej aplikacyjny znak klikalności po prawej.
## Struktura katalogów (po paczce arch_dirs_tests)

- `js/app/shared/` — helpery wspólne, storage, validate, public API.
- `js/app/ui/` — bindingi, routing zakładek, boxy, scroll-memory, layout helpers.
- `js/app/cabinet/` — modal szafki, fronty, okucia, cutlista i szkice.
- `js/app/investor/` — inwestor, sesja projektu, bootstrap/autosave.
- `js/app/material/` — magazyn, registry materiałów, opcje formatek, modal cenników.
- `js/app/optimizer/` — solver, worker, profile startu/szybkości.
- `js/app/rozrys/` — cały ROZRYS.
- `js/testing/` — smoke-testy developerskie (`rozrys`, `project`, `investor`, `material`, `wycena`, `cabinet`).

### Paczka 2026-03-28 — arch_dirs_tests
- Przeniesiono płaski katalog `js/app/*` do grup domenowych i technicznych bez zmiany UI.
- Usunięto martwy `js/app/rozrys.js.bak`.
- Usunięto stary workflow `.github/workflows/deploy-from-zip.disabled`.
- Dodano nową stronę `dev_tests.html` oraz smoke-testy dla projektu, materiałów i szafek.
- Dla Node dodano `tools/app-dev-smoke.js` jako szybki runner tych testów poza przeglądarką.

# DEV — porządek rozwoju meble-app / Optimax

- 2026-03-28 — `site_dev_smoke_more_scenarios.zip`: rozbudowa smoke-testów ROZRYS do 18 scenariuszy; dodane testy bardziej życiowe dla wyjątków słojów, stabilności podpisu magazynu, formatu obróconego, nadmiaru walidacji, zmian klucza cache po wyjątkach/okleinach oraz układu 2 małych arkuszy na jednej stronie wydruku.

## Ostatnia paczka zmian

### 2026-04-04 — rozrys_lists_tabs_pdf_v1
- `js/app/rozrys/rozrys-summary.js` — modal `Lista formatek` dostał 3 osobne zakładki (`RAW`, `Skomasowana`, `Walidacja`) zamiast jednego długiego widoku; dodane lokalne przyciski PDF dla `RAW` i `Skomasowanej` oraz PDF dla `Listy formatek arkusza`.
- `js/app/rozrys/rozrys.js` — wrappery otwierania list przekazują teraz także `openPrintView`, żeby PDF/druk list działał z poziomu modali bez ruszania innych sekcji ROZRYS.
- `css/style.css` — dodane lekkie style zakładek w modalu list formatek, bez zmiany zaakceptowanego wyglądu reszty ROZRYS.
- `index.html` — podbity cache-busting dla `style.css`, `rozrys-summary.js` i `rozrys.js` dla tej paczki.

### 2026-03-29 — checkbox_chip_checked_accent_v1
- `css/rozrys-checkbox-chip-selected-accent.css` — nowy, mały moduł wizualny tylko do stanu zaznaczonego checkbox-chipów ROZRYS; dodaje delikatny gradient, lekko mocniejszy obrys i subtelny lift całego przycisku, żeby aktywny stan był czytelniejszy bez trzeciego stanu.
- `index.html` — dopięty nowy moduł CSS i podbity cache-busting dla tej paczki.
- `js/testing/rozrys/tests.js` + `tools/rozrys-dev-smoke.js` + `dev_tests.html` — dodany test anty-regresyjny pilnujący, że zaznaczony checkbox-chip ma osobny akcent wizualny całego przycisku i checkboxa.

### 2026-03-29 — material_scope_chip_sync_v1
- `css/rozrys-scope-chip-room-sync.css` — nowy, mały moduł CSS tylko do synchronizacji zachowania małych kafelków `Fronty/Korpusy` w pickerze `Materiał / grupa` z wzorcem kafelków wyboru pomieszczeń; usuwa zieloną ramkę / zielony tekst z małego kafelka i zostawia tylko niebieski stan samego checkboxa.
- `css/rozrys-checkbox-chip-pattern.css` — wspólny wzorzec checkbox/chip dla ROZRYS z wariantem dużym; używany do kafelków wyboru pomieszczeń, żeby trzymały ten sam język wizualny co małe chipy `Fronty/Korpusy`.
- `js/app/rozrys/rozrys-selection-ui.js` — małe kafelki zakresu materiału dostają dedykowany modifier `rozrys-scope-chip--room-match`, żeby poprawka była punktowa i nie rozlewała się na inne checkboxy ROZRYS.
- `js/testing/rozrys/tests.js` + `tools/rozrys-dev-smoke.js` + `dev_tests.html` — dodane testy anty-regresyjne pod ten przypadek: sprawdzenie modifiera na małym kafelku i obecności dedykowanego CSS sync.
- `index.html` — dopięty nowy moduł CSS i podbity cache-busting dla `rozrys-selection-ui.js`.

### 2026-03-27 — rozrys_split_v6
- `js/app/rozrys/rozrys-scope.js` — wydzielony zakres / selekcja ROZRYS: pomieszczenia, scope materiałów, kolejność materiałów, klucz accordionu i agregacja formatek projektu.
- `js/app/rozrys/rozrys-engine.js` — wydzielone helpery engine ROZRYS: normalizacja kierunku, etykiety heurystyk, liczenie sync, liczenie workerowe i wspólny fallback `computePlanWithCurrentEngine()`.
- `js/app/rozrys/rozrys-sheet-helpers.js` — wydzielone helpery canvas arkusza: metryki planszy, snap do pixela, trim area, divider połówki i rysowanie pojedynczej formatki.
- `js/app/rozrys/rozrys-print-layout.js` — wydzielony layout PDF/druk: dobór skali, grupowanie 1–2 arkuszy na stronę i generowanie HTML wydruku bez zmiany wyglądu.
- `js/app/rozrys/rozrys.js` + `js/app/rozrys/rozrys-sheet-draw.js` + `js/app/rozrys/rozrys-render.js` — przepięte na nowe moduły, dzięki czemu `rozrys.js` dalej schudł i zostało w nim mniej ciężkiej logiki domenowej.
- `index.html` — dopięte nowe pliki i podbity pełny cache-busting pakietu `rozrys-*` do `20260327_rozrys_split_v6`.

### 2026-03-27 — rozrys_stock_validation_fix_v2
- `js/app/rozrys/rozrys-stock.js` — walidacja dla arkuszy `z magazynu` dostała dodatkowe, odporniejsze odejmowanie wykorzystanych formatek: jeśli placement z planu magazynowego nie wróci z idealnie dopasowanym `key`, moduł rozpoznaje go jeszcze po nazwie i wymiarze, więc formatki użyte na płycie magazynowej nie są już dublowane na płytach `zamówić`.
- `js/app/rozrys/rozrys.js` + `js/app/rozrys/rozrys-render.js` — podbity `stockPolicy` do `v4`, żeby po tej poprawce nie wracały stare, błędne plany z cache.
- `index.html` — podbite cache-busting dla całego zestawu modułów `rozrys-*` do `20260327_rozrys_stock_validation_v4`.

### 2026-03-26 — rozrys_validation_fix_v1
- `js/app/rozrys/rozrys-stock.js` — naprawiona regresja po module split: odejmowanie formatek już wykorzystanych z magazynu znowu używa pełnego `partSignature()`, więc brakujące elementy nie są dublowane na płytach zamawianych; dodatkowo filtr dopasowania do arkusza magazynowego znowu respektuje blokadę obrotu wynikającą ze słojów.
- `js/app/rozrys/rozrys.js` — wrapper do `applySheetStockLimit()` przekazuje wymagane zależności (`partSignature`, `isPartRotationAllowed`) i podbija `stockPolicy` do `v3`, żeby nie używać błędnych planów z cache po poprzedniej paczce.
- `index.html` — podbite cache-busting dla całego zestawu modułów ROZRYS powiązanych z tą paczką.

### 2026-03-26 — rozrys_module_split_v2
- `js/app/rozrys/rozrys.js` — dalsze odchudzenie przez przeniesienie pickerów, rysowania arkuszy, limitu stanów magazynowych i renderu accordionu do modułów pomocniczych bez zmiany UI.
- `js/app/rozrys/rozrys-pickers.js` — wydzielone modale wyboru pomieszczeń oraz materiału / grupy w ROZRYS.
- `js/app/rozrys/rozrys-sheet-draw.js` — wydzielone odświeżanie canvasów i rysowanie arkuszy / formatek.
- `js/app/rozrys/rozrys-stock.js` — przejęta logika `applySheetStockLimit()` dla wykorzystania stanów magazynowych przed pełną płytą.
- `js/app/rozrys/rozrys-accordion.js` — przejęty render sekcji materiałów w accordionie wyników.
- `index.html` — dopięte nowe pliki i pełny cache-busting `20260326_rozrys_split_v2`.

### 2026-03-26 — rozrys_module_split_v1
- `js/app/rozrys/rozrys.js` — odchudzony przez delegację części funkcji do nowych modułów pomocniczych bez zmiany UI i bez zmiany solverów.
- `js/app/rozrys/rozrys-choice.js` — wydzielone launchery wyboru i overlay wyboru dla customowych dropdownów ROZRYS.
- `js/app/rozrys/rozrys-print.js` — wydzielone CSV / pobieranie / otwieranie wydruku oraz pomiar nagłówka PDF.
- `js/app/rozrys/rozrys-stock.js` — wydzielone helpery formatu bazowego, magazynu i podaży arkuszy.
- `js/app/rozrys/rozrys-cache.js` — wydzielone helpery cache planów rozkroju.
- `js/app/rozrys/rozrys-accordion.js` — wydzielone helpery accordionu materiałów i tytułów sekcji.
- `index.html` — podbite cache-busting dla wszystkich plików powiązanych z tą paczką i dopięte nowe moduły ROZRYS.

### 2026-03-26 — list_scroll_restore_v1
- `js/app/ui/list-scroll-memory.js` — nowy, mały moduł pamięci pozycji listy dla `WYWIAD` i `MATERIAŁ`; zapamiętuje aktywną szafkę i offset scrolla przed wejściem w edycję, a po `Zatwierdź / Anuluj` przywraca dokładnie ten sam rejon listy zamiast wyrzucać na górę.
- `js/app/cabinet/cabinet-modal.js` — modal szafki zapisuje kontekst listy przy wejściu w `Edytuj` i po zamknięciu próbuje odtworzyć poprzednią pozycję.
- `js/app.js` — po przebudowie listy woła przywrócenie scrolla, żeby zapis edycji nie zrzucał użytkownika na początek.
- `index.html` — podbite cache-busting dla wszystkich plików powiązanych z tą paczką i dodany nowy moduł listy.

### 2026-03-21 — rozrys_ui_pdf_guard_v1
- `js/app/rozrys/rozrys.js` — uporządkowane akcje i logika stanów `Wyjdź / Anuluj / Zapisz/Zatwierdź` w pickerach ROZRYS oraz w modalu `Dodaj płytę do magazynu`; modal dodawania płyty przeniesiony na wspólny `panelBox`; eksport PDF ma bezpieczniejsze liczenie wysokości nagłówka przy długich nazwach materiałów.
- `js/app/ui/panel-box.js` — `panelBox.open()` obsługuje teraz opcjonalny `beforeClose`, żeby modal mógł zablokować zamknięcie przy niezapisanych zmianach.
- `css/style.css` — wzmocnione zawijanie długich nazw w nagłówkach/pickerach/akordeonach oraz usunięta kolizja układu paska akcji ROZRYS między CSS a inline-style.
- `index.html` — podbite cache-busting dla plików powiązanych z tą paczką.

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
   - Rejestr: `js/app/ui/actions-register.js`
   - Unikać dokładania luźnych `onclick` / `addEventListener`, jeśli nie są naprawdę konieczne.

6. **Optimax rozwijamy głównie w tych plikach:**
   - `js/app/rozrys/rozrys.js`
   - `js/app/optimizer/cut-optimizer.js`
   - `js/app/strip-solver.js`
   - Nie dokładamy tam logiki bokiem do `app.js`, poza koniecznymi mostami do istniejących danych projektu.

7. **Duży `js/app.js` traktować ostrożnie.**
   - Stopniowo wyciągać logikę do właściwych modułów.
   - Bez przebudowy UI.
   - Bez mieszania kilku odpowiedzialności w jednym miejscu bardziej niż to konieczne.

8. **Szczególnie uważać na regresje w:**
   - `js/app.js`
   - `js/app/ui/bindings.js`
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
- `js/app/shared/constants.js` — stałe.
- `js/app/shared/utils.js` — helpery.
- `js/app/shared/storage.js` — wrappery localStorage.
- `js/app/shared/ui-state.js` — stan UI.
- `js/app/investor/session.js` — zapis / odczyt sesji projektu.
- `js/app/investor/investors-store.js` — dane inwestorów.
- `js/app/investor/investor-ui.js` — aktywne UI inwestora.
- `js/app/investor/investor-pdf.js` — karta PDF danych inwestora do druku / segregatora, generowana z modelu danych.
- `js/app/ui/sections.js` — sekcje widoków typu inwestor / rozrys / magazyn.
- `js/app/ui/views.js` — przełączanie widoków.
- `js/app/shared/validate.js` — walidacja danych.
- `js/app/ui/bindings.js` — listenery i delegacja zdarzeń.
- `js/app/ui/actions-register.js` — rejestr akcji `data-action`.
- `js/app.js` — główny klej aplikacji + nadal część logiki domenowej; renderery `WYWIAD`, `MATERIAŁ` i `RYSUNEK` są już wydzielone do `js/tabs/*`.
- `js/app/investor/investor-project.js` — projekt inwestora.
- `js/app/ui/tabs-router.js` — routing zakładek.
- `js/app/optimizer/cut-optimizer.js` — główny silnik rozkroju i eksport API Optimax.
- `js/app/strip-solver.js` — wydzielony solver trybów pasowych (`Preferuj pasy wzdłuż / w poprzek`), odseparowany od eksperymentów z trybem opcjonalnym.
- `js/app/optional-solver.js` — przepisany solver trybu `Opcjonalnie`; buduje arkusz od 1–2 pasów startowych z grup podobnych wymiarów, a resztę prostokąta dogęszcza solverem pasowym.
- `js/app/material/magazyn.js` — logika magazynu.
- `js/app/material/price-modal.js` — modal cenników z aplikacyjnymi launcherami wyboru i boxami zamiast systemowych dialogów.
- `css/rozrys-reference-sync.css` — wizualne ujednolicenie ROZRYS względem zaakceptowanych wzorców UI.
- `css/rozrys-checkboxes.css` — wspólna skórka checkboxów ROZRYS bez systemowego highlightu.
- `css/rozrys-scope-chip-room-sync.css` — punktowy override tylko dla małych kafelków zakresu materiału w pickerze `Materiał / grupa`, żeby zachowywały się jak kafelki wyboru pomieszczeń.
- `js/app/rozrys/rozrys-choice.js` — launchery i overlaye wyboru w ROZRYS.
- `js/app/rozrys/rozrys-state.js` — centralny store stanu ROZRYS (selection/options/ui/cache) używany jako wspólne źródło prawdy dla zakładki.
- `js/app/rozrys/rozrys-print.js` — eksport CSV / druk / helpery PDF w ROZRYS.
- `js/app/rozrys/rozrys-print-layout.js` — techniczny layout PDF/druk dla ROZRYS.
- `js/app/rozrys/rozrys-sheet-model.js` — model arkuszy/magazynu: dopasowanie formatów, podpisy, odejmowanie zużytych formatek, helpery podaży arkuszy.
- `js/app/rozrys/rozrys-sheet-helpers.js` — helpery canvas dla rysowania arkuszy.
- `js/app/rozrys/rozrys-sheet-draw.js` — główne rysowanie arkuszy na canvas.
- `js/app/rozrys/rozrys-stock.js` — helpery magazynu, formatu bazowego i podaży arkuszy dla ROZRYS; po tej paczce deleguje model danych do `rozrys-sheet-model.js`.
- `js/app/rozrys/rozrys-cache.js` — helpery cache planów ROZRYS.
- `js/app/rozrys/rozrys-accordion.js` — helpery accordionu materiałów ROZRYS.
- `js/app/rozrys/rozrys-lists.js` — listy i karty wyników ROZRYS: `Lista formatek`, `Formatki arkusza`, karta podsumowania, launchery eksportu i karty arkuszy.
- `js/app/rozrys/rozrys-render.js` — helpery auto-renderu z cache, renderu wyników i spinnera ROZRYS; po tej paczce deleguje karty/listy do `rozrys-lists.js`.
- `js/app/rozrys/rozrys-summary.js` — diagnostyka i modale walidacji/list ROZRYS, oparte o `rozrys-lists.js`.
- `js/app/rozrys/rozrys.js` — główna logika zakładki rozrysu / Optimax po dalszym oddelegowaniu pickerów, stanu, modelu arkuszy, rysowania, logiki stock-limit, auto-renderu i renderu wyników do modułów pomocniczych.

### Zakładki aktywnie ładowane przez `index.html`
- `js/tabs/wywiad.js — WYWIAD (pełny renderer w module)` — aktywny renderer zakładki WYWIAD.
- `js/tabs/rysunek.js` — aktywny renderer zakładki RYSUNEK.
- `js/tabs/material.js` — aktywny renderer zakładki MATERIAŁ.
- `js/tabs/czynnosci.js`
- `js/tabs/wycena.js` — zakładka `Wycena` z własnym layoutem list i snapshotem wyceny.

---

## Pliki obecne w repo, ale nieładowane bezpośrednio przez `index.html`

Te pliki **nie są entrypointami strony** i przed poprawkami trzeba najpierw sprawdzić, czy są naprawdę używane pośrednio:

- `js/app/investor/inwestor.js` — stary wariant UI inwestora; w praktyce aktywnym plikiem jest `investor-ui.js`.
- `js/app/shared/calc.js` — warstwa obliczeń pomocniczych; obecnie nieładowana z `index.html`.
- `js/app/shared/migrate.js` — migracje schematu; obecnie nieładowane z `index.html`.
- `js/app/shared/schema.js` — osobny moduł schematu; obecnie nieładowany z `index.html`.
- `js/app/optimizer/panel-pro-worker.js` — nie jest ładowany jako zwykły script, ale jest używany pośrednio jako Web Worker z `rozrys.js`.

### Zasada dla takich plików
Najpierw sprawdzić, czy plik jest:
1. ładowany przez `index.html`,
2. tworzony dynamicznie (np. Worker),
3. tylko historyczny / legacy.

Dopiero potem go zmieniać.

---

## Gdzie szukać problemów

- **klik nie działa** → `js/app/ui/bindings.js`, `js/app/ui/actions-register.js`
- **akcja robi złą rzecz** → `js/app/ui/actions-register.js` + handler domenowy
- **modal źle się zamyka / nakłada** → `js/core/modals.js` + miejsca domenowe w `app.js`
- **widok źle się przełącza** → `js/app/ui/views.js`, `js/app/ui/sections.js`, `setActiveTab()` w `js/app.js`
- **rozjeżdżają się dane projektu** → `js/app/investor/session.js`, `js/app/shared/storage.js`, `js/app/shared/validate.js`, fragmenty `js/app.js`
- **szafki renderują się źle / znikają** → `renderCabinets()` i wszystko, co go wywołuje
- **Optimax / rozrys działa źle** → `js/app/rozrys/rozrys.js`, `js/app/optimizer/cut-optimizer.js`, ewentualnie worker
- **MAX wygląda na zawieszony na starcie** → najpierw sprawdzić `js/app/rozrys/rozrys.js` (start workera / fallbacki / status UI), potem `js/app/optimizer/panel-pro-worker.js`; nie wpadać cicho w ciężki sync fallback na głównym wątku.

---

## Najbardziej ryzykowne miejsca pod regresje

1. `js/app.js` — duży plik z wieloma odpowiedzialnościami.
2. `renderCabinets()` — centralny render części aplikacji.
3. `setActiveTab()` — łatwo zepsuć przełączanie i odświeżanie.
4. `initUI()` — start i spinanie całej aplikacji.
5. `js/app/ui/bindings.js` — łatwo dodać duble listenerów.
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


- `js/app/material/price-modal.js (renderer + akcje modala cenników)` — wydzielony renderer modala cenników; `app.js` ma być tu tylko delegatorem.
- Martwy helper `renderFinishList()` został usunięty z `app.js`; aktywna logika wykończeń dla RYSUNKU ma siedzieć w module zakładki.


- `js/app/ui/tab-navigation.js` — centralna nawigacja zakładek i skoki między WYWIAD ↔ MATERIAŁ; źródło prawdy dla `setActiveTab()` i helperów focus/scroll.
- `js/app/ui/layout-state.js` — helpery layoutu/wykończeń RYSUNKU i zapisu projektu; źródło prawdy dla `ensureLayout()`, `saveProject()` i pokrewnych helperów.

- `js/app/ui/list-scroll-memory.js` — cienka pamięć pozycji scrolla i kotwicy szafki przy przejściach `Edytuj ↔ lista` w `WYWIAD` i `MATERIAŁ`.


- `js/app/material/material-common.js` — wspólne helpery materiałowe i formatowanie wydzielone z `app.js`.

- `js/app/cabinet/front-hardware.js` — wspólne obliczenia frontów i okuć (fronty do Materiałów, zawiasy BLUM, AVENTOS).
- `js/app/cabinet/cabinet-fronts.js` — reguły typów/podtypów, fronty, walidacja AVENTOS i generowanie frontów; źródło prawdy dla logiki frontów używanej przez modal i materiały.
- `js/app/cabinet/cabinet-modal.js` — pełna logika modala szafki i kreatora zestawów; źródło prawdy dla renderu modala, dynamicznych pól i zapisu zestawów.


- `js/app/shared/calc.js` — aktywny moduł lekkich helperów obliczeniowych (wysokość góry, top zestawów).


- `js/app/ui/settings-ui.js` — helpery ustawień pokoju i rozwijania kart wyjęte z `app.js`.


- `js/app/cabinet/cabinet-summary.js` — helper tekstowych podsumowań szafek wydzielony z `app.js`.


- Step 17: safe dead-code cleanup in `js/app.js` (removed unused `deleteSelectedCabinet()` and duplicate/trailing ballast comments).


- `js/app/cabinet/corner-sketch.js` — helper canvas szkicu narożnych szafek; wydzielony z `app.js` bez zmiany UI.


- `js/app/cabinet/cabinet-cutlist.js` — helper obliczeniowy `getCabinetCutList(cab, room)` wydzielony z `app.js` z fallbackiem wstecznym.


- `js/app/investor/project-bootstrap.js` — boot-time normalization helpers for project data; keep app.js lighter without changing UI.


- `js/app.js` ma też lekki, globalny debounce autosave projektu (`installProjectAutosave` / `scheduleProjectAutosave`) jako bezpiecznik na wypadek, gdy pojedynczy handler zmiany nie zapisze stanu od razu.

- Refresh behavior: normal page refresh no longer forces a return to Home; manual safe reset is available via `?safe=1` (and legacy `?reset=1`).

- Router widoków preferuje aktywny projekt (`roomType`) nad starym `entry: home`, żeby zwykły refresh nie wyrzucał na start.

- `js/app.js`: fallbacki dla `drawCornerSketch()` i `getCabinetExtraSummary()` zostały uproszczone do cienkich delegatorów; źródłem prawdy są moduły `js/app/cabinet/corner-sketch.js` i `js/app/cabinet/cabinet-summary.js`.


- Step 24: `app.js` odchudzone przez skrócenie dużych lokalnych wrapperów `material-common` i `front-hardware`; źródłem prawdy pozostają moduły `js/app/material/material-common.js` i `js/app/cabinet/front-hardware.js`, a w `app.js` zostały tylko cienkie delegatory z minimalnym fallbackiem.

- `js/app.js` trzyma już tylko minimalny awaryjny fallback dla `getCabinetCutList()`; pełna logika siedzi w `js/app/cabinet/cabinet-cutlist.js`.


- `js/app/cabinet/cabinet-actions.js` — proste akcje szafek (dodanie/usunięcie) wydzielone z `app.js`.
- `js/app/cabinet/cabinet-actions.js` i `js/app/cabinet/cabinet-summary.js` są teraz również ładowane bezpośrednio przez `index.html`, więc `app.js` nie musi utrzymywać rozbudowanych fallbacków tylko z powodu braku skryptu.

- `project-bootstrap.js` ładowany tylko raz w `index.html`; usunięty duplikat include.

- js/app.js korzysta już z preładowanych modułów constants/utils/storage/ui-state jako źródeł prawdy; w app.js zostały tylko lokalne fallbacki awaryjne.


- `js/app/shared/public-api.js` — publiczne bezpieczne API FC/App (boot/init, openRoom, safe akcje modali i zakładek).


- `js/app/shared/core-failsafe.js` — awaryjne minimalne fallbacki dla `FC.actions` i `FC.modal`, ładowane przed `app.js`.
- `js/app/shared/dom-guard.js` — walidacja wymaganych selektorów DOM, ładowana przed `app.js`.


- Step 33: trimmed app.js wrappers for dom-guard, project-bootstrap and calc/settings by delegating to preloaded modules with minimal local fallbacks.

- `js/app/investor/project-autosave.js` — globalny debounce autosave projektu i instalacja lekkiego bezpiecznika autosave dla zmian w obszarze aplikacji.


- `js/app/material/material-registry.js` — registry producentów i helper `materialHasGrain()` wydzielone z `app.js`.

- `schema.js` is now the primary source of truth for project/room normalization; `app.js` keeps only a minimal emergency fallback.
- `js/app/material/material-registry.js` jest źródłem prawdy dla producentów materiałów i helpera `FC.materialHasGrain(...)`.

- Step 40: przebudowa UI części ROZRYS pod Optimax (profile A→DD, kierunek opcjonalnie/wzdłuż/w poprzek, rzaz, obrównanie, minimalny użyteczny odpad) oraz nowy pasowy packer `packStripBands()` dla trybów wzdłuż/w poprzek.

- Step 61: tryby pasowe `wzdłuż` / `w poprzek` dostały mocniejsze legacy-strip dopakowanie końcówek (`packStripBands`): preferencja orientacji zgodnej z kierunkiem, fill resztek po pasach przez wolne prostokąty oraz łagodny bonus dla pełnych rzędów/kolumn.


## Step 62
- Rewritten `packStripBands()` in `js/app/optimizer/cut-optimizer.js` for stable `wzdłuż` / `w poprzek` strip modes.
- Strip selection now evaluates multiple candidate strip heights and uses a width DP to choose the best-fitting group for each strip.
- Residual free rectangles are also created under shorter pieces inside a strip, then globally filled.
- Goal: restore practical strip behavior (group-oriented, near-full strips, <=100 mm acceptable tail waste) without relying on `optional` heuristics.
- Step 63: tryby pasowe `wzdłuż` / `w poprzek` dostały twardą preferencję orientacji końcowej na poziomie doboru kandydatów (`preferredCandidatesForItem` w `js/app/optimizer/cut-optimizer.js`). Jeśli dla elementu istnieje wariant zgodny z wybranym kierunkiem pasa, solver używa go zamiast mieszać orientacje w residual fill / planowaniu pasa.

- Step 64: `packStripBands()` przebudowany na pełny search wariantów dla jednej płyty. Tryby `wzdłuż` / `w poprzek` porównują teraz kilka strategii budowy pasów dla całego arkusza, wybierają najlepszy cały arkusz po occupancy / dużych pustkach, a dopiero potem przechodzą do następnej płyty. To ma ograniczyć duże białe pola i monotonne słabe układy.


## step65
- Strip modes (`wzdłuż` / `w poprzek`) dostały endgame dla ostatnich 2 płyt: dodatkowe strategie i więcej testów obrotu, oceniane wspólnie jako para arkuszy.
- W ogonie solver premiuje większe dociśnięcie przedostatniej płyty i bardziej kompaktową ostatnią płytę.

- step66: wzmocniono końcówkę trybów pasowych (`wzdłuż`/`w poprzek`) o strategie exact-band/exact-band-rot, silniejszą kontrolę pełnych pasów jednowymiarowych oraz scoring premiujący równomierne pasy na ostatnich 2 płytach.

- step67: profile A–D w Optimax przeszedł z budżetu czasowego na budżet prób (`maxAttempts`) z osobnym limitem `endgameAttempts=200` dla końcówki. `rozrys.js` pokazuje teraz próby zamiast sekund. W workerze strip modes dostały tylko lokalny polish ostatniego arkusza przez ponowne sortowanie/repack ostatniego sheetu; główne planowanie pasów nie zostało ruszone.

- step68: bez zmiany rdzenia algorytmu zmieniono nazwy trybów cięcia na uczciwsze (`Preferuj pasy wzdłuż/poprzek`) oraz poprawiono raportowanie postępu prób. Worker wysyła teraz osobno postęp prób głównych i końcówki ostatniego arkusza, dzięki czemu licznik nie stoi pozornie w miejscu ani nie skacze na końcu.

- step69: doprecyzowano raportowanie postępu prób w Optimax. Worker wysyła teraz nie tylko liczbę ukończonych prób, ale też numer aktualnie analizowanej próby (`currentAttempt` / `currentTailAttempt`) i fazę (`main` / `tail`). UI pokazuje dzięki temu bardziej realny stan: `Ukończone ...` oraz `W toku ...`, zamiast sprawiać wrażenie, że licznik stanął.
- step72: uproszczono UI postępu w `js/app/rozrys/rozrys.js`. Usunięto górny globalny licznik/box postępu (`rozrysGlobalStatus`) i zostawiono tylko lokalny licznik przy aktualnie liczonym materiale. Z opisu zniknął też etap/faza liczenia — status pokazuje już tylko materiał i `Najlepsze`.
- step73: wydzielono tryby pasowe do osobnego pliku `js/app/strip-solver.js`. `js/app/optimizer/cut-optimizer.js` zachowuje tylko wrapper `packStripBands()` + wspólne API, a `index.html` ładuje teraz osobno solver pasowy przed silnikiem głównym. Cel: odseparować `Preferuj pasy wzdłuż / w poprzek` od ryzykownych zmian w innych heurystykach Optimax.


## 2026-03-11 — step75
- `js/app/strip-solver.js`: stabilny solver trybów „Preferuj pasy wzdłuż / w poprzek”; nie mieszać z optional.
- `js/app/optional-solver.js`: nowy solver trybu „Opcjonalnie kierunek cięcia”. Liczy płyta po płycie, porównuje pełne warianty `along/across` oraz warianty hybrydowe z jednym głównym splitem i zmianą kierunku w drugiej części płyty. Końcówka dopieszcza ostatnie 2 płyty i jeszcze raz ostatnią.
- `js/app/optimizer/panel-pro-worker.js`: worker importuje teraz `optional-solver.js` i dla trybu optional korzysta z oddzielnego toru liczenia, bez dotykania solvera pasowego.


- step76: optional dostał bardziej produkcyjny scoring końcówki: kara za śmieciowy odpad / utylizację (małe i pocięte resztki), premia za grupowanie drobnicy w jednym wspólnym rzędzie/pasie oraz finalny rebalance ostatnich 2 płyt przed polish ostatniej. Zmiany zamknięte wyłącznie w `js/app/optional-solver.js`; tryby pasowe w `js/app/strip-solver.js` pozostają bez zmian.
- step89: tryb `Opcjonalnie` dostał mocniejsze reguły konstrukcyjne pod pasy startowe i słabe pasy. Solver próbuje teraz startować od konkretnych dużych formatek, wymusza 2. pas tylko gdy oba pasy mają >=90% zapełnienia, po pasie startowym ocenia resztę zarówno wzdłuż, jak i w poprzek, a słabe pasy (>20% odpadu) próbuje przebudować przez wyrzucenie zbyt małych elementów i dołożenie podobnej drobnicy w grupie +/- 75 mm. Worker dostał nowy znacznik cache `20260312_optional_v8` / `20260312_optional_rewrite_v8`.

- step77: tryby pasowe (`js/app/strip-solver.js`) dostały scrap-aware tail polish w obrębie residual fill i score: kara za śmieciowy odpad / długie cienkie ścinki oraz nowy shared-row fill dla drobnicy w resztkowych prostokątach, żeby częściej grupować małe elementy obok siebie zamiast otwierać wiele pojedynczych mikro-stref.


- `js/app/optional-solver.js` — solver trybu „Opcjonalnie”; od step79 uczy się od stabilnych solverów pasowych (`along/across`) przez kandydaty bazowe i dogęszczanie największych wolnych prostokątów przeciwnym kierunkiem, bez zmiany działania samych trybów pasowych.

- step81: `js/app/optional-solver.js` dostał nowy typ kandydatów `seed-*` inspirowany proponowanym algorytmem pasa startowego: optional próbuje zbudować 1 mocny pas startowy z grupy podobnych formatów (oraz 2. pas tylko gdy oba są bardzo dobrze wypełnione), a dopiero resztę płyty dopycha solverem pasowym. Kandydaty `seed-*` korzystają z grupowania podobnych wymiarów i mogą używać obrotu formatek, jeśli wolno. To pierwszy krok w stronę modelu „1–2 pasy startowe + dalsze liczenie reszty płyty”.


## 2026-03-12 — optional solver rewrite v2
- `js/app/optional-solver.js` przepisany ponownie jako konstrukcyjny solver: 1–2 pasy startowe z klastrów podobnych wymiarów, potem dogęszczenie reszty drugim kierunkiem przez solver pasowy.
- Nie zmieniano `js/app/strip-solver.js`; tryby wzdłuż / w poprzek pozostają bezpieczne i osobne.
- Podbito wersję workera w `js/app/rozrys/rozrys.js`, żeby przeglądarka nie trzymała starego worker cache.

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
  - `js/app/optimizer/start-along.js` → `Pierwsze pasy wzdłuż` (wymusza oś `along`)
  - `js/app/optimizer/start-across.js` → `Pierwsze pasy w poprzek` (wymusza oś `across`)
  - `js/app/optimizer/start-optimax.js` → `Opti-max`
- Dodano osobne moduły szybkości liczenia:
  - `js/app/optimizer/speed-turbo.js` → `Turbo` (shelf)
  - `js/app/optimizer/speed-dokladnie.js` → `Dokładnie`
  - `js/app/optimizer/speed-max.js` → `MAX`
- `MAX` realizuje aktualny rdzeń algorytmu użytkownika: 1–2 pasy startowe, sprawdzanie pasa po powierzchni, obowiązkowa zmiana kierunku po pasach startowych, bez otwierania nowej płyty przed zamknięciem poprzedniej.
- `js/app/optimizer/cut-optimizer.js` został uproszczony do wspólnych narzędzi i shelf fallbacku.
- `js/app/optimizer/panel-pro-worker.js` został napisany od nowa pod nowy podział start/szybkość.
- `js/app/rozrys/rozrys.js` i `index.html` zostały przepięte na nowe opcje UI i nowe pliki.

- Step 18: kept cut-direction select order as `wzdłuż -> w poprzek -> Opti-max` to match requested UI order without changing solver logic.

- 2026-03-14: swapped runtime behavior of `start-along` and `start-across` for all Panel PRO speed modes (Turbo, Dokładnie, MAX) so labels stay the same but `wzdłuż` starts along board length and `w poprzek` starts across board width; bumped solver cache-busting version to `20260314_max_plan_v1`.

- `js/app/rozrys/rozrys.js` steruje teraz też stanem przycisku generowania: brak cache = zielony `Generuj rozkrój`, cache hit / gotowy wynik = niebieski `Generuj ponownie`, liczenie = czerwony `Anuluj`.

- 2026-03-14: przebudowano `js/app/optimizer/speed-max.js`, żeby `MAX` wybierał najlepszy pełny plan arkusza po ocenie całych kandydatów 1–2 pasów startowych, a nie tylko pojedynczego najlepszego pierwszego pasa. `MAX` dalej zamyka arkusz przed otwarciem następnego, trzyma obowiązkową zmianę kierunku po pasach startowych i zachowuje repair słabego pasa; podbito cache-busting do `20260314_max_plan_v1`.


---

## Ostatnie zmiany robocze

- ROZRYS: dodany widoczny status liczenia z animacją, paskiem postępu orientacyjnego, licznikiem sekundowym i opisem aktualnie liczonego materiału / koloru.
- ROZRYS: przy starcie generowania wymuszony repaint UI przed cięższą pracą, żeby przycisk szybciej przechodził w czerwony stan `Anuluj` także na telefonach.
- ROZRYS: status pokazuje też szacunkową liczbę płyt i bieżący numer arkusza, jeśli worker raportuje postęp.
- ROZRYS: pozostawiony fallback twardego zatrzymania workera, żeby UI nie wisiało przy anulowaniu.
- ROZRYS: usunięto górny, zdublowany status z licznikiem; zostawiono tylko jeden status w obszarze wyniku.
- ROZRYS: pasek postępu idzie teraz proporcjonalnie do policzonych płyt względem oszacowania (np. 3 z ~5 = 60%%).
- 2026-03-14: przebudowano `js/app/optimizer/speed-max.js` jeszcze raz pod spec użytkownika: `MAX` liczy teraz pojedynczy wariant arkusza dla zadanego startu osi, robi 1–2 idealne pasy startowe, potem obowiązkowo zmienia kierunek i domyka resztę kolejnymi idealnymi pasami; dopiero gdy w danej osi nie ma idealnego pasa, sprawdza zmianę osi i na końcu fallback do najlepszego nieidealnego pasa. `Opti-max` porównuje już tylko 1 wariant startu wzdłuż vs 1 wariant startu w poprzek. Worker i UI dostały dokładniejsze fazy progresu oraz licznik „zamknięta płyta X / liczę płytę Y”.

- 2026-03-14: przebudowano `js/app/optimizer/speed-max.js` jeszcze raz pod doprecyzowaną specyfikację użytkownika: `MAX` buduje każdy pas od największego aktualnie pasującego elementu, sprawdza dla tego pasa obie dozwolone orientacje, dobiera formatki o tej samej grubości pasa lub mniejsze maks. o 75 mm, próbuje kolejno progi 90% i 80% (z wyjątkiem drugiego pasa startowego, który powstaje tylko przy 90%), a dopiero po niepowodzeniu zmienia kierunek lub schodzi do fallbacku. Nie ruszano działania trybów startu `wzdłuż` / `w poprzek`; podbito cache-busting do `20260314_max_user_algo_v1`.


## 2026-03-15 — MAX seed sweep and tiny-block grouping
- `js/app/optimizer/speed-max.js`: MAX now reviews all sensible seed starts for a band (unique fitting start sizes, biggest-to-smaller) before lowering threshold or switching axis.
- `js/app/optimizer/speed-max.js`: tiny repeat parts can be paired into grouped block candidates inside a band to reduce scattered micro-strips.
- `js/app/optimizer/panel-pro-worker.js`, `js/app/rozrys/rozrys.js`, `index.html`: cache-busting bumped for the new MAX solver build.

- 2026-03-15: MAX now scans seeds sequentially from largest area to smaller and accepts the first seed that reaches the requested occupancy target; ROZRYS waste summary uses full board dimensions and drawing shows the trim border around the usable area.

- 2026-03-15: ROZRYS — dodano procent odpadu przy nagłówku każdego arkusza (widok i eksport PDF/druk), liczony od pełnej płyty.

- 2026-03-15: `js/app/optimizer/speed-max.js` tuned per user request: MAX now tests only the top 5 unique seed starts for each band (largest unique candidates first) and raises the secondary occupancy threshold from 80% to 85%; cache-busting updated to `20260315_max_top5_90_85_v1`.
- 2026-03-15: `js/app/optimizer/speed-max.js` — start-pass 1 i 2 mają teraz twardą kolejność `90% -> 85% -> dopiero fallback`, z testem top 5 unikalnych seedów i obu orientacji każdego seeda; fallback został przerobiony na preferencję fizycznego cięcia po długości płyty (wewnętrzna oś `across`) z układaniem od najszerszych do najwęższych elementów.
- 2026-03-15: `js/app/optimizer/speed-max.js` — ostatni arkusz może być oznaczony jako wirtualne `0.5` płyty, jeśli komplet pozostałych elementów mieści się na połowie formatu; `js/app/rozrys/rozrys.js` liczy wtedy podsumowanie i % odpadu dla tej połówki, ale nadal rysuje arkusz na pełnej płycie.
- 2026-03-15: `js/app/optimizer/panel-pro-worker.js`, `js/app/rozrys/rozrys.js` — cache-busting bumped to `20260315_max_virtual_half_v1`.

- 2026-03-15: magazyn rozróżnia teraz pełne i realne pół płyty przez format; ROZRYS wybiera największy format jako hint, a MAX może użyć realnej połówki z magazynu na końcówce (rysowanej nadal na pełnym arkuszu) lub tylko oznaczyć wirtualne 0,5, gdy realnej połówki brak.


## 2026-03-15 – real_half_inventory_v2
- Half-sheet detection is now strict: full length + half short side only; no rotated whole-half acceptance.
- Virtual/real half preview uses lengthwise-only logic.
- Added dashed divider line on rendered sheets when half-board logic is active.

- 2026-03-15: MAX updated: band similarity 50mm, thresholds 95%/90%, and last-sheet virtual half now re-runs normal MAX on 2800x1030 and replaces the last layout before drawing on full board. Half divider drawn as stronger dashed line above placements.
- step: uproszczono panel ROZRYS — usunięto tekst wstępny pod nagłówkiem, a opcje dodatkowe (jednostki, wymiary do cięcia, rzaz, obrównanie i minimalny użyteczny odpad) przeniesiono do pływającego okna „Opcje rozkroju” z zapisem w localStorage.


- `js/app/ui/confirm-box.js` — współdzielony modal potwierdzeń (zamiast natywnego `confirm()`), do użycia także w innych miejscach aplikacji.

- `js/app/ui/info-box.js` — mały, wielorazowy modal informacji/pomocy otwierany z ikon `?` przy polach paneli.
- 2026-03-18: `js/app/ui/panel-box.js` + `js/app/rozrys/rozrys-validation.js` — dodano współdzielone okno list/diagnostyki dla ROZRYS oraz walidację rozkroju względem snapshotu; `Lista formatek` pokazuje teraz RAW snapshot 1:1 z Materiałów, listę do rozkroju po scaleniu i wynik walidacji, a każdy arkusz ma własną listę formatek.
- 2026-03-20: `js/app/rozrys/rozrys.js`, `js/app/material/magazyn.js`, `css/style.css`, `index.html` — przebudowano źródło wyboru ROZRYS pod jeden inwestor + wiele pomieszczeń: dodano picker pomieszczeń, nowy picker materiałów per kolor z trybem fronty/korpusy, usunięto wyszukiwarkę z pickera materiałów, a lista materiałów buduje się teraz z zaznaczonych pomieszczeń i sumuje ten sam materiał między nimi. Zapis formatu z ROZRYS do Magazynu dodaje już +1 szt. do istniejącego lub nowego formatu po własnym potwierdzeniu; pola formatu i przycisk `Dodaj format` są teraz w jednym rzędzie. Regresje do sprawdzenia: wielopomieszczeniowe sumowanie HDF i laminatów, pojedynczy materiał z samymi frontami / samym korpusem / obiema grupami, ponowne generowanie z cache po zmianie pomieszczeń i poprawne dodawanie kolejnych sztuk tego samego formatu do magazynu.
- 2026-03-21: `js/app/rozrys/rozrys.js`, `css/style.css`, `index.html` — dopracowano panel ROZRYS po przebudowie wielopomieszczeniowej. Pola formatu i przycisk `Dodaj format` zostały przeniesione przy przycisku `Generuj rozkrój`, a mobile layout przestał wypychać format poza kartę. Picker pomieszczeń i picker materiału mają teraz dynamiczne stopki: bez wyboru pokazują niebieski `Zamknij`, po wyborze czerwony `Anuluj`, a zielony `Zatwierdź` aktywuje się dopiero po realnym zaznaczeniu. W pickerze materiału karty z frontami/korpusami startują bez domyślnego zaznaczenia, a górna krawędź pierwszej karty nie jest już przycinana. Poprawiono też warstwowanie `info/confirm`, żeby komunikaty nie wpadały pod główne okno panelowe. Dodatkowo ROZRYS respektuje teraz limit stanów magazynowych dla dokładnie wybranego formatu: arkusze mieszczące się w stanie są oznaczane na zielono `z magazynu`, a brakujące na czerwono `zamówić`; przy niedoborze mniejszego formatu brakujące arkusze są doplanowywane na największym formacie dla materiału zamiast bez końca schodzić poniżej stanu. Regresje do sprawdzenia: brak zasłoniętych komunikatów przy pustym wyborze pomieszczeń, poprawne położenie sekcji `Dodaj format` obok `Generuj rozkrój`, zapis materiału dopiero po ręcznym zaznaczeniu frontów/korpusów oraz oznaczenia `z magazynu` / `zamówić` przy różnych stanach magazynowych.

- 2026-03-22: ROZRYS mobile/UI fix — akcje formatu utrzymane obok przycisku generowania, picker materiału działa jako pojedynczy wybór (albo Wszystkie, albo 1 materiał), a brakujące arkusze po wyczerpaniu mniejszego formatu mają przechodzić na pełny format z aktualnych pól zamiast zamawiać kolejne małe formatki.

- 2026-03-22: `js/app/rozrys/rozrys.js`, `js/app/material/magazyn.js`, `index.html` — ROZRYS zużywa teraz najpierw realne formaty dostępne w magazynie dla danego materiału (do maksymalnego stanu i tylko w takiej liczbie arkuszy, jaka naprawdę pasuje), a dopiero brakujące elementy doplanowuje na pełnej płycie z aktualnych pól ROZRYS. Poprawiono też styl akcyjnych przycisków w obszarze ROZRYS/MAGAZYN na warianty z białą czcionką oraz usunięto natywne `confirm()`/`alert()` z bieżąco poprawianego magazynu płyt. Regresje do sprawdzenia: mały format z magazynu musi być użyty przed pełną płytą, po wyczerpaniu stanu kolejne arkusze mają mieć pełny format z pól ROZRYS, a przyciski `Dodaj format`, `Dodaj do magazynu` i `Usuń` mają zachować spójny styl kolorystyczny.
- 2026-03-22: `js/app/rozrys/rozrys.js`, `js/app/material/magazyn.js`, `css/style.css`, `index.html` — dopięto pamiętanie ROZRYS po odświeżeniu względem stanów magazynowych: klucz cache uwzględnia teraz pełny podpis formatów i ilości z magazynu dla materiału, a auto-podgląd z cache odtwarza ten sam stan co ręczne generowanie. Logika stock-first została poprawiona tak, żeby mniejsze formaty z magazynu były testowane najpierw tylko dla formatek, które fizycznie mieszczą się na danym arkuszu; dopiero reszta idzie na pełną płytę z pól ROZRYS. W Magazynie przycisk `Dodaj do magazynu` inkrementuje istniejący format zamiast nadpisywać ilość, a potwierdzenie usuwania ma już czerwone `✕ NIE` i zielone `✓ TAK` z białą czcionką. Regresje do sprawdzenia: po odświeżeniu ten sam rozkrój ma wracać z cache przy niezmienionych ustawieniach, stan magazynu ma być zużywany najpierw dla pasujących małych arkuszy, a pozycje dodawane drugi/trzeci raz do Magazynu mają zwiększać ilość zamiast ją resetować.


## 2026-03-22 — ROZRYS / format bazowy vs magazyn
- Format bazowy arkusza został przeniesiony do opcji rozkroju.
- Główny panel nie może już zmieniać bazowego formatu przez dodawanie płyty do magazynu.
- Przycisk w ROZRYS otwiera osobny modal dodawania płyty do magazynu (materiał, format, ilość).
- Regresja do sprawdzenia: po dodaniu małej płyty do magazynu bazowy format rozrysu ma pozostać bez zmian po odświeżeniu i po ponownym wejściu do ROZRYS.

- 2026-03-22: ROZRYS — opcje rozkroju: przywróć domyślne + stan Wyjdź/Anuluj/Zapisz; wizualizacja arkuszy ma używać faktycznego rozmiaru arkusza z magazynu, nie globalnego formatu bazowego.
- 2026-03-22: `js/app/rozrys/rozrys.js`, `index.html` — naprawiono reset „Przywróć domyślne” w Opcjach rozkroju tak, żeby zawsze wracał także do jednostek `cm`. Render arkuszy używa teraz wspólnej skali względem formatu bazowego, więc mniejsze płyty z magazynu są rysowane wizualnie proporcjonalnie mniejsze zamiast rozciągać się do szerokości całej karty.

- 2026-03-22: `js/app/rozrys/rozrys.js`, `index.html` — eksport PDF/druk ROZRYS przerobiony na strony A4 landscape, jedna strona = jeden arkusz z własnym nagłówkiem. Usunięto sztuczne rozciąganie obrazów w PDF (`img` nie ma już `width:100%`), więc małe arkusze z magazynu zachowują proporcjonalnie mniejszy rozmiar także w wydruku. Regresje do sprawdzenia: brak pustych stron między arkuszami, pierwszy arkusz nie może lądować samotnie po tytule, a mały arkusz z magazynu ma pozostać mniejszy wizualnie od pełnej płyty również w podglądzie PDF.
- 2026-03-22: PDF/druk ROZRYS — poprawiono składanie stron: tytuł i arkusz na tej samej stronie, bez pustych stron między arkuszami; wymuszono layout A4 poziomo i czekanie na załadowanie obrazów przed otwarciem wydruku.


- PDF/druk ROZRYS: małe arkusze mogą trafić 2 na stronę tylko bez zmiany wspólnej skali względem pełnej płyty; nie wolno ich rozciągać do wolnego miejsca strony.


- 2026-03-22: PDF eksport ROZRYS — wszystkie arkusze obracane o 90° w druku; małe arkusze mogą wejść 2 na stronę tylko przy tej samej skali względem pełnej płyty.

- 2026-03-21: ROZRYS picker materiałów — pojedyncze zakresy (np. samo `Korpusy` przy HDF) renderowane jako checkbox-chip w tym samym stylu co reszta opcji; usunięty zielony badge-only dla takich kart.
- 2026-03-22: ROZRYS action row corrected from site_hdf_checkbox base: Opcje moved into shared panel-box modal with field descriptions, top extra settings block removed, action buttons ordered Opcje → Dodaj płytę → Generuj in one row, selection launchers widened with rooms more compact and material wider.

- 2026-03-22: ROZRYS action row — przywrócono poprzedni, kolorowy styl przycisków `Opcje` / `Dodaj płytę` / `Generuj ponownie` z bazy `site_rozrys_action_row_fix.zip` i dodano delikatny glow dookoła każdego z nich bez zmiany układu jednego rzędu ani wysokości wzorcowego przycisku `Generuj ponownie`.

- 2026-03-22: ROZRYS action row — usunięto glow wokół przycisków `Opcje` / `Dodaj płytę` / `Generuj ponownie`, dodano subtelniejszą ciemną ramkę oraz obniżono wysokość przycisków, zachowując układ jednego rzędu i kolejność `Opcje → Dodaj płytę → Generuj ponownie`.

- 2026-03-22: ROZRYS action row — obniżono wysokość przycisków `Opcje` / `Dodaj płytę` / `Generuj ponownie` o kolejne 8 px względem paczki `site_rozrys_action_border_low.zip`, bez zmiany kolejności i układu jednego rzędu.

- 2026-03-22: ROZRYS action row buttons now have explicit `font-size: 16px` in `.rozrys-action-btn` so the label style no longer depends on inherited browser/default sizing.

- 2026-03-22: ROZRYS action row buttons keep explicit 16px font on larger screens and 13px on screens <=640px; layout/order unchanged.

- 2026-03-22: Wariant C przycisków ROZRYS: warsztatowy / panelowy.

- 2026-03-22: workshop variant ROZRYS action row — fixed dark text on green action buttons locally for btn-success / btn-generate-green, including hover/active/focus.

- 2026-03-22: workshop variant ROZRYS action row — wszystkie przyciski w rzędzie mają teraz ciemny napis; lekko rozjaśniono tła kolorów (zielony/niebieski/czerwony) oraz subtelnie rozjaśniono ramki, zachowując układ, wysokość i warsztatowy charakter.

- 2026-03-22: ROZRYS action row (workshop softlight) — all button labels switched to graphite (#374151); cache-busting bumped for css/style.css.

- 2026-03-22: Wariant workshop ROZRYS — przyciemniono kolor napisów przycisków z grafitu #374151 do ciemniejszego antracytu #1f2937, bez zmian układu, wysokości i tła.

- 2026-03-22: Global button press/focus visual updated across the app: removed blue rectangular tap highlight and replaced it with a rounded white press flash matching each button's border radius.
- 2026-03-22: Globalnie ujednolicono kolorowe przyciski (.btn-primary/.btn-success/.btn-danger/.btn-generate-* oraz confirm-btn w tonach success/danger/neutral) do wzorca z rzędu ROZRYS: jaśniejsze tła, rozjaśnione ramki, ciemny napis, wspólny biały flash, desktop 16px / mobile 13px; większe warianty (np. home-btn btn-primary) ścięto do tej samej wysokości wzorcowej.


## 2026-03-22 — globalny system przycisków + ROZRYS popup choice v2
- Przyciski w całej aplikacji: usunięte unoszenie przy hover/active, cień ustawiony lekko po skosie w dół/prawo, biały press flash zachowany w kształcie przycisku.
- Kolory bazowych przycisków (.btn / .btn-* / confirm-btn / room-btn / floating-add / info-trigger) dopasowane do zaakceptowanego wzorca z rzędu ROZRYS.
- Przyciski strony głównej (.home-btn) zachowują swoją dotychczasową wysokość/padding — cofnięto wcześniejsze spłaszczenie kolorowego CTA.
- ROZRYS: Szybkość liczenia i Kierunek cięcia używają własnych popupów wyboru zamiast systemowych selectów.
- Opcje rozkroju: stałe opisy pod polami usunięte; informacje są dostępne spod ikony ? przy etykietach.
- Opcje rozkroju: Jednostki i Wymiary do cięcia też używają własnych popupów wyboru zamiast systemowych selectów.

- 2026-03-22: UI polish v3 — przywrócono duży font przycisków home-btn, dopieszczono górny tab `CZYNNOŚCI` (bardziej wyśrodkowany, delikatnie ciaśniejszy napis na mobile), etykiety ROZRYS wyrównano do lewej, ikony `?` dostały własny styl graficzny, a akordeony materiałów/arkuszy w ROZRYS dostały ramkę i cień zgodne z przyciskami.


## 2026-03-22 — modal typography unify + global window close UX
- Wszystkie okna/popupy dostały ujednoliconą typografię tytułów na wzór ROZRYS/Optimax.
- Zamknięcia okien ujednolicone do kółka z `×` (panel-box, info-box, stare modale, lista inwestorów, choice popupy ROZRYS).
- `Wróć` w potwierdzeniach ustawione jako niebieski wariant neutralny.
- Górne przyciski sesji: gdy brak zmian pokazywany jest jeden niebieski `Wyjdź`; gdy są zmiany wracają `Anuluj` + `Zapisz`.


## 2026-03-23 — modal/session/cabinet fix
- Naprawiono `refreshSessionButtons` w `js/app/ui/bindings.js` (błąd zakresu po refaktorze delegacji).
- Przywrócono właściwy header modala szafki: `Anuluj` + `Zatwierdź`, bez `X`.
- Usuwanie szafki w wywiadzie korzysta z `confirmBox`, nie z systemowego `confirm()`.
- `panel-box` dostał tytuł jak nagłówek Optimax także na mobile.

- 2026-03-23: UI polish follow-up — modal szafki: przy dodawaniu zielony CTA = 'Dodaj', przy edycji = 'Zapisz zmiany'; MAGAZYN: szerokie pole materiału + dolny rząd szer./wys./ilość/przycisk; ROZRYS: lepiej wyśrodkowane etykiety względem ikon ?, czytelniejsza ikona ?, oraz 3-liniowy opis w launcherze materiału.

- 2026-03-23: Fix mobilnego scrolla w modalach pełnoekranowych. `.modal` działa teraz jako kolumna flex z przewijalnym `.modal .body`, żeby dodawanie/edycja szafki i podobne okna dały się przewijać na telefonie.

- 2026-03-24: ROZRYS — usunięty globalny checkbox struktury; sterowanie słojami przeniesione per materiał (accordion) z popupem wyjątków. Dodany helper js/app/rozrys/rozrys-grain.js i naprawione utrwalanie hasGrain w validate.js.

- 2026-03-25: Słój per formatka: dodano js/app/material/material-part-options.js, modal "Opcje formatki" w zakładce Materiał, kierunek słojów (domyślny/poziom/pion/bez znaczenia), oraz poprawiono modal "Wyjątki słojów" na mechanikę Wyjdź/Anuluj/Zapisz.

- 2026-03-25: grain modal polish v2 — sticky/footer actions for `Opcje formatki` and `Wyjątki słojów`, neutral preview for `Domyślny z materiału`, stronger disabled styling for grain controls.

- 2026-03-25: grain dirs v3 — fixed visible footer actions in `Opcje formatki` and `Wyjątki słojów` by switching both modals to a `panel-box-form` layout with separate scroll area + bottom action bar; corrected `Domyślny z materiału` preview to show the default grain direction from material (axis 1 / horizontal).

- 2026-03-25: panel-box large windows unified again: contentNode-based panel boxes now top-align with ~20dvh offset, internal body scroll, and sticky footer; message-only small boxes stay centered. Cache-busting updated to `20260325_panelbox_top20_v1`.

- 2026-03-26: panel-box forms on mobile now reset scroll on open, keep 20dvh top offset, and use inner form scroll with stable sticky footer to avoid action buttons dropping below viewport.

## Dalsze propozycje porządkowania ROZRYS (częściowo wdrożone)

1. `js/app/rozrys/rozrys-choice.js` — wdrożone w tej paczce jako pierwszy krok zamiast większego `rozrys-pickers.js`.
   - wydzielone: `getSelectOptionLabel()`, `setChoiceLaunchValue()`, `createChoiceLauncher()`, `openRozrysChoiceOverlay()`.
   - dalszy krok: dołożyć tu jeszcze `openRoomsPicker()` i `openMaterialPicker()`.

2. `js/app/rozrys/rozrys-print.js` — wdrożone w tej paczce.
   - wydzielone: `buildCsv()`, `downloadText()`, `openPrintView()`, `pxToMm()`, `measurePrintHeaderMm()`.

3. `js/app/rozrys/rozrys-sheet-draw.js`
   - wydzielić: `scheduleSheetCanvasRefresh()`, `drawSheet()`, helpery wymiarów, etykiet i rysowania oklein;
   - po co: warstwa canvas jest duża i wizualnie ryzykowna, więc powinna być odseparowana od logiki danych.

4. `js/app/rozrys/rozrys-stock.js` — wdrożone częściowo w tej paczce.
   - wydzielone: helpery formatu bazowego, magazynu i podaży arkuszy (`getSheetRowsForMaterial()`, `getExactSheetStockForMaterial()`, `getLargestSheetFormatForMaterial()`, `clonePlanSheetsWithSupply()` i powiązane funkcje).
   - dalszy krok: przenieść tam jeszcze całe `applySheetStockLimit()`.

5. `js/app/rozrys-cache-progress.js`
   - wydzielić: `tryAutoRenderFromCache()`, cache planów, ticker globalny, status generowania i anulowanie liczenia;
   - po co: postęp liczenia i cache są dziś w jednym miejscu z renderem, a to utrudnia dalsze rozwijanie trybów `Super` i `Ultra`.

6. `js/app/rozrys/rozrys-accordion.js` — wdrożone częściowo w tej paczce.
   - wydzielone: `splitMaterialAccordionTitle()`, `createMaterialAccordionSection()`.
   - dalszy krok: przenieść tam jeszcze `renderMaterialAccordionPlans()`.


## 2026-03-27 — ROZRYS split v3 (render/cache preview)
- Dodano `js/app/rozrys/rozrys-render.js`.
- Z `js/app/rozrys/rozrys.js` wydzielono: `buildEntriesForScope()`, `tryAutoRenderFromCache()`, `renderOutput()`, `renderLoadingInto()`.
- `index.html` dopięty do nowego modułu i cały pakiet skryptów `rozrys-*` dostał wspólny cache-busting `20260327_rozrys_stock_validation_v4`.
- Usunięto martwy, nieużywany `deriveAggForMode()` z `js/app/rozrys/rozrys.js`.
- Efekt: dalsze odchudzenie `rozrys.js` bez zmiany UI i bez ruszania solverów.


## 2026-03-27 — ROZRYS split v5 (4 kolejne wydzielenia)
- Dodano nowe moduły: `js/app/rozrys/rozrys-summary.js`, `js/app/rozrys/rozrys-progress.js`, `js/app/rozrys/rozrys-stock-modal.js`, `js/app/rozrys/rozrys-runner.js`.
- Z `js/app/rozrys/rozrys.js` wydzielono: diagnostykę/walidację list (`Lista formatek`, `lista arkusza`), stan/progres/anulowanie generowania, modal `Dodaj płytę do magazynu`, oraz przebieg generowania materiałów (`generate()` + `runOne()` jako osobny runner).
- `index.html` dostał wspólny cache-busting `20260327_rozrys_split_v5` dla całego pakietu `rozrys-*`.
- Cel paczki: dalsze odchudzenie `rozrys.js` bez zmiany UI i bez ruszania solverów.


## 2026-03-27 — ROZRYS split v7 (state + sheet-model + lists)
- Dodano nowe moduły: `js/app/rozrys/rozrys-state.js`, `js/app/rozrys/rozrys-sheet-model.js`, `js/app/rozrys/rozrys-lists.js`.
- `rozrys-state.js` wprowadza centralny store stanu ROZRYS (`selection`, `options`, `ui`, `cache`) oraz helper budowy bazowego stanu z kontrolek panelu.
- `rozrys-sheet-model.js` przejął modelowanie arkuszy/magazynu: dopasowanie formatów, podpisy formatek, odejmowanie zużytych elementów i helpery podaży arkuszy.
- `rozrys-lists.js` przejął warstwę list/kart wyników ROZRYS: tabela `Lista formatek`, tabela `Formatki arkusza`, karta podsumowania, akcje eksportu i karty arkuszy.
- `js/app/rozrys/rozrys-stock.js` deleguje logikę modelu danych do `rozrys-sheet-model.js` zamiast trzymać wszystko w jednym pliku.
- `js/app/rozrys/rozrys-render.js` i `js/app/rozrys/rozrys-summary.js` delegują UI list i kart do `rozrys-lists.js`.
- `js/app/rozrys/rozrys.js` został spięty z centralnym store stanu ROZRYS, dzięki czemu wybory zakresu, podstawowy stan opcji, status przycisku i ostatni stan cache są utrzymywane w jednym miejscu.
- `index.html` dostał nowy wspólny cache-busting pakietu `rozrys-*`: `20260327_rozrys_split_v7`.

## 2026-03-27 — ROZRYS dev tests / anty-regresja
- Dodano `js/testing/rozrys/fixtures.js` — stałe scenariusze testowe dla ROZRYS (prosty plan, plan mieszany magazyn+zamówić, przypadki cache i wydruku).
- Dodano `js/testing/rozrys/tests.js` — lekki runner smoke-testów sprawdzający store stanu, model arkuszy/magazynu, walidację, cache, prosty engine shelf i strukturę HTML wydruku.
- Dodano `tools/rozrys-dev-smoke.js` — uruchamialny z Node skrypt developerski bez zależności zewnętrznych; zwraca kod błędu, jeśli któryś smoke-test nie przejdzie.
- Dodano `dev_tests.html` — prostą stronę developerską do ręcznego odpalenia testów w przeglądarce, bez ingerencji w główne UI aplikacji.
- Paczka nie zmienia UI użytkownika końcowego; dokłada techniczną siatkę bezpieczeństwa pod kolejne refaktory ROZRYS.


## 2026-03-28 — dev smoke page report
- Dopracowano `dev_tests.html`, żeby raport był czytelny dla użytkownika nietechnicznego.
- Strona pokazuje teraz wynik ogólny, sekcje testów, opis po co jest dany test, powód błędu oraz przycisk `Kopiuj raport`.

## 2026-03-28 — ROZRYS arch v8 (prefs + selection-ui + options modal + grain modal)
- Dodano nowe moduły: `js/app/rozrys/rozrys-prefs.js`, `js/app/rozrys/rozrys-selection-ui.js`, `js/app/rozrys/rozrys-options-modal.js`, `js/app/rozrys/rozrys-grain-modal.js`.
- `rozrys-prefs.js` przejął helpery trwałości/stanu pomocniczego ROZRYS: prefs panelu, prefs accordionu, store oklein, podpis formatek oraz most do store słojów.
- `rozrys-selection-ui.js` przejął orkiestrację wyboru zakresu: aktualizację launcherów `Pomieszczenia` i `Materiał / grupa`, sync ukrytych inputów, utrwalanie wyboru oraz otwieranie pickerów przez jeden kontroler.
- `rozrys-options-modal.js` przejął cały modal `Opcje rozkroju` razem z logiką `Wyjdź / Anuluj / Zapisz`, resetem do domyślnych wartości i konwersją jednostek.
- `rozrys-grain-modal.js` przejął modal `Wyjątki słojów`, bez zmiany zachowania UI.
- `js/app/rozrys/rozrys.js` został dalej odchudzony i deleguje do nowych modułów zamiast trzymać storage + modal opcji + sterowanie pickerami + modal wyjątków w jednym pliku.
- `index.html` dostał wspólny cache-busting pakietu `rozrys-*`: `20260328_rozrys_arch_v8`.


## 2026-03-28 — paczka: rozrys_empty_fix_and_smoke19
- Naprawa regresji ROZRYS, gdzie potrafił pokazać pusty stan „Brak rozpiski materiałów”, mimo że projekt miał szafki.
- `js/app/rozrys/rozrys.js` dostał bezpieczny resolver źródła cutlisty: najpierw `FC.cabinetCutlist.getCabinetCutList`, potem fallback globalny.
- Dzięki temu agregacja formatek do ROZRYS nie zależy już od kruchego jednego mostu.
- Warstwa smoke-testów została rozszerzona o test projektu/agregacji, który sprawdza, czy ROZRYS z prostego projektu faktycznie buduje materiał zamiast pustego stanu.
- Aktualny wynik smoke-testów po tej paczce: 19/19 OK.


## 2026-03-28 — rozrys project source fallback fix
- Start base: site_rozrys_project_rooms_fix.zip
- Fixed ROZRYS project source resolution: prefers the richest available project source (in-memory, window.projectData, FC.project.load()).
- Added fallback aggregation retry over discovered project room keys when saved room selection yields empty aggregate.
- Expanded smoke tests to catch empty-ROZRYS regressions caused by source desync and stale room selection.
- Smoke result after patch: 22/22 OK.


## 2026-03-28 — ROZRYS visual reference sync
- Dodano `css/rozrys-reference-sync.css` jako osobny moduł stylów tylko dla wizualnego ujednolicenia ROZRYS względem dwóch wzorców UI: `Wybierz materiał / grupę` oraz accordionów arkuszy.
- Ujednolicono typografię i karty launcherów ROZRYS (`Pomieszczenia`, `Materiał / grupa`, wybory opcji), żeby miały bliższą wagę tekstu, promienie, obramowania i cienie jak wzorcowe okna ROZRYS.
- Modale `Opcje rozkroju`, `Dodaj płytę do magazynu` i `Wyjątki słojów` dostały dodatkowe klasy (`rozrys-panel-*`), dzięki czemu ich pola i sekcje są wizualnie bliższe kartom z pickera materiałów.
- Zielona strzałka accordionu została zastąpiona bardziej aplikacyjnym chevronem w osobnym kafelku, z zachowaniem tej samej mechaniki rozwijania.

## 2026-03-28 — ROZRYS visual sync: remove frame-in-frame
- Base: `site_rozrys_visual_sync.zip`
- Goal: keep ROZRYS aligned with the material-picker / sheet-accordion references, but remove the extra boxed-in-boxed look introduced in option-style modals.
- Changes:
  - `css/rozrys-reference-sync.css`: flattened `rozrys-panel-field` containers so fields no longer render as cards inside cards
  - toned down accordion chevron glow to better match the app
  - kept the single-field control frame as the main visual boundary inside ROZRYS option/add-stock dialogs
- Result:
  - `Opcje rozkroju` and `Dodaj płytę do magazynu` no longer show a nested frame around already framed controls.

- 2026-03-29: ROZRYS UI tweak — top label rows (Pomieszczenia / Materiał / grupa / Szybkość liczenia / Kierunek cięcia) lowered visually to align closer with the ? help triggers above the cards; no logic changes.


## 2026-03-29 — custom checkbox style in ROZRYS
- Added `css/rozrys-checkboxes.css`.
- Replaced native-looking checkbox appearance in ROZRYS pickers/chips with custom app-styled square checkbox.
- First target: `Materiał / grupa` modal, with shared ROZRYS checkbox styling available for other ROZRYS pickers.

- 2026-03-29: `site_rozrys_checkbox_press_fix.zip` — usunięty systemowy niebieski highlight checkboxów w ROZRYS; checkboxy dostały własny efekt naciśnięcia w stylu przycisków ROZRYS (biały, zaokrąglony press/focus ring), bez zmiany logiki zaznaczania.

## 2026-03-29 — Paczka: ROZRYS checkbox press fix v3
- Naprawa systemowego niebieskiego highlightu przy checkboxach w ROZRYS.
- Źródłem problemu był nie tylko sam checkbox, ale też otaczające go label/chip/card.
- Wygaszono tap highlight na wrapperach i przeniesiono efekt naciśnięcia na cały chip/card w stylu przycisków ROZRYS.
- Checkbox wewnątrz chipa ma pointer-events:none, żeby klik przechodził przez wrapper bez systemowego efektu.
- 2026-03-29: Fix press/highlight for material cards in `Wybierz materiał / grupę` by disabling system tap highlight on the whole picker card and adding the same white rounded press ring direction used elsewhere in ROZRYS.


## 2026-03-29 — ROZRYS visual polish (active picker stability + shadows + gradient headers)
- Stabilized active green frame in Material / group picker by deriving selected card from actual local scope chips.
- Added panel-box boxClass support and marked ROZRYS panel-box modals with `panel-box--rozrys`.
- Added ROZRYS-only gradient underline treatment for section labels and ROZRYS modal titles.
- Added button-like shadows to picker chips/buttons and close X buttons in ROZRYS.


## 2026-03-29 — ROZRYS picker stability + shadows polish
- Naprawiono natychmiastowe zaznaczanie aktywnej karty w `Materiał / grupa` po kliknięciu ptaszka.
- Karty materiałów/pomieszczeń w pickerach dostały bardziej "X-like" styl: 14px radius, delikatny gradient, stabilny cień.
- Chipy `Fronty` / `Korpusy` zachowują cień również po zaznaczeniu i pokazują stan aktywny bez gubienia obramowania karty.

- 2026-03-29: site_rozrys_header_gradient_field.zip — usunięto gradientowe paski pod tytułami w ROZRYS i pod etykietami sekcji; nagłówki okien ROZRYS dostały subtelne tło biały→szary z mocniejszym przejściem przy dolnych ~20%.

## 2026-03-29 — Paczka: room picker chip pattern
- Start base: `site_material_scope_chip_sync.zip`.
- Picker `Wybierz pomieszczenia` dostał duży wariant wspólnego wzorca checkbox/chip (`css/rozrys-checkbox-chip-pattern.css`) zamiast starego pełnego kafla listy.
- `js/app/rozrys/rozrys-pickers.js` nadaje teraz kafelkom pomieszczeń klasy `rozrys-checkbox-chip rozrys-checkbox-chip--large` i utrzymuje `is-checked` zgodnie z realnym stanem checkboxa.
- Nowy wzorzec zachowuje neutralny kafelek i nie przenosi zielonej ramki na całe zaznaczone pole; stan zaznaczenia komunikuje głównie checkbox i spójny chipowy kształt.
- Smoke/testy dostały anty-regresję sprawdzającą render dużego checkbox-chipa pomieszczeń oraz obecność neutralnego pattern CSS.


- 2026-03-29: room picker now uses large scope-chip pattern based on the material Fronty/Korpusy chips; browser dev tests inject a fake document through deps instead of mutating window.document.


- 2026-03-29: room chip pattern v3 — picker pomieszczeń został przepięty na dokładnie bazowy markup scope-chip jak w Material / grupa (bez legacy `rozrys-picker-check`), a duży wariant dostał wygaszenie overlay focus/active, żeby po kliknięciu nie zostawał grubszy obrys. Zaktualizowano test anty-regresyjny i wersjonowanie assetów.

- 2026-03-29: Checkbox/chip buttons in ROZRYS now use a strict two-state visual model (base/unchecked = same as after uncheck, checked = selected). Mobile sticky-hover regression for room picker chips was fixed by gating hover styles to real hover devices and zeroing chip focus overlays.

- 2026-03-29: Checkbox-chip proportions tuned in ROZRYS. Small chips now use 12px vertical padding with unchanged horizontal offset; room-picker chips use 16px vertical padding with a 24px inner row minimum so top/bottom spacing matches the left checkbox gutter without moving the checkbox right.
- 2026-03-29: Checkbox-chip small variant tightened for mobile fit: base `.rozrys-scope-chip` reduced to `min-height:46px` with `padding:11px 12px 11px 11px` so three material cards fit better on narrow phone screens; large room-option variant unchanged.

- 2026-03-29: checkbox-chip polish v2 — małe chipy ciaśniejsze (44px, 10/12/10/10), karty materiałów niższe o 1 px góra/dół i zaznaczone karty mają zieloną ramkę/cień jak wzorzec wyboru trybu; duże chipy pomieszczeń dostały taki sam promień narożników jak małe.

- 2026-03-29: selected picker/material cards in ROZRYS now share the exact same green border and shadow tokens as the accepted `Szybkość liczenia` selected card; extra green halo overlay on selected material cards was removed.
- 2026-03-29: `site_material_picker_match_speed_exact.zip` — picker materiału w `Wybierz materiał / grupę` dostał dokładnie ten sam rytm odstępów i parametry kart co modal `Szybkość liczenia`: gap 12px, dół listy 20px pod cień, karty 18px/20px desktop i 16px/18px mobile, z tym samym zielonym border/shadow zaznaczenia.

- 2026-03-29: `site_material_picker_scroll_gutter.zip` — W `Wybierz materiał / grupę` lista dużych kart dostała prawy gutter (`padding-right`) i `scrollbar-gutter: stable`, żeby pionowy scroll nie nachodził już na prawą ramkę kart; test anty-regresyjny pilnuje teraz także tego zapasu pod scrollbar.

- 2026-03-29: Wybór materiału zsynchronizowany dokładniej z modalem `Szybkość liczenia`: osobny moduł `css/rozrys-picker-exact-sync.css` pilnuje rytmu pola kart (gap 12px, prawy gutter na scrollbar, dolny zapas 20px) oraz pionowego wyśrodkowania stopki akcji.

- 2026-03-30: Picker materiału i pomieszczeń — stopka akcji dostała większy, spokojniejszy oddech (60px / mobile 58px, padding 6px 0 8px), żeby pionowe osadzenie dolnych przycisków było bliżej rytmu strefy górnego przycisku X.

- 2026-03-30: Picker footer spacing now follows the exact close-button math from the modal header shell (desktop 20px/20px, mobile 18px/18px) so bottom action buttons inherit the same vertical breathing as the top X.

- 2026-03-30: Picker footer spacing fix — removed extra picker-level gap and footer padding so bottom action buttons no longer create an oversized empty band below the card list; the list keeps the 20px shadow breathing and the modal body keeps the outer bottom breathing.

- 2026-03-30: picker footer align v1 — material picker got its own footer modifier (`.rozrys-picker-footer--material`) with a small bottom padding so the single `Wyjdź` button sits like the footer in room picker; room picker footer left unchanged. Updated `rozrys-pickers.js`, `rozrys-picker-exact-sync.css`, picker regression tests, and cache-busting.

- 2026-03-30: material picker footer drop v1 — cofnięto błędne podnoszenie samotnego `Wyjdź`; stopka materiałów używa teraz górnego paddingu (`20px` desktop / `18px` mobile), żeby przycisk siedział niżej bez ruszania room pickera.


## 2026-03-30 — material picker footer unified with rooms footer
- Material picker footer no longer uses a dedicated modifier spacing block.
- `Wybierz materiał / grupę` and `Wybierz pomieszczenia` now share the same base `rozrys-picker-footer` rhythm.
- The bottom breathing under material cards stays on the list (`padding-bottom: 20px`) instead of on a separate material footer padding block.


## 2026-03-30 — material footer restore after bad unify
- Cofnięto regresję z unifikacji stopki `Wybierz materiał / grupę` z oknem `Wybierz pomieszczenia`.
- Material picker znów używa własnego modifiera `.rozrys-picker-footer--material` z top paddingiem 20px desktop / 18px mobile.
- Room picker pozostawiono bez zmian.

- 2026-03-30: `Opcje rozkroju` wróciły do praktycznego układu bez zmiany funkcjonalnej siatki; launchery wyboru w tym modalu nie pokazują już helpera „Kliknij, aby wybrać” ani strzałek, a pola wpisywane mają niższy, wklęsły styl (`css/rozrys-panel-modal-sync.css`, `js/app/rozrys/rozrys-options-modal.js`, test anty-regresyjny w `js/testing/rozrys/tests.js`).
- 2026-03-30: `Opcje rozkroju` dostały reusable shell ROZRYS dla modali formularzowych (`css/rozrys-panel-modal-sync.css`): rytm jak w zatwierdzonych oknach ROZRYS oraz wklęsłe pola input dla ręcznie wpisywanych wartości.

- 2026-03-30: Opcje rozkroju zachowują shell ROZRYS i wklęsłe pola, ale krótkie pola liczbowe wróciły do kompaktowych szerokości (moduł `rozrys-panel-modal-sync.css`, klasy `rozrys-panel-input--compact`, `rozrys-panel-input--compact-wide`, `rozrys-panel-inline--compact-pair`).

- 2026-03-30: Opcje rozkroju — przywrócono praktyczny układ rzędów zgodnie z ustaleniem: 1) Jednostki + Wymiary do cięcia, 2) Rzaz piły + Obrównanie, 3) Format bazowy arkusza, 4) Najmniejszy użyteczny odpad. Siatka opcji ma jawnie trzymać 2 kolumny także na telefonie; launcher pól wyboru pozostaje bez helpera i bez strzałki.

- 2026-03-31: ROZRYS `Dodaj płytę do magazynu` dostał własny shell formularza (`rozrys-stock-modal-sync.css`) zgodny z zatwierdzonym wzorcem ROZRYS: 2-kolumnowa siatka, wklęsłe pola, przewijalne body `panel-box-form`, kompaktowe pole ilości i stopka akcji jak w innych modalach edycyjnych.

- 2026-03-31: `Opcje rozkroju` dostały dokładniejszy, praktyczny układ pól bez zmiany logiki: lewa kolumna jest węższa (Jednostki jak Rzaz piły), prawa rozciąga się na resztę rzędu, drugi rząd ma wyrównane pole wejściowe mimo wielowierszowej etykiety, a dolne pary pól (`Format bazowy`, `Najmniejszy użyteczny odpad`) mają równą szerokość przez wspólny układ `rozrys-panel-inline--options-pair`.
- 2026-03-31: ROZRYS `Dodaj płytę do magazynu` przestał używać systemowego selecta materiału; modal korzysta teraz z istniejącego aplikacyjnego launchera i overlayu wyboru (`createChoiceLauncher` + `openRozrysChoiceOverlay`) ze stylem `.rozrys-choice-launch--stock-clean`, bez helpera i bez strzałki.

## 2026-03-31 — rooms/lists/investor sync batch
- Added `js/app/shared/room-registry.js` as dynamic room registry for investor/project room definitions.
- Investor detail view now uses app-style choice launchers for `Typ` and `Status`, plus compact app-style inputs.
- Investor quick-room section now renders dynamic rooms from current investor and exposes `Dodaj pomieszczenie`.
- ROZRYS room discovery now prefers dynamic investor/project rooms through room registry labels.
- Validation/list tables now support vertical headers, stacked dimensions, room/source/cabinet columns.
- Sheet lists are enriched from raw snapshot metadata to show room/source/cabinet context when available.

## 2026-04-02 — investor refactor + room registry hardening
- `Inwestor` został rozdzielony na nowe moduły pomocnicze:
  - `js/app/investor/investor-editor-state.js`
  - `js/app/investor/investor-choice.js`
  - `js/app/investor/investor-links.js`
  - `js/app/investor/investor-modals.js`
  - `js/app/investor/investor-rooms.js`
- Dodano osobne style `css/investor-layout.css` i `css/investor-form.css` dla układu, pól, launcherów i akcji inwestora.
- `Inwestor` ma teraz tryb podglądu/edycji:
  - spoczynek = `Usuń` + `Edytuj`
  - edycja bez zmian = `Wyjdź`
  - edycja po zmianach = `Anuluj` + `Zapisz`
- W trybie spoczynkowym `Status` można zmieniać od razu, ale tylko po potwierdzeniu przez nasz modal.
- W trybie edycji zablokowane są górne zakładki i szybki wybór pomieszczeń inwestora.
- `Typ` i `Status` w inwestorze używają niskich launcherów w stylu aplikacji; `NIP` pojawia się tylko dla `Firma` obok pola `Źródło`.
- W trybie nieedytowalnym `Telefon` i `Email` pokazują ikonki akcji tylko wtedy, gdy pole ma wartość.
- Rejestr pomieszczeń (`room-registry`) wymusza teraz nazwę pomieszczenia i blokuje duplikaty nazw dla jednego inwestora; dodano też widoczną pozycję legacy `kuchnia stary program` dla starych danych kuchni.
- Usunięto nieużywany legacy plik `js/app/investor/inwestor.js`.
- Domyślne `Obrównanie krawędzi` zmieniono z `2 cm` / `20 mm` na `1 cm` / `10 mm`.
- W `Dodaj płytę do magazynu` poprawiono lewy zapas launchera `Wybierz materiał` i jego aktywny stan.
- W tabelach rozkroju poprawiono układ komórki `Szafka` (numer + `?`) tak, żeby nie nachodziły na siebie.

- 2026-04-02: followup v2 — `Dodaj płytę do magazynu` dostał wspólny lewy rytm dla pól i stopki; `Lista formatek` uspokoiła kolumnę `Ilość`/`Szafka` (centrowanie ilości + rozdzielenie numeru i `?`), a `room-registry` porównuje nazwy pomieszczeń akcento-niezależnie (`dół` = `dol`). W `Inwestorze` ikonki telefonu/email dostały mocniejszy, czytelniejszy wariant.

- 2026-04-02 — followup v3: domknięto zaległe poprawki po ostatnich uwagach: wyrównany lewy rytm modala dodawania płyty, wzmocnione akcje telefon/email i spłaszczony widok pól inwestora w trybie nieedytowalnym, poprawiony render kolumny Szafka także w ogólnej liście formatek, oraz dodana osłona na mobile ghost-click przy przejściach pełnoekranowych typu Otwórz inwestora / Lista inwestorów.

- 2026-04-03: investor follow-up — Typ readonly wrócił do spłaszczonego preview, action bar inwestora siedzi pod blokiem danych, telefon/email dostały lekkie ikony SVG i kompaktowe akcje, lista inwestorów blokuje przycisk Lista w edycji, listy formatek wróciły do pionowych nagłówków z dopasowanymi szerokościami kolumn, fallback obrównania utrzymany na 1 cm / 10 mm.


## 2026-04-03 — site_investor_green_icons_tables_tight
- INWESTOR: `Osoba` -> `Osoba prywatna`, poprawiona typografia labeli Telefon/Email i zielone ikonki akcji w stylu `Zapisz`.
- INWESTOR: w trybie edycji blokowane są także górne przyciski sesji `Anuluj` / `Zapisz`.
- LISTY FORMATek: zwężone kolumny liczbowo-statusowe, delikatniejsze pionowe separatory i ciemniejsze poziome linie w listach ogólnej / do rozkroju / arkusza.

## 2026-04-04 — site_investor_arch_sync_tables_blue
- INWESTOR: wdrożono 4 kroki optymalizacji architektury bez zmiany ogólnego UI:
  - `js/app/investor/investor-persistence.js` — jedno wejście do CRUD inwestora pod przyszły adapter Firestore,
  - `js/app/investor/investor-navigation-guard.js` — jedno miejsce do blokad top nav / Lista / pokoje / sesja,
  - `js/app/investor/investor-field-render.js` — wspólne renderowanie pól readonly/editable i sztywnych rzędów,
  - `js/app/investor/investor-actions.js` — wydzielona logika action bara inwestora.
- INWESTOR: karta inwestora została przestawiona na sztywne rzędy par pól (`name/phone`, `city/email`) i pełne rzędy (`adres`, `źródło`, `notatki`), żeby linie i baseline nie rozjeżdżały się między lewą i prawą kolumną.
- INWESTOR: ikonki telefonu/email wróciły do niebieskiego tonu zgodnego z `Dodaj pomieszczenie`.
- LISTY FORMATek: dalej zwężono kolumny liczbowe / wymiarowe i przyciemniono poziome linie na około 60% szarości.
- ACTIONS REGISTRY: akcje create/open/assign/delete inwestora korzystają teraz z warstwy `investorPersistence`, a nie bezpośrednio z `FC.investors`.

## 2026-04-04 — site_rozrys_table_column_tuning
- LISTY FORMATek: utrzymano kolumnę `Formatka` bez zmian i dociśnięto techniczne szerokości pod realne treści:
  - `Wymiar` pod układ `XXX.x / x / XXX.x`,
  - `Potrzebne` i `Rozrysowane` pod 3 cyfry,
  - `Różnica` i `Status` pod 3 znaki.
- LISTA DO ROZKROJU: przestawiono kolejność kolumn tak, aby `Różnica` i `Status` siedziały zaraz po `Rozrysowane`, przed sekcją `Szafka`.
- SZAFKA: rozdzielono sekcję `Szafka` na wspólny nagłówek z dwiema kolumnami:
  - wąska kolumna z `?`,
  - właściwa kolumna z listą szafek.
- SZAFKA: numery szafek renderują się po 5 pozycji w rzędzie, maksymalnie w 3 widocznych rzędach; przy większej liczbie pojawia się wewnętrzny scroll.
- LISTY FORMATek: poziome linie zostały utrzymane wyraźniej, a pionowe pozostały delikatniejsze.
- STATUS: statusy skrócono do krótkich form (`OK`, `BRK`, `NAD`), żeby mieściły się w węższej kolumnie bez rozwalania układu.


## 2026-04-04 — investor_project_status + rozrys_pdf_row
- Inwestor: usunięty status inwestora; dodana edytowalna data dodania; lista inwestorów pokazuje datę; projekty/pomieszczenia na dole mają własne statusy i wspólny układ kart.
- Inwestor: odświeżenie w zakładce Inwestor trzyma kontekst wybranego inwestora; wyjście z widoku inwestora górnym Zapisz/Anuluj prowadzi do listy inwestorów.
- ROZRYS: PDF skrócony do `PDF`, przyciski osadzone w rzędzie zakładek/akcji; usunięty słupek `?`; szerokości tabel ujednolicone z dynamiczną kolumną szafek.
- Testy: app smoke 12/12 OK, rozrys smoke 31/31 OK.

## 2026-04-04 — site_rozrys_render_rooms_company_owner
- ROZRYS: naprawiono regresję braku kart arkuszy/rozrysów pod podsumowaniem w accordionach materiałów; renderer ma teraz awaryjny fallback budujący karty arkuszy nawet wtedy, gdy warstwa list zwróci pusty wynik, oraz podbite wersje plików JS, żeby GitHub Pages nie trzymał starego kodu w cache.
- ROZRYS: wybór pomieszczeń w panelu rozkroju dla inwestora bierze się z realnie dodanych pomieszczeń inwestora (`room_*`), a nie z generatorowych typów bazowych `kuchnia/szafa/pokój/łazienka`.
- INWESTOR: dla typu `Firma` dodano osobne pole `Właściciel — imię i nazwisko`; `Źródło` i `Notatki` rozciągnięto na cały rząd, a `NIP` ma własny pełny rząd pod właścicielem.
- TESTY: app smoke 14/14 OK; rozrys smoke 31/31 OK.

- 2026-04-04: site_investor_company_layout_room_labels.zip — naprawa etykiet pomieszczeń w ROZRYS (bez technicznych room_*), poprawa układu firmy w Inwestorze: właściciel pod mailem, NIP pod właścicielem, pełny rząd dla Źródła i Dodatkowych informacji, neutralniejsze tło pól oraz cache-busting dla zmienionych skryptów.

- 2026-04-05: Paczka site_investor_validation_room_delete_summary_cleanup.zip — uproszczenie podsumowania ROZRYS, poprawa układu firmy w Inwestorze, modal usuwania pomieszczenia, walidacja obowiązkowych pól i ostrzeżenia o duplikatach, nowy inwestor otwierany od razu w edycji.


## 2026-04-05 — investor followup v2
- investor create flow moved to transient draft before first real save (no empty investor records)
- investor top session buttons detached from investor form save/cancel path
- room delete modal now lists full active room set including legacy rooms
- investor rooms header tightened: Pomieszczenia + Dodaj/Usuń in one row
- resolved table widths treated as reference for RAW/validation/sheet list widths

## 2026-04-05 — site_fix_investor_render_recursion
- INWESTOR: naprawiono regresję boot-clean-1.4 z pętlą renderu w zakładce Inwestor. Gdy zapisany/current investor ID nie wskazuje już istniejącego wpisu, UI czyści kontekst detail, wyłącza blokady i bezpiecznie wraca do listy inwestorów zamiast wpadać w rekurencję render() -> render().
- CACHE-BUSTING: podbita wersja `investor-ui.js`, żeby GitHub Pages nie trzymał starej wersji skryptu.
- TESTY: app smoke 15/15 OK; rozrys smoke 31/31 OK.


## 2026-04-05 — wycena start + regression bundle
- fix ghost click/click-through on `create-investor` by swallowing follow-up global click after action dispatch on mobile-like flows.
- investor duplicate guard now also warns when company `ownerName` matches an existing private investor `name`.
- RAW / Walidacja / Lista arkuszy now share explicit reference col widths via `rozrys-lists.js` colgroup widths instead of relying only on CSS mode-specific rules.
- added `js/app/wycena/wycena-core.js` as first modular quote layer: seeds AGD service defaults, collects selected-room aggregate, material sheet counts from ROZRYS cache/generation, accessory rows from cabinet cutlists and built-in AGD service rows from cabinet subtypes.
- `tabs/wycena.js` replaced placeholder with first working estimate view and `Wyceń` action.
- service catalog auto-seeds editable AGD installation items for future quote integration.


## 2026-04-05 — field unify + width sync
- ujednolicono styl pól formularza inwestora przez wspólny wzorzec `.investor-form-control` i usunięto wyjątek dla `invOwnerName`
- dopięto focus/autofill/read-only pod jeden system stylu dla pól formularza
- RAW, Walidacja i Lista arkuszy korzystają z referencyjnych szerokości kolumn ze Skomasowanej; kolumna Szafka jest dynamiczna z limitem max

## 2026-04-06 — ROZRYS anti-regression + merge validation
- rozdzielono render ROZRYS na sekcje summary / actions / sheets oraz dodano guard po renderze kart arkuszy i canvasów,
- przy błędzie renderu arkuszy widok próbuje fallback kart arkuszy, a dopiero potem pokazuje komunikat fail-safe,
- lista `Skomasowana` przestała być sztucznym `OK`; korzysta teraz z rzeczywistej walidacji RAW → scalanie,
- dodano smoke testy ROZRYS dla walidacji scalania oraz dla obecności sekcji/kart/canvasów w DOM.

- 2026-04-06 13:xx: spacing under investor divider + session cancel reload restore fix.


- 2026-04-07: dodano `js/app/investor/investor-room-actions.js` jako osobny binder akcji Dodaj/Edytuj dla pomieszczeń inwestora, żeby nie trzymać tej logiki w `investor-ui.js`.


## 2026-04-07 — etap 2 trybów pracy
- Dodano moduły `js/app/catalog/catalog-domain.js` i `js/app/catalog/catalog-migration.js` jako wspólną warstwę domeny katalogów oraz migracji legacy danych.
- `catalog-store.js` korzysta teraz z tych modułów i publiczne `migrateLegacy()` domyślnie przebudowuje split z legacy danych, a init aplikacji zachowuje bezpieczne preferowanie już rozdzielonych katalogów.
- Dodano wspólny modal zarządzania pomieszczeniami inwestora przez `roomRegistry.openManageRoomsModal()`.


- 2026-04-07 stage2 fix v2: rozdzielono draft wspólnego modala pomieszczeń od sesji projektu/inwestora, `Anuluj` w modalu pomieszczeń resetuje tylko lokalne zmiany bez zamykania okna, a `dev_tests.html` ładuje już `constants.js` i `storage.js`, dzięki czemu testy katalogów używają prawdziwych kluczy storage. Dodatkowo ROZRYS dopuszcza retry dla niestandardowych kluczy pomieszczeń także przy aktywnym inwestorze.

## 2026-04-08 — etap 3 architektury: domeny projektu / usług / wyceny
- Dodano `js/app/project/project-model.js`, `js/app/project/project-store.js` i `js/app/project/project-bridge.js`.
  - `project-model` normalizuje dane projektu niezależnie od widoku,
  - `project-store` trzyma osobne rekordy projektów powiązane z inwestorem,
  - bridge utrzymuje zgodność z dotychczasowym `FC.project`, więc reszta aplikacji nadal działa bez masowego przepinania.
- Dodano `js/app/service/service-order-store.js` jako osobny store dla `serviceOrders`; `catalog-store` zachowuje tylko mostki kompatybilności dla starego API.
- Dodano `js/app/catalog/catalog-selectors.js` jako wspólną warstwę odczytu katalogów dla dalszej chmury i dla wyceny.
- Dodano `js/app/quote/quote-snapshot.js` jako pierwszy czysty model snapshotu wyceny meblowej, niezależny od DOM.
- `wycena-core.js` korzysta już z selektorów katalogów i buduje snapshot bez mieszania `workshopServices` do wyceny mebli.
- `service-orders.js` korzysta bezpośrednio z `serviceOrderStore`, więc drobne zlecenia nie wiszą już logicznie pod katalogami.
- `investor-project.js` synchronizuje projekt inwestora także do `project-store`, przygotowując grunt pod przyszłe rozdzielenie `investor` i `project` jako osobnych bytów domenowych.
- `dev_tests.html` i smoke-runner Node ładują nowe moduły domenowe; smoke po zmianach: app 27/27 OK, rozrys 34/34 OK.


## 2026-04-08 boot fix
- Przywrócono jawne wystawianie startu aplikacji (`FC.init`, `App.init`, `initApp`, `initUI`) z `js/app.js`.
- `js/boot.js` dostał awaryjne doładowanie `js/app.js` i `js/app/shared/public-api.js`, jeśli po starcie strony nie ma funkcji init.

- 2026-04-08: Boot/start hardening: app now exposes init earlier, and stale roomType after deleted investor/test cleanup falls back safely instead of crashing renderCabinets.

## 2026-04-08 — etap 4 cleanup + snapshoty
- testy developerskie oznaczają dane testowe markerem `meta.testData` i sprzątają je po uruchomieniu, bez ruszania realnych danych;
- `dev_tests.html` ma też ręczny przycisk `Usuń dane testowe`;
- wycena ma osobny magazyn snapshotów (`quoteSnapshotStore`) przygotowany pod późniejszy PDF klienta i historię wycen;
- `serviceOrderStore` i `investors` zachowują metadane rekordów, co ułatwia późniejszą migrację do chmury i bezpieczny cleanup.


## 2026-04-08 — Stage 5: quote PDF + snapshot history
- Nowy moduł: `js/app/quote/quote-pdf.js` — buduje drukowalny PDF wyceny z snapshotu.
- `js/tabs/wycena.js` pokazuje ostatni snapshot, historię snapshotów projektu oraz akcje Podgląd/PDF.
- `js/testing/wycena/tests.js` dostał test PDF wyceny oparty o snapshot.


## 2026-04-08 — Stage 5B: quote history UX polish
- `Historia wycen` w `Wycena` ma teraz zwarte, niskie karty zamiast wysokich pustych pól.
- Kliknięcie `Podgląd` wyraźnie oznacza oglądany snapshot i automatycznie przewija do aktywnego podglądu wyceny.
- Aktywny wpis historii ma wyróżniony stan i nie udaje, że nic się nie stało po przełączeniu snapshotu.

- Stage 6: quote-offer-store trzyma draft oferty (stawki + pola handlowe) per projekt; quote snapshot i PDF drukują dokładnie tę wersję wyceny.

- Etap historii ofert: sekcja handlowa w Wycena działa jako accordion; snapshot oferty można usunąć lub oznaczyć jako zaakceptowany, co ustawia status projektu na `zaakceptowany`.

## 2026-04 quote status sync
- Wycena obsługuje flagę wstępnej wyceny, akceptację wstępnej -> Pomiar oraz akceptację właściwej wyceny -> Zaakceptowany.
- Ręczna zmiana statusu projektu w Inwestorze synchronizuje stan zaakceptowanej oferty w Wycena.


## 2026-04-10 preliminary quote fix
- removed project status `Po pomiarze`; after measurement use `Wycena` directly
- preliminary quote drafts now survive scope switch from investor-only to project-bound draft
- preliminary history entries are archived only when a newer normal quote exists

## 2026-04-10 — stage9_quote_sync_v1
- WYCENA: domknięto draft oferty o `selection` (pomieszczenia + zakres korpusy/fronty) oraz `commercial.versionName`.
- WYCENA: snapshot i historia zapisują nazwę wersji oferty oraz zakres elementów (`materialScope`, `materialScopeMode`).
- WYCENA: tab `Wycena` dostał własny wybór pomieszczeń i zakresu bez wchodzenia do ROZRYS; `Wyceń` używa tego wyboru do rozkroju w tle.
- WYCENA: historia ofert i podgląd zostały zsynchronizowane ze statusem projektu (`wstepna_wycena`, `pomiar`, `wycena`, statusy finalne).
- WYCENA: po usunięciu snapshotu wykorzystywany jest rekomendowany status projektu, żeby nie zostawał błędny stary etap.
- WYCENA UI: aktywna oferta i stany zaakceptowane korzystają z zielonych akcentów; accordion i info-box wzorowane na istniejących kierunkach z ROZRYS.
- PDF: dopracowano layout PDF oferty bez zmiany logiki danych snapshotu.
- TESTY: rozszerzono smoke testy Wycena o zapis wyboru pomieszczeń/zakresu, nazwę wersji oferty, status po usunięciu oferty oraz zawartość PDF.


## 2026-04-10 — stage10_quote_polish_v1
- WYCENA: klik `Podgląd` naprawdę przełącza oglądany snapshot i tylko ten klik przewija do górnego podglądu; pozostałe akcje nie mają już sztucznego skoku scrolla.
- WYCENA: po ręcznym cofnięciu statusu przed etap `Wycena` wcześniejsze wyceny wstępne znowu są odblokowane zamiast zostawać na siłę wygaszone przez późniejszą wycenę końcową.
- WYCENA UI: launcher pomieszczeń ukrywa obcy mały trójkąt; chip `Wpływa na kolejny snapshot`, zielone zaznaczenie aktywnej historii i chevron accordiona zostały podciągnięte bliżej realnych wzorców z ROZRYS.
- WYCENA: domyślne nazwy wersji to teraz `Oferta` i `Wstępna oferta`; kliknięcie pola nazwy zaznacza całą wartość, więc można od razu pisać nad starą nazwą.
- WYCENA: badge `Wstępna` jest pomarańczowy, badge `Zaakceptowana` czerwony.
- WYCENA: przy zaakceptowanej wycenie wstępnej pojawia się mały przycisk `Do końcowej`, który przygotowuje draft zwykłej wyceny na bazie tej wersji i przełącza projekt na etap `Wycena`.
- TESTY: smoke testy Wycena dostały kontrolę domyślnych nazw wersji (`Oferta` / `Wstępna oferta`).

## 2026-04-11 — stage11_quote_followup_v1
- WYCENA: `Oglądany` i `Zaakceptowana` zostały rozdzielone — zielona obwódka dotyczy już tylko aktualnie oglądanej karty, a sama akceptacja zostaje oznaczona czerwonym badge'em i stanem przycisku.
- WYCENA: akcje `Zaakceptuj`, `Usuń` i `Końcowa` zapamiętują pozycję scrolla; tylko `Podgląd` przewija do górnego podglądu oferty.
- WYCENA UI: zielone zaznaczenie aktywnej karty historii dostało dokładny promień, obrys i cień jak zaznaczona karta w ROZRYS (`MAX` / picker-option), zamiast wcześniejszego przybliżenia.
- WYCENA: `Końcowa` nie przerzuca już do obcego draftu — konwertuje tę samą zaakceptowaną wycenę wstępną na zwykłą końcową ofertę i ustawia status projektu na `zaakceptowany`.
- WYCENA: po zaakceptowaniu zwykłej oferty wszystkie wyceny wstępne są wygaszane spójnie dla całej historii, niezależnie od pozycji nad/pod ofertą końcową.
- TESTY: smoke testy Wycena sprawdzają teraz także konwersję wstępnej oferty do końcowej oraz wygaszanie wycen wstępnych po zaakceptowaniu zwykłej oferty.

- 2026-04-11: `js/tabs/wycena.js`, `css/style.css`, `index.html`, `dev_tests.html` — Wycena dostała polskie etykiety `Wersja oferty`, żeńskie formy dla oferty, usunięty badge `Oglądany`, scroll akcji historii oparty o przywracanie pozycji jak w działających częściach programu oraz accordion ustawień oferty przepięty wizualnie na shell i chevron z ROZRYS.

- 2026-04-11: `js/tabs/wycena.js`, `css/style.css`, `index.html` — Wycena: naprawione rozjechanie bloku „Ustawienia oferty do nowej wyceny” przez przepięcie headera accordiona na układ wzorowany na ROZRYS (trigger + osobny dolny rząd meta), poprawione przewijanie `Podgląd` do początku sekcji podglądu oraz przywracanie scrolla po akcjach historii z fallbackiem do sąsiedniej karty / sekcji historii zamiast skoku na górę.

- 2026-04-11: `js/tabs/wycena.js`, `index.html` — Wycena: akcje historii, które nie mają celowo przewijać (`Zaakceptuj`, `Usuń`, `Końcowa`), zapamiętują pozycję scrolla bardziej agresywnie jak w działających częściach programu: pamięć jest łapana jeszcze przed potwierdzeniem modala, przy anulowaniu czyszczona, a przy odtworzeniu scroll jest dosuwany kilkukrotnie po rerenderze, żeby nie wracał na górę po ubocznych odświeżeniach statusu/projektu.
- 2026-04-12: Wycena — domknięcie wizualne top sekcji pod wzorzec z ROZRYS: selekcja pomieszczeń/zakresu przełączona na układ `rozrys-selection-grid`, pola dostały shell `rozrys-field`, a karta używa syncu `panel-box--rozrys`, żeby helpery `?`, launchery i proporcje były kopiowane z ROZRYS zamiast lokalnego wariantu.

- 2026-04-12: Paczka `site_quote_scope_pdf.zip` na bazie `site_quote_visual_sync.zip`. W `Wycena` przeniesiono wybór zakresu fronty/korpusy do osobnego modala wzorowanego na pickerach z `ROZRYS`, poprawiono launcher i wielkość czcionek przy wyborze pomieszczeń, przeniesiono checkbox `Wstępna wycena (bez pomiaru)` pod przyciski `Wyceń` / `PDF`, a generator PDF klienta został przebudowany na wersję handlową: tylko cena końcowa bez rozbicia kosztów, z listą elementów, materiałów/kolorów, akcesoriów, usług i sprzętów/AGD. Dodatkowo snapshoty zapisują ukrytą listę elementów dla PDF, bez zmiany szczegółowego podglądu w programie.
- 2026-04-12: Hotfix po paczce site_quote_scope_pdf.zip — przywrócono funkcję collectCommercialDraft w js/app/wycena/wycena-core.js, dzięki czemu aplikacja znowu wstaje bez boot-clean-1.4 oraz export FC.wycenaCore.ensureServiceCatalog jest dostępny dla smoke testu katalogu usług AGD bez duplikowania pozycji.
- 2026-04-12: ROZRYS test fixture isolation + first-run room retry fix — dodałem override projektu dla testów ROZRYS, żeby aggregatePartsForProject i retry po pokojach nie łapały starego projektu przy pierwszym uruchomieniu testów; podbite wersje rozrys.js i js/testing/rozrys/tests.js.

- 2026-04-12: Wycena — zapis wyboru pomieszczeń został uszczelniony na wzór ROZRYS: quoteOfferStore i wycenaCore nie czyszczą już jawnie wybranego zestawu pokoi tylko dlatego, że roomRegistry chwilowo zwróci pustą lub niepełną listę; dodatkowo górny checkbox/pole `Wstępna wycena (bez pomiaru)` został wyśrodkowany w osi lewo-prawo. Smoke testy Wycena dostały regresję na pusty roomRegistry przy zachowaniu selectedRooms.

- 2026-04-12: PDF klienta w Wycena bez listy formatek / elementów technicznych. Dokument pokazuje tylko handlowe sekcje: materiały / kolory, akcesoria z ilościami, usługi, AGD i cenę końcową. Dodany regresyjny smoke test PDF bez `Elementy w ofercie`.

- 2026-04-12: zaległe testy działowe — dodano `js/testing/service/tests.js` z osobną sekcją `USŁUGI` dla store zleceń usługowych, listy statusów, upsertu bez duplikatów i cleanup testowych rekordów. `dev_tests.html` dostał osobne przyciski uruchamiania działów: PROJEKT, INWESTOR, MATERIAŁY, WYCENA, SZAFKI, USŁUGI, a runner Node `tools/app-dev-smoke.js` został rozszerzony o nową sekcję testów.

- 2026-04-12: ROZRYS first-run scoped rooms fix — aggregatePartsForProject spina teraz safeGetProject i listę pokoi z tego samego scoped projektu, więc pierwszy przebieg testów nie filtruje już `salon` / `inne` po globalnych domyślnych pokojach. Retry po pokojach używa discovered rooms z tego samego kandydata projektu. Dodany regresyjny smoke test na pierwszy przebieg ze scoped pokojami.

- 2026-04-12: Testy przekrojowe Wycena — rozszerzono `js/testing/wycena/tests.js` o scenariusze `Wycena ↔ Inwestor`, `Wycena ↔ Pomieszczenia ↔ ROZRYS` oraz `Wycena ↔ PDF`: ręczna zmiana statusu inwestora synchronizuje projectStore i wskazaną ofertę, wybór pokoi w Wycena filtruje elementy dokładnie po aktywnych pomieszczeniach projektu, pusty wybór wraca do wszystkich realnych pokoi inwestora, a PDF zapisanej końcowej oferty po konwersji z wstępnej zachowuje handlowy charakter bez technicznej listy formatek.

- 2026-04-12: Hotfix testów USŁUGI — catalogStore.serviceOrders czyta teraz zawsze aktualny stan z serviceOrderStore zamiast wiszącego cache; dodany regres na synchronizację po bezpośrednim zapisie do store.

- 2026-04-12: Statusy Wycena/Inwestor zostały uszczelnione per pomieszczenie bez pełnego refaktoru ETAPU 2. `js/tabs/wycena.js` przestał opierać status oferty o pierwszy pokój inwestora i aktualizuje tylko pokoje z `scope.selectedRooms` snapshotu; wycena wspólna zmienia tylko pokoje objęte zakresem. `js/app/investor/investor-persistence.js` nie nadpisuje już wszystkich pokoi przy ręcznej zmianie jednego statusu, tylko liczy zagregowany status projektu z realnych statusów pokoi. `js/app/quote/quote-snapshot-store.js` dostał scoped helpery roomIds do doboru/rekomendacji ofert. Smoke testy Wycena dostały regresje na statusy per pomieszczenie, wyceny wspólne i brak fallbacku do pierwszego pokoju.

- 2026-04-12: Domknięto regresję przełączania akceptacji wycen scoped między wspólną a jednopomieszczeniową. `js/tabs/wycena.js` po akceptacji / cofnięciu / usunięciu wyceny przelicza statusy wszystkich znanych pomieszczeń projektu na podstawie scoped historii ofert zamiast zostawiać stare `pomiar` w pokojach zdjętych z akceptacji. `js/app/investor/investor-persistence.js` po ręcznej zmianie statusu jednego pokoju utrzymuje ten pokój jako źródło intencji użytkownika, ale przelicza pozostałe pokoje z ich własnej historii ofert. `js/app/quote/quote-snapshot-store.js` dostał helper `getRecommendedStatusMapForProject`, a `js/testing/wycena/tests.js` dostał regresję na przełączenie akceptacji z wyceny wspólnej na wycenę jednego pomieszczenia.

- 2026-04-12: ROZRYS first-click fix — getRoomsForProject nie blokuje już pokojów odkrytych w projekcie przez chwilowo stare roomRegistry aktywnego inwestora; testy ROZRYS pokrywają niestandardowe klucze i retry także przy aktywnym roomRegistry.

- 2026-04-12: ETAP 2 statusów — dodany centralny moduł `js/app/project/project-status-sync.js` jako wspólny mechanizm zmiany statusów projektu/pomieszczeń dla `Inwestor` i `Wycena`. `js/app/investor/investor-persistence.js` oraz `js/tabs/wycena.js` zostały przepięte na ten sam serwis, bez zmiany reguł biznesowych z ETAPU 1. Smoke testy Wycena dostały regresje potwierdzające, że oba wejścia wołają jeden wspólny mechanizm i że centralny serwis synchronizuje inwestora, projectStore oraz wskazaną ofertę.

- 2026-04-12: ETAP 3 statusów — usunięto stary duplikujący mostek synchronizacji z `js/app/investor/investor-persistence.js`; ręczna zmiana statusu opiera się już na centralnym `js/app/project/project-status-sync.js`, a lokalny fallback ogranicza się tylko do awaryjnego patcha pokoju. `js/tabs/wycena.js` został odchudzony z dawnej pełnej zapasowej ścieżki zapisu/odczytu statusów i zostawia już tylko lekki fallback awaryjny + ostrzeżenie w konsoli, gdyby centralny serwis nie był dostępny. `js/testing/wycena/tests.js` dostał regresję pilnującą, że po sprzątaniu nie wraca stare lokalne `updateInvestorRoom` jako drugi mechanizm zapisu statusów.


- 2026-04-12: Hotfix po ETAPIE 3 statusów — `js/app/project/project-status-sync.js` nie bierze już do agregacji projectStore obcych / starych statusów z `roomRegistry`, jeśli projekt i inwestor mają już własną listę pokojów. Przy zapisie statusów centralny serwis agreguje teraz status projektu po zakresie bieżącej zmiany (`scope.selectedRooms` albo wskazany pokój), a nie po przypadkowych pokojach wiszących w runtime. `js/testing/wycena/tests.js` dostał regresję na „brudny roomRegistry”, który wcześniej potrafił zostawić `projectStore.status = wycena` mimo poprawnej zmiany scoped na `pomiar`.

- 2026-04-13: Statusy ręczne w `Inwestor` dostały nowy guard `js/app/project/project-status-manual-guard.js`. Ręczne wejście na `Pomiar` wymaga teraz zaakceptowanej wyceny wstępnej solo dla danego pokoju; ręczne wejście na `Zaakceptowany` i dalsze statusy końcowe wymaga zaakceptowanej wyceny końcowej solo. Gdy brakuje wyceny solo, `Inwestor` pokazuje modal z pytaniem o wygenerowanie odpowiedniej wyceny dla tego jednego pomieszczenia i po potwierdzeniu przerzuca do `Wycena`; gdy wycena solo istnieje, ale nie jest zaakceptowana, pokazuje komunikat blokujący bez cichego podnoszenia statusu. Dodatkowo rekomendacja statusów per pokój po rozpięciu wspólnej wyceny wraca teraz do własnych ofert solo (`nowy` albo `wstepna_wycena`) zamiast liczyć dalej starą wycenę wspólną jako podstawę dla pokoju pojedynczego. Smoke testy Wycena/Inwestor dostały regresje na blokady ręcznych zmian, brak wyceny solo i powrót do statusu solo po zdjęciu wspólnej akceptacji.

- 2026-04-13: Rozbicie zaakceptowanej wyceny wspólnej nie zostawia już jej jako ukrytego blokera dla ofert solo. `js/app/quote/quote-snapshot-store.js` oznacza poprzednio zaakceptowaną ofertę jako odrzuconą po zmianie zakresu (`rejectedReason: scope_changed`), zamiast tylko cicho zdejmować akceptację; dzięki temu oferta wspólna przestaje blokować ponowną akceptację wycen solo. `js/tabs/wycena.js` renderuje taki stan jako żeńskie `Odrzucona`, a archiwizacja wstępnych ofert patrzy już po dokładnie tym samym zakresie pomieszczeń zamiast po całym projekcie. `js/app/project/project-status-manual-guard.js` blokuje też ręczne wejście na status `wycena` bez własnej zaakceptowanej wyceny wstępnej solo. `js/testing/wycena/tests.js` dostał regresje na odrzucenie wspólnej oferty po rozbiciu zakresu, odblokowanie solo wstępnych i blokadę ręcznego wejścia na `wycena` bez zaakceptowanej podstawy solo.

- 2026-04-14: Usługi stolarskie dostały uproszczony detal cięcia oparty na silniku ROZRYS (nowe pliki w js/app/service/cutting/). Poprawiono też scoped rekomendację statusu po odrzuceniu wspólnej oferty oraz zamieniono kolory przycisków na ekranie Start.

- 2026-04-14: Hotfix ręcznych statusów w `Inwestor` — `js/app/project/project-status-manual-guard.js` przestał traktować blokady tylko jako ruch „w górę”. Statusy wymagające podstawy ofertowej (`pomiar`, `wycena`, końcowe) są teraz walidowane zawsze względem własnej zaakceptowanej oferty solo dla danego pokoju, nawet jeśli bieżący status pokoju był omyłkowo wyższy. Dzięki temu nie da się już ręcznie wskoczyć ani wrócić na `Pomiar` / `Wycena` bez zaakceptowanej wyceny wstępnej solo. `js/app/investor/investor-choice.js`, `js/app/investor/investor-rooms.js` i `js/app/rozrys/rozrys-choice.js` dostały zgodne wsparcie dla zablokowanych opcji w overlayu wyboru statusu, a `js/testing/wycena/tests.js` dostał regresję na pokój z błędnie wyższym statusem, który bez zaakceptowanej wyceny wstępnej solo nie może już przejść na `Pomiar` ani `Wycena`.


## 2026-04-14 — choice click fix
- Naprawa overlayu wyboru statusu: tylko faktycznie zablokowane opcje dostają disabled; dozwolone znów klikają się poprawnie.
- Dodany lekki helper js/app/ui/app-view.js eksportujący FC.appView.shouldHideRoomSettingsForTab także dla dev_tests bez ładowania całego js/app.js.

## 2026-04-14: Scope-aware entry do Wstępnej wyceny
- Dodano nowy moduł `js/app/quote/quote-scope-entry.js` jako jedno źródło prawdy dla wejścia do wyceny scoped. Moduł rozpoznaje dokładny `scope.selectedRooms`, odróżnia solo od kombinacji A+B, umie znaleźć istniejącą wycenę tego samego typu i scope oraz prowadzi flow `Otwórz istniejącą` / `Utwórz nową` z drugim krokiem nadania nazwy wariantowi.
- `js/app/quote/quote-snapshot-store.js` dostał helpery exact-scope (`listExactScopeSnapshots`, `findExactScopeSnapshot`) filtrowane po typie wyceny i dokładnym zestawie pomieszczeń, bez mieszania scope solo i wspólnego.
- `js/app/investor/investor-ui.js` przechwytuje wejście na status `wstepna_wycena` i zamiast ślepo tylko przestawiać status otwiera scoped flow wyceny. Jeżeli draft Wyceny ma zaznaczoną kombinację pomieszczeń zawierającą kliknięty pokój, flow używa tej kombinacji; w przeciwnym razie spada do scope solo.
- `js/app/project/project-status-manual-guard.js` został przepięty na nowe scoped wejście przy generowaniu wyceny z blokad ręcznych statusów, dzięki czemu także ścieżka guardów korzysta z tych samych reguł exact-scope i nie robi cichych duplikatów.
- `js/tabs/wycena.js` dostał helper `showSnapshotPreview`, żeby flow `Otwórz istniejącą` mogło otworzyć dokładnie wskazaną wersję w historii bez generowania nowego snapshotu.
- `css/style.css` dostał lokalny styl modali scope-entry, a `index.html` / `dev_tests.html` zostały zaktualizowane o nowy moduł i cache-busting.
- `js/testing/wycena/tests.js` rozszerzono o regresje na: istniejącą wycenę solo, istniejącą wycenę wspólną dla konkretnej kombinacji, brak exact-scope dla innego zakresu, rozróżnienie A od A+B, podpowiedź nazwy kolejnego wariantu oraz otwarcie istniejącej wyceny bez tworzenia duplikatu.

- 2026-04-14: Room cleanup + status fallback fix — `js/app/shared/room-registry.js` pozwala teraz zapisać pustą listę pomieszczeń w modalu zarządzania, czyści zaznaczenie pokoi w draftcie `Wycena` po usunięciu pokoi i po zmianie zestawu pokojów przelicza statusy projektu/pokoi bez zostawiania starych etapów. `js/app/project/project-status-sync.js` dostał helper `reconcileProjectStatuses`, używany do pełnego przeliczenia statusów po sprzątaniu danych zamiast ręcznego nadpisywania tylko jednego scope. `js/app/quote/quote-snapshot-store.js` nie zostawia już statusu `wstepna_wycena` po skasowaniu ostatniej oferty — bez aktywnych ofert fallback wraca do `nowy` (poza `odrzucone`). `js/tabs/wycena.js` po usunięciu snapshotu woła pełną rekonsyliację statusów projektu, dzięki czemu usunięcie scope A+B nie zeruje błędnie solo A. `js/testing/investor/tests.js` i `js/testing/wycena/tests.js` dostały regresje na: zapis pustej listy pomieszczeń, czyszczenie scope draftu, powrót statusu do `nowy` po usunięciu ostatniej wyceny wstępnej oraz zachowanie solo A po usunięciu wspólnej wyceny A+B. `tools/app-dev-smoke.js` ładuje też `js/app/quote/quote-scope-entry.js`, więc pełny smoke node obejmuje teraz również testy scope-entry.


### 2026-04-16 — dev_tests fixture sync
- `dev_tests.html` now includes hidden app-view fixture nodes (`topTabs`, `roomsView`, `appView`, session/floating controls) so project smoke tests can validate tab order and roomless WYCENA entry against a stable DOM.
- `js/app/ui/views.js` is loaded in `dev_tests.html`, because project tests assert `FC.views.shouldOpenRoomlessWycena()` and `FC.views.applyFromState()` directly.

- WYCENA: po faktycznym utworzeniu nowej wyceny wstępnej `quote-scope-entry` pokazuje prosty modal tylko z `OK`; otwarcie istniejącej wersji ani zwykłej wyceny końcowej nie pokazuje tego komunikatu.
- WYCENA: przycisk `Zaakceptuj ofertę` pod `Podsumowanie` rozciąga się teraz na szerokość sekcji akcji, żeby był wyrównany do układu lewo-prawo tej karty.

- 2026-04-16: WYCENA dostała twardą walidację pustych ofert w `js/app/wycena/wycena-core.js`: brak pomieszczeń, nieistniejący scope albo scope bez żadnych danych do wyceny nie zapisuje już zerowego snapshotu. `js/tabs/wycena.js` pokazuje wtedy prosty komunikat tylko z `OK` zamiast tworzyć pustą ofertę. Dodatkowo `js/app/ui/info-box.js` obsługuje teraz wariant `okOnly`, a `js/app/quote/quote-scope-entry.js` używa go jako domyślnego potwierdzenia po faktycznym utworzeniu nowej wyceny wstępnej. `dev_tests.html` ładuje też `info-box.js`, a `js/testing/wycena/tests.js` dostał regresje na: brak pomieszczeń, nieistniejący wybrany pokój, pusty scope bez danych i domyślny komunikat OK po nowej wycenie wstępnej.

- 2026-04-15: Odtworzona paczka cabinet_room_quote_cleanup na bazie site_quote_guard_notice_fix.zip. Naprawa cabinet-cutlist (bez kruchej zależności od luźnych globali), czyszczenie wycen solo/wspólnych przy usuwaniu pomieszczeń oraz ostrzeżenia o kasowanych wycenach w modalach usuwania pokoju.

- 2026-04-15: WYCENA — przy kliknięciu `Wyceń` dla zakresu, który ma już exact-scope historię tego samego typu, `js/tabs/wycena.js` wymusza teraz nadanie nazwy kolejnemu wariantowi jeszcze przed zapisaniem snapshotu. Nowy flow używa modalnego pola nazwy z przyciskami `OK` / `Anuluj`, z proponowaną unikalną nazwą wariantu oraz walidacją duplikatu po normalizacji (case/spacing/diacritics) w `js/app/quote/quote-scope-entry.js`. `js/testing/wycena/tests.js` dostał regresje na wymuszenie nazwania nowego wariantu przy istniejącej historii scope oraz na blokadę nazwy różniącej się tylko zapisem.


## 2026-04-15 — wywiad room choice + cabinet cutlist guard
- `js/app/ui/tab-navigation.js`: `WYWIAD` bez aktywnego pokoju wraca do wyboru pomieszczeń (`roomsView`) zamiast przeskakiwać do `Inwestor`.
- `js/app/cabinet/cabinet-cutlist.js`: obudowano wywołania helperów frontów/okuć (`frontHardware`) bezpiecznymi fallbackami, żeby testy i podstawowa geometria korpusu nie wysypywały się przez brak kontekstu projektu.
- `js/testing/project/tests.js`: dodany regres pod wejście do `WYWIAD` bez aktywnego pomieszczenia.


## 2026-04-16 — async runner + home restore
- `js/testing/shared/harness.js` uruchamia i **awaituje** testy asynchroniczne, żeby suite `WYCENA` nie zostawiała po sobie stubów `FC.cabinetCutlist.getCabinetCutList` przed sekcją `Szafki`.
- `js/testing/dev-tests-page.js` zbiera raporty asynchronicznie; `APP` czeka teraz na pełne zakończenie suite zamiast scalać niegotowe obietnice.
- `js/app/ui/views.js` traktuje `entry:'home'` jako nadrzędne wobec helpera roomless `WYCENA`, więc po wyjściu na stronę główną i odświeżeniu nie powinno już wskakiwać z powrotem do `WYCENA` tylko dlatego, że zachował się `currentInvestorId`.
- `js/testing/project/tests.js` ma regresję pilnującą, że zapisany kontekst inwestora nie otwiera roomless `WYCENA` z ekranu głównego.

- 2026-04-15: Fix test fixture in `js/testing/wycena/tests.js` so explicit `rooms: []` stays empty instead of falling back to default rooms; this restores the `no_rooms` regression path for quote validation tests.

## 2026-04-15 — mini-paczka 2 / status master + mirrors
- `js/app/project/project-status-sync.js`: scoped status projektu został nazwany i domknięty jako centralny `masterStatus`; `projectStore.status` oraz `meta.projectStatus` są zapisywane wyłącznie jako lustra (`mirrorStatus`) przez jedną ścieżkę sync.
- `js/app/investor/investor-persistence.js`: `setInvestorProjectStatus(..., { returnDetails:true })` zwraca teraz wynik centralnego syncu zamiast gubić go w `result:null`.
- `js/testing/wycena/tests.js`, `js/testing/investor/tests.js`: testy pilnują zgodności master ↔ mirror dla scoped rekonsyliacji i ręcznej zmiany statusu z poziomu Inwestora.
- Cache-busting podbity w `index.html` i `dev_tests.html` dla modułów/statusów i testów tej paczki.
