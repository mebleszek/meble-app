# Wnoszenie wysokich frontów v1

Paczka `site_carrying_high_fronts_v1.zip` rozszerza kalkulator wnoszenia o wysokie fronty powyżej 2 m.

## Zakres

- Wysokie fronty (`> 200 cm` po dłuższym wymiarze) są traktowane jako osobne elementy logistyczne.
- Fronty są odczytywane z centralnych helperów frontów używanych przez MATERIAŁ/WYCENĘ, z fallbackiem do cutlisty szafki.
- Fronty są sprawdzane tym samym helperem płaskich elementów co boki po rozkręceniu:
  - przejście przez drzwi windy wprost,
  - przejście przez przekątną drzwi,
  - wejście do windy po głębokości,
  - wejście po przekątnej kabiny `wysokość × głębokość` tylko wtedy, gdy drugi wymiar frontu mieści się w szerokości drzwi windy.
- Jeżeli wysoki front mieści się w windzie, dostaje osobną linię wnoszenia jako `2 poziomy`.
- Jeżeli wysoki front nie mieści się w windzie albo windy brak, dostaje osobną linię wnoszenia po schodach według `piętro + 1`.
- Wnoszenie wysokich frontów korzysta z tej samej pozycji cennika `labor_carrying_cabinet`, ale w WYCENIE/CZYNNOŚCIACH ma własny komponent audytu `carrying-high-front-labor`.

## Nie zmieniono

Nie zmieniono ORS, transportu km, oferty klienta, PDF, PCV, kosztów firmy, `drawer.count`, automatów AGD ani wymagań technicznych szafek.
