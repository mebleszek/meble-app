# Nazwa katalogowa i techniczna okuć v1

## Zakres

- `Nazwa` w modalu edycji okucia została rozdzielona na `Nazwa katalogowa` oraz podgląd `Nazwa techniczna`.
- Podgląd nazwy technicznej jest nieedytowalny i jest odświeżany z dynamicznych parametrów technicznych.
- Widoczny launcher `Typ / cecha` został usunięty z normalnego formularza. Wewnętrzne pole `hardwareType` zostało ukryte i pełni rolę technicznego miejsca zapisu automatycznie zbudowanej nazwy, żeby nie rozrywać istniejących ścieżek WYCENY, zamienników i eksportu.
- W słownikach parametrów zmieniono etykiety:
  - `Cecha kluczowa` → `Użyj do porównania`,
  - `Buduje typ` → `Buduje nazwę techniczną`.
- Nieaktywne parametry z dopiskiem `legacy` są ukrywane w modalu słowników, żeby nie zaśmiecały normalnej edycji.
- Eksport katalogu i cen dostawców używa nagłówka `nazwa_techniczna`; import rozpoznaje również stare nagłówki, żeby nie blokować wczytania wcześniejszych arkuszy.

## Testy

- `node tools/hardware-technical-name-ui-smoke.js`
- `node tools/app-dev-smoke.js`
- `node tools/hardware-accessories-dev-smoke.js`
- `node tools/hardware-import-export-deep-smoke.js`
- `node tools/hardware-technical-completeness-smoke.js`
- `node tools/cabinet-hinge-tipon-spring-smoke.js`
- `node tools/wycena-hinge-quote-replacement-flow-smoke.js`

## Cache-busting

- `20260606_hardware_technical_name_ui_v1`
