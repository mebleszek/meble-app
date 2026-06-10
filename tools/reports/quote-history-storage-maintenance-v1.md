# WYCENA — historia ofert i storage maintenance v1

Paczka: `site_quote_history_storage_maintenance_v1.zip`

## Zakres

- Dodano moduł `js/app/quote/quote-snapshot-storage-maintenance.js` jako lokalny, chmuro-gotowy adapter awaryjnego odchudzania storage przed zapisem historii WYCENY.
- `quote-snapshot-store` przy błędzie zapisu snapshotu próbuje teraz zwolnić miejsce przez usunięcie cache/kluczy technicznych oraz odchudzenie lokalnych backupów, zamiast od razu kończyć na `Podgląd bez zapisu historii`.
- Zachowano sens flow ofert z BACKUP-u: wiele ofert, wstępna/końcowa, akceptacja, statusy, odrzucenia i historia nadal idą przez `quoteSnapshotStore` / status bridge.
- Zachowano obecny silnik automatów robocizny, `quantitySource`, warunki i audyt robocizny. Nie cofano robocizny do BACKUP-u.
- Historia snapshotów jest limitowana do 30 najnowszych ofert na projekt, z zachowaniem ofert wybranych/zaakceptowanych; globalnie store ma miękki limit techniczny.
- `Diag` nie wkleja już pełnego `previewState.lastQuote`; pokazuje skrót snapshotu oraz rozbicie rozmiarów snapshotu/sekcji.
- Cache-busting: `20260610_quote_history_storage_maintenance_v1`.

## Co może zostać usunięte automatycznie przy pełnym localStorage

- cache ROZRYS,
- `fc_edit_session_v1`, `fc_reload_restore_v1`,
- techniczne kopie awaryjne projektu/inwestorów,
- nadmiar lokalnych backupów `fc_data_backups_v1`.

Nie są usuwane bieżące projekty, inwestorzy, katalogi, cenniki ani aktualnie zapisywany snapshot oferty.

## Testy

- `node --check js/app/quote/quote-snapshot-storage-maintenance.js`
- `node --check js/app/quote/quote-snapshot-store.js`
- `node --check js/app/wycena/wycena-diagnostics.js`
- `node tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/index-load-groups.js`
- `node tools/wycena-quote-history-storage-maintenance-smoke.js`
- `node tools/wycena-snapshot-clean-store-smoke.js`
- `node tools/wycena-diagnostics-report-smoke.js`
- `node tools/wycena-duplicate-offer-guard-smoke.js`
- `node tools/wycena-unsaved-preview-storage-fix-smoke.js`
- `node tools/wycena-generate-single-flow-smoke.js`
- `node tools/wycena-generate-action-registry-smoke.js`
- `node tools/quote-single-truth-pre-labor-smoke.js`

## Świadomie nieruszone

- `cabinet-modal.js`, `cabinets-render.js`, `cabinet-common.css`.
- WYWIAD i plus dodawania szafki.
- Naprawa źródła `drawer.count` — zostaje osobnym etapem przez jawne wymagania szuflad/prowadnic, nie przez whitelistę wariantów.
