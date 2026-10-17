# CLOUD-2B.3 — jedno logowanie przed główną aplikacją

2026-10-17. Gałąź `cloud-2b3-main-login`, baza main `154fc365` po PR #56. **Kod przygotowany do przeglądu; bez publikacji, wdrożenia Rules, grantu, uploadu lub synchronizacji.**

## Gotowość i warunek przed publikacją

Zaimplementowano właściwe wejście pod `index.html`, nie nową stronę testową. Nowy pusty profil przeglądarki po serwerowej autoryzacji uruchamia normalną aplikację. **Obecna przeglądarka z istniejącymi danymi, bez potwierdzonego lokalnego kontekstu konta, pozostanie zablokowana.** To zamierzona odmowa ochronna, a nie zgoda na reset lub automatyczne przypisanie danych. Nie należy publikować tej gałęzi użytkownikowi z takim profilem przed decyzją opisaną poniżej.

Nie wdrożono rozdzielenia każdej domeny localStorage na konta ani chmurowego autorytetu. Firebase UID nie został dopisany do projektów, cenników ani backupów.

## Jedno wejście i jeden system Auth

- `index.html` zawiera istniejący oryginalny JPG, dotychczasowy wygląd firmowego logowania i osiem skryptów powłoki Auth. Moduły biznesowe i ich CSS znajdują się w nieaktywnych `template`. Przed autoryzacją nie pobierają się ani nie wykonują `boot.js`, `app.js`, sesje lub katalogi.
- `auth-test.html` tylko przekierowuje do `index.html`; nie ma drugiego logowania. Historyczny nieużywany kontroler `js/auth-test.js` nie jest ładowany przez żadne wejście.
- `js/main-login.js` używa istniejących `cloudAuth`, `authAccessGate` i `cloudAccessVerifier`. Nie zmieniono Web configu, UID, providera Google, persistence, serwerowego proofu, interwału 30 s, limitu 45 s ani timeoutu 8 s. Zachowano nazwę instancji SDK `meble-auth-test`, aby wykorzystać istniejącą sesję bez jej kopiowania/resetu; nazwa jest historyczna.
- Serwerowa odmowa, brak dokumentu, offline lub timeout nie uruchamiają biznesu. Zalogowanie dowolnym Google nadal nie nadaje dostępu.
- Po uruchomieniu dostępne jest Wyloguj. Wylogowanie/zmiana konta/cofnięcie grantu blokują interakcje i dostęp aplikacyjny do lokalnych danych. Powrót tego samego UID po świeżym proofie może wznowić ten sam dokument i RAM; nie uruchamia ponownie biznesowych skryptów ani `init()`.

## Zachowanie istniejącego startu i recovery

`main-business-loader.js` korzysta z jedynej istniejącej listy 323 biznesowych skryptów w HTML; nie tworzy drugiego manifestu. `tools/index-load-groups.js` nadal kontroluje tę kolejność oraz osiem pozycji Auth. Pobrania mają maksymalnie osiem równoległych zadań; wykonanie następuje kolejno, po ponownym sprawdzeniu dostępu. Po utracie zgody opóźniona odpowiedź nie wykonuje kodu.

Skrypty są wykonywane jako klasyczne skrypty w tym samym dokumencie, bez bundlera, `eval`, iframes lub drugiej aplikacji. Inline element otrzymuje metadane oryginalnego URL (`data-loaded-src` oraz zgodny `getAttribute('src')` / `src`), zachowując kontrakt boot/retry i `document.currentScript`. `sourceURL` zachowuje nazwy plików w błędach.

Bramka obejmuje także późniejsze lokalne skrypty dodawane przez istniejące `appendChild`/`insertBefore`: lazy ROZRYS, retry zależności WYCENY i recovery boot. Nie modyfikuje ich kalkulatorów. Błąd pobrania usuwa tylko odtwarzalny wpis pamięciowego loadera; nie dotyka storage użytkownika. Niepowodzenie częściowego startupu wymaga nowego dokumentu, bez próby ponownego wykonania top-level `app.js`.

Ponieważ natywny DOMContentLoaded powłoki wystąpił przed załadowaniem biznesu, loader po rejestracji wszystkich modułów dokładnie raz wysyła ich barierę DOMContentLoaded. Mała zmiana `boot.js` wstrzymuje start do tej bariery i sprawdza dostęp przed init/retry. Nie rozpoczyna init, gdy lista nie jest kompletna. Samo init nadal ma istniejący `__APP_STARTED__`. Zmieniono wersję URL boot.js, aby przeglądarka nie użyła starego cache z przedwczesnym startem.

Przy pagehide zgoda jest zamykana. Pageshow z bfcache oraz powrót po offline/ukryciu dokumentu wymagają nowego proofu. Testy rozróżniają prawdziwe przejście i Wstecz w Chromium od syntetycznego PageTransitionEvent, który sprawdza konkretną gałąź obsługi zachowanego dokumentu; nie dowodzą dostępności bfcache na każdym urządzeniu.

## Lokalne dane: ochrona, nie pozorna izolacja

`local-access-profile.js` wprowadza mały lokalny **dowód dostępu do nowego profilu** `meble_access_profile_v1 = {version:1, uid}`. Nie jest to źródło danych biznesowych, token, grant serwerowy ani kopia projektu. Nie jest objęty eksportem `fc_*`. Powstaje wyłącznie po proofie i przy braku jakiegokolwiek znanego klucza biznesowego w local/sessionStorage; ma potwierdzony read-back. Właściwe wejście serializuje utworzenie/potwierdzenie dowodu przez originowy Web Lock `meble-main-access-profile-v1`, ze sprawdzeniem lease wewnątrz sekcji i ignorowaniem starej odpowiedzi po wylogowaniu/zmianie zgody i limitem oczekiwania 8 s; brak Web Locks oznacza odmowę. Dwie współpracujące karty nie mogą wybrać różnych UID dla pierwszego użycia. Nie jest to CAS localStorage, ochrona przed starszą wersją aplikacji ani mechanizm synchronizacji chmurowej. Sprawdzane są nazwy `fc_*` oraz pięć aliasów `hardwareCategories`, `hardwareSettings`, `hardwareSuppliers`, `hardwareTechnicalParams`, `hardwareTypes`. Nie odczytuje ani nie modyfikuje ich wartości.

Istniejące dane bez tego dowodu → `LOCAL_DATA_UNCLAIMED`; inny UID → `LOCAL_ACCESS_OTHER_ACCOUNT`; uszkodzony dowód → `LOCAL_ACCESS_INVALID`; niepotwierdzony zapis/odczyt → odmowa. Nie ma automatycznej naprawy, usuwania ani przejęcia. Dowód dla pustego profilu nie może być użyty do automatycznego przypisania starszych istniejących danych.

Przed pierwszym modułem biznesowym powłoka osłania metody Storage używane przez aplikację dla kluczy biznesowych. Po blokadzie odczyty, zapisy i usunięcia tymi ścieżkami są odrzucane; `clear()` i modyfikacja dowodu dostępu są zablokowane. Mechanizm sesji nadal nakłada własny tracker na te metody, z zachowaniem swoich dowodów i rollbacku. Firebase Persistence ma osobną przestrzeń i pozostaje obsługiwana wyłącznie przez SDK.

Przy utracie dostępu nie ma Save, Cancel, resetu snapshotu ani odmontowania draftu. UI (także baner boot poza body) jest ukryty i inert, przechwytywane są zdarzenia interakcji; formularz w RAM i trwały snapshot pozostają. Niezakończone kalkulacje mogą nadal kończyć pracę w RAM, ale istniejące ścieżki storage nie mogą wtedy utrwalać rezultatów. Nie deklarujemy zatrzymania całego JavaScript. Przy zablokowanej aktywnej sesji beforeunload ostrzega przed opuszczeniem dokumentu. Wymuszone zamknięcie procesu lub odrzucenie karty przez system nie gwarantuje zachowania zmian wyłącznie w RAM; nie dodano nowej trwałej kopii draftu. Weryfikacja backendu pozostaje obowiązkowa niezależnie od UI.

**Granica:** localStorage nie ma CAS między kartami ani kryptograficznej izolacji. Użytkownik z dostępem do narzędzi przeglądarki, rozszerzenie, XSS lub własny skrypt tego samego origin mogą czytać surowe lokalne bajty albo zmienić lokalny dowód. Stare otwarte karty sprzed wdrożenia również nie uzyskują tej ochrony automatycznie — przed aktywacją trzeba zamknąć stare wejścia. To nie jest serwerowy mechanizm ACL ani ochrona przed osobą kontrolującą profil przeglądarki. Do rozdzielenia takich użytkowników potrzebne są osobne profile/urządzenia oraz przyszły zatwierdzony model chmura/cache. Nie można obiecać ochrony starych danych tylko ekranem Google.

Publiczne `dev_tests.html`, `debug_price_materials.html`, `autorun_cabinet_tests.html` mają zachowaną zawartość w inert template i przekierowanie do głównej bramki. Poprzedni debug bezwarunkowo podmieniał materiały/usługi/UI w localStorage — nie może pozostać alternatywnym startem. Node/emulatorowe testy są zachowane; publiczne narzędzia developerskie nie wykonują się w przeglądarce. Przekierowania dev_app/dev_rozrys prowadzą przez to samo zamknięte wejście. Statyczne wzorce UI nie odczytują danych.

## Decyzja dotycząca obecnej przeglądarki — nie wykonano

Przed publikacją należy wybrać i osobno zatwierdzić jedno z rozwiązań:

1. **Rekomendowane dla bieżącego właściciela:** jawne, administracyjne dopuszczenie dostępu do istniejącego lokalnego profilu po sprawdzeniu rzeczywistego UID i zachowaniu kopii bezpieczeństwa. Kontrakt musi powiedzieć, że to zgoda na dostęp do zastanego profilu, a nie automatyczna własność każdego rekordu. Nie zaimplementowano automatycznego ani dostępnego klientowi bypassu. Nie wpisywać UID do repo i nie konstruować dowodu samodzielnie w konsoli bez tej decyzji.
2. Oddzielny pusty profil przeglądarki do pierwszej akceptacji rzeczywistego głównego wejścia. Dotychczasowe dane zostają na swoim miejscu; nowy profil nie otrzymuje ich automatycznie, więc nie zapewnia tych samych katalogów/wycen. Nie usuwać danych witryny ani nie używać incognito jako docelowego magazynu.
3. Odłożyć publikację do zatwierdzonego modelu własności lokalnych domen i migracji chmurowej. Przygotowany loader i Auth pozostają tym samym rozwiązaniem; nie wymaga to kolejnego ekranu lub systemu logowania.

## Dokładna procedura administracyjna przyszłej aktywacji

Nie wykonano żadnego z poniższych działań:

1. Zatwierdzić kod, testy, rollback i decyzję dotyczącą istniejącego lokalnego profilu. Bez zamknięcia tego warunku **nie publikować** logowania obecnemu użytkownikowi z nieprzypisanymi danymi.
2. W Console sprawdzić projekt `mebleszek-meble-app`, Spark bez billingu, Google Sign-In i domenę `mebleszek.github.io`. Porównać UID właściwego konta w Authentication → Users. Nie wpisywać go do repo, raportów ani testów.
3. **Nie tworzyć ponownie** istniejących dokumentów. Sprawdzić administracyjnie `/authorizedUsers/<właściwy uid>` z `appEnabled: true`, `enabled: false` i `/appAccess/<ten sam uid>` z samym `schemaVersion: 1`. Nie nadawać grantu pilota danych ani uprawnień zapisu klientowi.
4. Po osobnej zgodzie zastąpić produkcyjne deny-all dokładnie minimalnym profilem `tools/firebase-pilot/firestore-auth-only.rules`. Nie wdrażać pełnego `firestore.rules`, `firebase.json` lub pilota danych. Dozwolony jest tylko `get` własnego kontrolnego dokumentu dla tokenu Google zatwierdzonego UID. Granty, listowanie, zapisy kontrolne i wszystkie dane biznesowe pozostają zablokowane.
5. Dopiero po kolejnej świadomej zgodzie uruchomić istniejący proces Ready/CI/merge/Pages dla uzgodnionego SHA. Bez samodzielnego wdrażania w tym zadaniu. Rules i UI mają niezależne kroki; aplikacja do tego czasu nie udaje autoryzacji przy deny-all.
6. Otworzyć zwykły adres aplikacji na Android Chrome w uzgodnionym profilu. Sprawdzić jedno logowanie / odtworzenie sesji, wejście do Start, istniejący projekt, zapis/Anuluj, logout oraz odmowę drugiemu kontrolowanemu kontu. Nie tworzyć drugiej strony testowej i nie wymagać dodatkowego logowania do programu. Tablet/Windows pozostają docelowymi platformami; automatyczny Chromium nie jest testem rzeczywistego Androida/Windowsa/tabletu.
7. Cofnięcie grantu przez `appEnabled:false` blokuje nowe RPC natychmiast według Rules, UI wykrywa zmianę do 30 s lub wygasa po 45 s. Nie usuwa danych, konta, sesji edycji ani cenników.

## Cofnięcie zmiany

Przed publikacją wystarczy pozostawić/wycofać gałąź — main i produkcyjne Rules są nietknięte. Po osobno zatwierdzonej publikacji administrator może świadomie przywrócić poprzedni SHA Pages i deny-all Rules. Przywrócenie poprzedniego głównego wejścia usuwa tę bramkę UI; nie obiecuje ochrony lokalnych danych. Nie kasować `fc_*`, lokalnego dowodu profilu, SDK persistence lub administracyjnych dokumentów. W razie utraty dostępu podczas edycji najpierw odzyskać zgodę tego samego konta i zakończyć istniejącą sesję; nie wymuszać reload/Cancel.

## Testy i ograniczenia

Weryfikacja końcowa jest opisana poniżej. Wyłącznie izolowane syntetyczne profile, konta i granty emulatorowe; bez prawdziwego logowania, odczytu prywatnych danych lub działań w konsoli Firebase. Referencje PCV/4–3–6 pozostają w istniejącym Preflight. Matematyki PCV, dwóch stawek, zapasu 10%, geometrii, słojów, optymalizatora i historii ofert nie zmieniono.

Zakres plików: powłoka `index.html`, przekierowanie `auth-test.html`, trzy zamknięte wejścia diagnostyczne, `js/main-login.js`, nowe `local-access-profile.js` i `main-business-loader.js`, techniczna bariera `js/boot.js`, komentarze wspólnych modułów Auth/configu, manifest `tools/index-load-groups.js`, nowy `tools/main-login-smoke.js`, dostosowane `tools/cloud-auth-smoke.js`, `tools/boot-domcontentloaded-init-fix-smoke.js` i `tools/firebase-pilot/auth-browser.test.mjs`, ten raport oraz krótkie aktualizacje CURRENT_STATE/ROADMAP/CLOUD_MIGRATION/CLOUD_DATA_REGISTER. Bez zmian backend Rules, konfiguracji Firebase, bibliotek SDK/lockfile, workflow i modułów biznesowych.

### Końcowe wyniki dla kodu do przeglądu

- `node tools/main-login-smoke.js`: **13/13 PASS** — pusty profil, idempotencja/read-back, inny UID, wszystkie chronione aliasy, sesja/reload, korupcja, odmowa zapisu, brak odczytu wartości danych i kompletny inert manifest.
- `node tools/cloud-auth-smoke.js`: **37/37 PASS** — zachowane walidacje UID i skończonej zgody, 45 000/45 001 ms, odnowienia, serwerowy proof/cache oraz błędy Auth.
- `cd tools/firebase-pilot && npm test`: **30/30 PASS**, zero SKIP, prawdziwe Auth/Firestore emulatory + SDK, w tym Auth-only Rules, cofnięcie appEnabled, anonymous/obcy UID/direct API, prywatny grant oraz niezmienny pilot danych, konflikty i przerwane operacje.
- `AUTH_POPUP_TEST=1 npm run test:browser`: **17/17 PASS**, zero SKIP. Prawdziwy Chromium i SDK: normalne wejście, Google popup emulatora, restore/reload/logout/zmiana konta; branding 320/393/768/1440 i niskie ekrany; server-approved ale nieprzypisany profil; pełny 323-modułowy startup; sesja rzeczywistego pokoju, zmiana szafki w RAM, zachowany snapshot przy offline i wznowieniu, późniejszy zwykły Save, nowy dokument; rzeczywiste Wstecz oraz osobna symulacja pagehide/pageshow; cofnięcie grantu, timeout, przerwany startup i opóźnione lazy/recovery; brak wycieku przez baner boot; zamknięte diagnostyki; Web Lock przy równoległym pierwszym użyciu i wylogowaniu podczas oczekiwania. Konta Google są syntetyczne w emulatorze, nie kontami produkcyjnymi.
- Ostatni `node tools/preflight.js` po zmianach produkcyjnych: **PRE-FLIGHT PASS**, exit 0, **541/541** JS, **122/122** smoke, **APP 110/110**, kolejność **331** (8 Auth + 323 biznes), dependency/storage PASS (statycznie 407 domenowych JS, 342 referencje/42 pliki storage). Zachowane regresje PCV 17,122 → 18,834 oraz 5,010 → 5,511, jeden zapas 10%, referencja **4/3/6 arkuszy**, sesje/rollback/historia.
- `node --check` wszystkich zmienionych/nowych JS i MJS oraz `git diff --check`: PASS. Porównanie z bazowym main potwierdza brak zmian Rules, firebase.json, bibliotek/lockfile, workflow, transportu danych, oryginalnego JPG i wszystkich modułów projektu/sesji/PCV/ROZRYSU/WYCENY/katalogów.

Nie wykonano ręcznej akceptacji na prawdziwym Androidzie/tablecie/Windowsie, prawdziwego Google Sign-In, zmian administracyjnych lub pomiarów sieci użytkownika. Środowisko testowe nie czytało jego localStorage. Wczesne uruchomienia ujawniły nieprawidłowo przygotowany projekt fixture i brak trasy inspekcyjnej testowego serwera — poprawiono fixture przez rzeczywisty confirmed store oraz izolowany serwer, bez osłabiania asercji. Końcowy zestaw przechodzi w całości.

### Pełna lista plików tej zmiany

- `CLOUD_DATA_REGISTER.md`
- `CLOUD_MIGRATION.md`
- `CURRENT_STATE.md`
- `ROADMAP.md`
- `auth-test.html`
- `autorun_cabinet_tests.html`
- `debug_price_materials.html`
- `dev_tests.html`
- `index.html`
- `js/app/cloud/auth-access-gate.js`
- `js/app/cloud/cloud-auth.js`
- `js/app/cloud/local-access-profile.js`
- `js/app/cloud/main-business-loader.js`
- `js/auth-test-config.js`
- `js/boot.js`
- `js/main-login.js`
- `tools/boot-domcontentloaded-init-fix-smoke.js`
- `tools/cloud-auth-smoke.js`
- `tools/firebase-pilot/auth-browser.test.mjs`
- `tools/index-load-groups.js`
- `tools/main-login-smoke.js`
- `tools/reports/cloud-2b3-main-login.md`
