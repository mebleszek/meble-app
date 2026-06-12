# labor-time-minutes-v1

Data: 2026-06-12
Paczka: `site_labor_time_minutes_v1.zip`
Baza: `site_pricing_modes_form_price_fix_v1.zip`

## Cel

Uprościć wybór czasu w **Cenniku robocizny i usług**: użytkownik wybiera minuty, nie ułamki godziny. Usunąć opcję 45 minut i zamienić zapisane w cenniku dokładne 45 minut na 60 minut, bez globalnego zaokrąglania wyników obliczeń.

## Zmiany

- `index.html`
  - `laborTimeBlockHours`, `laborStartHours`, `laborStepHours` pokazują: Brak, 5 min, 15 min, 30 min, 60 min.
  - Usunięto opcję `0.75` / `0,75 h`.
  - Podbito cache-busting do `20260612_labor_time_minutes_v1`.

- `js/app/pricing/labor-catalog.js`
  - Dodano normalizację dokładnie zapisanych 45 min (`0.75 h`) do 60 min (`1 h`) dla pól czasu cennika.
  - Dodano opcję 5 min (`1/12 h`) jako dozwolony czas.
  - Progi czasu można wpisywać w minutach, np. `1-2=15 min;3-5=30 min;6-10=60 min`; stary zapis godzinowy nadal jest odczytywany.
  - Nie ma globalnego zaokrąglania wyników: `3 × 15 min` nadal daje wynik `45 min` jako wynik mnożenia.
  - Opis pozycji cennika pokazuje czas w minutach.

- `js/app/pricing/labor-catalog-definitions.js`
  - Domyślne automaty `dishwasher_mount` i `fridge_mount` zmienione z `0.75` h na `1` h.

- `js/app/material/price-modal-item-form.js`
  - Podgląd reguły pokazuje czas w minutach.
  - Launchery czasu mają opisy „Czas startowy” i „Czas za krok”, bez technicznego `h` w etykiecie wyboru.

- `js/app/material/price-modal-field-help.js`
  - Help dla pól czasu opisuje, że UI pokazuje minuty, a program wewnętrznie przelicza je na godziny do stawki PLN/h.

- Testy
  - Dodano `tools/labor-time-minutes-smoke.js`.
  - Zaktualizowano test czystego rebase AGD pod nową decyzję: zapisane 45 min są zamieniane na 60 min.

## Nieruszane

- Transport, koszty firmy, dane firmy, OpenRouteService.
- `drawer.count`.
- Materiały, okucia, wymagania techniczne szafek.
- Silnik mnożenia czasu przez ilość: wynik `3 × 15 min = 45 min` pozostaje poprawny.

## Testy

- `node --check js/app/pricing/labor-catalog.js`
- `node --check js/app/material/price-modal-item-form.js`
- `node --check js/app/pricing/labor-catalog-definitions.js`
- `node tools/labor-time-minutes-smoke.js`
- `node tools/pricing-modes-smoke.js`
- `node tools/labor-appliance-category-clean-rebase-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/hourly-rates-settings-smoke.js`
- `node tools/labor-rate-profiles-restore-clean-smoke.js`
- `node tools/transport-catalog-quote-fix-smoke.js`
- `node tools/company-transport-business-costs-smoke.js`
- `node tools/boot-domcontentloaded-init-fix-smoke.js`
- `node tools/pricing-modes-form-service-price-fix-smoke.js`
