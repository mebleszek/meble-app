# Raport — work quantity facts reader v1

Paczka: `site_work_quantity_facts_reader_v1.zip`
Baza: zaakceptowana `site_work_quantity_sources_settings_clean_v1.zip`.

## Cel

Dodać pierwszy bezpieczny most między słownikiem źródeł danych z trybika a realnymi danymi szafki, bez zmian UI i bez podpinania do WYCENY/czynności.

## Analiza powiązań

Obszary sprawdzone przed zmianą:

- słownik źródeł: `js/app/pricing/work-quantity-sources.js`,
- centralne fronty: `FC.frontHardware.getCabinetFrontCutListForMaterials(room, cab)`,
- centralne wymagania zawiasów: `FC.cabinetHardwareRequirements.getHingeRequirementsWithQty(room, cab)`,
- reguły AGD: `FC.laborApplianceRules.getApplianceForCabinet(cabinet)`,
- obecne liczenie robocizny: `js/app/wycena/wycena-core-labor.js`,
- krytyczne pliki WYWIADU/modala: `cabinet-modal.js`, `cabinets-render.js`, `cabinet-common.css`.

Wniosek: podpinanie do modala szafki jest ryzykowne, więc w tym etapie dodano wyłącznie read-only adapter danych bez UI.

## Zmiana

Dodano moduł:

- `js/app/pricing/work-quantity-facts.js`

Publiczne API:

- `FC.workQuantityFacts.getCabinetFacts(roomId, cabinet)`,
- `FC.workQuantityFacts.getCabinetFact(roomId, cabinet, code)`,
- `FC.workQuantityFacts.buildCabinetFactMap(roomId, cabinet)`,
- `FC.workQuantityFacts.getRawCabinetFactValues(roomId, cabinet)`.

Moduł umie na żądanie odczytać z aktualnej szafki m.in.:

- `cabinet.count`,
- `cabinet.width_mm`,
- `cabinet.height_mm`,
- `cabinet.depth_mm`,
- `cabinet.volume_m3`,
- `cabinet.zone`,
- `cabinet.kind`,
- `front.count`,
- `front.dimensions`,
- `front.area_m2`,
- `hinge.count`,
- `hinge.requirement`,
- `shelf.count`,
- `drawer.count`,
- `appliance.count`,
- `appliance.type`.

Źródła nadal niepodpięte pozostają jako `available:false`, np. `worktop.length_m`, `plinth.length_m`, `cutout.count`, `routing.count`, `cabinet.weight_kg`.

## Zasada jednej prawdy

Moduł nie zapisuje niczego do szafki, projektu, localStorage ani quoteCalculationRegister. Odczytuje istniejące dane i zwraca fakty na żądanie.

Wywołania centralnych helperów frontów i zawiasów idą przez klon szafki, ponieważ część istniejących helperów może porządkować obiekt wejściowy. Test regresyjny pilnuje, że oryginalna szafka nie jest mutowana.

## Zakres celowo nietknięty

Nie zmieniono:

- UI WYWIADU,
- `cabinet-modal.js`,
- `cabinets-render.js`,
- `cabinet-common.css`,
- plusa dodawania szafki,
- edycji szafki,
- WYCENY,
- `quoteCalculationRegister`,
- cennika czynności,
- automatów robocizny,
- działu CZYNNOŚCI.

## Audyt antyregresyjny

Nowy plik ma jedną odpowiedzialność: odczyt faktów roboczych z istniejącej szafki.

Kontrola linii po zmianie:

- `js/app/pricing/work-quantity-facts.js` — poniżej 300 linii,
- `js/app/pricing/work-quantity-sources.js` — poniżej 250 linii,
- `js/app/pricing/labor-catalog.js` — poniżej 450 linii,
- `js/app/material/price-modal-item-form.js` — poniżej 500 linii,
- `js/app/catalog/catalog-store.js` — poniżej 600 linii.

## Testy

Dodano:

- `tools/work-quantity-facts-cabinet-smoke.js`.

Test sprawdza:

- API `FC.workQuantityFacts`,
- odczyt wymiarów, objętości, frontów, zawiasów, półek i AGD,
- brak mutacji oryginalnej szafki,
- brak localStorage i DOM w nowym module,
- brak podpięcia panelu `cmWorkFactsPreview`,
- brak zmian w krytycznych plikach modala/plusa.
