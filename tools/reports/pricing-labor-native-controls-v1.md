# pricing-labor-native-controls-v1

## Cel

Poprawka UI po zgłoszeniu, że formularz robocizny w `Stawki wyceny mebli` używał natywnych/systemowych kontrolek wyboru na mobile.

## Zakres

- Zamieniono nowe selecty robocizny na aplikacyjne launchery wyboru oparte o istniejący `investorChoice` / `rozrysChoice`.
- Dotyczy pól: użycie, automat, stawka, czas bazowy, tryb ilości, start h, dodaj h, gabarytoczas.
- Przełączniki `Aktywna` i `Szczegóły tylko wewnętrzne` ustawiono w stylu app-chip/checkbox zgodnym z wzorcem ROZRYS.
- Dodano smoke kontrakt chroniący formularz robocizny przed powrotem natywnych pickerów systemowych.

## Poza zakresem

- Brak zmian modelu danych robocizny.
- Brak zmian wyliczeń WYCENY.
- Brak zmian PDF klienta.
- Brak zmian RYSUNKU, materiałów, okuć, statusów/ofert i backupów.

## Testy

- `node --check js/app/material/price-modal-item-form.js`
- `node --check tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/rozrys-dev-smoke.js`
- `FC.materialDevTests.runAll()` w Node
- `FC.wycenaDevTests.runAll()` w Node
- `FC.investorDevTests.runAll()` w Node
- `node tools/local-storage-source-audit.js`
- `node tools/dependency-source-audit.js`
- `node tools/wycena-architecture-audit.js`
