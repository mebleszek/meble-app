# labor quantity source selector v1

Paczka: `site_labor_quantity_source_selector_v1.zip`

## Cel

Dodać w cenniku robocizny pole wyboru `Źródło ilości`, które zapisuje wybrane nazwane źródło danych, np. `front.count`, `hinge.count`, `shelf.count`, ale nie zmienia jeszcze sposobu liczenia WYCENY.

## Zakres

- Dodano pole `laborQuantitySource` w formularzu pozycji robocizny.
- Pole jest obsługiwane przez istniejący mechanizm launcher + modal wyboru, bez natywnego widocznego selecta.
- `FC.workQuantitySources` wystawia listę aktywnych źródeł nadających się do ilości.
- `FC.laborCatalog.normalizeDefinition()` zapisuje i normalizuje `quantitySource`.
- Startowe pozycje robocizny dostały sugestie źródeł tam, gdzie jest to jednoznaczne, np. fronty, zawiasy, półki, szuflady.

## Poza zakresem

- Nie podpinano `quantitySource` do WYCENY.
- Nie zmieniano `quoteCalculationRegister`.
- Nie ruszano WYWIADU, modala szafki, plusa dodawania ani renderu szafek.
- Nie dodawano automatów robocizny.

## Cache-busting

`20260609_labor_quantity_source_selector_v1`
