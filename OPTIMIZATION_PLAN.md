# OPTIMIZATION_PLAN — plan wspólnych mechanik i porządkowania

Ten plik trzyma plan optymalizacji, scalania duplikacji i kolejności porządkowania. `DEV.md` zostaje krótką mapą zasad pracy, `CLOUD_MIGRATION.md` trzyma decyzje dotyczące danych, storage i przyszłej chmury, a `DEPENDENCY_MAP.md` trzyma mapę zależności oraz wpływu zmian między plikami.

## Cel

Porządkować aplikację etapami bez robienia jednego wielkiego modułu `shared` na wszystko. Wspólne mechaniki łączyć tylko wtedy, gdy mają realnie wspólny kontrakt, testy i podobną odpowiedzialność.

## Zasady scalania

1. Najpierw mapa zależności, potem kontrakt/test, potem refaktor.
2. Łączyć mechaniki naprawdę wspólne, nie tylko podobnie wyglądające.
3. Nie przenosić logiki na siłę, jeśli działy mają podobny UI, ale inną logikę biznesową.
4. Nie tworzyć dużego `shared`-worka. Moduły wspólne mają być małe i nazwane odpowiedzialnością.
5. UI można ujednolicać tylko według zatwierdzonych wzorców aplikacji i bez samowolnej zmiany wyglądu.
6. Dane i storage traktować zgodnie z `CLOUD_MIGRATION.md`: user data, cache, UI state i test data muszą mieć jasne granice.

## Mapa wspólnych mechanik

### UI

- modale: potwierdzenia, informacje, panelowe okna wyboru, modale formularzy,
- przyciski: `Wyjdź`, `Wróć`, `Anuluj`, `Zapisz`, `Zatwierdź`, `Dodaj`, akcje destrukcyjne,
- accordiony i listy rozwijane,
- checkbox/chip/select launchery,
- ikony SVG,
- raporty i widoki wyników testów,
- formularze edycji/dodawania rekordów.

### Dane i domena

- storage/repozytoria/adapters,
- import/export/backup/snapshoty,
- formatki, okleiny i materiały,
- projekty, pomieszczenia i powiązanie z inwestorem,
- statusy projektu i ofert,
- katalogi/cenniki/zlecenia usługowe,
- geometria i wizualizacja RYSUNEK/ROZRYS — tylko ostrożnie, po testach kontraktowych.

## Duplikacje i wspólne obszary

| Obszary | Kandydat do wspólnej mechaniki | Ryzyko | Kolejny bezpieczny krok |
| --- | --- | --- | --- |
| Materiał + ROZRYS | formatki, okleiny, materiały, snapshot wejściowy | średnie | najpierw wspólny model danych i testy porównujące wynik |
| Inwestor + Wycena | status projektu, zaakceptowane oferty, historia ofert | wysokie | kontrakt statusów i testy synchronizacji przed dalszym splittem |
| Backup + Testy | raporty danych, audyt pamięci, cleanup testów | niskie/średnie | utrzymać narzędzia pamięci w jednym wejściu `dev_tests.html` i w małych modułach |
| Cenniki + Zlecenia usługowe + Wycena | katalogi, ceny, stawki, snapshot wartości użytych w ofercie | średnie | lokalne repo katalogów i granica snapshotu ofertowego |
| ROZRYS + RYSUNEK | geometria/wizualizacja | wysokie | nie łączyć przed usunięciem długów RYSUNKU i testami kontraktowymi |
| UI modali w działach | shell modala, stopka akcji, close/discard flow | średnie | wydzielać tylko mechanikę, nie zmieniać wyglądu bez zgody |

## Kolejność optymalizacji

### Etap 1 — niskie ryzyko

1. Utrzymać split toolingowy `tools/app-dev-smoke.js`, żeby runner APP nie mieszał listy plików, mini-DOM, storage mocka i orkiestracji.
2. Utrzymywać źródłowy audyt storage przez `tools/local-storage-source-audit.js`.
3. Przy każdej większej paczce sprawdzać, czy nowy kod nie dokłada bezpośredniego, rozproszonego `localStorage`.
4. Porządkować raporty/testy tylko w obrębie istniejącego wejścia `dev_tests.html`. Etap splitu testów ROZRYS jest wykonany: runner `js/testing/rozrys/tests.js` ma pozostać cienki, a suite'y są w `js/testing/rozrys/suites/*`.
5. Reload/restore wyjęty z `app.js` do `js/app/bootstrap/reload-restore.js`; kolejne podobne kroki mają wyciągać poboczne mechaniki app shell bez zmiany UI.
6. Przed wyborem kolejnego splitu uruchomić/odświeżyć `node tools/dependency-source-audit.js` i sprawdzić `DEPENDENCY_MAP.md`, żeby ocenić wpływ drugiego poziomu.
7. `project-autosave.js` został rozstrzygnięty jako aktywny runtime boundary i nie jest już kandydatem do usunięcia jako martwy plik.

### Etap 2 — dane i katalogi

1. Materiał + ROZRYS: wspólny model formatek i oklein.
2. Cenniki/katalogi: jednoznaczne repozytoria lokalne i snapshot wartości użytych w ofercie.
3. Projekty/inwestorzy: stopniowo ograniczać stare równoległe sloty projektów bez ukrytej migracji danych.

### Etap 3 — większe moduły

1. RYSUNEK: najpierw usunąć systemowe dialogi i wzmocnić testy, dopiero potem ciąć monolit.
2. ROZRYS/RYSUNEK: rozważać wspólne helpery geometryczne dopiero po rozdzieleniu renderu, interakcji i domeny.
3. Wspólne UI: konsolidować tylko sprawdzone mechaniki modali/accordionów/list, bez zmiany zatwierdzonych styli.

## Kandydaci na przyszłe moduły wspólne

- `js/app/shared/ui/modal-actions.js` — logika stopki `Wyjdź/Anuluj/Zapisz` po zatwierdzeniu kontraktu.
- `js/app/shared/ui/accordion.js` — wspólna mechanika accordionów bez narzucania wyglądu.
- `js/app/shared/ui/icons.js` albo dalsze rozwinięcie `js/app/ui/app-icons.js`.
- `js/app/shared/data/storage-source-audit.js` — tylko jeśli audyt storage ma trafić także do UI, nie tylko do Node tooling.
- `js/app/shared/domain/material-parts.js` — formatki/płyty/elementy na styku Materiał + ROZRYS.
- `js/app/shared/domain/edges.js` — model oklein i stron oklejania.
- `js/app/shared/domain/project-status.js` — statusy projektu/ofert po ustabilizowaniu kontraktu.
- `js/app/shared/domain/export-import.js` — jeśli backup/export/import zaczną mieć wspólne kontrakty poza obecnym data-safety.

## Audyt źródeł storage — stan 2026-04-26

Źródłowy audyt uruchamiany komendą:

```bash
node tools/local-storage-source-audit.js
```

Bieżący wynik dla katalogu `js`:

- pliki z użyciem storage: 25,
- referencje storage razem: 229,
- największa część to test tooling: 150 referencji,
- `js/app.js` został zdjęty z listy bezpośrednich referencji storage,
- kontrolowane granice storage: `js/app/shared/storage.js`, `js/app/bootstrap/reload-restore.js`, `data-storage-*`, `data-backup-*`, store domenowe i `investor/session.js`,
- obszary do dalszego wygaszania bezpośrednich zapisów: `js/boot.js`, `js/app/investor/investor-project.js`, `js/app/material/*`, `js/app/rozrys/*`.

Wniosek: nie trzeba robić ukrytej migracji w tej paczce, ale każdy następny etap danych powinien przesuwać zapis/odczyt do store/repository/adaptera zamiast dopisywać kolejne bezpośrednie użycia `localStorage`.


## 2026-05-03 — Pricing labor display fix v1

- Naprawiono kontrakt store/selector dla katalogów robocizny bez przebudowy UI i bez nowego storage.
- Dodano mały moduł `js/tabs/wywiad-labor-summary.js`, zamiast rozbudowywać `wywiad.js` o wyszukiwanie i opis robocizny.
- Dalsze prace przy robociźnie prowadzić przez osobne moduły: katalog/reguły, podgląd WYWIAD, kalkulator WYCENA i snapshot oferty.

## 2026-04-26 — audit next v1
- Po naprawie Wyceny najbezpieczniejszy kierunek to małe paczki stabilizujące testy/status sync, nie duży refaktor runtime.
- Bezpośredni smoke ROZRYS dostał jawne pokrycie domyślnego obrównania 1 cm / 10 mm.

## Wycena status contract v1

Przed splitem `js/tabs/wycena.js`, `js/app/wycena/wycena-core.js`, `js/app/quote/quote-snapshot-store.js` albo `js/app/project/project-status-sync.js` uruchamiać i utrzymywać kontrakty z `js/testing/wycena/suites/status-contract.js`. Ten etap nie jest refaktorem runtime; to zabezpieczenie ścieżek przed kolejnym cięciem.

## ROZRYS optimizer contracts v1 — 2026-04-27

- Dodano suite kontraktową `js/testing/rozrys/suites/optimizer-contracts.js` jako zabezpieczenie przed splitem `js/app/optimizer/speed-max.js`.
- Testy pilnują progów 95/90, limitu top 5 seedów oraz obecnego mapowania `start-along` → `across`, `start-across` → `along`.

## ROZRYS speed-max split v1 — 2026-04-27

- Wykonano techniczny split `speed-max.js` bez zmiany UI i bez celowej zmiany algorytmu.
- Nowy układ: `speed-max-core.js`, `speed-max-bands.js`, `speed-max-sheet-plan.js`, `speed-max-half-sheet.js`, a `speed-max.js` zostaje cienką fasadą `FC.rozkrojSpeeds.max`.
- Przy następnych zmianach optymalizacji nie dokładać logiki do fasady `speed-max.js`; zmiany kierować do właściwego modułu odpowiedzialności.
- Pełny raport: `tools/reports/rozrys-speedmax-split-v1.md`.
- Następny bezpieczny etap: realne usprawnienia algorytmu tylko przypadek po przypadku, zaczynając od testu kontraktowego i porównania wyniku old/new dla konkretnego układu formatek.

## App shell / WYWIAD split v1 — 2026-04-27

- RYSUNEK został tymczasowo odłożony i nie był ruszany w tej paczce.
- Start z ostatniej stabilnej bazy sprzed zmian RYSUNKU: `site_rozrys_speedmax_split_v1_download.zip`.
- `renderCabinets()` przeniesiono z `js/app.js` do `js/app/ui/cabinets-render.js`.
- Render listy zakładki WYWIAD (`renderWywiadTab`, `renderSingleCabinetCard`) przeniesiono do `js/tabs/wywiad.js`.
- `js/app.js` zachowuje stare globalne delegatory, żeby nie zmienić kontraktu wywołań.
- `js/app.js` spadł z ok. 790 do 590 linii; nadal jest plikiem podwyższonego ryzyka, ale przestał zawierać właściwy renderer listy szafek.
- Pełny raport: `tools/reports/app-shell-wywiad-split-v1.md`.
- Następny logiczny kierunek optymalizacji: WYCENA, etap kontraktowy/splitowy bez zmiany UI i bez zmiany zachowania.

## Wycena contracts audit v1 — 2026-04-27

- Dodano suite `js/testing/wycena/suites/architecture-contract.js` jako zabezpieczenie przed pierwszym splitem Wyceny.
- Statyczny audyt potwierdza największe ryzyka: `js/tabs/wycena.js`, `quote-snapshot-store.js`, `wycena-core.js`, `project-status-sync.js` — wszystkie 600+ linii i mieszają kilka odpowiedzialności.
- Rekomendowany kolejny krok: split `js/tabs/wycena.js` bez zmiany UI — wydzielić preview/render historii i cienkie delegatory statusu, zostawiając publiczne debug/API bez zmian.
- Store snapshotów i status sync zostawić na później; najpierw przygotować fixture porównujące old/new dla exact-scope, selected/rejected i cofania statusów.

## Wycena preview split v1 — 2026-04-28

- Rozpoczęto właściwy split `js/tabs/wycena.js` bez zmiany UI i bez zmiany działania: podgląd oferty przeniesiono do `js/app/wycena/wycena-tab-preview.js`.
- `js/tabs/wycena.js` spadł z ok. 813 do ok. 710 linii, ale nadal jest plikiem podwyższonego ryzyka i miesza render, statusy, snapshoty oraz delegatory akcji.
- `tools/app-dev-smoke.js` został ustabilizowany dla Node: uruchamia szybkie sanity smoke publicznych API, a ciężkie testy modalowe/regresyjne zostają w `dev_tests.html`.
- Następny krok Wyceny: dalej wycinać małe odpowiedzialności z `tabs/wycena.js`; nie zaczynać jeszcze od `quote-snapshot-store.js` ani `project-status-sync.js` bez fixture old/new.
- Pełny raport: `tools/reports/wycena-preview-split-v1.md`.

## Wycena shell split v1 — 2026-04-28

- Kontynuowano split `js/tabs/wycena.js`: wyjęto helpery DOM, adapter statusowych akcji i shell renderu/topbara do osobnych modułów.
- `tabs/wycena.js` spadł z ok. 710 do ok. 590 linii, bez zmiany UI, runtime, storage i statusów.
- Kolejny krok nie powinien być kolejnym losowym cięciem zakładki; większe ryzyka są teraz w `quote-snapshot-store.js`, `wycena-core.js` i `project-status-sync.js`.
- Przed ruszeniem tych plików wymagane są fixture porównawcze old/new dla historii ofert, exact-scope, akceptacji, odrzucania i synchronizacji statusów.

## 2026-04-28 — Wycena snapshot scope split v1

- Wycena: wykonano pierwszy split krytycznego `quote-snapshot-store.js` bez zmiany zachowania.
- Nowy moduł `js/app/quote/quote-snapshot-scope.js` przejął pure helpery scope; store spadł do ok. 438 linii.
- Testy: `js/testing/wycena/suites/snapshot-scope-contract.js` pilnuje API, delegacji store → scope, kanonicznego zakresu i exact/overlap.
- Następne bezpieczne kroki w Wycena: albo `wycena-core.js` collect/selection split, albo kolejny etap snapshot-store selection/rejected — tylko po dedykowanych kontraktach.

## 2026-04-28 — Wycena snapshot selection split v1

- Wydzielono `js/app/quote/quote-snapshot-selection.js` z `quote-snapshot-store.js`.
- Store snapshotów został ograniczony do storage, normalizacji i list/filter API; selection/status flow działa przez moduł z dependency injection.
- Nie zmieniono semantyki ofert: same exact-scope nie jest automatycznie archiwizowany jako `rejected` przy przełączeniu wyboru.
- Po tym etapie `quote-snapshot-store.js` nie jest już pierwszym kandydatem do dalszego cięcia; większe ryzyko pozostaje w `wycena-core.js`, `project-status-sync.js`, `tabs/wycena.js`, `quote-scope-entry.js` i `wycena-tab-selection.js`.

## 2026-04-28 — Wycena core selection split v1

- Wydzielono z `wycena-core.js` wybór/walidację do `js/app/wycena/wycena-core-selection.js` bez zmiany działania.
- `wycena-core.js` spadł do ok. 539 linii, ale nadal zawiera collect/rozrys/material/accessory/AGD logic i pozostaje plikiem ostrzegawczym 400+.
- Następne cięcie `wycena-core.js` robić tylko po kontraktach dla jednej konkretnej odpowiedzialności: material lines, accessory/AGD lines albo quote-rate/commercial draft.
- `project-status-sync.js` jest po audycie największym plikiem Wyceny i wymaga osobnego planu oraz kontraktów statusowych przed refaktorem.

## 2026-04-28 — Project status scope split v1

- Wydzielono `js/app/project/project-status-scope.js` jako mały moduł helperów status/scope używany przez `project-status-sync.js`.
- Nie zmieniono logiki biznesowej statusów, mirrorów, selected/rejected ani historii ofert.
- `project-status-sync.js` nie jest już 600+; pozostaje w progu ostrzegawczym ok. 389 linii, ale nadal miesza commit/reconcile/mirror save i wymaga ostrożnego dalszego cięcia.
- Następny bezpieczny krok Wyceny: albo dalszy mały split `wycena-core.js` po kontraktach collect, albo status sync commit/reconcile split z dedykowanym fixture.


## 2026-04-30 — Investor store boundary v1

- Wykonano etap „Inwestor/store/chmura”: `investors-store.js` nie jest już monolitem 600+ linii mieszającym model, storage, recovery i CRUD.
- Nowy podział odpowiedzialności: `investors-model.js`, `investors-local-repository.js`, `investors-recovery.js`, `investors-store.js`.
- Priorytet dalszej optymalizacji pozostaje zgodny z zasadą 2+ odpowiedzialności: nie ciąć plików tylko dla liczby linii, ale nie dopisywać nowych funkcji do plików mieszających warstwy.
- Następny sensowny kandydat w obszarze inwestor/projekt: `investor-project.js`, bo nadal łączy bezpośredni storage, projekt per inwestor i częściową logikę save/load.

## 2026-04-30 — Investor project boundary v1

- Wykonano kolejny etap po `Investor store boundary`: rozdzielono `investor-project.js` według odpowiedzialności bez zmiany UI i bez ruszania RYSUNKU.
- Nowe moduły: `investor-project-repository.js`, `investor-project-runtime.js`, `investor-project-patches.js`; stary `investor-project.js` został cienkim inicjatorem.
- Bezpośrednie odwołania do `localStorage` w tym obszarze zostały zamknięte w repository; audyt storage spadł z 237 do 234 referencji.
- Następny sensowny kandydat: `investor-ui.js` tylko jeśli ruszamy inwestora/UI, albo powrót do WYCENA/statusy. Nie ruszać RYSUNKU do czasu osobnej decyzji.

## Wykonane — project status boundary v1

- `js/app/project/project-status-sync.js` został rozdzielony na trzy odpowiedzialności: mirrors/persistence refresh, core reconcile/apply engine oraz snapshot acceptance/removal/promotion flow.
- Kolejne porządki w statusach robić tylko po konkretnej ścieżce biznesowej i z kontraktem testowym; nie wrzucać workflow snapshotów ani zapisu luster z powrotem do silnika statusów.
- Następni kandydaci poza RYSUNKIEM: `wycena-core.js` collect split, `tabs/wycena.js` dalszy shell split albo `investor-ui.js` po osobnym przejściu ścieżek render/event.

## 2026-05-01 — Orphan fixture cleanup v1

- Zakres naprawczy przed dalszą optymalizacją: testy Wyceny po splicie investor-project mogły zostawiać legacy sloty `fc_project_inv_*_v1` jako osierocone projekty.
- Naprawa została wykonana w fixture testowym, nie przez zmianę runtime aplikacji. Dzięki temu dalsza optymalizacja może kontynuować zasadę: najpierw zabezpieczenie przepływu danych, potem split plików mieszających odpowiedzialności.
- Przed kolejnymi zmianami w Wycena/Inwestor trzeba pilnować, żeby fixture’y przywracały pełne granice danych, nie tylko główne store’y.


## 2026-05-01 — Data safety test/backup retention fix

Zakres utrzymaniowy, bez RYSUNKU i bez zmiany UI wizualnego:

- poprawiono za ciasny test czyszczenia osieroconych slotów projektu,
- dodano twardy limit 10 najnowszych backupów testowych `before-tests`,
- zachowano dotychczasową retencję ręcznych backupów programu,
- poprawiono zachowanie listy backupów po usunięciu: accordion i scroll mają zostać w miejscu.

## 2026-05-01 — Wycena core platform split v1

Wykonane:
- rozdzielono `wycena-core.js` po odpowiedzialnościach: utils, catalog, source, material-plan, offer, lines, orchestrator,
- zachowano publiczne API `FC.wycenaCore`,
- dodano kontrakty smoke/architektury dla nowych warstw.

Po tym etapie `wycena-core.js` nie jest już priorytetowym długiem. Następni kandydaci poza RYSUNKIEM:
1. `js/tabs/wycena.js` — nadal 590 linii i miesza zakładkę, snapshoty, statusy i delegatory; ciąć tylko małymi ścieżkami po testach.
2. `js/app/wycena/wycena-tab-selection.js` — 452 linie, miesza wybór/scope/render; ruszać przy zmianach wyboru zakresu.
3. `js/app/investor/investor-ui.js` i `js/app.js` — kandydaci poza Wycena, ale bez RYSUNKU.

## 2026-05-01 — Test cleanup boundary v1

Zakres utrzymaniowy przed dalszą optymalizacją:

- domknięto sprzątanie danych testowych, żeby kolejne paczki refaktoru nie zostawiały `Jan Test`, `Room patch` ani legacy slotów `fc_project_inv_*_v1`,
- testy inwestora dostały kontrolowaną ścieżkę seedowania testowych inwestorów,
- Wycena fixture oznacza inwestora/projekt markerami testowymi,
- dodano kontrakt data-safety pilnujący całego łańcucha: inwestor → projekt → slot → snapshot → draft.

Po tym etapie można wrócić do optymalizacji Wyceny/Inwestora, nadal zostawiając RYSUNEK na koniec.

## Dev tests progress v1 — 2026-05-01

- Dodano osobny moduł `js/testing/dev-tests-progress.js`, żeby licznik postępu testów nie trafiał do cięższego kontrolera strony.
- `testHarness` emituje zdarzenia `suite-start/test-start/test-done/suite-done`; runner ROZRYS, który ma własny mechanizm, emituje zgodny kontrakt ręcznie.
- `dev_tests.html` pokazuje postęp `x/y`, aktualną sekcję i aktualny test bez zmiany runtime aplikacji oraz bez nowych zapisów do storage.
- Dalsza optymalizacja testów powinna iść w kierunku dzielenia dużych plików suite przy okazji zmian w danym obszarze, nie jako osobna kosmetyczna paczka.


## 2026-05-01 — dev tests progress live v2

Domknięto użyteczność narzędzia testowego: licznik `x/y` ma być widoczny w trakcie przebiegu testów, nie dopiero jako wynik końcowy. Zmiana dotyczy tylko test harness/dev_tests i nie rusza runtime aplikacji.


## 2026-05-01 — Quote scope entry boundary v1

Wykonane:
- rozdzielono `quote-scope-entry.js` na warstwy `utils`, `scope`, `modal`, `flow` i cienką fasadę publiczną,
- zachowano publiczne API `FC.quoteScopeEntry`,
- nie zmieniono UI, danych, storage ani logiki biznesowej Wyceny,
- dodano kontrakty smoke/architektury dla nowych warstw.

Po tym etapie `quote-scope-entry.js` nie jest już priorytetowym długiem. Następni sensowni kandydaci poza RYSUNKIEM:
1. `js/tabs/wycena.js` — nadal ok. 590 linii i miesza zakładkę, snapshoty, statusy oraz delegatory.
2. `js/app/wycena/wycena-tab-selection.js` — ok. 452 linie, miesza wybór zakresu, render modalowy i workflow nazw/snapshotów.
3. `js/app/investor/investor-ui.js` — duży obszar UI inwestora, ruszać tylko po przejściu event/render/data flow.
4. `js/app.js` — nadal gruby shell, ale odchudzać wyłącznie małymi delegatorami bez przenoszenia logiki domenowej na ślepo.

## 2026-05-01 — Preliminary measure final-wait v1

- Zatrzymano dalszą optymalizację na rzecz poprawki semantyki statusów Wycena/Inwestor.
- Poprawka utrwala zasadę procesową: `Pomiar → Wycena` to oczekiwanie na wycenę końcową po pomiarze, nie odrzucenie zaakceptowanej wyceny wstępnej.
- Po tej poprawce można wrócić do optymalizacji `tabs/wycena.js` albo `wycena-tab-selection.js`; RYSUNEK nadal zostaje na koniec.

## 2026-05-02 — Wycena selection split v1

Wykonane:
- rozdzielono `wycena-tab-selection.js` według odpowiedzialności: scope/summary, version naming/snapshot name guard, pickery, render i fasada,
- zachowano publiczne API `FC.wycenaTabSelection`, więc `tabs/wycena.js` i testy nadal korzystają z tego samego wejścia,
- nie zmieniono UI, storage, statusów ani semantyki zaakceptowanej wyceny wstępnej.

Po tym etapie `wycena-tab-selection.js` nie jest już długiem 400+ linii. Następni sensowni kandydaci poza RYSUNKIEM:
1. `js/tabs/wycena.js` — nadal ok. 590 linii i miesza orkiestrację zakładki, snapshoty, statusy i delegatory.
2. `js/app/investor/investor-ui.js` — tylko po przejściu render/event/data flow.
3. `js/app.js` — odchudzać wyłącznie przez małe delegatory, bez przenoszenia logiki domenowej na ślepo.


## 2026-05-02 — Wycena tab boundary v1

Wykonane bez zmiany UI i bez ruszania RYSUNKU:

- `js/tabs/wycena.js` spadł z ok. 589 do ok. 347 linii.
- Wycięto z niego sześć odpowiedzialności: data adapter, runtime state, selection bridge, editor bridge, status controller i render bridge.
- Po tym etapie `tabs/wycena.js` nadal jest ważnym plikiem orkiestrującym, ale nie jest już kandydatem do kolejnego cięcia wyłącznie z powodu rozmiaru.

Następne sensowne kierunki po tym etapie:

1. `js/app/wycena/wycena-tab-status-bridge.js` / `wycena-tab-history.js` tylko jeśli ruszamy konkretną ścieżkę historii/statusów.
2. `quote-snapshot-store.js`, `quote-snapshot-scope.js` albo `project-status-scope.js` tylko po dedykowanym kontrakcie biznesowym.
3. Poza WYCENĄ: `investor-ui.js` albo `app.js`, ale bez sztucznego refaktoru i bez RYSUNKU.

## 2026-05-02 — Multi-room status guard fix v1

Zakres naprawczy zamiast kolejnej optymalizacji: użytkownik wykrył rozjazd statusu `Pomiar` między wyceną pojedynczego pokoju i wyceną obejmującą kilka pomieszczeń.

Wykonane:
- poprawiono `project-status-manual-guard.js`, żeby manualny status pokoju uznawał zaakceptowaną wycenę wstępną, której scope zawiera ten pokój,
- zaktualizowano kontrakt Wycena/Inwestor dla wspólnej wyceny wstępnej,
- nie zmieniono UI, RYSUNKU, backupów ani storage.

Po tej poprawce można wrócić do optymalizacji poza RYSUNKIEM. Najbliższe sensowne kierunki pozostają: `investor-ui.js`, wybrane ścieżki historii/statusów Wyceny albo `app.js` jako shell — tylko jeśli jest konkretny powód, nie dla sztucznego cięcia.



## 2026-05-02 — Status / quote scope v1

Zakres był naprawą logiki biznesowej, nie kolejnym etapem sztucznego refaktoru.

Wykonane:
- dodano mały moduł `project-status-scope-decision.js` dla decyzji zakresu statusu w aplikacyjnym modalu,
- dodano mały moduł `wycena-room-availability.js` dla dostępności pomieszczeń w kalkulacji Wyceny,
- statusy `Pomiar/Wycena` mogą być ustawione bez wyceny wstępnej,
- manualny status respektuje scope zaakceptowanej wyceny wstępnej; przy konflikcie kilku zakresów pokazuje wybór,
- wybór pomieszczeń w WYCENIE pokazuje pokoje bez szafek jako zablokowane z opisem `Brak szafek`.

Decyzja architektoniczna:
- `project-status-manual-guard.js` pozostał spójnym guardem ok. 384 linii. Split w tej paczce byłby bardziej ryzykowny niż poprawka, bo dotyka ścieżek status/scope/oferty.
- `investor-ui.js` i `rozrys-pickers.js` pozostają plikami ostrzegawczymi; nie dokładać tam nowych odpowiedzialności. Następny refaktor robić tylko po konkretnej ścieżce: status modal inwestora albo shared picker UI.
- RYSUNEK nie był ruszany.

Następny sensowny kierunek po tej poprawce: obserwować statusy Wycena/Inwestor w realnym użyciu; dopiero potem ewentualnie ciąć `investor-ui.js` albo status guard według kontraktów, bez zmiany wyglądu.

## 2026-05-02 — Manual status preserve v1

Zakres był naprawą regresji statusów, nie refaktorem optymalizacyjnym.

Wykonane:
- doprecyzowano ścieżkę manualnego statusu w `Inwestorze`,
- dodano test regresyjny dla niezależnych pokoi bez wyceny wstępnej,
- nie cięto dalej `project-status-manual-guard.js` ani `investor-ui.js`, bo problem był w rekomendacji fallbacków statusu, nie w strukturze UI.

Następny sensowny krok nadal: obserwować realne statusy Wycena/Inwestor; dopiero potem ciąć status guard albo `investor-ui.js` po konkretnej ścieżce.


## 2026-05-02 — Schedule status prep v1

Zakres nie był refaktorem optymalizacyjnym, tylko przygotowaniem statusów pod przyszły harmonogram.

Wykonane:
- dodano osobny read-only moduł `project-schedule-status.js`, zamiast dokładać interpretację harmonogramu do `project-status-sync.js`, `investor-ui.js` albo zakładki Wyceny,
- utrzymano rozdział: status procesu pokoju vs dokument oferty/snapshot,
- dodano kontrakty Wycena/Harmonogram dla `Pomiar`, `Wycena`, braku wyceny wstępnej i wspólnej zaakceptowanej wyceny wstępnej.

Po tym etapie przy właściwym harmonogramie nie zaczynać od UI. Najpierw użyć boundary `FC.projectScheduleStatus`, a dopiero potem budować widok/kalendarz.


## 2026-05-02 — status reconcile v1

- Etap był naprawą biznesową statusów, nie refaktorem optymalizacyjnym.
- `project-status-snapshot-flow.js` dostał małą logikę rozpoznania pokoi zwolnionych po zmianie zaakceptowanego zakresu oferty; nie przenosić jej z powrotem do UI Wyceny.
- `project-status-manual-guard.js` jest blisko progu ostrzegawczego i miesza analizę ofert z budową decyzji zakresu, ale w tej paczce zostaje bez dużego splitu, bo priorytetem była stabilizacja regresji. Następny split statusów robić tylko po istniejących testach `status-reconciliation-regression.js`.


## 2026-05-02 — Status reconcile hotfix v1

- Nie wykonano refaktoru architektonicznego; to była celowana poprawka logiki statusów po akceptacji ofert.
- `project-status-snapshot-flow.js` dostał małą logikę wykrywania pokojów, których status `Zaakceptowany` pochodził z wcześniejszej zaakceptowanej końcowej oferty zastąpionej przez nową wstępną.
- `project-status-sync.js` dostał punktowe wejście `forceStatusRoomIds`, ale tylko dla takiego źródłowego cofnięcia z `Zaakceptowany` do `Pomiar`; nie używać tego jako globalnego mechanizmu resetowania statusów.
- `project-status-manual-guard.js` pozostaje blisko progu ostrzegawczego, ale nie był ruszany w tej paczce. Jego split powinien być osobną paczką po stabilizacji logiki statusów.


## 2026-05-02 — Manual status restore v1

- To była paczka stabilizująca logikę biznesową statusów, nie refaktor optymalizacyjny.
- Celowo nie cięto dalej `project-status-sync.js`, `project-status-snapshot-flow.js` ani `project-status-manual-guard.js`, bo najpierw trzeba było zabezpieczyć kontrakty statusów testami.
- Po stabilizacji statusów można wrócić do optymalizacji, ale kolejne cięcie statusów robić tylko po konkretnej ścieżce: manual status base, snapshot release/reconcile albo guard decyzji scope — nie jako ogólny refaktor.


## 2026-05-02 — Investor UI split v1

Wykonane bez zmiany UI, storage, RYSUNKU i bez zmiany semantyki statusów/ofert:

- `js/app/investor/investor-ui.js` spadł z ok. 588 do ok. 362 linii.
- Wydzielono render listy/karty inwestora do `js/app/investor/investor-ui-render.js`.
- Wydzielono przepływ statusów pokoju z Inwestora do `js/app/investor/investor-ui-status-flow.js`.
- Dodano kontrakt app-smoke dla rozdzielenia `FC.investorUiRender`, `FC.investorUiStatus` i `FC.investorUI`.

Decyzja architektoniczna:

- `investor-ui.js` nadal jest powyżej progu ostrożności 250 linii, ale pełni teraz jedną główną rolę: shell/binder ekranu Inwestora. Nie ciąłem go dalej w tej paczce, bo kolejny split wymagałby przenoszenia dużej liczby callbacków formularza i zwiększyłby ryzyko regresji bez konkretnego zysku biznesowego.
- Następne cięcie Inwestora robić tylko po konkretnej ścieżce: binding pól edycji, akcje list/detail albo przepływ pokoi. Nie wkładać renderu HTML ani status-flow z powrotem do shellu.

Następne sensowne kierunki poza RYSUNKIEM:

1. `app.js` jako shell — tylko jeśli da się wydzielić cienki delegator bez zmiany zachowania.
2. Wybrane ścieżki statusów/Wyceny — tylko z istniejącymi kontraktami biznesowymi.
3. Kolejny etap Inwestora — dopiero przy konkretnej potrzebie, nie jako sztuczne cięcie.


## 2026-05-02 — App core namespace split v1

Wykonane bez zmiany UI, RYSUNKU, statusów/ofert i backupów:

- `js/app.js` spadł z ok. 590 do ok. 464 linii.
- Wydzielono stary bootstrap/fallback namespace `FC`, fallback storage i fallback project do `js/app/bootstrap/app-core-namespace.js`.
- Nowy moduł nie tworzy nowego storage i nie zmienia formatu danych; korzysta z istniejących `constants/storage/schema/project-bridge`, a fallback trzyma tylko jako awaryjną kompatybilność.
- Dodano kontrakt smoke: `App core namespace jest wydzielony z app.js`.

Decyzja architektoniczna:

- `app.js` nadal jest powyżej progu ostrożności, ale po tym etapie jest bardziej właściwym shellem runtime niż miejscem bootstrapu danych.
- Nie ciąć go dalej tylko dla liczby linii. Kolejne wyjęcia robić tylko, jeśli widać konkretną odpowiedzialność: runtime validation/state, global legacy bridges albo render/delegatory.
- `app-core-namespace.js` ma pozostać małym bootstrap boundary. Nie dokładać tam logiki domenowej, UI, statusów ani backupów.

Następne sensowne kierunki poza RYSUNKIEM:

1. `app.js` — ewentualnie mały split runtime validation/state, tylko jeśli test runtime load pozostaje stabilny.
2. `project-status-manual-guard.js` — tylko po stabilizacji i z konkretną ścieżką statusową.
3. `actions-register.js` albo wybrane moduły szafek — po osobnym audycie odpowiedzialności, bez zmiany UI.


## 2026-05-02 — App legacy bridges split v1

Wykonane bez zmiany UI, RYSUNKU, statusów/ofert i backupów:

- `js/app.js` spadł z ok. 464 do ok. 354 linii.
- Wydzielono globalne delegatory cabinet/front, cabinet modal/actions, price modal i material/front hardware do `js/app/bootstrap/app-legacy-bridges.js`.
- `app-legacy-bridges.js` zachowuje stare globalne nazwy funkcji dla klasycznych skryptów, ale deleguje do istniejących modułów `FC.*` i nie wprowadza nowej logiki domenowej.
- Dodano kontrakt smoke: `App legacy bridges są wydzielone z app.js`.

Decyzja architektoniczna:

- `app.js` zostaje shellem runtime i nadal nie powinien przyjmować nowych funkcji domenowych.
- Nie ciąć dalej app shell tylko dla liczby linii; następne cięcia robić dopiero po znalezieniu kolejnej wyraźnej odpowiedzialności, np. runtime validation/state albo kolejny mały, testowalny boundary.
- `app-legacy-bridges.js` ma pozostać cienkim mostem zgodności. Nie dopisywać tam implementacji biznesowej, renderu UI ani storage.

Następne sensowne kierunki poza RYSUNKIEM:

1. Audyt `actions-register.js` lub wybranych modułów szafek — tylko jeśli da się rozdzielić jedną odpowiedzialność bez zmiany UI.
2. Ostrożny powrót do WYCENY/statusów tylko przy konkretnej ścieżce biznesowej i z pełnym testem regresji.
3. `app.js` etap 3 tylko, jeśli analiza pokaże konkretny bezpieczny fragment, nie dla sztucznego zejścia poniżej 250 linii.


## 2026-05-03 — Optimization checkpoint v1

- Po dwóch splitach `app.js` dalsze cięcie shellu runtime nie jest już najbezpieczniejszym ruchem bez konkretnego celu funkcjonalnego.
- Wykonano bezpieczny split narzędzi testowych Inwestora: `js/testing/investor/tests.js` → helpery + suity tematyczne + cienki agregator.
- To zmniejsza dług narzędziowy bez ruszania UI/runtime aplikacji i ułatwia przyszłe dopisywanie testów Inwestora bez tworzenia kolejnego monolitu.
- Przy okazji ujawniono i naprawiono problem izolacji fixture: recovery testy Inwestora muszą czyścić/przywracać `fc_edit_session_v1`, bo inaczej test snapshot-only miesza się z poprzednim testem pustej listy pomieszczeń.
- Następny refaktor powinien być powiązany z planowaną funkcją: szafki/fronty (`cabinet-fronts.js`/modal stack), Inwestor (`investor-ui.js` bindingi) albo Materiały (`tabs/material.js`). Nie ciąć RYSUNKU.


## 2026-05-03 — Pricing labor rules v1

- Po checkpointcie optymalizacji rozpoczęto funkcjonalny rozwój cenników: robocizna/czynności.
- Dodano nowe granice odpowiedzialności zamiast rozbudowywać istniejące pliki katalogów/WYCENY: `labor-catalog-definitions.js`, `labor-catalog.js`, `wycena-core-labor.js`.
- `labor-catalog.js` został rozdzielony z definicji domyślnych, żeby nie tworzyć nowego monolitu katalogu robocizny.
- `quote-snapshot.js` przekroczył próg ostrożności ok. 300 linii, bo doszła normalizacja `lines.labor`; nie ciąć go przy okazji bez osobnego planu na split normalizerów snapshotu, żeby nie ryzykować historii ofert.
- Następny sensowny kierunek w tym obszarze: UI wyboru dodatków robocizny bezpośrednio w modalu szafki oraz testy dla ręcznych `laborItems`.
- UI wyboru dodatków robocizny w modalu szafki został dodany w osobnym module `cabinet-modal-labor.js`; następny kierunek to testy dla edycji tych dodatków w przeglądarce i ewentualne dopracowanie formularza po ręcznym sprawdzeniu.


## 2026-05-03 — Pricing labor test fix v1

- To nie był refaktor funkcjonalny, tylko naprawa za ciasnego testu po `pricing_labor_rules_v1`.
- Nie ciąć runtime cenników przy takich korektach testów; najpierw rozróżniać realną regresję od kontraktu testowego, który przestał pasować do nowego modelu danych.
- Dalszy rozwój cennika robocizny powinien iść przez małe paczki: edycja formularza reguł, testy `laborItems`, a potem dopiero dokładniejsze podpięcie do WYCENY/PDF wewnętrznego.

## 2026-05-03 — Pricing labor unified picker v1

Wykonane:

- Rozwojowo ujednolicono robociznę do jednej puli definicji zamiast utrwalać mylące rozdzielenie `ręcznie`/`szafka`.
- Dodano osobny moduł `js/app/wycena/wycena-labor-picker.js`, żeby `WYCENA` nie renderowała monolitycznej listy wszystkich czynności z polami ilości.
- Dodano `js/app/pricing/labor-appliance-rules.js` jako małą granicę reguł domyślnego montażu AGD z możliwością wyłączenia przy konkretnej szafce.
- Nie ruszano RYSUNKU, statusów/ofert ani backupów.

Do obserwacji:

- `wycena-tab-editor.js` jest powyżej progu ostrożności 250 linii. Nie ciąć go losowo; jeśli kolejny etap dotknie edytora WYCENY, rozważyć wydzielenie renderu sekcji warunków oferty albo wybranych czynności.
- `price-modal-item-form.js` pozostaje powyżej progu ostrożności, ale ta paczka tylko ukryła kompatybilnościowe `usage`. Większy split formularza cennika robocizny powinien być osobnym etapem po ręcznej akceptacji działania modelu.

## 2026-05-03 — Pricing labor manual accordion v1

- Ręczne czynności WYCENY wydzielono do `js/app/wycena/wycena-tab-manual-labor.js` zamiast powiększać `wycena-tab-editor.js`.
- `wycena-tab-editor.js` spadł poniżej progu ostrożności i ponownie odpowiada głównie za opcje oferty.
- Dalsze zmiany robocizny w WYCENIE kierować do modułów: picker (`wycena-labor-picker.js`), ręczny akordeon (`wycena-tab-manual-labor.js`) albo core labor (`wycena-core-labor.js`), nie do shellu.

## 2026-05-03 — Czynności labor workspace v1

- Robocizna została przeniesiona funkcjonalnie do zakładki `CZYNNOŚCI` bez dalszego rozrostu `wycena-tab-editor.js`.
- Następny etap, jeśli zakładka `CZYNNOŚCI` będzie rosła: wydzielić z `js/tabs/czynnosci.js` osobne moduły renderu ręcznych czynności i renderu czynności szafek.


## Czynności labor UI adjust v1 — 2026-05-03

- Nie wykonano dużego refaktoru. Zmiany zostały ograniczone do UI robocizny: picker czynności, kolejność sekcji w modalu szafki i chipy montażu AGD.
- `wycena-labor-picker.js` pozostaje małym modułem pickera, a `cabinet-modal-labor.js` pozostaje modułem sekcji robocizny w modalu szafki. Nie scalać tego z głównym modalem szafki ani z WYCENĄ.

## Czynności labor calc help v1 — 2026-05-04

- `price-modal-item-form.js` został odciążony przez nowy moduł `price-modal-field-help.js`, który przejął objaśnienia `?` oraz launchery podstawowych pól formularza. Dzięki temu formularz nie przekroczył progu ostrzegawczego 400+ linii po dodaniu pomocy pól.
- `czynnosci.js` pozostaje poniżej progu ostrożności i ma jedną odpowiedzialność: workspace czynności/robocizny w zakładce `CZYNNOŚCI`.


## 2026-05-04 — obserwacja modułów robocizny

- `price-modal-item-form.js` przekracza próg ostrożności, ale po wydzieleniu `price-modal-field-help.js` nadal pełni jedną główną odpowiedzialność: stan formularza dodawania/edycji pozycji cennika.
- Następny sensowny split w tym obszarze, jeśli plik będzie dalej rósł, to wydzielenie logiki odczytu/zapisu draftu robocizny z formularza, nie dalsze mieszanie UI z kalkulacją.
- `tabs/czynnosci.js` jest blisko progu ostrożności i przy dalszym rozwoju warto rozdzielić render ręcznych czynności od renderu czynności szafek.

## Hardware catalog model v1 — 2026-05-04

- Etap katalogu okuć wydzielił model (`hardware-catalog.js`), pola formularza (`price-modal-hardware-form.js`) oraz panel producentów (`price-modal-hardware-manufacturers.js`).
- Nie wykonywano automatyki okuć ani przebudowy MATERIAŁ/WYCENA, aby nie mieszać modelu katalogowego z logiką wyliczeń.
- Do obserwacji: `catalog-store.js` pozostaje relatywnie większym store katalogów; dalszy podział robić dopiero przy kolejnym realnym etapie katalogów/okuć, nie jako sztuczny refaktor.

## Hardware supplier pricing v1 — 2026-05-04

- Wykonano etap dostawców i modelu ceny okuć: dostawcy/rabaty, ustawienia domyślne katalogu, cena katalogowa netto/brutto, realny koszt zakupu po rabacie, cena do wyceny i marża informacyjna.
- Następny etap okuć nie powinien dalej rozbudowywać `catalog-store.js`; przy kolejnym większym kroku warto wydzielić hardware storage/settings boundary, bo store przekroczył próg ostrzeżenia 400 linii.
- Plan raportów rentowności: nowy dział w przyszłych ustawieniach/raportach ma liczyć przychód z oferty, realne koszty materiałów/okuć, roboczogodziny po montażu, koszty dodatkowe, szacunkowy podatek/bufor i zysk na godzinę. To jest kierunek rozwoju, nie zakres bieżącej paczki.
- Przed raportami konieczne są snapshoty: cena dla klienta i realny koszt firmy muszą być zapisywane przy wycenie, a nie wyciągane później z aktualnego katalogu.



## Hardware catalog seed v1 — 2026-05-07

- Seed realnych okuć został rozdzielony na `js/app/catalog/hardware-catalog-seed-data.js` oraz `js/app/catalog/hardware-catalog-seeds.js`; nie powiększono `catalog-store.js` o dużą listę danych.
- `catalog-store.js` dostał tylko cienkie podłączenie merge seedów. To jest świadomy wyjątek od dalszego cięcia store, bo zmiana była mała i ograniczona do boundary katalogu.
- Kolejne etapy: najpierw sprawdzenie UX seedów/listy, potem standardy okuć w WYWIADZIE albo automatyka wyboru okuć przy szafce. Większy split store robić dopiero, gdy kolejny etap realnie wymaga rozbudowy zapisu/ustawień okuć.

## Hardware bundle inputs v1 — notatka planistyczna

- Katalog okuć dostał skład zestawu/kompletu oraz bezpieczniejsze wpisywanie cen.
- Nadal nie podpinano okuć do szafek, MATERIAŁÓW ani WYCENY; to pozostaje kolejnymi etapami po stabilizacji katalogu.
- Przy kolejnym większym etapie okuć warto rozważyć wydzielenie osobnego boundary dla storage/settings okuć, bo `catalog-store.js` jest już w strefie ostrzeżenia rozmiaru.


## Hardware import/export v1 — 2026-05-07

- Nie rozbudowano dalej `catalog-store.js`; import/eksport dostał osobne boundary `hardware-catalog-import-export.js`.
- UI importu/eksportu jest osobnym modułem `price-modal-hardware-import-export.js`, a nie dopiskiem do listy czy formularza pozycji.
- Wspólny zapis/odczyt prostych arkuszy XLSX trafił do `js/app/shared/xlsx-lite.js`, żeby przyszłe importy innych katalogów mogły użyć tej samej warstwy bez kopiowania parsera.
- Do obserwacji: jeśli XLSX będzie rozszerzany o style, walidacje komórek albo większe arkusze, rozdzielić `xlsx-lite.js` na writer/reader zamiast rozbudowywać jeden plik ponad próg ostrzeżenia.

## Backup storage keys v1 — 2026-05-07

- Zamiast rozbudowywać `catalog-store.js` o pełną politykę migracji kluczy, dodano małe boundary `js/app/catalog/catalog-storage-policy.js`.
- `catalog-store.js` przekracza próg ostrzegawczy, ale zmiana w nim jest cienkim podłączeniem do policy. Kolejny większy etap katalogu powinien dalej wydzielać storage/settings, jeśli będzie wymagał rozbudowy store.
- Reguła `fc_*` dla danych backupowanych jest od teraz architektonicznym wymogiem dla nowych modułów danych.

## Hardware Excel template v1 — 2026-05-07

- Rozszerzono istniejący boundary import/export zamiast dopisywać logikę Excela do `catalog-store.js` albo modala formularza.
- `xlsx-lite.js` przekroczył próg ostrożności, ale nadal ma jedną odpowiedzialność: lekki reader/writer XLSX bez bibliotek zewnętrznych. Następny większy etap XLSX powinien rozdzielić writer/reader/validation XML, jeśli plik będzie dalej rosnąć.
- `hardware-catalog-import-export.js` pozostał boundary mapowania katalogu ↔ JSON/XLSX. Przy dalszej rozbudowie katalogu uważać, żeby nie zamienił się w drugi store; logika domenowa cen nadal ma należeć do `hardware-catalog.js`.


## 2026-05-09 — Hardware Excel import UX

- Import/export okuć ma działający boundary, ale `js/app/catalog/hardware-catalog-import-export.js` przekracza 400 linii. Nie ciąć go ukrycie w tej samej poprawce użytkowej; następna rozbudowa import/export powinna zacząć się od splitu na template/export, parse/defaults oraz plan/apply.
- Uzupełnianie braków obowiązkowych jest już w osobnym module UI `price-modal-hardware-import-resolver.js`; nie scalać go z panelem import/export.


## Hardware bundle/import UX v1 — 2026-05-09

- Domknięto logikę jednostek okuć: `kpl.` jako komplet, `zestaw` jako pozycja składana, `para` bez osobnego bytu.
- Do następnej większej pracy nad import/export zostaje jawny dług: split `js/app/catalog/hardware-catalog-import-export.js` na template/export, parse/defaults i plan/apply.


## 2026-05-10 — Hardware catalog UX v1

- Domknięto pierwszy UX katalogu okuć bez wchodzenia w automatyczne dobieranie okuć do szafek.
- Nowy moduł `price-modal-hardware-ux.js` przejął status ceny, szybkie filtry i karty listy, żeby `price-modal-list.js` pozostał cienkim rendererem wspólnych katalogów.
- Dalszy sensowny kierunek po akceptacji: standardy okuć w WYWIADZIE albo dopiero potem wybór okuć przy szafce; import/export ma jawny dług splitu `hardware-catalog-import-export.js` przed kolejną większą rozbudową Excela.

## 2026-05-10 — Hardware supplier prices / purchase flow plan

- Dodano tylko notatkę planistyczną; bez zmian runtime. Przyszły kierunek okuć: rozdzielić produkt techniczny, wiele cen u dostawców, snapshot oferty i faktyczny zakup.
- Najpierw nie budować automatu dobierania najtańszej ceny do oferty. Wycena ma używać ustalonej kolejności źródeł i zapisywać snapshot, a sugestie najtańszego/najrozsądniejszego zakupu mają powstać dopiero po akceptacji oferty jako lista zakupów.
- Kolejność przyszłych paczek: `hardware_supplier_prices`, `hardware_quote_price_rule`, `hardware_quote_snapshot`, `hardware_purchase_list`, `hardware_profit_report`.
- Architektonicznie przed większym rozszerzaniem import/export rozdzielić `hardware-catalog-import-export.js` na template/export, parse/defaults i plan/apply; przed modelem wielu cen rozważyć osobny boundary danych cen dostawców zamiast rozbudowywać `catalog-store.js`.

## 2026-05-10 — Hardware supplier prices v1

- Model wielu cen dostawców został dodany bez rozbudowy `catalog-store.js` o nowy storage: ceny są częścią rekordu okucia, a store tylko normalizuje je przez `hardware-catalog.js`.
- XLSX cen dostawców dostał osobny moduł `js/app/catalog/hardware-catalog-supplier-price-xlsx.js`, żeby nie dopisywać całej logiki arkusza do `hardware-catalog-import-export.js`.
- UI cen dostawców jest w osobnym module `js/app/material/price-modal-hardware-supplier-prices.js`; nie scalać go z dużym formularzem okuć przy kolejnych zmianach.
- `hardware-catalog-import-export.js` nadal pozostaje powyżej progu ostrzeżenia 400 linii, mimo wydzielenia arkusza cen dostawców do osobnego helpera. Zostawiono go świadomie, bo dalej jest jednym boundary import/export; następna duża rozbudowa importu powinna zacząć się od podziału na template/export oraz parse/plan/apply.
- Kolejne etapy po stabilizacji: reguła/wybór ceny do wyceny w WYCENIE, snapshot ceny w ofercie, lista zakupów po akceptacji, raport plan vs rzeczywistość. Nie mieszać ich z bieżącym formularzem katalogu.

## 2026-05-11 — Hardware supplier price status/types v1

- Do modelu okuć dodano słowniki kategorii i typów oraz per-dostawca status ceny bez wchodzenia w WYCENĘ, MATERIAŁY ani automatyczne dobieranie okuć do szafek.
- Nowy moduł `price-modal-hardware-dictionaries.js` przejął UI słowników, a `hardware-catalog-supplier-price-xlsx.js` utrzymuje arkusz `Ceny_dostawcow`. Nie scalać tych obszarów z głównym formularzem ani store.
- `catalog-store.js`, `hardware-catalog.js` i `hardware-catalog-import-export.js` pozostają powyżej progów ostrożności/ostrzeżenia, ale zmiana utrzymuje większość nowych odpowiedzialności w osobnych modułach. Następna większa rozbudowa import/export musi zacząć się od podziału `hardware-catalog-import-export.js` na template/export oraz parse/plan/apply.
- Przed automatyczną zamianą producentów trzeba osobno zaprojektować UI wyboru producenta i zasady obsługi braków/duplikatów; obecna paczka tylko czyści dane katalogowe pod przyszły matching `kategoria + typ`.

## 2026-05-11 — Hardware supplier price import fix v1

- Naprawa została utrzymana w istniejących boundary: model domenowy w `hardware-catalog.js`, arkusz cen w `hardware-catalog-supplier-price-xlsx.js`, UI w `price-modal-hardware-supplier-prices.js` i słowniki w `price-modal-hardware-dictionaries.js`.
- Nie rozbudowano `catalog-store.js` ani nie ruszono WYCENY. To świadomie ogranicza zakres do stabilizacji katalogu okuć po dużej zmianie statusów/typów/cen dostawców.
- `hardware-catalog-import-export.js` nadal pozostaje powyżej progu ostrzeżenia. Zostaje jawny dług: następna większa rozbudowa import/export powinna zacząć się od splitu na template/export, parse/defaults oraz plan/apply.


## 2026-05-11 — hardware supplier import/dictionary UX fix v1

- Naprawa została wykonana punktowo bez dużego splitu import/export, bo dotyczyła realnego błędu importu z kopiowanym wierszem Excel i stanu słowników.
- `hardware-catalog-import-export.js` pozostaje kandydatem do podziału przy najbliższej większej pracy import/export: osobno template/export, parse/defaults oraz plan/apply.
- Dla słowników okuć docelowo rozważyć przejście z tekstowego `hardwareType` na stabilne `hardwareTypeId`, żeby zmiany nazw nie wymagały migracji tekstu w pozycjach.



## 2026-05-11 — Hardware import bulk/diff/types fix v1

- Domknięto użytkowy kierunek importu cenników hurtowni: `Ceny_dostawcow` można uzupełniać bez ręcznego ID, a program dopasowuje po `producent + symbol + dostawca`.
- Dodano rzeczywisty diff w podglądzie importu, więc import/export okuć ma więcej logiki planowania niż prosty mapper arkusza.
- Dług techniczny został świadomie nazwany: `hardware-catalog-import-export.js` ma ok. 500 linii i przy następnej większej rozbudowie należy go rozdzielić na trzy granice: XLSX template/export, parse/defaults oraz import plan/apply.
- Nie robić ukrytego dużego splitu razem z kolejną naprawą użytkową; najpierw dodać kontrakty dla obecnego diffu importu i dopiero wtedy ciąć plik.


## Hardware import — dopisane po supplier price create item v1 — 2026-05-12

- `hardware-catalog-import-export.js` pozostaje plikiem powyżej progu 400 linii i powinien zostać rozdzielony w osobnym, nietwórczym refaktorze import/export.
- Następny sensowny split: logika planu importu okuć, logika importu cen dostawców i raportowanie diffu jako osobne moduły/fasady z testami kontraktowymi.
- Nie wykonywać tego splitu razem z kolejnymi zmianami UX katalogu, żeby nie mieszać ryzyka.

## Hardware import resolver — notatka po 2026-05-12

- `hardware-catalog-import-export.js` pozostaje plikiem ostrzegawczym 400+ linii. Ten etap świadomie nie robił dużego splitu, bo naprawiał krytyczną logikę importu nowych okuć z cen dostawców.
- Najbliższy bezpieczny refaktor w tym obszarze: wydzielić plan importu cen dostawców i resolver braków do osobnych modułów domenowych, z testami dla `producent + symbol + dostawca`, braków kategorii/jednostki oraz dodawania kategorii.



## Hardware import resolver supplier gap v1 — 2026-05-12

- Punktowa poprawka importu nie robi dużego splitu, ale potwierdza dług: logikę planu importu cen dostawców, resolver braków i raportowanie ostrzeżeń warto wydzielić do mniejszych modułów przy osobnym refaktorze.
- Przed takim refaktorem zachować testy dla: brakującego dostawcy/kategorii/jednostki, fałszywych duplikatów z eksportu oraz tworzenia nowego okucia z `Ceny_dostawcow`.


## Hardware supplier missing resolver v1 — 2026-05-12

- Punktowa poprawka utrzymała logikę w istniejących modułach: arkusz cen w `hardware-catalog-supplier-price-xlsx.js`, plan importu w `hardware-catalog-import-export.js`, resolver UI w `price-modal-hardware-import-resolver.js`.
- Dług techniczny pozostaje aktualny: następna większa rozbudowa import/export powinna wydzielić plan importu cen dostawców oraz resolver braków do mniejszych modułów z kontraktami.
- Nowe kontrakty do zachowania przy przyszłym refaktorze: brakujący dostawca dla istniejącego okucia, wybór dostawcy z listy, brak dodawania dostawcy w resolverze i licznik cen pominiętych po `Ignoruj wszystko`.

## Hardware price change confirmation v1 — 2026-05-13

- Dodano osobny moduł UI `price-modal-hardware-price-confirm.js` zamiast dopisywać potwierdzanie cen do resolvera braków. To utrzymuje rozdział: resolver uzupełnia brakujące dane, confirm zatwierdza realne zmiany cen.
- `hardware-catalog-supplier-price-xlsx.js` ma teraz ponad 400 linii. Następny refaktor import/export powinien wydzielić co najmniej: parser/normalizację wierszy, dopasowanie item+dostawca, diff/akcje cen i aplikowanie zmian.
- `hardware-catalog-import-export.js` nadal przekracza próg ostrzeżenia. Nie ciąć go razem z kolejną funkcją użytkową; najpierw zrobić testy kontraktowe dla planu importu i potwierdzeń cen.

## Hardware import/export stabilization — 2026-05-13

W paczce `site_hardware_global_vat_import_stabilization_v1.zip` wykonano stabilizację bez dużego splitu:

- podgląd importu cen dostawców nie mutuje już bieżącego katalogu;
- VAT dostawcy usunięto z aktywnego modelu i XLSX, a kalkulacje używają globalnego VAT z ustawień;
- rabat dostawcy pozostaje w modelu dostawcy;
- dodano test ochronny dla czystości `buildImportPlan()`.

Następny sensowny krok optymalizacyjny: wydzielić import/export okuć na mniejsze moduły, np. plan, match, supplier-price apply, export XLSX i report, ale tylko jako osobną paczkę refaktoryzacyjną po stabilnym teście użytkownika.

## 2026-05-13 — Hardware accessory tests v1

- Dodano dedykowaną suite `js/testing/material/accessories-tests.js` jako zabezpieczenie przed dalszą stabilizacją import/export okuć.
- Przed kolejnym refaktorem `hardware-catalog-import-export.js` albo `hardware-catalog-supplier-price-xlsx.js` uruchamiać dodatkowo:

```bash
node tools/hardware-accessories-dev-smoke.js
```

- Suite ma pilnować kontraktów, które wcześniej wychodziły dopiero w ręcznych testach Excela: globalny VAT, rabaty dostawców, wiele cen, `Do wyceny`, resolver brakującego dostawcy, import po `producent + symbol`, brak nadpisywania nazwy katalogowej i brak mutacji katalogu na etapie podglądu importu.
- To jest etap testowy/stabilizujący, bez zmiany runtime. Następny bezpieczny etap optymalizacji to dopiero split import/export na mniejsze moduły.


## 2026-05-14 — Hardware import/export refactor v1

- Wykonano planowany split import/export okuć po paczce testów akcesoriów.
- Nowy podział: `hardware-catalog-export-xlsx.js`, `hardware-catalog-import-parser.js`, `hardware-catalog-import-plan.js`, `hardware-catalog-import-export.js` jako fasada oraz `hardware-supplier-price-export.js`, `hardware-supplier-price-import.js`, `hardware-catalog-supplier-price-xlsx.js` jako fasada.
- Pliki ostrzegawcze `hardware-catalog-import-export.js` i `hardware-catalog-supplier-price-xlsx.js` przestały być miejscem ciężkiej logiki. Następne zmiany w tym obszarze kierować do właściwych modułów, a nie do fasad.
- Najbliższy logiczny następny etap po ręcznym sprawdzeniu: poprawa czytelności raportu importu albo rozbudowa dostawców/preferencji zakupowych, ale tylko po zachowaniu kontraktów z `tools/hardware-accessories-dev-smoke.js`.


## 2026-05-14 — Hardware import/export deep tests v1

- Po refaktorze import/export dodano osobną suite głębokich testów kontraktowych `js/testing/material/accessories-import-export-deep-tests.js`.
- Przed kolejnymi zmianami w modułach `hardware-catalog-import-plan.js`, `hardware-supplier-price-import.js`, `hardware-catalog-export-xlsx.js` albo UI potwierdzeń importu uruchamiać:

```bash
node tools/hardware-import-export-deep-smoke.js
node tools/hardware-accessories-dev-smoke.js
```

- Suite deep smoke pilnuje szczególnie granicy `buildImportPlan()` versus `applyImportPlan()`, resolverów braków, potwierdzeń ceny, dopasowania `producent + symbol`, globalnego VAT-u i rabatu dostawcy.
- Ten etap nie jest refaktorem runtime; jest warstwą bezpieczeństwa przed kolejną funkcją użytkową, np. czytelniejszym raportem importu albo rozbudową dostawców/preferencji zakupowych.


## PRO100 service import — dalszy plan

- Obecny etap dodaje parser i UI importu bez osobnego storage. Następne prace powinny iść przez istniejący model zleceń usługowych.
- Jeśli import PRO100 zacznie obsługiwać dodatkowe operacje z nazw (`NUT`, `FREZ`, `ROZCIĄĆ`, `FRONT ZAWIASY`), nie dokładać tego do parsera bazowego. Dodać osobny moduł rozpoznawania operacji i osobne testy.
- `service-order-detail.js` ma ok. 300 linii i jest plikiem ostrożności. Przy następnej większej zmianie UI usług rozdzielić formularz podstawowy, listę formatek i akcje rozrysu.


## PRO100 file import v1 — 2026-05-14

- Import plikowy PRO100 został dołożony bez duplikowania logiki wklejki: `parseRows()` i `parseColumns()` są wspólnym wejściem dla XLSX/CSV/TXT oraz tekstu wklejanego.
- Nie powstał osobny importer usługowy ani osobny storage; dalsze porządki w usługach powinny iść w kierunku wspólnego modelu formatek/oklein wskazanego w planie `Materiał + ROZRYS`.

## 2026-05-15 — Room preferences stage1 v1

- Preferencje pomieszczenia zostały wydzielone jako nowy obszar domenowy `js/app/room-preferences/`, zamiast dopisywania logiki do parametrów pokoju albo dużych modułów WYWIADU.
- UI preferencji jest osobnym modułem `js/app/ui/wywiad-room-preferences.js`; obecny `wywiad-room-settings.js` zostaje odpowiedzialny tylko za parametry techniczne pomieszczenia.
- Następny etap hurtowego zastosowania preferencji do istniejących szafek powinien dostać osobne moduły plan/apply oraz modal podglądu liczników. Nie dokładać masowego nadpisywania bezpośrednio do modala preferencji.
- Przy późniejszym etapie zamiany producentów okuć zacząć od czystego silnika dopasowania katalogowego i testów, bez podmiany tekstów w WYCENIE.

## 2026-05-16 — Program defaults settings v1

- Dodano osobny store `js/app/settings/program-defaults-store.js` i osobny widok `js/app/ui/data-settings-defaults-view.js`, żeby globalne fallbacki programu nie trafiały do WYWIADU ani dużych modułów ustawień.
- `data-settings-modal.js` pozostaje cienkim routerem widoków: menu / backup / domyślne. Nie rozbudowywać go o logikę formularzy.
- Następny etap preferencji pomieszczenia powinien rozdzielić strefy dolna/środkowa/górna w osobnym modelu, bez mieszania z globalnym `fc_program_defaults_v1`.


## Room zone preferences v1 — 2026-05-16

- Preferencje pokoju są rozdzielone w małych modułach: model `room-preferences-model.js`, UI `wywiad-room-preferences.js`, fallback globalny `program-defaults-store.js`.
- Nie rozbudowywać `app.js` ani dużych plików WYWIADU o logikę stref; kolejne etapy frontów łączonych powinny iść osobnym modułem.

## Front material source v1 — 2026-05-16

- Źródło materiału frontów specjalnych wydzielono do `js/app/cabinet/front-material-source.js`; kolejne etapy frontów łączonych/wieloczęściowych powinny rozbudowywać ten moduł zamiast dopisywać logikę bezpośrednio do generatorów.
- `cabinet-modal-set-wizard.js`, `cabinet-modal-standing-specials.js` i `cabinet-fronts.js` zostały dotknięte, bo zawierają istniejące UI/generowanie frontów. Przy następnym większym etapie frontów rozważyć wydzielenie osobnego modułu UI dla źródeł/kompozycji frontu.
- Następny logiczny etap: fronty wieloczęściowe/tabela części oraz hurtowa zmiana po źródłach `lower/middle/upper/custom`, ale dopiero po ręcznym zatwierdzeniu obecnego etapu.


## Set materials unify v1 — 2026-05-17

- Nowa logika materiałów zestawu została wydzielona do `js/app/cabinet/cabinet-modal-set-materials.js`, zamiast dalej rozbudowywać `cabinet-modal-set-wizard.js`.
- `cabinet-modal-set-wizard.js` nadal jest dużym plikiem podwyższonego ryzyka; kolejne prace przy zestawach powinny iść przez małe moduły pomocnicze, np. fronty wieloczęściowe, walidacja zestawu, zapis zestawu.
- Następny większy etap przy zestawach powinien mieć własne testy kontraktowe przed cięciem generatora frontów.

## Fridge/set material cleanup v1 — 2026-05-17

- Zamiast dodawać kolejne wyjątki w UI lodówki, ukryto stare ogólne pola frontu przez małą funkcję widoczności w `cabinet-modal.js`.
- Zestawy dostały prostszy, przewidywalny fallback: dolna strefa → globalne domyślne → awaryjne wartości. To zmniejsza zależność od ostatniej przypadkowej szafki w pokoju.
- Następny większy refaktor powinien dotyczyć wydzielenia części logiki `cabinet-modal-set-wizard.js`, ale dopiero po testach frontów wieloczęściowych/zestawów.

## Preferences / front source cleanup v1 — 2026-05-17

- Wykonano mały cleanup fundamentu preferencji/frontSource bez zmiany UI.
- Centralny resolver w `room-preferences-model.js` ogranicza duplikację między nowym draftem szafki, zestawami i specjalnymi frontami.
- Duże pliki historyczne (`cabinet-modal-set-wizard.js`, `cabinet-fronts.js`) nie były w tej paczce dzielone. Następny split robić tylko pod konkretną ścieżkę: set wizard, generowanie frontów albo hurtową zmianę.

## Bulk apply zone preferences v1 — 2026-05-17

- Hurtowe zastosowanie preferencji wydzielono do modułów plan/apply/UI zamiast rozbudowywać `wywiad-room-preferences.js` albo `app.js`.
- Granica odpowiedzialności: plan liczy i opisuje skutki, apply wykonuje mutacje, modal tylko steruje wyborem użytkownika i pokazuje liczniki.
- Ten podział ma zostać utrzymany przy kolejnych etapach, szczególnie przy przyszłej rozbudowie o producentów okuć albo fronty wieloczęściowe.
- `cabinet-fronts.js` i `cabinet-modal-set-wizard.js` nadal są dużymi plikami historycznymi. Nie ciąć ich szeroko bez osobnego etapu i testów kontraktowych.
- Następny możliwy etap produktowy: ręczne testy Etapu 2A, potem dopiero rozmowa o okuć/producentach albo frontach wieloczęściowych. Nie mieszać tych tematów w jednej paczce.

## Hardware technical data + Excel v1 — 2026-05-18

- Obszar katalogu okuć dostał nową warstwę danych technicznych bez osobnego storage.
- `hardware-catalog.js` pozostaje średnim ryzykiem i przekracza próg ostrożności, ale zmiana była domenowa i lokalna; przy następnym większym etapie okuć rozważyć wydzielenie technicznej normalizacji do osobnego modułu zamiast dalszego rozbudowywania `hardware-catalog.js`.
- Import/export zachowuje split: parser, plan, eksport katalogu i import/eksport cen dostawców pozostają osobnymi modułami.


## 2026-05-20 — hardware_dynamic_technical_params_v1

- Katalog okuć ma nowy kierunek rozwoju: dynamiczne parametry techniczne per kategoria zamiast dokładania kolejnych stałych pól do formularza.
- Następne etapy powinny używać `technicalParams` jako źródła prawdy dla zamienników, list zakupowych i umów.
- Nie rozwijać dalej jednego puchnącego arkusza `Okucia`; preferować arkusze grupowe oraz prosty arkusz `Ceny_dostawcow` do szybkich aktualizacji cen.
- Przed silnikiem zamiany producentów/systemów okuć należy oprzeć porównywanie na parametrach oznaczonych jako cechy kluczowe.
