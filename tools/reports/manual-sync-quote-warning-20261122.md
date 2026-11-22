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

Dowody lokalne: `/tmp/meble-pr163-fix.b2ROeD/` — `manifest-final.log`, `trusted-click.log`, `cabinet.log`, `quote-final.log`, `local-start.log`, `update.log`, `demo-targeted.log` (zachowany FAIL), `manual-isolated.log` (GREEN) i `local-ui.log`; trace/screenshot pierwszej odmowy: `/tmp/meble-p0b-normal-KTNJXL/`. Wynik następnej próby wydania podawany oddzielnie po wykonaniu. W tej korekcie nie zmieniono kodu kalkulatora, UI, uprawnień, biznesowych Rules ani LIVE. Natywne narzędzia Windows/Git zweryfikowano na Windows; rzeczywiste testy Chromium wykonano w izolowanym WSL/Linux. Nie przypisuje to PASS fizycznej przeglądarce użytkownika.
