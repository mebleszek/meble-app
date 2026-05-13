# Hardware accessory tests v1 — 2026-05-13

## Baza

- Start: `site_catalog_seed_dev_tests_fix_v1.zip`.
- Odrzucona paczka `site_hardware_excel_row_date_autofill_v1.zip` nie była używana.

## Zakres

Dodano testy akcesoriów/okuć bez zmiany runtime aplikacji.

Nowe pliki:

- `js/testing/material/accessories-tests.js`
- `tools/hardware-accessories-dev-smoke.js`

Zmodyfikowane:

- `js/testing/material/tests.js` — podpięcie suite akcesoriów do testów MATERIAŁY.
- `dev_tests.html` — cache-busting i załadowanie nowej suite.
- `DEV.md` — opis paczki.

## Pokrycie testów

Nowa suite ma 37 testów:

- 9 testów modelu ceny okuć,
- 7 testów słowników kategorii i typów/cech,
- 4 testy store/katalogu,
- 11 testów import/export,
- 6 testów kontraktów UI.

Testy pilnują m.in.:

- `para` → `kpl.` i brak powrotu `para`,
- `kpl.` jako zwykła jednostka, a `zestaw` jako składany zestaw,
- globalnego VAT-u z ustawień zamiast VAT-u dostawcy,
- rabatu dostawcy przy koszcie zakupu,
- ceny ręcznej i baz `catalogGross`/`purchaseGross`,
- tylko jednej ceny `Do wyceny`,
- ignorowania `#REF!` i błędów arkusza,
- mapowania statusów cen,
- filtrowania `Typ / cecha` po kategorii,
- duplikatu `producent + kategoria + typ`,
- kopii danych słowników ze store,
- braku kolumny VAT w arkuszu `Dostawcy`,
- układu arkusza `Ceny_dostawcow`,
- braku formuł w pustych wierszach cen,
- importu po `producent + symbol` bez nadpisywania nazwy katalogowej,
- braku mutacji katalogu przez podgląd importu,
- działania `__skipImport`,
- resolvera brakującego dostawcy,
- wymagania kategorii/jednostki dla nowego okucia z arkusza cen,
- zakazu tworzenia producenta z literówki,
- fałszywego duplikatu tego samego okucia z katalogu i arkusza,
- finalnego `applyImportPlan`,
- kontraktów statusów ceny, filtrów, pickera typu, potwierdzeń cen i renderu przycisku `Edytuj`.

## Wyniki

- `node tools/hardware-accessories-dev-smoke.js` — `37/37 OK`.
- Symulacja `FC.materialDevTests.runAll()` w Node — `43/43 OK`.
- Standardowe smoke/audyty przeszły w wydaniu paczki.

## Czego nie zmieniono

Nie zmieniono runtime aplikacji, UI, modelu danych, importu/exportu XLSX, RYSUNKU, WYWIADU, MATERIAŁÓW runtime, WYCENY, backupów ani polityki storage.
