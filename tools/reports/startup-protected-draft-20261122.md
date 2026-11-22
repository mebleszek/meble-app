# Start z chronionym szkicem po przejęciu — 22.11.2026

## USTALONE

Właściciel zatwierdził naprawę raportu z drugiego komputera. Kod: `initial-global-revision / LF_ACTIVE_RAM_PROTECTED`, wcześniej także binding-runtime. Raport jest obserwacją, nie dowodem utraty katalogów ani aktualnej liczby szafek/ofert. Zachowanie danych ma pierwszeństwo. Brak resetów, migracji, nowych ekranów, Rules lub operacji LIVE.

Kontynuacja `feat/manual-sync-quote-lock-warning-20261122` na `986c723d671b6f866e526ba85bb381ae754475ce`, BASE/main `9b5c0d21ee188f84014941326a5ee94b98f11881`; początkowo CLEAN, przygotowany poprzedni commit zachowany. GitHub main zweryfikowany. Odczytano wskazany wynik aktywacji z gałęzi `docs/p0b-live-activation-result-20261121`: wcześniejsze LIVE_CONFIG_ENABLED i właścicielski odbiór w obie strony są odrębne od obecnego błędu. Nie przywracano starych statusów LIVE_BLOCKED jako bieżącego stanu.

## Przyczyna i WDROŻONE w kandydacie

1. Boot odtwarza istniejący zatwierdzony obraz IndexedDB i prawidłową aktywną sesję v4. Authority rozpoznaje dokładny trwały szkic i, po sprawdzeniu zmiany edytora, zachowuje go do odczytowego odzyskiwania.
2. Następnie początkowy flush widzi nowszą rewizję z drugiego urządzenia. `incoming → idle` słusznie zwraca LF_ACTIVE_RAM_PROTECTED: aktywnej edycji nie wolno zastąpić.
3. Runtime traktował tę odmowę jak fatalny błąd startu. Nie dochodził do bind i istniejącego okna odzyskiwania. Samo zamknięcie przeglądarki nie usuwa trwałego szkicu, więc restart powtarzał blokadę.
4. Nowe potwierdzenie porównuje aktualną, ponownie odczytaną aplikację IDB z obrazem authority, sesję i jej źródłowe RAW, kontekst właściciela, RAM, blokady formularzy oraz brak trwającej transakcji/incoming. Początkowy start dodatkowo wymaga wcześniejszego dowodu bootDraft i fazy loading. Brak któregokolwiek dowodu nadal odmawia.
5. Tylko dla tak potwierdzonego szkicu i wyłącznie kodu LF_ACTIVE_RAM_PROTECTED runtime dopuszcza dotychczasowy lokalny widok/odzyskiwanie. Incoming/refresh nadal odmawiają, wynik flush pozostaje false, uprawnienia i pojedynczy edytor są nienaruszone. Ponowne uwierzytelnienie istniejącego runtime stosuje tę samą kontrolę trwałego obrazu.

Nie usunięto ani nie osłabiono `idle`, walidacji sesji, Auth, CAS, epoch, PIN-u, historii, outboxa lub ACK. Nie wykonano session.commit, automatycznego odzyskania ani kopiowania danych. Oryginały katalogów localStorage mogą być puste przy prawidłowym obrazie LOCAL-FIRST; nie są na tej podstawie odbudowywane.

## Dowody / wyniki

- RED: rzeczywiste dwa profile Chromium, Auth/Firestore DEMO 19099/18080, UI PIN takeover i publikacja nowej rewizji, następnie SIGKILL profilu z lokalnym szkicem. `startup-draft-red.log`: 1 FAIL, identyczny błąd initial-global-revision/LF_ACTIVE_RAM_PROTECTED, 147,717 s. Pierwszy punkt odmowy jest początkowym odbiorem, nie logowaniem Google ani brakiem danych globalnych.
- Pierwszy GREEN: `startup-draft-green.log`, 1/1 PASS, 161,751 s. Przed jakąkolwiek decyzją odzyskiwania potwierdzono dokładny lokalny projekt/sesję/outbox/replice/protected/RAW, bieżącą zdalną rewizję i niezmienione cudze prawo edycji. Brak automatycznej publikacji lub przejęcia.
- Końcowy scenariusz używa desktopu, którego natywne oryginały materiałów są puste, a katalogi IDB obecne. Ten sam moduł przejęcia/PIN i rzeczywiste kliknięcia, z zachowaniem niewysłanej szafki. Końcowy wspólny run `startup-draft-final.log`: 2/2 PASS, 0 FAIL, 0 SKIPPED, exit 0, 332,662 s. Desktop 119,059 s; istniejący normal-clean 211,362 s, w tym abort/recovery, CAS, offline, własne i obce blokady, usuwanie i zachowanie danych. Nie utożsamiać Chromium DEMO z fizycznym odbiorem Edge właściciela.
- Granice startup 14/14 i wcześniejsze quote-access 5/5 PASS; negatywy odmawiają m.in. zmienionego obrazu, obcego właściciela, niedurable sesji, różnego RAM, formularza, pustego/niezgodnego dowodu i innego RAW sesji. Login 36/36, source boundary, manifest/wczytywanie/weryfikacja pokrycia PASS. Nowy test obowiązkowy w osobnym segmencie `startup-draft-recovery`: 37 segmentów P0-B/P1, 59 przypadków; wszystkie stare grupy zachowane.
- Logi izolowane: `/tmp/meble-resume.e8R06r/startup-draft-*.log`, failure/trace/screenshot w `/tmp/meble-p0b-normal-*`. PIN losowy wyłącznie w pamięci testu, ślady są zatrzymywane przed jego wpisaniem.

## BRAKUJE / ryzyka / PROPONOWANE

Pełne CI, osobno zatwierdzone wydanie i próba na rzeczywistym drugim komputerze pozostają. Z tej sesji nie uzyskano dostępu do profilu Edge na komputerze `C:\Users\admin\...`. Nie podano aktualnej liczby rzeczywistych szafek/ofert ani rzekomego zrzutu historii. Po instalacji poprawki drugi Codex może dokończyć ten odczyt, po świadomym rozstrzygnięciu ewentualnego odzyskiwania przez właściciela. Nie należy nadpisywać starej pracy tylko po to, by odczytać licznik.

Poprawka dowodzi konkretnej odtworzonej przyczyny, nie wszystkich możliwych odmian binding-runtime/RAM_DIVERGENCE. Niezgodny lub niepotwierdzony lokalny stan musi nadal zachować bezpieczną odmowę. CODE_READY naprawy / CI_PENDING / RELEASE_BLOCKED / DEVICE_PENDING po celowanym PASS; brak automatycznej zgody na nowe CI/wydanie.

Dodatkowo: aktualizacja rzeczywistego starego SW BASE→nowy, pełne manifesty, naturalna aktywacja i odczytowa kopia ratunkowa PASS; aktywna edycja, RAW, IDB i uncertain outbox zachowane. Kontrola rzeczywistego workflow i 13 grup diagnostycznych (125 negatywów agregacji, bramki SHA/Ready/Pages/TAP) PASS. Nie uruchamiano GitHub Actions ani pełnego lokalnego Preflightu.

## Pliki poprawki względem wejściowego HEAD

- `.github/workflows/preflight-js.yml`
- `CURRENT_STATE.md`
- `docs/plans/LOCAL_FIRST_ROADMAP.md`
- `offline-assets.js`
- `sync/application-authority.mjs`
- `sync/application-runtime.mjs`
- `tools/ci-sharding-smoke.js`
- `tools/firebase-pilot/normal-startup-boundary.test.mjs`
- `tools/firebase-pilot/p0b-normal-application.test.mjs`
- `tools/p0b-ci-plan.js`
- `tools/firebase-pilot/p0b-startup-draft.cases.mjs`
- `tools/reports/startup-protected-draft-20261122.md`
