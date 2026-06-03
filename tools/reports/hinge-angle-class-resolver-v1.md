# Zawiasy: kąt rzeczywisty i klasa zamienności kąta v1

## Paczka
`site_hinge_angle_class_resolver_v1.zip`

## Problem
Jedno pole `kat_otwarcia` mieszało rzeczywisty kąt produktu z zakresem zamienności. To powodowało dwie skrajności:
- zbyt szerokie dobieranie, np. 170° jako zamiennik 110°;
- ryzyko zbyt ścisłego dobierania, gdzie 107°/110° z tej samej grupy standardowej nie działałyby jako zamienniki.

## Zmiana
Dodano w technicznych danych zawiasów rozdział:
- `kat_rzeczywisty` — nominalny/rzeczywisty kąt konkretnego zawiasu;
- `klasa_kata` — słownikowa klasa zamienności, np. `standardowy 90–120°`.

Stare `kat_otwarcia` działa jako legacy: program używa go do wypełnienia `kat_rzeczywisty` i wyliczenia klasy, jeśli nowej klasy jeszcze nie ma.

## Dobór w WYCENIE
Resolver porównuje cechy łącznie:
- nałożenie,
- klasę zamienności kąta,
- prowadnik/montaż,
- hamulec/domyk,
- sprężynę,
- pozostałe kluczowe parametry techniczne.

Kąt rzeczywisty jest rankingiem w obrębie tej samej klasy:
1. najpierw dokładny kąt,
2. potem najbliższy kąt w tej samej klasie,
3. nigdy poza klasą funkcjonalną.

## Przykłady
- Wymaganie 110° nakładany + klasa `standardowy 90–120°` może dobrać GTV 107° z tą samą klasą i cechami.
- Wymaganie 110° nakładany nie może dobrać 170° narożnego, bo to inna klasa kąta i inna funkcja zawiasu.

## Test
`tools/wycena-hinge-requirement-override-smoke.js`

## Cache-busting
`20260603_hinge_angle_class_resolver_v1`
