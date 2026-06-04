# Help registry audit v1 — 2026-06-04

## Co zrobiono
- dodano centralny `help-registry` do helperów `?`,
- przepięto formularz cennika, techniczne pola okuć, słowniki okuć, wybrane helpery ROZRYS, WYCENY i ustawień danych,
- poprawiono mylący opis w `Słownikach okuć` dla pola `Kategoria / rodzaj okucia`,
- nowe przyciski `?` dostają `data-help-key`.

## Cel techniczny
Każdy helper tworzony przez wspólny kod ma teraz centralny klucz i może być później audytowany jednym miejscem.

## Uwaga
Starsze helpery budowane całkowicie ręcznie poza wspólnymi helperami nadal mogą wymagać kolejnych drobnych migracji, ale główne ścieżki obsługujące ikony `?` są już spięte z centralnym rejestrem.
