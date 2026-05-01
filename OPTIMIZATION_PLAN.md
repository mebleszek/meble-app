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
2. `js/app/quote/quote-scope-entry.js` — 489 linii, miesza scope/modal/snapshot flow; dobry kandydat przy dalszym rozwoju ofert.
3. `js/app/wycena/wycena-tab-selection.js` — 452 linie, miesza wybór/scope/render; ruszać przy zmianach wyboru zakresu.
4. `js/app/investor/investor-ui.js` i `js/app.js` — kandydaci poza Wycena, ale bez RYSUNKU.

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

