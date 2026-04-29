# WYCENA architecture audit v1 — 2026-04-28

Zakres: statyczny audyt techniczny Wyceny/ofert/statusów bez zmian runtime, UI, danych ani storage.

## Wynik skrócony

1. `js/tabs/wycena.js` — 590 linii; ostrzeżenia: 400+ lines, mixed responsibilities heuristic.
2. `js/app/wycena/wycena-core.js` — 540 linii; ostrzeżenia: 400+ lines, mixed responsibilities heuristic.
3. `js/app/quote/quote-scope-entry.js` — 489 linii; ostrzeżenia: 400+ lines, mixed responsibilities heuristic.
4. `js/app/wycena/wycena-tab-selection.js` — 452 linii; ostrzeżenia: 400+ lines, mixed responsibilities heuristic.
5. `js/app/project/project-status-sync.js` — 318 linii; ostrzeżenia: 250+ lines.
6. `js/app/quote/quote-snapshot-store.js` — 315 linii; ostrzeżenia: 250+ lines, mixed responsibilities heuristic.
7. `js/app/project/project-status-scope.js` — 312 linii; ostrzeżenia: 250+ lines.
8. `js/app/quote/quote-snapshot-scope.js` — 304 linii; ostrzeżenia: 250+ lines.
9. `js/app/project/project-status-manual-guard.js` — 296 linii; ostrzeżenia: 250+ lines.
10. `js/app/quote/quote-pdf.js` — 278 linii; ostrzeżenia: 250+ lines, mixed responsibilities heuristic.
11. `js/app/wycena/wycena-tab-editor.js` — 262 linii; ostrzeżenia: 250+ lines.
12. `js/app/quote/quote-snapshot.js` — 257 linii; ostrzeżenia: 250+ lines, mixed responsibilities heuristic.
13. `js/app/wycena/wycena-tab-status-bridge.js` — 239 linii; ostrzeżenia: mixed responsibilities heuristic.
14. `js/app/quote/quote-offer-store.js` — 238 linii.
15. `js/app/quote/quote-snapshot-selection.js` — 209 linii; ostrzeżenia: mixed responsibilities heuristic.
16. `js/app/wycena/wycena-tab-history.js` — 203 linii; ostrzeżenia: mixed responsibilities heuristic.
17. `js/app/wycena/wycena-tab-preview.js` — 162 linii; ostrzeżenia: mixed responsibilities heuristic.
18. `js/app/wycena/wycena-tab-helpers.js` — 150 linii.
19. `js/app/wycena/wycena-core-selection.js` — 149 linii.
20. `js/app/wycena/wycena-tab-scroll.js` — 132 linii.
21. `js/app/project/project-status-mirrors.js` — 105 linii.

## Szczegóły odpowiedzialności — heurystyka

### js/tabs/wycena.js

- Linie: 590
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:139, status:87, render:20, scope:16, modal-ui:6, pdf-export:1

### js/app/wycena/wycena-core.js

- Linie: 540
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:24, snapshot:15, quote-collect:15, storage-boundary:1

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

### js/app/project/project-status-sync.js

- Linie: 318
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: status:145, snapshot:82, scope:22

### js/app/quote/quote-snapshot-store.js

- Linie: 315
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:62, storage-boundary:18, scope:16, status:14

### js/app/project/project-status-scope.js

- Linie: 312
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: status:95, snapshot:30, scope:22

### js/app/quote/quote-snapshot-scope.js

- Linie: 304
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:83, scope:53

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

### js/app/quote/quote-snapshot-selection.js

- Linie: 209
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: status:49, snapshot:25, scope:10, storage-boundary:8

### js/app/wycena/wycena-tab-history.js

- Linie: 203
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:57, render:23, status:17, scope:14, pdf-export:5, storage-boundary:1, modal-ui:1

### js/app/wycena/wycena-tab-preview.js

- Linie: 162
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: render:53, snapshot:18, scope:14, status:1

### js/app/wycena/wycena-tab-helpers.js

- Linie: 150
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:70, status:10, scope:9

### js/app/wycena/wycena-core-selection.js

- Linie: 149
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:29, snapshot:3

### js/app/wycena/wycena-tab-scroll.js

- Linie: 132
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:13

### js/app/project/project-status-mirrors.js

- Linie: 105
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: status:54, render:2, storage-boundary:1

## Wnioski do następnych paczek

1. Nie ciąć jeszcze Wyceny na podstawie samej liczby linii — najpierw utrzymać kontrakty status/scope/snapshot.
2. Pierwszy split `js/tabs/wycena.js` został rozpoczęty od preview; kolejne kroki powinny dalej odcinać małe odpowiedzialności, nie store/statusy.
3. Następni kandydaci: dalsze odchudzanie `js/tabs/wycena.js`, `wycena-core.js` collect split albo kolejny status split po dedykowanych kontraktach commit/reconcile.
4. `project-status-sync.js` ma już wydzielony `project-status-scope.js`; dalsze cięcie statusów zaczynać od kontraktów konkretnej ścieżki, nie od zapisu mirrorów.
5. W badanym zakresie nie wykryto bezpośrednich `localStorage/sessionStorage` ani systemowych `alert/confirm/prompt`; obecne granice danych idą przez store/helpery.
