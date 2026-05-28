# pricing-labor-manual-accordion-v1

## Baza

- Start: `site_pricing_labor_unified_picker_v1.zip`.
- Zakres: poprawka umiejscowienia i uruchamiania ręcznych czynności robocizny w WYCENIE.

## Zmiany

1. Ręczne czynności do WYCENY zostały wyjęte z `Ustawienia oferty do nowej wyceny`.
2. Dodano osobny akordeon `Czynności ręczne do wyceny`, renderowany nad akordeonem opcji oferty.
3. Przycisk `Dodaj czynność` działa z tego osobnego akordeonu i otwiera aplikacyjny picker robocizny.
4. Picker robocizny dostał jawne `display:flex` i wyższy `z-index`, bo wcześniej dziedziczył `.modal-back{display:none}` i mógł zostać dodany do DOM bez widocznego okna.
5. Dodano moduł `js/app/wycena/wycena-tab-manual-labor.js`, żeby ręczne czynności nie wracały do edytora opcji oferty.
6. Rozszerzono stan WYCENY o `manualLaborOpen`, domyślnie otwarty, żeby sekcja była widoczna nad opcjami.
7. Dodatkowy smoke kontrakt pilnuje, że ręczne czynności WYCENY mają osobny akordeon.

## Bez zmian

- Nie zmieniono modelu robocizny.
- Nie zmieniono katalogu stawek.
- Nie zmieniono automatycznych czynności szafek.
- Nie zmieniono PDF klienta.
- Nie ruszano RYSUNKU, statusów/ofert ani backupów.
