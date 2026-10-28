# LOCAL-FIRST SYNC — 28.10.2026

Gałąź: `local-first-sync-durable-20261028`. BASE/main: `149f9a126a85f9972f5fc1cd19afdc264be98cc7`. Dokładny HEAD jest w końcowym raporcie i referencji gałęzi; jeden logiczny commit ponad BASE. Bez PR/CI/wydania/LIVE. Zgoda właściciela obejmuje implementację, nie produkcyjną migrację lub aktywację.

## Wykonane funkcje

- `sync/local-first-idb.mjs`: osobna IndexedDB, model + SHA + lokalna rewizja + obowiązek publikacji w jednej transakcji strict. Sukces dopiero na transaction complete. Stały UID/device/instance, CAS, trwały identyfikator operacji, ochrona dirty, append-only RAW i receipts. Nie korzysta z archiwum backupów, Firebase persistence ani localStorage.
- `sync/local-first-sync.mjs`: automatyczne uruchomienie po skonstruowaniu izolowanego koordynatora, online i zmianie head Firestore. Powiadomienia tylko budzą niezależny odczyt. Zapis kolejki inflight/expected poprzedza mutację; po restarcie/niepewnym ACK wyłącznie odczytowe rozstrzygnięcie dokładnego head i całej treści. Brak nowego WRITE/revision ID po niepewnym wyniku. Późniejsze lokalne operacje czekają na zweryfikowany receipt poprzednika.
- Globalny kanał używa istniejących CLOUD-3 RAW capture, schematów, immutable rekordów, katalogu hashy, CAS i niezależnego SDK readera. Nie zastępuje CLOUD-SYNC-1 drugim formatem. Kompletny zestaw ma zawsze 14 domen: materials, hardware, manufacturers, suppliers, categories, types, technicalParams, hardwareSettings, labor, workshopServices, stock, programDefaults, company, businessCosts. Jedynym mapowaniem źródeł jest dotychczasowe `globalDataContract.sources`.
- `sync/local-first-project.mjs`: adapter przestrzeni ścieżek wokół istniejącego CLOUD-2B, bez nowego serializera/chunkowania. Projekt przypina konkretną kompletną rewizję katalogów; nowszy cennik nie zmienia jej automatycznie. Odczyt starej rewizji weryfikuje katalog/hash, rekordy, limity i zależności istniejącym unpack/validate. Nie rozwiązuje nieznanych selektorów heurystycznie.
- Jeden aktywny edytor: serwerowy CAS `active/deviceId/epoch/headRevision`, trwały lokalny fence, brak timeout/lease takeover. Przekazanie wymaga czystej repliki, pustej nierozstrzygniętej kolejki oraz niezależnego odczytu zgodnej treści. Stary edytor jest zablokowany lokalnie przed zdalnym zwolnieniem. Utracony ACK zwolnienia pozostawia blokadę; recovery tylko odczytuje, nie ponawia mutacji.
- `sync/local-first-project.rules`: osobny kandydat Rules projektu/edytora dla emulatorów. Składany z niezmienionymi Rules CLOUD-3 wyłącznie w nowym teście. Nie wdrożony. Manifest generacji porównuje poprzedni head i immutable revision, epokę/device oraz przypiętą rewizję globalną. Brak list/delete, mutacji istniejących chunków/rewizji lub wejścia do innych domen.
- `sync/local-first-values.mjs`: dokładny JSON i SHA; odrzucenie wartości, które JSON utraciłby; ścisłe sprawdzenie sesji/projektu/bazy/hosta emulatora. Bez normalizacji liczb/ID i bez wypisywania payloadu w błędach.

## Przygotowane rzeczywiste połączenie Firebase

`sync/firebase-activation.mjs` przyjmuje istniejące niezależne writer/reader Firebase Web SDK z Google Auth, obserwatorem UID/epoch i ważnym lease. Nie loguje się, nie pobiera tokenów, nie tworzy SDK, nie używa ADC. Import jest bierny. Globalny kanał bez prywatnej autoryzacji odmawia produkcji.

`authorizeGlobalFirebase(...)` wymaga osobnej decyzji Ed25519 dla projektu `mebleszek-meble-app`, bazy `(default)`, zakresu globalnego, UID/device/instance/bazy lokalnej, SHA artefaktu i baseline. Zaufany publiczny fingerprint oraz SHA uruchamianego artefaktu muszą być ustalone niezależnie od decyzji przez kontrolowane środowisko wdrożenia; ten moduł ich sam nie ustanawia. Prywatny klucz nie jest wymagany przez binder.

Decyzja wiąże `domain: MEBLE_LOCAL_FIRST_ACTIVATION_v1`, `scope: global-data-sync`, `projectId`, `database`, `ownerUid`, `deviceId`, `instanceId`, `databaseName`, `artifactSha256`, `baselineHash`, `expectedRelease`, `rulesSourceHash`, `expiresAt` (maksymalnie 15 minut) oraz osobno potwierdzone `migrationApproved/sourcePreserved/productionRulesApproved`. Binder sprawdza czystą lokalną kopię i zgodność z capture RAW oraz dokładny release → source → release przez oficjalny Rules API. Potrzebny do tego prywatny OAuth token przekazuje uprawniony operator po osobnej zgodzie na te odczyty. Żadnego takiego wywołania nie wykonano teraz. `revoke()` usuwa uprawnienie; expiry/tożsamość/lease są kontrolowane na granicach transportu. Sam podpis nie zastępuje skutecznych Rules i uprawnień serwera.

Przykładowa kolejność integracji (nie launcher, nie autoryzacja):

1. `openLocalFirstStore({indexedDB, locks:navigator.locks, name, ownerUid, deviceId, instanceId, initialize})` — initialize tylko po zatwierdzonej inicjalizacji/migracji. Przy wznowieniu zawsze false i ten sam zewnętrznie zachowany binding.
2. Przy zatwierdzonym rzeczywistym wdrożeniu: `authorizeGlobalFirebase({decision,signature,publicKeySpki,ownerKeySha256,artifactSha256,writer,reader,store,source,contract,rulesAccessToken})`. W emulatorze nie potrzeba i nie używa się tej funkcji.
3. `createGlobalChannel({writer,reader,ownerUid,contract,factory})`; opcjonalny projektowy kanał testowy używa istniejącego pilotContract/pilotFactory i projectContract.
4. `createDurableSynchronizer({store,channels,eventTarget:window,online:()=>navigator.onLine,onState})`. Potwierdzony lokalny commit wywołuje `submitGlobals`/`submitProject` ze stabilnym operationId i oczekiwaną lokalną wersją. Kolejka rusza automatycznie, bez przycisku.
5. `close()` odłącza sygnały; nie kasuje danych ani nie unieważnia niepewnego wyniku. `recoverEditor` nie powtarza zdalnej mutacji.

Brak importów w index/login/startup i manifestach produkcyjnych. Nie użyto operatora CLOUD-4.6E jako obejścia. Obecna krótka autoryzacja przygotowuje kontrolowaną próbę globalną, nie stały kontrakt automatycznego odnawiania produkcyjnego dostępu/offline.

## Dokładne granice danych i bezpieczeństwa

- Źródłowe `fc_projects_v1`/`fc_investors_v1` i wykryte nierozstrzygnięte RAW są zachowywane wyłącznie lokalnie per operacja. Nie są zbiorczym payloadem Firestore. Obecność edge/material part options/rozrys grain/overrides/historii/draftów pozostawia lokalną pracę, lecz blokuje publikację `LF_PROJECT_OWNERSHIP_PENDING`. Nie zgadujemy Issue #47 ani własności ofert/zleceń/tombstones.
- Produkcyjny kanał projektowy nadal odmawia: CLOUD-1B ma obecnie syntetyczny profil native-project-v1. Potrzebny jest zatwierdzony profil realnego eksportu, pełne rozstrzygnięcie chronionych zależności i migracja. Nie dodano flag testData do danych firmy i nie osłabiono starego walidatora.
- DeviceId/epoka w kandydacie to kooperacyjny protokół pod wspólnym UID. Blokuje starego poprawnie działającego klienta, nie dowodzi sprzętowej tożsamości przeciw klientowi celowo podszywającemu się pod inne urządzenie tego samego właściciela. Przed produkcyjnymi projektami potrzebne rozstrzygnięcie modelu zaufania/rejestracji urządzeń.
- Nieznane dozwolone pola są zachowane. Niezatwierdzone przez CLOUD-3 nowe pola odmawiają publikacji, zamiast zostać wycięte; oryginalne źródło nie jest zmieniane. `transport.apiKey`, tokeny, sesje, cache i archiwum nie wchodzą do globalnego payloadu.
- Quota, brak Web Locks/strict transaction, utracona baza/binding/hash lub lokalny konflikt odmawiają. Bez automatycznego czyszczenia i odtwarzania pustej bazy. Zewnętrzny instanceId jest warunkiem wykrywania utraty przy restarcie; przeglądarka nie może sama udowodnić istnienia usuniętej bazy. IndexedDB nie jest niezależną kopią i nie odzyska jedynych usuniętych bajtów.
- Niepewnej operacji, której wyniku nie da się ustalić z dokładnego head, nie odblokowuje się automatycznie, nawet gdy serwer pokazuje starą/nowszą wersję. Zachowane są dane, ID i expected. Rozstrzygnięcie konfliktu lub awaryjne przejęcie edytora pozostaje jawną procedurą, bez kasowania dowodów.
- Kod nie jest jeszcze podłączony do bieżącego `Zapisz/Anuluj`. Nie ma ochrony przed starym, niezmienionym writerem localStorage po hipotetycznej migracji — jej wyłączność jest bramką przed takim wdrożeniem. Aktualnego UI/UX, algorytmów i magazynów nie zmieniono.

## Kontrole i wymagane CI

Wykonano lokalnie wyłącznie nową celowaną diagnostykę: `node tools/local-first-contract-smoke.js` — 6 grup PASS (dokładny JSON; 14 RAW/sekret/historia/backup; natywny projekt/dependencies; kalkulacja robocizny z przeniesionej definicji 21,375 i cały jej wynik oraz RYSUNEK; odmowa LIVE/startup; podpis/artefakt/UID/Rules/revoke). Ostatnia grupa używa wyłącznie efemerycznego syntetycznego klucza, fikcyjnych obiektów i wstrzykniętej odpowiedzi HTTP, bez autentycznej decyzji właściciela lub sieci. Składnia 10 plików i diff sprawdzone.

Nie wykonano pełnego Preflight ani wcześniejszych zestawów. Próba uruchomienia nowego browser smoke została zatrzymana przed scenariuszami: środowisko zabrania lokalnego serwera (`listen EPERM 127.0.0.1`). Pakiety Firebase/emulatorów nie są dostępne; nie instalowano ich ponownie. Nowe IDB: **0/6 grup wykonanych**; nowe Auth/Firestore: **0/7 scenariuszy wykonanych**. To CI_PENDING, nie PASS.

Podłączenie do niezmienionego `.github/workflows/preflight-js.yml`:

| Ścieżka istniejącego CI | Nowy zakres |
|---|---|
| Preflight → automatyczne `*-smoke.js` | `tools/local-first-contract-smoke.js`: 6 grup granic offline; `tools/local-first-store-smoke.js`: 6 grup prawdziwego Chromium/IDB — atomowość, duplicate/CAS, restart queued/inflight, quota/abort, zabicie procesu w otwartej transakcji, zachowanie RAW i utrata bazy. |
| current Auth/Firestore → istniejący `cloud-sync-global.test.mjs` → nowa zagnieżdżona suita `local-first.test.mjs` | 7 rzeczywistych scenariuszy: telefon→komputer 14 domen; automatyczny odbiór komputer→telefon; fizycznie wyłączona sieć SDK i edycja offline; edytor/przekazanie/stara epoka/obcy UID/WYCENA-RYSUNEK; globalny konflikt CAS z zachowaniem przegranej wersji; rzeczywisty commit + utrata ACK + restart Chromium i jeden WRITE; braki zależności i trwała blokada historycznych RAW. |
| Niezmieniony kontekst historyczny `306f90a4cfd8bcb4277aa8b4d140e911493ddd60` | Dotychczasowe 425 pinów, C/D/E i ich 15 scenariuszy bez zmian. Stare 14 scenariuszy SYNC1 bez zmian; nowa suita dopisana po nich i dopiero wtedy instaluje kandydujący fragment Rules w emulatorze. |

Nie zmieniono package/lockfile, workflow, AGENTS, istniejących Rules, wcześniejszych manifestów/pinów ani istniejących asercji. Pełne domenowe regresje WYCENY/RYSUNKU/persistence/backupów pozostają zadaniem istniejącego Preflight dla nowego HEAD. Nowy test kalkulacji nie zastępuje kompletnego CI WYCENY ani fizycznego telefonu/tabletu.

## Najbliższe rzeczywiste uruchomienie na urządzeniach

1. Weryfikacja tej gałęzi/HEAD/BASE i osobna zgoda na PR Ready/CI. Teraz nie tworzono PR i nie uruchamiano workflow.
2. Zatwierdzony profil realnych projektów, rozstrzygnięcie wyłączonych domen i rejestracji urządzeń; bezstratny adapter sesji `Zapisz/Anuluj` oraz freeze/fence wszystkich starych writerów. To konkretna brakująca integracja kodu i decyzja o migracji, nie samo włączenie flagi.
3. Prywatnie potwierdzone baseline i binding na urządzeniach, zachowanie oryginalnych danych; aktualna kopia właściciela jest już potwierdzona — bez ponawiania audytu backupu. Osobna zgoda na migrację i jej wycofanie, bez kasowania oryginałów.
4. Osobne zgody na świeże odczytowe dowody dostępu/Rules/limitów, ewentualne kandydujące Rules/granty i kontrolowane Firebase LIVE, z niezależnym odczytem i zatrzymaniem. Istniejący pilot/4.6E pozostaje odrębną bramką, bez kolejnego audytu w tym pakiecie.
5. Po zatwierdzonym wdrożeniu: Google Auth i komplet lokalnych zależności na telefonie/tablecie/komputerze, akceptacja offline/restartu/przekazania na fizycznych urządzeniach oraz zatwierdzony kontrakt ciągłego odnawiania dostępu. Brak wymogu ręcznej obsługi Windowsa.

Implementacja: **CODE_READY dla opisanego izolowanego pakietu**. Weryfikacja: **CI_PENDING**. Wydanie: **RELEASE_BLOCKED**. Firebase i dane właściciela: **LIVE_BLOCKED**. Nie deklarujemy zakończenia automatycznej synchronizacji produkcyjnej.
