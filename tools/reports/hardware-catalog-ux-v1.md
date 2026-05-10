# Hardware catalog UX v1 — 2026-05-10

Baza: `site_hardware_bundle_import_ux_v1.zip`.

## Zakres

- Czytelniejsze karty listy okuć w katalogu Akcesoria.
- Status ceny liczony w UI: brak/do sprawdzenia/stara/aktualna.
- Szybkie filtry: wszystkie, do sprawdzenia cen, brak ceny, stara cena, zestawy.
- Podgląd składanych zestawów na karcie pozycji.
- Lepszy komunikat i fallback odczytu pliku przy imporcie XLSX/JSON na Androidzie.

## Poza zakresem

- Nie zmieniano modelu storage ani kluczy localStorage.
- Nie ruszano RYSUNKU, WYWIADU, WYCENY, MATERIAŁÓW jako rozpiski okuć ani automatyki okuć przy szafkach.

## Testy

- `node --check` dla zmienionych JS.
- `node tools/check-index-load-groups.js`.
- `node tools/app-dev-smoke.js`.
- `node tools/rozrys-dev-smoke.js`.
- `node tools/local-storage-source-audit.js`.
- `node tools/dependency-source-audit.js`.
- `node tools/wycena-architecture-audit.js`.
