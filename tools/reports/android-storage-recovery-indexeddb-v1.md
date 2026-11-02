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


## Domknięcie nowych backupów i anulowania COPIED — 25.10.2026

Wejściowy HEAD `263a75b30c160952eb3bb72221bc014d6139d190`; niezmieniona gałąź `fix/android-storage-recovery-indexeddb-v1`, BASE/main `9c6ad2263850868e37c0cdb9098dfe6047a39260`, potwierdzone przez GitHub. Zakres obejmuje wyłącznie dwa nowe wymagania właściciela, ich wersjonowanie/regresje i dokumentację. Nie ponawiano diagnozy SESSION_OWNER_MISSING ani zaliczonych regresji.

### Nowe archiwum — bez legacy fallbacku

Pierwszy zapis przy nieobecnym fc_data_backups_v1, journalu i markerze tworzy INITIALIZING (`origin:fresh`, source `[]`, count0, revision0) w atomowej strict transakcji sources/control. Odczyt po zamknięciu bazy, zapis i read-back małego routingu, CAS do ACTIVE, ponowny odczyt, dopiero potem transakcja pierwszego backupu. Bez automatycznych operacji przy samym odczycie lub starcie. Awaria pozostawia albo pustą bazę, albo pusty INITIALIZING do wznowienia przy jawnym zapisie, albo ACTIVE bez niepotwierdzonego rekordu. Potwierdzony marker nie jest ponownie zapisywany przy wznowieniu. Późniejsze rekordy zapisuje dotychczasowa metoda atomowa mutate; stare RAW nie są ponownie serializowane. Brak IDB przy markerze lub obcy legacy writer odmawiają bez odtwarzania starego klucza. Quota/odmowa Auth nigdy nie zaliczają backupu. INIT nie jest wznowieniem SWITCH_PENDING i nie usuwa danych historycznych.

### COPIED — wybrana ścieżka bezstratnego anulowania

API cancelCopy(decision) oraz przycisk „Anuluj przygotowanie migracji — zachowaj obie kopie”. Decyzja zawiera dokładny hash i revision journalu, jest chroniona istniejącym Auth oraz wspólnym Web Lock. Sprawdzenie kopii odwołuje się do zachowanego oryginalnego RAW IDB, a źródło aktualne musi być poprawne i niezmienne w trakcie operacji. COPIED → CANCELLED zapisuje atomowo wyłącznie metadane sterujące. Nie usuwa ani nie przepisuje sources/records/localStorage/RAM. Obsługuje też poprawne źródło zmienione wcześniej przez stary writer: aktualne dane pozostają autorytetem, a oryginalny dowód zostaje w IDB. Rutynowe backupy znów używają starego aktywnego archiwum i mogą uczciwie odmówić przy realnej quota. Po restarcie CANCELLED nie wraca do zamrożenia. Snapshot historyczny jest dostępny w pełnym prywatnym eksporcie wraz z bieżącym źródłem. Nie nadpisujemy go ponownym copy zmienionego źródła — SOURCE_CHANGED pozostaje. To realizuje wymaganie anulowania; nie dodano wymiany historycznych dowodów. SWITCH_PENDING/ACTIVE nie mogą skorzystać z anulowania.

Etap E w panelu zachowano z niezmienionym jawnym STOP RECOVERY_WRITER_EXCLUSIVITY_UNPROVEN. Lock serialize'uje kooperujące nowe karty, ale nie dowodzi nieobecności starych writerów; nie udajemy tego dowodu. Nie uruchomiono E, migracji ani usuwania danych właściciela.

### Celowana weryfikacja nowych luk

`node tools/storage-recovery-lifecycle-smoke.js`: **11 grup PASS** w rzeczywistym Chromium/IndexedDB, pięć żyć dokumentu, dwie rzeczywiste karty, mobilne 393×852, syntetyczne dane i access fixture. Nowy tryb --lifecycle-only istniejącego runnera nie uruchamia wcześniejszych zestawów. Pokrywa:

- atomowy abort inicjalizacji na IDB quota, odmowę Auth, pełny localStorage/no-op/read-back markera, prywatny eksport częściowej inicjalizacji;
- restart INITIALIZING, quota pierwszego rekordu bez fałszywego sukcesu, pierwszy i kolejny backup bez choćby próby zapisu legacy lub usunięcia klucza, zachowanie wcześniejszego RAW i zapis wyłącznie nowego rekordu;
- quota/cofnięcie Auth przy mutacji bez zmiany wcześniejszej rewizji, restart ACTIVE, obcy legacy writer i utraconą IDB bez fallbacku;
- zamrożony COPIED, nieaktualną decyzję, brak/nieznane źródło, abort quota/cofnięcie Auth podczas anulowania, zmianę legacy między odczytem i CAS bez nadpisania nowszej wartości;
- jawny przycisk anulowania po restarcie COPIED ze zmienionym wcześniej źródłem, brak usunięcia i brak zmian sesji/RAM/pozostałych RAW, oryginalne metadane i RAW, pełny prywatny eksport obu stanów;
- restart CANCELLED i nadal działające zwykłe backupy, brak niejawnej aktywacji/destrukcyjnego E, busy w innej rzeczywistej karcie dla inicjalizacji i anulowania.

Jedyną adaptacją wcześniejszego zestawu jest jawny seed `fc_data_backups_v1:[]` w teście historycznego API LEGACY: test ma rzeczywiście badać legacy, skoro brak klucza ma teraz nowy kontrakt IDB. Nie usunięto asercji. Poprawiono także barierę przeładowania runnera, żeby potwierdzał nowe życie dokumentu zamiast dawnego już gotowego callbacku.

Nowy *-smoke.js jest automatycznie wykonywany w bieżącym kontekście tools/preflight.js, z wymaganym rzeczywistym Chromium (brak binarki FAIL, nie SKIP). Dotychczasowe zestawy pozostają podłączone; workflow bez zmian. Pełnego Preflightu, poprzednich regresji i emulatorów nie uruchamiano. GitHub Actions i fizyczny telefon pozostają CI_PENDING / PHONE_PENDING.

**Gotowy zakres tych dwóch luk: CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED. Destrukcyjna migracja historyczna E: BLOCKED_WRITER_EXCLUSIVITY.** Brak PR, merge, Pages, Firebase LIVE oraz operacji na danych właściciela. Nie deklarujemy pełnego odblokowania historycznej instalacji ani testu Pixela.

Końcowa korekta tej samej ścieżki: odczyt INITIALIZING zwraca uczciwą pustą listę wyłącznie dla ściśle zwalidowanego journalu count0/records0/source[]; nie uruchamia żadnej mutacji. Dzięki temu także istniejące ensureCurrentStateBackup, które najpierw sprawdza listę, dochodzi do jawnego retry zapisu po restarcie. Test pierwszego rekordu/quota wykonuje rzeczywiste ensureCurrentStateBackup; nowa regresja sprawdza brak automatycznego wznowienia podczas listowania.

Kontrole końcowe tej korekty: składnia 8 zmienionych/dodanych JS PASS, ścisły wspólny cache-busting trzech modułów w index/dev_tests PASS, git diff --check PASS. tools/cloud-ci-impact.js --base 9c6ad2263850868e37c0cdb9098dfe6047a39260 potwierdził wpływ index/backup-archive-idb/storage-recovery-export/storage-recovery-panel na historyczne CLOUD42_SOURCE_CHANGED; historycznych pinów, manifestów, Rules, Auth, sesji ani workflow nie zmieniono. Nie ponawiano uprzednio zaliczonych testów granicznych CLOUD — wymagany przebieg dla nowego HEAD pozostaje CI_PENDING. Przegląd bieżącego Preflight potwierdził automatyczne podłączenie nowego smoke, nie jest to wykonanie GitHub Actions.

Pliki korekty (13): BACKUP.md; CURRENT_STATE.md; index.html; dev_tests.html; js/app/shared/backup-archive-idb.js; js/app/shared/storage-recovery-export.js; js/app/ui/storage-recovery-panel.js; tools/script-versions.js; tools/storage-recovery-browser-smoke.js; tools/storage-recovery-browser-suite.js; tools/storage-recovery-lifecycle-browser-suite.js; tools/storage-recovery-lifecycle-smoke.js; niniejszy raport. Inne obszary istniejącego pakietu zachowano.

## Backup LOCAL-FIRST i prywatny plan globals — 02.11.2026

Zakres nowego pakietu: `feat/global-rescue-plan-20261102`, BASE/main **`1f1cb017a818c3bcebc059c8d8d36083da10278d`**, potwierdzony świeżym `git fetch origin main`. HEAD jest jednym końcowym commitem zawierającym ten wpis; pełny SHA w przekazaniu. Obowiązują **CODE_READY / CI_PENDING / BACKUP_PENDING / REPAIR_BLOCKED**. To backend odczytu/kopii i plan, bez implementacji naprawy, uruchomienia UI ani zgody na WRITE. Poniższy opis nie zastępuje historii wcześniejszego eksportu ani kanonicznego CURRENT_STATE.

### Potwierdzone dane wejściowe i granica wiedzy

Właściciel przekazał fizyczny raport Androida: materials/fc_sheet_materials_v1 ↔ fc_materials_v1 **INVALID_SCHEMA / GLOBAL_REQUIRED_FIELD**; labor/fc_quote_rates_v1 ↔ fc_services_v1 **DIFFERENT / GLOBAL_ALIAS_CONFLICT**. Pozostałe pięć par **ONE_MISSING**, co jest dopuszczalnym pojedynczym źródłem. Stock, programDefaults, company i businessCosts **SOURCE_MISSING**. Wszystkie biznesowe RAW oryginałów localStorage są równe istniejącemu obrazowi LOCAL-FIRST. Ta równość warstw nie oznacza równości wewnętrznych aliasów. Initial-global-revision blokuje logowanie.

Nie posiadamy prywatnej kopii właściciela. Nie znamy konkretnych brakujących pól/rekordów, stawek ani definicji labor; nie wpisujemy ich do technicznego raportu. Wymagane pola schematu materiału to id/name/materialType/price/priceUnit, ale nie wolno z tego wnioskować, którego z nich rzeczywiście brakuje na telefonie. Wyłącznie lokalny, prywatny analizator ustali brakujące pola każdego źródła/rekordu. Nie dokonano wyboru katalogu, uzupełnień fabrykami ani WRITE.

### Odrębny odczyt i protokół pliku

Nowe `sync/local-first-rescue-{snapshot,state,ram,file,analysis}.mjs` nie rejestrują się w startupie, runtime, diagnostyce ani UI. `createLocalFirstRescue(context)` wymaga prywatnego kontekstu od uprawnionej integracji: window, zaufany ownerUid/name, oryginalny boot.readNative, bieżący authorize/assertQuiescent, produkcyjny zweryfikowany release oraz odczyt znanego RAM. Domyślny readCurrentBusinessRam odczytuje globalne projectData/uiState, znane dowody FC.session i wartości kontrolek biznesowych; nie inicjalizuje danych. Nieznany/niedostępny RAM lub niewspierane wartości blokują przygotowanie pełnej kopii. RAM innych kart i cała sterta JS nigdy nie są deklarowane jako zabezpieczone.

Odczyt wymaga niemodyfikowalnego, aktualnego `__FC_MAIN_ACCESS__`, potwierdzonego właściciela, poprawnego receipt, zgodnego binding i źródłowego SHA oraz integralności obrazu/rekordów/ACK. Produkcja wymaga autentycznej capability release powiązanej z właścicielem, nazwą, oknem i activationId. Jedyny wyjątek służy istniejącym testom localhost/127.0.0.1 z nazwą meble-lf-test-*. Nie ma ogólnego przełącznika obchodzącego bramki. `authorize` musi w przyszłej integracji potwierdzać rzeczywistą tożsamość, a `assertQuiescent` rzeczywiste zatrzymanie aktywnych operacji; oświadczenie właściciela ani funkcja bez kontroli nie jest dowodem.

Przed i po odczycie używany jest istniejący readonly protokół VERIFY_APPLICATION_AUTHORITY, bez modyfikacji SW/fence. Dodatkowy klient powoduje RESCUE_OTHER_CLIENT. Inventory musi jednoznacznie wskazać istniejącą bazę v1; nieznana baza oznacza STOP, znane bazy Auth są pomijane bez ich otwierania. Nie tworzymy bazy w celu sprawdzenia: upgradeneeded jest abortowane, binding odczytywany przed pobraniem rekordów; wyłącznie transakcje readonly. Pełne dwa pomiary baz, źródeł, sessionStorage i RAM muszą być zgodne; gate jest sprawdzany również po await. Limit pojedynczego snapshotu 15 s zamyka połączenia/abortuje odczyty, a przekroczenie rozmiaru odmawia zamiast obcinać dane. Limity: 8 Mi jednostek RAW na każdy Web Storage, 250 tys. węzłów i konserwatywny budżet 32 Mi jednostek serializacji, plaintext do 64 MiB, plik do 90 MiB. To granice backendu, nie dowód pomieszczenia realnego telefonu w RAM; wyczerpanie zasobów wymaga STOP.

Kopia obejmuje:

- Wszystkie obecne biznesowe fc_* i pięć historycznych hardwareSuppliers/hardwareSettings/hardwareCategories/hardwareTypes/hardwareTechnicalParams z **fizycznych** oryginałów, receipt i marker archiwum. Nie czyta podstawionego obrazu przez wirtualne localStorage.getItem. Chroni projekty, inwestorów, katalogi/cenniki, zamienniki, drafty, historię i kopie znajdujące się w tych magazynach. Nieznany inny klucz powoduje odmowę, nie ciche pominięcie. RAW zachowuje code units, w tym samotne surrogaty i historyczne niepoprawne JSON.
- Wszystkie rekordy control, protected, replicas i outbox z pełnymi polami, wersjami, JSON/hash, expected/receipt i fazami queued/inflight/uncertain/verified/blocked/conflict. Nie retry'uje operacji i nie zmienia faz; sprawdza integralność oraz obecność protected dla outboxu.
- Istniejące archiwum meble-business-backups-v1: całe control/records/sources, źródłowy RAW, bieżącą rewizję i rekordy. Kontroluje kontrakty faz/markera/count/SHA/decode; dla kopii przed ACTIVE również dokładne fragmenty historycznego źródła. Nie inicjalizuje archiwum, nie przełącza trasy, nie migruje.
- Dostępne biznesowe sessionStorage i znane niezapisane dane bieżącego dokumentu. Poświadczenia Auth i znane lokalne tokeny/granty nie są biznesowym backupem; pozostają wykluczone. Inne karty/RAM/cloud/odtwarzanie autoryzacji są jawnie poza gwarancją.

Rozszerzenie `storage-recovery-export.js` dodaje tylko oddzielny privateCodec oparty na istniejących funkcjach AES-256-GCM/PBKDF2-SHA256 310000, salt16/IV12/tag128 oraz UTF-16LE. Osobne kind i AAD `meble-app-local-first-rescue-v1` zapobiegają pomyleniu protokołów. Dotychczasowe prepare/verify/download/readFile oraz stare inventory pozostają niezmienione — **stary eksport nadal odmawia dla LOCAL-FIRST**, co ma nową asercję regresyjną. Hasło, plaintext i szczegóły nie są logowane ani przesyłane. Plik może zawierać prywatne sekrety biznesowe wewnątrz szyfrogramu; nie wolno publikować pliku lub hasła. Brak backendu sieciowego, uploadu, importu, restore, migracji czy synchronizacji.

### BACKUP_PASS wymaga rzeczywistego pliku

1. prepare(password) robi snapshot, manifest integralności każdego RAW i rekordu, RAM i całego zestawu, szyfruje, ponownie sprawdza źródła i zwraca niepodrabialny token **BACKUP_PENDING**. Token ujawnia wyłącznie SHA zaszyfrowanego pliku, nie plaintext.
2. download(token) ponownie sprawdza aktualność i uruchamia pobranie `meble-app-local-first-rescue.encrypted.json`. Nadal **BACKUP_PENDING**. Brak miejsca/anulowanie/brak ukończenia nie jest sukcesem, nawet jeśli a.click nie zgłosi wyjątku.
3. verifySelection(input,event,password,token) akceptuje tylko podłączony natywny input[type=file], rzeczywisty zaufany event change i natywny FileList. Odczytuje wybrany File przez istniejący readFile/ArrayBuffer, weryfikuje bajtowy SHA kontenera, GCM/hasło, manifest i wszystkie zabezpieczone wartości oraz wykonuje świeży bezpieczny pomiar. Fałszywy obiekt, Blob z przygotowania, dispatchEvent lub samo rozpoczęcie pobierania nie daje dowodu. Zmiana bieżących trwałych danych oznacza STOP/RESCUE_SOURCE_CHANGED.
4. Dopiero plik identyczny z przygotowanym zestawem i nadal zgodny ze wszystkimi źródłami bieżącego dokumentu daje prywatną capability **BACKUP_PASS** w WeakMap. Odczyt/odszyfrowanie pliku nie zapisuje niczego do aplikacji.
5. Ponowny natywny wybór pliku po restarcie może działać bez tokenu przygotowania. Jeśli trwałe źródła pasują, lecz zaginął/zmienił się RAM lub sessionStorage, wynik **FILE_VERIFIED_STALE / completeWithinScope:false** daje wgląd do zabezpieczonego dawnego zestawu; nie jest pełną aktualną kopią ani zgodą na naprawę. Brak RAM blokuje przygotowanie nowego pełnego pliku.

W technicznym summary występują jedynie zamknięte statusy i flagi zakresu; prywatne analyzePrivate/simulate wymagają autentycznego dowodu pliku oraz aktualnego gate. Nie są wywoływane przez istniejące Kopiuj raport. Dane prywatne nigdy nie powinny trafiać do anonimowego raportu, logów, CI ani ChatGPT.

### Prywatne różnice i deterministyczny plan bez wykonania

Analizator pracuje na danych zweryfikowanego pliku, oddzielnie dla oryginałów i aktywnego obrazu; dodatkowo porównuje obie warstwy. Zachowuje cały RAW/rekordy i wszystkie nieznane pola. Dla materiałów wskazuje per źródło/per indeks brakujące wymagane pola, ID, kod schematu, jednostki w istniejących polach, ceny i historyczne akcesoria. Nie traktuje mieszanego katalogu jako czystego płytowego. Zgodność semantyczna, RAW, obecność źródła i aktualny schemat są odrębnymi ocenami. Rekordy bez ID lub z duplikatem wymagają decyzji; nie są wyrzucane ani dopasowywane arbitralnie po nazwie.

Dwukierunkowe porównanie materiałów i labor wykazuje rekordy wyłączne po lewej/prawej, duplikaty/nieidentyfikowalne rekordy, kolejność oraz różnice wszystkich własności i struktur zagnieżdżonych, w tym cen, norm, quantity modes, progów i definicji czynności. Labor osobno sprawdza schematy rekordów, kody stawek godzinowych i nierozwiązane referencje. Żadnego zaokrąglania, defaultów lub wyboru najnowszego/najdroższego katalogu. Oryginalne zapisy liczb pozostają w RAW; przyszłe decyzje nie mogą polegać wyłącznie na projekcji JSON Number przy historycznych formatach/utracie precyzji.

Dla wszystkich 14 domen wykorzystywana jest istniejąca diagnostyka i walidatory/dependency closure — również sprzęt, dostawcy, ustawienia i źródła wyceny. Pięć prawidłowych fallbacków jest oznaczane jako OPTIONAL_ALIAS_ABSENT, cztery całkowite braki jako CONTROLLED_INITIALIZATION_REQUIRED, a schematy/formaty/referencje osobno. Plan zawiera decyzje schematów, właściciela, inicjalizacji oraz walidacji dla **obu** warstw. Nie ukrywa błędu danych pod brakiem źródła.

simulate(receipt,explicitCandidate) przyjmuje wyłącznie jawnie przygotowany, kompletny zestaw 14 domen i wywołuje pełne istniejące validateBundle(). Nie buduje kandydata z konfliktujących aliasów ani fabryk. Nie usuwa nieznanych pól; aktualny kontrakt może je odrzucić — konieczna jest wówczas kontrolowana kompatybilność, nie utrata informacji. Wynik VALIDATION_ONLY zawsze ma writeApproved:false; zależności materiałów magazynu/defaults wymagające runtime nadal blokują dowód równoważnej WYCENY. Nie ma apply/execute/restore ani wywołania completeMissingApplicationGlobals().

Wymagana kolejność przyszłej naprawy (obecnie **REPAIR_BLOCKED**):

1. Wykonać i prywatnie niezależnie zweryfikować kompletny plik właściciela przy niezmienionych źródłach i znanym RAM. Utrwalić bazowy receipt/binding/release, image version/hash i dokładny stan całego outboxu. Dowód syntetyczny nie zastępuje tego kroku.
2. Zestawić jawny, lokalny rejestr decyzji dla każdego brakującego/niepoprawnego pola materiału i każdego historycznego formatu/akcesorium. Nie odgadywać priceUnit/materialType/ID na podstawie nazwy. Rozszerzenie zgodności schematu musi zachować stare RAW i pola; jeśli brakuje jednoznacznej informacji — decyzja właściciela.
3. Dla labor i każdej innej sprzecznej pary właściciel rozstrzyga każdy konflikt rekordu/pola/ceny/ID/ref. Rekordy unikalne, historyczne pola, zamienniki i indywidualne stawki muszą mieć jawne miejsce w docelowym modelu lub bezstratnym chronionym obrazie. Nie wykonujemy automatycznego merge, nadpisania aliasu ani normalizacji. Zbieżność aliasów po naprawie musi być dowiedziona, nie zadeklarowana.
4. Wyłącznie dla potwierdzonych czterech całkowitych braków zatwierdzić konkretne wartości/fabryki i ich zależności. Missing nie oznacza zgody na puste []/{} lub domyślne koszty. Nie inicjalizować domeny, która ma poprawny pojedynczy fallback. Zatwierdzić kompletny jawny kandydat i pełne validateBundle + runtime resolution + porównanie WYCENY/reference/ID/stawek/zamienników. Sama walidacja schematu nie dowodzi bezstratności.
5. Osobny pakiet WRITE musi wykazać bieżący owner/gate/release, jednego edytora, brak innych writerów i zatrzymany scheduler/edycję bez utraty RAM. Zachować istniejący writer-fence. Dla inflight/uncertain niezależnie ustalić stan ACK bez retry i bez czyszczenia kolejki; nierozstrzygnięte ACK blokuje naprawę. Nie wymuszać Auth/fatal ani przejęcia sesji.
6. Zaprojektować atomowe zatwierdzenie **całego** obrazu/aplikacji i powiązanego outbox/protected z CAS na dokładną wersję/hash/receipt, z niezmienionymi fizycznymi oryginałami. localStorage i IDB nie tworzą wspólnej transakcji: nie udawać atomowości dwóch magazynów. Ewentualna przyszła zmiana również oryginałów wymaga osobno zatwierdzonego, odpornego na przerwanie journalu i kolejności recovery, bez pół-potwierdzonych aliasów. Brak takiego dowodu = STOP.
7. Na syntetycznych odpowiednikach wykazać abort quota/CAS/cofnięcia Auth i awarię w każdym punkcie granicznym; restart, offline, zachowanie ID/RAW/nieznanych pól/wszystkich cen oraz brak wysłania starej kolejki. Plan rollbacku musi zachowywać oryginały i chroniony preimage. Nie cofać automatycznie potwierdzonego ACK i nie odtwarzać starego outboxu powodującego powtórny WRITE. Po restarcie read-back/pełna walidacja/zgodność aplikacji muszą zostać potwierdzone przed wznowieniem.
8. Właściciel zatwierdza osobno dokładny artefakt i zakres rzeczywistego WRITE oraz rollback. Obecny pakiet nie udziela tej zgody i nie implementuje wykonania.

### Android i minimalna propozycja dostępu — niezaimplementowana

**Gotowość kodu: tak; gotowość użycia obecnego UI w fatal: BLOCKED.** Initial-global-revision kończy się fatal/cofnięciem main gate. Istniejący Tryb ratunkowy wymaga nadal ważnego gate i ma stary, celowo odmawiający eksport. Nie ma bezpiecznej istniejącej ścieżki pozwalającej właścicielowi wykonać nowy eksport w tej sytuacji. Nowe ESM nie są importowane przez produkt; samo wydanie tego kodu nie doda dostępu. Nie zmieniono main-login, Auth, fatal ani panelu, nie dodano przycisku.

Minimalna propozycja do **odrębnego zatwierdzenia UI i dostępu**: wykorzystać obecny panel ratunkowy w tej samej karcie, z jasno wydzieloną akcją pełnego eksportu LOCAL-FIRST i istniejącym wzorcem hasło → pobierz → wybierz ten sam plik → weryfikacja. Wejście z błędu startu wymaga osobno sprawdzonej capability wyłącznie do odczytu, po poprawnym uwierzytelnieniu tego samego właściciela, poprawnym receipt/binding/release i potwierdzeniu braku innych writerów. Nie wolno reaktywować cofniętego main gate, odblokować fatal/edycji, inicjalizować baz, startować migracji/replication ani podstawić fikcyjnego authorize/assertQuiescent. Integracja musi bezpiecznie dostarczyć readNative i znany RAM bieżącej karty; jeśli przy fatal nie da się tego dowieść, pozostaje STOP. Dostosowanie wejścia/gate do takiej rzeczywistej capability jest osobnym, niewykonanym zakresem. Nie zakładamy, że samo wyświetlenie panelu rozwiąże tę bramkę.

Po osobnej zgodzie i wdrożeniu tej integracji test właściciela na Androidzie powinien: zachować aktualną kartę/RAM, nie czyścić Chrome; potwierdzić właściwe konto i jedną kartę; pobrać zaszyfrowany plik do prywatnego miejsca, zachować hasło osobno; natywnie ponownie wybrać **ukończony pobrany plik**, odszyfrować i sprawdzić pełny zakres. Nie wysyłać pliku/hasła/szczegółów do czatu. Skopiować wyłącznie anonimowy status. Sprawdzić lokalnie różnice materiałów/labor i nie wykonać naprawy. Każdy BLOCKED/brak RAM/zmiana źródeł oznacza zatrzymanie odpowiedniego etapu; nie refresh, konsola, USB ani bookmarklet. Obecnie tej procedury na urządzeniu nie wykonano, nie deklarujemy BACKUP_PASS.

### Celowane dowody i obowiązkowy routing CI

Wyłącznie dane syntetyczne, Node **24.19.0**, Chromium **151.0.7922.173**. Lokalnie uruchomiono tylko poniższe celowane zestawy i statyczne kontrole; nie pełny Preflight/Firebase/Actions. Wyniki odnoszą się do roboczego drzewa finalnego jednego commita, nie są CI_PASS.

| Zestaw | Rzeczywisty wynik | Obowiązkowy CI |
| --- | --- | --- |
| local-first-rescue-smoke.js | **8/8 PASS**: pełne 4 store/RAW/5 aliasów/session/RAM, integralność ACK/archiwum, gate/identity/receipt/binding, unknown DB/upgrade, uszkodzone hashe/schema, zmiany/autoryzacja/2. klient/busy, brak RAM/rozmiar, download failure/niepełny plik/złe hasło/manifest/SHA/odczyt, natywny getter FileList, dowód tylko po weryfikacji, restart/stale, brak WRITE; stary eksport nadal odmawia LF | preflight-shards **4/7** |
| local-first-rescue-analysis-smoke.js | **4/4 grupy PASS**: 14 domen/7 par obu warstw, wymagane pola, historyczne akcesoria/unknown, dwukierunkowe rekordy/ID/ceny/normy/quantity modes, 5 fallbacków/4 braki, JSON/duplikaty/niekanoniczne Unicode, deterministyczny plan i pełna jawna symulacja bez mutacji | preflight-shards **6/7** |
| local-first-rescue-browser-smoke.js | **2 grupy PASS**: ukończony download na dysk i SHA rzeczywistych bajtów, native FileList/trusted change, odczyt/odszyfrowanie/manifest/BACKUP_PASS, złe hasło/ucięty plik, realna druga karta/Auth, SIGKILL/restart, FILE_VERIFIED_STALE przy utracie RAM, identyczność całego localStorage/IDB/outbox i readonly | preflight-shards **7/7**, brak skip przy niedostępnym Chromium |
| storage-recovery-smoke.js (dotychczasowy) | **5/5 PASS**, kontrakty starego pliku/RAW/hash/retencja/quota | preflight-shards **4/7**, bez osłabienia testu |
| storage-recovery-browser-smoke.js (dotychczasowy) | **18 grup PASS**, realny Chromium/IDB/download/quota/Auth/archiwum/restart | preflight-shards **5/7**, bez zmiany testu |
| local-first-contract-smoke.js (dotychczasowy) | **7 grup PASS**, odmowy produkcyjnej aktywacji, podpis/owner/Rules/revocation, nienaruszone kontrakty globals/RYSUNEK/robocizny | obowiązkowy preflight-shards, istniejący routing bez zmian |
| ci-sharding-smoke.js / składnia / wersje / load groups / offline manifest / diff | **PASS**, 192 aktualne smoke, siedem rozłącznych grup, każdy nowy test dokładnie raz; manifest obejmuje 484 publiczne pliki | obowiązkowy Preflight, workflow i historyczne piny bez zmian |

Advisory cloud-ci-impact wskazał wyłącznie dwa zmienione pliki z historycznymi pinami: index.html oraz storage-recovery-export.js. Oczekiwane odmowy CLOUD42_SOURCE_CHANGED i zależne historyczne bramki pozostają obowiązujące; nie aktualizowano pinów ani artefaktów. Wymagany current boundary oraz historyczne/Firebase zestawy dla końcowego SHA należą do niewykonanego CI (**CI_PENDING**). Porównanie bajtów potwierdziło brak zmian SW, writer-fence, boot/authority/initial-state/runtime/replication, kontraktu globalnego i implementacji starego eksportu.

Awaria download/brak miejsca jest celowanym wstrzyknięciem błędu, nie zapełnieniem dysku urządzenia. Test natywny wymaga osobno zdarzenia Chromium download completed i obecnego pełnego pliku, następnie naprawdę wybiera ten plik z dysku przez DOM.setFileInputFiles; nie weryfikuje samego Blob. Zaufanie event/FileList jest dodatkowo sprawdzane w rzeczywistym rendererze. Bez ukończonego pliku nie powstaje dowód, niezależnie od sposobu zgłoszenia braku miejsca przez Androida.

Początkowe wykonania nowego testu restartu wykryły nieutrwalone przygotowanie syntetycznego localStorage oraz dodatkowe karty odtwarzane przez Chromium. Fixture przed SIGKILL przechodzi rzeczywiste Browser.close z oczekiwaniem na zakończenie procesu, ponowne otwarcie i potwierdzenie obecności danych; zamyka wyłącznie dodatkowe strony we własnym jednorazowym profilu testowym. Finalna awaria i restart nadal wymagają identyczności wszystkich trwałych danych. Jednostkowy test archiwum poprawiono z porównania serializacji/prototypów dwóch realmów na porównanie pełnych wartości; nie zmieniono zabezpieczeń produkcji ani wcześniejszych asercji. Finalne wyniki powyżej, pierwotne błędy nie są przypisywane aplikacji.

**Syntetyczna kopia została faktycznie pobrana i niezależnie zweryfikowana: TAK. Kopia danych właściciela na fizycznym Androidzie: NIE / BACKUP_PENDING.** Bezpieczne wejście w fatal i prywatne rzeczywiste różnice nadal nierozstrzygnięte. Żaden wynik nie upoważnia do automatycznej naprawy, inicjalizacji, merge/importu/restore, czyszczenia danych, zmian SW/writer-fence/Auth, Firebase LIVE/Rules/IAM/billingu. Brak PR, GitHub Actions, merge i wdrożenia.
