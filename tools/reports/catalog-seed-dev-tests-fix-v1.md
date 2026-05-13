# Catalog seed dev tests fix v1 — 2026-05-13

## Baza

- Start: `site_hardware_global_vat_import_stabilization_v1.zip`.
- Nie użyto odrzuconej paczki `site_hardware_excel_row_date_autofill_v1.zip`.

## Zakres

- Poprawiono regresyjne testy przeglądarkowe `dev_tests.html`, które błędnie zakładały, że po migracji katalogu okuć w liście akcesoriów musi zostać dokładnie jeden rekord.
- Po seedach katalogu okuć lista akcesoriów może zawierać realne pozycje startowe Blum/GTV/Peka/Nomet/Rejs oraz migrowane legacy akcesorium.
- Testy sprawdzają teraz właściwy kontrakt: migrowane akcesorium z legacy `materials` ma trafić do `accessories`, nie może zostać w `sheetMaterials` i nie może dalej mieć `materialType: akcesoria`.
- Analogicznie poprawiono test `preferStoredSplit`, żeby pilnował zachowania zapisanego akcesorium, ale nie traktował obecności seedów jako błędu.
- Podbito cache-busting w `dev_tests.html` dla `js/testing/project/tests.js` i `js/testing/material/tests.js`.

## Czego nie ruszono

- Brak zmian runtime aplikacji.
- Brak zmian importu/exportu XLSX.
- Brak zmian modelu VAT/rabatów/dostawców.
- Brak zmian RYSUNKU, WYWIADU, MATERIAŁÓW, WYCENY, backupów i polityki backupów.
