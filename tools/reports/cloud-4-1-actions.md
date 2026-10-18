# CLOUD-4.1 — izolowane testy GitHub Actions

Workflow `.github/workflows/cloud41-emulator-tests.yml` wykonuje testy automatycznie
po pushu wyłącznie na `cloud-4-1-private-pilot-execution`. Jest osobną, zatwierdzoną
przez właściciela procedurą weryfikacji gałęzi roboczej; nie zastępuje zgód na
Ready/auto-merge/Pages ani na jakąkolwiek operację produkcyjną Firebase.

Sprawdza dokładny SHA zdarzenia push, pochodzenie od WIP
`0670c71bd223ab00cdb2e10fe2cca093c2bceeb8`, jego drzewo
`9d648975fa1f0d9c48a7989b76e45eca8fc80f7c` oraz niezmienność wszystkich
plików poza tym workflow i niniejszym dokumentem. Minimalne Rules pozostają
przypięte do SHA-256
`eaeb3e67417955bbd67d2881902d3827023502c2948ce0a19dc583c66b5a2e92`.

Node 22, Java 21, `npm ci` z istniejącego lockfile i oficjalny Chromium z przypiętego
Playwright zapewniają środowisko testowe. Oficjalny Firebase CLI pobiera emulator
Firestore v1.22.0. Testy używają wyłącznie `demo-meble-app`, lokalnego Auth
`127.0.0.1:19099` i Firestore `127.0.0.1:18080`, bez poświadczeń produkcyjnych.

Kolejno wykonuje się: `test:live-readiness`, `test:private-pilot`, pełny `npm test`,
`test:private-startup`, pełny `test:browser` z `AUTH_POPUP_TEST=1` oraz
`node tools/preflight.js`. Każdy proces emulatorów kończy się przed następnym.
Istniejący `test:private-pilot` filtruje grupę CLOUD-4.1; pozostałe grupy są następnie
wykonywane przez pełny zestaw przeglądarkowy bez filtra. Pełne zestawy wymagają
zerowej liczby pominięć. Popup używa syntetycznej tożsamości w emulatorze; pobierany
jest publiczny helper Google, bez rzeczywistego logowania do konta Google.

Rzeczywisty błąd zatrzymuje dalsze zestawy. Nieuruchomione zestawy nie są PASS.
Workflow nie ponawia prób automatycznie; ma limit 60 minut, limity etapów oraz
concurrency dla tej gałęzi. Dostępne logi są zachowywane jako artefakt przez 7 dni.
Status należy ustalać z zakończonego przebiegu i logów, nie z samego pushu.

Uprawnienia to wyłącznie `contents: read`; checkout nie utrwala poświadczeń.
Brak PR, dispatch, schedule, sekretów produkcyjnych, OIDC, deployu lub merge.
Istniejące workflow wydaniowe i pliki aplikacji pozostają bez zmian.
