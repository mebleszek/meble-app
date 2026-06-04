# Hinge change picker fix v2

## Problem
Po poprzedniej poprawce przycisk `Zmień` potrafił reagować wizualnie, ale nie otwierać żadnego wyboru. Działo się tak, gdy kaskadowa lista nie miała więcej niż jednej wartości na żadnym kroku.

## Naprawa
- Dodano końcowy modal wyboru `Wybierz wymaganie kompletu zawiasowego` jako fallback, gdy kaskada nie ma rozgałęzień.
- Obsługa kliknięcia nie zapisuje override, jeżeli użytkownik wybierze tę samą wartość, która już wynika z domyślnej reguły.
- Pozostawiono rozdzielenie: WYWIAD = kanoniczne wymaganie techniczne, WYCENA = dobór konkretnego produktu/zamiennika.

## Test
`tools/cabinet-hardware-requirements-live-edit-smoke.js` sprawdza teraz, że fallback modal się otwiera i że wybór tej samej wartości nie zapisuje override.

## Cache
`20260604_hinge_change_picker_fix_v2`
