# Backup storage keys v1 — 2026-05-07

## Baza

- Start: `site_hardware_import_export_v1.zip`
- Wynik: `site_backup_storage_keys_v1.zip`

## Zakres

- Dodano regułę `fc_*` dla danych objętych globalnym backupem.
- Zmigrowano dostawców okuć do `fc_hardware_suppliers_v1`.
- Zmigrowano ustawienia katalogu okuć do `fc_hardware_settings_v1`.
- Legacy klucze `hardwareSuppliers` i `hardwareSettings` są odczytywane tylko jako źródło migracji, gdy nie ma jeszcze nowego klucza.

## Zmienione pliki

- `js/app/shared/constants.js`
- `js/app/bootstrap/app-core-namespace.js`
- `js/app/catalog/catalog-storage-policy.js`
- `js/app/catalog/catalog-store.js`
- `index.html`
- `dev_tests.html`
- `tools/index-load-groups.js`
- `tools/app-dev-smoke-lib/file-list.js`
- `tools/app-dev-smoke.js`
- `DEV.md`
- `CLOUD_MIGRATION.md`
- `OPTIMIZATION_PLAN.md`

## Testy

- `node --check` dla nowych/zmienionych JS — OK
- `node tools/check-index-load-groups.js` — OK
- `node tools/app-dev-smoke.js` — 62/62 OK
- `node tools/rozrys-dev-smoke.js` — 72/72 OK
- `node tools/local-storage-source-audit.js` — OK
- `node tools/dependency-source-audit.js` — OK
- `node tools/wycena-architecture-audit.js` — OK
