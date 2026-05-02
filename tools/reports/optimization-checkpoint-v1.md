# Optimization checkpoint v1 — 2026-05-03

## Baza

- Baza startowa: `site_app_legacy_bridges_v1.zip`.
- Zakres: checkpoint optymalizacji po splitach `investor-ui.js` i `app.js`.
- Bez zmian UI, bez RYSUNKU, bez zmian statusów/ofert i bez zmian runtime storage.

## Decyzja

Nie wykonano kolejnego cięcia `app.js`, bo po dwóch ostatnich paczkach ma ok. 354 linie i kolejne sensowne granice dotykają już startu/runtime validation/render shell. To jest średnie ryzyko i nie powinno być robione tylko dla liczby linii.

Zamiast tego wybrano bezpieczny dług architektoniczny w narzędziach testowych: `js/testing/investor/tests.js` miał 911 linii i mieszał kilka suit testów Inwestora. To utrudniało rozwój testów oraz maskowało problem izolacji danych testowych.

## Wykonane

Rozdzielono testy Inwestora na mniejsze suity:

- `js/testing/investor/helpers.js`
- `js/testing/investor/suites/architecture.js`
- `js/testing/investor/suites/registry-core.js`
- `js/testing/investor/suites/registry-manage.js`
- `js/testing/investor/suites/model-actions.js`
- `js/testing/investor/suites/status-flow.js`
- `js/testing/investor/suites/recovery-sources.js`
- `js/testing/investor/suites/recovery-isolation.js`
- `js/testing/investor/suites/misc.js`
- `js/testing/investor/tests.js` jako cienki agregator

`tests.js` spadł z 911 do 17 linii. Największa nowa suita ma poniżej 250 linii.

## Naprawa test-toolingu

Podczas uruchomienia pełnych testów Inwestora wyszły 2 błędy obecne już w bazie `site_app_legacy_bridges_v1.zip`: recovery testów inwestora odzyskiwał rekord z `fc_edit_session_v1` zostawiony przez wcześniejszy test, przez co testy snapshot-only dostawały dodatkowy rekord `inv_empty_rooms`.

Naprawiono to w fixture testowym, nie w runtime aplikacji: suita recovery zapisuje, czyści i przywraca `fc_edit_session_v1` wokół testów odzysku. Dzięki temu testy recovery sprawdzają właściwe źródło danych i nie mieszają się z wcześniejszymi testami.

## Wynik audytu największych kandydatów po paczce

Pomijając RYSUNEK odłożony na koniec, największe pliki nadal wymagające ostrożnej decyzji to głównie:

- `js/app/cabinet/cabinet-fronts.js` — ok. 837 linii,
- `js/app/cabinet/cabinet-modal-set-wizard.js` — ok. 692 linie,
- `js/app/cabinet/cabinet-modal.js` — ok. 649 linii,
- `js/app/ui/actions-register.js` — ok. 448 linii,
- `js/app/project/project-status-manual-guard.js` — ok. 394 linie,
- `js/tabs/material.js` — ok. 379 linii,
- `js/app/investor/investor-ui.js` — ok. 362 linie,
- `js/app.js` — ok. 354 linie,
- `js/tabs/wycena.js` — ok. 347 linii.

## Rekomendacja następnego kroku

Nie ciąć dalej `app.js` od razu. Następny refaktor powinien wynikać z faktycznego obszaru funkcjonalnego:

1. Jeśli ruszamy szafki/fronty — zacząć od audytu i splitu `cabinet-fronts.js` albo modal stacku szafek.
2. Jeśli ruszamy Inwestora — ewentualnie rozdzielić bindingi/akcje w `investor-ui.js`.
3. Jeśli ruszamy cenniki/materiały — przejrzeć `tabs/material.js`.
4. Jeśli nie planujemy nowej funkcji — można uznać bieżący etap ogólnej optymalizacji za prawie domknięty i przejść do konkretnej funkcji biznesowej.

## Testy

W tej paczce szczególnie ważny jest pełny test Inwestora, bo rozdzielono jego test suite i naprawiono izolację `fc_edit_session_v1` w fixture recovery.
