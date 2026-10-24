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

Smoke sprawdza dokładną odmowę właściwą dla konkretnej ścieżki i kolejności jej kontroli integralności. Przygotowanie pakietu 4.2 i kontrola Rules rozpoczynają od `cloud42-package.inventory()`. Inventory C najpierw sprawdza swój pakiet, potem bajty `cloud44-integrity.json` i jego zależności (w tym AGENTS.md), a dopiero potem źródła aplikacji. D deleguje do C przed własną kontrolą; E deleguje do D przed własną kontrolą. Otwarcie i recovery operatora E zaczynają od tej samej walidacji uprawnień/inventory.

| Pierwsza naruszona kontrola | Dokładna odmowa i propagacja |
|---|---|
| Źródła aplikacji, przy niezmienionych wcześniejszych zależnościach | `CLOUD42_SOURCE_CHANGED`; propagowane również przez C/D/E i otwarcie/recovery E. |
| Chroniona zależność CLOUD-4.4, np. zatwierdzona edycja AGENTS.md | `CLOUD46C_DEPENDENCY_CHANGED` w C i dalej D/E oraz otwarcie/recovery. Bezpośrednie 4.2 nadal bada źródła swoim kontraktem. |
| Pakiet/manifest C | `CLOUD46C_PACKAGE_CHANGED`, propagowane przez D/E. |
| Pakiet/manifest D po poprawnych wcześniejszych kontrolach | `CLOUD46D_REVIEWED_SOURCE_CHANGED`, propagowane przez E. |
| Pakiet/manifest E po poprawnych wcześniejszych kontrolach | `CLOUD46E_PACKAGE_CHANGED`. |

To nie zbiorcza lista wyjątków akceptowanych wszędzie. Bieżący test najpierw wymaga niezmienionych historycznych manifestów i kodu operatora/testów względem zweryfikowanego historycznego drzewa. Dopiero na podstawie rzeczywistej rozbieżności pozostałych zależności CLOUD-4.4 wybiera jedną oczekiwaną odmowę dla C/D/E. Dla 4.2 nadal wymaga dokładnie `CLOUD42_SOURCE_CHANGED`. Zmiana chronionego manifestu lub implementacji nie może sama przepisać oczekiwań i zalegalizować nowego pakietu. Testy naruszeń pozostałych warstw wykonują się wyłącznie na kompletnych, odizolowanych kopiach syntetycznie zmienionego drzewa — nigdy na historycznym źródle ani danych właściciela; nie nadają tym kopiom historycznego PASS/uprawnień.

Przechwytywanie obejmuje sieć, synchroniczne/asynchroniczne zapisy i otwieranie do zapisu, timery oraz procesy potomne; także przechwycona przez kod próba IO powoduje FAIL. Dopuszczone są niezbędne lokalne odczyty. `executeProduction()` nadal bezwarunkowo odmawia. Dowolny inny błąd, inny typ wyjątku lub nieoczekiwany sukces są odrzucane. Historyczny PASS nie certyfikuje bieżącego HEAD.

## Emulatory i raport

Po przygotowaniu Node/Java workflow instaluje osobno istniejące lockfile zależności w obu drzewach. `tools/cloud-ci-emulators.js` uruchamia dwie kolejne, oddzielne instancje Emulator Suite: wyłącznie `--project demo-meble-app --only auth,firestore`, Auth `127.0.0.1:19099`, Firestore `127.0.0.1:18080`. Sprawdza konfigurację loopback, usuwa odziedziczone dane uwierzytelniające i używa osobnego pustego `XDG_CONFIG_HOME`. Nie wykonuje login/deploy ani operacji LIVE.

Runner wykonuje obie grupy także po niepowodzeniu pierwszej. Wymaga poprawnego kodu wyjścia oraz raportu TAP z dodatnią liczbą testów, wszystkimi PASS i zerem FAIL/cancelled/skipped/todo. Brak zależności lub raportu oznacza FAIL. **Pełny Preflight PASS jest teraz jawnym warunkiem przygotowania Java, instalacji zależności i uruchomienia SDK.** Po FAIL Preflight kosztowne kroki są SKIPPED, a podsumowanie wskazuje „not PASS / Release BLOCKED”. Po PASS wszystkie dotychczasowe bieżące i historyczne zestawy pozostają obowiązkowe. Błąd Java, instalacji albo emulatorów blokuje job i merge; auto-merge jawnie wymaga `needs.preflight.result == 'success'`. Nie zmieniono wyzwalaczy, uprawnień ani ochrony dokładnych HEAD/BASE.

Jeden `GITHUB_STEP_SUMMARY` zawiera HEAD/BASE zdarzenia PR, rzeczywisty SHA checkoutu (zwykle merge testowy), historyczne SHA, wyniki smoke obu kontekstów i osobne wyniki SDK wraz z plikami. Historyczny PASS odnosi się wyłącznie do historycznego SHA. Zdarzenia workflow, zgoda na próbę, warunki auto-merge i sprawdzanie dokładnego merge SHA dla Pages pozostają bez zmian. Push na gałąź WYCENY nie uruchamia pełnego wydaniowego Preflightu.

## Szybka kontrola przed zgłoszeniem CODE_READY

Przed PR/próbą wydania, również przy zmianach dokumentacji, uruchomić:

```sh
node tools/cloud-ci-impact.js --base <dokładne-40-znakowe-BASE-SHA>
```

Opcja `--json` zwraca ten sam raport strukturalnie. Kontrola obejmuje zmiany całej gałęzi oraz staged/unstaged/untracked; rename jest traktowany także jako usunięcie starej ścieżki. Czyta pięć deklarowanych manifestów SHA-256 z niezmiennego historycznego commita Git, z wyłączonymi replace objects, a nie ze zmodyfikowanego manifestu roboczego. Raport pokazuje bezpośrednie piny, istotne pośrednie zależności, propagowane kody odmowy i powiązane testy. Nowy JS w `js/` wskazuje również zmianę zbioru źródeł. Zakres to zadeklarowany graf CLOUD, nie pełny audyt repozytorium ani certyfikat braku wszystkich innych zależności.

Przykład PR #82: `AGENTS.md` jest przypięty w CLOUD-4.4 i powoduje `CLOUD46C_DEPENDENCY_CHANGED` propagowane przez C/D/E; `index.html` i moduły UI są objęte 425 pinami źródeł. Raport nie twierdzi, że zmieniły się bajty wszystkich manifestów pośrednich. Legalna edycja dokumentacji to sygnał do kontroli właściwej odmowy, **nie automatyczny zakaz wydania**. Nieaktualny test należy naprawić w zatwierdzonym zakresie, nigdy przeliczać stare piny.

Jeżeli raport wskazuje wpływ CLOUD, przygotować pełne izolowane drzewo historyczne zgodnie z sekcją „Źródło historyczne” (dokładny SHA i `verifyHistorical()`), a następnie wykonać tylko potrzebne kontrole celowane:

```sh
CLOUD_CI_HISTORY_ROOT=<pełne-izolowane-drzewo-historyczne> node tools/cloud-ci-current-boundary-smoke.js
CLOUD_CI_HISTORY_ROOT=<pełne-izolowane-drzewo-historyczne> node tools/cloud-ci-reliability-smoke.js
```

Nie kierować tych poleceń na częściową rekonstrukcję ani bieżące drzewo. Nie uruchamiają SDK, emulatorów ani produkcji. Nie uruchamiać lokalnie całego Preflightu i historycznych zestawów tylko dlatego, że wymienia je raport wpływu; pełne historyczne/bieżące smoke i SDK wykona GitHub Actions po osobnej zgodzie. Nie modyfikować manifestów, podpisów, CAS ani bramek LIVE. Po kontroli diffu zapisać HEAD/BASE i poprosić o osobną decyzję wydaniową; sam push nie jest nową próbą.

## Naprawa PR #82 — dowody i granice

Stan wejściowy: HEAD `28cf6c25cc1b6eb2a8f365af711d1a2b64fae021`, BASE/main `767c1c79acacc4d8334aa0d79a99b36d7af28ba8`; [run 40130456563](https://github.com/mebleszek/meble-app/actions/runs/40130456563), job `120980866680`. Log potwierdza 150/151 smoke PASS, rzeczywiste źródło merge testowego `4e039bb9a1f63b37fd7e4a894fa30231377dfbcc`, błędne oczekiwanie `CLOUD42_SOURCE_CHANGED` zamiast prawidłowego `CLOUD46C_DEPENDENCY_CHANGED`, a następnie zbędne wykonanie obu grup SDK po FAIL. Ich stary PASS nie dotyczy nowego commita.

Lokalnie naprawiony bieżący test graniczny PASS: 4.2 → SOURCE_CHANGED, C/D/E i oba wejścia połączenia → DEPENDENCY_CHANGED; zero IO, LIVE zablokowany. `cloud-ci-reliability-smoke.js`: **11 grup PASS**, w tym siedem odizolowanych wariantów naruszeń źródeł/manifestów, negatywne asercje błędów i IO, graf wpływu, rename oraz statyczna kontrola i model wyników workflow. Składnia zmienionych JS, parsowanie YAML i kontrola diffu PASS. To **nie jest wykonany workflow GitHub Actions**; rzeczywista bramka FAIL/PASS i wszystkie zestawy emulatorowe dla nowego HEAD pozostają **CI_PENDING**.

Nie zmieniono historycznych manifestów, kodu Firebase, podpisów, Rules, hashy CAS ani stałego SHA historii. Pliki diagnostyki Pixela oraz zatwierdzona zasada AGENTS „bez USB/narzędzi programistycznych” pozostają dokładnie jak w wejściowym HEAD PR #82. Nie wykonano żadnej operacji telefonu, PR Ready/Draft, merge, Pages lub Firebase LIVE. **CODE_READY / CI_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**; użycie nowej diagnostyki na aktualnej karcie Pixela nadal BLOCKED do osobnej decyzji o jej RAM.

## Brakujące wykonanie

Przygotowanie i celowana diagnostyka nie zastępują pełnego Preflightu, siedmiu historycznych smoke, ośmiu bieżących i trzech historycznych zestawów SDK ani Chromium. Wszystkie wymagają przyszłej osobno zatwierdzonej próby GitHub Actions dla nowego HEAD/BASE. Zmiana historycznych pinów, podpisów, CAS lub bramek LIVE pozostaje osobnym zakresem bezpieczeństwa.
