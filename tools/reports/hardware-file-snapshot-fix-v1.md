# Hardware file snapshot fix v1 — 2026-05-09

## Cel

Naprawić błąd importu plików na Android/Chrome, gdzie po wyborze XLSX aplikacja potrafiła pokazać komunikat `The requested file could not be read...`.

## Przyczyna

Kod trzymał referencję do obiektu `File` z inputa i dopiero później przekazywał ją do parsera. Na części środowisk mobilnych uprawnienie do tego uchwytu może zostać utracone po wyczyszczeniu inputa albo przy dalszej pracy z modalem.

## Zmiana

- `price-modal-hardware-import-export.js` czyta `arrayBuffer()` natychmiast po wyborze pliku.
- Dalej import pracuje na snapshocie w pamięci (`__fcFileSnapshot`), a nie na bezpośrednim uchwycie do pliku systemowego.
- Po odczycie można bezpiecznie wyczyścić input pliku.

## Zakres

Zmiana dotyczy tylko importu pliku JSON/XLSX w katalogu okuć. Nie zmienia modelu danych, backupów, WYCENY, WYWIADU, RYSUNKU ani automatyki okuć.

## Testy

- `node --check js/app/material/price-modal-hardware-import-export.js`
- `node --check tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/rozrys-dev-smoke.js`
- `node tools/local-storage-source-audit.js`
- `node tools/dependency-source-audit.js`
- `node tools/wycena-architecture-audit.js`
