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
