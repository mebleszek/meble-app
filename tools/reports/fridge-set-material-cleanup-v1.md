# Fridge/set material cleanup v1 — 2026-05-17

## Baza

`site_000_set_materials_unify_v1.zip`

## Zakres

- Lodówka: usunięcie z widoku zdublowanych ogólnych pól frontu, gdy używana jest nowa logika źródeł materiału frontu.
- Zestawy: domyślne korpus/plecy/otwieranie zestawu startują jak dolna strefa / szafki stojące.

## Zmienione pliki

- `index.html` — wrappery dla ogólnych pól frontu oraz cache-busting.
- `js/app/cabinet/cabinet-modal.js` — widoczność ogólnych pól frontu dla lodówki.
- `js/app/cabinet/cabinet-modal-set-wizard.js` — baza materiałów zestawu z dolnej strefy.
- `tools/app-dev-smoke.js` — kontrakty antyregresyjne.
- `README.md`, `DEV.md`, `OPTIMIZATION_PLAN.md` — dokumentacja.

## Nieruszone

- PRO100 / usługi.
- ROZRYS.
- WYCENA.
- Polityka backupów.
- Fronty wieloczęściowe.
- Hurtowa zmiana materiałów.
