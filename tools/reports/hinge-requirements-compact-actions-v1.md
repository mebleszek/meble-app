# Skrócony panel wymagań zawiasów w modalu szafki v1

## Cel

Zmniejszyć ilość technicznych pól widocznych od razu przy zwykłej szafce. Panel `Wymagania techniczne do wyceny` ma być miejscem kontroli jednej prawdy, ale w codziennym użyciu ma pokazywać krótki, zrozumiały skrót.

## Zmiany

1. `js/app/cabinet/cabinet-hardware-requirements-panel.js`
   - zastąpiono pełne rzędy cech zawiasów skrótem wymagań,
   - dodano status `Domyślnie` / `Ręcznie`,
   - dodano przyciski `Zmień` i `Przywróć domyślne`,
   - `Zmień` otwiera aplikacyjny overlay wyboru wymagania kompletu zawiasowego przez `FC.rozrysChoice.openRozrysChoiceOverlay`,
   - `Przywróć domyślne` czyści override dla konkretnych drzwiczek przez centralny helper `setHingeDoorOverride(..., { typeId:'' })`.

2. `css/cabinet-common.css`
   - dodano style skrótu, statusu i przycisków,
   - zachowano układ dwudrzwiowy: lewa strona / pionowa kreska / prawa strona.

3. Testy
   - zaktualizowano smoke testy panelu i live edit,
   - testy pilnują obecności skrótu, przycisku `Zmień`, przycisku `Przywróć domyślne` oraz dwóch kolumn dla szafki dwudrzwiowej.

## Celowo nie zrobiono

- Nie rozdzielono jeszcze edycji kąta, prowadnika i hamulca na osobne pola.
- Nie zmieniono resolvera WYCENY.
- Nie zmieniono logiki geometrii frontu dla zawiasów wpuszczanych.
- Nie ruszano prowadnic/szuflad, PCV, ROZRYSU, PRO100, backupów ani import/export Excel okuć.

## Zasada architektoniczna

Skrót w modalu jest tylko widokiem i edycją override. Prawdziwe wymaganie nadal pochodzi z centralnego `cabinet-hardware-requirements`, a WYCENA ma dobierać produkty po tym samym wymaganiu technicznym.
