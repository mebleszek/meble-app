# Project status scope split v1

## Zakres

Wycena/statusy projektu: mały split `js/app/project/project-status-sync.js` bez zmiany UI, bez zmiany działania biznesowego, bez zmian storage i bez ruszania RYSUNKU/ROZRYS.

## Zmiany

- Dodano `js/app/project/project-status-scope.js`.
- Do nowego modułu przeniesiono helpery:
  - rangi i normalizacja statusów,
  - normalizacja scope pokoi,
  - status-map pokoi,
  - agregacja statusów,
  - rekomendowana mapa statusów z historii snapshotów,
  - helpery odczytu kontekstu projektu/inwestora potrzebne do status scope.
- `js/app/project/project-status-sync.js` spadł do ok. 389 linii i został przy odpowiedzialności: zapis mirrorów, rekonsyliacja, commit akceptowanych snapshotów i odświeżanie widoków.

## Kontrakty

- Dodano `js/testing/wycena/suites/project-status-scope-contract.js`.
- Rozszerzono `js/testing/wycena/suites/architecture-contract.js`.
- `WYCENA node smoke` obejmuje grupę `Wycena ↔ Project status scope split`.

## Load order

Nowa kolejność obowiązkowa:

1. `js/app/project/project-status-scope.js`
2. `js/app/project/project-status-sync.js`

Zaktualizowano:

- `index.html`,
- `dev_tests.html`,
- `tools/index-load-groups.js`,
- `tools/app-dev-smoke-lib/file-list.js`.

## Cloud-readiness

Zmiana nie dodaje storage ani nowego modelu danych. Jest korzystna pod przyszłą chmurę, bo oddziela wyliczanie scope/statusów od zapisu mirrorów do obecnych store/fasad.

## Czego nie ruszano

- UI i wygląd.
- RYSUNEK.
- ROZRYS i optymalizator.
- `quote-snapshot-store.js`, poza testami i zależnościami.
- Zasady selected/rejected.
- Zapis backupów i localStorage.
