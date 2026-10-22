# CLOUD-4.6D — nieaktywny kandydat pierwszego Firebase LIVE

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
