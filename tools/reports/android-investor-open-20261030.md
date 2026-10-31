# Android: odmowa otwarcia inwestora po PR #88

Gałąź: `fix/android-open-investor-20261030`. BASE: `988763876770655b47f1aadd9285d8dad1538d10`.

## Przyczyna i poprawka

Ścieżka: natywny pointerup/click → `open-investor` → `sessionNavigation.requestTransition` → `investorPersistence.setCurrentInvestorId` → patched setter → `investorProjectRuntime` → centralny projectStore → render. Gest dociera do handlera. Setter już aktywował zmienionego inwestora, lecz handler aktywował go ponownie.

Reprodukcja na rzeczywistych modułach ze starszą szafką: pierwsza aktywacja `true`, druga `false`. Konkretne różnice po pierwszym renderze: `kuchnia.cabinets[0].frontCount` (brak → 2) i `details` (brak → {}). Dla starszych zestawów bootstrap uzupełnia także `sets[].number` i powiązane `cabinets[].setNumber`. Czytnik centralny nie dodawał tych samych istniejących wartości domyślnych. Efektem była pozorna niezapisana zmiana i milcząca odmowa.

- Odczyt kopii projektu i render stosują dotychczasowe wartości domyślne szafek. Numeracja zestawów pozostaje w bootstrapie widoku; porównania runtime/PCV używają tego samego bootstrapu na odseparowanych kopiach, bez rozszerzania modelu eksportowego. Bez zapisu RAW, regenerowania ID, zaokrąglania lub nowego schematu. Rzeczywiste zmiany szerokości/liczby frontów nadal tworzą rozbieżność.
- Handler korzysta z potwierdzonej aktywacji settera; ponowne wejście do tego samego inwestora nadal wymaga jednej walidacji. `undefined` z wykonawcy nie jest zgodą.
- Odmowa aktywacji ma bezpieczny kod i istniejący komunikat z diagnostyką sesji. Bez UID, nazw klientów, tokenów i payloadów. Świadome Back w prawidłowej sesji nie otwiera kolejnego błędu.
- Nowa regresja wykryła automatyczny Save podczas walidacji startowej: przepisanie historycznego rekordu po restarcie bez decyzji użytkownika. Obie ścieżki walidacji startowej i fallback normalizacji są teraz tylko do odczytu projektu. Istniejące jawne Save/Cancel pozostają bez zmian.

Nie zmieniono PCV, obliczeń, synchronizacji, Rules, modelu właściciela sesji ani blokad przy braku trwałego dowodu. Nie wykonano migracji/resetu/usuwania danych właściciela.

## Zmienione obszary

- `js/app/project/project-model.js`: spójna reprezentacja odczytu historycznych szafek/zestawów.
- `js/app/investor/investor-project-patches.js`: tylko potwierdzone `true` pozwala zakończyć aktywację.
- `js/app/investor/investor-project-runtime.js`: kody faktycznej odmowy aktywacji.
- `js/app/ui/actions-register.js`: jedna aktywacja, obserwowanie odmowy widoku, istniejący komunikat zamiast milczącego `false`.
- `js/app/bootstrap/app-state-bootstrap.js`, `js/app.js`: brak niejawnego Save w walidacji/normalizacji startowej.
- `offline-assets.js`: manifest rzeczywistych bajtów publicznych zasobów.
- Testy i dokumenty wymienione poniżej oraz `CURRENT_STATE.md`.

## Celowane kontrole pierwotnego pakietu `ab88a176…`

Node 22.23.3; natywny Chromium 151. Profile i dane są jednorazowymi fixture'ami. Google Auth/odczyt grantu w teście przeglądarkowym są jawnie podstawione; nawigacja, gesty dotykowe, aplikacja i lokalne magazyny są rzeczywiste. To nie jest test fizycznego Androida ani Firebase LIVE.

| Kontrola | Wynik / znaczenie |
| --- | --- |
| `investor-open-historical-smoke.js` | PASS: historyczne wartości domyślne, jeden dispatch/aktywacja, Exit/reopen, zachowanie RAW i obcego projektu, realne zmiany RAM, PCV/niejednoznaczna własność/niepewny wynik odrzucone z komunikatem. |
| `empty-installation-browser-smoke.js` + nowy `helpers/historical-investor-browser.js` | PASS: pełna aplikacja, rzeczywisty dotyk 393 px, istniejący i nowy inwestor, Save parametrów pokoju i ponowne wejście, logout/login, restart dokumentu. Historyczny rekord bez nowych pól; cały RAM odpowiada wybranemu projektowi. RAW obu projektów pozostaje identyczny po otwarciu, wyjściu, logowaniu i restarcie. |
| `project-bootstrap-readonly-smoke.js` | PASS: bootstrap i fallback nie wywołują Save ani nie zmieniają centralnego RAW. |
| `project-pcv-auto-open-smoke.js` | 12/12 PASS: istniejące warunki PCV, odmowy i bezpieczny retry. |
| `project-session-storage-pressure-smoke.js` | 17/17 PASS: quota, niepewny zapis/read-back/cleanup/rollback, stary writer, zachowanie innych projektów. |
| `investor-navigation-exit-smoke.js` | 13/13 PASS: nawigacja i osiem czystych wyjść; brudna sesja, Back i niepotwierdzony zapis/rollback nadal chronione. |
| `project-session-restored-proof-smoke.js` | 8/8 PASS: niekompletny dowód nie jest naprawiany ani pomijany. |
| `android-investor-isolation-smoke.js` | PASS: create/switch, obcy RAM, pusty formularz i odmowa Save bez utraty draftu. |
| `investor-project-boot-source-truth-smoke.js`, `project-false-edit-session-smoke.js` | PASS: centralny projekt wygrywa z legacy, brak nadpisania draftu; cache nie tworzy sesji, rzeczywista zmiana nadal ją rozpoczyna. |
| Składnia, diff, manifest/offline-shell | PASS: rzeczywiste bajty manifestu, brak prywatnego cache lub przejęcia aktywnej karty. |

Nowy smoke i rozszerzone istniejące smoke są wykrywane przez obowiązkowy `*-smoke.js` w `tools/preflight.js`; natywny helper jest jawnie wywoływany przez `empty-installation-browser-smoke.js`. Workflow `.github/workflows/preflight-js.yml` uruchamia ten Preflight. Nie zmieniono workflow ani historycznych pinów. Nie uruchomiono pełnego lokalnego Preflightu ani GitHub Actions.

## Korekta kontraktu po CI PR #89

Wejściowy HEAD `ab88a17690ae6678c4f64eac89cdb3a895d87cb8`, niezmieniony BASE i gałąź. [CI 41146407296](https://github.com/mebleszek/meble-app/actions/runs/41146407296) potwierdza Safety/CLOUD Historical PASS, Preflight 174/175 FAIL i Firebase Current 98/107 FAIL. Nie uruchamiano go ponownie.

Własna poprzednia poprawka normalizacji miała zbyt szeroki skutek: dopisywała do centralnego modelu `project.projectData.kuchnia.sets[0].number=1` oraz `project.projectData.kuchnia.cabinets[1].setNumber=1`. To jedyne strukturalne różnice względem payloadu z BASE. Wzrost 6797 → 6822 B zmieniał SHA na `158cfdc91289314da5938125d0a7b994dedce59b8425839a4f02b93c06a00a23`. Kontroler poprawnie zgłaszał `CLOUD_SOURCE_CHANGED` przed oczekiwaną obsługą uprawnień/publikacji; dziewięć awarii w pliku SDK wynikało z tego samego naruszenia.

Minimalna korekta usuwa generowanie numerów z `project-model.js`. Istniejący `project-bootstrap.js` nadal uzupełnia je w widoku. `investor-project-runtime.js` i `project-pcv-policy.js` używają tego bootstrapu na kopiach wyłącznie do porównania, bez modyfikowania RAM/centralnego źródła. Jawne zmiany numerów nadal wykrywa kontrola rozbieżności i PCV. Pojedyncza aktywacja, brak startup Save oraz ścisłe porównanie pełnego RAM w teście mobilnym pozostają zachowane.

Nie zmieniono `controlled-project-pilot.js`, źródła syntetycznego, eksportera, walidatora eksportu, SHA zatwierdzonego payloadu, manifestów integralności CLOUD, Rules ani testów `live-readiness.test.mjs`/`cloud4-pilot-readiness-smoke.js`. Zaktualizowano wyłącznie publiczny manifest offline zgodnie z rzeczywistymi bajtami.

Kontrole tej korekty w Node 22.23.3:

| Kontrola | Rzeczywisty wynik |
| --- | --- |
| Niezmieniony `cloud4-pilot-readiness-smoke.js` | PASS; **6797 B**, payload SHA `711f2fea49873bab0c4f76b5e8e0e666c4796190ed9fbfda71557d35890ba2e3`, document SHA `5c9bc70f8fc1d7a15cef742150636e41ebacde404e57bd6109213f82d28d81a1`. |
| Niezmieniony `live-readiness.test.mjs` | **13/13 PASS**, 0 skipped, 0 fail; rzeczywiste Auth/Firestore emulatory demo na loopback, 19,12 s. Potwierdzono także odmowy, utracony ACK, jedną publikację i niezależny odczyt. |
| Rozszerzony `investor-open-historical-smoke.js` | PASS; model zachowuje brak numeracji, widok kopii nadaje istniejące wartości domyślne, rzeczywista zmiana `number` lub `setNumber` nadal daje rozbieżność i `RAM_DIVERGENCE` w PCV; RAW i pojedyncza aktywacja zachowane. |
| `empty-installation-browser-smoke.js` + helper historyczny | PASS; natywny mobilny Chromium, cały RAM właściwego inwestora, jedno otwarcie, Save/Exit/reopen, logout/login/restart i identyczny RAW obu rekordów. Oczekiwany RAM to pełna kopia źródła po istniejącym bootstrapie widoku; żadne pola nie są usuwane z porównania. |
| `project-pcv-auto-open-smoke.js`, `project-bootstrap-readonly-smoke.js` | **12/12 PASS** i PASS dwóch grup read-only startup/normalizacji. |
| Składnia, manifest offline, offline shell, diff | PASS; bez zmian historycznych pinów, kontrolerów CLOUD i workflow. |

Celowana komenda SDK (z Node 22 na PATH), bez całego zestawu Firebase:

```sh
node tools/firebase-pilot/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --config tools/firebase-pilot/firebase-live-pilot.json --project demo-meble-app --only auth,firestore --non-interactive 'node --test tools/firebase-pilot/live-readiness.test.mjs'
```

Pokrycie CI pozostaje obowiązkowe: smoke przez `tools/preflight.js`, plik SDK przez `currentSdk` w `tools/cloud-ci-context.js` i zadanie `firebase-current`. Pełne grupy GitHub Actions dla nowego HEAD pozostają **CI_PENDING**. Fizyczny Android nadal **PHONE_PENDING**. Bez ponawiania Actions, zmiany PR Ready/Draft, merge, Pages i Firebase LIVE.

## Wydanie i ryzyka

PR #88 został scalony: HEAD `9d45b4a050a930d577a6931a82d00005d0f74fab`, merge/BASE powyżej; [41139176509](https://github.com/mebleszek/meble-app/actions/runs/41139176509) potwierdza Safety, Preflight, Firebase Current, CLOUD Historical, auto-merge i sprawdzenie Pages dla dokładnego merge SHA. To dowód poprzedniego wydania, nie nowej poprawki.

Nowa poprawka: **CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**. Pełne CI i fizyczny Android oczekują na osobne zatwierdzenie wydania. Reprezentatywne historyczne dane testowe nie dowodzą zgodności z każdym uszkodzonym rekordem urządzenia; zasadna odmowa nadal zachowuje dane i pokazuje przyczynę w aplikacji. Żadnych operacji produkcyjnych ani obsługi PR/wydania w tym zadaniu.


## Historyczni inwestorzy — 31.10.2026

Nowa gałąź `fix/historical-investor-owner-20261031`, BASE `2930e0d769d9576d387764af439eab7df9fd5636`. PR #89 wydano: HEAD `72a63ab70e41de42eab2673f8b9f0704e34e0d80`, [CI/auto-merge/Pages 41148657445](https://github.com/mebleszek/meble-app/actions/runs/41148657445) PASS dla merge BASE. Fizyczny Android: nowy inwestor działa, dwóch starszych nie; raporty READ_ONLY/code:NONE, brak aktywnej sesji, projectCount:5. Dane testowe, cenniki fabryczne. Poprzednie lokalne/CI PASS nie są dowodem tej naprawy ani akceptacji Androida.

### Przyczyna i granice

Reprodukcja sprzed implementacji: prawidłowy `record.investorId`, brak historycznego `projectData.meta.assignedInvestorId`; jedyna różnica przed PCV to metadana właściciela dopisana przez runtime w RAM. PCV odmawia RAM_DIVERGENCE. Dwa takie rekordy odmawiały, trzeci nowy otwierał się. To nie dowód uszkodzenia danych. Niezależnie zajęte przejście zwracało false, które handler mylił z Back i nie pokazywał komunikatu. Sam odczyt code:NONE z sesji nie ujawniał odmowy aktywacji.

`project-pcv-policy.ownerView` potwierdza jednoznaczny autorytatywny rekord po ID i właścicielu. Wyprowadza brakującego właściciela na kopii; jawnie sprzeczna, pusta/null metadana nie staje się brakiem i nadal blokuje. Kopia porównawcza nie przypisuje świeżemu RAM właściciela nowo utworzonego projektu, gdy źródło już ma metadaną: zachowano istniejące dowody jednorazowej kreacji. W źródle, modelu eksportowym i snapshotach sesji niczego nie dopisujemy.

- `investor-project-runtime.js`: potwierdzony widok właściciela, read-only otwarcie starszej karty (także bez znacznika PCV), anonimowe metadane odmowy/liczby kandydatów i wersja uruchomionego modułu.
- `project-pcv-policy.js`: ścisła kontrola konfliktu właściciela, porównanie tych samych zweryfikowanych kopii, bez nowych uprawnień i bez zmiany algorytmów PCV.
- `project-bridge.js`: load i wynik jawnego Save mają właściciela w kopii RAM. Porównanie scoped Save rozumie historyczny snapshot, bez dopisywania właściciela do RAW, rozszerzania zakresu pokoju lub naprawiania dowodu sesji. Ta poprawka była konieczna: po samym otwarciu jawny Save starego pokoju wcześniej odmawiał przez tę samą różnicę metadanej.
- `session-navigation.js`: istniejące boolean API pozostaje, opcjonalny wynik per żądanie odróżnia NAVIGATION_CANCELLED, BUSY, niepotwierdzoną decyzję, błąd, niepewny zapis/odczyt i odmowę aktywacji. Nie wyłączono żadnego warunku sesji.
- `actions-register.js`: Back potwierdzone przez dane żądanie nie pokazuje błędu; pozostałe odmowy pokazują istniejący komunikat. Równoległa wcześniejsza próba nie nadpisuje dowodu późniejszej odmowy.
- `session-diagnostics-readonly.js`, `session-diagnostics.js`: anonimowy etap/kod/wynik, liczba kandydatów i brak historycznej metadanej, identyfikatory faktycznie wykonujących się modułów `20261031_historical_owner_v1`; starsze/nieznane komponenty są LEGACY_OR_UNKNOWN. To wersja komponentów, nie deklaracja SHA całego wydania. Kolektor nadal odczytowy, autoryzowany, z kontrolą spójności i allowlistą kodów; bez UID, nazw, identyfikatorów projektów, tokenów i treści rekordów.
- `index.html`, `dev_tests.html`, `tools/script-versions.js`, `offline-assets.js`: zgodne wersje zależności i rzeczywiste bajty statycznego shella. Nie zmieniono mechanizmu Service Worker: bez skipWaiting, przejęcia otwartej karty i wymuszonego odświeżenia.
- `tools/diagnostics/pixel-session-bookmarklet.txt`: tylko regeneracja istniejącego artefaktu z jednego kolektora wymagana przez dotychczasowy test; nie jest nową instrukcją diagnostyki właściciela. Właściciel nadal używa wyłącznie aplikacji i istniejącego Kopiuj raport.
- `project-session-storage-pressure-smoke.js`: fixture nieudanego rollbacku ma teraz jawnego właściciela, aby nadal uruchamiać zapis znacznika PCV i wymuszoną awarię cofania wskaźnika. Historyczne otwarcie bez metadanej jest odczytowe, więc nie może zastępować tego scenariusza. Zachowano wszystkie asercje odmowy i ochrony danych; dodano potwierdzenie, że próba rollbacku rzeczywiście wystąpiła.

### Regresje i rzeczywiste kontrole tego pakietu

Node 22.23.3; natywny Chromium 151, odseparowane profile. Bez Google/Firebase LIVE; jak wcześniej fixture Auth/admission jest jawnie podstawiony, gesty, dokument, lokalne magazyny i aplikacja są rzeczywiste.

| Kontrola | Rzeczywisty wynik |
| --- | --- |
| Nowy `historical-investor-owner-smoke.js` | 5 grup PASS: dwóch historycznych + trzeci nowy, cold-list create, brak automatycznej zmiany RAW/PCV, odmowy obcego/pustego/null właściciela i niejednoznaczności, rozdzielenie busy/Back/niepewnej decyzji, jawny Save pokoju, anonimowa odczytowa diagnostyka wersji i odmowy. |
| Rozszerzony `helpers/historical-investor-browser.js`, wywoływany z obowiązkowego `empty-installation-browser-smoke.js` | PASS: istniejące wszystkie asercje oraz realnie utworzony trzeci inwestor; dwóch starszych bez metadanej, jeden także bez znacznika PCV; Open/Exit/logout/restart, pełny RAM właściciela, dokładnie niezmieniony RAW przy otwarciu. Konflikt właściciela i pięć rekordów z dwoma kandydatami na starszego inwestora dają widoczny komunikat, realny gest otwiera istniejącą diagnostykę i pokazuje kod/wersję. Trzeci pozostaje dostępny. Przy odmowie/diagnostyce identyczne RAW, RAM i payload sesji. |
| `investor-open-historical-smoke.js`, `project-pcv-auto-open-smoke.js` | PASS wcześniejszych dwóch grup i **12/12 PASS** PCV; bez osłabienia asercji. |
| `investor-navigation-exit-smoke.js`, `project-session-restored-proof-smoke.js` | **13/13 PASS**, **8/8 PASS**; dirty Back, Exit z ośmiu zakładek, Save/Cancel i brak naprawy niekompletnego dowodu. |
| `project-session-storage-pressure-smoke.js` | **17/17 PASS**; quota, niepewna trwałość, zachowanie innych projektów i rzeczywiście wymuszony nieudany rollback nadal blokują niebezpieczne operacje. |
| `pixel-session-bookmarklet-smoke.js`, `session-diagnostics-screen-smoke.js` | **15/15 PASS**, **6/6 PASS**; read-only, ograniczenie rozmiaru, autoryzacja i brak ujawnienia danych nadal obowiązują. |
| `cloud4-pilot-readiness-smoke.js` | PASS; niezmienione **6797 B**, SHA-256 `711f2fea49873bab0c4f76b5e8e0e666c4796190ed9fbfda71557d35890ba2e3`. Bez zmian pinów, kontraktu, operatorów i Rules. |
| Składnia, integralność i zakres | PASS składni 13 zmienionych/nowych plików JS, obu zestawów wersji skryptów, dokładnych bajtów manifestu offline, dwóch grup `offline-shell-smoke.js` i `git diff --check`. Chronione katalogi CLOUD/LOCAL-FIRST, workflow, AGENTS, Rules i piny pozostają bez zmian względem BASE. |

Nowy smoke i wszystkie rozszerzone regresje mają obowiązkowe pokrycie przez istniejący Preflight `*-smoke.js`; helper mobilny jest wywoływany, a nie tylko obecny na dysku. Pełne CI pozostaje po stronie GitHub Actions po osobnej zgodzie. Nie uruchomiono Actions, PR Ready/Draft, merge, Pages ani operacji produkcyjnych.

**Blokery:** CI_PENDING oraz fizyczna akceptacja PHONE_PENDING. Pięć rzeczywistych rekordów może oznaczać kilka projektów na inwestora: nie wybieramy ich heurystycznie, nowy anonimowy raport pokaże liczbę kandydatów. Cache na telefonie nie jest automatycznie odświeżany; raport starszej karty może nie mieć nowych pól. Brak nowego raportu nie jest potwierdzeniem wykonania nowej wersji. CODE_READY nie oznacza wydania ani LIVE_APPROVED.
