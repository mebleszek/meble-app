# WYCENA — wydajność i odnawianie dostępu, 2026-10-19

Baza: dokładny GitHub main `764d0852b7232b28e6920a36ca26d50ec5e1a3e3`,
drzewo `7691cdfdcaec339f7b85a63a41529cc39dad807e`, po PR #65 i #66.
Gałąź `fix/quote-performance-auth-renewal`. Osobny checkout; stare katalogi napraw pozostawiono.
To pakiet roboczy, bez PR, wydaniowego CI, merge, Pages i Firebase LIVE.

## Potwierdzone przyczyny i zmiany

1. `wycena-tab-shell.generateQuote` dwa razy wykonywał pełne `collectQuoteData`,
   choć pomiędzy nimi zmieniała się jedynie nazwa oferty. Powtarzał fakty, formatki,
   plany materiałów, PCV i robociznę. Teraz jedna operacja przechowuje swój wynik w RAM;
   oryginalny builder nadal buduje oba snapshoty i metadane. Wyłącznie nazwa i techniczny
   `updatedAt` draftu nie unieważniają matematyki. Rabat, warunki handlowe, dane RAW,
   katalogi runtime, geometria, kontrolki optymalizatora i inne wejścia wymagają nowego
   obliczenia albo odmowy. Powtórzenie przy zmianie wejść podczas inicjalizacji jest ograniczone.
   Duplikaty, nazewnictwo, anulowanie i niezależny wariant zachowują swój kontrakt.
2. Każdy adres PCV ponownie normalizował i porównywał ten sam cały pokój/projekt oraz
   generował cutlistę tej samej szafki. `project-pcv-overrides.withCalculationRead` współdzieli
   te odczyty wyłącznie wewnątrz jednego synchronicznego collect/validatePlanParts resolvera.
   Sprawdza świadek przed/po i tożsamość RAM, czyści stan w `finally`, odmawia Promise.
   Każdy adres nadal przechodzi kontrolę właściciela, roli, pochodzenia, krawędzi i geometrii.
   Reentrant zmiana RAM, rewizji, materiałów lub konfiguracji = odmowa. Brak współdzielenia
   między await, osobnymi wywołaniami i zapisami. Zwykły cache planu nadal jest pomijany
   w projektowym PCV. Nie zmieniono `cut-optimizer.js` ani matematyki pakowania.
3. Po przyspieszeniu rzeczywisty mobilny gest ujawnił starą, nieograniczoną flagę
   `swallowNextClickGlobal`: brak syntetycznego click po preventDefault potrafił pochłonąć
   pierwszy nowy tap potwierdzenia nazwy. `bindings.js` rozpoczyna nowy fizyczny gest na
   pointerdown; nadal blokuje click-through tego samego gestu i podwójne uruchomienie.
4. Główny wątek zablokowany przez co najmniej 45 s opóźnia timer odnowienia i wygaśnięcia.
   Sam dowód wygasa według rzeczywistego czasu, więc zapis jest odmawiany już przed timerem.
   Opóźniony lazy loader ROZRYSU po takiej odmowie nadpisywał komunikat gate ogólnym
   `AUTH_STARTUP_FAILED`. Reprodukcja ze śladem stosu wskazała `main-business-loader.code`
   → `main-login.assert` → `failure`. Po uruchomieniu aplikacji wtórna odmowa loadera przy
   faktycznie nieważnym dostępie tylko utrzymuje blokadę; nie nadpisuje stanu bramki i jej
   ścieżki ponownego potwierdzenia. Błędy rzeczywistego startu nadal są błędami startu.

Po obliczeniu shell oddaje wątek przez setTimeout(0), sprawdza rzeczywisty dostęp main
oraz dotychczasowy kontekst inwestora/projektu/rewizji/zakresu/sesji. Powtarza kontrole po
modalach i przed save/replace. Nie zwiększono TTL 45 s, okresu odnowienia 30 s ani timeoutu
serwera 8 s. Nie dodano uprawnień, sztucznego dowodu ani nowej architektury Auth.

## Pomiary rzeczywistej aplikacji

Node 24 / Java 21 / Chromium 151, mobilny viewport 393×851 i touch, CPU hosta bez throttlingu. Natywne szafki,
fronty, realna akcja, kalkulator, optymalizator, read-back snapshotu i render. Dwa inwestorskie
projekty, obcy legacy slot; wyłącznie syntetyczne dane i lokalny HTTP. Główne profilowanie
izoluje biznesowy markup/load order z index, bez emulowania wyniku kalkulatora. Oddzielny
przebieg korzysta z rzeczywistego shellu logowania i oficjalnych emulatorów.

Trzy świeże profile na rozmiar, po dwa zapisy: zimny i nowy wariant z rabatem 1% na ciepłej
geometrii. Czasy end-to-end obejmują także obsługę gestu, odpytywanie i odczyt/render harnessu.
Wszystkie scenariusze stosują projektowe PCV; nie wyłączano go dla sztucznej serii legacy.

| Scenariusz | Przed: mediana / max | Po: mediana / max | Zmiana mediany | Plany/opt. przed → po |
|---|---:|---:|---:|---:|
| 1 szafka | 2,338 / 2,415 s | 1,084 / 1,096 s | −53,63% | 4 → 2 |
| 3 szafki | 6,968 / 7,153 s | 1,621 / 1,661 s | −76,74% | 6 → 3 |
| 9 szafek / 18 frontów | 36,045 / 36,126 s | 3,192 / 3,221 s | −91,14% | 6 → 3 |
| 9+1+1 | 53,978 / 56,145 s | 4,395 / 4,626 s | −91,86% | 6 → 3 |
| Projektowe PCV | we wszystkich powyższych | we wszystkich powyższych | bez dodatkowej serii | jw. |

Ciepłe mediany: 1 szafka 2,439 → 2,441 s (brak mierzalnego zysku end-to-end);
3: 6,843 → 2,998 s; 9: 35,697 → 4,540 s; 9+1+1: 55,065 → 5,970 s.
Ciepłe czasy zawierają rzeczywiste modalne zatwierdzenie nowej wersji i narzut gestów.
Maksymalne długie zadania zimnej serii: 1 szafka 1826 → 477 ms; 3: 6558 → 1035 ms;
9: 35534 → 2394 ms; 9+1+1: 55541 → 3477 ms. Interfejs wciąż może chwilowo blokować się
przy synchronicznej matematyce; nie zadeklarowano pełnej płynności lub rozwiązania dla dowolnej skali.

Dla 9 szafek mediany faz (zagnieżdżone, NIE sumować): collect 26795 → 2314 ms;
fakty 344 → 186 ms; 2898 → 423 wywołań cutlisty, 431 → 129 ms;
2538 → 1593 odczytów adresów PCV, 30827 → 202 ms; materiały 13763 → 723 ms;
plany z walidacją 3563 → 185 ms; budowa snapshotów 4154 → 179 ms; save 3146 → 132 ms.
Dodatkowy szczegółowy przebieg bazowy: czyste pakowanie 0,9 ms, robocizna 543 ms,
przygotowanie projektu 88 ms, noszenie 128 ms. Przykładowy przebieg po: odpowiednio
0,8 / 304 / 46 / 72 ms. Koszt leżał głównie w walidacji wokół silnika, nie heurystyce pakowania.
Dodatkowy izolowany pomiar rzeczywistych dwóch wywołań render (busy + wynik):
9 szafek zimno **72,2 → 71,0 ms**, ciepło **172,2 → 170,9 ms**. To pojedyncze
uzupełniające profile, nie mediana trzech profili. Render nie był główną przyczyną.
W JSON są także czasy potwierdzonego save od tapu, poszczególnych materiałów, czystego
pakowania, robocizny i opóźnień timerów z tych pełnych przebiegów.
Szczegóły median, maksimów, liczników i porównań: `quote-performance-measurements.json`.

Główna syntetyczna seria ma celowo brak ceny jednego dekoru Oak (ostrzeżenie, 0),
identyczny przed/po. Nie jest dowodem kompletności cennika właściciela. Osobna regresja
z Oak po 135 zł porównuje pełną matematykę i dokładnie jeden zapas PCV 10%.
Nie jest to pomiar fizycznego Pixela ani dowód tożsamości całego incydentu właściciela.

## Identyczność i ochrona danych

24/24 pełne zapisane payloady biznesowe przed/po są identyczne; osobno 24/24 fingerprinty.
Porównanie usuwa tylko techniczne ID nowego snapshotu i jego identyczne referencje oraz
czasy generacji/builtAt. Zachowuje rzeczywiste ID szafek/źródeł/pozycji, ilości, wymiary,
krawędzie, zapas, zakres, materiały, ceny, arkusze, okucia, robociznę, transport, rabaty,
wartości końcowe i model klienta. Hash każdego porównania znajduje się w JSON.

Nie ma nowych kluczy storage, trwałego cache, kopii autorytatywnego projektu, migracji,
resetu, importu ani automatycznego Save/Cancel. `fc_projects_v1`, historia, globalne RAW,
kanoniczne rewizje, dowody PCV i odzyskiwanie intencji PR #66 zachowują kontrakty.
Zmienione piny CLOUD-4.2 wiążą nowe bajty; nie aktywują pakietu lub LIVE.

## Testy i ograniczenia

Zakończone testy celowane:
APP 110/110, kontrakty WYCENY 113/113, wydajność 22/22, PCV UI 60/60,
spójność kontekstu 17/17, odzyskiwanie statusu 22/22, main-login 36/36; mobilny cykl ofert 16/16, RAM/PCV 10/10,
nowe modalne regresje 7/7; pełny SDK/Rules 71/71; prywatny startup Chromium 3/3.
Referencja rzeczywistego optymalizatora Kitchen/Living/Combined **4 / 3 / 6 arkuszy**
pozostaje asercją `multiroom-calculation-session-safety-smoke.js` w pełnym Preflight.
Mobilny cykl obejmuje wstępne/końcowe, A/B/A+B, wersje, akceptacje, statusy, restart,
A→B→A, przełączenie podczas await, starą intencję statusową i RAW danych globalnych.

Pełny przeglądarkowy Auth przed ostatnią poprawką main-login został uruchomiony z `AUTH_POPUP_TEST=1`: 36 PASS, 2 FAIL,
0 SKIP. Oba błędy to odmowa HTTP 403 proxy dla oficjalnego `apis.google.com`, zanim
powstanie popup Google. Nie zastąpiono go fikcyjnym sukcesem ani nie obchodzono polityki.
SDK 12.19.0 to oficjalne bajty o przypiętych SHA; Firestore 1.22.0 to oficjalny JAR o
sprawdzonym rozmiarze i SHA256
`9b6498b7f62714d67f48f59b3818883cd682dbcd46b9f59511de81c97bb5166c`. Wszystkie dane i usługi emulowane: `demo-meble-app`, loopback.

Rzeczywisty Auth performance: **5/5 PASS, 0 FAIL, 0 SKIP**. Bloki 30,000 / 45,000 /
60,000 / 90,000 ms: zapis dopuszczony tylko w pierwszym, po upływie TTL odmowa już w
synchronicznym zadaniu. Ponowne online wymaga nowego dowodu i zachowuje niezapisany RAM
oraz wszystkie RAW. Rzeczywista oferta 9+1+1 przez main/login: **1 collect**, zapis i render,
odnowienie po 32 s, cofnięcie grantu, odmowa zmiany historii i restart zachowujący snapshot.
Czas tej próby 7,202 s pod równoległym obciążeniem testów; wcześniejsza 4,524 s.
Nie włączono tych obciążonych liczb do głównej tabeli porównawczej.

Już blok 35 s może przekroczyć TTL, jeżeli potwierdzenie ma ponad 10 s w chwili kliknięcia.
Nie dowodzi to wieku dowodu na telefonie właściciela.

Wygaszenie po 45 s pozostaje celowe i konieczne. Nie gwarantujemy podtrzymania sesji
przy dowolnie długim blokowaniu wątku/uśpieniu lub braku sieci. Udowodniono mechanizm
starvation i wtórne nadpisywanie błędu, nie dokładny przebieg incydentu z Pixela.
Większe projekty nadal mogą wymagać osobnego projektu kooperatywnego silnika/Workera;
nie poszerzano architektury ani TTL w tym pakiecie.

Pełny Preflight po ostatnich zmianach produkcyjnych i pinach: **PRE-FLIGHT PASS**,
131691 ms; składnia 566/566, load order 331, smoke 131/131 (APP 110/110),
audyt zależności i storage PASS. Dokładność Rules pilota nadal
`eaeb3e67417955bbd67d2881902d3827023502c2948ce0a19dc583c66b5a2e92`.
Kontrola planów ograniczonego grantu/wycofania i pinów CLOUD-4.2 na emulatorach: **4/4 PASS**.
To weryfikacja nieaktywnego artefaktu, nie wykonanie planu na produkcji.

W jednym pełnym Auth uruchomionym równolegle z Preflightem wystąpił dodatkowo timeout
15 s oczekiwania na stan unapproved, przed boot aplikacji/kalkulacją: 35 PASS / 3 FAIL.
Seryjne powtórzenie tego samego scenariusza zaliczyło rzeczywisty boot, bfcache, offline,
reauth, Save i restart w 5,288 s. Nie zmieniono asercji ani timeoutu; do istniejącego
helpera oczekiwania dodano jedynie stan/kod odmowy na wypadek kolejnego błędu.
Nie ustalono dokładnej przyczyny pojedynczego timeoutu; nie przypisujemy jej pewnie CPU,
telefonowi lub produkcyjnej regresji. Pierwszy niezaliczony przebieg pozostaje udokumentowany.

Końcowy seryjny pełny Auth: **36 PASS / 2 FAIL / 0 SKIP** (38 testów).
Pozostałe odmowy: oba testy rzeczywistego popup Google, CONNECT proxy HTTP 403 do
`apis.google.com/js/api.js`; strona pozostaje bez dostępu, `auth/internal-error`.
Wszystkie scenariusze startu, przyznania/cofnięcia dostępu, read-back/IDB, bfcache,
100 równoległych prób admission i 9 podtestów prywatnego pilota przeszły.
To nadal **BLOCKED dla pełnej weryfikacji**, nie zielony pełny Auth.
Brak SKIP nie oznacza PASS: oba niezaliczone testy były faktycznie uruchomione.

## Akceptacja Pixela po osobnej decyzji wydaniowej

1. Zachować zwykłą kopię i zanotować wartość/zakres istniejącej zaakceptowanej oferty.
   Nie czyścić profilu, nie importować eksportu i nie usuwać znaczników operacji.
2. W syntetycznym projekcie 9+1+1 zmienić wymiar i Zapisz. Bez restartu sprawdzić
   MATERIAŁ/PCV oraz ROZRYS, następnie jedno pomieszczenie i wszystkie w WYCENIE.
3. Jeden tap Wyceń, nazwa i pierwszy tap potwierdzenia: nowa widoczna oferta i historia.
   Zanotować rzeczywisty czas. Sprawdzić nową wersję, duplikat/Anuluj i jawne zastąpienie.
4. Zmienić rabat: nowa kalkulacja i wariant. Stara zaakceptowana oferta ma te same wartości.
5. Przełączyć inwestora A→B→A i uruchomić aplikację ponownie. Zakresy/statusy/historia
   mają pozostać zgodne. Przy powrocie po uśpieniu wymagana jest świeża weryfikacja dostępu;
   brak jej potwierdzenia ma zablokować pracę bez zapisywania/anulowania edycji.

Zmiany nie publikują aplikacji. Pełna gotowość wydaniowa pozostaje zablokowana do
rozstrzygnięcia testów popup Google, osobnej decyzji właściciela i późniejszej akceptacji Pixela.

## Dokładny zakres plików

Kod produkcyjny (5): `js/app/wycena/wycena-tab-shell.js`,
`js/app/project/project-pcv-overrides.js`, `js/app/project/project-pcv-resolver.js`,
`js/app/ui/bindings.js`, `js/main-login.js` — przyczyny opisano powyżej.

Cache/piny: `index.html`, `dev_tests.html`, `tools/firebase-pilot/cloud42-source-pins.json`,
`tools/firebase-pilot/private-pilot-source.js` (dokładny MAIN_SHA256, nie zmiana drivera/Rules).
Nie zmieniono kolejności ładowania. Main-login/bindings nie są dodawane do dev_tests,
który wcześniej ich nie ładował; ich wersje zmienia wyłącznie rzeczywisty konsument index.

Nowe narzędzia: `tools/quote-performance-fixture.js`, `tools/quote-performance-smoke.js`,
`tools/quote-performance-mobile-browser.js`. Rozszerzenie rzeczywistych Auth:
`tools/firebase-pilot/auth-browser.test.mjs`. Istniejące mobilne runnery
`tools/project-context-mobile-browser.js` i `tools/pcv-ram-quote-mobile-browser.js`
używają fizycznych zdarzeń touch także do modalnego potwierdzenia; PCV czeka na pełny boot.
`tools/project-pcv-ui-activation-smoke.js` przepuszcza prawdziwe tury timerów zamiast samych
setImmediate, zgodnie z nowym oddaniem wątku. Żadnych usuniętych asercji.

Wyłącznie oczekiwany cache token: `tools/wycena-duplicate-offer-guard-smoke.js`,
`tools/wycena-generate-action-registry-smoke.js`, `tools/wycena-generate-single-flow-smoke.js`,
`tools/wycena-orphan-edit-session-cleanup-smoke.js`, `tools/wycena-snapshot-clean-store-smoke.js`.

Dokumentacja: bieżący dopisek w `CURRENT_STATE.md`, `ROADMAP.md`, `DEPENDENCY_MAP.md`,
`QUOTE_CALCULATION_REGISTER.md`, `TEST_BASELINE.md`; ten raport i JSON pomiarów.
Nie przepisywano historycznych audytów, kontraktów biznesowych lub dokumentacji chmury.

## Powtarzanie testów

```bash
node tools/quote-performance-smoke.js
node tools/main-login-smoke.js
node tools/wycena-full-contracts-smoke.js
node tools/offer-status-recovery-smoke.js
node tools/pcv-ram-quote-mobile-browser.js
node tools/project-context-mobile-browser.js --offer-lifecycle
EXPECT_SINGLE=1 node tools/quote-performance-mobile-browser.js --regressions
node tools/preflight.js
```

Emulatory kolejno, nigdy kilka instancji na tych samych portach. Oficjalny JAR i SDK
muszą być dostępne; nie podstawiać zamienników ani wyłączać TLS.

```bash
npm --prefix tools/firebase-pilot test
AUTH_POPUP_TEST=1 npm --prefix tools/firebase-pilot run test:browser
FIRESTORE_EMULATOR_HOST=127.0.0.1:18080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:19099 npm --prefix tools/firebase-pilot run test:private-startup
npm --prefix tools/firebase-pilot run test:cloud42-plan
cd tools/firebase-pilot
AUTH_PERFORMANCE_TEST=1 ./node_modules/.bin/firebase emulators:exec --config firebase.json --project demo-meble-app --only auth,firestore --non-interactive 'node --test --test-name-pattern="^PERF Auth" auth-browser.test.mjs'
```

Polecenia nie uruchamiają procedury wydaniowej. Zwykły push tej gałęzi nie spełnia
wyzwalaczy Ready/PR/main ani dokładnych gałęzi testów CLOUD-4.1/4.2.
