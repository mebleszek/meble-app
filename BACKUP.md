# CLOUD-2B.4a — techniczny dowód profilu a kopia danych

## CLOUD-4.3b — przyszły wierny rollback (2026-10-20)

Właściciel zatwierdził historyczny 635 B baseline WYŁĄCZNIE do przygotowania następnej bramki. Dokładne prywatne źródło Rules pozostaje poza GitHubem i backupem fc_*; plik z repo o rozmiarze 755 B nie jest bajtowo wiernym rollbackiem. Przed jakimkolwiek przyszłym wdrożeniem wymagana jest dostępna, prywatna i hash-zweryfikowana kopia 635 B; brak kopii = STOP. Zgoda na przygotowanie nie zatwierdza deployu ani rollbacku. [Raport](tools/reports/cloud-4-3b-gate1-closure.md).


## CLOUD-4.3a — prywatny punkt odniesienia Firestore Rules

Oryginalne 635 B źródła z REST dostarczonego przez właściciela są odrębnym
prywatnym artefaktem infrastruktury, poza standardowym backupem aplikacji.
Nie obejmuje to danych fc_*, profilu dostępu ani sesji. Repo publikuje tylko
metadane/SHA i nieaktywny plan; nie publikuje oryginalnego produkcyjnego źródła.
Plik `cloud42-rules-rollback.json` nadal wskazuje template 755 B i NIE jest
bajtowo wiernym rollbackiem do produkcji 635 B. Prywatny plik należy zachować
niezmieniony i sprawdzić ponownie przed przyszłą operacją. Brak artefaktu = STOP.
[Źródło decyzji, tożsamość i ograniczenia](tools/reports/cloud-4-3a-production-rules-baseline.md).

## 2026-10-19 — odzyskiwanie istniejących intencji statusu

`meta.pendingDomainOperation` pozostaje w kanonicznym rekordzie `fc_projects_v1` i nadal trafia
do istniejącego backupu. Format v1 oraz klucze, retencja, eksport/import i restore pozostają bez zmian.
Odzyskiwanie nie usuwa intencji bez świeżego potwierdzenia celów; brak dwóch opcjonalnych pól
lustra jest porównywany wyłącznie z kontraktowymi wartościami domyślnymi (`''` i `false`).
Nie jest to migracja danych ani procedura ręcznego czyszczenia blokady.
[Zakres i dowody](tools/reports/offer-status-recovery-lifecycle.md).


Rozszerzony pakiet przechowuje rozstrzygający, techniczny rekord dostępu w IndexedDB `meble-access-profile-v1` / `ownership` / `owner`. Nie zawiera projektu ani kopii katalogów: tylko wersję, UID, stan pending/active i identyfikator próby. Standardowy eksport danych **nie obejmuje tej bazy**, tak samo jak nie przenosi sesji Firebase lub uprawnień. Nie dołączać jej do selektywnego pilota chmurowego jako źródła biznesowego.

Oryginalny v2 w localStorage pozostaje niezmieniony podczas bezpiecznego potwierdzenia tego samego właściciela. Nowe odnośniki v3 wymagają aktywnego rekordu IndexedDB; nie odtwarzać ich ręcznie jako sposobu nadania dostępu. Brak/uszkodzenie koordynacji blokuje wejście zamiast resetowania danych. Cofnięcie wydania musi zachować moduł obsługujący ten dowód albo pozostawić bramkę zamkniętą — stare logowanie nie powinno omijać nierozstrzygniętej rezerwacji. Nie usuwać bazy lub znaczników jako obejścia.

Nie zmieniono formatu, retencji, kolektora, restore ani żadnego istniejącego backupu. Poniższa historyczna tabela nadal opisuje rzeczywiste wykluczenia eksportu; zgoda właściciela na kopię nie jest technicznym dowodem jej kompletności. [Kontrakt i testy](tools/reports/cloud-2b4a-technical-2c.md).

## CLOUD-2B.3 — dopuszczenie profilu: rzeczywiste granice kopii (2026-10-17)

Ten dopisek opisuje kod; **nie zmienia formatu eksportu, retencji ani mechanizmu backupu**. Checkbox na ekranie dopuszczenia jest oświadczeniem właściciela o kopii, nie technicznym potwierdzeniem jej zawartości, kompletności lub istnienia pliku.

Źródła: `dataSettingsBackupActions` → `dataBackupStore.exportCurrent()` → `dataBackupSnapshot.collectSnapshot()` → `dataBackupExport.makeExportPayload()` / `downloadJson()`. O zakresie decydują `dataStorageKeys.isAppDataKey()`, `SNAPSHOT_EXCLUDED_KEYS`, `VOLATILE_KEYS` i `isProjectSlotBackupKey()`.

| Dane | Standardowe „Eksportuj wszystkie dane” | Ryzyko / zabezpieczenie przed publikacją |
|---|---|---|
| Zapisane `fc_*` nieobjęte wykluczeniami | Tak, wartości RAW w `snapshot.keys` | Dotyczy m.in. projektów/inwestorów, globalnych cenników/stawek, katalogów, słowników/ustawień, zamienników w katalogach, magazynu `fc_sheets_v1`, historii i draftów ofert, PCV w projekcie, legacy PCV i globalnych słojów/rotacji. Sprawdzić obecność potrzebnych kluczy i treści w pobranym pliku; nie zakładać jej na podstawie samej nazwy przycisku. |
| `hardwareSettings`, `hardwareCategories`, `hardwareSuppliers`, `hardwareTechnicalParams`, `hardwareTypes` | **Nie** — brak prefiksu `fc_` | Mogą zawierać wartościowe historyczne globalne dane. Nie zakładać identyczności z kanonicznymi `fc_hardware_*` ani samoczynnego ich przeniesienia. Pozostają tylko w profilu, o ile nie ma osobnej zweryfikowanej kopii. |
| `fc_data_backups_v1` | **Nie** | Historyczne backupy mogą zawierać jedyne starsze stany danych. Istniejący przycisk „Eksportuj” przy konkretnym backupie pozwala pobrać go osobno (`dataBackupStore.exportBackup`), bez „Przywróć”. Nie obiecywać pełnego RAW archiwum na podstawie takiego pojedynczego pliku. |
| `fc_project_backup_v1`, `fc_project_backup_meta_v1`, `fc_investors_backup_v1`, `fc_investors_backup_meta_v1`, `fc_project_inv_*_backup_v1`, `fc_project_inv_*_backup_meta_v1` | **Nie** | Kopie ratunkowe i metadane — nie bieżący autorytet, lecz potencjalnie istotne do odzyskania danych. Nie kasować. Wymagają osobnej kopii, jeśli mają być zabezpieczone poza przeglądarką. |
| `fc_edit_session_v1` | **Nie** | Trwały snapshot, oryginalny stan rollbacku i stan niezakończonej edycji. Sam eksport bieżącego projektu nie zabezpiecza sesji. Dopuszczenie zachowuje go bez zmian. |
| Całe sessionStorage (w tym właściwy `fc_reload_restore_v1`) oraz zmiany tylko w RAM | **Nie** | Kolektor odczytuje tylko localStorage. RAM nie jest trwałą kopią; przed publikacją świadomie zakończyć edycję potwierdzonym Zapisz/Anuluj, jeśli jest to bezpieczne. Bez automatycznego Cancel lub wymuszonego odświeżenia. |
| `fc_rozrys_plan_cache_v1`, `fc_rozrys_plan_cache_v2` | **Nie** | Legacy/odtwarzalny cache, nie źródło projektu. Nie mylić z zawierającymi decyzje `fc_rozrys_grain_state_v1` / `fc_rozrys_overrides_v1`, które nie są wykluczone. |
| Dowód i blokada `meble_access_profile_*`, Firebase SDK persistence / tokeny | **Nie** | Celowo nie są przenoszone jako biznesowy backup lub uprawnienie. Nowe uruchomienie wymaga prawdziwej autoryzacji; nie kopiować tokenów i nie usuwać blokady, aby obejść zgodę. |

**Dodatkowa luka kompletności obecnego eksportera:** `listStorageKeys()` przechwytuje błąd enumeracji, a `collectSnapshot()` przechwytuje błędy poszczególnych odczytów. Może powstać częściowy plik bez jawnej odmowy. W tej korekcie nie zmieniono kolektora; oddzielna diagnostyka poza repozytorium odtwarza pominięcie jednego katalogu przy błędzie odczytu. Nie jest to obowiązkowy PASS wymagający zachowania błędu. Poprawny JSON i checkbox nie dowodzą zgodności kopii ze źródłem.

**Warunek publikacji:** prywatny plik poza pamięcią witryny, porównanie zakresu i RAW wymaganych danych ze źródłem, a dla istotnych pominięć dodatkowe zabezpieczenie. Jeżeli kompletność nie jest potwierdzona albo wartościowa pominięta domena nie ma kopii, **publikacja pozostaje wstrzymana**. Nie odczytano rzeczywistych danych właściciela i nie stwierdzono, czy takie domeny u niego występują. Pełny backup może zawierać sekret ORS w `fc_company_profile_v1.transport.apiKey` i prywatne dane — nie uploadować go do Firebase/GitHuba/czatu.

**Minimalna propozycja osobno do zatwierdzenia (nie zaimplementowano):** jednorazowa prywatna kopia ratunkowa RAW `fc_*` oraz pięciu aliasów z localStorage i sessionStorage, również archiwum backupów/kopii ratunkowych i sesji. Bez normalizacji, importu, zapisów źródła, tokenów Auth lub dowodów dostępu. Ścisły odczyt z odmową przy każdym błędzie, jawny wykaz kluczy/rozmiarów, integralność pliku, końcowe sprawdzenie niezmienności i weryfikacja ponownie odczytanego pobranego pliku. To odrębny kontrakt kopii ratunkowej, nie cicha zmiana obecnego formatu backupu ani workflow chmurowy. Nie odzyska zmian istniejących wyłącznie w RAM. Nie dodano teraz nowego eksportera/kontrolki i nie uruchomiono biznesu przed zgodą.

---

# Dopisek CLOUD-1A — 2026-10-15, bez zmian mechanizmu

Aktualna mapa wszystkich magazynów, ich właścicieli i granic migracji: [CLOUD_DATA_REGISTER.md](CLOUD_DATA_REGISTER.md). Pełny lokalny backup opisany poniżej **nie jest** selektywnym eksportem pilotażu CLOUD-1 (jeden testowy I/P).

- Obecny RAW collector nie usuwa `fc_company_profile_v1.transport.apiKey` ORS; kopia tego sekretu może też znajdować się w starszych backupach. Nie publikować/uploadować pełnego backupu jako pilotażu. W tym zadaniu nie czytano wartości i nie zmieniono filtrowania.
- Pięć aliasów `hardwareSuppliers`, `hardwareSettings`, `hardwareCategories`, `hardwareTypes`, `hardwareTechnicalParams` nie zaczyna się od fc_ i nie jest objętych obecnym snapshotem fc_*. Nadal są chronionymi globalnymi danymi; główny klucz ma pierwszeństwo, a usunięcie aliasu wymaga potwierdzonego zapisu głównego według istniejącej polityki katalogu.
- `fc_material_part_options_v1` i `fc_rozrys_grain_state_v1` zawierają realne decyzje produkcyjne; etykieta technical nie daje zgody na czyszczenie. Projektowe PCV znajduje się już wewnątrz fc_projects_v1, a dawne fc_edge_v1 nie jest automatycznie importowane.
- `fc_projects_v1` jest kanoniczny; fc_project_v1 i sloty per inwestor są historyczne, a nie równorzędne źródła bieżącego projektu. Starsze wpisy poniżej zachowano jako historię.
- Retencja i awaryjna kompaktacja quota pozostają bez zmian. Ich optymalizacja jest odłożona do czasu po migracji. Export/restore pełnego backupu nie może zastąpić przyszłego kontrolowanego eksportu/pobrania I/P.

---

## 2026-06-11 — Transport: scalanie ceny startowej i osobny total WYCENY

- Nie dodano nowego klucza backupu ani nowego magazynu danych.
- Cena transportu nadal jest częścią istniejącego cennika `fc_quote_rates_v1` / legacy `fc_services_v1`, więc trafia do backupu razem ze stawkami wyceny.
- Jeżeli użytkownik ma zdublowaną pozycję **Transport do klienta**, konsolidacja przy starcie katalogu przenosi cenę użytkownika na kanoniczne `transport_distance_km` zamiast wymagać resetu danych.
- Snapshot oferty może mieć nowy mały total `totals.transport` i sekcję rejestru `transport`; to jest rozdzielenie istniejącej linii transportowej w WYCENIE, nie osobny storage.

## 2026-06-10 — Backup: osobne automaty AGD

- Zmiana nie dodaje nowego magazynu backupu.
- Nowe automaty AGD są pozycjami istniejącego cennika robocizny `quoteRates`, więc mieszczą się w dotychczasowym zakresie backupu katalogów/cenników.
- Źródła `appliance.<typ>.count` są definicjami systemowymi w kodzie, nie osobnym zapisem użytkownika.


## 2026-06-10 — Robocizna: podgląd reguły i warunki zastosowania

- Podgląd działania reguły robocizny nie dodaje żadnych nowych danych do backupu.
- Warunki `conditions[]` nadal są częścią istniejącego cennika robocizny i backupują się razem z katalogiem/stawkami.
- Nie dodano nowego klucza `localStorage`.

## 2026-06-10 — WYCENA: strukturalne pola robocizny w audycie

- Nie dodano nowego klucza `localStorage`.
- Lekkie snapshoty ofert zachowują dodatkowe małe pola robocizny (`hours`, `hourlyRate`, `baseHours`, `multiplier`, `volumeM3`, `sourceRole`, `sourceKind`), żeby modal audytu mógł pokazywać czynności jedno pod drugim bez parsowania długich opisów tekstowych.
- Zmiana nie zmienia zakresu backupu; dane są nadal częścią istniejących snapshotów ofert i rejestru wyliczeń.

## 2026-06-10 — Szuflady/prowadnice jako jawne wymagania

- Nie dodano nowego klucza `localStorage` ani nowego magazynu backupu.
- `drawerRequirements`, jeżeli wystąpią w przyszłym kreatorze korpusów, są częścią rekordu szafki w projekcie i trafiają do backupu razem z projektem.
- Legacy pola `drawerCount`, `drawers` i ukryte `innerDrawerCount` bez realnego wariantu nie są już traktowane jako źródło prawdy do WYCENY.
- Świeże drafty i zapis szafki czyszczą śmieci szufladowe, zamiast utrzymywać zgodność z dawnymi testowymi danymi.

## 2026-06-10 — WYCENA: martwa sesja edycji i fingerprint snapshotu

- `fc_edit_session_v1` nadal jest kluczem lotnym/sesyjnym i nie wchodzi do backupu.
- Przed zapisem historii WYCENY program może usunąć tylko martwą sesję edycji z zakładki WYCENA: aktywną, ale bez trybu, bez pokoju i bez otwartego modala/dialogu. Nie dotyczy to realnej edycji szafki/inwestora.
- `meta.quoteFingerprint` w snapshotach ofert jest teraz kompaktowym odciskiem `qfp2`, a nie pełnym JSON-em porównawczym. Zmiana zmniejsza rozmiar historii i nie dodaje nowego klucza backupu.


## 2026-06-10 — Awaryjne odchudzanie backupów przy zapisie historii WYCENY

- `quote-snapshot-storage-maintenance` może odchudzić `fc_data_backups_v1` tylko wtedy, gdy zapis historii WYCENY do `localStorage` nie mieści się w limicie.
- Najpierw usuwane są cache/klucze techniczne, potem nadmiar backupów testowych i starszych backupów aplikacji.
- Bieżące dane projektu, inwestorzy, katalogi i cenniki nie są czyszczone przez ten mechanizm.
- To jest lokalny bezpiecznik do czasu migracji chmurowej; docelowo historia ofert ma być osobną kolekcją/dokumentami, a backupy nie powinny blokować zapisu ofert.


## 2026-06-09 — Źródło ilości w cenniku robocizny v1

- Pole `quantitySource` jest częścią istniejących pozycji `quoteRates`, więc trafia do backupu razem z cennikiem robocizny.
- Nie dodano nowego klucza backupu ani osobnego magazynu faktów szafki.

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

