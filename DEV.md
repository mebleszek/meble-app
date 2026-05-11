# DEV — aktywne zasady rozwoju meble-app

Ten plik jest krótką, aktualną mapą pracy. Stare wpisy historyczne zostały przeniesione do `DEV_HISTORY_20260425.md` i nie są źródłem bieżących decyzji architektonicznych.

## Aktualna baza

- Aktualna paczka robocza po tym etapie: `site_hardware_import_bulk_diff_types_v1.zip`.
- Baza startowa tej paczki: `site_hardware_supplier_import_dictionary_ux_fix_v1.zip`.
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
- Wszystkie dane użytkownika, katalogów, cenników, inwestorów, projektów i ustawień biznesowych, które mają trafić do globalnego backupu, muszą mieć wersjonowany klucz `fc_*`, np. `fc_hardware_suppliers_v1`. Nie dodawać luźnych kluczy typu `hardwareSuppliers` dla danych backupowanych; jeśli taki klucz już istnieje, zrobić migrację do `fc_*`.

## UI i interakcje — zasady aktywne

- Nie zmieniać wyglądu UI bez wyraźnej zgody.
- Nowe elementy wzorować na istniejących wzorcach aplikacji, szczególnie ROZRYS, `Wybierz pomieszczenia`, `Wybierz materiał / grupę` i `dev_ui_patterns.html`.
- Nie używać systemowych `alert`, `confirm`, `prompt` w nowych pracach. Używać własnych modali `confirmBox`, `infoBox`, `panelBox` albo dedykowanych modali zgodnych ze stylem aplikacji.
- Opisy pomocnicze dawać pod ikoną `?`, nie jako luźne akapity obok pól/nagłówków.
- Przyciski: brak zmian = niebieski `Wyjdź`; niezapisane zmiany = czerwony `Anuluj` + zielony `Zapisz/Zatwierdź/Dodaj` zgodnie z kontekstem.
- Ikony w aplikacji mają być stabilnymi SVG, nie emoji zależnymi od systemu. Wzorce ikon trzymać w `dev_ui_patterns.html`, a wspólne SVG w `js/app/ui/app-icons.js`.


## Hardware price sources / zakup / rentowność — plan przyszły — 2026-05-10

- Plan dotyczy przyszłego rozwoju katalogu okuć, WYCENY i raportów rentowności; ten wpis nie zmienia jeszcze runtime ani modelu danych.
- Docelowo rozdzielać trzy warstwy: katalog techniczny okucia, wiele znanych cen u dostawców oraz snapshot ceny użytej w konkretnej ofercie.
- Jedno okucie powinno móc mieć wiele cen: lokalna hurtownia, Bivert, MAGO, faktura, ręczna cena albo inne źródło. Nie wracać do płaskiego mylenia `miejsce zakupu` z `źródło ceny` jako jedyną parą pól.
- Reguła wyceny dla klienta ma działać według kolejności źródeł, np. lokalna hurtownia jako domyślna, a przy braku ceny fallback do bazy internetowej typu Bivert. Cena użyta w ofercie musi być zamrożona w snapshotcie wyceny.
- Automat najtańszego zakupu nie powinien po cichu ustalać oferty dla klienta. Po akceptacji oferty ma powstać lista zakupów z sugestią gdzie kupić najtaniej/najrozsądniej, a użytkownik zatwierdza faktyczny zakup.
- Raport rentowności ma porównywać: koszt okuć przyjęty do oferty, sugerowany koszt zakupu, rzeczywisty koszt zakupu i różnicę zakupową. Przykład: klient dostał ofertę z okuciami za 3000 zł, realny zakup 2400 zł, różnica +600 zł poprawia rentowność projektu.
- Dalszy rozwój w tej ścieżce powinien iść etapami: wiele cen przy okuciu, reguła wyboru ceny do wyceny, snapshot w WYCENIE, lista zakupów po akceptacji, raport plan vs rzeczywistość.
- Przed kodowaniem tego obszaru przeczytać `CLOUD_MIGRATION.md` i nie dopisywać nowych danych poza wersjonowanymi kluczami `fc_*`/repozytorium. Przy większej pracy nad import/export najpierw rozdzielić `hardware-catalog-import-export.js` zgodnie z planem.





## Hardware supplier import + dictionary UX fix v1 — 2026-05-11

- Baza tej paczki: `site_hardware_supplier_price_import_fix_v1.zip`.
- Naprawiono import `Ceny_dostawcow` pod typowy scenariusz pracy w Excelu/Google Sheets: użytkownik może skopiować wiersz ceny, zmienić widoczną kolumnę `dostawca` i cenę, nawet jeśli techniczne `dostawca_id` zostało stare. Widoczna nazwa dostawcy ma pierwszeństwo, a konflikt jest raportowany ostrzeżeniem zamiast pomijania ceny.
- Import cen dostawców nadal liczy brakujące netto/brutto z VAT dostawcy i ignoruje błędy arkusza typu `#REF!` jako śmieci techniczne, nie jako cenę.
- Słowniki kategorii i typów/cech zapisują stan z poprawnym `dirty flow`: bez zmian pokazują `Wyjdź`, a po zmianach `Anuluj` + `Zapisz`. Zapis słownika odświeża formularz okuć.
- Zmiana nazwy typu/cechy w słowniku migruje istniejące okucia trzymające starą nazwę tekstową, żeby edytowana pozycja od razu widziała nową nazwę w `Typ / cecha`.
- Wybór `Typ / cecha` blokuje już na etapie pickera typy zajęte przez tego samego producenta w tej samej kategorii. Blokada zapisu pozostaje jako druga linia obrony.
- Lista okuć ma kompaktowy przycisk `Edytuj` w jednej linii z chipem statusu ceny, zgodnie z resztą aplikacji.
- Nie dodano nowych kluczy storage. Dane nadal żyją w `fc_accessories_v1`, `fc_hardware_categories_v1`, `fc_hardware_types_v1`, `fc_hardware_suppliers_v1` i `fc_hardware_settings_v1`.
- `hardware-catalog-import-export.js` nadal jest powyżej 400 linii; w tej paczce wykonano naprawę punktową bez dużego splitu, żeby nie zwiększać ryzyka regresji importu.


## Hardware supplier prices v1 — 2026-05-10

- Katalog okuć obsługuje teraz wiele cen dostawców przy jednej pozycji. Dane żyją w `fc_accessories_v1` jako `supplierPrices` przy okuciu; nie dodano nowego luźnego klucza storage.
- Przy cenie dostawcy trzymać minimum: `supplierId`, cena katalogowa netto/brutto, typ wpisanej ceny, data ceny i `useForQuote`. VAT, rabat dostawcy, zakup po rabacie i podgląd ceny do wyceny liczyć w locie z danych dostawcy oraz ustawień.
- Dla jednego okucia dokładnie jedna cena dostawcy może mieć `useForQuote=true`. Zaznaczenie innej ceny jako `Do wyceny` musi automatycznie odznaczyć poprzednią.
- Legacy płaskie pola ceny (`supplierId`, `priceSource`, `catalogPriceNet/Gross`, `purchasePriceNet/Gross`, `price`) pozostają jako pochodny/kompatybilny skrót dla listy, WYCENY i starszych danych. Nie traktować ich jako nowego źródła prawdy.
- Formularz okuć ma sekcję `Ceny u dostawców`; dawny płaski `Dostawca / miejsce zakupu` i `Źródło ceny` nie powinny być dalej rozwijane jako ręczny model ceny.
- XLSX ma arkusz `Okucia` jako produkt techniczny bez cen oraz arkusz `Ceny_dostawcow`, gdzie jeden wiersz to aktualna cena danego okucia u danego dostawcy. Nie dodawać dynamicznych kolumn per dostawca ani osobnego arkusza dla każdego dostawcy.
- W Excelu użytkownik może duplikować wiersz w `Ceny_dostawcow` i zmienić tylko dostawcę oraz cenę; importer dopasowuje po `okucie + dostawca`, nie wymaga ręcznego `id_ceny`.
- Ten etap nie tworzy jeszcze snapshotów WYCENY, listy zakupów po akceptacji ani raportu plan vs rzeczywisty zakup.
- Moduły: `hardware-catalog-supplier-price-xlsx.js` obsługuje arkusz cen dostawców, `price-modal-hardware-supplier-prices.js` obsługuje UI cen dostawców.
- Raport: `tools/reports/hardware-supplier-prices-v1.md`.


## Hardware catalog UX v1 — 2026-05-10

- Lista `Akcesoria` ma czytelniejsze karty okuć z nazwą, chipem statusu ceny, producentem, kategorią, jednostką, symbolem, dostawcą, zakupem, ceną do wyceny i datą ceny.
- Status ceny jest liczony jako UX-only: `Brak ceny`, `Do sprawdzenia`, `Stara cena`, `Aktualna cena`. Nie dodawać tego jako nowego trwałego pola bez osobnej decyzji.
- Szybkie filtry okuć obejmują: `Wszystkie`, `Do sprawdzenia cen`, `Brak ceny`, `Stara cena`, `Zestawy`. Filtry są stanem runtime UI, nie nowym storage.
- Zestawy na liście pokazują podsumowanie składników: wartość składników, koszt zakupu składników i różnicę względem ceny pozycji. `kpl.` nadal jest zwykłą jednostką, a skład wynika z `bundleItems`.
- Import XLSX/JSON ma komunikat dla Android/Google Sheets: najpewniej importować lokalną kopię `.xlsx` z urządzenia. Odczyt pliku ma fallback `FileReader` i własny komunikat z nazwą/rozmiarem/typem pliku.
- UX listy okuć jest w `js/app/material/price-modal-hardware-ux.js`; nie rozbudowywać `price-modal-list.js` o szczegółową logikę kart okuć.
- `hardware-catalog-import-export.js` nadal przekracza 400 linii. Przy następnej większej pracy z import/export zacząć od splitu na template/export, parse/defaults oraz plan/apply.


## Hardware bundle/import UX v1 — 2026-05-09

- `kpl.` jest zwykłą jednostką kompletu i nie może automatycznie otwierać składu zestawu.
- `para` nie jest osobną jednostką okuć; stare/importowane `para` normalizować do `kpl.`.
- Skład zestawu pokazuje się tylko dla jednostki `zestaw` albo dla istniejącej pozycji, która ma już `bundleItems`.
- Arkusz `Sklad_zestawow` w XLSX ma mieć czytelne kolumny robocze na początku: `zestaw_nazwa`, `skladnik_nazwa`, `ilosc`, a techniczne `zestaw_id` i `skladnik_id` na końcu.
- W podglądzie importu tryb importu ma być wyborem 1 z 2 (`Scal / aktualizuj` albo `Zastąp katalog`) i dopiero osobny przycisk `Zatwierdź import` wykonuje zapis.
- `hardware-catalog-import-export.js` jest nadal powyżej 400 linii; zostawiony świadomie po tej paczce, bo zmiana dotyczyła wrażliwego importu i większy split zwiększałby ryzyko regresji. Przy następnej rozbudowie import/export zacząć od wydzielenia template/export oraz parse/plan/apply.


## Hardware file snapshot fix v1 — 2026-05-09

- Import plików JSON/XLSX w katalogu okuć ma czytać dane pliku natychmiast po wyborze z inputa i przekazywać dalej snapshot w pamięci, nie żywą referencję `File`.
- To zabezpiecza Android/Chrome przed błędem utraty uprawnień do wybranego pliku po wyczyszczeniu inputa albo otwarciu kolejnego modala.
- Dalsze kroki importu, w tym uzupełnianie braków obowiązkowych, muszą pracować na danych już odczytanych z pliku.
- Nie cofać tej logiki do przekazywania surowego obiektu `File` przez kolejne modale.


## Hardware Excel required modal v1 — 2026-05-09

- Arkusz `Okucia` ma mieć najważniejsze kolumny robocze na początku: `nazwa`, `cena_netto`, `cena_brutto`, `jednostka`, `producent`, `kategoria`, `symbol`; techniczne `id` ma być na końcu.
- Import Excela ma ignorować puste wiersze robocze oraz wiersze zawierające tylko domyślne/formułowe wartości bez nazwy, symbolu, producenta lub realnej ceny.
- Minimalny import nowej pozycji to nazwa + jedna cena netto albo brutto. VAT, dostawca, rabat, narzut, baza wyceny, sposób liczenia i data ceny mają być uzupełniane z ustawień katalogu/importu.
- `producent`, `kategoria` i `jednostka` są obowiązkowe, ale brak tych pól nie ma tworzyć czerwonej ściany błędów. Import ma otworzyć aplikacyjne uzupełnianie braków pozycja po pozycji.
- Uzupełnianie braków ma działać bez hurtowego ustawiania: dla każdej brakującej pozycji osobno `Ignoruj`, `Ignoruj wszystko` albo `Zatwierdź` po uzupełnieniu pól.
- Logika uzupełniania braków UI jest w `js/app/material/price-modal-hardware-import-resolver.js`; nie dokładać jej do głównego modala import/export.
- `js/app/catalog/hardware-catalog-import-export.js` przekracza 400 linii i jest świadomie zostawiony jako boundary po tej paczce. Przy następnej większej rozbudowie import/export najpierw rozdzielić go na template/export, parse/defaults i plan/apply.

## Czynności labor UI adjust v1 — 2026-05-03

- Robocizna/czynności są zarządzane w zakładce `CZYNNOŚCI`; `WYCENA` nie może ponownie przejmować ręcznego dodawania czynności.
- Okno `Dodaj czynności` używa standardowego `FC.panelBox` z `panel-box--rozrys`, a nie własnego pływającego układu ani przyklejonego białego paska akcji.
- W modalu szafki sekcja `Czynności robocizny` ma być po podstawowych parametrach, wymiarach i materiałach; nie przenosić jej nad wybór materiałów.
- Wybór `Z montażem` / `Bez montażu` dla AGD ma być wzajemnie wykluczającym się chipem z ptaszkiem w stylu ROZRYS, nie zwykłymi przyciskami.
- `tools/app-dev-smoke.js` ma kontrakty pilnujące panelBox dla pickera, kolejności sekcji w modalu szafki i chipów montażu sprzętu.


## Pricing labor display fix v1 — 2026-05-03

- `catalogStore` musi wystawiać cienkie aliasy `getSheetMaterials/getAccessories/getQuoteRates/getWorkshopServices` obok `getPriceList(kind)`, bo selektory katalogów i WYCENA używają tych metod jako publicznego kontraktu.
- `catalogSelectors` ma fallback do `getPriceList(kind)`, żeby przyszły split store nie zerował katalogów w kalkulatorach.
- Sekcja `Robocizna — szafki` w WYCENIE zależy od `catalogSelectors.getQuoteRates()`; test smoke ma pilnować, że definicje `labor_body_*` i `labor_rate_*` są widoczne.
- WYWIAD pokazuje zapisane `cabinet.laborItems` przez `js/tabs/wywiad-labor-summary.js`; nie dokładać tej logiki bezpośrednio do `wywiad.js` poza cienkim wywołaniem renderu.

## Pricing labor native controls v1 — 2026-05-03

- Formularz robocizny w `Stawki wyceny mebli` nie może używać natywnych/systemowych selectów na mobile. Pola wyboru robocizny mają być montowane przez aplikacyjny launcher `investorChoice` / `rozrysChoice`.
- Dotyczy szczególnie pól: użycie, automat, stawka, czas bazowy, tryb ilości, start h, dodaj h i gabarytoczas.
- Przełączniki robocizny typu `Aktywna` i `Szczegóły tylko wewnętrzne` mają używać wzorca checkbox-chip aplikacji, nie gołych systemowych kontrolek.
- `tools/app-dev-smoke.js` ma kontrakt chroniący przed cofnięciem tego formularza do natywnych pickerów.
- Zmiana jest UI-only: nie zmienia modelu danych, WYCENY, PDF klienta ani snapshotów robocizny.

## Plan docelowy — harmonogram i statusy procesowe

- Harmonogram ma filtrować zadania po statusach procesowych, a nie po samym istnieniu wyceny wstępnej.
- `Pomiar` oznacza: trzeba umówić albo wykonać pomiar. Może wynikać z zaakceptowanej wyceny wstępnej albo z ręcznej decyzji bez wyceny wstępnej.
- `Wycena` po pomiarze oznacza: trzeba przygotować wycenę końcową. Ten stan jest legalny także dla pomieszczenia bez wyceny wstępnej, np. gdy pokój doszedł przy okazji pomiaru.
- Pomieszczenie bez szafek może mieć status `Pomiar/Wycena` i trafić do przyszłego harmonogramu, ale w kalkulacji WYCENY pozostaje zablokowane jako `Brak szafek`, dopóki nie ma elementów do policzenia.
- Zaakceptowana wspólna wycena wstępna pozostaje jednym dokumentem z zakresem wielu pokoi; harmonogram ma widzieć pokoje z tego zakresu bez duplikowania oferty per pokój.
- Moduł `js/app/project/project-schedule-status.js` jest read-only boundary pod przyszły harmonogram. Nie zapisuje danych i nie wprowadza nowego storage; zwraca kolejki `measurement` oraz `finalQuote`.
- Przy budowie właściwego kalendarza/harmonogramu najpierw użyć `FC.projectScheduleStatus.buildAllBuckets()` / `buildInvestorBuckets()`, zamiast ponownie interpretować statusy w UI.

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

## App core namespace split v1 — 2026-05-02

- `js/app.js` został odchudzony z ok. 590 do ok. 464 linii przez wydzielenie bootstrapu `FC`/storage/project fallback do `js/app/bootstrap/app-core-namespace.js`.
- Nowy moduł jest cienkim boundary startowym: korzysta z istniejących `constants`, `storage`, `schema`, `project-bridge`, a fallbacki trzyma tylko jako awaryjną kompatybilność.
- Nie zmieniono UI, RYSUNKU, statusów, backupów ani formatu danych.
- Load order: `app-core-namespace.js` musi być ładowany przed `js/app.js` w `index.html`; kontrakt pilnuje `check-index-load-groups` i `app-dev-smoke`.
- Dalsze odchudzanie `app.js` robić tylko przez konkretne ścieżki shellu/runtime. Nie przenosić domeny do app shell ani nie tworzyć nowego monolitu bootstrapowego.


## App legacy bridges split v1 — 2026-05-02

- `js/app.js` został odchudzony z ok. 464 do ok. 354 linii przez wydzielenie globalnych delegatorów cabinet/material/price do `js/app/bootstrap/app-legacy-bridges.js`.
- Nowy moduł zachowuje stare nazwy funkcji w globalnym kontrakcie klasycznych skryptów, ale sam nie zawiera logiki domenowej; deleguje do właściwych modułów `FC.*`.
- Load order: `app-legacy-bridges.js` musi być ładowany po `js/app.js` i przed modułami/wywołaniami, które korzystają z legacy funkcji. `dev_tests.html`, `index.html`, `tools/index-load-groups.js` i `app-dev-smoke` mają kontrakt obecności `FC.appLegacyBridges`.
- Nie zmieniono UI, RYSUNKU, statusów/ofert, backupów ani formatu danych. Nie dodano nowego storage.
- Dalsze cięcie `app.js` robić tylko po wskazaniu kolejnej jasnej odpowiedzialności. Nie rozbijać runtime startu ani render shellu na siłę.

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
- `js/app.js` — nadal plik ostrzegawczy app shell, ale bootstrap core namespace jest w `js/app/bootstrap/app-core-namespace.js`, a globalne delegatory cabinet/material/price są w `js/app/bootstrap/app-legacy-bridges.js`. Nowe funkcje kierować do modułów domenowych, nie do `app.js`; nie dublować fallbacków storage/project ani legacy bridge w shellu.
- `js/app/rozrys/rozrys.js` — duży, ale lepiej zabezpieczony testami. Nie dopisywać tam logiki, jeśli pasuje do istniejących modułów ROZRYS.
- `js/tabs/wycena.js` — nadal główny kandydat Wyceny do małych splitów; miesza zakładkę, snapshoty, statusy i delegatory. Ciąć tylko ścieżka po ścieżce po testach.
- `js/app/wycena/wycena-tab-selection.js` — po splicie selection v1 jest tylko fasadą; logika wyboru zakresu jest w modułach `wycena-tab-selection-scope/version/model/pickers/render`. Nie dokładać nowych funkcji do fasady.
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
  - `dev-tests-page.js` — cienki kontroler ekranu, przełączania sekcji i spinania progresu,
  - `dev-tests-progress.js` — licznik postępu testów `x/y` oraz aktualnie wykonywany test/sekcja.

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

## 2026-05-01 — dev tests progress live v2

- Licznik postępu w `dev_tests.html` musi oddawać sterowanie przeglądarce między testami; samo ustawianie DOM nie wystarcza, bo synchroniczne testy blokują paint do końca przebiegu.
- Wspólny `FC.testHarness.runSuite()` emituje progress i wykonuje `yieldToBrowser()` między krokami.
- Ręczne runnery testów, które nie używają `runSuite` (np. ROZRYS), muszą korzystać z tego samego helpera, żeby nie wrócił licznik widoczny dopiero na końcu.


## 2026-05-01 — Quote scope entry boundary v1

- Rozdzielono `js/app/quote/quote-scope-entry.js`, który mieszał scope, modal UI, nazewnictwo wersji, flow snapshotu i przejście do Wyceny.
- Nowy load order: `quote-scope-entry-utils.js` → `quote-scope-entry-scope.js` → `quote-scope-entry-modal.js` → `quote-scope-entry-flow.js` → `quote-scope-entry.js`.
- Publiczne API `FC.quoteScopeEntry` pozostaje fasadą kompatybilną dla zakładki WYCENA i testów; nie przenosić modal UI ani create/open snapshot flow z powrotem do tej fasady.
- Przy dalszych zmianach ofert/scope kierować kod do właściwej warstwy: scope/nazwy do `quote-scope-entry-scope.js`, modale do `quote-scope-entry-modal.js`, orkiestrację snapshotu/statusu do `quote-scope-entry-flow.js`.
- Raport: `tools/reports/quote-scope-entry-boundary-v1.md`.

## 2026-05-01 — Preliminary measure final-wait v1

- Status `Pomiar → Wycena` oznacza po pomiarze etap oczekiwania na wycenę końcową, a nie odrzucenie zaakceptowanej wyceny wstępnej.
- `quote-snapshot-selection.js` nie może przy statusie `wycena` automatycznie odpinać/odrzucać zaakceptowanej wyceny wstępnej, jeśli nie ma zaakceptowanej oferty końcowej w tym scope.
- Rekonsyliacja statusu ma zachować `wycena` jako świadomy etap po pomiarze; nie cofać automatycznie na `pomiar` tylko dlatego, że zaakceptowana wstępna oferta nadal jest w historii.
- Testy regresyjne: `core-offer-workflow.js` i `investor-integration.js` pilnują, że zaakceptowana wstępna oferta pozostaje zaakceptowana i nieodrzucona po ręcznej zmianie `Pomiar → Wycena`.
- Raport: `tools/reports/preliminary-measure-final-wait-v1.md`.

## 2026-05-02 — Wycena selection split v1

- Rozdzielono `js/app/wycena/wycena-tab-selection.js` bez zmiany UI i bez zmiany modelu danych.
- Nowy układ: `wycena-tab-selection-scope.js`, `wycena-tab-selection-version.js`, `wycena-tab-selection-model.js`, `wycena-tab-selection-pickers.js`, `wycena-tab-selection-render.js`, a `wycena-tab-selection.js` zostaje cienką fasadą publicznego API.
- Przy dalszych zmianach zakresu Wyceny kierować logikę do właściwej warstwy: scope/summary, version/nazwy snapshotów, pickery albo render. Nie sklejać ich ponownie w jednym pliku.
- RYSUNEK nie był ruszany; `js/tabs/wycena.js` pozostaje następnym kandydatem, ale tylko dla małych, konkretnych ścieżek.


## 2026-05-02 — Wycena tab boundary v1

- Kontynuowano optymalizację `js/tabs/wycena.js` bez zmiany UI, storage, statusów i polityki backupów.
- `tabs/wycena.js` jest teraz cienkim rejestrem zakładki i spadł z ok. 589 do ok. 347 linii.
- Nowe warstwy: `wycena-tab-data.js`, `wycena-tab-state.js`, `wycena-tab-selection-bridge.js`, `wycena-tab-editor-bridge.js`, `wycena-tab-status-controller.js`, `wycena-tab-render-bridge.js`.
- Nie dokładać danych, runtime state, adapterów selection/editor/status/render z powrotem do `tabs/wycena.js`; kolejne zmiany kierować do właściwej warstwy.
- Krytyczna kolejność ładowania: nowe moduły boundary po `wycena-tab-dom.js`, przed modułami selection/editor/history/status/render oraz przed `js/tabs/wycena.js`; utrzymywać ją w `index.html`, `dev_tests.html`, `tools/index-load-groups.js` i `tools/app-dev-smoke-lib/file-list.js`.
- App smoke ma kontrakt `Zakładka Wyceny ma rozdzielone boundary warstwy`; nie usuwać go przy dalszych splitach Wyceny.
- Raport: `tools/reports/wycena-tab-boundary-v1.md`.

## 2026-05-02 — Multi-room preliminary status guard v1

- Poprawiono guard ręcznej zmiany statusu w Inwestorze: pokój objęty wspólną zaakceptowaną wyceną wstępną ma być traktowany tak samo jak pokój z zaakceptowaną wyceną solo dla przejść `Pomiar` i `Wycena`.
- Nie wracać do wymogu wyłącznie exact-scope/solo przy `projectStatusManualGuard`; dla wyboru statusu pojedynczego pokoju trzeba brać pod uwagę również snapshoty, których scope zawiera ten pokój.
- Niezaakceptowana wspólna wycena wstępna dalej blokuje `Pomiar`/`Wycena`, ale jako „wycena niezaakceptowana”, a nie jako „brak wyceny”.
- Runtime bez nowego storage i bez zmiany UI; zmiana dotyczy wyłącznie interpretacji istniejących snapshotów scope.
- `project-status-manual-guard.js` jest powyżej progu ostrożności, ale w tej paczce został celowo zostawiony jako jeden guard statusowy — split tylko dla kilku linii poprawki byłby sztuczny. Jeśli będzie dalej rosnąć lub zacznie mieszać więcej flow generowania/statusów, wtedy ciąć po odpowiedzialnościach.



## 2026-05-02 — Status / quote scope v1

Zakres naprawczy po zgłoszeniu rozjazdu statusów i wyboru pomieszczeń do Wyceny:

- `Wstępna wycena` nie jest już ręcznym statusem wybieranym z poziomu `Inwestora`; powstaje przez realną ofertę w dziale `WYCENA`.
- Ręczne przejście na `Pomiar` albo `Wycena` jest dozwolone także bez wyceny wstępnej, bo w realnym procesie pomiar/wycena końcowa mogą dotyczyć pomieszczeń dodanych na miejscu.
- Jeśli zaakceptowana wycena wstępna obejmuje kilka pomieszczeń, manualna zmiana na `Pomiar/Wycena` ma respektować scope tej zaakceptowanej oferty. Przy wielu możliwych zakresach decyzja idzie przez aplikacyjny modal, nie przez systemowy dialog.
- `WYCENA` filtruje pomieszczenia bez szafek z kalkulacji: w pickerze są widoczne, wyszarzone i opisane jako `Brak szafek`, ale nie można ich zaznaczyć do oferty.
- Nowe moduły: `js/app/project/project-status-scope-decision.js` i `js/app/wycena/wycena-room-availability.js`.
- `project-status-manual-guard.js` ma ok. 384 linie i zostaje tymczasowo jako spójny guard procesowy; nie ciąć go przy okazji bez osobnego kontraktu dla decyzji status/scope.
- `rozrys-pickers.js` jest powyżej 400 linii, ale zmiana ogranicza się do opcjonalnego stanu disabled dla pickerów; dalszy split wspólnego pickera robić tylko, jeśli ruszamy szerzej mechanikę wyboru, żeby nie ryzykować regresji ROZRYS.
- Testowy fixture Wyceny czyści cache `roomRegistry` i tymczasowo odcina `fc_edit_session_v1`, żeby testy pustych/zmienianych zakresów nie odzyskiwały pokojów z poprzedniego kontekstu.
- Raport paczki: `tools/reports/status-quote-scope-v1.md`.

## 2026-05-02 — Manual status preserve v1

- Ręczne statusy `Pomiar/Wycena` ustawiane z `Inwestora` muszą zachowywać istniejące ręczne statusy pozostałych pomieszczeń, gdy dla tych pozostałych pokoi nie ma żadnej oferty/snapshotu.
- Fallback `nowy` z historii ofert nie może nadpisywać nietkniętego pokoju tylko dlatego, że pokój nie ma własnej wyceny.
- To dotyczy manualnego przepływu w `Inwestorze`; rekonsyliacja po usunięciu albo zmianie zaakceptowanego zakresu oferty nadal może cofać pokoje zdjęte z zakresu, bo to wynika z historii ofert.
- Kontrakt regresyjny jest w `js/testing/wycena/suites/investor-integration.js`: A z zaakceptowaną wstępną ofertą zostaje `Pomiar`, a ręczne ustawianie S/P na `Wycena` nie resetuje innych pokoi.


## 2026-05-02 — Schedule status prep v1

- Dodano read-only boundary `js/app/project/project-schedule-status.js` pod przyszły harmonogram.
- `Pomiar` trafia do kolejki `measurement`, a `Wycena` do kolejki `finalQuote`; oba stany mogą istnieć bez wyceny wstępnej.
- Harmonogram ma później filtrować statusy procesowe, nie samą historię ofert.
- Pomieszczenia bez szafek mogą czekać na wycenę końcową, ale boundary zwraca `quoteBlockedReason: Brak szafek`, żeby przyszły widok nie udawał, że da się je już policzyć.
- Nie dodano UI kalendarza, nowego storage ani migracji danych.
- Raport: `tools/reports/schedule-status-prep-v1.md`.


## 2026-05-02 — status reconcile v1

- Naprawiono rekonsyliację statusów po akceptacji oferty: akcja na ofercie może zmieniać tylko pokoje z zakresu tej oferty, a pokoje spoza zakresu zachowują ręczne statusy `Pomiar/Wycena`.
- Brak wyceny/snapshotu dla pokoju nie oznacza resetu do `Nowy`; reset/rekomendacja może dotyczyć tylko pokoju świadomie wypiętego z poprzednio zaakceptowanego zakresu oferty.
- Akceptacja wyceny wstępnej nie cofa pokoju, który jest już dalej w procesie, np. `Wycena` nie wraca do `Pomiar`; akceptacja końcowej nie cofa `Umowa/Produkcja/Montaż` do `Zaakceptowany`.
- Przy zaakceptowanej wspólnej wycenie wstępnej zmiana statusu jednego pokoju na `Pomiar/Wycena` ma pokazać modal decyzyjny: tylko kliknięty pokój albo cały zaakceptowany zakres. Gdy istnieje oferta solo i wspólna dla tego samego pokoju, również wymagana jest decyzja zakresu.
- Testy regresyjne dla tych kombinacji są w `js/testing/wycena/suites/status-reconciliation-regression.js`; nie usuwać ich przy dalszych porządkach statusów.
- Pełny raport paczki: `tools/reports/status-reconcile-v1.md`.


## 2026-05-02 — Status reconcile fix: wstępna zastępuje końcową

- Krytyczna reguła statusów ofert: zaakceptowana wycena wstępna ustawia swój zakres na `Pomiar`, a zaakceptowana końcowa oferta ustawia swój zakres na `Zaakceptowany`. Nie rozpoznawać statusu wyłącznie po `selectedByClient`.
- Jeżeli nowa zaakceptowana wycena wstępna zastępuje/odrzuca wcześniejszą zaakceptowaną końcową ofertę w tym samym pokrywającym się zakresie, pokoje z tej wcześniejszej końcowej oferty nie mogą zostać wizualnie na `Zaakceptowany`; dla statusu wynikającego z odrzuconej końcowej oferty wracają do `Pomiar`.
- Nadal obowiązuje ochrona ręcznego postępu: pokój ręcznie ustawiony na `Wycena` bez wcześniejszej odrzuconej końcowej oferty nie jest cofany do `Pomiar` tylko dlatego, że znalazł się w zakresie zaakceptowanej wyceny wstępnej.
- Pokoje spoza zakresu akceptowanej oferty zachowują swoje ręczne statusy (`Pomiar`, `Wycena` itd.); brak oferty dla pokoju nigdy nie jest powodem do resetu na `Nowy`.
- Testy regresyjne dla tej decyzji są w `js/testing/wycena/suites/status-reconciliation-regression.js`; przed zmianami w `project-status-snapshot-flow.js` albo `project-status-sync.js` uruchamiać pełne `FC.wycenaDevTests.runAll()` oraz standardowe audyty.
- Raport paczki: `tools/reports/prelim-replace-final-status-v1.md`.


## 2026-05-02 — Manual status restore v1

- Doprecyzowano zasadę statusów po rozpięciu/zastąpieniu wspólnej zaakceptowanej oferty: pokój, który wypada ze wspólnego zakresu, ma wracać do ostatniego ręcznego statusu (`lastManualProjectStatus`), a nie automatycznie do `Nowy`.
- Ręczne zmiany statusu w `Inwestorze` zapisują teraz bazę procesu pokoju jako `lastManualProjectStatus`. Oferta/snapshot może tymczasowo przykryć status pokoju, ale nie usuwa ręcznego punktu odniesienia.
- Przy akceptacji nowej oferty `project-status-snapshot-flow.js` zapamiętuje bazowy ręczny status pokoju przed przykryciem go statusem wynikającym z oferty, także dla istniejących danych legacy bez wcześniejszego `lastManualProjectStatus`, jeśli pokój nie miał aktywnej zaakceptowanej oferty albo był ręcznie przesunięty dalej niż status wynikający z oferty.
- Po zwolnieniu pokoju ze starego zaakceptowanego zakresu `reconcileProjectStatuses()` używa ręcznego fallbacku tylko wtedy, gdy historia ofert nie daje aktywnego statusu dla tego pokoju. Brak aktywnej oferty nie oznacza już resetu do `Nowy`.
- Dalsze etapy po zaakceptowanej końcowej ofercie (`Umowa`, `Produkcja`, `Montaż`, `Zakończone`) pozostają prowadzone pojedynczo per pomieszczenie; nie dodano modala grupowego dla tych etapów.
- Testy regresyjne dla tej zasady są w `js/testing/wycena/suites/status-reconciliation-regression.js`: rozpięcie wspólnej końcowej i wspólnej wstępnej ma przywracać ręczny status pokoju spoza nowego zakresu.


## 2026-05-02 — Investor UI split v1

- Rozdzielono `js/app/investor/investor-ui.js` bez zmiany UI, storage, RYSUNKU ani semantyki statusów/ofert.
- Nowy `js/app/investor/investor-ui-render.js` trzyma HTML listy/karty inwestora, opcje typów/źródeł i opcje statusów projektu używane przez render.
- Nowy `js/app/investor/investor-ui-status-flow.js` trzyma przepływ zmiany statusu pokoju z Inwestora: walidację guardem, modal generowania oferty, decyzję scope i zapis przez `investorPersistence`.
- `js/app/investor/investor-ui.js` zostaje shellem/binderem ekranu: wybór list/detail, transient investor, wiązanie pól i delegacja do nowych modułów. Nie dokładać tam ponownie renderu HTML ani logiki status/scope.
- Utrzymywać kolejność ładowania: `investor-rooms.js` → `investor-ui-render.js` → `investor-ui-status-flow.js` → `investor-ui.js` w `index.html`, `dev_tests.html`, `tools/index-load-groups.js` i `tools/app-dev-smoke-lib/file-list.js`.
- App smoke ma kontrakt `Investor UI ma wydzielony render i status flow`; nie usuwać go przy dalszych splitach Inwestora.
- Raport: `tools/reports/investor-ui-split-v1.md`.


## 2026-05-03 — Optimization checkpoint v1

- Wykonano checkpoint optymalizacji po splitach `app.js` i `investor-ui.js`; nie cięto dalej runtime shellu, bo kolejne granice w `app.js` dotykają startu/walidacji/runtime i byłyby zbyt ryzykowne bez konkretnej potrzeby funkcjonalnej.
- Rozdzielono monolit testów Inwestora: `js/testing/investor/tests.js` jest teraz cienkim agregatorem, a właściwe testy są w `js/testing/investor/suites/*` z helperami w `js/testing/investor/helpers.js`.
- Testy recovery Inwestora czyszczą i przywracają `fc_edit_session_v1` lokalnie w fixture, żeby nie mieszać snapshotów sesji edycji z testami odzysku z projektów/snapshotów ofert.
- Nie zmieniono UI, runtime danych, statusów/ofert, RYSUNKU ani polityki backupów.
- Raport checkpointu: `tools/reports/optimization-checkpoint-v1.md`.


## 2026-05-03 — Pricing labor rules v1

- Wprowadzono pierwszy etap modelu robocizny/czynności bez ruszania RYSUNKU, materiałów i okuć.
- `Stawki wyceny mebli` są teraz miejscem edycji definicji robocizny: stawki godzinowe, skręcanie korpusów, elementy szafki i usługi przy szafce.
- Nowy model obsługuje opcjonalne składniki: blok czasu `0,25/0,5/1 h`, ilość liniową, progi/pakiety, start + kolejne sztuki, dopłatę gabarytową `PLN/m³`, gabarytoczas, kwotę stałą, mnożnik i zakres wysokości.
- Nowe moduły katalogu robocizny: `js/app/pricing/labor-catalog-definitions.js` oraz `js/app/pricing/labor-catalog.js`. Trzymać je w tej kolejności ładowania.
- Nowy moduł `js/app/wycena/wycena-core-labor.js` zbiera wewnętrzne koszty robocizny po szafkach i używa numerów szafek zgodnych z kolejnością z `WYWIADU`.
- Podgląd `WYCENA` pokazuje sekcję `Robocizna — szafki` z rozwijanymi szczegółami dla każdej szafki. To jest widok wewnętrzny; PDF/klient nie dostał szczegółowego renderu `lines.labor`.
- W modalu szafki dodano sekcję `Dodatki robocizny`, obsługiwaną przez `js/app/cabinet/cabinet-modal-labor.js`; wybiera aktywne definicje z `usage: cabinet` i `autoRole: none` oraz zapisuje je jako `laborItems` przy konkretnej szafce.
- Ręczne stawki oferty filtrują definicje automatyczne/wewnętrzne (`autoRole !== none`, `usage !== manual`, `internalOnly === true`), żeby reguły korpusów/gabarytu nie trafiały jako pozycje klienta.
- Snapshot oferty ma wersję 6 i zapisuje `lines.labor`; nie usuwać tego pola przy dalszych zmianach WYCENY.
- Raport: `tools/reports/pricing-labor-rules-v1.md`.


## 2026-05-03 — Pricing labor test fix v1

- Naprawiono test materiałów `preferStoredSplit` po dodaniu domyślnych definicji robocizny do `quoteRates`.
- Zachowanie runtime pozostaje bez zmian: zapisane rozdzielone listy materiałów/akcesoriów/stawek są zachowywane, stare legacy `services` nie są wskrzeszane, a nowe domyślne definicje robocizny mogą zostać dołączone jako migracja katalogu.
- Test nie może już zakładać, że `quoteRates` ma dokładnie jeden zapisany wpis, bo po `pricing_labor_rules_v1` katalog robocizny wymaga seedów godzinowych i definicji korpusów/dodatków.
- Zmieniono tylko fixture/test i cache-busting `dev_tests.html`; UI, WYCENA, RYSUNEK, statusy, storage runtime i PDF klienta nie były ruszane.

## 2026-05-03 — Pricing labor unified picker v1

- Ujednolicono robociznę/czynności do jednej wspólnej puli definicji. Pole `usage` zostaje tylko kompatybilnościowym fallbackiem danych i nie może już być traktowane jako twardy podział `ręcznie` vs `szafka`.
- W formularzu pozycji `Stawki wyceny mebli` ukryto wybór `Użycie`; nowe definicje robocizny zapisują się jako `universal`. O tym, gdzie da się ich użyć, decydują kontekst, `autoRole`, aktywność i wybór użytkownika, a nie osobna kategoria ręczne/szafka.
- W `WYCENA` usunięto długą listę pól ilości dla ręcznych stawek. Ręczne/dodatkowe czynności dodaje się teraz przez aplikacyjne okno `Dodaj czynność`, obsługiwane przez `js/app/wycena/wycena-labor-picker.js`.
- Szafki AGD/okapowe korzystają z `js/app/pricing/labor-appliance-rules.js`: typ szafki może domyślnie proponować montaż sprzętu, ale w modalu szafki musi istnieć wybór `Z montażem` / `Bez montażu`. `Bez montażu` blokuje automatyczne doliczenie tej pozycji w WYCENIE.
- `WYWIAD` pokazuje przy szafce zarówno wybrane czynności robocizny, jak i status montażu sprzętu, żeby nie było ukrytych automatycznych dopłat.
- Nie wracać do natywnych selectów/systemowych pickerów w tym obszarze; `app-dev-smoke` pilnuje aplikacyjnych launcherów w formularzu robocizny i pickera czynności WYCENY.
- `js/app/wycena/wycena-tab-editor.js` ma ok. 285 linii po zmianie. To przekracza próg ostrożności 250, ale po wydzieleniu pickera pozostaje jednym edytorem ustawień oferty; dalszy split robić dopiero przy kolejnej pracy w tym konkretnym pliku, najlepiej przez wydzielenie renderu wybranych czynności albo formularza warunków oferty.
- Raport: `tools/reports/pricing-labor-unified-picker-v1.md`.

## Pricing labor manual accordion v1 — 2026-05-03

- Ręczne czynności dodawane w WYCENIE mają być osobnym akordeonem nad `Ustawienia oferty do nowej wyceny`, nie częścią opcji oferty.
- Moduł `js/app/wycena/wycena-tab-manual-labor.js` jest właścicielem tego akordeonu; nie dokładać ręcznego pickera robocizny z powrotem do `wycena-tab-editor.js`.
- `quote-labor-picker` musi jawnie ustawiać `display:flex`, bo bazowa klasa `.modal-back` ma `display:none`.
- `tools/app-dev-smoke.js` ma kontrakt pilnujący osobnego akordeonu ręcznych czynności.

## Czynności labor workspace v1 — 2026-05-03

- Zakładka `CZYNNOŚCI` jest od teraz miejscem pracy z robocizną: ręczne dodawanie czynności, podgląd czynności szafek i szczegóły kosztów wewnętrznych.
- Nie dodawać ponownie list/pickerów robocizny do `Ustawienia oferty do nowej wyceny`; WYCENA ma zostać od zakresu/oferty/generowania, a CZYNNOŚCI od robocizny.
- WYCENA może pokazywać tylko informację/podsumowanie, że szczegóły robocizny są w `CZYNNOŚCI`; szczegółowe rozbicie szafek, AGD i ręcznych czynności należy rozwijać w `js/tabs/czynnosci.js` albo w małych modułach tej zakładki.
- `js/tabs/czynnosci.js` korzysta z istniejącego draftu oferty `quoteOfferStore.rateSelections`, więc ręcznie dodane czynności dalej wpływają na następną WYCENĘ, ale edycja jest w osobnej zakładce.

## Czynności labor calc help v1 — 2026-05-04

- Formularz `Stawki wyceny mebli` ma wydzielony moduł `js/app/material/price-modal-field-help.js` dla aplikacyjnych launcherów pól i objaśnień `?`; nie dokładać tej logiki z powrotem do `price-modal-item-form.js`.
- Pole `Kategoria` w formularzu cennika ma być aplikacyjnym launcherem wyboru, tak jak pozostałe pola wyboru, i musi pozostać widoczne po dodaniu objaśnień `?`.
- Podgląd czynności szafek w zakładce `CZYNNOŚCI` ma pokazywać czytelny rozpis kalkulacji: czas bazowy/pakiet, stawkę, mnożnik, robociznę czasową, gabaryt, dopłatę gabarytową, kwotę stałą i razem. Nie wracać do zwartego tekstu typu `1.15 h • 120 PLN/h • mnożnik ×1.15`, bo jest mylący.


## 2026-05-04 — robocizna: gabaryt i kompaktowa rozpiska

- W regułach robocizny gabaryt nie może być liczony nieświadomie podwójnie: gdy `gabarytoczas` dolicza czas, dopłata `PLN/m³` jest ignorowana/zerowana dla tej reguły.
- W podglądzie `CZYNNOŚCI` rozpiska składników ma pozostać kompaktowa: ma pokazywać czas bazowy, gabarytoczas, stawkę, mnożnik, robociznę czasową, ewentualną dopłatę gabarytową i razem, ale bez dużej typografii rozciągającej kartę.
- Formularz cennika robocizny może mieć pola zaawansowane, ale musi prowadzić użytkownika: `Gabaryt zł/m³` i `Gabarytoczas` nie mają działać równolegle bez świadomego trybu zaawansowanego.

## Hardware catalog model v1 — 2026-05-04

- `Akcesoria` zostały przygotowane jako katalog okuć/akcesoriów, ale bez automatyki szafek w tym etapie.
- Model okuć jest w `js/app/catalog/hardware-catalog.js`; trzyma producentów, kategorie, jednostki, statusy i normalizację pól handlowych.
- `catalogStore` zapisuje listę producentów okuć przez istniejące store/repository boundary (`hardwareManufacturers`) oraz normalizuje akcesoria z polami: `hardwareCategory`, `hardwareUnit`, `series`, `purchasePrice`, `markupPercent`, `priceSource`, `priceUpdatedAt`, `status`, `note`.
- Formularz akcesoriów jest podzielony: `price-modal-hardware-form.js` obsługuje pola okuć, `price-modal-hardware-manufacturers.js` obsługuje panel producentów. Nie dokładać tej logiki do `price-modal-item-form.js`.
- Ten etap nie podpina okuć do szafek, `MATERIAŁ`, `WYCENA` ani PDF. Następne etapy: seed realnych okuć, standardy okuć w WYWIADZIE, wybór przy szafce, rozbicie w MATERIAŁ i snapshot WYCENY.
- Producenci usunięci z listy mogą nadal pojawić się w filtrach, jeśli istnieją pozycje katalogu używające tej nazwy — to jest celowe, aby nie osierocić istniejących danych.


## Boot start wait fix v1 — 2026-05-04

- `js/boot.js` ma czekać bezpieczniej na funkcję startową po świeżym wdrożeniu/cache-miss. Nie wracać do krótkiego limitu `tries > 60`, bo na mobile może fałszywie pokazać `Nie znaleziono funkcji startowej`, a po odświeżeniu działać.
- Boot raportuje brak init dopiero po dłuższym limicie czasu i po `window.load`/grace period; cache-busting `boot.js` musi być podbijany przy zmianach startu.
- `tools/app-dev-smoke.js` ma statyczny kontrakt chroniący `boot-clean-1.5` przed cofnięciem do krótkiego startu.

## Hardware supplier pricing v1 — 2026-05-04

- Katalog okuć ma rozdzielać koszt firmy od ceny do wyceny klienta. Model trzyma: cenę katalogową netto/brutto, rabat dostawcy, realny zakup po rabacie, bazę ceny do wyceny, narzut/cenę ręczną oraz marżę informacyjną.
- Domyślny dostawca, VAT, narzut i baza ceny okuć są ustawieniami katalogu (`hardwareSettings`), a dostawcy są osobnym słownikiem (`hardwareSuppliers`). Nie duplikować tego w projektach ani szafkach.
- Zmiana dostawcy w okuciu ma podstawiać rabat i VAT dostawcy, ale pojedyncze okucie może mieć własne wartości.
- Toolbar katalogu `Akcesoria` ma osobne aplikacyjne okna: `Filtry`, `Sortuj`, `Producenci`, `Dostawcy`, `Ustawienia`; nie wracać do długich inline filtrów na ekranie głównym.
- Przyszłe raporty rentowności mają korzystać z zamrożonej ceny dla klienta oraz realnego kosztu zakupu firmy. Nie pokazywać tych wewnętrznych kosztów klientowi.
- `catalog-store.js` jest teraz przy progu ostrzeżenia 400+ linii. Nie rozbudowywać go dalej przy kolejnym etapie okuć; następna większa zmiana store powinna wydzielić część hardware settings/suppliers do osobnego modułu/adaptora.


## Hardware form price wrapper fix v1 — 2026-05-04

- Po rozbudowie katalogu okuć formularz akcesoriów nadal musi mieć bezpieczny wrapper starego pola `formPrice`, bo widok ukrywa je dla okuć i używa rozbudowanych pól cenowych netto/brutto/rabat/narzut.
- Smoke test `Formularz okuć ma wrapper ceny prostej bez błędu startu` ma pilnować, żeby otwarcie `Dodaj okucie` nie wróciło do `ReferenceError: formPriceWrapper is not defined`.



## Hardware catalog seed v1 — 2026-05-07

- Realne startowe pozycje katalogu okuć są rozdzielone na `js/app/catalog/hardware-catalog-seed-data.js` (lista danych) i `js/app/catalog/hardware-catalog-seeds.js` (merge), a nie dopisane bezpośrednio do `catalog-store.js`.
- Seed dodaje konkretne pozycje Blum/GTV/Peka/Nomet/Rejs po stabilnym `id`; jeśli użytkownik ma już pozycję o tym samym `id` albo tej samej kombinacji producent+symbol+nazwa, seed nie duplikuje jej i nie nadpisuje ręcznej edycji.
- Jedyny automatycznie usuwany wpis to dokładny stary placeholder `a1 / Blum / B1 / Zawias Blum` bez źródła i notatki. Nie rozszerzać tego na kasowanie innych danych użytkownika.
- Ceny seedów są cenami startowymi z dnia `2026-05-07`; przed realną ofertą użytkownik ma nadal sprawdzić aktualność, wariant, rabat i dostawcę.
- `catalog-store.js` korzysta z seedów przez boundary `FC.hardwareCatalogSeeds.mergeAccessorySeeds()`. Przy następnych etapach okuć nie rozbudowywać store o kolejne duże listy danych; dane trzymać w osobnych modułach, a store zostawić jako cienkie podłączenie.
- Smoke test `Katalog okuć ma realne seedy Blum/GTV/Peka/Nomet/Rejs` pilnuje, że seed nie wraca do sztucznego placeholdera i że podstawowe ceny/daty seedów nie są zerowane.

## Hardware bundle inputs v1 — 2026-05-05

- Katalog okuć obsługuje teraz zestawy/komplety jako pozycje z opcjonalnym składem z istniejących pozycji katalogu.
- Zestaw ma dwa tryby kosztu zakupu: `Własna cena zestawu` oraz `Licz ze składników`. Nie zakładać, że suma elementów zawsze jest ceną zestawu — gotowy komplet u dostawcy może być tańszy niż elementy osobno.
- Przy polach cenowych netto/brutto formularz musi pozwalać na całkowite wyczyszczenie wartości podczas wpisywania na mobile; nie wolno natychmiast odtwarzać cyfr z pola powiązanego w trakcie kasowania.
- `Data ceny` dla nowego okucia domyślnie przyjmuje dzisiejszą datę lokalną, ale przy edycji istniejącej pozycji nie może być automatycznie nadpisywana.
- Skład zestawu nie może pozwalać na bezpośrednie dodanie pozycji samej do siebie; przyszłe głębsze zestawy wymagają dodatkowego zabezpieczenia przed cyklami.

## Hardware import/export v1 — 2026-05-07

- Katalog okuć ma aplikacyjny panel `Import / Eksport` w toolbarze `Akcesoria`.
- `js/app/shared/xlsx-lite.js` jest minimalnym shared utility do prostego XLSX; nie jest store ani logiką domenową.
- `js/app/catalog/hardware-catalog-import-export.js` jest boundary katalogu okuć dla JSON/XLSX: buduje snapshot, plan importu, waliduje dane i zapisuje wyłącznie przez `catalogStore`. Nie dopisywać importu bezpośrednio do `price-modal-*` ani do `catalog-store.js`.
- `js/app/material/price-modal-hardware-import-export.js` odpowiada tylko za panel UI i podgląd importu.
- Excel/XLSX ma arkusze `Okucia`, `Sklad_zestawow`, `Dostawcy`, `Producenci`, `Ustawienia`. Kolumna `id` jest kotwicą techniczną: istniejące ID aktualizuje pozycję, puste ID tworzy nową pozycję `hw_user_*`, a duplikat producent+symbol+nazwa jest dopasowywany do istniejącej pozycji.
- Import ma tryb `Scal / aktualizuj` oraz świadomy tryb `Zastąp katalog`. Nie dodawać cichego kasowania danych bez osobnego potwierdzenia.
- Smoke testy `Katalog okuć ma import/eksport JSON i XLSX` oraz `Import okuć obsługuje nowe wiersze bez ID i aktualizacje po ID` pilnują tego kontraktu.
- Raport: `tools/reports/hardware-import-export-v1.md`.

## Backup storage keys v1 — 2026-05-07

- Globalny backup w Ustawieniach obejmuje dane po kluczach `fc_*`; dlatego każdy nowy storage z danymi użytkownika/katalogu/cennika/projektu/ustawień biznesowych musi dostać wersjonowaną nazwę `fc_*`.
- Dla katalogu okuć dostawcy i ustawienia są od teraz pod `fc_hardware_suppliers_v1` i `fc_hardware_settings_v1`; stare klucze `hardwareSuppliers` i `hardwareSettings` są tylko legacy źródłem migracji.
- `js/app/catalog/catalog-storage-policy.js` jest małym boundary migracji kluczy katalogu okuć. Nie dopisywać takich migracji bezpośrednio do UI importu/eksportu ani do modali.
- `catalogStore` czyta legacy klucze tylko wtedy, gdy nie ma jeszcze nowego `fc_*`, zapisuje pod `fc_*` i usuwa dokładnie stare legacy klucze po udanym zapisie nowego klucza. Nie rozszerzać tego na czyszczenie backupów.
- Smoke test `Dostawcy i ustawienia okuć używają kluczy fc_* objętych backupem` pilnuje migracji i tego, że globalny backup obejmie dostawców oraz ustawienia okuć.
- Raport: `tools/reports/backup-storage-keys-v1.md`.

## Hardware Excel template v1 — 2026-05-07

- Eksport XLSX katalogu okuć jest teraz roboczym szablonem, nie tylko surowym zrzutem danych. Arkusz `Okucia` ma formuły dla pól liczonych: netto/brutto, zakup po rabacie, cena do wyceny i podgląd marży.
- Pola wybieralne w arkuszu `Okucia` mają walidacje/listy wyboru zgodne z programem: status, producent, kategoria, jednostka, dostawca, źródło ceny, VAT, baza wyceny, sposób liczenia i tryb ceny zestawu.
- Nowe pozycje w Excelu nadal mogą mieć puste `id`; import nada im `hw_user_*`. Istniejącego `id` nie wolno ręcznie zmieniać, jeśli wiersz ma aktualizować istniejący rekord.
- Import nie ufa ślepo wynikom formuł z Excela. Przy imporcie aplikacja ponownie normalizuje i przelicza kluczowe pola przez `hardware-catalog.js`, bo LibreOffice/Google Sheets albo ręczne wklejanie mogą usunąć formuły lub wartości cache.
- `js/app/shared/xlsx-lite.js` obsługuje teraz proste formuły i data validation, ale nadal pozostaje lekkim shared utility. Jeśli kolejny etap będzie wymagał stylowania, wielu typów komórek albo większej obsługi XLSX, rozdzielić reader/writer zamiast robić z niego monolit.
- Smoke test `Eksport XLSX okuć ma formuły i listy wyboru` pilnuje formuł i walidacji w szablonie.
- Raport: `tools/reports/hardware-excel-template-v1.md`.




## Wycena core cache fix v1 — 2026-05-10

- Po etapie wielu cen dostawców użytkownik zgłosił jednorazowy błąd pierwszego odświeżenia: `Brak modułów FC.wycenaCore*` przy `wycena-core.js?v=20260503_pricing_labor_rules_v1`, a drugi refresh działał.
- Przyczyna najbardziej prawdopodobna: mieszanie starych skryptów WYCENY z nowymi po wdrożeniu przez niepodbite/stare query stringi dla całej grupy `wycena-core*`.
- Naprawa: podbijać cache-busting spójnie dla wszystkich plików `js/app/wycena/wycena-core*.js` w `index.html` oraz `dev_tests.html`, nawet jeśli zmiana funkcjonalna dotyka innego działu, gdy błąd wskazuje na mieszanie wersji po deployu.
- Nie zmieniano logiki WYCENY; to poprawka ładowania/cache, nie refaktor.

## Hardware supplier price status/types v1 — 2026-05-11

- Formularz okuć ma teraz model wielu cen dostawców z per-ceną: netto/brutto, data ceny, status ceny i dokładnie jeden wybór `Do wyceny` na okucie. Globalny widoczny `Status` okucia został usunięty z formularza; status ceny należy do konkretnego dostawcy.
- `System / seria` przeniesiono do górnej części danych okucia, a w miejscu po globalnym statusie dodano `Typ / cecha`, używany później do zamiany producentów po parze `kategoria + typ`.
- Kategorie okuć oraz typy/cechy są edytowalnymi słownikami w panelu `Słowniki`. Typ/cecha trzyma listę dozwolonych kategorii, a formularz okucia filtruje listę typów po wybranej kategorii.
- Walidacja formularza blokuje duplikat `producent + kategoria + typ/cecha`, żeby późniejsza hurtowa zamiana producenta była jednoznaczna. Ten sam typ może występować u różnych producentów.
- XLSX ma teraz arkusze `Kategorie_okuc`, `Typy_cechy` oraz `Ceny_dostawcow` ze statusem ceny. Nie wymagać od użytkownika ręcznego zarządzania ID ceny — bieżąca cena dostawcy dopasowuje się po okuciu i dostawcy.
- Filtr globalnego statusu okucia został usunięty z okna filtrów okuć. Statusy cen obsługuje UI listy/quick-filtry oparte o cenę oznaczoną `Do wyceny`.

## Hardware supplier price import fix v1 — 2026-05-11

- Baza robocza: `site_hardware_supplier_price_status_types_v1.zip`; ta paczka naprawia błędy znalezione w kontroli tej wersji, bez cofania do starszych ZIP-ów.
- `hardware-catalog.js` musi eksportować helpery słowników i statusów ceny (`typeOptions`, `uniqueTypeConflict`, `priceStatusOptions`, normalizatory kategorii/typów/statusu), bo formularz, walidacja duplikatu i Excel nie mogą opierać się na cichych fallbackach.
- Import `Ceny_dostawcow` ma akceptować jedną stronę ceny: netto albo brutto. Brakująca druga wartość jest liczona z VAT dostawcy, a błędy arkusza typu `#REF!` nie są traktowane jako cena.
- Eksport `Ceny_dostawcow` nie może generować wzajemnych formuł w pustych wierszach netto/brutto. Puste wiersze szablonu mają być realnie puste, żeby kopiowanie w telefonie/Google Sheets nie tworzyło `#REF!`.
- Status `current` z arkusza ceny dostawcy oznacza aktualną cenę i nie może masowo zmieniać listy okuć na `Do sprawdzenia`. Jeśli cena `Do wyceny` pochodzi od dostawcy, lista ma pokazywać jego nazwę jako źródło ceny, a nie techniczne `Import Excel`.
- W formularzu ceny dostawcy nie wolno ustawiać `Do wyceny` na pustym wierszu bez ceny. Taka próba ma być obsłużona aplikacyjnym komunikatem, bez systemowych dialogów.
- Modal `Słowniki` nie może robić pełnego rerenderu po każdej literze w polach tekstowych, bo na Androidzie chowa to klawiaturę. Podczas pisania aktualizować draft bez przebudowy DOM; pełny render tylko przy zmianach strukturalnych.
- Smoke test `Import XLSX cen dostawców liczy brakujące netto/brutto i zachowuje status` pilnuje scenariusza z kopiowanym wierszem MAGO/Bivert, pustą drugą ceną, statusem `current` i błędami `#REF!` w arkuszu.
- Raport: `tools/reports/hardware-supplier-price-import-fix-v1.md`.


## Hardware import bulk/diff/types fix v1 — 2026-05-11

- Baza tej paczki: `site_hardware_supplier_import_dictionary_ux_fix_v1.zip`.
- Naprawiono fałszywe podstawianie pierwszego typu/cechy w formularzu okucia: puste `typ_cecha` zostaje puste i pokazuje launcher `Wybierz typ / cechę`, a domyślne typy ze słownika są tylko opcjami, nie wybraną wartością.
- Arkusz `Ceny_dostawcow` dostał kolumnę `producent`, żeby hurtowo wklejane cenniki można było dopasowywać po `producent + symbol` bez ręcznego pilnowania `okucie_id`, `id_ceny` ani `dostawca_id`. ID nadal może być w eksporcie jako techniczna ścieżka szybka, ale nie jest wymagane dla użytkownika.
- Import cen dostawców rozróżnia teraz nowe, zmienione, bez zmian i pominięte ceny; podgląd importu nie liczy już wszystkich dopasowanych okuć jako `Aktualizowane`.
- Import cen nadal nie używa dwukierunkowych formuł Excel netto/brutto. Użytkownik może wpisać tylko netto albo tylko brutto, program liczy brakującą stronę podczas importu, a kolejny eksport pokazuje obie wartości.
- Dopasowanie ceny dostawcy działa kolejno: `okucie_id`, potem unikalne `producent + symbol`, potem ostrożne fallbacki `symbol+nazwa`, `symbol` albo `nazwa` z ostrzeżeniami przy ryzyku pomyłki.
- Nie dodano nowych kluczy storage. Dane nadal zapisuje istniejący `catalogStore` i wersjonowane klucze `fc_*`.
- `hardware-catalog-import-export.js` wzrósł do ok. 500 linii i pozostaje jawnie oznaczonym długiem. Następna większa praca nad importem/eksportem powinna zacząć się od splitu: template/export, parse/defaults oraz plan/apply.
