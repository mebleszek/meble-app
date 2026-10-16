# CLOUD-2B.1 — ekran logowania i przygotowana granica Auth

2026-10-16; baza main **`96f43f04` po PR #52**. Etap A i przygotowanie B, **bez aktywowania obowiązkowego logowania**. Nie wykonywano prawdziwego logowania Google ani połączenia z produkcyjnym Firestore. Konfiguracja konsoli przekazana przez użytkownika pozostaje: `mebleszek-meble-app`, Spark bez billingu, Google, authorized domain `mebleszek.github.io`, Firestore Standard `(default)` Warszawa, Rules deny-all.

## 1. Uruchomienie kontrolowanego testu

Normalne `index.html` pozostaje bez zmian; nie ma flagi w localStorage, automatycznego logowania ani przekierowania. Osobny **`auth-test.html`** jest jedynym punktem wejścia. Nie ładuje `boot.js`, `app.js`, katalogów, projektów, backupów ani modułów biznesowych. Bez konfiguracji wyświetla czytelną odmowę, nie pobiera nawet SDK.

Aby później świadomie sprawdzić rzeczywiste Google Auth:

1. Firebase Console → Project settings → General → Your apps → zarejestrowana aplikacja Web → SDK setup / Config.
2. W **`js/auth-test-config.js`** zastąpić `null` zgodnie z komentarzem: `target:'live-auth'` i cztery publiczne pola `firebaseConfig`: `apiKey`, `authDomain`, `projectId`, `appId`. Kopiować rzeczywiste wartości z konsoli. Nie wklejać całego service account, tokenów, profilu firmy lub klucza ORS. Szablon nie zawiera wymyślonego klucza/appId. Publiczny web config nie jest regułą dostępu do danych.
3. Otworzyć wyłącznie stronę testową na osobno zatwierdzonym hostingu HTTPS. **Ta gałąź nie została opublikowana.** Lokalnie można użyć istniejącego serwera statycznego; ewentualny `localhost` musi być świadomie dopuszczony w Firebase Auth. Nie zmieniać domen/hostingu automatycznie.
4. „Zaloguj przez Google” wywołuje popup z wyborem konta. Po zalogowaniu widoczny jest stan **„Dostęp do aplikacji nie został jeszcze zatwierdzony”** — brak weryfikatora serwerowego, więc aplikacja biznesowa nadal nie jest otwierana.
5. „Pokaż Firebase UID” wyświetla tylko bieżące UID na żądanie. Nie ma automatycznego logowania UID, e-maila ani tokenów do konsoli/repo. „Wyloguj” natychmiast odbiera bieżącą dzierżawę dostępu i usuwa widok UID; SDK usuwa własną sesję, nie dane `fc_*`.

**Nie odblokowywać produkcyjnego Firestore, nie wdrażać Rules i nie tworzyć grantu konta w ramach tego etapu.** UID można potem sprawdzić w Authentication → Users, po świadomym rzeczywistym logowaniu użytkownika. Nie przesyłać tokenów ani poświadczeń do repo lub raportów.

## 2. UI i rozdzielenie startu

Grafitowe tło, miedziano-złota typografia i akcenty, minimalistyczna karta, jeden główny przycisk logowania. Nie znaleziono firmowego pliku logo w aktualnych assets; użyto nazwy i dekoracyjnego monogramu tekstowego, bez deklarowania go jako dostarczonego oficjalnego logo. Systemowe fonty, brak zewnętrznego fontu/trackera na stronie. Małe przyciski pomocnicze są widoczne dopiero po logowaniu.

Układ uwzględnia Android, tablet i komputer: viewport/safe-area, naturalny scroll i niskie ekrany, zawijanie UID/komunikatów, cele dotyku min. 48 px, widoczny fokus klawiatury i status/alert ARIA. Automatyczne testy Chromium sprawdzają szerokości 320, 768, 1440 px. To **symulacja viewportów**, nie test prawdziwego Androida/tabletu/Windowsa.

`js/app.js` i część wcześniejszych modułów wykonują odczyty/normalizację jeszcze przed `init()`. Dlatego samo opóźnienie `FC.init()` lub nakładka na pełny `index.html` nie chronią danych. Osobna strona testowa nie pobiera tych skryptów w ogóle. Aktualnego startu produkcyjnego nie przebudowywano.

## 3. SDK, UID i persistence

- Istniejący `firebase-pilot-transport.js` udostępnia wspólny **`loadAuthSdk()`** oraz **`observeIdentity()`**. Wykorzystują je zarówno CLOUD-2B, jak i Auth testowe; nie powstała druga implementacja identyfikacji UID/epoki konta.
- Loader Auth pobiera tylko przypięte Firebase **12.19.0 app + auth**. Firestore jest importowane dopiero przez dotychczasowy `loadSdk()` adaptera danych. Nie zmieniono jego emulatorowego warunku odmowy live.
- `cloud-auth.js` tworzy osobną nazwaną instancję Auth, bez bazy. Rozdziela target `live-auth` od kontrolowanego `demo-*` + loopback emulatora. Nie pozwala użyć innego produkcyjnego project ID/domain ani wklejać dodatkowych pól konfiguracji.
- Hierarchia **IndexedDB local → browser local persistence** jest przekazywana już do `initializeAuth`, aby SDK mogło najpierw odtworzyć istniejącą sesję. Następnie potwierdzana jest dostępność trwałego persistence; brak pamięci oznacza odmowę, bez udawania trwałej sesji w RAM. Wszystkimi tokenami zarządza SDK. Kod aplikacji nie zapisuje własnych tokenów.
- Wspólny obserwator wymaga providera Google i śledzi UID/epokę. Zmiana konta, wylogowanie i błąd weryfikacji unieważniają wcześniejszy dostęp. Odświeżenie sesji Auth nie jest dowodem uprawnień do danych.
- Nie użyto `signInWithRedirect`. Nie ma założenia o niezawodności third-party storage na GitHub Pages.

## 4. Popup i ograniczenia weryfikacji

SDK i persistence są gotowe **przed** włączeniem przycisku. `signInWithPopup` jest wywoływane synchronicznie w stosie kliknięcia/tap, bez wcześniejszego `await`/dynamicznego importu. Zmniejsza to ryzyko blokady okna przez Chrome. Używane jest `prompt:'select_account'`; przy odtwarzaniu sesji nie ma popupu.

Zamknięcie okna, blokada popupu, odmowa domeny, brak sieci/SDK/persistence i błąd konfiguracji otrzymują zrozumiałe komunikaty i bezpieczne kody. Brak surowych komunikatów konta/tokenów w UI. Błąd inicjalizacji usuwa wyłącznie własną instancję SDK, umożliwiając ponowienie; nie resetuje danych programu.

**Bloker środowiskowy:** prawdziwy browser SDK potrzebuje publicznego helpera `https://apis.google.com/js/api.js` także dla popupu Auth emulatora. Proxy Codexa zwraca dla tego hosta **CONNECT 403**. Zapisano dodanie hosta w konfiguracji środowiska do przeglądu, ale zapis draftu nie odblokował bieżącego runtime. Nie obchodzono polityki sieci, TLS ani nie zastępowano helpera atrapą udającą udany popup.

Z tego powodu **dwa pełne testy popupu są jawnie SKIP**, nie PASS. Odwzorowania błędów i synchroniczny start są testowane jednostkowo, a rzeczywisty Chromium sprawdza błąd niedostępnego helpera oraz ponowne udostępnienie przycisku. Test poprawnego SDK login/persistence używa syntetycznego Google credential bezpośrednio w lokalnym emulatorze, bez popupu — rozróżnienie jest celowe.

Po dopuszczeniu helpera w środowisku testowym: `AUTH_POPUP_TEST=1 npm run test:browser`. Test nadal ogranicza ruch do emulatorów i publicznych skryptów Google, bez prawdziwego OAuth lub danych biznesowych. **Pełny popup emulatorowy wymaga ponownego uruchomienia i potwierdzenia**. Potem użytkownik musi osobno przetestować rzeczywiste konto w Android Chrome: gest, wybór konta, zamknięcie/blokada, błąd sieci, restart i wylogowanie. Nie uznajemy tych scenariuszy za zaliczone na prawdziwym urządzeniu.

## 5. Przygotowana bramka i autoryzacja serwerowa

`auth-access-gate.js` rozróżnia `checking`, `unauthenticated`, `authenticated` (oczekiwanie na weryfikację), `unapproved`, `authorized`, `error`. Nie ma reguły e-mail ani UID użytkownika w publicznym kodzie.

API przygotowanej bramki przyjmuje w przyszłości `verifyAccess({uid,epoch})` i loader `onAuthorized(lease)`. Bez weryfikatora **zawsze odmawia**. Loader nie jest wywoływany przed rozstrzygnięciem autoryzacji. Sprawdza dokładny UID odpowiedzi oraz aktualność UID/epoki i oczekującej operacji. Zmiana konta, wylogowanie, błąd lub zamknięcie bramki unieważniają lease. Przyszły asynchroniczny loader ma sprawdzać `lease.assert()` przed każdym pobraniem/wykonaniem biznesowego skryptu; callback `onBlocked` musi natychmiast wstrzymywać dostęp. Ta gałąź nie podłącza takiego loadera do właściwej aplikacji.

**Plan, nie wdrożenie:** po osobnej zgodzie zaprojektować minimalny, niebiznesowy dokument uprawnienia odczytywany wyłącznie z serwera przez uwierzytelniony UID. Jego `get` musi zależeć w Rules od administracyjnego `authorizedUsers/{uid}`, zatwierdzenia i zakresu pilota. Klient nie może pisać grantu; samego grantu/listy kont nie udostępniać klientom. Nie otwierać Rules dla każdego konta Google. Każda późniejsza operacja na danych musi niezależnie przejść Rules; publiczna bramka JS sama nie jest zabezpieczeniem bazy. Weryfikator nie może uznać cache/offline lub błędu odczytu za zgodę. Potrzebny jest też kontrakt ponownej weryfikacji/cofnięcia grantu podczas pracy; aktualna bramka nie implementuje monitorowania uprawnień serwera.

**Warunki przed obowiązkowym logowaniem:** zatwierdzony serwerowy kontrakt uprawnień i Rules, pozytywne/negatywne testy, bramka przed pobraniem *wszystkich* modułów biznesowych (nie tylko przed init), zamknięcie wszystkich alternatywnych wejść, bezpieczna reakcja na revoke/logout i błędy, oraz rozwiązanie własności istniejących lokalnych danych na wspólnym urządzeniu. Nie wolno automatycznie przypisać lokalnego katalogu/projektów nowemu UID ani kasować ich po zmianie konta. Nie wolno obiecywać ochrony lokalnych danych ekranem testowym — zwykły `index.html` pozostaje dostępny zgodnie z Etapem A.

## 6. Dane, podatności i CI

Auth nie czyta ani nie zmienia `fc_*`, sesji Zapisz/Anuluj, inwestorów, projektów, katalogów/cenników, magazynu, PCV/słojów, ofert i backupów. SDK przechowuje własną sesję w Firebase IndexedDB/local persistence; nie należy jej kopiować do eksportu/backupów biznesowych. Nie ma Firestore instancji, odczytów biznesowych ani uploadu w ekranie testowym.

Ponowny `npm audit`: wcześniejszy raport miał 15 pozycji; aktualny odczyt przed zmianą wykazał **12 (8 high / 4 moderate)**, co odzwierciedla także zmienną bazę advisories. Dodano jawny override **`@grpc/grpc-js:1.14.6`**, zgodny z linią 1.x, zamiast przypiętego przez Node Firestore SDK 1.9.16. Rzeczywiste testy SDK/Rules potwierdzają zgodność. Nie używano `npm audit fix --force`, sugerowanych downgrade Firebase ani niezgodnych zmian major.

Po aktualizacji: **7 pozycji (3 high / 4 moderate)**. Główne nierozwiązane advisory: `braces` (poprzez chokidar/Firebase CLI; aktualna stabilna wersja nadal objęta), `uuid` i `@opentelemetry/core` w drzewie CLI/pubsub. Są to narzędzia Node, nie importy strony Auth app/auth. CLI uruchamia wyłącznie zamknięte lokalne emulatory, bez untrusted globów, serwera tracingu ani deploy/admin credentials; nie oznacza to braku ryzyka. Nie forsowano głównych wersji tych zależności bez kontraktu upstream. Ponowna ocena pozostaje warunkiem etapu live; browser SDK i wszystkie zewnętrzne zależności również wymagają dalszego nadzoru.

Workflow `preflight-js.yml` otrzymuje po pełnym preflight kroki Java 21 + `npm ci` + **cały** zestaw emulatorów. Są w istniejącym jobie `preflight`, więc jego późniejszy błąd blokuje istniejącą zależność auto-merge. Nie zmieniono triggerów, zgód ani reguł scalania. Sam push gałęzi nie uruchamia Ready/merge/deploymentu; nie wywoływano workflow ręcznie. Zestaw przeglądarkowy pozostaje osobną kontrolą lokalną (potrzebuje Chromium i publicznych helperów).

## 7. Testy i wyniki

- `node tools/cloud-auth-smoke.js`: **12/12 PASS** — rejestracja bez skutków, konfiguracja, persistence/odmowy, popup w stosie gestu, bezpieczne błędy/retry, cleanup inicjalizacji, brak zatwierdzenia, weryfikator odmowny/obcy UID/błąd, revocable lease i wyścig zmiany konta. Kontrolowane SDK w tych testach jest atrapą; nie są dowodem rzeczywistego OAuth.
- `cd tools/firebase-pilot && npm test`: **20/20 PASS, zero SKIP**. Obejmuje poprzednie 17 rzeczywistych regresji CLOUD-2B oraz prawdziwy Auth emulator/SDK, Google UID, brak zatwierdzenia, zmianę konta i anonymous odmowę. Node nie udaje przeglądarkowego persistence.
- `npm run test:browser`: **4 PASS / 2 SKIP**, bez FAIL. Prawdziwy headless Chromium i browser SDK/emulator: responsywność/fokus, zapis sesji w IndexedDB, reload i zamknięcie/ponowne otwarcie karty bez logowania, wylogowanie, zachowanie kontrolnych `fc_*` bajt w bajt, brak biznesowych skryptów/Firestore, błąd helpera i zwykły start `index.html` bez Auth. Dwa pełne popupy jawnie oczekują na odblokowanie hosta i ponowną weryfikację.
- Pełny `node tools/preflight.js`: **PRE-FLIGHT PASS**, 121/121 smoke, APP 110/110, 536/536 składni JS, load order 323, dependency/storage PASS (341 referencji / 41 plików). Dodatkowe `node --check` wszystkich nowych/zmienionych JS/MJS i `git diff --check`: **PASS**. Workflow YAML poprawnie parsowany; samego GitHub Actions nie uruchamiano.
- Celowane regresje: wspólny kontrakt CLOUD-2B **8/8**, niepotwierdzona sesja P1/P2/P3 **30/30**, adaptery R1/R2/W1/W2 **27/27**, bezpieczeństwo globalnych zapisów **30/30**, multiroom/session **PASS**. Zachowano **17,122 → 18,834 mb**, **5,010 → 5,511 mb**, ceny/jeden zapas 10% i **4/3/6 arkuszy**; nie zmieniono ich asercji.

Testy korzystają wyłącznie z syntetycznych kont/projektów i loopbackowych `demo-meble-app`. Nie użyto rzeczywistych magazynów użytkownika. Publiczne przypięte app/auth SDK pobrano po HTTPS i sprawdzono ich SHA-256; próby dostępu do prawdziwych Auth/data endpoints są blokowane w browser fixture. Dodatkowy pakiet `playwright-core` to narzędzie testowe, bez bundlera aplikacji.

## 8. Wycofanie i stan do akceptacji

Ponieważ `index.html` nie wskazuje nowych modułów, nie ma produkcyjnej aktywacji do cofania. Usunięcie/pozostawienie `FC_AUTH_TEST_OPTIONS=null` wyłącza nowe inicjowanie Auth w stronie testowej; nie jest wylogowaniem już istniejącej sesji SDK. Wylogowanie wykonuje przycisk testowy, bez resetu danych. Cały commit można później wycofać osobną zatwierdzoną zmianą; nie resetować magazynów.

**Nie gotowe do obowiązkowego logowania ani uznania danych za zabezpieczone bramką.** Pozostają: rzeczywisty publiczny config, helper/popup + ręczna akceptacja Androida, serwerowa autoryzacja/granty/Rules po odrębnej zgodzie, własność danych na wspólnej przeglądarce i prawdziwy loader biznesowy. Nie wdrożono synchronizacji, Firestore uploadu ani UI głównego logowania. Nie wykonano Ready, merge lub publikacji.

## 9. Dokładna lista zmienionych plików

- `auth-test.html`, `css/auth-test.css`: oddzielny ekran i responsywny styl.
- `js/auth-test-config.js`, `js/auth-test.js`: domyślnie pusty publiczny config i kontroler strony, bez biznesowego bootu.
- `js/app/cloud/cloud-auth.js`, `js/app/cloud/auth-access-gate.js`: Auth/persistence/popup i nieaktywna granica autoryzacji.
- `js/app/cloud/firebase-pilot-transport.js`: współdzielony loader Auth/UID, bez zmiany blokady Firestore live.
- `tools/cloud-auth-smoke.js`, `tools/firebase-pilot/auth.test.mjs`, `tools/firebase-pilot/auth-browser.test.mjs`: testy stanów, prawdziwego emulatora i Chromium.
- `tools/firebase-pilot/package.json`, `tools/firebase-pilot/package-lock.json`: komendy testów, Playwright i kontrolowana aktualizacja gRPC.
- `.github/workflows/preflight-js.yml`: obowiązkowy zestaw SDK/Rules przed powodzeniem istniejącego joba preflight, bez nowego triggera/publikacji.
- `CLOUD_DATA_REGISTER.md`, `CLOUD_MIGRATION.md`, `CURRENT_STATE.md`, `ROADMAP.md` i ten raport: status, SDK-owned persistence, warunki dalszych etapów.

Cache publicznych SDK testowych jest poza repozytorium (katalog tymczasowy OS), aby nie dodawać vendorowych JS do skanowania preflightu. Nie zmieniono skanera ani asercji istniejących regresji. Wynik 536 dotyczy źródeł, bez pobranych artefaktów SDK. Testy nie zapisują wygenerowanego cache do commita.
