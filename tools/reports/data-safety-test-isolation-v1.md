# Data safety test isolation v1

## Baza

- Start: `site_hardware_replacement_engine_preview_v1.zip`.

## Problem

W przeglądarce test `Backupy testowe mają twardy limit 10 najnowszych sztuk` mógł padać błędem zapisu backupu, jeżeli bieżący `localStorage` użytkownika był już blisko limitu. Sam test ustawiał pusty magazyn backupów, ale snapshot backupu nadal obejmował pozostałe realne klucze aplikacji, więc pętla 12 backupów mogła próbować zapisać 12 pełnych kopii dużych danych.

## Zmiana

- Zmieniono tylko fixture testu w `js/testing/data-safety/tests.js`.
- Test na czas sprawdzenia retencji izoluje klucze aplikacji objęte snapshotem i używa małego zestawu danych.
- Po teście wcześniejszy stan `localStorage` jest przywracany przez istniejący helper `withStorageSnapshotByPredicate`.

## Czego nie zmieniono

- Nie zmieniono mechanizmu backupu.
- Nie zmieniono polityki retencji.
- Nie zmieniono limitu `TEST_MAX_KEEP = 10`.
- Nie zmieniono fallbacku ręcznego eksportu backupu na dysk.
- Nie zmieniono `BACKUP.md`.
- Nie zmieniono silnika zamienników ani normalnego UI programu.

## Testy

- `node --check js/testing/data-safety/tests.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/rozrys-dev-smoke.js`
- `node tools/local-storage-source-audit.js`
- `node tools/dependency-source-audit.js`
- `node tools/wycena-architecture-audit.js`
- `node tools/hardware-accessories-dev-smoke.js`
- `node tools/hardware-import-export-deep-smoke.js`
- `node tools/service-pro100-dev-smoke.js`
