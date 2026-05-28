# Hardware Excel template v1 — 2026-05-07

## Baza

- Start: `site_backup_storage_keys_v1.zip`
- Wynik: `site_hardware_excel_template_v1.zip`

## Zakres

- Eksport XLSX katalogu okuć został zmieniony z surowego arkusza danych w roboczy szablon Excel.
- Arkusz `Okucia` dostał formuły dla pól liczonych: cena netto z brutto, zakup po rabacie, zakup netto, cena do wyceny, cena netto do wyceny oraz podgląd marży.
- Dodano puste wiersze robocze na nowe pozycje bez `id`; import nadaje im lokalne `hw_user_*`.
- Dodano listy wyboru/data validation dla pól wybieralnych z programu: status, producent, kategoria, jednostka, dostawca, źródło ceny, VAT, baza wyceny, sposób liczenia i tryb ceny zestawu.
- Dodano arkusz `Slowniki` jako czytelny podgląd wartości słownikowych.

## Zabezpieczenia

- Import nie polega wyłącznie na wynikach formuł zapisanych w XLSX. Jeżeli formuły nie mają wartości cache albo zostały usunięte, katalog nadal normalizuje dane przez `hardware-catalog.js`.
- Puste wiersze szablonu nie są importowane jako błędy. Import analizuje tylko wiersze z realnymi danymi pozycji.
- Nowe wiersze z pustym `id` nadal są obsługiwane, a istniejące pozycje aktualizują się po stabilnym `id`.

## Testy

- `node --check js/app/shared/xlsx-lite.js`
- `node --check js/app/catalog/hardware-catalog-import-export.js`
- `node --check js/app/material/price-modal-hardware-import-export.js`
- `node --check tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- Roundtrip generowanego XLSX sprawdzony w Node i przez `openpyxl` dla formuł i walidacji.
