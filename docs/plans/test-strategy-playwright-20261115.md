# Meble-App — plan przebudowy QA i CI: Playwright + krótszy Preflight

## Korekta po CI_FAIL PR #147 — 15.11.2026

**USTALONE:** Wymagane realne czasy poniżej 120 s dla każdego testu/grupy. Nie zmieniamy logiki biznesowej, nie pomijamy scenariuszy, nie timeoutujemy testów, nowe wydanie tylko za osobną zgodą na dokładny HEAD/BASE.

**WDROŻONE W KODZIE GAŁĘZI NAPRAWCZEJ:** `perf/ci-under-120s-fix-20261115` wychodzi od nieudanego HEAD PR #147 `3950596f6fc5f0d7e262ab59d236b2651597cb59` (main `7f4a76f880c8e1d58c88ea5e0cb399cc5b4c8952`). Zidentyfikowano i poprawiono wywołanie nieodpowiedniej walidacji batch 1 w `playwright-sync-ui`, dawne założenia o 10 smoke / 3 Firebase w kontrolach struktury CI, oraz obowiązkowy przydział części wycen po podziale. Dodatkowo 13 przypadków PDF przydzielono pojedynczo i przeprowadzono ponowną symulację z **36 grupami smoke oraz 250 jednostkami** (224 pliki), maksymalnie 105 s nominalnego obciążenia — to model, nie pomiar CI.

**WYNIK FAKTYCZNY NIEUDANEJ PRÓBY:** [PR #147](https://github.com/mebleszek/meble-app/pull/147), [Preflight #43764576105](https://github.com/mebleszek/meble-app/actions/runs/43764576105): `CI_FAIL / RELEASE_BLOCKED`, brak merge i Pages. FAIL: Playwright sync (CLOUD_CI_BATCH1_PLAN_CHANGED), grupy smoke 9 (stary kontrakt podziału Firebase), 11 (stary przydział global-code rebuild), 25 (stary kontrakt workflow); agregatory konsekwentnie zablokowały wydanie. W grupie smoke 14 zmierzono **139,3 s**, z czego jeden fragment PDF 116,1 s. Wszystkie osiem osobnych segmentów Firebase przeszło, czasy od 11,5 do 103,1 s. Wyniki z PR #147 nie są przenoszone jako PASS na nowy HEAD.

**BRAKUJE:** Jednego nowego, osobno zatwierdzonego wydania i realnego pomiaru dla SHA gałęzi naprawczej. Jeżeli dowolny test/grupa przekroczy 120 s, ponowny podział w ustalonym zakresie; nie ogłaszać ukończenia tylko po symulacji.

---

## Nowa decyzja właściciela 15.11.2026 — wszystkie grupy poniżej 120 s

**USTALONE:** Wszystkie zadania testowe mają dążyć do <120 s samego wykonania; optymalnie 75–90 s. Test trwający dłużej trzeba rozdzielić na niezależne, kompletne jednostki. Krótkie testy łączyć według realnego obciążenia, bez utraty asercji, retry, timeoutu ani Firebase LIVE.

**WDROŻONE W KODZIE GAŁĘZI ROBOCZEJ (jeszcze nie na main):** `perf/ci-under-120s-partition-20261115` od main `7f4a76f880c8e1d58c88ea5e0cb399cc5b4c8952`. Zmiana testów i CI bez produkcji: 224 pliki smoke → 244 rozłączne jednostki w 28 równoległych grupach. Skrypty obliczeń (83 przypadki), PDF (13 grup), norm i wydajności dzielone na segmenty w CLI z kontrolą integralności. Firebase Current podzielono na 8 osobnych obowiązkowych segmentów, nadal w izolowanych emulatorach DEMO. Dotychczasowe trzy długie scenariusze synchronizacji i ich 18 testów bazowych pozostają w pełnym pokryciu.

**BRAKUJE:** Pomiar GitHub Actions nowego dokładnego HEAD i przegląd różnic względem zatwierdzonej bazy. Ostatni rzeczywisty Preflight [#43756306571](https://github.com/mebleszek/meble-app/actions/runs/43756306571) miał pojedyncze smoke: quote-exact 404,5 s, PDF 330,0 s, norms 148,3 s, quote-performance 134,9 s; mieszane 195,4 / 157,4 / 144,5 / 113,3 s, a Firebase Current 3 270,6 s. Nowy plan na tych czasach **symuluje** 70,7–72,3 s/grupę smoke, ale NIE jest to dowód czasu rzeczywistego po podziale.

**PROPONOWANE / warunek odbioru:** Po osobnej zgodzie na dokładny HEAD/BASE uruchomić jeden standardowy Preflight. Sprawdzić faktyczne czasy każdej części smoke, każdego segmentu Firebase i Playwright/historical. Jeżeli jakikolwiek scenariusz >120 s lub grupa >120 s, kontynuować ten sam zatwierdzony zakres optymalizacji na kolejnej gałęzi, nie usuwać przypadku; nowa próba CI wymaga odrębnej zgody wydaniowej. Każdy plik i każda część muszą przejść dokładnie raz, niezależnie od zmiany liczby runnerów. Nie twierdzić, że granica jest osiągnięta bez tego pomiaru.

---

**Data analizy:** 15.11.2026  
**Repozytorium:** mebleszek/meble-app  
**Punkt odniesienia main:** 84a3a595c83091d97c9213e2e798c607da5a0a80  
**Baza pomiarowa:** GitHub Actions Preflight #43651112609, PR HEAD 46ed145a0db241d4a9c2b871dc95d751c8ae07b8, wszystkie shardy PASS.  
**Zakres:** wyłącznie testowanie, instrumentacja QA i organizacja CI. Bez zmiany cenników, reguł robocizny, modeli produkcyjnych, UI, danych urządzenia, Firebase LIVE czy protokołu synchronizacji.

> Cel: zapewnić, że zielony CI oznacza również możliwość wykonania rzeczywistej pracy — od kliknięcia i zatwierdzenia po trwały odczyt po restarcie i poprawną synchronizację — przy krótszym czasie testów i bez osłabiania zabezpieczeń.

## Optymalizacja 24.11.2026 — przygotowanie katalogów i koniec wydania

**USTALONE:** właściciel zlecił optymalizację sposobu wydawania; cel 4 minut dotyczy testów i wydania, nie pracy nad kodem. Pakiet od main d9a3f6ca0433e0d8215149e4e3a7a61ea96665e0 na perf/release-pipeline-20261124 nie ma jeszcze zgody na nową próbę CI. Bez zmiany aplikacji, UI, cen, Rules, katalogów użytkownika lub Firebase LIVE.

- **POMIAR OSTATNIEGO WYDANIA:** PR169, Preflight1400 / run45483317884:81 PASS/0 FAIL/2 nieobowiązujące SKIPPED. Ready20:40:50Z → koniec CI20:49:29Z (519 s). Exact Pages45484622259 dla merge d9a3f6ca0433e0d8215149e4e3a7a61ea96665e0 potwierdzone20:49:24Z. Publiczne533/533 plików PASS20:50:17,705Z: Ready→pełna kontrola567,705 s (9:27,705); odcinek zgoda→Ready niezmierzony. Weryfikator zaczął32,502 s po końcu Pages, odczyty trwały21,203 s. 6791 runner-sekund, szczyt20 równoległych, maksymalna kolejka287 s. Same6791/20 dają dolne ograniczenie339,55 s przy identycznej pracy; nie da się dowieść celu4 min samym kolejnym podziałem jobów.
- **WDROŻONE:** końcowa kontrola publicznych bajtów jest częścią istniejącego joba publikacji po exact Pages. Pobiera przypięty merge (depth2), sprawdza zgodność drzewa z testowanym HEAD, cały manifest z Git i publiczne pliki. Cztery odczyty równolegle, bez retry. Końcowy raport wymaga rzeczywistego PASS; brak wyniku blokuje. Usuwa ręczne przekazanie/ponowne oczekiwanie po Pages, nie samą kontrolę.
- **EKSPERYMENT / WYCOFANY:** zwykły quoteProbe uruchomiono z aktualnym katalogiem447 rekordów przygotowanym w emulatorze przez istniejący planPricingFactoryAdditions. Hash odczytanych14 domen przed/po identyczny7f04ed74b61eda3b5e87dd9c29ef58fc7cb6ca8db745e77c8368c1a44cf152b6; prywatne/zerowe ceny i ukryte pozycje zachowane. Cały istniejący scenariusz promocji obu pokoi, obcego edytora, CAS, abortu IDB, SIGKILL/restartu, niezmienności źródeł/historii i odbioru przeszedł1/1 przed i po. Czas311379,819→309432,167 ms (tylko0,63%, pojedynczy pomiar) nie dowodzi istotnego zysku. Pierwsza próba eksperymentu zatrzymała się na istniejącej odmowie zamknięcia procesu Chromium przy restartProbe; PID później nieobecny, bez zmiany nadzorcy, timeoutu lub asercji. Kolejna izolowana próba PASS. Nie włączono tego skrótu do pakietu: oba pliki Firebase są identyczne z wejściowym HEAD, helper usunięty wyłącznie z bieżącego własnego diffu po kopii SHA-256. Dowody i eksperymentalny diff pozaGit: work/release-pipeline-evidence-20261124. Przydział36 grup/265 jednostek oraz37 segmentów/61 przypadków niezmieniony.
- **LOKALNE DOWODY PAKIETU:** istniejący ci-release-speed-smoke obejmuje wszystkie pliki/SW/update, modyfikację bajtów, stary manifest, HTTP404 i niedozwolone ścieżki. Rzeczywisty CLI sprawdził533/533 aktualnych plików wydanego main (25,148 s); nieprzypięte SHA/odmienne drzewo odmawiają przed pobraniem. Izolowany płytki checkout merge zachował testowany HEAD i identyczne drzewo, manifest531/531 PASS. Kontrole rzeczywistego workflow:13 grup PASS,125 kombinacji agregacji, odmowy brakującego/błędnego public proof, FAIL/cancel/skipped, zmienionego HEAD/BASE/Ready i negatywne mutacje. Bez pełnego lokalnego Preflightu.
- **ODMOWA PUBLIKACJI:** po pierwszym błędzie nie rozpoczyna się dalszych odczytów, kończą się maksymalnie4 już aktywne, bez retry. Celowany test awarii22 plików:4 rozpoczęte żądania,0 potwierdzonych,22 niepotwierdzone i FAIL. Brak mnożenia30-sekundowych timeoutów przez całą kolejkę; częściowy odczyt nigdy nie daje PASS.
- **BRAKUJE / CI_PENDING:** rzeczywistego czasu nowego pełnego CI i publikacji. Zysk usunięcia32,5 s oczekiwania z ostatniego wydania jest szacunkiem; dojdzie koszt checkoutu. Zmienność runnerów/cache/kolejki nadal może przekroczyć4 min. Nie zmniejszono testów bezpieczeństwa ani czasu rzeczywistego timerów.

## Aktualizacja 22.11.2026 — proporcjonalne testy i zakres CI

**Zatwierdzona decyzja właściciela:** uporządkować testy i zasady; nie dodawać testu do każdej drobnej zmiany i nie uruchamiać wszystkich emulatorów przy poprawce samodzielnego testu. Poniższe dawne liczby i statusy pozostają historią. Aktualna polityka: [TESTING](../agents/TESTING.md#3-testy-proporcjonalne-do-zmiany--decyzja-właściciela-22112026), [RELEASE](../agents/RELEASE.md).

- **USTALONE → WDROŻONE w kandydacie.** Zamknięte ścieżki `documents` (pięć istniejących MD) i `tests` (dziesięć przejrzanych samodzielnych testów VM) wybierane z dokładnego diffu. `tests` wykonuje wszystkie zmienione pliki w całości oraz statykę, scope, przydział wszystkich testów, DAG i odmowy źródeł. Każdy runtime/shared fixture/SDK/browser test/polityka CI/nieznany plik wymusza `full`; nowy plik, rename, usunięcie i zmiana trybu również. Nie zmieniono aplikacji ani nie usunięto przypadków. Pełny wariant nadal 234 smoke /265 jednostek /36 logicznych grup i 37 segmentów P0-B/P1 /61 przypadków.
- **Reguła utrzymania.** Najpierw istniejący test i pokrycie wymagania; nowy przypadek tylko dla brakującego zachowania/ryzyka. Domenowe warianty sprawdzać szybko, E2E używać dla granic UI/IDB/ACK. Duplikat można scalić dopiero z dowodem równoważnych asercji, negatywów i izolacji. Nie stwierdzono równoważności całego zestawu i nie usuwano testów na podstawie samych nazw/czasów.
- **Pomiar istniejącego full #1387 (`45072549098`), bez nowego CI.** Ready→exact Pages 7:10; Safety→ostatni test 5:45, 75 zadań testowych łącznie 5775 runner-sekund, maksymalna kolejka 260 s, obserwowany szczyt 20 równoległych zadań. To nie jest 5775 sekund czasu wydania. Model tych samych czasów przy 20 miejscach daje ok. 307 s do końca testów (szacunek, nie SLA). Samo kolejne dzielenie jobów nie dowodzi osiągnięcia 4 minut. Szybkie tryby eliminują niepowiązane zadania; rzeczywisty czas nowego workflow wymaga zatwierdzonego CI.
- **BRAKUJE / CI_PENDING.** Nowy workflow nie został uruchomiony na GitHubie. Ten pakiet zmienia politykę/CI i sam wymaga `full` po zgodzie wydaniowej. Brak dowodu automatycznego, bezpiecznego ograniczania testów zmian aplikacji; takich zmian nadal nie kwalifikuje się do skrótu.
- **LOKALNIE PASS.** Zamknięte scope RED→GREEN, 10/10 dopuszczonych testów, 13 grup kontroli workflow z negatywnymi mutacjami i 125 kombinacjami agregacji, YAML i niezmienny pełny przydział. Rzeczywisty runner w izolowanej kopii Git: 33/33 testu, linki wszystkich pięciu MD, celowy FAIL propagowany, następny plik wykonany, po naprawie GREEN; DIRTY odrzucone przed testem. Statyka 770/770 i kanoniczny publiczny manifest 526/526 PASS. Nie uruchamiano emulatorów ani pełnego CI; brak nowego dowodu fizycznego urządzenia.
- **PROPONOWANE, bez implementacji w tym pakiecie.** Następne rozszerzenia dopiero po zamkniętej mapie zależności. Długie timery rozdzielać na szybki dowód domenowy i reprezentatywną integrację po sprawdzeniu równoważności; nie usuwać testu uśpienia/reconnect tylko dlatego, że trwa długo. Nie dodawać kolejnych runnerów bez pomiaru kolejki i kosztu.

## Aktualizacja wdrożenia 15.11.2026 — E0+lokalne E1 i obowiązkowe Playwright CI

**Ta sekcja aktualizuje status wdrożenia.** Poniższe sekcje 1–7 pozostają historycznym zapisem pierwotnego planu i pomiarów siedmiu shardów, nie opisem nowej konfiguracji.

- Codex dodał na gałęzi `test/qa-playwright-local-ui-20261115` dwa testy Playwright dla localOnly: rzeczywisty zapis inwestora i szafki, odczyt IndexedDB, restart Chromium i powtórny odczyt. Wynik lokalny przekazany przez Codexa: **2/2 PASS**. GitHub Actions dla tych testów jeszcze nie wykonał nowego przebiegu.
- W niniejszej gałęzi zmieniono liczbę shardów smoke z 7 na **10**, bez usuwania któregokolwiek z **221 plików testowych**. Sześć testów ma osobne, równoległe zadania: trzy istniejące izolowane oraz trzy ze zmierzonym czasem ponad 120 sekund: `quote-exact-calculations-smoke.js` (220,6 s), `wycena-labor-pdf-smoke.js` (175,1 s), `wycena-labor-norms-smoke.js` (156,1 s). Dodatkowy guard odmawia mieszanej grupy dla każdej wpisanej w wagach pozycji >120 000 ms.
- Pozostałe 215 smoke podzielono na cztery mieszane grupy. **Symulacja na historycznych czasach**: grupy mieszane 176/167/160/175 s, trzy ciężkie osobno 221/175/156 s. Szacowany najdłuższy shard **221 s zamiast 523 s**. Jest to obliczenie na danych historycznych, nie dowód czasu nowego przebiegu GitHub CI.
- Do `.github/workflows/preflight-js.yml` dodano **osobne równoległe zadanie `playwright-local-ui`** z Node 22, Chromium, zamrożonymi zależnościami i izolowanym `TMPDIR`. Wynik wymagany jest przez agregację `preflight`, zatem FAIL zablokuje wydanie; błędy zapisują log, screenshot i trace jako artefakty. Nie korzysta z Firebase LIVE ani nie wymaga serwera Firebase w localOnly.
- Obecny Firebase Current batch 3 jest wielominutową **sekwencją czterech odrębnych segmentów** (~93/40/45/40 s plus osobna jednostka administracyjna). W ostatnim pomiarze żaden z pojedynczych segmentów nie przekroczył 120 s. Jeżeli celem będzie dalsze skrócenie pełnego CI, należy rozważyć ich rozdzielenie na osobne zadania tylko po audycie izolacji emulatorów i kosztu runnerów; nie wolno w tym celu łączyć stanów testowych.
- **Wciąż brak** testu Playwright UI na rzeczywistym trybie zsynchronizowanym z Firebase Emulator; to następny trudniejszy pakiet dla Codexa Medium/High. Obecny localOnly PASS nie dowodzi naprawy problemu `LF_APPLICATION_SCOPE_REFUSED` ani zapisu historii wycen w trybie online.

**Status gałęzi:** `CODE_READY / CI_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED`. Bez PR Ready, merge, Pages i bez dotykania produkcyjnych danych. Przed wydaniem wymagana odrębna zgoda na dokładne HEAD i BASE SHA.

---
## 1. Ustalenia z kodu i rzeczywistych logów

### 1.1. Architektura bieżącego wydania

- Workflow .github/workflows/preflight-js.yml uruchamia: kontrolę SHA/źródła, statyczny preflight, **7 shardów smoke**, **3 batche Firebase Current**, historyczne smoke i SDK, agregację, automatyczny merge i weryfikację Pages. Zadania niezależne uruchamiane są równolegle.
- tools/preflight.js odkrywa pliki *-smoke.js automatycznie; tools/ci-smoke-shards.js przydziela je według ręcznie zadeklarowanych wag. tools/ci-sharding-smoke.js weryfikuje dokładnie jeden przydział każdego testu, 7 rozłącznych grup, test przyszłego pliku oraz izolację historycznych.
- Projekt ma zainstalowaną zależność **playwright-core 1.64.1** w tools/firebase-pilot/package.json. Istniejące realne testy Chromium wykorzystują w wielu miejscach własną orkiestrację CDP i Node; nie są automatycznie równoważne pełnym scenariuszom UI w Playwright.
- GitHub Actions ma gotowy Chromium; weryfikacja przeglądarki i instalacja zamrożonych zależności Firebase już istnieją. Nie zakładać globalnej instalacji Playwright poza środowiskiem tools/firebase-pilot.

### 1.2. Pomiar czasu — nie szacunki

W wykonaniu #43651112609 całkowity czas od rozpoczęcia do finalizacji procesu (łącznie z merge/Pages) wyniósł **10 min 31 s**. Siedem shardów wykonało **221 unikalnych plików smoke**: liczby na shardach [1, 1, 1, 55, 56, 53, 54].

| Job | Suma czasów poszczególnych smoke | Czas job przybliżony |
| --- | ---: | ---: |
| smoke 1 | 114,9 s | 2:06 |
| smoke 2 | 29,2 s | 0:40 |
| smoke 3 | 41,6 s | 0:52 |
| smoke 4 | 334,9 s | 5:50 |
| smoke 5 | 294,3 s | 5:17 |
| smoke 6 | 77,0 s | 1:29 |
| **smoke 7** | **523,4 s** | **9:03** |

Szczególnie kosztowne testy:

| Plik | Czas wykonania (1 pomiar) | Obecna zadeklarowana waga |
| --- | ---: | ---: |
| quote-exact-calculations-smoke.js | **220,6 s** | **12 s** |
| wycena-labor-pdf-smoke.js | **175,1 s** | **domyślnie 1 s** |
| wycena-labor-norms-smoke.js | **156,1 s** | **8 s** |
| quote-performance-smoke.js | 114,9 s | 74 s |
| quote-final-corrections-smoke.js | 71,3 s | domyślnie 1 s |
| android-startup-auth-browser-smoke.js | 59,0 s | domyślnie 1 s |
| android-local-first-browser-smoke.js | 58,5 s | domyślnie 1 s |
| local-cabinet-native-browser-smoke.js | 55,4 s | domyślnie 1 s |
| android-safe-sw-update-smoke.js | 51,5 s | domyślnie 1 s |

**Wniosek potwierdzony:** sharding jest wadliwie wyważony przez nieaktualne wagi. Nie potrzeba usuwać testów, aby najpierw uzyskać istotną poprawę.

**Symulacja, nie wynik CI:** aktualizacja wag dla testów trwających >=4,5 s daje na tych samych pomiarach cztery grupy mieszane o obciążeniu ok. 311 / 305 / 305 / 308 s, zamiast 335 / 294 / 77 / 523 s. Teoretyczne dolne ograniczenie dla czterech grup mieszanych wynosi około 307 s. Realny czas może odbiegać od symulacji z powodu współdzielonego runnera, cache, zmienności Chromium i zmian innych branchy. Nie deklarować PASS ani osiągniętego przyspieszenia przed CI.

### 1.3. Braki jakościowe, których nie rozwiązuje sama liczba testów

- Rzeczywisty test android-local-first-browser-smoke.js klika m.in. zapis inwestora, szafki, zapisy i „Wyceń”, ale działa w **localOnly**. Pokrycie tej ścieżki nie potwierdza pracy synchronizowanej.
- Testy dwóch przeglądarek i emulatorów sprawdzają autoryzację, CAS, outbox i transfer. W przejrzanych scenariuszach nie odtwarzają pełnego łańcucha **klik formularza inwestora → zapis → ponowne otwarcie** i **klik „Wyceń” → trwała historia ofert** w trybie synchronizowanym.
- W kodzie aplikacji istnieją ścieżki zależne od localOnly dla inwestorów, ustawień oferty, pomieszczeń i kończenia edycji. To **wymaga testu integracyjnego**; nie uprawnia do arbitralnego rozszerzania dozwolonych kluczy lub wyłączenia ochrony danych.
- Nagranie fizycznego telefonu wskazało m.in. błędy zapisu inwestora, LF_APPLICATION_SCOPE_REFUSED przy wycenie oraz fałszywie widoczną historię po odrzuconej transakcji. Te fakty mają stać się kryteriami regresji.
- Sama obecność wyniku wyceny w DOM **nie jest dowodem** zapisu w IndexedDB. Sukces musi oznaczać trwały commit, readback po odtworzeniu kontekstu i właściwy zakres danych.

## 2. Decyzja: nie „usunąć testy i dodać Playwright”, tylko zmienić strukturę dowodów

### Co zachować

1. Niezależne testy matematyczne ceny/czasu, geometrii szafek, materiałów, zerowych wartości, formularzy cennika — Playwright nie jest lepszym narzędziem do sprawdzania arytmetyki.
2. Negatywne kontrakty IndexedDB/CAS/rollback, outbox/ACK/uncertain, drugi edytor, granice właściciela, 14 domen, nieruszalne dane globalne i zaakceptowane oferty.
3. Kontrole SHA/BASE, źródła, pinów SDK, kompatybilności skryptów, SW, Pages oraz niezależną bramkę Firebase DEMO.

### Co zmienić

1. **Playwright** staje się podstawowym dowodem **funkcjonalnym E2E**, z prawdziwymi gestami użytkownika, a nie syntetycznym wywołaniem repository zamiast kliknięcia.
2. **Szybkie jednostkowe/kontraktowe** zostają jako tanie, celowe asercje, ale długie powtarzanie inicjalizacji fixture i nieuzasadnione duplikaty należy zoptymalizować.
3. **Historyczne i szerokie przekrojowe** ocenić test po teście. Nie usuwać z release gate bez wykazania równoważnego pokrycia i zachowania negatywów. „Stary test” nie oznacza „niepotrzebny test”.
4. Raport CI ma pokazywać wyniki według **umiejętności użytkownika** (zapis inwestora, szafki, wycena, restart, sync), nie tylko numery shardów i setki PASS.

## 3. Etapy wdrożenia

### E0 — bezpieczne wyważenie istniejącego CI (mały zakres, wykonuje ChatGPT)

- Zmienić **wyłącznie wartości wag** w tools/ci-smoke-shards.js na podstawie czasu testów z #43651112609; bez zmiany algorytmu, liczby grup, listy izolowanych, testów, asercji i workflow.
- Nie modyfikować produkcji, UI, runnera, zależności ani Firebase.
- Sprawdzić deterministyczną symulacją, że **221/221 plików** ma jeden przydział i że ciężkie testy nie zbierają się w jednym shardzie; odnotować, że pomiar realny wymaga CI.
- Przed kolejną zmianą wag używać mediany z 3–5 wykonań zamiast jednego pomiaru. Jednorazowe E0 to dopuszczona ostrożna korekta organizacyjna; wyniki symulowane, nie gwarantowane.

**Odbiór E0:** niezmienione pokrycie i struktura zabezpieczeń; brak PR/merge bez osobnej zgody na dokładny HEAD/BASE.

### E1 — rzeczywista regresja użytkowa w Playwright (Codex; najważniejsza praca)

Uruchomić Playwright z istniejącego, przypiętego tools/firebase-pilot/playwright-core, działając na rzeczywistym HTML, produkcyjnych skryptach, IndexedDB i zatwierdzonym, izolowanym Firebase Emulator DEMO (bez LIVE). W obu trybach: localOnly i synchronized z autentycznym bootstrapem, nie za pomocą sztucznego przełączenia flagi po starcie.

**Scenariusze P0 (najpierw RED na rzeczywistym problemie, dopiero potem GREEN):**

1. **Inwestor:** uruchomienie, dodanie A i B, edycja A (nazwa, adres, źródło), potwierdzenie modalne, komunikat, odczyt A i B z kanonicznego IndexedDB, zimny restart, ponowny odczyt; A po zmianie, B i nieznane pola dokładnie zachowane.
2. **Pomieszczenie/szafki:** dodanie pomieszczenia, parametry, typowe szafki + jeden problematyczny wariant, edycja, główne Zapisz, restart, porównanie ID, frontów, materiałów i geometrii. Szkic przed Zapisz nie powoduje outboxa; Anuluj przywraca baseline.
3. **Ustawienia nowej oferty:** wybór pomieszczeń, nazwa wersji, koszt przerw, usługi, godziny pomocnika oraz narzut/ręczne pozycje. Zatwierdzenie i readback. Każdy przycisk przechodzi poprawną granicę transakcji.
4. **Wyceń i historia:** naciśnij prawdziwy przycisk Wyceń, zweryfikuj wynik niezależnie od UI, snapshot w IndexedDB, trwały identyfikator, odświeżenie i historię; podczas świadomie wymuszonego abortu historyczny snapshot nie może być pozornie zapisany. Nie uznawać wyniku w RAM za sukces.
5. **Dwa urządzenia i utrata sieci:** dwa odrębne profile Playwright, blokada drugiego edytora, potwierdzony lokalny commit, kontrola kolejki i ACK, zimny start odbiorcy, wyłączenie i przywrócenie połączenia, brak nadpisywania niezwiązanych rekordów i brak duplikatów po niepewnym ACK.

**Niezbędne negatywy:** odmowa scope, abort prawdziwej transakcji IDB, błąd owner/CAS, zamknięcie i utrata renderera, odrzucenie dostępu Auth, opóźniony reconnect, próba zapisu po zmianie kontekstu, zachowanie ofert zaakceptowanych i globalnych katalogów. Każdy taki scenariusz ma potwierdzać brak fałszywego sukcesu i zachowanie niepotwierdzonego formularza.

**Warunki implementacji:** testy mają symulować realne akcje UI; dopuszczalne są tylko read-only sondy do asercji IDB i jawnie kontrolowane fault injection; nie tworzyć fikcyjnego PASS przez bezpośrednie wywołania modelu zamiast przycisku. Syntetyczne dane wyłącznie w izolowanych profilach. Trace, screenshot, video i sanetyzowane kody wyjątków przy FAIL, nie logować prywatnych danych ani tokenów. Uporządkowane cleanup procesów przeglądarki i emulatorów, brak bezwarunkowych sleep, oczekiwanie na rzeczywisty stan.

**Uwaga:** E1 to pakiet QA, nie ukryta zgoda na masowy refaktor aplikacji. Jeśli testy odtworzą obecny błąd produkcyjny, zgłosić RED z dokładną ścieżką i minimalnym zakresem poprawki; nie osłabiać testu. Naprawa domeny według zaakceptowanego zakresu i oddzielnego pakietu.

### E2 — optymalizacja kosztownych testów bez utraty kontraktów

- Najpierw rozdzielić koszt stałego tworzenia fixture od samego zestawu asercji w: quote-exact-calculations-smoke, wycena-labor-pdf-smoke, wycena-labor-norms-smoke, quote-final-corrections-smoke.
- Przejrzeć powtarzane inicjalizacje kontekstu VM, kompilacje, generowanie katalogów i koszt startu Chromium; buforować **tylko niezmienne** obiekty i izolować stan testów. Nie używać współdzielonej mutowalnej fixture pomiędzy przypadkami.
- Zostawić dokładne oczekiwane wartości, porównania z niezależną arytmetyką, zera, ujemne przypadki, normy i zamrożone oferty. Testy porównawcze baseline SHA i hashe muszą pozostać wiarygodne.
- Mierzyć każdy test osobno i przechowywać raport duration (mediana/p95) jako artefakt. Żadnego sztucznego PASS po upływie 90 sekund; obecny ci-budget-watch ma jedynie ostrzegać.

### E3 — kontrolowana redukcja zestawu (dopiero po E1 i E2)

Dla każdego testu przygotować macierz: nazwa → scenariusze → pozytywne/negatywne asercje → domeny/ryzyko → czas → nowy test przejmujący kontrakt → decyzja. Kategorie:

- **KEEP ALWAYS:** autoryzacja, bezpieczny commit/recovery/CAS, obcy właściciel, outbox ACK, kalkulator norm i kwot, historia zaakceptowanych ofert, integralność katalogów, granica produkcja/DEMO.
- **MERGE:** funkcjonalnie pokrywające się testy i powtarzane setupy; scalić kontrakty, nie osłabiać ani usuwać ich.
- **CONDITIONAL/EXTENDED:** historyczne migracje i stare ścieżki tylko po dowodzie, że nie są częścią aktywnego wdrożenia. W release nie wolno pomijać przypadków, od których nadal zależą bieżące formaty danych.
- **RETIRE:** wyłącznie dokładne duplikaty zastąpione równoważną kontrolą z dowodem RED→GREEN, nie tylko podobną nazwą testu.

Niedopuszczalne: zmniejszanie asercji dla zielonego paska, filtrowanie FAIL, modyfikacja autoryzacji, obchodzenie scope guard, kasowanie katalogów lub outboxa i „testowanie” przez zwykły DOM bez potwierdzenia IDB.

### E4 — docelowe CI

- **Szybki pakiet developerski** przed review: składnia, weryfikacja źródła, tanie testy domen dotkniętych zmianą. Nie zastępuje bramki wydania.
- **Release gate** po zgodzie na Ready: krytyczne Playwright E2E + konieczne jednostkowe kontrakty danych/kwot + Firebase DEMO + nienaruszalność 14 domen + statyczne kontrole SHA/manifest/Pages. Pełna lista wynika z macierzy E3 i dopiero wtedy może zastąpić obecny workflow.
- Wynik **RELEASE_READY** tylko po wymaganych PASS dla zatwierdzonego exact HEAD/BASE; automatyczny merge istniejącą ścieżką, bez ręcznego merge, retry i Firebase LIVE.
- Raport zagregowany: INVESTOR, ROOM/CABINET, QUOTE, STORAGE/RECOVERY, CLOUD, GLOBALS, SW/UPDATE, SECURITY, RELEASE.
- Czas grup mierzony oddzielnie od setupu runnera, instalacji SDK, merge i Pages. Utrzymać budżet 75/90 sekund jako ostrzeżenie. Docelowy pre-release około 5–7 minut **jest celem do zweryfikowania**, nie obietnicą; nowy zestaw Playwright może go wydłużyć, dopóki nie zostanie zoptymalizowany.

## 4. Bramy przejścia i kryteria ukończenia

| Przejście | Wymagany dowód | STOP |
| --- | --- | --- |
| E0 → E1 | 221 testów w 7 rozłącznych grupach, zmodyfikowane tylko wagi i plan | brak przydziału, ukryty skip, zmiana produkcji |
| E1 RED | Wskazany gest, kod błędu, trace i stan IDB; brak sztucznego sukcesu | test nie odtwarza prawdziwego UX |
| E1 GREEN | Rzeczywista sekwencja UI i readback po cold start w obu trybach, negatywy zachowane | zapis widoczny tylko w RAM |
| E2 → E3 | Równe lub silniejsze asercje, ten sam wynik liczbowy, mierzony spadek kosztu | utrata kontraktu lub niezależnej weryfikacji |
| E3 → E4 | Macierz pokrycia bez luk i bezpieczny release gate w CI | brak dowodu, zachowane błędy użytkownika |
| Wydanie | Osobna zgoda właściciela na konkretną próbę: repo, gałąź, HEAD SHA, BASE SHA, zakres | niepełna zgoda, zmiana SHA, FAIL |

## 5. Wyłączenia i zależności

- Nie dotykać trwającego PR #140 (Service Worker) ani PR #133 (usuwanie inwestora). Wszelkie konflikty zmian w CI ocenić po zakończeniu ich ścieżek; nie uznawać wyników z obcego HEAD za PASS.
- Bez resetu Pixela, czyszczenia IndexedDB/RAW, konta Google, danych klientów, katalogów, cenników i stawek.
- Nie wykonywać operacji Firebase LIVE, publikacji Rules, migracji i usuwania danych.
- E0 nie modyfikuje żadnego API produkcyjnego ani sposobu synchronizacji. E1/E2/E3 wymagają osobnych etapów kontroli jakości; nie wrzucać całej przebudowy do jednego ryzykownego wydania.
- Zgoda „do dzieła” na analizę i implementację nie zastępuje osobnego zatwierdzenia **dokładnych** HEAD i BASE do PR Ready/merge.

## 6. Prompt dla Codexa — kolejny etap, wyłącznie E1

**Cel:** Dodać brakującą prawdziwą regresję Playwright dla dwóch trybów LOCAL-FIRST, nie usuwać starych testów.

Polecenie do skopiowania:

~~~text
MEBLE-APP — do dzieła. Zrealizuj TYLKO etap E1 z docs/plans/test-strategy-playwright-20261115.md, korzystając z planu na gałęzi chore/qa-playwright-ci-balance-20261115; utwórz gałąź E1 od tej gałęzi (przed pracą sprawdź aktualne main i konflikty). Przeczytaj AGENTS.md i TESTING.md. Przed kodem sprawdź obecny PR #140 i wybierz brak konfliktu. Użyj istniejącego playwright-core z tools/firebase-pilot (bez nowych, nieuzasadnionych zależności), rzeczywistego UI i dwóch izolowanych profili Chromium + Firebase Emulator DEMO. Zaimplementuj scenariusze klików INVESTOR → ROOM/CABINET → QUOTE → SAVE → restart → drugi profil/ACK w localOnly i synchronized oraz negatywy abort IDB, scope/CAS i zachowanie obcych danych. Najpierw odtwórz znane błędy (RED), zbierz trace/screenshot/sanitized code i RAW-hash/readback wyłącznie testowych danych. Nie osłabiaj walidacji; nie zmieniaj logiki produkcyjnej, cen, UI, Firebase LIVE, danych Pixela ani release workflow. Po RED podaj przyczynę i proponowany minimalny zakres osobnej naprawy; jeśli testy wymagają zmiany produkcji, zgłoś BLOCKED zamiast ukrywać FAIL. Dostosuj routing testów i manifest tylko jeżeli to wymagane przez E1. Wykonaj wyłącznie celowane sprawdzenia i statyczny diff, bez pełnego CI. Jeden commit + push, CLEAN, oddaj pełne HEAD/BASE SHA, listę plików, wyniki RED/PASS i ryzyka. Bez PR, merge, Pages, CI release ani LIVE.
~~~

## 7. Odczyt wyników pracy

- **E0:** wykonany odczytowo i organizacyjnie na gałęzi chore/qa-playwright-ci-balance-20261115; zmodyfikowane jedynie wagi w tools/ci-smoke-shards.js. Symulacja na rzeczywistych 221 czasach z CI: 221/221 unikalnych testów, siedem grup, szacowany najdłuższy shard 311 s zamiast historycznych 523 s. To NIE jest nowy CI PASS ani dowód realnego czasu.
- **E1–E4:** zaplanowane, nieuznane za wdrożone ani przetestowane.
- **CI / Pages / fizyczny Pixel:** brak nowego dowodu dla gałęzi E0 do czasu osobnego, zatwierdzonego przebiegu.
