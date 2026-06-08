# WYCENA — skomasowane ludzkie szczegóły robocizny szafek v2

Paczka: `site_quote_labor_details_human_readable_v2.zip`

## Zakres

- Jedna szafka tworzy jeden akordeon w modalu `Szczegóły robocizny szafek`.
- Linie dotyczące lewych i prawych drzwiczek są pokazane wewnątrz akordeonu tej samej szafki, a nie jako osobne akordeony.
- Podsumowanie akordeonu pokazuje liczbę czynności, sumę i łączny czas.
- Każda czynność pokazuje czytelne linie: `Dotyczy`, `Czas na 1 sztukę`, `Czas razem`, `Stawka ...`, `Razem`.

## Bez zmian

- Nie zmieniono algorytmów liczenia robocizny.
- Nie zmieniono `quoteCalculationRegister`.
- Nie zmieniono działu CZYNNOŚCI, materiałów, okuć, AGD, szafek ani stawek.
- Zmiana dotyczy wyłącznie sposobu prezentacji już istniejących danych w modalu audytu WYCENY.

## Testy

Rozszerzono `tools/quote-labor-details-human-readable-smoke.js`, żeby pilnował:

- nowego nagłówka i podtytułu,
- braku skrótu `poz.` w podsumowaniu robocizny,
- jednego akordeonu dla jednej szafki mimo osobnych źródeł `Lewe drzwiczki` / `Prawe drzwiczki`,
- widocznego `Czas razem`,
- widocznej stawki i działania `Razem`,
- nowego komunikatu stawki startowej,
- braku `PLN` i technicznego `Fronty z MATERIAŁ/WYCENA` w głównym opisie.
