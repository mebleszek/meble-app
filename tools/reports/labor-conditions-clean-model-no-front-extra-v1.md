# labor-conditions-clean-model-no-front-extra-v1

## Cel

Korekta po uwadze użytkownika: usunąć nadmiarowe warunki frontów dodane bez zlecenia.

## Zmiana

- Usunięto aktywne źródła warunków `front.max_width_mm` i `front.max_height_mm` z `FC.workQuantitySources`.
- Usunięto kalkulatory faktów dla `front.max_width_mm` i `front.max_height_mm` z `FC.workQuantityFacts`.
- Test warunków pilnuje teraz, że te dwa źródła nie są aktywne bez osobnego etapu.
- Model warunku nadal jest uniwersalny: `source + operator + min + max`.

## Zakres nieruszany

Nie ruszano WYWIADU, modala szafki, plusa dodawania szafki, kreatora korpusów, materiałów, okuć ani AGD.
