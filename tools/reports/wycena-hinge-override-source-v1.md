# WYCENA bierze ręczne wymagania zawiasów z jednej prawdy v1

## Paczka
`site_wycena_hinge_override_source_v1.zip`

## Problem
Po zmianie wymagań zawiasu w modalu szafki kolejna WYCENA mogła nadal dawać tę samą cenę, bo ścieżka WYCENY była za mocno zależna od pośrednich pozycji cutlisty/opisów zamiast od centralnego wymagania technicznego szafki.

## Zmiana
- `collectAccessories()` dla zawiasów pobiera aktualne wymagania przez `FC.cabinetHardwareRequirements.getHingeRequirementsWithQty(room, cabinet)`.
- Hinge rows z cutlisty są pomijane, jeśli centralne wymagania są dostępne, żeby nie było drugiego źródła prawdy.
- Resolver okuć najpierw sprawdza `catalogOptionSourceItemIds` zapisane w wymaganiu katalogowym i dopiero potem przechodzi do porównania parametrów/fallbacków.
- Jeżeli wymaganie wskazuje kilka pozycji o tych samych cechach, preferowany jest producent z WYWIADU, a jeśli go brak — sensowny kandydat z kompletem/ceną.

## Efekt
Zmiana typu zawiasu w panelu wymagań, np. standardowy 110° → równoległy wpuszczany, powinna zmienić linie akcesoriów i cenę WYCENY, o ile wybrane pozycje katalogowe mają różne ceny.

## Test
`tools/wycena-hinge-requirement-override-smoke.js`

Test celowo podstawia stale cutlistę z domyślnym zawiasem 110°, a mimo to wymaga, żeby WYCENA wzięła aktualny override z centralnego helpera szafki.

## Cache-busting
`20260603_wycena_hinge_override_source_v1`
