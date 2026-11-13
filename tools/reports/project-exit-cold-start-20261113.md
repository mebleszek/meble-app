# P0 — Wyjdź, autosave i zimny start projektu, 13.11.2026

Repo `mebleszek/meble-app`, gałąź `fix/project-exit-cold-start-20261113`.
BASE/main: `4aa88c1eaf746ef48c3a5bdd202ba06c8c75178f` (PR #134 już wydany; CI 21/21 i exact Pages PASS potwierdzone w poprzedniej próbie).
Jeden commit/push; wynikowy HEAD i świeże zdalne SHA/CLEAN w końcowym przekazaniu.

## Dowody i przyczyny

Telefon: „Anulowanie niepotwierdzone”, `SESSION_STORAGE_WRITE_FAILED`, brak trwałego payloadu sesji oraz późniejszy start `installing-authority / LF_ACTIVE_RAM_PROTECTED`. Sam raport READ_ONLY nie dowodzi przekroczenia quota. Brak starych fizycznych katalogów przy poprawnych katalogach LOCAL-FIRST nie dowodzi ich utraty; dane kanoniczne znajdują się w IndexedDB.

Celowany test na niezmienionym BASE (osobny tymczasowy worktree, te same nowe testy): Node: **4 odtworzone FAIL** w pierwszej reprodukcji. Potwierdzone: zapis autosave poza transakcją (`LF_ASYNC_TRANSACTION_REQUIRED`), timer po zakończeniu sesji tworzący aktywny nietrwały begin (`SESSION_STORAGE_WRITE_FAILED`), odmowa czystego Wyjdź po takim begin i odmowa wznowienia poprawnego online draft. Negatywy odmowy niepotwierdzonego zapisu i zachowania stanu po abort pozostały PASS. Dodatkowa asercja ponownego Wyjdź po abort wykryła następny FAIL w pierwszej poprawce (5/6 PASS), zanim uznano pakiet za gotowy. Chromium pełnego startu na BASE odtwarza **dokładnie `LF_ACTIVE_RAM_PROTECTED` w installing-authority** przy zapisanym widoku pomieszczenia bez draftu.

Przyczyny w kodzie:

1. `application-boot`: bez trwałej sesji tylko tryb localOnly neutralizował zapisany widok edytora. W trybie synchronizowanym legacy boot rozpoczynał edycję przed instalacją authority; authority prawidłowo odmawiała aktywnego, niepotwierdzonego RAM.
2. `project-autosave`: tylko localOnly przechodził przez applicationWrite. Włączona synchronizacja wracała do synchronicznego legacy save, co naruszało wymóg asynchronicznej transakcji; opóźniony timer mógł też rozpocząć sesję po jej zamknięciu.
3. `createApplicationActionBinding.cancel`: czysty aktywny, nietrwały initial begin trafiał bezpośrednio do commit; istniejąca kontrola canSave odmawiała, bo nie było trwałego dowodu. Pierwotny begin można ponowić wyłącznie istniejącym retryInitialBegin, z jego kontrolami baseline/właściciela, wewnątrz checkpointu draft.
4. Prywatna flaga initialBeginPending była kasowana po synchronicznym sukcesie begin, przed potwierdzeniem IDB. Rollback authority odtwarzał publiczny stan sesji, ale nie tę flagę. Pozostaje teraz zatrzaśnięta po pierwotnej odmowie do zakończenia sesji; nie dodano nowego uprawnienia ani pól do payloadu. Istniejące writeUnconfirmed i kontrole baseline/właściciela nadal odmawiają sprzeczności.
5. Dowód poprawnego draftu podczas pierwszego ładowania był ograniczony do localOnly. Ten sam dokładny warunek (bajty sesji z image, active, durable, canSave i isLoading) obowiązuje teraz także online; aktywny dokument poza ładowaniem i błędny dowód nadal odmawiają.

Poprawki nie obchodzą odmów. Niepewny zapis projektu nie pozwala utworzyć nowego baseline. Błąd IDB/CAS/zgody/owner pozostawia stan; nie ma automatycznego retry zapisu biznesowego. Ponowienie pierwotnego begin następuje wyłącznie po jawnym Wyjdź. Nie dodano recovery ani migracji. Nie odzyskujemy niezapisanych zmian, które istniały wyłącznie w RAM przed zamknięciem przeglądarki.

## Zakres

Cztery pliki produkcyjne: `sync/application-boot.mjs`, `sync/application-authority.mjs`, `js/app/investor/project-autosave.js`, `js/app/investor/session.js` (jedna linia logiki i komentarz; bez zwiększenia LOC monolitu). Wersje autosave i session spójne w index/dev/script-versions, odnowiony manifest offline. Nowe regresje `application-project-exit-smoke.js`, `project-exit-cold-start-browser-smoke.js` oraz rozszerzony istniejący pełny harness Chromium.

Bez zmian UI, definicji cenników/norm/materiałów, modeli/ID projektów, zamrożonych ofert, Auth, writer-fence, CAS, zasad pojedynczego edytora, protokołu synchronizacji, SW/aktualizatora. Bez resetowania telefonu, Firebase LIVE, PR/CI/wydania.

## Weryfikacja celowana (Codex, drzewo końcowego commita)

- Nowy Node: **6/6 PASS**; aktywny autosave, timer po commit, trwały draft online, odmowa corrupt/non-loading, niepotwierdzony projekt, Wyjdź i abort utrwalenia.
- Nowy Chromium: **PASS** — zapisany widok bez draftu, poprawny trwały draft online oraz faktyczny offline klik Wyjdź po legacy nieudanym begin, przerwanie natywnej transakcji IDB i udany drugi klik. Abort rzeczywiście uruchomiony (jawna asercja); RAM/snapshot/RAW i cztery magazyny zachowane, a sukces nie zmienia danych biznesowych, katalogów ani outbox. Pełny rzeczywisty boot/UI/authority/runtime, syntetyczne SDK i wyłącznie jednorazowe profile.
- Istniejące: `application-session-resume-smoke` PASS; `project-session-initial-retry-smoke` **12/12**; `project-session-begin-durability-smoke` **12/12**; `project-clean-session-navigation-smoke` **14/14**; `project-session-cancel-failure-safety-smoke` **10/10**; `investor-navigation-exit-smoke` **13/13 PASS**.
- `android-startup-auth-browser-smoke`: **PASS**, odmowy/brak internetu/zmiana konta oraz realny pełny start po 46 s/wygaśnięciu dowodu; RAM/formularz/RAW/katalogi/repliki/outbox zachowane.
- Składnia, dokładne wersje, manifest, diff: **PASS**. Nowe smoke są dokładnie raz w istniejącym planie CI: Node shard 4, Chromium shard 5. Bez zmian workflow i pełnego CI lokalnie.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING** po zakończeniu kontroli. Następnie niezależna kontrola i osobna zgoda na nowy HEAD/BASE przed wydaniem; wcześniejsza zgoda obejmowała wyłącznie PR #134.
