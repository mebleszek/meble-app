# Furniture Calc — aktualna paczka

Aktualna paczka: `site_hardware_dictionary_categories_details_body_fix_v1.zip`.

## Ostatnia zmiana

- Naprawiono akordeon `Kategorie / rodzaje okuć` w słownikach okuć: mechanika wróciła do stabilnego `details/summary`, więc lista kategorii nie powinna być już ucinana do pustej karty na telefonie.
- Wygląd karty pozostaje zgodny ze wzorcem ROZRYS: jedna ramka, cień, chevron i poprawne narożniki.
- Skorygowano testy regresji w `tools/app-dev-smoke.js`, żeby pilnowały realnej treści akordeonu po zamknięciu i ponownym otwarciu.
- Nie zmieniono backupów, storage, import/export Excel, PRO100, usług, RYSUNKU, WYCENY ani zamienników.

## site_hardware_dictionary_category_frame_restore_v1 — 2026-05-24

- Baza: `site_hardware_dictionary_category_no_clip_v1.zip`.
- Poprawiono regresję wizualną wspólnego akordeonu `Kategorie / rodzaje okuć`: zewnętrzna ramka wraca do jednego, spójnego obrysu ROZRYS z zaokrąglonymi rogami i bez „rozjechanych” narożników.
- Zawartość listy kategorii jest teraz w dedykowanym body `hardware-dictionary-category-section-body`, bez klasy `hardware-dictionary-section-body` ani `rozrys-material-accordion__body`, żeby nie dziedziczyć animacji wysokości, która na telefonie ucinała karty.
- Zewnętrzny akordeon ma znowu `overflow:hidden`, więc ramka trzyma kształt; środek ma pełną wysokość i nie ma `max-height`/animacji.
- Test regresji w `tools/app-dev-smoke.js` pilnuje jednocześnie dwóch rzeczy: pełnej treści kategorii po zamknięciu/otwarciu oraz braku powrotu problematycznego body/overflow.
- Zmiana jest tylko UI/UX i testowa: bez zmian backupów, storage, import/export, zamienników, PRO100, ROZRYS jako funkcji, RYSUNKU i WYCENY.

## site_hardware_dictionary_category_no_clip_v1 — 2026-05-24

- Baza: `site_hardware_dictionary_category_body_guard_v1.zip`.
- Dokładnie przeanalizowano powrót pustego/uciętego akordeonu `Kategorie / rodzaje okuć`: samo czyszczenie `max-height` nie wystarczyło, bo body wspólnego akordeonu nadal dziedziczyło klasę `rozrys-material-accordion__body` używaną do animowania wysokości.
- Wspólny akordeon kategorii dostał własne body `hardware-dictionary-category-section-body`, bez klasy animowanego body ROZRYS. Dzięki temu po otwarciu pokazuje pełną listę kategorii, a nie tylko uciętą górę pierwszej karty.
- Zewnętrzny akordeon kategorii ma wymuszone `overflow: visible`, a sama lista kategorii/wiersze/fieldy mają ochronę przed `max-height` i `overflow:hidden`.
- Test regresji w `tools/app-dev-smoke.js` sprawdza teraz, że body kategorii nie używa klasy `rozrys-material-accordion__body` i że używany jest dedykowany, nieclipowany kontener.
- Zmiana jest tylko UI/UX i testowa: bez zmian backupów, storage, import/export, zamienników, PRO100, ROZRYS jako funkcji, RYSUNKU i WYCENY.

## site_hardware_dictionary_category_body_guard_v1 — 2026-05-24

- Baza: `site_hardware_dictionary_category_regression_fix_v1.zip`.
- Przeanalizowano poprawkę regresji akordeonu kategorii i zawężono przyczynę: wspólny akordeon `Kategorie / rodzaje okuć` nadal mógł zostać wizualnie przycięty przez animację `max-height`, przez co na telefonie widoczna była pusta/ucięta karta pierwszej kategorii.
- Wspólny akordeon kategorii dostał bezpieczny tryb otwierania bez przycinania treści: po otwarciu body ma `overflow: visible` i nie zostaje z wymuszonym `max-height`. Animacje mini-akordeonów parametrów technicznych zostają bez zmian.
- Test regresji w `tools/app-dev-smoke.js` został zaostrzony: sprawdza realną zawartość listy kategorii, przycisk `Dodaj kategorię`, przycisk `Usuń`, brak ukrycia body oraz brak stylu przycinającego po zamknięciu i ponownym otwarciu.
- Zmiana jest tylko UI/UX i testowa: bez zmian backupów, storage, import/export, zamienników, PRO100, ROZRYS jako funkcji, RYSUNKU i WYCENY.

## site_hardware_dictionary_category_regression_fix_v1 — 2026-05-24

- Baza: `site_hardware_dictionary_rozrys_accordion_pattern_v1.zip`.
- Naprawiono regresję pustego akordeonu `Słowniki okuć → Kategorie / rodzaje okuć`: stan otwarcia jest nakładany po realnym wyrenderowaniu listy kategorii, a nie na pusty panel przed zbudowaniem treści.
- Dodano zabezpieczenie przed zostawieniem body akordeonu z `hidden` albo zerowym `max-height` po przebudowie zawartości.
- W `dev_ui_patterns.html → Accordion ROZRYS + ruch` oraz w mobile dla akordeonu kategorii ustawiono chevron tak, żeby w małych oknach miał równy oddech od góry, dołu i prawej strony.
- Dodano smoke test regresji: modal słowników musi otworzyć akordeon kategorii z widocznymi wierszami, zamknąć go i ponownie otworzyć bez utraty treści.
- Zmiana jest tylko UI/UX i testowa: bez zmian backupów, storage, import/export, zamienników, PRO100, ROZRYS jako funkcji, RYSUNKU i WYCENY.

## site_hardware_dictionary_rozrys_accordion_pattern_v1 — 2026-05-23

- Baza: `site_hardware_dictionary_category_content_single_open_v1.zip`.
- W `dev_ui_patterns.html → Wzorce UI` akordeon ROZRYS został uzupełniony o dzisiejsze zachowanie ruchu: stara sekcja zamyka się natychmiast, nowa rozwija się płynnie.
- W `Słowniki okuć → Kategorie / rodzaje okuć` dodano widoczny chevron po prawej i spięto wygląd wspólnego akordeonu z klasami ROZRYS.
- Poprawka nie robi globalnej normalizacji całej aplikacji; dotyka tylko wzorca UI i aktualnie poprawianego akordeonu słowników okuć.
- Zmiana jest tylko UI/UX: bez zmian backupów, storage, import/export, zamienników, PRO100, ROZRYS, RYSUNKU i WYCENY.

## site_hardware_dictionary_category_content_single_open_v1 — 2026-05-23

- Baza: `site_hardware_dictionary_categories_accordion_v1.zip`.
- Poprawiono wspólny akordeon `Kategorie / rodzaje okuć`: po rozwinięciu ma pokazywać pełną zawartość listy kategorii, a nie ucięty pusty fragment.
- Akordeon kategorii/rodzajów okuć działa teraz jako kontrolowany panel aplikacyjny, a nie natywne `details`, co stabilizuje widoczność zawartości na telefonie.
- W `Parametry techniczne kategorii` otwarcie jednej kategorii technicznej zamyka pozostałe, żeby podczas przechodzenia między kategoriami nie zostawały rozwinięte długie poprzednie sekcje.
- Zmiana jest tylko UI/UX: bez zmian backupów, storage, import/export, zamienników, PRO100, ROZRYS, RYSUNKU i WYCENY.

# README

## site_hardware_dictionary_categories_accordion_v1 — 2026-05-23

- Baza: `site_hardware_dictionary_param_instant_close_v1.zip`.
- W `Słowniki okuć` cała sekcja `Kategorie / rodzaje okuć` została zamknięta w jeden wspólny akordeon.
- Po zwinięciu tej sekcji zostaje więcej miejsca na `Parametry techniczne kategorii`, bez robienia osobnych akordeonów dla każdej kategorii.
- Lista kategorii i przycisk `Dodaj kategorię` zostają w tym samym miejscu, tylko wewnątrz wspólnego rozwijanego panelu.
- Zmiana jest tylko UI/UX: bez zmian backupów, storage, import/export, zamienników, PRO100, ROZRYS, RYSUNKU i WYCENY.

## site_hardware_dictionary_param_instant_close_v1 — 2026-05-23

- Baza: `site_hardware_dictionary_param_expand_animation_slow_v1.zip`.
- W `Słowniki okuć → Parametry techniczne kategorii` zostawiono płynne rozwijanie nowego mini-akordeonu parametru.
- Zamykanie poprzedniego parametru jest teraz natychmiastowe, bez animowanego zwijania, żeby lista nie wykonywała dziwnych ruchów na telefonie.
- Zachowano sekwencję UX: najpierw płynny scroll do nagłówka klikniętego parametru, potem natychmiastowe zamknięcie starego parametru i płynne rozwinięcie nowego.
- Zmiana jest tylko UI/UX: bez zmian backupów, storage, import/export, zamienników, PRO100, ROZRYS, RYSUNKU i WYCENY.

## site_hardware_dictionary_param_expand_animation_slow_v1 — 2026-05-23

- Baza: `site_hardware_dictionary_param_expand_animation_v1.zip`.
- Wydłużono i ustabilizowano animację rozwijania mini-akordeonów parametrów technicznych w słownikach okuć.
- Start animacji jest pewniejszy dzięki ustawieniu stanu początkowego przed właściwym przejściem wysokości.
- Zmiana jest tylko UI/UX: bez zmian backupów, storage, import/export, zamienników, PRO100, ROZRYS, RYSUNKU i WYCENY.

## site_hardware_dictionary_param_expand_animation_v1 — 2026-05-23

- Baza: `site_hardware_dictionary_param_scroll_before_open_v1.zip`.
- W `Słowniki okuć → Parametry techniczne kategorii` treść mini-akordeonu parametru rozwija się i zwija płynnie, zamiast pojawiać się nagle po doscrollowaniu do nagłówka.
- Zachowano kolejność interakcji: najpierw płynny scroll do nagłówka klikniętego parametru, dopiero potem animowane zwinięcie poprzedniego i rozwinięcie nowego parametru.
- Zostaje zasada jednego otwartego parametru naraz w kategorii oraz krótkie lokalne przewinięcia.
- Zmiana jest UI-only: bez zmian backupu, storage, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU i WYCENY.

## site_hardware_dictionary_param_scroll_before_open_v1 — 2026-05-23

- Baza: `site_hardware_dictionary_param_scroll_target_v1.zip`.
- Poprawiono kolejność animacji mini-akordeonów parametrów technicznych w `Słowniki okuć`: kliknięty, zwinięty parametr najpierw płynnie doscrollowuje do nagłówka, a dopiero potem poprzedni parametr się zwija i nowy się rozwija.
- Dzięki temu kliknięcie parametru z dołu listy nie traci wysokości na starcie scrolla i nie robi szarpnięcia.
- Po zmianie stanu akordeonów pozycja klikniętego nagłówka jest zachowana, więc rozwinięty formularz startuje od góry.
- Zmiana jest UI-only: bez zmian backupu, storage, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU i WYCENY.

## site_hardware_dictionary_param_scroll_target_v1 — 2026-05-23

- Baza: `site_hardware_dictionary_param_scroll_smooth_v1.zip`.
- Naprawiono regresję auto-scrolla mini-akordeonów parametrów technicznych w `Słowniki okuć`: kliknięcie parametru widocznego na dole ekranu nie jest już błędnie uznawane za wystarczające pozycjonowanie.
- Po rozwinięciu parametru główne okno słownika doscrollowuje do nagłówka otwartego parametru z małym marginesem od góry.
- Krótkie lokalne przewinięcia zostają, a ruch jest nadal opóźniony do czasu przeliczenia wysokości akordeonu, żeby ograniczyć szarpnięcie.
- Zmiana jest UI-only: bez zmian backupu, storage, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU i WYCENY.

## site_hardware_dictionary_param_scroll_smooth_v1 — 2026-05-23

- Baza: `site_hardware_dictionary_param_scroll_focus_v1.zip`.
- W `Słowniki okuć → Parametry techniczne kategorii` złagodzono auto-scroll mini-akordeonów parametrów.
- Krótkie, lokalne przewinięcia zostają bez zmian, ale przy otwieraniu parametru z samego dołu lista nie powinna już gwałtownie szarpać na starcie.
- Zamknięcie poprzedniego parametru zachowuje pozycję klikniętego nagłówka, a właściwe doscrollowanie startuje dopiero po ustabilizowaniu wysokości akordeonu.
- Zmiana jest UI-only: bez zmian backupu, storage, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU i WYCENY.

## site_hardware_dictionary_param_scroll_focus_v1 — 2026-05-23

- Baza: `site_hardware_dictionary_param_single_open_v1.zip`.
- W `Słowniki okuć → Parametry techniczne kategorii` rozwinięcie parametru automatycznie doscrollowuje główne okno słownika tak, żeby nagłówek otwartego parametru zaczynał się od góry widocznego obszaru.
- Przy otwieraniu parametru z dołu listy formularz nie startuje już ucięty w połowie; użytkownik widzi początek mini-akordeonu i dopiero potem jego pola.
- Nowo dodany parametr też przewija się do widocznego początku.
- Zmiana jest UI-only: bez zmian backupu, storage, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU i WYCENY.

## site_hardware_dictionary_param_single_open_v1 — 2026-05-23

- Baza: `site_hardware_dictionary_param_accordions_v1.zip`.
- W `Słowniki okuć → Parametry techniczne kategorii` wewnątrz jednej kategorii może być rozwinięty tylko jeden parametr naraz.
- Rozwinięcie kolejnego parametru automatycznie zwija poprzedni, więc na telefonie lista nie robi długiej ściany pól.
- Nowo dodany parametr nadal otwiera się od razu, ale zamyka inne parametry w tej samej kategorii.
- Zmiana jest UI-only: bez zmian backupu, storage, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU i WYCENY.

## site_hardware_dictionary_param_accordions_v1 — 2026-05-23

- Baza: `site_hardware_param_choice_launcher_fix_v1.zip`.
- W `Słowniki okuć → Parametry techniczne kategorii` pojedyncze parametry wewnątrz kategorii są teraz mini-akordeonami z lekkim wcięciem.
- Nagłówek parametru pokazuje skrót: typ pola, sposób porównania, czy jest cechą kluczową, czy buduje typ oraz liczbę dozwolonych wartości.
- Pełne pola edycji parametru pokazują się dopiero po rozwinięciu konkretnego parametru, więc testowanie i uzupełnianie słowników na telefonie jest czytelniejsze.
- Nowo dodany parametr otwiera się od razu.
- Zmiana jest UI-only: bez zmian backupu, storage, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU i WYCENY.

## Hardware dictionary width fix v1 — 2026-05-23

## site_hardware_param_choice_launcher_fix_v1 — 2026-05-23

- Baza: `site_hardware_dictionary_width_fix_v1.zip`.
- Poprawka UI formularza okucia: parametry tekstowe z dozwolonymi wartościami w słowniku pokazują widoczny przycisk wyboru aplikacyjnego.
- Dodano fallback bez natywnego selecta, żeby nie zostawał sam tekst `Wartość: ...` bez możliwości zmiany.
- Bez zmian w backupie, storage, import/export Excel i mechanice zamienników.


- Start z aktualnej bazy `site_hardware_dictionary_full_scroll_v1.zip`.
- Poprawiono szerokość układu parametrów technicznych w modalu `Słowniki okuć` na telefonie: pola parametru, `Typ pola`, `Sposób porównania`, `Dozwolone wartości` i chipy nie są już ucinane poziomo.
- Formularz parametru w słownikach korzysta z pełnej szerokości głównego scrolla modala i na mobile układa wiersze w jedną kolumnę.
- Zmiana jest wyłącznie CSS/UI; nie zmienia backupu, storage, import/export, zamienników ani modelu katalogu okuć.

### 2026-05-23 — hardware param dictionary choices v1
- Start z aktualnej bazy `site_hardware_replacement_button_visibility_fix_v1.zip`.
## Hardware dictionary full scroll v1 — 2026-05-23

- Poprawiono układ modala `Słowniki okuć`: parametry techniczne kategorii nie są już przewijane w małym wewnętrznym okienku. Po rozwinięciu kategorii przewija się główna zawartość modala.
- Stopka akcji została oparta o standardowy wzorzec stopki panelu, a pola parametru technicznego na telefonie układają się w jedną kolumnę.
- Zmiana jest wyłącznie UI/UX; nie zmienia backupu, storage, import/export, zamienników ani modelu katalogu okuć.

- Tekstowe parametry techniczne okuć z dozwolonymi wartościami w słowniku są teraz wybierane w formularzu okucia przez launcher/listę aplikacyjną, bez natywnego selecta widocznego dla użytkownika.
- Wartości spoza słownika są czyszczone: stare ręczne wpisy nie są chronione i pole pozostaje puste, dopóki użytkownik nie wybierze wartości ze słownika.
- W słownikach zmieniono opis pola na `Dozwolone wartości` i dodano instrukcję pod ikoną `?`, jak trzymać spójne wartości do porównywania zamienników.
- Nie ruszono backupów, polityki retencji, import/export Excel, PRO100, ROZRYS, RYSUNKU ani WYCENY.

### 2026-05-23 — hardware replacement button visibility fix v1
- Start z aktualnej bazy `site_hardware_replacement_preview_ui_v1.zip`.
- Poprawiono widoczność przycisku `Zamienniki` w modalu edycji okucia: moduł tworzy/odnajduje przycisk pod `Wyjdź` i buduje źródło porównania także z bieżącego draftu formularza.
- Podgląd nadal jest tylko listą kandydatów bez zapisu zmian; nie dodano akcji `Zamień`.
- Nie ruszono backupów, import/export Excel, PRO100, ROZRYS, RYSUNKU ani WYCENY.

### 2026-05-23 — hardware replacement preview UI v1
- Start z aktualnej bazy `site_data_safety_backup_limit_policy_test_v2.zip`.
- W modalu edycji okucia dodano przycisk `Zamienniki` pod `Wyjdź`.
- Przycisk pokazuje listę zamienników jako podgląd: pasujące i najbliższe odrzucone kandydaty, z ceną `Do wyceny` oraz powodami dopasowania/odrzucenia.
- Podgląd korzysta z technicznego silnika zamienników, nie zapisuje zmian do katalogu, projektów ani storage.
- Nie dodano jeszcze właściwej akcji `Zamień`; nie ruszono import/export, backupów, PRO100, ROZRYS, RYSUNKU ani WYCENY.

### 2026-05-21 — hardware compare modes / storage cleanup v1
- Start z aktualnej bazy `site_000_hardware_edit_modal_perf_fix_v1.zip`.
- Nie zmieniono UI ani miejsca ustawiania zasad szukania zamienników; dalej są w słownikach parametrów technicznych kategorii okuć.
- Tryb porównania `Mieści się w zakresie` wymaga teraz pełnego objęcia wymaganej wartości/zakresu przez zamiennik; częściowe przecięcie zakresów należy do trybu `Zakresy się przecinają`.
- Dodano testy negatywne dla porównywania zakresów i uzupełniono diagnostykę storage/backup dla słowników okuć.

### 2026-05-18 — dev tests errors fix v1
- Naprawiono błędy `dev_tests.html` po Etapie 2A: test potwierdzeń importu okuć nie używa już `.find()` bezpośrednio na `NodeList`.
- Launcher wyboru w modalu szafki synchronizuje draft także wtedy, gdy wybrana wartość jest już ustawiona w ukrytym selectcie.
- Dodano kontrakty smoke dla obu regresji; bez zmian modelu danych, storage, PRO100, ROZRYS i WYCENY.

### 2026-05-14 — pro100 file import v1
- Modal `Import PRO100` w drobnych usługach stolarskich obsługuje teraz nie tylko wklejkę, ale też pliki `.xlsx`, `.csv`, `.tsv` i `.txt`.
- XLSX jest czytany z pierwszego arkusza przez istniejący moduł `xlsxLite`; puste wiersze i nagłówek są pomijane.
- Wczytany plik idzie przez ten sam parser, podgląd, wykrywanie brakujących kolorów, ptaszek `Ma słoje` i zapis do `cutting.parts` co ręczne wklejenie tabeli.

### 2026-05-13 — hardware missing supplier duplicate fix v1
- Import `Ceny_dostawcow` poprawnie otwiera resolver wyboru dostawcy dla ceny istniejącego okucia nawet wtedy, gdy to samo okucie jest równocześnie w aktualnym katalogu i w arkuszu `Okucia`.
- Śmieciowy albo nierozpoznany dostawca, np. przypadkowe `14`, nie powoduje już cichego pominięcia ceny, jeśli `producent + symbol` wskazują istniejące okucie.
- Zasada pozostaje bez zmian: dostawca jest wybierany tylko z istniejącej listy, a resolver nie tworzy nowych dostawców.

### 2026-05-12 — hardware supplier missing resolver v1
- Import `Ceny_dostawcow` dla istniejącego okucia z pustym albo nierozpoznanym dostawcą otwiera resolver wyboru dostawcy zamiast pomijać cenę.
- Dostawcę można wybrać tylko z istniejącej listy programu albo z arkusza `Dostawcy` w importowanym XLSX; resolver nie tworzy nowych dostawców.
- Po wyborze dostawcy import aktualizuje lub dodaje cenę po kluczu `producent + symbol + dostawca`.
- `Ignoruj wszystko` pomija wszystkie nierozwiązane ceny z brakującym dostawcą w tym imporcie.

### 2026-05-12 — hardware import create item resolver v1
- Import `Ceny_dostawcow` nie tworzy już nowych okuć z automatyczną kategorią `Inne` i jednostką `szt.`.
- Nowe okucie z arkusza cen wymaga wyboru kategorii i jednostki w aplikacyjnym resolverze braków albo podania ich w Excelu.
- Resolver importu ma przycisk `Dodaj kategorię`, który zapisuje nową kategorię w słowniku i udostępnia ją w kolejnych wyborach.
- Arkusz `Ceny_dostawcow` ma teraz kolumny `kategoria` i `jednostka`; dopasowanie cen nadal idzie po `producent + symbol + dostawca`, nie po numerze wiersza Excela.

### 2026-04-26 — app shell storage boundary stage 1
- `js/app/bootstrap/reload-restore.js` now owns session-scoped reload/scroll restore.
- `js/app.js` no longer directly references `localStorage` or `sessionStorage`; it only delegates reload/restore through the app shell boundary.
- `js/app/shared/storage.js` exposes small session helpers used by the reload boundary.
- APP smoke test coverage now includes the reload/restore contract.

### 2026-04-24 — data safety foundation
- Added a system-wide backup module for all app data (`fc_*` localStorage keys), not just investors.
- Start screen now has a gear settings entry for `Dane programu`: create backup, save safe state, export/import JSON, restore saved backup, pin/delete backups, copy diagnostics.
- Dev tests now use the same backup module before each run and always cleanup marked test data after runs.

### 2026-04-24 — investor storage recovery visibility fix
- Normal app hides leaked developer-test investors and can recover missing investor records from the edit-session snapshot as well as project/quote stores.
- Updated cache-busting for `investors-store.js`.

# meble-app
Program do wyceny mebli i rozwijania modułów projektowania / rozkroju.

## Zasady pracy nad repo

- Nie zmieniać UI ani sposobu prezentacji bez zgody użytkownika.
- Po każdej serii zmian przygotować pełny `site.zip` z całą strukturą repo.
- W paczce zawsze muszą być `README.md` i `DEV.md`.
- Kolejne zmiany robić zawsze na ostatnim ZIP-ie wygenerowanym w rozmowie.


## Etap architektury — 2 tryby pracy (stage 1)

Program startuje teraz z 2 głównych wejść:
- `Projekty meblowe`
- `Drobne usługi stolarskie`

W tej paczce wdrożono pierwszy bezpieczny etap rozdzielenia odpowiedzialności:
- ekran startowy prowadzi do 2 osobnych hubów kontekstowych,
- cenniki nie są już pokazywane jako jedno wspólne centrum na starcie,
- katalog danych został logicznie rozdzielony na:
  - `sheetMaterials` / materiały arkuszowe,
  - `accessories` / akcesoria,
  - `quoteRates` / stawki wyceny mebli,
  - `workshopServices` / usługi stolarskie,
  - `serviceOrders` / drobne zlecenia usługowe.

### Nowe aktywne moduły stage 1

- `js/app/catalog/catalog-store.js` — centralny store katalogów; rozdziela legacy `materials/services` na nowe byty i utrzymuje kompatybilność wsteczną.
- `js/app/ui/work-mode-hub.js` — render 2 trybów pracy i kontekstowych wejść po wejściu w dany tryb.
- `js/app/service/service-orders.js` — osobna lista i edytor drobnych zleceń usługowych.

### Zakres etapu 1

To jeszcze nie jest pełna przebudowa całej domeny pod chmurę.
Etap 1 porządkuje wejścia, routing i podstawowe byty danych bez przepinania całego projektu meblowego i całej wyceny na nowy model naraz.

## Testy developerskie

- `dev_tests.html` — główna, użytkowa strona testów w przeglądarce.
- `js/testing/rozrys/tests.js` — cienki runner testów ROZRYS. Szczegółowe suite'y są w `js/testing/rozrys/suites/*`; nie scalać ich ponownie w jeden duży plik.
- `tools/app-dev-smoke.js` — cienki runner techniczny Node dla APP; szczegóły środowiska smoke są w `tools/app-dev-smoke-lib/`.
- `tools/local-storage-source-audit.js` — źródłowy audyt bezpośrednich użyć `localStorage` / `sessionStorage`.
- `OPTIMIZATION_PLAN.md` — plan wspólnych mechanik, duplikacji i kolejności porządkowania.

## Deploy (GitHub Pages)

Do repo trafia pełna paczka `site.zip` w root.
Workflow wypakuje ZIP do roota, usunie ZIP i zrobi commit.

## Główne aktywne pliki

- `index.html` — struktura widoków i kolejność ładowania skryptów
- `css/base-ui.css` — bazowe zmienne i fundament UI, ładowany jako pierwszy plik stylów.
- `css/app-runtime.css`, `css/cabinet-common.css`, `css/drawing-home-confirm.css`, `css/shared-overlays-choice.css`, `css/rozrys-main.css`, `css/investor-table-sync.css`, `css/wycena.css`, `css/wywiad.css` — pełny split dawnego `css/style.css` na ciągłe bloki ładowane w tej samej kolejności co dawny monolit.
- `css/style.css` — pusty placeholder zgodności po pełnym splicie CSS; nie dokładać tu nowych reguł.
- `js/boot.js` — preflight + banner błędów
- `js/core/actions.js` — Actions registry + walidacja `data-action`
- `js/core/modals.js` — obsługa modali
- `js/app/ui/bindings.js` — delegacja klików + listenery
- `js/app/ui/actions-register.js` — rejestr akcji UI
- `js/app.js` — główny klej aplikacji; renderery `WYWIAD`, `MATERIAŁ` i `RYSUNEK` są już przeniesione do `js/tabs/*`
- `js/app/rozrys/rozrys.js` — zakładka rozrysu / Optimax
- `js/app/optimizer/cut-optimizer.js` — silnik rozkroju

## Uwaga architektoniczna

Repo zawiera też pliki pomocnicze / historyczne, które nie zawsze są bezpośrednio ładowane przez `index.html`.
Przed edycją zawsze trzeba sprawdzić, czy plik jest aktywnym entrypointem, workerem, czy legacy.

Szczegóły utrzymywać i aktualizować w `DEV.md`.


- `js/app/material/price-modal.js (renderer + akcje modala cenników)` — wydzielony renderer modala cenników; `app.js` ma być tu tylko delegatorem.
- Martwy helper `renderFinishList()` został usunięty z `app.js`; aktywna logika wykończeń dla RYSUNKU ma siedzieć w module zakładki.


- `js/app/ui/tab-navigation.js` — centralna nawigacja zakładek i skoki między WYWIAD ↔ MATERIAŁ; źródło prawdy dla `setActiveTab()` i helperów focus/scroll.
- `js/app/ui/layout-state.js` — helpery layoutu/wykończeń RYSUNKU i zapisu projektu; źródło prawdy dla `ensureLayout()`, `saveProject()` i pokrewnych helperów.


- `js/app/material/material-common.js` — wspólne helpery materiałowe i formatowanie wydzielone z `app.js`.
- `js/app/material/material-edge-store.js` — store oklein/obrzeży dla zakładki MATERIAŁ: podpisy formatek, domyślne krawędzie, zapis `fc_edge_v1` i liczenie mb.
- `js/app/material/material-tab-data.js` — model danych zakładki MATERIAŁ: zbiera szafki, cutlisty, sumy m² i mb oklein przed renderem.

- `js/app/cabinet/front-hardware.js` — cienki shell kompatybilności dla front-hardware; logika jest w `front-hardware-weights.js`, `front-hardware-fronts.js`, `front-hardware-hinges.js` oraz splicie AVENTOS (`front-hardware-aventos-data.js`, `front-hardware-aventos-calc.js`, `front-hardware-aventos-selector.js`, `front-hardware-aventos.js`).
- `js/app/cabinet/cabinet-fronts.js` — reguły typów/podtypów, fronty, walidacja AVENTOS i generowanie frontów; źródło prawdy dla logiki frontów używanej przez modal i materiały.
- `js/app/cabinet/cabinet-modal.js` — pełna logika modala szafki i kreatora zestawów; źródło prawdy dla renderu modala, dynamicznych pól i zapisu zestawów.


- `js/app/shared/calc.js` — aktywny moduł lekkich helperów obliczeniowych (wysokość góry, top zestawów).


- `js/app/ui/settings-ui.js` — helpery ustawień pokoju i rozwijania kart wyjęte z `app.js`.


- `js/app/cabinet/cabinet-summary.js` — helper tekstowych podsumowań szafek wydzielony z `app.js`.


- Step 17: safe dead-code cleanup in `js/app.js` (removed unused `deleteSelectedCabinet()` and duplicate/trailing ballast comments).


- `js/app/cabinet/corner-sketch.js` — helper canvas szkicu narożnych szafek; wydzielony z `app.js` bez zmiany UI.


- `js/app/cabinet/cabinet-cutlist.js` — helper obliczeniowy `getCabinetCutList(cab, room)` wydzielony z `app.js` z fallbackiem wstecznym.


- `js/app/investor/project-bootstrap.js` — boot-time normalization helpers for project data; keep app.js lighter without changing UI.


- `js/app.js` deleguje lekki, globalny debounce autosave projektu (`installProjectAutosave` / `scheduleProjectAutosave`) do `js/app/investor/project-autosave.js` jako bezpiecznik na wypadek, gdy pojedynczy handler zmiany nie zapisze stanu od razu.

- Refresh behavior: normal page refresh no longer forces a return to Home; manual safe reset is available via `?safe=1` (and legacy `?reset=1`).

- Router widoków preferuje aktywny projekt (`roomType`) nad starym `entry: home`, żeby zwykły refresh nie wyrzucał na start.

- `js/app.js`: fallbacki dla `drawCornerSketch()` i `getCabinetExtraSummary()` zostały uproszczone do cienkich delegatorów; źródłem prawdy są moduły `js/app/cabinet/corner-sketch.js` i `js/app/cabinet/cabinet-summary.js`.


Step 24: `app.js` further trimmed by reducing duplicated `material-common` and `front-hardware` wrappers to thin delegators with minimal fallbacks.

- `js/app.js` trzyma już tylko minimalny awaryjny fallback dla `getCabinetCutList()`; pełna logika siedzi w `js/app/cabinet/cabinet-cutlist.js`.


- `js/app/cabinet/cabinet-actions.js` — proste akcje szafek (dodanie/usunięcie) wydzielone z `app.js`.
- `js/app/cabinet/cabinet-actions.js` i `js/app/cabinet/cabinet-summary.js` są teraz również ładowane bezpośrednio przez `index.html`, więc `app.js` nie musi utrzymywać rozbudowanych fallbacków tylko z powodu braku skryptu.

- `project-bootstrap.js` ładowany tylko raz w `index.html`; usunięty duplikat include.

- js/app.js korzysta już z preładowanych modułów constants/utils/storage/ui-state jako źródeł prawdy; bezpośrednie `localStorage` / `sessionStorage` zostały przeniesione poza `app.js`.


- `js/app/shared/public-api.js` — publiczne bezpieczne API FC/App (boot/init, openRoom, safe akcje modali i zakładek).


- `js/app/shared/core-failsafe.js` — awaryjne minimalne fallbacki dla `FC.actions` i `FC.modal`, ładowane przed `app.js`.
- `js/app/shared/dom-guard.js` — walidacja wymaganych selektorów DOM, ładowana przed `app.js`.


- Step 33: trimmed app.js wrappers for dom-guard, project-bootstrap and calc/settings by delegating to preloaded modules with minimal local fallbacks.

- `js/app/investor/project-autosave.js` — aktywny runtime boundary autosave ładowany jawnie w `index.html` i `dev_tests.html`; globalny debounce autosave projektu i instalacja lekkiego bezpiecznika autosave dla zmian w obszarze aplikacji.


## Update
- Aktywowane moduły techniczne przed `app.js`: `js/app/shared/migrate.js`, `js/app/shared/schema.js`.
- `app.js` deleguje teraz normalizację projektu/room do `FC.schema` z lekkim fallbackiem awaryjnym.


- `js/app/material/material-registry.js` — registry producentów i helper `materialHasGrain()` wydzielone z `app.js`.

- `schema.js` is now the primary source of truth for project/room normalization; `app.js` keeps only a minimal emergency fallback.
- `js/app/material/material-registry.js` jest źródłem prawdy dla producentów materiałów i helpera `FC.materialHasGrain(...)`.

## Testy developerskie ROZRYS

Repo ma teraz prostą warstwę anty-regresyjną dla ROZRYS.

### Wariant 1 — skrypt Node

Uruchom w katalogu projektu:

```bash
node tools/rozrys-dev-smoke.js
```

Skrypt sprawdza podstawowe rzeczy bez odpalania całej aplikacji:
- store stanu ROZRYS,
- model arkuszy i magazynu,
- walidację planu,
- stabilność cache,
- prosty plan engine,
- strukturę HTML wydruku.

Jeśli któryś test nie przejdzie, skrypt kończy się błędem.

### Wariant 2 — strona developerska

Otwórz w przeglądarce plik:

- `dev_tests.html`

Na stronie jest przycisk `Uruchom testy ROZRYS`, który pokazuje wynik PASS/FAIL dla przygotowanych smoke-testów.

### Ważne

To nie zastępuje końcowego sprawdzenia działania UI na realnych danych.
To jest techniczna siatka bezpieczeństwa, która ma szybciej wyłapywać regresje po dużych zmianach w ROZRYS.


## ROZRYS — strona testowa

Plik `dev_tests.html` uruchamia smoke-testy ROZRYS przez stronę.
Po kliknięciu `Uruchom testy ROZRYS` pokazuje czytelny raport: co przeszło, co nie przeszło, krótki powód błędu oraz podsumowanie `X/Y OK`.
Raport ma też akcje `Kopiuj raport` oraz `Kopiuj tylko błędy`, żeby łatwo przenieść samą listę niezaliczonych testów.
Przycisk `Kopiuj raport` pozwala szybko skopiować wynik do wklejenia w rozmowie.


### ROZRYS smoke — dodatkowy test agregacji projektu
Strona `dev_tests.html` sprawdza już nie tylko cache/walidację/magazyn, ale też regresję pustego ROZRYS: test `ROZRYS buduje materiały z projektu i resolvera cutlist` pilnuje, żeby prosty projekt z szafką nie kończył się komunikatem o braku materiałów.


## Struktura katalogów po porządkach architektonicznych

- `js/app/shared/` — helpery wspólne, storage, validate, public API, lekkie utils
- `js/app/ui/` — routing zakładek, bindings, boxy/modale współdzielone, pamięć scrolla, helpers layoutu
- `js/app/cabinet/` — logika szafki, frontów, okuć, cutlisty i modala szafki
- `js/app/investor/` — inwestor, sesja projektu, bootstrap/autosave projektu
- `js/app/material/` — rejestr materiałów, magazyn, opcje formatek, cenniki
- `js/app/optimizer/` — solver, worker i profile szybkości/startu
- `js/app/rozrys/` — cały obszar ROZRYS
- `js/testing/` — strony i moduły smoke-testów developerskich

### Strony testowe

- `dev_tests.html` — smoke-testy ROZRYS
- `dev_tests.html` — smoke-testy projektu, materiałów i szafek


## 2026-04-07 — etap 2 trybów pracy
- Dodano moduły `js/app/catalog/catalog-domain.js` i `js/app/catalog/catalog-migration.js` jako wspólną warstwę domeny katalogów oraz migracji legacy danych.
- `catalog-store.js` korzysta teraz z tych modułów i publiczne `migrateLegacy()` domyślnie przebudowuje split z legacy danych, a init aplikacji zachowuje bezpieczne preferowanie już rozdzielonych katalogów.
- Dodano wspólny modal zarządzania pomieszczeniami inwestora przez `roomRegistry.openManageRoomsModal()`.


- 2026-04-07 stage2 fix v2: rozdzielono draft wspólnego modala pomieszczeń od sesji projektu/inwestora, `Anuluj` w modalu pomieszczeń resetuje tylko lokalne zmiany bez zamykania okna, a `dev_tests.html` ładuje już `constants.js` i `storage.js`, dzięki czemu testy katalogów używają prawdziwych kluczy storage. Dodatkowo ROZRYS dopuszcza retry dla niestandardowych kluczy pomieszczeń także przy aktywnym inwestorze.

## Etap 3 architektury — rozdzielenie domen

Aplikacja ma teraz dodatkową warstwę przygotowującą ją pod chmurę i dalszy rozwój bez mieszania odpowiedzialności:

- `project-model / project-store` — oddzielają dane projektu meblowego od samego inwestora,
- `service-order-store` — daje osobny byt dla drobnych zleceń usługowych,
- `catalog-selectors` — daje wspólne selektory katalogów dla modułów biznesowych,
- `quote-snapshot` — buduje czysty snapshot wyceny meblowej z materiałów, akcesoriów i stawek.

Na tym etapie UI nie został przebudowany szeroko — zmiana dotyczy głównie architektury danych, warstw pośrednich i antyregresji. Dzięki temu kolejne kroki (np. PDF wyceny, historia wycen, chmura, wieloprojektowość) można wdrażać bez rozpruwania całej aplikacji.


## 2026-04-08 boot fix
- Przywrócono jawne wystawianie startu aplikacji (`FC.init`, `App.init`, `initApp`, `initUI`) z `js/app.js`.
- `js/boot.js` dostał awaryjne doładowanie `js/app.js` i `js/app/shared/public-api.js`, jeśli po starcie strony nie ma funkcji init.

- 2026-04-08: Boot/start hardening: app now exposes init earlier, and stale roomType after deleted investor/test cleanup falls back safely instead of crashing renderCabinets.

## 2026-04-08 — etap 4 cleanup + snapshoty
- testy developerskie oznaczają dane testowe markerem `meta.testData` i sprzątają je po uruchomieniu, bez ruszania realnych danych;
- `dev_tests.html` ma też ręczny przycisk `Usuń dane testowe`;
- wycena ma osobny magazyn snapshotów (`quoteSnapshotStore`) przygotowany pod późniejszy PDF klienta i historię wycen;
- `serviceOrderStore` i `investors` zachowują metadane rekordów, co ułatwia późniejszą migrację do chmury i bezpieczny cleanup.


## 2026-04-08 — Stage 5: quote PDF + snapshot history
- W zakładce Wycena dodano niebieski przycisk PDF oparty o zapisany quoteSnapshot, a nie o DOM.
- Dodano historię snapshotów wyceny dla bieżącego projektu z akcjami Podgląd i PDF.


## 2026-04-08 — Stage 5B: quote history UX polish
- `Historia wycen` w `Wycena` ma teraz zwarte, niskie karty zamiast wysokich pustych pól.
- Kliknięcie `Podgląd` wyraźnie oznacza oglądany snapshot i automatycznie przewija do aktywnego podglądu wyceny.
- Aktywny wpis historii ma wyróżniony stan i nie udaje, że nic się nie stało po przełączeniu snapshotu.

- Stage 6: Wycena ma pola handlowe, robociznę/stawki meblowe, snapshot oferty i PDF klienta zgodny z wybraną wersją.

- Etap historii ofert: sekcja handlowa w Wycena działa jako accordion; snapshot oferty można usunąć lub oznaczyć jako zaakceptowany, co ustawia status projektu na `zaakceptowany`.

## 2026-04 quote status sync
- Wycena obsługuje flagę wstępnej wyceny, akceptację wstępnej -> Pomiar oraz akceptację właściwej wyceny -> Zaakceptowany.
- Ręczna zmiana statusu projektu w Inwestorze synchronizuje stan zaakceptowanej oferty w Wycena.


## 2026-04-10 preliminary quote fix
- removed project status `Po pomiarze`; after measurement use `Wycena` directly
- preliminary quote drafts now survive scope switch from investor-only to project-bound draft
- preliminary history entries are archived only when a newer normal quote exists

- 2026-04-12: zaległe testy działowe — dodano `js/testing/service/tests.js` z osobną sekcją `USŁUGI` dla store zleceń usługowych, listy statusów, upsertu bez duplikatów i cleanup testowych rekordów. `dev_tests.html` dostał osobne przyciski uruchamiania działów: PROJEKT, INWESTOR, MATERIAŁY, WYCENA, SZAFKI, USŁUGI, a runner Node `tools/app-dev-smoke.js` został rozszerzony o nową sekcję testów.

- 2026-04-12: cross smoke tests for `Wycena` now cover status sync with `Inwestor`, room selection filtered through `ROZRYS`, and final client PDF after converting a preliminary quote.


### Dodatkowe testy fundamentu danych
- `INWESTOR`: smoke testy obejmują teraz synchronizację statusu projektu z `projectStore` i historią ofert oraz bezpieczną aktualizację pojedynczego pomieszczenia.
- `MATERIAŁY`: smoke testy pilnują, że zapis płyt nie miesza akcesoriów z materiałami arkuszowymi i że migracja `preferStoredSplit` nie przywraca legacy danych przy pierwszym starcie.
- `USŁUGI`: smoke testy obejmują spójność `catalogStore` ↔ `serviceOrderStore` oraz brak pustego rekordu przy tworzeniu szkicu zlecenia.

- 2026-04-12: Naprawiono synchronizację `catalogStore` ↔ `serviceOrderStore` dla zleceń usługowych i dodano regresję pod odczyt po bezpośrednim zapisie do store.

### 2026-04-24 — session test include fix
- Naprawiono stronę testów aplikacji: `dev_tests.html` ładuje teraz moduł sesji inwestora przed testami projektu, więc test `FC.session.begin` ma dostęp do właściwego API.
- Podbito cache-busting dla `session.js`.



## 2026-04-24 — AVENTOS message tones
- Przywrócono kolory komunikatów AVENTOS: czerwony błąd, pomarańczowe ostrzeżenie, zielony komunikat OK/zalecenie.


### 2026-04-24 — AVENTOS API/message fix
Przywrócono kompatybilne globalne API AVENTOS po splicie hardware i naprawiono czerwony/pomarańczowy/zielony komunikat walidacji.


### 2026-04-24 — investor recovery leak fix
- Naprawiono przypadek, w którym po przerwanym teście developerskim lista inwestorów mogła pokazać tylko fixture `Jan Test` i blokować odzysk pozostałych rekordów z projectStore/snapshotów.
- Dane testowe są teraz mocniej oznaczane i sprzątane przez cleanup testów.

## 2026-04-25 — settings menu shell
- Startowy trybik `⚙` otwiera teraz menu ustawień, a `Backup i dane` jest osobnym, głębszym panelem.
- Panel backupów używa akordeonów dla danych użytkownika i danych technicznych oraz ma czytelniejsze nazwy akcji backupu.



## Dokumenty techniczne

- `DEV.md` — aktywne zasady rozwoju i workflow paczek.
- `CLOUD_MIGRATION.md` — zasady danych, storage i przyszłej migracji do chmury.
- `OPTIMIZATION_PLAN.md` — plan optymalizacji i scalania wspólnych mechanik.
- `DEPENDENCY_MAP.md` — mapa zależności, wpływu drugiego poziomu i kolejności bezpiecznych refaktorów.
- `tools/dependency-source-audit.js` — narzędzie generujące raporty `tools/reports/dependency-source-audit.md/json`.


## 2026-05-11 — Hardware import bulk/diff/types fix v1

- Import cen dostawców obsługuje hurtowe wklejanie po `producent + symbol + dostawca` bez ręcznego pilnowania ID.
- Puste `typ_cecha` w okuciu pozostaje puste; słownik typów jest listą opcji, a nie automatycznym wyborem.
- Podgląd importu rozróżnia okucia/ceny bez zmian od realnie zmienionych rekordów.


## Hardware supplier price create item v1 — 2026-05-12

- Import XLSX okuć pozwala utworzyć nowe okucie z arkusza `Ceny_dostawcow`, gdy wiersz ma istniejącego producenta, symbol, nazwę, istniejącego dostawcę i cenę.
- Nie wymaga ręcznego `okucie_id`; nie tworzy producentów z literówek.
- Brakująca `data_ceny` dla nowej lub zmienionej ceny jest uzupełniana przy imporcie i widoczna po kolejnym eksporcie.


## Hardware import resolver supplier gap v1 — 2026-05-12

- Poprawiono import nowych okuć z arkusza `Ceny_dostawcow`: brakujący dostawca, kategoria i jednostka trafiają do aplikacyjnego uzupełnienia zamiast cichego pominięcia wiersza.
- Usunięto fałszywe ostrzeżenia o duplikatach `producent + symbol`, gdy plik importu pochodził z eksportu tego samego katalogu.

## Hardware price change confirmation v1 — 2026-05-13

- Import XLSX cen dostawców pokazuje teraz świadome potwierdzenia przed dodaniem nowej ceny dostawcy albo aktualizacją istniejącej ceny.
- Przy aktualizacji widać starą i nową cenę; przy cenie `Do wyceny` pojawia się ostrzeżenie, że zmiana wpłynie na przyszłe wyceny.
- Dostępne są akcje pojedyncze i hurtowe: dodanie/aktualizacja jednej ceny, dodanie wszystkich nowych cen, aktualizacja wszystkich zmian albo pominięcie podobnych zmian.

## Hardware global VAT + import stabilization v1 — 2026-05-13

Aktualna paczka stabilizuje import/eksport katalogu okuć:

- VAT okuć jest globalny w ustawieniach cen okuć;
- dostawca ma rabat, ale nie ma własnego VAT-u;
- eksport `Dostawcy` w XLSX nie zawiera już kolumny VAT dostawcy;
- podgląd importu cen nie zmienia katalogu przed zatwierdzeniem;
- cache-busting zmienionych modułów: `20260513_hardware_global_vat_import_stabilization_v1`.


### site_catalog_seed_dev_tests_fix_v1.zip — 2026-05-13

- Poprawiono testy developerskie katalogów po wprowadzeniu realnych seedów okuć.
- Testy migracji nie traktują już seedów okuć jako błędnego „niewydzielenia akcesoriów”.
- Runtime aplikacji, import/export XLSX oraz model VAT/rabatów nie były zmieniane.



## Hardware import/export refactor v1 — 2026-05-14

- Import/export katalogu okuć został rozdzielony na mniejsze moduły bez zmiany UI i bez zmiany sposobu pracy użytkownika z Excelem.
- Publiczne API zostaje pod fasadami `FC.hardwareCatalogImportExport` i `FC.hardwareSupplierPriceXlsx`, więc istniejące okna importu, resolvery i potwierdzenia cen działają przez te same wejścia.
- Logika arkusza `Ceny_dostawcow` jest rozdzielona na eksport oraz import/matching/diff, a import katalogu na parser, plan i apply.
- Dodano testy architektoniczne i rozszerzono smoke akcesoriów do 39 testów.


## Hardware import/export deep tests v1 — 2026-05-14

- Dodano głębokie testy importu/eksportu okuć po refaktorze import/export.
- Nowy plik testów: `js/testing/material/accessories-import-export-deep-tests.js`.
- Nowe narzędzie developerskie:

```bash
node tools/hardware-import-export-deep-smoke.js
```

- Testy są też podpięte pod `dev_tests.html` → `MATERIAŁY`, więc można je uruchomić w przeglądarce razem z pozostałymi testami materiałów i akcesoriów.
- Paczka nie zmienia runtime aplikacji ani UI; rozszerza wyłącznie zabezpieczenia regresyjne.

## PRO100 service import v1 — 2026-05-14

- W drobnych usługach stolarskich dodano import wklejki formatek z PRO100.
- Format: `nazwa | długość wzdłuż słoja | oklejanie długości | szerokość | oklejanie szerokości | grubość | ilość | kolor`.
- Znaki oklejania: `=` dwie krawędzie, `-` jedna krawędź, puste pole brak oklejania.
- Import dopisuje formatki do istniejącego zlecenia usługowego albo zastępuje listę formatek.
- Brakujące kolory/dekory można dodać do katalogu materiałów z ptaszkiem `Ma słoje`; decyzja ta wpływa na usługowy ROZRYS.
- Usługowy ROZRYS grupuje formatki po materiale/grubości, żeby nie mieszać różnych płyt w jednym planie.
- Nowe narzędzie testowe:

```bash
node tools/service-pro100-dev-smoke.js
```

## Room preferences stage1 v1 — 2026-05-15

- W WYWIADZIE nad listą szafek dodano dwa akordeony: `Parametry pomieszczenia` oraz `Preferencje standardu`.
- Preferencje są zapisane przy konkretnym pomieszczeniu jako `room.preferences`, bez osobnego storage i bez globalnego ustawienia aplikacji.
- Modal preferencji obejmuje: standard wykończenia, standard blend, korpus, materiał/kolor frontu, plecy, otwieranie dolnych/stojących, górnych/wiszących i modułu oraz preferowanego producenta okuć.
- `Standard okuć` nie został dodany, zgodnie z decyzją, że później używany ma być najlepszy sensowny wariant danej firmy.
- Nowa szafka w pustym pomieszczeniu bierze domyślne wartości z preferencji, a kolejna szafka w tym samym pomieszczeniu klonuje ostatnią bez limitu czasowego.
- Istniejące szafki nie są zmieniane po zapisie preferencji; hurtowe zastosowanie preferencji zostaje osobnym etapem.

## Deploy unzip workflow fix v1 — 2026-05-16

- Poprawiono workflow rozpakowywania paczek `site*.zip` do roota repozytorium.
- ZIP do wdrożenia wybierany jest z bieżącego commita, a nie po czasie pliku z checkoutu GitHub Actions.
- Workflow może aktualizować `.github` z pełnej paczki, jeżeli paczka zawiera poprawiony katalog workflowów.
- Zmiana nie wpływa na działanie aplikacji; dotyczy tylko wdrażania paczek na GitHub Pages.

## Room accordion inline v1 — 2026-05-16

- W WYWIADZIE `Parametry pomieszczenia` i `Preferencje standardu` są teraz domyślnie zwiniętymi akordeonami.
- Po rozwinięciu parametry i preferencje są dostępne od razu w treści akordeonu, bez dodatkowego przycisku otwierającego modal.
- Akordeony dostały styl zgodny z ROZRYS: mocniejsza ramka, cień i zielona strzałka rozwijania.
- Preferencje dalej dotyczą nowych szafek; istniejące szafki nie są zmieniane po cichu.

## Program defaults settings v1 — 2026-05-16

- W trybiku na stronie głównej dodano sekcję `Domyślne materiały i okucia`.
- Sekcja zapisuje globalne fallbacki programu pod kluczem `fc_program_defaults_v1`, objętym backupem danych.
- Materiały obejmują: domyślny korpus, materiał frontu, kolor frontu i plecy.
- Okucia obejmują preferowane marki dla: zawiasów, szuflad/prowadnic, podnośników, systemów przesuwnych oraz cargo/organizerów.
- Nowa pierwsza szafka w pustym pomieszczeniu może korzystać z globalnych domyślnych materiałów, a preferencje konkretnego pomieszczenia z WYWIADU mają nad nimi pierwszeństwo.
- Nie dodano sekcji `Domyślne` do WYWIADU pokoju; przyszłe preferencje pomieszczenia mają iść strefowo: dolna, środkowa, górna.

## Program defaults UI fix v1 — 2026-05-16

- Poprawiono sekcję `Domyślne materiały i okucia` w trybiku strony głównej.
- Usunięto natywne/systemowe selecty z tej sekcji; wybory są teraz launcherami aplikacyjnymi w stylu ROZRYS.
- Usunięto zbędne liczniki `4` i `5` przy akordeonach `Materiały` i `Okucia`.
- Akordeony tej sekcji dostały wygląd bliższy ROZRYS: ramka, cień, nagłówek i zielony chevron.
- Nie zmieniono modelu danych ani klucza `fc_program_defaults_v1`.

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

- Dodano fundament źródła materiału frontów specjalnych: front może być `jak strefa dolna / stojące`, `jak strefa środkowa / moduły`, `jak strefa górna / wiszące` albo `własny materiał`.
- Zakres etapu obejmuje lodówki w zabudowie oraz fronty zestawów szafek; nie dodano jeszcze tabeli frontów wieloczęściowych.
- Lodówka z 2 frontami może mieć osobno źródło materiału dla dolnego i górnego frontu. Lodówka z 1 frontem ma jedno źródło materiału frontu.
- Zestaw szafek ma wybór `Źródło materiału frontów`; fronty zestawu zapisują informację o źródle w `frontMaterialSource`.
- Stare lodówki i zestawy bez źródła materiału zachowują dotychczasowy materiał jako `własny`, żeby nie zmieniać projektów po cichu.
- Nowy moduł domenowy: `js/app/cabinet/front-material-source.js`.
- Cache-busting zmienionych modułów: `20260516_front_source_v1`.
- Raport: `tools/reports/front-material-source-v1.md`.

## 2026-05-17 — set materials unify v1

- Kreator zestawów został ujednolicony z pozostałymi szafkami: zestaw ma teraz wybór korpusu, pleców, otwierania i frontów.
- Wartości korpusu, pleców i otwierania są zapisywane w rekordzie zestawu oraz przepisywane na wygenerowane korpusy zestawu.
- Fronty zestawu dalej mogą korzystać ze źródła materiału: własny / strefa dolna / strefa środkowa / strefa górna.
- Dodano moduł `js/app/cabinet/cabinet-modal-set-materials.js` jako małą granicę odpowiedzialności dla materiałów zestawu.
- Raport: `tools/reports/set-materials-unify-v1.md`.

## Fridge/set material cleanup v1 — 2026-05-17

- Poprawiono UI lodówki po Etapie 1C: przy wariancie lodówkowym ogólne pola `Materiał Frontu` i `Kolor Frontu` nie są już pokazywane równolegle z nowymi źródłami materiału frontu.
- Korpus, plecy i otwieranie lodówki zostają dostępne, bo nie są zastąpione przez źródła frontu.
- Zestawy startują z materiałów dolnej strefy/stojących: korpus, plecy i otwieranie biorą najpierw preferencje `lower`, potem globalne domyślne programu i awaryjne fallbacki.
- Nie zmieniono modelu storage, PRO100, ROZRYS, WYCENY ani frontów wieloczęściowych.
- Raport: `tools/reports/fridge-set-material-cleanup-v1.md`.

## 2026-05-17 — preferences_front_source_cleanup_v1

- Uporządkowano fundament preferencji strefowych i źródeł materiału frontu.
- Nowe szafki, zestawy i fronty specjalne korzystają ze wspólnej kolejności: strefa pokoju → globalne domyślne z trybiku → fallback programu.
- Dodano nowe testy zabezpieczające tę ścieżkę.
- Paczka: `site_000_preferences_front_source_cleanup_v1.zip`.

## 2026-05-17 — bulk_apply_zone_preferences_v1

- Aktualna paczka po tym etapie: `site_000_bulk_apply_zone_preferences_v1.zip`.
- Baza startowa: `site_000_preferences_front_source_cleanup_v1.zip`.
- Dodano Etap 2A: kontrolowane zastosowanie preferencji strefowych do istniejących szafek w WYWIADZIE.
- W akordeonie `Preferencje standardu` pojawiła się akcja `Zastosuj do istniejących szafek`, która otwiera modal aplikacyjny z wyborem stref i pól do zmiany.
- Zakres stref: dolna/stojące, środkowa/moduły, górna/wiszące. Zakres pól: korpus, fronty, plecy, otwieranie.
- Zmiany są planowane przed zapisem: program pokazuje liczniki dla szafek, frontów zwykłych, frontów specjalnych oraz zestawów. Dopiero zatwierdzenie wykonuje apply.
- Fronty lodówek i zestawów są aktualizowane według `frontMaterialSource` / `frontSource`: źródła `lower`, `middle`, `upper` reagują na wybraną strefę, a `custom` zostaje nietknięte.
- Dodano moduły `room-preferences-bulk-plan.js`, `room-preferences-bulk-apply.js` oraz `wywiad-room-preferences-bulk-modal.js`.
- Dodano testy dla planowania/apply oraz ochronę przed natywnymi pickerami/selectami w nowym modalu.
- Etap nie rusza okuć, producentów okuć, WYCENY, PRO100, ROZRYS ani frontów wieloczęściowych.
- Raport: `tools/reports/bulk-apply-zone-preferences-v1.md`.

## Hardware technical data + Excel v1

- Katalog okuć obsługuje teraz `System okucia` oraz techniczne dane szuflad/prowadnic: profil, długość, nośność, wzmocnienie, kolor i zastosowanie.
- Pełne dane techniczne uzupełnia się masowo w arkuszu `Okucia`; arkusz `Ceny_dostawcow` nadal nadaje się do szybkiej aktualizacji cen, a techniczne kolumny są opcjonalne.
- Szczegóły: `tools/reports/hardware-technical-data-excel-v1.md`.


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


## Dokumentacja backupu

Szczegółowy opis mechanizmu backupu, zakresu snapshotów, retencji i testów znajduje się w `BACKUP.md`.

## 2026-05-20 — hardware_technical_params_serialization_fix_v1

- Naprawiono zapis dynamicznych parametrów technicznych okuć, żeby wartości z launcherów/list nie trafiały do katalogu i backupu jako `"[object Object]"`.
- Eksport arkuszy grupowych XLSX czyści wartości parametrów przed zapisem.
- Dodano testy antyregresyjne dla katalogu okuć, backupu pośredniego i import/export.

## 2026-05-20 — hardware edit modal perf fix v1

- Poprawiono wydajność otwierania/zamykania formularza edycji okucia po dodaniu dynamicznych danych technicznych.
- Pasywny odczyt stanu formularza nie remountuje już launchera `Typ / cecha`.
- Dodano test smoke dla tej regresji.



## 2026-05-22 — data safety test isolation v1

- Poprawiono wyłącznie izolację testu retencji backupów testowych `before-tests`.
- Zasada pozostaje bez zmian: automatyczne backupy testowe mają twardy limit 10 najnowszych kopii, a gdy zapis w pamięci programu nie jest możliwy, używany jest ręczny eksport backupu na dysk.
- Test nie tworzy już 12 kopii pełnego realnego storage użytkownika, więc nie powinien fałszywie padać przy dużych danych lokalnych.
- Nie zmieniono mechanizmu backupu, limitów retencji, silnika zamienników, UI, import/export Excel, PRO100, ROZRYS ani WYCENY.

## 2026-05-22 — hardware replacement engine preview v1

- Dodano techniczny silnik podglądu zamienników okuć: `js/app/catalog/hardware-replacement-engine.js`.
- Etap nie dodaje przycisku ani ekranu w normalnym UI. Silnik działa w testach i będzie fundamentem pod późniejszy modal zamiany producentów/systemów.
- Silnik sprawdza kategorię, producenta docelowego, aktywność pozycji, parametry kluczowe, tryby porównania oraz dostępność ceny dostawcy `Do wyceny`.
- Dodano testy dla prowadnic 350/400, nośności, zakresów, producenta docelowego, braku ceny oraz braku zapisu do storage.
- Nie zmieniono backupów, import/export Excel, PRO100, ROZRYS, RYSUNKU ani WYCENY.

## 2026-05-22 — data_safety_backup_limit_policy_test_v2

- Poprawiono wyłącznie przeglądarkowy test retencji backupów testowych `before-tests`.
- Test nie zapisuje już backupów do realnego `localStorage`; sprawdza limit 10 kopii na małych rekordach w pamięci JS przez politykę retencji.
- Zasada pozostaje bez zmian: automatyczne backupy testowe mają maksymalnie 10 najnowszych kopii, a gdy zapis w pamięci programu nie jest możliwy, użytkownik ma ręczny eksport backupu na dysk.
- Nie zmieniono mechanizmu backupu, retencji, `BACKUP.md`, silnika zamienników, UI, import/export Excel, PRO100, ROZRYS, RYSUNKU ani WYCENY.
