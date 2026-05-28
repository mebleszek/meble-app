# Backup documentation audit v1

Zakres: analiza istniejącego mechanizmu backupu, testów backupu i dodanie `BACKUP.md` jako obowiązkowego dokumentu do czytania przy zmianach storage/backup.

## Sprawdzone moduły

- `js/app/shared/data-storage-keys.js`
- `js/app/shared/data-storage-classifier.js`
- `js/app/shared/data-storage-audit.js`
- `js/app/shared/data-backup-snapshot.js`
- `js/app/shared/data-backup-snapshot-apply.js`
- `js/app/shared/data-backup-store.js`
- `js/app/shared/data-backup-policy.js`
- `js/app/shared/data-backup-sanitizer.js`
- `js/testing/project/tests.js`
- `js/testing/data-safety/tests.js`
- `js/testing/test-data-safety.js`

## Wniosek

Backup ma już osobne moduły snapshotu, eksportu, restore, polityki retencji, sanitizera i store. Testy już istnieją i obejmują podstawowe scenariusze bezpieczeństwa danych: snapshot, restore, wykluczenia, retencję backupów testowych, ochronę backupów i fallback plikowy przed testami.

## Dodane

- `BACKUP.md` — aktualny kontrakt mechanizmu backupu.
- `DEV.md` — dopisana zasada czytania `BACKUP.md` przy zmianach backupu/storage.
- `CLOUD_MIGRATION.md` — dopisana referencja do `BACKUP.md`.
- `README.md` — dopisana informacja o dokumentacji backupu.
- `tools/app-dev-smoke.js` — test sprawdzający obecność i podpięcie `BACKUP.md`.

## Nie zmieniono

- Runtime backupu.
- Polityki retencji.
- Zakresu kluczy wchodzących do backupu.
- UI.
- Importu/eksportu danych.
