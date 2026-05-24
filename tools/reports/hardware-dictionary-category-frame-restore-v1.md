# hardware dictionary category frame restore v1

Baza: `site_hardware_dictionary_category_no_clip_v1.zip`.

## Cel

Poprawić wizualną regresję wspólnego akordeonu `Kategorie / rodzaje okuć` w słownikach okuć: po poprzedniej próbie obejścia clipowania zewnętrzna ramka straciła jednolite zaokrąglenia i wyglądała jak rozdzielona karta.

## Zmiany

- Zewnętrzny akordeon kategorii zachowuje wygląd ROZRYS: jedna ramka, jeden cień, spójne zaokrąglone rogi.
- Zewnętrzny akordeon kategorii wraca do `overflow:hidden`, żeby ramka nie rozchodziła się na narożnikach.
- Zawartość listy kategorii siedzi w dedykowanym `hardware-dictionary-category-section-body`.
- Body kategorii nie używa już `hardware-dictionary-section-body` ani `rozrys-material-accordion__body`, żeby nie dziedziczyć animowanego `max-height`.
- Body kategorii ma pełną wysokość zawartości i nie ma animacji wysokości; tylko mini-akordeony parametrów technicznych zachowują płynne rozwijanie.

## Testy

- `tools/app-dev-smoke.js` pilnuje, że kategorie renderują realne wiersze, input `Zawiasy`, `Usuń` i `Dodaj kategorię` po zamknięciu i ponownym otwarciu.
- Test dodatkowo blokuje powrót problematycznej klasy `hardware-dictionary-section-body` przy body kategorii.
- Test sprawdza, że zewnętrzny akordeon kategorii ma kontrolowane `overflow:hidden`, a nie poprzednie `overflow:visible`, które psuło ramkę.

## Poza zakresem

Bez zmian w storage, backupach, import/export Excel, zamiennikach, PRO100, usługach, ROZRYS jako funkcji, RYSUNKU i WYCENIE.
