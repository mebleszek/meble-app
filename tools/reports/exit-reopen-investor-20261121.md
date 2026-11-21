# Wyjdź i ponowne otwieranie inwestora — 21.11.2026

## USTALONE

Właściciel zgłosił po wydaniu P1 `LF_APPLICATION_UNCONFIRMED` przy otwarciu inwestora i miganie Projektów. Zatwierdził naprawę zachowania, bez przebudowy UI i czyszczenia danych. BASE/main: `662fb163da73e1990f69c376eb4f5b61fa161cd6`; gałąź `fix/p1-exit-reopen-investor-20261121`. Brak zmian Firebase LIVE i nowego wydania.

Poprzednie wydanie: PR #155, Preflight [#1368](https://github.com/mebleszek/meble-app/actions/runs/44912339661) PASS i [Pages](https://github.com/mebleszek/meble-app/actions/runs/44912867592) PASS dla tego BASE. Publikacja od startu CI: 6:47. Starsza dokumentacja przygotowania jest historyczna.

## WDROŻONE — potwierdzony wyścig

`createApplicationActionBinding.cancel()` wykonywał dwa checkpointy: najpierw zamknięcie czystej sesji, potem nawigację do listy. W międzyczasie sesja była już nieaktywna, więc niezależny odbiór mógł rozpocząć projekcję. Drugi checkpoint odmawiał `LF_REMOTE_APPLY_PENDING`; pozostawał widok pomieszczenia bez sesji. To rzeczywisty błąd powiązanego przepływu, odtworzony w pełnym Chromium/Emulator po dodaniu zwykłego Wyjdź → ponownego otwarcia i dalszego zapisu.

Poprawka łączy zamknięcie czystej sesji, kontrolę rozbieżności i nawigację w jednym checkpointcie. Pozostają guardy, CAS, intencja handover i wymaganie ACK. Nie dodano retry ani ignorowania odmów. Nieudany commit przywraca także aktywną sesję, zamiast pozostawiać częściowe wyjście.

## Dowody

- Nowa regresja uruchomiona przeciw wydanej funkcji: **RED**, oczekiwany jeden checkpoint, rzeczywiste dwa. To izolowana asercja; licznika całego modułu z uruchamiacza wybierającego jeden przypadek nie traktujemy jako wyniku całego zestawu.
- Po poprawce pełny celowany moduł `application-project-exit-smoke.js`: **13/13 PASS**, w tym abort, zachowanie fizycznego RAW, szkice, Anuluj, pending operacje, handover i brak fałszywego potwierdzenia zapisu.
- Pierwszy rozszerzony UI na wydanym kodzie: **RED**, odmowa drugiego Wyjdź `LF_REMOTE_APPLY_PENDING`. Zwykłe otwarcie inwestora i oba otwarcia Projektów przeszły wcześniej; nie mylić tego z odtworzeniem wszystkich objawów telefonu.
- Po poprawce pełny rozszerzony UI delivery z myszą: **1/1 PASS**, zwykły Exit/reopen, projekty, Save, SIGKILL przed ACK, restart, ta sama rewizja bez duplikatu, zwolnienie i offline kolejka.
- Dodatkowy wariant 393×851 z prawdziwym CDP touchStart/touchEnd na Projekty: **1/1 PASS**, pełny delivery, exit 0, zero skipped.
- Pokrycie: istniejący obowiązkowy smoke i segment `project-batch-recovery` obejmują obie regresje, bez nowych wyłączeń; 228 plików / 259 jednostek / 36 grup i 25 segmentów / 39 przypadków zachowane. Manifest, wersje i diff sprawdzane celowanie; nie uruchamiano pełnego Preflightu lokalnie ani Actions.

## BRAKUJE / ograniczenia

Dokładny `LF_APPLICATION_UNCONFIRMED` i miganie z telefonu nie odtworzyły się w czystym DEMO. Nie dowiedziono, że wykryty wyścig jest jedyną przyczyną zgłoszenia właściciela. Poproszono o informację po ponownym otwarciu karty bez czyszczenia danych, wyłącznie przy braku niezapisanej edycji. Nie zmieniano uprawnień, cenników, danych właściciela ani projektu produkcyjnego.

Status: poprawka potwierdzonego wyścigu lokalnie zweryfikowana; **CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING**. Całego zgłoszenia telefonu nie oznaczamy PASS. Wydanie nowego SHA wymaga osobnej zgody.

## Zakres

- `sync/application-authority.mjs` i wygenerowany `offline-assets.js`.
- `tools/application-project-exit-smoke.js`, `tools/firebase-pilot/p1-project-sync.cases.mjs`.
- `CURRENT_STATE.md`, `docs/plans/LOCAL_FIRST_ROADMAP.md`, ten raport.

Dowody lokalne: `/tmp/meble-p1.KVrFtN/exit-reopen-initial.log`, `exit-reopen-green-mouse.log` i końcowy log dotyku; diagnostyka/screenshot/trace w katalogach `meble-p0b-normal-*` wskazanych w logach. Brak resetu danych i usuwania artefaktów.


## Uzupełnienie — AUTH_ACCESS_REVOKED ze stosu właściciela

Wejście tego uzupełnienia: `d69ccb10fb79ae521c87107dbe80b4eee4719798`, ten sam BASE/main i gałąź. Guard poprawnie odmawiał staremu uprawnieniu. Dwa problemy jego cyklu życia:

1. Bootstrap przy aktywnym runtime zwracał go bez podmiany połączeń, mimo nowej zatwierdzonej lease. Odtworzono RED (zero resume zamiast jednego). Osobna boundLease śledzi faktycznie podpięte uprawnienie, niezależnie od beforeBusiness/lastContext. Ta sama lease nie powoduje zbędnego reconnect; nowa wymaga udanego resume. Samo Google login nadal nie daje dostępu bez weryfikacji.
2. Istniejące elementy listy i modala trzymały obserwatory poprzedniego protokołu po podmianie SDK. Nowy stabilny dostawca obecności zamyka poprzednie obserwatory i odpina ich callbacki generacją, zachowując subskrypcję UI do ponownego związania z nowym autoryzowanym protokołem. Znana odmowa Auth podczas zakładania/odświeżania obserwatora daje wyłącznie unconfirmed; błędów programistycznych TypeError nie ukrywamy. Późny close starego runtime nie może odłączyć nowego protokołu.

Zmieniono bootstrap (z nową wersją zasobu), runtime P0-B, nowy application-presence.mjs i testy. Bez zmian auth-access-gate, Rules, uprawnień, cen, wyglądu lub tekstów UI. Fixture potrafi teraz jawnie cofnąć starą testową lease; nie nadaje to żadnego nowego dostępu. Testy nadal używają SDK i rzeczywistych emulatorów.

GREEN: diagnostyka/reauth bootstrap 10/10, main-login 36/36, lifecycle presence (zamknięcie, późne callbacki, stary close, revoked i nieukrywanie innych wyjątków), wersje/manifest/diff/pokrycie CI. Pełny realny UI/DEMO reauth/dotyk/delivery 1/1 PASS, exit 0, zero skipped. Nowy smoke automatycznie obowiązkowy: 229/260/36, macierz P0-B/P1 bez pominięć. Dodatkowe pliki: index.html, application-bootstrap.js, application-p0b-runtime.mjs, application-presence.mjs, normal-application.cases.mjs, p1-project-sync.cases.mjs, first-sync-error-diagnostics-smoke.js, application-presence-lifecycle-smoke.js, script-versions.js i manifest.

Istniejący mapper odmów application-write-boundary rozpoznaje prefiksy LF/SESSION/GLOBAL/CLOUD, ale Error z gate ma message AUTH_ACCESS_REVOKED bez code. Dlatego stale połączenie mogło dać zgłoszony ogólny LF_APPLICATION_UNCONFIRMED. Nie zmieniano tekstów ani mappera: naprawiono przyczynę pozostawienia starego uprawnienia. Fizyczny odbiór telefonu pozostaje PHONE_PENDING; pakiet obu napraw CODE_READY / CI_PENDING / RELEASE_BLOCKED.

Aktualizacja podczas przygotowania Auth: zdalny main przeszedł na `1658e60f178c37128b5dbaf56c13171d47bc13a5` przez scalenie poprzedniego `d69ccb10fb79ae521c87107dbe80b4eee4719798`. Porównanie całych drzew obu SHA jest puste: nowy BASE/main ma dokładnie przetestowaną bazę. Nie nadpisano ani nie scalono main ręcznie; nowy commit obejmuje wyłącznie uzupełnienie Auth.
