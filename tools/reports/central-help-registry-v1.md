# Centralny rejestr helperów `?` v1

## Paczka
`site_central_help_registry_v1.zip`

## Cel
Ujednolicić opisy pod ikoną `?` i usunąć sytuację, w której nowe pola techniczne pokazują generyczny placeholder typu „To nazwa pola technicznego...”.

## Zmiany
- Dodano `js/app/shared/help-registry.js`.
- `price-modal-field-help.js` rejestruje helpery formularzy cenników w centralnym rejestrze.
- `price-modal-hardware-dictionaries.js` czyta helpery słowników przez centralny rejestr.
- `price-modal-hardware-form.js` rozwiązuje opis dynamicznego pola po konkretnym `field.key`, nie po ogólnym typie pola.
- `hardware-technical-params.js` ma indywidualne instrukcje dla aktywnych parametrów technicznych, szczególnie zawiasów i prowadników.

## Zakres świadomie ograniczony
- Nie dodano nowych pól w innych działach.
- Nie zmieniono logiki WYCENY, prowadników, PRO100, ROZRYSU, PCV ani backupów.
- Zmiana jest warstwą UI/wyjaśnień i kontraktu helperów.

## Test
`tools/central-help-registry-smoke.js`

Test pilnuje m.in.:
- centralny rejestr ładuje się przed `hardware-technical-params`,
- aktywne parametry techniczne mają helpery,
- nowe pola zawiasów/prowadników nie pokazują generycznego placeholdera,
- formularz dynamicznych pól używa `field.key`.

## Cache-busting
`20260604_central_help_registry_v1`
