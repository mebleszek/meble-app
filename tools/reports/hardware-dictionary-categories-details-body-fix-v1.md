# Hardware dictionary categories details body fix v1

Baza: `site_hardware_dictionary_category_frame_restore_v1.zip`.

## Cel

Naprawić regresję w modalu `Słowniki okuć`, gdzie wspólny akordeon `Kategorie / rodzaje okuć` po rozwinięciu pokazywał tylko ucięty początek pierwszej karty kategorii zamiast pełnej listy kategorii.

## Diagnoza

Poprzednie poprawki próbowały jednocześnie zachować ramkę ROZRYS i ręcznie sterować widocznością body akordeonu. Na telefonie kombinacja zewnętrznego `overflow:hidden`, ręcznego `hidden/max-height` i dedykowanego body powodowała wizualne przycięcie zawartości. Testy widziały elementy w DOM, ale nie pilnowały stabilnej mechaniki akordeonu.

## Zmiana

- Wspólny akordeon kategorii wrócił do mechaniki `details/summary`, tak jak techniczne akordeony kategorii w tym samym ekranie.
- Wygląd pozostał aplikacyjny/ROZRYS: karta, ramka, cień, chevron.
- Body kategorii jest zwykłą zawartością w przepływie dokumentu: `rozrys-material-accordion__body hardware-dictionary-section-body hardware-dictionary-categories-body`.
- Kliknięcie summary jest kontrolowane przez JS (`preventDefault`), żeby stan `open`, `is-open` i `aria-expanded` był spójny.
- CSS wymusza brak `max-height` i brak animowania wysokości dla `hardware-dictionary-categories-body`, żeby lista kategorii nie była ucinana.

## Testy

`tools/app-dev-smoke.js` został skorygowany tak, żeby pilnować:

- wspólny akordeon kategorii używa `details` z `open`,
- body ma stabilną klasę `hardware-dictionary-categories-body`,
- nie wraca stare dedykowane body `hardware-dictionary-category-section-body`,
- są realne wiersze kategorii, input `Zawiasy`, przycisk `Usuń` i `Dodaj kategorię`,
- zamknięcie i ponowne otwarcie akordeonu zachowuje treść.

## Poza zakresem

Bez zmian w danych, storage, backupie, imporcie/eksporcie Excel, PRO100, usługach, ROZRYS jako funkcji, RYSUNKU, WYCENIE i silniku zamienników.
