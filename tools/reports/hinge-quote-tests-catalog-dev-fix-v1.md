# hinge-quote-tests-catalog-dev-fix-v1

Paczka: `site_hinge_quote_tests_catalog_dev_fix_v1.zip`
Cache-busting: `20260605_hinge_quote_tests_catalog_dev_fix_v1`

## Zakres

- Dodano `tools/wycena-hinge-quote-replacement-flow-smoke.js` dla pełnego przepływu zawiasów do WYCENY.
- Poprawiono testy przeglądarkowe `js/testing/project/tests.js` i `js/testing/material/tests.js`, aby nie traktowały poprawnego startowego PCV/obrzeża jako błędu migracji materiałów.
- Podbito query-string w `dev_tests.html` dla zmienionych testów przeglądarkowych.

## Chronione przypadki

1. Front 66×105 cm akryl przechodzi do WYCENY jako 4 zawiasy.
2. `szuflada_drzwi` z legacy `frontCount = 3` liczy tylko drzwiczki zawiasowe, nie front szuflady.
3. Zestaw bez zapisanych frontów w `room.fronts` odtwarza front z rekordu zestawu i liczy zawiasy tylko na korpusie prowadzącym.
4. WYCENA może dobrać GTV 107° jako zamiennik 110° w klasie 90–120°, ale nie może dobrać 170° narożnego.
5. Testy katalogu dopuszczają legalne dodatkowe pozycje materiałowe, np. PCV/obrzeże, i sprawdzają właściwą separację akcesoriów.

## Testy

- `node tools/cabinet-hinge-quantity-kg-smoke.js`
- `node tools/cabinet-set-material-cutlist-smoke.js`
- `node tools/wycena-hinge-requirement-override-smoke.js`
- `node tools/wycena-hinge-quote-replacement-flow-smoke.js`
- `node tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
