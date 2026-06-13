# Wnoszenie i winda v1 — 2026-06-13

Paczka `site_carrying_lift_logistics_v1.zip` dodaje wewnętrzny automat wnoszenia korpusów do WYCENY/CZYNNOŚCI bez przebudowy transportu, oferty klienta ani PDF.

## Zakres

- Dane inwestora dostały sekcję **Dostawa / wnoszenie** z piętrem oraz informacją o windzie.
- W edycji inwestora można ustawić `Jest winda` albo `Brak windy` jednym z dwóch aplikacyjnych przycisków. Nie użyto natywnego selecta ani systemowego pickera.
- Przy windzie można podać szerokość/wysokość drzwi, szerokość/głębokość/wysokość kabiny, udźwig i notatkę.
- Gdy windy brak, pola wymiarów są nieaktywne i wyszarzone.
- Dodano moduł `FC.carryingLogistics` (`js/app/pricing/carrying-logistics.js`).
- Dodano moduł `FC.investorCarrying` (`js/app/investor/investor-carrying.js`).

## Reguły liczenia

- Piętro rzeczywiste inwestora jest tylko danymi wejściowymi. Do kalkulacji idzie wynik `carrying.floor_units` dla konkretnego korpusu.
- Brak windy: parter = 1 poziom, 1 piętro = 2 poziomy, 2 piętro = 3 poziomy itd.
- Jest winda i korpus się mieści: program liczy 2 poziomy.
- Jest winda, ale korpus nie mieści się: program liczy jak schody.
- Korpus mieści się do windy, gdy dowolna para wymiarów przechodzi przez drzwi, a trzeci wymiar mieści się w głębokości kabiny. Jeżeli podano szerokość i wysokość kabiny, orientacja musi mieścić się także w tych wymiarach.
- Waga do decyzji logistycznej dotyczy tylko korpusu, bez frontów, półek luźnych, blend, cokołów i okuć.
- Do 20 kg: `carrying.people_count = 1`.
- Powyżej 20 kg: `carrying.people_count = 2`.
- Powyżej 45 kg na schodach: `carrying.requires_disassembly = true`.

## Cennik robocizny

Dodano dwie domyślne pozycje w katalogu robocizny/usług:

1. `labor_carrying_cabinet` — **Wnoszenie korpusu**
   - kategoria: Transport i logistyka,
   - stawka: Pomocnika,
   - wzór: `15 min + 5 min × carrying.floor_units`,
   - koszt mnożony przez `carrying.people_count`.

2. `labor_carrying_disassembly` — **Rozkręcenie i ponowne skręcenie korpusu**
   - kategoria: Transport i logistyka,
   - stawka: Montażowa,
   - czas: 1 h,
   - aktywne tylko, gdy `carrying.requires_disassembly = true`.

## Widoczność

- Wynik wnoszenia pojawia się w **CZYNNOŚCI → Czynności szafek** przy konkretnym korpusie.
- WYCENA otrzymuje te same automatyczne linie robocizny.
- Audyt opisuje wymiary, wagę korpusu, dopasowanie windy, poziomy, liczbę pomocników, wzór czasu i ewentualne rozkręcenie.
- Oferta klienta i PDF nie zostały przebudowane.

## Testy

Dodano `tools/carrying-lift-logistics-smoke.js`, który sprawdza:

- dopasowanie korpusu do windy według pary wymiarów i głębokości kabiny,
- brak windy i liczenie poziomów schodowych,
- wagę korpusu z formatek konstrukcyjnych bez frontów/półek/blend,
- fakty `cabinet.weight_kg`, `carrying.floor_units`, `carrying.people_count`, `carrying.requires_disassembly`, `carrying.lift_fits`,
- domyślne pozycje cennika robocizny,
- wynik robocizny w `FC.wycenaCoreLabor`, w tym mnożnik pomocników i 1 h rozkręcenia,
- load order i cache-busting nowych modułów.
