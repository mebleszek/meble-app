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
