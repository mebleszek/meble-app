# Raport — labor drawer count context fix v1

## Cel

Naprawić błąd, w którym WYCENA doliczała `Montaż szuflady / prowadnic` do zwykłej szafki `stojąca / standardowa / drzwiczki`.

## Przyczyna

`FC.workQuantityFacts.drawerCount()` czytał `details.drawerCount` i `details.innerDrawerCount` bez sprawdzania, czy dana szafka faktycznie jest wariantem szufladowym. W danych szafki mogły istnieć ukryte/historyczne domyślne pola z draftu modala, np. `drawerCount: 3` i `innerDrawerCount: 1`, mimo że użytkownik wybrał drzwiczki i półki.

## Poprawka

`drawer.count` stał się odczytem kontekstowym. Liczy tylko:

- realny wariant `subType: szuflady`,
- jawnie wybrane szuflady wewnętrzne w standardowej szafce,
- dolną podblatową z frontem szufladowym,
- zlewową z frontem szufladowym lub dodatkową szufladą wewnętrzną,
- piekarnikową z opcją szuflady.

Nie liczy ukrytych domyślnych pól w zwykłej szafce standardowej z drzwiczkami.

## Ochrona przed regresją

Dodano `tools/labor-drawer-count-context-smoke.js`.
Rozszerzono `tools/work-quantity-facts-cabinet-smoke.js` i `tools/labor-quantity-values-link-smoke.js`.

## Zakres nietknięty

Nie zmieniono modala szafki, WYWIADU, renderowania szafek, materiałów, okuć, AGD ani logiki warunków robocizny.
