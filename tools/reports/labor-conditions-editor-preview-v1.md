# Robocizna — edytor warunków i podgląd reguły v1

Paczka: `site_labor_conditions_editor_preview_v1.zip`

## Zakres

- Uporządkowano edycję warunków zastosowania reguł robocizny w cenniku/stawkach wyceny.
- Każdy warunek pokazuje podgląd `Działa gdy...` oraz jednostkę przy polach `Minimum / od` i `Maksimum / do`.
- Edytor nie pozwala zapisać pustego zakresu ani zdublować tego samego warunku w jednej regule.
- Dodano podgląd działania reguły: źródło ilości, tryb ilości, czas, stawka, warunki i informacja, że WYCENA czyta wartości przez `workQuantityFacts` bez drugiej kopii danych szafki.
- Poprawiono opis `drawer.count` w słowniku źródeł ilości, żeby odpowiadał obecnemu modelowi jawnych wymagań szuflad/prowadnic.

## Poza zakresem

- Nie zmieniono wyniku WYCENY ani automatów robocizny.
- Nie zmieniono historii ofert, snapshotów ani storage.
- Nie ruszano WYWIADU, modala szafki, plusa dodawania szafki, `cabinet-modal.js`, `cabinets-render.js` ani `cabinet-common.css`.
- Nie dodano chmury ani nowego klucza `localStorage`.

## Testy

- `tools/labor-conditions-editor-preview-smoke.js`
- `tools/labor-conditions-remove-auto-role-smoke.js`
- `tools/labor-quantity-source-selector-smoke.js`
- `tools/labor-quantity-values-link-smoke.js`
- smoke testy WYCENY, snapshotów, drawer requirements i app-dev.
