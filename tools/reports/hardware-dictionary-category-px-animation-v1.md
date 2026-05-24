# hardware-dictionary-category-px-animation-v1

Baza: `site_hardware_dictionary_category_stable_panel_v1.zip`.

## Cel

Przywrócić działającą, pełną zawartość panelu `Kategorie / rodzaje okuć` i sprawdzić bezpieczniejszą animację otwierania opartą o realnie zmierzoną wysokość w pikselach.

## Zakres

- Dodano wrapper `hardware-dictionary-categories-clip` między kartą a prawdziwą zawartością.
- `hardware-dictionary-categories-body` pozostaje zwykłą treścią bez clipowania i bez ukrywania.
- Otwieranie mierzy `categoriesBody.scrollHeight` i animuje tylko wrapper z `height:0px` do wyliczonej wartości px.
- Po animacji wrapper czyści style i wraca do zwykłego przepływu.
- Zamykanie jest natychmiastowe.

## Czego celowo nie użyto

- `details/open` dla tej sekcji.
- `rozrys-material-accordion__body` dla prawdziwej listy kategorii.
- CSS Grid `0fr -> 1fr`.
- `interpolate-size`.
- Stałego `max-height`.
- Animowania lub clipowania prawdziwego body kategorii.

## Testy

Zaktualizowano `tools/app-dev-smoke.js`, żeby pilnował struktury: karta, wrapper animacji px, prawdziwe body, pełna treść po zamknięciu i ponownym otwarciu.

## Poza zakresem

Bez zmian backupu, storage, import/export Excel, zamienników, PRO100, usług, RYSUNKU i WYCENY.
