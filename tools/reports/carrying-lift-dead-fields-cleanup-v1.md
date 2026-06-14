# carrying-lift-dead-fields-cleanup-v1

Poprawka porządkowa po `site_carrying_disassembled_elements_v2.zip`.

## Zmiana

- usunięto z normalizacji i zapisu danych inwestora nieużywane pola windy: `elevator.cabinWidthCm` oraz `elevator.capacityKg`,
- kalkulator wnoszenia nie zwraca już tych pól w `normalizeCarrying`,
- UI nadal pokazuje tylko praktyczne pola: szerokość/wysokość drzwi windy, głębokość windy, wysokość windy,
- dokumentacja chmurowa opisuje tylko aktywny model danych.

## Cel

Nie zostawiać martwych pól jako pozornie wspieranych danych, skoro v2 ich nie używa do decyzji logistycznych.
