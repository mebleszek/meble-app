# Wycena preview split v1 — 2026-04-28

Zakres: techniczny split pierwszej części `js/tabs/wycena.js` bez zmiany UI, działania Wyceny, danych, storage, RYSUNKU ani ROZRYS.

## Zmiany

1. Dodano `js/app/wycena/wycena-tab-preview.js` jako właściciela renderu podglądu aktualnej/historycznej oferty.
2. `js/tabs/wycena.js` deleguje render podglądu przez `FC.wycenaTabPreview.renderPreview(...)` i zachowuje dotychczasowe zależności jako jawny kontrakt wejściowy.
3. Zachowano dotychczasowy kontrakt przycisków podglądu: akceptacja, pobranie PDF i render historii korzystają z tych samych helperów/status bridge co przed splitem.
4. Zaktualizowano load order w `index.html`, `dev_tests.html`, `tools/index-load-groups.js` i `tools/app-dev-smoke-lib/file-list.js`.
5. `tools/app-dev-smoke.js` kończy się w Node jako szybki, stabilny sanity smoke publicznych API głównych działów. Ciężkie testy modalowe/regresyjne pozostają w `dev_tests.html`.

## Rozmiary po zmianie

- `js/tabs/wycena.js` — ok. 710 linii po splicie preview.
- `js/app/wycena/wycena-tab-preview.js` — ok. 162 linie.

## Granice odpowiedzialności

- `wycena-tab-preview.js` odpowiada wyłącznie za DOM/render podglądu oferty.
- Nie zapisuje danych, nie zmienia statusów i nie rozstrzyga scope ofert.
- Zależności biznesowe są przekazywane z `js/tabs/wycena.js`, żeby split nie zmienił logiki statusów ani historii.

## Testy wykonane przy paczce

- `node --check js/app/wycena/wycena-tab-preview.js`
- `node --check js/tabs/wycena.js`
- `node --check js/testing/wycena/tests.js`
- `node --check tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/wycena-architecture-audit.js`
- `node tools/app-dev-smoke.js` → 24/24 OK
- `node tools/rozrys-dev-smoke.js` → 72/72 OK

## Następne bezpieczne kroki

1. Dalsze odchudzanie `js/tabs/wycena.js` tylko przez małe moduły render/delegatory.
2. `quote-snapshot-store.js` i `project-status-sync.js` zostawić na osobny etap z fixture porównującymi old/new dla exact-scope, zaakceptowanych ofert i cofania statusów.
3. Nie przenosić logiki statusów do modułu preview.
