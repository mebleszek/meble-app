# Data safety backup limit policy test v2 — 2026-05-22

## Baza

`site_data_safety_test_isolation_v1.zip`

## Cel

Poprawić przeglądarkowy test `Backupy testowe mają twardy limit 10 najnowszych sztuk`, który w realnym, dużym `localStorage` użytkownika nadal mógł próbować zapisać backup do pamięci programu i kończyć się błędem quota.

## Zakres zmiany

- Zmieniono wyłącznie test w `js/testing/data-safety/tests.js`.
- Test nie wywołuje już `FC.dataBackupStore.createBackup()` i nie zapisuje nic do `localStorage`.
- Test buduje małe rekordy backupów w pamięci JS i sprawdza `FC.dataBackupPolicy.pruneBackups()` oraz `FC.dataBackupPolicy.groupBackups()`.
- Test potwierdza, że:
  - 12 backupów testowych `before-tests` jest przycinanych do 10 najnowszych,
  - dwie najstarsze kopie testowe odpadają,
  - ręczne backupy programu nie są przycinane przez limit `before-tests`.

## Czego nie zmieniono

- Nie zmieniono mechanizmu backupu.
- Nie zmieniono polityki retencji.
- Nie zmieniono limitu `TEST_MAX_KEEP = 10`.
- Nie zmieniono fallbacku ręcznego eksportu backupu na dysk przy braku miejsca.
- Nie zmieniono `BACKUP.md`.
- Nie zmieniono UI, silnika zamienników, import/export, PRO100, ROZRYS, RYSUNKU ani WYCENY.

## Testy

Patrz lista testów/audytów w odpowiedzi do użytkownika dla paczki `site_data_safety_backup_limit_policy_test_v2.zip`.
