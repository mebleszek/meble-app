# labor-cabinet-single-accordion-dedupe-v1

Cel: naprawić audyt robocizny WYCENY tak, żeby jedna szafka była jednym głównym akordeonem, a montaż zawiasów nie był liczony równolegle na poziomie szafki oraz osobno dla lewych/prawych drzwiczek.

## Zmiany

- `js/app/wycena/wycena-core-labor.js`: montaż zawiasu jest budowany jako jedna pozycja kosztowa na poziomie szafki. Lewa/prawa strona zostaje tylko w opisie technicznym rozbicia zawiasów.
- `js/app/wycena/wycena-summary-details-modal.js`: robocizna w modalu szczegółów grupuje się po szafce, nie po etykietach drzwi.
- Dodano test `tools/labor-cabinet-single-accordion-dedupe-smoke.js`.

## Zasady zachowane

- Nie ruszano `drawer.count` ani jawnych wymagań szuflad/prowadnic.
- Nie ruszano WYWIADU, plusa dodawania szafki, `cabinet-modal.js`, `cabinets-render.js`, `cabinet-common.css`.
- Nie zmieniono sensu automatów robocizny, `quantitySource`, warunków ani audytu „jak policzono”.
- Nie maskowano kosztu w samym widoku: źródło kosztu zawiasów jest generowane jako jedna pozycja kosztowa.

## Testy

- `node tools/labor-cabinet-single-accordion-dedupe-smoke.js`
- `node tools/cabinet-drawer-requirements-smoke.js`
- `node tools/work-quantity-facts-cabinet-smoke.js`
- `node tools/labor-quantity-values-link-smoke.js`
- `node tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/index-load-groups.js`
- smoke testy WYCENY snapshotów/historii.
