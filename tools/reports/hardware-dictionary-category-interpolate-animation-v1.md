# Hardware dictionary category interpolate animation v1

## Baza

- `site_hardware_dictionary_category_grid_animation_v1.zip`

## Problem

CSS Grid `grid-template-rows:0fr → 1fr` dawał ładną animację, ale na telefonie panel `Kategorie / rodzaje okuć` nadal pokazywał tylko górny fragment pierwszej karty kategorii. W praktyce realna lista była w DOM, ale warstwa grid/inner dalej clipowała zawartość.

## Rozwiązanie

- Zostawiono rozdzielone warstwy: karta, wrapper animacji, inner i realna treść.
- Usunięto gridową animację `0fr/1fr`.
- Wrapper `hardware-dictionary-categories-clip` używa `height:0 → height:auto` z `interpolate-size:allow-keywords`.
- W przeglądarkach bez wsparcia `interpolate-size` panel otwiera się bez płynnego liczenia wysokości, ale ma pokazywać pełną zawartość.
- Realna treść `hardware-dictionary-categories-content` nie dostaje `overflow:hidden`, `max-height`, `details/open` ani starych klas body ROZRYS.
- Zamykanie panelu pozostaje natychmiastowe przez klasę `hardware-categories-closing`.

## Testy

- `tools/app-dev-smoke.js` sprawdza metodę `interpolate-size`, brak `grid-template-rows:0fr/1fr`, brak starych klas body i obecność realnych wierszy kategorii po zamknięciu/ponownym otwarciu.

## Poza zakresem

Bez zmian backupu, storage, import/export Excel, zamienników, PRO100, usług, ROZRYS jako funkcji, RYSUNKU, WYCENY i modelu danych.
