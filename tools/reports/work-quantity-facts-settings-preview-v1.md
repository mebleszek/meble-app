# work-quantity-facts-settings-preview-v1

## Cel

Dodać podgląd nazwanych danych odczytywanych z istniejących szafek poza modalem szafki, w trybiku `Dane do czynności i wyceny`.

## Zakres

- Zmieniono `js/app/ui/data-settings-work-sources-view.js`.
- Zmieniono `css/data-settings.css`.
- Dodano test `tools/work-quantity-facts-settings-preview-smoke.js`.
- Zaktualizowano cache-busting do `20260609_work_quantity_facts_settings_preview_v1`.

## Zasady bezpieczeństwa

- Nie ruszano `js/app/cabinet/cabinet-modal.js`.
- Nie ruszano `js/app/ui/cabinets-render.js`.
- Nie ruszano `css/cabinet-common.css`.
- Podgląd nie zapisuje danych w szafce ani w localStorage.
- Podgląd korzysta z read-only adaptera `FC.workQuantityFacts`.

## Wynik

Użytkownik może wejść w trybik ustawień i sprawdzić, co program potrafi odczytać z aktualnych szafek, bez ryzyka blokowania modala edycji szafki.
