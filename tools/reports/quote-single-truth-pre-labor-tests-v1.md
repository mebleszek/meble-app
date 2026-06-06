# Raport: WYCENA jedna prawda przed robocizną v1

## Paczka

`site_quote_single_truth_pre_labor_tests_v1.zip`

## Cel

Etap przygotowuje WYCENĘ pod późniejsze liczenie robocizny. Priorytetem było sprawdzenie, czy nowe wyniki WYCENY są oparte o `quoteCalculationRegister`, a nie liczone równolegle w kilku miejscach, oraz zabezpieczenie parytetu MATERIAŁ ↔ WYCENA dla danych, do których później będzie podpięta robocizna.

## Analiza istniejącego pokrycia

Istniejące testy pokrywały już:

- PCV z centralnego edge store i politykę `PCV tylko dla laminatu`,
- bezpieczną regułę ilości zawiasów w kg,
- niedublowanie frontów i zawiasów dla zestawów,
- ścieżkę `WYWIAD/szafka → wymagania zawiasów → WYCENA`,
- generowanie WYCENY, snapshoty i ochronę przed duplikacją ofert,
- zapis słowników okuć z poprzedniego etapu.

Luki dotyczyły głównie testów przekrojowych: HDF, frontów, surowych metrów PCV w WYCENIE względem MATERIAŁU, jawnego sprawdzenia `quoteCalculationRegister` jako źródła snapshotu oraz zachowania ceny dostawcy oznaczonej `Do wyceny`.

## Zmiany runtime

- Rozszerzono normalizację materiału frontu z `Front: laminat • nazwa` na ogólny wzorzec `Front: typ • nazwa`.
- Poprawiono przeliczanie wymiarów frontów w `wycena-core-material-plan.js`: `w/h` z agregatu ROZRYS są traktowane jako mm, a `a/b` z surowych formatek jako cm. Usunięto zgadywanie po progu `300`, bo front 30 cm w agregacie ma dokładnie `300 mm`.
- Nie zmieniano modelu rejestru, snapshotów ani audytu, bo analiza pokazała, że właściwa ścieżka już istnieje. Dodano testy, które ją blokują przed regresją.

## Zmienione pliki

- `js/app/material/material-part-options.js`
- `js/app/material/material-edge-store.js`
- `js/app/rozrys/rozrys-part-helpers.js`
- `js/app/rozrys/rozrys.js`
- `js/app/wycena/wycena-core-material-plan.js`
- `js/app/rozrys/rozrys-lazy-manifest.js`
- `index.html`
- `dev_tests.html`
- `tools/quote-single-truth-pre-labor-smoke.js`
- `tools/app-dev-smoke.js`
- `README.md`
- `DEV.md`
- `QUOTE_CALCULATION_REGISTER.md`

## Dodane testy

`tools/quote-single-truth-pre-labor-smoke.js` sprawdza:

- HDF MATERIAŁ ↔ WYCENA dla jednej szafki, kilku szafek i wyboru kilku pokoi,
- fronty lakier/akryl/laminat w MATERIAŁ ↔ WYCENA,
- że front laminatowy trafia do wspólnej grupy materiału arkuszowego,
- PCV/obrzeża: surowe mb z WYCENY = edge store/MATERIAŁ, a `+10%` jest doliczane dopiero w WYCENIE,
- sumy `quoteCalculationRegister`: materiały, akcesoria, robocizna szafek, robocizna/stawki, montaż AGD, rabat i razem,
- że snapshot używa sum z rejestru, nawet jeśli wejściowo podane są inne `totals`,
- że audyt preferuje `snapshot.calculationRegister`,
- że cena dostawcy oznaczona `Do wyceny` jest używana; brak oznaczenia przy kilku cenach zostaje jako udokumentowany fallback do pierwszej ceny.

## Testy uruchomione

- `node tools/quote-single-truth-pre-labor-smoke.js`
- `node tools/quote-audit-material-quantities-fix-smoke.js`
- `node tools/cabinet-hinge-quantity-kg-smoke.js`
- `node tools/cabinet-set-material-cutlist-smoke.js`
- `node tools/wycena-hinge-quote-replacement-flow-smoke.js`
- `node tools/hardware-dictionary-save-actions-smoke.js`
- `node tools/wycena-generate-single-flow-smoke.js`
- `node tools/wycena-generate-action-registry-smoke.js`
- `node tools/wycena-duplicate-offer-guard-smoke.js`
- `node tools/wycena-snapshot-clean-store-smoke.js`
- `node tools/hardware-technical-name-ui-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`

Wynik: wszystkie powyższe testy przeszły. `app-dev-smoke`: `109/109 OK`, `Błędy: 0`.

## Zakres celowo nieruszony

- Nie dodano nowych wariantów szafek.
- Nie zmieniano UI.
- Nie wdrażano nowego liczenia robocizny.
- Nie finalizowano prowadnic, szuflad, cargo, podnośników ani innych okuć poza utrzymaniem istniejącej ścieżki zawiasów.
- Nie przebudowywano modelu wielu cen dostawców; ryzyko braku flagi `Do wyceny` jest tylko udokumentowane testem.
- Nie zmieniano import/export, backupów, storage ani mechaniki przyszłej chmury.

## Następny etap

Można przejść do właściwego projektowania i podpinania robocizny, ale tylko do wyniku WYCENY przechodzącego przez `quoteCalculationRegister`. Robocizna powinna dodawać linie do rejestru, a nie tworzyć osobny licznik sum.
