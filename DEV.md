# DEV — aktywne zasady rozwoju meble-app

Ten plik jest krótką, aktualną mapą pracy. Stare wpisy historyczne zostały przeniesione do `DEV_HISTORY_20260425.md` i nie są źródłem bieżących decyzji architektonicznych.

## Aktualna baza

- Ostatnia stabilna baza przed tym etapem: `site_app_shell_storage_boundary_stage1.zip`.
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
  - zostaje 10 najnowszych w każdej grupie,
  - 3 najnowsze w każdej grupie są chronione przed ręcznym usunięciem,
  - przypięte / `safe-state` są chronione zawsze,
  - automatyczne czyszczenie rusza tylko nadmiar starszy niż 7 dni i nie rusza chronionych.
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
- `js/app/quote/quote-snapshot-store.js`, `js/app/investor/investors-store.js`, `js/app/project/project-status-sync.js` — krytyczne store/statusy. Przy większej zmianie najpierw zaplanować split i testy kontraktowe.
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
