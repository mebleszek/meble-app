# hardware-producer-accessories-save-fix-v1

## Cel

Naprawić zgłoszony błąd: wybór w polu `Pozostałe akcesoria` w akordeonie `Preferencje producentów okuć` nie utrzymywał się po kliknięciu `Zapisz zmiany`.

## Zakres zmian

- `js/app/ui/wywiad-room-hardware-producers.js`:
  - dodano bufor draftu preferencji producentów okuć per pomieszczenie,
  - launchery producentów dostały atrybuty `data-hardware-producer-key` i `data-hardware-producer-value`,
  - zapis czyta realne wartości pól z DOM przed normalizacją i zapisem do `room.preferences`,
  - po skutecznym zapisie bufor draftu jest czyszczony.
- `tools/app-dev-smoke.js`:
  - dodano test zapisu `hardwareProducers.accessories`,
  - dodano test kontraktu UI, że zapis opiera się na wartościach launcherów.
- `index.html` i `dev_tests.html`:
  - zaktualizowano cache-busting dla zmienionego modułu UI.

## Poza zakresem

Nie ruszano:

- panelu `Kategorie / rodzaje okuć`,
- animacji tego panelu,
- backupów i retencji,
- import/export Excel,
- PRO100,
- usług stolarskich,
- ROZRYS,
- RYSUNKU,
- pełnego resolvera katalogu okuć do wyceny.

## Testy

- `node --check js/app/ui/wywiad-room-hardware-producers.js`
- `node --check tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/rozrys-dev-smoke.js`
- `node tools/local-storage-source-audit.js`
- `node tools/dependency-source-audit.js`
- `node tools/wycena-architecture-audit.js`
- `node tools/hardware-accessories-dev-smoke.js`
- `node tools/hardware-import-export-deep-smoke.js`
- `node tools/service-pro100-dev-smoke.js`
- `unzip -t` gotowej paczki
- kontrola uprawnień ZIP-a: katalogi `755`, pliki `644`
