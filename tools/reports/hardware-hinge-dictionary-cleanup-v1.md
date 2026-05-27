# Hardware hinge dictionary cleanup v1

## Cel

Poprawić błędne założenie, że szafka rogowa ślepa ma osobny typ `do ślepego narożnika`. Technicznie ma używać realnej cechy zawiasu: `równoległy wpuszczany`. Na tej samej zasadzie front lodówki ma używać cechy `lodówkowy nakładany`.

## Zmiany

- `cabinet-hardware-requirements.js`: `rogowa_slepa` zwraca `hinge_parallel_inset` i etykietę `Zawias równoległy wpuszczany`; lodówka z ptaszkiem zwraca `hinge_fridge_overlay` i `Zawias lodówkowy nakładany`.
- `hardware-technical-params.js`: słownik `Nałożenie` dla zawiasów dopisuje/migruje `równoległy wpuszczany` oraz `lodówkowy nakładany`; stare wartości opisowe są mapowane na nowe.
- `hardware-catalog.js`: domyślne typy/cechy zawiasów zastępują opisowe typy technicznymi: `Równoległy wpuszczany` i `Lodówkowy nakładany`.
- `hardware-catalog-seed-data.js`: dopisano realne seedowane pozycje cennika `79B9550+173L6130` i `91K9550+194K6100` zgodnie z istniejącym modelem danych katalogu.
- `tools/app-dev-smoke.js`: dodano regresje dla nowych typów, migracji starych nazw, nowych wartości słownika i seedów cennika.

## Zasada na przyszłość

Kod może określać wymaganie techniczne, ale nie może zaszywać realnej pozycji okucia ani ceny poza katalogiem. Nowe okucie ma trafić do słowników i cennika tak samo jak istniejące pozycje: producent, kategoria, jednostka, typ/cecha, parametry techniczne, dostawca, cena, data i notatka.

## Poza zakresem

Nie zmieniano UI panelu `Kategorie / rodzaje okuć`, import/export Excel, backupów, PRO100, usług stolarskich, ROZRYS, RYSUNKU ani pełnego resolvera katalogowego WYCENY.
