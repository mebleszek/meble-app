# Meble-App — plan przebudowy QA i CI: Playwright + krótszy Preflight

**Data analizy:** 15.11.2026  
**Repozytorium:** mebleszek/meble-app  
**Punkt odniesienia main:** 84a3a595c83091d97c9213e2e798c607da5a0a80  
**Baza pomiarowa:** GitHub Actions Preflight #43651112609, PR HEAD 46ed145a0db241d4a9c2b871dc95d751c8ae07b8, wszystkie shardy PASS.  
**Zakres:** wyłącznie testowanie, instrumentacja QA i organizacja CI. Bez zmiany cenników, reguł robocizny, modeli produkcyjnych, UI, danych urządzenia, Firebase LIVE czy protokołu synchronizacji.

> Cel: zapewnić, że zielony CI oznacza również możliwość wykonania rzeczywistej pracy — od kliknięcia i zatwierdzenia po trwały odczyt po restarcie i poprawną synchronizację — przy krótszym czasie testów i bez osłabiania zabezpieczeń.

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
MEBLE-APP — do dzieła. Zrealizuj TYLKO etap E1 z docs/plans/test-strategy-playwright-20261115.md na gałęzi roboczej Codexa utworzonej od aktualnego main. Przeczytaj AGENTS.md i TESTING.md. Przed kodem sprawdź obecny PR #140 i wybierz brak konfliktu. Użyj istniejącego playwright-core z tools/firebase-pilot (bez nowych, nieuzasadnionych zależności), rzeczywistego UI i dwóch izolowanych profili Chromium + Firebase Emulator DEMO. Zaimplementuj scenariusze klików INVESTOR → ROOM/CABINET → QUOTE → SAVE → restart → drugi profil/ACK w localOnly i synchronized oraz negatywy abort IDB, scope/CAS i zachowanie obcych danych. Najpierw odtwórz znane błędy (RED), zbierz trace/screenshot/sanitized code i RAW-hash/readback wyłącznie testowych danych. Nie osłabiaj walidacji; nie zmieniaj logiki produkcyjnej, cen, UI, Firebase LIVE, danych Pixela ani release workflow. Po RED podaj przyczynę i proponowany minimalny zakres osobnej naprawy; jeśli testy wymagają zmiany produkcji, zgłoś BLOCKED zamiast ukrywać FAIL. Dostosuj routing testów i manifest tylko jeżeli to wymagane przez E1. Wykonaj wyłącznie celowane sprawdzenia i statyczny diff, bez pełnego CI. Jeden commit + push, CLEAN, oddaj pełne HEAD/BASE SHA, listę plików, wyniki RED/PASS i ryzyka. Bez PR, merge, Pages, CI release ani LIVE.
~~~

## 7. Odczyt wyników pracy

- **E0:** może być przygotowany w odrębnej gałęzi bez PR i bez automatycznego wydania. Jego symulacja służy wyłącznie rozdzieleniu tych samych 221 testów.
- **E1–E4:** zaplanowane, nieuznane za wdrożone ani przetestowane.
- **CI / Pages / fizyczny Pixel:** brak nowego dowodu dla gałęzi E0 do czasu osobnego, zatwierdzonego przebiegu.
