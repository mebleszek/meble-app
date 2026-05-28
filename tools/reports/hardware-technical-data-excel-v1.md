# Hardware technical data + Excel v1 — 2026-05-18

## Baza

- Baza startowa: `site_000_dev_tests_errors_fix_v1.zip`.
- Zakres: katalog okuć, import/export Excel/JSON, arkusz `Ceny_dostawcow`, formularz pozycji okucia i testy.

## Cel

Przygotować katalog okuć pod przyszłe listy zakupowe i bezpieczną zamianę systemów okuć bez dokładania zbędnego klikania przy tworzeniu szafki.

## Zmiany danych

Do pozycji okucia dodano pola techniczne:

- `hardwareSystem` — system/rodzina okucia, np. `Blum TANDEMBOX`, `Rejs Comfort Box`, `Blum CLIP top`.
- `drawerProfile` — profil/wysokość szuflady, np. `M`, `N`, `H120`.
- `drawerLengthMm` — długość prowadnicy/szuflady w mm.
- `drawerLoadKg` — nośność w kg.
- `drawerReinforced` — czy wariant jest wzmocniony.
- `hardwareColor` — kolor okucia, jeśli ma znaczenie zakupowe.
- `hardwareUsage` — zastosowanie, np. frontowa/wewnętrzna/zlewowa.
- `technicalNote` — uwagi techniczne.

Pole `series` zostaje traktowane jako legacy alias dla `hardwareSystem`, żeby dotychczasowe dane i seedy nie traciły informacji o systemie/serii.

## Excel

### Arkusz `Okucia`

Pełny katalog eksportuje i importuje nowe kolumny techniczne:

- `system_okucia`
- `profil_szuflady`
- `dlugosc_mm`
- `nosnosc_kg`
- `wzmocniona`
- `kolor_okucia`
- `zastosowanie`
- `uwagi_techniczne`

### Arkusz `Ceny_dostawcow`

Szybka aktualizacja cen zachowuje użyteczny początek arkusza:

`okucie_nazwa`, `okucie_symbol`, `producent`, `kategoria`, `jednostka`, `dostawca`, `cena_netto`, `cena_brutto`, `do_wyceny`, `status_ceny`, `data_ceny`.

Dane techniczne są opcjonalnie po `data_ceny`, a ID techniczne zostają na końcu. Dzięki temu zwykła aktualizacja ceny nie wymaga wypełniania profilu/długości/nośności, ale nowe pozycje mogą od razu dostać pełne dane techniczne.

## UI

W formularzu okucia:

- etykietę `System / seria` zmieniono na `System okucia`,
- dane techniczne są schowane w aplikacyjnym akordeonie `Dane techniczne`,
- nie dodano natywnych pickerów/selectów telefonu,
- główna lista cennika pozostaje czytelna; dane techniczne nie są wypchnięte do podstawowego widoku.

## Testy

Dodano testy dla:

- normalizacji systemu i parametrów szuflady,
- unikalności typu z uwzględnieniem systemu okucia,
- eksportu technicznych kolumn w arkuszu `Okucia`,
- importu technicznych danych z arkusza `Okucia`,
- zachowania szybkiego początku arkusza `Ceny_dostawcow`,
- tworzenia nowego okucia z technicznymi danymi z arkusza cen,
- smoke Node dla importu technicznych danych i układu arkusza cen.

## Poza zakresem

Nie podłączono jeszcze:

- automatycznego doboru szuflady/prowadnicy po głębokości szafki,
- checkboxa `wzmocniona` w konkretnym modalu szafki,
- silnika zamiany producentów/systemów okuć,
- list zakupowych,
- WYCENY ani snapshotów ofert.
