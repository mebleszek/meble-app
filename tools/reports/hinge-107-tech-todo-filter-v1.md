# Zawias 107° jako zamiennik 110° + filtr danych technicznych v1

## Paczka
`site_hinge_107_tech_todo_filter_v1.zip`

## Problem
GTV 107° z klasą `standardowy 90–120°` nie był dobierany zamiast Bluma 110° przy preferencji producenta GTV, bo bezpośrednie źródła opcji katalogowej mogły blokować szersze dopasowanie po tej samej klasie funkcjonalnej.

Drugi problem: użytkownik nie miał szybkiego sposobu znalezienia okuć z brakującymi lub niepełnymi parametrami technicznymi, mimo że takie pozycje nie mogą bezpiecznie brać udziału w automatycznym doborze.

## Zmiana
- WYCENA najpierw szuka poprawnego kandydata od producenta wskazanego w WYWIADZIE.
- `sourceItemIds` są pomocą, ale nie blokują preferowanego producenta, jeżeli kandydat ma komplet danych technicznych i pasuje po cechach.
- Kanoniczne warianty zawiasów grupują po funkcji/klasie, nie po dokładnym kącie rzeczywistym.
- Dodano `evaluateItemTechnicalStatus` do centralnej logiki parametrów technicznych.
- Dodano jeden filtr katalogu: `Do uzupełnienia tech.`.
- Dodano czerwony chip i komunikat w edycji pozycji z listą brakujących parametrów.

## Zasada
Brak lub niepełność danych technicznych są traktowane tak samo: pozycja wymaga uzupełnienia i nie może być automatycznie dobrana w WYCENIE jako pasujące okucie.

## Testy
- `tools/wycena-hinge-requirement-override-smoke.js`
- `tools/hardware-technical-completeness-smoke.js`
- `tools/hardware-accessories-dev-smoke.js`

## Cache-busting
`20260604_hinge_107_tech_todo_filter_v1`
