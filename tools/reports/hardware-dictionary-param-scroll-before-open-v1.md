# Hardware dictionary param scroll before open v1

## Baza

- Start: `site_hardware_dictionary_param_scroll_target_v1.zip`
- Zakres: mikro-poprawka UI/UX w `Słowniki okuć → Parametry techniczne kategorii`.

## Problem

Przy klikaniu parametru z dołu listy poprzednia wersja rozwijała nowy parametr i zwijała poprzedni przed lub w trakcie doscrollowania. Jeżeli poprzedni otwarty parametr był wysoki, układ zmieniał wysokość na starcie ruchu i użytkownik widział szarpnięcie albo nieczytelny przeskok.

## Zmiana

- Kliknięcie zwiniętego parametru przejmuje domyślny `summary` toggle.
- Najpierw wykonywany jest płynny scroll do nagłówka klikniętego, nadal zwiniętego parametru.
- Po `scrollend` albo po bezpiecznym fallback timeout następuje dopiero zamknięcie poprzedniego parametru i otwarcie klikniętego.
- Po zmianie `open` pozycja aktywnego nagłówka jest korygowana, żeby zwinięcie długiego bloku powyżej nie wyrzuciło nagłówka z początku widoku.
- Dodano sekwencję `paramOpenSequence`, żeby szybkie kolejne kliknięcia nie odpalały przestarzałej animacji po czasie.

## Ograniczenia

- Nie zmieniono modelu danych parametrów technicznych.
- Nie zmieniono backupu, storage, import/export Excel, zamienników ani działania katalogu okuć.
- Nie dodano natywnych selectów ani systemowych dialogów.

## Testy

- `node --check js/app/material/price-modal-hardware-dictionaries.js`
- `node --check tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- Pełny zestaw audytów przed wydaniem paczki.
