# WYCENA architecture audit v1 — 2026-05-02

Zakres: statyczny audyt techniczny Wyceny/ofert/statusów bez zmian runtime, UI, danych ani storage.

## Wynik skrócony

1. `js/app/project/project-status-manual-guard.js` — 385 linii; ostrzeżenia: 250+ lines.
2. `js/tabs/wycena.js` — 348 linii; ostrzeżenia: 250+ lines, mixed responsibilities heuristic.
3. `js/app/quote/quote-snapshot-store.js` — 315 linii; ostrzeżenia: 250+ lines, mixed responsibilities heuristic.
4. `js/app/project/project-status-scope.js` — 313 linii; ostrzeżenia: 250+ lines.
5. `js/app/quote/quote-snapshot-scope.js` — 304 linii; ostrzeżenia: 250+ lines.
6. `js/app/quote/quote-pdf.js` — 278 linii; ostrzeżenia: 250+ lines, mixed responsibilities heuristic.
7. `js/app/wycena/wycena-tab-editor.js` — 262 linii; ostrzeżenia: 250+ lines.
8. `js/app/quote/quote-snapshot.js` — 257 linii; ostrzeżenia: 250+ lines, mixed responsibilities heuristic.
9. `js/app/project/project-status-sync.js` — 241 linii.
10. `js/app/wycena/wycena-tab-status-bridge.js` — 239 linii; ostrzeżenia: mixed responsibilities heuristic.
11. `js/app/quote/quote-offer-store.js` — 238 linii.
12. `js/app/quote/quote-snapshot-selection.js` — 234 linii; ostrzeżenia: mixed responsibilities heuristic.
13. `js/app/wycena/wycena-tab-history.js` — 203 linii; ostrzeżenia: mixed responsibilities heuristic.
14. `js/app/quote/quote-scope-entry-modal.js` — 196 linii; ostrzeżenia: mixed responsibilities heuristic.
15. `js/app/wycena/wycena-tab-selection-version.js` — 194 linii.
16. `js/app/quote/quote-scope-entry-flow.js` — 186 linii; ostrzeżenia: mixed responsibilities heuristic.
17. `js/app/wycena/wycena-tab-selection-pickers.js` — 177 linii.
18. `js/app/quote/quote-scope-entry-scope.js` — 169 linii.
19. `js/app/wycena/wycena-tab-selection-bridge.js` — 163 linii; ostrzeżenia: mixed responsibilities heuristic.
20. `js/app/wycena/wycena-tab-preview.js` — 162 linii; ostrzeżenia: mixed responsibilities heuristic.
21. `js/app/wycena/wycena-tab-helpers.js` — 150 linii.
22. `js/app/wycena/wycena-core-selection.js` — 149 linii.
23. `js/app/wycena/wycena-core-material-plan.js` — 137 linii.
24. `js/app/wycena/wycena-core-lines.js` — 136 linii.
25. `js/app/wycena/wycena-tab-scroll.js` — 132 linii.
26. `js/app/project/project-status-snapshot-flow.js` — 130 linii.
27. `js/app/wycena/wycena-tab-render-bridge.js` — 121 linii; ostrzeżenia: mixed responsibilities heuristic.
28. `js/app/wycena/wycena-tab-selection-scope.js` — 120 linii.
29. `js/app/wycena/wycena-core-catalog.js` — 117 linii.
30. `js/app/project/project-status-mirrors.js` — 107 linii.
31. `js/app/wycena/wycena-tab-editor-bridge.js` — 103 linii.
32. `js/app/wycena/wycena-core.js` — 96 linii.
33. `js/app/wycena/wycena-tab-state.js` — 82 linii.
34. `js/app/wycena/wycena-tab-status-controller.js` — 80 linii.
35. `js/app/quote/quote-scope-entry-utils.js` — 79 linii.
36. `js/app/wycena/wycena-core-offer.js` — 76 linii.
37. `js/app/wycena/wycena-room-availability.js` — 70 linii.
38. `js/app/wycena/wycena-tab-selection-render.js` — 63 linii.
39. `js/app/wycena/wycena-tab-data.js` — 62 linii.
40. `js/app/wycena/wycena-core-source.js` — 59 linii.
41. `js/app/quote/quote-scope-entry.js` — 49 linii.
42. `js/app/project/project-status-scope-decision.js` — 44 linii.
43. `js/app/wycena/wycena-core-utils.js` — 23 linii.
44. `js/app/wycena/wycena-tab-selection.js` — 11 linii.
45. `js/app/wycena/wycena-tab-selection-model.js` — 10 linii.

## Szczegóły odpowiedzialności — heurystyka

### js/app/project/project-status-manual-guard.js

- Linie: 385
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: status:70, scope:41, snapshot:40

### js/tabs/wycena.js

- Linie: 348
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:111, status:34, render:21, modal-ui:4

### js/app/quote/quote-snapshot-store.js

- Linie: 315
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:62, storage-boundary:18, scope:16, status:14

### js/app/project/project-status-scope.js

- Linie: 313
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: status:95, snapshot:30, scope:22

### js/app/quote/quote-snapshot-scope.js

- Linie: 304
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:83, scope:53

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

### js/app/project/project-status-sync.js

- Linie: 241
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: status:115, snapshot:36, scope:11

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

- Linie: 234
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: status:50, snapshot:29, scope:11, storage-boundary:8

### js/app/wycena/wycena-tab-history.js

- Linie: 203
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:57, render:23, status:17, scope:14, pdf-export:5, storage-boundary:1, modal-ui:1

### js/app/quote/quote-scope-entry-modal.js

- Linie: 196
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:69, render:31, modal-ui:6, snapshot:4, storage-boundary:3

### js/app/wycena/wycena-tab-selection-version.js

- Linie: 194
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:58, snapshot:36

### js/app/quote/quote-scope-entry-flow.js

- Linie: 186
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:63, snapshot:43, status:7, modal-ui:3

### js/app/wycena/wycena-tab-selection-pickers.js

- Linie: 177
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: render:15, modal-ui:15, scope:13

### js/app/quote/quote-scope-entry-scope.js

- Linie: 169
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:27, snapshot:25

### js/app/wycena/wycena-tab-selection-bridge.js

- Linie: 163
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:16, snapshot:11, render:4, modal-ui:4

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

### js/app/wycena/wycena-core-material-plan.js

- Linie: 137
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:3, quote-collect:2

### js/app/wycena/wycena-core-lines.js

- Linie: 136
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:8, quote-collect:4

### js/app/wycena/wycena-tab-scroll.js

- Linie: 132
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:13

### js/app/project/project-status-snapshot-flow.js

- Linie: 130
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: status:60, snapshot:60, scope:14

### js/app/wycena/wycena-tab-render-bridge.js

- Linie: 121
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:44, render:20, status:8, modal-ui:2

### js/app/wycena/wycena-tab-selection-scope.js

- Linie: 120
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:34, snapshot:3

### js/app/wycena/wycena-core-catalog.js

- Linie: 117
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: storage-boundary:1

### js/app/project/project-status-mirrors.js

- Linie: 107
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: status:54, render:2, storage-boundary:1

### js/app/wycena/wycena-tab-editor-bridge.js

- Linie: 103
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: render:8

### js/app/wycena/wycena-core.js

- Linie: 96
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:15, quote-collect:11, scope:6

### js/app/wycena/wycena-tab-state.js

- Linie: 82
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: status:6, snapshot:6

### js/app/wycena/wycena-tab-status-controller.js

- Linie: 80
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:52, status:21, modal-ui:4

### js/app/quote/quote-scope-entry-utils.js

- Linie: 79
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: render:5, scope:4, snapshot:3

### js/app/wycena/wycena-core-offer.js

- Linie: 76
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: quote-collect:4

### js/app/wycena/wycena-room-availability.js

- Linie: 70
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:8, snapshot:3

### js/app/wycena/wycena-tab-selection-render.js

- Linie: 63
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:29, render:20

### js/app/wycena/wycena-tab-data.js

- Linie: 62
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: snapshot:14

### js/app/wycena/wycena-core-source.js

- Linie: 59
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:7

### js/app/quote/quote-scope-entry.js

- Linie: 49
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:13, snapshot:6

### js/app/project/project-status-scope-decision.js

- Linie: 44
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: status:8, scope:3

### js/app/wycena/wycena-core-utils.js

- Linie: 23
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: brak

### js/app/wycena/wycena-tab-selection.js

- Linie: 11
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: brak

### js/app/wycena/wycena-tab-selection-model.js

- Linie: 10
- Bezpośrednie storage: 0
- Systemowe dialogi: 0
- Sygnały odpowiedzialności: scope:2

## Wnioski do następnych paczek

1. `js/tabs/wycena.js` po boundary split jest poniżej 400 linii i nie powinien być kolejnym kandydatem tylko z powodu rozmiaru.
2. Dalsze cięcie zakładki robić wyłącznie przy konkretnej ścieżce: historia, statusy, selection, editor albo render — bez mieszania odpowiedzialności z powrotem w shellu.
3. `wycena-core.js` jest po platform split i nie jest już kandydatem do dalszego cięcia w tym etapie; nowe funkcje kierować do właściwych warstw core, nie do orchestratorka.
4. `wycena-tab-selection.js` ma warstwy scope/version/model/pickers/render/fasada, a `tabs/wycena.js` korzysta z `wycena-tab-selection-bridge.js`; nie scalać ich ponownie.
5. Statusy projektu mają wydzielone lustra, workflow snapshotów i controller zakładki; dalsze cięcie statusów zaczynać od kontraktów konkretnej ścieżki biznesowej.
6. W badanym zakresie nie wykryto bezpośrednich `localStorage/sessionStorage` ani systemowych `alert/confirm/prompt`; obecne granice danych idą przez store/helpery.
