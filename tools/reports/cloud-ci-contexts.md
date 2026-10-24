# CLOUD/CI — rozdzielenie dowodu historycznego i bieżących źródeł

Pakiet WYCENA-LABOR-REPAIR, zgoda implementacyjna 24.10.2026. Procedura jest przygotowana; pełne wykonanie GitHub Actions: **CI_PENDING**. Bez zgody na wydanie, Rules, granty, migrację ani Firebase LIVE.

## Źródło historyczne

Jedyny dopuszczony commit: `306f90a4cfd8bcb4277aa8b4d140e911493ddd60`; Git tree `4104e0d1498889e2740403cdd7fa8139568506fe`. Pełny odizolowany checkout tego commita potwierdzono lokalnie: oryginalne `cloud42-package.inventory()` akceptuje wszystkie 425 pinów. To techniczny odczyt integralności, nie ponowienie historycznych zestawów ani autoryzacja produkcyjna.

`cloud42-source-pins.json` odwołuje się do pierwotnego `44b5be9…` i zatwierdzonego późniejszego source review. Nie należy utożsamiać tego pola z kompletnym drzewem wszystkich późniejszych dowodów C/D/E. Commit powyżej zawiera całe zatwierdzone drzewo, włącznie z tymi dowodami. Piny obejmują aplikację uruchamianą przez pakiet operatorski, dlatego aktualizacja aplikacji prawidłowo powoduje `CLOUD42_SOURCE_CHANGED`.

Workflow pobiera historię Git, klonuje lokalnie całe repozytorium z `--no-hardlinks --no-checkout` poza katalog testowanej aplikacji (`RUNNER_TEMP`), następnie wykonuje detached checkout dokładnego SHA. Nie składa historycznej aplikacji z pojedynczych podmienianych plików. Weryfikator wymaga SHA, niezmienionych plików śledzonych, braku obcych plików poza zależnościami/logami emulatorów oraz wszystkich oryginalnych pinów. Brak źródła, zagnieżdżenie drzew lub rozbieżność kończą kontrolę błędem. Nie ma fallbacku do aktualnego kodu ani automatycznego odświeżania manifestów.

## Przypisanie zestawów

| Kontekst | Kontrole | Źródło |
|---|---|---|
| Historyczny smoke | `cloud42-live-preparation`, `cloud43a-production-baseline`, `cloud43b-gate1-approval`, `cloud44-gate2`, `cloud46c-proof`, `cloud46d-preparation`, `cloud46e-connection` — oryginalne `tools/*-smoke.js` | Dokładny historyczny commit |
| Historyczny SDK | `cloud46c-executor.test.mjs`, `cloud46d-emulator.test.mjs`, `cloud46e-emulator.test.mjs` | Ten sam pełny historyczny commit |
| Bieżący smoke | Wszystkie pozostałe automatycznie wykryte smoke, w tym WYCENA-LABOR, Chromium i `cloud-ci-current-boundary-smoke.js` | Aktualny checkout CI |
| Bieżący SDK | `pilot`, `auth`, `access`, `global`, `live-readiness`, `cloud42-plan`, `cloud44-admin`, `cloud-sync-global` — pliki `.test.mjs` | Aktualny checkout CI |

`tools/cloud-ci-context.js` zawiera zamknięty podział. Suma zestawów SDK musi dokładnie odpowiadać dotychczasowemu poleceniu `scripts.test` w obu niezmienionych `package.json`; nowy nieprzypisany zestaw oznacza FAIL. Historyczne skrypty smoke i SDK muszą mieć te same bajty w bieżącym i historycznym drzewie, aby zmiana testu nie została ukryta przez routing. Nie zmieniono tych skryptów ani chronionego `package.json`.

`tools/preflight.js` kieruje siedem testów do historycznego drzewa, z jego własnym cwd. Po ich wykonaniu ponownie sprawdza integralność. Składnia, kolejność ładowania, zależności i audyt storage nadal dotyczą aktualnej aplikacji. Workflow zawsze testuje checkout źródeł; nie zastępuje bieżącego HEAD archiwum `site*.zip`.

## Aktualny kod i odmowa LIVE

Nowy smoke sprawdza dokładnie `CLOUD42_SOURCE_CHANGED` dla inventory 4.2/C/D/E, przygotowania pakietu, kontroli Rules oraz otwarcia/recovery połączenia. Przechwytuje próby sieciowe i zapisy dziennika: muszą pozostać niewykonane. `executeProduction()` nadal bezwarunkowo odmawia. Nie dopuszczamy ogólnego oczekiwania „dowolny błąd” ani historycznego PASS jako certyfikatu nowego HEAD.

## Emulatory i raport

Po przygotowaniu Node/Java workflow instaluje osobno istniejące lockfile zależności w obu drzewach. `tools/cloud-ci-emulators.js` uruchamia dwie kolejne, oddzielne instancje Emulator Suite: wyłącznie `--project demo-meble-app --only auth,firestore`, Auth `127.0.0.1:19099`, Firestore `127.0.0.1:18080`. Sprawdza konfigurację loopback, usuwa odziedziczone dane uwierzytelniające i używa osobnego pustego `XDG_CONFIG_HOME`. Nie wykonuje login/deploy ani operacji LIVE.

Runner wykonuje obie grupy także po niepowodzeniu pierwszej. Wymaga poprawnego kodu wyjścia oraz raportu TAP z dodatnią liczbą testów, wszystkimi PASS i zerem FAIL/cancelled/skipped/todo. Brak zależności lub raportu oznacza FAIL. SDK pozostaje obowiązkowe; po poprawnym przygotowaniu kontekstów krok SDK jest podejmowany również wtedy, gdy smoke zakończył się FAIL. Błąd instalacji/Java nie może prowadzić do zielonego joba ani merge.

Jeden `GITHUB_STEP_SUMMARY` zawiera HEAD/BASE zdarzenia PR, rzeczywisty SHA checkoutu (zwykle merge testowy), historyczne SHA, wyniki smoke obu kontekstów i osobne wyniki SDK wraz z plikami. Historyczny PASS odnosi się wyłącznie do historycznego SHA. Zdarzenia workflow, zgoda na próbę, warunki auto-merge i sprawdzanie dokładnego merge SHA dla Pages pozostają bez zmian. Push na gałąź WYCENY nie uruchamia pełnego wydaniowego Preflightu.

## Brakujące wykonanie

Przygotowanie i celowana diagnostyka nie zastępują pełnego Preflightu, siedmiu historycznych smoke, ośmiu bieżących i trzech historycznych zestawów SDK ani Chromium. Wszystkie wymagają przyszłej osobno zatwierdzonej próby GitHub Actions dla nowego HEAD/BASE. Zmiana historycznych pinów, podpisów, CAS lub bramek LIVE pozostaje osobnym zakresem bezpieczeństwa.
