# Preflight #1367 — naprawa i czas wydania

## USTALONE

- Właściciel zatwierdził naprawę błędów i optymalizację wydawania. Ten pakiet nie uruchamia kolejnej próby wydania.
- Istniejący PR #155, gałąź `feat/p1-debounced-project-sync-20261121`, wejściowy HEAD `60a8923b7bf95fab0ce349610eb0f41fb0b353ef`, BASE/main `e3a2f985461a8feb205cf90a0860ee6c8e1c3be4`.
- [Zakończony Preflight #1367](https://github.com/mebleszek/meble-app/actions/runs/44890232727): **75 PASS / 6 FAIL / 2 SKIPPED**. Trzy pierwotne FAIL: `firebase-p0b (normal-clean)`, `(signed-clean)`, `(room-quote-staging)`. Zależne FAIL: `firebase-current`, `ci-summary`, `final-status`. Skipped: `auto-merge`, `post-merge-verify`. Bez merge, nowego Pages i zmian Firebase LIVE.

## Przyczyny i poprawki

1. **Normal/signed clean, zapis offline.** Wspólny helper Save po trwałym commicie wywoływał explicit synchronize i wymagał `ok:true`, mimo celowo wyłączonej sieci. Poprawka wyłącza flush wyłącznie w tym kroku. Nadal sprawdzane są offline, trwały queued w IndexedDB, niezmieniona głowa serwerowa, SIGKILL, restart, recovery i ACK. Online nadal wymaga sukcesu flush.
2. **Staging oferty.** Test klikał akceptację/promocję zaraz po przełączeniu zakładki WYCENA, zanim ukończył się trwały checkpoint nawigacji. Wynik: `LF_APPLICATION_BUSY`, a następnie brak oczekiwanego etapowania fragmentów. Test czeka na faktyczną zakładkę i brak transactionPending/incomingPending; nie zwiększa limitu i nie ponawia operacji.
3. **Regresja ujawniona po poprawce helpera.** Oba rzeczywiste clean dochodziły dalej, lecz po SIGKILL nie otwierały odzyskiwania: P1 odkładał prepare queued na termin partii, a z nim odkładał odkrycie przejętej blokady. Teraz odroczenie z prawdziwym kanałem projektu najpierw odczytuje i porównuje autorytatywnego edytora, identycznie jak prepare. Utracona generacja oznacza trwały conflict i istniejące recovery. Bez pakowania, publikacji ani automatycznego przejęcia; szkic, RAW i kolejka pozostają. Ponowna walidacja przy właściwej publikacji nadal obowiązuje.

Pierwsza celowana próba: staging PASS, oba clean RED na oczekiwaniu odzyskiwania po restarcie. Oddzielna próba na kopii bez odświeżonego manifestu została prawidłowo odrzucona przez Service Workera (`OFFLINE_SHELL_INSTALL_FAILED`); poprawiono kompletność kopii testowej, nie walidator. Pomyłka lokalnego skryptu uruchomieniowego Java zakończyła się przed startem testów. Nie są to dowody regresji aplikacji ani PASS.

## WDROŻONE — optymalizacja bez ograniczania pokrycia

- Publiczny cache npm i emulatorów, oddzielne klucze OS / current lub historical / hash lockfile. `npm ci --prefer-offline` zachowuje lock i kontrolę integralności. Nie cache'ujemy node_modules, profili Chromium, danych aplikacji ani poświadczeń.
- JAR z cache jest odczytowo sprawdzany według rozmiaru i checksumy metadanych **zainstalowanego, przypiętego CLI**. Aktualny CLI: SHA-256. Starszy CLI może wymagać swojej opublikowanej MD5; to zgodność kontroli pobrania, nie autoryzacja. Zły hash/rozmiar/typ/link odmawia, brak pliku pozostawia pobranie CLI. Bez automatycznej naprawy uszkodzonego cache.
- Kalibracja na wszystkich **253** pomiarach jednostek smoke z #1367, zachowanych w `ci-smoke-timings-1367.json`. Dziewięć oryginalnych przypadków norm jest teraz dziewięcioma częściami; ich treść/asercje pozostają niezmienione. Ciężkie dawne części nie wykonują kolejnych przypadków w jednym procesie. Nowe czasy tych części są jawnie **szacowane**, do kalibracji kolejnym CI.
- Zachowane **36** rozłącznych grup; obecnie **228 plików / 259 jednostek**, w tym nowa obowiązkowa regresja cache/pokrycia. Nie usunięto grup ani testów. Najdłuższa zmierzona dawna jednostka: 117266 ms; najdłuższy nowy szacunek grupy: 92630 ms. To prognoza, nie zmierzony czas nowego CI.
- 425 historycznych pinów, izolacja, kontrola exact HEAD/BASE, wymagane podsumowania, brak retry i bramki auto-merge pozostają.

## Pomiar rzeczywistego wydania i cel 4 minut

Źródło: metadane wszystkich 83 jobów i logi wszystkich 36 shardów #1367. Sumy czasu runnerów obejmują równoległe wykonanie — nie należy dodawać ich do czasu ściennego.

| Etap | Rzeczywisty czas |
| --- | ---: |
| Utworzenie PR 09:34:33Z → zakończenie runu 09:40:22Z | **349 s / 5:49** |
| PR → zakończenie safety | 17 s |
| Od safety → ostatni job testowy (z kolejkami) | 308 s |
| Końcowy łańcuch podsumowań | 24 s |
| Najdłuższe oczekiwanie testu po safety | 213 s |
| P1 rzeczywisty timer, cały job / etap testu | 193 s / 172 s |
| Zajętość 75 jobów roboczych łącznie | 5029 runner-sekund |
| npm install łącznie / checkout łącznie | 325 s / 403 s |

Zaobserwowano maksymalnie 20 jednoczesnych jobów; to obserwacja tego runu, nie weryfikacja planu konta. P1 timer ma wymagane rzeczywiste 120 s i zachowuje tę asercję. Jego pozostałe 52 s etapu testowego to przygotowanie/otoczenie, nie dowód potrzeby skrócenia timera.

Poprzedni **udany**, odrębny Pages [run 44837050800](https://github.com/mebleszek/meble-app/actions/runs/44837050800), SHA BASE/main: 41 s (build 24, report 3, deploy 9 plus odstępy). W #1367 Pages nie wystąpił. Zatem 5:49 nie obejmuje nowej publikacji.

**BRAKUJE:** nowego autoryzowanego pomiaru cold/warm cache i PR → potwierdzony Pages. Cache zmniejsza powtarzane pobrania, kalibracja uruchamia najcięższe jednostki w pierwszych grupach, lecz nie usuwa zewnętrznych kolejek. Pierwsza próba z pustym cache może jeszcze nie przyspieszyć. Przy niezmienionych bramkach i rzeczywistym timerze **nie ma podstaw do gwarancji 4 minut**. Nie zmieniono limitów, oferty runnerów ani bezpieczeństwa, aby sztucznie osiągnąć wynik.

Cache zapisany przez PR ma zakres tego PR, więc nie zakładamy jego dostępności w następnych PR. Przyspiesza powtarzane pobrania w dozwolonym zakresie cache; nie dodano automatycznego workflow na main do jego rozgrzewania. [Ograniczenia cache GitHuba](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#restrictions-for-accessing-a-cache).

**PROPONOWANE:** po osobnej zgodzie jedna próba CI dokładnego nowego HEAD/BASE; zmierzyć ścieżkę krytyczną, kolejkę, cache hit i Pages. Dopiero dane z niej uzasadnią ewentualne dalsze łączenie jobów/zmiany zależności, bez usuwania testów lub wymaganych bramek. Nie wdrożono tego spekulacyjnie.

## Kontrole i bramki

- GREEN: trzy pierwotne scenariusze UI/emulatory razem **3/3**, exit 0: normal-clean, room-quote-staging, signed-clean. Obejmują trwałe IDB, queued/uncertain, SIGKILL, kopiowanie pokoju z nowymi ID, ACK, PIN/przejęcie, niezmienną historię, konkurencyjny CAS, usuwanie i ochronę globals.
- Jednostkowy P1 PASS: rzeczywisty kod synchronizatora z kontrolowanym zegarem, 2/5 minut, własny edytor, obce urządzenie/epoch, zwolniona/brak blokady, błąd odczytu bez publikacji lub usunięcia kolejki, handover, piny i nieznany konflikt.
- Cache PASS na Windows i Linux: MISS/VERIFIED, checksum/rozmiar/metadata, podmienione bajty, katalog, link i uszkodzony link odmawiają. Rzeczywisty istniejący JAR: SHA-256 VERIFIED według CLI.
- Pokrycie CI 228/259/36 PASS; obie rozdzielone ciężkie oryginalne normy PASS; wszystkie dziewięć treści/asercji porównane bajtowo z wejściowym HEAD — jedyna zmiana to select(4) → select(9).
- Workflow YAML i composite YAML PASS. Cloud CI reliability **11 grup PASS**, w tym 125 przypadków agregacji i odmowy przy błędnym SHA, pominięciu/FAIL, brakującym raporcie lub błędzie zapisu logu; current-boundary PASS z nienaruszonym historycznym 425-source kontekstem. Lokalny bash wymagał przekazania RUNNER_TEMP przez WSLENV z konwersją ścieżki Windows; nie zmieniano testu, żeby ominąć tę kontrolę.
- Offline shell/update, manifest, script versions i diff PASS. Rzeczywisty Chromium stary SW → nowy: HTTP 503 odmawia nowej wersji, stary cache/dane/formularz pozostają; zweryfikowane pobrania/reuse, opóźniony plik, brak automatycznego przejęcia kart, naturalna aktywacja i dokładne RAW/IndexedDB PASS. Lokalny odczyt historycznego git archive przez WSL wymagał wskazania istniejącego GIT_DIR; źródeł nie zmieniano.
- Dodatkowe celowane UI P1 timer/delivery: **2/2 PASS**, exit 0, zero skipped. Rzeczywiste 120 s, jedna najnowsza rewizja dwóch zapisów, niezależny pokój/ACK; Wyjdź, SIGKILL po serwerowym commicie przed ACK, odzyskanie tej samej rewizji i zwolnienie; offline Save, SIGKILL/restart i ochrona niezmienionej potwierdzonej głowy.
- Logi i uruchamiacze zachowane poza repo: `../../outputs/p1-evidence-20261121/ci1367-repair`, wcześniejsze artefakty diagnostyczne w wskazanych katalogach `/tmp/meble-p0b-normal-*` i logach źródłowych.

### Zmienione obszary

- Runtime: `sync/local-first-sync.mjs`; wygenerowany `offline-assets.js`.
- Testy UI: `tools/firebase-pilot/p0b-normal-application.test.mjs`, `p0b-quote-lifecycle.cases.mjs` w tym samym katalogu.
- CI: `.github/workflows/preflight-js.yml`, nowy `.github/actions/test-download-cache/action.yml`; `tools/ci-emulator-cache.js`, `ci-release-speed-smoke.js`, `ci-smoke-shards.js`, `ci-smoke-timings-1367.json`, `ci-sharding-smoke.js`, `cloud-ci-workflow-checks.js`, `project-sync-batching-smoke.js`, `wycena-labor-norms-smoke.js`.
- Dokumentacja: `CURRENT_STATE.md`, `docs/plans/LOCAL_FIRST_ROADMAP.md`, `docs/agents/RELEASE.md` i ten raport.

 Pełnego Preflightu lokalnie ani GitHub Actions nie uruchamiamy. **Status: CODE_READY pakietu naprawy / CI_PENDING / RELEASE_BLOCKED.** Działająca konfiguracja LIVE P0-B i UI nie są zmieniane. Dodatkowy odczyt blokady przed odroczeniem zwiększa liczbę odczytów przy oczekującej partii; błędu tego odczytu nie wolno zastąpić zgodą na publikację. Nie zmieniono usług ani billingu.
