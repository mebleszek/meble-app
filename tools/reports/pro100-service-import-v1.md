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

## P0 — integralność zleceń usługowych — 10.11.2026

Zatwierdzony jeden pakiet na `fix/service-order-integrity-20261109`, BASE/main `3ebf20c81601ae854f62fcdeba2ada25c54a074c`, ponownie potwierdzony po wznowieniu. Wynikowy HEAD to końcowy commit zawierający ten wpis; pełne SHA, push i CLEAN w przekazaniu po kontroli zdalnej. **CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING / LIVE_BLOCKED**. Ten raport dokumentuje dowody pakietu, a aktualny stan pozostaje w `CURRENT_STATE.md`.

### Przyczyny i naprawa

- `service-orders.js` i `service-order-detail.js`: potwierdzenie wymaga dokładnie `true`; brak modułu/metody, nieprawidłowa metoda, wyjątek, odrzucona obietnica, Cancel i inne wartości nie oznaczają zgody. Dotyczy zapisu, dodania, usuwania i odrzucenia zmian tam, gdzie te czynności mają potwierdzenie. Szczegóły zachowują dotychczasowy zapis bez nowego pytania o zgodę.
- `service-order-store.js`: `upsert` najpierw scala częściową zmianę z istniejącym zleceniem, potem normalizuje. Normalizatory zachowują także nieedytowane pola zlecenia, metadanych, pozycji, cięcia i formatek przez kopię danych wejściowych. Podstawowy edytor aktualizuje oba istniejące pola nazwy klienta (`clientName`/`customerName`), aby stara nazwa kanoniczna nie zasłaniała edycji.
- `writeAll` wymaga `FC.storage.setJSON(...) === true`; false, brak potwierdzenia albo wyjątek kończą zapis niepowodzeniem. Brak modułu storage również nie udaje powodzenia. `upsert` zwraca zapisany rekord dopiero po potwierdzeniu, `remove` zwraca `true` po potwierdzonym zapisie listy. Pozostaje istniejący klucz `fc_service_orders_v1` i kontrakt `js/app/shared/storage.js`; brak bezpośredniego zapisu lub nowego magazynu/fallbacku.
- Oba edytory oczekują na wynik zapisu; błąd nie zamyka formularza, nie czyści dirty ani nie pokazuje „Zapisano”. Usuwanie także sprawdza potwierdzenie zapisu. Brak autorytatywnego `serviceOrderStore` blokuje operację zamiast przekazania jej do starszego katalogowego fallbacku bez wiarygodnego potwierdzenia. Odczytowy fallback pozostaje.
- Szczegóły zapisują zmianę cięcia dla istniejącego ID, zachowując pozostałe pola w store. Guard `beforeClose` chroni także × i Escape, a nie tylko „Wyjdź”; odmowa lub błąd potwierdzenia pozostawiają zmiany w formularzu.

### Dowody celowane

| Kontrola | Wynik |
|---|---|
| `node tools/service-order-integrity-smoke.js` | **12/12 grup PASS**: false/undefined/wyjątek/quota, niepełny update z rzeczywiście wygenerowanym planem, nazwa klienta, brak/błąd/odrzucenie/Cancel potwierdzenia, błędy zapisu/usunięcia i retry, brak store, szczegóły i dirty, nowy rekord, oczekiwanie na ACK. |
| Te same testy na źródłach BASE przez `MEBLE_SERVICE_INTEGRITY_SOURCE_ROOT` | **11 oczekiwanych FAIL, 1 PASS** (prawidłowe odrzucenie zmian). Reprodukcja regresji, bez zmiany drzewa roboczego lub osłabienia asercji. |
| `node tools/service-order-integrity-browser-smoke.js` | **6/6 grup PASS**, prawdziwy Chromium, DOM, panelBox, storage i generator usługowego planu: przyciski/potwierdzenia, nieudany zapis/usuwanie, pełny rekord, dirty szczegółów, ×/Escape, trwały odczyt po reloadzie. Izolowany syntetyczny profil, zero żądań zewnętrznych. Test czeka na załadowanie nowego dokumentu przed odczytem po reloadzie. |
| `node tools/service-pro100-dev-smoke.js` | **18/18 PASS**, istniejące testy usług/PRO100 bez osłabiania asercji. |
| Wersje, manifest, load groups, składnia zmienionych JS, diff | **PASS**; trzy skrypty mają `20261110_service_order_integrity_v1` w obu HTML i `tools/script-versions.js`, manifest odtworzony. |
| Faktyczne włączenie do CI | **212 bieżących smoke / 7 rozłącznych kompletnych grup**; nowy Node w **6/7**, nowy Chromium w **5/7**, dotychczasowy PRO100 w **7/7**. Preflight wykrywa `tools/*-smoke.js`; workflow nie zmieniano. |

Granice: bez zmian wizualnych, schematu, identyfikatorów, migracji, głównego RYSUNKU, WYCENY i `storage.js`. Istniejąca ścieżka storage/LOCAL-FIRST nie jest omijana; odmowy zapisu pozostają odmowami. Test Chromium używa izolowanego syntetycznego localStorage, nie danych właściciela ani produkcyjnego Firestore. Nie jest dowodem akceptacji fizycznego Androida, pełnej synchronizacji ani regresji aktualizacji starego SW; pełne wymagane zestawy pozostają **CI_PENDING** dla GitHub Actions. Bez lokalnego pełnego CI, PR/Ready, merge, publikacji i Firebase LIVE.

Następny krok: niezależna kontrola diffu i świeżego zdalnego HEAD/BASE przez ChatGPT; ewentualne CI/wydanie dopiero po osobnej zgodzie właściciela na dokładne SHA.
