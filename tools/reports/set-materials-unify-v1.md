# Set materials unify v1 — 2026-05-17

## Cel

Ujednolicić kreator zestawów z pozostałymi szafkami: zestaw ma mieć jawny wybór korpusu, pleców, otwierania i frontów. Źródło materiału frontów pozostaje mechaniką Etapu 1C.

## Zakres

- Dodano pola w kreatorze zestawu:
  - `setBodyColor` — korpus zestawu,
  - `setBackMaterial` — plecy zestawu,
  - `setOpeningSystem` — otwieranie zestawu.
- Wygenerowane korpusy zestawu dostają te same wartości `bodyColor`, `backMaterial` i `openingSystem`.
- Rekord `room.sets[]` zapisuje teraz również `bodyColor`, `backMaterial` i `openingSystem`, obok `frontMaterial`, `frontColor` i `frontSource`.
- Wydzielono mały moduł `js/app/cabinet/cabinet-modal-set-materials.js`, żeby nowa logika zestawu nie puchła w `cabinet-modal-set-wizard.js`.
- Dodano kontrakty testowe dla pól materiałowych zestawu i dla launcherów.

## Poza zakresem

- Nie zmieniano PRO100.
- Nie zmieniano WYCENY, ROZRYS ani RYSUNKU.
- Nie dodawano hurtowej zmiany istniejących szafek.
- Nie dodawano tabeli frontów wieloczęściowych.
- Nie dodawano nowego `localStorage`.

## Cloud-readiness

Zmiana dotyczy danych projektu, konkretnie `room.sets[]` i wygenerowanych `room.cabinets[]`. Nie dodano osobnego store ani nowego klucza trwałego. Dane pozostają w istniejącym projekcie/inwestorze i są mapowalne do przyszłej chmury razem z projektem.
