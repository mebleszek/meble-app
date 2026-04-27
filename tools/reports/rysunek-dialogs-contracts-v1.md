# RYSUNEK dialogs/contracts v1 — 2026-04-27

## Baza

- Start z: `site_rozrys_speedmax_split_v1_download.zip`.
- Zakres: tylko RYSUNEK etap 1 — usunięcie systemowych dialogów i kontrakty testowe.
- Bez zmian działania głównych funkcji RYSUNKU.
- Bez zmian wyglądu głównego UI.
- Bez ruszania ROZRYS / algorytmu rozkroju.
- Bez ruszania WYCENY runtime.

## Zmiany

1. Dodano `js/app/rysunek/rysunek-dialogs.js` jako mały adapter dialogów dla RYSUNKU.
2. `js/tabs/rysunek.js` nie używa już `alert`, `confirm`, `prompt`.
3. Informacje idą przez `FC.infoBox`.
4. Potwierdzenia idą przez `FC.confirmBox`.
5. Pytania o wartość liczbową idą przez własny modal `FC.panelBox` z polem `number`.
6. Testy RYSUNKU zostały zmienione z wykrywania długu na zakaz powrotu systemowych dialogów.
7. Load order uzupełniony w `index.html`, `dev_tests.html`, `tools/index-load-groups.js` i `tools/app-dev-smoke-lib/file-list.js`.

## Zachowany kontrakt funkcjonalny

- `Odbuduj z listy szafek` dalej wymaga potwierdzenia przed odbudową segmentu.
- `Usuń przerwę` dalej wymaga potwierdzenia.
- Komunikaty blokujące START/KONIEC i zakresy z przerwami dalej zatrzymują akcję.
- Dodawanie paneli, blend i przerw dalej wymaga wartości liczbowej w cm.
- Anulowanie modala liczbowego odpowiada dawnemu anulowaniu prompta: akcja nie jest wykonywana.
- Wartości `<= 0` albo niepoprawne dalej nie wykonują akcji.

## Audyt odpowiedzialności

- Nowy plik `js/app/rysunek/rysunek-dialogs.js`: jedna odpowiedzialność, adapter dialogów RYSUNKU, 144 linie.
- `js/tabs/rysunek.js`: nadal monolit render/interakcje/inspektor/lista wykończeń, ale bez systemowych dialogów. Następny etap powinien być split kontraktowy, nie dokładanie funkcji.
- Zmienione testy `js/testing/rysunek/tests.js`: 125 linii, utrzymują minimalny render i zakaz systemowych dialogów.

## Testy wykonane

- `node --check js/app/rysunek/rysunek-dialogs.js` — OK.
- `node --check js/tabs/rysunek.js` — OK.
- `node --check js/testing/rysunek/tests.js` — OK.
- `node tools/check-index-load-groups.js` — OK.
- `node tools/app-dev-smoke.js` — wynik raportu: 196/196 OK.
- `node tools/rozrys-dev-smoke.js` — wynik raportu: 72/72 OK.
- `node tools/dependency-source-audit.js` — raport odświeżony w `tools/reports/dependency-source-audit.md`.

## Następny bezpieczny krok

Następny etap RYSUNKU powinien być osobnym splitem, bez zmian zachowania:

1. `rysunek-state.js` — layout segmentu, zaznaczenia, zakresy.
2. `rysunek-render-svg.js` — generowanie SVG/stage.
3. `rysunek-inspector.js` — panel inspektora i akcje elementu.
4. `rysunek-finishes.js` — lista i etykiety wykończeń.
5. `rysunek-drag.js` — drag/drop i kolejność elementów.

Nie łączyć jeszcze geometrii RYSUNEK z ROZRYS, dopóki RYSUNEK nie ma osobnych kontraktów dla renderu, inspektora i interakcji.
