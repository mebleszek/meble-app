# CLOUD-4.6D — nieaktywny kandydat pierwszego Firebase LIVE

**Aktualizacja po wydaniu:** PR #76 wydany do main `4b8ef922a4596372eba4a48b52de1bdff6585f4f`; właściciel potwierdził CI/merge/Pages SUCCESS. CLOUD-4.6D ma status **RELEASED / LIVE_BLOCKED**. Poniższy zapis przygotowania i jego CI_PENDING są historyczne. Aktualne uzupełnienie wykonawcze opisano w [sekcji CLOUD-4.6E](#cloud-46e--połączenie-operatora); PASS wydanej wersji nie obejmuje nowego HEAD.

BASE: `fd36b2e6fee433c92676d7619dc672d4361d9d59` (wydany PR #75).
Gałąź: `cloud-4-6d-live-execution-preparation`.
Status: **CODE_READY / CI_PENDING / LIVE_BLOCKED**. Nie ma PR ani wydania tego
pakietu. Nie wykonano operacji Firebase LIVE, odczytów produkcyjnych, Rules,
grantów, IAM, billingu, migracji ani dostępu do danych klientów.

## Rzeczywisty postęp i granice kodu

1. `cloud46d-contract.js`: wykonywalne, czyste kontrole produkcyjnego projektu
   `mebleszek-meble-app`, `(default)`, UID/epoch, aplikacji Auth, sesji Google,
   faktycznego hosta/SSL i bazy SDK, pakietu, syntetycznego zakresu oraz sześciu
   decyzji z istniejącego `FUTURE_SCOPES`. Zakres to wyłącznie
   `cloud4-investor-v1` / `cloud4-project-v1`, 6797 B i istniejące hashe. Kontrole
   Rules/rollbacku delegują do `cloud43a-baseline` i `cloud44-gate2`; nie
   powstał drugi matcher baseline, plan grantu ani walidator modelu.
2. `cloud46d-journal.js`: prywatny plik poza repo, tryb 0600 w katalogu 0700,
   odmowa symlinków, atomowe `O_EXCL`, fsync zapisu i katalogu. Przed każdym
   efektem zapisuje INTENT, a **przed publikacją rewizję zwróconą przez istniejące
   prepare()**. Zapisuje wyłącznie identyfikatory/hashy/statusy, bez payloadu,
   OAuth i Rules. Klucz obejmuje stały projekt/bazę/UID/scope — zmiana attemptId
   lub pakietu nie otwiera nowej próby. Nie ma resetu, retry WRITE ani wznowienia
   mutacji po restarcie. Łańcuch hashy wykrywa uszkodzone/niepełne zdarzenia;
   nie jest podpisem ani ochroną przed administratorem hosta.
3. `recordRecovery()` po restarcie przyjmuje wynik osobno autoryzowanego,
   niezależnego readera i zapisuje osobny, jednorazowy sidecar powiązany z hashem
   dziennika i **tą samą przygotowaną rewizją/dokumentem**. Nie otwiera writera,
   nie wznawia cyklu i nie poświadcza STOP. Dopasowanie JSON nie udowadnia
   pochodzenia z serwera: przyszły zaufany reader musi dostarczyć rzeczywisty
   wynik istniejącej pełnej walidacji. Niezgodność pozostaje UNRESOLVED.
4. `cloud46d-rules-reader.js.txt`: nieaktywny kod oficjalnego GET release →
   GET ruleset → ponowny GET release, z literalnym hostem i projektem, bez
   redirectów/retry, ze sprawdzeniem HTTP200 i pełnych nazw. Różnica release
   oznacza STOP, bez automatycznej zmiany oczekiwanej wersji. Istniejący walidator
   sprawdza pełną tożsamość i oryginalne bajty; dowód ma najwyżej 5 s. Trzy GET
   **nie są atomowym CAS** ani dowodem wyłączności innych publisherów.
5. `cloud46d-candidate.js`: assembler źródła, nie launcher. Generuje kompletny
   tekst modułu produkcyjnego z niezmienionej orkiestracji 4.6C i jej obecnej
   kolejności: checkpoint → stage → activate → jeden WRITE → osobny READ →
   STOP → niezależna kontrola STOP. Dodaje jedynie trwałe znaczniki granic i
   powiązanie rewizji. Podstawia ścisłe kontrole LIVE zamiast kontroli emulatora.
   Administracyjny callback transakcji, `assertExpected`, write set i
   `maxAttempts:1` są pobierane z 4.4, bez ponownej implementacji CAS. Przygotowany
   bridge dla prywatnego backendowego SDK korzysta z `db.doc`, `ref.get` i
   `db.runTransaction`. Projekt/baza/host backendowego SDK muszą być jawne.
6. Produkcyjny tekst ma **wyłącznie export executeProduction**, odsyłający do
   dotychczasowej bezwarunkowej odmowy. Funkcja prywatnego wiązania nie zwraca
   fabryk ani uchwytów i także wywołuje bezwarunkową odmowę przed ich utworzeniem.
   Bez eksportu bindera/launchera, parametru aktywacji, zmiennej środowiskowej,
   wpisu w UI/startupie lub polecenia CI. Sam import wygenerowanego modułu nie
   inicjuje SDK, nie pobiera tokenu i nie dotyka sieci. Istniejący loader 4.2
   i `executeProduction()` 4.4/4.6C są niezmienione.
7. `cloud46d-rehearsal.mjs` wiąże ten sam assembler i journal **wyłącznie z
   demo/loopback**. `cloud46d-emulator.test.mjs` ponownie wykorzystuje dokładne
   15 istniejących scenariuszy i asercji 4.6C, kierując je do nowego wiązania.
   Nie kopiuje ani nie osłabia scenariuszy. UID/projekt/baza, Rules, revocation,
   ACK, CAS, późna odpowiedź, STOP i powtórzona próba sprawdzają więc nowy kod.

Nazwa `openDemoOperator` w źródle kandydata oznacza odziedziczony, kooperacyjny
model stanów, nie kontrolę rzeczywistego projektu ani blokadę administratorów.
Tożsamość połączeń sprawdza oddzielny adapter. Nie przedstawiamy tego locka,
lease klienta ani dziennika hosta jako globalnej wyłączności/IAM lub server TTL.
Role WRITE/READ są separacją kontekstów klienta, nie nowymi rolami serwerowymi.

## Zmienione pliki

Nowe:

- `tools/firebase-pilot/cloud46d-contract.js`
- `tools/firebase-pilot/cloud46d-journal.js`
- `tools/firebase-pilot/cloud46d-candidate.js`
- `tools/firebase-pilot/cloud46d-rules-reader.js.txt`
- `tools/firebase-pilot/cloud46d-rehearsal.mjs`
- `tools/firebase-pilot/cloud46d-emulator.test.mjs`
- `tools/firebase-pilot/cloud46d-preparation.test.mjs`
- `tools/firebase-pilot/cloud46d-integrity.json`
- `tools/cloud46d-preparation-smoke.js`
- ten raport.

Zmodyfikowane: `tools/firebase-pilot/package.json` (dołączenie testu do obecnego
CI), `cloud46c-integrity.json` (wyłącznie nowy hash tego package.json),
`CURRENT_STATE.md`, `ROADMAP.md`, `CLOUD_MIGRATION.md` (bieżący status wydanego
PR #75 i tego przygotowania). Nowy manifest przypina tę aktualizację i źródła
4.6D; dotychczasowe piny kodu i asercje pozostają nietknięte. Nie zmieniono
AGENTS, workflow, historycznego raportu 4.6C, kodu aplikacji, Rules i danych
biznesowych. WYCENA/ROZRYS/PCV/10%/4-3-6, katalogi, magazyn i oferty są poza zmianą.

## Weryfikacja: wykonane i oczekujące

Nie powtarzano zakończonych testów CI PR #75 ani audytu IAM. Właściciel podał
SUCCESS Preflight/SDK/Rules, merge i Pages PR #75 dla wydanego main; ten PASS
nie jest przypisywany nowemu HEAD.

Wykonane przez Codex lokalnie, wyłącznie celowane kontrole nowej granicy:

- journal: zużycie próby, trwała rewizja przed WRITE, utracony ACK, brak retry,
  obcy identyfikator i uszkodzone zakończenie — **PASS**;
- bezpośredni import wygenerowanego kandydata i próba wywołania publicznego
  oraz prywatnego wejścia z nienaruszalnym atrapowym zasobem — **PASS**, zasób
  nie został dotknięty;
- recovery po zamknięciu uchwytu: ten sam revision/document, trwały sidecar,
  brak wznowienia WRITE/poświadczenia STOP — **PASS**;
- pierwsza próba testu nieaktywności miała błąd harnessu: `import.meta` w
  `new Function`. Poprawiono wyłącznie ewaluację testową; ponowiony ten jeden
  test zaliczono. Nie zmieniano blokady produktu ani asercji;
- mock HTTP rzeczywistego kodu Rules readera: prawidłowe trzy GET, obca tożsamość, zmiana release oraz HTTP403/429/500 — **PASS**, bez sieci;
- jedna diagnostyka wygenerowanego cyklu z rzeczywistym plikowym journalem i transportem w RAM — **PASS**, bez SDK/emulatorów;
- składnia 7 nowych JS/MJS, wygenerowanego modułu i końcowy diff — **PASS**. Bez lokalnego
  Preflightu, pełnej regresji, instalowania SDK i uruchamiania emulatorów.

Istniejące CI po **osobno zatwierdzonym PR** ma wykonać:

- Preflight i nowy automatycznie wykrywany smoke: 8 kontroli przygotowania
  (zgody, tożsamość, świeże źródło Rules, HTTP/403/zmiana release, journal,
  opóźniony wynik/przerwany STOP, odmowa produkcji i recovery).
- Dotychczasowy `npm test` plus `cloud46d-emulator.test.mjs`: 15 scenariuszy
  4.6C wobec nowo wygenerowanego adaptera/cyklu i dziennika. Zachowano poprzednie
  zestawy SDK/Rules/4.2/4.4/4.6C i domenowe regresje Preflightu.
- Prywatny rollback: pozytywny test oryginalnych 635 B wykona uprawniony
  przyszły operator poza repo/CI, gdy rzeczywiste bajty zostaną mu udostępnione.

Nowe testy SDK i pozostałe kontrole offline są **CI_PENDING**, nie PASS.
W teście odczytu API używa się wyłącznie atrap HTTP; nie ma połączeń LIVE.
Powłoka może ograniczać subprocess (`EPERM`); celowane testy wykonywano Node22
z `--experimental-test-isolation=none`, bez zmiany sposobu działania CI.

## Minimalna procedura przyszłej próby — lista nie jest zgodą

1. Zatwierdzić konkretny HEAD/BASE i przyszły prywatny launcher/binder, przypiąć
   hash wygenerowanego źródła/pakietu oraz UID. Osobno dopuścić odczyty stanu
   produkcyjnego. Przygotować trwały prywatny katalog dziennika poza repo/CI,
   poza `/tmp`, na sprawdzonym nośniku; jego kompletność i kopię zabezpieczyć
   przed próbą. fsync nie zapewnia przetrwania utraty dysku/hosta.
2. Bez ponownego pełnego audytu: sprawdzić **bieżącą różnicę** efektywnych
   uprawnień publikacji Rules/delegacji względem znanego zestawu właściciela
   i kont usługowych; potwierdzić, kto TERAZ może publikować/zmieniać IAM.
   Sprawdzić tylko aktualnych publisherów konsoli, CLI/REST i automatyzacji;
   zatrzymać konkurujące zadania i potwierdzić krótkie okno utrzymania kontroli.
   Zapisać świeże odniesienia do dowodów i czas, nie tokeny. Nieznana ścieżka,
   nieustalona delegacja lub niemożność utrzymania kontroli = STOP, bez dalszego
   rozszerzania tej próby do audytu. W razie potrzeby dodatkową kontrolę zlecić
   uprawnionemu administratorowi po osobnej zgodzie.
3. Właściciel może być jedną osobą. Technicznie potrzebne są cztery różne
   konteksty: writer i reader Web SDK z własnym Auth/lease oraz osobne połączenia
   backendowe administratora STOP i jego weryfikatora. Jeden człowiek może je
   obsługiwać; oddzielne wywołania serwerowe i uchwyty nie mogą zostać zastąpione
   jednym wynikiem/cache. Jeżeli nie można utrzymać administracji STOP niezależnie
   od zawieszonego writera, nie ma drugiego uprawnionego kontekstu lub występuje
   wspólna niedostępność poświadczeń — potrzebny dodatkowy uprawniony wykonawca
   i jego niezależne potwierdzenie, albo STOP. Nie dodajemy automatycznie IAM.
4. Sprawdzić oryginalne prywatne **635 B**, SHA-256
   `9260ebcd881e5a0cc2302e768f14e2e8152637093de071449ea90211461ffa91`, przez
   istniejący walidator. Odczytać świeży release/ruleset i źródło Auth-only;
   historyczny template 755 B nie jest rollbackiem. Sprawdzić aktualny Spark,
   brak billingu i limity/rezerwę co najmniej 500 reads/30 writes.
5. Oddzielne decyzje właściciela: (a) odczyty stanu, (b) dokładne minimalne Rules
   i warunki wycofania, (c) grant stage/activate, (d) jeden syntetyczny WRITE,
   (e) niezależny READ, (f) administracyjny STOP z niezależnym potwierdzeniem.
   Każda decyzja na ten sam projekt/bazę/UID/pakiet/scope/okno. Przygotowanie
   i wydanie kodu nie zastępują żadnej z tych decyzji.
6. Po osobno zatwierdzonej publikacji Rules wykonać niezależny read-back pełnej
   oczekiwanej nowej tożsamości i bajtów. Tuż przed każdą operacją sprawdzać je
   ponownie; rozbieżność oznacza STOP. Uruchomić raz gotowy cykl, bez retry.
   STOP pozostaje dostępny po terminie/utracie lease. Nie przywraca starych
   snapshotów grantów ani nie usuwa zatwierdzonego projektu.
7. Przy utraconym ACK, timeout lub crash: zablokować publikację, nie usuwać
   dziennika ani nie tworzyć nowego attemptId. Najpierw oddzielnie autoryzowany
   STOP i kontrola flag/odmowy biznesowego dostępu, następnie uprawniony reader
   dokładnej zapisanej rewizji i trwały wynik `recordRecovery`. Brak pełnego
   potwierdzenia STOP = nadal STOP_REVIEW_REQUIRED. Powtórna mutacja lub
   konfliktowy STOP wymaga świeżej decyzji i nowego ograniczonego planu.

## Historyczne dowody i konkretnie brakujące elementy

Zachowano ustalenia właściciela, bez nowych odczytów: cztery publikacje
16–17.10.2026 przez `mebleszek@gmail.com`, `firebaserules.releases.update` /
`granted:true`, historyczny Spark/no billing, prywatny oryginał rollbacku i
istnienie kont usługowych. Nie oznaczają absolutnej wyłączności ani bieżącej
zgody. Oryginału 635 B nie przekazano do tego zadania i nie skopiowano do repo.

Nie można uczciwie potwierdzić bez przyszłego autoryzowanego środowiska:
aktualnych IAM/Rules/billing/limitów i braku innych publisherów, rzeczywistych
prywatnych bajtów, tożsamości/efektywnych uprawnień poświadczeń backendowego
SDK oraz niezawodności prywatnego nośnika dziennika. Bridge administracyjny jest
przygotowany dla natywnego backendowego SDK; jego konkretna dystrybucja,
ustawienia hosta/bazy i powiązanie ADC/OAuth z nazwanym operatorem muszą być
sprawdzone w prywatnym środowisku wykonania. Testy Web SDK/emulatora nie są
potwierdzeniem tych produkcyjnych uprawnień.

**Jedyny celowo nieutworzony element wykonawczy** to aktywny, prywatny binder
łączący powyższe gotowe fabryki z zatwierdzonymi rzeczywistymi poświadczeniami,
nośnikiem i nowym oczekiwanym rulesetem. Zostałby produkcyjnym launcherem,
którego bieżące polecenie zabrania. Jego przyszła implementacja i przegląd muszą
usunąć bezwarunkową odmowę przez osobną zatwierdzoną zmianę kodu; nie da się tego
zrobić parametrem/JSON/env w tym pakiecie. Nie trzeba ponownie projektować cyklu,
CAS, źródła, walidatorów ani dziennika. Aktualne cięcie kończy się na kompletnym
nieaktywnym źródle i jego emulatorowym wiązaniu.

## CLOUD-4.6E — połączenie operatora

BASE: `4b8ef922a4596372eba4a48b52de1bdff6585f4f` (wydany PR #76).
Gałąź: `cloud-4-6e-live-connection`. Implementacja: **CODE_READY**;
weryfikacja: **CI_PENDING**; wydanie: **niewydane**; Firebase: **LIVE_BLOCKED**.
Nie wykonano żadnego produkcyjnego odczytu, logowania, Rules, grantu, WRITE,
READ, STOP, IAM ani billingu. Uzupełnienie zastępuje historyczny brak bindera
opisany powyżej; nie zmienia historii testów/wydań 4.6C/D.

### Gotowy kod i granica autoryzacji

- `cloud46e-connection.mjs`: jawne API `openAuthorizedConnection(input)` oraz
  `recoverAuthorizedConnection(input)`. Nie ma automatycznego CLI, flagi LIVE,
  wpisu w UI/startupie ani produkcyjnego polecenia CI. Import nie inicjuje SDK
  i nie łączy się z usługami. Wszystkie stare `executeProduction()` i stary
  wygenerowany moduł 4.6D zachowują bezwarunkową odmowę. Nowe wejście E ma własną
  bramkę osobnych podpisanych decyzji; nie zmienia starej odmowy.
- `cloud46d-candidate.connectionSources()` udostępnia te same przygotowane
  fabryki adaptera, administracji i cyklu. `cloud46e-runtime.mjs` wiąże je
  bez nowego modelu, transakcji lub protokołu STOP. Bridge normalizuje natywne
  serwerowe `snapshot.exists` do webowego `exists()`; callback CAS, write set,
  walidator i `maxAttempts:1` pozostają z 4.4. Źródło nieaktywnego kandydata
  nadal eksportuje wyłącznie blokowane `executeProduction()`.
- `cloud46e-authority.js`: sześć osobnych podpisów Ed25519, sprawdzanych wobec
  prywatnie ustanowionego klucza właściciela i jego odcisku SPKI SHA-256.
  Podpis obejmuje scope/decisionId, action, UID, attemptId, projekt/bazę,
  integralność pakietu, dokładny HEAD, bazę E, oczekiwaną tożsamość/źródło Rules,
  cztery nazwane konteksty i świeże końcowe dowody. Zachowano walidatory 4.6D.
  Sam poprawny podpis nie zastępuje rzeczywistych 635 B rollbacku, Spark/limitów,
  bieżącej kontroli wyłączności ani faktycznych odpowiedzi SDK/API. Przy próbie
  wykonania wymagane są również czysty checkout wskazanego HEAD i oryginalne
  bajty rollbacku. Manifest E przypina nowe źródła i łańcuch manifestów C/D.
- `cloud46e-native.mjs`: dwa osobne konteksty Firebase Auth/Web SDK, Google
  credential → Firebase ID token → kontrola issuer/audience/provider/email/UID,
  istniejący verifier i odwoływalny lease. Dwa osobne backendowe Firestore/OAuth
  konteksty STOP i weryfikatora mają jawny projekt, bazę, host i SSL. Oficjalny
  Google userinfo potwierdza nazwane konto OAuth, a faktyczne odczyty/transakcje
  weryfikują efektywny dostęp. Nie ma ADC ani fallbacku na środowisko. Tożsamość
  konta nie jest dowodem wyłączności publikacji lub wszystkich uprawnień IAM.
- Tokeny przychodzą wyłącznie w pamięci, bez pliku/tokenowego magazynu w repo;
  Auth używa `inMemoryPersistence`. Zdalne błędy są sanitowane. Journal 0600
  w prywatnym katalogu 0700 poza repo i katalogami tymczasowymi zapisuje zakres
  przed jakimkolwiek RPC, rewizję przed WRITE oraz wyniki/niepewność. Sidecar
  autoryzacji zawiera hash podpisanego pakietu decyzji, HEAD, identyfikatory
  operatorów i decyzji, bez tokenów, payloadu i oryginalnych Rules.
- `cloud46e-fence.js`: trwały marker recovery zatrzymuje przyszłe mutacje
  starego procesu. Atomowy plik przed RPC stage/activate zamyka lukę między
  procesem głównym i recovery. Niepewny administracyjny RPC pozostawia fence;
  po restarcie nie wolno wtedy poświadczyć STOP na podstawie chwilowych flag.
  To blokada na jednym prywatnym hoście/nośniku, nie rozproszony lock/IAM.
- Recovery nie ma WRITE/stage/activate ani wznowienia `run`. Zużywa osobny
  trwały marker przed RPC, inicjuje administrację bez writera i bez jego lease,
  wykonuje istniejący CAS STOP, następnie sprawdza flagi osobnym backendem i
  rzeczywistą odmowę nowym nieuprzywilejowanym readerem. Logowanie readera
  następuje **po STOP**. Nierozstrzygnięty wcześniejszy WRITE pozostaje oznaczony
  `REVIEW_OR_INDEPENDENT_READ_REQUIRED`; STOP nie udaje dowodu jego cofnięcia.
  Brak potwierdzenia, przerwany STOP lub niepewna administracja daje odmowę,
  zachowanie dziennika i potrzebę osobnego rozstrzygnięcia, nigdy retry.

### Prywatne uruchomienie — instrukcja na przyszłość, nie zgoda

1. Po osobno zatwierdzonym CI/wydaniu przygotować czysty prywatny checkout
   dokładnego HEAD oraz trwały katalog 0700 poza repo i `/tmp`. Nie kasować ani
   przenosić istniejącego journala/fence w celu otwarcia nowej próby. Zachować
   kopię dziennika poza tym hostem; fsync nie chroni przed utratą nośnika.
   Potwierdzony przez właściciela aktualny backup danych firmy pozostaje ważny;
   nie zleca się ponownego pełnego backupu/audytu bez nowej przesłanki.
2. W prywatnym katalogu runtime zainstalować i przypiąć
   `@google-cloud/firestore@7.11.0` i `google-auth-library@9.15.1`;
   Web SDK pochodzi z istniejącego lockfile `tools/firebase-pilot`.
   Nie używać profilu ADC ani domyślnych kluczy usługowych. Operator musi
   sprawdzić ten konkretny backendowy runtime w swoim prywatnym środowisku;
   emulatorowe facade nie potwierdza rzeczywistych uprawnień OAuth/IAM.
3. Właściciel ustanawia prywatnie klucz decyzyjny Ed25519. Publiczny klucz
   w pliku 0600 poza repo i jego odcisk SPKI SHA-256 zatwierdza innym zaufanym
   kanałem; nie przyjmuje klucza dostarczonego razem z nieznaną decyzją. Klucz
   prywatny nigdy nie trafia do repo/CI/Pages. Podpisy są bramką lokalnego
   operatora, nie dowodem tożsamości właściciela bez tego ustanowienia zaufania.
4. Po osobnej zgodzie na odczyty sprawdzić tylko bieżące zmiany efektywnego
   IAM/delegacji i publisherów konsola/CLI/REST/automation/service accounts,
   zatrzymać konkurujące zadania i utrzymać wyłączność w krótkim oknie próby.
   Nie powtarzać pełnego historycznego audytu. Nieznany publisher/delegacja
   lub brak kontroli oznacza STOP. Potwierdzić świeży Spark/no billing i
   rezerwę co najmniej 500 reads/30 writes. Nazwać writer/reader/stop/verifier;
   pola exclusion.operator/stopOperator/verifier odpowiadają ich context.id.
5. Udostępnić uprawnionemu operatorowi rzeczywiste prywatne 635 B rollbacku
   o SHA-256 `9260ebcd881e5a0cc2302e768f14e2e8152637093de071449ea90211461ffa91`.
   Minimalne Rules publikuje właściciel dopiero po osobnej zgodzie, istniejącą
   zatwierdzoną ścieżką. Oczekiwany nowy release/ruleset pochodzi z tej operacji,
   nie z automatycznego przyjęcia dowolnych aktualnych Rules. Kod E przed
   checkpointami pobiera oficjalny release → ruleset → release i porównuje
   dokładną tożsamość oraz bajty. JSON receipt nie zastępuje tego odczytu.
6. `authority.unsignedBundle({uid, attemptId, expiresAt, contexts, expectedRules,
   finalChecks, action:'cycle'})` tworzy **niepodpisany** pakiet na najwyżej
   15 minut. Każdą z sześciu decyzji właściciel osobno podpisuje nad
   `authority.signingBytes(bundle, approval.scope, approval.decisionId)`;
   podpis Base64 zapisuje w `approval.signature`. Funkcja nie podpisuje ani
   nie udziela zgody. FinalChecks mają istniejący kontrakt account/exclusion
   z 4.6D; oryginał rollbacku przekazuje się osobno jako Buffer `privateSource`.
7. Po zgodzie na wykonanie dostarczyć w prywatnym procesie dwa krótkotrwałe
   Google provider ID tokeny uzyskane Google Sign-In (`credentialFromResult`
   zatwierdzonego prywatnego logowania; nie są to Firebase ID tokeny), dwa
   nazwane tokeny OAuth administracji/weryfikatora i token odczytu Rules.
   OAuth musi obejmować właściwe API i userinfo.email. Nie wypisywać ich do
   terminala/logów ani przekazywać w argumentach procesu; użyć prywatnego
   kanału pamięciowego. Nie włączać logowania HTTP/gRPC SDK. Brak/niezgodność
   któregokolwiek poświadczenia oznacza odmowę, bez zastępowania innym kontem.
8. Jawnie wywołać `openAuthorizedConnection({bundle, trustFile, ownerKeySha256,
   privateSource, privateDirectory, runtimeDirectory, firebaseConfig,
   credentials})`. credentials zawiera writerGoogleIdToken, readerGoogleIdToken,
   stopAccessToken, verifierAccessToken, rulesAccessToken i expiresAt w ms.
   Wynik udostępnia `run()`, niezależne `stop()`, `inspect()` i `close()`.
   Wywołać `run()` **raz**; STOP jest w finally. Nie zamykać połączeń/journala
   przy pending RPC lub niepotwierdzonym STOP. Samo open zużywa próbę trwale.
9. Po utracie procesu nie otwierać nowej próby. Z nowymi decyzjami na
   `action:'recover-stop'`, tę samą próbę/pakiet i świeże dowody wywołać
   `recoverAuthorizedConnection(input)`. Ten pakiet decyzji ma tę samą
   sześcioczęściową strukturę kontraktu, ale podpisana action pozwala wyłącznie
   na odczyty stanu i STOP; nie udostępnia żadnego WRITE. Do samej administracji
   nie są wymagane token writera, Rules ani rollback; awaryjny STOP nie zależy
   też od dostępności Rules/Spark/billing. Nadal wymaga osobno podpisanej decyzji,
   zgodnego HEAD/pakietu i oryginalnego dziennika. Reader jest potrzebny do końcowej
   weryfikacji odmowy. Brak readera nie blokuje zastosowania STOP, lecz blokuje
   jego pełne potwierdzenie. Marker recovery jest jednorazowy. Niepewny wynik
   wymaga odrębnego planu rozstrzygnięcia przez uprawnionego operatora.

Jedna osoba może obsługiwać cztery konteksty. Jeżeli nie da się utrzymać
niezależnej administracji przy awarii writera/hosta albo niezależnie potwierdzić
wyniku, potrzebny jest drugi uprawniony operator lub odrębne potwierdzenie.
Kod nie tworzy kont, nie zmienia IAM i nie obiecuje absolutnej wyłączności.

### Weryfikacja i brakujące warunki

Zmienione pliki E (19): `CURRENT_STATE.md`, `ROADMAP.md`, `CLOUD_MIGRATION.md`,
`CLOUD_DATA_REGISTER.md`, ten raport, `tools/cloud46e-connection-smoke.js` oraz
w `tools/firebase-pilot/`: `package.json`, `cloud46c-integrity.json`,
`cloud46d-candidate.js`, `cloud46d-integrity.json`, `cloud46e-authority.js`,
`cloud46e-connection.mjs`, `cloud46e-native.mjs`, `cloud46e-runtime.mjs`,
`cloud46e-fence.js`, `cloud46e-emulator.mjs`, `cloud46e-emulator.test.mjs`,
`cloud46e-boundary.test.mjs`, `cloud46e-integrity.json`.

Istniejące CI wykrywa `cloud46e-connection-smoke.js` w Preflight i wykonuje
nowe granice offline. `npm test` dodatkowo uruchamia 15 scenariuszy E w osobnych
Workerach przeciwko wspólnemu runtime/fabrykom 4.6D, rzeczywistym emulatorom i
Web SDK. Wszystkie oryginalne asercje C/D i ich osobne zestawy pozostają.
Scenariusz ochrony danych dodatkowo sprawdza sentinel katalogu, magazynu,
ustawień i prawdziwego projektu, zarówno po cyklu, jak i przy odmowach dostępu.
Testy nie używają prawdziwego rollbacku ani produkcyjnego połączenia.

Celowane kontrole lokalne: składnia nowych modułów i łańcuch integralności — PASS.
Pierwszy przebieg nowych granic: 6/7 PASS, błąd brakującego `pilot` w złożonym
adapterze administracyjnym poprawiono w runtime i harnessie bez zmiany asercji.
Kolejny celowany przebieg: 4/8 PASS, 4 FAIL z przyczyny środowiskowej
`spawnSync git EPERM` (potwierdzone osobną minimalną diagnostyką). Testy journala
oddzielono od niepowiązanego przygotowania podpisanej decyzji; oba scenariusze
restartu/fence rzeczywiście wykonano i zaliczono 2/2. Łącznie potwierdzono
6 z 8 nowych granic; dwie kontrole podpisanej decyzji pozostają lokalnie
BLOCKED przez zakaz subprocess Git. Nie zastąpiono odczytu rewizji atrapą
i nie osłabiono asercji. Zestaw emulatorowy E: 0/15 wykonanych — brak lokalnych
zależności Firebase, bez ponawiania instalacji i bez deklaracji PASS.
Ostateczne SHA są podawane w raporcie przekazania.
Pełny Preflight oraz SDK/Rules pozostają do przyszłego, osobno zatwierdzonego CI.
Brak lokalnych zależności emulatorowych nie jest PASS. Rzeczywistego OAuth,
Google Sign-In, prywatnych 635 B, backendowego SDK i IAM nie sprawdzano LIVE.

Pozostały warunki, nie kolejna implementacja bindera: zatwierdzone CI/wydanie;
prywatny runtime/nośnik/ustanowienie zaufania klucza; rzeczywiste poświadczenia
i rollback; świeże dowody/utrzymanie wyłączności; osobne zgody na produkcyjne
odczyty, Rules, grant, WRITE, READ i STOP. Najbliższy krok to zatwierdzenie
konkretnego HEAD/BASE do CI, następnie dopuszczenie prywatnego operatora do
kontroli stanu i sesji. Ten pakiet nie zawiera żadnej zgody wykonawczej LIVE.

Po syntetycznym LIVE następują osobno: bezstratne podłączenie danych biznesowych
i ich synchronizacji, automatyczna synchronizacja projektów między urządzeniami,
a następnie pełny LOCAL-FIRST/offline. Pilot nie dowodzi działania tych etapów.

## CLOUD-4.6F FAST TRACK — 01.11.2026

Gałąź `cloud-4-6f-fast-track-20261101`, BASE/main
`5545a6df9a5e4ebc3551893414da0fde87a9d335`. Ten pakiet uzupełnia przygotowanie
operatora, bez aktywacji produkcji. Historycznych wyników C/D/E nie ponawiano.
PR #94 jest scalony do tego main; CI #41260577730 (w tym post-merge-verify Pages)
PASS, a właściciel potwierdził fizyczny Android. To dowody UI, nie Firebase LIVE.

### Kod i granice

- `cloud46f-history.js` korzysta z istniejącego `verifyHistorical`: odrębny,
  czysty checkout **306f90a4cfd8bcb4277aa8b4d140e911493ddd60**, wszystkie **425 pinów**.
  Nie wolno uruchamiać inwentarza C/D/E na zmienionym kodzie UI ani przepinać
  jego sum. `operatorRoot` wskazuje ten checkout; w CI pochodzi z istniejącego
  `CLOUD_CI_HISTORY_ROOT`. Nie jest przełącznikiem LIVE.
- `cloud46f-operator.mjs`: prywatny launcher **przygotowania**, manifest własnych
  źródeł i kontrola łańcucha E. `preparePrivateLaunch(input)` weryfikuje istniejące
  sześć podpisów, cztery konteksty, artefakty i podpis recenzenta oraz przypisanie
  do dokładnej próby/UID/HEAD/pakietu. Dla cyklu używa rzeczywistych bajtów
  rollbacku i istniejącego `reviewAuthorization`; dla recovery nie wymaga
  Rules/Spark/rollbacku, ale wymaga też readera do późniejszego dowodu odmowy.
  Nie otwiera SDK, nie zużywa próby, nie tworzy journala/fence. CLI bez argumentów
  wypisuje wyłącznie pin i LIVE_BLOCKED; każdy argument oznacza odmowę.
  **executeProduction/recoverProduction bezwarunkowo odmawiają**, także przy
  poprawnych podpisach. Nie ma importu produkcyjnego connection ani nowej drogi LIVE.
- `cloud46f-evidence.js`: oddzielnie przypięty publiczny klucz recenzenta
  Ed25519, rzeczywiste bajty prywatnych artefaktów i ich hashe; zamknięcie listy
  publisherów/delegacji, sześć kategorii efektywnego IAM, cztery ścieżki publikacji,
  monitorowanie wyłączności w oknie, spójność dwóch obserwacji Rules i stanu IAM,
  tożsamość projektu/bazy, czterech kontekstów i różnych domen awarii hostów.
  Brak/zmiana/nieznany publisher oznacza odmowę. Format znajduje się w czysto
  syntetycznej `cloud46f-fixture.mjs`; **nie jest ona dowodem ani szablonem do
  mechanicznego zatwierdzenia produkcji**. Dowód operacyjny musi zawierać rzeczywiste
  artefakty i niezależny przegląd ich autentyczności/kompletności. Podpis/JSON,
  porównanie hashy i dwa GET same nie dowodzą wyłączności. Wynik walidatora to
  wyłącznie `SUPPLIED_EVIDENCE_COMPLETE_ONLY`, nigdy potwierdzenie stanu Google.
- `cloud46f-recovery.js`: podpisany checkpoint oryginalnego journala, sidecaru
  autoryzacji i obu fence. Osobno przypięty fingerprint podpisującego i hash
  najnowszego checkpointu muszą być wcześniej dostępne na drugim hoście.
  Import sprawdza oryginalny hash-chain, binding, HEAD i pełność plików w staging;
  fsync + rename publikuje podkatalog `restored`. Uszkodzony import pozostaje
  zachowany/zablokowany, nie staje się aktywnym journalem. Nie nadpisuje istniejącej
  próby ani markerów; nie zawiera wznowienia WRITE. Same hashe nie dowodzą,
  że kopia jest najnowsza — konieczny jest niezależnie utrzymany receipt repliki.
- `cloud46f-replica.js`: dekorator **istniejącego** journala. Potwierdzenie trwałej
  repliki poprzedza mutację; `recordRevision` wymaga potwierdzonej kopii przed
  pierwszym WRITE. ACK wiąże dokładny checkpoint/hash-chain/host/domenę awarii.
  Niepotwierdzona lub asynchroniczna kopia odmawia, pozostawiając zużytą próbę.
  STOP nie czeka na kopię przed samą administracją; brak późniejszego ACK nie
  uprawnia do ogłoszenia potwierdzonego wyniku. Nie ma retry. **Nie dostarczono
  transportu do rzeczywistego drugiego hosta** ani aktywnego wpięcia dekoratora
  w produkcyjne `openAuthorizedConnection`. Obecne E nie przyjmuje takiego
  journala na swoim wejściu. Do przyszłego aktywnego złożenia należy użyć jego
  istniejącego `bindAuthorizedRuntime` i tych samych fabryk; nie przepisywać cyklu.
- `cloud46f-demo-recovery.mjs`: wyłącznie literalne demo/loopback, niezależne
  administracja/weryfikator/reader i rzeczywisty UID/Auth readera. Wykorzystuje
  istniejący `stopAction`, CAS i admin adapter, potwierdza flagi oraz odmowę READ
  i WRITE w Rules. Zachowany `admin-inflight` blokuje poświadczenie bezpieczeństwa.
  Niepewny STOP pozostawia marker i blokadę powtórzenia.

Nie zmieniono operatora C/D/E, historycznych testów ani pinów, produkcyjnych
Rules, UI, LOCAL-FIRST lub danych. Brak zmian publicznych zasobów: manifest
offline jest sprawdzany, nie regenerowany. Nowy manifest F nie zastępuje C/D/E.

### Kontrakt przyszłego prywatnego złożenia — nadal nieaktywne

1. Właściciel ustanawia zaufanie do publicznego klucza recenzenta i klucza
   receiptów/checkpointów niezależnym kanałem. Prywatny klucz decyzji właściciela
   pozostaje osobny i nigdy nie jest przekazywany Codexowi. Kod produkcyjny F nie
   podpisuje decyzji; klucze generowane w testach są wyłącznie syntetyczne.
2. Drugi host utrzymuje samodzielne, odnawialne poświadczenia STOP/verifier/reader,
   zatwierdzony checkout i runtime (backend 7.11.0, OAuth 9.15.1, Web SDK z lockfile),
   najnowszy trwały checkpoint i receipt poza pierwotną domeną awarii.
3. Transport replikacji musi mieć ograniczony czas, potwierdzać fsync/read-back
   na niezależnym nośniku i podpisywać dokładny receipt dopiero po nim. Żadnego
   async fire-and-forget; ACK utracony oznacza STOP, bez ponowienia WRITE.
   Kod callbacka `replicate` i jego dostępność wymagają prywatnego środowiska;
   lokalna kopia w testach **nie** potwierdza tego warunku.
4. Przed certyfikacją STOP po utracie hosta: potwierdzić zewnętrzne odcięcie starej
   administracji, w tym rozstrzygnięcie wysłanego `stage/activate`. Sama śmierć
   procesu, token expiry, timeout, kopia fence lub chwilowe `enabled:false` nie
   wykluczają spóźnionego RPC. Nie kasować `admin-inflight`. Jeżeli tego dowodu
   brak, utrzymać STOP/niepewność i eskalować do uprawnionego operatora.
5. Po osobnym przeglądzie/zgodzie na aktywację złożyć istniejący runtime E z
   replikowanym journalem, zachować claim przed IO, authority sidecar przed pierwszą
   fazą i jedno WRITE. Oryginalne `executeProduction()` nadal pozostaje odmową.
   Kod przygotowania nie jest aktywatorem i nie wykonuje tego kroku.
6. Dopiero w zatwierdzonym oknie uzyskać świeże Rules/read-back, efektywne IAM,
   delegacje/publisherów/wyłączność oraz Spark/billing/limity (500 reads/30 writes).
   Historyczne `billingEnabled:false` z 30.10 zachowano bez powtórnego audytu.
   Potrzebne sześć osobnych podpisanych decyzji: zakresy z `gate.FUTURE_SCOPES`,
   związane także z `bundle.finalChecks.fastTrack`: sourceManifestSha256 F,
   evidenceSha256, reviewerFingerprint i checkpointSha256. Dla recovery — nowa
   podpisana action recover-stop tej samej próby, bez WRITE/stage/activate.
   Rzeczywiste 635 B rollbacku sprawdza istniejący walidator; template 755 B odpada.

### Rzeczywiste kontrole i CI

- Node 22.23.3, `CLOUD_CI_HISTORY_ROOT=/workspace/cloud-history-306f90a4`:
  `node tools/cloud46f-fast-track-smoke.js` — **10/10 PASS**, 0 skip/todo.
  Obejmuje odmowy, 25 mutacji dostarczonych dowodów, utracony ACK repliki,
  import uszkodzony/stary/obcy, zachowanie admin/recovery fence, rzeczywisty
  SIGKILL kontrolowanego procesu, brak nowej próby i brak IO przygotowania nawet
  z sześcioma poprawnymi syntetycznymi podpisami.
- Rzeczywiste Auth/Firestore demo: `emulators:exec --project demo-meble-app
  --config firebase-live-pilot.json --only auth,firestore` i
  `node --test --test-name-pattern=CLOUD-4.6F live-readiness.test.mjs`:
  **5/5 PASS**, 0 skip/todo, 8,30 s części testowej. Publikacja prawdziwego
  syntetycznego payloadu, utrata ACK po commit, drugi klient/readVerify, trwała
  replika przed WRITE, utrata katalogu źródła, STOP z nowych kontekstów,
  niezmienny nagłówek rewizji i odmowa kolejnego READ/WRITE. Przerwana weryfikacja,
  reader offline, admin-inflight, obcy UID i produkcyjny host dają odmowy.
  Po dodaniu jawnego porównania hash-integrity odczytanego dokumentu wykonano
  tylko ten zmieniony przypadek ponownie: **1/1 PASS**. Hash dokumentu to istniejące
  zweryfikowane pole integrity, a nie SHA całej serializacji zawierającej to pole.
- Podczas diagnostyki poprawiono własną fixture podwójnego zamykania Auth;
  istniejące teardown/asercje nienaruszalności RAM/storage są wykonywane także
  przed celowym wyłączeniem pierwotnego klienta. Nie maskowano błędu aplikacji.
- `ci-sharding-smoke`: **182 current smoke**, każda kontrola dokładnie raz;
  nowy smoke jest automatycznie obowiązkowy. Pięć nowych przypadków rejestruje
  istniejący CURRENT `live-readiness.test.mjs`, partia 1 z istniejącego planu
  [5,1,2]. Całe stare suite i historyczne C/D/E pozostają w obowiązkowym CI.
  Nie zmieniano workflow/package.json ani planu plików; nie dodano skip/retry.
- Składnia **11 JS/MJS**, diff, 425 pinów, integralność F/offline oraz
  `cloud-ci-current-boundary-smoke.js` — **PASS**. Brak zmian publicznych plików
  lub historycznych źródeł/pinów; manifest offline pozostał identyczny.
  Pełny Preflight/SDK/historical dla tego HEAD: **CI_PENDING**, nie uruchamiano.

**CODE_READY** dotyczy przygotowania offline i regresji; **OPERATOR_PARTIAL /
CI_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED** dla przyszłego wykonania.
Rzeczywiste IAM/Rules/uprawnienia, oryginał rollbacku i całkowita awaria dwóch
niezależnych hostów pozostają **PENDING / NO_ACCESS**. Dostępny był tylko jeden
host Codexa. Nie przeprowadzono prywatnego rehearsal ani Firebase LIVE.

Najbliższy krok: niezależna kontrola dokładnego HEAD/BASE tej gałęzi i jedna
osobno zatwierdzona próba CI; równolegle wskazać prywatny drugi host i operatora
STOP, aby wykonać powyższy rehearsal bez produkcji. Dopiero jego dowody pozwolą
zatwierdzić minimalne aktywne złożenie oraz odrębne operacje LIVE.
