# WYCENA diagnostics report v1 — 2026-05-29

## Cel

Dodano diagnostykę przypadku, w którym WYCENA działa w incognito, ale w normalnej przeglądarce z istniejącymi danymi kliknięcie `Wyceń` reaguje bez widocznego snapshotu/historii.

## Zakres zmiany

- Dodano moduł `js/app/wycena/wycena-diagnostics.js`.
- W topbarze WYCENY dodano przycisk `Diag`, który otwiera aplikacyjny modal z raportem do skopiowania.
- Raport zbiera kontekst aktywnego inwestora/projektu, źródła projektu (`fc_projects_v1`, `fc_project_v1`, `fc_project_inv_*_v1`), aktywne pokoje, draft oferty, snapshoty, klucze storage i ostatni ślad kliknięcia `Wyceń`.
- Raport wykonuje `collectQuoteData` w trybie bez zapisu snapshotu, aby pokazać, czy problem jest w zbieraniu danych, zapisie snapshotu, renderze historii czy stanie storage.
- `generateQuote` zapisuje wewnętrzny ślad kroków: naprawa kontekstu, wybór zakresu, nazwa wersji, wynik budowy snapshotu albo błąd.
- Nie dodano czyszczenia danych ani migracji usuwającej inwestorów/projekty.

## Instrukcja użycia

1. Otworzyć normalną aplikację z problematycznymi danymi.
2. Wejść w `WYCENA`.
3. Kliknąć `Wyceń`, żeby zapisać ślad ostatniego kliknięcia.
4. Kliknąć `Diag`.
5. Skopiować raport i wkleić do analizy.
6. Powtórzyć to samo w incognito, gdzie WYCENA działa.

## Cel porównania normalny vs incognito

Raport ma jednoznacznie wskazać, czy różnica dotyczy:

- aktywnego inwestora/projektu,
- aktywnego `fc_project_v1` względem `fc_projects_v1`,
- starego `fc_project_inv_*_v1`,
- draftu oferty z błędnymi pokojami,
- snapshotów przypisanych do innego projektu,
- aktywnej sesji edycji `fc_edit_session_v1`,
- błędu `collectQuoteData`,
- błędu późniejszego zapisu/renderu snapshotu.
