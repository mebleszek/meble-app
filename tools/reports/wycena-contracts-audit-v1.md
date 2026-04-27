# WYCENA architecture audit v1 — 2026-04-27

Zakres: statyczny audyt techniczny Wyceny/ofert/statusów bez zmian runtime, UI, danych ani storage.

## Wynik skrócony

1. `js/tabs/wycena.js` — 814 linii; ostrzeżenia: 600+ lines, mixed responsibilities heuristic.
2. `js/app/quote/quote-snapshot-store.js` — 659 linii; ostrzeżenia: 600+ lines, mixed responsibilities heuristic.
3. `js/app/wycena/wycena-core.js` — 653 linii; ostrzeżenia: 600+ lines, mixed responsibilities heuristic.
4. `js/app/project/project-status-sync.js` — 644 linii; ostrzeżenia: 600+ lines, mixed responsibilities heuristic.
5. `js/app/quote/quote-scope-entry.js` — 489 linii; ostrzeżenia: 400+ lines, mixed responsibilities heuristic.
6. `js/app/wycena/wycena-tab-selection.js` — 452 linii; ostrzeżenia: 400+ lines, mixed responsibilities heuristic.
7. `js/app/project/project-status-manual-guard.js` — 296 linii; ostrzeżenia: 250+ lines.
8. `js/app/quote/quote-pdf.js` — 278 linii; ostrzeżenia: 250+ lines, mixed responsibilities heuristic.
9. `js/app/wycena/wycena-tab-editor.js` — 262 linii; ostrzeżenia: 250+ lines.
10. `js/app/quote/quote-snapshot.js` — 257 linii; ostrzeżenia: 250+ lines, mixed responsibilities heuristic.
11. `js/app/wycena/wycena-tab-status-bridge.js` — 239 linii; ostrzeżenia: mixed responsibilities heuristic.
12. `js/app/quote/quote-offer-store.js` — 238 linii.
13. `js/app/wycena/wycena-tab-history.js` — 203 linii; ostrzeżenia: mixed responsibilities heuristic.
14. `js/app/wycena/wycena-tab-helpers.js` — 150 linii.
15. `js/app/wycena/wycena-tab-scroll.js` — 132 linii.

## Szczegóły odpowiedzialności — heurystyka

### js/tabs/wycena.js

- Linie: 814
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:184, status:81, render:78, scope:34, modal-ui:12, pdf-export:6, quote-collect:2

### js/app/quote/quote-snapshot-store.js

- Linie: 659
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:131, scope:77, status:51, storage-boundary:20

### js/app/wycena/wycena-core.js

- Linie: 653
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:53, snapshot:18, quote-collect:15, storage-boundary:1

### js/app/project/project-status-sync.js

- Linie: 644
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: status:254, snapshot:103, scope:43, render:2, storage-boundary:1

### js/app/quote/quote-scope-entry.js

- Linie: 489
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:143, snapshot:66, render:34, modal-ui:9, status:6, storage-boundary:3

### js/app/wycena/wycena-tab-selection.js

- Linie: 452
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:102, snapshot:36, render:35, modal-ui:15

### js/app/project/project-status-manual-guard.js

- Linie: 296
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: status:57, snapshot:23, scope:14

### js/app/quote/quote-pdf.js

- Linie: 278
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:34, snapshot:28, pdf-export:25, modal-ui:3, status:2

### js/app/wycena/wycena-tab-editor.js

- Linie: 262
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: render:33, scope:7, status:1

### js/app/quote/quote-snapshot.js

- Linie: 257
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:52, snapshot:16, quote-collect:2, storage-boundary:1

### js/app/wycena/wycena-tab-status-bridge.js

- Linie: 239
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: status:79, snapshot:67, modal-ui:6, render:2, scope:1, storage-boundary:1

### js/app/quote/quote-offer-store.js

- Linie: 238
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:30, storage-boundary:10, snapshot:3

### js/app/wycena/wycena-tab-history.js

- Linie: 203
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:57, render:23, status:17, scope:14, pdf-export:5, storage-boundary:1, modal-ui:1

### js/app/wycena/wycena-tab-helpers.js

- Linie: 150
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:70, status:10, scope:9

### js/app/wycena/wycena-tab-scroll.js

- Linie: 132
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:13

## Wnioski do następnych paczek

1. Nie ciąć jeszcze Wyceny na podstawie samej liczby linii — najpierw utrzymać kontrakty status/scope/snapshot.
2. Pierwszy realny split powinien iść od `js/tabs/wycena.js`, bo miesza render, historię, status bridge i obsługę preview.
3. Drugi kandydat to `js/app/wycena/wycena-core.js`: oddzielić collect/validate/commercial/service catalog bez zmiany wyniku ofert.
4. `quote-snapshot-store.js` i `project-status-sync.js` są krytyczne dla danych/statusów — ciąć dopiero po dodatkowych testach old/new fixture.
5. W badanym zakresie nie wykryto bezpośrednich `localStorage/sessionStorage` ani systemowych `alert/confirm/prompt`; obecne granice danych idą przez store/helpery.
