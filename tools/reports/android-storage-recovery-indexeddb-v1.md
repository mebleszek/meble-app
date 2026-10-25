# ANDROID STORAGE RECOVERY + IndexedDB v1 — 25.10.2026


## Korekta przed wydaniem — 25.10.2026

Wejściowy HEAD `80ade3639c62b9c5c7f6c187432b58d0ece0bc8b`, BASE/main `9c6ad2263850868e37c0cdb9098dfe6047a39260`, ta sama gałąź/worktree. Poniższa korekta aktualizuje historyczne CODE_READY i opis braku przycisku; nie nadaje zgody na wydanie lub dane telefonu.

1. **E — ścieżka przygotowania w panelu, wykonanie BLOCKED.** Dodano wyświetlenie dokładnego SHA-256/klucza, osobną zgodę i potwierdzenie USUŃ STARE ARCHIWUM; przed próbą sprawdzane są faza, źródło, autentyczny dowód pliku, niezmienność sesji/danych i świeży Auth. `writerReadiness()` nie uznaje checkboxa ani pustego wykazu Web Locks za dowód. Obecny LockManager nie enumeruje kart, stary dokument może nie trzymać locka; storage event nie dowodzi braku zapisu/ABA i nie wyklucza przyszłego writera. Brak istniejącego mechanizmu wyliczania i zatrzymania niekooperujących kontekstów oznacza `RECOVERY_WRITER_EXCLUSIVITY_UNPROVEN` **przed jakąkolwiek mutacją etapu E**. W UI nie ma wywołania `activate` na podstawie samego oświadczenia. Nie implementowano nieuzgodnionej zmiany Auth ani nowej infrastruktury przeglądarki dla pozornego PASS. To nie jest ukończenie wykonawczej ścieżki E. Przycisk istniejącego retryInitialBegin pozostaje dostępny tylko po ACTIVE i potwierdzonym zwolnieniu źródła; nie zastępuje wymaganego dowodu sesji.
2. **ACTIVE — naprawione.** Przy braku legacy `sourceHash` może pochodzić z zachowanego źródła migracji także w ACTIVE. To identyfikator pochodzenia, a nie skrót wszystkich aktualnych kopii. Manifest obejmuje pełny bieżący `archive.records`, revision/control/source i ich hash; każdy rekord jest sprawdzany przez decode/SHA/metadane przed eksportem. Weryfikacja pliku ponownie sprawdza aktualny IDB; nowa rewizja albo uszkodzony rekord odmawia. Jedyny dopuszczony między eksportem a weryfikacją przyrost to dokładna COPIED kopia RAW już zabezpieczonego w pliku; nie nowszy ACTIVE. Nigdy nie odtwarza się legacy klucza.
3. **Diagnostyka — naprawione.** Osobny opt-in sessionRecovery zachowuje Kopiuj raport oraz dodaje Tryb ratunkowy wyłącznie dla autoryzowanego READ_ONLY. Otwieranie panelu nadal ponownie sprawdza niemodyfikowalny owner gate. Odmowa nie daje przycisków odczytu danych.
4. **Pełna quota — potwierdzone STOP.** Natywny QuotaExceededError znacznika daje ARCHIVE_ROUTE_QUOTA; no-op/nieudany read-back daje ARCHIVE_ROUTE_UNCONFIRMED. Źródło, projekty, historia i sesja pozostają, removeItem nie jest wywołane. Journal SWITCH_PENDING zachowuje barierę. Nie dodano czyszczenia cache: nie wykazano, że jest konieczne na Pixelu, i brak zatwierdzonego dowodu odtwarzalności. Odmowa nie wyzwala cleanupu.

### Pliki korekty

- `BACKUP.md`
- `CURRENT_STATE.md`
- `dev_tests.html`
- `index.html`
- `js/app/shared/backup-archive-idb.js`
- `js/app/shared/storage-recovery-export.js`
- `js/app/ui/info-box.js`
- `js/app/ui/session-diagnostics.js`
- `js/app/ui/storage-recovery-panel.js`
- `tools/reports/android-storage-recovery-indexeddb-v1.md`
- `tools/script-versions.js`
- `tools/session-diagnostics-screen-smoke.js`
- `tools/storage-recovery-browser-smoke.js`
- `tools/storage-recovery-repair-browser-suite.js`
- `tools/storage-recovery-repair-smoke.js`

### Celowane regresje korekty i CI

Nowy `tools/storage-recovery-repair-smoke.js` uruchamia **wyłącznie sześć nowych grup** przez tryb --repair-only istniejącego runnera Chromium. Stare 18 grup i wcześniejsze smoke pozostają w CI; nie uruchamiano ich ponownie lokalnie. Nowe przypadki: diagnostyka→Copy/Recovery i odmowa Auth; pełne zgody E przy braku technicznej wyłączności i niezmienność RAW/RAM/IDB; quota/no-op/błąd odczytu znacznika; ACTIVE z nowymi kopiami i kontrolą faktycznego payloadu po odszyfrowaniu; korupcja SHA i stara rewizja pliku; eksport ACTIVE po restarcie. Niskopoziomowe testy `activate` zakładają kontrolowany jednorazowy profil, nie certyfikują wyłączności starej karty Pixela.

Nowy smoke jest automatycznie wymagany w bieżącym Preflight przez istniejące wykrywanie *-smoke.js. Dwa życia dokumentu, realny Chromium/IndexedDB, viewport393×852; całość HTTP aplikacji spełniana lokalnie, bez LIVE. Testy nie tworzą warunku pomijania przeglądarki. Zachowano oryginalny tryb/stare zestawy runnera i workflow. Wersje pięciu zmienionych skryptów są ścisłe i zgodne w obu HTML; centralny script-versions obejmuje również nowe zależności. Usunięto dawny twardy token info-box w kontroli ekranu na rzecz tej samej ścisłej mapy — nie luźnej obecności tekstu. Skorygowano rzeczywistą zależność CI ujawnioną przy zmianie wersji. Pełnego Preflightu ani emulatorów nie wykonywano.

**Faktycznie wykonane dla korekty:** nowy repair-only Chromium/IndexedDB **6/6 grup PASS** (dwa życia dokumentu, viewport393×852); składnia wszystkich **10** zmienionych/nowych JS PASS; ścisłe wersje obu HTML i kontrola kolejności PASS; diff --check PASS. Bieżący test graniczny CLOUD PASS z oczekiwanymi odmowami C42_SOURCE_CHANGED/C46C_DEPENDENCY_CHANGED oraz bez IO; cloud-ci-impact zgłosił wpływ bez aktualizacji manifestów. Pusty diff potwierdza brak zmian Auth, sesji, projektu, CLOUD/Firebase, historycznych manifestów i workflow. Poprzednich 18 grup, APP110, pełnego Preflightu ani emulatorów nie ponawiano lokalnie. Brak operacji na Pixelu.

**Wynik korekty:** `CODE_BLOCKED_WRITER_EXCLUSIVITY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED`. Nie wolno traktować tej gałęzi jako gotowego kompletnego pakietu odblokowania telefonu. Pozostałe trzy luki naprawione; domknięcie E wymaga uzgodnienia bezpiecznego mechanizmu koordynacji wszystkich kontekstów albo zmiany zakresu. Nie rekomendujemy USB/konsoli, odświeżenia niezabezpieczonej karty, resetu ani wywoływania API ręcznie. Nie uzyskano zgody na operacje danych lub LIVE.


## Zakres i stan

BASE/main potwierdzony przez GitHub: `9c6ad2263850868e37c0cdb9098dfe6047a39260`; drzewo identyczne z zakończonym PR #82 (`85a11e00e37e32a5111a0f1f2470f3732c8559ae`). Nowa gałąź `fix/android-storage-recovery-indexeddb-v1`, worktree `/workspace/android-storage-recovery`. Nie było rozpoczętej gałęzi poprzedniego ANDROID EMERGENCY RECOVERY v1; nie duplikowano jej implementacji. Pozostałe istniejące worktree zachowano bez zmian.

Właściciel wskazał największy klucz: `fc_data_backups_v1`, 3 317 250 z 5 217 379 jednostek UTF-16 (~63,6%). To archiwum, nie bieżący projekt. Rozmiar tekstu nie ustala quota przeglądarki. Pierwszy zakres dotyczy wyłącznie tego archiwum; nie migruje historii ofert, projektów, katalogów ani cenników.

**STORAGE RECOVERY / INDEXEDDB — PRIORYTET 1. CLOUD / CLOUD-4.6F / FIREBASE LIVE / rozwój SYNCHRONIZACJI — WSTRZYMANE do nowej decyzji.** Zachowano kod, manifesty, Rules, podpisy, CAS, wcześniejsze wyniki i przyszłe plany. Nie zmieniono bramek wydania ani Auth. Priorytet zapisano w CURRENT_STATE, ROADMAP, CLOUD_MIGRATION, CLOUD_DATA_REGISTER i BACKUP.

Status przygotowania: **CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**. Nie wykonano operacji na telefonie, migracji danych właściciela, usunięcia starego klucza, PR, wydania ani LIVE. HEAD przekazania znajduje się w raporcie końcowym/GitHubie, aby uniknąć samoodnoszącego SHA w commicie.

## Model i jeden aktywny magazyn

Nowa biznesowa baza **`meble-business-backups-v1`, version 1**. Nie otwiera i nie modyfikuje bazy profilu `meble-access-profile-v1` ani Firebase Auth.

| Store | Klucz | Zawartość |
|---|---|---|
| `records` | `id` | Dotychczasowe ID backupu; oryginalny fragment JSON elementu (`raw`), SHA-256 UTF-16LE, grupa app/test, pinned/safe-state i createdAtMs. Metadane są porównywane z RAW. Nie powstaje nowy identyfikator kopii. |
| `sources` | `sha256` | Jednorazowy, dokładny RAW całego historycznego archiwum. Zachowuje białe znaki, historyczne notacje liczb, nieznane pola i jednostki UTF-16; nie jest rosnącym bieżącym autorytetem. |
| `control` | `archive` | `schema:1`, phase COPIED/SWITCH_PENDING/ACTIVE, sourceHash, count, revision; po rozpoczęciu E także hash sprawdzonego pliku. |

Odczyt sprawdza dokładny schemat store, liczbę rekordów kontrolnych/źródeł, stan i integralność. Nieznana wersja/korupcja nie staje się pustą listą. Przy braku bazy sam odczyt nie tworzy jej przez `open()`. Potrzebna jest obsługa `indexedDB.databases()` i Web Locks; ich brak to jawny blocker.

Wszystkie nowe writery archiwum używają tego samego Web Lock (exclusive/ifAvailable) oraz sprawdzają źródło i rewizję. IDB potwierdza **transaction complete**, nie pojedynczy request success; następnie następuje niezależny read-back po zamknięciu/otwarciu połączenia. Nieudany insert/abort nie usuwa wcześniejszych rekordów. Nowy backup zapisuje tylko nowy/zmieniony rekord i mały stan kontrolny; nie przepisuje źródłowego archiwum ani wszystkich niezmienionych kopii.

Po E mały localStorage marker **`meble_backup_archive_backend_v1`** (`{"v":1,"backend":"indexeddb"}`) uniemożliwia cichy fallback po utracie IDB. Musi się zmieścić i przejść read-back **przed usunięciem źródła**. Jeśli nie, STOP: pozostają źródło i SWITCH_PENDING. Marker nie jest biznesowym snapshotem, nie nadaje uprawnień i nie jest przywracany przez standardowy import. Utrata obu magazynów nadal wymaga niezależnego pliku; IDB nie jest gwarancją przed ewikcją.

## Tryb ratunkowy i migracja A–D

Przycisk dodano wyłącznie do istniejących komunikatów sesji z opt-in `sessionDiagnostic`. Obok Diagnostyki sesji i OK pojawia się **Tryb ratunkowy**. Panel jest własnym nakładanym widokiem w tej samej karcie, bez nawigacji projektowej. Oferuje diagnostykę, bezpieczne podsumowanie archiwum, szyfrowany eksport, ponowny wybór pliku bez importu, kopiowanie do IDB, ocenę przygotowania i zamknięcie.

Diagnostyka/podgląd nie wykonują begin/commit/cancel, recovery, uiState writerów, backupu, lokalnych zapisów ani prób quota. Kopiowanie C zapisuje wyłącznie nową biznesową IDB. Panel i wszystkie operacje wymagają istniejącego niemodyfikowalnego `__FC_MAIN_ACCESS__.isValid()`, także po asynchronicznych etapach. Cofnięcie/wygaśnięcie dostępu daje STOP. Błędy panelu mają wyłącznie zamknięty techniczny kod, bez treści RAW/wyjątku.

A. Ścisły odczyt tablicy archiwum; brak filtrowania uszkodzonych elementów do pozornego sukcesu. Unikalne ID, snapshot v1 lub rozpoznany stary format bez kind/version, keys o wartościach string/null, znane typy metadanych. Nieznany format/wersja/duplikat blokuje kopiowanie, ale pozostaje dostępny w prywatnym RAW eksporcie.

B. Eksport ratunkowy: wszystkie biznesowe `fc_*` i pięć aliasów hardware z localStorage i sessionStorage, rozpoznana biznesowa IDB, znane dane RAM projektu/UI/dowodów sesji oraz kontrolki biznesowe. Bez tworzenia nowej kopii w localStorage. Manifest wskazuje obecność i wykluczenia, zakres CURRENT_DOCUMENT_BUSINESS_RAW, długości i SHA-256 każdego RAW, hash RAM/IDB i samego manifestu. Nierozpoznana domena, błąd, zmiana pomiaru albo brak inwentaryzacji blokują kompletność. Nie oznaczamy niedostępnego RAM innych kart ani całej sterty JS jako zabezpieczonych.

Plik jest szyfrowany Web Crypto **AES-256-GCM** (IV12/tag128, losowy salt16, PBKDF2-SHA256 310000 iteracji, minimum12 znaków hasła). Biznesowy RAW, plaintext i ich hashe używają jawnego UTF-16LE code units, bez strat samotnych surrogatów przez TextEncoder; SHA-256 całego pobranego kontenera liczymy z rzeczywistych bajtów UTF-8/ASCII. Hasło do KDF kodowane UTF-8. Tag GCM chroni zawartość, osobny SHA-256 identyfikuje dokładne bajty pobranego kontenera; odczyt przez ArrayBuffer odrzuca BOM i nieprawidłowe kodowanie zamiast cicho je normalizować. Losowe parametry i hasło nie są zapisywane w aplikacji. Sekrety biznesowe, np. ORS, mogą być w środku; plik/hasło pozostają prywatne, nie trafiają do GitHuba/czatu/chmury. Nie ma eksportu ani odtwarzania poświadczeń/grantów.

Przycisk weryfikacji odczytuje faktycznie ponownie wybrany plik, porównuje hash, odszyfrowuje, weryfikuje tag, manifest, zakres/RAW i aktualne źródło. Nie importuje żadnej wartości. Dowód jest prywatną WeakMap capability tej karty — fałszywy obiekt z identycznymi polami nie jest akceptowany. Po restarcie wymagana jest świeża kompletna kopia/ponowna weryfikacja, nie flaga localStorage.

C. W jednej transakcji zapis wszystkich rekordów, dokładnych fragmentów i całego źródła oraz journalu COPIED. Bez sanitizera, normalizacji, retencji lub kasowania. Weryfikacja po nowym otwarciu sprawdza liczbę, ID, RAW, SHA i metadane. Źródło nadal istnieje. Po COPIED zwykłe writery archiwum są zamrożone, aby przygotowanie nie unieważniało się samo.

D. Raportuje zgodność IDB, źródło, dowód pliku, liczbę kopii/grupy/ochronę i potencjalnie zwalniany rozmiar tekstu. Nie ogłasza odzyskania quota ani odblokowania edycji.

## Etap E — zaimplementowany handler, brak zgody na telefon

**Bieżący panel nie zawiera przycisku aktywowania/usuwania archiwum.** `backupArchive.activate(decision, receipt)` jest przygotowaniem przyszłego świadomego etapu, wywoływanym wyłącznie w testach syntetycznych. Nie jest instrukcją wykonywania kodu przez właściciela. Późniejsza czynność interfejsowa wymaga osobnej, konkretnej zgody.

Handler wymaga jednocześnie: świadomej decyzji dla dokładnego `fc_data_backups_v1` i sourceHash, potwierdzenia zamknięcia innych writerów, Web Lock, świeżego Auth, pełnej zgodności lokalnej kopii, autentycznego dowodu ponownie odczytanego niezależnego pliku i niezmienności biznesowego świadectwa przed operacją. Kolejność: trwały SWITCH_PENDING → ponowny odczyt i kontrola → mały marker z read-back → usunięcie dokładnego źródła → odczyt braku → trwały ACTIVE i read-back. Brak któregokolwiek dowodu blokuje działanie.

Nowy kod koordynuje swoje karty Web Lockiem. **Stare dokumenty sprzed tego protokołu nie respektują nowej blokady**; aplikacja nie dowodzi ich nieobecności samą nazwą locka. Potrzebne jest świadome rozstrzygnięcie innych kart i zabezpieczenie ich RAM. Jeśli pozostaje nierozpoznany writer, E pozostaje BLOCKED. Nie używa się automatycznych odświeżeń, wymuszonych logowań, konsoli, USB lub bookmarkletów.

| Przerwanie | Stan bezpieczny / następne działanie |
|---|---|
| Przed lub w transakcji kopiowania | Źródło bez zmian, przerwane żądania nie tworzą częściowo zatwierdzonego zbioru. Ponowna jawna próba C po kontroli. |
| Po COPIED / restart | Weryfikowalna kopia i źródło, żadnego automatycznego E/cleanup. |
| E przed usunięciem | SWITCH_PENDING + zachowane źródło; writery odmawiają. Nowa kontrola i dowód pliku przed jawnym wznowieniem. |
| E po usunięciu, przed ACTIVE | SWITCH_PENDING + marker + cały oryginalny RAW w IDB; bez automatycznego fallbacku lub przyjęcia pustego archiwum. Świeży plik obejmuje także źródło IDB, potem osobno zatwierdzone wznowienie. |
| ACTIVE, później stary writer | Obecność legacy klucza blokuje nowe zapisy; obcy RAW nie jest usuwany ani scalany. |
| Utrata/korupcja IDB po przełączeniu | Marker i walidacja blokują fallback. Potrzebna prywatna kopia i osobna procedura recovery. |

Dwa przebiegi odczytu nie tworzą transakcji między localStorage, sessionStorage, RAM i IDB i nie dowodzą braku ABA. Nie obiecujemy spójności wobec niekontrolowanego starego writera. Utrata hasła, niekompletny plik, nieznana domena lub nieudowodniona wyłączność pozostawiają blokadę.

## Zgodność API, retencja, sesja

Asynchroniczne metody istniejącego `FC.dataBackupStore`: create/ensure, list/groups/find/update/delete, restore/import, eksport pojedynczej kopii/payloadu, stats/prune. Użytkownicy: Ustawienia (`data-settings-backup-actions`, list, view i modal), osłona `test-data-safety` oraz istniejące regresje project/data-safety. Oczekują na Promise przed sukcesem/reloadem; widok listy odrzuca opóźniony wynik, jeśli użytkownik wrócił do innej sekcji. H.runSuite już oczekuje na Promise testu. Zwykły eksport bieżącego snapshotu pozostaje synchronicznym pobraniem bez zapisu kopii.

`dataBackupStorage.writeStore` odmawia starego zapisu. Synchroniczny kompaktor WYCENY nie może zmieniać archiwum zarządzanego asynchronicznie; inne reguły transportu, obliczeń, historii i cache nie są przebudowywane. Dotychczasowy sanitizer nie usuwa historycznych RAW przy okazji nowego zapisu — to konieczna ochrona kopii. Oryginalny format standardowego eksportu/importu zachowany.

Polityka: 7 dni, minimum10 programu, testowe10, najnowsze3 w każdej grupie oraz pinned/safe-state. Poprawiono ochronę przypiętych/bezpiecznych kopii testowych, które poprzednie slice mogło zgubić ponad limitem. Nie uruchamia się retencji podczas migracji. Po zwykłych zapisach przechowywane niezmienione rekordy nie są ponownie serializowane.

Osobny przycisk kontroli sesji po zatwierdzonym E najpierw wymaga ACTIVE i braku starego źródła, odczytuje diagnostykę, a następnie wywołuje jedynie istniejący `retryInitialBegin`. Musi otrzymać true i `session.durable:true`. Nie wykonuje commit/cancel ani nie rekonstruuje zamkniętego dowodu baseline. Po pełnym restarcie brak prywatnego świadectwa pierwszego begin nadal może uniemożliwić ponowienie; nie omijamy tej odmowy.

## Weryfikacja i odpowiedzialność CI

Celowane kontrole przygotowania:

- `node tools/storage-recovery-smoke.js`: 5 grup — jednostki UTF-16/hash i formaty, rzeczywiste Web Crypto/file re-read, Pixel-like pełny magazyn i odmowy, pinned/safe retencja, rzeczywisty protokół sesji przy quota i nowszej rewizji. Spies blokują wszelkie próby zmiany źródła.
- `node tools/storage-recovery-browser-smoke.js`: obowiązkowy rzeczywisty Chromium + IndexedDB, profil jednorazowy, mobilne 393×852, dwa rzeczywiste taby i pięć żyć dokumentu. Używa wyłącznie syntetycznego immutable access fixture; nie jest testem serwerowego Google Auth. Każdy request aplikacji spełniany lokalnie; nieznany ruch odmawia. Obejmuje abort quota/utratę Auth, migrację ~3,1M jednostek, zachowanie wszystkich RAW i ochrony kopii, pobranie pliku na dysk i ponowną weryfikację, jawne odmowy E, przerwania przed i po usunięciu, restarty, pojedynczy nowy rekord po aktywacji, legacy writer oraz utratę IDB. Mutacje w testach dotyczą wyłącznie profilu jednorazowego.
- `app-dev-smoke.js`: 110/110 — celowane sprawdzenie rejestracji po zmianie listy ładowania, nie cały Preflight.
- `wycena-quote-history-storage-maintenance-smoke.js`: celowana regresja dostępu synchronicznego kompaktora do archiwum. Oczekiwanie automatycznego skracania backupów zastąpiono dokładną odmową quota, niezmiennością całego RAW i poprawnym zapisem po syntetycznym ustąpieniu presji; ceny i pozostałe granice historii bez zmian. Test zachowuje kontrolę cache-bustingu.
- Składnia wszystkich zmienionych JS, kolejność ładowania, ścisłe wersje nowych/zmienionych skryptów produkcyjnych w obu HTML (testy dev-only w dev manifest), diff check.
- `cloud-ci-impact.js --base 9c6ad2263850868e37c0cdb9098dfe6047a39260 --json`: wpływ na historyczne zależności zgłoszony, manifesty niezmienione. Bieżący test graniczny nadal odmawia C42_SOURCE_CHANGED oraz C46C_DEPENDENCY_CHANGED propagowanego do D/E, bez IO/LIVE. Pełne historyczne PASS nie jest dowodem dla nowego HEAD.

**Rzeczywiście wykonane:** storage-recovery-smoke 5/5 grup PASS; Chromium/IndexedDB 18/18 grup PASS (w tym pobrany plik, dwie karty, pięć żyć dokumentu, viewport393×852); APP110/110 PASS; kolejność ładowania i ścisłe wersje obu manifestów PASS; bieżąca granica CLOUD PASS z właściwymi odmowami i bez IO. Pierwsze uruchomienie Chromium w domyślnym sandboxie zatrzymało się na setsockopt; właściwe celowane wykonanie uzyskało dostęp do lokalnego kanału testowego i zakończyło się PASS, bez zdalnego ruchu aplikacji. W trakcie reprodukcji poprawiono mapowanie pustego błędu GCM na RECOVERY_DECRYPT_FAILED oraz obsługę lokalnego favicon fixture; nie pomijano asercji. Błędy prób sprawdzania wersji wynikające z błędnego wymagania testów dev-only w index poprawiono w poleceniu kontrolnym, bez zmiany ładowania aplikacji. Pełnego Preflightu, całych emulatorów, Google Auth ani procesu wydania nie uruchamiano lokalnie. Dwa nowe `*-smoke.js` są automatycznie wykrywane w bieżącym kontekście Preflight; real-browser smoke wymaga Chromium i nie daje SKIP/PASS przy braku binarki. Aktualny workflow na ubuntu-latest i Node22 zachowano; istniejące kontrole historyczne/SDK/Rules i bramki auto-merge nadal obowiązują po osobnej zgodzie wydaniowej. Nowa gałąź nie pasuje do izolowanych push-triggerów innych prac. Pełny GitHub Actions i fizyczny Pixel: **CI_PENDING / PHONE_PENDING**.

## Bramka telefonu i następny ruch

Nowa wersja wymaga załadowania nowego dokumentu. **Nie ma dowodu zachowania RAM istniejącej karty Pixela przy odświeżeniu**; nie rekomendujemy jej przeładowania. Eksport z 17.10 nie zabezpiecza obecnego RAM i pomijanych RAW. Sam pakiet ani przyszły PASS CI nie upoważnia do migracji na urządzeniu. Należy osobno zatwierdzić wydanie wskazanego HEAD/BASE, rozstrzygnąć zabezpieczenie obecnego RAM i dopuszczenie załadowania wersji, a dopiero potem działania A–D na telefonie. E wymaga kolejnej decyzji dla dokładnego archiwum, świeżego niezależnego pliku i wyłączności writerów. Nie deklarujemy odzyskania telefonu.

Wieloletnia odporność innych domen i pełny LOCAL-FIRST pozostają dalszymi zakresami. IDB ma limity, może zostać usunięta, a lokalna kopia nie jest chmurą ani gotowym offline. Eksport ma jawne budżety pracy (16Mi jednostek na skanowany magazyn/konserwatywny RAM, 64MiB plaintext, 90MiB plik); ich przekroczenie daje BLOCKED, nie częściowy sukces.

## Końcowa kontrola zakresu

- Składnia **22 zmienionych/nowych JS PASS**, kolejność i ścisłe cache-busting PASS, diff --check PASS.
- Celowana regresja `wycena-quote-history-storage-maintenance-smoke.js` **PASS**; niezmienność pełnego RAW archiwum przy quota oraz zapis historii po ustąpieniu presji potwierdzone, pozostałe cztery kontrole zachowane.
- Odczyt GitHuba ponownie potwierdził niezmieniony BASE/main. Brak zmian AGENTS, kodu CLOUD/Auth, mechanizmu sesji, projektu, historycznych manifestów/Rules i workflow potwierdzono pustym diffem.
- Nowy browser smoke nie jest rzeczywistym testem właściciela/Google Auth ani testem całego startupu: to rzeczywiste komponenty i IDB na syntetycznym profilu. Fizyczny Pixel, pełny Preflight i dotychczasowe obowiązkowe zestawy GitHub Actions pozostają CI_PENDING/PHONE_PENDING.

### Dokładna lista zmienionych plików

- `BACKUP.md`
- `CLOUD_DATA_REGISTER.md`
- `CLOUD_MIGRATION.md`
- `CURRENT_STATE.md`
- `ROADMAP.md`
- `dev_tests.html`
- `index.html`
- `js/app/quote/quote-snapshot-storage-maintenance.js`
- `js/app/shared/backup-archive-format.js`
- `js/app/shared/backup-archive-idb.js`
- `js/app/shared/data-backup-policy.js`
- `js/app/shared/data-backup-storage.js`
- `js/app/shared/data-backup-store.js`
- `js/app/shared/storage-recovery-export.js`
- `js/app/ui/data-settings-backup-actions.js`
- `js/app/ui/data-settings-backup-list.js`
- `js/app/ui/data-settings-backup-view.js`
- `js/app/ui/data-settings-modal.js`
- `js/app/ui/info-box.js`
- `js/app/ui/storage-recovery-panel.js`
- `js/testing/data-safety/tests.js`
- `js/testing/project/tests.js`
- `js/testing/test-data-safety.js`
- `tools/app-dev-smoke-lib/file-list.js`
- `tools/index-load-groups.js`
- `tools/reports/android-storage-recovery-indexeddb-v1.md`
- `tools/storage-recovery-browser-smoke.js`
- `tools/storage-recovery-browser-suite.js`
- `tools/storage-recovery-smoke.js`
- `tools/wycena-quote-history-storage-maintenance-smoke.js`


## Pilna korekta pustej instalacji — 25.10.2026

Zakres: istniejąca gałąź `fix/android-storage-recovery-indexeddb-v1`; wejściowy HEAD `75930632cec1cc30039e8bc43bf425e6624dda64`, BASE/main `9c6ad2263850868e37c0cdb9098dfe6047a39260`. Najnowszy pomiar właściciela dotyczy pustego Pixela (0 inwestorów/projektów, 15 kluczy, 183,9 KiB, ramActive:false/durable:false), a nie wcześniejszego zapełnionego magazynu. Nie wykonywano resetu ani operacji na telefonie.

### Reprodukcja i naprawa

Rzeczywisty Chromium z pełnym index i syntetycznym uwierzytelnionym weryfikatorem: zero rekordów, nieaktywna sesja, lecz hasProjectDivergence i needsClosure zwracały true. Jedyna różnica względem normalize(null) to lazienka.settings.counterThickness: 1,8 zamiast 2. Bridge przy braku centralnego projektu ładuje aktualny DEFAULT, a migracje null mają historyczny default. Kliknięcie Projekty meblowe wywoływało begin bez rzeczywistego właściciela i poprawnie kończyło się SESSION_OWNER_MISSING. Starszy mini-fixture bez produkcyjnych migracji nie ujawniał tej rozbieżności; nowa regresja ładuje rzeczywiste migrate.js.

`hasProjectDivergence()` porównuje aktualny DEFAULT z RAM tylko po ścisłym potwierdzeniu pustego, nieprzypisanego kontekstu. Brak odczytu, malformed store, rekord inwestora/projektu, wskaźnik właściciela, legacy projekt lub trwały/RAM dowód sesji nie są traktowane jako pusta instalacja. Rzeczywista zmiana domyślnego RAM nadal wymaga właściciela i zatrzymuje nawigację; nie ma begin ani zapisu do pustej sesji podczas wejścia do menu/katalogu.

Pełny przebieg ujawnił też odmowę aktywacji pierwszego rzeczywiście utworzonego projektu: dotychczasowy guard odrzucał nieprzypisany RAM różniący się od nowego projektu metadanymi właściciela. Wrapper jawnego create pozyskuje teraz jednorazowy token tylko przed przejściem z pustego magazynu. Aktywacja wymaga niezmienionego domyślnego RAM, braku dowodów sesji, dokładnie jednego zapisanego inwestora i jego projektu oraz zgodności nowego projektu z przygotowanym źródłem. W formularzu dopuszcza wyłącznie ID dokładnego transient draft znanego UI, nigdy dowolny zapisany/stary ID. Istniejąca ogólna kontrola przełączania i aktywnej sesji pozostaje. Nie fabrykuje się właściciela: otrzymuje go wyłącznie rekord utworzony po świadomym Zapisz inwestora.

### Nowe dowody celowane

- `node tools/empty-installation-smoke.js`: **5/5 grup PASS**. Puste null i [] (bez begin/writes), realna niezapisana zmiana RAM i odmowa owner-missing, evidence sesji/stare wskazania/legacy/niepoprawny lub nieodczytywalny magazyn, prawdziwa aktywna sesja i konflikt właściciela bez utraty RAM/RAW, pierwsza aktywacja i odmowa użycia checkpointu po zmianie RAM/sesji/pojawieniu się drugiego właściciela.
- `node tools/empty-installation-browser-smoke.js`: **PASS**, rzeczywisty Chromium, jednorazowy pusty profil, realny pełny shell aplikacji i gate, lokalne syntetyczne odpowiedzi Auth/verifier, viewport 393×852. Dotykowe przejście do menu i katalogu bez tworzenia rekordów/sesji; pełny restart dokumentu; rzeczywisty formularz pierwszego inwestora z potwierdzeniem; rzeczywisty projekt i pomieszczenie; trwała sesja z prawidłowym właścicielem; zmiana wysokości pomieszczenia do 275 cm i Zapisz; potwierdzona wartość centralna i usunięty dowód zamkniętej sesji. Przechwycone wszystkie requesty aplikacji, brak zdalnego IO lub nieobsłużonych błędów. Nie jest to test produkcyjnego Google/telefonu.
- Nowe pliki kończą się `-smoke.js`, więc istniejąca enumeracja tools w Preflight uruchamia je w bieżącym kontekście. Rzeczywisty Chromium jest wymagany — brak binarki powoduje FAIL, nie SKIP. Workflow bez zmian.
- Wersje obu zmienionych modułów produkcyjnych ustawiono zgodnie na `20261025_empty_installation_v1` w index/dev_tests i dodano ścisłą kontrolę w istniejącym tools/script-versions.js. Nie zmieniono kolejności ani listy produkcyjnych modułów.

Pełny Preflight, emulatory i GitHub Actions nieuruchomione; pozostają **CI_PENDING**. Fizyczny Pixel **PHONE_PENDING**. Ta pilna korekta: **CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**. Nie rozwiązuje wcześniejszego **CODE_BLOCKED_WRITER_EXCLUSIVITY** etapu E archiwum. Brak PR, merge, Pages, operacji na telefonie, nowych migracji lub Firebase LIVE. CLOUD i synchronizacja pozostają wstrzymane; historycznych pinów nie aktualizowano.

Końcowa kontrola tej korekty: składnia pięciu zmienionych/dodanych JS PASS, git diff --check PASS, ścisłe wersje skryptów PASS, check-index-load-groups PASS. cloud-ci-impact --base 9c6ad2263850868e37c0cdb9098dfe6047a39260 wskazał nowe chronione zmiany index/runtime/patches; aktualny boundary smoke z odizolowanym, zweryfikowanym drzewem historycznym 306f90a4cfd8bcb4277aa8b4d140e911493ddd60 PASS przez dokładne odmowy CLOUD42_SOURCE_CHANGED i CLOUD46C_DEPENDENCY_CHANGED (C/D/E), bez IO. Nie modyfikowano manifestów, podpisów, Rules, workflow ani kodu chmury. GitHub ponownie potwierdził powyższy BASE i wejściowy HEAD gałęzi przed publikacją commita. Wyniki dotyczą tej celowanej korekty roboczej; nie są pełnym CI ani potwierdzeniem dla telefonu.

Pliki tej korekty (9): CURRENT_STATE.md; index.html; dev_tests.html; js/app/investor/investor-project-runtime.js; js/app/investor/investor-project-patches.js; tools/empty-installation-smoke.js; tools/empty-installation-browser-smoke.js; tools/script-versions.js; niniejszy raport. Poprzednia lista 30 plików opisuje wcześniejszy zakres pakietu.
