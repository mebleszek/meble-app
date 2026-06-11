# Robocizna: czysty porządek kategorii AGD / Montaż AGD v1

Baza: `site_labor_appliance_separate_automats_v1.zip`.

Zakres:

- usunięcie starej kategorii robocizny `AGD` z listy kategorii stawek wyceny,
- automatyczne odcięcie starych seedowanych pozycji `AGD` przy normalizacji katalogu robocizny,
- pozostawienie jednego działu `Montaż AGD`,
- uzupełnienie listy `Montaż AGD` do kompletu starego działu AGD,
- rozdzielenie okapu na podszafkowy/teleskopowy oraz kominowy/wyspowy,
- bez zmian jednostek czasu i bez globalnego zaokrąglania.

Nie ruszono:

- WYWIADU,
- modala szafki,
- historii ofert i snapshotów,
- `drawer.count`,
- warunków automatów,
- audytu robocizny,
- szybkich opcji czasu w UI.
