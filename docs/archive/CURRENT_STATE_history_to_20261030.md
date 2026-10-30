# CURRENT_STATE — archiwum sprzed 30.10.2026

> Historia, nie bieżący stan. Zobacz [CURRENT_STATE.md](../../CURRENT_STATE.md).

**Uwaga:** kolejne nagłówki i stany `CODE_READY`, `CI_PENDING`, `RELEASE_BLOCKED` oraz „następny krok” są **migawkami historycznymi z dat ich napisania**. Część została już zastąpiona późniejszymi scaleniami. Zachowano je bez skasowania dowodów; wyłącznie sekcje 1–5 powyżej stanowią operacyjny punkt startowy.

## Nawigacja INWESTORA / Wyjdź / pasek zaufania — 29.10.2026

PR #85 został wydany do main `0a9522cf9277ef3de03d328a84dd9569a1958e46` (potwierdzenie właściciela). Dawne CI_PENDING pakietu Auth poniżej jest historyczne. Test fizycznego Androida pozostaje oddzielną kontrolą.

Na gałęzi `fix/investor-navigation-exit-mobile-20261029` przygotowano przeniesienie istniejących Pomieszczeń pod nagłówek INWESTORA, przekierowanie czterech zakładek bez pomieszczenia do tej karty, dyskretną wskazówkę oraz jednolite Wyjdź do listy inwestorów. Czysta sesja wymaga potwierdzonego trwałego zamknięcia; Anuluj/Zapisz i blokady danych pozostają. Pasek ma jeden rząd „Zaufany / Wyloguj”, z zachowaniem ostrzeżenia, opisu checkboxa i komunikatów aria-live poza stałym rzędem. Bez zmian danych, obliczeń, LOCAL-FIRST i Firebase LIVE.

**CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED.** Następny krok: niezależny przegląd HEAD/BASE i dopiero osobno zatwierdzone CI/wydanie. Nowe i dostosowane regresje, pokrycie obowiązkowego CI i lokalne ograniczenia są w [raporcie](../../tools/reports/investor-navigation-exit-mobile-20261029.md). Nie odświeżać otwartej karty z niezapisanym RAM.

## Zaufane urządzenia / sesja tymczasowa — pakiet 28.10.2026

Na bazie `951005296780f2b4887ab39b3c065a0beb247c48` przygotowano oddzielny lokalny dostęp, Google Auth i krótkie uprawnienie Firebase. Właściciel zatwierdził checkbox po logowaniu w górnym pasku obok Wyloguj. Zaufanie można świadomie ustanowić na telefonie, tablecie lub laptopie; wymaga ono dowodu WebCrypto/IDB i kompletnej powłoki offline. Niezaznaczona opcja oznacza na każdym urządzeniu sesję tymczasową tylko w pamięci dokumentu, z blokadą po 5 minutach bezczynności. Zmiana nie włącza synchronizacji, nie migruje danych ani nie zmienia PR #84. PR #84 jest scalony w powyższym main; wcześniejsze opisy jego CI_PENDING poniżej są historyczne.

**CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED.** Nowa macierz Chromium/IDB/offline i SDK/Rules wymaga CI, lokalnie natywny browser jest BLOCKED (`listen EPERM`). [Model, ograniczenia, rzeczywiste kontrole i wymagane dowody](../../tools/reports/trusted-phone-desktop-offline-auth.md). Nie odświeżać aktywnej karty z niezabezpieczonym RAM.

## LOCAL-FIRST SYNC — implementacja izolowana (28.10.2026)

Zgoda właściciela z 28.10 wznawia rozwój synchronizacji produktu; zastępuje wcześniejsze wstrzymanie wyłącznie w tym zakresie. BASE/main `149f9a126a85f9972f5fc1cd19afdc264be98cc7`, gałąź `local-first-sync-durable-20261028`. PR #77 i #78 wydane; PR #83 wydany, CI/Pages i akceptacja Pixela potwierdzone przez właściciela. Starsze wpisy CI_PENDING poniżej opisują poprzednie przekazania, nie dzisiejszy stan tych PR.

Nowy `sync/local-first-idb.mjs` oddziela model, trwały outbox i zachowane RAW od archiwum backupów. Transakcja IndexedDB potwierdza dane i obowiązek publikacji razem. Koordynator wykorzystuje CLOUD-3 (pełne 14 domen) i CLOUD-2B (niezmienne chunki projektów), niezależny odczyt, CAS, automatyczne sygnały online/server-head i odczytowe rozstrzyganie niepewnego ACK po restarcie. Edytor projektu ma trwałą epokę i wymaga potwierdzonego przekazania; nie ma przejęcia po timeout. Projekt zachowuje przypiętą, zweryfikowaną rewizję katalogów.

`sync/firebase-activation.mjs` przygotowuje rzeczywiste połączenia Web SDK dla globalnych danych: podpis Ed25519, osobna zgoda na migrację/Rules, tożsamość, baseline i świeży Rules read-back. Import i startup niczego nie aktywują. Transport projektów pozostaje emulatorowy: obecny profil CLOUD-1B dopuszcza tylko syntetyczne projekty. Nie dorobiono fikcyjnej zgody na realne projekty ani mapowania historii/Issue #47. Pełne podłączenie `Zapisz/Anuluj`, migracja i startup nadal wymagają osobnego bezstratnego wdrożenia.

Celowane kontrole: 6 grup kontraktów offline PASS, składnia 10 plików PASS. Nowe regresje prawdziwej IndexedDB/Chromium i Auth/Firestore są podłączone do istniejącego CI; lokalne wykonanie blokuje `listen EPERM`, a zależności SDK/emulatorów są niedostępne. Nie zaliczono tych scenariuszy. Historyczne 425 pinów oraz izolowany checkout `306f90a4cfd8bcb4277aa8b4d140e911493ddd60` bez zmian. [Raport, API, zakres i blokery](../../tools/reports/local-first-sync-20261028.md).

**Implementacja CODE_READY (izolowany pakiet) / CI_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED.** Bez PR, wydania, produkcyjnych odczytów/zapisów i zmian danych użytkownika. To nie jest jeszcze działająca synchronizacja na urządzeniach właściciela.

## STORAGE RECOVERY — nowe archiwum IDB i anulowanie COPIED (25.10.2026)

Na istniejącej gałęzi `fix/android-storage-recovery-indexeddb-v1`, wejściowy HEAD `263a75b30c160952eb3bb72221bc014d6139d190`, BASE/main `9c6ad2263850868e37c0cdb9098dfe6047a39260`, domknięto dwa zatwierdzone wymagania. Nie ponawiano diagnostyki SESSION_OWNER_MISSING ani jej zaliczonych regresji.

**Nowe archiwum:** przy braku starego klucza, wcześniejszego journalu i markera pierwszy zapis backupu inicjalizuje biznesową IndexedDB. INITIALIZING (atomowo pusty journal/źródło) → potwierdzony mały marker → ACTIVE → potwierdzona transakcja pierwszego rekordu. Przerwanie/pełny localStorage/IDB lub utrata Auth nigdy nie tworzą fallbacku fc_data_backups_v1 ani fałszywego potwierdzenia backupu. Ponowny jawny zapis może wznowić wyłącznie pustą inicjalizację fresh, również po restarcie. Utracona baza przy istniejącym markerze albo pojawienie się starego writera oznaczają STOP.

**COPIED:** w Trybie ratunkowym dodano „Anuluj przygotowanie migracji — zachowaj obie kopie”. Jawne anulowanie sprawdza Auth, Web Lock, dokładny hash/rewizję journalu, integralność oryginalnej kopii i obecne poprawne źródło. Trwały CANCELLED zachowuje cały wcześniejszy RAW i rekordy IDB jako dowód, zaś aktualny klucz localStorage pozostaje jedynym aktywnym archiwum; zwykłe backupy nie są już zamrożone. To nie jest Anuluj sesję, odblokowanie edycji ani zwolnienie quota. Wybrano bezstratne anulowanie, nie nadpisywanie historycznej kopii nowym źródłem. Zmienione źródło nadal blokuje ponowne copy, ale nie jawne anulowanie przy poprawnym aktualnym archiwum. SWITCH_PENDING nie może skorzystać z tej ścieżki.

Nowe celowane regresje Chromium/IndexedDB: `storage-recovery-lifecycle-smoke.js` — 11 grup PASS, pięć żyć dokumentu, dwie karty, mobilne 393×852, syntetyczne dane i gate. Obejmują inicjalizację, quota obu magazynów, transakcję pierwszego rekordu, read-back, restarty, brak fallbacku, historyczne RAW, cofnięcie dostępu, starego writera, CAS, jawny przycisk i odblokowane tworzenie backupów. Fizycznego telefonu nie testowano, nie uruchamiano pełnego CI/emulatorów. Nowy smoke wykrywa istniejący Preflight; workflow nie zmieniono.

**Gotowy zakres dwóch luk: CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED. Destrukcyjna migracja historyczna E: BLOCKED_WRITER_EXCLUSIVITY.** E w panelu nadal kończy jawnym STOP; nie symulowano wyłączności starych writerów, nie usunięto żadnego archiwum użytkownika ani nie uruchomiono CLOUD/Firebase LIVE. Pełny pakiet nie jest deklarowany jako gotowa destrukcyjna naprawa historycznej instalacji.


## Pusta instalacja — SESSION_OWNER_MISSING (25.10.2026)

Nowy stan zgłoszony przez właściciela po usunięciu danych testowych: Pixel ma 0 projektów, 0 inwestorów, 15 kluczy katalogów/startu, około 183,9 KiB, brak aktywnej i trwałej sesji. To odrębny przypadek od wcześniejszej blokady quota z sześcioma projektami; nie wykonano żadnych operacji na telefonie.

Na tej samej gałęzi `fix/android-storage-recovery-indexeddb-v1`, od wejściowego HEAD `75930632cec1cc30039e8bc43bf425e6624dda64`, odtworzono błąd w pełnym shellu Chromium. `project-bridge.load()` bierze aktualny DEFAULT (blat łazienki 2 cm), natomiast porównanie z nieistniejącym centralnym projektem normalizowało null przez migracje legacy (1,8 cm). Powstawała pozorna edycja, nawigacja próbowała `session.begin()`, a poprawna kontrola właściciela odmawiała `SESSION_OWNER_MISSING`.

Poprawka używa tego samego DEFAULT jako baseline wyłącznie dla sprawdzonej pustej instalacji bez rekordów, wskazań właściciela, legacy projektu i dowodów sesji. Nie tworzy właściciela ani sesji do menu/katalogów. Jawne utworzenie pierwszego inwestora może aktywować jego rzeczywisty nowy projekt przez jednorazowe świadectwo niezmienionego pustego RAM; nie otwiera tej ścieżki dla istniejących projektów. Blokady rzeczywistej edycji i konfliktów pozostają. Normy/ceny, schematy, sesja, Auth i CLOUD bez zmian.

Celowane testy: `empty-installation-smoke.js` 5/5 grup PASS; `empty-installation-browser-smoke.js` PASS w rzeczywistym Chromium, mobilne 393×852, pusty profil → startup i Auth gate → Projekty meblowe/katalog → restart → nowy inwestor/projekt/pomieszczenie → edycja i trwały zapis. Dane i odpowiedź weryfikatora dostępu są syntetyczne; nie testowano Google ani fizycznego Pixela. Oba testy są automatycznie wykrywane przez istniejący Preflight. Szczegóły w raporcie pakietu.

**Ta pilna poprawka: CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED.** Wcześniejszy blocker wyłączności writerów etapu E archiwum nadal obowiązuje — ta poprawka go nie rozwiązuje i nie zmienia statusu całego STORAGE RECOVERY. Bez PR, wydania ani działań na danych właściciela.


## STORAGE RECOVERY v1 — korekta przed wydaniem (25.10.2026)

Gałąź pozostaje `fix/android-storage-recovery-indexeddb-v1`; wejściowy HEAD `80ade3639c62b9c5c7f6c187432b58d0ece0bc8b`, potwierdzony BASE/main `9c6ad2263850868e37c0cdb9098dfe6047a39260`. Bez nowej gałęzi, PR lub wydania.

Naprawiono pełny prywatny eksport po ACTIVE: obejmuje wszystkie aktualne rekordy IndexedDB, sprawdza ich SHA/metadane i odmawia weryfikacji pliku zastąpionego nowszą rewizją. Nie odtwarza starego klucza. Diagnostyka sesji zachowuje Kopiuj raport i dodaje autoryzowane przejście do panelu. Zapis znacznika ma jawne odmowy quota/niepotwierdzonego read-back przed usunięciem archiwum; nie dodano czyszczenia cache.

**BLOCKER: etap E w interfejsie NIE JEST gotową ścieżką wykonawczą.** Panel pokazuje dokładny klucz/hash, stan pliku, osobną zgodę i świadome potwierdzenie, kontroluje sesję oraz świeży Auth, ale kończy `RECOVERY_WRITER_EXCLUSIVITY_UNPROVEN`. Pusty `navigator.locks.query()` nie jest spisem wszystkich kart; stara karta może nie używać locka. Storage events ani checkbox nie dowodzą jej nieobecności i nie blokują jej późniejszych zapisów. W obecnej architekturze brak technicznego spisu/fence dla takich kontekstów. Nie dodano fikcyjnego dowodu, nie zmieniono Auth ani nie wdrożono nowego koordynatora przeglądarki. Niskopoziomowe `activate(decision, receipt)` nadal ma zewnętrzny warunek rozstrzygnięcia writerów, a jego testy kontrolowanego profilu nie dowodzą spełnienia go na telefonie. Nie jest zalecane wywoływanie tego API przez właściciela.

Zgodnie z warunkiem STOP właściciela **nie deklarujemy CODE_READY dla kompletnej naprawy telefonu**: `CODE_BLOCKED_WRITER_EXCLUSIVITY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED`. Wcześniejsze CODE_READY poniżej jest statusem historycznego przekazania, skorygowanym przez tę kontrolę. Pozostałe poprawki można ocenić niezależnie. Dokończenie całego celu wymaga uzgodnionego mechanizmu koordynacji wszystkich writerów, również starych kontekstów; nie można zastąpić go deklaracją użytkownika ani samym wydaniem strony. Wstrzymanie CLOUD/Firebase LIVE/synchronizacji i ochrona obecnego RAM nadal obowiązują.


## STORAGE RECOVERY / INDEXEDDB — PRIORYTET 1 (25.10.2026)

**Nowa decyzja właściciela: CLOUD / CLOUD-4.6F / FIREBASE LIVE / rozwój SYNCHRONIZACJI — WSTRZYMANE do osobnej decyzji.** Zachowujemy dotychczasowy kod, wyniki i plany chmury. Bieżący pakiet implementuje wyłącznie lokalne ratowanie pamięci i archiwum backupów, przed dalszym CLOUD. Historyczne harmonogramy poniżej nie wyznaczają teraz priorytetu.

Zweryfikowany BASE/main: `9c6ad2263850868e37c0cdb9098dfe6047a39260` (scalony PR #82). Odrębny worktree i gałąź `fix/android-storage-recovery-indexeddb-v1`; nie znaleziono rozpoczętej gałęzi ANDROID EMERGENCY RECOVERY v1 do kontynuacji. Innych worktree nie zmieniano.

**Nowy fakt od właściciela, zastępujący wcześniejszą nieustaloną tożsamość klucza:** Pixel: 43 klucze / 6 projektów / 5 217 379 jednostek UTF-16; `fc_data_backups_v1` **3 317 250** (około 63,6%), `fc_quote_snapshots_v1` 1 328 058, `fc_rozrys_plan_cache_v2` 221 062, `fc_projects_v1` 63 244. To pomiar długości tekstu, nie limitu quota. `ram:true`, `durable:false`, `present:false`, `expectedKnown:false` nie dowodzą niezapisanej edycji ani utraty projektu. Edycja telefonu pozostaje zablokowana.

Przygotowano „Tryb ratunkowy” w istniejącym komunikacie sesji: diagnostyka, podgląd archiwum, prywatny szyfrowany plik z ponownym wyborem i weryfikacją, kopiowanie do osobnej biznesowej IndexedDB oraz kontrola przygotowania. Nie uruchamia nawigacji projektu, begin/commit/cancel, backupu localStorage, czyszczenia cache ani przeładowania. Baza `meble-business-backups-v1` nie jest bazą profilu/Auth. Migracja A–D zachowuje klucz źródłowy; zwykłe writery archiwum są po skopiowaniu wstrzymane do rozstrzygnięcia przełączenia. Etap E ma odrębny, testowany handler z dowodem pliku, świeżą kontrolą RAW/Auth, blokadą między kartami oraz jawną decyzją dla dokładnego klucza i SHA-256; **panel tego wydania nie oferuje usuwania ani aktywacji**. Mały marker routingu powstaje dopiero w osobno zatwierdzanym E, przed usunięciem; jeśli się nie mieści, pozostaje STOP i stary klucz.

Szczegóły modelu, awarii, testów i ograniczeń: [raport pakietu](../../tools/reports/android-storage-recovery-indexeddb-v1.md), kontrakt w [BACKUP.md](../../BACKUP.md#android-storage-recovery--indexeddb-v1). Nie migrujemy projektów, historii ani cenników. IndexedDB nie jest chmurą, niezależną kopią ani gwarancją offline. Retencja 7 dni / min10 / testowe10 / ochrona najnowszych3 pozostaje; doprecyzowano zachowanie przypiętych i bezpiecznych testowych kopii. Usunięto dotychczasowe automatyczne przepisywanie technicznych RAW wewnątrz starych backupów i dostęp synchronicznego kompaktora do archiwum — migracja i późniejsze zapisy zachowują historyczną treść.

**PHONE_PENDING / użycie obecnej karty BLOCKED:** nowy kod wymaga dostarczenia nowej wersji dokumentu. Nie wykazano zabezpieczenia RAM obecnej karty; nie zalecamy jej odświeżania. Eksport z 17.10 zabezpiecza wskazane zapisane dane, nie wszystkie dzisiejsze RAW ani RAM. Sam commit lub wydanie nie upoważnia do migracji/zwalniania miejsca na Pixelu. Najpierw osobna zgoda wydaniowa dla HEAD/BASE, potem rozstrzygnięcie zachowania RAM i osobna zgoda na działania A–D na telefonie; E nadal wymaga niezależnej decyzji. Brak USB/DevTools/konsoli/bookmarkletów pozostaje obowiązującą ergonomią.

Statusy przed wydaniem: **CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED** — wyniki faktycznie wykonanych kontroli oraz ewentualne blokery wskazuje raport pakietu. Poniższe opisy wcześniejszej diagnostyki zachowano jako historię.


## ANDROID QUOTA — incydent z 24.10.2026

Zweryfikowany na GitHubie main: `cd4a5b3b8c0560d7b8630892b47eb18970a91072`. PR [#80](https://github.com/mebleszek/meble-app/pull/80) jest scalony; właściciel potwierdził CI, auto-merge i Pages PASS. SESSION-QUOTA + EXACT-CALCULATIONS jest **wydanym pakietem diagnostycznym i naprawą opisów WYCENY, nie naprawą przyczyny quota**. [Raport przygotowania i trzech korekt CI](../../tools/reports/session-quota-exact-calculations.md) zachowuje historyczne statusy sprzed wydania. Kwoty/normy i historia nie były przeliczane.

**Obecny stan telefonu: edycja nadal zablokowana.** Pixel 8 Pro / Android / Chrome zgłasza `SESSION_QUOTA_EXCEEDED`. Wcześniejszy pakiet analizy/dokumentacji wydano w PR #81 do main `767c1c79acacc4d8334aa0d79a99b36d7af28ba8`. Nowa zgoda obejmuje wyłącznie opisaną poniżej implementację diagnostyki w aplikacji i trwały zapis decyzji; nadal bez operacji na danych telefonu, zwalniania miejsca, resetu, migracji, CI/wydania lub Firebase LIVE.

### Stała decyzja: diagnostyka bezpośrednio w aplikacji

**24.10.2026 — wymaganie właściciela, obowiązujące również w przyszłych procedurach serwisowych:** diagnostyka ma być dostępna w Meble-App na telefonie, bez USB, DevTools, konsoli, debugowania na komputerze, bookmarkletów, dodatkowych aplikacji i ręcznego wykonywania kodu. Docelowo: **Diagnostyka sesji → Kopiuj raport → wklejenie do ChatGPT**. Wyjątek wymaga osobnej wyraźnej zgody. Zasadę zapisano także w AGENTS.md §5; proces wydawniczy pozostaje bez zmian. Poprzednia gałąź narzędziowa `diag/pixel-storage-key-identification-20261024` / `94d0a30f87cce0f0f51ff995e7ce652ade99a2a9` jest niewydanym źródłem przejrzanej logiki anonimizacji, a jej instrukcja USB nie jest akceptowaną procedurą właściciela.

Na nowej gałęzi `fix/pixel-inapp-storage-diagnostics-20261024`, BASE `767c1c79acacc4d8334aa0d79a99b36d7af28ba8`, rozbudowano istniejący kolektor i modal. Ten sam skan localStorage tworzy `storageSizes` (`kind:meble-app-storage-sizes`, `status:READ_ONLY`, `complete`, `largest`, `top` do 10 pozycji, kategoria, rozpoznanie, długości UTF-16, sumy i `quotaLimitKnown:false`). Zachowano dotychczasowe pola sesji/usage i ich kategorie, bez zmiany protokołu sesji. Ekran pokazuje pięć największych pozycji oraz kompletność; istniejący przycisk kopiuje pełny anonimowy raport. Stałe nazwy pochodzą z zamkniętej listy wykorzystanej w poprzednim narzędziu; dynamiczne/nieznane klucze mają `ANON_01` itd. Ranking nie zawiera cen, ID, wartości, fragmentów ani treści wyjątków i nie jest zgodą na usunięcie danych.

Pomiar zachowuje istniejący Auth/origin gate, kontrolę całego ponownego odczytu i stanu sesji oraz granicę 2000 kluczy / 8 Mi jednostek tekstu. Ranking utrzymuje tylko dziesięć wierszy metadanych, dzieląc istniejące obserwacje RAW — bez dodatkowego klonowania magazynu i parsowania backupów/cache. Dodano konserwatywny limit serializacji diagnostycznego świadka RAM i jego estymaty: 8 Mi jednostek po uwzględnieniu najgorszego kodowania JSON i 100000 odwiedzanych węzłów; nadmiar daje `DIAGNOSTIC_TOO_LARGE`, bez częściowego PASS. To granice pracy narzędzia, nie gwarancja zużycia sterty lub dostępnej quota. Nie wywołuje zapisów/czyszczenia, backupu, recovery, metod sesji, sieci ani Firebase; wynik pozostaje wyłącznie w bieżącym widoku i opcjonalnie schowku. Historyczny wygenerowany bookmarklet zsynchronizowano ze wspólnym źródłem tylko dla integralności istniejącej regresji; nie jest ścieżką użytkową.

**Obecna karta Pixela: PHONE_PENDING, użycie nowego kodu BLOCKED.** Nowe produkcyjne skrypty wymagają osobno zatwierdzonego dostarczenia wersji i późniejszego załadowania dokumentu. Już otwarta karta nie dostaje ich automatycznie. Nie dodano odświeżania, restartu, logowania ani wznowienia sesji. Nie można dowieść zachowania jej RAM po przeładowaniu, więc **nie zalecamy odświeżenia obecnej karty** i nie deklarujemy bezpiecznego testu nowej wersji na niej. Eksport `meble-app-export-2026-10-17t11-35-56.json` jest wartościową kopią 36 zapisanych kluczy biznesowych według przekazanej niezależnej analizy; nie dowodzi dzisiejszej zgodności wszystkich danych, nie chroni RAM, archiwum backupów, cache, sesji i pozostałych pominiętych RAW. Zasadnicza zgodność biznesowa nie zastępuje tego dowodu.

Po późniejszym wydaniu i **osobnym rozstrzygnięciu ochrony RAM/dopuszczeniu załadowania wersji** jedynym zwykłym działaniem właściciela będzie otwarcie istniejącej „Diagnostyki sesji”, naciśnięcie „Kopiuj raport” i wklejenie wyniku do ChatGPT. Do tego czasu zachować obecną kartę bez resetu, Zapisz/Anuluj i prób zwalniania miejsca. To implementacja identyfikacji największego magazynu, nie odblokowanie telefonu. **CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**; rzeczywiste kontrole i zakres zmian zapisano przy przekazaniu commita. Pełny Preflight/Chromium integracji/Auth/SDK/Rules pozostaje dla osobno zatwierdzonego GitHub Actions, fizyczny telefon dla właściciela.

Celowana weryfikacja tej implementacji: `session-storage-ranking-smoke.js` **10/10 grup PASS** (ranking, anonimowość, pełny magazyn, błędy/zmiana, Auth, mutacje, granice RAM, C=B/E i kopia), `session-quota-usage-smoke.js` **7/7 PASS**, `session-diagnostics-screen-smoke.js` **6/6 PASS**. Składnia siedmiu zmienionych JS, ścisłe wersje obu HTML, zgodność wygenerowanego historycznego artefaktu i diff PASS. Mobilny test tylko komponentu diagnostyki (`wycena-labor-ui-browser-smoke.js --mobile-only --diagnostics-only`) przygotowano, lecz start Chromium zatrzymał sandbox: `setsockopt: Operation not permitted`. Responsywność ma więc status **BROWSER_BLOCKED / CI_PENDING**, nie PASS. Regresja istniejącego pełnego shellu została rozszerzona o kompletny ranking w kopiowanym JSON; nie uruchomiono jej ani emulatorów lokalnie. Nowy smoke jest wykrywany w bieżącym kontekście przez istniejący Preflight; workflow i historyczne dowody CLOUD pozostają bez zmian.

### Fakty i granice diagnozy

Przekazany przez właściciela anonimowy pomiar dotyczy tekstu localStorage, nie rzeczywistej zajętości quota przeglądarki:

| Kategoria | Jednostki UTF-16 |
|---|---:|
| Razem | 5 217 379 |
| Projekty | 77 375 |
| Inwestorzy | 9 423 |
| Katalogi i cenniki | 94 904 |
| Historia ofert | 1 328 079 |
| Kopie bezpieczeństwa (według wąskiej klasyfikacji kolektora) | 17 439 |
| Pozostałe | 3 690 159 |

Największa pojedyncza wartość: **3 317 250 jednostek**, około **6479,0 KiB** przy pomocniczym przeliczeniu ×2/1024. Należy do „Pozostałych”; **jej klucz pozostaje nieustalony**. Łącznie około 10190,2 KiB tekstu, historia 2593,9 KiB, pozostałe 7207,3 KiB. Kanonicznych projektów jest 6, największy 19187 jednostek, bieżący 17751 (około 34,7 KiB). `ramPayloadUnitsEstimate=137144` (267,9 KiB), `replacementNetUnitsEstimate=137162` — szacunki przyszłego zapisu, nie zapisany payload ani dowód wolnego miejsca.

`storage:READABLE`, `present:false`, `sessionPayloadUnits:0`, `ram:true`, `durable:false`, `expectedKnown:false`, `CB:null`, `CE:null`, `quotaLimitKnown:false`, `transientWriteCostKnown:false`. `ram:true` oznacza obiekt sesji, nie dowód niezapisanej edycji; brak payloadu nie dowodzi utraty projektu. Nie ma trwałego dowodu do porównania C=B/E. Nie ustalono zużycia całego profilu Chrome ani wolnego miejsca telefonu.

Ścieżka kodu `FC.session.begin()` → `persistSession()` → `writeRaw('fc_edit_session_v1', JSON.stringify(payload))` klasyfikuje natywny `QuotaExceededError` jako ten kod i zachowuje `durable:false`; odmowa edycji chroni brak trwałego rollbacku. Ograniczenie snapshotu do rekordu właściciela jest już w bazie. Payload zawiera także `expectedOwnerRaw`, kontekst oraz RAW `fc_edge_v1` i `fc_material_part_options_v1`, z narzutem kodowania JSON; nie ma powodu utożsamiać jego rozmiaru wyłącznie z 17 751 jednostkami projektu. Nie wykazano błędu nowego owner-only begin ani przyrostu po samym przejściu między kartami. Brak miejsca na dodatkowy dowód wobec obecnego dużego obciążenia jest główną hipotezą; dokładny limit i koszt zapisu pozostają nieznane. Przy `present:false` badany przypadek wymaga utworzenia klucza, a nie zastąpienia istniejącej sesji; tymczasowy koszt zastępowania innych monolitycznych kluczy to odrębne ryzyko.

### Co oznaczają „Pozostałe” — analiza źródeł, nie odczyt telefonu

W `session-diagnostics-readonly.js` kategoria backupów obejmuje tylko prefiksy `fc_project_backup`, `fc_backup`, `fc_safety_backup`. **`fc_data_backups_v1` nie pasuje i trafia do „Pozostałych”.** Tam trafiają również cache planów v1/v2, drafty ofert, sloty `fc_project_inv_*`, kopie inwestorów/slotów, legacy PCV, decyzje formatek/słojów, UI/wskaźniki, tombstones oraz nierozpoznane klucze. Skan obejmuje cały origin, nie tylko fc_*; inne dane tego samego origin też mogą należeć do tej grupy. Małe „Kopie bezpieczeństwa” nie wykluczają dużego archiwum backupów. Odrębny `data-storage-audit.js` używa innego zakresu (`fc_*`, często snapshot z wykluczeniami) i innych etykiet jednostek; jego wynik nie jest równoważny raportowi quota.

Kolejność sprawdzenia na podstawie struktury kodu, **bez ustalenia prawdopodobieństw ani uznania kandydata za przyczynę**: (1) `fc_data_backups_v1` — wiele pełnych snapshotów obejmujących także historię, (2) `fc_rozrys_plan_cache_v2` — do 100 planów, bez limitu bajtów, (3) historyczne sloty/nieznane importowane RAW, (4) drafty ofert i globalne decyzje formatek. Cache projektowy jest omijany przez bieżący tryb projektowy, więc nie każda generacja ROZRYSU powiększa v2. Drafty normalnego writera zawierają wybory/warunki handlowe i limit 50 rekordów, nie pełne katalogi/cały plan; mogą jednak mieć nieznany legacy RAW. Historia ofert (1 328 079), główne projekty i katalogi są mniejsze od największej wartości i według tego pomiaru nie mogą być jej kluczem. Istniejący limit historii 30 najnowszych niewybranych ofert na projekt i 240 łącznie zachowuje oferty `selectedByClient` ponad limitami; ograniczenie liczby nie zapewnia budżetu rozmiaru ani archiwizacji. Istnieje też filtr/purge starych ciężkich formatów. Te mechanizmy nie dowodzą zabezpieczenia wszystkich dawnych RAW i nie są teraz wywoływane ani zmieniane.

Poniższa tabela dotyczy warunków ratowania tego incydentu; **CLOUD_DATA_REGISTER.md pozostaje rejestrem własności**, a BACKUP.md kontraktem obecnego backupu. Żaden wpis nie jest zgodą na usunięcie lub migrację.

| Klucz / rodzina | Funkcja | Autorytatywność | Odtwarzalność | Ryzyko utraty | Zabezpieczenie | Warunek przyszłego zwolnienia miejsca |
|---|---|---|---|---|---|---|
| `fc_data_backups_v1` | Archiwum wielu pełnych kopii | Nie bieżący autorytet; możliwe jedyne dawne wersje | Nie wynika z obecnego projektu | Wysokie: historia i możliwe sekrety | Pełny prywatny RAW archiwum, manifest, odtworzenie poszczególnych kopii poza telefonem | Osobna zgoda, wskazane wersje i dowód niezależnego odzyskania; nie samo „backup” w nazwie |
| `fc_rozrys_plan_cache_v2`, `..._v1` | Obliczone plany, v1 legacy | Wynik pochodny | Warunkowo: komplet wejść i właściwa wersja algorytmu | Niskie dopiero po dowodzie; nieznany legacy RAW chroniony | RAW przed operacją; sprawdzenie, że to wyniki, nie jedyne wejścia | Potwierdzony klucz/rozmiar/format i odtwarzalność; dokładna osobna zgoda, bez ruszania preferencji |
| `fc_quote_offer_drafts_v1` | Ręczne wybory, ilości, warunki oferty | Wartościowy roboczy stan | Nie gwarantowana z historii | Wysokie: niezatwierdzona praca | RAW i relacje projekt/inwestor; bez normalizeDraft | Dopiero przeniesienie/archiwizacja z dowodem i zgodą; nie traktować jak cache |
| `fc_quote_snapshots_v1` | Zamrożona historia ofert | Autorytet historycznych kwot/wersji | Nie przez dzisiejszą WYCENĘ | Wysokie | Cały RAW, ID/relacje i kontrola wariantów, cen i sum | Zweryfikowane archiwum i dostęp/odtworzenie; bez kasowania zatwierdzonych ofert |
| `fc_projects_v1` | Kanoniczne rekordy projektów, pokoje, PCV i intencje | Bieżący autorytet | Nie bez potwierdzonej kopii właściwej rewizji | Krytyczne | Cały RAW wszystkich projektów i pending meta, zachowane ID/rewizje | Brak doraźnego usuwania; przyszła bezstratna migracja/przeniesienie tylko ze zgodą |
| `fc_project_v1`, `fc_project_inv_*_v1` | Legacy projekt/slot inwestora | Nie równorzędny bieżący autorytet; możliwe unikalne dane | Nieustalona | Wysokie; „osierocony” nie znaczy zbędny | RAW bez przepisywania na kanoniczny format | Porównanie zawartości, właściciela i rewizji; rozstrzygnięcie rozbieżności przez właściciela |
| `fc_project_backup*_v1`, `fc_investors_backup*_v1`, sloty `*_backup_v1` / `*_backup_meta_v1` | Kopie awaryjne i metadane | Nie bieżący autorytet; możliwe jedyne wersje | Nieustalona | Wysokie | RAW także pomijane przez standardowy eksport | Weryfikacja każdej potrzebnej wersji poza telefonem, osobna zgoda |
| `fc_edge_v1`, `fc_material_part_options_v1`, `fc_rozrys_grain_state_v1`, `fc_rozrys_overrides_v1` | Legacy PCV, decyzje formatek, słoje/wyjątki | Chronione decyzje; część własności nierozstrzygnięta | Nie zakładać odtwarzalności | Wysokie: produkcja/PCV i rollback | RAW oraz stan sesji; Issue #47 i rejestr rozstrzygają zakres | Żadnego czyszczenia jako cache; przyszłe rozstrzygnięcie i bezstratne przeniesienie |
| `fc_investors_v1`, katalogi/cenniki, `fc_sheets_v1`, ustawienia, pięć aliasów `hardware*` | Inwestorzy, ceny, zamienniki, magazyn i globalne dane | Własne kanoniczne domeny lub chronione aliasy | Nie z seedów ani z samego projektu | Wysokie: ceny/relacje/stan firmy | RAW kanoniczne i legacy, komplet referencji; sekret ORS osobno chroniony w prywatnym artefakcie | Brak doraźnego usuwania; dopiero potwierdzona migracja/replika zgodna z rejestrem |
| `fc_edit_session_v1`, RAM sesji/formularzy | Dowód rollbacku i niepotwierdzona praca | Dowód według istniejących guardów; RAM sam nie uprawnia do zapisu | Brak payloadu nie pozwala go odtworzyć z domysłu | Krytyczne | Istniejący RAW i osobna prywatna obserwacja RAM bez begin/save/cancel | Nigdy ręczne usunięcie/adopcja RAM; tylko istniejąca, udowodniona procedura sesji |
| `fc_ui_v1`, wskaźniki, `fc_rozrys_panel_prefs_v1`, `fc_rozrys_material_accordion_v1`, tombstones | Kontekst, preferencje i ochrona usunięć | Kontekst techniczny; tombstones mają znaczenie biznesowe | Zależna od klucza | Utrata wyborów lub błędne wznowienie/odtworzenie usuniętych danych | Prywatny RAW; nie utożsamiać całej grupy z cache | Zwykle mała korzyść; żadnego ogólnego resetu ustawień lub kontekstu sesji |
| Nieznane/importowane klucze tego origin | Funkcja nieustalona | Nieustalona | Nieustalona | Wysokie do wyjaśnienia | Najpierw prywatna identyfikacja zakresu; bez zrzutu tokenów SDK | STOP do rozpoznania; nie usuwać według prefiksu/rozmiaru |

### PILNE — plan zabezpieczenia i odzyskania telefonu, niewykonany

1. **Identyfikacja wyłącznie w interfejsie Meble-App.** Obowiązuje decyzja powyżej: istniejąca „Diagnostyka sesji”, anonimowy ranking i „Kopiuj raport”, bez procedury USB/DevTools lub wykonywania kodu. Wdrożenie nowej diagnostyki nie jest zgodą na przeładowanie obecnej karty. Do rozstrzygnięcia ochrony jej RAM etap telefoniczny pozostaje BLOCKED. Nie tworzyć nowej sesji, backupu w localStorage i nie wywoływać writerów. Ogólne raporty `dataStorageAudit`/„Diag” mogą ujawniać dynamiczne nazwy i dane — nie są zalecaną alternatywą dla właściciela.
2. **Projekt bezpiecznego raportu.** Stałe znane klucze raportować nazwą z allowlisty i liczbą jednostek, dynamiczne/obce jako rodzinę oraz anonimowy numer w danym raporcie. Bez nazw projektów, wartości, tokenów i treści wyjątków. Podwójny ścisły odczyt listy/rozmiarów/wartości, kontrola niezmienności i istniejącego Auth/origin przez całą operację; błąd/zmiana/przekroczony budżet = odmowa kompletnego raportu. Nie badać limitu przez setItem ani utożsamiać estimate() z wolnym localStorage. Brak ważnego Auth pozostawia odmowę.
3. **Pełna prywatna kopia przed zwalnianiem miejsca.** Obecne `exportCurrent()` pobiera plik bez zapisu nowego backupu w localStorage, ale obejmuje tylko dozwolone fc_* i może przemilczeć niepełny odczyt. Nie zabezpiecza pięciu aliasów, archiwum backupów, kopii ratunkowych, sesji, cache, sessionStorage, IndexedDB ani RAM. `exportBackup()` dotyczy wybranej kopii, nie pełnego RAW archiwum. Obecny niekryptograficzny hash deduplikacji i poprawny JSON nie dowodzą integralności pełnej kopii. Nie używać import/restore/createBackup/prune/maintenance w celu ratowania miejsca.
4. **Kontrakt przyszłego eksportera ratunkowego, nie implementacja.** Ścisły odczyt wszystkich potrzebnych biznesowych RAW localStorage: projekty/inwestorzy, katalogi/ceny/zamienniki, magazyn, historia/drafty, backupy/kopie, ustawienia, PCV/słoje i legacy/aliasy, także istniejący dowód sesji. Spis wszystkich zastanych nazw pozwala wykryć nieznaną domenę; nierozpoznany klucz wymagający ochrony oznacza STOP do klasyfikacji, nie ciche pominięcie ani zrzut Auth. RAW bez normalizacji, również niepoprawny JSON zachować jako RAW. Pakiet pobierany bezpośrednio do prywatnego pliku poza origin, bez buforowania w localStorage. Zawartość klientów i ewentualny ORS apiKey chronić w szyfrowanym prywatnym artefakcie, nigdy w GitHubie/logach/czacie ani payloadzie CLOUD.
5. **Oddzielne zakresy pamięci.** sessionStorage: potrzebny biznesowy stan i wznowienie osobno, bez tokenów/dowodów Auth, bez automatycznego odtwarzania sesji na innym urządzeniu. IndexedDB: inwentaryzacja istniejących baz, wersji i store; odczytowe transakcje wyłącznie rozpoznanych danych biznesowych. Nie otwierać nieistniejącej bazy przez open(), które mogłoby ją utworzyć; brak możliwości pełnej inwentaryzacji = jawny brak kompletności. `meble-access-profile-v1` i Firebase SDK persistence są technicznym dostępem/poświadczeniami, nie backupem biznesowym — nie kopiować/odtwarzać. W obecnym kodzie brak wdrożonego biznesowego IndexedDB; nie dowodzi to zawartości rzeczywistego profilu. RAM sesji/formularzy zabezpieczyć prywatnie tylko ze znanego zakresu, bez serializacji całego window/FC; zapis RAM nigdy nie potwierdza rewizji projektu ani prawa do rollbacku. Niedostępnych RAM innych kart nie oznaczać jako zabezpieczone. Chmurowe kopie i niesynchronizowane wersje raportować osobno; brak niezależnego potwierdzenia to brak dowodu kopii, nie zgoda na LIVE.
6. **Manifest i dowód kompletności.** Zdefiniować zakres, wersję narzędzia i źródłowej aplikacji, origin, czas, enumerowane/wykluczone magazyny z uzasadnieniem, obecność/brak kluczy, jednostki UTF-16, rozmiar pliku, SHA-256 per RAW i całego artefaktu oraz liczby/relacje/rewizje. Kodowanie ciągów musi zachować wszystkie jednostki UTF-16 (także samotne surrogaty), np. jawny UTF-16LE w binarnym kontenerze; hash liczyć z jednoznacznie wskazanych bajtów, bez parsowania/reformatowania RAW. Autorytatywne odczyty mają być spójne: istniejące writery muszą być w udowodnionym spoczynku, kontrola przed/po odmawia przy zmianie. Dwa przejścia same nie tworzą transakcji między magazynami ani nie dowodzą braku wyścigu ABA. Niepełny zakres/RAM, błąd odczytu, utrata Auth lub niemożność dowiedzenia spójności nie mogą dać „pełna kopia OK”.
7. **Weryfikacja poza źródłową przeglądarką.** Ponownie otworzyć rzeczywiście pobrany plik na zaufanym komputerze, niezależnie zweryfikować długości/hash całego pliku i każdej pozycji, zgodność z manifestem źródła, liczbę i relacje wszystkich potrzebnych domen; uszkodzony/ucięty plik musi odmówić. Manifest opisuje zakres, nie dowodzi sam, że niczego nie pominięto. Potem izolowana próba odtworzenia/domenowego odczytu bez prawdziwych writerów/Firebase LIVE, bez seedowania, normalizacji lub przeliczania historii. Uprawnienia uzyskać niezależnie, nie z kopii. Chronić kopię i klucz szyfrowania poza urządzeniem; źródło pozostaje nietknięte. Nie używać obecnego restore na źródłowym telefonie jako „testu kopii”.
8. **Minimalna późniejsza interwencja.** Po dowodzie największego klucza, kompletnej prywatnej kopii i osobnej zgodzie na dokładny zakres najpierw rozważyć usunięcie wyłącznie potwierdzonego odtwarzalnego cache, jeżeli to daje potrzebną przestrzeń. Jeżeli problemem jest archiwum backupów, zachować wszystkie wartościowe wersje poza telefonem i udowodnić recovery przed przeniesieniem wskazanych kopii. Jeżeli klucz ma nieustaloną semantykę lub jedyne dane biznesowe — STOP, bez czyszczenia. Nie ustalać potrzebnej rezerwy na podstawie samego szacunku 137162 jednostek. Istniejące `compactBackupStore()` / `prepareForSnapshotWrite()` nie są bezpiecznym zamiennikiem tej procedury: mogą usuwać techniczne kopie i historyczne backupy (tryb aggressive ogranicza również listę chronionych do trzech), a `writeRawShrinking()` po błędzie usuwa klucz przed ponownym zapisem; przy drugiej odmowie grozi utrata archiwum. Nie wywoływać też generowania nowej WYCENY jako sposobu uruchomienia maintenance. Nie zmieniono tych mechanizmów w tym zadaniu.
9. **Powrót do edycji dopiero z dowodem sesji.** W tym samym dokumencie istniejący retry pierwszego begin może działać wyłącznie przy oryginalnym niezmienionym baseline, kontekście właściciela i braku nowszej niepotwierdzonej rewizji. Po utracie RAM/restarcie nie wolno przyjmować tego uprawnienia z kopii ani zgadywać B/E. Brak dowodu zachowuje blokadę; plan nie obiecuje odzyskania telefonu. Zapisz/Anuluj, C=B/E/konflikt oraz wszystkie pozostałe RAW wymagają późniejszej celowanej weryfikacji na danych syntetycznych i świadomej kontroli właściciela.

### Obowiązkowy osobny tor strategiczny

Właściciel zatwierdził wymaganie **POST-CLOUD-STORAGE-RESILIENCE**: po działającej bezstratnej synchronizacji i odpowiednich etapach LOCAL-FIRST osobny priorytetowy pakiet trwałej odporności telefonu/tabletu/komputera na wieloletni przyrost danych. Nie odkłada to pilnego ratowania Pixela. [ROADMAP](../../ROADMAP.md#post-cloud-storage-resilience--trwała-odporność-pamięci-urządzeń) określa miejsce i zależności; [CLOUD_MIGRATION](../../CLOUD_MIGRATION.md#post-cloud-storage-resilience--wymaganie-z-24102026) zawiera rekomendowaną architekturę, ochronę offline i przyszłe kryteria. Nie wdrożono jeszcze polityki miejsca, migracji IndexedDB ani archiwum. Synchronizacja sama nie zwalnia localStorage i nie potwierdza niezależnej kopii ratunkowej.

**Historyczny stan przygotowania dokumentacji przed wydaniem PR #81: ANALYSIS_READY / DOCS_READY / CODE_UNCHANGED / PHONE_DATA_UNCHANGED / CI_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED.** Ówczesny pakiet obejmował tylko dokumentację; bieżącą implementację diagnostyki i jej odrębne blokady opisano powyżej. Wszystkie istniejące bramki Auth, Rules, CAS, sesji i Firebase LIVE pozostają bez zmian.

## CLOUD-SYNC-1 — globalne dane A → emulator → B

Na gałęzi `cloud-sync-1-global-data`, BASE `7faf4f097b6be0a8a0edcce922561e6632d9707c`, powstał izolowany koordynator istniejącego CLOUD-3: RAW kompletu 14 domen → immutable/CAS → niezależny odczyt i kontrola zawartości → atomowy magazyn pamięciowy B. Brak połączenia LIVE, startupu/UI, zapisu do prawdziwego localStorage, migracji i zmian WYCENY. Chroni lokalne zmiany, duplikaty i niepewny ACK; nieznane niezatwierdzone pola odmawiają bez usuwania. 14 nowych scenariuszy rzeczywistych SDK/emulatorów podłączono do istniejącego CI, lokalnie niewykonane (brak zależności). 5 celowanych kontroli granic PASS, pełna weryfikacja **CI_PENDING**. Implementacja **CODE_READY**, wydanie niewykonane, **LIVE_BLOCKED**. [API, pokrycie i ograniczenia trwałości](../../tools/reports/cloud-sync-1-global-data.md).

CLOUD-4.6F pozostaje osobnym przygotowaniem prywatnego operatora: **OPERATOR_PARTIAL / LIVE_BLOCKED**; nie jest zależnością wykonania testów produktu na emulatorach.

## CLOUD-4.6E — prywatne połączenie operatora, bez wykonania LIVE

Dodano odrębne wejście wymagające sześciu podpisanych decyzji właściciela, przypiętego pakietu/UID/Rules, rzeczywistych prywatnych bajtów rollbacku i świeżych końcowych dowodów. Łączy dwa konteksty Firebase Google Auth/Web SDK oraz dwa backendowe konteksty administracji/weryfikacji z istniejącą orkiestracją 4.6D. Trwały journal i ścieżka recovery nie otwierają ponownego WRITE. Import, aplikacja i CI nie aktywują produkcji; stare `executeProduction()` nadal odmawia. PR [#77](https://github.com/mebleszek/meble-app/pull/77) wydany do main `7faf4f097b6be0a8a0edcce922561e6632d9707c`; właściciel potwierdził Preflight, SDK/Rules, auto-merge i Pages PASS. CLOUD-4.6E: **RELEASED / LIVE_BLOCKED**. [Kontrakt, prywatne wejście i bramki](../../tools/reports/cloud-4-6d-live-execution-preparation.md#cloud-46e--połączenie-operatora).

## CLOUD-4.6D — wydany kandydat produkcyjny

PR [#76](https://github.com/mebleszek/meble-app/pull/76) wydany do main `4b8ef922a4596372eba4a48b52de1bdff6585f4f`; właściciel potwierdził SUCCESS CI, auto-merge i Pages. CLOUD-4.6D: **RELEASED / LIVE_BLOCKED**. Historyczne CI_PENDING w raporcie opisuje stan sprzed tego wydania.

## CLOUD-4.6C — izolowany wykonawca, bez aktywacji LIVE

Pakiet na bazie `af75be7201f3941c639bb41e5fa0e296a5720ae8` przygotowuje pełny cykl stage/activate → jedna próba syntetycznego WRITE → niezależny READ → administracyjny STOP → niezależne potwierdzenie wyłącznie na `demo-meble-app` i emulatorach. Używa istniejących walidatorów, CAS i operatora CLOUD-4.4. Adapter/launcher produkcyjny nie powstał; `executeProduction()` nadal bezwarunkowo odmawia. Regresje dołączono do skryptu istniejącego CI, bez zmiany workflow. PR [#75](https://github.com/mebleszek/meble-app/pull/75) wydany do main `fd36b2e6fee433c92676d7619dc672d4361d9d59`: według potwierdzenia właściciela pełny Preflight, SDK/Rules, auto-merge i Pages SUCCESS. Status 4.6C: **RELEASED / LIVE_BLOCKED**; ten PASS nie dotyczy nowego HEAD 4.6E. [Pliki, wykonane kontrole, wymagane CI i niezamknięte bramki](../../tools/reports/cloud-4-6c-isolated-executor.md). LOCAL-FIRST i wszystkie dane biznesowe pozostają poza zmianą.

## LOCAL-FIRST

**Decyzja właściciela z 21.10.2026, baza main `94145f57ff59a19d54c4f8511e527e75b3b04c08`: LOCAL-FIRST + AUTOMATYCZNA SYNCHRONIZACJA + JEDEN AKTYWNY EDYTOR NA PROJEKT + BEZPIECZNA PRACA OFFLINE. To wymagania przyszłe, NIE działające funkcje.** Pełny kontrakt ma jedno źródło w [CLOUD_MIGRATION.md](../../CLOUD_MIGRATION.md#local-first); [ROADMAP](../../ROADMAP.md#local-first) określa zależności, bramki i przyszłą akceptację.

| Zatwierdzony cel | Obecny stan / granica |
|---|---|
| Potwierdzony lokalny zapis i trwała kolejka w IndexedDB, potem automatyczna synchronizacja. | Projekty nadal zapisuje istniejący kanoniczny `fc_projects_v1` w localStorage. Nie wdrożono biznesowej bazy IndexedDB, kolejki ani migracji. Techniczny IndexedDB profilu dostępu nie jest magazynem projektów. |
| Jeden edytor projektu na telefonie/tablecie/komputerze, inne urządzenia read-only; bezstratne przekazanie. | Lokalne sesje i Auth lease nie są blokadą między urządzeniami. Potrzebny przyszły protokół wyłączności i ochrony pracy offline; samo wygaśnięcie lease nie uzasadnia przejęcia. |
| Offline po przygotowaniu aplikacji, projektu i zależności; zatwierdzone zmiany zachowane po restarcie. | Nie wdrożono uruchamiania biznesu offline ani polityki dostępu offline; obecny gate Google wymaga potwierdzenia serwerowego. Nie obchodzimy go i nie przedłużamy TTL. |
| Osobne potwierdzenia lokalne, chmurowe i gotowości offline dla urządzenia/wersji; pomocnicze „Dostępny offline”. | To przyszły UX; UI pozostaje bez zmian. Chmura nie dowodzi aktualnej kopii wyłączonego telefonu. Urządzenie bez danych offline nie może udawać najnowszego projektu. |
| Kompletne zależności WYCENY/ROZRYSU i bezpieczna pamięć. | Sam syntetyczny projekt nie przenosi katalogów/stawek. Nierozstrzygnięte Issue #47, globalne słoje, legacy i drafty pozostają chronione według rejestru. IndexedDB też może utracić dane; bez kasowania jedynej niesynchronizowanej kopii ani arbitralnej retencji projektów 7/30 dni. Istniejących backupów nie zmieniono. |
| Tymczasowy podgląd klienta na żywo, odwoływalny i read-only. | Jeszcze niewdrożony, osobny przyszły zakres. Bez ujawniania wewnętrznych kosztów i danych firmy bez zgody. |

Nie uruchomiono tu testów synchronizacji ani offline: [dziesięć scenariuszy](../../CLOUD_MIGRATION.md#kryteria-przyszłej-akceptacji) to **kryteria przyszłej akceptacji, NIEWYKONANE**, nie odziedziczone PASS pilota. Zachowujemy jeden model projektu, Zapisz/Anuluj, projektowe PCV z jednym zapasem 10%, ROZRYS 4/3/6, cenniki/katalogi/magazyn, kompatybilność i zamrożoną historię ofert. Nie wykonano migracji, importu ani zmiany lokalnego autorytetu.

**CLOUD-4.6 pozostaje osobnym, przyszłym etapem kontroli gotowości Firebase LIVE.** Dokumentacja nie aktywuje transportu i nie otwiera Bramki 2; przygotowanie CLOUD-4.4 nie oznacza działającej synchronizacji. Status tego pakietu: **`CODE_READY / CI_PENDING / LIVE_BLOCKED`**. Bez PR, wydania, operacji produkcyjnych i zmian AGENTS, pinów, kodu, testów lub workflow. Starsze decyzje poniżej zachowują historię; w kwestiach docelowego autorytetu i offline pierwszeństwo ma kontrakt z 21.10.2026.

## WSPÓŁPRACA — ChatGPT obsługuje zatwierdzone PR Ready (2026-10-21)

Właściciel ustanowił wąski wyjątek operacyjny od zakazu zmian GitHuba przez ChatGPT: po każdorazowej osobnej zgodzie na konkretną próbę wydania i ustalone HEAD/BASE SHA ChatGPT może samodzielnie utworzyć jeden PR Ready przez GitHub oraz odczytowo kontrolować CI, auto-merge i Pages. Nie programuje, nie zmienia commitów, gałęzi ani workflow i nie wykonuje ręcznego merge ani operacji Firebase. Domyślnie Codex kończy pracę na gałęzi i commicie, oszczędzając limit. Szczegóły i warunki STOP: [AGENTS.md §12 i §14](../../AGENTS.md). Zmiana zasad w tym pakiecie: `CODE_READY` / `CI_PENDING` do osobno zatwierdzonego wydania; Firebase: `LIVE_BLOCKED`.

## CLOUD-4.5 — kontrakt współpracy i testowania, wydany (2026-10-21)

PR #72 został automatycznie scalony po PASS CI (Preflight 139/139 smoke, APP 110/110; Firebase SDK/Rules 71 PASS), a GitHub Pages potwierdził dokładny merge SHA `cbc6a30122f4926e057282d88800726b715d8aec`. CLOUD-4.5 trwale rozdzielił odpowiedzialność: ChatGPT prowadzi projekt i doradza biznesowo, Codex implementuje, GitHub Actions wykonuje testy CI, właściciel zatwierdza wydania i testuje fizyczny telefon. Obowiązuje [AGENTS.md §3, §10 i §12–14](../../AGENTS.md): bez dublowania pełnych testów lokalnych. Poniższe raporty CLOUD-4.4 i wcześniejszych etapów są historyczne. Status: `RELEASED` / `LIVE_BLOCKED`; nie aktywowano produkcyjnego Firebase.

## CLOUD-4.4 — zintegrowane przygotowanie, produkcja STOP

Gałąź `cloud-4-4-gate2-technical-preparation` łączy main `a1f334df` z CLOUD-4.3/4.3a/4.3b i dokładnym §14 AGENTS. Narzędzia offline rozdzielają zgodę przygotowawczą od wykonawczej; emulatorowy operator sprawdza jedną próbę, niezależny odczyt i administracyjny STOP. Nie otwarto loadera LIVE ani żadnej bramki produkcyjnej. Prywatne 635 B nie zostały przekazane do tej próby, ochrona publikacji Rules przed innymi administratorami nadal wymaga dowodu. [Mechanizmy, wyniki i blokery](../../tools/reports/cloud-4-4-gate2-technical-preparation.md). To stan gałęzi, nie scalenie ani wydanie.

## CLOUD-4.3b — Bramka 1 Rules PASS, baseline zatwierdzony tylko do PRZYGOTOWANIA (2026-10-20)

Właściciel wykonał dwa GET Firebase Rules (oba HTTP 200) i potwierdził 635 B UTF-8 / SHA-256 9260ebcd881e5a0cc2302e768f14e2e8152637093de071449ea90211461ffa91 wraz z metadanymi. Osobnym, wyraźnym TAK zatwierdził ten baseline WYŁĄCZNIE do przygotowania Bramki 2. Historyczny przypięty rekord 4.3a jest niezmieniony; nowy rekord zgody i publiczny smoke wyraźnie oddzielają przygotowanie od wykonania. Historyczne baselineApprovedForGate2:false w nieaktywnym loaderze nadal blokuje LIVE; nie znosi to późniejszej zgody na samo przygotowanie.

Baza prac: CLOUD-4.3a 965544c861d203b372d179c3a3fcf2ac3106e950. Zweryfikowany main a1f334df824c10bb54384f7c00eb77b661f9d1b0 zawiera PR #70 (dokument odczytów), ale CLOUD-4.3/4.3a nie są w main. Żadnego wdrożenia Rules, grantu, produkcyjnego IO, migracji ani PR Ready. [Raport CLOUD-4.3b](../../tools/reports/cloud-4-3b-gate1-closure.md). Wpisy poniżej są historyczne.


## CLOUD-4.3a — historyczny baseline Rules, Bramka 1 nadal STOP

Baza gałęzi `cloud-4-3-live-readiness-refresh`: `2f2704a3239fc58fabf375dcab43edbd78680cfe`.
Właściciel dostarczył oryginalne źródło i metadane dwóch odczytów REST z 20.10.2026:
produkcja Auth-only to 635 B / SHA `9260ebcd…ffa91`, odrębne od template 755 B
`fd92cffa…10cd3` i minimalnych Rules `eaeb3e67…a2e92`. Nie pobierano produkcji ponownie.
Nowe kontrole sprawdzają pełną tożsamość release/rulesetu i bajty; zgodność nie
zalicza Bramki 1 ani nie zatwierdza baseline dla Bramki 2. Pełne źródło jest prywatne.
[Raport, migracja konsumentów i plan dokładnego rollbacku](../../tools/reports/cloud-4-3a-production-rules-baseline.md).

## CLOUD-4.3 — aktualizacja gotowości, bez aktywacji LIVE (2026-10-20)

Baza `44b5be9b1e05eded8243b9a617f976e44ad49c6f`; CLOUD-4.1/4.2 i późniejsze
naprawy są już w main. Starsze nagłówki poniżej zachowują historię, nie oznaczają
ponownego otwarcia tych etapów. Pakiet operatora pozostaje nieaktywny.
Przegląd 423 pierwotnych pinów: 35 zmian, 388 bez zmian, 2 nowe moduły; wszystkie
425 hashy były już zgodne z main. Nowy rejestr wiąże pochodzenie i ocenę kontraktów
z tą bazą, bez zmiany kodu aplikacji i Rules.
[Dowody, testy, pięć osobnych bramek i ograniczenia](../../tools/reports/cloud-4-3-live-readiness-refresh.md).
Gotowość kodu nie jest zgodą na produkcyjne odczyty, deploy, grant ani roundtrip.

## Rozmiar sesji i niepotwierdzony wskaźnik — pakiet po main `0cb7044`

Zweryfikowany main: `0cb7044e5feec71d462354efc501dc9e4278cdb6`; poprzednia
diagnostyka sesji jest już w tej bazie, jej nagłówki robocze poniżej są historią.
`fix/session-begin-storage-proof` odtwarza natywny QuotaExceededError dla
snapshotu całego magazynu i niezależny fałszywy latch po odmowie zbędnego
zapisu tego samego currentProjectId. Nowa sesja v4 zachowuje pełnego właściciela,
nie cudze projekty; potwierdzony wskaźnik nie wymaga ponownego zapisu.
Stare payloady/guardy i niepewne zapisy pozostają chronione; bez migracji,
czyszczenia, rollbacku ani gwarancji rozpoznania konkretnej przyczyny na Pixelu.
[Pomiary, reprodukcje i ograniczenia](../../tools/reports/session-storage-pressure-fix.md).
Regresje 13/17 → 17/17, natywna quota/Chromium 6/6, mobilne scenariusze
biznesowe 13/13 i diagnostyka 6/6 PASS. Auth 37/37 i main-login 36/36 PASS.
Końcowy PRE-FLIGHT PASS: 136/136 smoke, APP 110/110, składnia 579/579.
Bez PR, merge, Pages i Firebase LIVE.

## Diagnostyka zablokowanej sesji w aplikacji — bez wydania

Kontynuacja `fix/durable-session-recovery` po `47d20b0`, baza main nadal
`3332ac8e059a73430d3d40518caebb359a8728e8`. Właściciel zgłosił brak skutecznego
wyniku bookmarkletów na Pixelu; nie są już zalecaną ścieżką diagnostyki.
Przy błędach sesji dodano jawny przycisk **Diagnostyka sesji**, dostępny w tym
samym modalu. Raport anonimowy pojawia się na ekranie, na nieprzezroczystym
tle; kopiowanie jest opcjonalne. Istniejący gate Auth pozostaje obowiązkowy.
Kolektor jest wspólny dla aplikacji i wcześniejszych testów, bez drugiej kopii
reguł dowodu. Diagnostyka nie zapisuje danych, nie usuwa payloadu i nie
odblokowuje sesji. [Zakres, testy i instrukcja](../../tools/reports/initial-session-retry-recovery.md#diagnostyka-sesji-w-aplikacji--kontynuacja-po-47d20b0).
Na Pixelu funkcja będzie dostępna dopiero po osobno zatwierdzonym wydaniu.
Weryfikacja: kolektor 15/15, nowe regresje 6/6, mobilna diagnostyka 6/6,
dotychczasowe scenariusze mobilne 13/13 i granica logowania 36/36 PASS.
Końcowy PRE-FLIGHT PASS: 135/135 smoke, APP 110/110, składnia 577/577.
Bez PR, merge, Pages i Firebase LIVE.

## Ponawianie pierwszego zapisu sesji — gałąź robocza po PR #67

Zweryfikowany GitHub main: `3332ac8e059a73430d3d40518caebb359a8728e8`.
`fix/durable-session-recovery` naprawia odtworzoną pętlę po przejściowej awarii
pierwszego zabezpieczenia sesji: jawne działania ponawiają istniejący `begin()`
wyłącznie przy zachowanym pierwotnym dowodzie RAM i niezmienionym projekcie.
Nie potwierdzono tożsamości tego mechanizmu z incydentem Pixela; prawdziwe
konflikty i uszkodzone snapshoty pozostają zablokowane.
[Dowody, zakres, testy, ograniczenia Auth i plan bezstratnego odzyskiwania](../../tools/reports/initial-session-retry-recovery.md).
Bez wydania, usuwania sesji na ślepo, migracji danych i Firebase LIVE.

Uzupełnienie po `81d85fb`: pełny restart z istniejącym payloadem potwierdził,
że brak flagi RAM nie blokuje poprawnego trwałego dowodu. Utrata utrwalenia
nowej rewizji oraz rzeczywisty konflikt pozostają bezpiecznie zablokowane.
Dodano regresje i kontrakt diagnostyki Androida bez USB w powyższym raporcie;
bez nowej zmiany kodu produkcyjnego i bez gwarancji odblokowania Pixela.

Jednorazowa diagnostyka bez USB jest teraz przygotowana w
[tools/diagnostics](../../tools/diagnostics/README.md): bookmarklet z kontrolą istniejącego
Auth, wyłącznie odczytem danych aplikacji i anonimowym wynikiem w schowku.
Regresje 15/15, wykonanie adresu `javascript:` w mobilnym Chromium 7/7;
fizyczny Pixel nie został przetestowany. To obserwacja, nie mechanizm odblokowania.

## Wydajność WYCENY i odnowienie dostępu — pakiet roboczy po PR #66

Aktualna baza GitHub main `764d0852b7232b28e6920a36ca26d50ec5e1a3e3` zawiera PR #65 i #66;
starsze nagłówki przygotowania tych napraw poniżej pozostają historią.
Gałąź `fix/quote-performance-auth-renewal`: jedno obliczenie przy zmianie samej nazwy,
współdzielenie synchronicznych odczytów PCV z kontrolą niezmienności, obsługa nowego gestu
mobilnego oraz zachowanie odmowy gate przy wtórnym błędzie lazy loadera po wygaśnięciu.
9 szafek: mediana rzeczywistego przebiegu Chromium 36,045 → 3,192 s; 24/24 kalkulacje identyczne.
[Raport, ograniczenia pomiarów i blokada dwóch testów popup Auth](../../tools/reports/quote-performance-auth-renewal.md).
Bez PR/merge/Pages i LIVE; pełna gotowość wymaga usunięcia blokady środowiskowej Auth.


## Odzyskiwanie statusu i pełny cykl ofert — gałąź robocza po PR #65

GitHub potwierdził scalenie PR #65 do main `0ae7d1a24091d4a57460bacc9d30b9ea386f5b35`;
wcześniejszy opis przygotowania tej poprawki poniżej jest historyczny. Naprawy kontekstu pozostają.
Gałąź `fix/offer-status-recovery-lifecycle` usuwa potwierdzoną blokadę starej intencji `offerStatus`
przez zgodność dwóch opcjonalnych wartości domyślnych luster, bez usuwania zabezpieczeń.
Nie tworzy pustych intencji; przed zakończeniem ponownie potwierdza wszystkie cele i fizyczny pokój.
[Reprodukcje, pełny cykl ofert, wyniki i ograniczenia](../../tools/reports/offer-status-recovery-lifecycle.md).
To lokalnie testowany pakiet bez PR/merge/Pages, importu eksportu właściciela i Firebase LIVE.


## Spójność kontekstu po PR #64 — gałąź robocza

Baza main `431545d364b47ee4d0cf8efed7d9e478d43ebe8d`, gałąź `fix/project-context-coherence`.
Aktywny rekord i RAM zastępują heurystykę bogatszej kopii/override. Render i diagnostyka WYCENY
nie naprawiają trwałych danych; historyczne snapshoty nie są automatycznie przepinane.
Przebieg obliczenia jest związany z inwestorem, projektem, rewizją, zakresem i stanem sesji;
zmiana po await odrzuca wynik. Świeży błąd pozostaje widoczny w swoim kontekście.
[Zakres, dowody, wyniki i granice potwierdzenia incydentu](../../tools/reports/project-context-coherence-fix.md).
To przygotowanie gałęzi do osobnej decyzji o wydaniu, bez PR/merge/Pages i Firebase LIVE.
Starszy opis gałęzi PR #64 poniżej zachowano jako historię.

## Naprawa RAM/PCV i generowania WYCENY — gałąź po PR #63

Baza `4d8dd96df9f293276dee07dc0c4cedf26edac08c`, gałąź `fix/pcv-ram-quote-generate-android`.
Istniejące `window.projectData` jest aliasem globalnego wiązania `projectData`, więc zapis nie pozostawia starszego RAM dla PCV.
Opóźniony autosave nie zapisuje projektu w widokach obliczeń ROZRYS/WYCENA; odmowa nowej WYCENY pozostaje widoczna przy istniejącej historii.
Kontrole PCV, sesje, kanoniczny rekord i zamrożone oferty pozostają obowiązujące. CLOUD-4.2 nadal jest nieaktywnym przygotowaniem.
[Reprodukcje, zakres, testy i krótka akceptacja Androida](../../tools/reports/pcv-ram-quote-generate-android-fix.md).
To stan gałęzi roboczej, bez PR, wydaniowego CI, merge i Pages.

## Aktualizacja po PR #62 — CLOUD-4.1 scalone, CLOUD-4.2 w przygotowaniu

GitHub potwierdził merge PR #62 do main `d517d598917e5ccd6f1460950697c9ab27f1db1c`,
wydaniowe CI i Pages SUCCESS. CLOUD-4.1: 13/13 live-readiness, 10/10 prywatny pilot,
71/71 SDK, 3/3 startup, 38/38 Chromium, Preflight PASS, bez pominięć.
Starsze nagłówki o blokadzie poniżej są zapisem historycznym sprzed weryfikacji.
CLOUD-4.2 przygotowuje pakiet offline i próby emulatorowe przyszłego LIVE na osobnej
branży, bez produkcyjnych Rules, grantów, zapisów, odczytów ani zmiany UI/autorytetu.
[Artefakty, bramki zgody, procedura i statusy](../../tools/reports/cloud-4-2-live-pilot-preparation.md).
Aktualny wynik CLOUD-4.2 wymaga zakończonego CI tej gałęzi; nie jest odziedziczonym PASS.

## CLOUD-4.1 — gałąź robocza, weryfikacja emulatorowa zablokowana

Baza `62f80433c28cfd1ed0370618b58db8f4e88fad68` (CLOUD-4 w main). Gałąź `cloud-4-1-private-pilot-execution` przygotowuje prywatny, jednokrotny wykonawca i niezależny odczyt syntetycznego projektu. Operatorska kopia właściciela sesji powstaje tylko w RAM, z kontrolą SHA; produkcyjne `main-login.js`, index, UI, Auth/IndexedDB, modele i Rules pozostają bez zmian. Wykonawca odmawia LIVE przed inicjalizacją Auth i nie jest częścią startupu.

**Nie jest to zakończona weryfikacja ani zgoda na wydanie.** Preflight 125/125 smoke, 555/555 składni, APP 110/110 PASS; emulatorowy roundtrip i pełne Chromium wymagające emulatora nie wykonały się — pobranie oficjalnego JAR jest blokowane przez sieć środowiska (403). Nie przepisujemy historycznych wyników CLOUD-4 jako aktualnych. [Raport, dowody, blokada i procedura późniejszej aktywacji](../../tools/reports/cloud-4-1-private-pilot-execution.md). Nie wykonywano produkcyjnych operacji Firebase ani Ready/merge/Pages.

## CLOUD-4 — przygotowanie pilota, bez aktywacji LIVE

Baza **`0cafb432f18bcd052672aac020d36128155388a7` po PR #60**. Właściciel potwierdził: **PR #60 scalony, CI/Pages PASS, Android zaakceptowany**, cenniki/materiały/okucia zachowane. Pojedynczy pierwszy `AUTH_STARTUP_FAILED` nie ma potwierdzonej przyczyny; nie dodano retry ani przebudowy logowania.

Gałąź `cloud-4-live-pilot-readiness` przygotowuje niezarejestrowany, prywatny kontrakt przekazania istniejącej sesji/lease, izolowane natywne źródło syntetyczne CLOUD-1B, minimalne first-publication-only Rules z Auth-only i singletonem jednego UID oraz procedurę ograniczonego grantu. Testy dotyczą wyłącznie emulatorów i Chromium. Nie ma prywatnego call-site uruchamiającego LIVE w main-login, nowego UI, deployu Rules, grantu, uploadu, synchronizacji ani zmiany lokalnego autorytetu. Globalne dane CLOUD-3 pozostają poza pilotem.

Weryfikacja CLOUD-4: **Preflight 124/124 smoke, 552/552 syntax, APP 110/110 PASS; Emulator Suite 71/71 PASS; Chromium 28/28 PASS**, bez pominięć. Zachowano PCV/jeden zapas 10% i rozkrój 4/3/6. To testy lokalne gałęzi, nie nowe CI/Pages ani produkcyjny roundtrip.

[Raport CLOUD-4: dokładny Rules SHA, źródło, testy, budżet Spark, plan zapisu/odczytu i zatrzymania](../../tools/reports/cloud-4-live-pilot-readiness.md). Przed rzeczywistym uruchomieniem potrzebne są **cztery osobne zgody**: (1) Ready/auto-merge/Pages kodu, (2) deploy dokładnych Rules, (3) administracyjny grant syntetycznego scope, (4) pierwszy zapis i niezależny odczyt przez przejrzany prywatny launcher. Żadna zgoda nie obejmuje automatycznie kolejnej.

## CLOUD-3 — scalone PR #60, bez przełączenia autorytetu

Weryfikacja lokalna gałęzi: Preflight **123/123 smoke, 547/547 syntax, APP 110/110 PASS**; Emulator Suite **58/58 PASS**; Chromium **28/28 PASS**, kontrakty globalne **13/13 PASS**, bez pominięć. Zachowano PCV/jeden zapas 10% i 4/3/6 arkuszy. To wyniki lokalne, nie nowy CI/merge/Pages.

Baza `65085d18` po PR #59. **PR #59 scalony: CI PASS, auto-merge PASS, Pages PASS, Android zaakceptowany przez właściciela.** Główne Google Auth i produkcyjny profil Auth-only działają; nie wdrożono biznesowych Rules ani synchronizacji.

CLOUD-3 przygotował nieaktywne, niezarejestrowane kontrakty 14 domen globalnych, RAW capture bez normalizacji, rekordy immutable i grupowy manifest CAS, niezależny odczyt oraz prywatną granicę pożyczenia istniejącej sesji Firebase. Tylko emulatory i dane syntetyczne; brak zmian startupu, UI, lokalnych setterów, IndexedDB właściciela, katalogów użytkownika, ofert lub kalkulatorów. Globalne słoje/legacy overrides/drafty pozostają poza transferem. **Nie jest to uruchomiona synchronizacja między urządzeniami.** [Dokładny kontrakt, testy, koszty i brakujące zależności](../../tools/reports/cloud-3-global-data-foundation.md).


## CLOUD-2B.4a + techniczne CLOUD-2C — scalone PR #59, LIVE nadal nieaktywny

**Rozszerzenie pakietu zatwierdzone przez właściciela:** naprawiono wyścig dopuszczenia profilu przez transakcyjny rekord właściciela IndexedDB (`meble-access-profile-v1`, store `ownership`, klucz `owner`). Stan pending nie daje dostępu; poprawny v2 przechodzi bez przepisywania danych, nowe powiązanie v3 nie jest samodzielnym uprawnieniem. Usunięto produkcyjny przycisk/wyświetlanie UID, zachowując wewnętrzną autoryzację. Końcowa weryfikacja: Emulator Suite **41/41**, Chromium **28/28** (w tym 100 prób bez podwójnego dopuszczenia), profil **36/36**, pełny Preflight **PASS** (543/543 składnia, 122/122 smoke, APP 110/110), syntax/diff check PASS. Bez zgody na Ready/merge/Pages lub Firebase LIVE.

Baza: `6c5ca364` po PR #58 (obowiązujące AGENTS §13). **CLOUD-2B.3 jest scalone w PR #57 (`90bd5349`), CI i Pages PASS, Android zaakceptowany; produkcyjny profil Auth-only działa** — status potwierdzony przez właściciela. Starsze opisy „bez publikacji” / „deny-all całej bazy” dotyczą poprzednich etapów. Biznesowe Rules, grant uploadu, synchronizacja i chmurowy autorytet projektu nadal nie są wdrożone.

Ten pakiet przygotowuje niezarejestrowany adapter pożyczający istniejące App/Auth/Firestore oraz niezależny odczyt manifestu, rewizji i fragmentów do RAM z pełną walidacją CLOUD-1B. Zapis/odczyt sprawdzamy wyłącznie na syntetycznych danych i emulatorach. Adapter LIVE nie należy do manifestów; dotychczasowe `create({target:'live'})` nadal odmawia. Rozszerzenie zmienia wyłącznie kontrolę lokalnego profilu w istniejącym logowaniu i usuwa kontrolkę UID; nie zmienia Google Auth, danych biznesowych, Rules ani grantów. **To techniczne przygotowanie CLOUD-2C, nie produkcyjne zakończenie odczytu ani zgoda na upload.** [Kontrakt, testy i ograniczenia](../../tools/reports/cloud-2b4a-technical-2c.md).

## Historia przygotowania CLOUD-2B.3 — opis sprzed scalenia PR #57

Baza: main po PR #56. Użytkownik potwierdził istnienie dwóch administracyjnych dokumentów dostępu; nie tworzymy ich ponownie, produkcyjne Rules nadal deny-all. Gałąź `cloud-2b3-main-login` przygotowuje jeden ekran pod `index.html`, serwerową autoryzację oraz loader biznesu dopiero po zgodzie. Nie wdrożono Rules, synchronizacji ani zmian danych. **Właściciel zatwierdził dostęp do swojego istniejącego profilu.** Przygotowano jednorazowe dopuszczenie po świeżej autoryzacji serwerowej, potwierdzeniu zachowania kopii i świadomej zgodzie właściciela. Zapisuje dowód `meble_access_profile_v1` w wersji 2 oraz techniczną blokadę `meble_access_profile_pending_v1` do czasu potwierdzenia operacji, bez przepisywania `fc_*` lub aliasów. Niedokończona próba pozostaje zablokowana również po restarcie; stary dowód v1 wymaga ponownej zgody. Nowy pusty profil nadal wymaga potwierdzonego proofu. Publikacja i Rules pozostają osobno zatwierdzane; kopię trzeba wykonać przed publikacją, a akceptację Android — po uzgodnionym wdrożeniu. [Raport, ograniczenia, procedura Rules i rollback](../../tools/reports/cloud-2b3-main-login.md).

Data przeglądu danych i integracji: **2026-10-15**
Baza dokumentacji: **`98fffb87` — main po PR #49**; baza kodu przed CLOUD-1B: **`f3b6905e` — po PR #46**. Nie wykonywano ponownego audytu całej logiki biznesowej; niezwiązane rozdziały zachowują wcześniejszy kontekst.

## Po co jest ten plik

Ten dokument ma być krótką, aktualną odpowiedzią na pytanie: **„jak program działa dzisiaj i co jest już zrobione?”**. Nie zastępuje historii w `DEV.md` ani szczegółowych kontraktów w `CLOUD_MIGRATION.md`, `QUOTE_CALCULATION_REGISTER.md`, `BACKUP.md` i `DEPENDENCY_MAP.md`.

Przy kolejnych pracach najpierw czytać ten plik i `ROADMAP.md`. Historyczne wpisy w `README.md`/`DEV.md` traktować jako tło, a nie automatycznie jako listę rzeczy nadal do zrobienia.

---

## 1. Skala i architektura

Aplikacja przeglądarkowa bez frameworka/bundlera, moduły classic-script w `window.FC`, publikacja statyczna. Na bazie main po PR #46: **824 śledzone pliki**, **524 JS**, **261 Markdown**, **394 domenowe JS** w audycie zależności, **318** skryptów index.html i **346** dev_tests.html. CLOUD-1A dodaje jeden dokument rejestru; liczby odnoszą się do bazy.

Projekt jest jednym fizycznym rekordem `fc_projects_v1`, z investorId i wieloma pokojami w projectData. Lista pomieszczeń inwestora jest powiązaną projekcją. RAM to stan roboczy, nie drugie trwałe źródło prawdy. `derivedFacts` jest odtwarzalnym cachem usuwanym z kopii do zapisu.

## 2. Kontrola składni i zależności

Aktualny preflight obejmuje składnię wszystkich JS, load order, wszystkie `tools/*-smoke.js`, audyt zależności i storage. Ponowne uruchomienie dla CLOUD-1A: **PRE-FLIGHT PASS**, składnia **524/524**, load order **318**, smoke **118/118**, APP **110/110**, dependency/storage PASS. Szczegóły w [rejestrze](../../CLOUD_DATA_REGISTER.md#9-dowód-pokrycia-audytu-i-weryfikacja).

Wysokie ryzyko nadal dotyczy persistence/sesji, WYCENY/historii, katalogów i ROZRYSU; RYSUNEK pozostaje osobnym długiem, bez refaktoru w CLOUD-1A. `TEST_BASELINE.md` opisuje także dawną paczkę i nie zastępuje aktualnego wyniku preflightu.

## 3. Testy i ukończone fundamenty

Nie obowiązuje już stary baseline 66/76 z 10 FAIL. W main są pełny preflight i CI, zabezpieczenia C3.1 globalnych zapisów, pokojowa sesja/nawigacja C2.0b, bezdestrukcyjny odczyt wyjątków C2.1a, stabilne role/grupy formatek i geometria frontów, projektowe PCV oraz adaptery obliczeń i ochrona nowego kandydata oferty.

PR #40 uruchomił UI PCV; #43 automatyzował tryb projektu; #45 przywrócił wspólne Opcje; #46 naprawił fałszywy konflikt updatedAt po autosave. Są **scalone**, nie otwarte propozycje. Diagnostyka i symulowany DOM nie dowodzą ręcznej akceptacji na telefonie. Użytkownik obecnie ręcznie testuje Androida; tablet/komputer pozostają platformami docelowymi.

Regresje referencyjne: **16,440 → 17,122 → 18,834 mb**, fronty **5,010 → 5,511 mb**, jeden zapas PCV 10%, wielopomieszczeniowy rozkrój **4 / 3 / 6 arkuszy**. Historyczne oferty A/B/A+B zachowują własny zakres i zamrożone wyniki.

## 4. Dane i przygotowanie do chmury

Kanoniczna mapa: [CLOUD_DATA_REGISTER.md](../../CLOUD_DATA_REGISTER.md), zasady etapów: [CLOUD_MIGRATION.md](../../CLOUD_MIGRATION.md). Aktualny audyt to **339** referencji w **41** plikach: **204** test/tooling, **135** poza testami (32 pliki). Mapa obejmuje **46 stałych nazw + 3 dynamiczne rodziny**; to nie liczba wpisów w urządzeniu użytkownika.

- Zapis projektu: durable begin + saveConfirmed + read-back; active owner **projectId + roomId**. Zapis/rollback nie może cofać innego pokoju/projektu. Niepotwierdzona rewizja blokuje kolejne operacje, bez nadpisywania centralnego rekordu starym RAM.
- Nowy projekt od początku używa `projectData.meta.productionPcvMode='project'`; istniejący testowy przechodzi przy bezpiecznym otwarciu. Brak aktywacyjnego przycisku/dialogu i importu globalnych krawędzi. Decyzje PCV są w `projectData[roomId].production`, z niezależnymi rolami elementów/grup i setId.
- Słoje nadal globalne (`fc_material_part_options_v1`), a ROZRYS ma globalne enabled/exceptions. To decyzje produkcyjne z nierozstrzygniętą własnością, nie dowolnie usuwalny cache. Issue #47 dotyczy ich przyszłej przebudowy. `fc_rozrys_overrides_v1` ma dormant API, bez znalezionego aktualnego konsumenta.
- Globalne cenniki, katalogi, słowniki, stawki, magazyn i ustawienia są chronione, zgodne wstecz i **poza pilotem**. C3.1 nie daje automatycznie gwarancji confirmed write wszystkim pozostałym store.
- CLOUD-1A scalono w PR #48, CLOUD-1B scalono w PR #50 (pełne CI i Pages PASS). **Główne logowanie scalono i zaakceptowano w PR #57; synchronizacji NIE wdrożono. Adapter pilota z PR #52 nadal nie uruchamia transportu danych LIVE.** CLOUD-2A: użytkownik wybrał Firebase Spark oraz Google Sign-In, konfigurację konsoli potwierdzono 2026-10-16 (szczegóły poniżej). Pierwszy planowany CLOUD-2B pilot obejmuje tylko fikcyjnego inwestora i fizyczny projekt z pokojami/szafkami/PCV, bez danych globalnych i sekretów. [Projekt techniczny CLOUD-2A](../../tools/reports/cloud-2a-firebase-google-architecture.md).
- CLOUD-1B działa już w `main` jako **wewnętrzny builder RAM**, bez downloadu/uploadu, UI i chmury. Stosuje RAW, zakończoną sesję, SHA-256, limit tylko pilota 800 KiB i kontrolowane syntetyczne dane. Natywne podpisy frontów są walidowane, nie poświadczane kryptograficznie. [Kontrakt](../../tools/reports/cloud-1b-selective-project-export.md).
- Obecny pełny backup fc_* nie jest pilot payloadem: może zawierać ORS apiKey profilu firmy i pomija nieprefiksowane aliasy katalogów. Bez zmian mechanizmu/retencji; rozdzielenie i filtrowanie eksportu wymaga kolejnego zakresu.

> **Poniższa decyzja z 15.10.2026 jest historyczna; docelowy autorytet, statusy i przygotowanie offline doprecyzowuje [LOCAL-FIRST z 21.10.2026](#local-first).** Nie oznacza to zmiany obecnego kodu ani zgody na migrację.

**ZATWIERDZONE 2026-10-15, JESZCZE NIEWDROŻONE:** docelowo chmura jest autorytetem trwałych danych; urządzenia automatycznie otrzymują aktualny stan, zatwierdzone zmiany synchronizują się bez ręcznych operacji i bez zmiany UI. `Zapisz/Anuluj` i izolacja sesji pozostają. Wybrano Firebase Spark / Cloud Firestore oraz uwierzytelnianie Google; identyfikacja po Firebase UID. **Region i działający produkcyjny Auth-only potwierdzono; login/Pages i Android zaakceptowano po PR #57. Biznesowe Rules i model rewizji nadal sprawdzane są wyłącznie na emulatorach.** Przełączenie domen wymaga osobnej zgody, ochrony konfliktów i globalnych danych. Cel: 0 zł stałych opłat, bez podpinania billingu. [CLOUD-2A](../../tools/reports/cloud-2a-firebase-google-architecture.md).

Cztery zatwierdzone ograniczenia **tylko pierwszego testu CLOUD-1B**: odmowa nieobsługiwanych istotnych struktur bez cichej utraty, syntetyczny I/P bez niekontrolowanych notatek, jawny aktywny I/P po zakończonej sesji i potwierdzonym zapisie, 800 KiB bez obcinania. Nie są limitami docelowego produktu. Pełny aktualny kontrakt, wymagania bezpieczeństwa oraz propozycja wpisu do `PROJECT_DECISIONS.md` są w [CLOUD_MIGRATION.md](../../CLOUD_MIGRATION.md). Sam pilotaż nie kończy migracji; obowiązkowe dalsze cele po CLOUD-2C opisuje [ROADMAP.md](../../ROADMAP.md). `PROJECT_DECISIONS.md` nadal jest na osobnej gałęzi PR #41; nie zmieniono jej i nie utworzono konkurencyjnego rejestru.

---

## Historia CLOUD-2B — PR #52, bez biznesowego połączenia produkcyjnego

2026-10-16, baza `5a63cda6`: użytkownik potwierdził Firebase `mebleszek-meble-app`, Spark bez billingu, Google Auth, authorized domain `mebleszek.github.io`, Firestore Standard `(default)` w `europe-central2`, pusta baza i opublikowane deny-all Rules. Nie łączono się z rzeczywistą bazą ani nie zmieniano jej reguł.

PR #52 dodał nieaktywny, jawnie emulatorowy adapter Firebase Web SDK, UID/Google Auth, niezmienne fragmenty i transakcyjny manifest oparte wyłącznie na CLOUD-1B. Rejestracja skryptów nie pobiera SDK, nie loguje i nie wysyła danych. Transport live jest odrzucany. Lokalny projekt pozostaje autorytetem; UI, sesje i kalkulatory bez zmian. Zestaw realnego SDK/Auth/Firestore Emulator Suite jest oddzielny od zwykłego preflightu: **17/17 PASS**; preflight tej gałęzi: **120/120 smoke, 531/531 syntax, APP 110/110, load order 323, dependency/storage PASS**. Zachowano referencje PCV i 4/3/6 arkuszy. Scalenie kodu nie oznacza wdrożenia Rules ani połączenia aplikacji z rzeczywistą bazą. [Raport, ograniczenia Rules, zależności i warunki pierwszego zapisu](../../tools/reports/cloud-2b-firebase-pilot.md).

## Historia CLOUD-2B.1 — dawny kontrolowany test logowania

CLOUD-2B jest już scalony w PR #52 (main `96f43f04`); emulatorowy adapter nie jest połączeniem z produkcyjną bazą. Ta gałąź dodaje odseparowany **`auth-test.html`** i Auth-only SDK, domyślnie bez konfiguracji. Normalny `index.html` i start biznesowy pozostają bez Auth. SDK odtwarza sesję, ale brak weryfikatora serwerowego oznacza stan zalogowany/niezatwierdzony i brak ładowania biznesu. Przygotowano revocable gate; nie aktywowano obowiązkowego logowania. Produkcyjne Rules nadal deny-all; bez uploadu/synchronizacji. [Raport, instrukcja konfiguracji, testy i blokery](../../tools/reports/cloud-2b1-google-login.md). Pełny popup blokuje obecnie sieć Codexa (`apis.google.com`, 403); nie jest to test PASS ani akceptacja Androida.

**Uzupełnienie CLOUD-2B.1a, gałąź `cloud-2b1a-live-auth-config`, baza main `bf81b14c` po PR #53:** powyższy opis pustej konfiguracji i blokady sieci dotyczy poprzedniego etapu. Na tej gałęzi wyłącznie `auth-test.html` otrzymuje publiczny config użytkownika z `target:'live-auth'`. Strona inicjuje prawdziwe Firebase Auth; nie inicjuje Firestore i nie przyznaje dostępu biznesowego. `index.html` pozostaje bez zmian. Nie wykonano scalenia ani publikacji tej konfiguracji. [Instrukcja Androida, aktualne wyniki i wyłączenie testu](../../tools/reports/cloud-2b1a-live-auth-config.md).

## Historia CLOUD-2B.2 — przed wdrożeniem głównej bramki

Gałąź `cloud-2b2-single-user-access`, baza main `9d87b393` po PR #55: wcześniejsze config live i oryginalne logo są już scalone. Ta gałąź podłącza do strony testowej tylko własny dokument kontrolny Firestore, chroniony administracyjnym `appEnabled` w `/authorizedUsers/{uid}` i Google UID. Lista/granty pozostają nieczytelne i niezmienialne dla klienta. Proof wymaga świeżego odczytu transakcyjnego bez zapisów, wygasa po 45 s i jest sprawdzany co 30 s. Powstał osobny, emulatorowo testowany profil Auth-only Rules; **nie wdrożono go ani nie utworzono rzeczywistych grantów**. Produkcyjne Rules nadal deny-all. `index.html`, lokalne dane i Zapisz/Anuluj bez zmian; zatwierdzenie na stronie testowej nie ładuje biznesu. [Model, testy, UID/bootstrap i blokery właściwego loadera](../../tools/reports/cloud-2b2-single-user-access.md).

## 5. WYCENA — obecny kierunek

Centralnym kontraktem jest `QUOTE_CALCULATION_REGISTER.md`.

WYCENA ma już mocno rozwinięte fundamenty „jednej prawdy”:

- centralny rejestr wyliczeń,
- osobne linie materiałów, okuć, robocizny, transportu, wnoszenia i usług,
- snapshoty historii ofert,
- zamrożony model `clientOffer` do podglądu klienta i przyszłego PDF,
- audyt szczegółów oferty,
- `quantitySource` i `conditions` dla robocizny,
- stawki godzinowe i sposoby naliczania ceny,
- montaż AGD,
- transport i ORS,
- wnoszenie/logistyka,
- wymagania techniczne okuć.

Nie należy teraz robić dużego refaktoru WYCENY. Zielony baseline już istnieje; brakujące elementy matematyki wymagają osobnej decyzji, bez zmian przy dokumentacji chmury.

---

## 6. MATERIAŁ / ROZRYS

Projektowe PCV jest wspólnym źródłem krawędzi i metrów dla normalnego MATERIAŁU, ROZRYSU i WYCENY. Resolver rozlicza osobno lewy/prawy bok oraz grupy półek i frontów przed agregacją; planKey i placements zachowują różne krawędzie identycznych części. Projektowy tryb omija trwały legacy cache planu.

Jedno **Opcje → Opcje formatki → Zapisz** zachowuje oryginalną proporcjonalną mapę, PCV i globalne słoje. Koordynator chroni oba zapisy/draft i nie potwierdza częściowego sukcesu. PR #46 pomija jedynie updatedAt rekordu w lokalnym świadku, zachowując prawdziwe konflikty i kody błędów. Przelicz projekt pozostaje.

Otwarta pozostaje własność globalnych słojów/rotacji, część źródeł z sourceIssues i dalsze funkcje odłożone. D1–D6 nie są zbiorczo zamknięte przez projektowe PCV. Historyczne plany OPTIMIZATION_PLAN nie oznaczają ponownej implementacji już scalonych elementów.

---

## 7. Okucia, ceny dostawców i zakupy

Już działa rozbudowany katalog okuć:

- producenci,
- kategorie i parametry techniczne,
- wiele cen / dane dostawców,
- import/export XLSX,
- wymagania techniczne i dobór wariantów,
- rozdzielenie ceny zakupu od ceny do wyceny.

Plan przyszły, jeszcze nieukończony:

1. jasna reguła ceny użytej do konkretnej oferty,
2. snapshot kosztu/ceny w ofercie,
3. lista zakupów po zaakceptowaniu oferty,
4. zatwierdzenie faktycznego dostawcy i faktycznego kosztu,
5. raport **plan vs rzeczywistość / rentowność**.

Zaakceptowana oferta klienta nie może się zmieniać po późniejszej aktualizacji cennika.

---

## 8. Robocizna i „zjadacze czasu”

Model robocizny jest rozwinięty, ale `OPTIMIZATION_PLAN.md` wskazuje jeszcze niepełne obszary czasu pracy.

Priorytet dalszego uzupełniania:

1. montaż frontów, zawiasów, prowadnic/podnośników i regulacja,
2. wycięcia, blendy, trudne wnęki,
3. zamawianie materiałów/okuć i kontrola dostaw,
4. pakowanie, załadunek, sprzątanie,
5. dopiero później rozsądny bufor ryzyka.

Nie dodawać tych kosztów „na oko” bez jawnych źródeł ilości i testów.

---

## 9. Harmonogram / statusy procesowe

Pod przyszły harmonogram istnieje już read-only boundary `FC.projectScheduleStatus`.

Program rozróżnia procesowe kolejki m.in.:

- `Pomiar`,
- `Wycena` / wycena końcowa po pomiarze.

**Właściwy kalendarz/harmonogram nie jest jeszcze gotowy.** Gdy ten etap ruszy, UI powinno czytać istniejące boundary statusów, a nie interpretować historię ofert od nowa.

---

## 10. Kreator nietypowych korpusów

`CABINET_CREATOR_PLAN.md` jest nadal planem, nie ukończoną funkcją.

Kierunek jest ustalony:

- kreator ma być w WYWIADZIE,
- ma tworzyć zwykłą szafkę korzystającą z tych samych materiałów, faktów i WYCENY,
- nie może dostać osobnego systemu wyceny,
- później możliwy zapis nietypowej szafki jako szablonu,
- docelowo potrzebny prosty schemat/rysunek korpusu.

Warunkiem rozpoczęcia jest stabilny model źródeł ilości i WYCENY.

---

## 11. Mieszane fronty / „Szuflady + drzwiczki”

To nadal plan późniejszy.

Docelowy model powinien rozróżniać rolę każdego frontu, np.:

- `drawer` — front szuflady,
- `door` — drzwiczki zawiasowe.

Nie należy budować tego na samych licznikach `frontCount/drawerCount/doorCount`. Najpierw musi być stabilna jedna prawda frontów pomiędzy WYWIAD → MATERIAŁ → wymagania okuć → WYCENA.

---

## 12. RYSUNEK

`js/tabs/rysunek.js` ma ok. **1459 linii** i jest oznaczony jako obszar **„nie ruszać bez osobnego planu”**.

Nie jest obecnie blokadą dla chmury ani WYCENY. Duży refaktor RYSUNKU powinien być późnym, osobnym etapem. Nie należy teraz inwestować w szerokie łatanie starego monolitu tylko po to, żeby zachować jego obecną strukturę.

### Znany dług bezpieczeństwa zapisu — odłożyć do przebudowy RYSUNKU

Audyt zamykający 2B.4 po wdrożeniu MATERIAŁU 6f potwierdził, że obecny RYSUNEK ma ścieżki **mutation-before-durable-begin**:

- helpery takie jak `addFinish()`, `removeFinish()`, `insertGapAfter()` oraz część interakcji RYSUNKU najpierw mutują współdzielone `projectData`, a dopiero potem wywołują `saveProject()`,
- `saveProject()` dopiero później dochodzi do `FC.project.save(projectData)`, więc zabezpieczenie sesji może nastąpić już po zmianie RAM,
- przy awarii durable `session.begin()` zapis centralny może zostać zablokowany, ale RAM może być już zmieniony,
- `ensureLayout()` potrafi normalizować / tworzyć `layout`, wiersze i `finishes` podczas wejścia/renderu, czyli istnieją mutacje niebędące jednoznacznie zatwierdzoną akcją użytkownika,
- `fc_ui_v1` należy do rollback scope; przed przebudową trzeba testem rozdzielić prawdziwe dirty projektu od czysto wizualnego/UI dirty w RYSUNKU,
- moduł nadal miesza render SVG, interakcje, drag/drop, inspektor, listy wykończeń oraz stare `alert/confirm/prompt`.

### Decyzja

Nie tworzyć teraz osobnego patcha typu „6h” naprawiającego wszystkie powyższe ścieżki w obecnym monolicie.

Gdy temat RYSUNKU zostanie świadomie wznowiony:

1. najpierw ustalić docelowy UX i zakres funkcji,
2. zinwentaryzować mutacje danych vs stan czysto wizualny,
3. usunąć / zastąpić systemowe dialogi i wzmocnić testy kontraktowe,
4. dopiero potem rozdzielać render, interakcje i domenę,
5. nowe mutacje budować od początku według kontraktu: **lokalny draft / plan → durable session.begin → trwały zapis → aktualizacja współdzielonego RAM**,
6. nie przenosić automatycznie starych mutacji 1:1 do nowych modułów.

Wcześniejsze paczki przebudowy RYSUNKU nie zostały świadomie przeniesione do stabilnej bazy, dlatego przy przyszłej pracy nie traktować ich jako obowiązującej architektury bez ponownej decyzji.

---

## 13. Oferta klienta / PDF

Podgląd klienta i zamrożony `clientOffer` są już rozwijane.

Finalny PDF jest **świadomie odłożony na koniec**. Powinien renderować ten sam zamrożony model `clientOffer`, bez własnego ponownego liczenia i bez odczytywania bieżącego projektu.

---

## 14. PRO100 / usługi

Import plików PRO100 istnieje i korzysta ze wspólnego parsera dla pliku/wklejki.

Plan późniejszy obejmuje rozpoznawanie dodatkowych operacji (`NUT`, `FREZ`, `ROZCIĄĆ`, `FRONT ZAWIASY`) jako osobny moduł, a nie rozbudowę parsera bazowego bez końca.

---

## 15. GitHub / publikacja

`preflight-js.yml` uruchamia pełny Preflight i `npm test` w `tools/firebase-pilot` przy otwarciu PR Ready do main albo przejściu Draft → Ready. Wymagana jest osobna zgoda właściciela na próbę wydania. Automatyczny merge sprawdza niezmienione HEAD/BASE i stan Ready po PASS; po merge jest kontrola Pages dla dokładnego merge SHA. Draft, synchronize i zwykły push nie uruchamiają pełnego wydaniowego Preflightu. Dostępny `workflow_dispatch` nie udziela zgody na ponowienie ani nie wykonuje ścieżki auto-merge PR. Codex nie powtarza tych testów lokalnie.

Przegląd pokrycia CLOUD-4.5 (odczyt workflow i skryptów, bez uruchamiania testów):

| Ścieżka | Rzeczywisty zakres / ograniczenie |
|---|---|
| `preflight-js.yml` | Jeden Preflight: składnia, load order, wszystkie `tools/*-smoke.js` (w tym APP i publiczne kontrole CLOUD), audyty zależności/storage. Osobno SDK/Auth/Rules przez `npm test`: pilot, auth, access, global i live-readiness. Brak drugiego Preflightu po merge. |
| `cloud41/42/43/43a-emulator-tests.yml` | Izolowane push na dokładnie wskazane historyczne gałęzie, nie dowolną nową gałąź. Dodatkowe prywatne próby i pełny Chromium; CLOUD-4.2+ także package/rehearsal. Nazwy testów live-readiness i prywatnego podzbioru Chromium nakładają się z kolejnymi zestawami; nie usuwano historycznych kontroli ani konfiguracji Rules bez dowodu równoważności. Nie są drugim automatycznym CI tego samego zdarzenia PR Ready. |
| `cloud44-missing-verifications.yml` | Tylko dwa rzeczywiste testy popup Google na `cloud-4-4-verification-closure`; nie daje pokrycia Chromium dla nowego SHA CLOUD-4.5. |
| Luki poza ogólnym workflow wydaniowym | Pełny Chromium, oddzielne mobilne runnery, prywatny startup/rehearsal i administracyjne CAS/STOP nie są automatycznie wykonywane przez sam Preflight + SDK. Przy zmianie tych domen trzeba przed Ready przypisać brakujące regresje właściwemu izolowanemu CI; bez wykonania wymaganej kontroli nie deklarować pełnego `CI_PASS`. |
| Dowody poza publicznym CI | Ergonomia fizycznego Pixela: właściciel po zatwierdzonym wydaniu. Prywatne oryginalne Rules: istniejąca lokalna weryfikacja dokładnych bajtów/SHA, bez publikacji źródła. Firebase LIVE: wyłącznie po odrębnej zgodzie na konkretną operację. |

Dla dokumentacyjnego CLOUD-4.5 nie zmieniono workflow, nie uruchomiono CI i nie powtórzono lokalnego Preflightu. Push gałęzi tego pakietu nie uruchamia istniejących historycznych workflow CLOUD. `unzip-site-to-root.yml` dotyczy tylko ZIP/zmiany tego workflow na main; ten pakiet nie zmienia żadnego z tych plików. Zmiana pokrycia testowego nie jest wymagana dla samej korekty kontraktu; luki domenowe pozostają jawne dla przyszłych zleceń.

---

## 16. Zasada pracy od teraz

Przed zmianą programu:

1. opisać problem i proponowany zakres,
2. wskazać ryzyko i testy,
3. nie zmieniać niczego przed komendą użytkownika **„do dzieła”**,
4. po zatwierdzeniu robić możliwie mały diff,
5. przygotować właściwe regresje i przypisać ich wykonanie GitHub Actions; lokalnie tylko diagnostyka potrzebna do implementacji oraz kontrola diffu, bez dublowania pełnych zestawów CI,
6. przygotować gałąź i raport `CODE_READY` / `CI_PENDING`; bez osobnej zgody nie tworzyć PR. Zatwierdzona próba wydania odbywa się bez domyślnego Draft, zgodnie z AGENTS §12.

Aktualny kontrakt ról, statusów i zgód określa AGENTS §14 wraz z §3 i §10. Wcześniejsze wyniki lokalne w tym dokumencie są historycznymi dowodami, nie nakazem dublowania CI. Rzeczywisty transport danych Firebase wymaga oddzielnej zgody; dalszy cel to ochrona domen i automatyczna synchronizacja.
