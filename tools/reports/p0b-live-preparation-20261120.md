# P0-B — przygotowanie połączenia z Firebase, 20.11.2026

## Tożsamość i zgoda

Repo: mebleszek/meble-app. Gałąź: feat/p0b-live-connection-preparation-20261119.
HEAD wejściowy / BASE main: `2cfd2f84499b653d7239d4e975e8ca6850f9f09d`.
PR #151 jest już scalony i zamknięty; nie zmieniano go ani nie tworzono kolejnego.
Zachowano zastane zmiany AGENTS/RELEASE oraz ich kopię poza repozytorium.
Właściciel zatwierdził przygotowanie synchronizacji i warunkowe uruchomienie po potwierdzeniu gotowości. UI wymaga odrębnej zgody. Testowe dane nie oznaczają zgody na reset; cenniki i globals są chronione.

## USTALONE → WDROŻONE

Brakującą granicą były emulator-only assertEmulator w protokole, adapterze przestrzeni nazw i historii ofert, flaga p0bDemo w normalnym boot/runtime oraz publiczna zgoda protokołu 2/business-project-v1. CI starego wydania nie autoryzowało LIVE P0-B.

- Weryfikator przyjmuje osobną podpisaną decyzję protokołu 3: profile=business-room-v1, registry=p0b-rooms-v1, legacyDataPolicy=preserve-outside-registry. Nadal wymaga dokładnych pól, podpisu Ed25519, przypiętego klucza, właściciela, origin, projektu, bazy i hasha Rules. Stara decyzja protokołu 2 pozostaje ważna wyłącznie dla starego trybu.
- Bootstrap/boot/runtime wyprowadzają tryb P0-B ze zweryfikowanej decyzji. Nie wymaga flagi DEMO w podpisanej ścieżce. Samo ustawienie flagi na produkcyjnej domenie nie udziela dostępu.
- Nowa capability połączenia P0-B jest utrzymywana w istniejącym WeakMap autoryzacji, wymaga świeżej sesji Google/lease i dwóch niezależnych SDK. Adapter zachowuje kontrolę oryginalnego połączenia, epoch i revoke; kopia obiektu nie przenosi uprawnienia. Stara lub global-only zgoda nie udziela tej capability. Używają jej istniejący protokół, adapter oraz kanał historii ofert; nie przepisano CAS, blokad, PIN-u, recovery, heartbeat ani outboxa.
- Boot/runtime i odzyskiwanie bindingu odmawiają powrotu do starego protokołu, gdy IndexedDB ma marker nowego rejestru. Przed odmową nie zmieniają obrazu ani kolejki.
- Istniejące enterP0BRegistry zachowuje stare RAW, obrazy, repliki i wszystkie fazy outboxa w chronionej przestrzeni; nie migruje starych projektów. Nowe pokoje, kartoteka i oferta mają istniejące niezależne kanały. Nie zmieniono kalkulatora, PCV, cen, historii ani UI. W index.html zmieniono tylko wersję skryptu bootstrapu; manifest offline odzwierciedla aktualne bajty.
- Przygotowano application-p0b-owner.rules jako dokładny prototyp z istniejącego generatora normalnego P0-B i dokumentacją modelu. Nie zmieniono wyrażeń walidacji Rules, starych application-owner.rules ani firestore-live-pilot.rules. Brak komendy deploy i brak konfiguracji CLI kierującej ten prototyp do LIVE.
- Narzędzie offline application-release-package sprawdza zgodność podpisu i dokładnego hasha właściwego prototypu. Nie podpisuje, nie aktywuje i nie publikuje. Obecny publiczny application-release.js jest niezmieniony i nadal zawiera protokół 2.

SHA-256 prototypu Rules: `e05bef8df96a139fe061949008fea1d3187dfb0dfacc8b68606eed8047f128f4`.

## Kontrole i dowody

Dowody pełne, trace i archiwa lokalnego diffu są poza repo: work/p0b-live-preparation-evidence-20261120. Żadne profile właściciela ani produkcyjne rekordy nie służyły jako fixture. Źródła Linux mirror porównano SHA-256 z 22 zmienionymi plikami kodu/Rules/workflow w natywnym repozytorium; EXACT_TEST_MIRROR.

| Kontrola | Wynik / zakres |
| --- | --- |
| RED nowej podpisanej decyzji | LF_DEPLOYMENT_APPROVAL_REQUIRED na kodzie wejściowym; jedna celowana reprodukcja |
| Granice wdrożenia | 14/14 PASS Windows Node 22.23.4; dodatkowe 4 przypadki P0-B obejmują podpis, policy/registry, odmowę starego permitu/DEMO flagi, revoke/epoch/lease i pakowanie Rules. Po dokumentacji modelu ponownie tylko 4 powiązane PASS. Obiekty LIVE w tych testach są syntetyczne, bez sieci |
| Podpisany pełny scenariusz dwóch profili | Pierwszy PASS 1/1, ~193 s; nowy podpis protokołu 3, bez p0bDemo. UI, IDB/outbox/ACK, równoległe pokoje, odmowa tego samego pokoju, PIN, offline, SIGKILL, abort recovery, kopia, Exit, usuwanie, globals i stare źródło |
| Podpisana łączna oferta + Rules | PASS 5/5, exit 0 (~196 s): UI/PCV dwóch pokojów, historia/ACK/uncertain/SIGKILL/restart bez duplikacji; rzeczywista odmowa starej podpisanej decyzji na nowym markerze, bez zmian IDB; dwie regresje rejestru i dwie ofert, CAS, Auth, terminal deletion, 0/1/N i grupowe usuwanie, brak starego writera, budżet odczytów i historia |
| Końcowy pełny scenariusz po dodaniu guardu downgrade | PASS 1/1, exit 0 (~189 s), signed-demo-final.log: dokładny końcowy kod; także odmowa downgrade przed zmianą IDB. Powtórzono wyłącznie z powodu dodania nowego guardu recovery po pierwszym przebiegu |
| UI/source i wersje | main-login-smoke 36/36 PASS; offline-shell-smoke PASS; manifest i script-versions PASS; rzeczywisty HTTP 200/dokładne bajty 13 zależności fixture (w tym nowa granica Firebase), negatywy ścieżek PASS; diff --check PASS |
| Obowiązkowe CI | Plan 34 przypadków / 21 segmentów P0-B; nowy signed-quote osobno, podpisany signed-clean obejmuje teraz cały istniejący scenariusz. Zachowane 225 smoke / 251 jednostek / 36 grup. Structural coverage PASS; workflow diagnosticChecks 11/11 PASS na Linux (125 przypadków agregacji i negatywy). Żadnego uruchomienia Actions |

Pełny wrapper cloud-ci-reliability-smoke na Windows nie miał CLOUD_CI_HISTORY_ROOT; nie zaliczono go. Bezpośrednie diagnosticChecks na Windows zatrzymały się na teście bash pipeline (platforma); te same niezmienione kontrole przeszły w WSL/Linux. Nie obchodzono asercji ani nie poprawiano produkcji dla tego wyniku. Cała warstwa historycznych 425 pinów i pełny Preflight pozostają do Actions.

## Odczyt Firebase i granice

Firebase MCP: istniejące logowanie jest dostępne; aktywny projekt mebleszek-meble-app; billing wyłączony. To stan narzędzia, nie dowód, że przeglądarki synchronizują P0-B. Nie wykonywano logowania, zmian środowiska, Rules, grantów, IAM, billingu ani odczytów/zapisów danych LIVE.

## BRAKUJE → PROPONOWANE

1. Pełny zatwierdzony Preflight dokładnego końcowego HEAD/BASE i wydanie przez obowiązującą procedurę. Nie uruchomiono CI/PR/merge/Pages. Lokalne wyniki nie spełniają tej bramki.
2. Przed aktywacją: odczyt i porównanie rzeczywistego źródła Rules oraz istniejących grantów/activationId, sprawdzalna kopia i plan wycofania zmiany Rules, zweryfikowany publiczny podpisany artefakt protokołu 3 powiązany z dokładnym hashem prototypu. Zmiana istniejącego activationId bez protokołu bindingu nadal bezpiecznie odmawia; nie wolno leczyć jej resetem danych. Nie szukano, nie drukowano ani nie zastępowano klucza prywatnego. Poza repo przygotowano unsigned-p0b-decision.json: jawnie NIEPODPISANY kandydat z dotychczasowym ownerUid/activationId/odciskiem klucza i nowym dokładnym hashem Rules. Nie udziela uprawnień. Nie ma aktywującego P0-B artefaktu produkcyjnego w tym pakiecie.
3. Dopiero po dowodach gotowości realizacja warunkowej zgody LIVE w dokładnym bezpiecznym zakresie; w razie nowej potrzeby migracji/resetu/UI — STOP i osobna decyzja. Nowy rejestr nie przenosi starych testowych projektów. Zachowane źródła i archiwa nie mogą automatycznie zasilić nowego rejestru.
4. Fizyczny telefon/komputer/tablet: PHONE_PENDING. Profile Chromium nie zastępują odbioru sprzętu.

Prototyp Rules nie jest certyfikatem bezpieczeństwa ani dowodem wdrożenia. PIN pozostaje zaakceptowanym potwierdzeniem klienta, a nie serwerową ochroną. CAS/epoch i wyłączność nadal są egzekwowane przez Firestore. Powrót do starego writera po aktywacji nowego modelu wymaga świadomego planu, a nie tylko cofnięcia plików.

Stan: CODE_READY wyłącznie przygotowania połączenia / CI_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED — nie oznacza gotowości urządzeń ani aktywacji. P1/P2 nie rozpoczęto.


## Naprawa istniejącego PR #152 — Preflight run 44718390445

Właściciel zatwierdził naprawę 20.11.2026. Wejście: c6cc2efe75e4e2005cde12dcf2d76d9c88641ade; BASE/main: 2cfd2f84499b653d7239d4e975e8ca6850f9f09d. Ta sama gałąź/PR, bez nowego PR ani retry Actions.

Komplet końcowych jobów odczytano z API (per_page=100): 78 = 70 PASS, 6 FAIL, 2 SKIPPED. Pierwotne joby: playwright-sync-ui (136227623829) i preflight-shards (32) (136227625390). Agregaty firebase-current, preflight, ci-summary, final-status odmówiły wskutek tych dwóch jobów — nie mają osobnych przyczyn produkcyjnych.

- **Shard 32 — RED → GREEN.** Oba testy wycinają importy z prawdziwego runtime i wstrzykują zależności. Nie dostarczały nowego applicationP0BMode ani odczytu store.p0bRegistry. ReferenceError przerywał startup przed badanym cleanupem; test Android otrzymywał przez to settled=true zamiast czekania na close. Odtworzono oba błędy lokalnie. Podłączono rzeczywisty helper trybu oraz null markera w istniejącej starej fixture. Wszystkie asercje odmów, sprzątania, pierwotnego błędu i zakresu read-only zachowane. Android recovery 7/7 PASS; first-sync diagnostics 9/9 PASS. Nie zmieniano runtime.
- **Playwright — granica pomiaru.** CI porównało version 7/UI investorsList z version 8/UI rooms/inwestor, podczas gdy kolejka pozostała pusta i istniejące rekordy były niezmienione. Obraz before pobierano zaraz po kliknięciu otwarcia formularza, zanim jego osobny checkpoint nawigacji musiał się zakończyć. Poprawka mierzy before po przygotowaniu formularza i zakończeniu transakcji; dodatkowo porównuje z obrazem sprzed otwarcia: wszystkie klucze biznesowe i cała kolejka muszą pozostać identyczne, dopuszczalny jest wyłącznie zamierzony fc_ui_v1 tej nawigacji. Po abortowanym Zapisz nadal obowiązuje pełne deepEqual całego obrazu, wersji, hasha i outboxa oraz zachowanie formularza. Nie dodano whitelisty produkcyjnej ani ignorowania pól po abort.
- **Dalsze subtesty CI.** Po pierwszym FAIL formularz nie został zakończony; odbiór oferty czekał, generated nie zostało ustanowione, a kolejne kliknięcie zatrzymał info-backdrop. Kontrolny lokalny przebieg niezmienionego wejścia przeszedł 4/4 scenariusze (TAP 5/5 z rodzicem, exit 0, ~193 s). To dowód zależności od kolejności/timingu; nie deklarujemy stale odtwarzalnego lokalnego RED UI ani czterech osobnych błędów produkcyjnych. Dowód RED to dokładny diff i stack z CI. Końcowy przebieg poprawionej fixture: 4/4 scenariusze PASS, TAP 5/5 z rodzicem, exit 0 (~184 s), repair-ui-green.log. Wykazał setupBeforeVersion=7, beforeAbortVersion=8, setupChangedKeys=[fc_ui_v1] przed abortem; późniejszy pełny deepEqual po abort przeszedł.

Zmiany ograniczone do trzech istniejących testów i powiązanej dokumentacji. Kod aplikacji, UI, manifest, kalkulator, ceny, Rules i dane bez zmian. Routing pozostaje obowiązkowy: istniejący playwright-sync-ui oraz smoke w shardzie 32; kontrola pełnego rozłącznego pokrycia PASS, manifest PASS. Pełnego CI lokalnie ani w Actions nie powtarzano. Ścieżka dowodów lokalnych: work/p0b-live-preparation-evidence-20261120/repair-ui-control.log i repair-ui-green.log; ślady błędów CI pozostają artefaktami wskazanego runu.

Status naprawy: CODE_READY naprawy / CI_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED. Nowa próba wydania wymaga zgody na końcowe HEAD/BASE; dotychczasowy CI FAIL nie został skasowany ani zamieniony na PASS.


## Preflight #1362 — Chromium startup, diagnostyka BLOCKED

Wejście/HEAD PR #152: 2611c2c413ced1d0fc9d44487b0a1cb9e6178a6a; BASE/main: 2cfd2f84499b653d7239d4e975e8ca6850f9f09d. [Run](https://github.com/mebleszek/meble-app/actions/runs/44769824124), 78 jobów: 72 PASS, 4 FAIL, 2 SKIPPED. Jeden pierwotny FAIL: preflight-shards (23), job 136404272027, local-cabinet-native-browser-smoke.js; trzy agregaty preflight/ci-summary/final-status. Poprzednie naprawione grupy nie są przyczyną tego FAIL.

**USTALONE.** Endpoint nie został ogłoszony w 59996 ms, phase=endpoint-announcement, elapsed=60065, budget=60000. stderr pusty, exitCode/signal null, raportowane pid=2986. Ten PID jest procesem Python subreaper, nie bezpośrednim Chrome: Python → dbus-run-session → /usr/bin/google-chrome. Brak stderr i żywy nadzorca nie wskazują, na którym kroku utknęło uruchomienie. Log nie ma stanów potomków ani ich miejsca oczekiwania. Nie dowodzi braku pamięci, błędu szafek, błędu aplikacji ani konkretnej winy D-Bus/Chrome. Nie zwiększamy timeoutów, nie dodajemy retry i nie zgadujemy flag uruchomienia.

**WYKONANE BEZPIECZNE CZĘŚCI — PAKIET DIAGNOSTYCZNY.** Do diagnostyki błędu w istniejącym helperze dodano snapshot tylko własnego drzewa procesów PRZED cleanup: pid/ppid/grupa, stan, nazwa procesu i wchan. Maksymalnie 64 rekordy, obsługa znikających procesów i niedostępnego /proc. Bez argv, środowiska, tokenów, zawartości profilu ani szczegółów obcych procesów w wyniku. Nie zmienia startu, endpointu, 60 s, cleanup, reaper receipt ani asercji aplikacji. Regresje w istniejącym obowiązkowym chromium-runtime-smoke: syntetyczny nadzorca/D-Bus/Chrome, brak obcych danych, prawdziwe własne potomki i timeout/HTTP/crash z dowodem drzewa przed cleanup. W przyszłym FAIL będzie wiadomo, czy istniał Chrome i na czym czekali jego przodkowie; sam snapshot nie gwarantuje diagnozy wszystkich możliwych hangów.

**WYNIKI.** Dokładny test local-cabinet-native-browser-smoke lokalnie PASS: natywne modale, zestawy A/C/D, PCV i wszystkie 17 wariantów po zimnym restarcie offline. To nie reprodukcja FAIL runnera. Uruchomiono w istniejącym izolowanym WSL Chromium, bez Firebase i profilu właściciela. chromium-startup-smoke 4/4 PASS; chromium-runtime-smoke PASS wraz z nowymi negatywami i niezmienionymi testami wspólnego deadline/cleanup. Pierwsze wywołanie runtime-smoke nie miało CHROMIUM_PATH (brak /usr/bin/google-chrome w WSL); po wskazaniu istniejącego binarium test przeszedł, bez instalacji i zmian kodu dla środowiska. Rzeczywisty test szafek wykonał się na wejściowym launcherze; końcowa zmiana działa tylko w diagnostyce odmowy, sprawdzonej przez regresje launchera. Lokalny log: work/p0b-live-preparation-evidence-20261120/chromium1362-local.log.

**BRAKUJE → PROPONOWANE.** Przyczyna historycznego zawieszenia pozostaje nierozstrzygnięta; runner został zakończony, a dostępny log nie zawiera niezbędnych danych o potomkach. Do ustalenia potrzebny jest dowód z procesu, który rzeczywiście utknie, np. z kolejnej osobno zatwierdzonej próby z przygotowaną diagnostyką. Lokalny PASS nie rozstrzyga historycznej awarii. Status: BLOCKED przyczynowej naprawy / CI_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED. Po odrębnej zgodzie właściciela pakiet diagnostyczny obejmuje jeden commit/push do tej samej gałęzi PR #152. Bez nowego PR, Actions/retry, merge, wydania i Firebase LIVE. Przyczyna nadal nierozstrzygnięta. Nie przedstawiać diagnostyki jako naprawy startu Chromium.
