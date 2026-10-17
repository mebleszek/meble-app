# CLOUD-2B.4a + techniczne CLOUD-2C — transport i niezależny odczyt

Baza: `6c5ca364d2b7ec2a6f3a40e9ce6eafd406201cf3` po PR #58. Gałąź `cloud-2b4a-technical-2c`. Zakres zatwierdzony jako jeden pakiet zgodnie z AGENTS §13. **Bez publikacji, wdrożenia Rules, zmian grantów i operacji na rzeczywistych danych Firebase.**

## Status wdrożonego logowania i granice pakietu

PR #57 (`90bd5349`) scalił główne logowanie. Właściciel potwierdził CI/Pages PASS, akceptację Androida i działający produkcyjny profil Auth-only. Nie należy już przedstawiać całej produkcyjnej bazy jako deny-all: własny `appAccess` jest dostępny zgodnie z tym profilem. **Ścieżki biznesowe nadal są zablokowane; synchronizacji i uploadu nie wdrożono.** PR #58 wprowadził zasady pakietowania prac.

Ten pakiet przygotowuje kod transportu LIVE, ale go nie rejestruje ani nie uruchamia w aplikacji. Zapis i pełny odczyt danych przetestowano wyłącznie na Auth/Firestore Emulator Suite, syntetycznym Google UID i syntetycznym projekcie. To **techniczne przygotowanie CLOUD-2C, nie produkcyjne zakończenie CLOUD-2C**. Lokalny projekt nadal jest autorytetem pracy programu.

## Transport i własność połączenia

`firebase-pilot-transport.js` zachowuje `create({target:'emulator', ...})` i jego dotychczasowy wynik `{transport,app,auth,db}`. `create({target:'live'})` nadal odmawia przed importem SDK. Emulator nadal wymaga `demo-*` i loopback. Wydzielono wspólny `fromConnection()` wyłącznie dla dotychczasowych operacji i nowego odczytu; nie powstał kolejny format projektu lub framework synchronizacji.

`firebase-pilot-live-transport.js` to **osobny, niezarejestrowany adapter**. Rejestracja pliku niczego nie inicjuje. Wewnętrzne `create({authSession,assertAccess,sdk?})` wymaga:

- już istniejącego obiektu `cloudAuth`, jego Google UID, epoki i `verificationContext()`;
- synchronicznego `assertAccess`, który rzuca błąd, gdy istniejąca bramka utraci zatwierdzenie; docelowo przekazany przez właściciela sesji, nie zastępowany lokalnym booleanem;
- zgodności App/Auth i docelowego projektu; tryb `live-auth` ograniczony do `mebleszek-meble-app`, emulator do `demo-*`/loopback;
- Firestore już skonfigurowanego przez istniejący serwerowy weryfikator. Adapter pobiera tę samą instancję przez `getFirestore(app)`, nie używa `initializeFirestore` i nie podłącza ponownie emulatora.

SDK importowany jest leniwie i w tej samej przypiętej wersji. Nie ma nowego App/Auth, obserwatora UID, logowania, tokenów lub SDK persistence. Pożyczony transport nie posiada metod logowania/wylogowania. Jego `close()` blokuje wyłącznie własne dalsze operacje: **nie zamyka weryfikatora, nie wylogowuje, nie usuwa App i nie kończy wspólnego Firestore**. Emulator posiadający własne zasoby nadal poprawnie je zwalnia.

UID i epoka są kontrolowane przed i po oczekiwaniu, haszowaniu i w callbackach ponawianych transakcji. Adapter pożyczony wiąże się z konkretną epoką; logout/login tego samego UID wymaga nowego adaptera. Brak/utrata lokalnego potwierdzenia dostępu daje odmowę, a Rules niezależnie sprawdzają prawo do ścieżki biznesowej.

## Dostęp serwerowy, rewizje i awarie

`readHead` poprzedza odczyt nową transakcją tylko do odczytu: wcześniejszy server-marked listen target nie może podtrzymywać grantu po jego cofnięciu. Zachowano jawny `getDocFromServer`, który odmawia również przy `disableNetwork()`; samo SDK transaction RPC nie jest wystarczającą kontrolą wyłączonej sieci.

Nie zmieniono schematu Rules. `appEnabled` i dokument `appAccess` uprawniają do uruchomienia aplikacji, **nie do danych pilota**. Emulatorowe Rules wymagają dodatkowo `enabled:true`, właściwego `pilotProjectId` i `pilotInvestorId`; klient nie odczytuje ani nie nadaje sobie grantu. Auth-only profil nadal odmawia wszystkim danym biznesowym, nawet przy ustawionym grantcie pilota.

Zapis zachowuje CLOUD-1B, 800 KiB, fragmenty 128 KiB (maks. 7), niezmienne rewizje, pełną podstawę rewizji, transakcyjny manifest, optimistic guard, ponowne sprawdzanie źródła i read-back własnego head. Brak last-write-wins, nowej kolejki offline lub automatycznej kompensacji. Utrata odpowiedzi po publikacji nadal daje `published:'unconfirmed'` i wymaga `confirm(handle)`, zamiast deklaracji nieudanego zapisu lub ślepego retry. Przerwane fragmenty nie stają się opublikowanym projektem.

## Niezależny odczyt CLOUD-2C

Wewnętrzne API koordynatora:

```js
const result = await pilot.read({investorId, projectId});
// sukces: {ok:true, document, bytes, utf8Bytes, dependencies, warnings, head}
// odmowa: {ok:false, code}
```

Odczyt nie wymaga uchwytu zapisu, bieżącego lokalnego projektu ani ponownego eksportu. Nowy klient SDK z własnym połączeniem odtwarza dane zapisane przez innego klienta:

1. Weryfikuje tożsamość, dostęp i jawny zakres.
2. Pobiera aktualny manifest z serwera i sprawdza jego zamknięty schemat/właściciela/limity.
3. Transakcyjnie pobiera wskazaną rewizję i dokładnie zadeklarowane indeksy fragmentów, bez listowania kolekcji.
4. Odmawia przy brakujących dokumentach, cache lub pending writes.
5. `cloudPilotContract.unpack()` kontroluje liczbę, kolejność, długości i SHA-256 fragmentów oraz składa ograniczony bufor oryginalnych bajtów.
6. Sprawdza fileSha256, ścisły UTF-8 i dokładną kanoniczną reprezentację JSON. Nie naprawia/normalizuje danych.
7. Ponownie wykorzystuje istniejący `pack()` i walidator CLOUD-1B: wersję, zamkniętą allowlistę, daty/liczniki, powiązania inwestor/projekt/pokoje/szafki/zestawy/PCV, payloadSha256, documentSha256, podstawę rewizji i zgodność z manifestem. Hash sam nie zastępuje walidacji modelu.
8. Ponownie pobiera manifest z serwera. Zmiana head, długości, liczby części lub timestampu daje `CLOUD_READ_CONFLICT`.
9. Sprawdza tożsamość i dostęp po zakończeniu operacji, zwraca odłączone dane wyłącznie do RAM.

Dodatkowe odmowy: `CLOUD_PROJECT_NOT_FOUND`, `CLOUD_REVISION_INCOMPLETE`, `CLOUD_CHUNK_INVALID`, `CLOUD_INTEGRITY_INVALID`, `CLOUD_REVISION_INVALID`, `CLOUD_MANIFEST_INVALID`, `CLOUD_BASE_INVALID`, `CLOUD_EXPORT_INVALID`, `CLOUD_AUTH_CHANGED`, `CLOUD_ACCESS_UNCONFIRMED`; istniejące mapowanie uprawnień/sieci pozostaje. Zwracane błędy nie zawierają RAW danych, tokenów ani wartości grantów.

Brak importera, zapisów localStorage, odtwarzania sesji lub zmiany aktywnego projektu. Test porównuje **dokładne bajty** oraz cały payload z oryginalnym syntetycznym źródłem; źródło nie jest dostępne niezależnemu czytnikowi. Osobno sprawdzono wiele pokojów, identyczne szafki, indywidualne boki, grupy półek/frontów/szuflad i setId.

## Testy i dowody

Wyniki pierwszej części pakietu zachowano jako historię; po rozszerzeniu zakresu wykonujemy ponownie całą końcową weryfikację opisaną poniżej.

- `node tools/firebase-pilot-smoke.js`: 10/10 PASS; brak rejestracji LIVE w manifestach, odmowa flagi live, ścisły odczyt i błędny model z ponownie wyliczonymi hashami.
- Pierwszy pełny emulator suite: 38/38 PASS. Następnie dodano pełny roundtrip grup/zestawów i logout podczas odczytu oraz finalną kontrolę guardu.
- Końcowy Emulator Suite: **40/40 PASS**, zero skipped, rzeczywiste SDK i Auth/Firestore emulatory.
- Końcowy pełny Chromium: **23/23 PASS**, zero skipped, w tym rzeczywisty startup i pożyczone App/Auth/Firestore. Ten pojedynczy zielony przebieg nie unieważnia osobnej diagnozy 4/20 błędnych dopuszczeń.
- Pełny Preflight: **PRE-FLIGHT PASS**, 542/542 składnia, 122/122 smoke, APP 110/110, load order 331; dependency i storage PASS (342 referencje / 42 pliki). Uruchomiono przed końcową korektą harnessu Chromium; dodatkowo ponownie sprawdzono składnię finalnych MJS.
- `node --check` wszystkich zmienionych JS/MJS oraz `git diff --check`: **PASS**.

Testy korzystają z realnego Web SDK 12.19.0 i Auth/Firestore Emulator Suite, nie z zamockowanej bazy. Obejmują konflikt dwóch urządzeń, utratę odpowiedzi po rzeczywistym commicie, staging interruption, offline, cofnięcie grantów, zmianę Auth/epoki i niezależny odczyt w świeżej instancji. Celowo uszkodzone dokumenty przygotowuje wyłącznie izolowany emulatorowy administrator.

Chromium przechwytuje wyłącznie w teście wynik rzeczywistego `cloudAuth.create` z głównego startupu. Nie ma produkcyjnego dostępu do prywatnej zmiennej main-login. Weryfikuje tożsamość wszystkich współdzielonych instancji i działanie głównej bramki po zamknięciu pilota; app-only grant odmawia pilota. Adapter jest dołączany wyłącznie przez test, po wykazaniu jego nieobecności w normalnym startupie.

Pierwszy pełny przebieg Chromium: **20/23 PASS**. Nowy test skorygowano, aby odwoływał się do rzeczywistego `window.FC` (bez zacienienia przez ograniczony lexical FC aplikacji) i pożyczał istniejący weryfikator zamiast tworzyć drugi (celowane powtórzenie wykryło odmowę ponownego initializeFirestore). Są to poprawki harnessu, nie produkcyjnego Auth. Osobną porażkę dotychczasowego testu kart opisano poniżej.

Pierwszy przebieg Chromium ujawnił też nieregularny numeryczny beacon `/js/gen_204?c=50:1` helpera Google w dotychczasowym teście zamknięcia popupu. Harness obsługuje teraz wyłącznie ten ściśle rozpoznany GET lokalną odpowiedzią 204, **bez przesłania telemetrii do Google**. Inne nieoczekiwane adresy, zwłaszcza prawdziwe Auth/Firestore API, nadal są blokowane i wykazywane jako błąd. Nie zmieniono kodu logowania ani asercji jego ochrony.

## Brak zmian domen i lokalnych danych

Część transportowa nie zmieniała UI. Zatwierdzone rozszerzenie zmienia `index.html`, `css/auth-test.css`, `main-login.js` oraz lokalny dowód dostępu i dodaje jeden techniczny rekord IndexedDB. Nie zmieniono manifestu biznesowych skryptów, cloud-auth, serwerowego weryfikatora/bramki Auth, Firebase config, Rules, grantów, sesji edycji, setterów PCV, kalkulatorów, katalogów/cenników, magazynu, historii lub mechanizmu backupów. Nowa baza nie jest drugim autorytetem projektu ani kopią danych biznesowych. Testy porównują RAW/RAM przed i po operacji, również przy odmowie; obecne regresje sesji, częściowego zapisu P1/P2/P3 i rollbacku pozostają obowiązujące. Referencje: 16,440 → 17,122 → 18,834 mb, fronty 5,010 → 5,511 mb, jeden zapas 10%, 4/3/6 arkuszy.

## Bloker wykryty w niezmienionym mechanizmie profilu

**Historia blokera, obecnie naprawiona w zatwierdzonym rozszerzeniu pakietu.** W pierwszej części pracy wstrzymano commit/push i nie zmieniano profilu bez zgody. Następnie właściciel wyraźnie zatwierdził transakcyjny mechanizm, testy wyścigów i usunięcie kontrolki UID. Pierwszy pełny Chromium wykazał odmowę testu `Two existing-profile admissions use the real cross-tab Web Lock and never overwrite a foreign UID`: obie karty zwróciły `ok`, zamiast odmowy drugiemu syntetycznemu UID. Celowane powtórzenie przeszło; nie uznano go za obalenie pierwotnego wyniku.

Osobna diagnostyka `/tmp/cloud-profile-race-diagnostic.mjs`, poza repozytorium, uruchamia niezmieniony kod profilu w natywnym Chromium na izolowanym localhost. Dwie karty przygotowują zgody różnych syntetycznych UID, kolejkują operacje w tym samym rzeczywistym Web Lock i wykonują je po kolei. W **4/20** prób druga karta wewnątrz locka nadal odczytała `null` dla `meble_access_profile_v1`, chociaż pierwsza zakończyła zapis i read-back; druga również zgłosiła sukces z własnym dowodem. Kolejność Web Lock nie zagwarantowała widoczności zapisu localStorage w drugiej karcie. Diagnostyka nie zmienia żadnych rzeczywistych danych ani repozytorium.

`local-access-profile.js` jest bajtowo zgodny z bazą main (SHA-256 `0e1c7a66510b65190a43890143a6bde96b761bf92f721d64e2a9b319560abe64`). `main-login.js` również niezmieniony. W reprodukcji nie ma importu nowego transportu. Jest to zastana niezgodność deklarowanej ochrony przed równoległym powiązaniem profilu, a nie regresja algorytmu transportu.

**Granica dowodu:** badany niskopoziomowy mechanizm profilu nie wykonuje Firebase Auth; diagnoza nie dowodzi obejścia serwerowego appEnabled, Firestore Rules ani wejścia niezatwierdzonego konta do normalnej aplikacji. Nie stwierdzono utraty danych biznesowych. Mimo to nie można uznać wymaganej regresji równoległych kart za niezawodnie zieloną lub przedstawiać Web Lock jako atomowej ochrony localStorage.

Ten zakres został później zatwierdzony i wykonany; szczegóły transakcyjnej naprawy oraz dowody przed/po poniżej. Nie dodano opóźnień jako zabezpieczenia, resetu ani obejścia autoryzacji serwerowej.

## Ograniczenia i następne warunki

- Kod LIVE nie jest częścią manifestu ani startupu; nie ma flagi, kontrolki lub automatycznego uploadu. Zmiana `target` dotychczasowego `create()` nie uruchomi LIVE. Późniejsze podłączenie do prywatnej sesji main-login wymaga osobnej integracji i zgody; nie udostępniono globalnej kopii sesji.
- Brak rejestracji w UI nie jest serwerowym ACL. Publiczny JS można uruchamiać ręcznie; wyłącznie Rules i granty stanowią zabezpieczenie serwera. Obecnego Auth-only nie rozszerzono.
- Rules nie liczą SHA-256 Blob ani nie walidują biznesowego JSON. Złośliwy zatwierdzony właściciel z własnym klientem może tworzyć nieprawidłowy staging; kontrolowany klient odrzuca go przy odczycie. Nie poszerzamy pilota poza jedno syntetyczne I/P.
- Transakcja zapewnia spójność odczytanych dokumentów; końcowy odczyt manifestu wykrywa zmianę podczas składania. Nie blokuje przyszłej zmiany po zwrocie wyniku i nie tworzy transakcji obejmującej localStorage. Snapshot ma własną wskazaną rewizję.
- Utrata sieci, Auth lub zamknięcie klienta po wysłaniu transakcji nie dowodzi, że serwer jej nie wykonał. Brak automatycznego usuwania lub retry po wyniku niepewnym; istniejące ograniczenia uchwytów RAM po restarcie pozostają.
- Odtworzenie bajtów i poprawnego modelu nie oznacza identycznego wyświetlenia ani WYCENY na pustym urządzeniu. `dependencies` raportuje referencje; katalogi/ceny/defaulty i globalne słoje nie są dołączane. Issue #47 pozostaje otwarte.
- 800 KiB jest limitem pierwszego pilota, nie docelowego produktu. Maksymalny odczyt wymaga manifestu, rewizji i do 7 fragmentów oraz końcowego potwierdzenia; ponowienia i zależne odczyty Rules zużywają limity Spark. Nie zmieniono billingu, retencji ani backupów.
- localStorage nadal nie ma izolacji kryptograficznej przed właścicielem profilu/DevTools/XSS. Nie zmieniono lokalnego dowodu ani modelu własności.

**Przed realnym Firebase:** oddzielna zgoda właściciela na dokładny kod integracji, przegląd i wdrożenie właściwych biznesowych Rules, administracyjny grant jednego syntetycznego zakresu, aktualna weryfikacja serwerowych odmów, limitów i zależności SDK oraz kontrolowany plan zapisu/odczytu bez importu. Nie wykonywać tych czynności w tym pakiecie. Bez Ready/merge/Pages, Firebase deploymentu lub przełączenia autorytetu domen.

## Pliki zachowane w roboczym pakiecie

- `js/app/cloud/firebase-pilot-transport.js` — wspólne operacje i własność połączenia, świeże serwerowe odczyty.
- `js/app/cloud/firebase-pilot-live-transport.js` — nowy, niezarejestrowany adapter współdzielonej sesji.
- `js/app/cloud/cloud-pilot-contract.js` — pełny, niezależny `unpack` z ponowną walidacją CLOUD-1B.
- `js/app/cloud/project-cloud-pilot.js` — wewnętrzne `read()` zwracające dane do RAM.
- `tools/firebase-pilot-smoke.js` — 10 pozytywnych/negatywnych kontroli kontraktu, wykrywanych przez Preflight.
- `tools/firebase-pilot/pilot.test.mjs` — niezależni klienci, integralność, model i współdzielona sesja; część pełnego 40/40.
- `tools/firebase-pilot/auth-browser.test.mjs` — rzeczywisty startup z pożyczonym Auth i blokada live ruchu; istniejąca asercja kart nie została osłabiona.
- `CURRENT_STATE.md`, `ROADMAP.md`, `CLOUD_MIGRATION.md` — rozdzielenie wdrożonego Auth-only, emulatorowego pakietu, nieaktywnego LIVE i blokera odbioru.
- `tools/reports/cloud-2b-firebase-pilot.md`, `tools/reports/cloud-2b3-main-login.md` — krótkie sprostowania statusu z zachowaniem historii.
- Ten raport — kontrakt, wyniki i jawny bloker.

Nie zmieniono PR #41 ani nie utworzono konkurencyjnego rejestru decyzji. Po zgodzie na rozszerzenie domykamy ten sam pakiet na tej samej gałęzi. Nie wykonano resetu, Ready, merge, Pages lub wdrożenia Firebase.


## Zatwierdzone rozszerzenie — atomowy właściciel lokalnego profilu

**Wybór:** natywny IndexedDB, jedna baza `meble-access-profile-v1`, store `ownership`, klucz `owner`. Rekord ma dokładnie `{version:1,uid,state,attemptId}`. Transakcje readwrite obejmują odczyt istniejącego właściciela i zapis decyzji, a baza serializuje je między połączeniami/kartami. Web Locks pozostały dodatkową ochroną organizującą startup, ale nie są podstawą atomowości ani widoczności danych localStorage. Bez sleep/retry jako zabezpieczenia, nowych zależności lub przenoszenia domen biznesowych.

### Protokół i awarie

1. Świeża serwerowa autoryzacja UID, konkretna epoka Auth i świadoma zgoda dla zastanego profilu nadal poprzedzają dopuszczenie. Synchronous `assert` podczas działania biznesu opiera się na potwierdzonym właścicielu i bieżącej bramce Auth; nie zastępuje pierwszego transakcyjnego potwierdzenia.
2. Pierwsza transakcja atomowo rezerwuje UID jako `pending`. Inny UID jest odrzucany nawet wtedy, gdy jego karta widzi stare `null` w localStorage. Ten sam UID współdzieli rezerwację bez podmiany jej identyfikatora; po nieudanej próbie wymagana jest świeża zgoda/ticket.
3. Druga transakcja sprawdza rezerwację i niezmienność danych. W jej synchronicznym callbacku wykonuje dotychczasowy zapis/read-back lokalnego odnośnika i weta, bez zmian biznesowych. Następnie zapisuje `active`, odczytuje go ponownie **wewnątrz tej samej transakcji**, weryfikuje dane i Auth.
4. Sukces dopiero po `transaction.oncomplete`, nie po `request.onsuccess`. Błąd odczytu, write, read-back, abort albo cofnięcie dostępu podczas transakcji pozostawia wcześniejszą rezerwację `pending`. Żaden aktywny kandydat nie przeżywa abortu. Rezerwacji nie kompensuje się kasowaniem; tylko ten sam UID po świeżej autoryzacji i zgodzie może dokończyć.
5. Zakończenie strony **po zatwierdzeniu** pozostawia kompletny aktywny dowód tego UID; po restarcie trzeba jeszcze przejść rzeczywistą serwerową autoryzację. Zakończenie przed commit nie daje zaufanego active. Nie dodano timeoutu, który błędnie deklarowałby nieudany commit po utracie jego odpowiedzi.
6. Logout, zmiana epoki/konta, utrata grantu i zamknięcie bramki czyszczą zaufanie RAM oraz abortują trwające transakcje profilu. Nie kasują dowodu właściciela ani biznesu. Nie ma fallbacku na sam localStorage przy braku/błędzie IndexedDB, błędnej wersji lub nieznanym rekordzie.

### Zachowanie Androida, v1/v2/v3 i cofnięcie

- Dotychczasowy poprawny **v2 bez weta** po autoryzacji tego samego UID jest potwierdzany atomowo w IndexedDB. Oryginalny RAW v2 oraz wszystkie dane pozostają bajt w bajt bez zmian; nie pojawia się ponowna zgoda właściciela tylko z powodu aktualizacji.
- Historyczny v1, veto lub niedokończony rekord wymagają świeżej zgody. Obcy UID, korupcja, nieznany schemat lub sprzeczne rekordy oznaczają odmowę, bez automatycznego resetu.
- **Nowe powiązania używają odnośnika v3** w dotychczasowym kluczu localStorage. Sam v3 bez aktywnego rekordu IndexedDB nie ma mocy uprawnienia, również w pustym profilu. Starszy moduł sprzed IndexedDB odrzuca nieznany v3 — nie może uznać niepotwierdzonego kandydata za v2 po cofnięciu wydania.
- Cofnięcie musi zachować poprawiony moduł profilu/integrację albo blokować startup; nie wolno cofać do wersji ufającej wyłącznie localStorage. Żadnego usuwania bazy, dowodów, fc_* lub importu backupu jako sposobu odblokowania. To ograniczenie dostępu przy downgrade, nie utrata danych. Przejście poprawnego v2 nie wymaga jego przepisywania.
- Oryginalne logo i Google SDK/persistence pozostają. Usunięto tylko produkcyjny przycisk `Pokaż Firebase UID`, output, handler i nieużywane style. UID pozostaje wewnętrzną podstawą autoryzacji. Odmowa niezatwierdzonemu kontu, wylogowanie i sesja Google działają; nie dodano kontrolki zastępczej.

### Reprodukcja i regresje

- Pierwsza diagnoza: 4/20 błędnych dopuszczeń; powtórzenie przed poprawką w tej kontynuacji: **3/20**. Oba wyniki zachowano poza repo (`/tmp/cloud-profile-race-before-fix.log` i wcześniejszy log).
- Deterministycznie wymuszono per-karta widok starych znaczników: stary kod dopuścił oba różne UID (**1/1 FAIL**), nowy kod odmówił drugiemu (**1/1 PASS**), mimo `null` w jego localStorage. Jest to wymuszenie problematycznej kolejności/widoczności, nie test oparty na prawdopodobieństwie.
- Natywne Chromium: **100 współbieżnych prób, zero podwójnego dopuszczenia**, dokładnie jeden właściciel w każdej próbie; brak zmian fc_*, aliasów, aktywnego snapshotu i sessionStorage. Bez sleep, preferowania zwycięzcy lub ponawiania.
- Osobno: ten sam UID w dwóch stale widzących kartach; restarty obu kart; awarie po rezerwacji i przy aktywacji/read-back/abort; poprawny v2 bez przepisania; brak IndexedDB; błędne rekordy; stary v1; cofnięcie autoryzacji/epoki; no-op i brak biznesowych mutacji.
- Unit model transakcji służy do wstrzykiwania precyzyjnych awarii; **nie zastępuje natywnego IndexedDB i testów dwóch kart**. Nie dodano npm dependency.

### Błędy ujawnione podczas domykania i poprawione bez osłabienia testów

Pierwszy rozszerzony Preflight zatrzymał się na starej asercji cache-bustingu `boot.js`: przypadkowo zmieniono query tag niezmienionego bootu razem z Auth. Przywrócono go, a znaczniki aktualizujemy wyłącznie dla zmienionych plików. Assercja bootu pozostała bez zmian; zmodyfikowane local-access-profile/main-login mają nowy tag, aby stary cached moduł nie ominął naprawy.

Pierwszy rozszerzony pełny Emulator Suite miał **39/40**, ponieważ przy konflikcie dwóch klientów zwycięzca nie potwierdził swojego zapisu: nowa transakcja odczytowa manifestu otrzymała rzeczywiste SDK `aborted`. Celowany test odtworzył ten kod; nie oznaczało to utraty projektu lub pozwolenia przegranemu na nadpisanie. Zwiększono wyłącznie ograniczoną liczbę prób tej read-only transakcji do 3, z tymi samymi kontrolami Auth i Rules. Nie ponawiamy automatycznie niepotwierdzonej publikacji. Nowy test wymusza pierwsze `aborted` w rzeczywistym SDK (odczyt odzyskany) oraz trwałe `aborted` (3 próby, jawna odmowa, zero zapisów). Celowane regresje konfliktu i retry: **2/2 PASS**. Wyczerpanie prób po już wysłanym commicie nadal oznacza wynik niepotwierdzony wymagający istniejącego confirm.

### Końcowe wyniki rozszerzonego pakietu

| Końcowa kontrola | Wynik |
|---|---|
| `npm --prefix tools/firebase-pilot test` | **41/41 PASS**, zero skipped, SDK + Auth/Firestore emulatory |
| `AUTH_POPUP_TEST=1 npm --prefix tools/firebase-pilot run test:browser` | **28/28 PASS**, zero skipped, natywny Chromium |
| Współbieżne dopuszczenia w końcowym Chromium | **100/100 poprawnych rozstrzygnięć, zero dwóch UID dopuszczonych** |
| Deterministycznie wymuszony stary odczyt | stary kod **FAIL**, nowy **PASS**; restart obu kart i właściciel sprawdzone |
| `node tools/main-login-smoke.js` | **36/36 PASS** |
| `node tools/cloud-auth-smoke.js` | **37/37 PASS** |
| `node tools/firebase-pilot-smoke.js` | **10/10 PASS** |
| `node tools/preflight.js` | **PRE-FLIGHT PASS** — 543/543 JS, 122/122 smoke, APP 110/110, load order 331, dependency/storage PASS (342 referencje / 42 pliki) |
| `node --check` wszystkich zmienionych JS/MJS i `git diff --check` | **PASS** |

Preflight obejmuje niezmienione regresje PCV, pojedynczego zapasu 10%, 4/3/6 arkuszy, globalnych zapisów, P1/P2/P3, rollbacku i historii ofert. Po końcowym zaostrzeniu typu rekordu koordynatora (odmowa tablicy z nazwanymi polami) dodatkowo ponownie wykonano 36/36 jednostkowych i kontrolę składni. Rozstrzygające testy atomowości korzystają z natywnego IndexedDB, nie modelu jednostkowego. Wszystkie emulatory zakończyły pracę; żadna kontrola nie korzystała z produkcyjnego konta ani danych.

Logi środowiska: `/tmp/atomic-package-preflight-pass.log`, `/tmp/atomic-package-emulators-pass.log`, `/tmp/atomic-package-chromium-pass.log`, `/tmp/atomic-profile-unit.log`, `/tmp/atomic-auth-unit.log`, `/tmp/atomic-pilot-unit.log`. Celowane wcześniejsze przebiegi 4/4 i 5/5 oraz początkowe odmowy zachowują kontekst diagnostyki; nie zastępują końcowych wyników.

Dodatkowe pliki względem pierwszej części: `js/app/cloud/local-access-profile.js`, `js/main-login.js`, `index.html`, `css/auth-test.css`, `tools/main-login-smoke.js`, `tools/helpers/profile-indexeddb-fixture.js`, `CLOUD_DATA_REGISTER.md`, `BACKUP.md`; rozszerzono już zmieniony Chromium i dokumenty statusu.

### Ryzyka resztkowe

IndexedDB zapewnia atomowe rozstrzygnięcie między współpracującymi kontekstami tego samego origin. Nie jest serwerowym ACL: DevTools, XSS, rozszerzenie lub osoba kontrolująca profil systemowy mogą zmieniać lokalne dane. Celowe wyczyszczenie/ewikcja pamięci witryny może usunąć techniczny dowód; wtedy nie ma automatycznej zgody na zastane dane. Strict durability wymaga wsparcia przeglądarki; brak/niedostępność bazy lub blokada aktualizacji oznacza odmowę. Android Chrome jest platformą docelową, ale testy Chromium nie zastępują ręcznej akceptacji wydania na telefonie.

Nie dotknięto produkcyjnych Rules/grantów, nie uruchomiono Firestore LIVE, uploadu, migracji biznesu, billingu lub publikacji. Wymagania dotyczące syntetycznego pilota, katalogów, wyceny, chmurowego autorytetu i przyszłej zgody na realny transport pozostają bez zmian.
