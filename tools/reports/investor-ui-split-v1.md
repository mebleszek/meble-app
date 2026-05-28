# Investor UI split v1 — 2026-05-02

## Baza

- Start: `site_manual_status_restore_v1.zip`.
- Wynik: `site_investor_ui_split_v1.zip`.

## Zakres

Optymalizacja bez zmiany UI i bez ruszania RYSUNKU. Celem było odchudzenie `js/app/investor/investor-ui.js`, który mieszał shell ekranu, budowę HTML i status-flow pomieszczeń.

## Zmiany

- Dodano `js/app/investor/investor-ui-render.js`:
  - render listy inwestorów,
  - render karty inwestora,
  - opcje statusów projektu, typów inwestora i źródeł,
  - formatowanie daty dla listy/karty.

- Dodano `js/app/investor/investor-ui-status-flow.js`:
  - walidacja manualnej zmiany statusu przez `projectStatusManualGuard`,
  - aplikacyjny modal generowania oferty, jeśli guard tego wymaga,
  - wybór zakresu statusu przez `projectStatusScopeDecision`,
  - zapis statusu przez `investorPersistence`.

- `js/app/investor/investor-ui.js` został shellem/binderem:
  - stan listy/detail,
  - transient investor,
  - wybór aktualnego inwestora,
  - wiązanie pól formularza,
  - delegacja renderu i status-flow do nowych modułów.

## Load order

Utrzymywać kolejność:

1. `js/app/investor/investor-rooms.js`
2. `js/app/investor/investor-ui-render.js`
3. `js/app/investor/investor-ui-status-flow.js`
4. `js/app/investor/investor-ui.js`

Zaktualizowane miejsca:

- `index.html`,
- `dev_tests.html`,
- `tools/index-load-groups.js`,
- `tools/app-dev-smoke-lib/file-list.js`.

## Audyt odpowiedzialności

- `investor-ui.js`: ok. 362 linie, shell/binder ekranu; nadal powyżej progu ostrożności 250, ale bez renderu HTML i bez status-flow.
- `investor-ui-render.js`: ok. 219 linii, jedna odpowiedzialność — render HTML Inwestora.
- `investor-ui-status-flow.js`: ok. 136 linii, jedna odpowiedzialność — przepływ zmiany statusów pokoi z Inwestora.

Nie wykonano dalszego splitu `investor-ui.js`, bo kolejny krok wymagałby rozdzielenia bindingu formularza i callbacków, a w tej paczce nie było konkretnej ścieżki biznesowej uzasadniającej większe ryzyko.

## Testy

- `node --check` dla nowych/zmienionych JS — OK.
- `node tools/check-index-load-groups.js` — OK.
- `node tools/app-dev-smoke.js` — 33/33 OK.
- `node tools/rozrys-dev-smoke.js` — 72/72 OK.
- `FC.wycenaDevTests.runAll()` w Node — 113/113 OK.
- `node tools/local-storage-source-audit.js` — OK, bez nowych referencji storage; 274 referencje jak w bazie po zmianach testów.
- `node tools/dependency-source-audit.js` — OK, raport odświeżony.
- `node tools/wycena-architecture-audit.js` — OK.
