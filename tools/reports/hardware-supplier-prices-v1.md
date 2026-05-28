# Hardware supplier prices v1 — 2026-05-10

Baza startowa: `site_hardware_purchase_plan_notes_v1.zip`.

## Zakres

- Dodano wiele cen dostawców przy jednej pozycji katalogu okuć.
- Formularz okucia ma sekcję `Ceny u dostawców`, gdzie dostawcy pochodzą z listy dostawców okuć.
- Przy każdej cenie można wpisać netto albo brutto; druga wartość jest wyliczana według VAT dostawcy.
- Jedna cena może być oznaczona jako `Do wyceny`; zaznaczenie innej odznacza poprzednią.
- Dawne płaskie pola ceny pozostają jako skrót kompatybilności dla listy i WYCENY, ale są wyprowadzane z ceny oznaczonej `Do wyceny`.
- XLSX rozdziela produkt techniczny (`Okucia`) od cen dostawców (`Ceny_dostawcow`).

## Model danych

`fc_accessories_v1` pozostaje głównym storage katalogu. Każde okucie może mieć tablicę:

```js
supplierPrices: [
  {
    supplierId,
    catalogPriceNet,
    catalogPriceGross,
    enteredPriceType,
    priceDate,
    useForQuote
  }
]
```

Wartości takie jak VAT, rabat i zakup po rabacie są liczone w locie z danych dostawcy. Snapshot oferty ma w przyszłości zapisać pełne wartości użyte w konkretnej wycenie.

## Excel

- `Okucia` zawiera dane produktu bez cen dostawców.
- `Ceny_dostawcow` zawiera jeden wiersz na jedną cenę danego okucia u danego dostawcy.
- Import dopasowuje cenę po `okucie + dostawca`, nie wymaga ręcznego `id_ceny`.
- Użytkownik może zduplikować wiersz ceny, zmienić dostawcę i cenę, a import doda/zmieni cenę tego dostawcy.

## Poza zakresem

- Nie dodawano automatyki wyboru ceny w WYCENIE.
- Nie tworzono snapshotów ofert.
- Nie tworzono listy zakupów po akceptacji.
- Nie ruszano RYSUNKU, WYWIADU, MATERIAŁÓW ani polityki backupów.

## Testy

- `node --check` dla nowych/zmienionych JS.
- `node tools/check-index-load-groups.js`.
- `node tools/app-dev-smoke.js`.
- `node tools/rozrys-dev-smoke.js`.
- `node tools/local-storage-source-audit.js`.
- `node tools/dependency-source-audit.js`.
- `node tools/wycena-architecture-audit.js`.
