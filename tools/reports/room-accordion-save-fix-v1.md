# room accordion save fix v1

## Cel

Poprawka regresji po `site_hardware_producer_preferences_v1.zip`:

- po wyborze producenta okuć i kliknięciu zapisu wartość nie może znikać z launchera,
- akordeon `Parametry pomieszczenia` ma mieć taki sam zielony przycisk zapisu jak pozostałe akordeony WYWIADU,
- przyciski zapisu w akordeonach mają korzystać ze wspólnego helpera zamiast dublować osobną konstrukcję w każdym module.

## Zmiany

1. Dodano `js/app/ui/wywiad-room-accordion-actions.js`.
   - Udostępnia `FC.wywiadRoomAccordionActions.createSaveFooter()`.
   - Tworzy zielony przycisk `Zapisz zmiany` i opcjonalne przyciski po lewej stronie, np. `Zastosuj do istniejących szafek`.

2. `Parametry pomieszczenia`:
   - pola w akordeonie działają teraz na podglądzie roboczym,
   - zmiana pola odświeża auto-wysokość,
   - zapis następuje po kliknięciu `Zapisz zmiany`, tak jak w pozostałych akordeonach.

3. `Preferencje producentów okuć`:
   - przycisk zmieniono na `Zapisz zmiany`, korzystający ze wspólnego helpera,
   - wybór producenta nadal odbywa się tylko przez launcher aplikacyjny z istniejących producentów katalogu,
   - normalizacja producenta nie czyści już wartości, gdy lista producentów chwilowo nie jest dostępna przy przebudowie widoku.

4. `Preferencje materiałów i kolorów`:
   - stopka zapisu korzysta z tego samego helpera,
   - zachowano przycisk `Zastosuj do istniejących szafek`.

## Nietknięte obszary

- panel `Kategorie / rodzaje okuć`,
- animacje panelu kategorii,
- backupy i retencja,
- import/export Excel,
- PRO100 i usługi stolarskie,
- ROZRYS, RYSUNEK,
- pełny resolver katalogu okuć do wyceny.
