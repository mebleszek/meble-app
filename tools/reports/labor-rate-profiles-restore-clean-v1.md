# labor-rate-profiles-restore-clean-v1

## Cel

Przywrócono wyłącznie fundament profili stawek godzinowych w cenniku robocizny, bez dotykania WYWIADU, modala szafki, źródeł danych w trybiku i automatów robocizny.

## Zakres

- Cztery systemowe stawki godzinowe: `workshop` 150 zł/h, `assembly` 250 zł/h, `specialist` 300 zł/h, `helper` 80 zł/h.
- Tryb formularza `To jest stawka godzinowa` dla pozycji cennika robocizny.
- Dla stawki godzinowej formularz pokazuje nazwę przyjazną, kod techniczny stawki, kwotę zł/h i aktywność; pola reguły robocizny są ukrywane.
- Zwykła czynność wybiera `Stawka godzinowa` z aktywnych profili, także z przyszłych stawek użytkownika, np. `painter`.
- Stawki godzinowe są nieusuwalne; można zmieniać nazwę, kwotę i aktywność.
- Dedup po kodzie stawki usuwa błędne stare duble typu `assembly=150` i `specialist=250` na rzecz kanonicznych wartości startowych, jeśli użytkownik ich świadomie nie edytował.

## Poza zakresem

- Nie dodano automatów robocizny.
- Nie dodano źródeł danych w trybiku.
- Nie podpinano nic do modala szafki.
- Nie ruszano `cabinet-modal.js`, `cabinets-render.js`, materiałów, WYCENY ani `quoteCalculationRegister`.

## Audyt antyregresyjny

Zmienione pliki aplikacji:

- `index.html` — tylko formularz cennika robocizny i cache-busting.
- `js/app/pricing/labor-catalog-definitions.js` — domyślne ceny i metadane stawek.
- `js/app/pricing/labor-catalog.js` — profile stawek, deduplikacja i walidacje.
- `js/app/catalog/catalog-store.js` — zapis `quoteRates` przechodzi przez deduplikację/normalizację.
- `js/app/material/price-modal-item-form.js` — tryb formularza stawki godzinowej i dynamiczny wybór profilu stawki.
- `js/app/material/price-modal-persistence.js` — walidacja i blokada usunięcia stawki godzinowej.
- `js/app/material/price-modal-field-help.js` — opisy pól stawki godzinowej.

Kontrola plików krytycznych WYWIADU:

- `js/app/cabinet/cabinet-modal.js` — niezmieniony.
- `js/app/ui/cabinets-render.js` — niezmieniony.
- `css/cabinet-common.css` — niezmieniony.

Kontrola rozmiaru plików po zmianie:

- `labor-catalog.js`: 416 linii.
- `price-modal-item-form.js`: 486 linii.
- `catalog-store.js`: 589 linii.

Nie przekroczono progu 600 linii, ale `catalog-store.js` zostaje blisko limitu i nie powinien przyjmować kolejnej logiki domenowej bez wydzielenia.
