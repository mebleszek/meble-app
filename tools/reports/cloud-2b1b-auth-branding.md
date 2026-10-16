# CLOUD-2B.1b — oryginalny branding strony logowania

2026-10-16. Baza: `7941973b` — main po scaleniu CLOUD-2B.1a. Gałąź: `cloud-2b1b-auth-branding`. Zakres wyłącznie wizualny, bez Ready, merge lub publikacji.

## Oryginalny plik i wygląd

Użyto dokładnie załącznika użytkownika `1-12299.jpg`, skopiowanego bajt w bajt do `assets/branding/MebLeszek_logo_oryginal.jpg`. Dostępny plik ma **1280 × 1280 px**, 71 610 bajtów, zamiast podanych w opisie 1536 × 1536. Nie przeskalowano ani nie zrekonstruowano zasobu; nie generowano innego logo, WebP, SVG lub znaku CSS.

SHA-256 załącznika i lokalnego JPG jest identyczny: `d2958e9cb5fd738352418d6d03bf6d4d086cb8a000fd97f92420db4590716836`.

`auth-test.html` pokazuje cały kwadratowy JPG przez lokalny `img`, z proporcjami 1:1 i `object-fit:contain`. Jawne width/height rezerwują miejsce przed pobraniem; `fetchpriority=high` daje priorytet centralnej grafice. Nie ma przycinania ani filtrów koloru logo. Bardzo ciemne tło i miękki cień wewnętrzny wyłącznie na zewnętrznym marginesie fotografii łagodzą jej granice, zachowując znak, litery, fakturę i kolory. Kontrolki zajmują pusty dolny obszar kwadratowego tła, poniżej całego znaku i hasła, bez usuwania pikseli pliku.

Usunięto zastępczy monogram, widoczne powtórzenie nazwy, hasła i dodatkowy slogan oraz dużą ramkę karty. Nagłówek pozostał dostępny dla czytników ekranu. Pod grafiką jest istniejący przycisk Google, a dalej status, błędy, UID, wylogowanie i informacja o niewczytywaniu danych. Zachowano dotykowe cele min. 48 px, fokus klawiatury, ARIA i naturalne przewijanie. Nie dodano animacji, fontów zewnętrznych, bibliotek ani nowych kontrolek. Zmieniono wersję URL wyłącznie CSS, aby dotychczasowy cache stylu nie przesłonił zmiany.

## Ochrona funkcjonalności

Wszystkie identyfikatory kontrolek i skrypty pozostają takie same. Nie zmieniono `index.html`, `js/auth-test-config.js`, `js/auth-test.js`, modułów Auth/bramki/transportu, Rules ani żadnego modułu biznesowego. Logowanie nie daje uprawnień biznesowych. Testy korzystają z izolowanych profili i syntetycznych kont emulatora; nie logowano prawdziwego konta Google, nie czytano danych użytkownika i nie wysyłano niczego do produkcyjnej bazy.

## Testy

Nowa regresja w istniejącym `auth-browser.test.mjs` kontroluje oryginalny hash JPG, poprawny odczyt obrazu, naturalne wymiary, pełne proporcje, brak zastępczego logo i przesunięcia po opóźnionym pobraniu obrazu. Sprawdza **320 × 640, 393 × 852, 768 × 1024, 1440 × 900**, a także niskie **393 × 360 i 1440 × 480**. Weryfikuje brak poziomego przewijania, dostępność przycisku/statusu/noty po przewinięciu i fokus. Serwer testowy podaje JPG z właściwym MIME.

- `node tools/cloud-auth-smoke.js`: **13/13 PASS**.
- `AUTH_POPUP_TEST=1 npm run test:browser`: **8/8 PASS**, zero FAIL/SKIP, po końcowej kontroli wyglądu. Obejmuje nową regresję logo i układu oraz dotychczasowy rzeczywisty browser SDK, popup emulatora, zamknięcie/blokadę popupu, odtworzenie UID/persistence po reload/nowej karcie, wylogowanie, błędy, brak dostępu biznesowego i niezmieniony start `index.html`.
- Pełny `node tools/preflight.js`: **PRE-FLIGHT PASS** (exit 0), składnia **536/536**, smoke **121/121**, APP **110/110**, load order **323**, audyt zależności/storage **PASS** (341 referencji / 41 plików). Nie zmieniono asercji ani wyników PCV/rozkroju i pozostałych istniejących regresji.
- `node --check tools/firebase-pilot/auth-browser.test.mjs` i `git diff --check`: **PASS**.

Test przeglądarkowy zapisuje zrzuty `/tmp/cloud-2b1b-auth-{320,393,768,1440}.png` poza repozytorium. Są obrazem rzeczywistego renderowania Chromium z syntetycznym kontekstem emulatora, nie testem fizycznego Androida/tabletu/Windowsa. Mobilny i desktopowy zrzut podlegają przeglądowi wizualnemu; gust i akceptacja na rzeczywistym telefonie pozostają po stronie użytkownika.

## Zmienione pliki i wycofanie

- `assets/branding/MebLeszek_logo_oryginal.jpg` — niezmieniony oryginalny zasób użytkownika.
- `auth-test.html` — obraz, hierarchia i kontener istniejących kontrolek, wersja CSS.
- `css/auth-test.css` — wyłącznie styl strony testowej.
- `tools/firebase-pilot/auth-browser.test.mjs` — regresja renderowania i lokalne zrzuty.
- Ten raport — zakres, dowód pochodzenia i wyniki.

Wycofanie polega na odwróceniu tej wizualnej zmiany osobnym zatwierdzonym commitem. Nie wymaga zmiany configu Auth, sesji ani jakichkolwiek danych. Nie aktywowano obowiązkowego logowania i nie zmieniono wcześniejszych ograniczeń autoryzacji.
