# Źródła danych do czynności i wyceny w trybiku — clean v1

Paczka: `site_work_quantity_sources_settings_clean_v1.zip`.

Zakres: przywrócono zaakceptowany dział trybika `Dane do czynności i wyceny` na stabilnej bazie `site_labor_rate_profiles_restore_clean_v1.zip`.

## Zasady

- Etap dodaje tylko centralny słownik/podgląd nazw źródeł ilości i danych do przyszłych czynności oraz WYCENY.
- Nie zapisuje żadnych nowych danych w szafkach.
- Nie podpina źródeł do modala szafki, WYWIADU, WYCENY ani `quoteCalculationRegister`.
- Nie dotyka plików `cabinet-modal.js`, `cabinets-render.js` ani `cabinet-common.css`.

## Nowe moduły

- `js/app/pricing/work-quantity-sources.js` — definicje systemowych/planowanych źródeł danych.
- `js/app/ui/data-settings-work-sources-view.js` — widok read-only w trybiku ustawień.
- `tools/work-quantity-sources-settings-smoke.js` — test kontraktowy słownika i ładowania widoku.
