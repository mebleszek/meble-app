## 2026-06-11 — Cennik: poprawka otwierania formularza sposobów naliczania ceny v1

Paczka `site_pricing_modes_form_price_fix_v1.zip` poprawia zgłoszony błąd `ReferenceError: formServicePriceWrapper is not defined` po kliknięciu edycji pozycji w **Cenniku robocizny i usług**. Przyczyna była prosta: nowy moduł ukrywania pól po wyborze **Sposobu naliczania ceny** odwoływał się do wrappera pola ceny usługi, ale helper nie został zdefiniowany w pliku formularza.

Zmiany:
- dodano brakujący helper `formServicePriceWrapper()` dla pola `formServicePrice`,
- tryby naliczania ceny, transport `kwota startowa + km`, stawki godzinowe w trybiku i logika WYCENY pozostają bez zmian,
- dodano smoke test pilnujący, żeby formularz ceny usługi miał ten helper przed użyciem.

Nie ruszano kosztów firmy, OpenRouteService, inwestora, `drawer.count`, automatów AGD, materiałów, okuć ani obliczeń robocizny. Cache-busting: `20260611_pricing_modes_form_price_fix_v1`. Raport: `tools/reports/pricing-modes-form-price-fix-v1.md`.

## 2026-06-11 — Sposoby naliczania ceny w cenniku v1

Paczka `site_pricing_modes_v1.zip` dodaje w **Cenniku robocizny i usług** pole **Sposób naliczania ceny**. Formularz pokazuje tylko pola potrzebne dla wybranego trybu, więc transport nie miesza się z czasem robocizny, a czynności czasowe nadal wybierają profil stawki godzinowej z trybika.

Zmiany:
- dodano tryby: **Kwota stała**, **Cena za ilość**, **Kwota startowa + cena za ilość**, **Czas × stawka godzinowa**, **Progi czasu**, **Czas startowy + kolejne sztuki**, **Zaawansowane**,
- transport `transport_distance_km` ma tryb **Kwota startowa + cena za ilość**,
- dla transportu można ustawić kwotę startową, kilometry w cenie startowej i cenę za km,
- silnik `laborCatalog.calculateDefinition()` centralnie liczy nowe tryby, bez osobnej łatki tylko pod transport,
- WYCENA transportu korzysta z tego samego kalkulatora i zapisuje w audycie start, limit oraz płatne km,
- stawki godzinowe zostają w trybiku i nadal wybiera się je przy czynnościach zależnych od czasu.

Nie ruszano kosztów firmy, OpenRouteService, `drawer.count`, automatów AGD, szuflad ani wymagań technicznych szafek. Cache-busting: `20260611_pricing_modes_v1`. Raport: `tools/reports/pricing-modes-v1.md`.

## 2026-06-11 — Stawki godzinowe firmy w trybiku v1

Paczka `site_hourly_rates_settings_v1.zip` przenosi zarządzanie profilami stawek godzinowych do trybika, bez przebudowy samej logiki robocizny. Stawki godzinowe są teraz parametrem firmy, a cennik robocizny i usług zawiera konkretne czynności/usługi, które wybierają odpowiedni profil stawki.

Zmiany:
- dodano trybik → **Stawki godzinowe firmy**,
- można edytować stawki systemowe: warsztatową, montażową, specjalistyczną i pomocnika,
- można dodawać własne stawki godzinowe z własnym kodem technicznym,
- kod istniejącej stawki jest zablokowany po zapisie, żeby nie rozpiąć czynności w cenniku,
- cennik nie pokazuje już kategorii **Stawki godzinowe** ani checkboxa tworzenia stawek godzinowych,
- czynności zależne od czasu nadal wybierają profil stawki godzinowej tak jak wcześniej,
- okno cennika zmieniono na **Cennik robocizny i usług**,
- w WYCENIE zmieniono etykietę **Robocizna / stawki wyceny** na **Usługi dodatkowe** i nie ukryto wartości 0.00 PLN.

Nie zmieniono jeszcze transportu w modelu `kwota startowa + kilometry`; to osobny następny etap. Cache-busting: `20260611_pricing_modes_v1`. Raport: `tools/reports/hourly-rates-settings-v1.md`.

## 2026-06-11 — Boot: start aplikacji po DOMContentLoaded v1

Paczka `site_boot_domcontentloaded_init_fix_v1.zip` poprawia zgłoszony przypadek pierwszego uruchomienia po wdrożeniu: `boot.js` był ładowany jako pierwszy skrypt `defer`, widział `document.readyState = interactive` i mógł zacząć szukać `FC.init()` zanim `app.js` oraz późniejsze moduły zdążyły się wykonać. Na wolniejszym pierwszym ładowaniu mobile dawało to fałszywy czerwony błąd `Nie znaleziono funkcji startowej aplikacji`, a po odświeżeniu cache już maskował problem.

Zmiany:
- `boot.js` podniesiony do `boot-clean-1.6`,
- listenery błędów nadal instalują się wcześnie, ale realny start `init` następuje dopiero po `DOMContentLoaded`, czyli po wykonaniu deferred scripts z `index.html`,
- komunikat `Nie znaleziono funkcji startowej aplikacji` nie może pojawić się przed `window.load`; timeout liczy się od pełnego załadowania strony, nie od pierwszego skryptu,
- nie ruszano transportu, WYCENY, inwestora, kosztów firmy, robocizny, danych ani UI.

Cache-busting: `20260611_boot_domcontentloaded_init_fix_v1`. Raport: `tools/reports/boot-domcontentloaded-init-fix-v1.md`.

## 2026-06-11 — Transport: poprawka cennika i widoczności w WYCENIE v1

Paczka `site_transport_catalog_quote_fix_v1.zip` poprawia zgłoszony przypadek: edycja startowej pozycji **Transport do klienta** tworzyła drugi wpis zamiast zaktualizować kanoniczny wpis `transport_distance_km`, więc WYCENA nadal czytała starą cenę 0 PLN/km i transport nie pojawiał się w podsumowaniu.

Zmiany:
- duplikaty transportu po nazwie/kategorii/źródle ilości są scalane do `transport_distance_km`, z zachowaniem ceny użytkownika,
- domyślna pozycja transportu nie pokazuje już mylącego usuwania — trzeba ją edytować, ustawić cenę 0 albo odznaczyć aktywność,
- WYCENA pokazuje osobny wiersz **Transport**, zamiast chować go pod „Robocizna / stawki wyceny”,
- rejestr wyliczeń i audyt mają osobną sekcję `transport`, ale źródłem ilości nadal jest `transport.distance_km` z Inwestora,
- nie zmieniono ręcznego wpisywania kilometrów, OpenRouteService, kosztów firmy ani robocizny szafek.

Cache-busting: `20260611_boot_domcontentloaded_init_fix_v1`. Raport: `tools/reports/transport-catalog-quote-fix-v1.md`.

## 2026-06-11 — Dane firmy/transport: WYCENA core boot fix v1

Paczka `site_company_transport_wycena_core_boot_fix_v1.zip` poprawia czerwony błąd `boot-clean-1.5` przy pierwszym uruchomieniu po wdrożeniu. Zmiana dotyczy wyłącznie odporności startu `wycena-core.js`; nie zmienia obliczeń, transportu, kosztów firmy ani danych inwestora.

## 2026-06-11 — Robocizna: czysty porządek kategorii AGD / Montaż AGD v1

- Paczka: `site_labor_appliance_category_clean_rebase_v1.zip`.
- Bazą jest zaakceptowana paczka `site_labor_appliance_separate_automats_v1.zip`; nie bazowano na późniejszych paczkach z niezaakceptowanym cleanupem kategorii/czasów.
- Stary dział robocizny `AGD` jest usuwany z katalogu stawek wyceny jako seedowany śmieć. W cenniku zostaje jeden dział dla sprzętów: `Montaż AGD`.
- Automaty AGD pozostają osobnymi technicznymi kodami. Uzupełniono listę `Montaż AGD` o pozycje odpowiadające staremu działowi AGD: okap podszafkowy/teleskopowy, okap kominowy/wyspowy, pralka, suszarka, ekspres i podgrzewacz szufladowy.
- Nie zmieniano jednostek czasu, listy szybkich opcji czasu ani nie dodano żadnego globalnego zaokrąglania czasu. W szczególności nie ma reguły `0.75 h → 1 h`.
- Nie ruszano WYWIADU, modala szafki, historii ofert, snapshotów, `drawer.count`, audytu robocizny ani warunków automatów.
- Cache-busting: `20260611_labor_appliance_category_clean_rebase_v1`. Raport: `tools/reports/labor-appliance-category-clean-rebase-v1.md`.

## 2026-06-10 — Robocizna: osobne automaty montażu AGD v1

- Paczka: `site_labor_appliance_separate_automats_v1.zip`.
- Montaż AGD został rozbity na osobne techniczne automaty: `dishwasher_mount`, `fridge_mount`, `oven_mount`, `hob_mount`, `hood_mount`, `microwave_mount`.
- Dodano osobne źródła ilości `appliance.dishwasher.count`, `appliance.fridge.count`, `appliance.oven.count`, `appliance.hob.count`, `appliance.hood.count`, `appliance.microwave.count`.
- Linie nadal trafiają do działu `Montaż AGD`, ale cena jest liczona z cennika robocizny/stawki wyceny jako osobny automat z czasem i stawką, a nie jako jeden wspólny `appliance_mount`.
- `Bez montażu` przy szafce nadal wyłącza naliczenie AGD. Automaty AGD nie dublują się w `Robocizna szafek`.
- Nie ruszano WYWIADU, modala szafki, historii ofert, `drawer.count`, warunków robocizny ani czytelnego audytu.
- Cache-busting: `20260611_labor_appliance_category_clean_rebase_v1`. Raport: `tools/reports/labor-appliance-separate-automats-v1.md`.

## 2026-06-10 — Robocizna: edytor warunków i podgląd reguły v1

- Paczka: `site_labor_conditions_editor_preview_v1.zip`.
- W cenniku robocizny/stawkach wyceny warunki zastosowania są czytelniejsze: każdy wiersz pokazuje `Działa gdy...`, zakres `od–do` z jednostką oraz wspólny podgląd wszystkich warunków.
- Edytor blokuje puste zakresy i duplikowanie tego samego warunku w jednej regule, zamiast zapisywać niejednoznaczne konfiguracje.
- Dodano `Podgląd działania reguły`, który pokazuje źródło ilości, tryb ilości, czas, stawkę, warunki i informację, że WYCENA czyta dane z aktualnej szafki przez `workQuantityFacts`, bez tworzenia drugiej kopii danych.
- Poprawiono opis `drawer.count` w słowniku źródeł ilości na zgodny z jawnymi wymaganiami szuflad/prowadnic.
- Nie zmieniono wyniku WYCENY, automatów, `quantitySource`, warunków w snapshotach, historii ofert, WYWIADU, modala szafki ani plusa dodawania.
- Cache-busting: `20260610_labor_conditions_editor_preview_v1`. Raport: `tools/reports/labor-conditions-editor-preview-v1.md`.

## 2026-06-10 — Robocizna: czytelny audyt czynności v1

- Paczka: `site_labor_audit_readable_lines_v1.zip`.
- Modal `Szczegóły: Robocizna szafek` nie pokazuje już długiego opisu czynności sklejonego separatorami `•`, które wyglądały jak mnożenie.
- Dla linii robocizny dane są renderowane jedno pod drugim: `Dotyczy`, `Ilość`, `Czas`, `Stawka`, `Warunki`, `Źródło ilości`, `Rozbicie`, `Wyliczenie`.
- Rozbicie zawiasów w robociźnie pokazuje tylko ludzką ilość per drzwiczki; techniczne opisy zawiasu, reguły i wymiary frontu nie zaśmiecają głównego audytu robocizny.
- `quoteCalculationRegister` i lekki snapshot zachowują strukturalne pola robocizny potrzebne do renderowania czytelnego audytu bez odtwarzania danych z tekstu notatki.
- Nie zmieniono wyniku WYCENY, automatów robocizny, `quantitySource`, warunków, historii ofert, `drawer.count`, WYWIADU ani modala szafki.
- Cache-busting: `20260610_labor_audit_readable_lines_v1`. Raport: `tools/reports/labor-audit-readable-lines-v1.md`.

## 2026-06-10 — Szuflady/prowadnice: jawne wymagania jako źródło drawer.count v1

- Paczka: `site_drawer_requirements_source_of_truth_v1.zip`.
- Dodano `js/app/cabinet/cabinet-drawer-requirements.js` jako centralny moduł jawnych wymagań szuflad/prowadnic.
- `drawer.count` w `FC.workQuantityFacts` nie czyta już śmieciowych pól `details.drawerCount`, `details.drawers`, `innerDrawerCount` ani `podInnerDrawerCount` bez kontekstu. Liczy wyłącznie wymagania zwracane przez `FC.cabinetDrawerRequirements`.
- Świeży draft zwykłej szafki nie dostaje już ukrytych wartości `drawerCount: '3'`, `innerDrawerCount: '1'`, `innerDrawerType: 'blum'`.
- Klonowanie, zmiana typu/wariantu i zapis szafki czyszczą legacy pola szufladowe, jeżeli nie wynikają z realnego wariantu szuflad/prowadnic.
- Przyszły kreator korpusów może dodać `drawerRequirements` do dowolnej konstrukcji; wtedy `drawer.count` je policzy niezależnie od typu szafki.
- Nie robiono whitelisty wariantów szafek i nie maskowano problemu w WYCENIE. Nie zmieniono sensu automatów robocizny, `quantitySource`, warunków ani audytu robocizny.
- Nie ruszano `cabinet-modal.js`, `cabinets-render.js`, `cabinet-common.css`, WYWIADU ani plusa dodawania szafki.
- Cache-busting: `20260610_drawer_requirements_source_of_truth_v1`. Raport: `tools/reports/drawer-requirements-source-of-truth-v1.md`.

## 2026-06-10 — WYCENA: porządek Diag, storage i kompaktowy fingerprint v1

- Paczka: `site_quote_diag_storage_cleanup_v1.zip`.
- `Diag` skraca teraz także `shellState.lastQuote`, więc raport nie powinien wypluwać pełnej oferty z listą formatek i linii.
- `Diag` pokazuje `topKeys` — największe klucze `localStorage`, żeby od razu było widać, czy magazyn zjadają snapshoty, backupy, sesja edycji, cache czy inny klucz.
- `fc_edit_session_v1` jest bezpiecznie czyszczony przed zapisem historii WYCENY tylko wtedy, gdy wygląda na martwą sesję z zakładki WYCENA: aktywna, ze snapshotem, bez trybu, bez pokoju i bez otwartego modala/dialogu.
- Odcisk porównawczy oferty `meta.quoteFingerprint` nie jest już pełnym JSON-em ważącym dziesiątki KB. Jest kompaktowym stabilnym hashem `qfp2`, więc `meta` snapshotu nie puchnie przy 30 ofertach.
- Nie zmieniono sensu liczenia WYCENY, automatów robocizny, `quantitySource`, warunków, audytu robocizny ani flow akceptacji ofert.
- Nie ruszano `drawer.count`, WYWIADU, plusa dodawania szafki, `cabinet-modal.js`, `cabinets-render.js` ani `cabinet-common.css`.
- Cache-busting: `20260610_quote_diag_storage_cleanup_v1`. Raport: `tools/reports/quote-diag-storage-cleanup-v1.md`.


## 2026-06-10 — WYCENA: historia ofert i storage maintenance v1

- Paczka: `site_quote_history_storage_maintenance_v1.zip`.
- Dodano moduł `js/app/quote/quote-snapshot-storage-maintenance.js`, który przy pełnym `localStorage` usuwa cache/techniczne kopie i odchudza stare lokalne backupy przed zapisem historii WYCENY.
- `quote-snapshot-store` nie kończy już od razu na tymczasowym `Podglądzie bez zapisu historii`; najpierw próbuje realnie zapisać odchudzony snapshot oferty.
- Historia ofert zachowuje flow z BACKUP-u: wiele wariantów, wstępna/końcowa, akceptacja, statusy i odrzucenia nadal idą przez istniejący store/status bridge.
- Nie cofano ani nie zmieniano sensu nowych automatów robocizny, `quantitySource`, warunków i audytu robocizny.
- Limit historii: 30 najnowszych ofert na projekt, z zachowaniem wybranych/zaakceptowanych.
- `Diag` pokazuje teraz skrót `lastQuote` oraz rozbicie rozmiarów snapshotu, zamiast wklejać pełne `lines.elements`.
- Nie ruszano WYWIADU, plusa dodawania szafki, `cabinet-modal.js`, `cabinets-render.js` ani `cabinet-common.css`.
- Cache-busting: `20260610_quote_history_storage_maintenance_v1`. Raport: `tools/reports/quote-history-storage-maintenance-v1.md`.


## 2026-06-10 — WYCENA: podgląd bez zapisu historii przy pełnym storage v1

- Paczka: `site_wycena_unsaved_preview_storage_fix_v1.zip`.
- Naprawiono regresję: gdy zapis historii WYCENY do `localStorage` nie powiedzie się przez pełny magazyn lub ciężkie stare dane, program nie pokazuje już pustej oferty 0.00 PLN jako sukcesu.
- WYCENA po kliknięciu `Wyceń` buduje wynik w pamięci i, jeśli zapis historii zawiedzie, pokazuje użytkownikowi policzony podgląd oznaczony `Podgląd bez zapisu historii` z ostrzeżeniem, że wynik nie trafił do historii.
- Nie zmieniono modelu ofert, nie dodano nowego klucza storage i nie ukryto migracji danych. Docelowe czyszczenie ciężkich snapshotów/backupu zostaje osobnym etapem.
- Zaktualizowano build diagnostyki WYCENY, żeby raport nie sugerował starej paczki `20260530_wycena_duplicate_modal_fix_v1`.
- Nie ruszano WYWIADU, modala szafki, plusa dodawania, katalogów, materiałów ani logiki warunków robocizny poza tym, że nowy błąd storage nie zabija podglądu.
- Cache-busting: `20260610_wycena_unsaved_preview_storage_fix_v1`. Raport: `tools/reports/wycena-unsaved-preview-storage-fix-v1.md`.


## 2026-06-09 — Robocizna: load fix kaskadowych warunków v1

- Paczka: `site_labor_conditions_cascade_load_fix_v1.zip`.
- Poprawiono błąd z paczki `site_labor_conditions_cascade_fields_v1.zip`: moduł `price-modal-labor-conditions.js` był w testach, ale nie ładował się w realnym `index.html`, więc w Stawkach wyceny mebli nie pojawiał się `Warunek 1`.
- Moduł warunków jest teraz ładowany po `price-modal-field-help.js` i przed `price-modal-item-form.js`.
- `tools/index-load-groups.js` pilnuje tej kolejności, a smoke test sprawdza realne `index.html`, nie tylko listę plików testowych.
- Nie zmieniano modelu warunków, WYCENY, WYWIADU, modala szafki ani plusa dodawania szafki.
- Cache-busting: `20260610_wycena_unsaved_preview_storage_fix_v1`. Raport: `tools/reports/labor-conditions-cascade-load-fix-v1.md`.


## 2026-06-09 — Podpięcie źródeł ilości do robocizny WYCENY v1

- Paczka: `site_labor_quantity_values_link_v1.zip`.
- Bazą jest zaakceptowana paczka `site_labor_quantity_source_selector_v1.zip`.
- WYCENA robocizny szafek zaczyna używać pola `quantitySource` z cennika robocizny przez read-only adapter `FC.workQuantityFacts`.
- Źródła są odczytywane na żądanie z aktualnych danych szafki i nie są zapisywane jako druga prawda.
- Do `quoteCalculationRegister` trafiają metadane źródła ilości: kod, nazwa, wartość i opis w nocie/audycie.
- Dodano plan przyszłego kreatora i przycisku `Dane szafki` w `CABINET_CREATOR_PLAN.md`.
- Nie ruszano `cabinet-modal.js`, `cabinets-render.js`, `cabinet-common.css`, plusa dodawania, edycji szafki ani UI modala szafki.
- Cache-busting: `20260609_labor_quantity_values_link_v1`. Raport: `tools/reports/labor-quantity-values-link-v1.md`.


## 2026-06-09 — Źródło ilości w cenniku robocizny v1

- Paczka: `site_labor_quantity_source_selector_v1.zip`.
- Bazą jest zaakceptowana paczka `site_work_quantity_facts_settings_preview_v1.zip`.
- W formularzu stawek wyceny mebli / czynności robocizny dodano pole `Źródło ilości`, np. `front.count`, `hinge.count`, `shelf.count`.
- Pole zapisuje wybrany kod w pozycji cennika jako `quantitySource`, ale ten etap nie podpina go jeszcze do WYCENY ani `quoteCalculationRegister`.
- Lista wyboru pochodzi ze słownika `Dane do czynności i wyceny` i obejmuje aktywne, policzalne źródła; planowane i tekstowe źródła nie są jeszcze wybieralne jako ilość.
- Nie ruszano `cabinet-modal.js`, `cabinets-render.js`, `cabinet-common.css`, WYWIADU, plusa dodawania, edycji szafki, WYCENY ani automatów robocizny.
- Cache-busting: `20260609_labor_quantity_values_link_v1`. Raport: `tools/reports/labor-quantity-source-selector-v1.md`.


## 2026-06-09 — Podgląd odczytu szafek w trybiku

W trybiku `Dane do czynności i wyceny` dodano podgląd aktualnego projektu: program pokazuje, jakie nazwane dane potrafi odczytać z istniejących szafek, np. wymiary, liczbę frontów, zawiasów, półek, szuflad i AGD. Podgląd jest poza modalem szafki, tylko do odczytu i nie zapisuje drugiej kopii danych.

Nie zmieniono WYWIADU, modala szafki, plusa dodawania, WYCENY ani cennika czynności.


## 2026-06-09 — site_work_quantity_facts_reader_v1

- Bazą jest zaakceptowana paczka `site_work_quantity_sources_settings_clean_v1.zip`.
- Dodano wyłącznie read-only adapter `FC.workQuantityFacts`, który na żądanie czyta z aktualnej szafki nazwane fakty do przyszłych czynności i wyceny.
- Adapter odczytuje m.in. wymiary, objętość, fronty, zawiasy, półki, szuflady i AGD przez istniejące centralne źródła, bez zapisywania drugiej prawdy w szafce.
- Nie ruszano UI WYWIADU, `cabinet-modal.js`, `cabinets-render.js`, plusa dodawania, WYCENY, `quoteCalculationRegister`, cennika czynności ani automatów.
- Cache-busting: `20260609_work_quantity_facts_settings_preview_v1`. Raport: `tools/reports/work-quantity-facts-reader-v1.md`.


## 2026-06-09 — site_work_quantity_sources_settings_clean_v1

- Przywrócono zaakceptowany dział ustawień `Dane do czynności i wyceny` na bazie z działającymi profilami stawek godzinowych.
- Dział pokazuje systemowy słownik źródeł danych: kod techniczny, nazwę przyjazną, jednostkę i opis `jak liczone`.
- Etap jest tylko read-only/podglądowy: bez zapisu drugiej prawdy w szafkach i bez zmian w WYWIADZIE, WYCENIE oraz automatach.

## 2026-06-07 — WYCENA: akordeony audytu ROZRYS 1:1 z auto wysokością v1

- Paczka: `site_quote_details_accordion_rozrys_auto_height_v1.zip`.
- Sprawdzono wzorzec `dev_ui_patterns.html → Accordion ROZRYS + ruch`: po animacji wzorzec czyści `max-height`, więc zawartość działa automatycznie według realnej wysokości treści.
- Naprawiono realną przyczynę ucinania akordeonów w audycie WYCENY: body modala było `display:flex` z dziećmi jako elementami flex, więc długie listy ściskały zwinięte akordeony i przez `overflow:hidden` ucinały nagłówki.
- Body modala szczegółów WYCENY jest teraz blokowe jak wzorzec UI, zachowuje własny scroll i nie ściska dzieci. Akordeony mają `flex:0 0 auto` jako dodatkowe zabezpieczenie przed przyszłym przycięciem.
- Odstępy między akordeonami działają jak we wzorcu: pierwszy element bez dodatkowego marginesu, kolejne z odstępem 12 px.
- Nie zmieniano wyliczeń WYCENY, robocizny, `quoteCalculationRegister`, snapshotów, materiałów, zawiasów, wariantów szafek, import/export, backupów ani UI poza modalem szczegółów/audytu WYCENY.
- Cache-busting: `20260607_quote_details_accordion_rozrys_auto_height_v1`. Raport: `tools/reports/quote-details-accordion-rozrys-auto-height-v1.md`.

## 2026-06-07 — WYCENA: akordeony audytu 1:1 z „Accordion ROZRYS + ruch” v1

- Paczka: `site_quote_details_accordion_rozrys_1to1_v1.zip`.
- Poprawiono modal szczegółów/audytu WYCENY tak, żeby akordeony korzystały strukturalnie 1:1 ze wzorca `dev_ui_patterns.html → Accordion ROZRYS + ruch`: `rozrys-material-accordion`, `rozrys-material-accordion__trigger`, `rozrys-material-accordion__title`, `title-line1`, `title-line2`, `rozrys-material-accordion__chevron` i `rozrys-material-accordion__body`.
- Usunięto boczny układ kwoty/chevrona w nagłówku audytu, który tworzył inne proporcje niż wzorzec i powodował przycinanie krótkiej linii `1 poz.` na telefonie. Kwota jest teraz w drugiej linii nagłówka, razem z liczbą pozycji.
- Chevron w audycie nie ma już własnego, konkurencyjnego stylu WYCENY; używa dokładnie mechanizmu i wyglądu wzorca ROZRYS, bez podwójnego symbolu strzałki.
- Ostrzeżenia są nadal pierwszą sekcją audytu, ale ich zewnętrzny akordeon ma ten sam wygląd i mechanizm jak pozostałe sekcje; pomarańczowe zostały tylko wewnętrzne komunikaty ostrzegawcze.
- Zachowano główny scroll modala, stałą stopkę `Wróć`, animację `scrollHeight/max-height`, natychmiastowe zamykanie poprzedniego akordeonu i przewijanie po kliknięciu.
- Nie zmieniano wyliczeń WYCENY, robocizny, `quoteCalculationRegister`, snapshotów, materiałów, zawiasów, wariantów szafek, import/export, backupów ani UI poza modalem szczegółów WYCENY.
- Cache-busting: `20260607_quote_details_accordion_rozrys_1to1_v1`. Raport: `tools/reports/quote-details-accordion-rozrys-1to1-v1.md`.

## 2026-06-07 — WYCENA: akordeony audytu zgodne ze wzorcem ROZRYS v1

- Paczka: `site_quote_details_rozrys_accordion_sync_v1.zip`.
- Ujednolicono wszystkie akordeony w modalu szczegółów/audytu WYCENY z wzorcem ROZRYS / `dev_ui_patterns`: wspólna ramka, cień, chevron, proporcje nagłówka i panelu.
- Usunięto twarde minimalne wysokości zwiniętych nagłówków, które powodowały przycinanie długich nazw szafek; wysokość akordeonu wynika teraz z treści.
- Wszystkie działy szczegółów WYCENY korzystają z jednego renderera i tych samych klas akordeonu, w tym `Robocizna szafek`, `Akcesoria` i `Ostrzeżenia / rzeczy do sprawdzenia`.
- Dodano animację otwierania opartą o `scrollHeight` / `max-height`, zgodną z wzorcem UI, z natychmiastowym zamykaniem poprzedniej sekcji.
- Zachowano główny scroll modala, stałą stopkę `Wróć` i przewijanie otwartej sekcji do początku obszaru treści.
- Nie zmieniano wyliczeń WYCENY, robocizny, `quoteCalculationRegister`, snapshotów, materiałów, zawiasów, wariantów szafek, import/export, backupów ani UI poza modalem szczegółów WYCENY.
- Cache-busting: `20260607_quote_details_rozrys_accordion_sync_v1`. Raport: `tools/reports/quote-details-rozrys-accordion-sync-v1.md`.

## 2026-06-07 — WYCENA: poprawa mobile akordeonów audytu robocizny v1

- Paczka: `site_quote_details_mobile_accordion_fit_v1.zip`.
- Poprawiono wyłącznie widok akordeonów w modalu szczegółów/audytu WYCENY, szczególnie w sekcji `Robocizna szafek` na mobile.
- Zwinięte akordeony mają teraz bezpieczną minimalną wysokość, grid nagłówka, jawny `line-height` tytułu i stałe miejsce po prawej na kwotę oraz przycisk rozwijania, żeby długie nazwy szafek nie były ucinane.
- Mobile modal szczegółów dostał większy użyteczny obszar okna oraz większe bufory scrolla, żeby rozwinięta pozycja nie wyglądała jak minimalnie przycięta.
- Kliknięcie akordeonu przewija otwartą sekcję do początku obszaru treści modala, zamiast zostawiać półucięte karty nad aktywną sekcją.
- Rozszerzono regresję `tools/quote-details-accordion-scroll-smoke.js` o zabezpieczenia wysokości nagłówków, mobile offsetu i scrollowania otwartej sekcji.
- Nie zmieniano wyliczeń WYCENY, robocizny, `quoteCalculationRegister`, snapshotów, materiałów, zawiasów, wariantów szafek, import/export, backupów ani UI poza modalem szczegółów WYCENY.
- Cache-busting: `20260607_quote_details_mobile_accordion_fit_v1`. Raport: `tools/reports/quote-details-mobile-accordion-fit-v1.md`.

## 2026-06-06 — WYCENA: robocizna jako jedna prawda v1

- Paczka: `site_quote_labor_single_truth_v1.zip`.
- Podpięto automatyczną robociznę szafek/korpusów, frontów i zawiasów do centralnej ścieżki WYCENY tak, żeby linie trafiały przez `quoteCalculationRegister`, a nie przez boczne sumowanie.
- Robocizna frontów korzysta z tego samego źródła frontów co MATERIAŁ/WYCENA (`frontHardware.getCabinetFrontCutListForMaterials`), więc wariant `szuflada_drzwi` oraz zestawy nie powinny dublować frontów.
- Robocizna zawiasów korzysta z centralnych wymagań zawiasów (`cabinetHardwareRequirements.getHingeRequirementsWithQty`), bez liczenia ilości z legacy cutlisty i bez zmiany samej reguły ilości zawiasów.
- Montaż AGD trafia do rejestru jako linie usług z audytem źródła szafki/urządzenia zamiast zbiorczego agregowania bez źródła.
- Ręczne pozycje robocizny zostały zachowane i oznaczone jako ręczne; ręczne pozycje przy szafce o typie front/zawias dostają ostrzeżenie o możliwym dublu z automatem.
- Snapshot/oferta zachowuje metadane źródła robocizny i preferuje zapis/sumy z `calculationRegister`.
- Dodano regresję `tools/quote-labor-single-truth-smoke.js` oraz raport `tools/reports/quote-labor-single-truth-v1.md`.
- Nie przebudowywano prowadnic, szuflad systemowych, cargo, podnośników, innych okuć poza zawiasami, UI katalogu okuć ani wariantów szafek.
- Cache-busting: `20260606_quote_labor_single_truth_v1`.

## 2026-06-06 — WYCENA: ostrzeżenia jako akordeon i bez zagnieżdżonego małego scrolla v1

- Paczka: `site_quote_details_warning_accordion_fix_v1.zip`.
- Poprawiono modal `Analiza oferty` / szczegóły WYCENY: ostrzeżenia nie są już małym zagnieżdżonym okienkiem ze scrollbarem, tylko normalnym akordeonem takim jak pozostałe sekcje.
- Modal szczegółów zachowuje stałą wysokość viewportu, własny główny scroll w treści, stałą stopkę `Wróć` i jednolity grid header/body/footer.
- Po pierwszym otwarciu modala program nie przeskakuje już automatycznie do pierwszego otwartego akordeonu; przewijanie działa dopiero po kliknięciu sekcji, żeby nie chować nagłówków i początku okna.
- Blok `Ostrzeżenia / rzeczy do sprawdzenia` jest domyślnie zwinięty i pokazuje liczbę pozycji; po otwarciu korzysta z głównego scrolla modala, bez własnego małego scrolla.
- Zaktualizowano regresję `tools/quote-details-accordion-scroll-smoke.js`, która pilnuje wejść szczegółów WYCENY oraz tego, że ostrzeżenia są akordeonem bez zagnieżdżonego scrolla.
- Nie zmieniano wyliczeń WYCENY, rejestru, snapshotów, zawiasów, PCV, materiałów, robocizny, import/export, backupów ani UI poza modalem szczegółów WYCENY.
- Cache-busting: `20260606_quote_details_warning_accordion_fix_v1`. Raport: `tools/reports/quote-details-warning-accordion-fix-v1.md`.

## 2026-06-06 — Jedna prawda WYCENY przed robocizną v1

- Paczka: `site_quote_single_truth_pre_labor_tests_v1.zip`.
- Dodano regresję `tools/quote-single-truth-pre-labor-smoke.js`, która pilnuje, że nowe sumy WYCENY idą przez `quoteCalculationRegister`, a snapshot i audyt korzystają z rejestru zamiast z równoległych sum.
- Test zabezpiecza parytet MATERIAŁ ↔ WYCENA dla HDF, frontów lakier/akryl/laminat oraz PCV/obrzeży z edge store. Surowe metry PCV muszą zgadzać się z MATERIAŁEM, a zapas `+10%` jest doliczany dopiero w WYCENIE.
- Poprawiono normalizację frontów `Front: typ • nazwa`, żeby `lakier`, `akryl` i `laminat` trafiały do tej samej pozycji materiału/katalogu, zamiast rozjeżdżać MATERIAŁ i WYCENĘ.
- Poprawiono przeliczanie wymiarów frontów w planie materiałowym WYCENY: pola `w/h` z agregatu ROZRYS są traktowane jako mm, bez zgadywania progiem `300`, więc front 30 cm nie może zostać policzony jak 300 cm.
- Dodano test ceny dostawcy `Do wyceny`: oznaczona cena jest używana, a brak oznaczenia przy wielu cenach zostaje udokumentowany jako obecny ryzykowny fallback do pierwszej ceny.
- Nie wdrażano nowego liczenia robocizny, nie finalizowano prowadnic/szuflad/cargo/podnośników i nie zmieniano UI.
- Cache-busting: `20260606_quote_single_truth_pre_labor_tests_v1`. Raport: `tools/reports/quote-single-truth-pre-labor-tests-v1.md`.

## 2026-06-06 — Zapis zmian w słownikach parametrów okuć v1

- Paczka: `site_hardware_dictionary_save_actions_fix_v1.zip`.
- Naprawiono brak przycisków `Zapisz` i `Anuluj` po zmianie checkboxów i innych pól w modalu `Słowniki okuć`.
- Modal słowników oznacza teraz zmianę użytkownika natychmiast po edycji parametru, więc stopka przełącza się z samego `Wyjdź` na `Anuluj` + `Zapisz` bez polegania wyłącznie na znormalizowanym podpisie danych.
- `normalizeDefinition()` nie nadpisuje już ręcznie zmienionych ustawień parametrów systemowych, np. `Użyj do porównania`, `Buduje nazwę techniczną`, `Sposób porównania`, `Aktywna` i `Kolejność`. Domyślne wartości nadal startują poprawnie, ale decyzje użytkownika zapisane w słowniku są respektowane.
- Dodano regresję `tools/hardware-dictionary-save-actions-smoke.js`.
- Podbito cache-busting dla `hardware-technical-params.js` i `price-modal-hardware-dictionaries.js`.
- Raport: `tools/reports/hardware-dictionary-save-actions-fix-v1.md`.

## 2026-06-06 — Nazwa katalogowa i techniczna okuć v1

- Paczka: `site_hardware_technical_name_ui_v1.zip`.
- W edycji okucia pole `Nazwa` jest teraz etykietowane jako `Nazwa katalogowa`, a bezpośrednio pod nim pojawia się nieedytowalny podgląd `Nazwa techniczna`.
- Widoczne pole wyboru `Typ / cecha` zostało usunięte z normalnej edycji okucia; techniczna nazwa jest budowana z parametrów oznaczonych jako `Buduje nazwę techniczną`.
- W słownikach parametrów technicznych zmieniono etykiety checkboxów na `Użyj do porównania` i `Buduje nazwę techniczną`; porównanie/dobór nadal opiera się na danych technicznych, nie na tekście nazwy.
- Eksport XLSX pokazuje kolumnę `nazwa_techniczna` zamiast starego `typ_cecha`; parser nadal rozpoznaje stare nagłówki przy imporcie, ale nowy eksport i UI używają nowej nazwy.
- Dodano regresję `tools/hardware-technical-name-ui-smoke.js`; zaktualizowano cache-busting dla edytowanych modułów UI, technicznych parametrów oraz testów akcesoriów.
- Raport: `tools/reports/hardware-technical-name-ui-v1.md`.

## 2026-06-05 — Poprawka testu edge store MATERIAŁU v1

- Paczka: `site_material_edge_store_test_fixture_fix_v1.zip`.
- Poprawiono wyłącznie fixture testu `Zakładka Materiał ma wydzielony model danych i edge store`: test używa teraz jawnego materiału laminatowego (`Laminat test`) zamiast niejednoznacznego `Biały test`.
- Przy obecnej polityce PCV/okleina jest liczona tylko dla laminatu, więc poprzedni test dawał fałszywy błąd mimo poprawnej logiki runtime.
- Podbito cache-busting w `dev_tests.html` dla `js/testing/material/tests.js`.
- Nie zmieniano działania aplikacji, UI, MATERIAŁÓW, WYCENY, zawiasów, PRO100, backupów, import/export ani snapshotów ofert.
- Raport: `tools/reports/material-edge-store-test-fixture-fix-v1.md`.

## 2026-06-05 — Plan przyszły: mieszane fronty / siatka frontów v1

- Paczka: `site_future_mixed_fronts_plan_md_v1.zip`.
- Dodano do `OPTIMIZATION_PLAN.md` odłożony plan rozwoju dla wariantu `Szuflady + drzwiczki`.
- Decyzja: nie wdrażać teraz pełnego edytora siatki frontów; temat wróci dopiero po ustabilizowaniu WYCENY i pełnego liczenia ceny mebli.
- Kierunek przyszły: UI może zacząć od kilku presetów pod wariantem `Szuflady + drzwiczki`, ale dane mają być od razu opisane jako lista/siatka frontów z jawną rolą `drawer`/`door`, żeby MATERIAŁ, WYCENA, zawiasy i prowadnice korzystały z jednego źródła prawdy.
- Nie zmieniano runtime aplikacji, UI, testów, cache-bustingu, PRO100, ROZRYS/Optimax, PCV/obrzeży, backupów, import/export Excel ani snapshotów ofert.
- Raport: `tools/reports/future-mixed-fronts-plan-md-v1.md`.

## 2026-06-05 — Testy WYCENA/zamiana zawiasów i poprawka testów katalogów v1

- Paczka: `site_hinge_quote_tests_catalog_dev_fix_v1.zip`.
- Dodano regresję `tools/wycena-hinge-quote-replacement-flow-smoke.js`, która pilnuje całej ścieżki `WYWIAD/szafka → centralne wymaganie zawiasu → WYCENA`: duży front 66×105 cm w akrylu ma 4 zawiasy w WYCENIE, `szuflada_drzwi` z legacy `frontCount = 3` liczy 2 drzwiczki/4 zawiasy, a zestaw bez zapisanych frontów w `room.fronts` odtwarza front z rekordu zestawu i liczy zawiasy tylko raz.
- Ten sam test pilnuje zamiany zawiasu w WYCENIE: przy preferencji GTV wymaganie 110° może dobrać GTV 107° w klasie `standardowy 90–120°`, ale nie może dobrać zawiasu narożnego 170°.
- Poprawiono fałszywe błędy testów przeglądarkowych katalogu: test migracji nie wymaga już, żeby `sheetMaterials` miało dokładnie jedną pozycję, bo obecność startowego PCV/obrzeża jest poprawna. Test sprawdza właściwy kontrakt: legacy akcesorium nie może zostać w materiałach arkuszowych, a zapisane rozdzielone listy nie mogą wskrzesić legacy danych.
- Podbito cache-busting w `dev_tests.html` dla `js/testing/project/tests.js` i `js/testing/material/tests.js`.
- Nie zmieniano logiki runtime aplikacji, UI, PRO100, ROZRYS/Optimax, PCV/obrzeży, backupów, import/export Excel ani modelu snapshotów ofert.
- Cache-busting: `20260605_hinge_quote_tests_catalog_dev_fix_v1`. Raport: `tools/reports/hinge-quote-tests-catalog-dev-fix-v1.md`.

## 2026-06-05 — Fronty i zawiasy zestawów w MATERIAŁACH v1

- Paczka: `site_set_fronts_material_hinges_fix_v1.zip`.
- Naprawiono regresję w MATERIAŁACH: zestawy nie muszą już polegać wyłącznie na zapisanych rekordach `projectData[room].fronts`. Jeżeli fronty zestawu nie istnieją w tej tablicy, program odtwarza je centralnie z rekordu zestawu (`sets`: preset A/C/D, parametry, ilość frontów, materiał i kolor).
- To samo centralne źródło odtworzonych frontów jest używane przez MATERIAŁ i przez liczenie zawiasów, więc korpus prowadzący zestawu pokazuje fronty oraz zawiasy, a kolejne korpusy zestawu ich nie dublują.
- Dodano lokalny formatter wymiarów w `front-hardware-fronts.js`, żeby fronty zestawu nie znikały przez brak globalnego `fmtCm` w środowiskach testowych lub przy zmianie kolejności ładowania.
- Rozszerzono regresję `tools/cabinet-hinge-quantity-kg-smoke.js` oraz dodano `tools/cabinet-set-material-cutlist-smoke.js`, który sprawdza pełną cutlistę MATERIAŁÓW: fronty i zawiasy zestawu przy korpusie prowadzącym, bez duplikacji na korpusie nieprowadzącym.
- Nie ruszano UI, PRO100, ROZRYS/Optimax, PCV/obrzeży, backupów, import/export Excel ani modelu snapshotów ofert.
- Cache-busting: `20260605_set_fronts_material_hinges_fix_v1`. Raport: `tools/reports/set-fronts-material-hinges-fix-v1.md`.

## 2026-06-05 — Bezpieczna ilość zawiasów w kg v1

- Paczka: `site_hinge_quantity_kg_safe_v1.zip`.
- Zmieniono centralny kalkulator ilości zawiasów z progów funtowych na progi w kg: waga frontu, wysokość frontu i dodatek szerokości są liczone bez przeliczenia na funty.
- Nowa reguła szerokości: do 600 mm bez dodatku, powyżej 600 mm `+1` zawias za każde rozpoczęte 100 mm, zamiast starego `+1` za każde rozpoczęte 50 mm.
- Dodano publiczne API `universalHingesPerDoor()`, `hingesByWeightKg()`, `hingesByHeightMm()` i `hingeWidthAddOn()`. Stare `blumHingesPerDoor()` zostało jako alias kompatybilności, ale używa nowej logiki kg.
- Naprawiono przypadek `szuflada_drzwi`: front szuflady pozostaje frontem materiałowym, ale nie jest panelem drzwiowym do zawiasów. Wspólny resolver `resolveDrawerDoorCount()` odcina też legacy `frontCount = 1 + liczba drzwi`.
- Fronty zestawów nadal są liczone tylko na korpusie prowadzącym; zawiasy zestawu korzystają z tej samej nowej reguły kg i nie dublują się na kolejnych korpusach.
- Zaktualizowano cache-busting dla modułów front-hardware i wymagań zawiasów.
- Dodano regresję `tools/cabinet-hinge-quantity-kg-smoke.js` dla przykładów 60×100, 60×105, 66×105, 70×105, 71×105, szuflada+drzwi oraz zestawów.
- Nie ruszano UI, PRO100, ROZRYS/Optimax, PCV/obrzeży, backupów, import/export Excel ani modelu snapshotów ofert.
- Cache-busting: `20260605_hinge_quantity_kg_safe_v1`. Raport: `tools/reports/hinge-quantity-kg-safe-v1.md`.

## 2026-06-04 — Globalna naprawa renderowania helperów `?` v2

- Paczka: `site_help_qmark_label_trigger_fix_v2.zip`.
- Naprawiono właściwą przyczynę prostokątów w WYCENIE i ROZRYS/Optimax: `helpRegistry.labelWithInfo()` przekazywał do `createTrigger()` tę samą konfigurację `className`, której używał dla wiersza etykiety. W efekcie przycisk `?` dostawał klasę `label-help` zamiast `info-trigger` i był stylowany jak wiersz/formularz, czyli jako pusty prostokąt.
- Rozdzielono klasę wiersza etykiety od klasy przycisku helpera: `className` zostaje klasą kontenera, a `triggerClassName` domyślnie tworzy przycisk `.info-trigger`.
- Zachowano centralną blokadę kształtu `.info-trigger` z poprzedniej paczki oraz lokalne rozmiary 26/24 px tam, gdzie były wcześniej.
- Dodano test regresji `tools/help-registry-label-trigger-smoke.js`, który pilnuje, żeby `labelWithInfo()` nigdy więcej nie przekazał klasy `label-help` do przycisku `?`.
- Nie ruszano logiki helperów, treści opisów, WYCENY, duplikatów okuć, override zawiasów, PRO100, ROZRYS/algorytmu, PCV/obrzeży, backupów ani import/export Excel.
- Cache-busting: `20260604_help_qmark_label_trigger_fix_v2`. Raport: `tools/reports/help-qmark-label-trigger-fix-v2.md`.

## 2026-06-04 — Globalna blokada kształtu helperów `?` v1

- Paczka: `site_help_qmark_global_shape_fix_v1.zip`.
- Naprawiono realną przyczynę prostokątów: helper `?` mógł być rozciągany przez układy grid/flex formularzy w różnych modułach, więc lokalna poprawka samej WYCENY była niewystarczająca.
- Dodano globalną regułę kształtu dla `.info-trigger` i wariantów używanych w aplikacji: stały kwadratowy rozmiar, `aspect-ratio: 1 / 1`, `flex: 0 0`, `align-self:center`, `justify-self:end`, pełne `min/max width/height`, okrągły `border-radius` oraz zachowanie starego SVG `?` przez `::before`.
- Zachowano lokalne rozmiary tam, gdzie były w starej aplikacji: formularz okucia 26 px, małe helpery w tabeli 24 px.
- Nie zmieniano logiki helperów, treści opisów, WYCENY, duplikatów okuć, override zawiasów, PRO100, ROZRYS, PCV/obrzeży, backupów ani import/export Excel.
- Cache-busting: `20260604_help_qmark_global_shape_fix_v1`. Raport: `tools/reports/help-qmark-global-shape-fix-v1.md`.

## 2026-06-04 — Poprawka kształtu helperów `?` w WYCENIE v1

- Paczka: `site_wycena_question_mark_shape_fix_v1.zip`.
- Poprawiono wyłącznie wygląd ikon `?` w sekcji wyboru zakresu WYCENY. WYCENA używa układu ROZRYS (`panel-box--rozrys` / `rozrys-selection-grid`), przez co przycisk helpera rozciągał się do prostokąta w rzędzie formularza.
- Dodano bardzo wąsko ograniczoną regułę CSS dla `.quote-selection-grid .label-help .info-trigger`, żeby helper zachował okrągły rozmiar 28×28 px jak w działającym modalu okuć.
- Nie zmieniano logiki helperów, treści opisów, WYCENY, duplikatów okuć, zapisu override zawiasów, PRO100, ROZRYS, backupów, PCV/obrzeży ani import/export Excel.
- Cache-busting: `20260604_wycena_qmark_shape_fix_v1`. Raport: `tools/reports/wycena-question-mark-shape-fix-v1.md`.

## 2026-06-04 — Przywrócenie starych helperów `?` v1

- Paczka: `site_help_question_mark_restore_v1.zip`.
- Cofnięto wyłącznie ostatnią zmianę wyglądu helperów `?`: `help-registry.js`, `shared-overlays-choice.css` i dodatkową korektę mobile w `wycena.css` przywrócono do wersji z poprzedniej działającej paczki.
- Usunięto tekstowy fallback `btn.textContent = '?'` oraz dopisany CSS fallbackowy, który na telefonie dawał puste kwadraty/prostokąty zamiast starej okrągłej ikonki.
- Zachowano naprawę podwójnego kliknięcia `Wyceń` oraz poprawioną logikę duplikatu okucia z paczki `site_quote_click_help_duplicate_fix_v1.zip`.
- Nie ruszano PRO100, ROZRYS, PCV/obrzeży, import/export Excel, backupów ani modelu snapshotów ofert.
- Cache-busting: `20260604_wycena_qmark_shape_fix_v1`. Raport: `tools/reports/help-question-mark-restore-v1.md`.


## 2026-06-04 — WYCENA click, helpery `?` i duplikaty okuć v1

- Paczka: `site_quote_click_help_duplicate_fix_v1.zip`.
- Naprawiono podwójne uruchamianie `Wyceń` na mobile: `wycena-generate` po `pointerup` połyka dokładnie jeden kolejny syntetyczny `click` globalnie, a shell WYCENY ma dodatkową blokadę drugiego wywołania tuż po zakończeniu liczenia.
- Przywrócono helpery `?`: centralny `help-registry` nadaje przyciskom tekstowy fallback `?`, a CSS nie zostawia pustych kwadratów/prostokątów, gdy pseudo-element/SVG nie wyrenderuje się na telefonie.
- Sekcja wyboru zakresu WYCENY na mobile przechodzi na jedną kolumnę, żeby helpery i launchery nie zwężały się do pustych prostokątów.
- Duplikat okucia nie jest już oparty wyłącznie o `hardwareType`/nazwę techniczną. Preferowany klucz to producent + kategoria + system/seria + parametry oznaczone `Użyj do porównania`; `hardwareType` zostaje tylko fallbackiem dla legacy/niepełnych danych.
- Dodano regresję `tools/quote-generate-helper-duplicate-regression-smoke.js`.
- Cache-busting: `20260604_quote_click_help_duplicate_fix_v1`. Raport: `tools/reports/quote-click-help-duplicate-fix-v1.md`.

## 2026-06-04 — Trwały zapis ręcznych wymagań zawiasów v1

- Paczka: `site_hinge_override_persistence_fix_v1.zip`.
- Naprawiono błąd, w którym panel `Wymagania techniczne do wyceny` po ponownym renderze modala mógł pracować na starym `draft` szafki. Wizualnie pokazywał `Ręcznie`, ale `Zapisz zmiany` zapisywał aktualny draft bez override.
- Delegowany listener panelu nie trzyma już `room/draft/opts` w zamknięciu z pierwszego renderu. Każdy `renderPanel()` zapisuje aktualny kontekst na kontenerze, a kliknięcia `Zmień`, `Zmień oba` i `Przywróć domyślne` działają na bieżącym drafcie modala.
- Jedno źródło prawdy dla ręcznych wymagań pozostaje w `cabinet.hardwareRequirementOverrides.hinges.doors`: `single` dla jednego frontu oraz `left/right` dla dwóch frontów.
- `setHingeDoorOverride()` zapisuje techniczny snapshot wybranego wymagania (`typeId`, `label`, `technicalParams`) bez producenta i modelu katalogowego. Dzięki temu odczyt po zapisie, MATERIAŁ i WYCENA korzystają z tych samych cech technicznych.
- `Przywróć domyślne` usuwa cały override i czyści puste struktury, zamiast zostawiać pusty pseudo-zapis.
- Rozszerzono testy o przypadek ponownego użycia tego samego kontenera panelu dla innego draftu, zapis `single` dla jednego frontu, osobne `left/right` dla dwóch frontów, `Zmień oba`, `Przywróć domyślne`, cutlistę/MATERIAŁ i WYCENĘ.
- Cache-busting: `20260604_hinge_override_persistence_fix_v1`. Raport: `tools/reports/hinge-override-persistence-fix-v1.md`.

## 2026-06-04 — Naprawa przycisku `Zmień` w wymaganiach zawiasów v2

- Paczka: `site_hinge_change_picker_fix_v2.zip`.
- Naprawiono regresję z poprzedniej paczki: przycisk `Zmień` w panelu `Wymagania techniczne do wyceny` nie może reagować wizualnie i nie otworzyć żadnego okna.
- Jeżeli kaskadowy wybór nie ma wielu wartości na żadnym kroku, program otwiera końcowy aplikacyjny modal `Wybierz wymaganie kompletu zawiasowego` zamiast milczeć.
- Wybranie tej samej wartości, którą szafka ma już domyślnie, nie zapisuje ręcznego override i nie aktywuje `Przywróć domyślne`.
- Zachowano zasadę: WYWIAD pokazuje kanoniczne wymaganie techniczne szafki, a katalogowe 107° pozostaje zamiennikiem WYCENY, nie źródłem domyślnego kąta w panelu.
- Dodano test regresyjny: kliknięcie `Zmień` przy braku wielu kroków kaskady musi otworzyć modal, ale nie może zapisać override przy wyborze tej samej wartości.
- Cache-busting: `20260604_hinge_change_picker_fix_v2`.

## 2026-06-04 — Naprawa domyślnych wymagań zawiasów i kliknięcia „Zmień” v1

- Paczka: `site_hinge_panel_default_fix_v1.zip`.
- WYWIAD/panel wymagań szafki nie może brać nominalnego kąta z konkretnego produktu katalogowego. Kanoniczne wymaganie szafki `110° nakładany` pozostaje `110°`, a produkt `107°` jest tylko kandydatem/zamiennikiem WYCENY w klasie `standardowy 90–120°`.
- `getHingeRequirementPreset()` dla kanonicznych typów zawiasów korzysta z reguł technicznych programu, a nie z pierwszej/scalonej pozycji katalogowej.
- Lista wyboru zawiasów w panelu pokazuje kanoniczne wymagania dla typów bazowych, bez przepisywania kąta zamiennika katalogowego do WYWIADU.
- Kliknięcie `Zmień` nie ustawia już ręcznego override, jeżeli nie został otwarty żaden modal wyboru i użytkownik nic realnie nie wybrał. To zabezpiecza przed samoczynnym przełączeniem stanu panelu/przycisków.
- Dodano regresję: pojedynczy front nie może po kliknięciu/odświeżeniu przejść w układ lewe/prawe, a domyślne wymaganie pojedynczych drzwiczek pozostaje `110° nakładany`.
- Cache-busting: `20260604_hinge_panel_default_fix_v1`.

## 2026-06-04 — Zawias + prowadnik jako komplet lub składane części v1

- Paczka: `site_hinge_driver_components_v1.zip`.
- Dodano kategorię okuć `Prowadniki` oraz jawne parametry techniczne do parowania bez osobnej tabeli zgodności: `rola_kompletu`, `system_kompatybilnosci`, `typ_prowadnika`, `forma_prowadnika`, `pokrycie_prowadnika`.
- `Osobno` nie jest już typem prowadnika; jest sposobem pokrycia prowadnika (`w komplecie` / `osobno` / `bez prowadnika`). Typ prowadnika i forma prowadnika są osobnymi cechami technicznymi.
- `Zerowy uskok` pozostaje cechą zawiasu / klasy zawiasu, nie cechą prowadnika.
- WYCENA może pokryć `Komplet zawiasowy` gotowym kompletem z katalogu albo, gdy wybrany zawias wymaga prowadnika osobno, dobrać osobny prowadnik po tym samym producencie, systemie kompatybilności, typie i formie prowadnika. Nie dodano słownika zgodności — parowanie jest jawne po parametrach.
- W formularzu okucia brakujące obowiązkowe dane techniczne są oznaczane bezpośrednio przy polach: czerwona obwódka/tło i opis `Wymagane do wyceny`.
- Pola boolean, np. hamulec i sprężyna, rozróżniają `Nie ustawiono`, `Tak` i `Nie`; puste pole nie jest już traktowane jak `nie`.
- Dodano test `tools/hinge-driver-components-smoke.js` i rozszerzono testy kompletności danych technicznych.
- Cache-busting: `20260604_hinge_driver_components_v1`. Raport: `tools/reports/hinge-driver-components-v1.md`.

## 2026-06-04 — Zawias 107° jako zamiennik 110° + filtr danych technicznych v1

- Paczka: `site_hinge_107_tech_todo_filter_v1.zip`.
- Naprawiono dobór zawiasów w WYCENIE: `catalogOptionSourceItemIds` i bezpośrednie źródła opcji nie mogą blokować preferowanego producenta. Jeżeli preferencja w WYWIADZIE wskazuje np. GTV, a GTV ma zawias 107° z klasą `standardowy 90–120°` i tymi samymi cechami (`nakładany`, `prowadnik`, `hamulec`, `sprężyna`), WYCENA może dobrać GTV zamiast Bluma 110°.
- Opcje katalogowe zawiasów kanonicznych są grupowane po funkcji/klasie, a nie po samym kącie rzeczywistym. Kąt rzeczywisty jest rankingiem w obrębie tej samej klasy, nie blokadą zamiennika.
- Dodano centralny status kompletności danych technicznych `evaluateItemTechnicalStatus`. Pozycja z brakującymi wymaganymi parametrami technicznymi jest oznaczana jako `Do uzupełnienia tech.` i nie bierze udziału w automatycznym doborze WYCENY ani w podglądzie zamienników jako poprawny kandydat.
- W katalogu `Okucia i akcesoria` dodano jeden szybki filtr `Do uzupełnienia tech.` obejmujący zarówno brak danych, jak i dane niepełne.
- Na karcie okucia dodano czerwony chip `Do uzupełnienia tech.` dla pozycji problemowych. W modalu edycji, w sekcji `Dane techniczne`, program pokazuje listę brakujących parametrów do automatycznej wyceny.
- Dodano test `tools/hardware-technical-completeness-smoke.js` oraz rozbudowano test WYCENY, żeby pilnować przypadku GTV 107° vs Blum 110° i blokowania pozycji z niepełnymi danymi.
- Cache-busting: `20260604_hinge_107_tech_todo_filter_v1`. Raport: `tools/reports/hinge-107-tech-todo-filter-v1.md`.

## 2026-06-03 — Zawiasy: kąt rzeczywisty i klasa zamienności kąta v1

- Paczka: `site_hinge_angle_class_resolver_v1.zip`.
- Rozdzielono w danych technicznych zawiasów dwa znaczenia kąta: `kat_rzeczywisty` jako nominalny/rzeczywisty kąt konkretnego produktu oraz `klasa_kata` jako słownikowa klasa zamienności, np. `standardowy 90–120°`, `zerowy uskok 155°`, `narożny 170°`, `równoległy wpuszczany 95°`, `lodówkowy 95°`.
- Stare pole `kat_otwarcia` jest traktowane jako legacy/źródło migracyjne. Nie powinno być głównym polem edycji dla zawiasów; przy odczycie program przenosi jego wartość do `kat_rzeczywisty` i wylicza `klasa_kata`, jeśli jej brakuje.
- Dobór WYCENY porównuje cechy zawiasów łącznie: nałożenie, klasę zamienności kąta, prowadnik, hamulec/domyk, sprężynę i inne kluczowe parametry. Kąt rzeczywisty służy do rankingu: najpierw dokładny, potem najbliższy w tej samej klasie.
- Zawias 107° z klasą `standardowy 90–120°` może spełnić wymaganie zwykłego 110° przy tym samym nałożeniu/prowadniku/hamulcu. Zawias 170° narożny nie może spełnić wymagania 110°, bo ma inną klasę funkcjonalną.
- W technicznych definicjach zawiasów `Prowadnik / montaż` jest cechą kluczową i ma być porównywany, a nie ignorowany.
- Dodano/rozbudowano test `tools/wycena-hinge-requirement-override-smoke.js`: pilnuje, że GTV 107° w klasie 90–120° może zastąpić wymagane 110°, a 170° narożny nie jest dobierany jako zwykły zawias.
- Cache-busting: `20260603_hinge_angle_class_resolver_v1`. Raport: `tools/reports/hinge-angle-class-resolver-v1.md`.

## 2026-06-03 — WYCENA: ścisły dobór wariantu zawiasu po wymaganiu v1

- Paczka: `site_wycena_hinge_strict_resolver_v1.zip`.
- Naprawiono dobór konkretnego okucia w WYCENIE dla wymagań zawiasów bez `catalogOptionSourceItemIds` albo ze starszych danych. Wymaganie `110° nakładany` nie może dobrać zawiasu `170° narożny` tylko dlatego, że ogólny parametr kąta został potraktowany jako „minimum taki sam albo większy”.
- Resolver WYCENY dla `hardwareGroup: hinges` najpierw sprawdza kanoniczny typ techniczny kandydata: `110° nakładany`, `110° wpuszczany`, `155° zerowy uskok`, `170° narożny`, `równoległy wpuszczany`, `lodówkowy nakładany`. Jeżeli wymaganie jest kanoniczne, kandydat innego typu jest odrzucany.
- Zachowano wcześniejszą zasadę: aktualne wymagania zawiasów idą do WYCENY z centralnego helpera `cabinet-hardware-requirements`, a nie z opisowej kopii cutlisty.
- Rozbudowano test `tools/wycena-hinge-requirement-override-smoke.js`: legacy wymaganie `Zawias 110° nakładany` bez source IDs musi dobrać `71B3550+173L6100`, a nie `71T6550+174E6100`.
- Cache-busting: `20260603_wycena_hinge_strict_resolver_v1`. Raport: `tools/reports/wycena-hinge-strict-resolver-v1.md`.

## 2026-06-03 — WYCENA bierze ręczne wymagania zawiasów z jednej prawdy v1

- Paczka: `site_wycena_hinge_override_source_v1.zip`.
- Naprawiono ścieżkę `WYWIAD → wymagania zawiasów → WYCENA`: ręczne nadpisanie wymagań kompletu zawiasowego w modalu szafki musi zmieniać pozycję dobraną w WYCENIE i wynik finansowy, jeśli wybrany wariant ma inną cenę.
- `WYCENA` zbiera wymagania zawiasów bezpośrednio z centralnego helpera `cabinet-hardware-requirements`, a nie z opisowej/starej kopii w cutliście. Cutlista nadal może pokazywać okucia w MATERIAŁ/ROZRYS, ale dla zawiasów WYCENA ma źródło w wymaganiu technicznym szafki.
- Resolver WYCENY najpierw korzysta z `catalogOptionSourceItemIds` zapisanych przy wymaganiu z katalogu/słowników okuć. Dzięki temu wariant wybrany w panelu, np. równoległy wpuszczany albo lodówkowy, wskazuje konkretną pozycję katalogową wspierającą ten wariant, z preferencją producenta z WYWIADU.
- Różne wymagania lewych i prawych drzwiczek generują osobne linie akcesoriów w WYCENIE, z osobnymi cenami i ilościami. Nie wolno zlewać ich z powrotem do domyślnego `110° nakładany`.
- Dodano test `tools/wycena-hinge-requirement-override-smoke.js`, który symuluje stary/stale cutlist i sprawdza, że WYCENA nadal bierze aktualny override z centralnej logiki szafki.
- Cache-busting: `20260603_wycena_hinge_override_source_v1`. Raport: `tools/reports/wycena-hinge-override-source-v1.md`.

## 2026-06-03 — Wspólne przyciski zawiasów jeden pod drugim v1

- Paczka: `site_hinge_requirements_pair_buttons_stacked_v1.zip`.
- W panelu `Wymagania techniczne do wyceny` dla korpusu dwudrzwiowego wspólne akcje pod kolumnami `Lewe drzwiczki │ Prawe drzwiczki` mają teraz pełną szerokość i są ułożone jedna pod drugą: `Zmień oba`, a pod nim `Przywróć domyślne dla obu`.
- Osobne przyciski per strona (`Zmień`, `Przywróć domyślne`) zostają bez zmian, żeby nadal można było ustawić inne wymagania dla lewych i prawych drzwiczek.
- Zmiana dotyczy tylko układu UI przycisków wspólnych; nie zmieniono logiki wymagań zawiasów, kaskadowego wyboru, katalogu okuć ani danych override.
- Cache-busting: `20260603_hinge_requirements_pair_buttons_stacked_v1`. Raport: `tools/reports/hinge-requirements-pair-buttons-stacked-v1.md`.

## 2026-06-03 — Wspólne akcje zawiasów dla szafki dwudrzwiowej v1

- Paczka: `site_hinge_requirements_pair_actions_v1.zip`.
- W skróconym panelu `Wymagania techniczne do wyceny` dla korpusu dwudrzwiowego zostają osobne akcje per strona: `Zmień` i `Przywróć domyślne` dla lewych oraz prawych drzwiczek.
- Pod obydwoma kolumnami dodano wspólne akcje: `Zmień oba` oraz `Przywróć domyślne dla obu`, żeby jednym wyborem ustawić ten sam komplet zawiasowy na lewą i prawą stronę albo zresetować oba override.
- Wspólna akcja nie zastępuje wyboru per strona. Asymetryczne wymagania nadal są możliwe, a układ `Lewe drzwiczki │ Prawe drzwiczki` pozostaje bez zmian.
- `Zmień oba` korzysta z tego samego kaskadowego wyboru wymagań technicznych: typ/nakładanie → kąt → prowadnik → hamulec/domyk. Nadal nie wybieramy producenta, modelu ani symbolu katalogowego w modalu szafki.
- Cache-busting: `20260603_hinge_requirements_pair_actions_v1`. Raport: `tools/reports/hinge-requirements-pair-actions-v1.md`.

## 2026-06-03 — Kaskadowy wybór wymagań zawiasów i utrzymanie stron drzwiczek v1

- Paczka: `site_hinge_requirements_cascade_keep_doors_v1.zip`.
- Panel `Wymagania techniczne do wyceny` zostaje w skróconym widoku: prosta karta z podsumowaniem, statusem `Domyślnie`/`Ręcznie`, przyciskiem `Zmień` i `Przywróć domyślne`.
- Akcja `Zmień` nie pokazuje już jednej długiej listy wariantów zawiasów. Wybór jest kaskadowy: najpierw typ/nakładanie, potem kąt otwarcia, prowadnik i hamulec/domyk, z opcji zbudowanych z katalogu okuć i `technicalParams`.
- Lista wyboru nie jest zawężana przez aktualny override. Po ręcznym wybraniu np. `równoległy wpuszczany` nadal można wrócić przez kaskadę do `nakładany → 110° → standardowy → hamulec tak`, o ile taki wariant istnieje w systemie.
- Ilość kompletów nie jest parametrem wariantu katalogowego. Lista wyboru nie pokazuje `ilość: 0 kpl.`; ilość zostaje liczona z konkretnej szafki/drzwiczek i pokazywana dopiero w panelu szafki.
- Dla korpusu dwudrzwiowego zmiana jednej strony nie może zwijać układu do jednego bloku `Drzwiczki`; lewe i prawe drzwiczki mają pozostać w dwóch kolumnach z pionową kreską, a override działa per strona.
- Warianty katalogowe są rozróżniane po pełnej sygnaturze technicznej. Dodatkowe przyszłe warianty, np. 110° bez hamulca, inny prowadnik albo inne rozwiązanie sprężyny/domyk, nie powinny nadpisywać standardowego `110° nakładany`.
- Nadal nie wybieramy producenta, modelu ani symbolu katalogowego w modalu szafki; WYCENA ma dobrać pokrycie wymagania z katalogu.
- Cache-busting: `20260603_hinge_requirements_cascade_keep_doors_v1`. Raport: `tools/reports/hinge-requirements-cascade-keep-doors-v1.md`.

## 2026-06-03 — Skrócony panel wymagań zawiasów w modalu szafki v1

- Paczka: `site_hinge_requirements_compact_actions_v1.zip`.
- Panel `Wymagania techniczne do wyceny` pokazuje teraz skrót wymagań zawiasowych zamiast pełnej listy pól technicznych na wierzchu modala.
- Dla drzwiczek panel pokazuje status `Domyślnie` albo `Ręcznie`, krótkie podsumowanie cech kompletu zawiasowego oraz dwa przyciski: `Zmień` i `Przywróć domyślne`.
- `Zmień` otwiera aplikacyjny modal wyboru wymagania technicznego kompletu zawiasowego; nadal nie wybieramy producenta, modelu ani symbolu katalogowego.
- `Przywróć domyślne` usuwa ręczne nadpisanie dla danych drzwiczek i wraca do centralnej reguły szafki.
- Dla szafki dwudrzwiowej zachowano układ: lewe drzwiczki po lewej, prawe po prawej, w jednym rzędzie, z pionową kreską.
- Nie dodano osobnej edycji kąta/prowadnika/hamulca jako niezależnych pól; to zostaje do następnego kroku po uporządkowaniu pełnej listy opcji z systemu.
- Cache-busting: `20260603_hinge_requirements_cascade_keep_doors_v1`. Raport: `tools/reports/hinge-requirements-compact-actions-v1.md`.

## 2026-06-03 — Wymagania zawiasów z katalogu okuć v1

- Paczka: `site_hinge_catalog_requirement_options_v1.zip`.
- Lista wyboru w panelu `Wymagania techniczne do wyceny` nie jest już źródłowo hardcodowaną listą presetów. W normalnym runtime powstaje z katalogu okuć/akcesoriów kategorii `Zawiasy`, z `technicalParams`, z deduplikacją po cechach technicznych i bez pokazywania producenta/modelu w modalu szafki.
- W panelu szafki wymaganie zawiasów jest pokazywane jako `Komplet zawiasowy`: typ/nakładanie, kąt, prowadnik, hamulec i ilość kompletów. To nadal nie jest wybór konkretnej pozycji katalogowej.
- Jedno wymaganie `komplet zawiasowy` niesie informację, że WYCENA ma pokryć je katalogowo jako gotowy komplet albo jako składniki, np. zawias + prowadnik. Brak pokrycia ma być ostrzeżeniem audytu, a nie fallbackiem typu `zawiasy Blum`.
- `cabinet-cutlist` przekazuje akcesoryjne pozycje zawiasów jako `Okucia: komplet zawiasowy`, bez zaszywania producenta BLUM w nazwie materiału źródłowego.
- Utrzymano zasadę: wybór w modalu dotyczy wymagań/cech technicznych, a nie producenta, modelu ani symbolu katalogowego. Producent z preferencji i konkretna cena są zadaniem WYCENY.
- Raport: `tools/reports/hinge-catalog-requirement-options-v1.md`.

## 2026-06-02 — Zasada pokrycia wymagań okuć przez katalog v1

- Paczka: `site_hardware_requirement_coverage_policy_md_v1.zip`.
- Zapisano zasadę dla przyszłych okuć: wymaganie techniczne szafki opisuje potrzebę funkcjonalno-montażową, a nie konkretną pozycję katalogową.
- Przykład dla drzwiczek: w panelu szafki ma istnieć wymaganie `komplet zawiasowy`, czyli zestaw cech: typ/nakładanie, kąt otwarcia, prowadnik, hamulec i ilość kompletów. Nie rozbijać tego w modalu na niezależne wymagania `zawias` oraz `prowadnik`, bo katalog może mieć gotowy komplet albo osobne składniki.
- WYCENA ma pokrywać jedno wymaganie techniczne na dwa dopuszczalne sposoby: najpierw szukać gotowego kompletu spełniającego wszystkie cechy, a jeśli go nie ma, dobrać składniki osobno, np. zawias + prowadnik. Brak składnika ma dawać ostrzeżenie audytu, nie cichy fallback po ogólnej nazwie.
- Ta sama zasada dotyczy przyszłych prowadnic, szuflad, podnośników, cargo, profili LED, drążków i innych okuć: szafka zapisuje wymaganie techniczne, a resolver WYCENY decyduje, czy katalog pokrywa je kompletem czy częściami.
- Lista wyboru wymagań w panelu nie może być hardcodowaną listą presetów. Ma pochodzić z systemu: słowników/kategorii okuć, katalogu akcesoriów i parametrów technicznych, z deduplikacją po cechach, bez pokazywania producenta/modelu w modalu szafki.
- Obecny etap jest zapisem reguły MD i korektą wersjonowania; nie zmienia jeszcze runtime resolvera ani panelu wyboru. Następna poprawka powinna usunąć statyczną listę zawiasów i budować opcje z danych systemu.
- Raport: `tools/reports/hardware-requirement-coverage-policy-md-v1.md`.

## 2026-06-02 — Edytowalne wymagania zawiasów w modalu szafki v1

- Na dole modala szafki panel `Wymagania techniczne do wyceny` pozwala teraz zmienić wymagany typ zawiasu jako cechę techniczną, bez wybierania producenta/modelu katalogowego.
- Przy dwóch drzwiczkach lewe i prawe wymagania są pokazane obok siebie w jednym rzędzie, oddzielone pionową kreską.
- Ilość zawiasów odświeża się z bieżących wymiarów i liczby frontów w trakcie edycji modala.
- Nadpisania wymagań zapisują się w danych konkretnej szafki i przechodzą przez centralny helper wymagań, zgodnie z zasadą jednej prawdy.

# WYWIAD: panel wymagań technicznych szafki v1 — 2026-06-02

- Paczka: `site_cabinet_hardware_requirements_panel_v1.zip`.
- W modalu dodawania/edycji szafki dodano na samym dole sekcję `Wymagania techniczne do wyceny`.
- Sekcja pokazuje wymagania techniczne konkretnej szafki, a nie konkretne produkty katalogowe. Nie pokazuje napisów typu `Blum zawias nakładany`; producent i model ma dobrać dopiero WYCENA z katalogu po wymaganiach.
- W v1 panel pokazuje centralne wymagania zawiasów z `cabinet-hardware-requirements`: cechę/nakładanie, kąt otwarcia, prowadnik, hamulec, ilość i regułę źródłową albo jawny powód braku zawiasów.
- Panel jest tylko widokiem tej samej prawdy, z której korzysta WYCENA. Nie dodano osobnej logiki modala ani równoległych wyliczeń okuć.
- Nie dodano jeszcze edycji override ani prowadnic/szuflad. To następny etap: wymagania prowadnic mają wynikać centralnie z głębokości szafki, typu szuflady i tego, czy szuflada jest frontowa czy wewnętrzna.
- Reguła prowadnic zapisana na przyszłość: zwykła szuflada może mieć prowadnicę maksymalnie `głębokość szafki - 1 cm`; szuflada wewnętrzna maksymalnie `głębokość szafki - 3 cm` z powodu dodatkowego miejsca na front wewnętrzny. Ręczna korekta może zmniejszać długość, ale nie może ustawić długości większej niż dozwolona.
- Nie ruszano PRO100, ROZRYS, import/export Excel okuć, backupów, panelu kategorii, PCV ani modelu snapshotów/ofert.
- Raport: `tools/reports/cabinet-hardware-requirements-panel-v1.md`.

# PCV jedna prawda: MATERIAŁ → WYCENA v1 — 2026-06-01

- Paczka: `site_pcv_single_source_truth_v1.zip`.
- Obrzeża PCV mają jedno źródło prawdy: centralna polityka w `material-edge-store` decyduje, czy dana formatka może mieć PCV, a agregacja mb idzie przez helper MATERIAŁU. WYCENA nie liczy już PCV osobno z agregatu ROZRYSU.
- PCV można zaznaczać i liczyć wyłącznie dla formatek, których realny materiał ma typ `laminat`. Decyzja zależy od materiału konkretnej formatki, nie od nazwy elementu typu bok/front/półka.
- Dla lakieru, akrylu, HDF, blatu, okuć i materiałów nie-laminatowych zakładka MATERIAŁ nie pokazuje checkboxów krawędzi; pokazuje komunikat `Bez PCV — materiał nie jest laminatem`. Stare zapisane krawędzie takich elementów są ignorowane w obliczeniach.
- Audyt WYCENY pokazuje realne mb z elementów z tej samej logiki co `Okleiny — suma mb` w MATERIAŁ, następnie zapas +10%, mb do wyceny, cenę za mb i koszt.
- Utrzymano tylko `Obrzeże PCV standard`; ABS nie jest dodawany.
- Dodano test regresyjny zgodności MATERIAŁ ↔ WYCENA oraz testy blokady PCV dla lakieru, akrylu i HDF.
- Nie ruszano PRO100, ROZRYS, import/export Excel okuć, backupów, panelu kategorii ani modelu ofert poza źródłem ilości PCV.
- Raport: `tools/reports/pcv-single-source-truth-v1.md`.

# WYCENA audyt: ukrycie duplikatów, PCV i jednostki materiałów v1 — 2026-06-01

- Paczka: `site_quote_audit_material_quantities_fix_v1.zip`.
- Główny widok WYCENY nie pokazuje już szczegółowych kart `Materiały z ROZRYS`, `Akcesoria` ani technicznego hintu robocizny. Szczegóły mają być tylko w modalach audytu po kliknięciu linii podsumowania.
- Naprawiono przeliczanie ilości w rejestrze WYCENY: agregat ROZRYS przekazuje formatki w mm, a modal audytu m²/mb ma pokazywać te same rzędy wielkości co zakładka MATERIAŁ. Usunięto błąd ×100 dla HDF/frontów m² i obrzeży.
- Obrzeże `Obrzeże PCV standard` jest dopisywane do cennika materiałów jako widoczna cena startowa, jeżeli istniejące dane użytkownika nie mają żadnej pozycji obrzeża/mb. Nie dodawać ABS.
- Nie zmieniono logiki rozkroju arkuszy, PRO100, ROZRYS, backupów ani pełnego modelu wymagań technicznych wszystkich okuć.

# WYCENA szczegóły modala i dopasowanie okuć v1 — 2026-06-01

- Paczka: `site_quote_details_modal_ui_hardware_match_fix_v1.zip`.
- Baza startowa: `site_quote_calculation_register_v1.zip`.
- Poprawiono modal szczegółów WYCENY: ma własny scroll w środku, stopkę z `Wróć` na dole i treść nie powinna chować się pod przyciskiem.
- Działy w modalu są akordeonami aplikacyjnymi; otwarcie jednego działu zwija pozostałe. Wygląd linijek podsumowania WYCENY poza modalem nie został zmieniony.
- Ostrzeżenia są przypisane do działów: w `Materiały` widać materiałowe, w `Akcesoria` akcesoryjne, w `Robocizna` robociznę; `Razem` pokazuje zbiorczy audyt.
- Startowe obrzeże w cenniku materiałów to tylko `Obrzeże PCV standard` (`mb`, +10% zapasu w wycenie). ABS nie jest dodawany jako osobna pozycja startowa, bo traktujemy go jako zamienny i zbędny na tym etapie.
- Akcesoria w WYCENIE nie powinny zatrzymywać się na nazwie typu `zawiasy Blum`: jeśli część z WYWIADU/ROZRYSU niesie `hardwareRequirement`, WYCENA próbuje dobrać konkretną pozycję z katalogu okuć po producencie z preferencji i cechach technicznych. Jeśli nie znajdzie konkretnego modelu, pokazuje wymaganie techniczne i ostrzeżenie.
- Do seedów zawiasów dodano jawne `technicalParams` dla podstawowych pozycji Blum/GTV, żeby resolver miał czym dopasować wymagania techniczne.
- Stała reguła na przyszłość: każde akcesorium generowane przez materiały/formatki/cutlist dla WYCENY musi mieć przy sobie `hardwareRequirement` z kategorią, grupą, cechami technicznymi i regułą źródłową. Nie wolno opierać wyceny na samej nazwie ogólnej typu `zawiasy Blum`. Jeśli gdzieś brakuje takich wymagań dla rodzaju szafki, dopisać to do kolejki i poprawić reguły dla wszystkich rodzajów szafek, nie punktowo.
- Zaktualizowano `QUOTE_CALCULATION_REGISTER.md`; raport: `tools/reports/quote-details-modal-ui-hardware-match-fix-v1.md`.

# WYCENA rejestr wyliczeń oferty v1 — 2026-05-31

## 2026-05-31 — WYCENA: rejestr wyliczeń i modal szczegółów v1
- Paczka: `site_quote_calculation_register_v1.zip`.
- Dodano `QUOTE_CALCULATION_REGISTER.md` jako stały opis ustaleń: jednostki cennika materiałów, cena startowa, obrzeża +10%, robocizna po szafkach, modal audytu i rzeczy odłożone.
- Dodano centralny `quote-calculation-register`: sumy WYCENY i szczegóły modala pochodzą z jednego rejestru pozycji, bez ukrytych cen.
- Linie podsumowania WYCENY są klikalne bez zmiany wyglądu; otwierają wewnętrzny modal szczegółów kosztu.
- Cennik materiałów ma jednostkę ceny: arkusz / m² / mb / szt. Ceny startowe są widoczne przy pozycji w cenniku i znikają po pierwszej ręcznej edycji (`priceUserEditedAt`).
- Obrzeża są liczone jako mb z elementów + 10% zapasu i zapisują algorytm w szczegółach wyceny.
- Dalsze prace w WYCENIE/cennikach zaczynać od lektury `DEV.md`, `CLOUD_MIGRATION.md` przy danych/storage oraz `QUOTE_CALCULATION_REGISTER.md`.

# WYCENA duplicate modal fix v1 — 2026-05-30

- Aktualna paczka robocza po tym etapie: `site_wycena_duplicate_modal_fix_v1.zip`.
- Baza startowa: `site_wycena_duplicate_offer_guard_v1.zip`.
- Po raporcie użytkownika ustalono, że guard duplikatów działa częściowo: identyczna oferta nie tworzyła już kolejnego snapshotu, ale aplikacja tylko przenosiła/podświetlała istniejącą ofertę bez modala decyzji.
- `wycena-tab-shell.js` ma teraz dedykowany helper decyzji duplikatu: najpierw używa aplikacyjnego `choiceBox`, potem `confirmBox`, a jeżeli modal nie jest dostępny, bezpiecznie anuluje zamiast automatycznie zamieniać ofertę.
- Po wykryciu identycznej oferty modal ma zawsze pokazać dwa działania: czerwone `Anuluj` i zielone `Zamień istniejącą`.
- `Anuluj` nie zapisuje nowego snapshotu i nie zamienia istniejącej oferty; `Zamień istniejącą` odświeża istniejący slot, zachowując ID, nazwę, status i korelację zaakceptowania/odrzucenia/wyboru.
- Diagnostyka WYCENY loguje teraz `duplicateModalShown`, `duplicateModalDecision`, `duplicateModalError` i `duplicateModalUnavailable`.
- Podbito cache-busting do `20260530_wycena_duplicate_modal_fix_v1`.
- Nie ruszano katalogu okuć, resolvera okuć, import/export Excel, backupów/retencji, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani panelu `Kategorie / rodzaje okuć`.
- Raport: `tools/reports/wycena-duplicate-modal-fix-v1.md`.

# WYCENA duplicate offer guard v1 — 2026-05-30

- Aktualna paczka robocza po tym etapie: `site_wycena_duplicate_offer_guard_v1.zip`.
- Baza startowa: `site_wycena_generate_single_flow_v1.zip`.
- Po ustabilizowaniu clean store i pojedynczego flow generowania użytkownik potwierdził, że dwa świadome kliknięcia `Wyceń` mogą utworzyć dwie identyczne oferty. To poprawiono jako regułę biznesową, nie jako awarię kliknięcia.
- Dodano fingerprint identycznej oferty: projekt, inwestor, zakres pomieszczeń, zakres materiałowy, typ wyceny, ustawienia handlowe bez nazwy wersji, linie wyceny i sumy. Nazwa `Oferta — A` / `wariant 2` nie decyduje o unikalności, żeby nie dało się tworzyć duplikatu samą nazwą.
- Jeśli identyczna aktywna oferta już istnieje, program nie tworzy nowego snapshotu. Istniejąca oferta jest podświetlana w historii, a użytkownik dostaje modal aplikacyjny z przyciskami: zielony `Zamień istniejącą` i czerwony `Anuluj`.
- `Zamień istniejącą` zachowuje slot/ID, nazwę i metadane statusu istniejącej oferty, w tym wybraną/zaakceptowaną/odrzuconą korelację, ale odświeża linie i sumy świeżym przeliczeniem.
- `Anuluj` nie zapisuje nic nowego.
- Rzeczywiście inna oferta, np. inny zakres materiałowy `fronty` zamiast `całość`, nadal tworzy kolejny wariant i nie blokuje systemu wielu ofert.
- Dodano `tools/wycena-duplicate-offer-guard-smoke.js`; zaktualizowano test single-flow pod nowy guard duplikatów.
- Podbito cache-busting do `20260530_wycena_duplicate_offer_guard_v1`.
- Nie ruszano katalogu okuć, resolvera okuć, import/export Excel, backupów/retencji, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani panelu `Kategorie / rodzaje okuć`.


## Aktualny etap roboczy

- `site_wycena_generate_single_flow_v1.zip` — poprawka WYCENY po clean store: jedno kliknięcie `Wyceń` nie może tworzyć dwóch snapshotów. Dodano runtime lock i deduplikację replayu `pointerup -> click`, zachowując możliwość wielu świadomych wariantów/ofert dla projektu.

# WYCENA render source diagnostics v1 — 2026-05-30

- Aktualna paczka robocza po tym etapie: `site_wycena_render_source_diagnostics_v1.zip`.
- Baza startowa: `site_wycena_orphan_edit_session_cleanup_v1.zip`.
- Po raportach normalnie/incognito silnik WYCENY liczył poprawnie, ale ekran nadal potrafił pokazywać mylący wariant/snapshot, dlatego dodano diagnostykę źródeł renderu zamiast kolejnej ślepej naprawy.
- `wycena-diagnostics.js` ma build `20260530_wycena_render_source_diagnostics_v1` i nowe sekcje raportu: `ŹRÓDŁA EKRANU WYCENA`, `NAZWA / WARIANT OFERTY`, `SNAPSHOT STORAGE DEEP DIVE`.
- Raport zbiera teraz: historię przekazaną do rendererów, stan preview/shell, bieżący draft oferty, rozstrzygnięty `currentQuote`, faktyczne elementy DOM historii/podglądu, decyzje nazwy wariantu oraz zdarzenia zapisu/usunięcia snapshotów.
- `quote-snapshot-store.js` loguje diagnostycznie `save:before`, `save:after`, `remove:before`, `remove:after`, w tym liczbę rekordów, rozmiar storage, `rawChanged` i widoczność ID po zapisie.
- `wycena-tab-selection-version.js` loguje, skąd bierze się nazwa typu `Oferta — A — wariant 2`: draft, nazwa bazowa, exact-scope snapshoty, `isVersionNameTaken` i modal nazwy.
- `wycena-tab-history.js` oraz `wycena-tab-preview.js` logują wejście do renderu i faktyczne snapshoty przekazywane na ekran.
- `tabs/wycena.js` wystawia dodatkowe metody debug tylko dla diagnostyki: historia, draft, stany preview/shell, `resolveDisplayedQuote`, `getVersionName`.
- Nie ruszano logiki biznesowej WYCENY, katalogu okuć, resolvera okuć, import/export Excel, backupów/retencji, PRO100, usług stolarskich, ROZRYS ani RYSUNKU.
- Raport: `tools/reports/wycena-render-source-diagnostics-v1.md`.


## 2026-05-30 — WYCENA orphan edit session cleanup v1

- Poprawiono przypadek, w którym stara aktywna `fc_edit_session_v1` mogła odtwarzać usunięte snapshoty ofert.
- Nowe sesje edycji zapisują metadane czasu i kontekstu, a stare aktywne sesje bez metadanych są czyszczone jako osierocone legacy.
- Usuwanie oferty z historii czyści także jej kopię z aktywnej sesji edycji.
- Diagnostyka WYCENY ma build `20260530_wycena_orphan_edit_session_cleanup_v1`.


## WYCENA diagnostics report v1 — 2026-05-29

Dodano przycisk `Diag` w zakładce WYCENA. Generuje raport porównawczy normalnej przeglądarki i incognito dla przypadków, w których kliknięcie `Wyceń` reaguje, ale nie tworzy widocznej historii/snapshotu. Raport nie czyści danych i wykonuje test `collectQuoteData` bez zapisu snapshotu.


## Wycena context richer source fix v1 — 2026-05-29

- Poprawka po zgłoszeniu: WYCENA działała w incognito, ale w normalnym trybie z danymi użytkownika nadal nie generowała wyniku.
- Przyczyna do usunięcia: centralny rekord projektu inwestora mógł być pustym szkieletem i wygrywał z bogatszym, realnym projektem zapisanym w legacy slocie `fc_project_inv_*_v1` albo aktywnym `fc_project_v1`. Samo utworzenie nowego inwestora/pomieszczenia nie pomagało, jeśli WYCENA nadal wybierała pusty rekord centralny.
- `wycena-context-repair.js` wybiera teraz najbogatsze źródło projektu dla aktywnego inwestora według zawartości szafek/zestawów/frontów i aktualizuje centralny rekord, jeśli legacy/aktywny projekt ma więcej realnych danych.
- Podbito cache-busting spójnie dla modułów `js/app/wycena/*`, `js/app/quote/*`, `project-model/store`, runtime projektu inwestora oraz testu szafek, żeby normalna przeglądarka nie mieszała starych skryptów z nowym ZIP-em.
- Poprawiono test aplikacyjny zestawu: nie szuka już starej nazwy `Zawias BLUM`, tylko rozpoznaje zawias po `hardwareRequirement.kind === "hinge"` albo nazwie zaczynającej się od `Zawias`.
- Nie ruszano resolvera okuć, katalogu okuć, import/export Excel, backupu, PRO100, ROZRYS, RYSUNKU ani panelu kategorii okuć.

# Furniture Calc — aktualna paczka



### 2026-05-28 — naprawa WYCENY na starym localStorage

- Aktualna paczka: `site_wycena_local_storage_context_repair_v1.zip`.
- Naprawiono przypadek: incognito działa, a normalny tryb z istniejącymi danymi reaguje na `Wyceń`, ale nie pokazuje wyceny.
- Problemem był rozjechany lokalny kontekst danych: aktywny inwestor, aktywny projekt, `fc_project_v1`, draft oferty i snapshoty mogły wskazywać różne projekty/pokoje.
- Naprawa spina aktywnego inwestora z właściwym projektem, aktualizuje `projectData`, oczyszcza draft WYCENY z nieistniejących pokojów i zachowuje dynamiczne pokoje przy normalizacji projektu.
- Nie trzeba ręcznie czyścić `localStorage`; aplikacja powinna sama przełączyć kontekst po otwarciu realnego inwestora/projektu i wejściu w WYCENĘ.
- Nie ruszano resolvera okuć, import/export Excel, backupów, PRO100, ROZRYS, RYSUNKU ani panelu kategorii okuć.

### 2026-05-28 — naprawa danych po starych snapshotach WYCENY

- Normalny tryb przeglądarki nie powinien już dopisywać na liście inwestorów technicznego rekordu `Projekt meblowy` z pustego `quote-snapshot`.
- Recovery inwestora ze snapshotu działa tylko, gdy snapshot zawiera realne dane klienta; puste snapshoty zostają historią ofert, a nie projektem do pracy.
- Przy nieprawidłowym bieżącym wskaźniku aplikacja czyści wybór inwestora/projektu, żeby WYCENA nie zostawała w martwym stanie po kliknięciu `Wyceń`.

Aktualna paczka: `site_wycena_local_storage_context_repair_v1.zip`.

## Ostatnia zmiana

- Naprawiono WYCENĘ w normalnym trybie przeglądarki, gdy istniejące dane lokalne miały rozjechany kontekst inwestora/projektu/snapshotów.
- Aplikacja przed WYCENĄ ustawia spójny aktywny projekt dla otwartego inwestora, odświeża globalne `projectData` i czyści draft oferty z nieistniejących pokojów.
- Normalizacja projektu zachowuje dynamiczne pokoje utworzone w INWESTORZE/WYWIADZIE, zamiast ograniczać dane do starych domyślnych pokojów.
- Dodano smoke test zatrutego localStorage: fałszywy projekt ze snapshotu nie może blokować WYCENY realnego inwestora.
- Nie ruszano resolvera okuć, import/export Excel, backupów, PRO100, usług, ROZRYS ani RYSUNKU.

## site_wywiad_labor_header_compact_v1 — 2026-05-26

- Baza: `site_wywiad_labor_header_status_v1.zip`.
- Zmieniono `js/tabs/wywiad-labor-summary.js`, `css/wywiad.css`, test `tools/app-dev-smoke.js`, dokumentację i cache-busting.
- Raport: `tools/reports/wywiad-labor-header-compact-v1.md`.

## site_wywiad_labor_header_status_v1 — 2026-05-26

- Baza: `site_fridge_single_front_hinges_fix_v1.zip`.
- Zmieniono `js/tabs/wywiad-labor-summary.js`, `js/tabs/wywiad.js`, `css/wywiad.css`, test `tools/app-dev-smoke.js`, dokumentację i cache-busting.
- Raport: `tools/reports/wywiad-labor-header-status-v1.md`.

## site_fridge_single_front_hinges_fix_v1 — 2026-05-25

- Baza: `site_cabinet_hardware_requirements_v1.zip`.
- Zmieniono `js/app/cabinet/front-hardware-fronts.js`, test `tools/app-dev-smoke.js`, dokumentację i cache-busting.
- Raport: `tools/reports/fridge-single-front-hinges-fix-v1.md`.

## site_cabinet_hardware_requirements_v1 — 2026-05-25

- Baza: `site_hardware_producer_accessories_save_fix_v1.zip`.
- Dodano warstwę techniczną `szafka / wariant frontu → wymaganie techniczne okucia` w `js/app/cabinet/cabinet-hardware-requirements.js`.
- Dla lodówki dodano ptaszek `Wymaga zawiasów meblowych`; po zaznaczeniu lodówka używa wymagania `Zawias lodówkowy nakładany`.
- Do katalogu/słowników okuć dodano słownikowe typy/cechy `Równoległy wpuszczany` oraz `Lodówkowy nakładany`.
- Nie dodano fikcyjnej pozycji/ceny Bivert dla zawiasu rogowej ślepej; zostaje do uzupełnienia prawdziwym symbolem i ceną.
- Raport: `tools/reports/cabinet-hardware-requirements-v1.md`.

## site_hardware_producer_accessories_save_fix_v1 — 2026-05-25

- Baza: `site_room_accordion_save_fix_v1.zip`.
- Zmieniono tylko `js/app/ui/wywiad-room-hardware-producers.js`, test `tools/app-dev-smoke.js`, dokumentację i cache-busting.
- Raport: `tools/reports/hardware-producer-accessories-save-fix-v1.md`.

## site_room_accordion_save_fix_v1 — 2026-05-25

- Baza: `site_hardware_producer_preferences_v1.zip`.
- Dodano `js/app/ui/wywiad-room-accordion-actions.js` jako wspólną stopkę zapisu dla akordeonów WYWIADU.
- Zmieniono przyciski zapisu na spójne `Zapisz zmiany`.
- Raport: `tools/reports/room-accordion-save-fix-v1.md`.

## site_hardware_producer_preferences_v1 — 2026-05-24

- Baza: `site_hardware_dictionary_category_stable_panel_v1.zip`.
- Dodano model `room.preferences.hardwareProducers` dla preferencji producentów okuć na poziomie pomieszczenia/projektu.
- Dodano UI `js/app/ui/wywiad-room-hardware-producers.js` z wyborem istniejących producentów katalogu okuć przez aplikacyjny launcher/listę.
- Rozszerzono `app-dev-smoke` o kontrakty nowego akordeonu, brak natywnych selectów, normalizację modelu i pierwszy odczyt preferencji przez WYCENĘ.
- Raport: `tools/reports/hardware-producer-preferences-v1.md`.

## site_hardware_dictionary_category_stable_panel_v1 — 2026-05-24

- Baza: `site_hardware_dictionary_categories_details_body_fix_v1.zip`.
- Przeanalizowano powtarzający się błąd pustego akordeonu `Kategorie / rodzaje okuć`: poprzednie poprawki mieszały mechanikę `details/open`, klasy animowanego body ROZRYS, `hidden`, `max-height` i `overflow`, przez co testy widziały treść w DOM, ale telefon potrafił renderować tylko uciętą pierwszą kartę.
- Wspólny panel kategorii został przebudowany na prostą kartę aplikacyjną `hardware-dictionary-categories-card`: normalna ramka/cień jak ROZRYS, ale bez `details`, bez animowanego body, bez `max-height` i bez clipowania treści.
- Body kategorii jest zwykłym kontenerem `hardware-dictionary-categories-body`; po otwarciu ma pokazywać pełne wiersze kategorii, inputy, przyciski `Usuń` i `Dodaj kategorię`.
- Skorygowano smoke test, żeby pilnował nowej stabilnej struktury i nie przepuszczał powrotu do `rozrys-material-accordion__body` / `hardware-dictionary-section-body` przy liście kategorii.
- Zmiana jest tylko UI/UX i testowa: bez zmian backupów, storage, import/export Excel, zamienników, PRO100, ROZRYS jako funkcji, RYSUNKU i WYCENY.

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

## Hardware hinge dictionary cleanup v1 — 2026-05-26

- Poprawiono nazewnictwo słownikowe zawiasów pod szafki: rogowa ślepa korzysta z realnego typu `Równoległy wpuszczany`, a lodówkowa z `Lodówkowy nakładany`.
- Zaszyte opisowe wartości `Do rogowej ślepej / ślepego narożnika`, `równoległy / do ślepego narożnika` i samo `lodówkowy` zostały zastąpione słownikowymi odpowiednikami.
- Katalog startowy okuć dostał dwie realne pozycje Blum/Bivert: `79B9550+173L6130` oraz `91K9550+194K6100`, z kategorią `Zawiasy`, jednostką `kpl.`, dostawcą Bivert, datą ceny i parametrami technicznymi.
- Instrukcja rozwoju cennika: nowe okucia dopisywać tylko jako rekordy katalogu zgodne z istniejącym modelem i słownikami aplikacji; kod nie może udawać produktu ani ukrywać ceny poza katalogiem.

## 2026-05-30 — WYCENA click/snapshot relink fix
- Naprawa po diagnostyce normalny tryb vs incognito: `collectQuoteData` potrafiło liczyć dane, ale wygenerowana wycena mogła nie zostać widocznie pokazana po zmianie statusu projektu. `wycena-tab-shell.js` ustawia teraz świeżo utworzony snapshot jako aktywny podgląd (`lastQuote`, `previewSnapshotId`) i nie kasuje go przy pojedynczej synchronizacji statusu.
- Przycisk `Wyceń` obsługuje `pointerup` oraz `click` przez jeden strzeżony handler, żeby mobile/click-swallow nie kończył się samą reakcją wizualną bez generowania. Diagnostyka zapisuje teraz osobno zdarzenie przycisku i trace generowania.
- `wycena-context-repair.js` przepina snapshoty tego samego inwestora ze starego `projectId` do aktualnego projektu, jeśli zakres pokoi nadal istnieje. Inwestor odzyskany wcześniej ze źródła `quote-snapshot` z realnymi szafkami jest uzdrawiany jako normalny rekord zamiast blokować bieżący kontekst.

## Aktualna paczka — WYCENA action registry v1

- Paczka: `site_wycena_action_registry_v1.zip`.
- Cel: stabilizacja realnego kliknięcia `Wyceń` przez centralny `data-action` / Actions registry.
- Silnik WYCENY i diagnostyka zostają; nie kasuje danych użytkownika i nie cofa snapshotów/ofert.
- Szczegóły techniczne: `DEV.md` oraz `tools/reports/wycena-action-registry-v1.md`.

## Aktualna paczka — WYCENA orphan edit session cleanup v1

- Paczka: `site_wycena_orphan_edit_session_cleanup_v1.zip`.
- Cel: usunięcie wpływu starej aktywnej `fc_edit_session_v1`, która mogła przywracać usunięte snapshoty ofert.
- Usuwanie snapshotu czyści również jego kopię w sesji edycji, a diagnostyka WYCENY pokazuje build `20260530_wycena_orphan_edit_session_cleanup_v1`.
- Szczegóły techniczne: `DEV.md` oraz `tools/reports/wycena-orphan-edit-session-cleanup-v1.md`.

## WYCENA snapshot clean store v1 — 2026-05-30

- WYCENA zapisuje nowe snapshoty w lekkim formacie `quote-snapshot-slim-v1` bez pełnych katalogów w historii ofert.
- Stare ciężkie snapshoty są odcinane; program ma działać czysto od teraz, bez ratowania starych ofert po regresji.
- Zachowany jest docelowy model: wiele ofert/wariantów na projekt, statusy/wybór/akceptacja/odrzucenie oraz linie potrzebne do przyszłych list zakupowych i czynności.
- Zapis historii ofert jest weryfikowany; błąd localStorage nie jest już ukrywany jako udana wycena.

## Awaryjny rollback — site_restore_thread_start_stable_v1.zip

Ta paczka przywraca aplikację do checkpointu `site_quote_details_accordion_rozrys_auto_height_v1.zip` i wymusza świeże ładowanie plików przez nowy cache-busting. Celem jest odzyskanie stabilnego WYWIADU przed dalszymi pracami.

## 2026-06-09 — Profile stawek godzinowych robocizny

W cenniku stawek wyceny mebli przywrócono cztery systemowe profile stawek godzinowych: warsztatową, montażową, specjalistyczną i pomocnika. Stawki są osobne od zwykłych czynności robocizny. Przy dodawaniu nowej pozycji można zaznaczyć `To jest stawka godzinowa`, podać nazwę przyjazną, kod techniczny i kwotę zł/h. Zwykłe czynności wybierają profil stawki z listy.

Ten etap nie dotyka WYWIADU, modala szafki, źródeł danych w trybiku ani automatów robocizny.

## 2026-06-09 — Robocizna: kaskadowe warunki zastosowania

W formularzu `Stawki wyceny mebli` warunki zastosowania reguły robocizny są edytowane kaskadowo: pierwszy wybór warunku jest widoczny od razu, po wyborze pojawiają się pola `Minimum / od` i `Maksimum / do`, a kolejny pusty wybór pojawia się automatycznie. Nie ma osobnego przycisku `Dodaj warunek`.


## 2026-06-10 — Robocizna: pojedynczy akordeon szafki

Paczka `site_labor_cabinet_single_accordion_dedupe_v1.zip` naprawia audyt robocizny: jedna szafka jest jednym głównym akordeonem, a montaż zawiasów liczony jest raz jako suma lewych/prawych drzwiczek. Nie zmieniono sensu automatów robocizny ani `drawer.count`.
