# Dev tests errors fix v1 — 2026-05-18

## Baza

- Start: `site_000_bulk_apply_zone_preferences_v1.zip`.
- Cel: poprawić trzy błędy zgłoszone z `dev_tests.html` po Etapie 2A.

## Zakres

1. `js/testing/material/accessories-import-export-deep-tests.js`
   - Funkcja wyszukująca przyciski w modalach potwierdzeń importu okuć używa teraz `Array.from(rootNode.querySelectorAll('button') || []).find(...)`.
   - Naprawia błąd w przeglądarce/Androidzie, gdzie `NodeList` z `querySelectorAll` nie ma metody `.find()`.

2. `js/app/cabinet/cabinet-choice-launchers.js`
   - Launcher wyboru szafki odpala `change` również wtedy, gdy użytkownik wybierze tę samą wartość, którą źródłowy select ma już ustawioną po renderze.
   - Naprawia desynchronizację: select mógł mieć nową wartość, ale draft szafki zostawał ze starą wartością po zmianach stref/preferencji.

3. `tools/app-dev-smoke.js`
   - Dodano kontrakty ochronne dla obu powyższych poprawek.

## Poza zakresem

- Bez zmian modelu danych.
- Bez zmian storage/localStorage.
- Bez zmian UI poza synchronizacją launchera.
- Bez zmian PRO100, ROZRYS, WYCENY, hurtowego apply i katalogu okuć runtime.
