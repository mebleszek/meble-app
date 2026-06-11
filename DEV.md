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

- Paczka: `site_hourly_rates_settings_v1.zip`.
- Przeniesiono zarządzanie profilami stawek godzinowych z cennika robocizny/usług do trybika jako osobny widok **Stawki godzinowe firmy**.
- Zachowano mechanikę stawek: czynności zależne od czasu nadal wybierają konkretny profil stawki (`workshop`, `assembly`, `specialist`, `helper` albo własny kod), a WYCENA czyta te same definicje z `quoteRates` jako jednego źródła prawdy.
- W trybiku można edytować nazwę przyjazną, kwotę PLN/h, notatkę i aktywność stawek systemowych. Kod techniczny istniejącej stawki jest zablokowany.
- Dodano możliwość tworzenia własnych stawek godzinowych w trybiku. Nowa stawka ma kod techniczny wpisywany przy tworzeniu, a po zapisie kod jest traktowany jak stały klucz.
- Cennik ukrywa definicje stawek godzinowych i nie pokazuje już mylącej kategorii **Stawki godzinowe**; cennik służy do robocizny, montażu, transportu i usług, a nie do edycji profili PLN/h.
- Zmieniono nazwę okna z **Stawki wyceny mebli** na **Cennik robocizny i usług** oraz opis pod nagłówkiem.
- W podsumowaniu WYCENY zmieniono etykietę **Robocizna / stawki wyceny** na **Usługi dodatkowe**. Nie ukryto zerowych wierszy.
- Nie zmieniano jeszcze sposobu naliczania transportu typu kwota startowa + kilometry; to zostaje osobnym etapem po uporządkowaniu stawek godzinowych.
- Cache-busting: `20260611_pricing_modes_v1`.
- Testy: `node --check` zmienionych JS — OK; `node tools/check-index-load-groups.js` — OK; `node tools/hourly-rates-settings-smoke.js` — OK; `node tools/labor-rate-profiles-restore-clean-smoke.js` — OK; `node tools/transport-catalog-quote-fix-smoke.js` — OK; `node tools/company-transport-business-costs-smoke.js` — OK; `node tools/boot-domcontentloaded-init-fix-smoke.js` — OK; `node tools/app-dev-smoke.js` — OK 109/109.
- Raport: `tools/reports/hourly-rates-settings-v1.md`.

## 2026-06-11 — Boot: start aplikacji po DOMContentLoaded v1

- Paczka: `site_boot_domcontentloaded_init_fix_v1.zip`.
- Poprawiono błąd pierwszego wejścia po świeżym wdrożeniu: `boot.js` nie uruchamia już startu aplikacji przy `document.readyState = interactive`, bo wtedy kolejne `defer` z `index.html` mogły jeszcze nie wykonać `app.js` i nie wystawić `FC.init()`.
- `boot-clean-1.6` zachowuje wczesne listenery `error` / `unhandledrejection`, ale sam start aplikacji opóźnia do `DOMContentLoaded` albo `complete`.
- Błąd `Nie znaleziono funkcji startowej aplikacji` jest raportowany dopiero po `window.load` + grace/timeout; nie ma już twardego raportu przed pełnym załadowaniem wszystkich skryptów.
- Nie zmieniano transportu, WYCENY, inwestora, kosztów firmy, robocizny, `drawer.count`, snapshotów ani danych.
- Cache-busting: `20260611_boot_domcontentloaded_init_fix_v1`.
- Testy: `node --check js/boot.js` — OK; `node tools/check-index-load-groups.js` — OK; `node tools/boot-domcontentloaded-init-fix-smoke.js` — OK; `node tools/app-dev-smoke.js` — OK; `node tools/company-transport-business-costs-smoke.js` — OK; `node tools/transport-catalog-quote-fix-smoke.js` — OK.
- Raport: `tools/reports/boot-domcontentloaded-init-fix-v1.md`.

## 2026-06-11 — Transport: poprawka cennika i widoczności w WYCENIE v1

- Paczka: `site_transport_catalog_quote_fix_v1.zip`.
- Poprawiono błąd, w którym edycja startowej pozycji **Transport do klienta** mogła utworzyć drugi wpis z ceną użytkownika, podczas gdy automatyczna WYCENA nadal czytała kanoniczne `transport_distance_km` z ceną 0.
- `FC.laborCatalog.ensureDefaultDefinitions()` konsoliduje teraz zdublowane domyślne definicje robocizny/transportu po `id` albo po podpisie `kategoria + nazwa + quantitySource`. Cena użytkownika i `priceUserEditedAt` przechodzą na kanoniczne ID.
- Domyślnych definicji `DEFAULT_LABOR_DEFINITIONS` nie usuwamy fizycznie z cennika, bo seed programu i tak by je odtworzył. W UI ukryto przycisk Usuń dla tych pozycji i dodano blokadę awaryjną; użytkownik ma edytować cenę, aktywność albo ustawić 0.
- Rejestr WYCENY rozdziela transport do osobnej sekcji `transport`; `totals.quoteRates` nie zawiera transportu, a `totals.transport` jest widoczne jako osobny wiersz **Transport**.
- Linia transportu nadal powstaje z `quoteRateLines` jako automatyczna pozycja z `sourceRole:'transport-distance'`, więc nie dodano nowego magazynu danych.
- Nie ruszano inwestora, ustawień firmy, OpenRouteService, kosztów firmy, robocizny szafek, automatów AGD, snapshotów statusów ani `drawer.count`.
- Cache-busting: `20260611_boot_domcontentloaded_init_fix_v1`.
- Testy: `node --check` zmienionych JS — OK; `node tools/check-index-load-groups.js` — OK; `node tools/app-dev-smoke.js` — OK 109/109; `node tools/company-transport-business-costs-smoke.js` — OK; `node tools/transport-catalog-quote-fix-smoke.js` — OK.
- Raport: `tools/reports/transport-catalog-quote-fix-v1.md`.

## 2026-06-11 — Dane firmy/transport: poprawka pierwszego startu WYCENY v1

- Paczka: `site_company_transport_wycena_core_boot_fix_v1.zip`.
- Poprawiono błąd pierwszego czystego wejścia po wdrożeniu: `wycena-core.js` nie przerywa już bootowania, jeśli zależności `FC.wycenaCore*` nie są widoczne dokładnie w chwili ładowania orkiestratora.
- Zależności WYCENY są teraz sprawdzane leniwie, dopiero przy realnym użyciu API WYCENY, z listą brakujących modułów w komunikacie błędu.
- Nie zmieniono wyniku WYCENY, robocizny, materiałów, transportu, kosztów firmy, danych inwestora ani storage.
- Cache-busting: `20260611_boot_domcontentloaded_init_fix_v1`. Raport: `tools/reports/company-transport-wycena-core-boot-fix-v1.md`.

## 2026-06-11 — Robocizna: czysty porządek kategorii AGD / Montaż AGD v1

- Paczka: `site_labor_appliance_category_clean_rebase_v1.zip`.
- Bazą jest zaakceptowana paczka `site_labor_appliance_separate_automats_v1.zip`; nie bazowano na późniejszych paczkach z niezaakceptowanym cleanupem kategorii/czasów.
- Stary dział robocizny `AGD` jest usuwany z katalogu stawek wyceny jako seedowany śmieć. W cenniku zostaje jeden dział dla sprzętów: `Montaż AGD`.
- Automaty AGD pozostają osobnymi technicznymi kodami. Uzupełniono listę `Montaż AGD` o pozycje odpowiadające staremu działowi AGD: okap podszafkowy/teleskopowy, okap kominowy/wyspowy, pralka, suszarka, ekspres i podgrzewacz szufladowy.
- Nie zmieniano jednostek czasu, listy szybkich opcji czasu ani nie dodano żadnego globalnego zaokrąglania czasu. W szczególności nie ma reguły `0.75 h → 1 h`.
- Nie ruszano WYWIADU, modala szafki, historii ofert, snapshotów, `drawer.count`, audytu robocizny ani warunków automatów.
- Cache-busting: `20260611_labor_appliance_category_clean_rebase_v1`. Raport: `tools/reports/labor-appliance-category-clean-rebase-v1.md`.

## 2026-06-11 — company_transport_business_costs_v1

Baza: `site_labor_appliance_category_clean_rebase_v1.zip`.

Zakres:
- Dodano w trybiku osobne widoki: **Dane firmy i transport** oraz **Koszty firmy**.
- Dodano store `fc_company_profile_v1` dla danych firmy, konfiguracji transportu i OpenRouteService.
- Dodano store `fc_business_costs_v1` dla miesięcznych kosztów firmy.
- Dodano panel **Dojazd / transport** w inwestorze, z ręcznym kilometrażem, otwarciem trasy w mapach i opcjonalnym przeliczeniem przez OpenRouteService.
- Dodano źródło ilości `transport.distance_km` oraz domyślną pozycję cennika `transport_distance_km` / **Transport do klienta**.
- WYCENA dodaje automatyczną linię transportu tylko wtedy, gdy są kilometry, aktywna pozycja i cena za km > 0.
- Dodano raport: `tools/reports/company-transport-business-costs-v1.md`.

Zasady:
- Nie użyto Google Maps API.
- Klucz OpenRouteService jest opcjonalny i wpisywany w ustawieniach.
- Koszty firmy są na tym etapie zapisywane i sumowane, bez automatycznego narzutu w WYCENIE.

Testy:
- `node --check` dla zmienionych plików JS — OK.
- `node tools/check-index-load-groups.js` — OK.
- `node tools/app-dev-smoke.js` — OK, 109/109.
- `node tools/company-transport-business-costs-smoke.js` — OK.

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

## 2026-06-10 — Robocizna: jedna szafka = jeden akordeon, bez dubla zawiasów v1

- Paczka: `site_labor_cabinet_single_accordion_dedupe_v1.zip`.
- `Montaż zawiasu` jest teraz jedną pozycją kosztową na poziomie szafki: ilość = suma wymagań lewych/prawych drzwiczek. Lewa/prawa strona zostaje w opisie technicznym, nie jako osobna główna pozycja kosztowa.
- Modal `Szczegóły: Robocizna szafek` grupuje robociznę po szafce, żeby jedna szafka była jednym głównym akordeonem. Drzwi/szuflady są detalem wewnątrz szafki.
- Nie zmieniono `drawer.count`, jawnych wymagań szuflad/prowadnic, automatów robocizny, `quantitySource`, warunków ani audytu wyliczeń.
- Nie ruszano `cabinet-modal.js`, `cabinets-render.js`, `cabinet-common.css`, WYWIADU ani plusa dodawania szafki.
- Cache-busting: `20260610_labor_audit_readable_lines_v1`. Raport: `tools/reports/labor-cabinet-single-accordion-dedupe-v1.md`.

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


## 2026-06-09 — Podgląd faktów szafek poza modalem

- Paczka: `site_work_quantity_facts_settings_preview_v1.zip`.
- Bazą jest zaakceptowana paczka `site_work_quantity_facts_reader_v1.zip`.
- Dodano podgląd odczytu danych z aktualnego projektu w trybiku `Dane do czynności i wyceny`, poza modalem szafki.
- Podgląd korzysta z read-only adaptera `FC.workQuantityFacts`, pokazuje m.in. wymiary, fronty, zawiasy, półki, szuflady i AGD dla istniejących szafek.
- Nie ruszano `cabinet-modal.js`, `cabinets-render.js`, `cabinet-common.css`, plusa dodawania, edycji szafki, WYCENY, `quoteCalculationRegister`, cennika czynności ani automatów.
- Cache-busting: `20260609_work_quantity_facts_settings_preview_v1`. Raport: `tools/reports/work-quantity-facts-settings-preview-v1.md`.


## 2026-06-09 — site_work_quantity_facts_reader_v1

- Bazą jest zaakceptowana paczka `site_work_quantity_sources_settings_clean_v1.zip`.
- Dodano wyłącznie read-only adapter `FC.workQuantityFacts`, który na żądanie czyta z aktualnej szafki nazwane fakty do przyszłych czynności i wyceny.
- Adapter odczytuje m.in. wymiary, objętość, fronty, zawiasy, półki, szuflady i AGD przez istniejące centralne źródła, bez zapisywania drugiej prawdy w szafce.
- Nie ruszano UI WYWIADU, `cabinet-modal.js`, `cabinets-render.js`, plusa dodawania, WYCENY, `quoteCalculationRegister`, cennika czynności ani automatów.
- Cache-busting: `20260609_work_quantity_facts_settings_preview_v1`. Raport: `tools/reports/work-quantity-facts-reader-v1.md`.


## 2026-06-09 — Źródła danych do czynności i wyceny w trybiku clean v1

- Paczka: `site_work_quantity_sources_settings_clean_v1.zip`.
- Bazą jest zaakceptowana paczka `site_labor_rate_profiles_restore_clean_v1.zip` z działającym WYWIADem i profilami stawek godzinowych.
- Dodano wyłącznie dział trybika `Dane do czynności i wyceny`: nazwa techniczna, nazwa przyjazna, jednostka i opis sposobu liczenia.
- Ten etap nie podpina źródeł do szafek, nie dodaje panelu w modalu szafki, nie zmienia WYCENY, automatów ani `quoteCalculationRegister`.
- Nie ruszano `cabinet-modal.js`, `cabinets-render.js` ani `cabinet-common.css`.
- Cache-busting: `20260609_work_quantity_sources_settings_clean_v1`. Raport: `tools/reports/work-quantity-sources-settings-clean-v1.md`.


## 2026-06-08 — Awaryjny rollback do początku wątku v1

- Paczka: `site_restore_thread_start_stable_v1.zip`.
- Przywrócono kod aplikacji do checkpointu `site_quote_details_accordion_rozrys_auto_height_v1.zip`, czyli stanu sprzed etapów automatów robocizny, profili stawek godzinowych, źródeł danych w trybiku i podglądu danych w szafce.
- Zmieniono wyłącznie cache-busting w `index.html` i `dev_tests.html`, żeby przeglądarka nie ładowała późniejszych plików z cache.
- Celem paczki jest odzyskanie działania WYWIADU: plus dodawania szafki, edycja szafki i modal szafki.
- Po tej paczce nowe funkcje z bieżącego wątku są celowo usunięte z aplikacji.

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

## 2026-06-05 — Dynamiczne cechy zawiasów i TIP-ON v1

- Paczka: `site_hinge_tipon_dynamic_features_v1.zip`.
- Poprawiono centralne domyślne wymagania zawiasów: dla normalnego otwierania domyślny zawias ma `hamulec: tak` i `sprężyna: tak`.
- Dodano centralną obsługę otwierania `TIP-ON` po polu `cabinet.openingSystem`: wymagania zawiasów są dzielone per drzwiczki/front na wariant bez hamulca ze sprężyną (`floor(ilość/2)`) oraz bez hamulca i bez sprężyny (`ceil(ilość/2)`).
- Przebudowano kaskadę wyboru w panelu `Wymagania techniczne do wyceny`: pola wyboru są budowane z dynamicznych parametrów technicznych kategorii `Zawiasy` oznaczonych jako używane do porównania, zamiast ze sztywnej, płytkiej listy.
- Warianty zawiasów różniące się cechami technicznymi, np. hamulcem/sprężyną, dostają osobny podpis techniczny wyboru i nie nadpisują kanonicznych typów `110° nakładany`, `155° zerowy uskok`, `170°` itd.
- WYCENA dalej rozpoznaje funkcjonalną klasę zawiasu, ale dobór produktu katalogowego wymaga zgodności dynamicznych cech oznaczonych `Użyj do porównania`.
- Starterowe seedy zawiasów poprawiono na `hamulec: tak` i `sprężyna: tak`; nie dodano migracji ani automatycznego nadpisywania istniejącego katalogu użytkownika w localStorage.
- Dodano regresję `tools/cabinet-hinge-tipon-spring-smoke.js` i zaktualizowano testy panelu oraz doboru zawiasów w WYCENIE.
- Nie ruszano PRO100, ROZRYS/Optimax jako algorytmu, PCV/obrzeży, backupów, import/export Excel ani modelu snapshotów ofert.
- Cache-busting: `20260605_hinge_tipon_dynamic_features_v1`. Raport: `tools/reports/hinge-tipon-dynamic-features-v1.md`.

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

## 2026-06-04 — Audyt wszystkich helperów `?` i centralny rejestr v1

- Paczka: `site_help_registry_full_audit_v1.zip`.
- Dodano wspólny moduł `js/app/shared/help-registry.js` jako centralne źródło opisów pod ikoną `?`. Rejestr potrafi przechowywać wpisy, otwierać helpery, budować przyciski `info-trigger` i robić prosty audyt ikon przez `data-help-key`.
- Do rejestru podpięto helpery formularza cennika, danych technicznych okuć, słowników okuć, części ROZRYS, WYCENY oraz ustawień danych. Najważniejsze miejsca, które wcześniej miały lokalne opisy lub ogólny błędny tekst, korzystają teraz z centralnego klucza.
- W `Słownikach okuć` poprawiono błędny helper przy `Kategoria / rodzaj okucia`: ma już własny opis, zamiast dziedziczyć tekst od nazwy parametru technicznego.
- `makeAccordion` w ustawieniach danych obsługuje teraz `infoKey`, więc kolejne helpery można dopinać do centralnego klucza bez powielania lokalnej logiki.
- Każdy nowy przycisk `?` tworzony przez nowy helper dostaje `data-help-key`, co pozwala wykrywać brakujące migracje w testach/dev-audytach.
- Cache-busting: `20260604_help_registry_audit_v1`. Raport: `tools/reports/help-registry-audit-v1.md`.

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

# Edytowalne wymagania zawiasów w modalu szafki v1 — 2026-06-02

- Paczka: `site_cabinet_hinge_requirements_live_edit_v1.zip`.
- Panel `Wymagania techniczne do wyceny` nie jest już tylko podglądem dla zawiasów: pozwala zmienić wymagany typ zawiasu jako cechę techniczną, bez wyboru producenta/modelu katalogowego.
- Dla szafki dwudrzwiowej wymagania zawiasów są rozbite per drzwiczki: lewe po lewej, prawe po prawej, w jednym rzędzie z pionowym separatorem.
- Zmiana liczby frontów i wymiarów szafki odświeża ilość zawiasów w panelu na żywo, bez zapisywania i ponownego wejścia w edycję.
- Nadpisania wymagań są częścią danych szafki (`hardwareRequirementOverrides.hinges.doors`) i są używane przez centralny helper `cabinet-hardware-requirements`; nie dodano osobnego storage ani równoległej logiki WYCENY.
- `cabinet-cutlist` korzysta z per-drzwiowych wymagań zawiasów, więc różne wymagania lewego i prawego frontu mogą później trafić do WYCENY jako osobne wymagania techniczne.
- Wybór zawiasu wpuszczanego nie zmienia jeszcze geometrii frontu; to zapisane przygotowanie pod przyszłe spięcie wymagań okuć z logiką wymiaru frontu.
- Raport: `tools/reports/cabinet-hinge-requirements-live-edit-v1.md`.

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

# WYCENA generate single flow v1 — 2026-05-30

- Aktualna paczka robocza po tym etapie: `site_wycena_generate_single_flow_v1.zip`.
- Baza startowa: `site_wycena_snapshot_clean_store_v1.zip`.
- Po raporcie użytkownika ustalono, że czysty store działa, ale pierwsze kliknięcie `Wyceń` potrafiło uruchomić generowanie dwa razy: pierwszy snapshot zapisywał się od razu, a drugi flow pokazywał modal nazwy `wariant 2`; po `Anuluj` zostawał pierwszy snapshot.
- `wycena-tab-shell.js` ma teraz modułowy runtime lock generowania (`generateRuntime`) niezależny od renderu przycisku, więc re-render po `pointerup` nie resetuje ochrony przed syntetycznym `click`.
- Dodano okno deduplikacji `GENERATE_DEDUP_WINDOW_MS = 1500`: replay tego samego tapnięcia/kliknięcia jest ignorowany jako `generate-skipped-duplicate-event`, a generowanie równoległe jako `generate-skipped-in-flight`.
- Jedno świadome kliknięcie tworzy maksymalnie jeden snapshot; drugie świadome kliknięcie po oknie deduplikacji nadal tworzy kolejny wariant/ofertę, więc korelacja wielu ofert i statusów zostaje zachowana.
- Nie zmieniano formatu clean snapshotów v7 ani zasad list wykonawczych; snapshoty nadal trzymają linie materiałów, okuć, usług/AGD, robocizny i elementów, bez pełnych katalogów.
- Dodano `tools/wycena-generate-single-flow-smoke.js`: pusty store + replay eventu po pierwszym kliknięciu daje dokładnie 1 snapshot; dopiero świadome drugie kliknięcie po oknie deduplikacji daje 2 snapshoty/warianty.
- Podbito cache-busting do `20260530_wycena_generate_single_flow_v1`.
- Nie ruszano katalogu okuć, resolvera okuć, import/export Excel, backupów/retencji, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani panelu `Kategorie / rodzaje okuć`.
- Raport: `tools/reports/wycena-generate-single-flow-v1.md`.

# WYCENA snapshot clean store v1 — 2026-05-30

- Aktualna paczka robocza po tym etapie: `site_wycena_snapshot_clean_store_v1.zip`.
- Baza startowa: `site_wycena_render_source_diagnostics_v1.zip`.
- Po raportach diagnostycznych ustalono, że silnik WYCENY liczy poprawnie, ale historia może nadal pokazywać stary `wariant 2`, bo nowe snapshoty nie zawsze były widoczne po zapisie, a stare ciężkie snapshoty zawierały pełne katalogi.
- Stare snapshoty/oferty WYCENY sprzed czystego formatu nie są już migrowane ani ratowane. `quote-snapshot-store` odcina i czyści legacy rekordy z `fc_quote_snapshots_v1` przy starcie modułu.
- Nowy format snapshotu: `version: 7`, `meta.storageSchema: quote-snapshot-slim-v1`, bez pola `catalogs`.
- Nowy snapshot zachowuje korelację wielu ofert/wariantów i statusów przez `id`, `project`, `investor`, `scope`, `commercial`, `totals`, `meta` i `lines`. Linie pozostają źródłem dla przyszłych list wykonawczych: zakupów, materiałów, okuć, usług/AGD i czynności robocizny.
- Zapis `fc_quote_snapshots_v1` jest teraz twardy: `quote-snapshot-store` zapisuje bezpośrednio, weryfikuje liczbę rekordów i obecność ID; przy błędzie rzuca widoczny błąd zamiast cichego sukcesu.
- `wycena-core.buildQuoteSnapshot()` i `quoteSnapshot.saveSnapshot()` nie połykają już błędów zapisu snapshotu.
- `wycena-tab-shell` przerywa generowanie błędem, jeśli snapshot po zapisie nie jest widoczny w store.
- Stary draft nazwy automatycznej typu `Oferta — A — wariant 2` resetuje się do nazwy bazowej, jeśli aktualny clean store nie ma snapshotów dla danego scope.
- Dodano `tools/wycena-snapshot-clean-store-smoke.js`: legacy purge, slim snapshoty, wiele wariantów, wybrany status i reset starego wariantu.
- Podbito cache-busting dla zmienionych modułów WYCENY/QUOTE oraz diagnostyki.
- Nie ruszano katalogu okuć, resolvera okuć, import/export Excel, backupów/retencji, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani panelu `Kategorie / rodzaje okuć`.
- Raport: `tools/reports/wycena-snapshot-clean-store-v1.md`.

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

# DEV.md — meble-app

# WYCENA orphan edit session cleanup v1 — 2026-05-30

- Aktualna paczka robocza po tym etapie: `site_wycena_orphan_edit_session_cleanup_v1.zip`.
- Baza startowa: `site_wycena_action_registry_v1.zip`.
- Po raportach diagnostycznych ustalono, że silnik WYCENY liczy poprawnie, a klik `Wyceń` przechodzi przez Actions registry. Pozostały problem dotyczył starej aktywnej sesji edycji `fc_edit_session_v1`, która mogła zawierać własną kopię `fc_quote_snapshots_v1` i odtwarzać usunięte snapshoty po Anuluj/restore.
- `js/app/investor/session.js` zapisuje teraz metadane sesji: `schemaVersion`, `startedAt`, `updatedAt` i `context` (`investorId`, `projectId`, aktywna zakładka, pokój).
- Stare aktywne sesje edycji bez metadanych są traktowane jako osierocone legacy i usuwane przy starcie, żeby nie przywracały starych snapshotów ofert ani technicznego stanu sprzed migracji.
- Usunięcie snapshotu przez `quoteSnapshotStore.remove(id)` czyści ten sam snapshot także z kopii przechowywanej w `fc_edit_session_v1.snapshot.fc_quote_snapshots_v1`, więc skasowana oferta nie wraca z sesji edycji.
- `wycena-tab-shell.js` po zbudowaniu wyceny sprawdza, czy snapshot faktycznie jest widoczny w `quoteSnapshotStore`; jeśli nie, ponawia zapis i dopisuje ślad diagnostyczny `snapshotSaveRetry` / `snapshotVisibleInStore`.
- Diagnostyka WYCENY ma build `20260530_wycena_orphan_edit_session_cleanup_v1` i pokazuje metadane oraz flagę `legacyOrphan` sesji edycji.
- Dodano `tools/wycena-orphan-edit-session-cleanup-smoke.js`, który sprawdza czyszczenie legacy sesji, metadane nowych sesji i usuwanie snapshotu z kopii sesji edycji.
- Nie ruszano katalogu okuć, resolvera okuć, import/export Excel, backupów/retencji, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani panelu `Kategorie / rodzaje okuć`.
- Raport: `tools/reports/wycena-orphan-edit-session-cleanup-v1.md`.

## WYCENA action registry v1 — 2026-05-30

- Aktualna paczka robocza po tym etapie: `site_wycena_action_registry_v1.zip`.
- Baza startowa: `site_wycena_click_snapshot_relink_v1.zip`.
- Po raportach normalnie/incognito silnik WYCENY (`collectQuoteData`) umiał policzyć wycenę, więc problem przeniesiono z danych na ścieżkę realnego kliknięcia `Wyceń`.
- Przycisk `Wyceń` ma teraz `data-action="wycena-generate"` i idzie przez centralny Actions registry, tak jak pozostałe kluczowe akcje aplikacji.
- `js/app/ui/actions-register.js` rejestruje `wycena-generate`, a `js/app/wycena/wycena-tab-shell.js` wystawia runtime handler `FC.wycenaGenerateAction.run(...)` z aktualnymi zależnościami zakładki WYCENA.
- Usunięto bezpośrednie listenery `pointerup`/`click` z przycisku `Wyceń`, żeby nie było podwójnego źródła prawdy i konfliktu z globalną mobile-safe delegacją.
- Diagnostyka ma build `20260530_wycena_action_registry_v1`; raport po wdrożeniu ma pokazać ten build.
- Podbito cache-busting dla `actions-register.js`, `wycena-diagnostics.js` i `wycena-tab-shell.js` w `index.html` oraz `dev_tests.html`.
- Dodano `tools/wycena-generate-action-registry-smoke.js`.
- Nie ruszano resolvera okuć, katalogu okuć, import/export Excel, backupów, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani danych użytkownika.
- Raport: `tools/reports/wycena-action-registry-v1.md`.

## WYCENA diagnostics report v1 — 2026-05-29

- Aktualna paczka robocza po tym etapie: `site_wycena_diagnostics_report_v1.zip`.
- Baza startowa: `site_wycena_context_richer_source_fix_v1.zip`.
- Po zgłoszeniu, że WYCENA nadal działa w incognito, ale w normalnej przeglądarce z pełnymi danymi kliknięcie `Wyceń` tylko reaguje i nie tworzy widocznej historii/snapshotu, dodano diagnostykę zamiast kolejnego zgadywania migracji storage.
- Dodano `js/app/wycena/wycena-diagnostics.js` oraz przycisk `Diag` w topbarze WYCENY. Otwiera aplikacyjny modal z raportem do skopiowania; nie używa natywnych alertów/promptów.
- Raport pokazuje aktywnego inwestora/projekt, różne źródła projektu (`fc_projects_v1`, `fc_project_v1`, `fc_project_inv_*_v1`), pokoje widziane przez registry/resolver/WYCENĘ, draft oferty, snapshoty, klucze storage, aktywną sesję edycji `fc_edit_session_v1` oraz ślad ostatniego kliknięcia `Wyceń`.
- Diagnostyka wykonuje `collectQuoteData` bez zapisu snapshotu, żeby odróżnić błąd zbierania danych od błędu zapisu/renderu historii.
- `generateQuote` zapisuje ślad kroków w diagnostyce: naprawa kontekstu, selection, naming, quoteBuilt, statusSynced albo błąd.
- Nie czyszczono danych użytkownika, nie usuwano inwestorów/projektów, nie ruszano resolvera okuć, katalogu okuć, import/export Excel, backupów, PRO100, ROZRYS ani RYSUNKU.
- Raport: `tools/reports/wycena-diagnostics-report-v1.md`.


## Wycena context richer source fix v1 — 2026-05-29

- Poprawka po zgłoszeniu: WYCENA działała w incognito, ale w normalnym trybie z danymi użytkownika nadal nie generowała wyniku.
- Przyczyna do usunięcia: centralny rekord projektu inwestora mógł być pustym szkieletem i wygrywał z bogatszym, realnym projektem zapisanym w legacy slocie `fc_project_inv_*_v1` albo aktywnym `fc_project_v1`. Samo utworzenie nowego inwestora/pomieszczenia nie pomagało, jeśli WYCENA nadal wybierała pusty rekord centralny.
- `wycena-context-repair.js` wybiera teraz najbogatsze źródło projektu dla aktywnego inwestora według zawartości szafek/zestawów/frontów i aktualizuje centralny rekord, jeśli legacy/aktywny projekt ma więcej realnych danych.
- Podbito cache-busting spójnie dla modułów `js/app/wycena/*`, `js/app/quote/*`, `project-model/store`, runtime projektu inwestora oraz testu szafek, żeby normalna przeglądarka nie mieszała starych skryptów z nowym ZIP-em.
- Poprawiono test aplikacyjny zestawu: nie szuka już starej nazwy `Zawias BLUM`, tylko rozpoznaje zawias po `hardwareRequirement.kind === "hinge"` albo nazwie zaczynającej się od `Zawias`.
- Nie ruszano resolvera okuć, katalogu okuć, import/export Excel, backupu, PRO100, ROZRYS, RYSUNKU ani panelu kategorii okuć.


## Wycena local storage context repair v1 — 2026-05-28

- Aktualna paczka robocza po tym etapie: `site_wycena_local_storage_context_repair_v1.zip`.
- Baza startowa: `site_quote_snapshot_phantom_investor_fix_v1.zip`; referencja pełnego flow WYCENY/snapshotów: `site_hardware_param_choice_launcher_fix_v1.zip`.
- Naprawiono przypadek, w którym WYCENA działała w incognito, ale w normalnej przeglądarce z istniejącymi danymi kliknięcie `Wyceń` reagowało bez widocznego wyniku.
- Przyczyna: zatruty/stary `localStorage` mógł mieć rozjechany aktywny kontekst (`fc_current_investor_v1`, `fc_current_project_id_v1`, `fc_project_v1`, draft oferty i snapshoty wskazywały różne projekty/pokoje). Dodatkowo `projectModel.normalizeProjectData()` gubił dynamiczne pokoje, więc nowy inwestor/pokój także mógł nie pomagać.
- Dodano `js/app/wycena/wycena-context-repair.js`, który przed WYCENĄ spina aktywnego inwestora, właściwy projekt z `projectStore`, globalne `projectData`, aktywne pokoje i draft oferty.
- `FC.project.load()` preferuje centralny rekord projektu aktualnego inwestora zamiast ślepo ładować stare `fc_project_v1`; `open-investor` jawnie aktywuje projekt otwieranego inwestora.
- `normalizeProjectData()` zachowuje dynamiczne pokoje i pokoje z `meta.roomDefs`, zamiast ograniczać projekt do legacy kluczy `kuchnia/szafa/pokoj/lazienka`.
- Drafty WYCENY są oczyszczane z pokojów nieistniejących w aktualnym projekcie; osierocone snapshoty nie mogą mieszać historii innego projektu z bieżącą pracą.
- Dodano smoke test `tools/wycena-local-storage-context-repair-smoke.js`, który odtwarza zatruty storage z fantomowym snapshotem i sprawdza naprawę kontekstu.
- Nie ruszano resolvera okuć, katalogu okuć, import/export Excel, backupów/retencji, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani panelu `Kategorie / rodzaje okuć`.
- Raport: `tools/reports/wycena-local-storage-context-repair-v1.md`.


## 2026-05-28 — WYCENA/normalny tryb: ochrona przed sztucznym inwestorem ze snapshotu

- Nie wolno odbudowywać inwestora z samego snapshotu WYCENY, jeśli snapshot ma tylko techniczne `investorId`, tytuł typu `Projekt meblowy` i brak realnych danych klienta. Taki snapshot jest historią oferty, a nie źródłem nowego inwestora.
- `quote-snapshot`/`quote-snapshot-store` może służyć do recovery inwestora tylko wtedy, gdy snapshot niesie realną tożsamość klienta: nazwę, firmę, telefon, email, adres, NIP albo inne ręcznie wpisane dane.
- Jeżeli bieżący inwestor wskazuje na odrzucony rekord snapshot-only, aplikacja ma wyczyścić wskaźnik bieżącego inwestora/projektu zamiast zostawić WYCENĘ w stanie „klik działa, ale nic się nie generuje”.
- Nie usuwać pełnego mechanizmu snapshotów, wariantów, wyborów i statusów WYCENY. Snapshoty są historią ofert; problemem było tylko użycie pustych snapshotów jako źródła listy inwestorów.

## Hardware hinge dictionary cleanup v1 — 2026-05-26

- Aktualna paczka robocza po tym etapie: `site_hardware_hinge_dictionary_cleanup_v1.zip`.
- Baza startowa: `site_wywiad_labor_header_compact_v1.zip`.
- Poprawiono słownikową warstwę zawiasów: rogowa ślepa / ślepy narożnik używa teraz realnej cechy `Równoległy wpuszczany`, a lodówka używa cechy `Lodówkowy nakładany`.
- Usunięto z domyślnych słowników błędne opisowe wartości `Do rogowej ślepej / ślepego narożnika`, `równoległy / do ślepego narożnika` i samo `lodówkowy`; normalizacja przenosi starsze zapisane wartości na nowe słownikowe odpowiedniki bez kasowania danych użytkownika.
- Reguła szafki `rogowa_slepa` zwraca wymaganie `Zawias równoległy wpuszczany` z parametrem `nalozenie = równoległy wpuszczany`, a lodówkowa z ptaszkiem zwraca `Zawias lodówkowy nakładany` z parametrem `nalozenie = lodówkowy nakładany`.
- Do seedów cennika okuć dopisano realne pozycje Blum z Bivert zgodnie z istniejącym modelem katalogu: `79B9550+173L6130` jako zawias równoległy wpuszczany 95° + prowadnik oraz `91K9550+194K6100` jako zawias lodówkowy nakładany 95° + prowadnik.
- Nie dodano żadnej fikcyjnej pozycji z ceną; nowe wpisy mają producenta, dostawcę, kategorię, jednostkę, system, parametry techniczne słownikowe, datę ceny i notatkę tak jak pozostałe seedowane pozycje katalogu.
- Zasada na przyszłość: żadne realne okucie nie może być zaszyte w programie jako ukryty produkt. Kod może wyznaczać wymaganie techniczne, ale pozycja do cennika/wyceny musi być rekordem katalogu zbudowanym ze słowników aplikacji: producent, kategoria, typ/cecha, parametry techniczne, dostawca i ceny.
- Przy dodawaniu nowych pozycji cennika najpierw sprawdzić istniejący sposób zapisu w `hardware-catalog-seed-data.js` i aktualne słowniki w dziale `Okucia i akcesoria → Słowniki`; nowe dane dopisywać zgodnie z istniejącym formatem, bez ręcznego obchodzenia słowników.
- Rozszerzono `tools/app-dev-smoke.js` o regresję migracji starych nazw, nowych wartości słownika i obecności nowych seedów cennika.
- Zaktualizowano cache-busting `hardware-technical-params.js`, `hardware-catalog.js`, `hardware-catalog-seed-data.js` i `cabinet-hardware-requirements.js` w `index.html` oraz `dev_tests.html`.
- Nie ruszano panelu `Kategorie / rodzaje okuć`, animacji tego panelu, import/export Excel, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani pełnego resolvera katalogowego WYCENY.
- Raport: `tools/reports/hardware-hinge-dictionary-cleanup-v1.md`.

## Wywiad labor header compact v1 — 2026-05-26

- Aktualna paczka robocza po tym etapie: `site_wywiad_labor_header_compact_v1.zip`.
- Baza startowa: `site_wywiad_labor_header_status_v1.zip`.
- Na karcie szafki w WYWIADZIE nagłówek dodatków robocizny pokazuje teraz tylko nazwy czynności, bez ilości typu `×3`; ilości zostają w rozwiniętej sekcji `Czynności robocizny`.
- Czynności robocizny w nagłówku są kolorowane na pomarańczowo jako informacja ostrzegawcza/dodatkowa robota, a status montażu sprzętu zostaje: zielony dla montażu wliczonego i czerwony dla `bez montażu`.
- Nie zmieniano wielkości, wagi ani ogólnej typografii tekstów w nagłówku; zmiana dotyczy wyłącznie treści i koloru linii czynności.
- Rozszerzono `tools/app-dev-smoke.js` o regresję, że nagłówek nie pokazuje ilości `×2/×3` i że czynności mają osobny pomarańczowy kolor.
- Zaktualizowano cache-busting `wywiad.css`, `wywiad-labor-summary.js` i `wywiad.js` w `index.html` oraz `dev_tests.html`.
- Nie ruszano panelu `Kategorie / rodzaje okuć`, backupów, storage, import/export Excel, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani pełnego resolvera katalogowych pozycji okuć do WYCENY.
- Raport: `tools/reports/wywiad-labor-header-compact-v1.md`.

## Wywiad labor header status v1 — 2026-05-26

- Aktualna paczka robocza po tym etapie: `site_wywiad_labor_header_status_v1.zip`.
- Baza startowa: `site_fridge_single_front_hinges_fix_v1.zip`.
- Na karcie szafki w WYWIADZIE status montażu sprzętu jest teraz kolorowany zgodnie z wyborem: `bez montażu` na czerwono, `z montażem` na zielono.
- Dodatkowe czynności robocizny w nagłówku karty są renderowane w osobnych liniach, bez zmiany wielkości, wagi ani ogólnej typografii.
- `js/tabs/wywiad-labor-summary.js` dostał `getHeaderLines()` i `renderHeaderSummary()`, a stary `getHeaderText()` zostaje kompatybilny jako tekstowy fallback/test.
- Rozszerzono `tools/app-dev-smoke.js` o regresję czerwonego/zielonego statusu i osobnych linii czynności.
- Zaktualizowano cache-busting `wywiad.css`, `wywiad-labor-summary.js` i `wywiad.js` w `index.html` oraz `dev_tests.html`.
- Nie ruszano panelu `Kategorie / rodzaje okuć`, backupów, storage, import/export Excel, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani pełnego resolvera katalogowych pozycji okuć do WYCENY.
- Raport: `tools/reports/wywiad-labor-header-status-v1.md`.

## Fridge single front hinges fix v1 — 2026-05-25

- Aktualna paczka robocza po tym etapie: `site_fridge_single_front_hinges_fix_v1.zip`.
- Baza startowa: `site_cabinet_hardware_requirements_v1.zip`.
- Naprawiono regresję lodówkowej: przy `fridgeFrontCount:'1'` i zaznaczonym `Wymaga zawiasów meblowych` program nie może liczyć zawiasów od dwóch frontów góra/dół.
- `js/app/cabinet/front-hardware-fronts.js` używa teraz realnego `details.fridgeFrontCount`: `1` oznacza jeden duży front, `2` oznacza dolny + górny front.
- Liczenie zawiasów lodówkowych korzysta z tej samej listy frontów, więc ilość zawiasów wynika z realnej liczby frontów, a nie ze starego założenia dwóch frontów.
- Rozszerzono `tools/app-dev-smoke.js` o test regresji dla lodówki z jednym dużym frontem i zawiasami meblowymi.
- Zaktualizowano cache-busting `front-hardware-fronts.js` w `index.html` i `dev_tests.html`.
- Nie ruszano panelu `Kategorie / rodzaje okuć`, backupów, storage, import/export Excel, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani pełnego resolvera katalogowych pozycji okuć do WYCENY.
- Raport: `tools/reports/fridge-single-front-hinges-fix-v1.md`.

## Cabinet hardware requirements v1 — 2026-05-25

- Aktualna paczka robocza po tym etapie: `site_cabinet_hardware_requirements_v1.zip`.
- Baza startowa: `site_hardware_producer_accessories_save_fix_v1.zip`.
- Dodano warstwę techniczną `js/app/cabinet/cabinet-hardware-requirements.js`: typ szafki / wariant frontu → wymaganie techniczne okucia. Ten etap nie dobiera jeszcze konkretnego produktu katalogowego do WYCENY.
- Reguły v1 dla zawiasów obejmują m.in. standard 110° nakładany, narożną L 170°, rogowe ślepe / ślepy narożnik jako zawias równoległy wpuszczany, lodówkowe po ręcznym ptaszku jako lodówkowy nakładany, dolne podblatowe jako stojące bez nóg, wyjątki HK-XS i nożycowy Häfele z pomocniczymi zawiasami 110°.
- `js/app/cabinet/front-hardware-hinges.js` nie nalicza zawiasów dla wariantów, które ich nie wymagają: zmywarka, szuflady, zlewowa z szufladą, piekarnikowa z szufladą, dolna podblatowa z szufladami/brakiem frontu, okapowa z klapą i lodówka bez ptaszka `Wymaga zawiasów meblowych`.
- Lodówkowa dostała w modalu frontów aplikacyjny checkbox/chip `Wymaga zawiasów meblowych`; po zaznaczeniu używa wymagania `Zawias lodówkowy nakładany`, a ilość jest liczona z realnych frontów lodówki.
- `js/app/cabinet/cabinet-cutlist.js` dopina do partów okuć pole `hardwareRequirement`, żeby przyszły resolver katalogowy i WYCENA miały jawny kontekst techniczny bez zgadywania.
- Do katalogu/słowników okuć dodano słownikowe typy/cechy: `hinge_parallel_inset` (`Równoległy wpuszczany`) i `hinge_fridge_overlay` (`Lodówkowy nakładany`) oraz wartości parametru `nalozenie`: `równoległy wpuszczany` i `lodówkowy nakładany`.
- W późniejszym etapie `hardware_hinge_dictionary_cleanup_v1` dopisano realną pozycję Bivert dla zawiasu równoległego wpuszczanego; nadal obowiązuje zasada, że nie wolno tworzyć fikcyjnych pozycji bez prawdziwego symbolu i ceny.
- Na przyszłość zostaje: pełna logika okapowej drzwiczki/klapa + montaż AGD okapu, szuflady wewnętrzne 155° zerowy uskok albo `na dystansie` np. 1,8 cm, warstwa front nakładany/wpuszczany/bliźniaczy, resolver wymaganie techniczne + preferowany producent + pozycja katalogowa + cena `Do wyceny`, a także edycja poszczególnych korpusów zestawu.
- Rozszerzono `tools/app-dev-smoke.js` o testy regresji reguł zawiasów, ptaszka lodówki i nowych typów/cech katalogu.
- Nie ruszano panelu `Kategorie / rodzaje okuć`, backupów, import/export Excel, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani pełnego resolvera katalogowych pozycji okuć do WYCENY.
- Raport: `tools/reports/cabinet-hardware-requirements-v1.md`.

## Hardware producer accessories save fix v1 — 2026-05-25

- Aktualna paczka robocza po tym etapie: `site_hardware_producer_accessories_save_fix_v1.zip`.
- Baza startowa: `site_room_accordion_save_fix_v1.zip`.
- Naprawiono zgłoszoną regresję: pole `Pozostałe akcesoria` w akordeonie `Preferencje producentów okuć` nie mogło tracić wartości po kliknięciu `Zapisz zmiany`.
- `js/app/ui/wywiad-room-hardware-producers.js` dostał bezpieczny odczyt wartości z launcherów przy zapisie (`data-hardware-producer-key/value`) oraz bufor draftu na czas przebudowy widoku.
- Rozszerzono `tools/app-dev-smoke.js` o test roundtrip `room.preferences.hardwareProducers.accessories` i kontrakt UI zapisu wartości launcherów.
- Nie ruszano panelu `Kategorie / rodzaje okuć`, backupów, import/export Excel, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani pełnego resolvera katalogu okuć do wyceny.
- Raport: `tools/reports/hardware-producer-accessories-save-fix-v1.md`.

## Room accordion save fix v1 — 2026-05-25

- Aktualna paczka robocza po tym etapie: `site_room_accordion_save_fix_v1.zip`.
- Baza startowa: `site_hardware_producer_preferences_v1.zip`.
- Poprawiono regresję zapisu w `Preferencjach producentów okuć`: wybrany producent, np. Blum, nie jest czyszczony przy zapisie/przebudowie widoku, jeżeli lista producentów jest chwilowo niedostępna.
- Dodano wspólny helper `js/app/ui/wywiad-room-accordion-actions.js` dla zielonego przycisku `Zapisz zmiany` w akordeonach WYWIADU pomieszczenia.
- `Parametry pomieszczenia` dostały zielony przycisk `Zapisz zmiany`; pola w akordeonie działają teraz jak draft z podglądem auto-wysokości i zapisują komplet parametrów po kliknięciu przycisku.
- `Preferencje producentów okuć` i `Preferencje materiałów i kolorów` używają tego samego helpera stopki zapisu; materiały zachowują przycisk `Zastosuj do istniejących szafek`.
- Nie ruszano panelu `Kategorie / rodzaje okuć`, backupów, import/export Excel, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani pełnego resolvera katalogu okuć do wyceny.
- Raport: `tools/reports/room-accordion-save-fix-v1.md`.

## Hardware producer preferences v1 — 2026-05-24

- Aktualna paczka robocza po tym etapie: `site_hardware_producer_preferences_v1.zip`.
- Baza startowa: `site_hardware_dictionary_category_stable_panel_v1.zip`.
- W `WYWIADZIE` dodano osobny akordeon `Preferencje producentów okuć` między `Parametry pomieszczenia` i preferencjami materiałowymi.
- Dotychczasowy akordeon `Preferencje standardu` zmieniono na `Preferencje materiałów i kolorów`, bo zawiera strefowe wybory korpusu, frontu, pleców, kolorów i otwierania.
- Preferencje producentów okuć są rozbite na: `Zawiasy`, `Szuflady / prowadnice`, `Podnośniki`, `Cargo`, `Pozostałe akcesoria`.
- Wybór producenta odbywa się wyłącznie przez launcher aplikacyjny z istniejących producentów katalogu okuć; nie dodano natywnych selectów ani ręcznego wpisywania producenta w WYWIADZIE.
- Model `room.preferences` dostał pole `hardwareProducers` bez nowego klucza storage; pozostaje w danych pomieszczenia/projektu.
- WYCENA dostała pierwszy bezpieczny most: uproszczone linie okuć typu `zawiasy BLUM` i `podnośniki BLUM` mogą użyć producenta ustawionego w preferencjach pomieszczenia przy agregacji/nazwie linii. Nie zapisuje to zamian do projektu i nie uruchamia jeszcze pełnego resolvera katalogowych pozycji okuć.
- Rozszerzono testy `app-dev-smoke` o nowy akordeon, brak natywnych selectów, normalizację `hardwareProducers` i pierwszy kontrakt `WYWIAD → WYCENA`.
- Nie ruszano panelu `Kategorie / rodzaje okuć`, backupów, import/export Excel, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani polityki backupów.
- Raport: `tools/reports/hardware-producer-preferences-v1.md`.

## Hardware dictionary category stable panel v1 — 2026-05-24

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_category_stable_panel_v1.zip`.
- Baza startowa: `site_hardware_dictionary_categories_details_body_fix_v1.zip`.
- Przeanalizowano powielany błąd wspólnego akordeonu `Kategorie / rodzaje okuć`: `details/open`, klasy animowanego body ROZRYS, `hidden`, `max-height` i `overflow` dawały poprawną treść w DOM, ale na telefonie wizualnie ucinały listę do pustej/niepełnej karty.
- Wspólny panel kategorii został odseparowany od mechaniki animowanych akordeonów: `hardware-dictionary-categories-card` trzyma ramkę/cień jak ROZRYS, a `hardware-dictionary-categories-body` jest zwykłym, nieanimowanym kontenerem bez `max-height` i bez clipowania.
- Mini-akordeony parametrów technicznych zostają bez zmian: jeden otwarty naraz, natychmiastowe zamknięcie starego, płynne rozwijanie nowego.
- Test `app-dev-smoke` pilnuje, że lista kategorii nie używa już `rozrys-material-accordion__body`, `hardware-dictionary-section-body`, `details/open` ani starego selektora `categories-accordion:not([open])`.
- Bez zmian w modelu danych, backupie, storage, imporcie/eksporcie, PRO100, usługach, RYSUNKU, WYCENIE i zamiennikach.
- Raport: `tools/reports/hardware-dictionary-category-stable-panel-v1.md`.


## Hardware dictionary categories details body fix v1 — 2026-05-24

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_category_stable_panel_v1.zip`.
- Baza startowa: `site_hardware_dictionary_category_frame_restore_v1.zip`.
- Naprawiono regresję pustego/uciętego akordeonu `Kategorie / rodzaje okuć`: wspólny akordeon kategorii wrócił do stabilnej mechaniki `details/summary`, a jego body ma klasę `hardware-dictionary-categories-body` bez animowanego `max-height`.
- Zachowano wygląd aplikacyjny/ROZRYS: jedna ramka, cień, chevron i zaokrąglone rogi; treść kategorii pozostaje w normalnym przepływie dokumentu, żeby telefon nie pokazywał tylko uciętej pierwszej karty.
- Skorygowano testy `app-dev-smoke`: sprawdzają strukturę `details`, realne wiersze kategorii, input `Zawiasy`, przyciski `Usuń`/`Dodaj kategorię` oraz zamknięcie i ponowne otwarcie bez utraty treści.
- Bez zmian w modelu danych, backupie, storage, imporcie/eksporcie, PRO100, usługach, RYSUNKU, WYCENIE i zamiennikach.
- Raport: `tools/reports/hardware-dictionary-categories-details-body-fix-v1.md`.

# DEV — aktywne zasady rozwoju meble-app

Ten plik jest krótką, aktualną mapą pracy. Stare wpisy historyczne zostały przeniesione do `DEV_HISTORY_20260425.md` i nie są źródłem bieżących decyzji architektonicznych.

## Aktualna baza

- Aktualna paczka robocza po tym etapie: `site_cabinet_hardware_requirements_v1.zip`.
- Baza startowa tej paczki: `site_hardware_producer_accessories_save_fix_v1.zip`.
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


## Hardware dictionary category frame restore v1 — 2026-05-24

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_category_frame_restore_v1.zip`.
- Baza startowa: `site_hardware_dictionary_category_no_clip_v1.zip`.
- Przeanalizowano regresję wizualną po próbach naprawy pustego akordeonu `Kategorie / rodzaje okuć`: wymuszenie `overflow: visible` na zewnętrznym akordeonie pomagało omijać clipowanie, ale psuło jednolitą ramkę i zaokrąglone narożniki wzorca ROZRYS.
- Akordeon kategorii ma teraz zewnętrzną ramkę jak ROZRYS (`overflow:hidden`, jedna karta, jeden cień), a lista kategorii siedzi w dedykowanym body `hardware-dictionary-category-section-body`, które nie używa animowanego `hardware-dictionary-section-body` ani `rozrys-material-accordion__body`.
- Test regresji w `tools/app-dev-smoke.js` został skorygowany tak, żeby pilnował pełnej zawartości listy kategorii i braku powrotu problematycznych klas/overflow.
- Bez zmian storage, backupu, import/export Excel, zamienników, PRO100, ROZRYS jako funkcji, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-dictionary-category-frame-restore-v1.md`.


## Hardware dictionary category body guard v1 — 2026-05-24

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_category_body_guard_v1.zip`.
- Baza startowa: `site_hardware_dictionary_category_regression_fix_v1.zip`.
- Przeanalizowano regresję z telefonu: wspólny akordeon `Kategorie / rodzaje okuć` miał poprawną zawartość w DOM, ale mógł być wizualnie przycięty przez animację `max-height`, więc użytkownik widział pustą/uciętą ramkę zamiast listy kategorii.
- Dla tego jednego wspólnego akordeonu kategorii ustawiono bezpieczny tryb otwarcia bez przycinania body; `max-height` i `overflow:hidden` nie zostają na otwartym panelu. Mini-akordeony parametrów technicznych nadal mają dotychczasowe animowane rozwijanie.
- Zaostrzono `tools/app-dev-smoke.js`: test regresji sprawdza wiersze kategorii, input `Zawiasy`, przycisk `Usuń`, przycisk `Dodaj kategorię`, brak ukrycia body i brak stylu przycinającego po ponownym otwarciu.
- Bez zmian storage, backupu, import/export Excel, zamienników, PRO100, ROZRYS jako funkcji, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-dictionary-category-body-guard-v1.md`.

## Hardware dictionary category regression fix v1 — 2026-05-24

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_category_regression_fix_v1.zip`.
- Baza startowa: `site_hardware_dictionary_rozrys_accordion_pattern_v1.zip`.
- W `Słowniki okuć → Kategorie / rodzaje okuć` naprawiono regresję pustego body wspólnego akordeonu: render listy kategorii odbywa się przed finalnym nałożeniem stanu widoczności, a po przebudowie zawartości akordeon pilnuje, żeby body nie zostało ukryte ani z zerowym `max-height`.
- Dla małych ekranów chevron w akordeonie kategorii ma równy odstęp od góry, dołu i prawej strony; ten sam kierunek dopisano w `dev_ui_patterns.html → Accordion ROZRYS + ruch`.
- `tools/app-dev-smoke.js` ma nowy test regresji, który otwiera modal słowników, sprawdza obecność wierszy kategorii, zamyka i ponownie otwiera akordeon.
- `tools/app-dev-smoke-lib/mini-document.js` dostał minimalne wsparcie dla `hidden` i selektorów `:scope > ...`, żeby test DOM dla akordeonu sprawdzał realne zachowanie zamiast tylko tekstów w plikach.
- Nie normalizowano innych akordeonów w aplikacji; bez zmian storage, backupu, import/export Excel, zamienników, PRO100, ROZRYS jako funkcji, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-dictionary-category-regression-fix-v1.md`.

## Hardware dictionary ROZRYS accordion pattern v1 — 2026-05-23

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_rozrys_accordion_pattern_v1.zip`.
- Baza startowa: `site_hardware_dictionary_category_content_single_open_v1.zip`.
- W `dev_ui_patterns.html → Wzorce UI` wzorzec akordeonu ROZRYS pokazuje teraz jeden spójny kierunek: wygląd 1:1 z ROZRYSU, chevron po prawej, `aria-expanded`, natychmiastowe zamykanie starej sekcji i płynne rozwijanie nowej.
- W `Słowniki okuć → Kategorie / rodzaje okuć` wspólny akordeon korzysta z klas ROZRYS i ma widoczny chevron w takim samym stylu jak w ROZRYSIE.
- Dla wspólnego akordeonu kategorii dodano tę samą zasadę ruchu co w dzisiejszych mini-akordeonach: zamknięcie natychmiast, otwarcie płynne, z obsługą `prefers-reduced-motion`.
- Nie normalizowano pozostałych akordeonów w całej aplikacji; zmiana jest celowo ograniczona do wzorca UI i poprawianego akordeonu słowników okuć.
- Bez zmian storage, backupu, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-dictionary-rozrys-accordion-pattern-v1.md`.

## Hardware dictionary category content / single open v1 — 2026-05-23

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_category_content_single_open_v1.zip`.
- Baza startowa: `site_hardware_dictionary_categories_accordion_v1.zip`.
- Wspólny akordeon `Kategorie / rodzaje okuć` został poprawiony z natywnego `details` na kontrolowany panel aplikacyjny z `aria-expanded`, żeby po rozwinięciu na telefonie widoczna była pełna zawartość listy kategorii, a nie ucięty fragment pierwszego wiersza.
- W `Parametry techniczne kategorii` otwarcie jednej kategorii zamyka pozostałe kategorie techniczne, więc przy przechodzeniu np. z `Zawiasy` do `Szuflady / prowadnice` poprzednia długa sekcja znika.
- Zmiana jest wyłącznie UI/UX słowników okuć: bez zmian storage, backupu, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-dictionary-category-content-single-open-v1.md`.

## Hardware dictionary categories accordion v1 — 2026-05-23

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_categories_accordion_v1.zip`.
- Baza startowa: `site_hardware_dictionary_param_instant_close_v1.zip`.
- W modalu `Słowniki okuć` cała sekcja `Kategorie / rodzaje okuć` jest teraz jednym wspólnym akordeonem.
- Zwinięcie sekcji kategorii odsłania więcej miejsca do pracy na `Parametry techniczne kategorii`, bez zmiany modelu danych kategorii i parametrów.
- Lista kategorii, pola edycji nazw i przycisk `Dodaj kategorię` działają jak dotychczas, tylko znajdują się wewnątrz wspólnego panelu.
- Zmiana jest wyłącznie UI/UX słowników okuć: bez zmian storage, backupu, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-dictionary-categories-accordion-v1.md`.


## Hardware dictionary param instant close v1 — 2026-05-23

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_categories_accordion_v1.zip`.
- Baza startowa: `site_hardware_dictionary_param_expand_animation_slow_v1.zip`.
- W mini-akordeonach parametrów technicznych słowników okuć pozostawiono płynne rozwijanie nowo klikniętego parametru.
- Zamykanie poprzednio otwartego parametru jest teraz natychmiastowe, bez animacji zwijania; usuwa to dziwne ruchy listy widoczne na mobile.
- Sekwencja interakcji pozostaje: najpierw scroll do nagłówka klikniętego parametru, potem natychmiastowe zamknięcie starego i płynne rozwinięcie nowego.
- Zmiana jest wyłącznie UI/UX słowników okuć: bez zmian storage, backupu, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-dictionary-param-instant-close-v1.md`.


## Hardware dictionary param expand animation slow v1 — 2026-05-23

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_param_expand_animation_slow_v1.zip`.
- Baza startowa: `site_hardware_dictionary_param_expand_animation_v1.zip`.
- Wydłużono i ustabilizowano animację rozwijania mini-akordeonów parametrów technicznych w słownikach okuć.
- Zmieniono start animacji na podwójny `requestAnimationFrame`, żeby przeglądarka najpierw ustawiła stan początkowy `max-height:0`, a dopiero potem płynnie rozwinęła treść.
- Animacja pozostaje wyłącznie UI/UX: bez zmian storage, backupu, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-dictionary-param-expand-animation-slow-v1.md`.

## Hardware dictionary param expand animation v1 — 2026-05-23

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_param_expand_animation_v1.zip`.
- Baza startowa: `site_hardware_dictionary_param_scroll_before_open_v1.zip`.
- W mini-akordeonach parametrów technicznych słowników okuć dodano płynne rozwijanie i zwijanie treści parametru.
- Zachowano sekwencję: najpierw scroll do nagłówka klikniętego parametru, potem animowane zamknięcie poprzedniego i otwarcie nowego.
- Zasada jednego otwartego parametru naraz pozostaje bez zmian; stare szybkie kliknięcia kasują poprzednie timery animacji, żeby nie odpalać spóźnionych stanów.
- Zmiana jest wyłącznie UI/UX słowników okuć: bez zmian storage, backupu, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-dictionary-param-expand-animation-v1.md`.

## Hardware dictionary param scroll before open v1 — 2026-05-23

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_param_scroll_before_open_v1.zip`.
- Baza startowa: `site_hardware_dictionary_param_scroll_target_v1.zip`.
- W akordeonie parametrów technicznych kategorii okuć zmieniono kolejność interakcji: kliknięcie zwiniętego parametru najpierw przewija główne okno słownika do jego nagłówka, a dopiero po zakończeniu/timeout scrolla zwija poprzedni parametr i rozwija kliknięty.
- Po mutacji akordeonów pozycja aktywnego nagłówka jest korygowana, żeby zamknięcie długiego parametru powyżej nie wyrzucało użytkownika poza początek nowo otwartego formularza.
- Krótkie lokalne przewinięcia zostały zachowane; zmiana celuje w szarpnięcie przy klikaniu parametrów z dołu listy.
- Zmiana jest wyłącznie UI/UX słowników okuć: bez zmian storage, backupu, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-dictionary-param-scroll-before-open-v1.md`.

## Hardware dictionary param scroll target v1 — 2026-05-23

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_param_scroll_target_v1.zip`.
- Baza startowa: `site_hardware_dictionary_param_scroll_smooth_v1.zip`.
- Naprawiono regresję po wygładzaniu scrolla: mini-akordeon parametru widoczny na dole ekranu nie zatrzymuje już auto-scrolla tylko dlatego, że jego nagłówek mieści się w widocznym obszarze.
- Doscrollowanie liczy docelową pozycję względem głównego scrolla słowników i przewija do nagłówka otwartego parametru z marginesem od góry.
- Krótkie lokalne przewinięcia zostają, a start ruchu nadal czeka na ustabilizowanie wysokości rozwiniętego akordeonu.
- Zmiana jest wyłącznie UI/UX słowników okuć: bez zmian storage, backupu, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-dictionary-param-scroll-target-v1.md`.

## Hardware dictionary param scroll smooth v1 — 2026-05-23

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_param_scroll_smooth_v1.zip`.
- Baza startowa: `site_hardware_dictionary_param_scroll_focus_v1.zip`.
- Złagodzono auto-scroll mini-akordeonów parametrów technicznych w słownikach okuć.
- Przy otwieraniu parametru z dołu listy zamknięcie poprzedniego otwartego parametru zachowuje wizualną pozycję klikniętego nagłówka, żeby nie było szarpnięcia zanim zacznie się płynne przewinięcie.
- Doscrollowanie startuje po krótkim odczekaniu na przeliczenie układu i nie uruchamia się, jeśli nagłówek jest już dobrze widoczny.
- Zmiana jest wyłącznie UI/UX słowników okuć: bez zmian storage, backupu, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-dictionary-param-scroll-smooth-v1.md`.

## Hardware dictionary param scroll focus v1 — 2026-05-23

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_param_scroll_focus_v1.zip`.
- Baza startowa: `site_hardware_dictionary_param_single_open_v1.zip`.
- W akordeonie parametrów technicznych kategorii okuć rozwinięcie parametru automatycznie przewija główne okno słownika do początku otwartego mini-akordeonu.
- Dzięki temu przy otwieraniu parametru z dołu listy formularz nie startuje ucięty w połowie; najpierw widać nagłówek parametru i dopiero potem pola edycji.
- Zasada jednego otwartego parametru naraz pozostaje bez zmian.
- Zmiana jest wyłącznie UI/UX słowników okuć: bez zmian storage, backupu, import/export Excel, zamienników, PRO100, ROZRYS, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-dictionary-param-scroll-focus-v1.md`.

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
- W modalu szafki dodano sekcję `Dodatki robocizny`, obsługiwaną przez `js/app/cabinet/cabinet-modal-labor.js`; wybiera aktywne definicje robocizny i zapisuje je jako `laborItems` przy konkretnej szafce.
- Ręczne stawki oferty filtrują definicje wewnętrzne (`internalOnly === true`) i stawki systemowe, żeby reguły korpusów/gabarytu nie trafiały przypadkowo jako pozycje klienta.
- Snapshot oferty ma wersję 6 i zapisuje `lines.labor`; nie usuwać tego pola przy dalszych zmianach WYCENY.
- Raport: `tools/reports/pricing-labor-rules-v1.md`.


## 2026-05-03 — Pricing labor test fix v1

- Naprawiono test materiałów `preferStoredSplit` po dodaniu domyślnych definicji robocizny do `quoteRates`.
- Zachowanie runtime pozostaje bez zmian: zapisane rozdzielone listy materiałów/akcesoriów/stawek są zachowywane, stare legacy `services` nie są wskrzeszane, a nowe domyślne definicje robocizny mogą zostać dołączone jako migracja katalogu.
- Test nie może już zakładać, że `quoteRates` ma dokładnie jeden zapisany wpis, bo po `pricing_labor_rules_v1` katalog robocizny wymaga seedów godzinowych i definicji korpusów/dodatków.
- Zmieniono tylko fixture/test i cache-busting `dev_tests.html`; UI, WYCENA, RYSUNEK, statusy, storage runtime i PDF klienta nie były ruszane.

## 2026-05-03 — Pricing labor unified picker v1

- Ujednolicono robociznę/czynności do jednej wspólnej puli definicji. Pole `usage` zostaje tylko kompatybilnościowym fallbackiem danych i nie może już być traktowane jako twardy podział `ręcznie` vs `szafka`.
- W formularzu pozycji `Stawki wyceny mebli` ukryto wybór `Użycie`; nowe definicje robocizny zapisują się jako `universal`. O tym, gdzie da się ich użyć, decydują kontekst, aktywność, `internalOnly`, `quantitySource`, `conditions` i wybór użytkownika, a nie osobna kategoria ręczne/szafka.
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


## Hardware dictionary category no-clip v1 — 2026-05-24

- Aktualna paczka robocza po tym etapie: `site_hardware_dictionary_category_no_clip_v1.zip`.
- Baza startowa: `site_hardware_dictionary_category_body_guard_v1.zip`.
- Po zgłoszeniu użytkownika przeanalizowano, że wspólny akordeon `Kategorie / rodzaje okuć` nadal wizualnie przycinał zawartość: widoczna była tylko górna część pierwszego wiersza kategorii.
- Przyczyna: body kategorii nadal miało klasę `rozrys-material-accordion__body`, czyli klasę wykorzystywaną w animowanym wzorcu ROZRYS. Dla edytowalnej listy kategorii ta klasa jest ryzykowna, bo przy przeliczaniu wysokości na telefonie może zostawić ograniczony widok.
- Rozwiązanie: dla wspólnego akordeonu kategorii używać dedykowanego body `hardware-dictionary-category-section-body`, bez klasy `rozrys-material-accordion__body`; sam nagłówek i chevron nadal wizualnie trzymają wzorzec ROZRYS.
- W CSS akordeon kategorii i jego body mają wymuszone `overflow: visible`, `max-height: none`, `height: auto`, bez animowania wysokości. Mini-akordeony parametrów technicznych pozostają bez zmian.
- `tools/app-dev-smoke.js` zaostrzono tak, by sprawdzał dedykowany nieclipowany kontener kategorii oraz brak klasy `rozrys-material-accordion__body` na tym body.
- Bez zmian storage, backupu, import/export Excel, zamienników, PRO100, ROZRYS jako funkcji, RYSUNKU ani WYCENY.
- Raport: `tools/reports/hardware-dictionary-category-no-clip-v1.md`.

## 2026-05-30 — WYCENA click/snapshot relink fix
- Naprawa po diagnostyce normalny tryb vs incognito: `collectQuoteData` potrafiło liczyć dane, ale wygenerowana wycena mogła nie zostać widocznie pokazana po zmianie statusu projektu. `wycena-tab-shell.js` ustawia teraz świeżo utworzony snapshot jako aktywny podgląd (`lastQuote`, `previewSnapshotId`) i nie kasuje go przy pojedynczej synchronizacji statusu.
- Przycisk `Wyceń` obsługuje `pointerup` oraz `click` przez jeden strzeżony handler, żeby mobile/click-swallow nie kończył się samą reakcją wizualną bez generowania. Diagnostyka zapisuje teraz osobno zdarzenie przycisku i trace generowania.
- `wycena-context-repair.js` przepina snapshoty tego samego inwestora ze starego `projectId` do aktualnego projektu, jeśli zakres pokoi nadal istnieje. Inwestor odzyskany wcześniej ze źródła `quote-snapshot` z realnymi szafkami jest uzdrawiany jako normalny rekord zamiast blokować bieżący kontekst.

## 2026-06-09 — Przywrócenie profili stawek godzinowych bez zmian WYWIADU v1

- Paczka: `site_labor_rate_profiles_restore_clean_v1.zip`.
- Przywrócono tylko profile stawek godzinowych w cenniku robocizny: `workshop` 150 zł/h, `assembly` 250 zł/h, `specialist` 300 zł/h, `helper` 80 zł/h.
- Dodano tryb formularza `To jest stawka godzinowa`; w tym trybie formularz pokazuje nazwę przyjazną, kod techniczny stawki, kwotę zł/h i aktywność, a chowa pola reguły robocizny.
- Zwykła czynność wybiera stawkę godzinową z dynamicznej listy profili; lista może zawierać przyszłe stawki użytkownika, np. `painter`.
- Stawki godzinowe są nieusuwalne; nazwę, kwotę i aktywność można zmieniać, ale kod techniczny istniejącej stawki jest stały.
- Celowo nie dodano automatów robocizny, źródeł danych w trybiku ani podglądu danych w modalu szafki.
- Nie ruszano `cabinet-modal.js`, `cabinets-render.js` ani `css/cabinet-common.css`.
- Cache-busting: `20260609_labor_rate_profiles_restore_clean_v1`. Raport: `tools/reports/labor-rate-profiles-restore-clean-v1.md`.

## 2026-06-09 — Robocizna: czysty model quantitySource + conditions

Nie używać starego pola `autoRole` jako aktywnego modelu robocizny ani jako automatycznej migracji nowych reguł. Program jest na etapie budowy, nie łatki produkcyjnej, więc obowiązuje czysty kontrakt:

- `quantitySource` = ile liczyć,
- `conditions` = kiedy reguła ma działać,
- `conditions[].source` = kod faktu do odczytu, np. `cabinet.height_mm`, `cabinet.width_mm`, `hinge.count`,
- `conditions[].min` / `conditions[].max` = uniwersalne minimum i maksimum niezależne od tego, jaki fakt wybrano.

Nie tworzyć pól specyficznych typu `heightMinMm` / `heightMaxMm`. Wysokość, szerokość, waga, liczba frontów, liczba zawiasów i przyszłe dane kreatora mają korzystać z tego samego mechanizmu `source + min/max`.

Warunku nie wolno ignorować. Jeżeli źródło warunku nie zwraca liczbowej wartości, reguła ma zostać pominięta, a nie policzona jak reguła bez warunków.

Warunki dostępne w UI mogą pochodzić tylko z aktywnych, zaimplementowanych i liczbowych źródeł `FC.workQuantitySources`. Źródła planowane, tekstowe albo bez realnego kalkulatora nie mogą być aktywnymi warunkami.


## 2026-06-09 — Korekta: bez dodatkowych warunków front.max_* bez osobnego etapu

Nie dodawać nowych aktywnych źródeł warunków tylko dlatego, że technicznie da się je policzyć. Po korekcie użytkownika usunięto nadmiarowe `front.max_width_mm` i `front.max_height_mm` z aktywnych warunków robocizny. Warunki frontów/długich elementów można dodać później jako osobny, świadomie zaakceptowany etap.

## 2026-06-09 — Robocizna: warunki kaskadowe bez przycisku Dodaj

W formularzu `Stawki wyceny mebli` sekcja `Warunki zastosowania` nie używa osobnego przycisku `Dodaj warunek`. UI ma działać kaskadowo:

- pierwszy pusty launcher wyboru warunku jest widoczny od razu pod `Źródło ilości`,
- po wybraniu wartości warunku pokazują się uniwersalne pola `Minimum / od` i `Maksimum / do`,
- po wyborze pierwszego warunku automatycznie pojawia się drugi pusty launcher,
- po wyborze drugiego automatycznie pojawia się trzeci itd.,
- ostatni pusty launcher nie zapisuje się do `conditions`,
- wybrany warunek bez `min` i bez `max` jest niekompletny i nie może zostać zapisany,
- nie wolno wracać do osobnego przycisku `Dodaj warunek` ani do natywnych selectów.

Trybik `Dane do czynności i wyceny` pozostaje miejscem podglądu/definicji dostępnych źródeł danych. Wprowadzanie zakresów warunków `od/do` należy wyłącznie do formularza pozycji w `Stawki wyceny mebli`.

Paczka: `site_labor_conditions_cascade_fields_v1.zip`. Cache-busting: `20260610_wycena_unsaved_preview_storage_fix_v1`.
