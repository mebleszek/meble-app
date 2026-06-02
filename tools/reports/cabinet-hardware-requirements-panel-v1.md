# WYWIAD: panel wymagań technicznych szafki v1 — 2026-06-02

## Cel

Użytkownik ma widzieć przy dodawaniu/edycji szafki, jakie wymagania techniczne szafka przekaże do WYCENY. Panel ma pokazywać wymagania, nie konkretne modele katalogowe.

## Zmiany

- Dodano `js/app/cabinet/cabinet-hardware-requirements-panel.js`.
- Dodano host `#cmHardwareRequirements` na dole modala szafki.
- `cabinet-modal.js` renderuje panel przez moduł `FC.cabinetHardwareRequirementsPanel`, bez własnej logiki okuć w modalu.
- Panel korzysta z `FC.cabinetHardwareRequirements.getCabinetHardwareRequirements(room, draft)`.
- Dla zawiasów pokazuje: cechę/nakładanie, kąt otwarcia, prowadnik, hamulec, ilość do wyceny, uwagę i regułę źródłową.
- Dla braku zawiasów pokazuje status `brak` i powód.
- Dodano style w `css/cabinet-common.css`.
- Dodano smoke test `tools/cabinet-hardware-requirements-panel-smoke.js`.

## Zakres v1

Wersja v1 pokazuje jawnie zawiasy, bo ich wymagania są obecnie najlepiej opisane centralnie. Nie dodano jeszcze edycji override, prowadnic, podnośników, cargo, ociekarek ani pantografów.

## Zasada architektoniczna

Modal ma być widokiem tej samej prawdy, z której korzysta WYCENA. Nie wolno tworzyć osobnego resolvera okuć w UI modala. Producent i konkretny produkt katalogowy mają być dobierane dopiero w WYCENIE po wymaganiach technicznych oraz preferencjach producenta.

## Następny etap

Dodać prowadnice/szuflady do centralnych wymagań technicznych:

- osobna pozycja per szuflada,
- typ szuflady: skrzynkowa/systemowa,
- wysuw: pełny/częściowy według późniejszego słownika,
- długość prowadnicy domyślna z głębokości szafki,
- szuflada frontowa: maksymalnie `głębokość - 1 cm`,
- szuflada wewnętrzna: maksymalnie `głębokość - 3 cm`,
- ręczna korekta może zmniejszać długość, ale nie może przekroczyć limitu.

## Nieruszane obszary

Nie ruszano PRO100, ROZRYS, import/export Excel okuć, backupów, panelu kategorii, PCV ani modelu ofert/snapshotów.
