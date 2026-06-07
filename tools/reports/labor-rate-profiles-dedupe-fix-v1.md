# Robocizna — deduplikacja profili stawek godzinowych v1

## Problem
Po etapie `site_labor_rate_profiles_foundation_v1.zip` cennik mógł pokazać zdublowane stawki godzinowe. Przyczyną było to, że nowe systemowe profile stawek były dodawane po ID (`labor_rate_assembly`, `labor_rate_specialist`), ale w danych użytkownika mogły istnieć stare wiersze `quoteRates` z tym samym kodem technicznym stawki i innym ID.

Przykład regresji widoczny w UI:

- `Stawka montażowa` `assembly` 150 zł/h,
- `Stawka montażowa` `assembly` 250 zł/h,
- `Stawka specjalistyczna` `specialist` 250 zł/h,
- `Stawka specjalistyczna` `specialist` 300 zł/h.

## Naprawa

- Dodano deduplikację stawek godzinowych po technicznym kodzie profilu (`rateKey`/`rateCode`/`rateType`).
- Dla systemowych kodów zostaje jeden kanoniczny rekord `labor_rate_<code>`.
- Przy konflikcie ze starymi błędnymi duplikatami systemowe ceny startowe wracają do wartości: `workshop=150`, `assembly=250`, `specialist=300`, `helper=80`.
- `catalogStore.savePriceList('quoteRates', ...)` normalizuje i deduplikuje listę także przy zapisie z UI.

## Bez zmian

- Nie przebudowano WYCENY.
- Nie przebudowano działu CZYNNOŚCI.
- Nie zmieniono zasad wyboru stawki przy czynności.
- Nie przypisano na sztywno, kto wykonuje daną czynność.
- Własne stawki użytkownika pozostają dodawalne po unikalnym kodzie technicznym.

## Testy

Rozszerzono `tools/labor-rate-profiles-foundation-smoke.js` o scenariusz zdublowanych, błędnych stawek systemowych.
