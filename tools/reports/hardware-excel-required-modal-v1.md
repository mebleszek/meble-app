# hardware-excel-required-modal-v1

Baza: `site_hardware_excel_template_v1.zip`.

Zakres:
- uproszczono układ arkusza `Okucia`: pola robocze są na początku, `id` przeniesione na koniec,
- import ignoruje puste wiersze robocze oraz wiersze zawierające tylko wartości domyślne/formuły,
- import przyjmuje minimum danych: nazwa + jedna cena netto albo brutto,
- VAT, dostawca, rabat, narzut, baza wyceny, sposób liczenia i data ceny są uzupełniane z ustawień/domysłów importu,
- jeśli brakuje pól obowiązkowych (`nazwa`, cena, `producent`, `kategoria`, `jednostka`), import otwiera uzupełnianie pozycja po pozycji,
- resolver braków ma akcje `Ignoruj`, `Ignoruj wszystko` i `Zatwierdź`.

Uwagi architektoniczne:
- UI uzupełniania braków jest w osobnym module `js/app/material/price-modal-hardware-import-resolver.js`.
- `hardware-catalog-import-export.js` urósł do ok. 443 linii. Został świadomie zostawiony jako jeden boundary import/export na ten etap, bo większy split w trakcie poprawki importu zwiększałby ryzyko regresji. Następna rozbudowa import/export powinna zacząć się od splitu tego pliku na: template/export, parse/defaults i plan/apply.

Testy:
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/rozrys-dev-smoke.js`
- `node tools/local-storage-source-audit.js`
- `node tools/dependency-source-audit.js`
- `node tools/wycena-architecture-audit.js`
- `node --check` dla zmienionych JS
- test XLSX przez `openpyxl`: kolejność kolumn, liczba formuł, walidacje i `id` na końcu.
