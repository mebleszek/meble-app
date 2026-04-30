# Investor project boundary v1 — raport paczki

Baza: `site_investor_store_boundary_v1.zip`.

## Cel

Rozdzielić `js/app/investor/investor-project.js`, ponieważ plik mieszał więcej niż dwie odpowiedzialności: legacy per-inwestorowe sloty projektu, most do `projectStore`, aktywny `projectData`, patchowanie `FC.investors`, patchowanie `FC.project.save` i odświeżanie UI.

## Zakres

- Bez zmian UI.
- Bez RYSUNKU.
- Bez zmiany formatu danych.
- Bez ukrytej migracji.
- Bez zmiany polityki backupów.

## Nowy podział

- `js/app/investor/investor-project-repository.js` — granica storage/adaptera dla `fc_project_inv_*_v1` oraz most do `FC.projectStore`.
- `js/app/investor/investor-project-runtime.js` — normalizacja, świeży projekt, load/save aktywnego projektu, refresh aplikacji i tracking sesji.
- `js/app/investor/investor-project-patches.js` — patchowanie `FC.investors` i `FC.project.save`.
- `js/app/investor/investor-project.js` — cienki init/orchestrator.

## Wyniki rozmiaru

- `investor-project.js`: z ok. 228 linii do ok. 21 linii.
- Nowe moduły: ok. 121 / 146 / 75 linii.

## Testy / audyty

- `tools/check-index-load-groups.js`: OK.
- `tools/app-dev-smoke.js`: 26/26 OK.
- `tools/rozrys-dev-smoke.js`: 72/72 OK.
- `tools/local-storage-source-audit.js`: 25 plików storage, 234 referencje storage.
- `tools/dependency-source-audit.js`: raport odświeżony.

## Uwagi antyregresyjne

- Kolejność ładowania musi pozostać: repository → runtime → patches → init.
- `FC.investors` i `FC.project.save` nadal są patchowane, więc zmiany w tym obszarze muszą sprawdzać przełączanie inwestorów, tworzenie nowego inwestora, usuwanie inwestora i zapis aktywnego projektu.
- `fc_project_inv_*_v1` pozostaje legacy kompatybilnością, nie docelowym modelem chmurowym.
