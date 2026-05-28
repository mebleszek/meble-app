# hardware-producer-preferences-v1

## Baza

- Start: `site_hardware_dictionary_category_stable_panel_v1.zip`.
- Wyjście: `site_hardware_producer_preferences_v1.zip`.

## Zakres zmiany

1. W `WYWIADZIE` dodano osobny akordeon `Preferencje producentów okuć` między `Parametry pomieszczenia` a preferencjami materiałów/kolorów.
2. Dotychczasowy akordeon `Preferencje standardu` przemianowano na `Preferencje materiałów i kolorów`.
3. Dodano pięć grup preferencji producentów okuć:
   - `Zawiasy`,
   - `Szuflady / prowadnice`,
   - `Podnośniki`,
   - `Cargo`,
   - `Pozostałe akcesoria`.
4. Wybór producenta odbywa się przez launcher aplikacyjny i listę z istniejących producentów katalogu okuć.
5. Model preferencji pokoju zapisuje wybory w `room.preferences.hardwareProducers` bez nowego klucza storage.
6. WYCENA dostała pierwszy kontrakt czytania tych preferencji przy uproszczonych liniach okuć, bez zapisywania zamian do projektu.

## Świadomie nie ruszano

- Panelu `Kategorie / rodzaje okuć` i jego stabilnego nieanimowanego body.
- Backupów i retencji backupów.
- Importu/eksportu Excel.
- PRO100 i usług stolarskich.
- ROZRYS, RYSUNKU oraz pełnej mechaniki WYCENY.
- Silnika zamienników jako zapisu do projektu.

## Pliki główne

- `index.html`
- `dev_tests.html`
- `css/wywiad.css`
- `js/app/room-preferences/room-preferences-model.js`
- `js/app/ui/wywiad-room-hardware-producers.js`
- `js/app/ui/wywiad-room-preferences.js`
- `js/app/ui/cabinets-render.js`
- `js/app/wycena/wycena-core-lines.js`
- `js/app/shared/schema.js`
- `js/app/settings/program-defaults-store.js`
- `tools/app-dev-smoke.js`
- `tools/index-load-groups.js`
- `tools/app-dev-smoke-lib/file-list.js`

## Testy

- `node --check` dla zmienionych plików JS.
- `node tools/check-index-load-groups.js`.
- `node tools/app-dev-smoke.js`.
- `node tools/rozrys-dev-smoke.js`.
- `node tools/local-storage-source-audit.js`.
- `node tools/dependency-source-audit.js`.
- `node tools/wycena-architecture-audit.js`.
- `node tools/hardware-accessories-dev-smoke.js`.
- `node tools/hardware-import-export-deep-smoke.js`.
- `node tools/service-pro100-dev-smoke.js`.

## Uwagi do kolejnego etapu

Kolejnym etapem może być właściwy resolver katalogowy: potrzeba okucia z projektu → preferowany producent z WYWIADU → konkretna pozycja katalogu z ceną `Do wyceny`. Obecna paczka przygotowuje strukturę i UI, ale nie wykonuje jeszcze trwałych zamian producentów w istniejących szafkach/projekcie.
