# Quote click / helper / duplicate fix v1 — 2026-06-04

Paczka: `site_quote_click_help_duplicate_fix_v1.zip`.

## Zakres

- Naprawiono podwójne uruchamianie `Wyceń` na mobile: po `pointerup` dla `data-action="wycena-generate"` delegacja połyka dokładnie jeden kolejny syntetyczny `click` globalnie, a shell WYCENY ma dodatkowe krótkie okno blokady po zakończeniu liczenia.
- Przywrócono helpery `?`: centralny `help-registry` nadaje przyciskowi tekstowy fallback `?`, a CSS pokazuje fallback, gdy pseudo-element/SVG nie wyrenderuje się na mobile.
- Sekcja wyboru zakresu WYCENY przechodzi na jedną kolumnę na małych ekranach, żeby helpery i launchery nie ściskały się do pustych prostokątów.
- Zmieniono wykrywanie duplikatów okuć: preferowane jest porównanie po producencie, kategorii, systemie/serii i technicznym podpisie z parametrów oznaczonych `Użyj do porównania`. `hardwareType`/nazwa techniczna pozostaje fallbackiem tylko dla legacy/niepełnych danych.

## Nie zmieniano

Nie ruszano PRO100, ROZRYS, PCV/obrzeży, import/export Excel, backupów ani modelu snapshotów poza blokadą drugiego kliknięcia w generowaniu WYCENY.

## Testy

- `node --check` dla zmienionych plików JS.
- `tools/quote-generate-helper-duplicate-regression-smoke.js`.
- `tools/app-dev-smoke.js`.
- `tools/wycena-generate-action-registry-smoke.js`.
- `tools/wycena-generate-single-flow-smoke.js`.
- `tools/wycena-duplicate-offer-guard-smoke.js`.
- `tools/wycena-diagnostics-report-smoke.js`.
- `tools/wycena-snapshot-clean-store-smoke.js`.
- `tools/wycena-orphan-edit-session-cleanup-smoke.js`.
- `tools/wycena-local-storage-context-repair-smoke.js`.
- `tools/cabinet-hardware-requirements-live-edit-smoke.js`.
- `tools/cabinet-hardware-requirements-panel-smoke.js`.
- `tools/cabinet-hardware-pair-buttons-stacked-smoke.js`.
- `tools/hinge-driver-components-smoke.js`.
- `tools/hardware-technical-completeness-smoke.js`.
- `tools/hardware-accessories-dev-smoke.js`.
- `tools/quote-audit-material-quantities-fix-smoke.js`.
- `tools/wycena-hinge-requirement-override-smoke.js`.
- `tools/check-index-load-groups.js`.

Cache-busting: `20260604_quote_click_help_duplicate_fix_v1`.
