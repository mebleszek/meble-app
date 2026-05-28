# Wycena core cache fix v1

Baza: `site_hardware_supplier_prices_v1.zip`

## Problem

Po pierwszym odświeżeniu po wdrożeniu pojawił się błąd:

```
Brak modułów FC.wycenaCore* — sprawdź kolejność ładowania Wyceny.
```

Adres błędu wskazywał na stary cache-busting `wycena-core.js?v=20260503_pricing_labor_rules_v1`. Drugie odświeżenie działało, co wskazuje na mieszanie wersji/cache po wdrożeniu, a nie trwały błąd logiki WYCENY.

## Zmiana

- Ujednolicono i podbito cache-busting dla całej grupy `wycena-core*` w `index.html`.
- Ujednolicono i podbito cache-busting dla tej samej grupy w `dev_tests.html`.
- Nie zmieniano runtime WYCENY ani logiki okuć.

## Testy

Do uruchomienia przed ZIP:

- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/rozrys-dev-smoke.js`
- `node tools/local-storage-source-audit.js`
- `node tools/dependency-source-audit.js`
- `node tools/wycena-architecture-audit.js`
