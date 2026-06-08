# Podgląd danych odczytywanych z szafki v1

Paczka: `site_cabinet_work_facts_preview_v1.zip`

## Cel

Dodać na dole modala szafki czytelny, tylko-odczytowy podgląd wartości, które program potrafi odczytać z bieżącej szafki pod przyszłe czynności i WYCENĘ. Panel ma pokazać użytkownikowi, że źródła ilości nie są niewidzialnym helperem ani drugim magazynem danych.

## Zakres

- Dodano moduł `js/app/cabinet/cabinet-work-facts-preview.js`.
- Dodano host `#cmWorkFactsPreview` w modalu szafki.
- Podpięto odświeżanie panelu do renderowania modala oraz do odświeżenia wymagań technicznych.
- Dodano style w `css/cabinet-common.css`.
- Dodano test `tools/cabinet-work-facts-preview-smoke.js`.

## Zasada jednej prawdy

Panel nie zapisuje żadnych danych. Wartości są czytane z bieżącego draftu szafki i z istniejących centralnych obliczeń frontów oraz zawiasów. Funkcje frontów i zawiasów są wywoływane na klonie szafki, żeby podgląd nie zmieniał draftu w modalu.

## Pokazywane źródła

- `cabinet.count`
- `cabinet.width_mm`
- `cabinet.height_mm`
- `cabinet.depth_mm`
- `cabinet.volume_m3`
- `cabinet.zone`
- `cabinet.kind`
- `front.count`
- `front.dimensions`
- `front.area_m2`
- `hinge.count`
- `hinge.requirement`
- `shelf.count`
- `drawer.count`
- `appliance.count`
- `appliance.type`

## Poza zakresem

- Brak zmian w WYCENIE.
- Brak zmian w `quoteCalculationRegister`.
- Brak zmian w cenniku czynności.
- Brak buildera czynności.
- Brak zapisu nowych danych w szafkach.
- Brak przebudowy wariantów szafek, AGD, materiałów i okuć.
