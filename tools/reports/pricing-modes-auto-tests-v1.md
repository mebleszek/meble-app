# 2026-06-12 — Automatyczny test trybów naliczania ceny v1

Paczka: `site_pricing_modes_auto_tests_v1.zip`.

Zakres zmiany jest testowy i dokumentacyjny. Nie zmieniono UI, formularzy, logiki transportu, stawek godzinowych ani WYCENY. Dodano osobny test Node `tools/pricing-modes-calculation-coverage-smoke.js`, który sprawdza fundament nowego cennika robocizny i usług bez ręcznego klikania wielu konfiguracji szafek.

Test obejmuje:
- obecność sposobów naliczania ceny i zależnych pól formularza,
- brak wyboru 45 min i obecność 5 min,
- kwotę stałą,
- cenę za ilość,
- kwotę startową + cenę za ilość,
- kwotę startową z kilometrami w cenie startowej,
- czas × stawkę godzinową,
- własną stawkę godzinową dodaną w trybiku,
- progi czasu,
- czas startowy + kolejne sztuki,
- tryb zaawansowany z dopłatą zł za gabaryt,
- tryb zaawansowany z gabarytoczasem h/m³ i wyłączeniem dopłaty zł za gabaryt,
- normalizację starego zapisu 45 min w cenniku do 60 min,
- pozostawienie wyniku `3 × 15 min = 45 min` jako poprawnego wyniku mnożenia,
- automatyczną linię transportu z Inwestora w WYCENIE,
- audyt transportu `start + max(0, km - km w cenie) × cena/km`,
- grupowanie rejestru WYCENY: `transport`, `quoteRates` jako Usługi dodatkowe i `labor` jako Robocizna szafek.

Cache-busting: `20260612_pricing_modes_auto_tests_v1`.
