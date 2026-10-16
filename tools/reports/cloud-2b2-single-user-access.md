# CLOUD-2B.2 — zatwierdzony UID i serwerowe potwierdzenie dostępu

2026-10-16. Baza `9d87b393` — main po PR #55 (CLOUD-2B.1b). Gałąź `cloud-2b2-single-user-access`. Implementacja i testy lokalne; **nie wdrożono Rules, nie utworzono rzeczywistego grantu ani nie włączono obowiązkowego logowania**.

## 1. Zakres i model uprawnień

Google/Firebase Auth potwierdza tożsamość. Decyzję serwera wyznacza administracyjny dokument `/authorizedUsers/{uid}`. Klient nie może go odczytywać, listować, tworzyć, zmieniać ani usuwać. Nie ma listy UID/e-mail w publicznym kodzie; testy używają wyłącznie syntetycznych identyfikatorów emulatora. Jednego właściciela wybiera administrator przez utrzymywanie dokładnie jednego zatwierdzonego grantu, a nie przez publiczną stałą.

Rozdzielono dwie odpowiedzialności tego dokumentu:

- **`appEnabled: true`** — zatwierdzenie wejścia do aplikacji. Wymaga Firebase UID zgodnego ze ścieżką oraz `firebase.sign_in_provider == 'google.com'` w rzeczywistym tokenie. Sam e-mail, istnienie konta lub providerData po stronie JS nie wystarczają do przejścia Rules.
- **`enabled: true`, `pilotProjectId`, `pilotInvestorId`** — wcześniejsza, osobna zgoda na jeden syntetyczny projekt danych CLOUD-2B. Pełne emulatorowe Rules wymagają teraz również `appEnabled`. Samo wejście do aplikacji nie otwiera projektu, katalogów ani innych danych.

Administracyjny dokument kontrolny `/appAccess/{uid}` ma tylko `{ "schemaVersion": 1 }`. Tylko zatwierdzony właściciel może wykonać jego `get`. Nie ma listowania lub zapisów klienckich; inny UID, anonymous i brak Auth otrzymują odmowę. Weryfikator odrzuca brak dokumentu, obcy ID, dodatkowe pola i niezgodną wersję. Kontrolny dokument nie zawiera grantu, e-maila, projektu ani informacji biznesowych.

Nie użyto samego grantu projektu do wejścia: nie powinno być konieczności otwierania pilota danych, aby sprawdzić konto. Nie rozszerzono scope danych ani transportu live.

## 2. Weryfikacja, świeżość i cofnięcie

`FC.cloudAccessVerifier.create(auth)` tworzy leniwy weryfikator. Korzysta z **tej samej nazwanej instancji app/Auth**, udostępnionej przez wewnętrzne `cloudAuth.verificationContext()`. Nie tworzy kolejnego systemu logowania, tokenów ani domyślnej aplikacji Firebase. Ładuje przypięty Firestore Web SDK dopiero po tożsamości Google, z cache wyłącznie w RAM. Normalny `index.html` nie ładuje tego modułu. Publiczny Web config, Google popup i persistence Auth pozostają bez zmian.

`verify({uid,epoch})`:

1. Sprawdza bieżący UID/epokę, projekt SDK i znaną utratę sieci. Emulator wymaga `demo-*` i loopback; nie może po cichu użyć produkcji.
2. `getDocFromServer()` własnego dokumentu kontrolnego sprawdza dostępność sieci SDK i odrzuca `fromCache` / `hasPendingWrites`.
3. **Dodatkowy odczyt w transakcji bez zapisów** wymusza świeże sprawdzenie Rules na serwerze; `maxAttempts:1`, bez kolejki offline. Nie wystarcza sam snapshot oznaczony jako serwerowy. W diagnostyce aktywny listen target i niezmieniony dokument kontrolny potrafiły zachować poprzednią zgodę po zmianie zależnego grantu. Z tego powodu usunięto zależność od `onSnapshot()`; regresja wymaga odmowy świeżej transakcji i produkcyjnego `verify()` po cofnięciu grantu.
4. Ponownie sprawdza UID/epokę, metadane, ID i zamkniętą zawartość dokumentu. Błąd, niepewność lub timeout **8 s** nie dają zgody. Późna odpowiedź nie uruchamia loadera.

Każda pozytywna odpowiedź weryfikatora, także odnowienie, musi zawierać liczbowy, skończony `validUntil` spełniający `Date.now() < validUntil <= Date.now() + 45000` w chwili przyjęcia odpowiedzi. Bramka odmawia przy braku pola, `Infinity`, `-Infinity`, `NaN`, nieliczbowym typie, terminie minionym/bieżącym lub przekraczającym 45 s; nie podstawia wartości domyślnej ani bezterminowej zgody. Nieprawidłowe odnowienie unieważnia dotychczasowy lease i zatrzymuje watcher, bez możliwości odżycia tej zgody. Poprawny proof ma krótki termin ważności **45 s** i istnieje tylko w RAM. `watch()` ponawia wyłącznie powyższe odczyty co **30 s**, bez zapisów. Zdarzenia `offline`, ukrycie dokumentu i `pagehide` skracają czas do blokady. Bramka od razu unieważnia lease przy wylogowaniu lub zmianie UID/epoki. Upływ ważności sprawdza również samo `lease.isValid()/assert()`, niezależnie od opóźnionych timerów. Po błędzie lub cofnięciu stary lease nigdy nie odzyskuje ważności; do nowej weryfikacji można odświeżyć stronę albo wylogować i zalogować się ponownie.

**Granica gwarancji:** reguły odmawiają kolejnych rzeczywistych żądań serwera po cofnięciu grantu. UI nie ma natychmiastowej wiedzy o zdalnej zmianie: odświeża proof co 30 s, przy braku odpowiedzi najpóźniej wygasa 45-sekundowy lease. Cicha awaria sieci ma analogiczną granicę. Nie można odebrać klientowi wcześniej pobranych bajtów przez samą zmianę Rules ani uznać dostępnego lokalnie snapshotu za nową zgodę. W tym etapie strona nie pobiera danych biznesowych w ogóle.

Wylogowanie unieważnia lokalny lease i sesję SDK, lecz nie jest kryptograficznym cofnięciem JWT już wydanego i skopiowanego poza przeglądarkę. Administracyjna blokada danych polega na `appEnabled=false`; nie wolno zastępować jej obietnicą, że zamknięcie karty odbiera wszystkie tokeny.

Dwa odczyty kontrolne na odświeżenie oraz sprawdzenia zależnego grantu zużywają limity Spark. Jeden stale aktywny test to rząd kilku–kilkunastu tysięcy rozliczanych odczytów na dobę, zależnie od Rules/ponowień; nie jest to obietnica zerowego zużycia. Nie otwierać wielu kart bez potrzeby. Nie aktywowano billingu ani płatnych usług.

## 3. Strona testowa i brak produkcyjnej bramki

Istniejące `auth-test.html`, `cloud-auth.js`, `auth-access-gate.js` i kontroler strony pokazują: sprawdzanie sesji → sprawdzanie uprawnień → konto zatwierdzone / niezatwierdzone / cofnięte uprawnienia / błąd weryfikacji. UID i wylogowanie nadal dotyczą sesji Auth, nie administracyjnego grantu. Zmieniono teksty statusów, wpis modułu i wersje zmienionych skryptów; **logo 1536 px, hash oryginału, CSS i wygląd pozostają bez zmian**.

Zatwierdzenie pokazuje „Konto zatwierdzone. Dane aplikacji nie są wczytywane”. Nie ma callbacku ładującego biznes. Nieautoryzowane konto może się uwierzytelnić, ale nie przechodzi Rules i nie dostaje lease. Produkcyjne deny-all oznacza, że po ewentualnym wdrożeniu samego kodu, bez osobno zatwierdzonych Rules i grantu, próba sprawdzenia nadal odmówi — nie jest to awaria obchodzona fallbackiem.

`index.html` nadal otwiera dotychczasową aplikację lokalną. **Ta gałąź nie zabezpiecza istniejących danych localStorage obowiązkowym loginem.** Nie czyta, nie kasuje i nie przypisuje ich kontu. Nie zmieniono Zapisz/Anuluj, PCV, rozkroju, wyceny, historii, katalogów, stawek ani backupów.

## 4. Rules do późniejszego zatwierdzenia

- `tools/firebase-pilot/firestore.rules`: pełny, **wyłącznie emulatorowy** profil wcześniejszego pilota danych oraz kontrola `appEnabled`. Testy wcześniejszych niezmiennych rewizji, transakcyjnego manifestu i zakresów pozostają obowiązujące. **Nie publikować go tylko w celu sprawdzenia logowania** — otworzyłby dodatkowe operacje danych przy odpowiednim grancie.
- `tools/firebase-pilot/firestore-auth-only.rules`: osobny, mały kandydat **wyłącznie dla przyszłego testu autoryzacji**. Zezwala tylko na `get /appAccess/{request.auth.uid}` zależny od administracyjnego `appEnabled`, zgodnego UID i Google. `/authorizedUsers/**`, listowanie/zapis kontrolnego dokumentu i wszystkie pozostałe ścieżki pozostają deny-all. Profil kompilowany i testowany oddzielnie na emulatorze.

Nie zmieniono `firebase.json`, celu produkcji ani opublikowanych Rules. Nie uruchamiano deploy ani prawdziwych zapytań do Firebase. Kod adaptera danych CLOUD-2B nadal odmawia transportu live.

## 5. Późniejsze uzyskanie UID i ręczny bootstrap — instrukcja, nie wykonanie

Po osobnej zgodzie na rzeczywisty test:

1. Użytkownik otwiera wyłącznie stronę testową przez zatwierdzony HTTPS, loguje się własnym Google i sprawdza UID przyciskiem „Pokaż Firebase UID”. W Firebase Console → Authentication → Users porównuje go z właściwym kontem. **Nie wysyłać UID/tokenów do repo, logów testów lub raportów**; nie rozpoznawać uprawnień po samym e-mailu.
2. W Firestore Console, administracyjnie poza klientem, utworzyć `/authorizedUsers/<własny-Firebase-UID>` z `appEnabled` typu boolean `true` oraz `enabled` typu boolean **`false`**. Bez grantu projektu, cen czy innych danych. W pilotażu zatwierdzić tylko jednego właściciela. Nie zmieniać istniejących cudzych rekordów ani nie nadawać ról IAM klientowi.
3. Utworzyć `/appAccess/<ten-sam-UID>` z `schemaVersion` typu number `1`, bez innych pól. Console/IAM jest operacją administracyjną; klient nie ma takiego uprawnienia.
4. Wyłącznie po osobnej akceptacji wdrożyć **dokładny profil Auth-only**, nie pełny profil danych. Przed zatwierdzeniem zachować produkcyjne deny-all. Sprawdzić Spark/bez billingu, projekt, wersję i negatywne testy Rules. Ta instrukcja nie jest zgodą na wykonanie.
5. Odświeżyć stronę i potwierdzić status zatwierdzony; drugim kontrolowanym kontem sprawdzić odmowę. Konto drugie może powstać w Auth, lecz nie otrzymuje grantu. Dane Meble-App nadal nie są ładowane.
6. Cofnięcie: administracyjnie `appEnabled=false` lub usunięcie grantu, następnie potwierdzenie odmowy nowych operacji oraz zmiany statusu w ograniczonym czasie. Nie trzeba kasować projektów, `fc_*`, kont Auth ani danych globalnych. Wyłączenie Google providera to osobna decyzja i nie zastępuje cofnięcia uprawnień.

Warunki pierwszego testu: zaakceptowany ten kod i pełny zestaw testów, zatwierdzony dokładny profil Auth-only, potwierdzony własny UID w Console, osobna zgoda na administracyjny grant i Rules, kontrolowany Android Chrome, świadomość publicznego URL i limitów Spark, brak otwierania danych biznesowych. **Żaden z rzeczywistych kroków 1–6 nie został tutaj wykonany.**

## 6. Projekt właściwego loadera — jeszcze nie implementacja

Fakty: `index.html` zawiera statyczne eager/defer skrypty (m.in. `boot.js`, storage, sesje, katalogi, `app-state-bootstrap.js`, `app.js`). `js/app.js` już przy ewaluacji wywołuje `createInitialState`, zapisuje UI i uruchamia walidację/zapis projektu przed `init()`. `boot.js` obsługuje m.in. recovery skryptów i ręczne safe/reset. Nie wystarczy nakładka lub opóźnienie `FC.init()`.

Najmniejszy przyszły zakres, wymagający oddzielnej zgody:

1. `index.html` staje się lekką powłoką Auth przed **pobraniem i wykonaniem** któregokolwiek modułu biznesowego. Zatwierdzony layout aplikacji jest dodawany dopiero po serwerowym proofie i rozstrzygnięciu własności lokalnych danych.
2. Jeden loader zachowuje obecny porządek grup skryptów; nie utrzymywać ręcznie dwóch rozjeżdżających się manifestów. Przed każdym pobraniem i wykonaniem wymaga aktualnego `lease.assert()`. Wyścigi logout/revoke/zmiana konta przerywają ładowanie; inicjalizacja następuje najwyżej raz na dokument. Zestaw load-order i smoke musi zostać odpowiednio zachowany, bez przebudowy logiki domenowej.
3. Sprawdzić alternatywne wejścia (`dev_tests.html`, bezpośrednie strony/moduły, recovery bootu, bfcache) i zablokować niezamierzone lokalne odczyty przed autoryzacją. Publicznego JS/HTML/obrazów na GitHub Pages nie da się traktować jak sekretu; Rules nadal kontrolują każdą operację serwerową niezależnie od loadera.
4. Po utracie dostępu zamrozić edytor i zablokować operacje danych; nie wykonywać automatycznie Save ani Cancel. Już wykonanych modułów JS nie da się „odładować”; potrzebna jest bezpieczna granica zakończenia dokumentu i zachowania niezakończonego draftu. Nie budować jej bez testów sesji i decyzji użytkownika.
5. **Bloker przed aktywacją:** obecne lokalne projekty i cenne globalne dane nie mają rozstrzygniętej własności Firebase UID. Nie przypisywać ich pierwszemu kontu, nie usuwać przy logout, nie odtwarzać na nowym koncie. Wspólna przeglądarka i ręczne ominięcie JS mogą nadal dawać dostęp do localStorage. Dopiero zatwierdzony model chmurowego autorytetu/cache i własności lokalnej pozwoli obiecać ochronę danych między kontami. Ekran testowy i lease nie rozwiązują tego problemu.

Ta gałąź nie implementuje tych pięciu zmian i nie aktywuje obowiązkowego loginu.

## 7. Spark, tworzenie kont i publiczny hosting

Security Rules Firestore nie blokują tworzenia kont w Firebase Authentication. W obecnym Google Sign-In osoba znająca publiczny Web config może próbować zalogować się i utworzyć konto Auth; domena autoryzowana i API key nie są listą uprawnionych użytkowników. Brak grantu blokuje jej dane i aplikacyjne potwierdzenie, nie samo istnienie konta. Może to zużywać limity Auth i odczytów odmownych; monitorowanie należy do administratora.

Dokumentacja Firebase wymaga **Authentication with Identity Platform** dla blocking functions `beforeCreate`/`beforeSignIn`; deployment Cloud Functions wymaga **Blaze**. W zatwierdzonym Spark/bez billingu nie implementujemy takiej blokady tworzenia kont, Cloud Functions, zaproszeń przez własny backend ani płatnego API. Nie obiecujemy zamkniętego tworzenia Auth kont prostą listą UID w JS. Publiczny kod nie chroni sekretów ani lokalnych danych na współdzielonym urządzeniu.

Źródła oficjalne sprawdzone 2026-10-16: [blocking functions](https://firebase.google.com/docs/auth/extend-with-blocking-functions), [wymagania deploy Cloud Functions](https://firebase.google.com/docs/functions/get-started), [Rules i Auth](https://firebase.google.com/docs/firestore/security/rules-conditions#authentication). Bez zmiany planu, billingu lub ustawień konsoli.

## 8. Weryfikacja i pliki

Wszystkie konta, granty, zasoby i profile przeglądarek są syntetyczne; emulatory tylko loopback `demo-*`. Nie testowano autoryzacji na rzeczywistym Androidzie ani produkcyjnym Firestore.

- `node tools/cloud-auth-smoke.js`: **37/37 PASS** — 19 dodatkowych regresji ścisłego terminu początkowego i odnowienia (brak pola, nieskończoności, NaN, przeszłość, bieżący czas, nadmierny termin, string/null, dokładna granica 45 000/45 001 ms) oraz dotychczasowy Auth/gate, revocation, wygaśnięcie lease, błędny watcher, cache/pending/obcy dokument/dodatkowe pola i regresja starego server-marked snapshotu przy odmowie nowej transakcji. Te testy izolują odpowiedzi SDK; nie zastępują poniższych rzeczywistych testów.
- `cd tools/firebase-pilot && npm test`: **30/30 PASS**, zero SKIP, rzeczywiste Firebase SDK + Auth/Firestore emulatory. Nowe 10 testów: serwerowa zgoda Google, izolacja projektu/grantu, drugie konto/no-auth/anonymous, direct API, zakaz listowania i zmian grantów/probe, revoke i brak odżywania lease, brak/błędny dokument, offline z istniejącym cache, utrata sieci, logout/zmiana konta, proof po terminie oraz osobny profil Auth-only nieotwierający danych. Ten osobny profil dodatkowo odmawia niezatwierdzonemu Google UID (własny i cudzy probe), kontu anonymous z UID zatwierdzonego właściciela, niezalogowanemu klientowi i świeżej transakcji po `appEnabled=false`. Poprzednie 20 regresji Auth/pilota przechodzą, w tym manifest/konflikty/awarie, ochrona lokalnych danych i pełne 800 KiB/siedem fragmentów przez Rules.
- `AUTH_POPUP_TEST=1 npm run test:browser`: **9/9 PASS**, zero SKIP. Prawdziwy Chromium, przypięty Web SDK i loopback: rzeczywista strona z nowym weryfikatorem, odmowa bez grantu → administracyjny syntetyczny grant → zatwierdzenie → cofnięcie → wylogowanie, bez zmiany bajtów `fc_*`. Dotychczasowe popup/persistence/reload/UID/błędy, hash oryginalnego logo i responsywność 320/393/768/1440/niskie ekrany oraz normalny start index bez Auth nadal przechodzą. SDK Firestore dopuszczony w fixture tylko dla tej kontrolnej autoryzacji; wszelkie live Auth/data API są nadal blokowane.
- Końcowy `node tools/preflight.js`, po ostatniej asercji bezpieczeństwa: **PRE-FLIGHT PASS** (exit 0) — **537/537** JS, **121/121** smoke, **APP 110/110**, load order **323**, dependency/storage **PASS** (404 domenowe JS; 341 referencji storage / 41 plików).
- Dodatkowe `node --check` wszystkich ośmiu nowych/zmienionych JS/MJS i `git diff --check`: **PASS**. Porównanie z main potwierdza brak zmian w index, CSS, oryginalnym logo, Web configu, transporcie pilota, modułach projektu/sesji/PCV/ROZRYSU/WYCENY, lockfile i workflow. Nowy test emulatorowy jest w istniejącym `npm test`, więc obejmie go dotychczasowy zatwierdzany job CI; nie uruchamiano GitHub Actions lub deploymentu.

Początkowa diagnostyka rzeczywiście wykryła brak świeżej odmowy przy starym listen target; nie uznano jej za PASS. Usunięto nasłuch jako źródło decyzji, wymuszono świeży transakcyjny RPC i zweryfikowano odmowę po zmianie grantu. Inny przejściowy błąd emulatorowego cleanupu nie wystąpił w pełnym 30/30 po usunięciu długotrwałego nasłuchu. Timeouty testów cofnięcia uwzględniają jawny interwał 30 s, bez udawania natychmiastowej zdalnej zmiany UI. Regresje PCV (17,122 → 18,834; 5,010 → 5,511, jeden zapas 10%) i 4/3/6 arkuszy pozostają w niezmienionej paczce smoke.

Pliki: `js/app/cloud/cloud-access-verifier.js` (nowy weryfikator), `cloud-auth.js` (dostęp do tej samej instancji), `auth-access-gate.js` (ważność i cofnięcie proofu), `js/auth-test.js` i `auth-test.html` (połączenie testowe/statusy), `tools/cloud-auth-smoke.js`, `tools/firebase-pilot/{access.test.mjs,auth-browser.test.mjs,pilot.test.mjs,package.json,firestore.rules,firestore-auth-only.rules}` (rzeczywiste Rules/SDK/UI i dotychczasowy pilot), ten raport oraz krótkie wpisy stanu/kierunku. Nie zmieniono zależności ani lockfile.

Pozostają: osobna akceptacja realnego Auth-only testu i Rules/grantu, własność lokalnych danych i prawdziwy loader przed biznesem, manualny Android, nadzór limitów/podatności narzędzi i dalsze osobno zatwierdzane etapy chmury. Nie ma uploadu, migracji, importu lub synchronizacji. Nie wykonano Ready, merge ani publikacji.

## 9. Korekta fail-closed przed scaleniem

Korekta na istniejącej gałęzi po `e1f91279`, 2026-10-16. Regresja uruchomiona przed zmianą produkcyjną potwierdziła błąd: brak `validUntil` dawał `authorized`, zamiast oczekiwanego `unapproved`. Usunięto zarówno początkowe `Infinity`, jak i fallback do niego. Termin jest walidowany przed przypisaniem i uruchomieniem timera; poprawna odpowiedź zawsze ma skończony timer. Nie zmieniono weryfikatora, odświeżania co 30 s ani maksymalnego okresu 45 s. Fikcyjne pozytywne odpowiedzi w testach Auth otrzymały prawidłowy termin, aby nadal sprawdzać właściwe scenariusze UID, logout i błędnego watchera.

Zakres korekty: `js/app/cloud/auth-access-gate.js`, `tools/cloud-auth-smoke.js`, `tools/firebase-pilot/auth.test.mjs`, `tools/firebase-pilot/access.test.mjs` i ten raport. Nie zmieniono UI, HTML, konfiguracji, Google Sign-In, Rules (także plików kandydackich), danych biznesowych ani lokalnych magazynów. Testy Auth-only uruchamiają istniejący, odrębny profil Rules wyłącznie na emulatorze.

Weryfikacja po tej korekcie (nowe uruchomienia, nie odziedziczone wyniki): `cloud-auth-smoke` **37/37 PASS**, `npm test` **30/30 PASS**, `AUTH_POPUP_TEST=1 npm run test:browser` **9/9 PASS**, zero SKIP. Pełny `node tools/preflight.js`: **PRE-FLIGHT PASS**, 537/537 składni JS, 121/121 smoke, APP 110/110, load-order 323 i audyty zależności/storage PASS. `node --check` czterech zmienionych JS/MJS i `git diff --check`: PASS. Chromium i emulatory korzystały wyłącznie z syntetycznych kont/danych; nie zastępuje to ręcznej akceptacji na Androidzie. Pozostają ograniczenia opisane wyżej: brak aktywnej bramki głównej aplikacji, osobna zgoda na realne Rules/grant, ustalenie własności lokalnych danych oraz granica 30/45 s dla wykrywania zdalnego cofnięcia dostępu.
