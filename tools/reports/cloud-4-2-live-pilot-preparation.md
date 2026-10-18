# CLOUD-4.2 — pakiet przeglądu pierwszego syntetycznego pilota LIVE

## Stan, pochodzenie i granica uruchomienia

Baza: najnowszy main `d517d598917e5ccd6f1460950697c9ab27f1db1c`, drzewo
`772af0cc8e8e0822301c48662ceef3053527ce53`, po scalonym
[PR #62](https://github.com/mebleszek/meble-app/pull/62).
[Wydaniowe CI](https://github.com/mebleszek/meble-app/actions/runs/39154418002),
[Pages](https://github.com/mebleszek/meble-app/actions/runs/39154752366) i
[pełne CI CLOUD-4.1](https://github.com/mebleszek/meble-app/actions/runs/39153193743)
zakończyły się SUCCESS. Dawne blokady emulatora są historią. Nie powtarzamy audytów CLOUD-1/2/3.

Gałąź: `cloud-4-2-live-pilot-preparation`. To przygotowanie offline i próba na
emulatorach, bez odczytów/zapisów Firestore, logowania administracyjnego,
odczytów produkcyjnych Rules, grantów, IAM, deploymentu lub billingu.
Nie tworzono PR ani nie publikowano aplikacji.

**Kandydat operatora jest tekstem do osobnego przeglądu, nie aktywnym launcherem.**
`cloud42-package.js` nie importuje SDK, nie uruchamia Firebase i nie wykonuje sieci.
`prepare()` zwraca `REVIEW_REQUIRED_NOT_ACTIVATED`, source, jego SHA oraz plany CAS.
Nie ma tu eksportowanej funkcji otwierającej produkcyjny adres, polecenia CLI,
publicznego UI ani getterów Auth/lease/transportu. Istniejący launcher CLOUD-4.1
nadal bezwarunkowo odmawia LIVE. Nie ma parametru `target`/`live=true` do odblokowania.

## Artefakty i integralność

- `tools/firebase-pilot/cloud42-source-pins.json`: 423 przypięte pliki źródłowe,
  w tym wszystkie `js/*.js` rekurencyjnie, index, źródło/worker syntetyczny,
  kompilator i driver CLOUD-4.1, Rules oraz lockfile.
- `cloud42-package.js`: kontrola rzeczywistych bajtów pinów, statycznego projektu
  `mebleszek-meble-app`, origin `https://mebleszek.github.io`, dokładnego
  `/meble-app/index.html`, konfiguracji Auth, UID, jednej roli i terminu <=15 minut.
  Każde wywołanie zużywa limit, także odmowa. Zmiana źródła lub nieznane pole = STOP.
- `cloud42-approval.template.json`: niekompletny szablon, sam nie daje dostępu.
  UID i obserwowane granty wprowadza się później wyłącznie do prywatnej pamięci
  operatora, po osobnej zgodzie; nigdy do repo, logów CI, URL lub publicznego raportu.
- `cloud42-reviewed-loader.mjs.txt`: nieruchomy szablon prywatnego loadera do
  osobnego wydania, z SHA w pakiecie. Nie jest importowany przez aplikację ani
  używany do LIVE w CI. Przed dotknięciem strony wymaga odrębnego zapisu decyzji
  właściciela wskazującego dokładne piny, SHA pakietu/loadera/kandydata/Rules,
  bazę, projekt, UID, rolę i termin. Nie przyjmuje ogólnego scope ani payloadu.
- `cloud42-rules-deploy.json`: tylko wskazanie minimalnych Rules, bez indeksów.
- `cloud42-rules-rollback.json`: tylko wskazanie poprzedniego Auth-only.
- `cloud42-rehearsal.mjs`: wyłącznie loopback/demo, używa niezmienionego rzeczywistego
  wykonawcy oraz tego samego wrappera limitów co kandydat. Produkcyjny adres jest
  odrzucany przed dotknięciem strony. Nie można zmienić celu flagą.

Minimalne Rules SHA-256:
`eaeb3e67417955bbd67d2881902d3827023502c2948ce0a19dc583c66b5a2e92`.
Auth-only/rollback SHA-256:
`fd92cffababe500cba62ed6e592b482760ce9e66df35f01419c44edff2f10cd3`.
`inventory()` podaje też hash indeksu pinów i modułu pakietu.
Hash kandydata zależy dodatkowo od prywatnego UID, roli i krótkiego terminu;
po zatwierdzeniu statycznego pakietu należy sprawdzić konkretną instancję przed
każdym wykonaniem. SHA potwierdza bajty, **nie** jest podpisem właściciela ani ACL.
Rzeczywiste uprawnienia nadal egzekwują serwerowe Rules i administracyjny grant.

## Co dokładnie zawiera kandydat operatora

Powstaje w RAM z kompilatora CLOUD-4.1, z kontrolą jednoznacznej struktury i pinów.
Oryginalne pliki nie są nadpisywane. Jedyna różnica docelowa wewnątrz kandydata
to zamiana twardej granicy emulatora na zamkniętą kontrolę dokładnego projektu,
origin, ścieżki i konfiguracji Auth. Wrapper przypina UID, rolę i termin do
jednego wywołania. To nie jest ogólny transport ani przełącznik dotychczasowego API.

Pozostałe kontrole pozostają dokładnie z CLOUD-4.1: istniejące App/Auth tej strony,
Google UID zatwierdzony przez serwer, aktualny lease/epoka, lokalny profil,
zakończony loader oraz `session.inspectExportState()` przed i po oczekiwaniu.
Aktywna trwała sesja i niepotwierdzone pozostałości oznaczają odmowę; nie ma
automatycznego commit/cancel/recovery. Źródłem pozostaje worker MemoryStorage,
nie magazyn właściciela. Przegląd obejmuje też dokładny SHA kandydata, bo tekst
ma możliwość wykonania LIVE dopiero po świadomym wydaniu i prywatnym załadowaniu.

W przyszłym, osobno zatwierdzonym wykonaniu używa się świeżej, odizolowanej strony
Playwright. W niej istniejący zwykły Google login tworzy **jedną** sesję i lease;
operator pożycza je wewnątrz lexical main, bez drugiego Auth i bez przechwytywania
sesji działającej karty właściciela. Osobny czytelnik ma drugi izolowany kontekst
SDK tego samego zatwierdzonego UID. Nie otwieramy profilu z danymi właściciela.

Przed załadowaniem kandydata przyszły operator ma: sprawdzić wszystkie piny i SHA,
podmienić wyłącznie odpowiedź pobrania main-login na pustą w prywatnym routingu,
załadować dokładną przypiętą kopię statycznych plików pod zatwierdzonym origin,
zweryfikować publiczną konfigurację Auth i brak wcześniejszego `__FC_MAIN_ACCESS__`,
a następnie ocenić zatwierdzony source dokładnie raz przez `page.evaluateHandle`.
Jest to osobna bramka **wydania konkretnego kandydata i wykonania**, niewykonana
w CLOUD-4.2. W repo jest wyłącznie nieruchomy szablon `.mjs.txt`, bez aktywnego
entrypointu LIVE. Nie wolno otworzyć kandydata w już uruchomionej aplikacji.
Po zatwierdzonym wydaniu prywatnej kopii szablonu `openReviewedCandidate()`
otrzymuje checkout, pakiet i odrębny rekord decyzji, sprawdza je przed otwarciem
strony, zwraca tylko `execute()/close()`. `execute()` nie przyjmuje parametrów:
używa tylko zatwierdzonej roli i zgody. Nie jest to publiczne API aplikacji.

## Osobne zgody i procedura produkcyjna — NIC z tego nie wykonano

### 1. Pierwsza operacja: wyłącznie sprawdzenie stanu Rules i budżetu

Oddzielna zgoda ma obejmować odczyt/eksport **aktywnie przypiętego** wydania
Firestore Rules dla `mebleszek-meble-app`, bazy `(default)`, wraz z nazwą release
i rulesetu, oraz kontrolę Spark/braku billingu i dostępnej kwoty w Console.
Nie wystarcza zapisany lokalny plik, szkic Rules lub sukces Auth.
Nie czytać w tym kroku dokumentów produkcyjnego Firestore ani zmieniać IAM.

Pobrane bajty sprawdzić offline przez `verifyDeployedRules('auth-only', bytes)`.
Inny SHA (także tylko formatowanie), inne wydanie/baza lub nieznany stan = STOP
i porównanie do osobnej decyzji, bez normalizowania lub nadpisania Rules.
Zachować prywatnie oryginalny eksport i identyfikatory release jako rollback.
Sprawdzić rezerwę co najmniej 500 odczytów i 30 zapisów zgodnie z CLOUD-4;
to limit organizacyjny, nie serwerowy licznik. Nie aktywować billingu.

### 2. Osobna zgoda na dokładne minimalne Rules

Po zielonych testach i przeglądzie konkretnego commita/bajtów:

```sh
# WYŁĄCZNIE po osobnej zgodzie produkcyjnej, nigdy w CI:
firebase deploy --only firestore:rules --project mebleszek-meble-app --config tools/firebase-pilot/cloud42-rules-deploy.json
```

Nie używać głównego `firebase.json`, pełnych Rules CLOUD-3 ani deployu indeksów.
Zarchiwizować wynik kompilacji/release i ponownie wyeksportować aktywne Rules;
`verifyDeployedRules('minimal', bytes)` musi potwierdzić SHA. Sama komenda deploy
nie jest dowodem zgodności. Auth-only nadal ma działać; kontrola dokumentów
dostępu i próby klienta wymagają objęcia ich następną wyraźną zgodą.

### 3. Osobna zgoda na ograniczony grant i jego kontrolowane wycofanie

Przeczytać wyłącznie `authorizedUsers/{UID}`, `appAccess/{UID}` i `pilotControl/cloud4`.
Wymagane: istniejący Google UID właściciela, `appEnabled:true`, dokładny
`appAccess:{schemaVersion:1}`, `enabled:false`; singleton nieobecny lub wyłączony.
Nieznane pola/obcy scope, włączony pilot lub zmiana równoległa = STOP.

`prepare({uid,role,expiresAt,grant,appAccess,control})` tworzy plan:

1. **stage**: singleton `enabled:false`, grant `enabled:false` i tylko dwa stałe ID;
2. **activate**: wyłącznie dwa `enabled:true` po porównaniu całych trzech dokumentów;
3. **stop**: singleton oraz projektowe `enabled:false`, bez zmiany `appEnabled`,
   `appAccess`, globalnych pól i pozostałych wartości.

Każdy etap to zaufana transakcja administracyjna: odczyt wszystkich trzech
konkretnych dokumentów, `assertExpected(action, observed)`, następnie tylko
`action.writes`. Grant jest aktualizowany, nigdy zastępowany całym starym snapshotem.
Test `cloud42-plan.test.mjs` wykonuje dokładnie takie transakcje na emulatorze.
W repo nie ma Admin SDK, sekretów ani wykonawcy administracyjnego dla produkcji.
Wyłączenie pilota po próbie należy objąć tą zgodą z góry, aby STOP nie czekał
na dodatkową rozmowę. Gdy snapshot ulegnie zmianie, wstrzymać klientów i uzyskać
nową ocenę aktualnego stanu; nie nadpisywać równoległych zmian starym planem.
Po takim przeglądzie `stopAction()` buduje osobny plan wyłączenia z AKTUALNEGO
snapshotu, także przy już cofniętym appEnabled. Zachowuje zmienione prawa globalne
i appEnabled:false; nie służy do ponownej aktywacji.

Prawa klienta: tylko własny `users/{UID}/pilotProjects/cloud4-project-v1` oraz
immutable rewizje/fragmenty. Pierwsza publikacja generation=1/base=0, żadnego
update/delete/list; grant i singleton niedostępne klientowi. Całe globals,
katalogi, ceny i inne projekty pozostają default-deny. Podrobiony plik zgody
nie zmienia serwerowych uprawnień.

### 4. Osobna zgoda na wydanie kandydata, jeden zapis i niezależny odczyt

Zatwierdzić dokładny pakiet/piny, UID prywatnie, jednego writer-a i reader-a,
scope, czas <=15 minut oraz zatrzymanie po jednej próbie. Przygotować pakiety
oddzielnie dla ról `write` i `read`, bez logowania ich UID/tokenów.
Potwierdzić brak edycji i danych właściciela w profilach operatorów.

Jedna operacja `{role:'write', approval:packet.approval}` na zatwierdzonym uchwycie.
Źródło: istniejący fikcyjny `cloud4-investor-v1/cloud4-project-v1`, 6797 B;
payload SHA `711f2fea49873bab0c4f76b5e8e0e666c4796190ed9fbfda71557d35890ba2e3`,
document SHA `5c9bc70f8fc1d7a15cef742150636e41ebacde404e57bd6109213f82d28d81a1`.
Istniejący manifest = konflikt i STOP, bez wybierania nowego ID dla obejścia.
Poprawna próba tworzy trzy dokumenty: rewizję, fragment i manifest.

Drugi kontekst SDK tego samego zatwierdzonego UID wykonuje tylko `role:'read'`.
Sprawdza serwer, rewizję, fragment, rozmiar, UTF-8, canonical JSON, wszystkie hashe,
model i równość ze źródłem. Wynik wyłącznie w RAM, bez importu i WYCENY.
`readDecision(write, read)` nie wydaje zgody na ponowny zapis. Przy znanym
revisionId wymaga zgodności. Jeśli odpowiedź zginęła bez poznania revisionId,
poprawny odczyt potwierdza stan syntetyczny, ale nie przypisuje go bez dowodu
konkretnej próbie (`attribution:unattributed`). Nie zmieniać tego w pozorny sukces.

### 5. Niepewność, zakończenie, wycofanie

`published:unconfirmed`, utrata Auth/grantu/lease lub błąd sieci po rozpoczęciu
publikacji: STOP kolejnych zapisów, żadnego retry, resetu ID, rollbacku danych ani
usuwania stagingu. Zatwierdzony niezależny odczyt tego samego zakresu ustala stan.
Brak manifestu nie upoważnia do nowej próby; nowa decyzja właściciela jest konieczna.

Zamknąć uchwyty/worker i odizolowane konteksty. Wykonać zatwierdzony plan stop
z porównaniem aktualnych dokumentów i read-back; zachować `appEnabled/appAccess`.
Pozostawić syntetyczne dokumenty do kontroli, bez automatycznego delete/TTL.
Po osobno zatwierdzonym cofnięciu Rules użyć wyłącznie konfiguracji rollback,
tego samego jawnego projektu i `--only firestore:rules`, potem sprawdzić aktywne
Auth-only bajt w bajt. Nie przywracać włączonego grantu ani poprzedniego stanu
globalnych uprawnień ze starej kopii. Wycofanie uprawnień nie cofa zatwierdzonego zapisu.

## Weryfikacja i gotowość

Automatyczny workflow CLOUD-4.2: tylko push na tę gałąź, contents:read, Node 22,
Java 21, oficjalny emulator i Chromium, demo-meble-app, sekwencyjne procesy.
Wykonuje offline smoke, transakcje planów, live-readiness, prywatny roundtrip
przez wrapper CLOUD-4.2, pełne SDK/Rules, startup, pełny Chromium/Auth i Preflight.
Zero pominięć w pełnych zestawach; błąd blokuje dalsze etapy. Piny i ścisły diff
chronią produkcyjne pliki, Rules, modele oraz workflow wydaniowy.

- Kod: kandydat i próba emulatorowa do przeglądu; brak aktywacji produkcyjnej.
- Rules: gotowe minimalne bajty i rollback; stan wdrożenia wymaga osobnego odczytu.
- Grant: gotowe plany CAS i testy; rzeczywisty UID/dokumenty nie były odczytane.
- Operator: gotowy source i nieruchomy szablon loadera do osobnego wydania;
  nie ma aktywnego entrypointu LIVE.
  Próba emulatorowa nie jest testem produkcyjnego OAuth, produkcyjnej kwoty ani ACL.

Nie zmieniono UI, Zapisz/Anuluj, katalogów, magazynu, PCV, ROZRYSU, WYCENY,
modeli ani autorytetu danych. Nie oznacza to synchronizacji lub migracji chmurowej.
