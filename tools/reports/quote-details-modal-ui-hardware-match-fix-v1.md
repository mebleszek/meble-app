# quote-details-modal-ui-hardware-match-fix-v1

## Cel

Poprawka po testach użytkownika dla etapu rejestru wyliczeń WYCENY. Zakres: czytelność modali szczegółów, przypisanie ostrzeżeń do działów, startowe PCV zamiast ABS oraz lepsze rozpoznawanie konkretnych okuć z katalogu na podstawie `hardwareRequirement`.

## Zmiany

- Modal szczegółów ma własny scroll, stałą stopkę i akordeony zwijające inne otwarte działy.
- Ostrzeżenia są filtrowane według działu; pełny zbiorczy audyt zostaje w widoku `Razem`.
- Startowa pozycja obrzeża w materiałach to `Obrzeże PCV standard`; usunięto startowe ABS jako nazwę/fallback.
- `collectAccessories()` używa `hardwareRequirement` z cutlist, preferencji producenta pomieszczenia i parametrów technicznych do dobrania konkretnej pozycji katalogu okuć.
- Jeśli nie uda się dobrać konkretnego modelu, pozycja w audycie pokazuje wymaganie techniczne i ostrzeżenie, zamiast ukrywać problem pod nazwą ogólną.
- Seed podstawowych zawiasów dostał `technicalParams`, żeby przyszłe dopasowania miały dane wejściowe.

## Odłożone / nie ruszano

- Nie przebudowywano pełnej logiki wszystkich akcesoriów szuflad, cargo i podnośników. Reguła wymagań technicznych została zapisana w `QUOTE_CALCULATION_REGISTER.md` i `DEV.md`.
- Nie zmieniano PRO100, ROZRYS, import/export Excel okuć, backupów ani retencji.
