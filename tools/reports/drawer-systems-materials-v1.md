# Szuflady — systemy/preferencje i formatki skrzynkowe v1

## Zakres

- Preferencje pomieszczenia dla `Szuflady / prowadnice` przechowują teraz konkretny system/model, a nie tylko producenta.
- Wspierane opcje startowe: `Skrzynkowe — same prowadnice`, `Blum TANDEMBOX Antaro`, `Blum LEGRABOX`, `Blum MERIVOBOX`, `GTV Axis Pro`, `Rejs — system szuflady`.
- Szuflady skrzynkowe generują wymaganie prowadnic oraz osobną podgrupę materiałową `Szuflady skrzynkowe` w MATERIAŁACH.
- Dla skrzynkowych formatki konstrukcyjne są liczone jako płyta 18 mm, a dno jako osobny materiał `Dno szuflad 10 mm`.
- Szuflady systemowe zapisują wymaganie katalogowe systemu, ale nie są liczone jak skrzynkowe; formatki systemowe będą dopinane później według specyfikacji producenta.

## Świadome ograniczenia

- Ten etap nie uzupełnia jeszcze pełnych tabel technicznych producentów dla systemowych szuflad.
- Ten etap nie dodaje nowych cen do katalogu okuć. WYCENA nadal dobiera konkretną pozycję z istniejącego katalogu albo pokazuje brak ceny.
- Nie ruszano cargo, podnośników, ORS, PCV poza flagą `pcvEligible:false` dla dna 10 mm, PDF, transportu ani wnoszenia.
