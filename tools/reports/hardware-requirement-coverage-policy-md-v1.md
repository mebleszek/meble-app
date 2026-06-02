# Zasada pokrycia wymagań okuć przez katalog — MD v1

Data: 2026-06-02  
Paczka: `site_hardware_requirement_coverage_policy_md_v1.zip`

## Cel

Utrwalić w dokumentacji zasadę, że panel `Wymagania techniczne do wyceny` zapisuje wymagania funkcjonalno-techniczne szafki, a nie gotowe produkty katalogowe ani przypadkowo rozbite części katalogowe.

## Zasada główna

Jedna szafka może wymagać jednego kompletnego rozwiązania montażowego, nawet jeśli katalog sprzedaje je jako jedną pozycję albo kilka osobnych składników. Wymaganie techniczne opisuje potrzebę, a resolver WYCENY decyduje, jak tę potrzebę pokryć katalogiem.

## Przykład: zawias + prowadnik

Dla drzwiczek nie należy tworzyć w modalu dwóch niezależnych wymagań `zawias` i `prowadnik`, bo użytkownik nie wybiera produktu. Właściwa jednostka wymagania to `komplet zawiasowy`:

- typ/nakładanie, np. nakładany, wpuszczany, równoległy wpuszczany, lodówkowy nakładany,
- kąt otwarcia,
- wymagany prowadnik,
- hamulec,
- ilość kompletów dla danych drzwiczek.

WYCENA ma później spróbować pokryć to wymaganie:

1. gotowym kompletem katalogowym `zawias + prowadnik`,
2. albo osobnymi pozycjami katalogowymi `zawias` i `prowadnik`, jeśli komplet nie istnieje.

Jeżeli nie da się dobrać któregoś składnika, audyt WYCENY ma pokazać brak pokrycia wymagania. Nie wolno cicho zastępować tego ogólną nazwą typu `zawiasy Blum`.

## Zasada dla przyszłych okuć

Ten sam model obowiązuje przyszłe kategorie:

- prowadnice i szuflady,
- podnośniki,
- cargo,
- systemy narożne,
- pantografy,
- profile LED,
- drążki,
- relingi i inne akcesoria.

Panel szafki zapisuje wymaganie i cechy. Katalog może pokrywać wymaganie kompletem albo składnikami.

## Opcje wyboru w panelu

Opcje wyboru wymagań nie mogą być wpisaną na sztywno listą presetów. Mają pochodzić z danych systemu:

- słowników i kategorii okuć,
- katalogu akcesoriów,
- parametrów technicznych pozycji katalogowych,
- z deduplikacją po cechach, bez producenta/modelu/symbolu w panelu szafki.

## Zakres tej paczki

Ta paczka zapisuje zasadę w MD i podbija wersjonowanie/cache-busting. Nie zmienia jeszcze runtime wyboru zawiasów ani resolvera WYCENY. Następna poprawka powinna usunąć statyczne presety zawiasów i budować listę wyboru z danych systemu.
