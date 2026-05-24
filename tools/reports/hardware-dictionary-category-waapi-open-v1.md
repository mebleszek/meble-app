# Hardware dictionary category WAAPI open v1 — 2026-05-24

## Cel

Ostatnia próba animacji panelu `Kategorie / rodzaje okuć` miała zachować działającą zawartość z `site_hardware_dictionary_category_stable_panel_v1.zip`, ale dodać widoczne otwieranie bez animowania `height:auto`.

## Zakres

- Baza: `site_hardware_dictionary_category_stable_panel_v1.zip`.
- Dotknięto tylko panelu `Kategorie / rodzaje okuć` w słownikach okuć.
- Nie użyto późniejszych popsutych wersji z grid/interpolate/wrapperami clipującymi.
- Zamykanie panelu pozostaje natychmiastowe.
- Otwieranie używa realnie zmierzonej wysokości `categoriesBody.scrollHeight` i Web Animations API: `0px -> <zmierzona wysokość>px`.
- Po zakończeniu animacji style inline są czyszczone, więc body wraca do normalnego przepływu i nie zostaje z przyciętą wysokością.

## Ważne ograniczenie

CSS dla realnego body kategorii nie może mieć `height:auto!important`, `overflow:visible!important` ani `transition:none!important`, bo takie reguły blokują animację wysokości. Zostają zwykłe wartości bez `!important`, a klasa `hardware-categories-opening` tymczasowo ustawia `overflow:hidden` tylko podczas otwierania.

## Poza zakresem

Bez zmian w danych, storage, backupie, imporcie/eksporcie, PRO100, usługach, RYSUNKU, ROZRYS, WYCENIE i zamiennikach.
