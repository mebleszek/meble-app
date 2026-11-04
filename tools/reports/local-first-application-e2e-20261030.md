# LOCAL-FIRST application end-to-end — 30.10.2026


## LOCAL-FIRST + synchronizacja w tle — 04.11.2026


### Standard HDF — kontynuacja po decyzji właściciela

Wejściowy HEAD `3c6ced45f2a4259af2734fd8091aed9db18d2e74`, ta sama gałąź i BASE `afee03d2b408dd78b85ec3efcb575fffb568457b`. Właściciel zatwierdził: **„HDF 3mm biała czyli najpierw materiał i jego grubość a później kolor”**. Historyczny STOP opisany poniżej jest rozstrzygnięty; nie wymaga ponownej zgody. **CODE_READY / CI_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**. Pełny celowany E2E zakończony **1/1 PASS, 556,75 s**, bez skip/cancel/todo; nie oznacza CI ani urządzeń właściciela.

- Nazwa fabrycznego `m4` i wygenerowany artefakt są zgodne z formularzem. Widok istniejącego katalogu pokazuje nazwę standardową na kopii rekordu, zachowując oryginalny RAW/cache. Odczytowy resolver w istniejącym `catalog-selectors.js` rozpoznaje nową i dokładną poprzednią nazwę; wymaga jednego rekordu typu hdf. WYCENA i walidacja zależności transportu korzystają z tego samego resolvera. Nie wprowadza innych synonimów, rekordów, cen ani heurystyk po fragmencie nazwy. Dwa pasujące rekordy dają null/odmowę, również przy różnej cenie; stary fallback WYCENY nie wybiera wtedy rekordu.
- Nie przepisuje RAW, projektów, obrazów ani starych aliasów. Stary katalog z nową referencją i nowy katalog ze starą referencją zachowują dokładną cenę i jednostkę istniejącego rekordu. Brak źródła, inna grubość/kolor i nieznane materiały nadal odmawiają. Porównanie wygenerowanego modelu z main potwierdziło, że **wszystkie 14 domen i reguły są identyczne poza nazwą `m4`**; ceny, ID, normy, zamienniki i pozostałe pola identyczne.
- Produkcyjny bootstrap ma przygotowane `localOnly:true,backgroundSync:true`: lokalna gotowość poprzedza autoryzację i uruchomienie replikacji w tle. Zmiany kodu nie wykonują LIVE w środowisku implementacyjnym. Zgoda na wydanie musi osobno obejmować późniejsze produkcyjne READ/WRITE przez aplikację. Brak PR/Actions/merge/Pages, operacji na urządzeniu i Firebase LIVE.
- Zmienione klasyczne zasoby katalogu/selektorów/WYCENY mają `20261104_hdf_name_v1` w obu HTML i rejestrze wersji. Generator i manifest przeliczone z rzeczywistych bajtów. Bez zmian Rules, polityki SW, writer-fence, geometrii lub UI poza zatwierdzoną nazwą materiału.

| Kontrola kontynuacji | Faktyczny wynik | Wymagany CI |
| --- | --- | --- |
| `code-global-catalogs-smoke.js` | **8/8 PASS**, w tym obie nazwy / oba katalogi, dokładna indywidualna cena, niezmienność, brak/konflikt/inna grubość i kolor | Preflight 6/7 |
| `cloud-global-data-smoke.js` | **13/13 PASS**, dotychczasowy capture/pack/unpack, odmowy i limity bez zmian | Preflight 6/7 |
| `quote-exact-calculations-smoke.js` | **83 przypadki PASS**, kwoty/normy/frozen i istniejące obliczenia | Preflight 7/7 |
| `cloud-auth-smoke.js` | **39/39 PASS**, w tym FAIL przed / PASS po poprawce ponownego verifiera, nadal świeży RPC i odmowa dostępu | Preflight 7/7 |
| `first-sync-error-diagnostics-smoke.js` | **10/10 PASS**, anonimowość i wersje | Preflight 7/7 |
| `android-local-first-browser-smoke.js` | **11 grup PASS**, w tym drugi inwestor/projekt/pokój offline, niezmienne wcześniejsze rekordy i katalogi oraz atomowa odmowa zmiany dwóch projektów; końcowy sekwencyjny przebieg po poprawkach verifiera i statusu zamknięcia **11/11 PASS** | Preflight 5/7 |
| `project-storage-write-failure-smoke.js` / `android-investor-isolation-smoke.js` | **PASS / PASS**, quota nadal odmawia, brak fałszywego zapisu i rozdzielony RAM właścicieli | Preflight 4/7 |
| `android-globals-recovery-smoke.js` | **7 grup PASS**, realny runtime czeka na close, odtwarza kontroler dla tego samego właściciela i sprawdza istniejący writer-fence; obcy właściciel/druga karta odmawiają | Preflight 5/7 |
| `one-app-startup-smoke.js` | **9/9 PASS**, istniejące granice startupu i drenowanie starego odczytu | Preflight 5/7 |
| `cloud-sync-global.test.mjs`, filtr `LOCAL-FIRST background sync` | **1/1 PASS, 556,75 s**, 0 fail/skip/cancel/todo: oba kierunki, drugi klient/edytor, readmission, RAM, offline/SIGKILL/ACK bez duplikatu, nowy projekt i WYCENA, konflikty i rzeczywiste cofnięcie appAccess zaufanego telefonu | Firebase CURRENT batch 3, istniejący obowiązkowy plik |

**Końcowy dowód (04.11):** Node 24.19.0, Chromium 151.0.7922.173, rzeczywisty SDK Auth/Firestore i emulator Firestore 1.22.0 / Java 21, wyłącznie `demo-meble-app` na loopback. UI/Google enrollment korzysta z dotychczasowej syntetycznej injekcji; serwerowa weryfikacja appAccess/syncAccess, Rules, cztery store, kanały, ACK i podpisany release slot są rzeczywiste w DEMO. Uruchomiono tylko wskazany nowy przypadek SDK, nie cały plik ani pełne CI. Native **11/11 PASS** wykonano sekwencyjnie na końcowych bajtach produktu. Składnia 19 zmienionych JS/MJS, zgodność wersji obu HTML, wygenerowanego artefaktu i manifestu 490 zasobów oraz rozłączne przypisanie 201 smoke / 7 grup i CURRENT 8 / 3 partie: PASS. Pełne CI i fizyczna synchronizacja właściciela pozostają PENDING.

Verifier ponownie używa dokładnych opcji memory-only tego samego app SDK; każdy świeży verifier nadal wykonuje własny GET i transakcję oraz sprawdza właściciela/epoch/TTL. Nie reużywa proof. Zamknięty runtime raportuje ACK=false, a po ponownym logowaniu wymaga nowego działającego kontrolera. Wersje obu zasobów inwestorów: `20261104_scoped_investor_insert_v1`; wcześniejsze wersje pakietu tła zachowane w ramach tej niewydanej gałęzi, bajty w aktualnym manifeście.

Dodatkowy rzeczywisty błąd: `create` i `upsert` inwestora normalizowały także `rooms` wcześniejszego inwestora. Nie osłabiono trafnej odmowy committera. Istniejący repository zapisuje teraz wyłącznie wskazany rekord i zachowuje pozostałe obiekty ze starego obrazu; nie używa ich znormalizowanego widoku. Native regresja miała **FAIL przed / PASS po** i porównuje dokładnie wcześniejsze rekordy, globals, source i pozostałe store; mutacja dwóch projektów nadal odmawia atomowo. Hipoteza zmiany routingu scope nie była przyczyną i jej próbna zmiana nie jest częścią pakietu.

Kontrola wznowienia wykazała zamknięty kontroler tła po ponownym dopuszczeniu właściciela. Runtime czeka na jego zakończenie i odtwarza jedną instancję oraz istniejące nasłuchy, bez przebudowy Auth. Podłączenie ponownie stosuje `boot.verifyFence()` przed tworzeniem intencji. Deterministyczne regresje realnego runtime miały **FAIL przed / PASS po**; pełny Chromium dodatkowo sprawdza drugą kartę oraz wylogowanie/logowanie w tym samym dokumencie. Bez nowych blokad lub zmiany polityki SW.

### Historyczne próby diagnostyczne kontynuacji

Poniższe FAIL/PENDING opisują kolejne reprodukcje przed końcowym **1/1 PASS** podanym wyżej. Nie są bieżącym statusem pakietu; zachowujemy powody poprawek i niezaliczone próby.

W kontynuacji pierwsza próba po utrwalonym uncertain zatrzymała się na asercji `navigator.onLine === false` po restarcie — Chromium zmieniał renderer. Test stosuje istniejący wzorzec CDP: debugger przed pierwszym skryptem, prawdziwe zablokowanie sieci i `Network.overrideNetworkState`; nadal wymaga offline przed kodem aplikacji, bez podmiany navigator lub pominięcia asercji. Następna próba przeszła crash/recovery, ale formularz nowego inwestora nie miał wymaganego notes; uzupełniono wyłącznie dane syntetyczne, bez zmiany walidatora. Nowy projekt obejmuje także prawdziwy formularz szafki, podstawową WYCENĘ offline oraz sprawdzenie pełnego odebranego modelu i powiązania HDF/ceny/jednostki na komputerze. Te poprawki bodźców nie są deklaracją pełnego E2E PASS.

Dodatkowa reprodukcja harnessu: przełączanie sieci przez Playwright context i osobną sesję CDP mogło emitować online przy nadal zablokowanym transporcie, powodując trwałą odmowę dynamicznego importu SDK w tym dokumencie. Test stosuje jedną sesję CDP do rzeczywistej sieci i stanu navigator, jak istniejący test zimnego offline startu; pięć małych reprodukcji importu po online PASS. Zachowano offline przed pierwszym skryptem i wszystkie asercje ACK. Nie zmieniono produkcyjnego loadera/Auth ani nie zastąpiono sieci podmianą JavaScript. Końcowy E2E musi potwierdzić usunięcie tego zakłócenia.

Po korekcie emulacji sieci E2E zaliczył transfery obu kierunków, trwały uncertain, restart offline, niezależny ACK z identycznym HEAD serwera (bez drugiej publikacji), nowego inwestora/projekt/pokój/szafkę z natywnego formularza offline, WYCENĘ i dokładny odebrany payload oraz HDF/cenę/jednostkę. Próba **382,73 s / FAIL** zatrzymała się dopiero przy odnowieniu dostępu przed kontrolą dodatkowej karty. Pierwsza hipoteza dotyczyła visibility loss: zwykłe `context.newPage()` ukrywa dokument, a verifier wtedy cofa lease. Nie wyłączono tego zabezpieczenia. Kolejna próba **386,70 s / FAIL** z widocznym dokumentem i ważnym MAIN dowiodła, że ta hipoteza nie wyjaśnia odmowy; nie wykonano nawet RPC do appAccess. Bodziec sprawdza teraz klienta w rzeczywistej karcie utworzonej przez CDP `background:true`, z asercją widoczności oryginalnej karty oraz rzeczywistym HTTP 423. Osobna mała reprodukcja Chromium potwierdziła brak visibilitychange. Wszystkie asercje niezmienności i odmowy writer-fence zachowane. Inna próba miała timeout inicjalizacji drugiego interfejsu w domyślnych 30 s; diagnostyka UI obejmuje teraz zasoby/stan, a jawny limit to te same 45 s co inne etapy UI (cykl synchronizacji nadal 120 s, TTL bez zmian). Rzeczywista przyczyna drugiej odmowy: każda instancja verifiera tworzyła nową instancję `memoryLocalCache()`. Firebase SDK porównuje opcje inicjalizacji i odmawia ponownego `initializeFirestore()` z takimi opcjami; odtworzono to także bez emulatora (bez RPC). Istniejący verifier przechowuje teraz w WeakMap opcje memory-only przypisane do tej samej aplikacji Auth oraz nie konfiguruje ponownie już podłączonego emulatora. Nie współdzieli dowodów dostępu, lease ani watcherów: każdy verifier nadal wykonuje świeży GET i transakcję, a retire zamyka wyłącznie własne nasłuchy. Domyślny close nadal kończy połączenie; wyłącznie zatwierdzony retainConnection zachowuje współdzielony DB. Nowa regresja miała **FAIL przed / PASS po**; Auth **39/39 PASS**, rzeczywisty SDK z syntetycznymi odpowiedziami odczytów również PASS (bez RPC). Kontrole drugiej karty i readmission przeniesiono przed długi round trip, bez usunięcia asercji. Pełny końcowy wynik nadal oczekiwany.

Po poprawce SDK następna próba **187,11 s / FAIL** dotarła do rzeczywistej autoryzacji, ale spodziewała się klienta originu po HTTP 423; Chromium może zastąpić tę odpowiedź dokumentem błędu. Korekta bodźca **129,35 s / FAIL** wykazała, że CDP bypass nie przeżywał tej nawigacji; nie zmieniono produktu. Końcowy helper zachowuje asercję 423, a obecność starego dokumentu odwzorowuje przez pusty syntetyczny dokument HTML tego samego originu. Fixture używa lokalnej nawigacji POST (istniejący worker obsługuje GET), nie ładuje aplikacji/Auth i niczego nie zapisuje; bez bypass SW, podmiany originu lub zmiany polityki produktu. Mały rzeczywisty Chromium potwierdził dwa klientów w `clients.matchAll()`.

Wzmocniono także warunek końca readmission: ważny MAIN, stan local-only i bieżący ACK; stary `businessState=ready` nie zalicza zamkniętego runtime. Znaleziono związany błąd diagnostyczny: zamknięty runtime zwracał poprzednie `cloudConfirmed:true`. Teraz jawnie raportuje pending/LF_CLOSED/false; nie zmienia IDB ani ACK operacji. Regresja realnego runtime miała FAIL przed / PASS po, **7/7 grup PASS**. Test Chromium wymaga false po wylogowaniu oraz rzeczywistego wznowienia w tym samym dokumencie. Pełny końcowy scenariusz nadal PENDING.

Bezpośrednia kontrola niezmienionego produkcyjnego SW z rzeczywistym dodatkowym dokumentem tego samego originu potwierdziła **LF_OTHER_APPLICATION_CLIENT**. W pełnym teście odnowienie już trwające przed utworzeniem klienta mogło być współdzieloną obietnicą; test teraz najpierw drenuje poprzednią autoryzację, tworzy klienta, sprawdza fence bezpośrednio i wymaga nowego `normalConnectionEpoch` przed asercją odmowy w runtime. Nie ponawia nieudanej asercji. Ta końcowa sekwencja oraz readmission po logout mają PASS w bieżącym przebiegu, a pełny E2E nadal oczekuje na wszystkie pozostałe asercje.

Próba **511,03 s / FAIL** zaliczyła wszystkie osiem głównych scenariuszy (w tym drugi klient/readmission i nowy projekt offline → odbiorca), a zatrzymała się w przygotowaniu profilu konfliktu: przed włączeniem LOCAL-FIRST `globalDataContract` nie jest ładowany przez zwykły bootstrap. Fixture importuje teraz rzeczywisty kontrakt przed capture; nie zmieniono aplikacji ani danych scenariusza. Przed końcową odmową dostępu test wymaga też ustabilizowanego odbiorcy. Pełny wynik po tej korekcie jest PENDING; wcześniejszego częściowego PASS nie traktujemy jako zaliczenia całego testu.

Próba **780,06 s / FAIL** zaliczyła także obie ścisłe odmowy konfliktów; przed końcowym usunięciem appAccess zadziałała istniejąca pięciominutowa bezczynność desktopu (MAIN nieważny, runtime locked, ACK false). To nie odmowa serwera ani powód do zmiany Auth. Końcowa asercja rzeczywistego server denial jest skierowana na nadal dopuszczony zaufany telefon, z jawnym sprawdzeniem checkboxa zaufania i gotowości, a potem z tymi samymi porównaniami source/image/outbox. Nie przedłuża TTL/idle, nie podmienia zegara i nie odblokowuje wygasłej sesji. Pełny wynik tej korekty nadal oczekiwany.

### Ograniczenia przekazania

**Granica:** strict porównanie lokalnego i zdalnego globals nadal uwzględnia nazwę rekordu. Odczytowa zgodność referencji HDF nie jest automatyczną migracją dwóch różnych obrazów, scalaniem katalogów ani zgodą na zmianę danych produkcyjnych. Rzeczywisty stan katalogów/Rules/grantu pozostaje nieznany; konflikt daje odmowę i wymaga rozstrzygnięcia zamiast nadpisania. Fizyczny test telefonu/komputera nadal DEVICE_SYNC_PENDING. Końcowy E2E trwał 556,75 s i przekracza miękki budżet 90 s; nie zmieniono twardych timeoutów produktu, workflow ani progów PASS. Wydanie, CI i produkcyjne READ/WRITE wymagają odrębnej zgody na dokładny HEAD/BASE. Jeden nowy commit kontynuacji po WIP `3c6ced45`, bez przepisywania jego historii; wynikowy HEAD w przekazaniu.

### Historyczny zapis zatrzymania na HEAD 3c6ced45 — nie jest statusem kontynuacji

Gałąź `feat/local-first-background-sync-20261104`, BASE/main **`afee03d2b408dd78b85ec3efcb575fffb568457b`**, potwierdzony git/remote. Właściciel potwierdził działające kolejne szafki po wydaniu PR #112 i zatwierdził podłączenie bieżącego LOCAL-FIRST do synchronizacji w tle. **BLOCKED / CI_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**; **nie CODE_READY**. Prototyp rozwiązuje podłączenie silnika w testach, lecz nie cały start synchronizacji zwykłych szafek. Produkcyjne podłączanie pozostawiono wyłączone jak w BASE. Pełny bieżący scenariusz ma FAIL, zgodnie z dowodami poniżej.

### Implementacja w istniejącym silniku

- Bootstrap pozostaje localOnly: lokalny obraz i 14 domen są gotowe przed dopuszczeniem chmury. Jawna konfiguracja testowa `backgroundSync:true` po starcie, zakończeniu operacji, powrocie sieci lub widoczności może podłączyć istniejącą replikację. Produkcyjne `deployment()` nadal ustawia wyłącznie `localOnly:true` — brak automatycznej aktywacji nieukończonej ścieżki. Jedna obietnica odnowienia, rzeczywista sesja Google tego samego właściciela, świeży gate/admission i istniejący podpisany sync grant; bez drugiego logowania, wydłużenia TTL czy nowego Auth/UI. Przy zmianie trybu na zaufany zachowuje przyjęty kontekst dla następnego reconnect. Wycofany verifier zamyka własne nasłuchy, zachowując współdzieloną instancję SDK używaną przez bieżące połączenie.
- `application-background-sync.mjs` jedynie składa istniejące kanały, committer, discovery, synchronizator i cztery store. Nie dodaje magazynu, nowej bazy ani schematu. Dotychczasowy trwały obraz jest źródłem jeszcze nieopublikowanej pracy. Pierwsze podłączenie porównuje obraz/CAS z niezależnym odczytem zdalnych zakresów; odmienny cennik/projekt pozostaje konfliktem. Nie przyjmuje automatycznie zdalnych globals nad definicjami z kodu.
- Po uzyskaniu własnego edytora zatwierdzony Save przechodzi przez istniejący atomowy zapis application/replica/protected/outbox. Aktywna sesja zachowuje lokalny draft i RAM. Istniejący edytor offline musi być własny; nowy lokalny projekt nie potrzebuje fikcyjnej serwerowej rewizji, powstaje offline i jest dopuszczany do kolejki dopiero po autoryzacji. Jawne Wyjdź przekazuje czysty zakres; drugi edytor odmawia. Oryginały/receipt/binding/fence i walidatory pozostają obowiązkowe.
- Przy podłączeniu wykorzystywana jest istniejąca bariera transakcji/odczytu rescue. Kandydat połączenia nie zamyka starego synchronizatora, zanim uzyska barierę i potwierdzi idle. Spóźnione generacje nie raportują potwierdzenia. Otwarty formularz szafki oraz istniejące blokady formularzy/RAM zatrzymują incoming; zamknięcie istniejącym gestem wybudza właściwy synchronizator. Brak reload/resetu i automatycznego Save formularza.
- Istniejąca diagnostyka sesji odróżnia `local-pending`, `pending` i `confirmed`. Potwierdzenie wymaga zgodności aktualnego obrazu i wszystkich jego projektów/katalogów z czystymi replikami oraz wyłącznie verified ACK, bieżących guardów i niezmienionej wersji. Aktywny formularz/draft nie jest potwierdzeniem chmury. Kod przyczyny przechodzi przez istniejący zamknięty słownik; brak RAW/UID/cen/wyjątków. Zmienione skrypty mają wersję `20261104_background_sync_v1`, manifest obejmuje 490 zasobów; protokół i polityka SW bez zmian.

### Celowane dowody i routing

Wyłącznie syntetyczne profile/rekordy, loopback `demo-meble-app`, rzeczywisty Chromium 151.0.7922.173 i SDK Auth/Firestore, emulator Firestore 1.22.0, Java 21, Node 24.19.0. Google/UI admission ma dotychczasowy syntetyczny bodziec; transport, serwerowa weryfikacja appAccess/syncAccess, Rules, IDB i ACK są rzeczywiste w emulatorze. Nie jest to dowód Google/Firebase LIVE ani telefonu właściciela.

| Kontrola | Wynik bieżącego pakietu | Obowiązkowy routing |
| --- | --- | --- |
| `cloud-sync-global.test.mjs`, filtr `LOCAL-FIRST background sync` | **FAIL (1/1, 512,88 s)**: pełne fabryczne 14 domen/dwa projekty, oba kierunki, drugi edytor i ochrona formularza potwierdzone; lost ACK został odzyskany przed restartem, asercja trwałego uncertain nie przeszła. Poprawiony bodziec rzeczywistego odcięcia sieci po commit **NIEWYKONANY** po odkryciu niezależnego blokera materiałów | Istniejący Firebase CURRENT batch 3, plik dokładnie raz; helper nie jest osobnym pomijanym testem |
| `android-local-first-browser-smoke.js` | **FAIL**: 6 wcześniejszych grup do abortu formularza PASS, dodatkowe istniejące `validateProjectDependencies` na rzeczywistej szafce odmawia `LF_PROJECT_DEPENDENCY_MISSING`; dalsze etapy niezaliczone. Pierwszy dodatkowy przebieg miał setup/CDP timeout, bez asercji; osobny sekwencyjny odtworzył konkretny błąd kontraktu | Preflight 5/7 |
| `android-startup-auth-smoke.js` | **6 grup PASS**, te same odmowy/TTL/same-owner | Preflight 5/7 |
| `cloud-auth-smoke.js` | **38/38 PASS**, w tym domyślne terminate oraz zamknięcie współdzielonego verifiera | Preflight 7/7 |
| `first-sync-error-diagnostics-smoke.js` | **10/10 PASS**, dotychczasowe odmowy/wersje i anonimowe potwierdzenie | Preflight 7/7 |
| `production-application-smoke.js` | **8/8 PASS**, istniejące granty/podpis/Rules/fabryki/piny | Istniejący obowiązkowy Preflight |
| `pixel-session-bookmarklet-smoke.js` | **15/15 PASS**, zgodność wygenerowanego kolektora | Preflight 4/7 |

Nowy scenariusz ma przygotowane asercje obejmujące istniejące lokalne projekty, rzeczywiste fabryczne 14 domen, transfer w obie strony, odmowę drugiego edytora, niezapisany formularz, pracę offline, utratę ACK po faktycznym zatwierdzeniu serwera, SIGKILL i zimne offline wznowienie tej samej instalacji, brak ponownej publikacji, nowy projekt/szafkę offline, konflikty obu źródeł i rzeczywistą odmowę appAccess. **Nie deklarujemy PASS restartu/recovery nowego tła ani zwykłej szafki w chmurze:** po odtworzeniu kontraktowego blokera dalsze próby zatrzymano. Asercje wcześniejszych scenariuszy zachowane. Przy pełnych fabrycznych katalogach zakończenie transferu ma jawny limit 120 s (UI 45 s); wcześniejszy limit 45 s skończył się przy trwającym cyklu, mimo już verified zapisów. Nie zmieniono TTL, timeoutów transportu ani warunków PASS. Czas scenariusza przekracza miękki budżet 90 s — do oceny kosztu w osobno zatwierdzonym CI, bez ukrytego retry lub pomijania przypadku.

### Konkretny STOP: opcja pleców a rekord cennika

Rozszerzony istniejący `android-local-first-browser-smoke.js` po rzeczywistym formularzu trzech szafek i trwałym Save wywołuje **niezmienione** `businessProjectContract.build()` i `validateProjectDependencies()`. Raport syntetycznych zależności wskazał `backMaterial = HDF 3mm biała`; pozostałe odwołania materiałowe (nazwa laminatu i jego typ) są rozpoznawane. Fabryczny rekord ma id `m4`, symbol `HDF-3-BIALY`, nazwę `HDF biały 3 mm`, jednostkę m². Żadne id/name/materialType nie równa się opcji formularza, więc transport prawidłowo odmawia. Oryginalne definicje, ceny, normy i payload szafki zachowano.

Odrębna odczytowa kontrola rzeczywistego `catalog-selectors.js` z istniejącym generatorem kodowym potwierdziła: `findSheetMaterial('HDF 3mm biała') === null`, kanoniczna nazwa rozwiązuje się do `m4`; **CONFIRMED**, bez mutacji danych/cen. `wycena-core-catalog.materialPriceLookup()` korzysta z tego resolvera i analogicznego dokładnego fallbacku. To nie brak grantu ani problem kolejki: konieczne jest ustalenie wspólnego znaczenia opcji UI i rekordu cennika.

AGENTS §4: **„Jeżeli reguła biznesowa nie wynika jednoznacznie z aktualnego kodu, testów lub dokumentacji, zatrzymaj się i zapytaj użytkownika zamiast przyjmować własne założenie.”** Automatyczne dopisanie aliasu albo powiązanie po fragmencie nazwy przypisałoby znaczenie materiałowe/cenowe bez takiego kontraktu. Nie zmieniono walidatora, nie dopisano sztucznego rekordu do fabrycznych katalogów, nie przestawiono wyboru formularza w teście ani na urządzeniu. Dodana regresja ma pozostać czerwona do rzeczywistej poprawki uzgodnionego kontraktu, zamiast maskować problem.

**Minimalna decyzja do kontynuacji:** zatwierdzić (albo wskazać inne) powiązanie kodowej opcji „HDF 3mm biała” z istniejącym `m4`, a następnie spójny resolver WYCENY/transportu z zachowaniem oryginalnej ceny, jednostki, ID i wszystkich RAW. Po decyzji kontynuować ten sam pakiet: potwierdzić zwykłą szafkę i WYCENĘ na obu urządzeniach oraz dokończyć przygotowane ACK/restart/offline/conflict/denial testy. Bez nowego ogólnego audytu, resetu lub LIVE. Obecna gałąź jest wyłącznie przeglądalnym zapisem niedokończonej pracy; nie jest pakietem do wydania.

### Granice przekazania

Pełny Preflight, pozostałe pliki Firebase CURRENT i historyczne zestawy należą do osobno zatwierdzonego CI. Plan nadal ma 201 smoke / 7 rozłącznych grup, CURRENT8, bez zmian workflow, Rules i 425 historycznych pinów. Testy celowane nie zastępują CI_PASS.

Nie odczytywano ani nie zmieniano Firebase LIVE, Rules/IAM/grantów/billingu i danych Pixela; brak resetu, PR, Actions, merge i publikacji. Obecny kod produkcyjny nie włącza podłączania. Przyszłe włączenie po dokończeniu pakietu może wykonywać rzeczywiste READ/WRITE: **wymaga osobnej zgody właściciela na ten zakres produkcyjny oraz dokładny HEAD/BASE**. Faktyczny stan Rules/grantu i zgodność zdalnych globals/projektów są nieznane. Konflikt nie uprawnia do merge, kasowania chmury, wyboru cen ani ponownego resetu. Po dopuszczeniu wydania/operacji właściciel sprawdza na Pixelu/komputerze jeden projekt w obie strony, następnie offline Save/restart/reconnect oraz rozróżnienie lokalnego i serwerowego potwierdzenia; dopiero to daje DEVICE_SYNC_PASS.

## Revision and scope

Product branch: `integration/android-local-first-20261030`. Continued input
`f3ae3374dfa581ea93d4bffa80f6d338070ff898`, reconciled with released main
`6588cac972fc1ebbfe57f80ad55b4d22620a7647` through merge
`6db5164c433d1cded5b3cd47cb9f79895b2d1be0`. No force push or release merge.

PR #87 is MERGED, head `c220ac506ca345077f13eec26a695d8e6d6f42ca`.
GitHub read-only evidence: run [41038339355](https://github.com/mebleszek/meble-app/actions/runs/41038339355)
completed successfully, including safety, Preflight, Firebase current, CLOUD
historical, auto-merge and exact-merge Pages verification. These are documentation
release proofs, not CI evidence for this product branch. Compact documentation
and complete archives were retained; no archive was rewritten.

## Implemented application path

- `application-authority.mjs` explicitly installs an emulator-only application
  image in the existing LOCAL-FIRST IDB control store. It is not the backup archive.
  Current repositories read this image; original covered localStorage bytes remain
  untouched recovery sources. Approved Save commits the image, replica and outbox
  atomically, with a version CAS and hashes. No local/cloud success before commit.
- Writes of covered keys outside an asynchronous transaction refuse. Concurrent
  transactions, source changes/old-tab storage events and clear() refuse. The
  controlled installer requires loopback, the exact demo connection, test database,
  matching UID and valid existing local access. A production-name initialization
  refuses with `LF_OLD_WRITER_EXCLUSIVITY_UNPROVEN`.
- Existing Save/Cancel and clean Exit have optional bindings. Save notices wait
  for local durability. Cancel keeps its real confirmation and native proof/owner
  checks; rollback must match the approved local replica and may not add an outbox
  operation. Clean Exit first confirms durable session closure. Failed transactions
  restore the previous image, RAM/session/UI state instead of acknowledging success.
- Draft transactions retain session proof and local draft bytes without approving
  their publication. Explicit adapter resume uses the existing session validator;
  it does not create a missing snapshot, repair proof, retry begin or replay WRITE.
  A corrupt/missing proof remains blocked. Startup hydrates the IDB image and shows
  the verified investor; remembered UI alone does not grant a new room edit.
- `application-replication.mjs` composes the existing channels and coordinator.
  Verified remote content is projected into the application image in the same IDB
  transaction as the replica CAS. Active RAM/session, dirty local data/outbox,
  wrong owner, conflicting aliases and stale application version prevent apply.
  Rendering follows commit and the unchanged-RAM witness. Company transport.apiKey
  remains local and is never included in the network model.
- Head listeners and online/local-commit signals wake synchronization. A confirmed
  commit joining a cycle in progress now requests another outbox scan; otherwise a
  queued operation could remain unpublished after the last listener event. This
  is queue scheduling, not retrying an uncertain WRITE. Uncertain operations still
  resolve from an independent server read and the durable expected revision.
- Owner-scoped project discovery registers channels only after the same independent
  chunk/hash/dependency validation. A fresh receiver needs no preconfigured project
  inventory. Its emulator-only Rules fragment permits owner-approved head queries
  bounded to 100 results per request; pagination reads the full inventory. Unbounded
  queries, foreign UID, deletes, and revision/chunk/editor listing remain denied.
  No deployed/production Rules or grant was changed.
- Android fixes from the input commit remain. A newly reproduced defect was in
  project-bootstrap: rendering called project.save() even when normalization made
  no content change. The observed difference on investor switch was only
  `projects[1].updatedAt`; the captured stack proved refresh -> normalize -> save.
  Normalization now fills RAM defaults without implicitly committing a revision.

## Supported data and explicit refusals

The single existing CLOUD-3 contract still defines all 14 globals: materials,
hardware, manufacturers, suppliers, categories, types, technicalParams,
hardwareSettings, labor, workshopServices, stock, programDefaults, company and
businessCosts. Primary sources and historical aliases use that contract; a
conflicting alias refuses without erasing either source. No second data register.

`business-project-v1` carries the exact selected investor, full owned project
record and its unambiguously owned frozen offers. It retains IDs, values, unknown
allowed fields, project-local PCV and layouts. It reuses existing geometry,
relationship, PCV and dependency validators, immutable chunks, revision hashes,
CAS and editor epochs. No synthetic eligibility flags are stamped onto real
records. Historical `native-project-v1` pilot validation remains unchanged.

Unsupported structures return `LF_PROJECT_SCHEMA_BLOCKED` with the original
validator reason. In particular, this does not claim support for constructions
outside the existing room-validator coverage (standard cabinets/drawers and
supported set layouts). A whole dependent project refuses, rather than silently
omitting its cabinets or treating a partial project as complete.

Nonempty fc_edge_v1, fc_material_part_options_v1, fc_rozrys_grain_state_v1,
fc_rozrys_overrides_v1 and unresolved quote drafts remain protected and block the
dependent project. Unowned history, pending domain operations, incomplete room
ownership and missing catalog dependencies refuse. Issue #47 stays deferred.
Old RAW, backups, source keys and previously protected versions are not deleted.

## Targeted checks and mandatory CI

No full local Preflight or full Firebase regression suite was run. Development
failures were diagnosed and fixed within the new E2E, including inconsistent
fixture aliases, the queue wake-up race and implicit normalization Save. Final targeted E2E: **1/1 PASS**, 0 skipped, on Node 22.23.3/native Chromium;
74.06 s scenario / 76.39 s TAP lifetime. The receiver started with only its global
channel; both project scopes were discovered after publication. It is not inherited
from an earlier CI SHA.

| Check | Evidence / CI owner |
| --- | --- |
| application-e2e.test.mjs | Real native Chromium profiles, real IDB, pinned Web SDK and Auth/Firestore emulators. Full index/bootstrap/repositories, original Save and Cancel controls. UI Google popup/admission is an explicit fixture; transport Auth and Firestore are real emulator SDKs, not mocked network transports. |
| Round trip | Phone -> publication -> previously empty receiver -> computer edit -> phone; automatic commit wake, head-listener receive and online wake, without manual synchronize control. |
| Actual data | Two independently owned investors/projects, nonempty cabinet, real room creation, 14 domains, stock updates, frozen offer, exact unknown field, identical cut-list and labor result 21.375. |
| Offline / editor | Genuine SDK disableNetwork, locally durable edit, online reconciliation, second editor refusal, confirmed handover and stale editor refusal. |
| Draft / crash | Real SIGKILL and same-profile IDB/session recovery; explicit Save after draft resume. Another real SIGKILL after a successful server publication loses its ACK; recovery resolves with independent READ and exactly one WRITE. |
| RAM / Cancel / Exit | A remote catalog cannot replace an active local draft; original cancellation confirmation, unchanged approved RAW/outbox, clean Exit without logout, logout preserving IDB. |
| Security | Foreign UID denied; unbounded head inventory denied; old-writer fence refuses; no automatic LIVE startup. |
| application-authority-store-smoke.js | Real IDB image+outbox atomicity, quota abort rollback, application CAS, duplicate payload binding, SIGKILL persistence and production-name migration refusal. |
| business-project-contract-smoke.js | Whole owned payload/hashes/frozen fields, invalid owner/geometry/references, pending operation, ambiguous RAW, secret exclusion and conflicting alias preservation. |
| application-session-resume-smoke.js | Valid durable proof resume without writes; missing/corrupt proof or replacement of active session refused. |
| project-bootstrap-readonly-smoke.js | Both normalized and missing-default RAM paths perform no implicit Save or stored RAW/timestamp change. |
| empty-installation-browser-smoke.js | Native empty startup, actual investor/room Save, two-investor isolation, logout/reauthentication and document restart. |
| Restored-proof baseline | Existing project-session-restored-proof-smoke: **8/8 PASS**, including missing proof refusal, lost ACK attribution and safe Cancel cleanup. |
| Offline/load order/syntax/diff | Exact generated public asset hashes, coherent offline-shell contract, ordered classic script registration, syntax and scoped diff checks. |

Mandatory routing: `.github/workflows/preflight-js.yml` -> firebase-current ->
`tools/cloud-ci-emulators.js --context=current` -> cloud-sync-global.test.mjs ->
separate top-level application E2E. Existing LOCAL-FIRST 01–08 and all CLOUD-SYNC-1
assertions remain. New *-smoke.js files are automatically discovered by mandatory
Preflight; routing itself has a regression. Historical checkout
`306f90a4cfd8bcb4277aa8b4d140e911493ddd60` and its 425 pins are unchanged.
No workflow, dependency pins, Chromium launcher, business calculator or backup
archive implementation changed. Final changed/new JS/MJS syntax: **21/21 PASS** on Node 22.23.3. New store/contract/resume/readiness/RAM-normalization smoke controls and manifest/load order passed. The targeted empty-installation Chromium check passed on the available host Node 24; the real SDK E2E and final technical controls used pinned Node 22. Full CI and physical Android remain pending.

## Remaining activation conditions, separated by cause

**Code/integration boundary:** this is a controlled application composition, not
an automatic production cutover. All covered synchronous UI callbacks must either
enter its asynchronous transaction boundary or refuse. Their wholesale production
conversion/initialization and offline creation of a brand-new server-unknown
project are not declared complete. Existing, durably owned editor scopes can save
offline and resume. Unsupported construction contracts and ambiguous RAW do not
become supported because transport succeeds. These are concrete remaining code
boundaries, not missing Firebase credentials and not a request for another audit.

**Migration/environment proof:** production activation must demonstrate exclusion
of old/incompatible writers and a lossless versioned source/image handoff. Storage
event detection does not prove that every old device stopped writing. No such
proof or owner-data migration was fabricated. Normal application startup remains
unchanged and cannot activate this composition by a flag.

**LIVE/operator:** existing C/D/E code, executeProduction() refusal, six signed
decisions, private journal/fence/recovery and STOP protocol remain the basis.
No new operator or production launcher. Private host and independent STOP after
loss of the entire primary host still require actual separate availability,
journal/fence recovery, identities and permissions. Original private rollback is
635 B / SHA-256 9260ebcd881e5a0cc2302e768f14e2e8152637093de071449ea90211461ffa91;
no copy/template was fetched, reconstructed or committed. Historical billingEnabled:false
from the owner's 30.10 evidence was not re-audited. Fresh Rules/read-back,
effective IAM/publishers/exclusivity, Spark/limits and named STOP operator belong
to the separately authorized execution window, not this emulator task.

## Delivery status and next action

Controlled emulator integration is **CODE_READY** for independent review; the entire
production application cutover is explicitly INTEGRATION_PARTIAL. CI_PENDING /
PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED. Next: review this branch's exact
HEAD/BASE and the mandatory coverage, then obtain a separate approval for one CI
attempt. No PR, Ready/Draft change, workflow invocation, release merge, Pages or
Firebase production operation was performed.

## Jedna aplikacja — normalny startup 01.11.2026

Branch: `integration/one-app-local-first-20261101`. Exact requested BASE:
`864250c28bd52969859d3ef579cc3d1c98c3e796`, from
`docs/free-first-sync-priority-20261101`. Its FREE-FIRST decisions are preserved.
Read-only GitHub verification confirmed PR #95 merged at
`6ec80ef026eeacfdd8bc9dadf44972c342305776`, CI 41287514243 and Pages
41287757034 PASS; those are release evidence for #95, not for this package.
One new delivery commit contains this section; its full HEAD is in the handoff.

### Implemented path and authority

Normal `main-login` now calls the application bootstrap before business scripts
and after admission. On an explicitly configured loopback/demo installation the
existing application runs with browser-owned SDK connections and coordinator,
not a Node transport proxy. The public deployment remains inert and LIVE_BLOCKED.
No new UI or synchronize button, dependencies, workflow, operator or Rules.

Before legacy initializers execute, the boot adapter reads a lossless source
image or restores the verified IDB image. A versioned source receipt binds UID,
database, device and instance; missing receipt/image, different owner or source
hash refuses. Web Lock, exact SW single-window acknowledgement and source checks
refuse concurrent/stale clients. Original source keys, backups and unresolved RAW
are retained, with no automatic normalization or clearing. This is demonstrated
in disposable emulator profiles; it is not proof that every production old writer
is excluded. Production cutover remains refused.

Covered Save/Cancel, investor/room forms, price save/delete, supplier/dictionary
forms, company/default/cost settings, stock and offer-generation entry points await
the existing atomic IDB image+outbox transaction. Failed commits restore RAM,
session/editor state and form view; success notices and dialog results wait for
confirmed durability. A whole-store archive restore refuses before changing any
key or journal; export/retained backups remain available. Other covered writes
outside this boundary refuse instead of becoming a second localStorage authority.

Explicit global edits mirror the exact value to the aliases already declared in
CLOUD-3. Conflicting historical aliases or two different writes refuse; the helper
does not repair source RAW or infer ownership. Project/investor/offer transfer
uses the existing `business-project-v1` validation, immutable chunks, hashes,
pinned complete catalog revision and CAS. Unknown allowed fields remain exact;
unresolved grain/rotation/edge/drafts block the dependent project. No partial
project is published as complete and Issue #47 is not changed.

Real Google SDK contexts use the authenticated owner with a distinct in-memory
reader. Only explicit trusted local admission permits the SDK's own persistent
writer Auth; application code never exports or persists provider tokens. Offline
cold startup uses local proof + IDB without creating Google Auth. Online return
obtains a fresh cloud access proof. Confirmed denial invokes the existing local
revocation path; network uncertainty does not revoke local trust. Logout seals
writes and signs out the independent SDK contexts while retaining IDB/outbox.

A confirmed editor can save offline and resume the queue. Handover never uses a
timeout as permission to take over. A clean offline Exit keeps remote ownership;
a subsequent verified reconnect can release it only from the clean investor list.
A busy marker covers local commit **and** confirmed handover, so the next navigation
cannot race the remote release.

### Bugs found while integrating, and regression coverage

- Initial discovery could receive its only signal before startup was ready.
  `notify()` now wakes discovery too, including a pending wake during settling.
- Legacy boot could normalize source catalogs before the authority existed.
  Pre-business hydration/read-only source protection now precedes these scripts.
- Initial metadata seeding and remote application could race their IDB CAS.
  Seeding uses the same existing store exclusion boundary.
- Local checkpoint completion was earlier than asynchronous handover. The
  application operation remains reserved through its full completion; dialog
  results wait until reservation release.
- Cloud leases can be revoked on offline/background events while trusted local
  work continues. Reconnect renews the SDK proof, replaces channels and retires
  the previous reader; it does not republish uncertain operations.
- Reconnect assertions first await a new, authorized SDK connection generation
  and completed runtime binding, then check independent data delivery. This
  separates real asynchronous prerequisites without extending either deadline.
- A test-only network setup briefly exposed online before its other CDP layer
  allowed transport. Cold-start emulation now uses one target network controller,
  with actual offline established before the first script. No navigator shim,
  longer timeout, action retry or weakened assertion.

### Actual targeted evidence

Node 22.23.3, native Chromium, real IndexedDB and Firebase Auth/Firestore Emulator
Suite, project `demo-meble-app`. No full local Preflight, full Firebase suite or
GitHub Actions run was invoked.

| Check | Actual result |
| --- | --- |
| Existing actual-application E2E | PASS, 67.51 s. Kept original native Save/Cancel, SIGKILL/durable draft, lost ACK resolved by independent READ and one committed WRITE, foreign UID and CAS/editor/RAW protections. |
| New normal-startup two-profile E2E | PASS, 150.54 s (final exact-value and reconnect-readiness assertions); earlier combined targeted run 2/2 PASS, no skip/cancel/todo. Phone → Firestore → computer → Firestore → phone, real browser-owned SDK/coordinator, two investors, owned kitchen/cabinet/frozen offer, whole-project equality, exact values in all 14 domains, price 47.125 and stock 29, labor 21.375 and identical cut list, native touch Save/room gestures, original Cancel, second editor refusal and handover, same-window offline reconnect, natural browser restart/cold offline recovery without Google login, offline logout with IDB retained. |
| New startup boundary regressions | 8/8 PASS. Public-origin refusal/no unapproved IO, one asynchronous writer, promise completion, required CI routing, lost initial discovery wake, handover reservation, alias integrity and archive-restore refusal before side effects. |
| Real IDB authority store | PASS. Application+outbox atomicity, quota abort rollback, local CAS, duplicate integrity, real SIGKILL persistence and production migration refusal. |
| LOCAL-FIRST activation contract | PASS. Synthetic signatures only: exact artifact/UID/Rules and revocation; a global-only permit cannot open project scope, altered image/absent exclusivity/bad signature refuse before network. No actual production HTTP or owner signing. |
| Business-project / session-resume / readiness | PASS. Owned RAW/frozen fields, unknown fields, local-only company credential, ambiguous RAW refusal, valid durable proof reuse and missing/corrupt proof refusal; old and new suites remain mandatory. |
| Trusted main login | PASS. Desktop idle/bfcache/reauth, trusted offline cold access/logout, real denied grant vs network uncertainty, existing event guards and unsaved RAM. |
| Four affected quote/cache-version regressions | PASS: duplicate-offer guard, generate single flow, orphan edit cleanup, snapshot clean store. Expected versions come from the canonical register; cache checks remain. |
| Offline/versions/load order | PASS: generated manifest equals actual public bytes, shell integrity/no takeover, exact HTML versions and ordered auth/business groups. |
| Syntax / growth / diff | 37/37 changed/new JS/MJS syntax PASS; 35 changed modules checked for growth, 0 blocked; scoped diff clean. |
| Original CLOUD-4 / historical isolation | PASS: original 6797 B, payload SHA 711f2fea49873bab0c4f76b5e8e0e666c4796190ed9fbfda71557d35890ba2e3, unchanged document pin and 425 historical sources. Current stale operator packages still refuse as designed. |

The new SDK observer returns the original SDK promises, never changes results,
retries input or waits for an artificial PASS. UI Google popup/admission remains
an explicit fixture; data transport, independent SDK readers, Firestore Rules,
IDB and native input are real emulators/browser mechanisms. The new cold restart
is a confirmed normal browser shutdown; the earlier E2E separately retains genuine
SIGKILL cases. No claim of a physical Android test.

Mandatory routing: Preflight's existing `*-smoke.js` discovery includes
`one-app-startup-smoke.js`; Firebase Current's existing batch-3 entry
`cloud-sync-global.test.mjs` invokes both old application E2E and the new normal
startup case. No prior test was removed. Other current files, seven smoke shards,
three emulator batches and the frozen 425-pin historical job remain unchanged.
The rest of their regression results remain **CI_PENDING** for this new HEAD.

### Exact remaining limits and first real Firebase activation

1. **Code boundary:** this package connects the normal application in a controlled
   demo installation. Production image initialization/cutover still refuses and
   needs a separately approved binding to a proven versioned source handoff.
   `authorizeApplicationFirebase` prepares a separately signed project/global
   scope, image/owner/Rules binding and revocation; its short permit is not a
   permanent automatic production policy. Credentials alone do not remove this
   code boundary. No flag, environment switch or `executeProduction()` bypass.
2. **Explicitly unsupported scope:** a brand-new server-unknown project needs its
   first online editor confirmation. Bulk deletion/tombstones, archive import or
   restore and unsupported/ambiguous project RAW cannot be called fully synced.
   They refuse without erasing their existing data. Existing durable editors work
   offline; losing their device is a conflict/recovery question, not a lease
   timeout permitting another editor.
3. **Release/environment:** review this exact HEAD/BASE, separately approve CI and
   release, then check Android with the deployed version. Before any owner-data
   cutover prove old-writer exclusion and source/recovery agreement in the real
   profiles; do not infer it from emulator single-window evidence.
4. **LIVE authority:** separately authorize current owner-only Rules/grants,
   actual target/database/UID and the first limited Firebase operation. Historical
   Spark/billing/Rules evidence was not re-audited; check genuinely required fresh
   state at that authorized window. Keep mandatory cost 0 zł; exceeding Spark
   limits must refuse, never enable billing. No VPS/CLOUD-4.6G/distributed STOP
   dependency was added to ordinary product sync. The existing pilot's execution
   blocks remain unchanged.

Implementation is **CODE_READY for the controlled emulator scope**;
production cutover is **INTEGRATION_PARTIAL / LIVE_BLOCKED**. CI_PENDING /
PHONE_PENDING / RELEASE_BLOCKED. No PR, Ready/Draft change, workflow invocation,
merge, Pages, production GET/WRITE, Rules/IAM/billing/grant change or owner-data
migration was performed.

## Produkcyjna synchronizacja — pakiet 01.11.2026

Gałąź `integration/production-local-first-20261101`, BASE `6d6513775ef1e6535503304d5a9540eda33a243c`; HEAD to końcowy commit zawierający ten wpis (pełny SHA w przekazaniu). PR #97 wydany: HEAD `1eb641d5e137eaebfd2f980925b23b686337c92c`, BASE `6ec80ef026eeacfdd8bc9dadf44972c342305776`, merge równy bieżącemu BASE. [CI #41337773213](https://github.com/mebleszek/meble-app/actions/runs/41337773213): 21/21 zadań PASS, w tym auto-merge i weryfikacja Pages dokładnego merge. To dowód poprzedniego wydania, nie PASS nowych zmian.

### Zrealizowane wiązanie produktu

- Istniejący `main-login → application-bootstrap → application-runtime` obsługuje teraz zarówno demonstracyjny startup, jak i zweryfikowane wdrożenie produkcyjne. Nie powstał drugi synchronizator lub operator. Publiczny `application-release.js` ma **null/null**, więc zwykły import/start nadal nie uruchamia migracji ani chmury.
- Trwała publiczna decyzja Ed25519 `MEBLE_APPLICATION_DEPLOYMENT_V1` wiąże konkretny UID, projekt/bazę/origin, activationId, profil, 14 domen, SHA Rules i osobną zgodę na zachowanie źródła/cutover. Nie ma krótkiego terminu administracyjnego. Weryfikacja offline nie przyznaje prawa do danych; każda operacja nadal sprawdza rzeczywisty Google UID, kontekst SDK oraz krótką serwerową lease. Odnowienie tej lease jest zwykłym odczytem Rules, nie podpisywaniem kolejnych zgód.
- Ten sam rzeczywisty SDK Google writer i osobny reader z pamięciowym Auth; trwały SDK login wyłącznie na wcześniej świadomie zaufanej instalacji. Bez wydobywania tokenów przez aplikację, ADC, kluczy usługowych czy prywatnego OAuth operatora. Zwykła sesja tymczasowa nadal wymaga ponownego logowania po zamknięciu; zaufana instalacja odtwarza lokalne dane offline bez Google.
- Protokół 2 Service Workera + Web Lock i trwały techniczny fence IDB potwierdzają pojedynczego klienta przed modułami biznesowymi. Kolejne niezgodne klienty/skrypty otrzymują 423. Nawigacja właściciela może przenieść fence; restart wymaga potwierdzenia nieobecności starego klienta, nie timeoutu. Nie wymusza to aktualizacji otwartej karty, `skipWaiting` ani przejęcia starego aktywnego edytora projektu. Stary worker bez protokołu powoduje odmowę do istniejącej bezpiecznej aktualizacji po zamknięciu kart.
- Oryginalne objęte klucze localStorage pozostają nietknięte. Źródło/hash/activationId i obraz są zatwierdzane w tej samej transakcji IDB. Zapis obrazu/outboxu i potwierdzonego odbioru/CAS używa istniejącego magazynu. Brak receipt po utraconym potwierdzeniu odzyskuje się tylko z kompletnego, zgodnego obrazu/źródła i bindingu; brak/utrata/uszkodzenie dowodów oznacza odmowę. Nie otwierano danych właściciela ani nie wykonywano rzeczywistej migracji.
- Odbiór aktualizuje także prawdziwy cache katalogów, więc UI i obliczenia korzystają z potwierdzonych danych zamiast starej kopii RAM. Nowe materiały mogą wejść do kolejnej jawnie zapisanej rewizji projektu dopiero po potwierdzeniu kompletnego katalogu. Nierozstrzygnięta publikacja nie zmienia przypiętych zależności; stare rewizje i zamrożone oferty pozostają niezmienne. Lokalna wtórna kopia `fc_materials_v1` jest objęta obrazem/transakcją i musi odpowiadać jawnie zapisanej głównej liście; nie jest nowym źródłem prawdy ani domeną synchronizacji.
- Świeże puste urządzenie pobiera istniejące katalogi/projekty; nie publikuje fabrycznych lub pustych wartości zamiast serwera. Niepuste odmienne źródło urządzenia daje jawny konflikt początkowy, bez heurystycznego scalania. Wszystkie 14 domen pozostają istniejącym kontraktem: materiały, okucia, producenci, dostawcy, kategorie, typy, parametry techniczne, ustawienia okuć, robocizna, usługi warsztatowe, magazyn, defaults, firma i koszty. `transport.apiKey` pozostaje lokalny.

### Kandydat Rules i gotowy artefakt aktywacji — niczego nie wdrożono

`tools/firebase-pilot/application-owner.rules` powstaje deterministycznie z publicznych istniejących Rules i fragmentu LOCAL-FIRST, z oryginalnymi walidatorami, immutable rekordami, CAS i epoką edytora. Ograniczenie: dokładny Google UID z verified email, zgodne administracyjne `syncConfig/owner` i `syncAccess/{UID}`; stary pilot wyłączony. Klient nie może edytować/listować grantów, nadpisać immutable rekordu ani usunąć projektu. Nie ma dostępu innego UID. Nie skopiowano prywatnego rollbacku 635 B; kandydat nie jest jego zamiennikiem.

`tools/application-release-package.js` sprawdza wyłącznie dostarczony **publiczny** JSON `{trustedKeySha256,envelope:{decision,publicKeySpki,signature}}` (bajty publicSPKI i podpisu jako tablice). Weryfikuje podpis, niezależnie ustalony fingerprint i hash dokładnego kandydata Rules. Nie generuje klucza, nie podpisuje za właściciela, nie loguje UID/podpisu, nie łączy się z Firebase. Zapisuje nowy publiczny JS wyłącznie poza repo (0600, bez nadpisania). Nie uruchomiono go z prawdziwymi danymi. Publikacja wyniku w slocie aktywacji wymaga osobnej zgody i ponownego powiązania wersji/manifestu; nie jest prostą flagą środowiskową.

### Kontrole i obowiązkowe CI

Wykonane celowane kontrole (Node 22.23.3, rzeczywisty natywny Chromium, Auth/Firestore wyłącznie `demo-meble-app` na loopback):

- Granice wdrożenia/Google/Rules, odnowienie lease, realne fabryki 14 domen, opakowanie podpisu i nowe zależności: **8/8 PASS** (`node tools/production-application-smoke.js`). Dotychczasowe granice startupu: **8/8 PASS**.
- Prawdziwe IDB: atomowość image/outbox przy quota/abort, CAS, duplikat, SIGKILL/persistencja i odmowa niezatwierdzonej produkcyjnej migracji: **PASS**, `node tools/application-authority-store-smoke.js`. Pierwsze wykonanie wykazało 404 nowych zależności ESM w ścisłym serwerze fixture; dodano wyłącznie dwa wymagane moduły, bez zmiany asercji lub czasu oczekiwania.
- Ochrona rzeczywistych zapisów globalnych: **30/30 PASS**, `node tools/global-data-write-safety-smoke.js`. CLOUD-4: niezmienione **6797 B**, SHA `711f2fea49873bab0c4f76b5e8e0e666c4796190ed9fbfda71557d35890ba2e3`; kontrola boundary/historycznych pinów PASS. Nie zmieniono historycznych manifestów ani odmowy `executeProduction()`.
- Końcowy celowany przebieg `node --test --test-name-pattern='LOCAL-FIRST (normal application startup|approved deployment)' cloud-sync-global.test.mjs` w `firebase emulators:exec --project demo-meble-app --only auth,firestore`: **2/2 PASS**, zero skip/cancel/todo, 142,36 s + 127,39 s (łącznie 270,20 s). Obejmuje także nowy jawny zapis materiału przez rzeczywisty katalog, następnie projekt korzystający z niego na drugim urządzeniu i niezmienną zamrożoną ofertę. Komentarze porządkujące opis wspólnego runtime po tym teście nie zmieniają zachowania. Składnia 28 JS/MJS, kanoniczne wersje HTML, routing CI i dokładna integralność offline: PASS. Podczas prac wykryto rzeczywiste przerwanie ważnej lease w chwili odnowienia (naprawione i pokryte regresją), a także zbyt późną asynchroniczną konfigurację podpisanego fixture przy zimnym starcie (rozpoczęcie przed `main-login`, zachowane wszystkie asercje). Jedno celowane wykonanie starszej ścieżki po online zgłosiło odmowę; diagnostyczny przebieg tej samej ścieżki przeszedł. Nie uznano tego za PASS całego pakietu; końcowa kontrola obejmuje obie ścieżki bez diagnostycznego zatrzymywania JS.

Nowy `production-application-smoke.js` jest automatycznie obowiązkowy przez wykrywanie `*-smoke.js` w siedmiu shardach Preflight. Nowa podpisana ścieżka browser/SDK jest osobnym testem w **istniejącym** `cloud-sync-global.test.mjs`, należącym do obowiązkowego Firebase CURRENT batch 3. Dotychczasowe normal-startup, application E2E, LOCAL-FIRST, Auth/Rules i historyczne regresje zachowane. Bez zmian workflow, liczby ośmiu plików CURRENT ani 425 historycznych pinów. Pełnych lokalnych zestawów, Actions i wydania nie uruchamiano.

### Jedna konkretna droga uruchomienia po osobnej zgodzie

1. Niezależna kontrola dokładnych HEAD/BASE, osobna zgoda na PR/CI, PASS i wydanie; Android musi otrzymać tę wersję przez istniejącą bezpieczną aktualizację, bez czyszczenia danych.
2. Prywatnie potwierdzić właścicielski Google UID i fingerprint publicSPKI. Właściciel podpisuje **jedną trwałą decyzję wdrożeniową** dla konkretnego activationId/projektu/bazy/origin, profilu `business-project-v1`, 14 domen i SHA tego kandydata Rules, z `migrationApproved/sourcePreserved/rulesApproved:true`; Codex nie podpisuje w jego imieniu. `reviewApplicationRelease` przygotowuje publiczny artefakt do niezależnego sprawdzenia. Prywatny klucz nie jest potrzebny do codziennej pracy i nie trafia do repo.
3. Osobno zatwierdzić świeże minimalne potwierdzenie stanu Rules i zachowanego oryginalnego rollbacku, Spark/limitów (historyczne billingEnabled:false pozostaje dowodem historycznym), publikację dokładnych Rules z read-back oraz administracyjne granty. Wymagane: `authorizedUsers/{UID}` z `appEnabled:true,globalDataEnabled:true,globalSchemaVersion:1,enabled:false` (zachować inne istniejące pola); `appAccess/{UID}` dokładnie `{schemaVersion:1}`; `syncConfig/owner` dokładnie `{ownerUid:UID,activationId,schemaVersion:1}`; `syncAccess/{UID}` dokładnie `{activationId,schemaVersion:1}`. Żaden z tych zapisów nie jest wykonany w pakiecie.
4. Osobno zatwierdzić publikację publicznego artefaktu aktywacji, rzeczywiste lokalne przełączenie źródła i ograniczony pierwszy produkcyjny READ/WRITE. Po zamknięciu pozostałych starych kart ta sama aplikacja inicjalizuje IDB, zachowuje źródło i automatycznie synchronizuje. Na nowym urządzeniu to samo Google konto odbiera istniejące dane. Codziennie nie potrzeba nowych podpisów, administracyjnego OAuth, drugiego hosta ani płatnej usługi. Cofnięcie `syncAccess` zatrzymuje chmurę, nie kasuje lokalnych danych. Nie usuwać descriptoru/bindingu/journala dla obejścia odmowy.

### Jawne ograniczenia

Koszt obowiązkowy 0 zł, Spark w granicach darmowych limitów; brak gwarancji nieograniczonego transferu lub trwałości przeglądarkowej IDB. Brak VPS/CLOUD-4.6G i rozbudowy STOP operatora. Nie zmieniono UI ani matematyki. Nowy, nieznany serwerowi projekt wymaga pierwszego online potwierdzenia edytora; istniejący zatwierdzony edytor zapisuje offline. Usuwanie zbiorcze i import pełnego archiwum w trybie aktywnego sync pozostają jawną odmową do właściwego protokołu. Sporne globalne RAW/drafty/słoje Issue #47 blokują zależny zakres bez usuwania. Niepuste różne katalogi urządzeń wymagają bezstratnego rozstrzygnięcia konfliktu, nie cichego merge. Fizyczny Android i rzeczywiste Rules/uprawnienia/LIVE pozostają niewykonane. Sukces emulatorów nie stanowi zgody na produkcję.

**Końcowe przekazanie:** CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED. Wszystkie celowane końcowe kontrole powyżej zaliczone; brak pełnego CI, PR, uruchomienia Actions lub operacji produkcyjnych. Niezależna kontrola obejmuje cały diff względem wskazanego BASE. Jedna początkowa odmowa starszego przepływu po online ma niepotwierdzone źródło (brak danych o wyjątku); po diagnostyce i końcowym przebiegu bez pauz oba testy PASS. Ryzyko do obserwacji w obowiązkowym CI, nie ukryty retry ani zmiana timeoutu/asercji.

## PR #98 — dwie naprawy po CI #41349695707

**01.11.2026.** Wejściowy i niezmieniony BASE `076020005a9793c3271aee01daf0dc1b1ab88552`. Nowa gałąź `fix/pr98-offline-reconnect-ci-20261101`; istniejąca `integration/production-local-first-20261101` i PR #98 nie są modyfikowane. HEAD jest jednym końcowym commitem zawierającym ten wpis; pełny SHA w przekazaniu. Odczytane logi [#41349695707](https://github.com/mebleszek/meble-app/actions/runs/41349695707): Safety i Historical PASS, Preflight shard 2 FAIL w natywnym delete, Firebase CURRENT shard 3 FAIL w normalnym reconnect (6/6 pierwszego pliku, następnie 26/27 w drugim; zatwierdzone wdrożenie PASS). Merge/Pages SKIPPED. Nie uruchamiano Actions.

### Potwierdzone przyczyny i minimalne poprawki

1. **Offline delete — CONFIRMED w rzeczywistym Chromium.** Natywne zaznaczenie obu inwestorów działało. `prepare()` odmawiało z `DELETE_OTHER_DATABASE_PRESENT`: bazy profilu to access-profile, device-trust i nowa `meble-application-writer-fence-v1`. Każdy odczyt SW wykonywał `liveOwner → read → record → indexedDB.open(...,1)`, tworząc tę bazę także bez aktywacji. Nie jest to problem gestu/checkboxa. SW sprawdza teraz obecność bazy i otwiera istniejącą tylko readonly, z odmową niezatwierdzonego upgrade. Tworzenie jest dozwolone jedynie w obsłudze jawnego `APPLICATION_WRITER_FENCE`, po dotychczasowej kontroli klienta/protokołu. Nie zmieniono whitelisty ani logiki kasowania, nie usunięto żadnej bazy. Aktywna aplikacja LOCAL-FIRST nadal odmawia `DELETE_LOCAL_FIRST_ACTIVE`.
2. **Reconnect — potwierdzona luka cyklu życia i źródło ogólnego kodu.** Bierna diagnostyka bez pauzowania JS ujawniła `AUTH_ACCESS_REVOKED` w guard starego połączenia podczas discovery i global read. `safeError` zgodnie z dotychczasową polityką anonimowości zamienia ten nieobsługiwany prefiks na `LF_REMOTE_UNCONFIRMED`. Nie zmieniono kontroli uprawnień ani klasyfikatora dla zielonego testu. `close()` usuwało listenery, lecz nie dawało dowodu zakończenia trwającego SDK/IDB read i discovery. `resume()` równolegle wiązało nowy cykl i uruchamiało `flush()` fire-and-forget; `ready` mogło poprzedzać rozstrzygnięcie outboxu. Stary reader mógł być zamykany podczas pozostającego odczytu. Nowy deterministyczny test przed poprawką FAIL wykazał przedwczesne zakończenie close, po poprawce PASS.

`close()` koordynatora zwraca teraz zakończenie aktualnego cyklu, a kompozycja czeka też na discovery. `resume()` oczekuje tego dowodu przed zastąpieniem kanałów, następnie **oczekuje pierwszego `flush()`**. Niepewna operacja nadal może zostać rozstrzygnięta tylko niezależnym READ, nigdy retry WRITE. Błąd pozostaje błędem i nie prowadzi do `ready`. Bootstrap zachowuje nowe połączenia także przy odmowie wznowienia, a stary reader jest zwalniany po przekazaniu; dispose nie zamyka magazynu pod trwającym cyklem.

**Granica dowodu:** dwa celowane wykonania pierwotnego reconnect przed poprawką lokalnie przeszły; oryginalnego, zależnego od czasu timeoutu CI nie odtworzono identycznie. Nie nazywamy go automatycznie flakiness. Potwierdzono rzeczywisty wyjątek starej lease i lukę completion, odtworzono ją deterministycznie na prawdziwym koordynatorze; końcowa rozszerzona ścieżka natywna dodatkowo przytrzymuje wynik prawdziwego SDK read ponad zmianę kontekstu i sprawdza brak przedwczesnego `ready`. To wymuszona kolejność zdarzeń, bez sztucznego sukcesu, ponowienia dotyku/WRITE lub wydłużania timeoutów.

### Zakres i regresje

- Produkcyjne: `offline-writer-fence.js`, `application-bootstrap.js`, `application-replication.mjs`, `application-runtime.mjs`, `local-first-sync.mjs`. Aktualizacja wersji bootstrap w `index.html` i dokładnego manifestu `offline-assets.js`. Bez zmiany UI, synchronicznej logiki biznesowej, modeli, CAS, uprawnień lub Rules.
- Testowe: istniejące `investor-delete-sw-browser.js` sprawdza brak utworzonej bazy sync przed usuwaniem; zachowuje wszystkie gesty, zliczenia potwierdzenia, RAW, restart/recovery, zaufanie i logout. Przy odmowie pokazuje kod/stan fixture zamiast samego oczekiwania na modal.
- `normal-startup-boundary.test.mjs`: rzeczywisty koordynator, kontrolowany stary read i cofnięta lease, zachowana queued operacja, dopiero po zakończeniu starego cyklu świeży odczyt/publikacja, dokładnie jeden WRITE i verified receipt.
- `normal-application.cases.mjs`: pierwotny normal-startup zachowany. Dodatkowo signed deployment przytrzymuje **wynik rzeczywistej read-only transakcji SDK starego readera**, czeka na utworzenie nowego kontekstu, wymaga `reconnect-runtime` zamiast `ready`, zwalnia tylko ten wynik i wymaga pełnego przepływu do telefonu. Generacja serwerowa rośnie dokładnie o jeden dla lokalnego zapisu offline; obie ścieżki odmawiają lokalnego kasowania w aktywnym sync. Wszystkie wcześniejsze kontrole 14 domen, cen, projektów/ofert, sesji, offline restartu, grantu i RAW pozostają.
- Routing bez zmian workflow: normal-startup boundary przez obowiązkowy `one-app-startup-smoke.js`, oba native SDK scenariusze w obowiązkowym `cloud-sync-global.test.mjs` (CURRENT shard 3), native delete w obowiązkowym `trusted-session-browser-smoke.js` (Preflight shard 2). Nie dodano niezarejestrowanej kopii testu ani nie pominięto starej regresji.

### Faktycznie wykonane kontrole

- Pierwotny native delete przed poprawką: **FAIL**, `DELETE_OTHER_DATABASE_PRESENT` i wskazana dodatkowa baza; to dowód odtworzenia, nie zaliczony test.
- Deterministyczna regresja close/handoff: **FAIL przed poprawką**, następnie cały celowany normal-startup boundary **9/9 PASS**.
- Test harmonogramu/utraconego ACK: `node tools/local-first-crash-smoke.js` **PASS**, wszystkie dotychczasowe race, jeden WRITE, recovery przez READ oraz realny SIGKILL/reap/ponowne otwarcie profilu zachowane.
- Manifest/static shell: `node tools/offline-shell-smoke.js` **PASS**, brak przejęcia aktywnej karty, integralność i kompletność zachowane.
- Końcowy `node tools/trusted-session-browser-smoke.js`: **PASS, exit 0**. Pełne oryginalne dwa ciągi nawigacji A/B z natywnymi gestami, offline zaznaczenie dwóch inwestorów, modal z rzeczywistymi zliczeniami, usuwanie/recovery po utracie markera/reload, zachowany RAW innych rekordów i dowód zaufania, zimny start po offline logout i odmowa odczytu.
- `firebase emulators:exec --project demo-meble-app --only auth,firestore`, filtr istniejącego `cloud-sync-global.test.mjs`: signed deployment z kontrolowanym opóźnieniem read **1/1 PASS, 169,54 s**. Pierwotny normal-startup w osobnym świeżym cyklu diagnostycznym **1/1 PASS, 154,18 s**, zero skip/cancel/todo. Nie twierdzimy, że cały Firebase CURRENT wykonano lokalnie. Oba scenariusze potwierdziły READ na telefonie oraz dokładnie jedną nową serwerową generację po offline zapisie, zachowując wszystkie dotychczasowe asercje.
- **Dodatkowa obserwacja, bez ukrytego retry:** wspólny przebieg po poprawce miał 1/2, bo normal-startup przekroczył istniejący limit oczekiwania na pierwszy login przy etapie `initial-project-revisions`, przed badanym reconnect. Nie zwiększono timeoutu. Dodano wyłącznie bierny, ograniczony ślad nazw/czasów/pending RPC bez argumentów/danych/tokenów. W kolejnym świeżym celowanym wykonaniu normal-startup przeszedł inicjalizację i cały przepływ; próbka pokazała rzeczywiste odpowiedzi RPC i `ready`. Dokładna przyczyna tego pojedynczego początkowego timeoutu **UNCONFIRMED**, nie ogłoszono go błędem środowiskowym ani nie zamieniono FAIL na PASS. Do obserwacji w osobno zatwierdzonym CI.
- Składnia zmienionych JS/MJS, kanoniczne wersje, zgodność manifestu i `git diff --check`: **PASS**. Żaden timeout/assertion nie został osłabiony. Obowiązkowy routing potwierdzony: trusted-session shard 2, one-app-startup shard 6, cloud-sync-global w CURRENT8. Pełnego lokalnego Preflightu/Firebase i GitHub Actions nie uruchamiano.

Nie zmieniono gałęzi PR #98, historycznych 425 pinów, podpisanego eksportu CLOUD-4, publicznego slotu `null/null`, stawek, UI, źródeł danych ani archiwów. Nie wykonano Firebase LIVE, produkcyjnego GET/WRITE, migracji, Rules, IAM, billingu, PR, Actions, merge lub Pages. Obowiązkowy koszt pozostaje 0 zł. Po push STOP do niezależnej kontroli i osobnej zgody wydaniowej.

**Wynik pakietu naprawczego:** CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED. Pierwotne scenariusze mają celowane PASS, a deterministyczny przypadek starego SDK read jest dodatkową regresją. Nie deklarujemy końcowej stabilności wydaniowej ani potwierdzenia fizycznego telefonu na podstawie tych kontroli. Następny ruch: niezależna kontrola SHA/diffu nowej gałęzi i osobna decyzja właściciela o dalszej próbie wydania; bez ingerencji Codexa w PR #98.


## Diagnostyka pierwszego błędu synchronizacji — 02.11.2026

Gałąź `fix/first-sync-error-diagnostics-20261102`, BASE `96392838d20e36907a8229db6cff0ee469299164` (zweryfikowany merge PR #101). CI/Pages tego wydania potwierdził właściciel; nowa zmiana ma osobne CI_PENDING. Pakiet wyłącznie ujawnia brakujący dowód, nie deklaruje naprawy niepotwierdzonej przyczyny transferu.

- `application-bootstrap.js` zachowuje **pierwszy** kod/etap i osobno pierwszą odmowę transferu. Późniejszy błąd, ograniczony bufor runtime, disposal i AUTH_RELOAD_REQUIRED nie nadpisują dowodu. Wyłącznie RAM karty: nic nie zapisuje się do storage, IDB lub sieci. Nowy dokument zaczyna pustą diagnostykę. Zamknięta lista znanych kodów i etapów, bez UID, identyfikatorów projektu, tokenów, treści danych, komunikatów wyjątków lub stosów. Nieznane wartości = unknown/UNRECOGNIZED_ERROR.
- Opcjonalny obserwator runtime dostaje oryginalny kod z catch `project-transfer-blocked` przed safeError. Dotychczasowy stan, błędy, zapisy, flush, CAS, brak retry i cleanup pozostają bez zmian. Wyjątek obserwatora również nie wpływa na wykonanie. Oczekiwany LF_OFFLINE z harmonogramu przed gotowością nie jest błędem startu.
- Istniejący auth-error pokazuje „Pierwszy błąd: stage / code”; AUTH_RELOAD_REQUIRED pozostaje dopiskiem. Bez nowych przycisków, DOM lub układu. Istniejący raport ma `localFirst`: stage, code, firstError, transferStatus, projectTransferBlocked. `cycle-confirmed` oznacza wyłącznie zaobserwowany udany cykl kolejki, **nie dowód wysłania projektu**. Odmowa pozostaje blocked mimo późniejszych udanych cykli. Bramka autoryzacji raportu bez zmian.
- Cache-busting obu HTML/rejestru, wygenerowany dotychczasowy bookmarklet kolektora oraz manifest offline odpowiadają nowym bajtom. Bookmarklet nie jest instrukcją obsługi dla właściciela.

| Celowana kontrola — Node 24.19.0 | Rzeczywisty wynik |
| --- | --- |
| `node tools/first-sync-error-diagnostics-smoke.js` | **7/7 PASS**: pierwszy błąd/transfer/disposal/reload, rzeczywisty main-login i zachowana fatal odmowa bez ponownego startu, prywatność, bezpieczny collector/copy/format, identyczny ślad runtime z obserwatorem i bez (także rzucającym wyjątek), routing do jednej obowiązkowej grupy. SDK zastąpione na granicy ładowania; nie jest to Firebase E2E. |
| `node tools/trusted-main-login-smoke.js` | **PASS**, cztery dotychczasowe grupy main/Auth: desktop idle/bfcache/reauth, trust/offline/restart/logout, revocation i bindings/ochrona RAM. Stare asercje zachowane, tylko opcjonalny hook fixture przed main. |
| `node tools/pixel-session-bookmarklet-smoke.js` | **15/15 PASS**, prywatność, bramki dostępu, spójność, brak zapisów/recovery. |
| `node tools/session-diagnostics-screen-smoke.js` | **6/6 PASS**, dotychczasowe odmowy i ekran raportu. |
| `node tools/offline-shell-smoke.js` | **PASS**, dwie grupy: bieżący manifest, offline/corruption/kompletność, brak przejęcia karty i cache prywatnych odpowiedzi. |
| Składnia / wersje / `git diff --check` | **PASS**. Nowy `*-smoke.js` należy do dokładnie jednego obowiązkowego sharda `preflight.js --current-only --smoke-shard=…`; workflow bez zmian. |

Pełnego Preflightu, emulatorów, natywnego Chromium, fizycznego telefonu i GitHub Actions nie uruchamiano dla tej zmiany. Nie wykonano Firebase LIVE, podpisywania, grantów, Rules, migracji, resetu, kasowania danych, PR, merge lub Pages.

Po **osobno zatwierdzonym wydaniu** właściciel odczytuje istniejący komunikat logowania „Pierwszy błąd: …”, także przy AUTH_RELOAD_REQUIRED. Jeśli aplikacja jest dostępna: jeden odczyt **Diagnostyka sesji → Kopiuj raport**, pole localFirst. Na zablokowanym ekranie logowania raport biznesowy nadal jest niedostępny — wystarczy zrzut istniejącego błędu, bez obejścia bramki. Nie odświeżać karty z niezapisanym RAM. Nie odtworzymy błędów poprzedniego dokumentu; obserwacja dotyczy nowej wersji i żyje do zamknięcia/załadowania dokumentu.

**CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED.** Następny ruch: niezależny przegląd HEAD/BASE i osobna decyzja właściciela o CI/wydaniu; dopiero anonimowy pierwotny kod uzasadni naprawę transferu.


## PR #102 — korekta dwóch bramek Preflight, 02.11.2026

Nowa gałąź `fix/pr102-preflight-chromium-20261102`, BASE roboczy `1c54a659c53d87f542950f9ae9f7f059d8b1c885` (wadliwy HEAD PR #102); BASE/main tego PR pozostaje `96392838d20e36907a8229db6cff0ee469299164`. Nie zmieniono istniejącego PR ani jego gałęzi.

**Źródła:** [CI #41470013557](https://github.com/mebleszek/meble-app/actions/runs/41470013557), logi `preflight-shards (5)` job 125360991024 oraz `preflight-shards (7)` job 125360990833. Safety/static/Firebase CURRENT/historyczne CLOUD PASS; Preflight FAIL, automatyczny merge i Pages SKIPPED. Logi sprawdzono odczytowo, nie ponawiano GitHub Actions.

1. **CONFIRMED — błędny kontrakt statyczny:** `local-first-contract-smoke.js:47` odrzucał dowolny tekst `local-first` w main-login, w tym zatwierdzoną, wyłącznie diagnostyczną instrukcję `startupStage='starting-local-first';`. Lokalnie odtworzono ten sam FAIL. Dopuszczamy tylko tę jedną dokładną instrukcję (wymagane jedno wystąpienie); każde pozostałe wystąpienie w main-login i każde w index/load-groups nadal jest odrzucane. Wszystkie rzeczywiste kontrole podpisu, właściciela, Rules, odwołania i odmowy przed siecią pozostają.
2. **CONFIRMED — dwie fazy startu mają niespójne limity:** pierwszy recovery przerwany po 15000 ms, brak DevTools/stderr; drugi miał prawdziwy endpoint, ale HTTP `/json/version` przekroczyło osobny limit 5000 ms (łącznie ok. 20 s). Są to odmowy przed testami danych. Wspólny helper miał już standard 60000 ms, lecz storage nadpisywał go 15000 ms, a kontrola HTTP nie korzystała z pozostałego budżetu. Teraz jeden nieodnawialny budżet obejmuje launch, announcement i potwierdzenie HTTP/tożsamości. Standard pozostaje 60 s; storage korzysta ze standardu. Po wyczerpaniu czasu, błędzie HTTP, obcej tożsamości lub spóźnionym body nadal FAIL i potwierdzony cleanup. Jeden launch i jeden GET, zero retry/relaunch. Komunikat awarii podaje fazę, czas i budżet. Nie zmieniono flag Chrome, profili, subreapera, SingletonLock ani kodu aplikacji.
3. **UNCONFIRMED — źródło opóźnienia Chrome na GitHub runnerze:** Ubuntu 26.04 / Google Chrome 156.0.8078.47. Logi nie wykazują OOM, braku miejsca lub niepotwierdzonego cleanup; odczytano je bez przypisywania awarii automatycznie środowisku. Lokalnie Chromium 151.0.7922.173 / Node 24.19.0: pierwotny storage miał 18 grup PASS jeszcze przed zmianą, więc nie odtworzono tego samego spowolnienia hosta. Nie deklarujemy, że 60 s usunie każdy możliwy problem runnera. Deterministyczny model rzeczywistego helpera wykazał jednak konkretny defekt podziału czasu: announcement 17 s + HTTP 8 s mieści się w standardowym budżecie, ale stary helper odmawia przez osobny limit 5 s. Ten sam przypadek przechodzi nowy helper. To model protokołu, nie odziedziczony PASS rzeczywistego CI.

| Faktycznie wykonana kontrola | Wynik |
| --- | --- |
| `node tools/local-first-contract-smoke.js` | **PASS**, wszystkie 7 dotychczasowych grup i rzeczywiste odmowy aktywacji zachowane; wcześniej odtworzono wskazany FAIL. |
| `node tools/chromium-runtime-smoke.js` | **9 grup PASS**: także rzeczywiste procesy Linux/subreaper, bezpieczne profile, deadline, błędna tożsamość, brak retry i ślad domenu FAIL. Nowa grupa wirtualnego czasu: 17+8 s, pozostały budżet 43 s, wyczerpanie przy 59+1.001 s, brak GET po wyczerpaniu announcement i odmowa spóźnionego body. |
| `node tools/chromium-startup-smoke.js` | **4/4 grupy PASS**, gotowość i cleanup listenerów/timerów, błędy nadal FAIL. |
| `node tools/storage-recovery-browser-smoke.js` | **18 grup PASS** po poprawce, natywne Chromium i rzeczywista IndexedDB, 393×852, pięć dokumentów, dwa taby, bezstratne RAW/quota/restart/recovery i zero LIVE requests. |
| `node tools/storage-recovery-repair-smoke.js` | **6 grup PASS**, natywne Chromium/IndexedDB, dwa dokumenty, eksport i odmowy właściciela oraz wyłączności bez zmian. |
| `node tools/first-sync-error-diagnostics-smoke.js` | **7/7 PASS**, pierwszy błąd, brak maskowania, fatal, prywatność i read-only raport zachowane. |
| Składnia / manifest / diff | **PASS**; publiczne pliki js/sync/HTML/offline-assets i Firebase Rules/integrity bez zmian. Zmodyfikowane smoke należą do obowiązkowego Preflightu przez dotychczasowy inventory/sharding; workflow bez zmian. |

Pełny lokalny Preflight, Firebase SDK/Rules i GitHub Actions nie były uruchamiane. Testy zmieniały wyłącznie syntetyczne dane w jednorazowych profilach testowych. Nie dotknięto danych właściciela, Firebase LIVE, aktywacji, Rules, IAM, billingu, fatal, LOCAL-FIRST, indeksów lub kolejki. Nie zmieniono pinów ani manifestu offline (brak zmian publicznych zasobów). Bez nowego PR, Ready/Draft, merge i Pages.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED.** Następny jeden ruch: niezależnie skontrolować nową gałąź i BASE roboczy; dotychczasowa próba PR #102 pozostaje zakończona FAIL, nowa zgoda wydaniowa nie jest domyślna. Zachowane ograniczenie: zachowanie Google Chrome 156 na runnerze wymaga przyszłego, osobno zatwierdzonego CI.


## Domena konfliktu aliasów — 02.11.2026

Pakiet `fix/catalog-conflict-sw-update-20261102`, BASE `5f04ff6ef306ac63630a23353339b0e0e0d4de9b` (merge PR #103, workflow #41475539796 success). Potwierdzony przez właściciela błąd telefonu: `initial-global-revision / GLOBAL_ALIAS_CONFLICT`. Nie uzgadniamy danych ani nie przypisujemy domeny bez dowodu.

- Jedyny resolver metadanych jest przy zamkniętym kontrakcie globalDataContract.sources. Zamrożono samą tabelę/jej listy kluczy (metadane schematu, nie dane). Rozpoznaje wyłącznie kod GLOBAL_ALIAS_CONFLICT, dokładną domenę i istniejącą parę dwóch kluczy. Obce path, podścieżki, domena bez aliasu i niejednoznaczność = UNKNOWN / pusta lista. Nie eksportuje error.path, message, stack, UID, danych ani dostarczonej przez błąd listy kluczy. Capture/porównanie/walidacja pozostają bez zmian.
- Bootstrap utrzymuje pierwszy aliasConflict `{stage,code,domain,keys}` w pamięci dokumentu, niezależnie od późniejszego AUTH_RELOAD_REQUIRED lub innego konfliktu. Pierwotny firstError nadal ma pierwszeństwo. Komunikat istniejącego auth-error i istniejący raport localFirst pokazują te same statyczne nazwy. Nie otwiera nowych magazynów, nie dodaje odczytów biznesowych ani zapisów i nie zmienia fatal/odmów/synchronizacji.
- Wersje obu HTML/rejestru, pochodny bookmarklet kolektora i dokładny manifest offline odpowiadają nowym bajtom. Nie ruszono transferu projektów, Rules, operatorów, oryginalnych katalogów/cenników/zamienników, RAW lub źródeł danych.

Rzeczywiście wykonane celowane kontrole: first-sync-error-diagnostics **9/9 PASS** (rzeczywiste capture materiałów i robocizny, statyczne klucze, odczyty tylko pierwotnych trzech kluczy, niezmienność RAW, ekran/raport z obcym path/sekretem, UNKNOWN, fatal i reload-required); cloud-global-data **13/13 PASS**, pixel-session-bookmarklet **15/15 PASS**, session-diagnostics-screen **6/6 PASS**, trusted-main-login cztery dotychczasowe grupy **PASS**, local-first-contract wszystkie siedem grup **PASS**. Składnia, kanoniczne wersje i manifest/diff **PASS**. Node 24.19.0; nie jest to PASS nowego CI ani fizycznego telefonu. Testy trafiają do dokładnie jednego obowiązkowego sharda Preflightu; workflow bez zmian.

Po osobno zatwierdzonym wydaniu pierwszy błąd na telefonie zawiera „domena konfliktu: …; klucze: … / …”. Jeśli aplikacja jest dostępna: Diagnostyka sesji → Kopiuj raport → localFirst.aliasConflict. Gdy logowanie jest zablokowane, wystarczy zrzut istniejącego komunikatu; nie obchodzimy bramki raportu. UNKNOWN wymaga zachowania tego wyniku, nie zgadywania domeny. Informacje żyją tylko w nowym dokumencie/karcie, nie odzyskamy błędu poprzedniej wersji wstecznie. Dopiero odczyt uzasadni osobną decyzję dotyczącą właściwych danych.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED.** Bez pełnego lokalnego Preflightu/SDK, GitHub Actions, PR, merge, Pages, Firebase LIVE, Rules, IAM, billingu, migracji lub naprawy wartości aliasów. Część aktualizacji i natywne dowody: istniejący raport android-safe-sw-update-20261031.
