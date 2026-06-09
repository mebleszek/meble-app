# labor-conditions-cascade-fields-v1

## Cel

Poprawa sekcji `Warunki zastosowania` w formularzu `Stawki wyceny mebli` po zgłoszeniu, że poprzednia paczka pokazywała martwy komunikat `Brak warunków` i nie dawała miejsca na wpisanie zakresów `od/do`.

## Zmiana

- Usunięto osobny launcher/przycisk `Dodaj warunek` z sekcji warunków.
- Sekcja renderuje pierwszy pusty wybór warunku od razu.
- Po wyborze warunku pokazuje pola `Minimum / od` i `Maksimum / do`.
- Po wyborze każdego warunku automatycznie pojawia się kolejny pusty wybór.
- Ostatni pusty wybór nie zapisuje się do `conditions`.
- Wybrany warunek bez minimum i maksimum blokuje zapis pozycji.
- Zmieniono pustą etykietę opcji z `Dodaj warunek` na `Wybierz wartość warunku`.

## Zakres

Nie ruszano modala szafki, WYWIADU, plusa dodawania szafki, kreatora korpusów, materiałów, okuć ani AGD.
