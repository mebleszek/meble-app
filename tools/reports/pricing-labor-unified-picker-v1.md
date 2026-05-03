# Pricing labor unified picker v1

## Cel

Ujednolicić robociznę/czynności do jednej wspólnej puli definicji, usunąć mylące rozdzielenie ręczne/szafka oraz zastąpić długą listę pól w WYCENIE aplikacyjnym oknem wyboru czynności.

## Zmiany

- Dodano `js/app/pricing/labor-appliance-rules.js` dla domyślnego montażu AGD z możliwością wyłączenia przy szafce.
- Dodano `js/app/wycena/wycena-labor-picker.js` i `css/quote-labor-picker.css`.
- `Stawki wyceny mebli` zapisują nowe definicje jako `usage: universal`; pole użycia jest ukryte w formularzu.
- `WYCENA` pokazuje wybrane czynności i otwiera osobne okno `Dodaj czynność` zamiast renderować wszystkie pozycje naraz.
- Modal szafki pokazuje wybór `Z montażem` / `Bez montażu` dla typów z domyślnym montażem AGD.
- `WYWIAD` pokazuje przy szafce status montażu sprzętu i wybrane czynności robocizny.
- Automatyczne AGD w `wycena-core-lines.js` respektuje `Bez montażu`.

## Granice

- Nie zmieniono RYSUNKU.
- Nie zmieniono statusów/ofert.
- Nie zmieniono polityki backupów.
- Nie dodano chmury ani nowych bezpośrednich zapisów storage.

## Testy

- `node --check` dla nowych/zmienionych JS.
- `node tools/check-index-load-groups.js`.
- `node tools/app-dev-smoke.js`.
- `node tools/rozrys-dev-smoke.js`.
- `FC.materialDevTests.runAll()`.
- `FC.wycenaDevTests.runAll()`.
- `FC.investorDevTests.runAll()`.
- `node tools/local-storage-source-audit.js`.
- `node tools/dependency-source-audit.js`.
- `node tools/wycena-architecture-audit.js`.
