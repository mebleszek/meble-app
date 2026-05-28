# Hardware supplier price import fix v1 — 2026-05-11

## Baza

- Start: `site_hardware_supplier_price_status_types_v1.zip`.
- Cel: naprawić błędy wykryte w kontroli paczki dotyczące cen dostawców, statusów cen, słowników i importu XLSX.

## Zakres zmian

1. Wyeksportowano publiczne helpery kategorii, typów, statusów i walidacji z `FC.hardwareCatalog`.
2. Import `Ceny_dostawcow` liczy brakującą cenę netto/brutto według VAT dostawcy.
3. Import ignoruje błędy arkusza typu `#REF!` jako dane ceny.
4. Eksport `Ceny_dostawcow` nie generuje formuł w pustych wierszach szablonu.
5. `priceStatus: current` nie oznacza już listy okuć jako `Do sprawdzenia`.
6. `Do wyceny` nie może być ustawione na pustej cenie dostawcy.
7. Modal `Słowniki` nie przebudowuje DOM przy każdym znaku w polach tekstowych.
8. Cache-busting dla zmienionych modułów został podbity do `20260511_hardware_supplier_price_import_fix_v1`.

## Sprawdzenia

- `node --check` dla zmienionych plików JS.
- `node tools/check-index-load-groups.js`.
- `node tools/app-dev-smoke.js`.
- `node tools/rozrys-dev-smoke.js`.
- `node tools/local-storage-source-audit.js`.
- `node tools/dependency-source-audit.js`.
- `node tools/wycena-architecture-audit.js`.
- Dodatkowo sprawdzono przesłany XLSX użytkownika: arkusz zawierał `#REF!`, ale plan importu nie zwrócił błędów, policzył brakujące ceny i nie ustawił technicznego źródła `Import Excel` jako aktywnego źródła ceny.
