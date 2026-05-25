# Fridge single front hinges fix v1 — 2026-05-25

## Cel

Naprawić zgłoszoną regresję w lodówkowej: po zaznaczeniu `Wymaga zawiasów meblowych` ustawienie `1 front` nie może liczyć zawiasów tak, jakby lodówka nadal miała dwa fronty góra/dół.

## Zakres

- Baza startowa: `site_cabinet_hardware_requirements_v1.zip`.
- Aktualna paczka po poprawce: `site_fridge_single_front_hinges_fix_v1.zip`.
- Zmieniono `js/app/cabinet/front-hardware-fronts.js`.
- Zmieniono `tools/app-dev-smoke.js`.
- Zaktualizowano cache-busting `front-hardware-fronts.js` w `index.html` i `dev_tests.html`.

## Co było błędne

`getCabinetFrontCutListForMaterials()` miało starą specjalną ścieżkę lodówki, która zawsze budowała dwa fronty: górny i dolny. Ta funkcja jest używana także przez liczenie zawiasów lodówkowych, więc przy ustawieniu jednego dużego frontu zawiasy mogły być liczone od dwóch frontów.

## Poprawka

Logika lodówki w `front-hardware-fronts.js` bierze teraz pod uwagę:

- `details.fridgeOption`,
- `details.fridgeFrontCount`,
- wysokość nóżek z ustawień pomieszczenia,
- wysokość dolnej strefy z ustawień pomieszczenia.

Dla `fridgeFrontCount === '1'` powstaje jeden front o pełnej wysokości frontowej lodówki. Dla `fridgeFrontCount === '2'` nadal powstają dwa fronty: dolny i górny.

## Test regresji

`tools/app-dev-smoke.js` dostał test:

- lodówka w zabudowie z `fridgeFrontCount:'1'` i `requiresFurnitureHinges:true` tworzy dokładnie jeden part frontu,
- zawiasy liczone są od jednego dużego frontu,
- wariant `fridgeFrontCount:'2'` nadal tworzy dwa fronty.

## Bez zmian

Nie ruszano:

- panelu `Kategorie / rodzaje okuć`,
- animacji tego panelu,
- backupów,
- storage,
- import/export Excel,
- PRO100,
- usług stolarskich,
- ROZRYS,
- RYSUNKU,
- pełnego resolvera katalogowych pozycji okuć do WYCENY.
