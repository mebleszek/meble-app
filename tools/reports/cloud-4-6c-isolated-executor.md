# CLOUD-4.6C — izolowany wykonawca, LIVE zablokowane

Baza: `af75be7201f3941c639bb41e5fa0e296a5720ae8`. Gałąź:
`cloud-4-6c-isolated-executor`. Zgoda obejmuje implementację, testy do przyszłego
CI, commit i push; nie obejmuje PR, merge, Pages ani operacji Firebase LIVE.
Sprawdzono bieżący main, AGENTS §3 i §10–14, CURRENT_STATE, ROADMAP,
CLOUD_MIGRATION, CLOUD_DATA_REGISTER i raport CLOUD-4.4. Kontrakt LOCAL-FIRST
pozostaje przyszłym osobnym zadaniem; ten wykonawca nie jest synchronizacją.

## Zakres i istniejące mechanizmy

- `cloud46c-proof.js`: przegląd czterech odrębnych decyzji wyłącznie typu
  `emulator-rehearsal-only`, przypiętych do UID, bazy, próby, BASE, pakietu,
  Rules i terminu. Nowy manifest obejmuje kod, testy i skrypt CI. Sprawdzane są
  również niezmienione manifesty/425 pinów i dowody CLOUD-4.2–4.4. Nie napisano
  drugiego walidatora baseline, źródła syntetycznego ani modelu projektu.
- `cloud46c-executor.mjs`: dowody → stage → activate → jeden WRITE → osobny
  READ → administracyjny STOP → niezależna weryfikacja. Używa
  `openDemoOperator`, `grantActions`, `stopAction` i `readDecision`. Każda
  granica sprawdza integralność, tożsamość, termin oraz rzeczywiste źródło
  Rules emulatora. Niepewny WRITE może zostać zdiagnozowany niezależnym READ,
  ale wynik całego cyklu pozostaje odmową. Nie ma automatycznego retry.
- Próba jest konsumowana przed operacją: w uchwycie, procesie i pliku `wx`
  z `fsync` w stałym `/tmp/meble-cloud46c-demo-attempts-v1`. Brak prawa zapisu,
  niebezpieczny katalog lub istniejący znacznik oznaczają odmowę. Brak API
  resetu. To pomocniczy dziennik demo zachowany przy restarcie procesu na tej
  maszynie, nie produkcyjny dziennik i nie gwarancja przetrwania utraty `/tmp`.
  Dotychczasowe Rules dodatkowo zabraniają zastąpienia pierwszego manifestu.
- Timeout/STOP podczas await nie anuluje zdalnego commita. Wykonawca odrzuca
  spóźniony wynik; STOP nie czeka na zawieszonego writera. Dopóki wcześniejsze
  RPC może się zakończyć, nie potwierdza STOP i nie zwalnia blokady istniejącego
  operatora. Niepewny lub przerwany STOP pozostawia `STOP_REVIEW_REQUIRED`.
- `cloud46c-demo-transport.mjs`: jedyny akceptowany adapter, oznaczony prywatnym
  WeakSet. Cztery różne aplikacje SDK: writer, reader, administracja i kontrola
  STOP. Sprawdza rzeczywisty projekt/bazę SDK, host `127.0.0.1:18080`, SSL=false,
  Auth emulator `127.0.0.1:19099`, UID/epoch i istniejące lease. Nie przyjmuje
  własnego SDK, buildera, Storage, adresu sieciowego ani flagi LIVE. Dane buduje
  istniejąca izolowana, zapieczętowana `MemoryStorage` źródła CLOUD-4.
- Granty stosuje niezmieniony `applyDemoAction` (CAS, `maxAttempts:1`). Reader
  ponownie buduje i sprawdza pełne bajty/model/hash przez istniejący kontroler.
  Sprawdzenie STOP czyta dwie flagi na innym połączeniu, potwierdza odmowę
  dostępu do pilota w świeżej transakcji zwykłego readera i zachowanie Auth-only,
  gdy normalne uprawnienie aplikacji nadal istnieje. Nie cofa zapisanych danych.
- Rules pobierane są tylko przez literalny loopback `:ruleCoverage`, bez
  redirectów, z kontrolą oryginalnego źródła przez `verifyDeployedRules`.
  Nieznana odpowiedź/HTTP/bajty są odmową. To kontrola emulatora, nie odbiór
  produkcyjnych Rules ani atomowy CAS publikacji Rules.

`executeProduction()` jest dokładnie dotychczasową bezwarunkową odmową.
Nie powstał adapter ani launcher produkcyjny; istniejący `.mjs.txt` pozostał
niezmieniony i zablokowany. Żadnych wpisów w UI, startupie lub manifestach
aplikacji, zmian lokalnego autorytetu, Rules aplikacji, IAM/billingu i danych
klientów. Kalkulatory, PCV/jeden zapas 10%, 4/3/6, katalogi, magazyn i historia
ofert są poza zmianą. Nie zmieniono AGENTS ani workflow.

## Wymagana weryfikacja i właściciel

Właściciel automatycznych regresji: **GitHub Actions**, istniejący
`.github/workflows/preflight-js.yml`, dopiero po osobno zatwierdzonym PR Ready
z dokładnym HEAD/BASE. Nie uruchomiono ani nie utworzono takiej próby.

| Ścieżka istniejącego CI | Przygotowane pokrycie |
| --- | --- |
| `node tools/preflight.js` | Automatycznie wykrywa nowy `cloud46c-proof-smoke.js`: dowody, zmienione bajty, odmowa produkcji, brak integracji startupu; zachowuje wszystkie dotychczasowe regresje domenowe i CLOUD-4.4/loadera. |
| `npm test` w `tools/firebase-pilot` | Zachowuje pięć dotychczasowych plików SDK/Rules; dołącza istniejące `cloud42-plan.test.mjs`, `cloud44-admin.test.mjs` oraz nowy `cloud46c-executor.test.mjs`. Wszystkie pliki są jawne i wykonywane kolejno na jednym projekcie demo. |
| Nowe scenariusze SDK | 15 scenariuszy: pełny cykl, failed WRITE, rzeczywisty commit z utratą ACK, CAS, obcy UID/projekt/baza, późny wynik, STOP w await, przerwany STOP, zmienione Rules przed/w trakcie cyklu, odebrane uprawnienie, odmowa produkcji i odmowa dostępu do obcych/globalnych ścieżek na emulatorze. |

Każdy scenariusz SDK ma osobny worker. Blokady po niepotwierdzonym STOP nie
są kasowane przez test ani produkcyjny reset. Fault injection istnieje wyłącznie
w testowym `node:test mock`: korzysta z prawdziwego transportu SDK i rzeczywistego
commita; adapter nie ma konfiguracyjnej ścieżki fault/LIVE. Każdy worker weryfikuje
dwa hosty emulatorów przed inicjalizacją. Timeout testu kończy jego worker.

Rzeczywiście wykonane przez Codex kontrole tego pakietu:

- Celowane testy offline Node 22: **3 PASS, 0 FAIL, 0 SKIP** (powiązanie dowodów,
  odmowa zmienionych bajtów, brak podłączenia do startupu).
- Jedna celowana diagnostyka rzeczywistego orkiestratora z atrapą transportu w RAM: **PASS**. Potwierdziła kolejność stage/activate/WRITE/READ/STOP/weryfikacja/close, brak drugiego run i bezwarunkową odmowę produkcji. Nie była cyklem SDK ani emulatorowym.
- Kontrola składni 6 nowych JS/MJS i `git diff --check`: **PASS**; bez pełnego Preflightu, testów domenowych lub emulatorów lokalnie.
- Próba launchera smoke systemowym Node 24 napotkała `spawnSync EPERM` w sandboxie.
  Dlatego trzy kontrole uruchomiono bez subprocess isolation przez Node 22
  `--test --experimental-test-isolation=none`. Nie zmieniono launchera/asercji CI.
- Instalacje zależności przerwano wcześniej; pakietu SDK/emulatorów **nie
  uruchomiono**, nie ma dla niego PASS. Na wznowieniu nie ponawiano instalacji.

Wyniki offline nie potwierdzają pozytywnego cyklu SDK ani formatu odpowiedzi
uruchomionego emulatora dla bieżącego SHA. Te kontrole są obowiązkowe w CI;
brak odpowiedzi źródłowej Rules będzie jawnym FAIL, nigdy pominięciem. Nie
przenosić historycznego PASS CLOUD-4.4 na ten pakiet. Prywatne testy oryginalnego
rollbacku pozostają poza repo/CI, do wykonania przez właściciela po udostępnieniu
oryginału uprawnionemu wykonawcy.

## Checklista przyszłej aktywacji — NIE jest zgodą wykonawczą

Wszystkie poniższe bramki pozostają **otwarte / LIVE_BLOCKED**:

- [ ] Oryginalny prywatny rollback **635 B**, SHA-256
  `9260ebcd881e5a0cc2302e768f14e2e8152637093de071449ea90211461ffa91`.
  Osobno udowodnić posiadanie bajtów i możliwość ograniczonego wycofania przez
  istniejący walidator. Nie kopiować oryginału do repo, CI ani raportów.
- [ ] Aktualny, osobno dopuszczony odczyt efektywnego IAM: granty bezpośrednie
  i dziedziczone, grupy, delegacje/impersonation kont usług, federacja, konta
  automatyzacji i uprawnienia do zmiany IAM. Sam spis ról nie dowodzi faktycznej
  wyłączności. Bez ujawniania tokenów, kluczy i prywatnych treści.
- [ ] Zewnętrzne ścieżki publikacji Rules: konsola, Firebase CLI, REST/SDK,
  CI/CD innych repozytoriów i środowisk oraz inni administratorzy. Dowód
  wstrzymania wszystkich konkurujących publisherów na całe okno operacji.
- [ ] Dowiedziona wyłączność publikacji; dwa GET, boolean `exclusive:true`,
  lokalny plik próby i transakcja grantu nie są atomowym CAS Rules.
  Nieznana ścieżka/operator lub utrata wyłączności oznaczają STOP.
- [ ] Imiennie wskazani wykonawca, operator administracyjnego STOP,
  niezależny reader i weryfikator STOP, z właściwymi uprawnieniami i procedurą
  dla zawieszonego klienta, utraconego ACK i konfliktu STOP. Ochrona prób po
  restarcie wymaga osobnego produkcyjnego dziennika i protokołu odzyskiwania.
- [ ] Świeże pełne metadane/source Rules (projekt, baza, release/ruleset,
  wersje/czasy i dokładne bajty), kontrole przed i po zmianie, dowód read-back
  przez niezależnego wykonawcę. Ostatnia kontrola tuż przed operacją.
- [ ] Świeże Spark, billing wyłączony, bieżące zużycie i limity, budżet
  odczytów/zapisów (dotychczasowa rezerwa co najmniej 500/30), granice kosztowe
  i plan ograniczenia operacji. Bez samoczynnego przejścia na billing.
- [ ] Odrębna zgoda na dokładne Rules i warunki ich wycofania.
- [ ] Odrębna zgoda na konkretny UID, projekt/bazę i stage/activate grantu.
- [ ] Odrębne zgody na jedną próbę syntetycznego WRITE oraz niezależny READ,
  dokładny pakiet, źródło, rewizję, zakres dokumentów i okno wykonania.
- [ ] Odrębna zgoda na administracyjny STOP i niezależne potwierdzenie,
  również po błędzie/timeout. Nie zakładać zgody na rollback danych lub
  powtórzenie konfliktowej operacji. STOP nie usuwa wcześniejszego zapisu.
- [ ] Osobna implementacja, przegląd i świadome zatwierdzenie aktywacji
  produkcyjnego wykonawcy. Obecna funkcja odmowy i loader nie są przełącznikami.
  Role klienta i termin klienta nie są serwerowym rozdziałem ról ani TTL.
- [ ] Osobna zgoda na PR Ready/CI/wydanie dla dokładnego HEAD/BASE;
  żadna pozycja tej listy nie uruchamia operacji automatycznie.

**Status implementacji: CODE_READY. Weryfikacja: CI_PENDING. Firebase:
LIVE_BLOCKED.** Bez wydania i bez LIVE_APPROVED. Ryzyka niezamknięte: wymagane
CI dla nowego SHA, prywatny rollback, świeże dowody/uprawnienia/wyłączność,
produkcyjny protokół prób i osobna implementacja/zgoda wykonawcza. Ograniczenia
serwerowego TTL, rozdziału ról i atomowości publikacji Rules pozostają jawne.
