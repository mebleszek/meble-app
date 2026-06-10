# drawer-requirements-source-of-truth-v1

## Cel

Usunąć źródło ukrytych szuflad i przełączyć `drawer.count` na jawne wymagania szuflad/prowadnic, bez whitelisty wariantów szafek i bez maskowania w WYCENIE.

## Zmienione pliki

- `js/app/cabinet/cabinet-drawer-requirements.js` — nowy centralny moduł wymagań szuflad/prowadnic.
- `js/app/pricing/work-quantity-facts.js` — `drawer.count` czyta tylko wymagania z modułu.
- `js/app/cabinet/cabinet-modal-draft.js` — świeży draft i klony nie niosą śmieciowych pól szuflad.
- `js/app/cabinet/cabinet-fronts.js` — zmiana typu/wariantu czyści legacy pola, a szuflady frontowe wynikają z `drawerLayout`.
- `js/app/cabinet/cabinet-modal-finalize.js` — przed zapisem szafki wykonywane jest czyszczenie śmieci szufladowych.
- `js/app/shared/schema.js`, `js/app/shared/migrate.js` — normalizacja nie odbudowuje `drawerCount` jako ukrytej prawdy.
- `index.html`, `dev_tests.html`, `tools/index-load-groups.js`, `tools/app-dev-smoke-lib/file-list.js` — load order nowego modułu przed `work-quantity-facts`.
- `tools/cabinet-drawer-requirements-smoke.js` — test źródła prawdy dla szuflad.

## Decyzje

- Nie robimy zgodności wstecz dla starych testowych pól `drawerCount`.
- Zwykła szafka z drzwiami i półkami daje `drawer.count = 0`, nawet jeśli ma stare ukryte pola.
- Dowolna konstrukcja może być policzona jako szufladowa przez jawne `drawerRequirements`.
- Automaty robocizny, `quantitySource`, warunki i audyt pozostają bez zmiany sensu.

## Testy

Patrz lista w odpowiedzi końcowej paczki. Znany stan: `quote-labor-single-truth-smoke` nadal jest niezielony na tej bazie i dotyczy szerszego tematu robocizny/zestawów, nie naprawy `drawer.count`.
