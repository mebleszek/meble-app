# CLOUD-2B.3 — jedno logowanie przed główną aplikacją

2026-10-17. Gałąź `cloud-2b3-main-login`, baza main `154fc365` po PR #56. **Kod przygotowany do przeglądu; bez publikacji, wdrożenia Rules, grantu, uploadu lub synchronizacji.**

## Gotowość i warunek przed publikacją

Zaimplementowano właściwe wejście pod `index.html`, nie nową stronę testową. Nowy pusty profil przeglądarki po serwerowej autoryzacji uruchamia normalną aplikację. **Właściciel zatwierdził dopuszczenie swojego istniejącego profilu, bez resetu i zmiany rekordów.** Gałąź udostępnia jednorazowe potwierdzenie kopii oraz świadomej zgody dopiero po autoryzacji serwerowej. Brak potwierdzenia nadal blokuje biznes. Przed publikacją trzeba zachować kopię według procedury poniżej; sam login Google nie wystarcza.

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

`local-access-profile.js` zarządza lokalnym **dowodem dostępu do profilu** `meble_access_profile_v1 = {version:1, uid}`. Nie jest to źródło danych biznesowych, token, grant serwerowy ani kopia projektu. Pusty profil nadal otrzymuje go po proofie przez `confirm()`. Istniejące dane nigdy nie są automatycznie dopuszczane tą metodą.

Po `LOCAL_DATA_UNCLAIMED` główne wejście pokazuje sekcję dopuszczenia, z niezmienionym logo i bez ładowania biznesu. Wymaga dwóch osobnych, początkowo niezaznaczonych potwierdzeń: wykonanej/sprawdzonej/zachowanej kopii oraz wyłącznego użytkowania profilu i świadomego dostępu. To oświadczenie właściciela, nie dowód technicznego sprawdzenia jego pliku. Anuluj nie zapisuje znacznika i nie wywołuje sesyjnego Cancel.

`prepareAdmission(uid)` tworzy nieprzenośny, nieujawniający danych ticket; tymczasowo zapamiętuje dokładne klucze/wartości `fc_*` oraz pięciu aliasów w local/sessionStorage. `admitExisting(uid,ticket,{backupConfirmed:true,ownerConfirmed:true})` odmawia niepełnej zgody, obcego ticketu/UID, zmiany danych lub uszkodzonego dowodu. Nie naprawia ani nie normalizuje źródła. Dowód jest jedynym zapisem; read-back oraz końcowe porównanie danych są obowiązkowe. Wartości nie trafiają do logów, grantu, Firebase ani dowodu; ticket jest tylko pamięciowym warunkiem operacji, nie drugim magazynem projektu.

Przycisk potwierdzenia uruchamia **nową instancję tej samej `authAccessGate`** z istniejącym serwerowym weryfikatorem. Stary proof nie wystarcza. Jednorazowa intencja jest związana z UID oraz epoką Auth; wspólna walidacja nadal wymaga skończonego lease maksymalnie 45 s. Dopiero świeży grant pozwala wykonać dopuszczenie wewnątrz originowego Web Lock `meble-main-access-profile-v1` (limit oczekiwania 8 s), z ponownym `grant.assert()` i kontrolą tożsamości. Następnie startuje istniejący loader. Wylogowanie/zmiana konta/offline/cofnięcie grantu kasują formularz zgody i unieważniają oczekujący dostęp. Błąd ani niedokończona weryfikacja nie uruchamiają biznesu.

Współpracujące karty nie mogą nadpisać wyboru UID. Dwie zgodne zgody tego samego UID są idempotentne, o ile zastane dane nie zmieniły się. Inny UID → `LOCAL_ACCESS_OTHER_ACCOUNT`; korupcja → `LOCAL_ACCESS_INVALID`; zmiana danych → `LOCAL_ACCESS_DATA_CHANGED`; brak wymaganych potwierdzeń → `LOCAL_ACCESS_CONSENT_REQUIRED`; błędny zapis/read-back → `LOCAL_ACCESS_UNCONFIRMED`. Po zapisie z utraconym potwierdzeniem nie ma sukcesu w danym uruchomieniu, kompensacyjnego usuwania lub przepisywania danych. Jeżeli właściwy dowód faktycznie pozostał na dysku, późniejszy świeży proof i poprawny read-back mogą go potwierdzić, bez ponownego zapisu lub zmiany UID.

Nie jest to CAS localStorage, ochrona przed starszą wersją aplikacji ani synchronizacja chmurowa. Przed wdrożeniem zamknąć inne karty Meble-App; starsza karta nie respektuje nowego Web Lock. Dotychczasowy kontrakt i format dowodu pozostają zgodne, bez dopisywania UID do rekordów biznesowych.

Przed pierwszym modułem biznesowym powłoka osłania metody Storage używane przez aplikację dla kluczy biznesowych. Po blokadzie odczyty, zapisy i usunięcia tymi ścieżkami są odrzucane; `clear()` i modyfikacja dowodu dostępu są zablokowane. Mechanizm sesji nadal nakłada własny tracker na te metody, z zachowaniem swoich dowodów i rollbacku. Firebase Persistence ma osobną przestrzeń i pozostaje obsługiwana wyłącznie przez SDK.

Przy utracie dostępu nie ma Save, Cancel, resetu snapshotu ani odmontowania draftu. UI (także baner boot poza body) jest ukryty i inert, przechwytywane są zdarzenia interakcji; formularz w RAM i trwały snapshot pozostają. Niezakończone kalkulacje mogą nadal kończyć pracę w RAM, ale istniejące ścieżki storage nie mogą wtedy utrwalać rezultatów. Nie deklarujemy zatrzymania całego JavaScript. Przy zablokowanej aktywnej sesji beforeunload ostrzega przed opuszczeniem dokumentu. Wymuszone zamknięcie procesu lub odrzucenie karty przez system nie gwarantuje zachowania zmian wyłącznie w RAM; nie dodano nowej trwałej kopii draftu. Weryfikacja backendu pozostaje obowiązkowa niezależnie od UI.

**Granica:** localStorage nie ma CAS między kartami ani kryptograficznej izolacji. Użytkownik z dostępem do narzędzi przeglądarki, rozszerzenie, XSS lub własny skrypt tego samego origin mogą czytać surowe lokalne bajty albo zmienić lokalny dowód. Stare otwarte karty sprzed wdrożenia również nie uzyskują tej ochrony automatycznie — przed aktywacją trzeba zamknąć stare wejścia. To nie jest serwerowy mechanizm ACL ani ochrona przed osobą kontrolującą profil przeglądarki. Do rozdzielenia takich użytkowników potrzebne są osobne profile/urządzenia oraz przyszły zatwierdzony model chmura/cache. Nie można obiecać ochrony starych danych tylko ekranem Google.

Publiczne `dev_tests.html`, `debug_price_materials.html`, `autorun_cabinet_tests.html` mają zachowaną zawartość w inert template i przekierowanie do głównej bramki. Poprzedni debug bezwarunkowo podmieniał materiały/usługi/UI w localStorage — nie może pozostać alternatywnym startem. Node/emulatorowe testy są zachowane; publiczne narzędzia developerskie nie wykonują się w przeglądarce. Przekierowania dev_app/dev_rozrys prowadzą przez to samo zamknięte wejście. Statyczne wzorce UI nie odczytują danych.

## Zatwierdzona decyzja właściciela i kopia przed publikacją

Użytkownik potwierdził, że jest jedyną osobą używającą obecnego profilu i wszystkie dane należą do niego. Zgoda obejmuje **dostęp do tego profilu** po autoryzacji, nie migrację, zmianę własności każdego rekordu ani przesłanie danych. Jednorazowy ekran realizuje tę decyzję osobno od Google Sign-In. Nie trzeba wpisywać UID do kodu lub konstruować lokalnego dowodu w konsoli.

**Bezpieczna kolejność dla właściciela: kopia → Firebase → dopuszczenie → normalna praca.**

1. **Przed publikacją, w obecnej działającej Meble-App**, zachować bieżące formularze. Jeśli edycja może zostać świadomie zakończona, wykonać właściwe Zapisz albo Anuluj — nigdy automatyczne Cancel. Nie odświeżać formularza zawierającego jedyne niezapisane zmiany. Zamknąć pozostałe karty tej samej aplikacji po zabezpieczeniu ich edycji.
2. Na Start otworzyć **Ustawienia danych → Backup i dane → Eksportuj wszystkie dane**. To istniejący `dataSettingsBackupActions` → `dataBackupStore.exportCurrent()`, bez nowego eksportera, importu, restore lub sprzątania. Zapisać `meble-app-export-*.json` w Pobrane/Files poza pamięcią witryny i zachować drugą prywatną kopię, jeśli możliwe.
3. Otworzyć pobrany plik jako tekst/JSON, bez importowania do aplikacji. Sprawdzić, że plik nie jest pusty, ma `kind: "meble-app-data-export"`, `version:1`, `snapshot.keys`, oraz potrzebne zapisane cenniki/katalogi, projekty i oferty (nazwy kluczy według [BACKUP.md](../../BACKUP.md)). Nie wystarczy backup zapisany tylko w localStorage. Nie wysyłać pliku do GitHuba, Firebase lub czatu: może zawierać dane klientów i sekret ORS. Ekran dopuszczenia nie twierdzi, że odczytał/zweryfikował ten prywatny plik.
4. **Granice starego backupu pozostają jawne:** pomija pięć aliasów bez `fc_`, aktywną sesję i sessionStorage, magazyn backupów oraz kopie ratunkowe/cache wykluczone istniejącą polityką. Nie stanowi więc pełnej kopii bajtowej przeglądarki ani RAM. Ten PR zachowuje je w źródle bez zmian i nie dodaje nowego backupu. Jeżeli wartościowe dane istnieją wyłącznie w pominiętej domenie albo nie uda się potwierdzić potrzebnej kopii, **nie publikować / nie potwierdzać dopuszczenia**; zachować obecną aplikację i osobno ustalić zabezpieczenie takiej domeny. Nie testować odtwarzania przez Import na oryginalnym profilu. Aktywna trwała sesja nie jest przeszkodą dla samego dopuszczenia, ale nie należy nazywać jej objętą plikiem backupu.
5. Po zatwierdzeniu kodu i minimalnych Rules zgodnie z procedurą administracyjną otworzyć zwykły adres w **tym samym profilu** Android Chrome. Google odtwarza sesję lub wymaga logowania. Zatwierdzone konto musi otrzymać świeży proof z serwera; brak sieci/deny-all/obcy UID nie pokazują zgody na przejęcie danych.
6. W jednorazowej sekcji przeczytać zakres, potwierdzić zachowaną kopię oraz wyłączne użytkowanie/własne dane, nacisnąć **Dopuść ten profil**. Można wybrać **Anuluj** — nie zmienia to danych ani sesji. Następuje nowa weryfikacja serwerowa, kontrola danych i zapis tylko lokalnego dowodu. Przy odmowie nie usuwać dowodu/storage i nie wklejać obejścia w konsoli.
7. Po sukcesie uruchamia się normalna Meble-App. Sprawdzić istniejące cenniki, katalogi i projekt. Przy następnym wejściu poprawny dowód tego samego UID i świeża autoryzacja wystarczają; nie ma powtórnej zgody. Trwała sesja pokoju pozostaje obsługiwana dotychczasowym mechanizmem, bez automatycznego Save/Cancel przy dopuszczeniu.

## Dokładna procedura administracyjna przyszłej aktywacji

Nie wykonano żadnego z poniższych działań:

1. Zatwierdzić kod, testy, rollback i wykonaną kopię według powyższej procedury. Decyzja właściciela o dostępie jest zatwierdzona; jej jednorazowe wykonanie wymaga nadal jego osobistego potwierdzenia po logowaniu. Bez potrzebnej kopii **nie publikować** logowania obecnemu użytkownikowi.
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

### Wyniki bazowe commita e0bfb618 (przed uzupełnieniem dopuszczenia)

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

## Uzupełnienie CLOUD-2B.3 — wyniki dopuszczenia istniejącego profilu

Zakres tej korekty: `local-access-profile.js`, `main-login.js`, sekcja potwierdzenia w `index.html` i jej małe style, testy `main-login-smoke.js` / `auth-browser.test.mjs`, ten raport oraz odsyłacze/statusy w CURRENT_STATE, ROADMAP, CLOUD_MIGRATION i CLOUD_DATA_REGISTER. Bez zmian Rules, Auth SDK/config, grantu, loadera/boot, domen biznesowych, backupu lub logo. Dopuszczenie nie wykonuje normalizacji, Save, Cancel lub recovery; po nim normalny startup zachowuje swoje istniejące działanie. Test rozróżnia operację dopuszczenia (wszystkie bajty bez zmian) od późniejszego zwykłego startu, który nadal może aktualizować swój techniczny UI/cache.

Wyniki końcowe tej korekty (wyłącznie syntetyczne dane, prawdziwy Chromium/SDK i izolowane emulatory):

- `node tools/main-login-smoke.js`: **20/20 PASS**. Wymagane obie zgody; nieprzenośny ticket i UID; wszystkie aliasy; dokładne bajty danych i sesji; read-back; błędy/utrata potwierdzenia; konkurencyjna zmiana przed i w trakcie zapisu, bez destrukcyjnej kompensacji; idempotencja oraz odmowa obcemu UID. Wycofanie wydania nie wymaga zmiany danych — nowy dowód jest odrębnym kluczem.
- `node tools/cloud-auth-smoke.js`: **37/37 PASS**. Wspólna bramka, świeży serwerowy proof, skończony lease, brak zgody Google-only i odrzucenie starej tożsamości pozostają niezmienione.
- `cd tools/firebase-pilot && npm test`: **30/30 PASS, zero SKIP**, rzeczywiste Auth/Firestore Emulator Suite i Rules. Zatwierdzony Google / obcy UID / anonymous / wylogowanie, zakaz samodzielnego nadania uprawnień, cofnięcie `appEnabled`, offline/cache, bezpośrednie API, izolacja i dotychczasowy pilot konfliktów pozostają bez regresji.
- `AUTH_POPUP_TEST=1 npm run test:browser`: **22/22 PASS, zero SKIP**. Zachowane 17 regresji bazowych oraz pięć nowych scenariuszy z podprzypadkami: brak kopii/zgody, Anuluj, offline i cofnięcie grantu przed kliknięciem; natywny profil z rzeczywistym confirmed save i aktywną trwałą sesją pokoju; obecny eksporter i pobrany plik; dopuszczenie i restart bez ponownej zgody, drugi zatwierdzony UID; cztery warianty konfliktu/korupcji/awarii lub częściowego zapisu; Web Lock między kartami; wylogowanie w trakcie oczekiwania na lock. Sekcja dopuszczenia kontrolowana na szerokościach 320/393/768/1440 oraz małej wysokości; zrzut telefonu `/tmp/cloud-2b3-profile-admission-phone.png` z emulowanego widoku, nie prawdziwego urządzenia.
- Końcowy `node tools/preflight.js`: **PRE-FLIGHT PASS**, exit 0, **541/541 JS**, **122/122 smoke**, **APP 110/110**, kolejność **331** (8 + 323), dependency/storage PASS (407 domenowych JS, 342 referencje w 42 plikach). Zachowane PCV 17,122 → 18,834 i 5,010 → 5,511, jeden zapas 10% oraz **4/3/6 arkuszy**. Preflight ponowiono po ostatniej kontroli lease w sekcji Web Lock i dodaniu końcowej regresji konkurencyjnej zmiany.
- `node --check` zmienionych JS/MJS i `git diff --check`: PASS. Porównanie z `e0bfb618` potwierdza brak zmian Rules, configu, SDK, loadera/boot, logo oraz wszystkich domen biznesowych i backupu.

Pierwszy pełny Chromium miał **20/21 PASS**: nowy fixture umieszczał szafkę przez niski store z nieodświeżonym `cabinetCount=0`. Nie zawiodła kontrola bajtów przy dopuszczeniu; zwykły startup przeliczył licznik i `updatedAt`. Fixture poprawiono przez rzeczywisty `project.saveConfirmed()`, bez zmiany produkcyjnego zapisu. Oddzielna celowana regresja natywnego profilu przeszła **1/1**, a końcowy pełny zestaw **22/22**. Test po zwykłym starcie wymaga identycznych danych projektu i liczników, dopuszczając wyłącznie istniejącą aktualizację `updatedAt` (sprawdza jej typ i monotoniczność). Snapshot aktywnej sesji i chronione katalogi/cenniki/oferty są nadal porównywane dokładnie. Kontrola przed wykonaniem pierwszego biznesowego skryptu wymaga identyczności **wszystkich** `fc_*` bajt w bajt; test jednostkowy obejmuje także wszystkie pięć aliasów i sessionStorage. Nie osłabiono kontroli dopuszczenia, aby ukryć zwykły startup autosave.

Dokładna lista **11 plików zmienionych względem e0bfb618**:

| Plik | Zmiana |
|---|---|
| `js/app/cloud/local-access-profile.js` | Ticket, jawne zgody, porównanie danych i potwierdzony zapis tylko dowodu. |
| `js/main-login.js` | Sekcja dopuszczenia, świeży proof wspólnej bramki, intencja UID/epoch, Web Lock i odrzucenie starego kontekstu. |
| `index.html` | Jednorazowa sekcja w istniejącym głównym logowaniu oraz wersje URL zmienionych zasobów. |
| `css/auth-test.css` | Minimalne style wyłącznie tej sekcji. |
| `tools/main-login-smoke.js` | Regresje lokalnego dowodu, zgód, byte preservation i awarii. |
| `tools/firebase-pilot/auth-browser.test.mjs` | Rzeczywisty przepływ dopuszczenia oraz zachowane bazowe testy startup/Auth. |
| `CLOUD_DATA_REGISTER.md` | Aktualny kontrakt istniejącego klucza dostępu, bez nowego storage. |
| `CLOUD_MIGRATION.md` | Zatwierdzona decyzja właściciela i warunki wydania. |
| `CURRENT_STATE.md` | Aktualny status przygotowania, bez deklaracji publikacji. |
| `ROADMAP.md` | Rozstrzygnięcie dotychczasowej blokady własności profilu. |
| `tools/reports/cloud-2b3-main-login.md` | Procedura kopii/dopuszczenia, dowody testowe, ograniczenia i rollback. |

**Warunki przed publikacją:** audyt i akceptacja tej korekty, zachowana/sprawdzona kopia właściciela obejmująca potrzebne trwałe dane, osobna zgoda na minimalne Auth-only Rules i wydanie konkretnego SHA. Przy obecnych produkcyjnych deny-all weryfikacja nadal odmawia — nie obchodzimy tego w kliencie. Po uzgodnionym wdrożeniu pozostaje ręczna akceptacja Android. Ograniczenie współdzielonego localStorage nie zostało usunięte: receipt można zmienić przez DevTools/XSS; inne osoby powinny używać oddzielnego profilu systemowego/przeglądarki. Zgoda jedynego właściciela rozstrzyga bieżący przypadek, nie tworzy wieloużytkownikowego ACL na lokalnych plikach.

**Rollback dopuszczenia:** cofnięcie wydania nie wymaga cofania lub importowania danych. Stara wersja nie używa nowego klucza i zastaje te same dane biznesowe; dowodu nie usuwać. Powrót do deny-all blokuje bramkę, ale nie zmienia danych. Nie wymuszać odświeżenia podczas niezapisanej edycji. Pełne testowe potwierdzenie braku zapisów/removes dotyczy operacji dopuszczenia, nie bezwarunkowego uruchamiania dowolnej starszej wersji programu.
