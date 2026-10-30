# Android: odmowa otwarcia inwestora po PR #88

Gałąź: `fix/android-open-investor-20261030`. BASE: `988763876770655b47f1aadd9285d8dad1538d10`.

## Przyczyna i poprawka

Ścieżka: natywny pointerup/click → `open-investor` → `sessionNavigation.requestTransition` → `investorPersistence.setCurrentInvestorId` → patched setter → `investorProjectRuntime` → centralny projectStore → render. Gest dociera do handlera. Setter już aktywował zmienionego inwestora, lecz handler aktywował go ponownie.

Reprodukcja na rzeczywistych modułach ze starszą szafką: pierwsza aktywacja `true`, druga `false`. Konkretne różnice po pierwszym renderze: `kuchnia.cabinets[0].frontCount` (brak → 2) i `details` (brak → {}). Dla starszych zestawów bootstrap uzupełnia także `sets[].number` i powiązane `cabinets[].setNumber`. Czytnik centralny nie dodawał tych samych istniejących wartości domyślnych. Efektem była pozorna niezapisana zmiana i milcząca odmowa.

- Odczyt kopii projektu i render stosują te same dotychczasowe wartości domyślne. Bez zapisu RAW, regenerowania ID, zaokrąglania lub nowego schematu. Rzeczywiste zmiany szerokości/liczby frontów nadal tworzą rozbieżność.
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

## Celowane kontrole

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

## Wydanie i ryzyka

PR #88 został scalony: HEAD `9d45b4a050a930d577a6931a82d00005d0f74fab`, merge/BASE powyżej; [41139176509](https://github.com/mebleszek/meble-app/actions/runs/41139176509) potwierdza Safety, Preflight, Firebase Current, CLOUD Historical, auto-merge i sprawdzenie Pages dla dokładnego merge SHA. To dowód poprzedniego wydania, nie nowej poprawki.

Nowa poprawka: **CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**. Pełne CI i fizyczny Android oczekują na osobne zatwierdzenie wydania. Reprezentatywne historyczne dane testowe nie dowodzą zgodności z każdym uszkodzonym rekordem urządzenia; zasadna odmowa nadal zachowuje dane i pokazuje przyczynę w aplikacji. Żadnych operacji produkcyjnych ani obsługi PR/wydania w tym zadaniu.
