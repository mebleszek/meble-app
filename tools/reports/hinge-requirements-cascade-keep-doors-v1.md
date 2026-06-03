# Kaskadowy wybór wymagań zawiasów i utrzymanie stron drzwiczek v1

Paczka: `site_hinge_requirements_cascade_keep_doors_v1.zip`  
Data: 2026-06-03

## Cel

Uprościć wybór wymagań zawiasów w modalu szafki, żeby prosta szafka nie zamieniała się w długą techniczną listę, a jednocześnie zachować pełną kontrolę nad cechami wymagań technicznych.

## Zasady

1. Modal szafki nie wybiera producenta, modelu ani symbolu katalogowego.
2. Modal szafki wybiera wyłącznie wymaganie techniczne `komplet zawiasowy`.
3. Wymaganie opisuje cechy: typ/nakładanie, kąt otwarcia, prowadnik, hamulec/domyk oraz ilość kompletów wynikającą z konkretnej szafki.
4. Lista wyboru nie może być jedną długą listą produktów ani wariantów z ilością `0 kpl.`.
5. Wybór ręczny odbywa się kaskadowo: typ/nakładanie → kąt otwarcia → prowadnik → hamulec/domyk.
6. Warianty są budowane z katalogu okuć i parametrów technicznych, z deduplikacją po sygnaturze technicznej.
7. Aktualny override nie może zawężać pełnej puli wyboru. Po wybraniu wariantu specjalnego można wrócić do standardowego wariantu, jeśli jest w systemie.
8. Dla dwóch drzwiczek wymagania lewej i prawej strony zostają rozdzielone. Zmiana jednej strony nie może zwijać panelu do jednego bloku.

## Zmienione pliki runtime

- `js/app/cabinet/cabinet-hardware-requirements-panel.js`
- `js/app/cabinet/cabinet-hardware-requirement-options.js`

## Zmienione testy

- `tools/cabinet-hardware-requirements-live-edit-smoke.js`
- test sprawdza, że po override jednej strony nadal widoczne są lewe i prawe drzwiczki,
- test sprawdza, że lista wariantów nie pokazuje `ilość: 0 kpl.`,
- test sprawdza kaskadowy wybór: `nakładany → 110° → standardowy → hamulec tak`.

## Nie zmieniono

- PRO100,
- ROZRYS,
- PCV/obrzeży,
- import/export Excel okuć,
- backupów,
- panelu kategorii,
- prowadnic/szuflad,
- geometrii frontu dla zawiasów wpuszczanych.
