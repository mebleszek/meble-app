# Hardware import/export v1 — 2026-05-07

## Zakres

- Dodano import/eksport katalogu okuć jako JSON oraz XLSX.
- JSON jest technicznym backupem katalogu okuć: pozycje, producenci, dostawcy i ustawienia.
- XLSX jest arkuszem roboczym do edycji w Excelu: `Okucia`, `Sklad_zestawow`, `Dostawcy`, `Producenci`, `Ustawienia`.
- Import zapisuje dane przez `catalogStore`, a nie bezpośrednio przez UI do `localStorage`.

## Granice odpowiedzialności

- `js/app/shared/xlsx-lite.js` — minimalny zapis/odczyt prostego XLSX bez zewnętrznych bibliotek.
- `js/app/catalog/hardware-catalog-import-export.js` — snapshot katalogu, mapowanie JSON/XLSX, walidacja planu importu i zapis przez `catalogStore`.
- `js/app/material/price-modal-hardware-import-export.js` — panel UI importu/eksportu w katalogu okuć.

## Zasady importu

- Wiersz z istniejącym `id` aktualizuje istniejącą pozycję.
- Wiersz bez `id` tworzy nową pozycję i dostaje techniczne `hw_user_*`.
- Wiersz bez `id`, ale z takim samym producentem, symbolem i nazwą jak istniejąca pozycja, jest dopasowywany do istniejącej pozycji zamiast tworzyć duplikat.
- Import ma dwa tryby: scal/aktualizuj oraz zastąp katalog.
- Import nie jest jeszcze synchronizacją chmurową, ale boundary jest przygotowany tak, żeby później przepiąć zapis z lokalnego store na chmurę.
