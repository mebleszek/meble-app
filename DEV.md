# DEV — aktywne zasady rozwoju meble-app

Ten plik jest krótką, aktualną mapą pracy. Stare wpisy historyczne zostały przeniesione do `DEV_HISTORY_20260425.md` i nie są źródłem bieżących decyzji architektonicznych.

## Aktualna baza

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_param_single_open_v1.zip`.
- Baza startowa tej paczki: `site_hardware_dictionary_param_accordions_v1.zip`.
- Po każdej paczce wydawać kompletny ZIP z pełną strukturą repo, w tym `README.md`, `DEV.md` oraz pozostałymi dokumentami.
- Przy wydaniu samodzielnie pilnować cache-bustingu zmienionych plików w `index.html`, `dev_tests.html` i narzędziach smoke/load-order.

## Workflow przed każdą paczką

1. Startować z ostatniego ZIP-a zaakceptowanego w rozmowie.
2. Przed zmianami przeczytać aktualny `DEV.md`.
3. Przy zmianach danych, storage, backupów, importu/eksportu, inwestorów, projektów, wycen, cenników albo testów danych przeczytać też `CLOUD_MIGRATION.md`. Przy zmianach backupu/storage dodatkowo przeczytać `BACKUP.md`.
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






## Hardware dictionary param single open v1 — 2026-05-23

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_param_single_open_v1.zip`.
- Baza startowa: `site_hardware_dictionary_param_accordions_v1.zip`.
- W akordeonie parametrów technicznych kategorii okuć działa teraz zasada: jeden rozwinięty parametr naraz w danej kategorii.
- Rozwinięcie kolejnego parametru automatycznie zwija poprzedni, dzięki czemu edycja słowników na telefonie nie tworzy kilku długich bloków pól naraz.
- Nowo dodany parametr nadal rozwija się automatycznie, ale pozostaje jedynym otwartym parametrem w swojej kategorii.
- Zmiana jest wyłącznie UI/UX słowników okuć: bez zmian storage, backupu, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-dictionary-param-single-open-v1.md`.

## Hardware dictionary param accordions v1 — 2026-05-23

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_param_accordions_v1.zip`.
- Baza startowa: `site_hardware_param_choice_launcher_fix_v1.zip`.
- W modalu `Słowniki okuć`, wewnątrz akordeonu kategorii parametrów technicznych, każdy parametr jest teraz osobnym mini-akordeonem z lekkim wcięciem.
- Nagłówek parametru pokazuje skrót: typ pola, sposób porównania, status `Cecha kluczowa`, `Buduje typ`, aktywność oraz liczbę dozwolonych wartości.
- Pełne pola edycji parametru są widoczne dopiero po rozwinięciu konkretnego parametru; nowo dodany parametr otwiera się automatycznie.
- Przy okazji naprawiono usuwanie parametru w tej liście tak, żeby usuwać realny rekord z kategorii, a nie kopię draftu formularza.
- Zmiana jest wyłącznie UI/UX słowników okuć: nie zmieniono storage, backupu, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-dictionary-param-accordions-v1.md`.

## Hardware param choice launcher fix v1 — 2026-05-23

- Aktualna paczka robocza po tym etapie: `site_hardware_param_choice_launcher_fix_v1.zip`.
- Baza startowa: `site_hardware_dictionary_width_fix_v1.zip`.
- Poprawiono formularz edycji okucia: tekstowe parametry techniczne z `Dozwolonymi wartościami` renderują widoczny launcher wyboru aplikacyjnego, a nie sam podgląd `Wartość: ...`.
- Dodano odporny fallback launchera bez natywnego selecta: jeśli standardowe `ctx.mountChoice` nie zamontuje przycisku, formularz korzysta bezpośrednio z `FC.rozrysChoice` i dalej otwiera aplikacyjną listę wyboru.
- Stare wartości spoza słownika nadal są czyszczone i pole pozostaje puste do wyboru ze słownika.
- Zmiana jest UI-only: bez zmian storage, backupu, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-param-choice-launcher-fix-v1.md`.


## Hardware dictionary width fix v1 — 2026-05-23

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_width_fix_v1.zip`.
- Baza startowa: `site_hardware_dictionary_full_scroll_v1.zip`.
- Poprawiono responsywną szerokość formularza parametrów technicznych w modalu `Słowniki okuć`: siatki `grid-2` i `grid-3` w panelu słowników używają `minmax(0, 1fr)`, a na mobile przechodzą w jedną kolumnę.
- Ucięte po prawej stronie pola `Klucz Excel`, `Sposób porównania`, `Dozwolone wartości` i przyciski cykliczne mieszczą się teraz w głównym scrollu modala.
- Zmiana jest wyłącznie CSS/UI; nie zmieniono danych, backupu, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-dictionary-width-fix-v1.md`.

## Hardware dictionary full modal scroll v1 — 2026-05-23

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_full_scroll_v1.zip`.
- Baza startowa: `site_hardware_param_dictionary_choices_v1.zip`.
- W modalu `Słowniki okuć` usunięto mały wewnętrzny scroll z listy parametrów technicznych kategorii. Kategorie parametrów rozwijają się teraz w głównym scrollu modala przez `panel-box-form__scroll`.
- Stopka z przyciskami `Wyjdź` / `Anuluj` / `Zapisz` korzysta ze standardowego wzorca `panel-box-form__footer`, a zawartość słowników przewija się nad nią.
- Na telefonie pola w wierszu parametru technicznego przechodzą na jedną kolumnę, żeby nie wymuszać poziomego przewijania w parametrach.
- Nie zmieniono modelu danych, backupu, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-dictionary-full-scroll-v1.md`.

## Hardware param dictionary choices v1 — 2026-05-23

- Aktualna paczka robocza po tym etapie: `site_hardware_param_dictionary_choices_v1.zip`.
- Baza startowa: `site_hardware_replacement_button_visibility_fix_v1.zip`.
- Tekstowe parametry techniczne okuć z dozwolonymi wartościami w słowniku są renderowane w formularzu okucia jako wybór aplikacyjny/launcher, nie jako ręczne pole tekstowe.
- Normalizacja parametru tekstowego z listą dopuszcza tylko dokładną wartość ze słownika. Wartości spoza listy, w tym stare ręczne wpisy kilku pozycji testowych, są czyszczone i użytkownik musi wybrać poprawną wartość ze słownika.
- Parametry tekstowe bez listy, parametry liczbowe od-do i boolean zachowały dotychczasowy model wejścia.
- W słownikach pole `Wartości podpowiedzi` zostało opisane jako `Dozwolone wartości`, a pomoc `?` tłumaczy konsekwentne wpisywanie opcji i wpływ na zamienniki.
- Nie dodano nowego storage, nie zmieniono backupów, import/export Excel, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-param-dictionary-choices-v1.md`.

## Hardware replacement button visibility fix v1 — 2026-05-23

- Aktualna paczka robocza po tym etapie: `site_hardware_replacement_button_visibility_fix_v1.zip`.
- Baza startowa: `site_hardware_replacement_preview_ui_v1.zip`.
- Poprawiono realną widoczność przycisku `Zamienniki` w modalu edycji okucia: moduł UI potrafi odnaleźć albo odtworzyć przycisk pod `Wyjdź` i panel podglądu w stopce modala.
- Źródło porównania jest teraz budowane odporniej: z pozycji katalogu oraz pasywnego draftu formularza, z obsługą aliasu `category` jako `hardwareCategory`.
- Warunek widoczności nadal ogranicza przycisk do edycji istniejącego okucia bez niezapisanych zmian; przycisk nie pokazuje się w dodawaniu nowej pozycji.
- Podgląd zamienników nadal nie zapisuje zmian do katalogu, projektu ani storage i nie dodaje właściwej akcji `Zamień`.
- Nie zmieniono polityki backupów, import/export Excel, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-replacement-button-visibility-fix-v1.md`.

## Hardware replacement preview UI v1 — 2026-05-23

- Aktualna paczka robocza po tym etapie: `site_hardware_replacement_preview_ui_v1.zip`.
- Baza startowa: `site_data_safety_backup_limit_policy_test_v2.zip`.
- W modalu edycji okucia dodano przycisk `Zamienniki` pod przyciskiem `Wyjdź`. Przycisk jest widoczny tylko przy edycji istniejącego okucia, gdy formularz nie ma niezapisanych zmian.
- Dodano moduł UI `js/app/material/price-modal-hardware-replacements.js`, który korzysta z `FC.hardwareReplacementEngine`, ale nie zapisuje zmian do katalogu, projektu ani storage.
- Lista pokazuje kandydatów z tej samej kategorii i od innych producentów, z podziałem na pasujące oraz najbliższe odrzucone. Wynik zawiera status, podstawowe meta, cenę `Do wyceny` i powody dopasowania/odrzucenia.
- `price-modal-item-form.js` tylko przekazuje stan modala do modułu zamienników; nie przejął logiki porównywania.
- Dodano kontrakty smoke i test UI okuć pilnujące, że podgląd zamienników używa silnika, nie robi zapisu i nie używa systemowych dialogów.
- Nie zmieniono polityki backupów, import/export Excel, PRO100, ROZRYS, RYSUNKU, WYCENY ani właściwej zamiany okuć w projekcie.
- Raport: `tools/reports/hardware-replacement-preview-ui-v1.md`.

## Hardware compare modes / storage cleanup v1 — 2026-05-21

- Baza startowa: `site_000_hardware_edit_modal_perf_fix_v1.zip`.
- Nie zmieniono miejsca ustawiania zasad szukania zamienników: nadal definiuje się je w słownikach parametrów technicznych kategorii okuć.
- Doprecyzowano logikę `compareParam()` dla liczbowych parametrów od-do: `withinRange` oznacza teraz, że zakres/wartość wymagania musi w całości mieścić się w zakresie zamiennika; częściowe przecięcie należy do trybu `rangeOverlap`.
- Dodano testy negatywne pilnujące, że częściowe przecięcie zakresów nie przechodzi jako „Mieści się w zakresie”, ale przechodzi jako „Zakresy się przecinają”.
- Doprecyzowano opisy pomocy `?` dla `withinRange` i `rangeOverlap`, bez zmiany UI ani dodawania helper textu obok pól.
- Uzupełniono klasyfikację storage dla słowników okuć: producenci, dostawcy, ustawienia, kategorie, typy/cechy i parametry techniczne. Nie zmieniono polityki backupów ani zakresu snapshotu.
- Raport: `tools/reports/hardware-compare-modes-storage-cleanup-v1.md`.

## Hardware edit modal perf fix v1 — 2026-05-20

- Baza startowa: `site_000_hardware_technical_params_serialization_fix_v1.zip`.
- Po dynamicznych parametrach technicznych edycja okucia na telefonie mogła wyglądać jak brak reakcji na pierwszy klik, a otwarcie/zamknięcie modala potrafiło przycinać interfejs. Przyczyną było synchroniczne, wielokrotne przeliczanie formularza podczas sprawdzania dirty state oraz remountowanie launchera `Typ / cecha` przy pasywnym odczycie stanu.
- `currentItemSignature()` dla akcesoriów używa teraz pasywnego `getCurrentAccessoryDraft({ passive:true })`, bez efektów ubocznych w DOM.
- Dynamiczne parametry techniczne aktualizują ukryty `hardwareType` i etykietę launchera bez ponownego montowania całego launchera przy każdym przeliczeniu.
- Odczyt dynamicznych pól jest ograniczony do kontenera `hardwareDynamicTechnicalFields`, zamiast skanować cały dokument.
- Dodano test smoke pilnujący pasywnego odczytu stanu formularza okuć.
- Nie zmieniono modelu danych, importu/eksportu, backupu ani polityki storage.
- Raport: `tools/reports/hardware-edit-modal-perf-fix-v1.md`.


## Hardware price sources / zakup / rentowność — plan przyszły — 2026-05-10

- Plan dotyczy przyszłego rozwoju katalogu okuć, WYCENY i raportów rentowności; ten wpis nie zmienia jeszcze runtime ani modelu danych.
- Docelowo rozdzielać trzy warstwy: katalog techniczny okucia, wiele znanych cen u dostawców oraz snapshot ceny użytej w konkretnej ofercie.
- Jedno okucie powinno móc mieć wiele cen: lokalna hurtownia, Bivert, MAGO, faktura, ręczna cena albo inne źródło. Nie wracać do płaskiego mylenia `miejsce zakupu` z `źródło ceny` jako jedyną parą pól.
- Reguła wyceny dla klienta ma działać według kolejności źródeł, np. lokalna hurtownia jako domyślna, a przy braku ceny fallback do bazy internetowej typu Bivert. Cena użyta w ofercie musi być zamrożona w snapshotcie wyceny.
- Automat najtańszego zakupu nie powinien po cichu ustalać oferty dla klienta. Po akceptacji oferty ma powstać lista zakupów z sugestią gdzie kupić najtaniej/najrozsądniej, a użytkownik zatwierdza faktyczny zakup.
- Raport rentowności ma porównywać: koszt okuć przyjęty do oferty, sugerowany koszt zakupu, rzeczywisty koszt zakupu i różnicę zakupową. Przykład: klient dostał ofertę z okuciami za 3000 zł, realny zakup 2400 zł, różnica +600 zł poprawia rentowność projektu.
- Dalszy rozwój w tej ścieżce powinien iść etapami: wiele cen przy okuciu, reguła wyboru ceny do wyceny, snapshot w WYCENIE, lista zakupów po akceptacji, raport plan vs rzeczywistość.
- Przed kodowaniem tego obszaru przeczytać `CLOUD_MIGRATION.md` i nie dopisywać nowych danych poza wersjonowanymi kluczami `fc_*`/repozytorium. Przy większej pracy nad import/export najpierw rozdzielić `hardware-catalog-import-export.js` zgodnie z planem.









## PRO100 service import v1 — 2026-05-14

- Aktualna paczka robocza po tym etapie: `site_pro100_board_parts_import_v1.zip`.
- Baza startowa: `site_hardware_import_export_deep_tests_v1.zip`; odrzucona paczka `site_hardware_excel_row_date_autofill_v1.zip` nadal nie jest używana jako baza.
- Dodano import wklejek PRO100 w drobnych usługach stolarskich: `nazwa | długość wzdłuż słoja | oklejanie długości | szerokość | oklejanie szerokości | grubość | ilość | kolor`.
- Znaki oklejania: `=` oznacza dwie krawędzie, `-`/`–`/`—` jedną krawędź, puste pole brak oklejania.
- Import PRO100 korzysta z istniejącego modelu zlecenia usługowego i usługowego ROZRYS-u. Formatki są zapisywane w `cutting.parts`; nie dodano nowego storage ani osobnego martwego katalogu.
- Brakujący kolor/dekor jest dodawany do istniejącego katalogu materiałów przez aplikacyjny modal importu z ptaszkiem `Ma słoje`; ta decyzja steruje później możliwością obrotu w rozrysie.
- Usługowy ROZRYS grupuje formatki po materiale/grubości, żeby nie mieszać kolorów i grubości w jednym planie.
- Raport: `tools/reports/pro100-service-import-v1.md`.

## Catalog seed dev tests fix v1 — 2026-05-13

- Aktualna paczka robocza po tym etapie: `site_catalog_seed_dev_tests_fix_v1.zip`.
- Baza startowa: `site_hardware_global_vat_import_stabilization_v1.zip`; odrzucona paczka `site_hardware_excel_row_date_autofill_v1.zip` nadal nie jest używana jako baza.
- Naprawiono wyłącznie kontrakty testów przeglądarkowych `dev_tests.html`: po wprowadzeniu realnych seedów okuć testy migracji nie mogą wymagać, żeby lista `accessories` miała dokładnie jeden rekord.
- Test `Katalogi rozdzielają legacy materiały, akcesoria i stawki meblowe` sprawdza teraz, czy legacy akcesorium faktycznie trafiło do `accessories` i nie siedzi dalej w materiałach arkuszowych, zamiast traktować obecność seedów jako błąd.
- Test `Migracja z preferStoredSplit...` sprawdza obecność zapisanego akcesorium i brak `materialType: akcesoria`, ale dopuszcza realne seedy katalogu okuć.
- Nie zmieniono runtime aplikacji, importu/exportu, storage ani modelu VAT/rabatów.
- Raport: `tools/reports/catalog-seed-dev-tests-fix-v1.md`.


## Hardware missing supplier duplicate fix v1 — 2026-05-13

- Aktualna paczka robocza po tym etapie: `site_hardware_missing_supplier_duplicate_fix_v1.zip`.
- Baza startowa tej paczki: `site_hardware_supplier_missing_resolver_v1.zip`; odrzucona paczka `site_hardware_excel_row_date_autofill_v1.zip` nadal nie jest używana jako baza.
- Naprawiono przypadek z realnego XLSX, w którym `Ceny_dostawcow` miały cenę dla istniejącego okucia po `producent + symbol`, ale dostawca był pusty albo śmieciowy/nierozpoznany, a to samo okucie występowało też w arkuszu `Okucia`.
- Resolver brakującego dostawcy nie jest już blokowany przez fałszywy duplikat tego samego okucia z aktualnego katalogu i importowanego arkusza `Okucia`.
- Wiersze ceny z nierozpoznanym dostawcą nadal nie tworzą dostawców. Trafiają do wyboru dostawcy z istniejącej listy albo można je pominąć/ignorować wszystkie.
- Nie dodano nowego storage ani nowych kluczy localStorage; zmiana pozostaje w granicy import/export i resolvera UI.
- Raport: `tools/reports/hardware-missing-supplier-duplicate-fix-v1.md`.


## Hardware supplier missing resolver v1 — 2026-05-12

- Aktualna paczka robocza po tym etapie: `site_hardware_supplier_missing_resolver_v1.zip`.
- Baza startowa tej paczki: `site_hardware_import_resolver_supplier_gap_v1.zip`; odrzucona paczka `site_hardware_excel_row_date_autofill_v1.zip` nadal nie jest używana jako baza.
- Import `Ceny_dostawcow` dla istniejącego okucia z ceną, producentem i symbolem, ale bez rozpoznanego dostawcy, nie jest już pomijany po cichu. Trafia do resolvera braków jako wybór dostawcy.
- Resolver pozwala wybrać dostawcę tylko z istniejącej listy dostawców programu albo z listy `Dostawcy` w importowanym XLSX. Nie dodaje nowych dostawców z tego modala.
- Po wyborze dostawcy import działa idempotentnie po `producent + symbol + dostawca`: aktualizuje istniejącą cenę tego dostawcy albo dodaje nową cenę przy okuciu.
- `Ignoruj wszystko` w resolverze dla brakującego dostawcy pomija wszystkie nierozwiązane ceny z brakującym/nieznanym dostawcą w tym imporcie, bez ruszania pozostałych typów braków.
- Nie dodano nowego storage ani nowych kluczy localStorage; zmiana pozostaje w granicy import/export i resolvera UI.
- Raport: `tools/reports/hardware-supplier-missing-resolver-v1.md`.

## Hardware import resolver supplier gap v1 — 2026-05-12

- Aktualna paczka robocza po tym etapie: `site_hardware_import_resolver_supplier_gap_v1.zip`.
- Baza startowa tej paczki: `site_hardware_import_create_item_resolver_v1.zip`; odrzucona paczka `site_hardware_excel_row_date_autofill_v1.zip` nadal nie jest używana jako baza.
- Przy tworzeniu nowego okucia z arkusza `Ceny_dostawcow` resolver braków obejmuje teraz także brakującego/nieznanego dostawcę, a nie tylko kategorię i jednostkę.
- Wiersz z `okucie_nazwa`, `okucie_symbol`, istniejącym producentem i ceną, ale bez dostawcy/kategorii/jednostki nie jest już po cichu pomijany; ma trafić do modala uzupełniania.
- `Ceny_dostawcow` nadal nie wiąże danych po numerze wiersza Excela. Kilka cen jednego okucia nadal działa jako wiele wierszy po `producent + symbol + dostawca`.
- Usunięto fałszywe ostrzeżenia `pasuje do kilku okuć` wynikające z tego, że to samo okucie było jednocześnie w aktualnym katalogu i w arkuszu `Okucia` z eksportu.
- Nie dodano nowego storage ani nowych kluczy localStorage; zmiana pozostaje w granicy import/export i resolvera UI.
- Raport: `tools/reports/hardware-import-resolver-supplier-gap-v1.md`.


## Hardware import create item resolver v1 — 2026-05-12

- Aktualna paczka robocza po tym etapie: `site_hardware_import_create_item_resolver_v1.zip`.
- Baza startowa tej paczki: `site_hardware_supplier_price_create_item_v1.zip`; odrzucona paczka `site_hardware_excel_row_date_autofill_v1.zip` nadal nie jest używana jako baza.
- Import z arkusza `Ceny_dostawcow` nie ustawia już automatycznie `kategoria = Inne` ani `jednostka = szt.` przy tworzeniu nowego okucia.
- Nowe okucie z arkusza cen może powstać dopiero po podaniu istniejącego producenta, symbolu, nazwy, istniejącego dostawcy, ceny oraz kategorii i jednostki.
- Jeżeli kategoria albo jednostka są puste, import zatrzymuje wiersz w resolverze braków i pokazuje aplikacyjny modal uzupełniania; użytkownik wybiera kategorię i jednostkę z istniejących opcji.
- W resolverze kategorii dodano przycisk `Dodaj kategorię`; mały modal aplikacyjny zapisuje nową kategorię do słownika i udostępnia ją od razu w kolejnych wyborach oraz w późniejszym eksporcie/importcie.
- Arkusz `Ceny_dostawcow` dostał jawne kolumny `kategoria` i `jednostka`, ale pozostają one pomocnicze: jeśli są puste przy nowym okuciu, uzupełnia je użytkownik w modalu, a nie automat.
- Kilka cen jednego okucia dalej działa jako kilka wierszy po `producent + symbol + dostawca`; nie wraca wiązanie po numerze wiersza Excela.
- Nie dodano nowego klucza storage. Kategorie nadal są zapisywane przez `catalogStore.saveHardwareCategories()` pod wersjonowanym kluczem `fc_hardware_categories_v1`.
- Raport: `tools/reports/hardware-import-create-item-resolver-v1.md`.


## Hardware supplier price create item v1 — 2026-05-12

- Aktualna paczka robocza po tym etapie: `site_hardware_supplier_price_create_item_v1.zip`.
- Baza startowa tej paczki: `site_hardware_import_bulk_diff_types_v1.zip`; odrzucona paczka `site_hardware_excel_row_date_autofill_v1.zip` nie była używana jako baza.
- Arkusz `Ceny_dostawcow` może tworzyć nowe okucie bez ręcznego `okucie_id`, jeśli w wierszu ceny podano istniejącego producenta, `okucie_symbol`, `okucie_nazwa`, istniejącego dostawcę oraz cenę netto albo brutto.
- Producent w `Ceny_dostawcow` jest dopasowywany do istniejącego słownika case-insensitive (`blum` → `Blum`), ale import nie tworzy nowych producentów z literówek.
- Nie wraca wiązanie po numerze wiersza. Kilka cen jednego okucia nadal ma być wieloma wierszami powiązanymi po `producent + symbol + dostawca`.
- Brakująca `data_ceny` przy nowej lub zmienionej cenie jest uzupełniana datą importu, dzięki czemu kolejny eksport XLSX ma pełniejsze dane.
- `Ceny_dostawcow.producent` dostał walidację z arkusza `Producenci`; dostawca nadal jest wybierany z arkusza `Dostawcy`.
- Jeśli okucie powstaje tylko z arkusza cen i brak dodatkowych danych, domyślnie dostaje `kategoria = Inne`, `jednostka = szt.`; użytkownik może to później doprecyzować w katalogu albo w arkuszu `Okucia`.
- Raport: `tools/reports/hardware-supplier-price-create-item-v1.md`.


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

## Hardware price change confirmation v1 — 2026-05-13

- Aktualna paczka robocza po tym etapie: `site_hardware_price_change_confirmation_v1.zip`.
- Baza startowa tej paczki: `site_hardware_missing_supplier_duplicate_fix_v1.zip`; odrzucona paczka `site_hardware_excel_row_date_autofill_v1.zip` nadal nie jest używana jako baza.
- Import `Ceny_dostawcow` nie zapisuje już nowych ani zmienionych cen dostawców całkiem po cichu. Plan importu niesie listę `supplierPriceChanges` z rozróżnieniem `added` / `updated` oraz starą i nową ceną.
- Dodano osobny moduł UI `js/app/material/price-modal-hardware-price-confirm.js`, żeby potwierdzanie zmian cen nie rozbudowywało resolvera braków ani głównego panelu import/export.
- Przy dodaniu ceny użytkownik widzi pytanie o dodanie nowej ceny dla konkretnego dostawcy; przy aktualizacji widzi starą i nową cenę oraz ostrzeżenie, jeśli zmiana dotyczy ceny `Do wyceny`.
- Dostępne są akcje pojedyncze oraz hurtowe: dodaj/zaktualizuj jedną, dodaj wszystkie nowe ceny, zaktualizuj wszystkie aktualizacje, zostaw/pomiń jedną lub wszystkie podobne.
- Nie dodano nowego storage ani nowych kluczy localStorage; potwierdzenia działają wyłącznie w pamięci bieżącego importu przed `applyImportPlan()`.
- `hardware-catalog-supplier-price-xlsx.js` przekroczył próg ostrzeżenia 400 linii, ale pozostaje jednym boundary arkusza cen dostawców. Przy następnej większej rozbudowie rozdzielić diff/akcje cen od parsera arkusza.
- Raport: `tools/reports/hardware-price-change-confirmation-v1.md`.

## Hardware global VAT + import stabilization v1 — 2026-05-13

Baza: `site_hardware_price_change_confirmation_v1.zip`.

Zakres paczki `site_hardware_global_vat_import_stabilization_v1.zip`:

- usunięto aktywny VAT z modelu i UI dostawcy okuć;
- VAT dla katalogu okuć jest teraz brany z globalnych ustawień cen okuć (`defaultVatRate`);
- rabat pozostaje przy dostawcy (`defaultDiscountPercent`) i nadal obniża koszt zakupu po rabacie;
- arkusz `Dostawcy` w eksporcie XLSX nie eksportuje już `vat_domyslny_proc`;
- import dostawców ignoruje legacy VAT dostawcy, żeby stare pliki nie mieszały kalkulacji;
- przeliczanie brakującej ceny netto/brutto w `Ceny_dostawcow` używa globalnego VAT z ustawień;
- formularz okucia i panel cen dostawców pokazują VAT jako globalny, a nie zależny od dostawcy;
- `buildImportPlan()` klonuje bieżące okucia przed planowaniem importu, żeby podgląd importu nie mutował aktualnego katalogu;
- `applySupplierPriceRows()` pracuje na sklonowanych wpisach cen dostawców, żeby decyzje typu `Zostaw starą`, `Ignoruj` i `Ignoruj wszystko` nie miały wcześniejszych skutków ubocznych;
- dodano test ochronny: `Podgląd importu cen nie zmienia katalogu przed zatwierdzeniem`;
- cache-busting zmienionych modułów podbito do `20260513_hardware_global_vat_import_stabilization_v1`.

Nie zmieniano RYSUNKU, WYWIADU, MATERIAŁÓW, WYCENY, backupów, snapshotów ofert ani automatycznej zamiany producentów.

Dług techniczny: `hardware-catalog-import-export.js` i `hardware-catalog-supplier-price-xlsx.js` nadal są duże i powinny zostać rozdzielone w osobnej paczce refaktoryzacyjnej, bez mieszania z logiką biznesową importu.


## Hardware accessory tests v1 — 2026-05-13

- Aktualna paczka robocza po tym etapie: `site_hardware_accessory_tests_v1.zip`.
- Baza startowa: `site_catalog_seed_dev_tests_fix_v1.zip`; odrzucona paczka `site_hardware_excel_row_date_autofill_v1.zip` nadal nie jest używana jako baza.
- Dodano osobną suite testów akcesoriów `js/testing/material/accessories-tests.js` i podpięto ją pod `MATERIAŁY` w `dev_tests.html`.
- Suite zawiera 37 testów w grupach: model ceny, słowniki, store, import/export oraz kontrakty UI okuć.
- Dodano narzędzie Node `tools/hardware-accessories-dev-smoke.js`, żeby można było uruchomić same testy akcesoriów bez ręcznego klikania w przeglądarce.
- Testy pilnują m.in.: globalnego VAT-u, rabatów dostawców, jednego `Do wyceny`, braku `#REF!`, pustego `typ/cecha`, blokady duplikatów, importu po `producent + symbol`, resolvera brakującego dostawcy, braku automatycznego tworzenia producentów/dostawców oraz braku mutacji katalogu przy podglądzie importu.
- Nie zmieniono runtime aplikacji, UI katalogu, importu/eksportu ani modelu danych; to paczka testowa/stabilizująca.
- Raport: `tools/reports/hardware-accessory-tests-v1.md`.


## Hardware import/export refactor v1 — 2026-05-14

- Aktualna paczka robocza po tym etapie: `site_hardware_import_export_refactor_v1.zip`.
- Baza startowa: `site_hardware_accessory_tests_v1.zip`; odrzucona paczka `site_hardware_excel_row_date_autofill_v1.zip` nadal nie jest używana jako baza.
- Rozdzielono import/export okuć bez zmiany UI i bez celowej zmiany logiki biznesowej.
- `hardware-catalog-import-export.js` jest teraz cienką fasadą publicznego API `FC.hardwareCatalogImportExport`. Cięższe odpowiedzialności są w `hardware-catalog-export-xlsx.js`, `hardware-catalog-import-parser.js` i `hardware-catalog-import-plan.js`.
- `hardware-catalog-supplier-price-xlsx.js` jest teraz cienką fasadą publicznego API `FC.hardwareSupplierPriceXlsx`. Eksport arkusza `Ceny_dostawcow` jest w `hardware-supplier-price-export.js`, a parser/matching/diff/apply cen w `hardware-supplier-price-import.js`.
- Zachowano kontrakty: import po `producent + symbol`, brak ręcznego ID dla użytkownika Excela, resolvery braków, potwierdzanie zmian cen, globalny VAT, rabaty dostawców i brak mutacji katalogu przy samym podglądzie importu.
- Dodano testy architektoniczne do `tools/app-dev-smoke.js` i `js/testing/material/accessories-tests.js`; dedykowany smoke akcesoriów ma teraz 39 testów.
- Cache-busting nowych/zmienionych modułów: `20260514_hardware_import_export_refactor_v1`.
- Raport: `tools/reports/hardware-import-export-refactor-v1.md`.


## Hardware import/export deep tests v1 — 2026-05-14

- Aktualna paczka robocza po tym etapie: `site_000_hardware_edit_modal_perf_fix_v1.zip`.
- Baza startowa: `site_hardware_import_export_refactor_v1.zip`; odrzucona paczka `site_hardware_excel_row_date_autofill_v1.zip` nadal nie jest używana jako baza.
- Dodano głęboką suite testów import/export okuć `js/testing/material/accessories-import-export-deep-tests.js` i podpięto ją pod `MATERIAŁY` w `dev_tests.html`.
- Dodano narzędzie Node `tools/hardware-import-export-deep-smoke.js`, żeby można było uruchomić same scenariusze import/export bez klikania w przeglądarce.
- Testy obejmują m.in.: brak mutacji store przy podglądzie importu, realny zapis dopiero przez `applyImportPlan()`, `Zostaw starą`, `Zaktualizuj`, `__skipImport`, brak fałszywych aktualizacji, różne nazwy przy tym samym `producent + symbol`, resolver brakującego/śmieciowego dostawcy, tworzenie nowego okucia z arkusza cen, blokadę literówek producenta, przenoszenie `Do wyceny`, globalny VAT, rabat dostawcy i brak formuł w pustych wierszach Excela.
- Nie zmieniono runtime aplikacji, UI, modelu danych ani importu/exportu; to paczka testowa/stabilizująca po refaktorze.
- Od tej paczki przed kolejnymi zmianami przy import/export okuć uruchamiać dodatkowo `node tools/hardware-import-export-deep-smoke.js`.
- Raport: `tools/reports/hardware-import-export-deep-tests-v1.md`.


## PRO100 file import v1 — 2026-05-14

- Aktualna paczka robocza po tym etapie: `site_pro100_file_import_v1.zip`.
- Baza startowa: `site_pro100_board_parts_import_v1.zip`; odrzucona paczka `site_hardware_excel_row_date_autofill_v1.zip` nadal nie jest używana jako baza.
- Modal `Import formatek PRO100` w drobnych usługach stolarskich ma teraz dwie ścieżki: wklejenie tabeli oraz `Wczytaj plik XLSX / CSV / TXT`.
- Plik XLSX czyta pierwszy arkusz przez istniejący `FC.xlsxLite`, a CSV/TSV/TXT idą przez odczyt tekstowy; oba wejścia korzystają z tego samego parsera i tego samego podglądu co wklejka.
- Parser PRO100 dostał `parseRows()`/`parseColumns()`, pomija puste wiersze i rozpoznawalny nagłówek, ale nie tworzy osobnego modelu danych ani osobnego storage.
- Import pliku dalej zapisuje formatki w istniejącym `cutting.parts`, zachowuje wykrywanie brakujących kolorów, ptaszek `Ma słoje`, grupowanie do usługowego ROZRYS-u i dotychczasowe dodawanie/zastępowanie formatek.
- Dodano testy dla wierszy z pliku, wejścia plikowego oraz realnej ścieżki XLSX → pierwszy arkusz → parser PRO100.
- Raport: `tools/reports/pro100-file-import-v1.md`.

## Room preferences stage1 v1 — 2026-05-15

- Aktualna paczka robocza po tym etapie: `site_room_preferences_stage1_v1.zip`.
- Baza startowa: `site_pro100_file_import_v1.zip`.
- WYWIAD dostał dwa akordeony nad listą szafek: `Parametry pomieszczenia` oraz `Preferencje standardu`. Parametry techniczne pokoju zostały odseparowane od preferencji klienta/pomieszczenia.
- Dodano model `room.preferences` jako część danych konkretnego pomieszczenia. Preferencje nie są globalne dla aplikacji i nie tworzą osobnego klucza `localStorage`.
- Schemat projektu podbito do `schemaVersion: 10`; normalizacja i migracja V9→V10 dopisują pusty obiekt preferencji dla starszych projektów bez kasowania istniejących danych.
- Domenę preferencji wydzielono do `js/app/room-preferences/room-preferences-model.js`, a UI modala do `js/app/ui/wywiad-room-preferences.js`, żeby nie rozbudowywać modułów parametrów pokoju ani renderowania szafek.
- Modal `Preferencje standardu` zapisuje: standard wykończenia, standard blend, korpus, materiał/kolor frontu, plecy, otwieranie dla dolnych/stojących, otwieranie dla górnych/wiszących, otwieranie dla modułu oraz preferowanego producenta okuć.
- `standard okuć` celowo nie został dodany. Zgodnie z decyzją użytkownika dobór okuć ma później opierać się na najlepszym sensownym okuciu danej firmy, a nie na dodatkowym poziomie standardu.
- Nowa szafka bez poprzednika w pomieszczeniu pobiera domyślne wartości z `room.preferences`. Jeżeli w danym pomieszczeniu istnieje już szafka, kolejna dodawana szafka klonuje jej rodzaj i ustawienia bez limitu czasowego.
- Istniejące szafki nie są zmieniane po zapisie preferencji. Hurtowe zastosowanie preferencji do istniejących szafek pozostaje osobnym, późniejszym etapem.
- Nie zmieniano PRO100, usług stolarskich, ROZRYS-u, WYCENY, backupów ani import/export okuć poza bezpiecznym odczytem listy producentów do pola preferencji.
- Cache-busting zmienionych modułów: `20260515_room_preferences_stage1_v1`.
- Raport: `tools/reports/room-preferences-stage1-v1.md`.

## Deploy unzip workflow fix v1 — 2026-05-16

- Aktualna paczka techniczna po poprawce wdrożenia: `site_000_room_preferences_stage1_deployfix_v2.zip`.
- Baza startowa: `site_room_preferences_stage1_v1.zip`.
- Naprawiono workflow `.github/workflows/unzip-site-to-root.yml`, żeby rozpakowywanie `site*.zip` nie zgadywało paczki po czasie pliku (`ls -1t`), tylko najpierw wybierało ZIP zmieniony w bieżącym commicie.
- Workflow uruchamia się na każdy push do `main` oraz ręcznie przez `workflow_dispatch`; gdy nie ma pliku `site*.zip`, kończy się bez zmian.
- Przy deployu kopiowane są również dotfiles/dotfolders, więc `.github` z pełnej paczki może aktualizować workflow w kolejnych wdrożeniach.
- Jeżeli paczka nie zawiera `.github`, istniejący katalog `.github` zostaje zachowany, żeby przypadkowo nie skasować workflowów.
- Nie zmieniano runtime aplikacji, danych projektu, UI, PRO100, ROZRYS-u, WYCENY ani katalogu okuć; to poprawka mechanizmu wdrożeniowego po paczce preferencji pokoju.
- Raport: `tools/reports/deploy-unzip-workflow-fix-v1.md`.

## Room accordion inline v1 — 2026-05-16

- Aktualna paczka techniczna po poprawce UI: `site_000_room_accordion_inline_v1.zip`.
- Baza startowa: `site_000_room_preferences_stage1_deployfix_v2.zip`.
- W WYWIADZIE akordeony `Parametry pomieszczenia` i `Preferencje standardu` są domyślnie zwinięte.
- Usunięto dodatkowe przyciski `Edytuj parametry` / `Edytuj preferencje` z akordeonów; zawartość jest edytowana bezpośrednio po rozwinięciu.
- Parametry pomieszczenia działają inline na istniejącym modelu `room.settings`, a preferencje inline zapisują istniejące `room.preferences` bez nowego storage.
- Wygląd akordeonów WYWIADU dopasowano do wzorca ROZRYS: mocniejsza ramka, cień, biały nagłówek i zielona strzałka.
- Nie zmieniano PRO100, usług stolarskich, ROZRYS-u, WYCENY, backupów, import/export okuć ani hurtowej zmiany istniejących szafek.
- Cache-busting zmienionych plików: `20260516_room_accordion_inline_v1`.
- Raport: `tools/reports/room-accordion-inline-v1.md`.

## Program defaults settings v1 — 2026-05-16

- Aktualna paczka robocza po tym etapie: `site_000_program_defaults_settings_v1.zip`.
- Baza startowa: `site_000_room_accordion_inline_v1.zip`.
- Dodano globalne domyślne programu w trybiku strony głównej, bez dokładania sekcji `Domyślne` w WYWIADZIE pokoju.
- Nowy store: `js/app/settings/program-defaults-store.js`; klucz `fc_program_defaults_v1`; dane są user-data i wchodzą do snapshotu/backupów przez prefiks `fc_`.
- Nowy widok UI: `js/app/ui/data-settings-defaults-view.js`; wejście dodane w `data-settings-menu-view.js` i routingu `data-settings-modal.js`.
- `cabinet-modal-draft.js` stosuje globalne domyślne materiałów przed preferencjami pokoju; preferencje pokoju mają pierwszeństwo, a klonowanie ostatniej szafki dalej zachowuje dotychczasowe dane.
- Przy kolejnych pracach nie wracać do sekcji `Domyślne` w WYWIADZIE; w pokoju rozwijać strefy dolna/środkowa/górna oraz osobny model źródła frontu `jak dolne / jak środkowe / jak górne / własny`.
- Raport: `tools/reports/program-defaults-settings-v1.md`.

## Program defaults UI fix v1 — 2026-05-16

- Aktualna paczka robocza po tej poprawce: `site_000_program_defaults_ui_fix_v1.zip`.
- Baza startowa: `site_000_program_defaults_settings_v1.zip`.
- Poprawiono wyłącznie UI sekcji `Domyślne materiały i okucia` w trybiku strony głównej.
- Usunięto natywne selecty/pickery z tego widoku; `data-settings-defaults-view.js` tworzy aplikacyjne launchery wyboru oparte o overlay ROZRYS.
- Usunięto zbędne liczniki akordeonów `Materiały`/`Okucia`; styl akordeonów w tej sekcji dopasowano do wzorca ROZRYS.
- Dodano smoke test pilnujący braku natywnych selectów w tym widoku i obecności cache-bustingu `20260516_program_defaults_ui_fix_v1`.
- Nie zmieniono storage, `fc_program_defaults_v1`, backupów, PRO100, ROZRYS, WYCENY ani preferencji pokoju.
- Raport: `tools/reports/program-defaults-ui-fix-v1.md`.

## Program defaults ROZRYS sync v1 — 2026-05-16

- Poprawiono UI sekcji `Domyślne materiały i okucia` w trybiku strony głównej po audycie względem ROZRYS.
- Launchery wyboru w tej sekcji nie pokazują już dodatkowej strzałki i nie używają natywnych selectów/pickerów telefonu.
- Akordeony `Materiały` i `Okucia` mają geometrię chevrona, ramkę i cień zgodne z wzorcem ROZRYS.
- Zmiana jest UI-only dla tej sekcji: bez zmiany modelu `fc_program_defaults_v1`, backupów, PRO100, WYCENY, ROZRYS i preferencji pokoju.
- Raport: `tools/reports/program-defaults-rozrys-sync-v1.md`.


## Room zone preferences v1 — 2026-05-16

- Aktualna paczka po tym etapie: `site_000_room_zone_preferences_v1.zip`.
- Baza startowa: `site_000_program_defaults_rozrys_sync_v1.zip`.
- Preferencje w WYWIADZIE są strefowe: `lower`/dolna-stojące, `middle`/środkowa-moduły, `upper`/górna-wiszące. Nie dodawać sekcji „Domyślne” w WYWIADZIE.
- Globalne domyślne materiały i okucia pozostają w trybiku strony głównej pod `fc_program_defaults_v1`; są fallbackiem programu i są objęte backupem.
- UI preferencji strefowych ma używać aplikacyjnych launcherów ROZRYS; nie używać natywnych selectów/pickerów telefonu.
- Dodawanie szafki: po wybraniu typu nowy draft kopiuje ostatnią szafkę tego samego typu. Jeżeli poprzednika danego typu brak, bierze strefę pokoju, potem globalne domyślne z trybiku, potem awaryjny fallback.
- Raport: `tools/reports/room-zone-preferences-v1.md`.

## Front material source v1 — 2026-05-16

- Aktualna paczka po tym etapie: `site_000_front_material_source_v1.zip`.
- Baza startowa: `site_000_room_zone_preferences_v1.zip`.
- Dodano `js/app/cabinet/front-material-source.js` jako mały moduł domenowy rozwiązujący źródło materiału frontu: `lower`, `middle`, `upper`, `custom`.
- Moduł korzysta z `room.preferences.zones` oraz z globalnych fallbacków `FC.programDefaults`; nie tworzy nowego storage.
- Lodówki w zabudowie zapisują źródła w `cab.details.fridgeFrontSourceSingle|Lower|Upper` oraz opcjonalne materiały własne w odpowiadających polach `fridgeFrontCustomMaterial*` / `fridgeFrontCustomColor*`.
- Zestawy zapisują `set.frontSource`; wygenerowane fronty dostają metadane `frontMaterialSource`, żeby późniejsza hurtowa zmiana mogła odróżnić front strefowy od własnego.
- `schemaVersion` podbito do 12, ale bez destrukcyjnej migracji: brak źródła oznacza zachowanie dotychczasowego materiału jako `custom`.
- UI wyborów używa istniejących launcherów aplikacji; nie dodawać natywnych pickerów/selectów telefonu.
- Ten etap nie dodaje tabeli frontów wieloczęściowych, nie zmienia WYCENY i nie uruchamia hurtowej zmiany istniejących szafek.
- Testy ochronne dodano do `js/testing/cabinet/tests.js` i `tools/app-dev-smoke.js`.
- Raport: `tools/reports/front-material-source-v1.md`.


## Set materials unify v1 — 2026-05-17

- Aktualna paczka robocza po tym etapie: `site_000_set_materials_unify_v1.zip`.
- Baza startowa: `site_000_front_material_source_v1.zip`.
- Zestaw w WYWIADZIE ma być traktowany jak pozostałe szafki pod względem wyboru: korpus, plecy, otwieranie i fronty.
- Materiały zestawu są w module `js/app/cabinet/cabinet-modal-set-materials.js`; nie dopisywać tej logiki ponownie bezpośrednio do `cabinet-modal-set-wizard.js`.
- `room.sets[]` może zapisywać `bodyColor`, `backMaterial`, `openingSystem`, `frontMaterial`, `frontColor`, `frontSource`. Wygenerowane `room.cabinets[]` zestawu mają dostać spójne wartości korpusu, pleców i otwierania z rekordu zestawu.
- Nie dodano nowego storage ani nowych kluczy localStorage. Raport: `tools/reports/set-materials-unify-v1.md`.

## Fridge/set material cleanup v1 — 2026-05-17

- Lodówka nie może pokazywać jednocześnie nowych pól źródła materiału frontu oraz starych ogólnych pól `cmFrontMaterial` / `cmFrontColor` w głównej siatce materiałów. W UI lodówki ukrywać tylko wrappery `cmFrontMaterialWrap` i `cmFrontColorWrap`; `Korpus`, `Plecy` i `Otwieranie` zostają widoczne.
- Przy zestawach `getSetBaseDraft(room)` ma bazować na dolnej strefie (`room.preferences.zones.lower`) oraz globalnych domyślnych programu, a nie na ostatniej dowolnej szafce z pokoju. Zestaw konstrukcyjnie ma startować jak dolne/stojące.
- `cabinet-modal-set-wizard.js` nadal jest duży. Przy następnych pracach przy zestawach unikać dalszego puchnięcia: wydzielać małe moduły pomocnicze, tak jak `cabinet-modal-set-materials.js`.
- Testy ochronne dodano do `tools/app-dev-smoke.js` dla ukrywania zdublowanych pól lodówki i dla startu zestawu z dolnej strefy.

## Preferences / front source cleanup v1 — 2026-05-17

- Baza startowa: `site_000_fridge_set_material_cleanup_v1.zip`.
- Aktualna paczka po tym etapie: `site_000_preferences_front_source_cleanup_v1.zip`.
- Dodano centralny resolver strefowych materiałów w `room-preferences-model.js`: strefa pomieszczenia → globalne domyślne z trybiku → awaryjny fallback.
- Nowy draft szafki, domyślne zestawu oraz źródła frontu lodówki/zestawu korzystają z tej samej ścieżki rozwiązywania materiałów, żeby nie dublować logiki.
- Dodano nowe testy w `js/testing/cabinet/tests.js` oraz szybkie kontrakty w `tools/app-dev-smoke.js`.
- Nie ruszano PRO100, WYCENY, ROZRYS, hurtowej zmiany ani frontów wieloczęściowych.
- Raport: `tools/reports/preferences-front-source-cleanup-v1.md`.

## Bulk apply zone preferences v1 — 2026-05-17

- Aktualna paczka po tym etapie: `site_000_bulk_apply_zone_preferences_v1.zip`.
- Baza startowa: `site_000_preferences_front_source_cleanup_v1.zip`.
- Etap 2A dodaje bezpieczną ścieżkę: plan zmian → podgląd/liczniki → apply preferencji strefowych do istniejących szafek.
- Nowe moduły domenowe:
  - `js/app/room-preferences/room-preferences-bulk-plan.js` — buduje plan i liczniki bez mutowania danych.
  - `js/app/room-preferences/room-preferences-bulk-apply.js` — stosuje zatwierdzony wybór do szafek, frontów i zestawów.
  - `js/app/ui/wywiad-room-preferences-bulk-modal.js` — modal aplikacyjny w stylu programu; bez natywnych selectów/pickerów.
- `wywiad-room-preferences.js` ma jedynie wejście do modala bulk; ciężka logika nie jest dopisana do UI preferencji.
- Zasady apply:
  - `lower` obejmuje szafki stojące i materiały bazowe zestawu.
  - `middle` obejmuje moduły.
  - `upper` obejmuje szafki wiszące.
  - fronty specjalne lodówek i zestawów reagują na `frontMaterialSource` / `frontSource`; `custom` nie jest zmieniany.
- Zestawy dla korpusu, pleców i otwierania są traktowane jak dolna strefa, zgodnie z decyzją produktową.
- Nie dodano nowego storage ani nowych kluczy `localStorage`; zmiany zapisują się w istniejącym projekcie.
- Dodano testy w `tools/app-dev-smoke.js` oraz `js/testing/cabinet/tests.js` dla planowania/apply, lodówki z frontem własnym i braku natywnych pickerów w nowym UI.
- Ten etap nie obejmuje okuć, producentów okuć, WYCENY, PRO100, ROZRYS ani frontów wieloczęściowych.
- Raport: `tools/reports/bulk-apply-zone-preferences-v1.md`.

## Dev tests errors fix v1 — 2026-05-18

- Aktualna paczka po tym etapie: `site_000_dev_tests_errors_fix_v1.zip`.
- Baza startowa: `site_000_bulk_apply_zone_preferences_v1.zip`.
- Naprawiono błędy `dev_tests.html` zgłoszone po Etapie 2A:
  - testy potwierdzeń importu/exportu okuć używają `Array.from(...)` dla `querySelectorAll`, bo `NodeList` w przeglądarce nie musi mieć `.find()`;
  - launcher wyboru szafki odpala `change` także przy wyborze tej samej wartości, żeby ukryty select i draft szafki nie rozjeżdżały się po renderze.
- Dodano smoke kontrakty w `tools/app-dev-smoke.js` dla obu regresji.
- Zmiana nie dodaje storage, nie zmienia modelu danych i nie rusza PRO100, ROZRYS, WYCENY ani hurtowego apply.
- Raport: `tools/reports/dev-tests-errors-fix-v1.md`.

## Hardware technical data + Excel v1 — 2026-05-18

- Aktualna paczka robocza po tym etapie: `site_000_hardware_technical_data_excel_v1.zip`.
- Baza startowa: `site_000_dev_tests_errors_fix_v1.zip`.
- Dodano pola techniczne pozycji okucia: `hardwareSystem`, `drawerProfile`, `drawerLengthMm`, `drawerLoadKg`, `drawerReinforced`, `hardwareColor`, `hardwareUsage`, `technicalNote`.
- `series` zostaje legacy aliasem dla `hardwareSystem`; w UI i Excelu używać nazwy `System okucia` / `system_okucia`, żeby nie dublować pojęć `rodzina_systemu` i `system_seria`.
- Arkusz `Okucia` jest pełnym miejscem uzupełniania technicznych cech. Arkusz `Ceny_dostawcow` zachowuje szybkie kolumny cen z przodu, a techniczne kolumny ma jako opcjonalne dane dla nowych pozycji.
- W formularzu okucia dane techniczne są schowane pod aplikacyjnym akordeonem `Dane techniczne`; nie dodawać natywnych selectów/pickerów.
- Następny etap okuć nie powinien zaczynać od WYCENY. Najpierw można dodać dobór szuflad/prowadnic po głębokości i opcji `wzmocniona`, a dopiero później silnik zamiany systemów.
- Raport: `tools/reports/hardware-technical-data-excel-v1.md`.


## 2026-05-20 — hardware_dynamic_technical_params_v1

- Dodano dynamiczne parametry techniczne okuć definiowane per kategoria.
- Dodano moduł `js/app/catalog/hardware-technical-params.js` jako centralny model definicji, wartości, zakresów i porównywania parametrów.
- Słowniki okuć pozwalają edytować parametry techniczne w akordeonach kategorii; parametry mogą być cechą kluczową i mogą budować automatyczne `Typ / cecha`.
- Formularz okucia pokazuje w akordeonie `Dane techniczne` tylko pola przypisane do wybranej kategorii.
- Parametry liczbowe obsługują pola `od` i `do`: samo `od` = wartość dokładna, `od` + `do` = zakres.
- Dodano opisy pod ikoną `?` dla nazw parametrów, typów pól, jednostek, cechy kluczowej i sposobów porównania.
- Dodano backupowany klucz `fc_hardware_technical_params_v1` oraz klasyfikację storage.
- Import/export XLSX dostał `Parametry_techniczne` i arkusze grupowe `Okucia_<kategoria>`, przy zachowaniu szybkiego arkusza `Ceny_dostawcow`.
- Szczegóły etapu: `tools/reports/hardware-dynamic-technical-params-v1.md`.

## 2026-05-20 — hardware_technical_params_serialization_fix_v1

- Baza startowa: `site_000_backup_documentation_audit_v1.zip`.
- Naprawiono serializację dynamicznych parametrów technicznych okuć: obiekty z launcherów/list aplikacyjnych są normalizowane do czystych wartości tekstowych, liczbowych albo zakresów.
- `hardwareType` / `Typ / cecha` nie powinien już zapisywać `"[object Object]"`; jeżeli stary storage miał taki śmieć, normalizacja traktuje go jako pustą wartość zamiast utrwalać go dalej.
- Eksport arkuszy grupowych XLSX używa znormalizowanych wartości parametrów, żeby nie wypuszczać `"[object Object]"` do Excela.
- Dodano testy dla normalizacji parametrów, arkuszy grupowych i smoke test pilnujący braku `"[object Object]"` w rekordzie okucia.
- Nie zmieniono polityki backupu ani retencji; naprawa dotyczy modelu/normalizacji katalogu okuć.
- Raport: `tools/reports/hardware-technical-params-serialization-fix-v1.md`.


## Data safety test isolation v1 — 2026-05-22

- Baza startowa: `site_hardware_replacement_engine_preview_v1.zip`.
- Naprawiono wyłącznie test przeglądarkowy `Backupy testowe mają twardy limit 10 najnowszych sztuk`, który przy pełnym `localStorage` mógł tworzyć 12 dużych snapshotów realnych danych użytkownika i kończyć się błędem quota.
- Test izoluje teraz fixture danych aplikacji na czas sprawdzenia retencji: tymczasowo czyści klucze `fc_*` objęte snapshotem, tworzy mały zestaw testowy, sprawdza limit 10 backupów `before-tests`, a potem przywraca wcześniejszy stan.
- Nie zmieniono mechanizmu backupu, polityki retencji, limitu 10 kopii testowych, fallbacku ręcznego eksportu na dysk ani `BACKUP.md`.
- Nie zmieniono silnika zamienników, normalnego UI, import/export Excel, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/data-safety-test-isolation-v1.md`.

## Hardware replacement engine preview v1 — 2026-05-22

- Aktualna paczka po tym etapie: `site_hardware_replacement_engine_preview_v1.zip`.
- Baza startowa: `site_hardware_compare_modes_storage_cleanup_v1.zip`.
- Dodano moduł domenowy `js/app/catalog/hardware-replacement-engine.js` jako techniczny silnik podglądu zamienników okuć.
- Silnik nie dodaje UI, przycisków ani akcji użytkownika. Nie zapisuje zmian w projekcie, katalogu ani `localStorage`; działa jako czysta warstwa porównania dla testów i przyszłego modala zamiany.
- Publiczne API `FC.hardwareReplacementEngine` udostępnia:
  - `compareItems(source, candidate, options)` — sprawdza jednego kandydata i zwraca `compatible`, `score`, `checks`, `reasons`, `failures`, `warnings` oraz informację o cenie do wyceny;
  - `findCandidates(source, candidates, options)` / `previewCandidates(...)` — ocenia listę kandydatów i sortuje zgodne po wyniku, dostępnej cenie i cenie;
  - `quotePriceInfo(item)` — odczytuje cenę dostawcy `Do wyceny` bez zmiany danych;
  - `summarizeResult(result)` — krótki opis wyniku dla przyszłego raportu UI.
- Dopasowanie bazuje na kategorii, opcjonalnym producencie docelowym, aktywności kandydata, parametrach kluczowych kategorii oraz trybach porównania z `hardware-technical-params.js`.
- Brak ceny dostawcy `Do wyceny` jest ostrzeżeniem w trybie miękkim albo blokadą przy `requireQuotePrice:true`.
- Dodano 6 testów w `js/testing/material/accessories-tests.js` dla: braku zapisu do storage, długości prowadnic 350/400, nośności `minGte`, zakresów `withinRange`/`rangeOverlap`, producenta docelowego i braku ceny dostawcy.
- `tools/index-load-groups.js`, `tools/app-dev-smoke-lib/file-list.js`, `index.html` i `dev_tests.html` ładują nowy moduł po `hardware-technical-params.js`, przed katalogiem okuć.
- Nie zmieniono PRO100, usług, ROZRYS, RYSUNKU, WYCENY, import/export Excel ani polityki backupów.
- Raport: `tools/reports/hardware-replacement-engine-preview-v1.md`.

## Data safety backup limit policy test v2 — 2026-05-22

- Baza startowa: `site_data_safety_test_isolation_v1.zip`.
- Naprawiono wyłącznie test przeglądarkowy `Backupy testowe mają twardy limit 10 najnowszych sztuk`, który przy realnie ciężkim `localStorage` nadal mógł zgłaszać quota error.
- Test nie używa już `FC.dataBackupStore.createBackup()` i nie zapisuje backupów do realnego `localStorage`; sprawdza `FC.dataBackupPolicy.pruneBackups()` oraz `groupBackups()` na małych rekordach w pamięci JS.
- Test nadal pilnuje decyzji produktowej: backupy `before-tests` mają maksymalnie 10 najnowszych kopii, a ręczne backupy programu nie są przycinane przez limit testowy.
- Nie zmieniono mechanizmu backupu, polityki retencji, fallbacku ręcznego eksportu na dysk, `BACKUP.md`, UI, silnika zamienników, import/export, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/data-safety-backup-limit-policy-test-v2.md`.
