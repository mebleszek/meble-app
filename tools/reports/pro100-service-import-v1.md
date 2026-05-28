# PRO100 service import v1 — 2026-05-14

## Baza

- Start: `site_hardware_import_export_deep_tests_v1.zip`.
- Nie użyto odrzuconej paczki `site_hardware_excel_row_date_autofill_v1.zip`.

## Zakres

Dodano import formatek PRO100 w drobnych usługach stolarskich bez ruszania katalogu okuć, WYCENY, WYWIADU ani głównego ROZRYSU.

Format wejściowy:

1. nazwa formatki,
2. długość wzdłuż słoja,
3. oklejanie długości,
4. wymiar w poprzek płyty,
5. oklejanie szerokości,
6. grubość,
7. ilość,
8. kolor/dekor.

Znaki oklejania:

- `=` — dwie krawędzie,
- `-` / `–` / `—` — jedna krawędź,
- puste — brak oklejania.

## Nowe moduły

- `js/app/service/cutting/service-pro100-parser.js` — czysty parser i podsumowanie wklejki PRO100.
- `js/app/service/cutting/service-pro100-import-ui.js` — aplikacyjny modal importu PRO100, podgląd, brakujące kolory i ptaszek `Ma słoje`.
- `tools/service-pro100-dev-smoke.js` — node smoke testy usług i importu PRO100.

## Zmiany w istniejących modułach

- `service-cutting-common.js` zachowuje w formatkach materiał, symbol, grubość, źródło i `hasGrain`.
- `service-cutting-rozrys.js` grupuje formatki po materiale/grubości; dla materiałów bez słojów pozwala na obrót, a dla materiałów ze słojami pilnuje kierunku.
- `service-order-detail.js` ma przycisk `Import PRO100` obok `Dodaj formatkę`; import dopisuje lub zastępuje formatki i zostawia widok szczegółu zlecenia otwarty.
- `service-order-store.js` naprawia zachowanie formatek cięcia przy zapisie/odczycie i nie gubi pól PRO100.
- `js/testing/service/tests.js` ma testy parsera, podsumowań, materiałów, zapisu i współpracy z usługowym ROZRYS-em.

## Cloud/readiness

- Nie dodano nowego klucza storage.
- Nowe dane idą przez istniejący `fc_service_orders_v1` oraz katalog materiałów przez `catalogStore.savePriceList('materials')`.
- Brakujące kolory nie są zapisywane poza store; materiał dodany z importu dostaje standardowy rekord materiału z `manufacturer: PRO100`, `materialType: laminat`, `symbol`, `name`, `hasGrain`.

## Testy

- `node --check` dla JS.
- `node tools/check-index-load-groups.js`.
- `node tools/hardware-import-export-deep-smoke.js`.
- `node tools/hardware-accessories-dev-smoke.js`.
- `node tools/service-pro100-dev-smoke.js`.
- `node tools/app-dev-smoke.js`.
- `node tools/rozrys-dev-smoke.js`.
- `node tools/local-storage-source-audit.js`.
- `node tools/dependency-source-audit.js`.
- `node tools/wycena-architecture-audit.js`.
- `unzip -t` gotowego ZIP-a.
