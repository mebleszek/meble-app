# Hardware dictionary category animation split v1

## Baza

`site_hardware_dictionary_category_expand_animation_v1.zip`

## Zakres

- Naprawiono wspólny panel `Kategorie / rodzaje okuć`, rozdzielając ramkę, warstwę animacji i realną treść.
- `hardware-dictionary-categories-card` trzyma tylko wygląd karty/ramki/chevrona.
- `hardware-dictionary-categories-clip` dostaje tymczasowe `height` i `overflow:hidden` tylko podczas animacji otwierania.
- `hardware-dictionary-categories-content` trzyma prawdziwą listę kategorii i nie dostaje `max-height`, `overflow:hidden` ani starych klas akordeonu ROZRYS.
- Zamykanie panelu pozostaje natychmiastowe, a otwieranie jest płynne.
- Usunięto zdublowane wywołanie `FC.panelBox.open` w modalu słowników okuć.

## Zabezpieczenia

- `tools/app-dev-smoke.js` sprawdza strukturę karta → wrapper animacji → treść.
- Test pilnuje, że nie wraca stare `hardware-dictionary-categories-body`, `hardware-dictionary-section-body`, `rozrys-material-accordion__body`, `details/open` ani selektor `categories-accordion:not([open])`.
- Test sprawdza realne wiersze kategorii, input `Zawiasy`, przycisk `Usuń` i `Dodaj kategorię` po zamknięciu/ponownym otwarciu.

## Poza zakresem

Bez zmian w backupach, storage, import/export Excel, zamiennikach, PRO100, usługach, ROZRYS jako funkcji, RYSUNKU i WYCENIE.
