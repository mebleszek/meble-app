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


## Korekta CI PR #90 — 31.10.2026

Wejście `d7c9a27f9a1bd601f37d04e0f5ce7f6ca9a7cf45`, gałąź `fix/historical-investor-owner-20261031`, BASE `2930e0d769d9576d387764af439eab7df9fd5636`. Odczytano PR #90: open, Ready, niescalony, dokładne SHA zgodne. [Run 41189725394](https://github.com/mebleszek/meble-app/actions/runs/41189725394): Safety i CLOUD Historical PASS; Preflight 175/176 i Firebase Current 106/107 oznaczają FAIL obu bramek; merge i Pages pominięte. To dowód dla wejściowego HEAD, nie wynik CI poprawki.

### Zmiany i ustalenia

1. `tools/wycena-generate-action-registry-smoke.js` miał własny, nieaktualny łańcuch wersji, w tym `20261020_session_diagnostics`. Faktyczny kanoniczny rejestr i obie strony wskazują `20261031_historical_owner_v1`. Test wymaga obecności wszystkich trzech kontrolowanych modułów w rejestrze i używa wspólnego `assertHtmlVersions`: dokładnie jedno odwołanie z właściwą wersją w index oraz dev_tests. Zachowano asercje rejestracji akcji, runtime WYCENY i braku podwójnych handlerów gestów. Kontrola cache-bustingu nie została usunięta.
2. `tools/firebase-pilot/cloud42-plan.test.mjs`: CI nie wykonało ciała pierwszego testu — HTTP 500 UNKNOWN pochodzi z REST DELETE emulatora wywołanego przez `clearFirestore` w beforeEach. Następne trzy scenariusze tego pliku przeszły. Grupa jest sekwencyjna (`--test-concurrency=1`); faktycznie poprzedza ją alfabetycznie `cloud-sync-global.test.mjs`. W opublikowanym artefakcie `diagnostics-firebase-current` jest stdout testów, brak serwerowego `firestore-debug.log`, więc log CI nie dowodzi wewnętrznej przyczyny HTTP 500. Nie ma dowodu wady historycznej aktywacji inwestora, Rules ani kontraktu CLOUD-4.
3. Celowane reprodukcje nie odtworzyły 500. Nie dodano retry, opóźnień, osobnego projektu/bazy, zmiany Rules ani obejścia czyszczenia. Jedyna zmiana hooka: po awarii wypisuje marker etapu i maksymalnie końcowe 16 KiB / 80 linii istniejącego serwerowego logu z tego izolowanego emulatora; brak pliku jest jawny, błąd zamknięcia logu nie maskuje pierwotnej odmowy. Następnie rzuca dokładnie oryginalny błąd, bez seedowania bazy i bez wykonania scenariusza. Log pochodzi wyłącznie z tego testowego środowiska `demo-meble-app` na loopback; nie odczytuje poświadczeń ani produkcji. **To diagnostyka, nie potwierdzona naprawa wewnętrznej awarii emulatora.**
4. `CURRENT_STATE.md` oraz niniejszy raport zawierają rzeczywisty wynik PR #90 i nadal otwarty bloker. Nie zmieniono produkcyjnego JS, napraw historycznych inwestorów, PCV, RAW, 14 domen, sesji, Rules, workflow, SDK/lockfile, pinów ani manifestu offline. Oryginalny kontrakt CLOUD-4 6797 B / SHA `711f2fea49873bab0c4f76b5e8e0e666c4796190ed9fbfda71557d35890ba2e3` pozostaje bez zmian; nie zaliczamy ponownie wcześniejszego PASS jako nowego testu tego commita.

### Rzeczywiste kontrole

Node 22.23.3, Java 21, przypięty Firestore Emulator 1.22.0 i obecne zależności z lockfile; bez reinstalacji. Wszystkie uruchomienia emulatorów wyłącznie Auth/Firestore dla `demo-meble-app`, 127.0.0.1:19099/18080, bez odziedziczonych tokenów i poświadczeń.

| Kontrola celowana | Wynik / znaczenie |
| --- | --- |
| Smoke rejestru akcji WYCENY po zmianie | PASS. Cztery kontrolowane mutacje: stara wersja i duplikat w każdym z dwóch HTML-ów są odrzucane, 4/4. Bez modyfikacji rzeczywistych HTML-ów. |
| CLOUD-4.2 przed zmianą hooka | 4/4 PASS; izolowany emulator. |
| Ostatni poprzedzający CLOUD-SYNC-1 14 + Stage | 2/2 PASS; wspólne życie emulatora, bez pominiętych wybranych testów. |
| Cały bezpośrednio poprzedzający plik CLOUD-SYNC-1 (14 przypadków) + Stage | 15/15 PASS; konieczna reprodukcja stanu poprzednika, nie pełny zestaw Firebase ani Preflight. |
| CLOUD-4.2 po dodaniu diagnostyki | 4/4 PASS na rzeczywistym emulatorze, 0 skip/cancel/todo. |
| Kontrolowane awarie samego hooka diagnostycznego | 4/4 PASS: log dostępny, niedostępny, błąd close oraz sukces; w błędzie dokładnie jeden clear, zero seedowania, ten sam obiekt wyjątku; limit odczytu 16384 B. To kontrola testowego helpera, nie reprodukcja wewnętrznego HTTP 500. |
| Składnia obu zmienionych testów, manifest offline, diff | PASS; chronione źródła aplikacji, Rules i piny bez zmian względem wejścia. |

Oba testy pozostają w dotychczasowych obowiązkowych grupach: smoke przez Preflight `*-smoke.js`, CLOUD-4.2 w `firebase-current` przez istniejący plan SDK. Pełnego Preflightu ani całego zestawu SDK nie uruchamiano lokalnie. Nie ponawiano GitHub Actions, nie zmieniano PR, nie wykonywano merge, Pages ani Firebase LIVE.

**FIX_PARTIAL / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED.** Korekta cache-bustingu gotowa. Brak potwierdzonej przyczyny i dowodu usunięcia HTTP 500; do domknięcia potrzebny serwerowy stacktrace z awarii lub inna powtarzalna reprodukcja. Nowa diagnostyka zachowa ten dowód w logu obowiązkowej grupy przy ewentualnej ponownej awarii. Nowa próba CI/wydania wymaga osobnej zgody na dokładny wynikowy HEAD/BASE, bez dziedziczenia wcześniejszej zgody.

## Pełne usuwanie inwestorów — 31.10.2026

Gałąź `fix/investor-list-delete-20261031`, BASE `571c8ae1975ea18237172ce8eb747306c83e9234`, wejście `5a49f67ce18957ac174db5d23c732a0d33d50913`. Rozszerzenie zatwierdzone przez właściciela zastępuje wcześniejsze ukrywanie wpisów. PR #90 pozostaje wydany: CI [41190850451](https://github.com/mebleszek/meble-app/actions/runs/41190850451) i Pages [41191198632](https://github.com/mebleszek/meble-app/actions/runs/41191198632), exact merge BASE. PHONE_FAIL `PROJECT_OWNER_CONFLICT` jest rzeczywistym konfliktem metadanych; nie odblokowujemy go ani nie zmieniamy PCV.

### Faktyczny łańcuch i własność

`Lista inwestorów → bindings (pointerup/compatibility click) → actions-register → investorDeletion.prepare → istniejący confirmBox → commit → strict IndexedDB + localStorage fence → spis klientów SW → zapis/odczyt celów → trwały completed → odświeżenie listy`. Przed initializerami projektu/recovery loader wywołuje `resumePending`. Nie zmieniono modeli, kalkulacji, LOCAL-FIRST, Rules ani operatorów CLOUD.

| Magazyn | Wykonanie |
| --- | --- |
| `fc_investors_v1`, `fc_projects_v1` | Fizycznie usuwa wybrane ID oraz projekty z pierwotnym `project.investorId`. Sprzeczna historyczna `meta.assignedInvestorId` nie jest podstawą własności; jej odmowa Open pozostaje. Duplikaty/brak właściciela/pendingDomainOperation blokują. |
| `fc_quote_snapshots_v1`, `fc_quote_offer_drafts_v1` | Usuwa jednoznaczne referencje projectId/investorId, także historyczny jawny investorId. Niezgodne referencje i nierozstrzygnięte rekordy blokują zamiast zgadywania. Frozen treść pozostałych ofert i drafty nie są normalizowane. |
| `fc_project_inv_{id}_v1`, `fc_project_v1`, wskaźniki | Dokładny własny slot legacy bez konfliktu; globalny legacy tylko z jawnym wybranym właścicielem. Niewłasne/nieprzypisane globalne legacy pozostaje jako historyczna kopia. Czyści tylko wskaźniki skasowanego kontekstu; bez zapisu RAM. |
| Pozostali inwestorzy, projekty, katalogi, ustawienia, RAW wspólne | Zachowuje. Filtrowanie tablic utrzymuje dokładne RAW pozostałych elementów, także nieznane pola i leksykalny zapis liczb spoza bezpiecznego zakresu JS. Nie przypisuje globalnego PCV/słojów/rozrysu po nazwie ani heurystyce. Zlecenia usługowe są niezależne. Issue #47 bez zmian. |
| Pełne backupy localStorage i `meble-business-backups-v1` | Nie usuwa, nie przepisuje, nie migruje. Podgląd wylicza rzeczywiste liczby magazynów i rekordów archiwum IDB. Mogą zawierać skasowane dane. |
| `fc_investor_removed_ids_v1` | Dodatkowa ochrona przed automatycznym odtworzeniem z projektów/ofert; nie zastępuje rzeczywistego usunięcia aktywnych tablic. |
| LOCAL-FIRST/outbox/nieznany IDB lub store | Jawna odmowa. Nie usuwa kolejek ani chronionych rewizji i nie obiecuje propagacji na inne urządzenia. |

### Trwałość, recovery i interfejs

- `meble-investor-delete-v1` / `operations`, schema1: prywatne intencje pending i dowody completed z kopiami przed/po. Wymagane faktyczne transaction complete z `durability:strict` i niezależny read-back. Zostają po sukcesie jako dowód odzyskiwania; to nie bezpowrotne wymazanie każdej kopii danych. Nie wchodzą do standardowego eksportu/importu ani chmury.
- `meble_investor_delete_journal_v1`: dodatkowy synchroniczny fence w localStorage, zapisany przed trwałą intencją i przed modyfikacjami. Utrata tego markera po awarii nie pomija dziennika IDB. Brak miejsca/niepewny ACK/konflikt nie dają sukcesu. Wznowienie dopisuje tylko nieukończone cele; nie wykonuje ślepego rollbacku. Dowód completed nie nadpisuje późniejszych legalnych zmian; ponowne pojawienie się skasowanych aktywnych rekordów wymaga zgodnego recovery albo blokady.
- Pending blokuje biznesowe odczyty/zapisy w kooperujących kartach, a nowy loader czeka przed modelami/defaultami/recovery. Web Lock serializuje operatorów. Rzeczywisty Service Worker wymaga ACK wszystkich zaobserwowanych klientów originu; stara/aktywna/nieodpowiadająca karta blokuje, a kod odmowy jest anonimowy. Nie traktujemy pustej listy locków jako dowodu wyłączności. Nie zamykamy kart użytkownika i nie wywołujemy skipWaiting/claim/reload w aplikacji.
- Przed restore/importem istniejąca bramka odmawia odtworzenia usuniętych ID lub pominięcia ich tombstones **przed pierwszą mutacją**. Archiwum nadal jest dostępne; nie kasujemy ani nie przepisujemy jego pliku. Przywrócenie takich danych wymaga osobnego bezpiecznego rozstrzygnięcia, nie cichej reaktywacji przez stary backup.
- Pierwszy minus włącza zaznaczanie, drugi z pustym wyborem wyłącza, drugi z zaznaczeniem pokazuje istniejący modal zbiorczy. Liczby rzeczywistych pomieszczeń rozróżniają definicje/geometryczne pokoje od pustych wbudowanych szablonów. Anuluj zachowuje dane i wybór. Sukces usuwa checkboxy. Brak drugiej akcji `delete-investor`, przycisków w karcie i confirmDeleteInvestor; wewnętrzne sprzątanie niezapisanego nowego formularza pozostaje odrębnym istniejącym lifecycle, nie drogą usuwania zapisanych inwestorów.
- Potwierdzony mobilny defekt: pierwszy pointerup przebudowywał przycisk, a compatibility click trafiał w jego nową instancję i wyłączał tryb. Istniejący mechanizm bindings konsumuje teraz ten jeden compatibility click; nowy fizyczny pointerdown nadal otwiera kolejny gest.
- AGENTS: jedna pełna analiza ChatGPT i zakres; Codex weryfikuje niezbędny kod, bez powtarzania audytu. Dodatkowe pogłębienie tylko dla wykazanej sprzeczności/ryzyka. W tym pakiecie taką nową luką był brak trwałego potwierdzenia localStorage przy utracie zasilania — stąd mały dziennik IDB, bez migracji aktywnych danych. PIN wspólny z zaufaniem urządzenia wyłącznie w ROADMAP.

### Regresje i rzeczywiste dowody

Node 22.23.3, natywny Chromium 151, wyłącznie syntetyczne dane w odseparowanych profilach. SDK/grant Auth są jawnie podstawione w fixture; Storage, IndexedDB, WebCrypto, dotyk i Service Worker są prawdziwe. Żadnego Firebase LIVE, nowej instalacji zależności ani pełnego lokalnego CI.

| Kontrola / obowiązkowa bramka | Wynik celowany |
| --- | --- |
| `investor-list-delete-smoke.js` / wykrywanie Preflight `*-smoke.js` | **9 grup PASS**: pełne wielokrotne usunięcie; pozostałe numeryczne RAW; oba minusy i Anuluj; 10 odmów; awaria każdego zapisu/cleanup; ciche/no-op zapisy; zmiana źródła podczas await; konflikt recovery; świeży runtime; brak hint/tombstones; strict/completed i późniejsze legalne zmiany; blokada restore przed mutacją; wylogowanie podczas durable completion bez ponownego WRITE; token i usunięty drugi UI. Model IDB tej grupy służy logice awarii, nie jest dowodem trwałości prawdziwego IDB. |
| `empty-installation-browser-smoke.js` → `investor-list-delete-browser.js` / Preflight | **PASS**, exit 0: prawdziwe gesty wielokrotnego wyboru, drugiego pustego minusa, Anuluj bez zmiany wszystkich localStorage RAW, czerwone checkboxy po prawej od Otwórz i lista bez overflow przy 320 px. Zachowane wcześniejsze grupy pierwszego/historycznego inwestora, izolacji, logout i restartu. Ten intercepted-origin fixture nie udaje Service Workera. |
| `trusted-session-browser-smoke.js` → `investor-delete-sw-browser.js` / Preflight | Prawdziwy offline SW: pełne usunięcie dwóch inwestorów z projektem o sprzecznej metadanej, 2 ofert i 2 draftów, zachowany obcy projekt/RAM/zaufanie, restart offline; następnie kontrolowana awaria przed mutacją, rzeczywisty pending IDB, utrata localStorage hint i automatyczne wznowienie loadera. **PASS całego przebiegu, exit 0**, łącznie z ośmioma wyjściami projektu, pięciominutową blokadą, świadomym logout offline i odmową ponownego dostępu/odczytu. |
| `trusted-ci-readiness-smoke.js` / Preflight | **7 grup PASS**: zachowane bramki dokumentu/gestów/realnego kontrolera formularza/Auth i nowa odmowa współrzędnych zmienionych po dwóch klatkach; ciągła stabilność przed jednym dotykiem. |
| `investor-navigation-exit-smoke.js`, `historical-investor-owner-smoke.js` / Preflight | **13/13 i 5 grup PASS**: Zapisz/Anuluj/niepewna trwałość, osiem wyjść, blokady edytora, cudze pokoje, PCV, RAW, metadane historyczne i diagnostyka. |
| Wersje, load order, manifest, offline shell, składnia, diff | **PASS**: 26 zmienionych/nowych JS, dokładne kanoniczne referencje obu HTML-ów oraz index-only, kolejność init i manifest z bajtów; obie grupy offline-shell PASS. |
| `cloud4-pilot-readiness-smoke.js` | **PASS**, oryginalne 6797 B; payload SHA `711f2fea49873bab0c4f76b5e8e0e666c4796190ed9fbfda71557d35890ba2e3`, document SHA `5c9bc70f8fc1d7a15cef742150636e41ebacde404e57bd6109213f82d28d81a1`. Rules, operatorzy i historyczne piny bez zmian. |

W trakcie diagnostyki testowego Chromium potwierdzono przywracanie kolejnych kart profilu (1 → 2 → 3), niejednoznaczny wybór celu CDP oraz reset navigator.onLine przy nowym rendererze mimo wcześniej ustawionego blokowania sieci. Fixture wybiera własny pusty cel, obserwuje i zamyka wyłącznie dodatkowe strony startowe własnego procesu, a przed pierwszym gestem wymaga jednej karty na pierwszym planie. Nie zamyka prawdziwych kart aplikacji. Sieć blokowana od początku, origin HTTP zatrzymany, CDP overrideNetworkState osobno potwierdza stan navigatora. Diagnostyka dotyku wykazała przesuwanie sticky przycisku po zbędnym scrollIntoView: gotowy widoczny cel nie jest już przewijany, a stabilność obejmuje ciągłe klatki i pozycję scroll. Nie ma retry kliknięć, większych timeoutów ani syntetycznego wywołania akcji zamiast dotyku. Poprzednie nieudane przebiegi nie są zaliczone jako PASS.

Po rzeczywistym wylogowaniu ostatni zimny start offline nie posiada ani dowodu zaufania, ani pobranego Firebase SDK. Oczekiwany jest dokładny `AUTH_SDK_UNAVAILABLE`, brak startu biznesowego i odmowa `AUTH_ACCESS_REVOKED` przy odczycie biznesowym, a nie odziedziczone unauthenticated ze starej karty testowej. Zachowano i doprecyzowano odmowę dostępu; nie zmieniano Auth produkcyjnego.

**CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED.** Pełne CI i fizyczny Android pozostają niewykonane dla tego pakietu. Brak PR/Actions/merge/Pages/LIVE. Właściciel nie musi ponawiać audytu ani instalacji; następny ruch to niezależna kontrola gałęzi i osobna zgoda na wydanie dokładnego HEAD/BASE. Funkcja będzie odmawiała przy starych kartach, aktywnej sesji/sync, nieznanym IDB, braku strict durability, niejednoznacznych referencjach lub braku miejsca na dziennik. Nie należy usuwać dzienników albo kopii, żeby ominąć odmowę.


### PR #91 — celowana korekta nieaktualnej gotowości gestu (31.10.2026)

[GitHub Actions #41215057211](https://github.com/mebleszek/meble-app/actions/runs/41215057211), wejściowy HEAD `a28240c867b271d8b953c59b4802afcd4a7370a2`, BASE `571c8ae1975ea18237172ce8eb747306c83e9234`: Safety PASS, Firebase Current PASS, CLOUD Historical PASS; Preflight **176/177** — **FAIL tylko `trusted-session-browser-smoke.js`**. Auto-merge i Pages pominięte. Natywny `pointerdown/up` trafił zakładkę `inwestor` zamiast `wywiad`. W logu współrzędna zmierzona `108,78`; w momencie dotyku docelowy prostokąt `x=73,y=42,w=70,h=32`, czyli jego środek był już przy `108,58` (zmiana pionowa 20 px). `scrollY=94`, viewport 393, skala 1. Potwierdzony błąd testowy to **przestarzałe współrzędne między pomiarem w rendererze a natywnym CDP input**; dokładnego wyzwalacza późnego przesunięcia sticky header w CI nie udowodniono.

Doprecyzowano jedynie test: bierni obserwatorzy `pointerdown/up` są instalowani **przed** końcowym, sześcioklatkowym pomiarem stabilności `waitForGesturePoint(...,{stable:true})`, a nie osobnym poleceniem CDP **po** pomiarze. Przez to nie ma dodatkowej asynchronicznej operacji instrumentacji między odczytaniem punktu a jedynym rzeczywistym `Input.dispatchTouchEvent`. `try/finally` nadal sprząta obserwatorów również wtedy, gdy gotowość się nie potwierdzi. Nie zmieniono helpera stabilności, zachowano prawdziwy gest, kontrolę zaufanych `pointerdown/up`, brak anulowania i wszystkie asercje nawigacji. Bez sztucznych kliknięć, ślepego retry, wydłużenia timeoutów oraz zmian aplikacji/usuwania/Firebase.

`trusted-ci-readiness-smoke.js` rozszerza celowaną regresję o reprodukcję zmiany środka sticky przycisku `108,78 → 108,58` i sprawdza kolejność „obserwator przed pomiarem” oraz nienaruszone asercje natywnego gestu. Bezpośrednia izolowana kontrola rzeczywistego `browser-test-readiness.js` potwierdziła stary błędny i nowy poprawny punkt; pełnej regresji Chromium lokalnie nie wykonano (brak kompletnego checkoutu). Test syntetyczny nie zastępuje pełnego natywnego Chromium ani nowego CI. Równolegle w `AGENTS.md` utrwalono decyzje właściciela o elastycznych pakietach, ochronie UI/UX (wyjątek B), danych testowych i globalnych, backupach, odrębnych błędach, aktualności testów oraz zapisie decyzji. **CODE_READY tylko po sprawdzeniu diffu; CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED** dla nowego HEAD. Następna próba wydania wymaga osobnej zgody właściciela na nowe SHA i niezmieniony BASE; nie uruchamiano ponownie Actions i nie zmieniano PR #91.

### PR #91 — druga próba FAIL i instrumentacja diagnostyczna (31.10.2026)

[CI #41219469974](https://github.com/mebleszek/meble-app/actions/runs/41219469974), HEAD przed instrumentacją `b93f48c443213a1f62b5e86fcfbe7768ef38a6f5`, BASE `571c8ae1975ea18237172ce8eb747306c83e9234`: Safety, Firebase Current, CLOUD Historical **PASS**; Preflight **176/177 FAIL** wyłącznie w `trusted-session-browser-smoke.js`. Tym razem natywny pointerdown celowany w `rysunek` trafił `rozrys` w punkcie `(264,78)`, a prostokąt `rysunek` podczas gestu miał `x=229,y=42,w=70,h=32` (środek `264,58`); `scrollY=0`. Dopiero compatibility click miał `onTarget=true`, co **nie spełnia** wymogu zaufanego pointerdown i nie jest PASS. Automatyczne merge/Pages pominięto.

**Zatwierdzona teraz zmiana diagnostyczna — nie deklaracja naprawy:** tylko testowy `nativeTouchProbe` i obserwatory rejestrują bez danych biznesowych prostokąty header/zakładek/celu, bieżący hit-test, scroll (window/document/body), visualViewport (scale/offset/pageTop) oraz bounded scroll-event trace. W natywnym smoke zapisują `beforeStart` **bezpośrednio przed pojedynczym CDP touchStart** i `layout` podczas autentycznego `pointerdown`. Te odczyty nie wpływają na współrzędne, nie ponawiają gestu i nie ignorują błędów. Istniejące rygorystyczne asercje pointerdown/up, brak cancel oraz wszystkie testy domenowe zachowane. Syntetyczna regresja rozróżnia samą zmianę layoutu od przesunięcia scroll. Zbadane źródła możliwych zmian: `js/app/ui/tab-navigation.js` (smooth scrollTo) i `js/app/ui/list-scroll-memory.js` (rAF restore); nie ma jeszcze dowodu przypisującego je do danego FAIL. Brak zmian w kodzie aplikacji, Firebase, usuwaniu inwestorów, workflow/PR i LIVE.

Zalecana kolejna decyzja: **osobno zatwierdzić próbę CI dla nowego wynikowego SHA**, aby uzyskać różnicę `beforeStart` → `pointerdown` w natywnym Chromium; po analizie dowodu wprowadzić dopiero korektę przyczyny. **CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED** (CI nieuruchamiane w tym pakiecie).


### PR #91 — korekta dwóch blokad CI po trzeciej próbie (31.10.2026)

[CI #41222338211](https://github.com/mebleszek/meble-app/actions/runs/41222338211), HEAD przed korektą `6a76fcb27f0344ab3aa406a492eb4aabe6d9e8a5`, BASE `571c8ae1975ea18237172ce8eb747306c83e9234`: Safety PASS, CLOUD Historical PASS, Preflight 176/177 FAIL (`trusted-session-browser-smoke.js`), Firebase Current 106/107 FAIL (`cloud42-plan.test.mjs`, `beforeEach` HTTP 500 przy `clearFirestore()`). Auto-merge i Pages pominięte.

**Natywny touch:** log `beforeStart` dowiódł `scrollY=0, tab.y=62`; w `pointerdown` było `scrollY=20, tab.y=42`, z kolejnymi zdarzeniami scroll `3/20/58/0`. Zaległa animacja przewijania po poprzedniej nawigacji mogła ruszyć po sześcioklatkowej próbie stabilności. W testowej przeglądarce wywołanie `finishPendingTouchScroll()` jednokrotnie kończy smooth scroll **w bieżącym położeniu**, przed pomiarem natywnego gestu. Nie zmienia kodu aplikacji ani asercji `pointerdown/up`, nie dodaje JS click, retry czy timeoutów.

**SDK current:** Firestore Emulator v1.22.0 zwrócił `Stream is already completed` w `ListenStreamManager/clearData`; pierwszy test `cloud42-plan.test.mjs` miał hookFailed, a pozostałe kontrole zakończono. W `cloud-ci-emulators.js` wszystkie osiem testów current dzieli się na *dwie osobne, obowiązkowe sesje demo emulatorów* [5+3] z kompletnym TAP i bez pominięć. Osobny test boundary wymusza dokładny podział, kompletność i niezmieniony historyczny kontekst. Jest to izolacja niepewnego stanu watch-emulatora, nie ukrycie FAIL ani gwarancja naprawy wewnętrznego błędu Firestore.

**Status po zmianie:** celowana kontrola kodu/planów; pełne CI dla nowego SHA **nieuruchamiane bez odrębnej zgody**. CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED. Nie zmieniono Rules, danych, Firebase LIVE, UI, logiki usuwania inwestorów ani stanu PR.


### PR #91 — kontrolowane porównanie A/B wprowadzenia „Usuń” (31.10.2026)

Odczytowe porównanie BASE `571c8ae1975ea18237172ce8eb747306c83e9234` z HEAD sprzed instrumentacji `0f0b5ffda6454817ca1c55ffc00745b48cb3488f`: nawigacja `js/app/ui/tab-navigation.js`, zapamiętywanie scroll `js/app/ui/list-scroll-memory.js` i istniejący test `tools/helpers/investor-navigation-browser.js` są **identyczne**. Nowy `tools/helpers/investor-delete-sw-browser.js` wykonuje kasowanie, recovery IndexedDB, dwa reload i pracę na natywnym Chromium/SW; w tym samym `trusted-session-browser-smoke.js` jest wykonywany przed niezmienionym helperem nawigacji. Potwierdzono w poprzednich CI przewinięcie `scrollY=0 → 20` pomiędzy próbką a `pointerdown`. Zmiany w CSS listy inwestorów nie modyfikują bezpośrednio top-tabs.

**Zatwierdzona, testowa kontrola porównawcza:** w tej samej już przygotowanej zaufanej przeglądarce offline z tym samym mechanizmem natywnego Chromium test najpierw wykonuje `exerciseInvestorNavigation(device)` i zapisuje `NAVIGATION_AB A_BEFORE_DELETE START/PASS/FAIL`, następnie pełny niezmieniony `exerciseFullDeletion(device)`, potem ten sam `exerciseInvestorNavigation(device)` jako `NAVIGATION_AB B_AFTER_DELETE`. Obie wersje zachowują wszystkie krytyczne asercje i rzeczywisty gest. Metryki START/PASS/FAIL: scrollX/Y, aktywna zakładka, wejście UI, sesja i topTabsY; bez danych klientów, UID i zasobów chronionych. A FAIL oznacza, że do odtworzenia błędu nie jest niezbędny poprzedni test usuwania; A PASS/B FAIL wskazuje na stan odziedziczony w sekwencyjnej sesji, ale może wynikać także z pierwszego testu A — potrzebne niezależne potwierdzenie przed zmianą aplikacji. Porównanie **nie zostało wykonane** (brak dostępnego checkoutu Meble-App w runtime); uruchomi je dopiero osobno zatwierdzone CI dla nowego SHA. Bez wywołań Firebase LIVE, zmian danych produkcyjnych, UI, logiki usuwania, PR Ready czy workflow.

### PR #91 — naprawa wtórnego click

Wejście `1a96326a3115e2d6cc37cf573cefe19425a27755`, gałąź `fix/investor-list-delete-20261031`, BASE `571c8ae1975ea18237172ce8eb747306c83e9234`. Remote HEAD potwierdzony przed zmianami. Diagnostyka A/B poza repo: `/workspace/diagnostics/pr91-ab/REPORT.md`, surowe ślady i SHA artefaktów w tym samym katalogu. Jeden przebieg na każdy czysty profil; kod aplikacji identyczny. Historyczny gesturePoint A: PASS/74 gesty; bieżący B: FAIL/64. Ruch wystąpił również w A. W B opóźnione `accordion-behavior.js:54` scrollTo smooth do 129.71875 uruchomione przez callback z linii 66 przesunęło scrollY 0→58 oraz cel INWESTOR y102→52. Przedtem compatibility click po open-room trafił w SUMMARY; zarejestrowany timer wystartował około 73 ms później. Pomiędzy końcową próbką i pointerdown nie było nowej komendy JS, ale działała wcześniej rozpoczęta animacja JS. To nie dowód ruchu niezależnego od JS ani potrzeby cofnięcia gesturePoint.

**Zmiana produkcyjna:** wyłącznie rozdzielenie listenera w bindings. Konsumpcja globalnego/same-element compatibility click działa na window/capture przed document; właściwy dispatch data-action pozostaje na document/capture. Dotychczasowe flagi, reset przy nowym pointerdown, preventDefault/stopImmediatePropagation i ochrona przed podwójną akcją pozostają. Normalny click i klawiatura przechodzą do istniejących konsumentów. Bez zmian w gesturePoint, finishPendingTouchScroll, scrollTo, accordion-behavior, UI, Auth, logice usuwania, danych biznesowych i Firebase. Index-only wersja bindings `20261031_compat_click_v1`; manifest regenerowany z rzeczywistych bajtów.

**Regresje:** nowy `compatibility-click-order-smoke.js` rejestruje konsumenta document przed instalacją prawdziwego bindings, a następnie sprawdza pojedynczy open-room, zablokowanie retargetowanego SUMMARY, dokładnie jeden skonsumowany click, normalny/klawiaturowy click, reset nowym pointerdown i brak podwójnego dispatch. Negatywna kontrola na oryginalnym bindings z wejściowego HEAD potwierdziła, że stary kod przepuszcza SUMMARY. Plik `*-smoke.js` jest automatycznie obowiązkowy w Preflight.

W istniejącym `investor-navigation-browser.js` pasywne liczniki rzeczywistego dispatch/scrollTo i SUMMARY: po jednym natywnym dotyku pokoju wymagane opens=1, summaryClicks=0, accordionScrolls=0 przez całe okno 70/510/680 ms. Następnie świadomy natywny dotyk SUMMARY musi go otworzyć i uruchomić dozwolone przewijanie, a natywna sekwencja Enter zamknąć. Okno 720 ms służy obserwacji timerów i ukończeniu celowo otwartego akordeonu, nie retry ani zwiększeniu timeoutu błędu. Wszystkie wcześniejsze natywne asercje i osiem wyjść zachowane przed i po pełnym usuwaniu/recovery. Helper jest wywoływany przez obowiązkowy trusted-session-browser-smoke w obu granicach na HEAD #91.

Pierwsza próba nowego testu doszła do poprawnego braku skutków ubocznych open-room, lecz nie aktywowała SUMMARY przez Enter: test wysłał keydown/keyup bez zdarzenia znaku. Poprawiono wyłącznie sekwencję CDP na keydown/char `\r`/keyup, bez sztucznego JS click lub zmiany asercji/produkcji.

Końcowy pełny celowany `trusted-session-browser-smoke.js`: **PASS, exit 0**, Node 22.23.3 / natywny Chromium 151. NAVIGATION_AB A_BEFORE_DELETE PASS i B_AFTER_DELETE PASS: w obu nowe asercje pokoju/SUMMARY/Enter oraz wszystkie osiem wyjść, identyczność RAW, sesja i zaufanie PASS. Pełne kasowanie/recovery/SW i utrata hint PASS. Świadomy logout offline i odmowa ponownego dostępu PASS. Nowy smoke kolejności zdarzeń PASS; kontrola negatywna odtwarza starą wadę. Składnia zmienionych JS, kanoniczne wersje HTML, manifest i obie grupy offline-shell oraz diff PASS. CLOUD-4 nadal dokładnie 6797 B, payload SHA `711f2fea49873bab0c4f76b5e8e0e666c4796190ed9fbfda71557d35890ba2e3`, bez zmian pinów. **CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED.** Pełne CI i fizyczny Android pozostają PENDING. Bez obsługi PR, Actions, merge, Pages, migracji i Firebase LIVE.

### PR #91 — trzy blokady infrastruktury CI #41231758866

Wejście `3ab4761f11b0532c0a5df74e07f0afdf9e295a50`, gałąź `fix/investor-list-delete-20261031`, BASE `571c8ae1975ea18237172ce8eb747306c83e9234`. HEAD/BASE i czyste drzewo sprawdzone przed zmianami. Odczytano [CI #41231758866](https://github.com/mebleszek/meble-app/actions/runs/41231758866): Safety i CLOUD Historical PASS, Preflight oraz Firebase Current FAIL, wydanie pominięte; logi jobów `124627307440` i `124627307477`.

1. **Quote Performance — CONFIRMED.** Fixture window nie miała addEventListener; wyjątek wystąpił przy prawidłowej instalacji window/capture w bindings. Naprawiono tylko fixture: osobne listenery window/document, kolejność capture, rzeczywiste stopPropagation/stopImmediatePropagation i wcześniejszy konsument document. Zachowano wszystkie kalkulacyjne asercje i poprzednie przypadki, dodano potwierdzenie wczesnej konsumpcji i pojedynczego kliknięcia klawiaturowego. Regresje obejmują brak podwójnej akcji, wtórny click i nowy fizyczny pointerdown.
2. **Offline logout — CONFIRMED błędny kontrakt testu.** `main-login.js:159` przy navigator.onLine=false zwraca unauthenticated przed tworzeniem SDK; plik jest identyczny z wydanym PR #89. Wcześniejsze oczekiwanie error/AUTH_SDK_UNAVAILABLE w PR #91 było błędne. Przywrócono unauthenticated, dodając: navigator offline, authCreations=0, brak authStatus, trustRestore absent, mode locked, cofnięty fence/proof po kolejnym zimnym starcie, brak APP_STARTED, __FC_MAIN_ACCESS__ false i AUTH_ACCESS_REVOKED przy biznesowym odczycie. Sam tekst stanu nie zalicza kontroli.

   Pierwsza nowa kontrola Chromium lokalnie zakończyła się FAIL: po zimnym starcie navigator był już offline, ale authCreations=1 i stan error. Poprzednia korekta ustawiała sieć po DOMContentLoaded, za późno względem initialize w nowym rendererze. Fixture teraz zatrzymuje swój pierwszy wstrzyknięty skrypt przez testowe CDP Debugger, ustawia Network.overrideNetworkState przed jakimkolwiek kodem aplikacji, wznawia i asercją wymaga __OFFLINE_BOOT_ONLINE__===false. Rzeczywista blokada sieci jest włączona jeszcze przed nawigacją, origin HTTP pozostaje wyłączony. Bez shimu navigatora, wywoływania produkcyjnego logowania, alternatywnego oczekiwania error, retry czy zwiększenia timeoutu. Błąd ustawienia lub brak pauzy daje FAIL. Bramka dotyczy tylko offline Chromium fixture i działa też na nowych dokumentach recovery.
3. **Firebase — CONFIRMED błąd emulatora, UNCONFIRMED konkretny producent strumienia.** Log CI: druga partia 34/35, hook pierwszego CLOUD-4.2 clearFirestore HTTP500, CloudFirestoreV1.clearData → ListenStreamManager.notifyDocumentListeners → Stream is already completed. W logu LOCAL-FIRST zakończył się przed CLOUD-4.2, mimo innej kolejności argumentów CLI (Node porządkuje pliki). Statycznie prześledzono cloud-sync afterEach/after, local-first t.after, application-e2e t.after, synchronizer.close i transport.close: odpinanie onSnapshot/online, zakończenie kontrolowanych przeglądarek, oczekiwane terminate/deleteApp wszystkich transportów i env.cleanup. Sam close synchronizatora jest synchroniczny, a cleanup transportu jest oczekiwany; nie dowodzi to źródła zamkniętego serwerowego watch ani braku każdego możliwego wyścigu. Nie zmieniano produkcyjnego synchronizatora ani cleanup bez reprodukcji winnego klienta.

   CLOUD-4.2 ma teraz własne `emulators:exec`, nowy proces Java, pusty serwer bez importu/eksportu i odrębny katalog ustawień CLI. Plan **[5,1,2]** zachowuje dokładnie wszystkie 8 CURRENT: pilot/auth/access/global/live-readiness; osobno cloud42-plan; cloud44-admin/cloud-sync-global (z całym LOCAL-FIRST i application E2E). Każdy proces kończy się przed następnym, błędy uruchomienia i TAP nadal blokują grupę. Nie istnieje współdzielony serwer watch między CLOUD-4.2 i pozostałymi plikami. Nie akceptujemy HTTP500 ani nie ponawiamy clearFirestore. Boundary smoke wymaga dokładnego podziału, niezmienionej inwentaryzacji i wszystkich plików dokładnie raz; osobny historyczny checkout SHA306f90a4/425 pinów bez zmian. Izolacja usuwa współdzielenie wadliwego stanu, nie jest twierdzeniem o naprawie kodu emulatora.

Końcowe dowody (Node 22.23.3, Chromium 151, Java 21, przypięty emulator Firestore 1.22.0, bez reinstalacji):

| Kontrola | Wynik |
| --- | --- |
| Quote Performance | 22/22 PASS, zachowane obliczenia; po doprecyzowaniu rejestracji wcześniejszego document/capture wykonano dodatkowo tylko końcową regresję fixture, PASS. |
| Natywny trusted-session-browser-smoke | PASS, exit0: A_BEFORE_DELETE i B_AFTER_DELETE, jeden dispatch i brak SUMMARY/scroll po open-room, świadomy SUMMARY/Enter, osiem wyjść w obu granicach, RAW, trwały IndexedDB/SW recovery, zaufanie i logout. Końcowy zimny start: unauthenticated, navigator offline przed pierwszym kodem, 0 Auth/SDK, brak inherited authStatus, trwale revoked fence/proof, brak aplikacji i AUTH_ACCESS_REVOKED przy biznesowym odczycie. SDK/grant wejściowy w tym fixture jest jawnie syntetyczny; to nie LIVE. |
| Rzeczywiste emulatory CURRENT przez zmieniony runner | **107/107 PASS**, wszystkie 8 plików, trzy odrębne cykle: 72/72, sam CLOUD-4.2 4/4, pozostałe 31/31 z pełnym CLOUD-SYNC/LOCAL-FIRST/application E2E. W każdej partii 0 fail/cancel/skip/todo, pełny TAP, normalny shutdown przed kolejnym uruchomieniem. Bez retry i bez zaakceptowanych HTTP500. |
| Boundary/integralność | PASS: dokładnie [5,1,2], flatten identyczny z całą inwentaryzacją CURRENT, osobny sam CLOUD-4.2, brak utraty testów, historyczny SHA306f90a4/425 pinów niezmieniony, bramki production refusal bez IO. |
| Składnia / diff / manifest | PASS wszystkich 4 zmienionych JS; manifest offline aktualny bez regeneracji, ponieważ nie zmieniono publicznych zasobów. Diff ograniczony do testów/runnera i dwóch dokumentów. |

Logi lokalne: `/tmp/pr91-blockers-quote.log`, `/tmp/pr91-blockers-browser2.log`, `/tmp/pr91-blockers-firebase.log`, `/tmp/pr91-blockers-boundary.log`. Pierwszy nieudany lokalny cold-start zachowano w `/tmp/pr91-blockers-browser.log` i nie zaliczono go jako PASS. Pierwotne źródło zamkniętego strumienia pozostaje UNCONFIRMED; zaliczony świeży cykl dowodzi izolacji, nie naprawy wewnętrznego emulatora. Wszystkie 4 narzędzia pozostają w dotychczasowych obowiązkowych grupach (smoke przez Preflight, runner przez firebase-current); workflow nie zmieniano. **CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED.** Następny krok: niezależna kontrola i odrębna zgoda wydaniowa dla wynikowego HEAD/BASE. Produkcyjne JS, UI, Rules, dane, piny, kolejki, usuwanie i wtórny click pozostają bez zmian. Nie uruchamiano pełnego Preflightu, historycznych emulatorów ani GitHub Actions; nie zmieniano PR, Ready/Draft, merge, Pages lub Firebase LIVE.
