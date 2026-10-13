# C2.1b.2c.2 — adaptery projektowego PCV

Baza: `9b1afa0f2df39b778aaa812fbd40fd50db12cd51` (main po PR #38).

## Rozpoznane błędy i wykonana integracja

- **R1:** engine bridge przekazywał tylko zależności legacy. Metody synchroniczna i asynchroniczna otrzymują teraz jawne opcje `{pcvMode:'project',projectId}`. Do mappera silnika trafiają części z poprawnym ledgerem, a identyfikację technologiczną zachowuje istniejący `planKey()`. Globalny `fc_edge_v1` nie jest odczytywany w tej ścieżce.
- **R2:** runner przechwytywał błędy PCV jako zwykłe awarie silnika, używał globalnych krawędzi i utrwalał wynik. Teraz diagnostyka projektowa zatrzymuje obliczenie, czyści nieaktualny wynik ekranu i nie zapisuje cache. Ponowne pobranie agregatu, zmiana materiału/pomieszczeń i wszystkie checkpointy respektują ten sam kontekst. Zwykła awaria transportu może użyć istniejącej metody synchronicznej z kontekstem projektowym; błąd walidacji nie może.
- **W1:** `collectQuoteData(options)` przekazuje kontekst do źródła, material plan i resolvera. Dotyczy to także `buildFromCore`, `buildQuoteSnapshot` oraz jawnego uruchomienia istniejącego generateQuote. Ceny, wzory i zaokrąglenia nie zostały zmienione.
- **W2:** wynik kalkulacji i nowy kandydat mają tymczasowy dowód pochodzenia. Budowa snapshotu, decyzja o duplikacie oraz ostateczne `save`, `replaceSnapshot` i `writeAll` walidują go przed zapisem. Zmiana projektu, inwestora, zakresu, danych RAM lub rewizji odrzuca kandydata. Wymagana jest nowa kalkulacja; nie ma automatycznego przeliczenia/zapisu.

## Przekazanie kontekstu

ROZRYS: `render(options)` → lokalny agregator zakresu → selection/output bridge → render compose → run controller → runner → engine bridge → computePlan / computePlanPanelProAsync. Magazyn arkuszy korzysta z plan helpers związanych z tym samym kontekstem.

WYCENA: `collectQuoteData(options)` → getSelectedAggregate(options) → collectMaterialLines(options) → computePlanForMaterial(options) → silnik i magazyn → wspólny resolver. Istniejący tab shell przyjmuje opcje wyłącznie jawnie, przez meta lub calculationOptions kontekstu. Zwykłe wywołania nie aktywują trybu projektowego.

Nie dodano modułu, storage key ani przełącznika interfejsu. Zmienione adresy skryptów mają cache-busting w index.html, dev_tests.html i lazy-manifeście ROZRYSU; kolejność ładowania pozostaje bez zmian. Aktualizacje starych testów dotyczą wyłącznie wersji tych assetów. Fixture poprzedniego smoke jest udostępniony nowemu testowi bez zmiany jego asercji.

## Arkusze magazynowe, ledger i placements

Magazyn nadal korzysta z dotychczasowego algorytmu, ale odejmuje ilości według projektowego `planKey()`. Resztę normalizuje istniejące `withQuantity()`. Opcjonalne `{skip}` pozwala przydzielić pojedynczy fizyczny wkład z agregowanego ledgera bez zmiany źródłowej grupy.

Po połączeniu arkuszy magazynowych i zamawianych resolver dopina kopie `sourceRefs`, `sourceGroups` i `effectivePcv` do placements. Sprawdza klucze, flagi po istniejących transformacjach słojów/obrotu oraz kompletny bilans ilości. Identyfikatory placements są unikalne w połączonym planie; adresy źródłowe pozostają niezmienione. To metadane wyniku, nie trwałe sloty.

Test zwykłej awarii workera wykrył, że rezerwowy bezpośredni packShelf('along') transponuje krawędzie bez spójnej flagi rotated. Nie zmieniono optymalizatora ani legacy. Projektowy fallback korzysta z istniejącego computePlan zamiast tej niezgodnej ścieżki. MAX z noSyncFallback i niekompletny wynik runnera są odrzucane.

Diagnostyka/listy używają projektowych źródeł i kluczy zamiast odtwarzania globalnego snapshotu. Canvas otrzymuje rzeczywiste flagi; CSV odejmuje PCV według tych samych flag. Render i akcje wydruku/eksportu ponownie sprawdzają aktualność. Dialog listy otwarty wcześniej także otrzymuje chroniony callback wydruku.

## Cache

W jawnym trybie nie jest czytany ani zapisywany trwały cache planów. Automatyczny cache render także jest pomijany. Agregat jest pobierany świeżo przed liczeniem i walidowany po zakończeniu oraz przed użyciem wyniku. Ledger/proweniencja nie stają się trwałym źródłem prawdy. Legacy cache działa jak dotychczas.

## Dowód nowego kandydata a historia

Rejestr dowodów istnieje tylko w RAM resolvera (maksymalnie 64 ostatnie kalkulacje). Zawiera fizyczny projekt, inwestora, dokładną rewizję kanonicznego rekordu, zakres pomieszczeń i materiałów, początkową selekcję draftu oraz podpis wyliczonych linii materiałowych. Weryfikacja ponownie korzysta z kanonicznego resolvera i obowiązujących zabezpieczeń sesji.

Root `pcvMode`, `projectId` i `__projectPcvCandidate` są znacznikami nowego wyniku; przed utrwaleniem zostają usunięte. Historyczne snapshoty zachowują dotychczasowy format, własny zapisany scope i ceny. Odczyt historii nie wymaga dowodu, nie przelicza i nie przepisuje danych. Zapis zwraca zapisany snapshot historyczny, a oryginalny niezapisany kandydat nadal podlega weryfikacji.

Bezpośredni kandydat oznaczony jako projektowy bez dowodu jest odrzucany. Ochrona obejmuje produkcyjne fabryki i save/replace/writeAll zachowujące ten kontrakt; nie próbuje odgadywać pochodzenia ręcznie skonstruowanego obiektu legacy z celowo usuniętymi znacznikami. Nie wprowadzono globalnej polityki aktywacji.

## Wartości kontrolne

Izolowane projekty korzystają z rzeczywistych generatorów, resolvera, centralnego store, sesji, silnika, arkuszy magazynowych, core WYCENY i magazynu ofert. Symulowane są transport Web Workera i minimalny DOM/progress; worker uruchamia rzeczywiste moduły optymalizatora i szybkości.

- Dwa korpusy: 16,440 mb default; dodatkowa krawędź lewego boku: **17,122 mb**, z jednym zapasem **18,834 mb**. Przy stawce fixture 3 zł/mb: **56,50 zł**.
- Fronty 600 × 139/283/283 mm: **5,010 mb**, z zapasem **5,511 mb**. Przy stawce fixture PCV pod kolor frontu 5 zł/mb: **27,56 zł**.
- Zakresy A / B / A+B: **17,122 / 8,220 / 25,342 mb** surowego PCV, niezależne snapshoty historii.
- Niezależna referencja rozkroju pozostaje **4 / 3 / 6 arkuszy**; bieżąca cena i historyczna oferta nie mieszają zakresów.

## Testy

Nowy `project-calculation-adapters-smoke.js` obejmuje R1/R2/W1/W2, prawdziwe obie metody silnika, runner, controller i publiczny render z rzeczywistą akcją DOM Generuj, fallback, magazyn, ledger, render/CSV, kwoty PCV, scope, bezpośrednie API, dialog duplikatu, historię, legacy i czystość odczytu. Dotychczasowe smoke P1/P2/P3, globalnych danych i sesji pozostają obowiązkowe w preflight.

## Granica C2.1b.2c.3 i ryzyka

Nie aktywowano projektowego PCV w normalnym UI. Nie zmieniono setterów, okna Opcje formatki, geometrii szuflad, słojów, cenników ani historii. Wszystkie globalne klucze zachowano; brak migracji/importu/cleanupu.

Ostatni etap musi jawnie zapisać decyzję o aktywacji w kanonicznym projekcie, poinformować o nieimportowaniu niejednoznacznego fc_edge_v1, rozdzielić zapis PCV od słojów oraz zapewnić osobną edycję właścicieli lewego/prawego boku i grup. Dopiero potem normalne launchery mogą przekazywać wspólnie tryb projektowy do wszystkich trzech modułów.

Dowód nowej oferty nie przetrwa restartu: niezapisany kandydat wymaga nowego obliczenia. Zmiana dowolnej części kanonicznego rekordu konserwatywnie unieważnia dowód, także gdy inny pokój nie należy do wyceny. Ceny historyczne pozostają zamrożone. Globalne słojowanie i legacy kolizje D1–D6 nie zostały rozwiązane przez ten PR. Testy DOM/transportu nie zastępują ręcznego testu przeglądarki i rzeczywistego wydruku.

## Zmienione pliki

- `dev_tests.html`
- `index.html`
- `js/app/project/project-pcv-resolver.js`
- `js/app/quote/quote-snapshot-store.js`
- `js/app/quote/quote-snapshot.js`
- `js/app/rozrys/rozrys-engine-bridge.js`
- `js/app/rozrys/rozrys-engine.js`
- `js/app/rozrys/rozrys-lazy-manifest.js`
- `js/app/rozrys/rozrys-plan-helpers.js`
- `js/app/rozrys/rozrys-render-compose.js`
- `js/app/rozrys/rozrys-render.js`
- `js/app/rozrys/rozrys-run-controller.js`
- `js/app/rozrys/rozrys-runner.js`
- `js/app/rozrys/rozrys-summary.js`
- `js/app/rozrys/rozrys.js`
- `js/app/wycena/wycena-core-material-plan.js`
- `js/app/wycena/wycena-core.js`
- `js/app/wycena/wycena-tab-shell.js`
- `tools/app-dev-smoke.js`
- `tools/effective-project-pcv-smoke.js`
- `tools/wycena-duplicate-offer-guard-smoke.js`
- `tools/wycena-generate-action-registry-smoke.js`
- `tools/wycena-generate-single-flow-smoke.js`
- `tools/wycena-orphan-edit-session-cleanup-smoke.js`
- `tools/wycena-snapshot-clean-store-smoke.js`
- `tools/project-calculation-adapters-smoke.js`
- `tools/reports/c2-1b2c2-project-calculation-adapters.md`

## Końcowa weryfikacja

- `node tools/project-calculation-adapters-smoke.js`: **27/27 PASS**; także w pełnym preflight.
- `node tools/effective-project-pcv-smoke.js`: **30/30 PASS**; ponownie zaliczony przez końcowy preflight.
- `node tools/project-session-unconfirmed-save-safety-smoke.js`: **30/30 PASS** (P1/P2/P3, restart, commit, rollback, konflikty).
- `node tools/global-data-write-safety-smoke.js`: **30/30 PASS**.
- `node tools/multiroom-calculation-session-safety-smoke.js`: **PASS**, rzeczywisty optymalizator **4 / 3 / 6** arkuszy i WYCENA **400 / 300 / 600** w fixture.
- Pełny `node tools/preflight.js`: **PRE-FLIGHT PASS**, **115/115** smoke, **APP 110/110**, **520/520** `node --check`, kolejność **317** skryptów; audyty zależności i storage PASS. Końcowy przebieg: 88,562 s.
- Osobne `node --check` dla wszystkich 24 zmienionych/nowych plików JS: **24/24 PASS**.
- `git diff --check`: **PASS**.

Żaden test nie korzystał z produkcyjnego localStorage. Nie resetowano, nie migrowano ani nie importowano danych. Zabezpieczenia C2.1b.2c.1 pozostały bez zmian. Main nie był modyfikowany przez implementację; nie wykonano merge, Ready ani publikacji.
