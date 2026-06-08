# Szafki — odciążenie podglądu danych przy otwieraniu edycji v1

## Cel

Naprawić zgłoszoną regresję: kliknięcie `Edytuj` w WYWIADZIE po dodaniu panelu `Co program odczyta z tej szafki` mogło zawieszać albo mocno opóźniać otwarcie modala na telefonie.

## Zmiany

- Podgląd faktów roboczych jest planowany przez `scheduleCabinetWorkFactsPreview()` i liczony z krótkim opóźnieniem.
- W trakcie pierwszego renderu można pokazać lekką informację, że podgląd zostanie policzony po otwarciu okna.
- `cabinet-work-facts-preview.js` nie wywołuje już wielokrotnie tych samych obliczeń dla frontów, zawiasów, półek i szuflad w jednym przebiegu.

## Granice

Nie zmieniano danych szafki, WYCENY, quoteCalculationRegister, materiałów, okuć ani reguł wymagań technicznych.
