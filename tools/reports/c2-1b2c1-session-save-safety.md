# C2.1b.2c.1 — ochrona zapisu przed niepotwierdzoną sesją

Baza: `4cabe76b33d348ce442a7439d86f2e0203a67102`, aktualny main po PR #37. Gałąź: `c2-1b2c1-session-save-safety`.

Zakres: zabezpieczenie wspólnego zapisu i zakończenia sesji. Bez aktywacji projektowego PCV w UI, migracji, zmian kalkulacji, geometrii, cenników lub historii ofert.

## Przyczyna P1/P2/P3

Tracking zapisu `fc_projects_v1` aktualizował `session.expectedOwnerRaw` w RAM, a następnie próbował utrwalić rewizję w `fc_edit_session_v1`. Wynik drugiego zapisu był ignorowany. `canSaveProject()` sprawdzał tylko RAM-ową rewizję i aktualny rekord, a nie zgodność trwałego payloadu sesji.

API PCV wykrywało błąd trwałego payloadu i zachowywało stary shared RAM. Globalny Zapisz mógł jednak przyjąć ten RAM jako nową wersję projektu. Bezpośredni commit również przyjmował niepotwierdzony stan. Kolejny setter PCV dochodził do `RAM_DIVERGENCE`, bez wskazania przyczyny częściowego wykonania.

## Wspólna bramka

W `session.js` wydzielono prywatny, read-only `inspectDurableSession()`. Korzystają z niego `canSaveProject()`, `inspectNavigationState()` oraz modern Cancel. Nie ma wywołania `canSaveProject()` z inspektora, więc nie powstaje rekurencja.

Walidacja obejmuje:

- aktywność i trwałość sesji, istniejący snapshot i fizycznego właściciela;
- schemaVersion 4, projectId, roomId, startedAt, kontekst inwestora i pomieszczenia;
- dokładną zgodność snapshotów RAM/payloadu dla kluczy objętych sesją;
- zgodność obserwowanej rewizji zakresu pokoju z rewizją trwałego payloadu;
- oryginalny rekord właściciela i inwestora;
- ponowny odczyt wszystkich obserwowanych RAW, aby odrzucić zmianę podczas walidacji.

Nawigacja dodatkowo wymaga właściciela pokoju. W zwykłych roomless sesjach v4 nadal działa potwierdzony kontrakt całego rekordu. Nie rozszerzono zakresu rollbacku.

Utrata rewizji sesji lub potwierdzenia read-back uruchamia prywatną blokadę bieżącej instancji. Addytywne `session.markUnconfirmedProjectWrite()` potrafi wyłącznie ją ustawić i zgłosić odmowę; nie przyjmuje nowej rewizji, nie czyści blokady, nie zmienia snapshotu ani nie wykonuje zapisów. Blokada nie jest nowym magazynem ani kopią projektu.

## Chronione ścieżki

| Ścieżka | Zabezpieczenie |
|---|---|
| Globalny Zapisz w `actions-register.js` | Wspólna bramka przed `saveConfirmed`, potwierdzony wynik przed aktualizacją RAM i commit. Brak komunikatu „Projekt zapisany” przy częściowym wykonaniu. |
| Bezpośredni `session.commit()` | Wspólna bramka przed cleanupem, także gdy RAM błędnie oznacza sesję jako nieaktywną. |
| Nawigacja Zapisz/Anuluj/czyste przejście | Istniejące ścieżki używają teraz tego samego inspektora i chronionych save/commit/cancel. Nie zmieniono reguły `needsClosure()` ani dialogów. |
| `FC.project.saveConfirmed()` | Bramki przed centralnym zapisem i po potwierdzeniu store. Zapis projektu i potwierdzenie sesji są rozróżnione. |
| `FC.project.save()` oraz mirror/runtime inwestora | Zachowano API kompatybilności, ale faktyczny zapis przechodzi wspólną bramkę. Initial failed begin może ponowić zabezpieczenie przed nią. |
| `projectStore.writeAll/upsert/updateRecordConfirmed` | Zmiana rekordu właściciela wymaga wspólnego potwierdzenia. Bypass bridge'a nie pozwala zapisać starego RAM po awarii. Zapis B bez zmiany A pozostaje możliwy i nie może uprawnić niepotwierdzonej rewizji A. |
| `projectPcvOverrides.setEdges/clearEdges` | Aktywny, niepotwierdzony kontekst otrzymuje jawną odmowę przed oceną starego RAM. `projectSaved:true` i kod błędu są przekazywane z bridge'a. Własny failed read-back blokuje dalszy zapis. |
| Zapis parametrów/preferencji WYWIADU i bulk apply | Wspólny helper zachowuje kod i znacznik częściowego wykonania. Bulk przywraca swój RAM baseline, ale nie udaje, że centralnie nic nie zapisano. Kolejna operacja pozostaje zablokowana. |
| Bezpośredni Cancel | Modern sesja musi mieć dowód przed rollbackiem i cleanupem. Stan częściowy nie jest kompensowany przez automatyczne ani przypadkowe Cancel. |

Przeszukano bezpośrednich konsumentów commit/cancel, setterów centralnego store, bridge'a i repozytorium inwestora. Nie dodano nowej drogi zapisu. Niskopoziomowy `projectStore` potwierdza zapis centralny, a nie pełne zakończenie sesji; pełny sukces operacji wymaga bridge'a i potwierdzonego commit. Surowe `localStorage.setItem()` pozostaje niskopoziomową możliwością zapisu, nie autoryzowanym API zakończenia sesji. Nie instalowano ogólnego filtra wszystkich zapisów aplikacji.

## Wyniki i komunikaty

- **Failed begin:** bez mutacji projektu; pierwotny snapshot pozostaje w RAM. Retry zabezpiecza ten sam snapshot tylko wtedy, gdy zakres centralny nadal jest baseline i nie ma obcego/niezgodnego payloadu.
- **Failed central save:** `ok:false`, brak sukcesu, zachowany shared RAM i draft. Dotychczasowa obsługa błędu storage pozostaje dostępna.
- **Central save OK, session revision fail:** `ok:false`, `code:'SESSION_UNCONFIRMED'`, `projectSaved:true`. RAM nie zostaje przyjęty jako zatwierdzony. Store, commit, Cancel i przejście pozostają zablokowane.
- **Central write acknowledged, read-back fail:** `ok:false`, `code:'SAVE_UNCONFIRMED'`, `projectSaved:true`; wspólna blokada chroni także przypadek, w którym durable payload sam w sobie jest poprawny, ale RAM pozostał starszy.
- **Nowsza nieobserwowana wersja właściciela:** `PROJECT_WRITE_CONFLICT`, bez nadpisania rekordu. Nie jest uznawana za własną rewizję.
- **Pełny sukces:** istniejący confirmed central save, zgodny trwały payload, aktualizacja RAM; commit dopiero po pozytywnej bramce i potwierdzonym usunięciu sesji.

Komunikat częściowy korzysta z istniejącego infoBox:

> Dane projektu mogły zostać zapisane, ale nie potwierdzono sesji. Dalszy zapis został wstrzymany, aby chronić dane. Zachowano formularz i snapshot.

Zapis ustawień pokoju nie zastępuje tego ostrzeżenia komunikatem „Nie zapisano”. Bulk przekazuje `projectSaved:true` i ten sam sens komunikatu. Nie ma nowego systemu powiadomień ani automatycznego Cancel.

## Cleanup, kompatybilność i odzyskiwanie

Nie zmieniono formatu payloadu: nadal **schemaVersion 4**, te same klucze storage i oryginalny snapshot. Nie ma nowej trwałej intencji ani kopii projektu.

Zachowano bezpieczne ponowienie Cancel po udanym rollbacku i nieudanym cleanupie. Prywatny znacznik potwierdzonego rollbacku odróżnia tę ścieżkę od częściowego zapisu ustawień, który przypadkiem wrócił do baseline. Po restarcie dokładny baseline i niezmieniony trwały snapshot nadal pozwalają bezpiecznie dokończyć Cancel. Stare v2/v3 snapshoty zachowują istniejący baseline-only rollback: zmieniony lub nieustalony właściciel jest blokowany, cały kontener projektów nie jest przywracany.

Nie dodano automatycznego odzyskania P3. W tej samej instancji retry daje jawną odmowę `SESSION_UNCONFIRMED`, z zachowaniem draftu, snapshotu i centralnej wartości. Po restarcie brakująca trwała rewizja oznacza `PROJECT_WRITE_CONFLICT`; restart nie legalizuje nowej wersji i nie cofa jej automatycznie.

Jeśli utrata potwierdzenia dotyczyła tylko read-back, a durable payload nadal jednoznacznie potwierdza własny zakres, normalny restart może odczytać kanoniczny RAM i istniejący zgodny dowód. Test sprawdza taki przypadek bez przyjmowania dowolnej nowszej rewizji. Nie wprowadzono przycisku ani ślepego przeładowania danych w bieżącej instancji.

**Najmniejszy ewentualny następny kontrakt odzyskiwania utraconej rewizji:** trwały dowód konkretnej próby zapisu przed centralną mutacją, powiązany z właścicielem, pierwotnym snapshotem, poprzednią rewizją i dokładnym docelowym podpisem zakresu. Musi umożliwiać udowodnienie, że bieżący zakres jest wynikiem tej próby, oraz sprawdzenie niezapisanych zmian RAM przed jakąkolwiek jego synchronizacją. Może należeć do istniejącego mechanizmu sesji; nie wymaga nowego globalnego storage ani pełnej kopii projektu. Nie wdrożono go w tym PR, bo obecny payload zapisuje rewizję po fakcie i nie daje takiego dowodu po utracie zapisu. Przy braku dowodu zachowanie pozostaje fail-closed.

## Testy i zmiany fixture

Nowy `tools/project-session-unconfirmed-save-safety-smoke.js` używa izolowanego MemoryStorage i rzeczywistych modułów: **30/30 PASS**. Jest pozytywnym smoke automatycznie wykrywanym przez istniejący preflight. Nie zarejestrowano diagnostyki oczekującej błędu jako PASS.

Obejmuje P1/P2/P3 przez realne globalne akcje, saveConfirmed i commit; false/throw/no-op storage; failed begin; brak/uszkodzenie payloadu; snapshot i właściciela; restart; powrót do baseline; potwierdzony zapis z failed read-back; starszy RAM; inne pokoje/projekty; bezpośrednie store API; nawigację; room helper i realny bulk plan/apply; zdrowe Save/Cancel/retry/no-op; katalogi, cenniki, legacy i historię byte-for-byte.

Zmiany istniejących testów są celowe:

- Utrata RAM snapshotu nie uprawnia do usunięcia aktywnego trwałego payloadu. Asercje cleanupu zastąpiono **silniejszymi** asercjami zero writes i zachowania payloadu; pełny proof odtwarza restart.
- Niepotwierdzona rewizja nie może być cofana po samym ustąpieniu awarii storage. Test zachowuje centralne A/B i snapshot, zamiast oczekiwać utraty nowej wartości.
- Wstrzyknięcie konfliktu rollbacku przypięto do jego fazy `suspendTracking`, żeby dodatkowe odczyty bramki nie przesunęły awarii przed badaną operację. Zachowano odmowę i wszystkie asercje ochrony B.
- Dwa testy assetów sprawdzają ścisłą nową wersję zmienionych modułów, zamiast starego cache-bustingu; nie zmieniono ich asercji funkcjonalnych.

Bezpośrednie regresje przed ostatnim preflight: owner rollback **26/26**, failed Cancel **10/10**, begin durability **10/10**, confirmed save **5/5**, project-owned PCV **33/33**, effective project PCV **30/30**. Wielopomieszczeniowy rzeczywisty optimizer i WYCENA: **4/3/6 arkuszy**, osobne historie A/B/A+B i niezmienna oferta historyczna PASS.

Pierwszy preflight zakończył się 112/114 smoke: oba błędy dotyczyły literalnych wersji assetów po poprawce. Po aktualizacji wersji drugi preflight był PASS (114/114). Po znalezieniu i naprawieniu przekazywania komunikatu częściowego w room helper/bulk wykonano jeszcze końcowy pełny preflight; ostateczny wynik podano poniżej.

**Końcowy pełny preflight: PRE-FLIGHT PASS** — JS **519/519**, kolejność skryptów **317**, smoke **114/114**, APP **110/110**, dependency i storage audit PASS. Czas 72,802 s; log `/tmp/c2-1b2c1-preflight-final.log`. Nowy smoke **30/30**, `node --check` zmienionych/dodanych JS **13/13**, `git diff --check` PASS. Referencja 4/3/6 i dotychczasowe scenariusze session/project/material/quote/global-data są zielone.

## Zmienione pliki

- `js/app/investor/session.js` — wspólny dowód, odmowa zakończenia niepotwierdzonej sesji, zachowanie retry i cleanupu.
- `js/app/project/project-bridge.js` — przed/po save, rozróżnienie częściowego wykonania, blokada failed read-back.
- `js/app/project/project-store.js` — zamknięcie bypassu przez bezpośrednie zapisujące API store.
- `js/app/investor/investor-project-patches.js` — kolejność retry initial begin i wspólnej bramki bez zmiany API save.
- `js/app/project/project-pcv-overrides.js` — jawna odmowa retry i propagacja częściowego wyniku, bez zmiany flag/defaultów/metrów.
- `js/app/ui/actions-register.js` — brak błędnego komunikatu „nie zapisano” po częściowym wykonaniu; sukces nadal tylko po commit.
- `js/app/room-preferences/room-preferences-model.js`, `room-preferences-bulk-apply.js` — wyłącznie propagacja błędu/partial i komunikatu, bez zmiany modelu preferencji lub sposobu aplikowania.
- `index.html`, `dev_tests.html` — cache-busting ośmiu zmienionych modułów; kolejność ładowania bez zmian.
- Nowy smoke oraz cztery istniejące smoke wymienione wyżej — opisane scenariusze i literalne wersje assetów.
- Ten raport oraz zachowany, oznaczony jako historyczny raport analizy C2.1b.2c — dokumentacja decyzji i granicy następnych etapów.

## Pozostałe ryzyka / granice

- Projektowe PCV nadal nie jest aktywowane w UI. Integracja pełnego runnera, orchestratora WYCENY i edytora PCV pozostaje oddzielnymi etapami. R1/R2/W1/W2 z analizy bazowej nie są deklarowane jako naprawione.
- Globalne PCV/słoje nadal mają opisane ograniczenia własności. Nie migrowano, nie czyści się i nie importuje żadnego z trzech legacy store.
- API kompatybilności `FC.project.save()` nadal zwraca dane, a nie potwierdzenie; nie wolno traktować tego wyniku jako dowodu sukcesu. W chronionych ścieżkach używany jest `saveConfirmed`.
- LocalStorage nadal nie zapewnia atomowego compare-and-swap między kartami. Powtórne odczyty i blokada wykrywają testowane konflikty; nie są nową transakcją ani backendową atomowością.
- Przy utracie trwałej rewizji odzyskanie nie jest zgadywane. Użytkownik może pozostać z blokadą do diagnostyki/świadomego odzyskania. Jest to świadoma granica bezpieczeństwa tego PR.
- Nie zmieniono wzorów PCV, 10% zapasu, cen, geometrii, optymalizatora, zakresów ofert, historii ani retencji backupów. Dane użytkownika nie były używane w testach ani resetowane.
