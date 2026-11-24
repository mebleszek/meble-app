# Ręczna synchronizacja i wycena zajętych pomieszczeń — 22.11.2026

## Brak czasu i odległości przed WYCENĄ — 24.11.2026

**USTALONE:** właściciel zatwierdził implementację i wydanie czterech opcji. BASE/main c684df4e1b74fa121b12693d334a1294096f48cf; nowa gałąź feat/quote-missing-route-20261124, wejściowo CLEAN. Poprzedni PR168 jest RELEASED: HEAD e740fe4484697e9ab3b54391cea785a0db0d8fef / BASE9fac02d7ebd59e4e14290e2a580038650cb5c427, Preflight1398(45470917364)81 PASS/0 FAIL/2 nieobowiązujące SKIPPED, exact Pages45472285929 i publiczne bajty532/532 PASS. Ready→kontrola9:09,614; kolejka do283 s, najdłuższy test198 s. Automatyczny odczyt Pages uruchomił kontrolę bajtów po8,678 s zamiast poprzednich48,672 s; nie zmieniono workflow ani testów.

- **WDROŻONE w kandydacie:** przy dostawie/wnoszeniu/montażu i niekompletnej albo nieaktualnej trasie zwykłe Wyceń otwiera formularz przed synchronizacją źródeł i kosztownym kalkulatorem. Ten sam zatwierdzony shell/formularz i przyciski, bez nowych stylów lub przebudowy innych ekranów.
- Zapisz i wyceń: jawne km/min w jedną stronę trafiają przez investorPersistence i zwykłą transakcję auto do wspólnej kartoteki, niezależnego CAS/outboxa; usuwa się wyłącznie nieaktualne świadki ORS, jak w dotychczasowym ręcznym formularzu. Istniejące zaokrąglenia/minima/mnożnik pozostają. Puste/ujemne/nieliczbowe dane odmawiają, jawne0 jest liczbą, nie brakiem.
- Anuluj/X/Escape: brak zapisu i liczenia. Odbiór osobisty: jawne wyłączenie dostawy, wnoszenia i montażu w bieżącym drafcie przez istniejący saveSettings; trasa inwestora, pozostałe ustawienia i zamrożone oferty bez zmian. Przejdź do danych inwestora: zwykła trwała nawigacja, zakończenie próby, bez oferty i automatycznego wznowienia po powrocie.
- Guardy kontekstu kontrolują konto, inwestora, projekt, draft, kartotekę, adres firmy, aktywną edycję i granicę zapisu po oczekiwaniu oraz wewnątrz ręcznego zapisu. Wymagane dotychczasowe uprawnienia, źródła PCV, CAS, blokady, ACK i atomowość pozostają; bez admin Firebase LIVE, migracji, zmian cen/formuł i historii.
- **TESTY / BRAKUJE:** istniejący investor-create-transport ma RED starej ścieżki Wyceń (nie otwiera okna)→GREEN oraz ręczny zapis/restart, cztery opcje, jawne0, błędne dane, stary świadek i sześć zmian kontekstu. Transport catalog i transport-settings-pricing (rzeczywista WYCENA/harmonogram/minima/puste/zero/14 domen) PASS; powiązana część4 quote-performance6/6 PASS, wzorce UI7/7 PASS. W istniejącym podpisanym scenariuszu Chromium/DEMO dodano realny formularz, przerwaną nawigację, pickup, abort IndexedDB i zmianę kartoteki drugiego profilu; GREEN1/1 (309387 ms): manualne12 km/30 min i24 km do wyceny, poprawny odbiór drugiego profilu, niezmienione dwa pokoje/ceny/źródła/globalne, jedna rewizja oferty i ACK po SIGKILL bez ponownej publikacji. Wcześniejsza próba zatrzymała się na zbyt szerokim selektorze role=alert (ukryty błąd Auth oraz lokalna walidacja); selektor zawężono do badanego modala, bez osłabiania asercji. Kontrola zrzutu ujawniła ciasny footer przy małej wysokości; użyto w całości istniejącego przewijanego modala WYCENY, bez nowego CSS. CI: nadal36 grup/265 jednostek i37 segmentów/61 przypadków, bez nowego joba i lokalnego pełnego Preflightu.
- **AUDYT TECHNICZNY:** końcowa bramka wykazała fałszywy rozrost belki602→602: git(show).trim usuwał końcowy LF tylko z bazy i porównywał601 z602. Odczyt bazowego bloba zachowuje teraz dokładne bajty. RED→GREEN istniejącego preflight-phases-smoke dowodzi dopuszczenia niepowiększonego modułu oraz dalszej odmowy faktycznego rozrostu, nowego dużego modułu i przekroczenia progu;32/32 dotychczasowe kombinacje agregacji zachowane. Progi250/400/600, mieszana odpowiedzialność i wyjątki bez zmian. Końcowy audyt0 blokad.
- **PROPONOWANE:** po kompletnych kontrolach jeden commit/push i zatwierdzone wydanie przez pełne CI, automatyczny merge, exact Pages i publiczne bajty. Aktualny status implementacji: CODE_READY / CI_PENDING / RELEASE_BLOCKED. Odbiór właściciela w zwykłym Edge pozostaje odrębny od testów DEMO.


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

## Naprawa PR #163 po Preflight #1384

Zgoda właściciela: „Napraw i wydaj”. Ten sam PR/gałąź, wejściowy HEAD `eac56ee8218891b9d32a768fac813669534c143f`, BASE `9b5c0d21ee188f84014941326a5ee94b98f11881`. [Run 45060309724](https://github.com/mebleszek/meble-app/actions/runs/45060309724): 38 success / 43 failure / 1 skipped. PR nie został scalony; Pages i dane LIVE bez zmian. Poniżej przyczyny, bez przypisywania wyników historycznych nowemu SHA.

| Pierwotne FAIL / agregaty | Dowód i korekta |
| --- | --- |
| playwright-local-ui, playwright-sync-ui, firebase-current 3c/3d/3e, smoke 14 oraz 16 | Niepoprawne cztery wpisy manifestu: `application-p0b-runtime.mjs` 25822→25819 bajtów; `application-quote-release.mjs` 3067→3065; `local-first-quote-contract.mjs` 9348→9347; `local-first-quote-store.mjs` 5191→5189. Lokalny generator widział CRLF, commit Git LF. Prawidłowa odmowa instalacji/ACK. Ujednolicenie tekstu przez `.gitattributes`, nowy manifest z właściwych bajtów i dodatkowa kontrola HEAD/index przed klonowaniem/SDK. |
| P0-B: quote-receiver-variant, room-quote-acceptance-conflict, manual-quote-restart, background-resume, duplicate-replacement, desktop-presence, manual-sync-quote, quote-remove-overlap, tab-save, quote-remove-combined, room-quote-acceptance, startup-draft-recovery, project-batch-quote, room-quote-variants, quote-remove-single, room-quote-promotion, project-offline-quote, signed-quote, normal-clean, signed-startup, signed-clean, project-batch-recovery, room-quote, normal-startup, room-quote-staging, project-batch-timer | Ta sama odmowa workera przed gotowością aplikacji, a nie 26 dowodów błędów domenowych. Każdy segment pozostaje obowiązkowy w nowym CI. Lokalnie tylko reprezentatywne scenariusze signed DEMO/IDB/ACK z kanonicznych bajtów Git. |
| smoke 2 oraz 23 | `ReferenceError: installManualSync is not defined`. Stare `new Function` nie przekazywały nowej zależności runtime. Testy importują rzeczywistą implementację; brak nagłówka jest jawny w ich ograniczonej atrapie dokumentu. Zachowane negatywy i oryginalne asercje. |
| smoke 5, 10 oraz 16 | `setup: LF_CDP_TIMEOUT`. Logi nie określały metody, więc dokładna przyczyna każdego historycznego zawieszenia pozostaje niepotwierdzona. Helper wcześniej oceniał RAM zaraz po ACK nawigacji; teraz czeka na zgodny frame/loader DOMContentLoaded, wybiera właściwą kartę i opisuje metodę odmowy. Bez wydłużenia deadline ani retry. Celowane rzeczywiste testy zachowują pełne asercje. |
| smoke 18 | `RECOVERY_UPGRADE_TIMEOUT_UPDATE_NOTICE`, po trzech zaliczonych grupach recovery. Prawdziwy stary worker nie mógł zainstalować nowej wersji z niezgodnym manifestem. Test starego przypiętego commita→nowy kanoniczny obraz przeszedł bez adaptacji asercji historycznego ekranu i bez wymuszania przejęcia. |
| smoke 22 | Po udawanym bezruchu zarejestrowano prawdziwy pointerdown/up/click na `business`, zamiast Google login. Próbkowanie punktu odbywało się bez stabilizacji. Natywny mouse helper używa istniejącego protokołu stabilnego celu, kończy zaległy scroll przed próbkowaniem i dodatkowo potwierdza dokładnie jeden trusted pointerdown/up na celu; nie ponawia gestu i nie wywołuje handlera sztucznie. |
| firebase-current, preflight, ci-summary, auto-merge | Cztery zależne FAIL; prawidłowo zablokowały merge i Pages. Bramek nie osłabiono. |

Nowa regresja w istniejącym `offline-shell-smoke.js` używa prawdziwego repo Git z `core.autocrlf=true`: błędny manifest po normalizacji indeksu daje RED, poprawione LF GREEN; testuje też dokładne bajty binarne, niepełny inwentarz, niedozwolone tryby i odmowę Safety przed jakimikolwiek skutkami clone/install/env. Sprawdzane są bloby, nie tylko zgodność lokalnej kopii. Kontrola uruchamia się w istniejącym kroku Safety i przygotowaniu runnerów, więc zły pakiet kończy się przed kosztownymi instalacjami. Testy biznesowe i 425 pinów pozostają.

Pomiar zakończonej próby #1384: początek obsługi 19:20:56 UTC, Ready 19:21:37, safety PASS 19:21:52, ostatni leaf 19:27:01, koniec 19:27:23. Cała obsługa **6:27**, CI od utworzenia **5:43**. Przygotowanie 41 s, Ready→safety PASS 15 s, safety→ostatni leaf 5:09, agregaty/odmowa merge 22 s. Najdłuższa kolejka 3:26; najdłuższy runner 3:18, testy 3:08. To nakładające się etapy, nie składniki do bezpośredniego sumowania. Sumy 4602 runner-sekund i 6814 sekund kolejek nie są czasem ściennym. Obserwowano najwyżej 20 równoczesnych runnerów.

Optymalizacja wdrożona w tym zatwierdzonym pakiecie: szybka odmowa niezgodnych bajtów w Safety oszczędza całą zbędną falę runnerów przy tym rodzaju uszkodzenia; nie jest obietnicą przyspieszenia zdrowego wydania. Dalsza propozycja, niewdrożona: kalibracja 24 fizycznych runnerów według pomiarów pełnego zdrowego przebiegu, z zachowaniem 36 logicznych grup, oraz ocena limitu współbieżności konta. Potencjalnie skraca drugą falę kolejki, ale wymaga decyzji właściciela i może zwiększyć koszty; nie gwarantuje 4 minut. Po końcu testów pozostaje 22 s agregatów, więc samo przyspieszenie Actions po testach nie odzyska ponad 2 minut. Brak próby ukrycia obowiązkowych scenariuszy, realnych timerów i ACK.

Kontrole kandydata: realny Git HEAD poprzedniego commita RED, poprawiony INDEX GREEN (526 plików; manifest `7c23d3e44619baef6727df688d7897bea90860d3ae3e1ece469a3cd39b4aa99f`); regresje Git/worker PASS; diagnostyka first-sync 10/10, recovery 7/7, gotowość native gesture/loader, granice aktualnego CLOUD i 11 grup niezawodności CI PASS. Skrypty i wersje PASS; inwentarz pozostaje 234 pliki smoke / 265 jednostek / 36 grup, P0-B/P1 37 segmentów / 59 przypadków.

Realny Chromium z kanonicznego archiwum indeksu Git: trusted-session (pierwotny błędny target logowania), local-cabinet (17 wariantów/restart), quote-final-material, android-local-first oraz stary worker→nowy PASS. Osobny signed DEMO manual quote: **1/1 PASS, 153,470 s**, zero skipped, poprawne zamknięcie emulatorów. Scenariusz startup-draft uzyskał PASS (127,342 s), jednak jego pierwszy wspólny proces testowy nie jest pełnym PASS: równolegle działały rozbudowane lokalne testy Chromium, a manual quote odmówił `checking-installation / LF_WRITER_FENCE_UNCONFIRMED`; po wynikach proces pozostał otwarty i zakończono wyłącznie jego własne procesy testowe. To odrębna lokalna odmowa, nie rozstrzygnięta diagnoza pierwotnego CI. Po usunięciu współbieżnego obciążenia manual quote przeszedł samodzielnie, bez zmian produkcji, timeoutów, fixture ani retry w aplikacji. Dwusekundowy wymóg potwierdzenia blokady pozostał; ryzyko presji środowiska jest jawne, a pełny CI nadal obowiązkowy.

Playwright localOnly z kanonicznych bajtów Git: **2/2 PASS, 145,431 s**, zero skipped — rzeczywiste przyciski inwestora i szafki, IndexedDB, ponowne otwarcie i restart. Pierwotny `FIXTURE_WORKER_INSTALL_REFUSED` nie występuje; asercje zachowane. Statyczne kontrole bez pełnego smoke: 769/769 składni JS, 353 skrypty kolejności, audyt zależności i storage PASS. Lokalnie 263,928 s (w #1384 analogiczny krok GitHub trwał 19 s); nie należy utożsamiać wolniejszego lokalnego środowiska z czasem runnera.

## Wycena 3 szafek

Archiwum końcowej notatki poprzedniej korekty: dowody lokalne `/tmp/meble-pr163-fix.b2ROeD/` — `manifest-final.log`, `trusted-click.log`, `cabinet.log`, `quote-final.log`, `local-start.log`, `update.log`, `demo-targeted.log` (zachowany FAIL), `manual-isolated.log` (GREEN) i `local-ui.log`; trace/screenshot pierwszej odmowy `/tmp/meble-p0b-normal-KTNJXL/`. Wówczas wynik następnej próby wydania pozostawał do podania. W tamtej korekcie nie zmieniono kodu kalkulatora, UI, uprawnień, biznesowych Rules ani LIVE. Natywne narzędzia Windows/Git sprawdzono na Windows; testy Chromium w izolowanym WSL/Linux, bez przypisywania ich wyniku fizycznej przeglądarce użytkownika.

Poprzedni pakiet PR #163 zakończono po korekcie jako wydany: #1385 81 PASS /0 FAIL /1 nieobowiązujący documents SKIPPED, merge/exact Pages `93d8fc51673a446555294455d279ac887e9d7be3`, publiczne bajty 528/528 PASS. Dawne dowody `/tmp/meble-pr163-fix.b2ROeD/` i `/tmp/meble-p0b-normal-KTNJXL/` dotyczą tego wcześniejszego pakietu; jego zamknięty pomiar i wynik zachowano również w `../pr163-1384-repair-evidence-b2ROeD/release-result.json`.

Zlecenie właściciela 22.11.2026: przeanalizować i przyspieszyć wycenę po nagraniu telefonu. BASE/main `93d8fc51673a446555294455d279ac887e9d7be3`, gałąź `fix/quote-start-latency-20261122`. PR #163 został wcześniej wydany przez #1385; poniższa korekta nie jest jeszcze wydana.

**USTALONE.** Nagranie ma 36,518 s, 1008×2244. Pokazuje oczekiwanie przed wynikiem, następnie nową wycenę; nie zawiera jednoznacznego znacznika chwili dotknięcia, więc sam film nie daje dokładnego czasu kliknięcie→wynik. Materiał odczytano lokalnie przez Chromium, bez dostępu do danych aplikacji właściciela. Profil pełnego signed DEMO (kuchnia z trzema szafkami i drugie niezależne pomieszczenie) wykazał dominujące stosy `project-pcv-resolver.collect → getForCalculation → roomContext → roomQuoteSources.context/capture → projectPcvPolicy/readAll/normalizeProjectData → clone`. 19444 z 27386 próbek znajdowało się pod `capture` (około 71% próbek; nie utożsamiać z dokładnym czasem ściennym). To wielokrotne sprawdzanie/klonowanie tych samych źródeł, nie koszt arytmetyki ani samo porównanie ofert.

**WDROŻONE.** Jedyna zmiana zachowania produkcyjnego jest w `project-pcv-overrides.roomContext`: ścieżka niezależnych pomieszczeń przestaje omijać już istniejącą mapę odczytu synchronicznego. Każde pomieszczenie przechodzi pełną dotychczasową walidację raz na zakres. Późniejsze odczyty korzystają z tego samego źródła, a przed zwróceniem wyniku pozostaje niezmienione sprawdzenie świadków RAW/RAM/wyboru inwestora/projektu/katalogów. Klucz zawiera flagę kalkulacji, więc wynik odczytu obcego pomieszczenia nie zostaje uprawnieniem do edycji. `finally` usuwa zakres, Promise jest odrzucana, a następna wycena weryfikuje źródła od nowa. Brak cache między operacjami i brak zmiany cen, formuł, globalnego modelu, historii, UI, outboxa, CAS, PIN-u lub Rules.

**RED→GREEN.** Deterministyczny test z trzema szafkami w każdym z dwóch pomieszczeń: 58 wywołań pełnego kontekstu zamiast 2 (RED); po korekcie dokładnie 2 (GREEN). Nowe negatywy: odczyt nie daje prawa edycji innego pokoju, zwracane wartości nie aliasują źródła, zmiana danych między wycenami jest widoczna, zmiana reentrantna odmawia, Promise odmawia, a błąd zwalnia zakres. Osobne porównanie rzeczywistego kodu BASE z kandydatem w tej samej fixture potwierdziło dokładną równość PCV, agregatu i czterech linii materiałowych/cen dla sześciu szafek; RAW i zapisy pozostały identyczne.

**Pomiar porównawczy.** Rzeczywisty Chromium/Firestore+Auth Emulator DEMO; ten sam profil testowy, 120 ms kontrolowanego opóźnienia sieci, bez spowolnienia CPU w porównaniu końcowym, z samplerem V8. Okno instrumentacji do przywrócenia przycisku: 32,660→15,472 s (około 53% krócej). Faza napisu „Liczę…”: 25,273→8,362 s (około 67% krócej). Pierwsze pojawienie się napisu w oknie 7,387→7,109 s, więc początkowe oczekiwanie nadal pozostaje i nie należy twierdzić, że skróciło się o 67%. W kandydacie potwierdzenie przed transakcją zajęło około 3,2 s, zbieranie danych 6,188 s, dwa wywołania planowania łącznie 1,089 s, dwa porównania duplikatu łącznie 31 ms. To pomiary pojedynczych kontrolowanych przebiegów z narzutem profilera, nie SLA ani pomiar fizycznego telefonu; sumy RPC nie są czasem ściennym. Instrumentacja bazowa nie rozpoznawała opcjonalnych API przez nazwę leksykalną `FC`; obserwator DOM i profiler V8 działały. Kandydat odwołuje się jawnie do `window.FC` i dodatkowo rozdziela etapy. Wynik ilościowy budżetu odczytu pozostaje niezależny od tej instrumentacji.

**Kontrole.** Kontrakty quote proof 9/9, efektywne PCV 30/30, własność PCV 33/33, RAM/zapis/historia 12/12 PASS. Celowany istniejący signed UI/DEMO: 1/1 PASS, zero skipped, 185,539 s lokalnie z profilem i opóźnieniem; rzeczywiste przyciski, kuchnia z trzema szafkami, drugi profil/pomieszczenie, źródła, IDB/outbox, odbiór, utrata ACK i restart pozostały. Obserwator w obowiązkowym teście sprawdza dokładnie jeden pełny kontekst na pomieszczenie w każdym z 23 synchronicznych odczytów, zamiast kruchego progu czasu. Dodano dwa obowiązkowe przypadki w istniejącym segmencie `room-quote-proof`; 37 segmentów /61 przypadków oraz 36 grup smoke (234 pliki /265 jednostek) pozostają kompletne. Nie wykonano pełnego lokalnego CI ani GitHub Actions.

**BRAKUJE → PROPONOWANE.** Pełny CI dla nowego HEAD i odbiór telefonu po osobno zatwierdzonym wydaniu. Nie usuwać pełnego flush/świeżego sprawdzenia zajętości tylko dla szybszego startu. Gdy potrzebna będzie dalsza optymalizacja, mierzyć pozostałe walidacje/renderowanie i oczekiwanie na synchronizację; zmiana ich kontraktu lub komunikatu wymaga odrębnego uzgodnienia. Pierwsze próby instrumentacji miały dwa błędy obserwatora i zbyt ciężki profil 4× CPU zakończony timeoutem screenshotu; nie są oznaczane jako RED aplikacji ani PASS. Ich logi zachowano, a timeoutów produktu/testów nie zwiększano.

Dowody lokalne poza repo: `../quote-start-evidence-20261122/` — klatki nagrania, `profile-before.json`, `profile-after.json`, `cpu-before.json`, `cpu-after.json`, `base-versus-candidate-values.json`, `baseline-signed.log`, `green-signed.log`; pozostała diagnostyka `/tmp/meble-quote-perf.AxON2Y/`. Samo archiwum kandydata z Git INDEX potwierdzono zgodnym z manifestem. Nowy pakiet jest CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING.

Natywne narzędzia i kontrakty sprawdzono na Windows; testy Chromium/Emulator i profilowanie wykonano w izolowanym WSL/Linux. Oba środowiska pozostają odrębne od fizycznego telefonu i danych użytkownika.

## CI 1386 i ochrona powtórnego dodania

Właściciel zatwierdził wydanie i przyczynowe naprawy ewentualnych FAIL wraz z kolejnymi próbami do PASS, w tym samym bezpiecznym zakresie. [PR #164](https://github.com/mebleszek/meble-app/pull/164), [Preflight #1386](https://github.com/mebleszek/meble-app/actions/runs/45071193471), HEAD `e259409ce0bd3207c582aff7d6f7d71f2354eee0`, BASE `93d8fc51673a446555294455d279ac887e9d7be3`. Końcowo 77 PASS /4 FAIL /1 nieobowiązujący documents SKIPPED; main bez zmian, merge i Pages nie nastąpiły.

Jedyny pierwotny FAIL to `firebase-p0b (signed-quote)`, job `137358350036`: `addCabinet`, wywołanie dodatkowej szafki, `locator.click: Timeout 30000ms`, `#cabinetTypeChoices .choice-tile` istnieje, lecz jest niewidoczny. Test nie dotarł do sprawdzania wyceny. Pozostałe FAIL `firebase-current`, `ci-summary`, `auto-merge` są zależne i prawidłowo blokują wydanie.

Przyczyna potwierdzona w rzeczywistych źródłach: `actions-register.js` odmawia `add-cabinet`, gdy `FC.actions.isLocked('add-cabinet')`; `js/core/actions.js` ustawia domyślny TTL 800 ms jako ochronę pointerup→click. Szybki runner zakończył poprzedni formularz i wysłał kolejne Dodaj przed wygaśnięciem tego samego guardu. Kliknięcie było prawidłowo odrzucone; ukryty wybór typu pochodził z zamkniętego modala. To nie alternatywny wariant formularza ani dowód błędu cen. Wolniejszy lokalny przebieg z profilerem/opóźnieniem nie wykazał wyścigu.

Poprawka dotyczy wyłącznie wspólnego helpera testowego: przed pojedynczym rzeczywistym kliknięciem odczytuje `isLocked===false`, następnie wymaga widocznego modala i wykonuje dotychczasowy wybór typu/wymiarów/zapis. Nie czyści ani nie obchodzi guardu, nie zmienia jego czasu, nie dodaje stałego sleep/retry, force-click ani wywołania handlera zamiast UI. Regresja trzech szafek celowo uzbraja istniejący domyślny guard przed dwoma następnymi dodaniami, potwierdzając jego aktywność; nadal wymaga pełnego UI, trzech trwałych szafek, budżetu PCV, historii, źródeł, ACK i restartu. Produkcyjna optymalizacja, UI i pozostałe asercje pozostają bez zmian. Inwentarz nadal 37 segmentów /61 przypadków oraz 36 grup smoke /234 pliki /265 jednostek.

Próba #1386: początek obsługi 21:15:51 UTC, Ready 21:16:39, run utworzony 21:16:43, zakończony 21:23:58. Obsługa do FAIL 8:07, sam run 7:15; publikacji nie było. Dominuje wykonywanie i kolejka runnerów, nie etap Pages. Kolejna próba będzie osobno mierzona; nie oznaczać poprzedniego CI jako PASS.

Celowana weryfikacja po korekcie: rzeczywisty istniejący signed scenariusz Chromium/Emulator **1/1 PASS, 180,274 s, zero skipped**, bez profilera ani dodatkowego spowolnienia sieci/CPU. Oba kontrolowane guardy uzbrojono przez rzeczywiste API, a dalsze kroki wykonano wyłącznie natywnym UI po ich naturalnym wygaśnięciu. Nadal potwierdzono trzy trwałe szafki, jeden odczyt źródła na pomieszczenie w zakresie synchronicznym, pełną historię, IDB/outbox, niezależne źródła, restart i uzgodnienie utraconego ACK. Pełne CI nie było powtarzane lokalnie; produkcyjny pakiet i manifest pozostają identyczne. Kontrola przydziału CI, składni, diffu oraz dokładnych bajtów Git INDEX PASS. Log: `../quote-start-evidence-20261122/replay-guard-green.log` (także `/tmp/meble-quote-perf.AxON2Y/replay-guard-green.log`). Następna zatwierdzona próba używa tego samego PR i nowego, jawnie zweryfikowanego HEAD/BASE.

## CZYNNOŚCI — zachowana historia diagnostyki 23.11.2026

Migawka wcześniejszych, zastąpionych etapów; aktualny stan wyłącznie w CURRENT_STATE.md.

## CZYNNOŚCI — zatrzymanie po wejściu, 23.11.2026

**BLOCKED / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING.** Wcześniejsza wersja poprawki zawieszenia zaliczona celowanie; aktualny zawężony pakiet i wspólna regresja WYCENY pozostają niepotwierdzone. Gałąź `fix/activities-session-reentry-20261122`, HEAD/BASE/main `c9fe7a681f98ca9f62d716ff95e3f83025dacb25`, cały pakiet DIRTY, bez commita/pusha/PR. Materiał: `screen-20261122-231602-1795385460931.mp4`. Bez zmiany UI, cen, wzorów, blokad i Firebase LIVE.

- **USTALONE.** Trzy szafki i rzeczywiste 122 definicje fabrycznej robocizny: 1884 pełne odczyty/normalizacje źródeł pomieszczeń na render, profil CPU 155,834 s, rzeczywisty klik przekraczał dotychczasowy limit Playwright. Dwie syntetyczne definicje fixture nie ujawniały problemu. Samo ograniczenie źródeł do dwóch odczytów dało 58,121 s i nadal RED. Druga przyczyna: odczyt jednego faktu obliczał wszystkie fakty, w tym sześć wywołań logistyki wnoszenia dla pytania o szerokość.
- **WDROŻONE.** Istniejący synchroniczny zakres PCV obejmuje render CZYNNOŚCI; konsumenci otrzymują kopie, zakres kończy się przed await/po wyjątku. Kod publicznych kolektorów robocizny ostatecznie bez zmian względem BASE. Świadek RAW/RAM/katalogów obejmuje także pomieszczenie i kontekst sesji. Pojedynczy fakt liczy tylko wskazany kalkulator; pełna mapa zachowuje obliczenia. Rewizje/piny nadal odczytywane świeżo, bez cache uprawnień i planów zapisu.
- **DOWODY.** RED 1884 → GREEN [2,2] odczyty w dwóch wejściach. Render 1956,9 /1716,9 ms przy 122 definicjach, nie pomiar telefonu. Wcześniejszy kandydat: signed DEMO/Chromium 1/1 PASS (161,871 s całego scenariusza): MATERIAŁ→CZYNNOŚCI, akordeon, nienaruszony IDB/outbox, SIGKILL/restart i dotychczasowy zapis/abort/retry/offline. Kontrakty 9/9, PCV 30/30, właściciel 33/33, fakty, plan pracy, raport UI i normy 9/9 PASS. Wszystkie pojedyncze fakty równe pełnej mapie; width nie liczy wnoszenia, pełna mapa nadal je liczy. Rozszerzono istniejące tab-save/room-quote-proof: bez nowego joba/topcase, nadal 36 grup smoke, 37 segmentów P0-B/P1 i 61 przypadków.
- **BRAKUJE / GRANICE.** Pełny CI, telefon i osobne odtworzenie SESSION_OWNER_MISMATCH. W odtworzonym UI/restart nie było odmowy właściciela; nie kasowano historycznego błędu ani guardów. Dodatkowa diagnostyczna kombinacja pełnego katalogu i realMainAuth zatrzymała fixture na initial-global-revision przed scenariuszem (dotychczasowa gotowość 30 s); nie jest PASS ani dowodem błędu CZYNNOŚCI. Obowiązkowe scenariusze rzeczywistego Auth pozostają bez zmian; tab-save zachowuje wcześniejszy mechanizm logowania i dodatkowo podpisaną aktywację.
- **REGRESJA I STOP.** Signed-quote nie zaliczony dla kandydata: pierwsza próba zatrzymała się na initial-global-revision; trace pokazuje niedokończony HTTP documents:batchGet, wcześniejsze odpowiedzi 200, bez kodu błędu SDK. Porównanie tego samego scenariusza z kodem BASE: 1/1 PASS, 161,164 s. Ponowny pomiar kandydata przeszedł startup, lecz zatrzymał się przed wyceną na otwarciu inwestora przez drugi profil: p0b-normal-application.test.mjs:150, transakcja p0bRoomInvestors, permission-denied, Rules L493:24, brak pending RPC. To nie dowodzi przyczyny w zmienionym kalkulatorze ani błędu samych Rules. Nie rozszerzono odmów/whitelist, nie zmieniono Rules, timeoutów ani nie dodano retry. Nie uznajemy BASE PASS za PASS kandydata. Realny SW stary→nowy PASS: 198 pobrań, 328 zweryfikowanych użyć cache, szczyt 3; 503, opóźniona instalacja, aktywny RAM/klienci i dokładny RAW/IDB zachowane. Manifest Git INDEX 526 plików, wersje, kolejność, składnia zmian, zależności, storage i przydział CI PASS.
- **DALSZA DIAGNOSTYKA.** Przebieg z odczytowym zapisem obrazu transakcji przeszedł startup i otwarcie inwestora, następnie odtworzył błąd kandydata w łącznej WYCENIE: PCV read changed. Wycofano wyłącznie nowy wrapper kolektorów wyceny, przywracając ich dokładny kod BASE i poprzednie wersje; nie zmieniono świadka ani nie wyłączono walidacji. Dodano próbę wejścia w CZYNNOŚCI bez odtwarzalnych cache RAM szafek. Ostatni, zawężony kandydat nie dotarł do tej próby: final-tab-save.log, initial-global-revision przed scenariuszem, 75,027 s całego testu; final-signed-quote nie uruchomiony po tym FAIL. Wcześniejszych PASS nie przypisujemy zmienionemu pakietowi. Diagnostyczne instrumentowanie transakcji istniało tylko w izolowanym fixture i zostało wycofane.
- **PROPONOWANE.** Rozstrzygnąć niedokończone RPC inicjalizacji w emulatorze, następnie sprawdzić aktualny cold tab-save i signed-quote przed commitem/wydaniem. Bez dalszych retry w ciemno, podnoszenia timeoutów i zmian Rules. Logi/profil/trace/screenshot i nieudane próby zachowano poza Git: work/activities-video-evidence-20261122, work/activities-repair-evidence-20261123 oraz /tmp/meble-activities-ZBYjen (WSL). Bez resetów i umieszczania filmu w repo.


### WYCENA start 23.11.2026

**Zgoda właściciela:** przeanalizować i naprawić zatrzymanie po Wyceń, przed istniejącym stanem Liczę. Krótkie pierwsze otwarcie CZYNNOŚCI zgłoszone jako znacznie szybsze; nie rozszerzano tej zmiany na jego UI.

**Dwie przyczyny.** Request czekał na settingsSettled/whenIdle, synchronizację i potwierdzenie źródeł przed wejściem do generateQuote, które dopiero ustawiało isBusy. Brak potwierdzenia gestu nie oznaczał, że nic nie działało. Ponadto normalizeProjectRecord wywoływał normalizację pełnego projektu bezpośrednio, następnie ponownie w summarizeProjectData i jeszcze raz w roomKeysFromData. V8 wskazał ten łańcuch jako główny koszt kopii.

**Naprawa.** Ten sam przycisk przechodzi w dotychczasowe Liczę natychmiast, wraca po odmowie, a zadanie gestu kończy się przed kosztownym odczytem. Nie zmienia to isBusy kalkulatora ani momentu rozpoczęcia zapisu. Deduplikacja requestPending i sprawdzanie instancji writera/właściciela pozostają. Prywatne normalizedRoomKeys/summarizeNormalized konsumują znormalizowaną lokalną kopię; publiczne API nadal normalizują nieufne wejścia. Nie wprowadzono cache danych, ACK, uprawnień ani planów.

**RED→GREEN.** Przycisk wstrzymany lokalnym zapisem: Wyceń→Liczę przed oczekiwaniem, odmowa/zmiana właściciela przywraca przycisk i nie odtwarza usuniętego podglądu. Liczba normalizacji jednego rekordu 3→1, zgodne liczności i niezmieniony/niealiasowany RAW. Bench rzeczywistych fixture trzech szafek i dodatkowych pokojów oraz rekordu room-project: trzy pełne znormalizowane rekordy identyczne bajtowo; 30×3 wywołania po rozgrzewce 421,7806→148,1019 ms (sam CPU, nie wycena końcowa).

**Chromium/DEMO.** BASE i poprawka osobno na tej samej bazie e17b9be4, z tymi samymi źródłami i V8 profilerem: funkcjonalnie 1/1 PASS w każdej próbie, ceny/PCV/piny/historia, utrata ACK i SIGKILL/restart zachowane. Początek obserwacji→Liczę 3976,7→134,5 ms; collectQuoteData 6792,9→6229,2 ms. Cała obserwacja 12945,5→15035,4 ms, maksymalny long task 6730→7067 ms: obciążenie/profile sieciowe różniły się, więc brak dowodu równoważnego procentowego skrócenia całej wyceny. Nie ukrywać tego ograniczenia. Nowy stan przycisku obejmuje przygotowanie, zatem długości samej fazy Liczę nie porównuje się już wprost.

**Regresje i CI.** Pięć celowanych rzeczywistych przypadków performance 5/5 PASS, także zmiana inwestora i odebranie dostępu w await bez zapisu. Wcześniej natywna kompletna suite przerwana po 7 PASS; nie jest pełnym PASS. Zmienione istniejące quote-performance-smoke (jedna nowa regresja, cztery dotychczasowe części CI) oraz signed-quote/read-budget (natychmiastowy istniejący stan przed dostępem i maksymalnie jedna normalizacja rekordu, stary budżet źródeł nietknięty). Nie dodano joba, nie wyłączono asercji/scenariuszy. Końcowy nowy read-budget signed Chromium/DEMO 1/1 PASS, wraz z ponownym odblokowaniem aktualnie wyrenderowanego przycisku po pełnym commicie; PCV 33/33 i wykluczenie derivedFacts z trwałych danych PASS. CI i telefon pozostają.

**Ciągłość.** Rozpoczęte 38 plików szuflad/cenników i kopia ich diffu zachowane; ta naprawa ich nie resetuje ani nie aktywuje niekompletnego doboru. Nie wykonano commita/pusha/PR/Actions/wydania ani administracyjnego Firebase LIVE. Profiler i diagnostyka działały wyłącznie w izolowanym localhost DEMO, nie w kodzie aplikacji. Dowody: work/quote-start-evidence-20261123; /tmp/meble-quote-start-v3x9oqb3.