# Hardware bundle/import UX v1 — 2026-05-09

## Baza

- Start: `site_hardware_file_snapshot_fix_v1.zip`
- Wynik: `site_hardware_bundle_import_ux_v1.zip`

## Zakres

- `kpl.` zostaje normalną jednostką kompletu i nie uruchamia automatycznie składu zestawu.
- `para` usunięta z list wyboru i normalizowana do `kpl.` dla danych legacy/importu.
- Skład zestawu widoczny tylko dla jednostki `zestaw` albo pozycji mającej już `bundleItems`.
- Arkusz `Sklad_zestawow` ma czytelny układ: nazwy i ilość na początku, techniczne ID na końcu.
- Podgląd importu używa wyboru trybu 1 z 2 i osobnego przycisku `Zatwierdź import`.

## Uwagi architektoniczne

`js/app/catalog/hardware-catalog-import-export.js` przekracza 400 linii. Plik pozostał w tej paczce bez splitu, bo zmiana była wrażliwa i dotyczyła importu/eksportu. Następna większa praca w tym obszarze powinna zacząć się od podziału na template/export, parse/defaults i plan/apply.

## Testy

- `node --check` dla zmienionych JS
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/rozrys-dev-smoke.js`
- `node tools/local-storage-source-audit.js`
- `node tools/dependency-source-audit.js`
- `node tools/wycena-architecture-audit.js`
