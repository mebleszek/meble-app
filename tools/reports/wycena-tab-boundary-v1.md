# Wycena tab boundary v1

Zakres: kontynuacja optymalizacji `js/tabs/wycena.js` na bazie `site_wycena_selection_split_v1.zip`.

## Zmiana

- Bez zmiany UI.
- Bez zmiany storage, backupów i logiki statusów.
- Bez ruszania RYSUNKU.
- `js/tabs/wycena.js`: ok. 589 → ok. 347 linii.

## Nowe moduły

- `js/app/wycena/wycena-tab-data.js` — adapter danych zakładki WYCENA.
- `js/app/wycena/wycena-tab-state.js` — runtime state zakładki.
- `js/app/wycena/wycena-tab-selection-bridge.js` — bridge do wyboru zakresu i nazewnictwa wersji.
- `js/app/wycena/wycena-tab-editor-bridge.js` — bridge do edytora ustawień oferty.
- `js/app/wycena/wycena-tab-status-controller.js` — controller akcji statusowych z dependency injection z shellu.
- `js/app/wycena/wycena-tab-render-bridge.js` — bridge preview/historii/shell renderu.

## Zabezpieczenia

- Zachowane wejścia `FC.wycenaTabDebug`.
- Zaktualizowany load order w `index.html`, `dev_tests.html`, `tools/index-load-groups.js`, `tools/app-dev-smoke-lib/file-list.js`.
- App smoke rozszerzony o kontrakt boundary warstw zakładki WYCENA.
- Audyt WYCENA obejmuje nowe moduły.

## Audyt architektoniczny

Nowe pliki są małe i mają pojedynczą odpowiedzialność albo są świadomym cienkim bridge/controllerem. `tabs/wycena.js` pozostaje orkiestratorem, ale zszedł poniżej progu 400 linii.
