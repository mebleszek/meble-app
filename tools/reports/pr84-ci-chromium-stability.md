# PR #84 — stabilizacja Chromium / CI

Gałąź `local-first-sync-durable-20261028`; wejściowy HEAD `4fd287f63ebf3bc71081fb74be44fa27afcdd61c`; BASE/main `149f9a126a85f9972f5fc1cd19afdc264be98cc7`. Nowy HEAD wskazuje końcowy raport i referencja istniejącej gałęzi. Jeden spójny commit naprawczy, bez nowej próby CI, PR, merge, Pages i Firebase LIVE.

## Dowody z trzech przebiegów

| Przebieg | Dowód i rozstrzygnięcie |
|---|---|
| [40675616060](https://github.com/mebleszek/meble-app/actions/runs/40675616060) | Smoke 159/161. Empty-installation wykonał oba scenariusze biznesowe, ale końcowa kontrola błędów wykryła `Invalid InterceptionId`. LOCAL-FIRST potwierdził pierwszy zapis IDB, po czym restart trafił w martwy port 33655. Brak bariery Fetch przed reloadem oraz stary DevToolsActivePort naprawiono wcześniej w `db621bdb…`; te poprawki pozostają. |
| [40720250777](https://github.com/mebleszek/meble-app/actions/runs/40720250777) | Pełny Preflight PASS, 161/161 smoke. Następnie nowa suita LOCAL-FIRST zatrzymała się przed scenariuszami na kompilacji Rules: Unexpected `}` / `)` / `match`. String.replace traktował `$'` jako podstawienie sufiksu. Callback w `4fd287f6…` zachowano bez zmian. Nie jest to błąd uruchamiania Chromium ani dowód wykonania nowych scenariuszy SDK. |
| [40724427171](https://github.com/mebleszek/meble-app/actions/runs/40724427171) | Smoke 159/161. Empty-installation: 60 s bez endpointu CDP, proces nadal żył. WYCENA-LABOR: 30 s bez wyniku DOM. W obu stderr zawierał nieprawidłowy adres D-Bus. Testy nie dotarły do asercji domenowych. Brak liczników CPU/RAM/FD/PID przed awarią; log nie dowodzi OOM ani braku miejsca. |

**Klasyfikacja:** błędy mechanizmów testowych i niekontrolowane środowisko headless. Potwierdzono niespójny wybór binarium w różnych harnessach, zależność od odziedziczonego D-Bus, zabijanie tylko lidera oraz brak cleanup przy błędzie startu/handshake LOCAL-FIRST. Sam stderr D-Bus nie dowodzi, że jest jedyną przyczyną timeoutów; nowa próba runnera jest nadal potrzebna.

Preflight uruchamia smoke sekwencyjnie (`spawnSync`, sort nazw); SDK używa `--test-concurrency=1`. Nie znaleziono równoległego uruchamiania tych dwóch smoke. Empty-installation jest pierwszym rzeczywistym startem Chromium w tym ciągu, więc jego timeoutu nie przypisujemy wyciekowi późniejszego LOCAL-FIRST. Każdy run ma oddzielny host — nie ma dowodu kumulowania procesów między trzema runami. Osierocone procesy mogą wpływać na późniejsze testy tego samego runu. Oddzielne jednoczesne przeglądarki urządzeń w teście LOCAL-FIRST zachowano.

## Naprawa

1. `tools/helpers/chromium-runtime.js` zapewnia jeden cykl życia dla wszystkich czterech harnessów Chromium używanych przez CI. Każdy start ma własny profil testowy, cache/config i prywatną sesję D-Bus bez aktywowania usług desktopowych. Usuwane są odziedziczone adresy D-Bus; nie korzystamy z pulpitu runnera. Wybór jednego binarium oraz jego wersja są widoczne w workflow. Nie zmieniono obrazu runnera ani nie dodano instalacji/aktualizacji przeglądarki.
2. Start usuwa wyłącznie nieaktualny plik `DevToolsActivePort`, odmawia równoczesnego użycia profilu, używa istniejącego nadzoru endpointu, następnie sprawdza `/json/version` i identyfikator procesu CDP. Nie ma retry/relaunch. HTTP ma osobny limit 5 s. Dotychczasowe limity pozostają: empty-installation i LOCAL-FIRST 60 s, storage-recovery 15 s, WYCENA DOM 30 s i virtual-time-budget 2000.
3. `tools/helpers/chromium-process.py` jest linuksowym subreaperem jednej rodziny przeglądarki. Zbiera również odłączone/double-fork/setsid helpery. Sygnalizuje wyłącznie własnych potomków, z kontrolą czasu utworzenia PID; nie używa globalnego pkill. Najpierw TERM, po 1 s eskalacja do KILL. Czeka i wykonuje waitpid, także po wyjściu lidera. Potwierdzenie `descendants-reaped` powstaje dopiero po braku potomków. Brak potwierdzenia lub niepewny cleanup oznacza FAIL i blokadę ponownego użycia profilu. Osłona wymaga Linux, /proc, Python 3 i dbus-run-session, dostępnych na docelowym runnerze Ubuntu; brak wymagań jest jawnym błędem.
4. Zwykłe `close()` jest oczekiwanym zamknięciem. Oddzielne `crash()` żąda natychmiastowego SIGKILL potomków i ich zebrania. Dwa celowe crash injection — otwarta transakcja IDB i utracony ACK z restartem — wywołują teraz jawnie `crash()`. Nie zastąpiono testu awarii łagodnym zamknięciem.
5. Każda ścieżka błędu startu, endpointu lub inicjalizacji CDP LOCAL-FIRST kończy cleanup. Profil można ponownie otworzyć dopiero po jego potwierdzeniu. Nie usuwa się SingletonLock, IndexedDB, outboxu, recovery ani innych danych profilu w celu wymuszenia startu. Usuwane runtime/cache/konfiguracja należą wyłącznie do tego uruchomienia testowego.
6. Dump DOM WYCENY ma asynchroniczny nadzór z tym samym 30 s limitem i 8 MiB limitem stdout. Nie przepisuje wyniku ani stderr na PASS; kod wyjścia, timeout i błędy asercji pozostają błędami. Treść obu funkcji wykonywanych w przeglądarce i wszystkie ich asercje są identyczne.
7. Preflight zapisuje START/END, nazwę, kontekst, kod i czas każdego smoke, a przy błędzie także snapshot zasobów. Runtime raportuje wybrany plik wykonywalny, PID, ograniczony stderr, load, MemAvailable, limity PID/FD, cgroup memory/pids i wolne /tmp oraz /dev/shm. Nie wypisuje zmiennych środowiska, poświadczeń ani danych aplikacji. Oczekiwanie na gotowość nie jest zastępowane stałym sleep.

## Zmienione pliki

- `.github/workflows/preflight-js.yml` — tylko kontrola dostępności runtime, wybór/wersja przeglądarki i snapshot zasobów. Triggery, wymagane kroki, HEAD/BASE, auto-merge i Pages bez zmian.
- `tools/helpers/chromium-runtime.js`, `tools/helpers/chromium-process.py` — wspólny nadzór i zbieranie potomków.
- `tools/empty-installation-browser-smoke.js`, `tools/storage-recovery-browser-smoke.js`, `tools/helpers/local-first-browser.mjs`, `tools/wycena-labor-ui-browser-smoke.js` — podłączenie czterech istniejących harnessów i oczekiwanie na cleanup.
- `tools/local-first-store-smoke.js`, `tools/firebase-pilot/local-first.test.mjs` — po jednej zmianie jawnego close → crash w rzeczywistym fault injection.
- `tools/preflight.js` — kolejność/stan/czasy i diagnostyka błędu, bez zmiany listy lub warunków zaliczania testów.
- `tools/chromium-runtime-smoke.js` — nowe regresje wykrywane automatycznie przez istniejący Preflight.
- `tools/reports/pr84-ci-chromium-stability.md` — ten raport.

## Rzeczywiście wykonane kontrole

- Nowe celowane `chromium-runtime-smoke.js`: **8 grup PASS**. Cztery grupy używają rzeczywistych procesów Linux/Python/sh: oporny potomek, nietknięta obca grupa, wyjście lidera i setsid/reaping, zwykłe zamknięcie kontra crash, błąd spawn. Cztery grupy protokołu używają rzeczywistego kodu runtime ze wstrzykniętymi granicami OS/CDP: świeży endpoint, brak retry, brak kasowania profilu, timeout/exit/HTTP/obca tożsamość, nienaruszony FAIL DOM i odmowa przy braku receipt. Nie są to testy aplikacji na Chromium ani Firebase.
- Składnia **9 JS/MJS + AST Python: PASS**. Kontrola diffu, zachowania wszystkich istniejących asercji biznesowych i identycznych funkcji fixture WYCENY/diagnostyki: PASS. Dawne warunki dostępności binarium zastąpiła jawna odmowa w wspólnym runtime, bez skip.
- Wyłącznie eksportowany statyczny `workflowChecks()` z istniejącego testu: PASS; obowiązkowe SDK, propagacja FAIL, triggery zgody i porównania HEAD/BASE pozostały. Nie uruchamiano pełnego tego zestawu ani Preflightu.
- Próba samego rzeczywistego startu Chromium z nowym runtime: **BLOCKED/FAIL przed gotowością** — lokalna polityka zabrania utworzenia socketu D-Bus (`Failed to bind socket: Operation not permitted`). To ograniczenie środowiska Codexa, nie rozpoznanie przyczyny awarii GitHuba. Po tej próbie delta procesów Chrome/DBus wyniosła **0**, sentinel profilu pozostał niezmieniony. Nie zaliczamy Chromium, testów biznesowych ani SDK jako PASS.
- Nie uruchamiano pełnych testów lokalnych, emulatorów ani nowego workflow. Istniejące źródła aplikacji, synchronizator, Rules, manifesty, testy historyczne C/D/E i helper chromium-startup pozostają bez zmian. Frozen checkout `306f90a4cfd8bcb4277aa8b4d140e911493ddd60` i 425 pinów nie były modyfikowane.

## Brakujące dowody i ryzyka

Wymagane jest osobno zatwierdzone CI dla nowego HEAD i niezmienionego BASE: pełny Preflight (w tym nowy smoke i rzeczywiste harnessy), obydwa konteksty Auth/Firestore/Rules oraz wszystkie scenariusze LOCAL-FIRST. Bez tego nie deklarujemy trwałego usunięcia wszystkich przejściowych problemów hosta. Zmiana wersji Chrome/obrazu Ubuntu, rzeczywiste limity zasobów i wydajność pod obciążeniem pozostają obserwacją przyszłej próby; dodane logi umożliwią rozpoznanie zamiast kolejnego zgadywania. Brak dowodu OOM, quota lub współbieżności nie został zamieniony w diagnozę tych problemów.

Nie zmieniano funkcjonalności aplikacji, WYCENY/RYSUNKU, rzeczywistych danych, migracji, Firebase LIVE ani produkcyjnych Rules. **CODE_READY / CI_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED.** Nie przełączano PR Draft/Ready, nie ponawiano Actions i nie wykonywano merge.
