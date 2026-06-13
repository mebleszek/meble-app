# catalog-migration-test-fix-v1

Cel: poprawić fałszywie negatywny test `Katalogi rozdzielają legacy materiały, akcesoria i stawki meblowe`.

Przyczyna błędu: migracja faktycznie przenosiła legacy usługę do `quoteRates`, ale test sprawdzał tylko `quoteRates[0]`. Po dodaniu systemowych stawek godzinowych pierwszy rekord listy jest stawką godzinową, a legacy usługa znajduje się dalej w tablicy.

Poprawka: test szuka rekordu `s_rate` w całym `quoteRates` i sprawdza, że jest zwykłą pozycją cennika, a nie stawką godzinową. Dodano też `tools/catalog-migration-test-fix-smoke.js`, który odtwarza przypadek w Node.

Zakres: tylko test i dokumentacja; bez zmian WYCENY, katalogów produkcyjnych, transportu, ORS, PCV i modelu oferty klienta.
