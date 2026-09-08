# Globalne ustawienia domyślne — poprawka stosowania v1

Data: 2026-09-08

## Objaw

Materiały zapisane w `Start → trybik → Domyślne materiały i okucia` były widoczne w ustawieniach, ale nowo dodawana szafka mogła nadal dostać korpus, front i plecy z wcześniej zapisanej szafki.

## Przyczyna

Przy dodawaniu kolejnej szafki program klonował ostatnią szafkę (albo ostatnią szafkę wybranego typu) i natychmiast zwracał ten klon. Centralny resolver `pomieszczenie → globalne ustawienia z trybiku → fallback` był wywoływany tylko dla pierwszej szafki w pustym pomieszczeniu.

## Poprawka

- konstrukcja poprzedniej szafki nadal jest kopiowana: typ, wariant, wymiary i szczegóły,
- po sklonowaniu program ponownie nakłada aktualne domyślne materiały,
- kolejność pierwszeństwa pozostaje jednoznaczna:
  1. preferencje strefy konkretnego pomieszczenia,
  2. globalne ustawienia z trybiku,
  3. wartości skopiowane z poprzedniej szafki albo awaryjne wartości programu,
- zapisane wcześniej szafki nie są zmieniane,
- kreator zestawów nadal korzysta z tego samego centralnego resolvera strefowego.
- formularz w trybiku zachowuje teraz jedną stabilną referencję draftu; kolejna zmiana wykonana po wcześniejszym kliknięciu `Zapisz` nie trafia już do odłączonej kopii.

## Test regresji

`node tools/program-defaults-application-smoke.js` sprawdza:

1. zapis i ponowny odczyt ustawień,
2. pierwszą szafkę w pustym pomieszczeniu,
3. kolejną szafkę tworzoną przez sklonowanie konstrukcji poprzednika,
4. pierwszeństwo preferencji pokoju nad trybikiem,
5. fallback globalnych wartości dla stref i zestawów,
6. brak mutacji poprzedniej zapisanej szafki.

`node tools/program-defaults-ui-save-smoke.js` sprawdza dodatkowo dwa kolejne cykle `wybór → Zapisz` bez zamykania widoku ustawień.

Cache-busting: `20260908_program_defaults_apply_fix_v1`.
