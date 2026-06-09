# 2026-06-09 — Robocizna: wczytanie kaskadowych warunków w realnym index

Paczka: `site_labor_conditions_cascade_load_fix_v1.zip`.

## Problem

W paczce `site_labor_conditions_cascade_fields_v1.zip` moduł `js/app/material/price-modal-labor-conditions.js` był obecny oraz podpięty w `dev_tests.html`, ale nie był załadowany w realnym `index.html`. W efekcie sekcja `Warunki zastosowania` w Stawkach wyceny mebli pokazywała tylko tekst informacyjny i nie renderowała `Warunek 1`.

## Poprawka

- Dodano `js/app/material/price-modal-labor-conditions.js` do `index.html`.
- Dodano ten sam moduł do `tools/index-load-groups.js`, bezpośrednio po `price-modal-field-help.js` i przed `price-modal-item-form.js`.
- Zaktualizowano cache-busting na `20260609_labor_conditions_cascade_load_fix_v1`.
- Rozszerzono test `tools/labor-conditions-remove-auto-role-smoke.js`, żeby sprawdzał realne `index.html`: moduł warunków musi być wczytany przed formularzem pozycji.

## Zakres niezmieniony

Nie zmieniano modelu danych warunków, WYCENY, WYWIADU, modala szafki, plusa dodawania szafki, materiałów, okuć ani AGD.
