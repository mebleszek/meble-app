# CLOUD-2B.1a — publiczny config kontrolowanego Google Sign-In

2026-10-16. Baza: main `bf81b14c` po PR #53; gałąź `cloud-2b1a-live-auth-config`. Raport CLOUD-2B.1 zachowuje historyczny stan bez publicznego configu. Ta zmiana przygotowuje test; nie wykonuje Ready, merge ani publikacji.

## Zakres i zgodność

`js/auth-test-config.js` ustawia `FC_AUTH_TEST_OPTIONS.target='live-auth'` i dokładnie cztery publiczne pola przekazane przez użytkownika: `apiKey`, `authDomain`, `projectId`, `appId`. Projekt `mebleszek-meble-app`, domena `mebleszek-meble-app.firebaseapp.com` i Web app ID odpowiadają istniejącemu kontraktowi `FC.cloudAuth.configOf()`. Nie dodano tokenów, kont administracyjnych ani nowych mechanizmów logowania. Walidacja lokalna nie potwierdza jeszcze akceptacji klucza i konfiguracji OAuth przez rzeczywiste serwery Google.

W `auth-test.html` zmieniono wersję URL skryptu configu na `20261016_auth1a`, aby wcześniejsze cache z `null` nie przeszkadzało w teście. Moduły Auth, interfejs, style i normalny `index.html` pozostają bez zmian. Config sam tylko definiuje obiekt; inicjalizuje go istniejący kontroler strony testowej. Żaden inny aktualny punkt wejścia nie ładuje tego configu.

Strona korzysta wyłącznie z przypiętych Firebase Web SDK app/auth 12.19.0, nazwanej instancji `meble-auth-test`, `signInWithPopup` wywoływanego w stosie kliknięcia oraz persistence SDK IndexedDB → browser local. Aplikacja nie zapisuje własnych tokenów. Zwykły start Meble-App nie inicjuje tego Auth. Emulatorowa blokada transportu Firestore live nie została zmieniona. Nie dotykano produkcyjnych Rules; pozostają deny-all zgodnie z potwierdzeniem użytkownika.

Logowanie Google oznacza tylko uwierzytelnienie. Bez weryfikatora serwerowego strona pokazuje „Dostęp do aplikacji nie został jeszcze zatwierdzony”. Nie ładuje projektów, katalogów, cenników ani innych modułów biznesowych. Nie wykonuje uploadu, odczytów biznesowych lub migracji. Istniejący `index.html` nadal działa lokalnie; ekran testowy nie stanowi jego zabezpieczenia.

## Test Android Chrome — do wykonania przez użytkownika po zatwierdzonym wdrożeniu

1. Po osobno zatwierdzonym merge i udanym Pages otworzyć **https://mebleszek.github.io/meble-app/auth-test.html** bezpośrednio w zwykłym Android Chrome (nie webview komunikatora ani tryb incognito). Nie aktywować testu w projekcie biznesowym. Strona jest statycznym plikiem w katalogu głównym, więc pod tym adresem będzie dostępna po wdrożeniu; ta gałąź nie została opublikowana.
2. Poczekać na „Zaloguj się, aby rozpocząć” i aktywny „Zaloguj przez Google”. Przy `auth/unauthorized-domain` sprawdzić w Firebase Authentication → Settings → Authorized domains wpis `mebleszek.github.io`; przy błędzie configu porównać cztery pola z właściwą aplikacją Web w Console. Nie otwierać Firestore Rules.
3. Dotknąć przycisku i wybrać konto Google. Oczekiwany wynik: zalogowano, dostęp do aplikacji niezatwierdzony. „Pokaż Firebase UID” powinien pokazać UID zgodny z Authentication → Users; nie przesyłać tokenów, UID ani danych konta do repozytorium. Powstanie konta Auth jest oczekiwanym skutkiem pierwszego rzeczywistego logowania.
4. Odświeżyć stronę: sesja ma odtworzyć się bez popupu. Następnie zamknąć kartę i Chrome, ponownie otworzyć Chrome oraz ten sam adres. Oczekiwać tego samego zalogowanego UID bez kolejnego kliknięcia, jeśli przeglądarka nie usunęła pamięci witryny. Pełne zamknięcie aplikacji Chrome wymaga ręcznego testu; symulacja mobilnego viewportu ani nowa karta nie są jego dowodem.
5. Nacisnąć „Wyloguj”: wraca przycisk logowania, UID znika. Po odświeżeniu nadal brak sesji. Ponowić login i sprawdzić inne konto, jeśli potrzebne; żadne konto nie otrzymuje dostępu biznesowego.
6. Wylogować się, rozpocząć nowy login i zamknąć okno Google: oczekiwać czytelnego błędu i możliwości ponowienia. Jeśli popup jest zablokowany, zezwolić na niego dla tej witryny. Nie włączać redirect ani osłabiać ustawień dla całej przeglądarki jako poprawki w kodzie.
7. Bez aktywnej sesji sprawdzić brak sieci, a potem jej przywrócenie i ponowienie. Oczekiwać błędu zamiast dostępu biznesowego. Sprawdzić, że zwykły `index.html` nadal otwiera się jak wcześniej, z niezmienionymi danymi.

## Publiczna dostępność i wyłączenie

Po publikacji każdy znający URL może próbować logowania Google, co może tworzyć dodatkowe konta Firebase Authentication i zużywać limity usługi. Nie jest to autoryzacja do danych Meble-App. Nie dodano publicznej listy dozwolonych UID ani automatycznego grantu. W Console można kontrolować listę kont; zadanie nie tworzy ani nie usuwa kont rzeczywistych.

Wyłączenie nowych inicjalizacji: w osobnej zatwierdzonej zmianie ustawić `window.FC_AUTH_TEST_OPTIONS = null` i ponownie zmienić wersję URL tego skryptu w `auth-test.html`, następnie wdrożyć. Nie usuwać `fc_*`, projektów ani sesji biznesowych. Samo `null` nie unieważnia sesji Firebase już zapisanej przez SDK ani otwartej wcześniej karty. Przed wyłączeniem można użyć istniejącego „Wyloguj”. Gdy trzeba natychmiast zablokować nowe logowania również ze starych kart/cache, użytkownik może świadomie wyłączyć providera Google w Firebase Console; dotyczy to całego projektu Auth i nie unieważnia automatycznie wydanych tokenów. Nie zmienia to deny-all Rules ani lokalnych danych biznesowych.

## Weryfikacja

- `node tools/cloud-auth-smoke.js`: **13/13 PASS**, w tym dokładny publiczny config, zgodność z `configOf()`, wyłącznie loader Auth, brak dostępu biznesowego oraz dotychczasowe błędy/retry/persistence/bramka.
- `cd tools/firebase-pilot && npm test`: **20/20 PASS**, zero SKIP. Rzeczywisty SDK/Auth/Firestore Emulator Suite na `demo-meble-app`, bez dostępu do produkcji i zmian Rules.
- `AUTH_POPUP_TEST=1 npm run test:browser`: **7/7 PASS**, zero SKIP. Rzeczywisty Chromium, przypięty browser SDK i emulator: nowy config live inicjuje Auth; Google popup emulatora, zamknięcie/blokada popupu, UID, IndexedDB persistence, reload, nowa karta, logout, błąd helpera, viewporty 320/768/1440, brak biznesu/Firestore oraz zwykły start `index.html`. Syntetyczne dane `fc_*` pozostają identyczne. Helper Google jest już osiągalny w tym środowisku; poprzedni bloker sieci z raportu CLOUD-2B.1 nie wystąpił. Negatywny test niedostępnego helpera jawnie go blokuje, niezależnie od opcji pełnych popupów.
- Pełny `node tools/preflight.js`: **PRE-FLIGHT PASS** (exit 0), **536/536** składni JS, **121/121** smoke, **APP 110/110**, load order **323**, audyt zależności i storage **PASS** (341 referencji / 41 plików). Dotychczasowe regresje PCV i rozkroju w tej paczce przeszły bez zmiany kodu lub oczekiwań.
- `node --check` wszystkich trzech zmienionych JS/MJS oraz `git diff --check`: **PASS**.

Testy używają wyłącznie izolowanych profili i syntetycznych danych. Test configu live inicjuje rzeczywisty browser SDK w pustym profilu, blokując zewnętrzne Auth/data API: nie loguje konta, nie tworzy go i nie potwierdza rzeczywistego OAuth. Popup loguje wyłącznie syntetyczne konto lokalnego emulatora, a nie konto Google w produkcji. Nie użyto rzeczywistej przeglądarki ani danych użytkownika. Przygotowanie środowiska: frozen `npm ci`, Node 22.23.3, Java 21, istniejący Chromium; bez zmiany lockfile, zależności, CI lub modułów Auth.

Ręcznie pozostają do potwierdzenia: rzeczywisty Google popup na Androidzie z GitHub Pages, poprawność konfiguracji po stronie Google/Firebase, zachowanie polityk popupów/cookies i persistence po pełnym zamknięciu Chrome. Nie wdrożono obowiązkowej bramki, uprawnień serwerowych ani synchronizacji. Nie zmieniono stawek, PCV, geometrii, rozkroju, historii ofert, globalnych danych lub backupów.
