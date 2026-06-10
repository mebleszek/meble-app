# WYCENA: porządek Diag, storage i kompaktowy fingerprint v1 — 2026-06-10

## Zakres

- Baza: `site_quote_history_storage_maintenance_v1.zip`.
- Paczka wynikowa: `site_quote_diag_storage_cleanup_v1.zip`.
- Etap porządkowy po przywróceniu historii ofert: bez zmian w WYWIADZIE, modalu szafki i logice `drawer.count`.

## Zmiany

- `wycena-diagnostics.js` streszcza `shellState.lastQuote` tak samo jak `previewState.lastQuote`, zamiast wypisywać pełny JSON oferty.
- Raport WYCENY pokazuje największe klucze `localStorage` jako `topKeys`.
- `quote-snapshot-storage-maintenance.js` dostał bezpieczne rozpoznawanie martwej sesji `fc_edit_session_v1` z zakładki WYCENA.
- `quote-snapshot-store.js` czyści taką martwą sesję przed zapisem historii ofert, ale tylko gdy nie ma trybu, pokoju i otwartego modala/dialogu.
- `meta.quoteFingerprint` został zmieniony z pełnego JSON-a porównawczego na kompaktowy stabilny odcisk `qfp2`.

## Niezmienione

- Nie zmieniono liczenia WYCENY.
- Nie zmieniono nowych automatów robocizny, `quantitySource`, warunków ani audytu robocizny.
- Nie zmieniono flow ofert z BACKUP-u: wstępna/końcowa, akceptacja, statusy, odrzucenia i konwersja pozostają w istniejących modułach.
- Nie ruszano `drawer.count`, WYWIADU, plusa dodawania szafki ani plików `cabinet-modal.js`, `cabinets-render.js`, `cabinet-common.css`.

## Testy

- `node --check js/app/quote/quote-snapshot-storage-maintenance.js`
- `node --check js/app/quote/quote-snapshot-store.js`
- `node --check js/app/wycena/wycena-diagnostics.js`
- `node tools/wycena-quote-history-storage-maintenance-smoke.js`
- `node tools/wycena-diagnostics-report-smoke.js`
- `node tools/wycena-snapshot-clean-store-smoke.js`
- `node tools/wycena-unsaved-preview-storage-fix-smoke.js`
- `node tools/wycena-duplicate-offer-guard-smoke.js`
- `node tools/wycena-generate-single-flow-smoke.js`
- `node tools/wycena-generate-action-registry-smoke.js`
- `node tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/index-load-groups.js`
- `node tools/quote-single-truth-pre-labor-smoke.js`
- `node tools/wycena-orphan-edit-session-cleanup-smoke.js`
- `node tools/quote-audit-material-quantities-fix-smoke.js`
- `node tools/work-quantity-facts-cabinet-smoke.js`
- `node tools/work-quantity-facts-settings-preview-smoke.js`
- `node tools/labor-quantity-values-link-smoke.js`
- `node tools/local-storage-source-audit.js`

Znany stan bazy: `node tools/quote-labor-single-truth-smoke.js` nadal nie przechodzi z powodu istniejącego tematu robocizny / `drawer.count`, który nie był celem tego etapu.
