# Preflight #1357 — pakiet naprawczy po PR #151 (19.11.2026)

## Zakres i stan źródeł

- Repozytorium: mebleszek/meble-app; nowa gałąź: `fix/preflight-1357-p0b-20261119`.
- HEAD wejściowy: `d096e8a0caae5ef0170492250860f9a5983a0383`.
- BASE/main (zweryfikowany przez ls-remote): `d91c48938febe800553def7ed17967d0ffdcfb0b`.
- [Przebieg 44468878511, Preflight #1357](https://github.com/mebleszek/meble-app/actions/runs/44468878511), attempt 1. PR #151 pozostawiono bez zmian.
- Pełna strona API jobs (`per_page=100`, również `filter=all`) zawiera 72 zadania: **50 success, 21 failure, 1 in_progress**. Nie użyto skróconej odpowiedzi ograniczonej do 30 zadań. Pobrano kompletne logi wszystkich 21 zakończonych FAIL.
- `playwright-local-ui` (135373384429) nadal wykonuje krok testowy od 05:59:51 UTC; API logów odmawia pobrania niezakończonego joba. Nie jest to PASS ani kompletny wynik końcowy przebiegu. Końcowy odczyt i logi tego joba pozostają bramką kompletności inwentarza.
- Nie uruchamiano ponownie Actions, pełnego Preflightu ani pełnych shardów lokalnie. Nie modyfikowano produkcyjnych Rules, danych, cen, UI ani AGENTS.

## Wspólne przyczyny i dowody

1. **Konfiguracja ładowania:** HTML zawierał 353 skrypty, kanoniczne grupy 348. Brakowało pięciu już wdrożonych plików room-project/quote/picker. Uzupełniono konfigurację w istniejącej kolejności HTML. Zachowano kontrolę wszystkich dodatkowych skryptów inline w main-login.
2. **Fixture/cwd:** moduły CJS czytały index/worker/skrypty względem cwd procesu uruchamianego z tools/firebase-pilot. Ścieżki zakotwiczono w __dirname. Rzeczywisty test uruchomiony z tego katalogu przeszedł.
3. **Serwery modułów:** local-first-idb importuje teraz m.in. quote-store → quote-status → room-batch → application-p0b-domain/binding. Stare listy/regexy nie obsługiwały grafu, m.in. cyfry 0. Przeglądarka zgłaszała błąd modułu nadrzędnego mimo 404 zależności. Serwery obsługują literalne względne zależności zadeklarowanych entrypointów; nadal odmawiają zasobów spoza repozytorium i brakujących plików. Android preconditions wymaga pełnego entrypointu application-runtime. Nowy smoke potwierdza rzeczywiste HTTP 200, MIME i dokładne bajty 12 zależności oraz odmowy 404.
4. **Stary fixture magazynu:** kontakt bez pola rooms nie odpowiadał kanonicznemu rekordowi aplikacji; validateQuoteStatusRooms słusznie odmawiał zmiany expectedCards. Poprawiono wyłącznie fixture (`rooms:[]`). Guard, scope i atomowość pozostają bez zmian.
5. **Recovery/test błędu:** UI celowo stosuje safeError, więc surowy Error('copy-lost-ack') nie może być publicznym kodem. Test wstrzykuje teraz jawny syntetyczny kod LF_TEST_COPY_ACK_LOST oraz dowodzi, że serwer wcześniej zmienił właściciela/epoch. Zachowano wszystkie późniejsze asercje szkicu, checkpointu, kolejki, restartu, abortu i braku duplikatów.
6. **Stary fixture Auth/edytora:** zimny start trwałego szkicu dostawał ogólne {schemaVersion:1} zamiast potwierdzonej blokady. recoverEditor poprawnie odmawiał. Fixture odpowiada teraz pełnym rekordem właściwego urządzenia/generacji i dowodzi świeżego odczytu. Nie zmieniono reguł recoverEditor.
7. **Infrastruktura Chromium:** sockety UNIX przekraczały limit długości przy dziedziczonym TMPDIR; odtworzono dbus127 „Socket name too long”. Unikalny runtime i TMPDIR dziecka są krótkie (/tmp/mcr-*); profile, limit 60 s, dowód CDP/HTTP oraz subreaper/receipt pozostają obowiązkowe. Ten sam długi TMPDIR daje rzeczywisty start/cleanup PASS. Historyczny signed-startup miał tylko timeout z pustym stderr: nie ma dowodu pozwalającego przypisać mu jednoznacznie identyczny błąd dbus. Nowy test podpisanego startupu przy długim TMPDIR przechodzi bez zwiększenia budżetu.
8. **Fixture async/zależności runtime:** test company settings sprawdzał rezultat przed zakończeniem istniejącego async handlera. Testy stripped-runtime pomijały handover, lokalną nazwę urządzenia oraz wymagane API fixture store. Dodano rzeczywiste zależności i oczekiwanie na handler; nie zmieniono wyników ani negatywnych asercji.
9. **Produkcja — pochodzenie frontów zestawu:** kontekst obcego projectId mógł oznaczyć fronty z RAM jako należące do innego projektu. Jawny projectId służy detached obiektom pokoju; odczyt przez klucz RAM zachowuje jego rzeczywistego właściciela. Negatyw cross-context i pozytyw detached P0-B działają razem, przy zachowaniu golden ilości/powierzchni/PCV. Bez zmian wzorów/cen.
10. **Produkcja — wyścig handover:** pending() obserwował dopiero końcowe release, pomijając trwający flush/ACK. Ponowne otwarcie mogło wejść pomiędzy te fazy i prawidłowo otrzymać LF_HANDOVER_UNCERTAIN. Śledzona jest cała istniejąca, trwale zlecona operacja; ensureEditor najpierw ją rozstrzyga. Nie powstaje nowa intencja zwolnienia, nie zmienia się epoch ani CAS. Deterministyczna regresja: przed zmianą pending był undefined podczas wstrzymanego ACK (RED); po zmianie oczekuje pełnej operacji i jednego release (GREEN).
11. **Test nawigacji i odbiór:** ACK nadawcy nie oznacza zakończonego refresh odbiorcy. normal-clean nie czekał na rewizję drugiego pokoju i próbował nawigacji podczas chronionego incoming. Dodano dowód konkretnej odebranej rewizji i zakończenia projekcji. Runtime udostępnia istniejący incomingPending wyłącznie odczytowo w diagnostyce; odmowa LF_REMOTE_APPLY_PENDING pozostaje.
12. **Wiszący localOnly UI:** jego serwer nie obsługiwał pięciu plików tools/firebase-pilot/*.mjs wymaganych przez aktualny manifest offline. Rzeczywisty HTTP zwrócił pięć 404, po nieudanej instalacji brak rejestracji Workera, a ready nigdy się nie spełniało. Fixture serwuje także dokładną listę publicznego manifestu i jawnie odmawia po stanie redundant, zamiast wisieć. Kod produkcyjnego Workera i wymaganie aktywnego Workera zachowane.

## Wszystkie pierwotne FAIL

„PASS celowany” oznacza kontrolę przyczyny/przypadku, nie ponowne zaliczenie całego joba na nowym SHA.

| Job / ID | Przyczyna | Rozstrzygnięcie / dowód lokalny |
|---|---|---|
| preflight-static / 135373384347 | 1 | Audyt grup 353, wersji, manifestu i zależności PASS |
| playwright-sync-ui / 135373384363 | 10 | Rzeczywisty RED powtórzony; regresja handover 12/12 PASS; sync-ui-final: wszystkie 4 scenariusze UI PASS (TAP 5/5 z rodzicem), exit 0 |
| firebase-p0b room-model / 135373384718 | 2 | cwd-target: PASS, łącznie 6 przypadków model/proof |
| firebase-p0b normal-clean / 135373384793 | 11 | normal-clean-final: 1/1 PASS po korekcie bariery i handover, exit 0; dwa urządzenia, PIN/copy/SIGKILL/ACK/usuwanie |
| firebase-p0b room-storage / 135373384809 | 4 | room-storage-target: 4/4 PASS |
| firebase-p0b signed-startup / 135373384823 | 7 | normal-signed-target: test diagnostyczny PASS przy długim TMPDIR; funkcjonalnie oczekiwana odmowa starego protokołu pozostaje |
| firebase-p0b profiles / 135373384824 | 3 | recovery-profiles-final: 2/2 PASS (wspólny proces z recovery) |
| firebase-p0b room-quote-acceptance-conflict / 135373384831 | 7 | długi TMPDIR: reprodukcja RED → realny start/cleanup GREEN; acceptance-conflict-target: 1/1 PASS, realny UI/Firestore DEMO |
| firebase-p0b recovery / 135373384844 | 5 | recovery-profiles-final: 2/2 PASS, także osobno recovery 1/1 PASS |
| firebase-p0b room-quote-proof / 135373384891 | 2 | cwd-target: PASS, łącznie 6 przypadków model/proof |
| preflight-shards 24 / 135373385176 | 8 | global-data-write-safety PASS, wszystkie asercje zachowane |
| preflight-shards 31 / 135373385178 | 3 | android-globals-recovery-browser: 3 scenariusze PASS |
| preflight-shards 25 / 135373385204 | 1 | main-login-smoke PASS, w tym skrypty inline |
| preflight-shards 20 / 135373385205 | 3 | transport-import-target: rzeczywisty Chromium PASS |
| preflight-shards 32 / 135373385218 | 8 | first-sync diagnostics 9/9 i android recovery 7/7 grup PASS |
| preflight-shards 26 / 135373385229 | 6 | cold-start-proof-final: oba warianty startupu i abort/retry Exit PASS |
| preflight-shards 16 / 135373385248 | 3 | rescue-browser-target PASS |
| preflight-shards 29 / 135373385278 | 3 | synthetic-rebuild-target: 3 scenariusze PASS |
| preflight-shards 27 / 135373385341 | 3, 9 | Android preconditions 3 scenariusze PASS; template-part-groups 22/22 PASS |
| preflight-shards 35 / 135373385351 | 3 | labor-browser-target: rzeczywisty Chromium PASS, historyczne wartości/zależności zachowane |
| firebase-current / 135375166787 | agregat zależności | W pierwotnym CI FAIL wskutek powyższych; bez nowego Actions pozostaje CI_PENDING |

Dodatkowo `playwright-local-ui` / 135373384429: pierwotny run w toku; przyczyna wiszenia odtworzona (12), local-ui-final: oba rzeczywiste scenariusze IndexedDB/restart 2/2 PASS. Nie przypisano mu fikcyjnego FAIL/PASS GitHuba.

## Wynik pakietu

Wszystkie wykonane końcowe kontrole celowane zakończyły się PASS i kodem 0. Nie jest to pełny Preflight ani dowód zaliczenia całego P0-B. Ostateczny inwentarz pierwotnego runu pozostaje **BLOCKED**: w odczycie API z 19.11.2026 07:28:19 UTC nadal 50 success / 21 failure / 1 in_progress; nie ma końcowego loga playwright-local-ui. Jego rzeczywistą lokalną przyczynę i oba przypadki UI już zweryfikowano. Po zakończeniu oryginalnego joba potrzebny jest odczyt wyniku/logów przez niezależną kontrolę; nie wolno domyślać późniejszych wyników. Nie ponawiano Actions.

50 pierwotnych PASS nie przypisano nowemu SHA i nie powtarzano całych grup. Lista powyżej rozlicza wszystkie 21 zakończonych pierwotnych FAIL oraz osobno niezakończony job.

## Pokrycie i ograniczenia

- Wszystkie wcześniejsze grupy i asercje zachowane; nowy fixture-module-graph-smoke jest obowiązkowy. Gate wykazał **225 smoke files / 251 execution units / 36 disjoint groups**; nadal **20 grup / 32 przypadki P0-B** plus osobne Playwright localOnly/sync.
- Nowa regresja pełnego handover znajduje się w istniejącym obowiązkowym application-project-exit-smoke. Test infrastruktury Chromium wymaga krótkiego TMPDIR również przy długim dziedziczonym korzeniu, zachowuje negatywy deadline/HTTP/cleanup.
- Testy: native Windows Node oraz izolowane profile Chromium w istniejącym WSL, Firebase Emulator Standard DEMO (19099/18080). Bez LIVE, danych użytkownika i migracji.
- Podpisany test diagnostyczny potwierdza bezpieczną bramkę niezgodności starego rejestru (`LF_PROJECT_DISCOVERY_UNCONFIRMED`), a nie gotowość jego migracji/aktywacji.
- Jednorazowa odmowa Rules w pierwszym łącznym uruchomieniu recovery/profiles nie powtórzyła się osobno ani po poprawce recovery przy wspólnym przebiegu (2/2 PASS). Nie zmieniono Rules i nie traktuje się tego jako udowodnionej naprawy Rules.
- Historycznego 60-sekundowego timeoutu signed-startup nie da się jednoznacznie rozłożyć bez brakującego stderr; dowód nowego uruchomienia i zachowane granice są odrębne od hipotezy historycznej.
- Pełne CI nowego SHA: CI_PENDING; wydanie i LIVE: BLOCKED. Fizyczne urządzenia: PHONE_PENDING. Końcowy status całego oryginalnego przebiegu pozostaje niepotwierdzony.

## Zmienione pliki

- `CURRENT_STATE.md`
- `dev_tests.html`
- `docs/plans/LOCAL_FIRST_ROADMAP.md`
- `index.html`
- `js/app/cabinet/front-hardware-fronts.js`
- `offline-assets.js`
- `sync/application-replication.mjs`
- `sync/application-runtime.mjs`
- `tools/android-globals-recovery-smoke.js`
- `tools/app-dev-smoke.js`
- `tools/application-project-exit-smoke.js`
- `tools/chromium-runtime-smoke.js`
- `tools/firebase-pilot/p0b-investor-rules.test.mjs`
- `tools/firebase-pilot/p0b-normal-application.test.mjs`
- `tools/firebase-pilot/p0b-recovery-cases.mjs`
- `tools/firebase-pilot/p0b-room-storage.test.mjs`
- `tools/firebase-pilot/playwright-local-ui.test.mjs`
- `tools/first-sync-error-diagnostics-smoke.js`
- `tools/fixture-module-graph-smoke.js`
- `tools/global-data-write-safety-smoke.js`
- `tools/helpers/android-globals-browser-fixture.js`
- `tools/helpers/android-startup-full-browser.js`
- `tools/helpers/chromium-runtime.js`
- `tools/helpers/fixture-module-assets.js`
- `tools/helpers/local-first-browser.mjs`
- `tools/index-load-groups.js`
- `tools/investor-list-delete-smoke.js`
- `tools/investor-navigation-exit-smoke.js`
- `tools/labor-catalog-local-first-browser-smoke.js`
- `tools/local-first-rescue-browser-smoke.js`
- `tools/local-first-transport-delete-browser-smoke.js`
- `tools/project-navigation-blockers-smoke.js`
- `tools/reports/preflight-1357-repair-20261119.md`
- `tools/script-versions.js`
- `tools/template-part-groups-smoke.js`

## Dowody

Komplet API jobs/run, 21 oryginalnych logów i lokalne logi/trace zachowano poza repozytorium w katalogu roboczym outputs/preflight-1357-20261119-11435f. Kluczowe pliki: jobs-initial.json, run-initial.json, <jobId>.log, transport-import-red/target.log, long-tmp-red/target.log, handover-red.txt, handover-green.log, local-shell-red.log, cold-start-proof-final.log, recovery-profiles-final.log, normal-signed-target.log, sync-ui-final.log, local-ui-final.log, normal-clean-final.log, acceptance-conflict-target.log, jobs-last.json. Nie publikowano pełnych trace ani profili.

Końcowe SHA pakietu należy odczytać z commita/raportu przekazania. Dokument nie wpisuje własnego hasha commita w jego zawartość.
