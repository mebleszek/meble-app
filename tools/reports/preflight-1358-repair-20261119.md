# Preflight #1358 — P0-B: trwała baza fixture przed SIGKILL (19.11.2026)

## USTALONE

- Repo: mebleszek/meble-app; PR #151 pozostaje bez zmian.
- Gałąź naprawcza: `fix/preflight-1358-p0b-20261119`.
- HEAD wejściowy: `15034994b7ed26490eda233d56ed244f1abc97c1`.
- BASE/main: `d91c48938febe800553def7ed17967d0ffdcfb0b`.
- [Run 44504335371 / Preflight #1358](https://github.com/mebleszek/meble-app/actions/runs/44504335371) zakończony: **77 zadań, 69 success, 6 failure, 2 skipped**. Pełna strona API jobs i komplet logów sześciu FAIL zachowane. Nie analizowano ponownie 21 historycznych przyczyn #1357.
- Trzy pierwotne FAIL, trzy agregaty zależne; brak dodatkowego pierwotnego FAIL w końcowych logach. Auto-merge i post-merge-verify zostały poprawnie pominięte.

| Job | ID | Pierwotna przyczyna / rozstrzygnięcie |
|---|---|---|
| firebase-p0b (room-quote) | 135492397682 | Restart po rzeczywistym SIGKILL: `preparing-source / LF_P0B_BINDING_UNCONFIRMED`. Niezapewniona trwałość starego RAW fixture w Web Storage; nie błąd kalkulatora ani CAS. |
| firebase-p0b (room-quote-staging) | 135492397470 | Ten sam brak trwałej bazy źródłowej przy restarcie po etapowaniu. Zachowano test tej samej rewizji, fragmentów, ACK i konkurencyjnego CAS. |
| firebase-p0b (normal-clean) | 135492397852 | Po szybkim SIGKILL świeżo ustawiona lokalna nazwa nie przetrwała: oczekiwano Telefon DEMO, otrzymano pusty opis. Samo przejęcie serwerowe nastąpiło; test nie miał utrwalonej konfiguracji początkowej. |
| firebase-current | 135493689366 | Agregat: firebase-p0b failure; pozostałe zależności przeszły. Nie jest czwartą przyczyną produkcyjną. |
| ci-summary | 135495038486 | Agregat odmówił pełnego PASS przez firebase-current. Nie zmieniono agregacji ani kryteriów. |
| final-status | 135495086113 | Poprawna końcowa odmowa z FIREBASE_STATUS=FAIL. Nie zmieniono logiki wydania. |

69 PASS dotyczy wyłącznie wejściowego SHA, nie nowego commita. Nie ponawiano tych grup ani Actions.

## Diagnoza i RED

W aktualnym kontrakcie IndexedDB jest trwałym autorytetem. P0-B może odzyskać brakującą wskazówkę Web Storage tylko przy potwierdzonych: właścicielu/wersji bindingu, czterech tabelach, aktualnym rejestrze, obrazie application i jego hashu, archiwum p0b-previous-registry/scope/hash oraz dokładnej zgodności aktualnego natywnego źródła z archived sourceRows. Brudna replika nie zastępuje tego dowodu.

1. CI jest RED: room-quote ~40 s, staging ~44 s, normal-clean ~35 s. Wszystkie błędy wystąpiły po restartach/SIGKILL, nie podczas pierwszego utworzenia rejestru.
2. Lokalny długi przebieg wejściowego SHA dał 2/2 PASS (~219 s). To nie obala szybkiego CI: rozróżniono czas utrwalenia samego setupu od zapisów domenowych.
3. Celowany rzeczywisty Chromium, poprawnie zainicjalizowany image/registry/archive, natywne trzy RAW i lokalna nazwa → natychmiastowy SIGKILL → restart: RAW i nazwa zniknęły z Web Storage, IndexedDB pozostało poprawne. `binding-crash-complete-source.log`:
   - schema: control/outbox/protected/replicas;
   - owner proof-owner, binding version 1, registry p0b-rooms-v1;
   - imageHash=true, archiveHash=true;
   - archive scope p0b-archives, kind p0b-previous-registry, registry p0b-rooms-v1;
   - changedSourceKeys: fc_investors_v1, fc_projects_v1, fc_company_v1;
   - raw=null, label=null, code=LF_P0B_BINDING_UNCONFIRMED.
4. **Pierwsza niespełniona kontrola przy poprawnych powyższych dowodach:** dokładne `equal(source, preserved.sourceRows projected to source keys)` w application-p0b-binding. Walidator słusznie odmawia po utracie części źródła. Pusta nazwa trafiająca do legalnej transakcji przejęcia ma tę samą przyczynę setupu Web Storage; nie oznacza automatycznie nieudanego przejęcia.
5. W historycznych artefaktach CI nie ma pełnego natywnego Web Storage po awarii, więc nie przypisuje się tamtym profilom konkretnej listy brakujących kluczy z lokalnej reprodukcji. Lista powyżej pochodzi z kontrolowanej reprodukcji. Pierwsze, niekompletne próby diagnostyczne bez obrazu application nie są dowodem tej kontroli; użyto wyłącznie końcowej reprodukcji z poprawnymi hashami i obrazem.

Nie zwiększono timeoutów, nie dodano retry ani sleep. Nie odtwarza się utraconego RAW automatycznie z archiwum i nie kasuje się żadnego źródła.

## WDROŻONE

- `p0b-fixture-baseline.mjs`: jeden jawny, uporządkowany restart **przygotowania fixture**, po zapisaniu starych danych i nazw, przed utworzeniem nowych testowanych inwestorów, pokoi, ofert i niewysłanych operacji. Używa istniejącego orderly exit z dowodem kodu zakończenia/cleanup.
- Przed/po tej granicy sprawdzane są rzeczywiste: natywny RAW, deviceId/instanceId, lokalna nazwa, archiwum, repliki, outbox i protected. Dopuszczone różnice to wyłącznie dotychczasowe techniczne pola wyboru widoku; pozostałe wiersze muszą pozostać identyczne.
- Późniejsze testowane SIGKILL pozostały SIGKILL. Po checkpointcie setupu nie wykonuje się łagodnego zamknięcia, które utrwalałoby badane niewysłane zmiany.
- Normal-clean zachowuje dawną asercję Telefon DEMO oraz dodaje dowód konkretnego deviceId, zwiększonego epoch, active=true i headRevision serwera po abortowanym lokalnym checkpointcie. Po SIGKILL sprawdza też oryginalny binding, RAW i rzeczywistą nazwę z API aplikacji.
- W istniejącym storage case: trwała baza → NOWY queued commit IDB → natychmiastowy SIGKILL → identyczna kolejka/dane. Brak RAW nadal daje LF_P0B_BINDING_UNCONFIRMED i pełny snapshot wszystkich tabel pozostaje bez zmian. Dawne negatywy właściciela, źródła, tombstone, archiwum i queued/inflight/uncertain pozostają.
- Diagnostyka testowa login: tylko przy LF_P0B_BINDING_UNCONFIRMED odczytuje schema/binding/marker, poprawność hashy, metadane archiwum i nazwy różniących się kluczy. Bez zapisu do IndexedDB lub Firebase.
- Kod produkcyjny, walidator bindingu, Rules, UI, kalkulator, ceny i manifest aplikacji pozostają bez zmian.

## Weryfikacja

| Kontrola | Wynik |
|---|---|
| Końcowa szybka reprodukcja utraty natywnej bazy | RED odtworzony: poprawne IDB, brak RAW/nazwy, właściwa odmowa; skrypt kończy 0 po potwierdzeniu tej oczekiwanej sytuacji |
| P0-B registry boundary retains… — realny Chromium | PASS 1/1, ~4 s; baza + nowe IDB + SIGKILL + negatywy bez częściowych zmian |
| Wspólny run normal-clean + room-quote + room-quote-staging, ten sam emulator, concurrency=1 | PASS 3/3, exit 0, ~346 s całość z setupem |
| Pokrycie obowiązkowego CI | PASS: 225 smoke / 251 execution units / 36 grup; 20 segmentów / 32 istniejące przypadki P0-B, bez pominięć |
| Pełny CI nowego SHA | CI_PENDING, nieuruchomiony |

Wspólny run obejmuje dotychczasowe negatywy CAS, obcego edytora/błędnego PIN-u, offline/reconnect, prawdziwy SIGKILL, utratę ACK, archiwizację niewysłanej kolejki, atomowość abortu, niezmienność historii i brak duplikacji. Końcowy log potwierdza wszystkie 3 PASS, w tym odmowę konkurencyjnego CAS bez receipt, zachowanie lokalnej historii i wznowienie tej samej rewizji bez podwójnej publikacji. Nie przypisano tego wyniku z innych PASS.

## Zmienione pliki

- tools/firebase-pilot/normal-application.cases.mjs — odczytowa diagnostyka odmowy.
- tools/firebase-pilot/p0b-fixture-baseline.mjs — trwałe przygotowanie fixture.
- tools/firebase-pilot/p0b-normal-application.test.mjs — integracja setupu i silniejsze dowody przejęcia.
- tools/firebase-pilot/p0b-registry-storage.test.mjs — szybka regresja baseline/IDB/SIGKILL/bezpiecznej odmowy.
- CURRENT_STATE.md, docs/plans/LOCAL_FIRST_ROADMAP.md, ten raport — wykonanie i ograniczenia.

## BRAKUJE → PROPONOWANE / ryzyka

CI_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED. Po celowanym PASS: jeden commit i zwykły push osobnej gałęzi, niezależna kontrola pakietu i dopiero osobna decyzja właściciela o próbie CI. PR #151 i jego gałąź nie są aktualizowane w tym zadaniu.

Nie zmieniono kontraktu trwałości Web Storage w aplikacji. Nowa konfiguracja nazwy urządzenia tuż przed awarią nadal podlega ograniczeniom tego magazynu; ten pakiet ustanawia trwałe warunki początkowe testu, nie obiecuje nowej gwarancji produkcyjnej ani nie migruje nazwy do IndexedDB. To samo dotyczy utworzenia starego RAW przed wejściem do P0-B. Brak dowodu źródła nadal musi bezpiecznie blokować startup; nie wolno go obchodzić, nawet gdy archiwum zawiera kopię. Dane biznesowe po ustaleniu autorytetu pozostają w IndexedDB.

Koszt lokalny: normal-clean ~126 s, room-quote ~99 s, staging ~120 s; cały wspólny run ~346 s. To przekracza docelowy budżet części scenariuszy i wymaga ponownego pomiaru w CI; nie zwiększano timeoutów ani nie ogłaszano FAIL za sam czas. Nie obiecuje się czasu szybszego runnera CI.

Testy w izolowanych profilach istniejącego Chromium WSL, sterowane z Windows; Firebase Emulator Standard DEMO, porty 19099/18080. Fizyczne urządzenia niebadane. Nie wykonano resetów danych użytkownika, migracji, Firebase LIVE, PR/Ready/merge, pełnego CI ani wydania.

Dowody poza repo: outputs/preflight-1358-20261119 — jobs.json (77), run.json, sześć plików <jobId>.log, red-both.log, binding-crash-complete-source.log i jego skrypt, green-baseline-storage.log, green-combined.log oraz wskazane w logach trace/screenshot/JSON. Pełne profile/trace nie są publikowane.

Końcowy HEAD znajduje się w commicie i raporcie przekazania; dokument nie umieszcza własnego hasha w zawartości.
