# PRO100 file import v1 — 2026-05-14

## Baza

- Start: `site_pro100_board_parts_import_v1.zip`.
- Odrzucona paczka `site_hardware_excel_row_date_autofill_v1.zip` nie była używana.

## Zakres

Dodano brakującą ścieżkę wczytania pliku w modalu `Import formatek PRO100` w drobnych usługach stolarskich.

Obsługiwane wejścia:

- ręczne wklejenie tabeli — bez zmian,
- plik `.xlsx` — czytany przez istniejący `FC.xlsxLite`, pierwszy arkusz,
- plik `.csv`, `.tsv`, `.txt` — czytany jako tekst i prowadzony przez ten sam parser co wklejka.

## Zasady importu

- Plik używa tej samej kolejności kolumn co wklejka: `nazwa | długość wzdłuż słoja | oklejanie długości | szerokość | oklejanie szerokości | grubość | ilość | kolor`.
- Parser pomija puste wiersze i rozpoznawalny nagłówek.
- Po wczytaniu pliku działa ten sam podgląd, wykrywanie brakujących kolorów, ptaszek `Ma słoje`, dodanie do usługi i usługowy rozrys.
- Nie dodano nowego storage ani osobnego modelu danych. Plik jest tylko drugim źródłem wejściowym dla istniejącego parsera PRO100.

## Pliki

- `js/app/service/cutting/service-pro100-parser.js` — dodano `parseRows()` i `parseColumns()`, żeby pliki XLSX/CSV korzystały z tej samej normalizacji co wklejka.
- `js/app/service/cutting/service-pro100-import-ui.js` — dodano przycisk `Wczytaj plik XLSX / CSV / TXT`, ukryty input pliku i parser pliku.
- `js/testing/service/tests.js` — dodano testy dla wierszy z pliku, wejścia plikowego i realnej ścieżki XLSX.
- `tools/service-pro100-dev-smoke.js` — rozszerzono sandbox smoke o obsługę `Blob`/`TextEncoder`/`TextDecoder` dla testu XLSX.

## Testy

- `node --check` dla zmienionych JS.
- `node tools/service-pro100-dev-smoke.js`.
- Pełne smoke/audyty z paczki.
