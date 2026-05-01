# DEV — aktywne zasady rozwoju meble-app

Ten plik jest krótką, aktualną mapą pracy. Stare wpisy historyczne zostały przeniesione do `DEV_HISTORY_20260425.md` i nie są źródłem bieżących decyzji architektonicznych.

## Aktualna baza

- Ostatnia stabilna baza przed tym etapem: `site_wycena_core_platform_split_v1.zip`.
- Po każdej paczce wydawać kompletny ZIP z pełną strukturą repo, w tym `README.md`, `DEV.md` oraz pozostałymi dokumentami.
- Przy wydaniu samodzielnie pilnować cache-bustingu zmienionych plików w `index.html`, `dev_tests.html` i narzędziach smoke/load-order.

## Workflow przed każdą paczką

1. Startować z ostatniego ZIP-a zaakceptowanego w rozmowie.
2. Przed zmianami przeczytać aktualny `DEV.md`.
3. Przy zmianach danych, storage, backupów, importu/eksportu, inwestorów, projektów, wycen, cenników albo testów danych przeczytać też `CLOUD_MIGRATION.md`.
4. Przy większych porządkach, splitach albo szukaniu duplikacji między działami przeczytać też `OPTIMIZATION_PLAN.md`.
5. Przed refaktorem większego pliku albo modułu z zależnościami sprawdzić `DEPENDENCY_MAP.md` i w razie potrzeby uruchomić `node tools/dependency-source-audit.js`.
6. Przed wydaniem uruchomić przynajmniej:
   - `node --check` dla nowych/zmienionych JS,
   - `node tools/check-index-load-groups.js`,
   - `node tools/app-dev-smoke.js`,
   - `node tools/rozrys-dev-smoke.js`, jeśli zmiana może dotknąć ROZRYS albo wspólnych danych.
7. Przed wydaniem sprawdzić linie i odpowiedzialności nowych/mocno zmienionych plików.
8. W finalnej odpowiedzi wypisać, co weszło, czego nie ruszano i co użytkownik ma sprawdzić w programie.

## Limity plików i odpowiedzialności

- Jedna główna odpowiedzialność na plik.
- Jeśli nowy lub mocno zmieniony plik miesza 2+ realne odpowiedzialności, dzielić od razu przed wydaniem ZIP-a.
- Wyjątek: cienki plik-klej/orchestrator bez ciężkiej logiki domenowej albo UI.
- Około 250 linii: próg ostrożności. Może zostać tylko przy jednej spójnej odpowiedzialności i braku sensownego podziału.
- Około 400 linii: mocne ostrzeżenie. Może zostać tylko tymczasowo albo przy naprawdę dużej jednej odpowiedzialności, której nie da się sensownie podzielić.
- Około 600 linii: próg nieprzekraczalny dla nowych lub mocno zmienianych plików. Nie wydawać paczki z takim świeżym plikiem.

## Cloud-readiness — obowiązkowy audyt danych

- Szczegółowy plan i checklista są w `CLOUD_MIGRATION.md`; nie dublować ich w całości w `DEV.md`.
- Każda nowa lub mocno zmieniana funkcja danych musi przejść audyt cloud-readiness podobnie jak audyt linii i odpowiedzialności.
- Sprawdzać zwłaszcza: bezpośrednie/scattered `localStorage`, mieszanie danych użytkownika z cache/techniką, duplikację rekordów, stabilne ID, granicę store/repository/adapter oraz późniejszą mapowalność do Firestore/synchronizacji.
- Małe lokalne poprawki cloud-ready robić w tej samej paczce, jeśli nie zmieniają UI ani logiki biznesowej. Większe albo międzydomenowe migracje zgłaszać jako osobny etap.

## UI i interakcje — zasady aktywne

- Nie zmieniać wyglądu UI bez wyraźnej zgody.
- Nowe elementy wzorować na istniejących wzorcach aplikacji, szczególnie ROZRYS, `Wybierz pomieszczenia`, `Wybierz materiał / grupę` i `dev_ui_patterns.html`.
- Nie używać systemowych `alert`, `confirm`, `prompt` w nowych pracach. Używać własnych modali `confirmBox`, `infoBox`, `panelBox` albo dedykowanych modali zgodnych ze stylem aplikacji.
- Opisy pomocnicze dawać pod ikoną `?`, nie jako luźne akapity obok pól/nagłówków.
- Przyciski: brak zmian = niebieski `Wyjdź`; niezapisane zmiany = czerwony `Anuluj` + zielony `Zapisz/Zatwierdź/Dodaj` zgodnie z kontekstem.
- Ikony w aplikacji mają być stabilnymi SVG, nie emoji zależnymi od systemu. Wzorce ikon trzymać w `dev_ui_patterns.html`, a wspólne SVG w `js/app/ui/app-icons.js`.

## Load order i testy

- Po każdym dodaniu/splitcie modułu ładowanego w aplikacji aktualizować równolegle:
  - `index.html`,
  - `dev_tests.html`,
  - `tools/index-load-groups.js`,
  - `tools/app-dev-smoke.js`.
- Przy zmianach kolejności ładowania albo zależności między modułami sprawdzić `DEPENDENCY_MAP.md` oraz raport `tools/reports/dependency-source-audit.md`.
- `dev_tests.html` jest jedynym ręcznym wejściem do testów. Nowe działy testów podpinać jako osobną sekcję, nie tworzyć drugiej strony testowej.
- `tools/app-dev-smoke.js` jest cienkim runnerem. Lista plików, mock storage i mini-DOM są w `tools/app-dev-smoke-lib/`; nie sklejać tego ponownie w jeden duży plik.
- Reload/restore po odświeżeniu jest osobnym modułem `js/app/bootstrap/reload-restore.js`; `app.js` ma tylko cienkie delegatory i nie powinien wracać do bezpośredniego `sessionStorage`.
- `js/app/investor/project-autosave.js` jest aktywnym runtime boundary autosave ładowanym po `reload-restore.js`; przy zmianach load order pilnować `index.html`, `dev_tests.html` i `tools/index-load-groups.js`. Nie ładować go na siłę do Node `app-dev-smoke`, jeśli runner nie ma pełnego kontekstu runtime.
- Testy mają tworzyć dane tylko z markerami `__test:true` i `__testRunId`, przez `FC.testDataManager` albo równoważny helper.
- Cleanup testów ma sprzątać tylko oznaczone dane testowe i nie dotykać prawdziwych danych użytkownika.
- Przycisk `Usuń dane testowe` zostaje awaryjny; normalnie testy sprzątają po sobie automatycznie.

## Backup / data safety

- Backup/data-safety jest podzielony na małe moduły: storage keys, hash, normalizer snapshotu, apply/restore, export, policy, storage, records oraz cienki store/fasada.
- UI backupu jest podzielone na DOM/helpery, menu ustawień, akcje, listę, widok backupu i shell modala.
- Nie dokładać nowych funkcji do `data-settings-modal.js` ani `data-backup-store.js`, jeśli należą do istniejących warstw szczegółowych.
- Backupy programu i testowe mają osobne accordiony oraz osobną retencję:
  - ręczne/programowe backupy zostają na dotychczasowej polityce: minimum 10 najnowszych, retencja 7 dni, przypięte / `safe-state` chronione,
  - backupy testowe `before-tests` mają twardy limit maksymalnie 10 najnowszych sztuk; przy tworzeniu kolejnego backupu testowego najstarsze testowe kopie są usuwane automatycznie,
  - 3 najnowsze w każdej grupie są chronione przed ręcznym usunięciem,
  - ręczna polityka backupów programu nie może być zmieniana przy okazji sprzątania testów.
- Backup nie powinien obejmować technicznych stanów sesji/cache: `fc_edit_session_v1`, `fc_reload_restore_v1`, `fc_rozrys_plan_cache_v2`.
- Snapshot backupu nie obejmuje roboczych kopii awaryjnych projektu/inwestorów ani cache ROZRYS: `fc_project_backup_*`, `fc_project_inv_*_backup*`, `fc_investors_backup_*`, `fc_rozrys_plan_cache_v1/v2`.
- Przy zapisie backup store stare backupy są sanitizowane z tych technicznych kluczy bez zmiany retencji 10/3/przypięte. Raport/audyt pamięci jest przeniesiony do `dev_tests.html` → `Narzędzia pamięci`; zwykły panel `Backup i dane` zostaje do backupu, importu, eksportu i list backupów.
- Osierocone sloty `fc_project_inv_*` nie są kasowane po cichu. Przy ręcznym backupie i przed testami działa półautomat z własnym modalem: wyczyść i kontynuuj / kontynuuj bez czyszczenia / anuluj.
- Jeśli backup `before-tests` nie mieści się w `localStorage`, testy mogą pobrać backup do pliku i dopiero wtedy ruszyć. Nie uruchamiać testów bez żadnego zabezpieczenia.
- Narzędzie `Analiza pamięci` w `dev_tests.html` może ręcznie, po potwierdzeniu, wyczyścić osierocone sloty projektów. Testy nie mogą samodzielnie kasować prawdziwych danych użytkownika.

## Mapa aktywnych ryzyk architektonicznych

Największe pliki/obszary, których nie wolno dalej dokarmiać bez planu:

- `js/tabs/rysunek.js` — bardzo duży aktywny renderer RYSUNKU. Miesza render SVG, drag/drop, inspektor, listę wykończeń, edycję elementów i stare systemowe dialogi. Najpierw wzmacniać testy i planować split, potem ciąć.
- `js/app.js` — nadal gruby klej aplikacji. Nowe funkcje kierować do modułów domenowych, nie do `app.js`.
- `js/app/rozrys/rozrys.js` — duży, ale lepiej zabezpieczony testami. Nie dopisywać tam logiki, jeśli pasuje do istniejących modułów ROZRYS.
- `js/tabs/wycena.js`, `js/app/wycena/wycena-core.js` — kontynuować delegowanie do modułów `wycena-tab-*` i store/quote, nie przywracać inline workflow.
- `js/app/quote/quote-snapshot-store.js`, `js/app/investor/investors-local-repository.js`, `js/app/investor/investors-recovery.js`, `js/app/project/project-status-sync.js` — krytyczne store/statusy/recovery. Przy większej zmianie najpierw zaplanować split i testy kontraktowe.
- `js/app/material/price-modal.js` — po `Materiał cleanup etap 2` jest cienką fasadą. Nie dopisywać tam ciężkiej logiki; kierować zmiany do modułów `price-modal-context/options/filters/item-form/list/persistence`.


## TESTY / NARZĘDZIA — aktualny układ

- `dev_tests.html` ma ekran wejściowy zamiast jednej przeładowanej listy przycisków.
- Główne wejścia:
  - `Narzędzia pamięci` — raport danych, audyt localStorage, backup store, sieroty projektów i awaryjne czyszczenie danych testowych,
  - `Testy aplikacji` — wszystkie smoke/regression testy dokładane i rozwijane z aplikacją,
  - `Wzorce UI` — baza wzorców interfejsu i ikon.
- Nie dokładać kolejnych serwisowych narzędzi do paska testów regresyjnych. Narzędzia pamięci/diagnostyki mają trafiać do sekcji `Narzędzia pamięci` albo osobnego modułu narzędziowego.
- Logika strony testów jest rozdzielona:
  - `dev-tests-registry.js` — rejestr i zbieranie raportów testów,
  - `dev-tests-report-view.js` — render raportów i tekst do schowka,
  - `dev-tests-storage-tools.js` — narzędzia pamięci,
  - `dev-tests-page.js` — cienki kontroler ekranu i przełączania sekcji.

## MATERIAŁ — aktualny stan po cleanup etap 2

- `price-modal.js` jest tylko fasadą renderu głównego modala i publicznego API `FC.priceModal`.
- Odpowiedzialności modala cenników są rozdzielone:
  - `price-modal-context.js` — wspólny kontekst, stan runtime i helpery modalowe,
  - `price-modal-options.js` — opcje selectów/launcherów,
  - `price-modal-filters.js` — filtry, wyszukiwanie i toolbar,
  - `price-modal-item-form.js` — formularz dodawania/edycji pozycji,
  - `price-modal-list.js` — render listy pozycji,
  - `price-modal-persistence.js` — walidacja, zapis i usuwanie pozycji.
- UI cenników nie został celowo zmieniony w tym etapie; to był split techniczny.
- Kolejny etap materiałów może objąć `magazyn.js`, `material-part-options.js` i wspólny model formatek/oklein dla `Materiał + ROZRYS`.

## RYSUNEK — aktualny stan bezpieczeństwa

- `js/testing/rysunek/tests.js` dodaje podstawową ochronę: publiczne API, rejestracja zakładki, minimalny render stage/inspektora/listy wykończeń oraz jawne wykrycie długu systemowych dialogów.
- `dev_tests.html` i `tools/app-dev-smoke.js` ładują teraz `layout-state.js`, `tabs/rysunek.js` i testy RYSUNKU.
- Testy ROZRYS są rozbite na `js/testing/rozrys/tests.js` jako cienki runner oraz suite'y w `js/testing/rozrys/suites/*`; nowe testy ROZRYS dodawać do właściwej suite, nie odbudowywać jednego wielkiego pliku.
- W `RYSUNKU` nadal są systemowe `alert/confirm/prompt`. To jawny dług techniczny do usunięcia w osobnym etapie przez własne modale aplikacji.
- Wykryte pozostałe aktywne fallbacki/dialogi systemowe poza RYSUNKIEM: `js/app/ui/actions-register.js`, `js/app/material/magazyn.js`, `js/app/ui/data-settings-dom.js`, `js/app/shared/room-registry-modals-manage-remove.js`. Nie rozwiązywać ich przy okazji innych refaktorów bez testów i własnego modala.
- Nie przebudowywać RYSUNKU bez testów kontraktowych dla kolejnych wycinanych odpowiedzialności.

## Najbliższa rekomendowana kolejność

1. Przy większych porządkach i szukaniu wspólnych mechanik trzymać `OPTIMIZATION_PLAN.md` jako mapę kolejności i kandydatów do wspólnych modułów.
2. Przy zmianach danych trzymać `CLOUD_MIGRATION.md` jako obowiązkową checklistę i aktualizować go tylko o istotne decyzje migracyjne.
3. Kolejny etap materiałów: `magazyn.js`, `material-part-options.js` i wspólny model formatek/oklein dla `Materiał + ROZRYS`.
4. Osobny etap RYSUNEK: najpierw usunięcie systemowych dialogów i plan splitu, potem dopiero cięcie monolitu.
5. Osobny etap cloud-readiness: po wyjęciu reload/restore z `app.js` kolejne bezpieczne kroki to `js/boot.js` jako wyjątek boot-level oraz domeny `investor-project`, `material/*`, `rozrys/*` według audytu `tools/local-storage-source-audit.js`.

## WYCENA — poprawka akceptacji z podglądu 2026-04-26

- `wycena.js` musi przekazywać do `wycena-tab-status-bridge` komplet helperów statusu (`isSelectedSnapshot`, `isRejectedSnapshot`, `getProjectStatusForHistory`, `isArchivedPreliminary`, `normalizeStatusKey`). Brak tych zależności daje martwy klik akceptacji z podglądu: reakcja wizualna jest, ale nie otwiera się confirm i nie zapisuje wyboru.
- `tools/app-dev-smoke-lib/mini-document.js` ma `childNodes` jako alias dzieci mini-DOM. To ochrona test-runnera dla renderów, które w przeglądarce korzystają z normalnego DOM API.
- Test izolacji projektu przed tworzeniem fixture zeruje i po teście przywraca źródła recovery Wyceny (`fc_quote_snapshots_v1`, `fc_quote_offer_drafts_v1`), żeby realne snapshoty użytkownika nie odbudowywały inwestorów w środku cleanup smoke.

### 2026-04-26 — architecture audit next v1
- Paczka audytowa bez zmian UI/danych/backupów. Test domyślnego obrównania ROZRYS jest chroniony również w bezpośrednim `tools/rozrys-dev-smoke.js`; runner ładuje jawnie `js/app/rozrys/rozrys-stock.js`.
- `tools/reports/architecture-audit-next-v1.md` zawiera bieżący ranking największych plików i rekomendowany kolejny zakres.

## 2026-04-27 — Wycena status contract v1

- Dodano testy kontraktowe Wycena ↔ statusy w `js/testing/wycena/suites/status-contract.js`.
- Przed większym refaktorem Wyceny/statusów pilnować, że exact-scope steruje `masterStatus`, `mirrorStatus`, `projectStore.status` i `loadedProject.meta.projectStatus`, a rozłączne pokoje nie tracą własnych zaakceptowanych ofert.
- Raport paczki: `tools/reports/wycena-status-contract-v1.md`.

## 2026-04-27 — ROZRYS optimizer contracts + speed-max split v1

- Kontrakty optymalizatora ROZRYS są w `js/testing/rozrys/suites/optimizer-contracts.js`; runner ROZRYS ma 72 testy w bezpośrednim smoke.
- Kontrakty pilnują mapowania `Wzdłuż/W poprzek`, porównania osi przez Opti-max, kolejności 1–2 pasów startowych, progów 95/90, limitu top 5 seedów, rzazu, słojów/free i kompletności prostych formatek.
- `js/app/optimizer/speed-max.js` został technicznie rozbity na `speed-max-core.js`, `speed-max-bands.js`, `speed-max-sheet-plan.js` i `speed-max-half-sheet.js`; sama fasada `speed-max.js` ma zostać cienką rejestracją `FC.rozkrojSpeeds.max`.
- Nie zmieniać `LENGTHWISE_AXIS = 'across'`, progów 95/90 ani limitu top 5 seedów bez jawnej aktualizacji kontraktów i testów.
- Przy następnych poprawkach algorytmu zaczynać od testu/przykładu wejściowego, potem zmieniać tylko właściwy moduł odpowiedzialności, nie fasadę.
- Raporty paczek: `tools/reports/rozrys-optimizer-contracts-v1.md`, `tools/reports/rozrys-speedmax-split-v1.md`.

## App shell / WYWIAD split v1 — 2026-04-27

- RYSUNEK jest odłożony do osobnego wątku; nie budować kolejnych paczek na zmianach `site_rysunek_*`, dopóki ten temat nie zostanie świadomie wznowiony.
- Aktualny porządek app shell: `js/app.js` ma zostać cienkim klejem, a render listy/pomieszczenia siedzi w `js/app/ui/cabinets-render.js`.
- Render zakładki WYWIAD siedzi w `js/tabs/wywiad.js`; nie przenosić go z powrotem do `app.js`.
- Przy zmianach renderu szafek sprawdzać ścieżkę: `renderCabinets()` globalny delegator → `FC.cabinetsRender.renderCabinets()` → router zakładek → `FC.tabsWywiad.renderWywiadTab()`.
- Pełny raport: `tools/reports/app-shell-wywiad-split-v1.md`.

## 2026-04-27 — Wycena contracts audit v1

- Dodano kontrakty architektury Wyceny w `js/testing/wycena/suites/architecture-contract.js`.
- Kontrakty pilnują publicznych fasad `FC.wycenaCore`, `FC.quoteSnapshotStore`, `FC.projectStatusSync` i `FC.wycenaTabDebug`, exact-scope snapshotów oraz walidacji nieistniejącego pokoju.
- Dodano statyczny audyt Wyceny `tools/wycena-architecture-audit.js`; raport: `tools/reports/wycena-contracts-audit-v1.md`.
- Najbliższy bezpieczny split Wyceny: zacząć od `js/tabs/wycena.js` jako warstwy render/preview/delegatory. `quote-snapshot-store.js` i `project-status-sync.js` ciąć dopiero po porównaniu old/new fixture, bo są krytyczne dla danych i statusów.
- W tej paczce nie zmieniać runtime Wyceny, UI, danych ani storage; to etap zabezpieczenia przed refaktorem.

## 2026-04-28 — Wycena preview split v1

- `js/app/wycena/wycena-tab-preview.js` jest właścicielem renderu podglądu aktywnej/historycznej oferty w zakładce WYCENA.
- `js/tabs/wycena.js` ma delegować preview przez `FC.wycenaTabPreview.renderPreview(...)`; nie dokładać nowych wierszy podglądu ani sekcji historii z powrotem do `tabs/wycena.js`.
- Moduł preview nie zapisuje danych, nie zmienia statusów i nie rozstrzyga scope ofert. Statusy, PDF, akceptacja i historia muszą dalej iść przez istniejące helpery przekazywane jako zależności.
- `tools/app-dev-smoke.js` kończy się w Node jako szybki sanity smoke publicznych API głównych działów; pełniejsze testy/regresje zostają w `dev_tests.html`.
- Raport paczki: `tools/reports/wycena-preview-split-v1.md`.

## 2026-04-28 — Wycena shell split v1

- `js/tabs/wycena.js` został zmniejszony do ok. 590 linii; nadal jest plikiem podwyższonego ryzyka, ale zszedł poniżej progu 600+.
- Nowe moduły Wyceny:
  - `js/app/wycena/wycena-tab-dom.js` — małe helpery DOM zakładki,
  - `js/app/wycena/wycena-tab-status-actions.js` — cienki adapter do `wycena-tab-status-bridge`,
  - `js/app/wycena/wycena-tab-shell.js` — shell renderu zakładki, topbar `Wyceń/PDF`, busy-state i scroll.
- Nie przenosić renderu shell/preview ani statusowych delegatorów z powrotem do `tabs/wycena.js`.
- `wycena-tab-status-actions.js` nie może zawierać nowej logiki biznesowej statusów; ma delegować do `wycena-tab-status-bridge` / `project-status-sync`.
- Przed cięciem `wycena-core.js`, `quote-snapshot-store.js` albo `project-status-sync.js` przygotować fixture old/new dla exact-scope, selected/rejected i cofania statusów.
- Raport paczki: `tools/reports/wycena-shell-split-v1.md`.

## 2026-04-28 — Wycena snapshot scope split v1

- `js/app/quote/quote-snapshot-scope.js` jest właścicielem czystych helperów zakresu ofert: normalizacja pokojów, etykiety, materialScope, nazwy wersji, exact-scope i overlap.
- `js/app/quote/quote-snapshot-store.js` ma delegować helpery scope do `FC.quoteSnapshotScope`; nie przenosić tej logiki z powrotem do store.
- `quote-snapshot-store.js` po splicie ma ok. 438 linii i pozostaje plikiem średniego ryzyka; dalsze cięcie tylko po kontrakcie selection/rejected/status.
- Kontrakty splitu są w `js/testing/wycena/suites/snapshot-scope-contract.js`; `WYCENA node smoke` ma pilnować także grupy `Wycena ↔ Snapshot scope split`.
- Raport paczki: `tools/reports/wycena-snapshot-scope-split-v1.md`.

## 2026-04-28 — Wycena snapshot selection split v1

- Wycena: wykonano kolejny split krytycznego `quote-snapshot-store.js` bez zmiany UI, storage i działania biznesowego.
- Nowy moduł `js/app/quote/quote-snapshot-selection.js` przejął selection/status flow snapshotów przez fabrykę `FC.quoteSnapshotSelection.createApi(...)` z jawnie wstrzykniętymi zależnościami store.
- `quote-snapshot-store.js` spadł do ok. 314 linii i zostaje właścicielem storage/normalizacji/list/filter API, nie pełnego przepływu accepted/recommended status.
- Testy: `js/testing/wycena/suites/snapshot-selection-contract.js` pilnuje publicznego API selection, zachowania same-scope selected/rejected oraz `convertPreliminaryToFinal`.
- Ważny kontrakt biznesowy: wybór nowej oferty dla tego samego exact-scope odznacza poprzednią selekcję, ale nie oznacza jej automatycznie jako `rejected`.
- Następne bezpieczne kroki Wyceny: `wycena-core.js` collect/validation split albo `project-status-sync.js`, ale tylko po dedykowanych kontraktach dla wybranego obszaru.

## 2026-04-28 — Wycena core selection split v1

- `js/app/wycena/wycena-core-selection.js` przejmuje wybór pomieszczeń, material scope i walidację Wyceny.
- Krytyczna kolejność ładowania: `wycena-core-selection.js` przed `wycena-core.js`; utrzymywać ją w `index.html`, `dev_tests.html`, `tools/index-load-groups.js` i `tools/app-dev-smoke-lib/file-list.js`.
- `FC.wycenaCore` nadal eksportuje stare publiczne metody jako delegaty, więc zakładka, PDF i testy nie powinny zmieniać punktów wejścia.
- Kontrakty: `js/testing/wycena/suites/core-selection-contract.js`; pilnują normalizacji wyboru, walidacji nieistniejącego pokoju i blokady pustej oferty.
- Raport: `tools/reports/wycena-core-selection-split-v1.md`.

## 2026-04-28 — Project status scope split v1

- Wycena/statusy: wydzielono z `js/app/project/project-status-sync.js` helpery scope/rangi/status-map do `js/app/project/project-status-scope.js`.
- `project-status-sync.js` spadł do ok. 389 linii i dalej odpowiada za zapis mirrorów, rekonsyliację i commit akceptowanych ofert.
- Krytyczna kolejność ładowania: `project-status-scope.js` przed `project-status-sync.js` w `index.html`, `dev_tests.html`, `tools/index-load-groups.js` i `tools/app-dev-smoke-lib/file-list.js`.
- Kontrakty: `js/testing/wycena/suites/project-status-scope-contract.js`; pilnują publicznego API scope, delegacji status sync oraz rekonsyliacji bez zmiany wyniku biznesowego.
- Dalszy split statusów robić dopiero po kontraktach dla jednej ścieżki: commit accepted snapshot, manual status change albo mirror save.
- Raport: `tools/reports/project-status-scope-split-v1.md`.


## 2026-04-30 — Investor store boundary v1

- RYSUNEK nie był ruszany; zostaje odłożony na koniec do osobnej decyzji koncepcyjnej.
- `js/app/investor/investors-store.js` został rozdzielony według odpowiedzialności: model/normalizacja, lokalny repository/storage, recovery oraz cienka publiczna fasada `FC.investors`.
- Nowe moduły i kolejność ładowania: `investors-model.js` → `investors-local-repository.js` → `investors-recovery.js` → `investors-store.js`. Utrzymywać tę kolejność w `index.html`, `dev_tests.html`, `tools/index-load-groups.js` i `tools/app-dev-smoke-lib/file-list.js`.
- Nie przenosić normalizacji, bezpośredniego storage ani recovery z powrotem do `investors-store.js`; store ma zostać fasadą CRUD/search/current/sync.
- Bezpośrednie `localStorage` inwestorów jest teraz świadomie zamknięte w `investors-local-repository.js`. Kolejne prace cloud-ready przy inwestorach powinny iść przez tę granicę, nie przez nowe rozproszone odczyty/zapisy.
- Testy: app smoke pilnuje obecności warstw store, a suite inwestora ma kontrakt rozdzielonych modułów.
- Raport: `tools/reports/investor-store-boundary-v1.md`.

## 2026-04-30 — Investor project boundary v1

- RYSUNEK nie był ruszany; pozostaje zamrożony do osobnej decyzji koncepcyjnej.
- Rozdzielono `js/app/investor/investor-project.js`, który mieszał legacy sloty `fc_project_inv_*`, centralny `projectStore`, aktywny `projectData`, patchowanie `FC.investors` i mirror zapisu projektu.
- Nowy podział odpowiedzialności: `investor-project-repository.js` = lokalna granica slotów i most do `projectStore`; `investor-project-runtime.js` = normalizacja, save/load aktywnego projektu i refresh; `investor-project-patches.js` = patche publicznych API; `investor-project.js` = cienki init/orchestrator.
- Krytyczna kolejność ładowania: `investor-project-repository.js` → `investor-project-runtime.js` → `investor-project-patches.js` → `investor-project.js`. Utrzymywać ją w `index.html`, `dev_tests.html`, `tools/index-load-groups.js` i `tools/app-dev-smoke-lib/file-list.js`.
- Nie przenosić bezpośredniego storage, patchowania API ani refreshu UI z powrotem do jednego pliku. Jeśli trzeba zmieniać projekt inwestora, najpierw ustalić, czy zmiana dotyczy repository, runtime czy patch layer.
- `localStorage` dla `fc_project_inv_*` ma pozostać zamknięty w `investor-project-repository.js`; pozostałe moduły mają korzystać z tej granicy albo z `FC.projectStore`/`FC.project`.
- App smoke pilnuje obecności warstw `investorProjectRepository/runtime/patches` oraz roundtripu legacy slotu projektu.
- Raport: `tools/reports/investor-project-boundary-v1.md`.

## Notatka po paczce `site_project_status_boundary_v1.zip`

- Statusy projektu rozdzielono po odpowiedzialnościach: `project-status-mirrors.js` zapisuje lustra/statusy w danych, `project-status-sync.js` zostaje silnikiem rekonsyliacji, a `project-status-snapshot-flow.js` obsługuje workflow zaakceptowanych snapshotów ofertowych.
- Przy kolejnych zmianach statusów nie dokładać zapisu danych ani workflow snapshotów z powrotem do `project-status-sync.js`; publiczne API `FC.projectStatusSync` ma pozostać kompatybilną fasadą.
- RYSUNEK nadal jest odłożony na koniec i nie był ruszany w tej paczce.

## Notatka po project-status-test-cache-fix-v2

- Przy poprawkach testów ładowanych przez `dev_tests.html` podbijać cache-busting nie tylko zmienionych testów, ale też powiązanych modułów runtime, jeśli wynik testu może pochodzić ze starego cache przeglądarki/GitHub Pages.
- Jeśli użytkownik zgłasza błędy testów po paczce naprawczej, najpierw odróżnić: realny błąd runtime, błąd testu, brak rozpakowania ZIP-a w Actions oraz cache starego `dev_tests.html`/skryptów.

## 2026-05-01 — Orphan fixture cleanup v1

- Naprawiono izolację testowego fixture Wyceny: `withInvestorProjectFixture` snapshotuje i przywraca legacy sloty `fc_project_inv_*_v1`, żeby testy nie zostawiały osieroconych projektów po przebiegu.
- Dodano kontrakt Wyceny, że fixture nie zmienia zestawu legacy slotów, oraz kontrakt danych, że czyszczenie sierot usuwa tylko osierocone sloty i zostawia slot aktywnego inwestora.
- To jest poprawka test/data-safety, bez zmian UI, runtime aplikacji, formatu danych i backupów.


## 2026-05-01 — Test backup retention / UI state

- Test `Data safety` dla czyszczenia osieroconych slotów ma być odporny na realne dane użytkownika: nie zakłada dokładnie jednej sieroty w localStorage.
- Backupy testowe `before-tests` mają maksymalnie 10 najnowszych kopii; ręczne backupy programu pozostają na dotychczasowej retencji.
- Lista backupów w panelu ustawień ma zachowywać stan otwarcia accordiona oraz scroll po usunięciu backupu.

## 2026-05-01 — Wycena core platform split v1

- Wykonano split `js/app/wycena/wycena-core.js` pod cloud/platform-readiness bez zmiany UI, storage ani logiki biznesowej.
- Nowy układ warstw: `wycena-core-utils.js`, `wycena-core-catalog.js`, `wycena-core-source.js`, `wycena-core-material-plan.js`, `wycena-core-offer.js`, `wycena-core-lines.js`, a `wycena-core.js` jest cienkim orchestratorem i fasadą starego API `FC.wycenaCore`.
- Przy dalszym rozwoju Wyceny nie dokładać nowych funkcji do orchestratorka. Nowe rzeczy kierować do właściwej warstwy: katalog/źródła danych/ROZRYS plan/oferta/linie.
- Ten split jest przygotowaniem pod chmurę i platformę wielofunkcyjną: Wycena pobiera dane przez jawne adaptery/fasady i nie tworzy nowego rozproszonego storage.

## 2026-05-01 — Test cleanup boundary v1

- Testowe dane inwestorów mają być tworzone przez `FC.testDataManager.seedInvestor()` albo inny helper, który zawsze nadaje markery `__test`, `__testRunId` i `meta.testData`.
- Nie tworzyć nowych fixture’ów inwestorów przez bezpośrednie `FC.investors.create()` w testach, jeśli wynik może trafić do storage. Gdy test potrzebuje konkretnego ID, użyć `seedInvestor()`, bo zachowuje przekazany `id`.
- Cleanup testów ma usuwać cały łańcuch testowego inwestora: `fc_investors_v1`, `fc_projects_v1`, `fc_project_inv_*_v1`, snapshoty Wyceny, drafty ofert oraz wskaźniki current.
- Runtime filter inwestorów ma ignorować znane legacy fixture’y testowe (`Jan Test`, `Room patch`, itp.), jeśli kiedyś pojawią się w appce po recovery.
- Pełny raport: `tools/reports/test-cleanup-boundary-v1.md`.
