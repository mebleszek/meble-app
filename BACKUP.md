# BACKUP — zakres, testy i zasady zmian

Ten plik jest obowiązkową mapą mechanizmu backupu danych w meble-app. Czytać go przed każdą zmianą, która dotyczy danych, storage, backupów, importu/eksportu, testów danych, katalogów/cenników, projektów, inwestorów albo przyszłej chmury.

## Aktualny mechanizm

Backup programu nie zapisuje ręcznie wybranych rekordów. Tworzy snapshot kluczy `localStorage`, które są uznane za dane aplikacji przez `js/app/shared/data-storage-keys.js`.

Główne reguły:

- backup obejmuje klucze zaczynające się od `fc_`, jeżeli `isAppDataKey(key)` uzna je za dane aplikacji,
- backup nie obejmuje własnego magazynu backupów `fc_data_backups_v1`,
- backup nie obejmuje technicznych kopii awaryjnych projektu/inwestorów,
- backup nie obejmuje cache ROZRYS planu,
- backup nie obejmuje kluczy lotnych/sesyjnych,
- restore może czyścić brakujące klucze aplikacji i usuwa klucze lotne/techniczne po przywróceniu.

## Klucz magazynu backupów

Magazyn backupów w aplikacji:

```text
fc_data_backups_v1
```

Ten klucz jest celowo wykluczony ze snapshotu, żeby backup nie backupował poprzednich backupów i nie rósł wykładniczo.

## Format snapshotu

Snapshot ma postać:

```json
{
  "kind": "meble-app-storage-snapshot",
  "version": 1,
  "createdAt": "...",
  "meta": { "reason": "...", "label": "..." },
  "keys": {
    "fc_investors_v1": "...surowy JSON jako string...",
    "fc_projects_v1": "...surowy JSON jako string..."
  }
}
```

Eksport aktualnego stanu do pliku ma opakowanie:

```json
{
  "kind": "meble-app-data-export",
  "version": 1,
  "exportedAt": "...",
  "snapshot": { }
}
```

Eksport pojedynczego backupu ma opakowanie:

```json
{
  "kind": "meble-app-data-backup",
  "version": 1,
  "exportedAt": "...",
  "backup": { }
}
```

## Klucze wykluczone ze snapshotu

Stałe wykluczenia są w `data-storage-keys.js`.

Aktualnie wykluczone są:

```text
fc_data_backups_v1
fc_project_backup_v1
fc_project_backup_meta_v1
fc_investors_backup_v1
fc_investors_backup_meta_v1
fc_rozrys_plan_cache_v1
fc_project_inv_*_backup_v1
fc_project_inv_*_backup_meta_v1
```

Klucze lotne/sesyjne niewchodzące do backupu:

```text
fc_edit_session_v1
fc_reload_restore_v1
fc_rozrys_plan_cache_v2
```

## Co backup obecnie obejmuje

Backup obejmuje dane użytkowe i część technicznego stanu aplikacji, jeśli klucz spełnia regułę `fc_*` i nie jest wykluczony.

Typowe klucze użytkowe:

```text
fc_investors_v1
fc_projects_v1
fc_project_v1
fc_project_inv_*_v1
fc_sheet_materials_v1
fc_materials_v1
fc_accessories_v1
fc_hardware_manufacturers_v1
fc_hardware_suppliers_v1
fc_hardware_settings_v1
fc_hardware_categories_v1
fc_hardware_types_v1
fc_hardware_technical_params_v1
fc_program_defaults_v1
fc_services_v1
fc_quote_rates_v1
fc_labor_automats_v1
fc_workshop_services_v1
fc_service_orders_v1
fc_quote_snapshots_v1
fc_quote_offer_drafts_v1
fc_edge_v1
fc_material_part_options_v1
fc_sheets_v1
```

Typowe klucze techniczne, które nadal mogą być w snapshotcie, jeżeli są `fc_*` i nie są wykluczone:

```text
fc_current_investor_v1
fc_current_project_id_v1
fc_ui_v1
fc_investor_removed_ids_v1
fc_rozrys_grain_state_v1
fc_rozrys_overrides_v1
fc_rozrys_panel_prefs_v1
fc_rozrys_material_accordion_v1
```

Uwaga: to nie jest jeszcze docelowa chmura. `CLOUD_MIGRATION.md` nadal wskazuje, że dane użytkowe, cache i techniczny stan UI powinny być docelowo rozdzielone ostrzej.

## Retencja backupów

Polityka jest w `js/app/shared/data-backup-policy.js`.

Aktualne zasady:

```text
RETENTION_DAYS = 7
MIN_KEEP = 10
TEST_MAX_KEEP = 10
AUTO_PROTECT_LATEST = 3
```

Znaczenie:

- zwykłe backupy aplikacji są trzymane według retencji 7 dni i minimum 10 sztuk,
- backupy testowe `before-tests` mają osobną grupę i limit maksymalnie 10 najnowszych,
- 3 najnowsze backupy w każdej grupie są automatycznie chronione przed ręcznym usunięciem,
- backup przypięty albo `safe-state` jest chroniony.

## Kiedy backup powstaje

Główne przypadki:

1. Backup ręczny w ustawieniach danych.
2. Backup przed przywróceniem innego backupu.
3. Backup przed importem danych.
4. Backup przed testami aplikacji.
5. Eksport aktualnego stanu do pliku przed testami, jeżeli zapis backupu w localStorage się nie uda lub użytkownik wybierze pobranie pliku.

## Restore

Przywrócenie backupu:

- przed restore tworzy backup obecnego stanu,
- normalizuje format importowanego snapshotu,
- zapisuje klucze ze snapshotu,
- przy `clearMissing:true` usuwa obecne klucze aplikacji, których nie ma w przywracanym snapshotcie,
- czyści klucze lotne i techniczne kopie awaryjne.

## Diagnostyka i audyt rozmiaru

Audyt storage jest w:

```text
js/app/shared/data-storage-audit.js
```

Raport pokazuje między innymi:

- rozmiar magazynu backupów,
- ile kluczy obejmie snapshot backupu,
- klucze wykluczone ze snapshotu,
- techniczne kopie awaryjne,
- osierocone sloty projektów inwestorów,
- największe klucze danych.

## Obecne testy backupu

Testy backupu są już w programie, głównie w:

```text
js/testing/project/tests.js
js/testing/data-safety/tests.js
js/testing/test-data-safety.js
```

Pokrywają między innymi:

- utworzenie backupu i restore inwestorów/projektów,
- pomijanie technicznych sesji i cache przy snapshot/restore,
- eksport pojedynczego backupu,
- ochronę 3 najnowszych backupów,
- retencję backupów testowych,
- fallback do pobrania pliku, gdy backup przed testami nie zapisze się do localStorage,
- raport danych z rozmiarem backup store i wykluczeniami,
- odchudzanie starych backupów przez sanitizer bez zmiany retencji.

## Zasady zmian

1. Nie zmieniać polityki backupów bez wyraźnej zgody użytkownika.
2. Nie dodawać nowego trwałego klucza danych bez ustalenia, czy ma wejść do backupu.
3. Jeśli klucz ma wejść do backupu, powinien mieć prefiks `fc_*` i opis w `data-storage-classifier.js`.
4. Jeśli klucz jest cache, sesją albo stanem technicznym, powinien być jawnie wykluczony albo sklasyfikowany jako techniczny.
5. Nie dodawać danych technicznych/testowych do backupu użytkownika przypadkiem.
6. Po zmianie storage/backup/import/export uruchomić testy backupu i audyty storage.
7. Przed usuwaniem lub automatycznym czyszczeniem danych dodać najpierw audyt/raport, potem osobną decyzję użytkownika.

## Znane ryzyka / długi

- `fc_quote_snapshots_v1` może rosnąć szybko, bo snapshoty ofert zawierają rozbudowane dane ofertowe i katalogowe.
- `fc_edge_v1` może rosnąć przez wpisy oklejania dla wielu wygenerowanych elementów; potrzebny później audyt osieroconych wpisów.
- `fc_project_v1`, `fc_projects_v1` i `fc_project_inv_*_v1` nadal pokazują historyczną duplikację modelu projektu.
- `fc_materials_v1` i `fc_sheet_materials_v1` oraz `fc_services_v1` i `fc_quote_rates_v1` są częściowo zdublowane dla zgodności.
- `fc_labor_automats_v1` jest nowym słownikiem użytkowym dla automatów robocizny; kod techniczny automatu jest trwały i nie powinien być zmieniany po utworzeniu.
- Profile stawek godzinowych robocizny są przechowywane w `fc_quote_rates_v1` jako pozycje `autoRole: hourlyRate`; ich kody `rateKey`/`rateCode`/`rateType` są trwałe, a systemowe stawki startowe nie powinny być usuwane.
- W backupu z 2026-05-20 w `fc_accessories_v1` widoczne były wartości `"[object Object]"` w polach okuć/parametrów technicznych. To był błąd serializacji danych katalogu okuć, nie element mechanizmu backupu. Od paczki `site_000_hardware_technical_params_serialization_fix_v1.zip` normalizacja katalogu i eksport arkuszy grupowych mają testy pilnujące, żeby taki zapis nie wracał.

## Minimalny zestaw testów po zmianie backupu/storage

```bash
node --check <zmienione pliki JS>
node tools/check-index-load-groups.js
node tools/app-dev-smoke.js
node tools/local-storage-source-audit.js
node tools/dependency-source-audit.js
```

Jeżeli zmiana dotyka okuć/importu/eksportu:

```bash
node tools/hardware-accessories-dev-smoke.js
node tools/hardware-import-export-deep-smoke.js
```

Jeżeli zmiana może dotknąć ROZRYS albo danych formatek:

```bash
node tools/rozrys-dev-smoke.js
```

## Hardware compare modes / storage cleanup v1 — 2026-05-21

Ten etap nie zmienia polityki backupów ani mechanizmu snapshot/restore. Uzupełnia tylko dokumentację i klasyfikację diagnostyczną słowników okuć, żeby raport storage jasno pokazywał jako dane użytkownika:

```text
fc_hardware_manufacturers_v1
fc_hardware_suppliers_v1
fc_hardware_settings_v1
fc_hardware_categories_v1
fc_hardware_types_v1
fc_hardware_technical_params_v1
```

Dynamiczne parametry techniczne i zasady porównania są częścią danych katalogu okuć. Backup obejmuje je przez regułę `fc_*`, o ile klucz nie jest jawnie wykluczony.


## Hardware replacement engine preview v1 — 2026-05-22

Ten etap nie zmienia polityki backupów, zakresu snapshotu, retencji ani restore.

Dodany silnik `FC.hardwareReplacementEngine` nie tworzy żadnego nowego klucza `localStorage` i nie zapisuje wyników podglądu zamienników. Korzysta wyłącznie z istniejących danych katalogu okuć i definicji parametrów technicznych objętych dotychczasowym backupem, m.in.:

```text
fc_accessories_v1
fc_hardware_technical_params_v1
fc_hardware_manufacturers_v1
fc_hardware_suppliers_v1
fc_hardware_settings_v1
fc_hardware_categories_v1
fc_hardware_types_v1
```

Wynik porównania zamiennika jest stanem runtime/testowym i nie powinien trafiać do backupu bez osobnej decyzji produktowej.

## Uwaga WYCENA snapshot clean store v1 — 2026-05-30

`fc_quote_snapshots_v1` nadal jest kluczem danych użytkowych objętym backupem, ale od etapu `site_wycena_snapshot_clean_store_v1.zip` aktywny format snapshotu WYCENY to lekki format `version: 7` / `quote-snapshot-slim-v1`. Stare ciężkie rekordy historii ofert sprzed tego formatu mogą zostać automatycznie odcięte i usunięte z aktywnego store, ponieważ na tym etapie priorytetem jest stabilna przyszła WYCENA, a nie kompatybilność starych snapshotów po regresji.

Nowe snapshoty nie zapisują pełnych katalogów materiałów/okuć/dostawców. Zachowują natomiast dane potrzebne do korelacji ofert i przyszłych danych wykonawczych: projekt, inwestora, zakres pomieszczeń, linie wyceny, sumy, dane handlowe i metadane statusów.

## Uwaga WYCENA generate single flow v1 — 2026-05-30

Etap `site_wycena_generate_single_flow_v1.zip` nie dodaje nowych kluczy storage i nie zmienia formatu `fc_quote_snapshots_v1`. Poprawia tylko ścieżkę generowania, aby jedno kliknięcie `Wyceń` nie zapisało dwóch snapshotów przez replay `pointerup -> click` po re-renderze przycisku.

Korelacja wielu ofert/wariantów zostaje zachowana: kolejne świadome kliknięcie po oknie deduplikacji nadal tworzy następny snapshot/wariant w tym samym kluczu `fc_quote_snapshots_v1`.


## Uwaga WYCENA duplicate offer guard v1 — 2026-05-30

Etap `site_wycena_duplicate_offer_guard_v1.zip` nie dodaje nowych kluczy storage i nie zmienia zakresu backupu. `fc_quote_snapshots_v1` pozostaje kluczem danych użytkowych objętym backupem.

Nowe pole/pojęcie fingerprintu oferty jest metadanym wewnątrz snapshotu v7. Służy do blokowania identycznych duplikatów przy generowaniu WYCENY i nie zastępuje korelacji ofert/statusów. Zamiana istniejącej identycznej oferty zachowuje slot/ID i metadane statusu, a aktualizuje linie/sumy świeżym przeliczeniem.

