# Ręczna synchronizacja i wycena zajętych pomieszczeń — 22.11.2026

## USTALONE

Zatwierdzona przez właściciela zmiana: wyłącznie tekst Synchronizuj w obecnym czarnym pasku, bez zwiększenia wysokości lub drugiego wiersza. Kolor zamiast odliczania. Przed wyceną cudzych zajętych pomieszczeń jawne Tak / Nie / Uwolnij blokowane. Po poprawnym PIN-ie i zwolnieniu nadal Tak / Nie; brak automatycznego wyceniania. Niewysłane zmiany innych urządzeń nie są dostępne dla wyceniającego.

Punkt wyjścia: `main`/BASE `9b5c0d21ee188f84014941326a5ee94b98f11881`, początkowo CLEAN, nowa gałąź `feat/manual-sync-quote-lock-warning-20261122`. Poprzednia zgoda wydaniowa została wykorzystana przez PR #162. Ten pakiet wymaga nowego wydaj. Bez operacji Firebase LIVE, nowych Rules, migracji i resetów.

## WDROŻONE w kandydacie

- Przycisk czeka na lokalną transakcję i wywołuje istniejący flush. Biel/kolor bazowy: gotowy; niebieski: trwa; zielony: rzeczywisty wynik ok; czerwony: odmowa. Nie przejmuje blokad, nie zatwierdza otwartych szkiców i nie udaje ACK. Nowy lokalny commit, utrata potwierdzenia lub offline resetują wskazanie. Zachowane istniejące 2/5 minut, ręczny zapis i Wyjdź.
- Osobna ścieżka generowania zapisuje wyłącznie niezależną historię oferty i jej własny outbox. Źródła to zweryfikowane, przypięte rewizje pokoi z istniejącymi hashami, CAS, autoryzacją i porównaniem świadków wewnątrz transakcji IndexedDB. Brudna replika, niepotwierdzony outbox, zmieniony kontekst, aktywna niezakończona edycja lub cofnięte uprawnienia nadal odmawiają.
- Generowanie nie nabywa edytora i nie zmienia statusów pomieszczeń. Jawna akceptacja, promocja, usuwanie i zmiana statusów pozostają w istniejących chronionych przepływach. Nowa granica generationOnly dodatkowo odmawia usunięcia/akceptacji/zmiany wcześniejszej treści i zapisów pokoi; jawna zamiana duplikatu zachowuje cały uzgodniony kontrakt i metadane akceptacji.
- Ostrzeżenie zawiera nazwy pomieszczeń i urządzeń, wskazuje możliwość brakujących zmian. Nie jest zapisem ani potwierdzeniem zakończenia pracy na innym urządzeniu. Nie daje przejęcia przy nieznanym stanie.
- Uwolnij używa istniejącego PIN-u, atomowego CAS/epoch przejęcia oraz zwykłego zwolnienia własnego edytora. Przed operacją trwale zapisuje komplet intencji w control. Kolejne kroki są wznawialne i rozpoznają już wykonane zwolnienie bez drugiego epoch lub publikacji projektu. Serwerowe statusy, a nie zniknięcie okna, potwierdzają wynik. Receipty zachowują pełny dowód intencji/obserwacji, bez PIN-u.
- Początkowy i ponowny bind runtime wznawia wyłącznie już zatwierdzone intencje. Odmowa zachowuje marker i odcina zapis danej generacji. Wspólna rezerwacja obejmuje także asynchroniczną weryfikację PIN-u, aby równoległe resume nie zgłosiło zakończenia przed etapowaniem.
- Dotychczasowe testy klikają nowe Tak tam, gdzie świadomie generują z cudzej potwierdzonej rewizji. Zachowują asercje cen, źródeł, ACK, restartu, abortu, konfliktów i historii. Nowe testy oddzielnie sprawdzają wszystkie trzy decyzje.

## Dowody i stan kontroli

**CODE_READY pakietu / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING.** Końcowy wspólny run czterech scenariuszy UI: 4/4 PASS, 0 FAIL, 0 SKIPPED, exit 0 (663,536 s); nowy normalny przebieg 132,882 s i SIGKILL 151,848 s, dotychczasowy receiver/wariant 223,765 s i szybkie usuwanie 153,103 s. Nowa ścieżka nie zwiększa wysokości paska i pozostawia niewysłany trzeci korpus poza wycenianą potwierdzoną wersją. Pełny Preflight nie był uruchamiany. Logi izolowanych testów: `/tmp/meble-resume.e8R06r/manual-quote-*`; artefakty `/tmp/meble-p0b-normal-*`. Testy Firebase używają wyłącznie `demo-meble-app`, Auth 19099 i Firestore 18080. Testy UI to rzeczywiste profile Chromium i kliknięcia, nie atrapa SDK. Jednostkowy model protokołu jest opisany osobno i nie zastępuje emulatora.

Dotychczasowe ustalenia:

- Domenowe granice/kontrakty: 25/25 PASS (13 startup, 7 proof oferty, 5 nowych quote-access; ostatnie rozszerzenia sprawdzane celowanie).
- Rzeczywiste transakcje IDB: 2/2 PASS (nowe intencje oraz istniejąca historia z dodatkowymi negatywami generationOnly) — etapowanie obu blokad, nieaktualna baza, obcy zakres, abort przed/po commicie, SIGKILL/restart, archiwum i nienaruszone pokoje/replice/outbox.
- Wersje, manifest, 353 skrypty, kontrola pokrycia CI, login 36/36, bezpieczeństwo historii 7/7, duplikat oraz odczytowy kontrakt źródła PASS. Plan obowiązkowy: 36 segmentów P0-B/P1, 58 przypadków; dotychczasowe 36 grup smoke zachowane.
- Rzeczywisty stary worker BASE → nowy worker: PASS. Pełne manifesty, waiting/ACK, naturalna aktywacja po bezpiecznym wyjściu, brak wymuszonego reloadu; dirty RAM/formularz, RAW, cztery magazyny IDB i uncertain outbox zachowane.
- Pierwsza błędna asercja końca testu oczekiwała odmowy lokalnego Save zanim stare urządzenie pozna nowy epoch. LOCAL-FIRST dopuszcza w tym momencie zachowanie danych lokalnie; bezpiecznym kryterium jest odmowa starej publikacji/ACK i zachowanie danych. Główny Save aktualizuje własny updatedAt. Asercje obejmują dokładną pozostałą treść i brak zmian pozostałych rekordów.
- RED restartu: trwały marker quote-release pozostawał po restarcie, bo dotychczasowe resume uruchamiały dopiero późniejsze zdarzenia. Poprawka bind i celowany test rzeczywistego SIGKILL potwierdzają GREEN: marker jest zamykany automatycznie, jedna zmiana epoch, zachowana historia, szkic, outbox i brak starej publikacji.
- Jeden przebieg odmówił już w istniejącym setupie otwarcia inwestora (permission-denied), przed nowym scenariuszem. Ślad i asercja zachowane; nie przypisano mu PASS, nie zmieniano Rules ani dodawano retry. Kolejny przebieg doszedł do nowego scenariusza. Osobne ryzyko sporadycznego współbieżnego setupu pozostaje jawne.

## BRAKUJE / ryzyka

Pełne CI i odbiór właściciela na telefonie wymagają osobnej próby. PIN pozostaje świadomym potwierdzeniem klienta, nie tajną ochroną egzekwowaną przez Rules. Zwolnienie nie pobiera niewysłanych danych. Kilka blokad to odtwarzalne operacje CAS, nie globalna transakcja: przy konflikcie część może być już zwolniona, ale aplikacja nie pokazuje pełnego sukcesu i odświeża listę. Nie wolno utożsamiać tego z częściowym zapisem projektu/oferty — te zapisy nadal są atomowe. Niepotwierdzona własna baza lub uprawnienia mogą nadal wstrzymać wycenę także po Tak.

## PROPONOWANE

Celowane kontrole PASS; jeden commit/push i CLEAN, następnie odrębne wydaj dla tego pakietu. Bez samodzielnego PR, Actions, merge lub operacji LIVE.

## Pliki pakietu

- `.github/workflows/preflight-js.yml`
- `CURRENT_STATE.md`
- `dev_tests.html`
- `docs/plans/LOCAL_FIRST_ROADMAP.md`
- `index.html`
- `js/app/wycena/wycena-tab-shell.js`
- `offline-assets.js`
- `sync/application-authority.mjs`
- `sync/application-p0b-runtime.mjs`
- `sync/application-quote-ledger.mjs`
- `sync/application-replication.mjs`
- `sync/application-runtime.mjs`
- `sync/application-write-boundary.mjs`
- `sync/local-first-idb.mjs`
- `sync/local-first-quote-contract.mjs`
- `sync/local-first-quote-store.mjs`
- `sync/local-first-rescue-state.mjs`
- `sync/local-first-sync.mjs`
- `tools/ci-sharding-smoke.js`
- `tools/firebase-pilot/normal-application.cases.mjs`
- `tools/firebase-pilot/p0b-normal-application.test.mjs`
- `tools/firebase-pilot/p0b-phone-quote-flow.cases.mjs`
- `tools/firebase-pilot/p0b-quote-removal.cases.mjs`
- `tools/firebase-pilot/p0b-quote-variants.cases.mjs`
- `tools/firebase-pilot/p0b-room-storage.test.mjs`
- `tools/firebase-pilot/p1-project-sync.cases.mjs`
- `tools/firebase-pilot/playwright-sync-ui.test.mjs`
- `tools/firebase-pilot/quote-tab-regressions.cases.mjs`
- `tools/p0b-ci-plan.js`
- `tools/script-versions.js`
- `sync/application-manual-sync.mjs`
- `sync/application-quote-access.mjs`
- `sync/application-quote-release.mjs`
- `sync/application-quote-warning.mjs`
- `sync/local-first-quote-release.mjs`
- `tools/firebase-pilot/p0b-manual-quote.cases.mjs`
- `tools/firebase-pilot/p0b-quote-access.test.mjs`
- `tools/firebase-pilot/quote-ui-actions.mjs`
- `tools/reports/manual-sync-quote-warning-20261122.md`
