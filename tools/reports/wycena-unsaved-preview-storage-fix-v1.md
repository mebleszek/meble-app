# WYCENA unsaved preview storage fix v1

## Problem

Raport diagnostyczny pokazał, że kliknięcie `Wyceń` buduje stan błędu zapisu historii:

`Nie udało się zapisać historii WYCENY. Prawdopodobnie magazyn przeglądarki jest pełny albo zawierał zbyt ciężkie stare snapshoty.`

Przez dotychczasową obsługę błędu użytkownik widział pusty podgląd 0.00 PLN i brak historii, mimo że dane projektu i pokoi były dostępne.

## Poprawka

- `wycena-tab-shell.js` rozpoznaje błąd zapisu historii snapshotu i buduje niezapisany podgląd wyniku.
- `wycena-tab-preview.js` pokazuje etykietę `Podgląd bez zapisu historii` oraz ostrzeżenie przy takim wyniku.
- `quote-snapshot-store.js` zachowuje flagi `unsavedDueToStorage` i komunikat błędu podczas normalizacji, żeby render nie zgubił diagnostyki.
- `wycena-diagnostics.js` ma aktualny build `20260610_wycena_unsaved_preview_storage_fix_v1`.

## Zakres celowo nietknięty

Nie czyszczono automatycznie całego magazynu, nie dodano nowego klucza storage, nie ruszano WYWIADU, modala szafki, materiałów, okuć, AGD, warunków robocizny ani modeli katalogowych.

## Testy

- `node tools/wycena-unsaved-preview-storage-fix-smoke.js`
- `node tools/labor-conditions-remove-auto-role-smoke.js`
- `node tools/labor-quantity-values-link-smoke.js`
- `node tools/labor-quantity-source-selector-smoke.js`
- `node tools/work-quantity-facts-cabinet-smoke.js`
- `node tools/labor-rate-profiles-restore-clean-smoke.js`
- `node tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/wycena-architecture-audit.js`
